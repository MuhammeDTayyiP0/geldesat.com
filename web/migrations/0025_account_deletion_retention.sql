-- Account deletion with a grace period, and chat retention.
--
-- Deleting an account: deletion_requested_at is set, listings are hidden
-- (previous status kept in status_before_deletion) and sessions end. Signing
-- in within 30 days restores everything. After 30 days the account and its
-- data are purged; chats stay with the other person, who sees "Silinmiş
-- kullanıcı".
--
-- Chats: each side can delete (hide) a chat for themselves. Once a chat is
-- gone on both sides (deleted or account closed), it is kept out of sight for
-- 60 days (purge_after) and then removed for good.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deletion_requested_at timestamptz;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS status_before_deletion text;

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS buyer_hidden_at timestamptz;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS seller_hidden_at timestamptz;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS purge_after timestamptz;
CREATE INDEX IF NOT EXISTS conversations_purge_after_idx ON conversations (purge_after) WHERE purge_after IS NOT NULL;
CREATE INDEX IF NOT EXISTS profiles_deletion_requested_idx ON profiles (deletion_requested_at) WHERE deletion_requested_at IS NOT NULL;

-- A removed listing must not take the buyer's and seller's chat with it.
ALTER TABLE conversations ALTER COLUMN listing_id DROP NOT NULL;
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_listing_id_fkey;
ALTER TABLE conversations
  ADD CONSTRAINT conversations_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE SET NULL;
