-- Crashes and errors the app reports (K9), so a staged OTA rollout can be judged before it
-- reaches everyone. No account is stored; device_id is the app's random install id.
create table if not exists client_errors (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  platform text not null check (platform in ('ios', 'android')),
  app_version text,
  update_id text,
  device_id text,
  fatal boolean not null default false,
  message text not null,
  stack text,
  screen text
);
create index if not exists client_errors_created_idx on client_errors (created_at);
create index if not exists client_errors_update_idx on client_errors (update_id, created_at);
