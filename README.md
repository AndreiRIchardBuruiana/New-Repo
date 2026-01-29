# Subscription Finder

This script scans an IMAP inbox for messages that look like subscriptions (newsletters, marketing emails, or anything that includes List-Unsubscribe headers). It groups results by sender so you can quickly see which services are sending you emails.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Run the script with your IMAP credentials:

   ```bash
   IMAP_HOST=imap.gmail.com \
   IMAP_PORT=993 \
   IMAP_SECURE=true \
   IMAP_USER=you@example.com \
   IMAP_PASSWORD=app_password \
   node subscription_search.js
   ```

## Optional settings

- `SEARCH_WINDOW_DAYS` (default: `365`) — limit how far back to scan.
- `SUBSCRIPTION_KEYWORDS` — comma-separated keywords used to match subscription-like messages.

## Notes

- For Gmail and similar providers, use an app password if 2FA is enabled.
- The script only reads headers, so it does not download full message bodies.
