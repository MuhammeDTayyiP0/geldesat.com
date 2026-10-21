-- Over-the-air app updates (self-hosted Expo Updates server, see
-- src/lib/server/ota.ts and mobile-app/OTA_GUNCELLEME.md).

-- Every file an update ships (JS bundle, images, fonts), stored once by its
-- content hash: an unchanged image is shared by every later update.
CREATE TABLE IF NOT EXISTS ota_assets (
  hash text PRIMARY KEY,                -- base64url SHA-256 of data
  content_type text NOT NULL,
  data bytea NOT NULL CHECK (octet_length(data) BETWEEN 1 AND 52428800),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One row per platform per published update. A publish for iOS and Android
-- shares one group_id, which the admin panel shows as a single update.
CREATE TABLE IF NOT EXISTS ota_updates (
  id uuid PRIMARY KEY,
  group_id text NOT NULL,
  runtime_version text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('ios', 'android')),
  channel text NOT NULL DEFAULT 'production',
  -- update: a JS bundle to download. rollback: go back to the build's own code.
  kind text NOT NULL DEFAULT 'update' CHECK (kind IN ('update', 'rollback')),
  launch_asset jsonb,                   -- { hash, key, contentType, fileExtension }
  assets jsonb NOT NULL DEFAULT '[]'::jsonb,
  expo_client jsonb NOT NULL DEFAULT '{}'::jsonb,
  message text NOT NULL DEFAULT '',
  -- Share of devices that get it (0 = paused). Same bucket idea as feature flags.
  rollout smallint NOT NULL DEFAULT 100 CHECK (rollout BETWEEN 0 AND 100),
  -- Critical updates restart the app as soon as they are downloaded.
  critical boolean NOT NULL DEFAULT false,
  republished_from text,                -- group_id this one was copied from (rollback to an older version)
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (kind = 'rollback' OR launch_asset IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS ota_updates_lookup_idx ON ota_updates (runtime_version, platform, channel, created_at DESC);
CREATE INDEX IF NOT EXISTS ota_updates_group_idx ON ota_updates (group_id);

-- The old placeholder "A/B testing" switch did nothing; feature flags with
-- rollout percentages replace it.
UPDATE app_config SET value = value - 'ab_testing' WHERE key = 'features';
