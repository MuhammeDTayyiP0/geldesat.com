/**
 * Sitemap.xml ve robots.txt için Nitro/H3 server middleware.
 * TanStack Router noktalı dosya adlarını route olarak tanımadığından
 * bu route'lar burada Nitro middleware olarak sunulur:
 *   GET /sitemap.xml  → XML sitemap
 *   GET /robots.txt   → Robots direktifleri
 */

const BASE_URL = "https://geldesat.com";

interface SeoEvent {
  url: URL;
  node: { req: { url?: string } };
  req: { method?: string; headers: Headers };
}

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

async function buildSitemap(): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);

  const staticUrls = [
    urlEntry(`${BASE_URL}/`, today, "daily", "1.0"),
    urlEntry(`${BASE_URL}/ilan-ver`, today, "weekly", "0.7"),
    urlEntry(`${BASE_URL}/sayfa/hakkimizda`, today, "monthly", "0.4"),
    urlEntry(`${BASE_URL}/sayfa/iletisim`, today, "monthly", "0.4"),
    urlEntry(`${BASE_URL}/sayfa/kvkk`, today, "monthly", "0.3"),
    urlEntry(`${BASE_URL}/sayfa/gizlilik`, today, "monthly", "0.3"),
    urlEntry(`${BASE_URL}/sayfa/kullanim`, today, "monthly", "0.3"),
    urlEntry(`${BASE_URL}/sayfa/uyelik`, today, "monthly", "0.3"),
  ];

  let categoryUrls: string[] = [];
  let listingUrls: string[] = [];

  try {
    const { getSql } = await import("../../src/lib/db");
    const sql = await getSql();

    const cats = await sql.query<{ slug: string; updated_at: string | null }>(
      "SELECT slug, updated_at FROM categories ORDER BY sort_order, name",
    );
    categoryUrls = cats.map((c) =>
      urlEntry(
        `${BASE_URL}/category/${c.slug}`,
        c.updated_at ? String(c.updated_at).slice(0, 10) : today,
        "weekly",
        "0.7",
      ),
    );

    const listings = await sql.query<{ slug: string; updated_at: string }>(
      `SELECT slug, updated_at FROM listings
       WHERE status = 'ACTIVE' AND (expires_at IS NULL OR expires_at > now())
       ORDER BY created_at DESC
       LIMIT 50000`,
    );
    listingUrls = listings.map((l) =>
      urlEntry(
        `${BASE_URL}/ilan/${l.slug}`,
        l.updated_at ? String(l.updated_at).slice(0, 10) : today,
        "daily",
        "0.6",
      ),
    );
  } catch {
    // DB hatası — sadece statik sayfalar döndür
  }

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    [...staticUrls, ...categoryUrls, ...listingUrls].join("\n") +
    `\n</urlset>`
  );
}

function buildRobots(): string {
  return [
    "User-agent: *",
    "Allow: /",
    "",
    "# Özel / kişisel sayfalar",
    "Disallow: /admin",
    "Disallow: /profil",
    "Disallow: /ilanlarim",
    "Disallow: /mesajlar",
    "Disallow: /favoriler",
    "Disallow: /bildirimler",
    "Disallow: /doping",
    "Disallow: /arsiv",
    "",
    "# Arama/filtreleme sayfaları — duplicate content önlemi",
    "Disallow: /search",
    "",
    `Sitemap: ${BASE_URL}/sitemap.xml`,
  ].join("\n");
}

export default async function seoMiddleware(
  event: SeoEvent,
  next: () => unknown | Promise<unknown>,
): Promise<unknown> {
  const path = event.url?.pathname ?? event.node?.req?.url ?? "";

  if (path === "/sitemap.xml") {
    const xml = await buildSitemap();
    return new Response(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  }

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
