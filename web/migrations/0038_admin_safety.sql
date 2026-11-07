-- Earlier versions of a legal text, so a bad edit can be undone and it stays
-- known what a member could have read when.
create table if not exists legal_page_revisions (
  id bigserial primary key,
  slug text not null,
  title text not null,
  body text not null,
  replaced_at timestamptz not null default now(),
  replaced_by text
);
create index if not exists legal_page_revisions_slug_idx on legal_page_revisions (slug, replaced_at desc);

-- Old category addresses keep working after a rename.
create table if not exists category_old_slugs (
  slug text primary key,
  category_id text not null references categories(id) on delete cascade
);

-- Doping is not on sale, and nothing reads mobile_bottom_nav: neither should
-- show as "on for everyone" in the panel.
update app_config
set value = (value - 'mobile_bottom_nav') || case
      when value ? 'doping_enabled' and jsonb_typeof(value -> 'doping_enabled') = 'object'
        then jsonb_build_object('doping_enabled', (value -> 'doping_enabled') || '{"enabled": false}'::jsonb)
      when value ? 'doping_enabled' then '{"doping_enabled": false}'::jsonb
      else '{}'::jsonb
    end
where key = 'features' and jsonb_typeof(value) = 'object';
