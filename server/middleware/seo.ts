/**
 * Sitemap Index, alt sitemap'ler ve robots.txt için Nitro/H3 server middleware.
 *
 * Rotalar:
 *   GET /sitemap.xml               → Sitemap index (tüm sitemap'leri listeler)
 *   GET /sitemap-static.xml        → Statik sayfalar
 *   GET /sitemap-categories.xml    → Kategoriler
 *   GET /sitemap-listings-N.xml    → Aktif ilanlar (sayfa N: /sitemap-listings-1.xml vb.)
 *   GET /sitemap-listings.xml      → 1. sayfa veya ?page=N geriye uyumluluk
 *   GET /sitemap-stores.xml        → Mağazalar
 *   GET /sitemap-sellers.xml       → Satıcı profilleri
 *   GET /robots.txt                → Robots direktifleri
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
  image?: { loc: string; title?: string } | null,
): string {
  let xml = `  <url>\n    <loc>${xmlEscape(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>`;
  if (image && image.loc) {
    xml += `\n    <image:image>\n      <image:loc>${xmlEscape(image.loc)}</image:loc>`;
    if (image.title) {
      xml += `\n      <image:title>${xmlEscape(image.title)}</image:title>`;
    }
    xml += `\n    </image:image>`;
  }
  xml += `\n  </url>`;
  return xml;
}

function wrapUrlset(entries: string[]): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n` +
    entries.join("\n") +
    `\n</urlset>`
  );
}

function xmlResponse(body: string, maxAge = 3600): Response {
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
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
  } catch (err) {
    console.error("[SEO] buildSitemapIndex DB error:", err);
  }

  const sitemaps: { loc: string; lastmod: string }[] = [
    { loc: `${BASE_URL}/sitemap-static.xml`, lastmod: today },
    { loc: `${BASE_URL}/sitemap-categories.xml`, lastmod: today },
    ...Array.from({ length: listingPages }, (_, i) => ({
      loc: `${BASE_URL}/sitemap-listings-${i + 1}.xml`,
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
    urlEntry(`${BASE_URL}/harita`, today, "daily", "0.8"),
    urlEntry(`${BASE_URL}/sayfa/hakkimizda`, today, "monthly", "0.5"),
    urlEntry(`${BASE_URL}/sayfa/iletisim`, today, "monthly", "0.5"),
    urlEntry(`${BASE_URL}/sayfa/kvkk`, today, "monthly", "0.3"),
    urlEntry(`${BASE_URL}/sayfa/gizlilik`, today, "monthly", "0.3"),
    urlEntry(`${BASE_URL}/sayfa/cerez`, today, "monthly", "0.3"),
    urlEntry(`${BASE_URL}/sayfa/kullanim`, today, "monthly", "0.3"),
    urlEntry(`${BASE_URL}/sayfa/uyelik`, today, "monthly", "0.3"),
  ]);
}

/** /sitemap-categories.xml — Yalnızca aktif ilanı olan veya kök kategoriler ve gerçek lastmod */
async function buildCategoriesSitemap(): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const { getSql } = await import("../../src/lib/db");
    const sql = await getSql();
    const cats = await sql.query<{ slug: string; lastmod: string }>(
      `WITH active_cats AS (
         SELECT DISTINCT category_id FROM listings
         WHERE status = 'ACTIVE' AND (expires_at IS NULL OR expires_at > now())
       ),
       cat_dates AS (
         SELECT category_id, MAX(COALESCE(updated_at, created_at)) as max_date
         FROM listings
         WHERE status = 'ACTIVE' AND (expires_at IS NULL OR expires_at > now())
         GROUP BY category_id
       )
       SELECT c.slug,
              COALESCE(TO_CHAR(cd.max_date, 'YYYY-MM-DD'), $1) as lastmod
       FROM categories c
       LEFT JOIN cat_dates cd ON cd.category_id = c.id
       WHERE c.parent_id IS NULL
          OR c.id IN (SELECT category_id FROM active_cats)
          OR EXISTS (
            SELECT 1 FROM categories ch
            WHERE ch.parent_id = c.id AND ch.id IN (SELECT category_id FROM active_cats)
          )
       ORDER BY c.sort_order, c.name`,
      [today],
    );
    return wrapUrlset(
      cats.map((c) =>
        urlEntry(
          `${BASE_URL}/category/${c.slug}`,
          c.lastmod || today,
          "daily",
          "0.8",
        ),
      ),
    );
  } catch (err) {
    console.error("[SEO] buildCategoriesSitemap error:", err);
    return wrapUrlset([]);
  }
}

/** /sitemap-listings-N.xml veya ?page=N */
async function buildListingsSitemap(page: number): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  const offset = (page - 1) * LISTINGS_PER_PAGE;
  try {
    const { getSql } = await import("../../src/lib/db");
    const sql = await getSql();
    const listings = await sql.query<{
      slug: string;
      title: string;
      images: string[] | string | null;
      updated_at: string;
    }>(
      `SELECT slug, title, images, updated_at FROM listings
       WHERE status = 'ACTIVE' AND (expires_at IS NULL OR expires_at > now())
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [LISTINGS_PER_PAGE, offset],
    );
    return wrapUrlset(
      listings.map((l) => {
        let firstImg: string | null = null;
        if (l.images) {
          const imgs = Array.isArray(l.images)
            ? l.images
            : typeof l.images === "string"
              ? (() => {
                  try {
                    return JSON.parse(l.images);
                  } catch {
                    return [];
                  }
                })()
              : [];
          if (imgs.length > 0 && typeof imgs[0] === "string") {
            firstImg = imgs[0].startsWith("http")
              ? imgs[0]
              : `${BASE_URL}${imgs[0].startsWith("/") ? "" : "/"}${imgs[0]}`;
          }
        }
        return urlEntry(
          `${BASE_URL}/ilan/${l.slug}`,
          l.updated_at ? String(l.updated_at).slice(0, 10) : today,
          "daily",
          "0.6",
          firstImg ? { loc: firstImg, title: l.title } : null,
        );
      }),
    );
  } catch (err) {
    console.error("[SEO] buildListingsSitemap error:", err);
    return wrapUrlset([]);
  }
}

/** /sitemap-stores.xml — Aktif mağazalar */
async function buildStoresSitemap(): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const { getSql } = await import("../../src/lib/db");
    const sql = await getSql();
    const stores = await sql.query<{ slug: string; lastmod: string }>(
      `SELECT s.slug,
              COALESCE(TO_CHAR(MAX(l.updated_at), 'YYYY-MM-DD'), TO_CHAR(s.created_at, 'YYYY-MM-DD'), $1) as lastmod
       FROM stores s
       LEFT JOIN listings l ON l.store_id = s.id AND l.status = 'ACTIVE' AND (l.expires_at IS NULL OR l.expires_at > now())
       GROUP BY s.slug, s.created_at
       ORDER BY s.created_at DESC
       LIMIT 10000`,
      [today],
    );
    return wrapUrlset(
      stores.map((s) =>
        urlEntry(
          `${BASE_URL}/magaza/${s.slug}`,
          s.lastmod || today,
          "weekly",
          "0.6",
        ),
      ),
    );
  } catch (err) {
    console.error("[SEO] buildStoresSitemap error:", err);
    return wrapUrlset([]);
  }
}

/** /sitemap-sellers.xml — Yalnızca aktif ilanı olan satıcılar */
async function buildSellersSitemap(): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const { getSql } = await import("../../src/lib/db");
    const sql = await getSql();
    const sellers = await sql.query<{ user_id: string; lastmod: string }>(
      `SELECT p.user_id,
              COALESCE(TO_CHAR(MAX(l.updated_at), 'YYYY-MM-DD'), TO_CHAR(p.created_at, 'YYYY-MM-DD'), $1) as lastmod
       FROM profiles p
       JOIN listings l ON l.user_id = p.user_id AND l.status = 'ACTIVE' AND (l.expires_at IS NULL OR l.expires_at > now())
       GROUP BY p.user_id, p.created_at
       ORDER BY p.created_at DESC
       LIMIT 10000`,
      [today],
    );
    return wrapUrlset(
      sellers.map((p) =>
        urlEntry(
          `${BASE_URL}/satici/${p.user_id}`,
          p.lastmod || today,
          "weekly",
          "0.5",
        ),
      ),
    );
  } catch (err) {
    console.error("[SEO] buildSellersSitemap error:", err);
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
    "Disallow: /ilan-ver",
    "",
    "# API rotaları",
    "Disallow: /api/",
    "",
    "# Arama sayfaları noindex meta taşır; taramaya açık kalmalı ki Google bu direktifi okuyabilsin.",
    "",
    "# Sitemap index",
    `Sitemap: ${BASE_URL}/sitemap.xml`,
  ].join("\n");
}

// ─── Middleware ───────────────────────────────────────────────────────────────

interface SeoEvent {
  url?: URL;
  node?: { req?: { url?: string } };
  req?: { method?: string; headers?: Headers };
}

export default async function seoMiddleware(
  event: SeoEvent,
  next: () => unknown | Promise<unknown>,
): Promise<unknown> {
  let path = "";
  let search = "";
  const eventUrl = event.url as URL | undefined;
  if (eventUrl && typeof eventUrl.pathname === "string") {
    path = eventUrl.pathname;
    search = eventUrl.search || "";
  } else {
    const rawUrl = event.node?.req?.url || "";
    const [p, s = ""] = rawUrl.split("?");
    path = p;
    search = s ? `?${s}` : "";
  }
  const params = new URLSearchParams(search);

  // ── 301 Canonical host redirect (geldesat.com → www.geldesat.com) ──
  const reqHost =
    event.req?.headers?.get?.("x-forwarded-host") ??
    event.req?.headers?.get?.("host") ??
    event.url?.host ??
    "";
  const cleanHost = String(reqHost).split(":")[0].toLowerCase();
  if (cleanHost === "geldesat.com") {
    return Response.redirect(`${BASE_URL}${path}${search}`, 301);
  }

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

  // /sitemap-listings-1.xml, /sitemap-listings-2.xml veya /sitemap-listings.xml?page=N
  const listingsMatch = path.match(/^\/sitemap-listings(?:-(\d+))?\.xml$/);
  if (listingsMatch) {
    const pageFromPath = listingsMatch[1] ? parseInt(listingsMatch[1], 10) : NaN;
    const pageFromQuery = parseInt(params.get("page") ?? "1", 10);
    const pageNum = !isNaN(pageFromPath) ? pageFromPath : pageFromQuery;
    const page = Math.max(1, isNaN(pageNum) ? 1 : pageNum);
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

