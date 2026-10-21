import { useEffect } from 'react';
import { AppState } from 'react-native';
import * as Updates from 'expo-updates';

/**
 * Over-the-air updates from our own server (web/src/lib/server/ota.ts).
 *
 * expo-updates checks on every launch by itself (app.json → updates) and the
 * new code runs from the next launch. This adds two things:
 * - a check when the app comes back to the foreground, so people who never
 *   close the app still get updates;
 * - "critical" updates (published with --critical) and rollbacks restart the
 *   app as soon as they are downloaded, instead of waiting for the next launch.
 */

const CHECK_EVERY_MS = 30 * 60_000;

function isCritical(update: Updates.UseUpdatesReturnType['downloadedUpdate']): boolean {
  if (!update) return false;
  // A rollback to the built-in code is the only kind without a manifest.
  if (!update.manifest) return true;
  const extra = 'extra' in update.manifest ? (update.manifest.extra as { geldesat?: { critical?: boolean } } | undefined) : undefined;
  return extra?.geldesat?.critical === true;
}

async function checkAndDownload() {
  try {
    const check = await Updates.checkForUpdateAsync();
    if (check.isAvailable || check.isRollBackToEmbedded) await Updates.fetchUpdateAsync();
  } catch {
    // Offline or server unreachable: try again next time.
  }
}

/** Mounted once, in the root layout. Does nothing in development builds. */
export function useOtaUpdates() {
  const { isUpdatePending, downloadedUpdate } = Updates.useUpdates();

  useEffect(() => {
    if (!Updates.isEnabled || __DEV__) return;
    let last = Date.now(); // the launch check just ran
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || Date.now() - last < CHECK_EVERY_MS) return;
      last = Date.now();
      void checkAndDownload();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!Updates.isEnabled || __DEV__) return;
    if (isUpdatePending && isCritical(downloadedUpdate)) void Updates.reloadAsync().catch(() => undefined);
  }, [isUpdatePending, downloadedUpdate]);
}

/** "1.0.0" or "1.0.0 · a1b2c3d4" when running an OTA update, for the settings footer. */
export function runningVersionLabel(appVersion: string): string {
  if (!Updates.isEnabled || Updates.isEmbeddedLaunch || !Updates.updateId) return appVersion;
  return `${appVersion} · ${Updates.updateId.slice(0, 8)}`;
}
