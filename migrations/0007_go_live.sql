-- Go-live: real credit orders (no instant fake payment) + drop demo seed content.

create table if not exists credit_orders (
  id text primary key,
  user_id text not null,
  sku text not null,
  credits int not null,
  price int not null,
  status text not null default 'PENDING',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists credit_orders_user_idx on credit_orders (user_id, created_at desc);
create index if not exists credit_orders_status_idx on credit_orders (status, created_at desc);

delete from reviews where reviewer_id in ('demo-ali', 'demo-ayse', 'vitrin') or seller_id = 'vitrin';
delete from notifications where user_id in ('vitrin', 'demo-ali', 'demo-ayse');
delete from credit_ledger where user_id in ('vitrin', 'demo-ali', 'demo-ayse');
delete from saved_searches where user_id in ('vitrin', 'demo-ali', 'demo-ayse');
delete from listings where user_id = 'vitrin';
delete from stores where id = 'store-vitrin' or user_id = 'vitrin';
delete from profiles where user_id in ('vitrin', 'demo-ali', 'demo-ayse');
