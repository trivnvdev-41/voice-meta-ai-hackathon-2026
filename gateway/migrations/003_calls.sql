CREATE TABLE IF NOT EXISTS call_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  wa_caller TEXT NOT NULL,
  recipe_id TEXT REFERENCES recipes(id),
  wa_call_id TEXT UNIQUE,
  cta_payload TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'ringing', 'active', 'ended', 'failed')),
  direction TEXT NOT NULL DEFAULT 'USER_INITIATED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);
