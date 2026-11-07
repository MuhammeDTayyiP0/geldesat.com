import { test } from "node:test";
import assert from "node:assert/strict";
import { assertOwnerStatus, assertRenewable, needsReReview, ownerActions, publishBlock, sameAttrs } from "./listing-status.ts";

const state = (status: string, approved = true, expired = false) => ({ status, approved, expired });

test("an owner can only publish an approved, unexpired listing", () => {
  assert.equal(publishBlock(state("INACTIVE")), null);
  assert.equal(publishBlock(state("SOLD")), null);
  assert.match(String(publishBlock(state("PENDING"))), /Onay bekleyen/);
  assert.match(String(publishBlock(state("REJECTED"))), /Onay bekleyen/);
  assert.match(String(publishBlock(state("SOLD", false))), /Onay bekleyen/);
  assert.match(String(publishBlock(state("INACTIVE", true, true))), /süresi dolmuş/);
  assert.match(String(publishBlock(state("ACTIVE"))), /zaten yayında/);
});

test("the sold route cannot skip review: an edit always goes back to moderation", () => {
  for (const status of ["ACTIVE", "INACTIVE", "SOLD"]) assert.equal(needsReReview(status), true, status);
  assert.throws(() => assertOwnerStatus("ACTIVE", state("SOLD", false)), /Onay bekleyen/);
});

test("owners cannot set moderation states", () => {
  assert.throws(() => assertOwnerStatus("PENDING", state("ACTIVE")), /Yetkisiz/);
  assert.throws(() => assertOwnerStatus("REJECTED", state("ACTIVE")), /Yetkisiz/);
  assert.throws(() => assertOwnerStatus("SOLD", state("PENDING")), /durumu değiştirilemez/);
  assert.doesNotThrow(() => assertOwnerStatus("SOLD", state("INACTIVE")));
});

test("rejected and sold listings cannot be renewed", () => {
  assert.throws(() => assertRenewable("REJECTED"));
  assert.throws(() => assertRenewable("SOLD"));
  assert.doesNotThrow(() => assertRenewable("INACTIVE"));
});

test("offered actions follow the same rules", () => {
  assert.deepEqual(ownerActions(state("ACTIVE")), ["edit", "hide", "sold", "renew", "delete"]);
  assert.deepEqual(ownerActions(state("INACTIVE", true, true)), ["edit", "sold", "renew", "delete"]);
  assert.deepEqual(ownerActions(state("SOLD")), ["edit", "publish", "delete"]);
  assert.deepEqual(ownerActions(state("REJECTED", false)), ["edit", "delete"]);
});

test("attribute comparison ignores key order and number vs string", () => {
  assert.equal(sameAttrs({ a: 1, b: "x" }, { b: "x", a: "1" }), true);
  assert.equal(sameAttrs({ a: 1 }, { a: 2 }), false);
  assert.equal(sameAttrs({ a: 1 }, {}), false);
});
