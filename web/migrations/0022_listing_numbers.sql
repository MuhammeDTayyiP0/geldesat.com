-- Human-readable listing numbers and stable listing URLs.
--
-- URLs become /ilan/<title-slug>-<listing_no>. The trailing number identifies
-- the listing, so the text part may change with the title and old links still
-- resolve (the app 301-redirects to the current slug). Slugs from before this
-- migration (<title>-<6 hex>) are kept in legacy_slug and redirect too.

ALTER TABLE listings ADD COLUMN IF NOT EXISTS listing_no bigint;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS legacy_slug text;

UPDATE listings l
SET listing_no = 1000000 + r.rn
FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM listings) r
WHERE r.id = l.id AND l.listing_no IS NULL;

CREATE SEQUENCE IF NOT EXISTS listing_no_seq START WITH 1000001;
SELECT setval('listing_no_seq', GREATEST((SELECT coalesce(max(listing_no), 1000000) FROM listings), 1000000));
ALTER TABLE listings ALTER COLUMN listing_no SET DEFAULT nextval('listing_no_seq');
ALTER TABLE listings ALTER COLUMN listing_no SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS listings_listing_no_idx ON listings (listing_no);

-- Rewrite slugs to the new shape, transliterating Turkish letters the same way
-- the app's slugify() does. Only rows still on the old format are touched.
UPDATE listings
SET legacy_slug = slug,
    slug = coalesce(
      nullif(
        trim(BOTH '-' FROM left(
          trim(BOTH '-' FROM regexp_replace(
            lower(translate(title, 'İIıĞğÜüŞşÖöÇçÂâÎîÛû', 'iiigguussooccaaiiuu')),
            '[^a-z0-9]+', '-', 'g')),
          72)),
        ''),
      'ilan') || '-' || listing_no
WHERE legacy_slug IS NULL AND slug !~ ('-' || listing_no || '$');

CREATE INDEX IF NOT EXISTS listings_lower_legacy_slug_idx ON listings (lower(legacy_slug)) WHERE legacy_slug IS NOT NULL;
