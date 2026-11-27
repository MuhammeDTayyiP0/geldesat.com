/**
 * Android App Links (`/.well-known/assetlinks.json`) ve iOS Universal Links
 * (`/.well-known/apple-app-site-association`) doğrulama dosyaları.
 *
 * Neden public/ değil: Nitro uzantısız public dosyaları `text/plain` ile
 * servis eder, Apple ise `application/json` ister. Dosya adı "app-links" diye
 * seçildi: middleware'ler ada göre sıralanır, bu yüzden seo.ts'teki
 * geldesat.com → www 301 yönlendirmesinden önce çalışır (Android doğrulaması
 * yönlendirme takip etmez; apex alan adı da intent filter'da var).
 *
 * Değerler girilmeden (yer tutucu kaldıkça) dosyalar 404 döner; böylece Apple'ın
 * CDN'i geçersiz bir dosyayı önbelleğe almaz.
 */

const APP_ID = "com.geldesat.app";

/** Apple Developer → Membership → Team ID (10 karakter). */
function getAppleTeamId(): string {
  return process.env.APPLE_TEAM_ID?.trim() || "APPLE_TEAM_ID";
}

function getIosBundleId(): string {
  return process.env.IOS_BUNDLE_ID?.trim() || APP_ID;
}

function getAndroidPackageName(): string {
  return process.env.ANDROID_PACKAGE_NAME?.trim() || APP_ID;
}

/**
 * İmza sertifikası SHA-256 parmak izleri (`AA:BB:...`, büyük harf).
 * - EAS imza anahtarı: `npx eas-cli credentials -p android` (preview APK'ları)
 * - Play Console → Uygulama bütünlüğü → Uygulama imzalama anahtarı (mağazadan
 *   kurulan sürüm Google'ın anahtarıyla imzalanır)
 */
function getAndroidFingerprints(): string[] {
  const raw = process.env.ANDROID_SHA256_FINGERPRINTS || process.env.ANDROID_APP_SHA256 || "";
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

/** Uygulamanın açtığı tüm web yolları. */
const APP_PATHS = [
  "/ilan/*",
  "/satici/*",
  "/magaza/*",
  "/category/*",
  "/search",
  "/harita",
  "/karsilastir",
  "/mesajlar",
  "/mesajlar/*",
  "/favoriler",
  "/bildirimler",
  "/ilanlarim",
  "/ayarlar/*",
  "/sayfa/*",
];

const FINGERPRINT_RE = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

function assetLinks(): unknown[] | null {
  const fingerprints = getAndroidFingerprints().filter((f) => FINGERPRINT_RE.test(f));
  if (fingerprints.length === 0) return null;
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls", "delegate_permission/common.get_login_creds"],
      target: { namespace: "android_app", package_name: getAndroidPackageName(), sha256_cert_fingerprints: fingerprints },
    },
  ];
}

function appleAppSiteAssociation(): unknown | null {
  const teamId = getAppleTeamId();
  if (!/^[A-Z0-9]{10}$/.test(teamId)) return null;
  const appID = `${teamId}.${getIosBundleId()}`;
  return {
    applinks: {
      details: [{ appIDs: [appID], components: APP_PATHS.map((path) => ({ "/": path })) }],
    },
    webcredentials: { apps: [appID] },
  };
}

const FILES: Record<string, () => unknown | null> = {
  "/.well-known/assetlinks.json": assetLinks,
  "/.well-known/apple-app-site-association": appleAppSiteAssociation,
};

interface AppLinksEvent {
  url?: URL;
  req?: { method?: string; url?: string; headers?: Headers | Record<string, string | string[] | undefined> };
  node?: { req?: { method?: string; url?: string; headers?: Record<string, string | string[] | undefined> } };
}

function readHeader(event: AppLinksEvent, name: string): string {
  const headers = event.req?.headers ?? event.node?.req?.headers;
  if (!headers) return "";
  if (typeof (headers as Headers).get === "function") return (headers as Headers).get(name) ?? "";
  const val = (headers as Record<string, string | string[] | undefined>)[name];
  return Array.isArray(val) ? (val[0] ?? "") : (val ?? "");
}

export default function appLinksMiddleware(
  event: AppLinksEvent,
  next: () => unknown | Promise<unknown>,
): unknown {
  let pathname = event.url?.pathname;
  if (!pathname) {
    const rawUrl = event.req?.url ?? event.node?.req?.url;
    if (rawUrl) {
      try {
        pathname = new URL(rawUrl, "http://localhost").pathname;
      } catch {
        pathname = undefined;
      }
    }
  }
  const build = pathname ? FILES[pathname] : undefined;
  if (!build) return next();
  const method = event.req?.method ?? event.node?.req?.method;
  if (method && method !== "GET" && method !== "HEAD") return next();

  const proto = event.url?.protocol === "https:" || readHeader(event, "x-forwarded-proto").split(",")[0]?.trim() === "https";
  const secHeaders: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    ...(proto ? { "Strict-Transport-Security": "max-age=31536000; includeSubDomains" } : {}),
  };

  const body = build();
  if (!body) {
    return new Response("Not Found", {
      status: 404,
      headers: { "Cache-Control": "no-store", ...secHeaders },
    });
  }
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
      ...secHeaders,
    },
  });
}
