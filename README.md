# Do2Earn Steem Comment Bot

Browser-based promotional comment tool for the Steem account **@do2earn**. The website is hosted on GitHub Pages. GitHub Actions performs read-only Steem API diagnostics and candidate discovery. **Only the browser session that you control handles the Posting Key, signs comments, and broadcasts them to Steem.** No Cloudflare Worker or D1 is used.

## Security boundary

- The username is fixed to `@do2earn`.
- The Posting Key is entered only in the browser dashboard and held in JavaScript memory for the open tab.
- The key is not sent to GitHub Actions, a server, a database, or browser storage. Never create a GitHub secret for the Posting Key.
- Logout, refreshing, or closing the tab clears the in-memory browser session.
- The browser signs and broadcasts the comment directly to the selected Steem RPC endpoint. Therefore, keep the dashboard open and connected while a batch is running.
- Use the dashboard only after reviewing the public source code loaded from GitHub Pages. Do not enter your key if you do not trust the deployed code.

## GitHub Actions

The scheduled/manual `bot.yml` workflow is **read-only**:

- Tests configured public Steem RPC endpoints from the GitHub Actions runner and selects the fastest healthy endpoint within 20 blocks of the newest healthy endpoint.
- Scans up to 100 recent posts for the configured campaign tags and keywords.
- Checks replies before listing candidates. It skips posts that already have an `@do2earn` reply and skips a post if its replies cannot be verified.
- Prints candidate links using SteemX and the original post publication timestamps in the workflow log.
- It never asks for, reads, or uses a Posting Key and cannot publish comments.

The dashboard independently checks current posts and duplicate replies in the browser before offering a publish batch. The Actions discovery log is a diagnostic/report, not a live backend or an API endpoint consumed by the static dashboard.

## Publish comments from the dashboard

1. Open the GitHub Pages website and log in as `@do2earn` using the Posting Key.
2. Test the Steem API endpoints and apply the endpoint you want to use.
3. Choose a hashtag and press **Check**.
4. Review the candidate posts and select/edit the promotional comment.
5. Use **Preview & Publish** and explicitly confirm the batch.
6. Keep the browser tab open and online until the report is complete. Comments are signed and broadcast from the browser; GitHub Actions does not publish them.

The dashboard includes safeguards such as duplicate-reply checks, a capped batch, confirmation before publishing, a delay between publishing attempts, and a final report with the selected API, SteemX post links, original post dates, verified/unconfirmed/failed totals, and duration. Review the results carefully and follow Steem/community rules; relevance filtering cannot guarantee that every target is appropriate.

## Campaign content

- Saved promotional campaigns are in `campaigns/`.
- The dashboard's HTML comment files are selectable in the campaign menu.
- The read-only Actions discovery workflow uses `campaigns/steem-flags.json` for its tags and keyword filter.
