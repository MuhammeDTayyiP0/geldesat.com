-- Recently viewed listings, per account. Only the latest 50 per user are kept
-- (older rows are trimmed on write); the user can remove one or all of them.
CREATE TABLE IF NOT EXISTS listing_views (
  user_id text NOT NULL,
  listing_id text NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, listing_id)
);
CREATE INDEX IF NOT EXISTS listing_views_user_idx ON listing_views (user_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS listing_views_listing_idx ON listing_views (listing_id);
