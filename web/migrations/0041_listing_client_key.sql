-- The app sends a random key with a new listing; a retried "Yayınla" (slow network,
-- timeout) finds the listing it already created instead of creating a second one.
alter table listings add column if not exists client_key text;
create unique index if not exists listings_client_key_idx on listings (user_id, client_key) where client_key is not null;
