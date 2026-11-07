-- Legal pages show when they really changed, not a date written in the code.
alter table legal_pages add column if not exists updated_at timestamptz not null default '2026-09-16';

-- Search that does not depend on Turkish letters or word order ("kiralik daire"
-- finds "Daire, Kiralık"). Used behind the arama_v2 flag; see catalog.ts.
create or replace function tr_fold(t text) returns text
language sql immutable parallel safe
as $$ select translate(lower(replace(replace(t, 'İ', 'i'), 'I', 'ı')), 'ıışğüöçâîû', 'iisguocaiu') $$;

alter table listings add column if not exists search_text text
  generated always as (tr_fold(coalesce(title, '') || ' ' || coalesce(description, ''))) stored;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_trgm') then
    execute 'create index if not exists listings_search_text_trgm_idx on listings using gin (search_text gin_trgm_ops)';
  end if;
end $$;
