-- Drop redundant indexes, safely validate 0043 NOT VALID constraints, add missing
-- enum CHECK constraints, and add chat pin/mute/edit columns.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'stores_user_id_unique_idx') THEN
    DROP INDEX IF EXISTS stores_user_id_idx;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'stores_lower_slug_unique_idx') THEN
    DROP INDEX IF EXISTS stores_lower_slug_idx;
  END IF;
END $$;

DROP INDEX IF EXISTS listings_category_idx;
DROP INDEX IF EXISTS listings_city_idx;
DROP INDEX IF EXISTS listings_user_idx;

-- Validate 0043 NOT VALID constraints when existing rows conform; warn otherwise.
DO $$
BEGIN
  ALTER TABLE listings VALIDATE CONSTRAINT listings_price_positive;
EXCEPTION
  WHEN check_violation OR undefined_object THEN
    RAISE WARNING 'Could not validate listings_price_positive';
END $$;

DO $$
BEGIN
  ALTER TABLE listings VALIDATE CONSTRAINT listings_status_valid;
EXCEPTION
  WHEN check_violation OR undefined_object THEN
    RAISE WARNING 'Could not validate listings_status_valid';
END $$;

DO $$
BEGIN
  ALTER TABLE reviews VALIDATE CONSTRAINT reviews_rating_range;
EXCEPTION
  WHEN check_violation OR undefined_object THEN
    RAISE WARNING 'Could not validate reviews_rating_range';
END $$;

DO $$
BEGIN
  ALTER TABLE reviews VALIDATE CONSTRAINT reviews_no_self_review;
EXCEPTION
  WHEN check_violation OR undefined_object THEN
    RAISE WARNING 'Could not validate reviews_no_self_review';
END $$;

-- Enum CHECK constraints (NOT VALID first + safe VALIDATE so legacy data never blocks deploy).
DO $$
BEGIN
  ALTER TABLE profiles ADD CONSTRAINT profiles_role_valid
    CHECK (role IN ('USER', 'ADMIN')) NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE profiles VALIDATE CONSTRAINT profiles_role_valid;
EXCEPTION
  WHEN check_violation OR undefined_object THEN
    RAISE WARNING 'Could not validate profiles_role_valid';
END $$;

DO $$
BEGIN
  ALTER TABLE messages ADD CONSTRAINT messages_kind_valid
    CHECK (kind IN ('text', 'image', 'offer', 'location')) NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE messages VALIDATE CONSTRAINT messages_kind_valid;
EXCEPTION
  WHEN check_violation OR undefined_object THEN
    RAISE WARNING 'Could not validate messages_kind_valid';
END $$;

DO $$
BEGIN
  ALTER TABLE store_applications ADD CONSTRAINT store_applications_status_valid
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')) NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE store_applications VALIDATE CONSTRAINT store_applications_status_valid;
EXCEPTION
  WHEN check_violation OR undefined_object THEN
    RAISE WARNING 'Could not validate store_applications_status_valid';
END $$;

DO $$
BEGIN
  ALTER TABLE credit_orders ADD CONSTRAINT credit_orders_status_valid
    CHECK (status IN ('PENDING', 'PAID', 'APPROVED', 'REJECTED', 'CANCELLED')) NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE credit_orders VALIDATE CONSTRAINT credit_orders_status_valid;
EXCEPTION
  WHEN check_violation OR undefined_object THEN
    RAISE WARNING 'Could not validate credit_orders_status_valid';
END $$;

-- Chat power features: per-participant pin/mute & 15-minute message editing.
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS buyer_pinned_at timestamptz;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS seller_pinned_at timestamptz;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS buyer_muted_until timestamptz;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS seller_muted_until timestamptz;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_at timestamptz;

CREATE INDEX IF NOT EXISTS conversations_buyer_pinned_idx
  ON conversations (buyer_id, buyer_pinned_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS conversations_seller_pinned_idx
  ON conversations (seller_id, seller_pinned_at DESC NULLS LAST);
