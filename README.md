# Do2Earn Steem Comment Bot

Browser-based comment campaign tool for the Steem account **@do2earn**, with GitHub Actions for server-side API diagnostics, dry-run discovery, and a separate manually triggered publishing workflow. It uses no Cloudflare Worker or Cloudflare D1.

## Current architecture

- The scheduled `bot.yml` workflow tests configured Steem RPC endpoints from the GitHub Actions runner, selects the fastest healthy endpoint within 20 blocks of the newest healthy endpoint, and performs read-only discovery.
- Discovery inspects up to 100 recent posts and prints up to 20 matching candidates in the scheduled dry-run log.
- The separate `publish.yml` workflow is manual only; it has no schedule or push trigger.
- Publishing is disabled by default. To publish, the workflow input `confirm_publish` must be enabled and `confirm_account` must be exactly `@do2earn`.
- The Posting Key secret is injected into the publishing process only when both explicit confirmation inputs match. The script checks that the WIF key corresponds to a direct key in @do2earn's Posting authority before broadcasting.
- Before publishing, the script checks for any existing @do2earn reply on each target and skips targets where it cannot safely verify replies. It waits 60 seconds between broadcast attempts and polls the selected API for the published reply.
- The final report includes the selected API, each target's SteemX link, the original post publication timestamp, verified/unconfirmed/failed totals, and total duration.
- The browser dashboard remains available for interactive login and manual publishing. Server-side Actions runs do not depend on the phone's internet connection.

## Browser-only login and key handling

- The username is fixed to `@do2earn`.
- In the browser dashboard, the Posting Key is held only in JavaScript memory for the open tab; it is not written to browser storage or a database.
- Logout, refreshing, or closing the tab clears the in-memory browser session.
- Do not enter the Posting Key in source files, campaign JSON, workflow YAML, issues, or chat messages.

## Configure the publishing secret

1. Open the repository Settings.
2. Go to **Secrets and variables → Actions**.
3. Create a repository secret named exactly `STEEM_POSTING_KEY`.
4. Paste the Posting Key value into that secret field only. Never commit it to the repository and never print it in logs.

The secret is not needed by the scheduled workflow. The manual publishing workflow only passes it to the publishing script when both confirmation inputs are supplied. Anyone with write access to a repository can potentially modify workflows and access repository secrets, so keep write access restricted and review changes to `.github/workflows/` and dependencies carefully. GitHub secret masking is not a guarantee against malicious code.

## Manual workflow steps

1. Open **Actions → Steem Comment Bot — Manual Publish (Safe Default) → Run workflow**.
2. Leave **Enable publishing** unchecked for a dry-run preview.
3. For actual publication only, check **Enable publishing** and type exactly `@do2earn` in the confirmation field.
4. Start with a low maximum (1 or 3 comments), review the output, and only increase the count when the results are appropriate.

The publishing workflow is intentionally manual, capped at 10 comments per run, and serialized so two runs cannot publish concurrently. It uses a 60-second gap between broadcast attempts. An accepted broadcast that is not visible in the follow-up RPC checks is reported as unconfirmed, not as verified success.

## Campaigns and community rules

- Saved promotional campaigns are in `campaigns/`.
- The current Steem Flags comment is defined in `campaigns/steem-flags.json`.
- Relevance filtering and duplicate checks reduce accidental repetition but cannot guarantee that every target is appropriate. Review dry-run output before enabling publication and follow Steem/community rules.
