import { describe, it, test } from "node:test";
import assert from "node:assert/strict";
import { resolveSignInGateState, safeRedirect } from "./sign-in-gate.ts";

describe("resolveSignInGateState", () => {
  it("is pending while the session check is in flight, user or not", () => {
    assert.equal(
      resolveSignInGateState({ isPending: true, hasUser: false }),
      "pending",
    );
    assert.equal(
      resolveSignInGateState({ isPending: true, hasUser: true }),
      "pending",
    );
  });

  it("is signed_in once a user is present", () => {
    assert.equal(
      resolveSignInGateState({ isPending: false, hasUser: true }),
      "signed_in",
    );
  });

  it("is signed_out only after the check resolved with no user", () => {
    assert.equal(
      resolveSignInGateState({ isPending: false, hasUser: false }),
      "signed_out",
    );
  });
});

test("login redirects stay on this site", () => {
  assert.equal(safeRedirect("/ilanlarim?tab=1"), "/ilanlarim?tab=1");
  assert.equal(safeRedirect("https://evil.example"), "/");
  assert.equal(safeRedirect("//evil.example"), "/");
  assert.equal(safeRedirect("/\\evil.example"), "/");
  assert.equal(safeRedirect(undefined), "/");
});
