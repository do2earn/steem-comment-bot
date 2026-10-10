# Do2Earn Steem Comment Bot

Private project for account @do2earn. The discovery workflow remains dry-run only and does not publish comments.

## Secure login API (Cloudflare Worker)

The Worker provides fixed-account login, an HttpOnly Secure SameSite session cookie, server-side session revocation on logout, and D1-backed session expiry. It accepts only username `do2earn` and a Posting Key matching the Worker Secret `STEEM_POSTING_KEY`. The submitted key is never logged or stored in D1; only a hash of a random session token is stored.

**Important:** the dashboard does not enable login until the Worker is deployed and the placeholder API URL in `index.html` and the website copy is replaced with the real Worker URL. There is no publishing endpoint in this version; signing in cannot publish anything.

### Deploy prerequisites

1. In Cloudflare, create a D1 database named `steem-comment-bot-sessions`.
2. Copy its database ID into `wrangler.toml`, replacing `REPLACE_WITH_D1_DATABASE_ID`.
3. Set repository Actions secrets:
   - `CLOUDFLARE_API_TOKEN` (Workers Scripts: Edit and D1: Edit permissions)
   - `CLOUDFLARE_ACCOUNT_ID`
4. In Cloudflare Workers & Pages, set Worker Secret `STEEM_POSTING_KEY` to the Posting Key for @do2earn. Never commit it or send it in chat.
5. Run **Deploy Steem Comment Bot API** from GitHub Actions.
6. Replace `https://steem-comment-bot-api.YOUR-SUBDOMAIN.workers.dev` in both dashboard HTML files with the actual Worker URL, then commit.
7. Check `https://<your-worker>.workers.dev/api/health` from the dashboard origin; it should return `{"ok":true,"authConfigured":true}` when secrets and D1 are configured.

### Security notes

- Only the exact origins `https://do2earn.dev` and `https://www.do2earn.dev` are allowed by CORS.
- Sessions expire after 8 hours; logout deletes the server-side session and clears the cookie.
- Do not use the Posting Key anywhere except the HTTPS login form. The Worker compares it to its configured secret and discards the submitted value.
- This login restricts the web dashboard. Any future search/publish endpoint must independently require a valid server session and enforce rate limits, duplicate protection, and human approval.
- Current code intentionally has no comment publishing endpoint.
