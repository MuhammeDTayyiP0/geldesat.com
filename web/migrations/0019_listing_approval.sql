-- Listing moderation: record when an admin (or the auto-approval rule) let a
-- listing go live. Owners may only re-publish (INACTIVE/SOLD -> ACTIVE, renew)
-- listings that carry an approval; anything else goes back to the queue.
ALTER TABLE listings ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- Existing listings that are past moderation keep their approval. PENDING and
-- REJECTED rows stay unapproved.
UPDATE listings
SET approved_at = coalesce(updated_at, created_at)
WHERE approved_at IS NULL
  AND status IN ('ACTIVE', 'SOLD', 'INACTIVE');
