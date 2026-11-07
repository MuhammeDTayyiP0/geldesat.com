-- Every listing page counts phone reveals; the admin dashboard filters these by date.
create index if not exists phone_reveals_listing_idx on phone_reveals (listing_id);
create index if not exists phone_reveals_created_idx on phone_reveals (created_at);
create index if not exists favorites_created_idx on favorites (created_at);
create index if not exists messages_created_idx on messages (created_at);

-- (conversation_id, created_at) already serves these lookups; extra copies only slow writes.
drop index if exists messages_conversation_idx;
drop index if exists messages_conv_idx;
