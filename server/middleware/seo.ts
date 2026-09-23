/**
 * Sitemap Index, alt sitemap'ler ve robots.txt için Nitro/H3 server middleware.
 *
 * Rotalar:
 *   GET /sitemap.xml             → Sitemap index (tüm sitemap'leri listeler)
 *   GET /sitemap-static.xml      → Statik sayfalar
 *   GET /sitemap-categories.xml  → Kategoriler
 *   GET /sitemap-listings.xml    → Aktif ilanlar (sayfalı: ?page=1,2,…)
 *   GET /sitemap-stores.xml      → Mağazalar
 *   GET /sitemap-sellers.xml     → Satıcı profilleri
 *   GET /robots.txt              → Robots direktifleri
 */

const BASE_URL = "https://www.geldesat.com";
const LISTINGS_PER_PAGE = 10_000;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function urlEntry(
  loc: string,
  lastmod: string,
  changefreq: string,
  priority: string,
): string {
  return `  <url>\n    <loc>${xmlEscape(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}

function wrapUrlset(entries: string[]): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    entries.join("\n") +
    `\n</urlset>`
  );
}

function xmlResponse(body: string, maxAge = 3600): Response {
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": `public, max-age=${maxAge}, s-maxage=${maxAge}`,
    },
  });
}

// ─── Sitemap builders ─────────────────────────────────────────────────────────

/** /sitemap.xml — index dosyası */
async function buildSitemapIndex(): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);

  // Kaç sayfa ilan var?
  let listingPages = 1;
  try {
    const { getSql } = await import("../../src/lib/db");
    const sql = await getSql();
    const res = await sql.query<{ cnt: string }>(
      `SELECT COUNT(*) AS cnt FROM listings WHERE status = 'ACTIVE' AND (expires_at IS NULL OR expires_at > now())`,
    );
    const total = parseInt(res[0]?.cnt ?? "0", 10);
    listingPages = Math.max(1, Math.ceil(total / LISTINGS_PER_PAGE));
  } catch { /* DB bağlantısı yoksa 1 sayfa varsay */ }

  const sitemaps: { loc: string; lastmod: string }[] = [
    { loc: `${BASE_URL}/sitemap-static.xml`, lastmod: today },
    { loc: `${BASE_URL}/sitemap-categories.xml`, lastmod: today },
    ...Array.from({ length: listingPages }, (_, i) => ({
      loc: `${BASE_URL}/sitemap-listings.xml?page=${i + 1}`,
      lastmod: today,
    })),
    { loc: `${BASE_URL}/sitemap-stores.xml`, lastmod: today },
    { loc: `${BASE_URL}/sitemap-sellers.xml`, lastmod: today },
  ];

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    sitemaps
      .map(
        (s) =>
          `  <sitemap>\n    <loc>${xmlEscape(s.loc)}</loc>\n    <lastmod>${s.lastmod}</lastmod>\n  </sitemap>`,
      )
      .join("\n") +
    `\n</sitemapindex>`
  );
}

/** /sitemap-static.xml */
function buildStaticSitemap(): string {
  const today = new Date().toISOString().slice(0, 10);
  return wrapUrlset([
    urlEntry(`${BASE_URL}/`, today, "daily", "1.0"),
    urlEntry(`${BASE_URL}/ilan-ver`, today, "weekly", "0.8"),
    urlEntry(`${BASE_URL}/categories`, today, "weekly", "0.7"),
    urlEntry(`${BASE_URL}/sayfa/hakkimizda`, today, "monthly", "0.4"),
    urlEntry(`${BASE_URL}/sayfa/iletisim`, today, "monthly", "0.4"),
    urlEntry(`${BASE_URL}/sayfa/kvkk`, today, "monthly", "0.3"),
    urlEntry(`${BASE_URL}/sayfa/gizlilik`, today, "monthly", "0.3"),
    urlEntry(`${BASE_URL}/sayfa/cerez`, today, "monthly", "0.3"),
    urlEntry(`${BASE_URL}/sayfa/kullanim`, today, "monthly", "0.3"),
    urlEntry(`${BASE_URL}/sayfa/uyelik`, today, "monthly", "0.3"),
  ]);
}

/** /sitemap-categories.xml */
async function buildCategoriesSitemap(): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const { getSql } = await import("../../src/lib/db");
    const sql = await getSql();
    const cats = await sql.query<{ slug: string }>(
      "SELECT slug FROM categories ORDER BY sort_order, name",
    );
    return wrapUrlset(
      cats.map((c) =>
        urlEntry(
          `${BASE_URL}/category/${c.slug}`,
          today,
          "weekly",
          "0.7",
        ),
      ),
    );
  } catch {
    return wrapUrlset([]);
  }
}

/** /sitemap-listings.xml?page=N */
async function buildListingsSitemap(page: number): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  const offset = (page - 1) * LISTINGS_PER_PAGE;
  try {
    const { getSql } = await import("../../src/lib/db");
    const sql = await getSql();
    const listings = await sql.query<{ slug: string; updated_at: string }>(
      `SELECT slug, updated_at FROM listings
       WHERE status = 'ACTIVE' AND (expires_at IS NULL OR expires_at > now())
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [LISTINGS_PER_PAGE, offset],
    );
    return wrapUrlset(
      listings.map((l) =>
        urlEntry(
          `${BASE_URL}/ilan/${l.slug}`,
          l.updated_at ? String(l.updated_at).slice(0, 10) : today,
          "daily",
          "0.6",
        ),
      ),
    );
  } catch {
    return wrapUrlset([]);
  }
}

/** /sitemap-stores.xml */
async function buildStoresSitemap(): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const { getSql } = await import("../../src/lib/db");
    const sql = await getSql();
    const stores = await sql.query<{ slug: string; created_at: string }>(
      "SELECT slug, created_at FROM stores ORDER BY created_at DESC LIMIT 10000",
    );
    return wrapUrlset(
      stores.map((s) =>
        urlEntry(
          `${BASE_URL}/magaza/${s.slug}`,
          s.created_at ? String(s.created_at).slice(0, 10) : today,
          "weekly",
          "0.5",
        ),
      ),
    );
  } catch {
    // stores tablosu yoksa boş döndür
    return wrapUrlset([]);
  }
}

/** /sitemap-sellers.xml */
async function buildSellersSitemap(): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const { getSql } = await import("../../src/lib/db");
    const sql = await getSql();
    const sellers = await sql.query<{ user_id: string; created_at: string }>(
      `SELECT user_id, created_at FROM profiles ORDER BY created_at DESC LIMIT 10000`,
    );
    return wrapUrlset(
      sellers.map((p) =>
        urlEntry(
          `${BASE_URL}/satici/${p.user_id}`,
          p.created_at ? String(p.created_at).slice(0, 10) : today,
          "weekly",
          "0.4",
        ),
      ),
    );
  } catch {
    // profiles tablosu yoksa boş döndür
    return wrapUrlset([]);
  }
}

// ─── robots.txt ──────────────────────────────────────────────────────────────

function buildRobots(): string {
  return [
    "User-agent: *",
    "Allow: /",
    "",
    "# Özel / kişisel sayfalar — indekslenmemeli",
    "Disallow: /admin",
    "Disallow: /profil",
    "Disallow: /ilanlarim",
    "Disallow: /mesajlar",
    "Disallow: /favoriler",
    "Disallow: /bildirimler",
    "Disallow: /doping",
    "Disallow: /arsiv",
    "Disallow: /login",
    "",
    "# API rotaları",
    "Disallow: /api/",
    "",
    "# Arama/filtreleme sayfaları — duplicate content önlemi",
    "Disallow: /search",
    "",
    "# Sitemap index",
    `Sitemap: ${BASE_URL}/sitemap.xml`,
  ].join("\n");
}

// ─── Middleware ───────────────────────────────────────────────────────────────

interface SeoEvent {
  url: URL;
  node: { req: { url?: string } };
  req: { method?: string; headers: Headers };
}

export default async function seoMiddleware(
  event: SeoEvent,
  next: () => unknown | Promise<unknown>,
): Promise<unknown> {
  const rawPath = event.url?.pathname ?? event.node?.req?.url ?? "";
  const [path, qs = ""] = rawPath.split("?");
  const params = new URLSearchParams(qs);

  // ── Sitemap Index ──
  if (path === "/sitemap.xml") {
    return xmlResponse(await buildSitemapIndex(), 3600);
  }

  // ── Alt Sitemap'ler ──
  if (path === "/sitemap-static.xml") {
    return xmlResponse(buildStaticSitemap(), 86400);
  }
  if (path === "/sitemap-categories.xml") {
    return xmlResponse(await buildCategoriesSitemap(), 3600);
  }
  if (path === "/sitemap-listings.xml") {
    const page = Math.max(1, parseInt(params.get("page") ?? "1", 10));
    return xmlResponse(await buildListingsSitemap(page), 1800);
  }
  if (path === "/sitemap-stores.xml") {
    return xmlResponse(await buildStoresSitemap(), 7200);
  }
  if (path === "/sitemap-sellers.xml") {
    return xmlResponse(await buildSellersSitemap(), 7200);
  }

  // ── Robots ──
  if (path === "/robots.txt") {
    return new Response(buildRobots(), {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=86400",
      },
    });
  }

  return next();
}
