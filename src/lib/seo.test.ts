import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { buildCategorySeo, buildListingSeo } from "./seo";
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
  for (const content of contents) assert.doesNotMatch(content, /Disallow:\s*\/search\b/);
});
