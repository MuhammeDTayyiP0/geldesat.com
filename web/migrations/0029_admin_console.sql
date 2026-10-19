-- Admin console: audit trail, account suspension, report resolution notes.

-- Every admin write is recorded here (who, what, on which record).
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id text PRIMARY KEY,
  admin_id text NOT NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  summary text NOT NULL DEFAULT '',
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx ON admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_target_idx ON admin_audit_log (target_type, target_id, created_at DESC);

-- Suspension: a banned account cannot sign in, its sessions are ended and its
-- live listings are hidden (previous status kept in status_before_ban so lifting
-- the ban puts them back). admin_note is an internal note only admins see.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banned_at timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ban_reason text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS admin_note text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS status_before_ban text;
CREATE INDEX IF NOT EXISTS profiles_banned_idx ON profiles (banned_at) WHERE banned_at IS NOT NULL;

-- Reports keep who closed them, when, and why.
ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolved_by text;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolution_note text;

-- Admin list screens filter and sort on these.
CREATE INDEX IF NOT EXISTS profiles_created_idx ON profiles (created_at DESC);
CREATE INDEX IF NOT EXISTS listings_created_idx ON listings (created_at DESC);
CREATE INDEX IF NOT EXISTS reviews_created_idx ON reviews (created_at DESC);
CREATE INDEX IF NOT EXISTS category_attributes_attr_idx ON category_attributes (attribute_id);

-- Listing moderation policy, editable from the admin console.
--   first_free: a member's first listing goes live, later ones wait for review (previous behaviour)
--   all:        every listing waits for review
--   none:       listings go live immediately
INSERT INTO app_config (key, value)
VALUES ('moderation', '{"mode": "first_free"}'::jsonb)
ON CONFLICT (key) DO NOTHING;
