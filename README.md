# Do2Earn Steem Comment Bot

Browser-based tool for the Steem account **@do2earn**. It does not use Cloudflare Worker, Cloudflare D1, or a server-side login service.

## Browser-only login

- The username is fixed to `@do2earn`.
- Enter the Posting Key only into the login form on the page.
- The page derives the key's public key locally and checks it against the public posting authority for `@do2earn` through the public Steem RPC. The private key is not sent to the RPC endpoint.
- The key stays only in JavaScript memory in the current tab. It is not written to localStorage, sessionStorage, GitHub, or a database.
- Logout clears the in-memory key. Refreshing or closing the tab also loses the key and requires signing in again.
- The page loads the SteemJS library from jsDelivr. If the library is unavailable, login and publishing will not work.

## Using the dashboard

1. Open the GitHub Pages site for this repository.
2. Enter the Posting Key for `@do2earn` and select **Login**.
3. Choose a hashtag and press **Check**.
4. Open each candidate post and review whether a promotional comment is genuinely relevant.
5. Select a campaign message and use **Review & publish** for one post at a time. Each comment requires a confirmation prompt; the page enforces at least 60 seconds between successful posts.
6. Log out when finished.

The page checks a limited sample of recent posts from the public Steem API; it cannot search all historical posts. Duplicate detection is based on recognized promotional text in replies and is not guaranteed to catch every variation. Please follow Steem community rules and avoid irrelevant or repetitive comments. There is no automatic bulk publishing.

## GitHub Actions

`.github/workflows/bot.yml` remains a scheduled **dry run** that discovers a small sample and prints suggestions to the Actions log. It does not publish comments and does not need a Posting Key or repository secrets.

## Security notes

- Never paste a Posting Key into a GitHub issue, commit, chat, or workflow log.
- The private key is handled locally by the page, but the page's JavaScript is downloaded from GitHub Pages and the SteemJS dependency is loaded from jsDelivr. Only enter your key when you trust the code currently being served.
- Browser-only mode works only while the page is open. It does not run unattended after the tab closes.
