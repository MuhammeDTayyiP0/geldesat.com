-- Proof of what a member agreed to and when. Older accounts stay null: nothing
-- was recorded for them.
alter table profiles add column if not exists terms_accepted_at timestamptz;
alter table profiles add column if not exists terms_version text;
