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
const APPLE_TEAM_ID = "APPLE_TEAM_ID";

/**
 * İmza sertifikası SHA-256 parmak izleri (`AA:BB:...`, büyük harf).
 * - EAS imza anahtarı: `npx eas-cli credentials -p android` (preview APK'ları)
 * - Play Console → Uygulama bütünlüğü → Uygulama imzalama anahtarı (mağazadan
 *   kurulan sürüm Google'ın anahtarıyla imzalanır)
 */
const ANDROID_SHA256_FINGERPRINTS: string[] = [];

/** Uygulamanın açtığı web yolları; app.json'daki Android intent filter ile aynı. */
const APP_PATHS = ["/ilan/*"];

const FINGERPRINT_RE = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

function assetLinks(): unknown[] | null {
  const fingerprints = ANDROID_SHA256_FINGERPRINTS.filter((f) => FINGERPRINT_RE.test(f));
  if (fingerprints.length === 0) return null;
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls", "delegate_permission/common.get_login_creds"],
      target: { namespace: "android_app", package_name: APP_ID, sha256_cert_fingerprints: fingerprints },
    },
  ];
}

function appleAppSiteAssociation(): unknown | null {
  if (!/^[A-Z0-9]{10}$/.test(APPLE_TEAM_ID)) return null;
  const appID = `${APPLE_TEAM_ID}.${APP_ID}`;
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
  req?: { method?: string };
}

export default function appLinksMiddleware(
  event: AppLinksEvent,
  next: () => unknown | Promise<unknown>,
): unknown {
  const build = event.url ? FILES[event.url.pathname] : undefined;
  if (!build) return next();
  if (event.req?.method && event.req.method !== "GET" && event.req.method !== "HEAD") return next();

  const body = build();
  if (!body) return new Response("Not Found", { status: 404, headers: { "Cache-Control": "no-store" } });
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
