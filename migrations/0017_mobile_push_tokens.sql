-- Device-scoped Expo push tokens. Existing notification rows remain unchanged.
CREATE TABLE IF NOT EXISTS mobile_push_tokens (
  token text PRIMARY KEY,
  user_id text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('ios', 'android')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mobile_push_tokens_user_idx ON mobile_push_tokens (user_id);
