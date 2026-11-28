-- Genişletilmiş kullanıcı tercihleri (sessiz saatler, satıcı/alışveriş ayarları) ve geri bildirim tablosu.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS user_prefs jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS user_feedback (
  id text PRIMARY KEY,
  user_id text,
  category text NOT NULL DEFAULT 'suggestion',
  message text NOT NULL,
  page_url text,
  platform text NOT NULL DEFAULT 'web',
  app_version text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_feedback_created_idx ON user_feedback (created_at DESC);
