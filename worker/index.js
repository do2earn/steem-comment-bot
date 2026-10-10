const ALLOWED_ORIGINS = new Set([
  "https://do2earn.dev",
  "https://www.do2earn.dev"
]);
const SESSION_TTL_SECONDS = 8 * 60 * 60;

function json(data, status, origin) {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "vary": "Origin"
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers["access-control-allow-origin"] = origin;
    headers["access-control-allow-credentials"] = "true";
    headers["access-control-allow-methods"] = "GET, POST, OPTIONS";
    headers["access-control-allow-headers"] = "Content-Type";
    headers["access-control-max-age"] = "600";
  }
  return new Response(JSON.stringify(data), { status, headers });
}
function getBearerToken(request) {
  const value = request.headers.get("Authorization") || "";
  return value.startsWith("Bearer ") ? value.slice(7).trim() : "";
}
async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}
function constantTimeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}
async function revokeSession(request, env) {
  const token = getBearerToken(request);
  if (token) await env.DB.prepare("DELETE FROM bot_sessions WHERE token_hash = ?").bind(await sha256(token)).run();
}
async function authenticated(request, env) {
  const token = getBearerToken(request);
  if (!token) return false;
  const tokenHash = await sha256(token);
  const row = await env.DB.prepare(
    "SELECT token_hash FROM bot_sessions WHERE token_hash = ? AND expires_at > ?"
  ).bind(tokenHash, Math.floor(Date.now() / 1000)).first();
  return Boolean(row);
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") {
      if (!ALLOWED_ORIGINS.has(origin)) return new Response(null, { status: 403 });
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": origin,
          "access-control-allow-credentials": "true",
          "access-control-allow-methods": "GET, POST, OPTIONS",
          "access-control-allow-headers": "Content-Type, Authorization",
          "access-control-max-age": "600",
          "vary": "Origin"
        }
      });
    }
    if (!ALLOWED_ORIGINS.has(origin)) return json({ error: "Origin not allowed." }, 403, origin);
    if (!env.DB || !env.STEEM_POSTING_KEY) return json({ error: "Secure authentication is not configured on the server." }, 503, origin);

    if (url.pathname === "/api/health" && request.method === "GET") {
      return json({ ok: true, authConfigured: true }, 200, origin);
    }

    if (url.pathname === "/api/login" && request.method === "POST") {
      let body;
      try { body = await request.json(); } catch { return json({ error: "Invalid request." }, 400, origin); }
      const username = String(body?.username || "").replace(/^@/, "").toLowerCase();
      const postingKey = String(body?.postingKey || "");
      if (username !== "do2earn" || !postingKey || !constantTimeEqual(postingKey, env.STEEM_POSTING_KEY)) {
        return json({ error: "Login failed. Only the @do2earn Posting Key is accepted." }, 401, origin);
      }
      // Never log or persist the submitted Posting Key. Only a random, hashed session token is stored.
      const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
      const token = [...tokenBytes].map(b => b.toString(16).padStart(2, "0")).join("");
      const tokenHash = await sha256(token);
      const now = Math.floor(Date.now() / 1000);
      await env.DB.prepare("DELETE FROM bot_sessions WHERE expires_at <= ?").bind(now).run();
      await env.DB.prepare("INSERT INTO bot_sessions (token_hash, expires_at, created_at) VALUES (?, ?, ?)")
        .bind(tokenHash, now + SESSION_TTL_SECONDS, now).run();
      return new Response(JSON.stringify({ authenticated: true, username: "@do2earn", sessionToken: token }), {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
          "access-control-allow-origin": origin,
          "access-control-allow-credentials": "true",
          "vary": "Origin"
        }
      });
    }

    if (url.pathname === "/api/session" && request.method === "GET") {
      const ok = await authenticated(request, env);
      return json({ authenticated: ok, username: ok ? "@do2earn" : null }, 200, origin);
    }

    if (url.pathname === "/api/logout" && request.method === "POST") {
      await revokeSession(request, env);
      return new Response(JSON.stringify({ authenticated: false }), {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
          "access-control-allow-origin": origin,
          "access-control-allow-credentials": "true",
          "vary": "Origin"
        }
      });
    }

    // No publishing endpoint exists in this version. Authentication alone never posts a comment.
    return json({ error: "Not found." }, 404, origin);
  }
};
