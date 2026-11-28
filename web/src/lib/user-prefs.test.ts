import assert from "node:assert/strict";
import { test } from "node:test";
import { isChunkLoadError } from "./app-version";
import { DEFAULT_USER_PREFS, isInQuietHours, resolveUserPrefs } from "./user-prefs";

test("resolveUserPrefs fills defaults and sanitizes invalid values", () => {
  assert.deepEqual(resolveUserPrefs(null), DEFAULT_USER_PREFS);
  const resolved = resolveUserPrefs({
    quiet_hours: { enabled: true, start: "bad", end: "07:30" },
    seller_prefs: { accept_offers: false, away_mode: true, away_message: "  Tatildeyim  " },
    browse_prefs: { default_city: "Adana", default_sort: "invalid", default_view: "list" },
  });
  assert.equal(resolved.quiet_hours.enabled, true);
  assert.equal(resolved.quiet_hours.start, "23:00");
  assert.equal(resolved.quiet_hours.end, "07:30");
  assert.equal(resolved.seller_prefs.accept_offers, false);
  assert.equal(resolved.seller_prefs.away_mode, true);
  assert.equal(resolved.seller_prefs.away_message, "Tatildeyim");
  assert.equal(resolved.browse_prefs.default_city, "Adana");
  assert.equal(resolved.browse_prefs.default_sort, "date_desc");
  assert.equal(resolved.browse_prefs.default_view, "list");
});

test("isInQuietHours handles overnight and daytime windows in Europe/Istanbul", () => {
  // 20:30 UTC == 23:30 Europe/Istanbul (UTC+3)
  const lateNight = new Date("2026-06-01T20:30:00Z");
  // 07:00 UTC == 10:00 Europe/Istanbul
  const morning = new Date("2026-06-01T07:00:00Z");

  assert.equal(isInQuietHours({ enabled: false, start: "23:00", end: "08:00" }, lateNight), false);
  assert.equal(isInQuietHours({ enabled: true, start: "23:00", end: "08:00" }, lateNight), true);
  assert.equal(isInQuietHours({ enabled: true, start: "23:00", end: "08:00" }, morning), false);
  assert.equal(isInQuietHours({ enabled: true, start: "09:00", end: "12:00" }, morning), true);
});

test("isChunkLoadError detects stale dynamic import failures", () => {
  assert.equal(isChunkLoadError(new Error("Failed to fetch dynamically imported module: /assets/x.js")), true);
  assert.equal(isChunkLoadError(new Error("ChunkLoadError: Loading chunk 12 failed")), true);
  assert.equal(isChunkLoadError(new Error("Network error")), false);
});
