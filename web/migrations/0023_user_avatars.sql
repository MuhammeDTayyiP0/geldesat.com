-- Profile photos, kept apart from listing images so the orphan sweep for
-- unattached listing uploads never touches them. One row per user; the URL
-- carries a version (?v=) so browsers refetch after a change.
CREATE TABLE IF NOT EXISTS user_avatars (
  user_id text PRIMARY KEY,
  mime_type text NOT NULL CHECK (mime_type = 'image/webp'),
  data bytea NOT NULL CHECK (octet_length(data) BETWEEN 1 AND 524288),
  updated_at timestamptz NOT NULL DEFAULT now()
);
