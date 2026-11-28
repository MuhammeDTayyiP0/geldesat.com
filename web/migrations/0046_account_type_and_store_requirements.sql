-- Hesap türü (Bireysel / Kurumsal) ve kurumsal mağaza başvuru alanları.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'INDIVIDUAL';

DO $$
BEGIN
  ALTER TABLE profiles
    ADD CONSTRAINT profiles_account_type_check
    CHECK (account_type IN ('INDIVIDUAL', 'CORPORATE'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Mevcut mağaza sahiplerini kurumsal hesap türüne geçir.
UPDATE profiles p
SET account_type = 'CORPORATE'
WHERE account_type <> 'CORPORATE'
  AND EXISTS (SELECT 1 FROM stores s WHERE s.user_id = p.user_id);

ALTER TABLE store_applications
  ADD COLUMN IF NOT EXISTS business_type text,
  ADD COLUMN IF NOT EXISTS sector text,
  ADD COLUMN IF NOT EXISTS tax_office text,
  ADD COLUMN IF NOT EXISTS address text;

DO $$
BEGIN
  ALTER TABLE store_applications
    ADD CONSTRAINT store_applications_business_type_check
    CHECK (business_type IS NULL OR business_type IN ('SOLE', 'COMPANY'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS business_type text,
  ADD COLUMN IF NOT EXISTS sector text,
  ADD COLUMN IF NOT EXISTS tax_office text,
  ADD COLUMN IF NOT EXISTS tax_no text,
  ADD COLUMN IF NOT EXISTS address text;
