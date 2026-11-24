-- Remaining integrity constraints, listing rejection reason, seller follows,
-- store applications, and duplicate report cleanup.

ALTER TABLE listings ADD COLUMN IF NOT EXISTS rejection_reason text;

CREATE TABLE IF NOT EXISTS seller_follows (
  follower_id text NOT NULL,
  seller_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, seller_id),
  CHECK (follower_id <> seller_id)
);
CREATE INDEX IF NOT EXISTS seller_follows_seller_idx ON seller_follows (seller_id);

CREATE TABLE IF NOT EXISTS store_applications (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  name text NOT NULL,
  city text,
  phone text,
  tax_no text,
  notes text,
  status text NOT NULL DEFAULT 'PENDING',
  reviewed_by text,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);
CREATE INDEX IF NOT EXISTS store_applications_user_idx ON store_applications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS store_applications_status_idx ON store_applications (status, created_at DESC);

-- Deduplicate open listing reports, keeping the newest per (listing_id, reporter_id).
DELETE FROM reports r USING reports newer
WHERE r.status = 'OPEN'
  AND r.conversation_id IS NULL
  AND r.listing_id IS NOT NULL
  AND newer.status = 'OPEN'
  AND newer.conversation_id IS NULL
  AND newer.listing_id = r.listing_id
  AND newer.reporter_id = r.reporter_id
  AND (newer.created_at, newer.id) > (r.created_at, r.id);

-- Deduplicate open chat/message reports, keeping the newest per (conversation_id, reporter_id, coalesce(message_id, '')).
DELETE FROM reports r USING reports newer
WHERE r.status = 'OPEN'
  AND r.conversation_id IS NOT NULL
  AND newer.status = 'OPEN'
  AND newer.conversation_id = r.conversation_id
  AND newer.reporter_id = r.reporter_id
  AND coalesce(newer.message_id, '') = coalesce(r.message_id, '')
  AND (newer.created_at, newer.id) > (r.created_at, r.id);

CREATE UNIQUE INDEX IF NOT EXISTS reports_open_listing_unique_idx
  ON reports (listing_id, reporter_id)
  WHERE status = 'OPEN' AND conversation_id IS NULL AND listing_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS reports_open_chat_unique_idx
  ON reports (conversation_id, reporter_id, coalesce(message_id, ''))
  WHERE status = 'OPEN' AND conversation_id IS NOT NULL;

DROP INDEX IF EXISTS messages_unread_idx;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM stores GROUP BY user_id HAVING count(*) > 1) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS stores_user_id_unique_idx ON stores (user_id);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM stores GROUP BY lower(slug) HAVING count(*) > 1) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS stores_lower_slug_unique_idx ON stores (lower(slug));
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
