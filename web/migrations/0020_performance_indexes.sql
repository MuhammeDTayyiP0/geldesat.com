-- Indexes for hot paths found in the review.

-- getListing looks listings up by lower(slug) (or id).
CREATE INDEX IF NOT EXISTS listings_lower_slug_idx ON listings (lower(slug));

-- "Is this photo still used by a listing?" checks use jsonb containment.
CREATE INDEX IF NOT EXISTS listings_images_gin_idx ON listings USING gin (images jsonb_path_ops);

-- Duplicate-report check.
CREATE INDEX IF NOT EXISTS reports_listing_reporter_idx ON reports (listing_id, reporter_id, status);

-- Unread counts and read receipts filter messages by conversation and sender.
CREATE INDEX IF NOT EXISTS messages_conv_sender_read_idx ON messages (conversation_id, sender_id, read_at);

-- Free-text search uses ILIKE '%q%', which only an index from pg_trgm can serve.
-- Creating the extension needs a privileged role; without it search still works,
-- just without these indexes.
DO $$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_trgm unavailable (%), skipping trigram indexes', SQLERRM;
  END;
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS listings_title_trgm_idx ON listings USING gin (title gin_trgm_ops)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS listings_description_trgm_idx ON listings USING gin (description gin_trgm_ops)';
  END IF;
END $$;
