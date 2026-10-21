import { createHash, timingSafeEqual } from "node:crypto";
import { flagBucket } from "../flags";

/**
 * Self-hosted Expo Updates server (protocol v1, the one expo-updates speaks):
 * https://docs.expo.dev/technical-specs/expo-updates-1/
 *
 * The app asks /api/ota/manifest "is there newer code for runtime X on
 * platform Y?" on every launch; we answer with the newest update it may have,
 * a "no update" directive, or a "roll back to the built-in code" directive.
 * Files are served from /api/ota/assets/<hash>. `mobile-app/scripts/ota-publish.mjs`
 * uploads them; the admin panel pauses, widens and rolls back updates.
 */

export type OtaPlatform = "ios" | "android";

export type OtaAsset = {
  /** base64url SHA-256 of the file (what the client verifies). */
  hash: string;
  /** md5 hex of the file; the bundle refers to assets by it. */
  key: string;
  contentType: string;
  fileExtension?: string;
};

export type OtaUpdateRow = {
  id: string;
  group_id: string;
  runtime_version: string;
  platform: OtaPlatform;
  channel: string;
  kind: "update" | "rollback";
  launch_asset: OtaAsset | null;
  assets: OtaAsset[];
  expo_client: Record<string, unknown>;
  message: string;
  rollout: number;
  critical: boolean;
  created_at: string | Date;
};

export const CHANNEL_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/;
export const RUNTIME_PATTERN = /^[A-Za-z0-9._()-]{1,64}$/;
export const HASH_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function sha256Base64Url(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("base64url");
}

/** Publishing needs `Authorization: Bearer <OTA_PUBLISH_TOKEN>`; unset token = publishing off. */
export function publishAuth(request: Request): "ok" | "off" | "denied" {
  const token = process.env.OTA_PUBLISH_TOKEN?.trim();
  if (!token || token.length < 24) return "off";
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(given);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b) ? "ok" : "denied";
}

export function publishDenied(state: "off" | "denied"): Response {
  return Response.json(
    {
      success: false,
      error: state === "off" ? "OTA yayınlama kapalı: sunucuda OTA_PUBLISH_TOKEN (en az 24 karakter) tanımlı değil." : "Geçersiz yayın anahtarı.",
    },
    { status: state === "off" ? 503 : 401 },
  );
}

/** https://www.geldesat.com behind the proxy, http://localhost:3000 locally. */
export function publicOrigin(request: Request): string {
  const url = new URL(request.url);
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || url.protocol.replace(":", "");
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || request.headers.get("host") || url.host;
  return `${proto}://${host}`;
}

const iso = (v: string | Date) => (v instanceof Date ? v : new Date(v)).toISOString();

/**
 * The update this device should run: the newest one in its channel whose
 * rollout includes the device. Devices without an id only get 100% updates.
 */
export function pickUpdate(rows: OtaUpdateRow[], clientId: string | null): OtaUpdateRow | null {
  for (const row of rows) {
    if (row.rollout >= 100) return row;
    if (row.rollout > 0 && clientId && flagBucket(`ota:${row.group_id}`, clientId) < row.rollout) return row;
  }
  return null;
}

function assetUrl(origin: string, hash: string) {
  return `${origin}/api/ota/assets/${hash}`;
}

export function buildManifest(row: OtaUpdateRow, origin: string) {
  const launch = row.launch_asset!;
  return {
    id: row.id,
    createdAt: iso(row.created_at),
    runtimeVersion: row.runtime_version,
    launchAsset: { hash: launch.hash, key: launch.key, contentType: launch.contentType, url: assetUrl(origin, launch.hash) },
    assets: row.assets.map((a) => ({
      hash: a.hash,
      key: a.key,
      contentType: a.contentType,
      ...(a.fileExtension ? { fileExtension: a.fileExtension } : {}),
      url: assetUrl(origin, a.hash),
    })),
    metadata: {},
    extra: {
      expoClient: row.expo_client,
      geldesat: { message: row.message, critical: row.critical, groupId: row.group_id },
    },
  };
}

export type Directive = { type: "noUpdateAvailable" } | { type: "rollBackToEmbedded"; parameters: { commitTime: string } };

export function rollbackDirective(row: OtaUpdateRow): Directive {
  return { type: "rollBackToEmbedded", parameters: { commitTime: iso(row.created_at) } };
}

/** multipart/mixed body with the given JSON parts, as the protocol expects. */
export function multipartResponse(parts: Array<{ name: "manifest" | "extensions" | "directive"; body: unknown }>, protocolVersion: number): Response {
  const boundary = `geldesat-${crypto.randomUUID()}`;
  let body = "";
  for (const part of parts) {
    body += `--${boundary}\r\n`;
    body += `content-disposition: form-data; name="${part.name}"\r\n`;
    body += "content-type: application/json; charset=utf-8\r\n\r\n";
    body += `${JSON.stringify(part.body)}\r\n`;
  }
  body += `--${boundary}--\r\n`;
  return new Response(body, {
    status: 200,
    headers: {
      "expo-protocol-version": String(protocolVersion),
      "expo-sfv-version": "0",
      "cache-control": "private, max-age=0",
      "content-type": `multipart/mixed; boundary=${boundary}`,
    },
  });
}
