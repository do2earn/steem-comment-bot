import fs from "node:fs/promises";
import { steem } from "@steemit/steem-js";

const ACCOUNT = "do2earn";
const API_NODES = [
  "https://api.justyy.com",
  "https://steem.justyy.com",
  "https://api2.steemyy.com",
  "https://api2.justyy.com",
  "https://api.steemyy.com",
  "https://api.steemitdev.com",
  "https://api.steemit.com",
  "https://api3.justyy.com",
  "https://steem.senior.workers.dev",
  "https://api.steem.fans"
];
const API_TIMEOUT_MS = 9000;
const MAX_COMMENTS = Math.max(1, Math.min(10, Number.parseInt(process.env.MAX_COMMENTS || "3", 10) || 3));
const CONFIRM_PUBLISH = process.env.CONFIRM_PUBLISH === "true";
const CONFIRM_ACCOUNT = process.env.CONFIRM_ACCOUNT || "";
const POSTING_KEY = process.env.STEEM_POSTING_KEY || "";
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function rpcAt(apiUrl, method, params, timeoutMs = 20000) {
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.error) throw new Error(payload.error.message || "Steem API returned an error");
  return payload.result;
}

async function probeApi(url) {
  const started = performance.now();
  try {
    const result = await rpcAt(url, "condenser_api.get_dynamic_global_properties", [], API_TIMEOUT_MS);
    const headBlockNumber = Number(result?.head_block_number);
    if (!Number.isFinite(headBlockNumber)) throw new Error("Invalid RPC response");
    return { url, ok: true, latencyMs: Math.round(performance.now() - started), headBlockNumber };
  } catch (error) {
    return {
      url, ok: false, latencyMs: Math.round(performance.now() - started),
      error: error?.name === "TimeoutError" ? "Timeout" : String(error?.message || "Request failed")
    };
  }
}

async function selectApi() {
  console.log("Checking Steem RPC endpoints from the GitHub Actions runner...");
  const results = await Promise.all(API_NODES.map(probeApi));
  const healthy = results.filter(item => item.ok);
  const newestBlock = healthy.reduce((max, item) => Math.max(max, item.headBlockNumber), 0);
  const fresh = healthy.filter(item => newestBlock - item.headBlockNumber <= 20).sort((a, b) => a.latencyMs - b.latencyMs);
  for (const item of results) {
    console.log(`API ${item.ok ? "OK" : "FAIL"} | ${item.latencyMs} ms | ${item.url}${item.ok ? ` | block ${item.headBlockNumber}` : ` | ${item.error}`}`);
  }
  if (!fresh.length) throw new Error("No healthy, sufficiently up-to-date Steem API endpoint was found.");
  console.log(`Selected API: ${fresh[0].url} (${fresh[0].latencyMs} ms)`);
  return fresh[0].url;
}

function normalizeTags(metadata) {
  try {
    const parsed = typeof metadata === "string" ? JSON.parse(metadata || "{}") : (metadata || {});
    return Array.isArray(parsed.tags) ? parsed.tags.map(tag => String(tag).toLowerCase()) : [];
  } catch {
    return [];
  }
}

function cleanText(value) {
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function isDo2EarnReply(reply) {
  return reply?.author === ACCOUNT;
}

async function getReplies(apiUrl, post) {
  return await rpcAt(apiUrl, "condenser_api.get_content_replies", [post.author, post.permlink]);
}

async function isCommentVisible(apiUrl, post, expectedPermlink) {
  try {
    const replies = await getReplies(apiUrl, post);
    return replies.some(reply => reply.author === ACCOUNT && reply.permlink === expectedPermlink);
  } catch {
    return false;
  }
}

async function main() {
  const startedAt = Date.now();
  console.log("Do2Earn Steem Comment Bot — manual workflow");
  console.log(`Mode: ${CONFIRM_PUBLISH ? "PUBLISH REQUESTED" : "DRY RUN (safe default)"}`);
  console.log(`Maximum comments this run: ${MAX_COMMENTS}`);

  if (CONFIRM_PUBLISH) {
    if (CONFIRM_ACCOUNT !== "@do2earn") {
      throw new Error('Publishing blocked. To confirm, set the workflow input exactly to "@do2earn".');
    }
    if (!POSTING_KEY) {
      throw new Error("Publishing blocked: STEEM_POSTING_KEY secret is missing. No comments were posted.");
    }
  }

  const campaign = JSON.parse(await fs.readFile(new URL("../campaigns/steem-flags.json", import.meta.url), "utf8"));
  if (!campaign.enabled) {
    console.log("Campaign disabled; nothing to do.");
    return;
  }

  const apiUrl = await selectApi();
  steem.config.set({
    nodes: [apiUrl],
    address_prefix: "STM",
    chain_id: "0000000000000000000000000000000000000000000000000000000000000000"
  });

  if (CONFIRM_PUBLISH) {
    if (!steem.auth.isWif(POSTING_KEY)) {
      throw new Error("Publishing blocked: the configured secret is not a valid WIF private key.");
    }
    const accountResult = await steem.api.getAccountsAsync([ACCOUNT]);
    const account = accountResult?.[0];
    if (!account) throw new Error("Could not load @do2earn account details.");
    const publicKey = steem.auth.wifToPublic(POSTING_KEY);
    const isPostingKey = (account.posting?.key_auths || []).some(([key]) =>
      key === publicKey && steem.auth.wifIsValid(POSTING_KEY, key)
    );
    if (!isPostingKey) {
      throw new Error("Publishing blocked: the key does not match a direct @do2earn Posting authority key.");
    }
    console.log("Posting key check passed for @do2earn Posting authority. The key itself will not be logged.");
  }

  const discussions = await rpcAt(apiUrl, "condenser_api.get_discussions_by_created", [{
    tag: campaign.tags[0],
    limit: 100
  }]);

  const matching = discussions
    .filter(post => post && post.author && post.permlink && post.title)
    .filter(post => post.author !== ACCOUNT)
    .filter(post => normalizeTags(post.json_metadata).some(tag => campaign.tags.includes(tag)))
    .filter(post => {
      const text = `${post.title} ${cleanText(post.body)}`.toLowerCase();
      return campaign.keywords.some(keyword => text.includes(keyword.toLowerCase()));
    });

  const eligible = [];
  for (const post of matching.slice(0, 40)) {
    let replies;
    try {
      replies = await getReplies(apiUrl, post);
    } catch (error) {
      console.log(`SKIPPED (could not verify existing replies) | @${post.author}/${post.permlink} | ${String(error?.message || "RPC error")}`);
      continue;
    }
    if (replies.some(isDo2EarnReply)) {
      console.log(`SKIPPED (an existing @do2earn reply is present) | @${post.author}/${post.permlink}`);
      continue;
    }
    eligible.push(post);
    if (eligible.length >= MAX_COMMENTS) break;
  }

  if (!eligible.length) {
    console.log("No eligible targets found after duplicate checks.");
    console.log("\\n========== FINAL REPORT ==========");
    console.log(`Selected API: ${apiUrl}`);
    console.log(`Mode: ${CONFIRM_PUBLISH ? "PUBLISH" : "DRY RUN"}`);
    console.log("Verified published: 0 | Unconfirmed: 0 | Failed: 0");
    console.log(`Total duration: ${Math.round((Date.now() - startedAt) / 1000)} seconds.`);
    return;
  }

  let published = 0;
  let unconfirmed = 0;
  let failed = 0;
  const gapMs = 60000;

  for (let index = 0; index < eligible.length; index++) {
    const post = eligible[index];
    const url = `https://www.steemx.org/@${post.author}/${post.permlink}`;
    console.log("\n----------------------------------------");
    console.log(`Target ${index + 1}/${eligible.length}: ${url}`);
    console.log(`Title: ${cleanText(post.title)}`);
    console.log(`Original post published: ${post.created}`);

    if (!CONFIRM_PUBLISH) {
      console.log("DRY RUN: comment not published.");
      console.log(`Preview: ${campaign.comment}`);
      continue;
    }

    const commentPermlink = steem.formatter.commentPermlink(post.author, post.permlink);
    try {
      const result = await steem.broadcast.commentAsync(
        POSTING_KEY,
        post.author,
        post.permlink,
        ACCOUNT,
        commentPermlink,
        "",
        campaign.comment,
        JSON.stringify({ tags: campaign.tags, app: "do2earn-steem-comment-bot/1.0" })
      );
      const txId = result?.id || result?.trx_id || "accepted by RPC";
      console.log(`Broadcast response: ${txId}`);

      let confirmed = false;
      for (let attempt = 0; attempt < 5; attempt++) {
        await sleep(4000);
        if (await isCommentVisible(apiUrl, post, commentPermlink)) {
          confirmed = true;
          break;
        }
      }
      if (confirmed) {
        published++;
        console.log(`VERIFIED PUBLISHED | ${url} | Original post date: ${post.created}`);
      } else {
        unconfirmed++;
        console.log(`UNCONFIRMED (broadcast accepted, reply not yet visible) | ${url} | Original post date: ${post.created}`);
      }
    } catch (error) {
      failed++;
      console.log(`FAILED | ${url} | ${String(error?.message || "Broadcast failed").slice(0, 240)}`);
    }

    if (index < eligible.length - 1) {
      console.log("Waiting 60 seconds before the next publishing attempt.");
      await sleep(gapMs);
    }
  }

  console.log("\n========== FINAL REPORT ==========");
  console.log(`Selected API: ${apiUrl}`);
  console.log(`Mode: ${CONFIRM_PUBLISH ? "PUBLISH" : "DRY RUN"}`);
  console.log(`Verified published: ${published} | Unconfirmed: ${unconfirmed} | Failed: ${failed}`);
  console.log(`Targets checked: ${eligible.length}`);
  console.log(`Total duration: ${Math.round((Date.now() - startedAt) / 1000)} seconds.`);
  if (!CONFIRM_PUBLISH) console.log("No comments were published. Set the explicit confirmation inputs only when you intend to publish.");
}

main().catch(error => {
  // Never print environment values or raw request objects; only the error message is shown.
  console.error("Bot run failed:", String(error?.message || "Unknown error").slice(0, 400));
  process.exitCode = 1;
});
