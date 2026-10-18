insert into profiles (user_id, display_name, city, role)
values
  ('demo-ali', 'Ali Kaya', 'Adana', 'USER'),
  ('demo-ayse', 'Ayşe Demir', 'İstanbul', 'USER')
on conflict (user_id) do nothing;
