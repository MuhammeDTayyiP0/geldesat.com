-- Messaging: typed messages (photo, offer), delete-for-everyone, per-side
-- archive and "mark unread", chat photos, conversation reports and the
-- read-receipt privacy switch.

-- kind: text | image | offer. `content` always keeps a readable fallback
-- ("📷 Fotoğraf", "Teklif: …") so older clients still show something.
ALTER TABLE messages ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'text';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS meta jsonb;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS messages_conv_created_idx ON messages (conversation_id, created_at DESC);

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS buyer_archived_at timestamptz;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS seller_archived_at timestamptz;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS buyer_marked_unread boolean NOT NULL DEFAULT false;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS seller_marked_unread boolean NOT NULL DEFAULT false;

-- Photos sent in chats live with the conversation (and go when it is purged),
-- apart from listing photos so the listing-orphan sweep never touches them.
CREATE TABLE IF NOT EXISTS chat_images (
  id text PRIMARY KEY,
  conversation_id text NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  uploader_id text NOT NULL,
  mime_type text NOT NULL CHECK (mime_type = 'image/webp'),
  data bytea NOT NULL CHECK (octet_length(data) BETWEEN 1 AND 2097152),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_images_conversation_idx ON chat_images (conversation_id);

-- Reports can be about a conversation (optionally one message), not only a listing.
ALTER TABLE reports ALTER COLUMN listing_id DROP NOT NULL;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS conversation_id text;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS message_id text;

-- Privacy: when off, others don't see "Görüldü" for your reads.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS read_receipts boolean NOT NULL DEFAULT true;
