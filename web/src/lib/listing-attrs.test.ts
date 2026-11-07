import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanAttrs } from "./listing-attrs.ts";

const rules = [
  { name: "Kilometre", type: "NUMBER" },
  { name: "Yıl", type: "NUMBER" },
  { name: "Renk", type: "SELECT", options: ["Beyaz", "Siyah"] },
  { name: "Not", type: "TEXT" },
];
const now = new Date("2026-11-07");

test("a number that would break numeric filters is refused", () => {
  assert.throws(() => cleanAttrs({ Kilometre: "1.2.3" }, rules, {}, now), /geçerli bir sayı/);
  assert.throws(() => cleanAttrs({ Kilometre: "." }, rules, {}, now), /geçerli bir sayı/);
  assert.deepEqual(cleanAttrs({ Kilometre: 120000 }, rules, {}, now), { Kilometre: 120000 });
  assert.deepEqual(cleanAttrs({ Kilometre: "120.5" }, rules, {}, now), { Kilometre: "120.5" });
});

test("a year stays in a realistic range", () => {
  assert.throws(() => cleanAttrs({ Yıl: 1 }, rules, {}, now), /1950 ile 2027/);
  assert.throws(() => cleanAttrs({ Yıl: 2028 }, rules, {}, now), /1950 ile 2027/);
  assert.deepEqual(cleanAttrs({ Yıl: 2027 }, rules, {}, now), { Yıl: 2027 });
});

test("unknown keys are dropped unless the listing already had that value", () => {
  assert.deepEqual(cleanAttrs({ Hacker: "x" }, rules, {}, now), {});
  assert.deepEqual(cleanAttrs({ Eski: "x" }, rules, { Eski: "x" }, now), { Eski: "x" });
  assert.deepEqual(cleanAttrs({ Eski: "y" }, rules, { Eski: "x" }, now), {});
});

test("a select accepts its options, and a removed option the listing already had", () => {
  assert.throws(() => cleanAttrs({ Renk: "Mor" }, rules, {}, now), /listeden/);
  assert.deepEqual(cleanAttrs({ Renk: "Mor" }, rules, { Renk: "Mor" }, now), { Renk: "Mor" });
});

test("oversized values and empty ones", () => {
  assert.throws(() => cleanAttrs({ Not: "a".repeat(201) }, rules, {}, now), /en fazla 200/);
  assert.deepEqual(cleanAttrs({ Not: "", Kilometre: "" }, rules, {}, now), {});
});
