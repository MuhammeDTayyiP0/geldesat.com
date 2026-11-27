import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isOlderVersion } from "./version";

describe("isOlderVersion", () => {
  it("compares semver parts numerically", () => {
    assert.equal(isOlderVersion("1.0.0", "1.0.1"), true);
    assert.equal(isOlderVersion("1.2.9", "1.10.0"), true);
    assert.equal(isOlderVersion("1.2.0", "1.2"), false);
    assert.equal(isOlderVersion("2.0.0", "1.9.9"), false);
  });

  it("returns false for missing or malformed versions", () => {
    assert.equal(isOlderVersion(null, "1.0.0"), false);
    assert.equal(isOlderVersion("1.0.0", undefined), false);
    assert.equal(isOlderVersion("dev", "1.0.0"), false);
  });
});
