# Do2Earn Steem Comment Bot

Browser-based comment campaign tool for the Steem account **@do2earn**. It uses no Cloudflare Worker, Cloudflare D1, server-side login, or Posting Key storage.

## Browser-only login and key handling
- The username is fixed to `@do2earn`.
- The Posting Key is verified in the browser and held only in JavaScript memory for the open tab. It is never written to browser storage, GitHub, or a database.
- Logout, refreshing, or closing the tab clears the in-memory session.

## Comment campaigns
- Saved promotional comments are individual HTML files in `campaigns/`.
- Choose a saved HTML campaign from the dropdown; its text loads into an editable editor.
- Select a hashtag and press **Check** to discover a limited sample of recent posts and temporarily queue eligible posts without a recognized @do2earn promotional reply.
- **Preview & Publish** shows the proposed comment and target count, then requires explicit confirmation before publishing the same edited comment to the queued targets.
- The queue is capped at 20 posts per scan, existing promotional replies are rechecked immediately before publishing, publishing attempts are at least 60 seconds apart, and a progress bar reports published/skipped/failed counts. The batch can be cancelled between attempts.
- The public Steem API only returns a limited sample; this tool does not search all historical posts. Review target relevance and follow Steem/community rules. Avoid irrelevant or repetitive comments.

## GitHub Actions
`.github/workflows/bot.yml` remains a scheduled **dry run** that discovers a small sample. It does not publish comments and does not need a Posting Key or repository secrets.

## Security notes
- Never paste a Posting Key into a GitHub issue, commit, chat, or workflow log.
- The page loads SteemJS from jsDelivr and page code from GitHub Pages. Only enter your key when you trust the code currently served.
- Browser-only mode works only while the page is open; it does not run unattended after the tab closes.
