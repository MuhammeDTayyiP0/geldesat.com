-- The app names each message it sends; a retried send (timeout, bad network) gets the
-- message it already delivered instead of posting it twice.
alter table messages add column if not exists client_id text;
create unique index if not exists messages_client_id_idx on messages (conversation_id, sender_id, client_id) where client_id is not null;
