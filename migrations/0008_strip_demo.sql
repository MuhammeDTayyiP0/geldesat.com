-- Idempotent: remove leftover demo seed accounts and stock listings.
delete from reviews where reviewer_id in ('demo-ali', 'demo-ayse', 'vitrin') or seller_id = 'vitrin';
delete from notifications where user_id in ('vitrin', 'demo-ali', 'demo-ayse');
delete from credit_ledger where user_id in ('vitrin', 'demo-ali', 'demo-ayse');
delete from saved_searches where user_id in ('vitrin', 'demo-ali', 'demo-ayse');
delete from listings where user_id in ('vitrin', 'demo-ali', 'demo-ayse') or id like 'lst-%';
delete from stores where id = 'store-vitrin' or user_id in ('vitrin', 'demo-ali', 'demo-ayse');
delete from profiles where user_id in ('vitrin', 'demo-ali', 'demo-ayse');
