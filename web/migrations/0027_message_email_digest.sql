-- E-mail digest for unread chat messages.
-- message_email: the user's opt-out switch (Bildirim tercihleri).
-- last_message_email_at: when the last digest went out; only messages after
-- it count for the next one, so the same messages are never mailed twice.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS message_email boolean NOT NULL DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_message_email_at timestamptz;
