-- Missing hot-path indexes, safe integrity constraints (NOT VALID so existing
-- rows never block deploy), and saved_searches for search alerts.

CREATE INDEX IF NOT EXISTS listings_status_expires_idx ON listings (status, expires_at);
CREATE INDEX IF NOT EXISTS listings_status_featured_idx ON listings (status, featured_until) WHERE featured_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS listings_status_views_idx ON listings (status, view_count DESC);
CREATE INDEX IF NOT EXISTS stores_lower_slug_idx ON stores (lower(slug));
CREATE INDEX IF NOT EXISTS reports_conv_status_idx ON reports (conversation_id, status) WHERE conversation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS profiles_last_seen_idx ON profiles (last_seen_at);
CREATE INDEX IF NOT EXISTS messages_sender_idx ON messages (sender_id);
CREATE INDEX IF NOT EXISTS phone_reveals_viewer_idx ON phone_reveals (viewer_id);
CREATE INDEX IF NOT EXISTS reports_reporter_idx ON reports (reporter_id);
CREATE INDEX IF NOT EXISTS reviews_reviewer_idx ON reviews (reviewer_id);
CREATE INDEX IF NOT EXISTS boosts_user_idx ON boosts (user_id);
CREATE INDEX IF NOT EXISTS boosts_kind_ends_idx ON boosts (kind, ends_at);

DO $$
BEGIN
  ALTER TABLE listings ADD CONSTRAINT listings_price_positive CHECK (price > 0) NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE listings ADD CONSTRAINT listings_status_valid
    CHECK (status IN ('ACTIVE', 'INACTIVE', 'SOLD', 'PENDING', 'REJECTED')) NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE reviews ADD CONSTRAINT reviews_rating_range CHECK (rating BETWEEN 1 AND 5) NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE reviews ADD CONSTRAINT reviews_no_self_review CHECK (seller_id <> reviewer_id) NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS saved_searches (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  name text NOT NULL,
  category_slug text,
  city text,
  district text,
  q text,
  min_price numeric,
  max_price numeric,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  notify boolean NOT NULL DEFAULT true,
  last_notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS saved_searches_user_idx ON saved_searches (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS saved_searches_match_idx ON saved_searches (category_slug, city) WHERE notify = true;
