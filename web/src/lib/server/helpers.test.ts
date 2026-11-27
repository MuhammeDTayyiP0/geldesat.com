import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { RateLimitError } from "./errors";
import { firstInWindow, rateLimit, resetWindow, viewerKey } from "./helpers";

const ORIG_TRUSTED_HEADER = process.env.TRUSTED_IP_HEADER;
const ORIG_PROXY_HOPS = process.env.TRUSTED_PROXY_HOPS;

afterEach(() => {
  if (ORIG_TRUSTED_HEADER === undefined) delete process.env.TRUSTED_IP_HEADER;
  else process.env.TRUSTED_IP_HEADER = ORIG_TRUSTED_HEADER;
  if (ORIG_PROXY_HOPS === undefined) delete process.env.TRUSTED_PROXY_HOPS;
  else process.env.TRUSTED_PROXY_HOPS = ORIG_PROXY_HOPS;
});

test("rateLimit allows up to max calls and rejects overflow within window", () => {
  const key = `test-rl-${Date.now()}-${Math.random()}`;
  rateLimit(key, 3, 60_000);
  rateLimit(key, 3, 60_000);
  rateLimit(key, 3, 60_000);
  assert.throws(() => rateLimit(key, 3, 60_000), RateLimitError);
  // Different key stays unaffected
  rateLimit(`${key}-other`, 1, 60_000);
});

test("firstInWindow and resetWindow are isolated from rateLimit", () => {
  const sharedKey = `test-shared-${Date.now()}-${Math.random()}`;
  rateLimit(sharedKey, 1, 60_000);
  assert.throws(() => rateLimit(sharedKey, 1, 60_000), RateLimitError);

  // firstInWindow has its own bucket map and must still succeed once
  assert.equal(firstInWindow(sharedKey, 60_000), true);
  assert.equal(firstInWindow(sharedKey, 60_000), false);

  // resetWindow clears only dedupBuckets, leaving rateLimit exhausted
  resetWindow(sharedKey);
  assert.equal(firstInWindow(sharedKey, 60_000), true);
  assert.throws(() => rateLimit(sharedKey, 1, 60_000), RateLimitError);
});

test("viewerKey prioritizes userId, TRUSTED_IP_HEADER, x-real-ip, and x-forwarded-for with TRUSTED_PROXY_HOPS", () => {
  assert.equal(viewerKey(new Headers({ "x-real-ip": "1.2.3.4" }), "user-42"), "u:user-42");

  delete process.env.TRUSTED_IP_HEADER;
  delete process.env.TRUSTED_PROXY_HOPS;

  assert.equal(viewerKey(new Headers()), "ip:unknown");
  assert.equal(viewerKey(new Headers({ "x-real-ip": "10.0.0.5", "x-forwarded-for": "9.9.9.9" })), "ip:9.9.9.9");
  assert.equal(viewerKey(new Headers({ "x-real-ip": "10.0.0.5" })), "ip:10.0.0.5");

  process.env.TRUSTED_IP_HEADER = "x-real-ip";
  assert.equal(viewerKey(new Headers({ "x-real-ip": "10.0.0.5", "x-forwarded-for": "9.9.9.9" })), "ip:10.0.0.5");
  delete process.env.TRUSTED_IP_HEADER;

  // Default TRUSTED_PROXY_HOPS = 1 picks rightmost entry
  assert.equal(viewerKey(new Headers({ "x-forwarded-for": "1.1.1.1, 2.2.2.2, 3.3.3.3" })), "ip:3.3.3.3");

  // TRUSTED_PROXY_HOPS = 2 picks second from right
  process.env.TRUSTED_PROXY_HOPS = "2";
  assert.equal(viewerKey(new Headers({ "x-forwarded-for": "1.1.1.1, 2.2.2.2, 3.3.3.3" })), "ip:2.2.2.2");

  // Clamps to index 0 when hops exceed entries
  process.env.TRUSTED_PROXY_HOPS = "10";
  assert.equal(viewerKey(new Headers({ "x-forwarded-for": "1.1.1.1, 2.2.2.2" })), "ip:1.1.1.1");

  // TRUSTED_IP_HEADER wins over x-real-ip and x-forwarded-for
  process.env.TRUSTED_IP_HEADER = "cf-connecting-ip";
  assert.equal(
    viewerKey(
      new Headers({
        "cf-connecting-ip": "203.0.113.9, 10.0.0.1",
        "x-real-ip": "10.0.0.5",
        "x-forwarded-for": "1.1.1.1",
      }),
    ),
    "ip:203.0.113.9",
  );
});
