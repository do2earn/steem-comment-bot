# Do2Earn Steem Comment Bot

Browser-based comment campaign tool for the Steem account **@do2earn**, with a GitHub Actions runner for server-side API diagnostics and dry-run discovery. It uses no Cloudflare Worker or Cloudflare D1.

## Current architecture

- The GitHub Actions workflow tests configured Steem RPC endpoints **from the Actions runner**, not from the user's phone or browser.
- It selects the fastest responding healthy endpoint that is within 20 blocks of the newest healthy endpoint, to reduce the risk of selecting a stale node.
- Discovery uses that selected endpoint and inspects up to 100 recent posts, showing up to 20 matching candidates in the dry-run log.
- The scheduled workflow remains **dry-run only**. It does not publish comments yet.
- The browser dashboard still handles interactive login and manual comment publishing. Therefore, manual browser publishing still depends on the user's connection; server-side API diagnostics alone do not remove that dependency.

## Browser-only login and key handling

- The username is fixed to `@do2earn`.
- The Posting Key is verified in the browser and held only in JavaScript memory for the open tab. It is never written to browser storage or a database.
- Logout, refreshing, or closing the tab clears the in-memory session.
- Do not enter the Posting Key anywhere except the trusted dashboard.

## Comment campaigns

- Saved promotional campaigns are in `campaigns/`.
- The browser tool can select a campaign, preview it, and manually publish to queued targets.
- Before any server-side publishing is enabled, the next phase must add explicit publishing safeguards, duplicate-comment checks, real post verification, and a secure GitHub Actions secret for the Posting Key. The key must never be committed to the repository or printed in logs.
- Avoid irrelevant or repetitive comments and follow Steem/community rules.

## GitHub Actions

The workflow runs on a schedule and can also be started manually. It checks API latency and freshness from the GitHub-hosted runner, then performs a **read-only dry run**. It does not need a Posting Key or repository secrets at this stage.
