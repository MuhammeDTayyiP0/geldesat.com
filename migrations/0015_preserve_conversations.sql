-- Preserve conversations and chat history when a listing is deleted
alter table conversations alter column listing_id drop not null;

-- Replace ON DELETE CASCADE with ON DELETE SET NULL on conversations(listing_id)
do $$
declare
  fk_name text;
begin
  select tc.constraint_name into fk_name
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name
    and tc.table_schema = kcu.table_schema
  where tc.constraint_type = 'FOREIGN KEY'
    and tc.table_name = 'conversations'
    and kcu.column_name = 'listing_id'
  limit 1;

  if fk_name is not null then
    execute format('alter table conversations drop constraint %I', fk_name);
  end if;
end $$;

alter table conversations
  add constraint conversations_listing_id_fkey
  foreign key (listing_id) references listings(id) on delete set null;
