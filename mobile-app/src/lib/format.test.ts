import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cleanPhone, formatNumber, formatPrice, lastSeenLabel } from "./format";

describe("mobile format helpers", () => {
  it("formats prices and numbers cleanly", () => {
    assert.equal(formatPrice(1500, "TRY"), "1.500 ₺");
    assert.equal(formatPrice(250, "USD"), "$250");
    assert.equal(formatNumber(123456), "123.456");
  });

  it("normalizes Turkish phone numbers", () => {
    assert.equal(cleanPhone("+90 (532) 123 45 67"), "05321234567");
    assert.equal(cleanPhone("5321234567"), "05321234567");
  });

  it("guards invalid dates in lastSeenLabel", () => {
    assert.equal(lastSeenLabel(false, null), "");
    assert.equal(lastSeenLabel(false, "not-a-date"), "");
  });
});
