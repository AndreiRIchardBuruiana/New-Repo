import { ImapFlow } from "imapflow";

const requiredEnv = [
  "IMAP_HOST",
  "IMAP_PORT",
  "IMAP_SECURE",
  "IMAP_USER",
  "IMAP_PASSWORD"
];

const missing = requiredEnv.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(
    "Missing required environment variables:\n" +
      missing.map((name) => `- ${name}`).join("\n") +
      "\n\nExample usage:\n" +
      "IMAP_HOST=imap.gmail.com \\\nIMAP_PORT=993 \\\nIMAP_SECURE=true \\\nIMAP_USER=you@example.com \\\nIMAP_PASSWORD=app_password \\\nnode subscription_search.js"
  );
  process.exit(1);
}

const SEARCH_WINDOW_DAYS = Number(process.env.SEARCH_WINDOW_DAYS ?? 365);
const KEYWORDS = (process.env.SUBSCRIPTION_KEYWORDS ??
  "unsubscribe,subscription,newsletter,manage preferences")
  .split(",")
  .map((keyword) => keyword.trim())
  .filter(Boolean);

const client = new ImapFlow({
  host: process.env.IMAP_HOST,
  port: Number(process.env.IMAP_PORT),
  secure: process.env.IMAP_SECURE === "true",
  auth: {
    user: process.env.IMAP_USER,
    pass: process.env.IMAP_PASSWORD
  },
  logger: false
});

const seenSenders = new Map();
const sinceDate = new Date();
sinceDate.setDate(sinceDate.getDate() - SEARCH_WINDOW_DAYS);

const headerKeys = [
  "from",
  "subject",
  "date",
  "list-unsubscribe",
  "list-unsubscribe-post",
  "list-id"
];

const hasKeyword = (text) =>
  KEYWORDS.some((keyword) => text.toLowerCase().includes(keyword.toLowerCase()));

const recordSender = ({ sender, subject, listId, listUnsubscribe, date }) => {
  if (!sender) return;
  const normalizedSender = sender.toLowerCase();
  const existing = seenSenders.get(normalizedSender);

  const entry = {
    sender,
    subject,
    listId: listId || existing?.listId || "",
    listUnsubscribe: listUnsubscribe || existing?.listUnsubscribe || "",
    lastSeen: date || existing?.lastSeen || ""
  };

  seenSenders.set(normalizedSender, entry);
};

try {
  await client.connect();
  const lock = await client.getMailboxLock("INBOX");

  try {
    const messages = await client.search({ since: sinceDate }, { uid: true });

    for await (const message of client.fetch(messages, {
      uid: true,
      envelope: true,
      headers: headerKeys,
      bodyParts: []
    })) {
      const headers = message.headers || new Map();
      const listUnsubscribe = headers.get("list-unsubscribe") || "";
      const listId = headers.get("list-id") || "";
      const subject = message.envelope?.subject || "";
      const from = message.envelope?.from?.[0];
      const sender = from ? `${from.name ? `${from.name} ` : ""}<${from.address}>` : "";
      const date = message.envelope?.date?.toISOString?.() || "";

      const combinedText = [subject, listUnsubscribe, listId].join(" ");

      if (listUnsubscribe || listId || hasKeyword(combinedText)) {
        recordSender({
          sender,
          subject,
          listId,
          listUnsubscribe,
          date
        });
      }
    }
  } finally {
    lock.release();
  }

  await client.logout();
} catch (error) {
  console.error("Error scanning mailbox:", error);
  process.exitCode = 1;
}

if (!seenSenders.size) {
  console.log("No subscription-style messages found in the selected window.");
  process.exit(0);
}

const output = Array.from(seenSenders.values()).sort((a, b) =>
  a.sender.localeCompare(b.sender)
);

console.log("Found potential subscriptions:\n");
output.forEach((entry, index) => {
  console.log(`${index + 1}. ${entry.sender}`);
  if (entry.subject) {
    console.log(`   Subject: ${entry.subject}`);
  }
  if (entry.listId) {
    console.log(`   List-ID: ${entry.listId}`);
  }
  if (entry.listUnsubscribe) {
    console.log(`   Unsubscribe: ${entry.listUnsubscribe}`);
  }
  if (entry.lastSeen) {
    console.log(`   Last Seen: ${entry.lastSeen}`);
  }
  console.log("");
});
