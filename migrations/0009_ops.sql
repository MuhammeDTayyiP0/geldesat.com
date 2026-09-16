create table if not exists site_settings (
  key text primary key,
  value text not null default ''
);

insert into site_settings (key, value) values
  ('company_name', 'GeldeSat'),
  ('iban', ''),
  ('bank_name', ''),
  ('account_holder', ''),
  ('support_email', 'destek@geldesat.com'),
  ('support_phone', '')
on conflict (key) do nothing;

create unique index if not exists profiles_phone_unique
  on profiles (phone)
  where phone is not null and phone <> '';
