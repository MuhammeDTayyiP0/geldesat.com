-- Replies (quote a message), and per-user saved reply templates.
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS chat_templates jsonb NOT NULL DEFAULT '[]'::jsonb;
-- Case-insensitive substring search inside one chat stays on the conversation index.
CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages (conversation_id);
