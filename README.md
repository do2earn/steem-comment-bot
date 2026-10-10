# Do2Earn Steem Comment Bot

A cautious, campaign-based helper for discovering relevant public Steem posts and preparing promotional comments for Do2Earn projects.

## Web dashboard

A mobile-friendly hashtag search page is available at https://do2earn.dev/steem-comment-bot/. Choose a hashtag (or type your own) and press **Check posts** to view recent public Steem posts. The dashboard is read-only and does not publish comments.

The source page is also stored in `index.html` in this repository.

## Current status

The first version is **dry-run only**. It does not publish comments, does not require a private key, and does not perform any account actions. It fetches recent posts from the public Steem API, filters for relevant `steemgame` content, and prints candidate posts plus a suggested campaign message.

## Safety defaults

- `DRY_RUN=true` by default; publishing is not implemented in this starter.
- No private keys or account credentials are needed.
- A per-run candidate cap limits the number of suggestions shown.
- Review each candidate and follow the community's rules; do not post unsolicited or repetitive promotions.

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
npm start
```

Optional environment variables:

- `DRY_RUN` — defaults to `true`.
- `MAX_CANDIDATES` — maximum candidates printed per run (default `5`).
- `STEEM_API_URL` — public API endpoint (default `https://api.steemit.com`).

## GitHub Actions

The workflow runs on a schedule and can also be started manually. It only performs dry-run discovery and does not publish comments.

## Next steps

Review candidate relevance and campaign wording before considering any future publishing feature. Any publishing feature should be explicitly enabled, rate-limited, and tested with manual approval first.
