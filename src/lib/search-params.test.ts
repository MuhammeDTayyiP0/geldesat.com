import assert from "node:assert/strict";
import test from "node:test";
import { inferSearchCategoryId, parseAttrs, parseSearch, toFilters } from "./search-params";

const categories = [
  { id: "shopping", parent_id: null },
  { id: "phones", parent_id: "shopping" },
  { id: "apple", parent_id: "phones" },
  { id: "iphone-15", parent_id: "apple" },
  { id: "iphone-15-pro", parent_id: "apple" },
  { id: "cars", parent_id: null },
  { id: "bmw", parent_id: "cars" },
  { id: "five-series", parent_id: "bmw" },
  { id: "furniture", parent_id: "shopping" },
];

test("search category context opens a single result at its parent", () => {
  assert.equal(inferSearchCategoryId(["iphone-15"], categories), "apple");
});

test("search category context uses the common branch for multiple models", () => {
  assert.equal(inferSearchCategoryId(["iphone-15", "iphone-15-pro"], categories), "apple");
  assert.equal(inferSearchCategoryId(["five-series"], categories), "bmw");
});

test("mixed category results fall back to their common parent and unknown IDs are ignored", () => {
  assert.equal(inferSearchCategoryId(["iphone-15", "furniture"], categories), "shopping");
  assert.equal(inferSearchCategoryId(["iphone-15", "five-series"], categories), undefined);
  assert.equal(inferSearchCategoryId(["missing"], categories), undefined);
  assert.equal(inferSearchCategoryId([], categories), undefined);
});

test("query parameters retain multi-select attributes and filter values", () => {
  const parsed = parseSearch({ q: "iPhone 15", category: "apple", attrs: '{"Renk":["Siyah","Mavi"]}', page: "3" });
  assert.deepEqual(parseAttrs(parsed.attrs), { Renk: ["Siyah", "Mavi"] });
  assert.deepEqual(toFilters(parsed), {
    q: "iPhone 15",
    category: "apple",
    city: undefined,
    district: undefined,
    neighborhood: undefined,
    minPrice: undefined,
    maxPrice: undefined,
    sort: "date_desc",
    page: 3,
    minYear: undefined,
    maxYear: undefined,
    minKm: undefined,
    maxKm: undefined,
    minM2: undefined,
    maxM2: undefined,
    attrs: { Renk: ["Siyah", "Mavi"] },
    limit: 20,
  });
});
