-- Lets a client that missed live events catch up on changed messages too
-- (accepted offers, deleted messages), not only on new ones. Read receipts do
-- not count: they have their own catch-up.
alter table messages add column if not exists updated_at timestamptz;

create or replace function messages_touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists messages_touch_updated_at on messages;
create trigger messages_touch_updated_at
  before update of meta, content, deleted_at on messages
  for each row execute function messages_touch_updated_at();

create index if not exists messages_conv_updated_idx on messages (conversation_id, updated_at) where updated_at is not null;

-- Expiry reminders remember being sent themselves. Looking for the bell
-- notification failed for members who turned the bell off for this type: they
-- got a new push on every sweep.
alter table listings add column if not exists expiry_notified_at timestamptz;
