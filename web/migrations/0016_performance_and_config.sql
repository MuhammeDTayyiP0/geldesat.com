-- Performance composite indexes & Remote App Config

-- 1. Dynamic App Configuration (A/B testing, remote layout control, mobile app settings)
CREATE TABLE IF NOT EXISTS app_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- Seed initial configs
INSERT INTO app_config (key, value)
VALUES
  ('home_sections', '["hero", "categories", "featured", "recent", "stats"]'::jsonb),
  ('features', '{"ab_testing": true, "doping_enabled": true, "mobile_bottom_nav": true}'::jsonb),
  ('mobile_app', '{"min_ios_version": "1.0.0", "min_android_version": "1.0.0", "announcement": null}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 2. Composite performance indexes for listings
-- Category page filter (status = 'ACTIVE' and category_id in (...) order by created_at desc)
CREATE INDEX IF NOT EXISTS listings_cat_status_created_idx ON listings (category_id, status, created_at DESC);

-- Location filter (status = 'ACTIVE' and city = ... order by created_at desc)
CREATE INDEX IF NOT EXISTS listings_city_status_created_idx ON listings (city, status, created_at DESC);

-- User listings filter
CREATE INDEX IF NOT EXISTS listings_user_status_idx ON listings (user_id, status);

-- Price sorting on active listings
CREATE INDEX IF NOT EXISTS listings_status_price_idx ON listings (status, price);

-- Unread notifications lookup
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON notifications (user_id, read_at);
