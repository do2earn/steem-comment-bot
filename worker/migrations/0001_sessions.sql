CREATE TABLE IF NOT EXISTS bot_sessions (
  token_hash TEXT PRIMARY KEY NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bot_sessions_expiry ON bot_sessions(expires_at);
