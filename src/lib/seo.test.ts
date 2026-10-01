import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { buildCategorySeo, buildListingSeo, isListingIndexable } from "./seo";
import type { ListingCard } from "./server/helpers";

test("category SEO uses the real category path and keeps pagination canonical", () => {
  const seo = buildCategorySeo({
    category: { id: "iphone-15", name: "iPhone 15", slug: "iphone-15" },
    path: [
      { id: "shopping", name: "İkinci El ve Sıfır Alışveriş", slug: "alisveris" },
      { id: "phones", name: "Cep Telefonu", slug: "cep-telefonu" },
      { id: "apple", name: "Apple", slug: "apple" },
      { id: "iphone-15", name: "iPhone 15", slug: "iphone-15" },
    ],
    result: { total: 42, page: 2, pages: 3 },
  });

  assert.match(seo.title, /Apple iPhone 15/);
  assert.equal(seo.canonicalUrl, "https://www.geldesat.com/category/iphone-15?page=2");
  assert.ok(seo.description.length <= 160);
});

test("listing indexability matches the active, unexpired sitemap policy", () => {
  const now = Date.parse("2026-10-01T00:00:00.000Z");
  assert.equal(isListingIndexable("ACTIVE", null, now), true);
  assert.equal(isListingIndexable("ACTIVE", "2026-10-02T00:00:00.000Z", now), true);
  assert.equal(isListingIndexable("ACTIVE", "2026-09-30T23:59:59.000Z", now), false);
  assert.equal(isListingIndexable("SOLD", null, now), false);
  assert.equal(isListingIndexable("ACTIVE", "not-a-date", now), false);
});

function listing(attrs: ListingCard["attrs"] = {}, expires_at: string | null = null): ListingCard {
  return {
    id: "listing-123456789",
    slug: "apple-iphone-15-123",
    user_id: "seller-1",
    store_id: null,
    category_id: "iphone-15",
    title: "Apple iPhone 15 128 GB",
    description: "Telefon açıklaması",
    price: 32000,
    currency: "TRY",
    status: "ACTIVE",
    city: "İstanbul",
    district: "Kadıköy",
    neighborhood: null,
    lat: null,
    lng: null,
    images: [],
    attrs,
    view_count: 12,
    featured_until: null,
    expires_at,
    created_at: "2026-01-01T10:00:00.000Z",
    updated_at: "2026-01-02T10:00:00.000Z",
    category_name: "iPhone 15",
  };
}

const listingPath = [
  { name: "İkinci El ve Sıfır Alışveriş", slug: "alisveris" },
  { name: "Cep Telefonu", slug: "cep-telefonu" },
  { name: "Apple", slug: "apple" },
  { name: "iPhone 15", slug: "iphone-15" },
];

test("listing SEO emits dynamic title, canonical and parseable data from listing fields", () => {
  const seo = buildListingSeo({ listing: listing({ Durum: "Sıfır" }, "2026-12-31T00:00:00.000Z"), path: listingPath });
  const jsonLd = JSON.parse(JSON.stringify(seo.structuredData)) as {
    name?: string;
    offers?: { price?: number; priceValidUntil?: string };
    itemCondition?: string;
    aggregateRating?: unknown;
  };

  assert.match(seo.title, /Apple iPhone 15/);
  assert.equal(seo.canonicalUrl, "https://www.geldesat.com/ilan/apple-iphone-15-123");
  assert.equal(jsonLd.name, "Apple iPhone 15 128 GB");
  assert.equal(jsonLd.offers?.price, 32000);
  assert.equal(jsonLd.offers?.priceValidUntil, "2026-12-31");
  assert.equal(jsonLd.itemCondition, "https://schema.org/NewCondition");
  assert.equal(jsonLd.aggregateRating, undefined);
});

test("listing SEO omits unverified validity dates and conditions", () => {
  const seo = buildListingSeo({
    listing: listing({ Renk: "Siyah" }),
    path: listingPath,
    seller: { id: "seller-1", name: "Satıcı", rating_avg: 4.9, rating_count: 25 },
  });
  const jsonLd = JSON.parse(JSON.stringify(seo.structuredData)) as {
    offers?: { priceValidUntil?: string };
    itemCondition?: string;
    aggregateRating?: unknown;
  };

  assert.equal(jsonLd.offers?.priceValidUntil, undefined);
  assert.equal(jsonLd.itemCondition, undefined);
  assert.equal(jsonLd.aggregateRating, undefined);
});

test("robots allows Google to read noindex on search pages in every serving config", async () => {
  const files = [
    new URL("../../public/robots.txt", import.meta.url),
    new URL("../../server/middleware/seo.ts", import.meta.url),
    new URL("../../vite.config.ts", import.meta.url),
  ];
  const contents = await Promise.all(files.map((url) => readFile(url, "utf8")));
  for (const content of contents) {
    assert.doesNotMatch(content, /Disallow:\s*\/search\b/);
    assert.doesNotMatch(content, /Disallow:\s*\/(?:admin|profil|ilanlarim|mesajlar|favoriler|bildirimler|doping|arsiv|login|ilan-ver)\b/);
    assert.match(content, /Disallow:\s*\/api\//);
  }
});

test("both sitemap implementations include every real category route", async () => {
  const files = [
    new URL("../../server/middleware/seo.ts", import.meta.url),
    new URL("../../vite.config.ts", import.meta.url),
  ];
  const contents = await Promise.all(files.map((url) => readFile(url, "utf8")));
  for (const content of contents) {
    assert.match(content, /FROM categories c\s+LEFT JOIN cat_dates cd ON cd\.category_id = c\.id/);
    assert.match(content, /\$\{BASE(?:_URL)?\}\/category\/\$\{c\.slug\}/);
    assert.doesNotMatch(content, /WHERE c\.parent_id IS NULL/);
    assert.match(content, /status = 'ACTIVE' AND \(expires_at IS NULL OR expires_at > now\(\)\)/);
    assert.doesNotMatch(content, /EXISTS\s*\(\s*SELECT 1 FROM categories ch/);
    assert.doesNotMatch(content, /\/search\?/);
  }
});

test("category, listing, and search routes keep distinct index directives and canonical paths", async () => {
  const [categoryRoute, listingRoute, searchRoute] = await Promise.all([
    readFile(new URL("../routes/category/$slug.tsx", import.meta.url), "utf8"),
    readFile(new URL("../routes/ilan/$slug.tsx", import.meta.url), "utf8"),
    readFile(new URL("../routes/search.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(categoryRoute, /name: "robots", content: "index,follow"/);
  assert.match(categoryRoute, /links: seo\.paginationLinks/);
  assert.match(listingRoute, /isListingIndexable\(listing\.status, listing\.expires_at\) \? "index,follow" : "noindex,nofollow"/);
  assert.match(listingRoute, /href: seo\.canonicalUrl/);
  assert.match(searchRoute, /name: "robots", content: "noindex,follow"/);
  assert.match(searchRoute, /href: "https:\/\/www\.geldesat\.com\/search"/);
});
