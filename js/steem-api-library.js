/* Steem RPC API library for Do2Earn Steem Comment Bot.
 * Probes all configured public RPC nodes in parallel using a read-only request.
 * "Latency" means end-to-end browser RPC response time, not ICMP ping.
 */
(function (global) {
  "use strict";

  const API_NODES = Object.freeze([
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
  ]);

  const RPC_BODY = Object.freeze({
    jsonrpc: "2.0",
    method: "condenser_api.get_dynamic_global_properties",
    params: [],
    id: 1
  });

  async function probeNode(url, timeoutMs) {
    const startedAt = performance.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs || 9000);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(RPC_BODY),
        signal: controller.signal,
        cache: "no-store"
      });

      if (!response.ok) {
        return { url, ok: false, latencyMs: Math.round(performance.now() - startedAt), error: "HTTP " + response.status };
      }

      const payload = await response.json();
      const result = payload && payload.result;
      if (payload.error || !result || !Number.isFinite(Number(result.head_block_number))) {
        return { url, ok: false, latencyMs: Math.round(performance.now() - startedAt), error: "Invalid RPC response" };
      }

      return {
        url,
        ok: true,
        latencyMs: Math.round(performance.now() - startedAt),
        headBlockNumber: Number(result.head_block_number)
      };
    } catch (error) {
      return {
        url,
        ok: false,
        latencyMs: Math.round(performance.now() - startedAt),
        error: error && error.name === "AbortError" ? "Timeout" : "Network/CORS error"
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async function checkAll(options) {
    const timeoutMs = options && options.timeoutMs || 9000;
    const results = await Promise.all(API_NODES.map(url => probeNode(url, timeoutMs)));
    return results.sort((a, b) => {
      if (a.ok !== b.ok) return a.ok ? -1 : 1;
      return a.latencyMs - b.latencyMs;
    });
  }

  async function selectFastest(options) {
    const results = await checkAll(options);
    const available = results.filter(result => result.ok);
    return {
      selected: available.length ? available[0] : null,
      results,
      checkedCount: results.length,
      availableCount: available.length
    };
  }

  global.SteemApiLibrary = Object.freeze({
    nodes: API_NODES,
    checkAll,
    selectFastest
  });
})(window);
