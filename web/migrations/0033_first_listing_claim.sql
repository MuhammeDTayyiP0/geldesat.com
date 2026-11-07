-- "First listing goes live" is once per member. Counting current listings let
-- anyone delete a listing and get automatic approval again.
alter table profiles add column if not exists first_listing_used boolean not null default false;
update profiles p set first_listing_used = true
where exists (select 1 from listings l where l.user_id = p.user_id);
