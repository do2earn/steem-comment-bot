import fs from "node:fs/promises";

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
const MAX_CANDIDATES = Math.max(1, Math.min(20, Number.parseInt(process.env.MAX_CANDIDATES || "5", 10) || 5));
const DRY_RUN = (process.env.DRY_RUN || "true").toLowerCase() !== "false";
const API_TIMEOUT_MS = 9000;

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
      url,
      ok: false,
      latencyMs: Math.round(performance.now() - started),
      error: error?.name === "TimeoutError" ? "Timeout" : String(error?.message || "Request failed")
    };
  }
}

async function selectApiFromActions() {
  console.log("Testing Steem RPC endpoints from the GitHub Actions runner...");
  const results = await Promise.all(API_NODES.map(probeApi));
  const healthy = results.filter(item => item.ok);
  const newestBlock = healthy.reduce((max, item) => Math.max(max, item.headBlockNumber), 0);
  const fresh = healthy
    .filter(item => newestBlock - item.headBlockNumber <= 20)
    .sort((a, b) => a.latencyMs - b.latencyMs);
  for (const item of results) {
    console.log(`API ${item.ok ? "OK" : "FAIL"} | ${item.latencyMs} ms | ${item.url}${item.ok ? ` | head block ${item.headBlockNumber}` : ` | ${item.error}`}`);
  }
  if (!fresh.length) throw new Error("No healthy, sufficiently up-to-date Steem API endpoint was found.");
  const selected = fresh[0];
  console.log(`Selected API for this read-only scan: ${selected.url} (${selected.latencyMs} ms; head block ${selected.headBlockNumber})`);
  return selected.url;
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

async function main() {
  if (!DRY_RUN) {
    throw new Error("Safety guard: GitHub Actions is read-only and must never publish comments.");
  }

  const campaign = JSON.parse(await fs.readFile(new URL("../campaigns/steem-flags.json", import.meta.url), "utf8"));
  if (!campaign.enabled) {
    console.log("Campaign disabled; nothing to do.");
    return;
  }

  const apiUrl = await selectApiFromActions();
  console.log("Do2Earn Steem Comment Bot — read-only candidate discovery");
  console.log("No Posting Key is used and no comments can be published.");
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

  const candidates = [];
  let skippedExisting = 0;
  let skippedUnverifiable = 0;
  for (const post of matching) {
    let replies;
    try {
      replies = await rpcAt(apiUrl, "condenser_api.get_content_replies", [post.author, post.permlink]);
    } catch (error) {
      skippedUnverifiable++;
      console.log(`SKIPPED (could not verify replies) | @${post.author}/${post.permlink} | ${String(error?.message || "RPC error").slice(0, 160)}`);
      continue;
    }
    if (!Array.isArray(replies)) {
      skippedUnverifiable++;
      console.log(`SKIPPED (invalid replies response) | @${post.author}/${post.permlink}`);
      continue;
    }
    if (replies.some(reply => reply?.author === ACCOUNT)) {
      skippedExisting++;
      console.log(`SKIPPED (existing @do2earn reply) | @${post.author}/${post.permlink}`);
      continue;
    }
    candidates.push(post);
    if (candidates.length >= MAX_CANDIDATES) break;
  }

  console.log(`Matching posts found in the 100-post sample: ${matching.length}`);
  console.log(`Skipped with existing @do2earn reply: ${skippedExisting}`);
  console.log(`Skipped because replies could not be verified: ${skippedUnverifiable}`);
  if (candidates.length === 0) {
    console.log("No eligible candidates found after duplicate checks.");
    return;
  }

  for (const [index, post] of candidates.entries()) {
    console.log("\n----------------------------------------");
    console.log(`Candidate ${index + 1}: @${post.author}/${post.permlink}`);
    console.log(`Title: ${cleanText(post.title)}`);
    console.log(`URL: https://www.steemx.org/@${post.author}/${post.permlink}`);
    console.log(`Original post published: ${post.created}`);
    console.log(`Suggested campaign: ${campaign.name}`);
  }

  console.log(`\nRead-only scan complete. ${candidates.length} candidate(s) shown; nothing was posted.`);
}

main().catch(error => {
  console.error("Read-only bot run failed:", String(error?.message || "Unknown error").slice(0, 400));
  process.exitCode = 1;
});
