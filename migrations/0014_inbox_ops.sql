create table if not exists user_blocks (
  blocker_id text not null,
  blocked_id text not null,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);
create index if not exists user_blocks_blocked_idx on user_blocks (blocked_id);
