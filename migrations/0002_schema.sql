-- GeldeSat marketplace schema

create table if not exists profiles (
  user_id text primary key,
  display_name text not null default '',
  phone text,
  bio text,
  city text,
  district text,
  avatar_url text,
  role text not null default 'USER',
  last_seen_at timestamptz default now(),
  created_at timestamptz not null default now()
);

create table if not exists stores (
  id text primary key,
  user_id text not null,
  name text not null,
  slug text unique not null,
  description text,
  city text,
  phone text,
  logo_url text,
  plan text not null default 'BASIC',
  created_at timestamptz not null default now()
);
create index if not exists stores_user_id_idx on stores (user_id);

create table if not exists categories (
  id text primary key,
  name text not null,
  slug text unique not null,
  parent_id text references categories(id) on delete cascade,
  icon text,
  sort_order int not null default 0
);
create index if not exists categories_parent_idx on categories (parent_id);

create table if not exists attribute_defs (
  id text primary key,
  name text not null,
  type text not null,
  options jsonb,
  unit text
);

create table if not exists category_attributes (
  category_id text not null references categories(id) on delete cascade,
  attribute_id text not null references attribute_defs(id) on delete cascade,
  required boolean not null default false,
  primary key (category_id, attribute_id)
);

create table if not exists listings (
  id text primary key,
  slug text unique not null,
  user_id text not null,
  store_id text references stores(id) on delete set null,
  category_id text not null references categories(id),
  title text not null,
  description text not null,
  price numeric not null,
  currency text not null default 'TRY',
  status text not null default 'ACTIVE',
  city text,
  district text,
  neighborhood text,
  lat double precision,
  lng double precision,
  images jsonb not null default '[]',
  attrs jsonb not null default '{}',
  view_count int not null default 0,
  featured_until timestamptz,
  expires_at timestamptz,
  phone_override text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists listings_status_created_idx on listings (status, created_at desc);
create index if not exists listings_category_idx on listings (category_id);
create index if not exists listings_city_idx on listings (city);
create index if not exists listings_user_idx on listings (user_id);
create index if not exists listings_price_idx on listings (price);
create index if not exists listings_featured_idx on listings (featured_until);
create index if not exists listings_store_idx on listings (store_id);

create table if not exists favorites (
  user_id text not null,
  listing_id text not null references listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);
create index if not exists favorites_listing_idx on favorites (listing_id);

create table if not exists conversations (
  id text primary key,
  listing_id text not null references listings(id) on delete cascade,
  buyer_id text not null,
  seller_id text not null,
  updated_at timestamptz not null default now(),
  unique (listing_id, buyer_id)
);
create index if not exists conversations_buyer_idx on conversations (buyer_id, updated_at desc);
create index if not exists conversations_seller_idx on conversations (seller_id, updated_at desc);

create table if not exists messages (
  id text primary key,
  conversation_id text not null references conversations(id) on delete cascade,
  sender_id text not null,
  content text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists messages_conv_idx on messages (conversation_id, created_at);
create index if not exists messages_unread_idx on messages (conversation_id, read_at);

create table if not exists reports (
  id text primary key,
  listing_id text not null references listings(id) on delete cascade,
  reporter_id text not null,
  reason text not null,
  details text,
  status text not null default 'OPEN',
  created_at timestamptz not null default now()
);
create index if not exists reports_status_idx on reports (status, created_at desc);

create table if not exists reviews (
  id text primary key,
  seller_id text not null,
  reviewer_id text not null,
  listing_id text references listings(id) on delete set null,
  rating int not null,
  comment text,
  created_at timestamptz not null default now()
);
create unique index if not exists reviews_unique_idx on reviews (seller_id, reviewer_id, listing_id);

create table if not exists price_history (
  id serial primary key,
  listing_id text not null references listings(id) on delete cascade,
  price numeric not null,
  recorded_at timestamptz not null default now()
);
create index if not exists price_history_listing_idx on price_history (listing_id, recorded_at);

create table if not exists credit_ledger (
  id text primary key,
  user_id text not null,
  amount int not null,
  reason text not null,
  created_at timestamptz not null default now()
);
create index if not exists credit_ledger_user_idx on credit_ledger (user_id, created_at desc);

create table if not exists boosts (
  id text primary key,
  listing_id text not null references listings(id) on delete cascade,
  user_id text not null,
  kind text not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null
);
create index if not exists boosts_listing_idx on boosts (listing_id, ends_at);

create table if not exists saved_searches (
  id text primary key,
  user_id text not null,
  label text,
  query text,
  filters jsonb,
  created_at timestamptz not null default now()
);
create index if not exists saved_searches_user_idx on saved_searches (user_id);

create table if not exists notifications (
  id text primary key,
  user_id text not null,
  type text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on notifications (user_id, created_at desc);

create table if not exists phone_reveals (
  id serial primary key,
  listing_id text not null references listings(id) on delete cascade,
  viewer_id text not null,
  created_at timestamptz not null default now()
);

create table if not exists legal_pages (
  slug text primary key,
  title text not null,
  body text not null
);
