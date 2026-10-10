import fs from "node:fs/promises";

const API_URL = process.env.STEEM_API_URL || "https://api.steemit.com";
const MAX_CANDIDATES = Math.max(1, Math.min(20, Number.parseInt(process.env.MAX_CANDIDATES || "5", 10) || 5));
const DRY_RUN = (process.env.DRY_RUN || "true").toLowerCase() !== "false";

async function rpc(method, params) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
    signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) throw new Error(`Steem API HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.error) throw new Error(payload.error.message || "Steem API returned an error");
  return payload.result;
}

function normalizeTags(metadata) {
  try {
    const parsed = typeof metadata === "string" ? JSON.parse(metadata || "{}") : (metadata || {});
    return Array.isArray(parsed.tags) ? parsed.tags.map(t => String(t).toLowerCase()) : [];
  } catch {
    return [];
  }
}

function cleanText(value) {
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

async function main() {
  if (!DRY_RUN) {
    throw new Error("Safety guard: this starter only supports DRY_RUN=true and never publishes comments.");
  }

  const campaign = JSON.parse(await fs.readFile(new URL("../campaigns/steem-flags.json", import.meta.url), "utf8"));
  if (!campaign.enabled) {
    console.log("Campaign disabled; nothing to do.");
    return;
  }

  console.log("Do2Earn Steem Comment Bot — DRY RUN");
  console.log("No comments will be published. Fetching recent public posts…");

  const discussions = await rpc("condenser_api.get_discussions_by_created", [{
    tag: campaign.tags[0],
    limit: 30
  }]);

  const candidates = discussions
    .filter(post => post && post.author && post.permlink && post.title)
    .filter(post => post.author !== "do2earn")
    .filter(post => normalizeTags(post.json_metadata).some(tag => campaign.tags.includes(tag)))
    .filter(post => {
      const text = `${post.title} ${cleanText(post.body)}`.toLowerCase();
      return campaign.keywords.some(keyword => text.includes(keyword.toLowerCase()));
    })
    .slice(0, MAX_CANDIDATES);

  if (candidates.length === 0) {
    console.log("No matching candidates found in this sample.");
    return;
  }

  for (const [index, post] of candidates.entries()) {
    console.log("\n----------------------------------------");
    console.log(`Candidate ${index + 1}: @${post.author}/${post.permlink}`);
    console.log(`Title: ${cleanText(post.title)}`);
    console.log(`URL: https://steemit.com/@${post.author}/${post.permlink}`);
    console.log(`Suggested campaign: ${campaign.name}`);
    console.log("Suggested comment (preview only):");
    console.log(campaign.comment);
  }

  console.log(`\nDry run complete. ${candidates.length} candidate(s) shown; nothing was posted.`);
}

main().catch(error => {
  console.error("Bot run failed:", error.message);
  process.exitCode = 1;
});
