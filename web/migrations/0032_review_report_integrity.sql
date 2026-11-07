-- One rating per reviewer per seller, whatever the listing. Older rows allowed
-- one per listing, which let a single chat inflate a seller's average; the
-- newest rating of each pair is the one that stays.
delete from reviews r using reviews newer
where newer.seller_id = r.seller_id
  and newer.reviewer_id = r.reviewer_id
  and (newer.created_at, newer.id) > (r.created_at, r.id);
drop index if exists reviews_unique_idx;
create unique index if not exists reviews_seller_reviewer_idx on reviews (seller_id, reviewer_id);

-- A report outlives what it reports: deleting a listing must not erase the
-- complaint, and moderators need the content as it was when it was reported.
alter table reports drop constraint if exists reports_listing_id_fkey;
alter table reports add constraint reports_listing_id_fkey
  foreign key (listing_id) references listings(id) on delete set null;
alter table reports add column if not exists listing_snapshot jsonb;
alter table reports add column if not exists evidence jsonb;

-- A paid order credits once. Skipped if history already holds a duplicate, so
-- the deploy does not fail on money records nobody should delete automatically.
do $$
begin
  if not exists (
    select 1 from credit_ledger where reason like 'order:%' group by reason having count(*) > 1
  ) then
    create unique index if not exists credit_ledger_order_idx on credit_ledger (reason) where reason like 'order:%';
  end if;
end $$;

-- Push goes only to devices whose session is still alive.
alter table mobile_push_tokens add column if not exists session_id text;
