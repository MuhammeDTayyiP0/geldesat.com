-- Public listing media lives in the configured Postgres database, not the
-- ephemeral function filesystem used by Vercel.
CREATE TABLE IF NOT EXISTS mobile_listing_images (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  storage_key text NOT NULL UNIQUE,
  mime_type text NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  data bytea NOT NULL CHECK (octet_length(data) BETWEEN 1 AND 2097152),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mobile_listing_images_user_idx
  ON mobile_listing_images (user_id, created_at DESC);
