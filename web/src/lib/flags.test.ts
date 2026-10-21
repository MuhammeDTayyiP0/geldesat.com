import assert from "node:assert/strict";
import test from "node:test";
import { compareVersions, evaluateFlags, flagBucket, fullRule, isFlagOn, normalizeFlags, type FlagRule } from "./flags";

const rule = (patch: Partial<FlagRule>): FlagRule => ({ ...fullRule(true), ...patch });
const people = Array.from({ length: 4000 }, (_, i) => `user_${i}`);

test("old boolean flags still work", () => {
  const rules = normalizeFlags({ doping_enabled: true, mobile_bottom_nav: false });
  assert.deepEqual(evaluateFlags(rules, { unitId: "u1", platform: "web" }), { doping_enabled: true, mobile_bottom_nav: false });
});

test("malformed entries are cleaned instead of throwing", () => {
  const rules = normalizeFlags({ "Bad Name": true, x: "yes", y: { enabled: true, rollout: 250, platforms: ["ios", "tv"], minAppVersion: "abc" } });
  assert.deepEqual(Object.keys(rules), ["y"]);
  assert.deepEqual(rules.y, { enabled: true, rollout: 100, platforms: ["ios"], minAppVersion: null, admins: false, description: "" });
  assert.deepEqual(normalizeFlags(null), {});
  assert.deepEqual(normalizeFlags([true]), {});
});

test("the same person always gets the same answer", () => {
  for (const id of people.slice(0, 50)) assert.equal(flagBucket("offer", id), flagBucket("offer", id));
});

test("a 50% rollout reaches about half of the people", () => {
  const on = people.filter((id) => isFlagOn("offer", rule({ rollout: 50 }), { unitId: id, platform: "android" })).length;
  assert.ok(on > people.length * 0.45 && on < people.length * 0.55, `${on} of ${people.length}`);
});

test("raising the rollout only adds people", () => {
  const at = (rollout: number) => new Set(people.filter((id) => isFlagOn("offer", rule({ rollout }), { unitId: id, platform: "ios" })));
  const ten = at(10);
  const fifty = at(50);
  for (const id of ten) assert.ok(fifty.has(id));
});

test("each flag splits people differently", () => {
  const a = people.filter((id) => flagBucket("story", id) < 50);
  const shared = a.filter((id) => flagBucket("offer", id) < 50).length;
  assert.ok(shared > a.length * 0.4 && shared < a.length * 0.6);
});

test("the master switch beats everything, admins included", () => {
  assert.equal(isFlagOn("x", rule({ enabled: false, admins: true }), { unitId: "u", platform: "web", isAdmin: true }), false);
  assert.equal(isFlagOn("x", undefined, { unitId: "u", platform: "web" }), false);
});

test("admins get a flag before everyone else", () => {
  const r = rule({ rollout: 0, admins: true });
  assert.equal(isFlagOn("x", r, { unitId: "u", platform: "android", isAdmin: true }), true);
  assert.equal(isFlagOn("x", r, { unitId: "u", platform: "android" }), false);
});

test("platform and minimum app version limit the flag", () => {
  const r = rule({ platforms: ["android"], minAppVersion: "1.2.0" });
  assert.equal(isFlagOn("x", r, { unitId: "u", platform: "ios", appVersion: "2.0.0" }), false);
  assert.equal(isFlagOn("x", r, { unitId: "u", platform: "android", appVersion: "1.1.9" }), false);
  assert.equal(isFlagOn("x", r, { unitId: "u", platform: "android", appVersion: "1.10.0" }), true);
  assert.equal(isFlagOn("x", r, { unitId: "u", platform: "android" }), false);
  assert.equal(isFlagOn("x", rule({ minAppVersion: "9.0.0" }), { unitId: "u", platform: "web" }), true);
});

test("versions compare numerically", () => {
  assert.equal(compareVersions("1.10.0", "1.9.9"), 1);
  assert.equal(compareVersions("1.2.0", "1.2.0"), 0);
  assert.equal(compareVersions("1.2", "1.2.1"), -1);
});
