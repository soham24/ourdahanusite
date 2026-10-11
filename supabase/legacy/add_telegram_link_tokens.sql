-- ============================================================
-- Telegram link tokens
--   User clicks "Connect Telegram" → server generates a token →
--   user opens t.me/<bot>?start=<token> → bot webhook matches
--   the token to user_id and saves their chat_id to
--   notification_preferences.telegram_chat_id.
-- ============================================================

CREATE TABLE IF NOT EXISTS telegram_link_tokens (
  token text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE telegram_link_tokens ENABLE ROW LEVEL SECURITY;

-- No client access; all reads/writes go through the server using the admin client.

CREATE INDEX IF NOT EXISTS idx_tg_link_tokens_user
  ON telegram_link_tokens (user_id, created_at DESC);
