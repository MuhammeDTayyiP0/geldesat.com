import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { challengeCookie, isChallenge, parkToken, readChallengeCookie, redeemCode } from "./mobile-oauth.ts";

const verifier = "v".repeat(64);
const challenge = createHash("sha256").update(verifier).digest("base64url");

test("a code works once, and only with the matching verifier", () => {
  assert.ok(isChallenge(challenge));
  const code = parkToken(challenge, "session-token");
  assert.equal(redeemCode(code, verifier), "session-token");
  assert.equal(redeemCode(code, verifier), null);
  const wrong = parkToken(challenge, "session-token");
  assert.equal(redeemCode(wrong, "x".repeat(64)), null);
  assert.equal(redeemCode(wrong, verifier), null, "a wrong try spends the code");
});

test("the finish step can tell which browser started the flow", () => {
  const cookie = challengeCookie(challenge, true);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.equal(readChallengeCookie(`a=b; ${cookie.split(";")[0]}; c=d`), challenge);
  assert.equal(readChallengeCookie("a=b"), null);
  assert.equal(readChallengeCookie(null), null);
});
