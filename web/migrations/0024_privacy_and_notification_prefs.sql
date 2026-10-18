-- Per-user privacy and notification settings.
--
-- phone_visibility: who may reveal the seller's phone on a listing
--   everyone = anyone, members = signed-in users (previous behaviour), hidden = nobody (messages only).
-- show_whatsapp: whether listings offer a WhatsApp link once the phone is shown.
-- notify_prefs: {"<type>": {"inapp": bool, "push": bool}}; a missing key means "on".
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_visibility text NOT NULL DEFAULT 'members';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_whatsapp boolean NOT NULL DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notify_prefs jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_phone_visibility_check') THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_phone_visibility_check
      CHECK (phone_visibility IN ('everyone', 'members', 'hidden'));
  END IF;
END $$;
