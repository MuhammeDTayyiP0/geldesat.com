import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ProfilePageSkeleton } from "@/components/listing/ListingGridSkeleton";
import { getStore } from "@/lib/server/account";
import { searchCatalog } from "@/lib/server/catalog";
import { ListingCard } from "@/components/listing/ListingCard";
import { Badge } from "@/components/ui/badge";
import { NotFound } from "@/components/common/NotFound";
import { jsonLd } from "@/lib/seo";

export const Route = createFileRoute("/magaza/$slug")({
  loader: async ({ params }) => {
    const store = await getStore({ data: { slug: params.slug } });
    if (!store) {
      throw notFound();
    }
    const listings = await searchCatalog({ data: { storeId: store.id, limit: 24, page: 1 } });
    return { store, listings: listings.listings };
  },
  head: ({ loaderData }) => {
    if (!loaderData?.store) {
      return {
        meta: [
          { title: "Mağaza Bulunamadı | GeldeSat" },
          { name: "robots", content: "noindex,nofollow" },
        ],
      };
    }
    const { store } = loaderData;
    const BASE = "https://www.geldesat.com";
    const pageUrl = `${BASE}/magaza/${store.slug}`;
    const title = `${store.name} Mağazası İlanları ve Fiyatları | GeldeSat`;
    const desc = store.description
      ? store.description.slice(0, 160)
      : `${store.name} mağazasının tüm güncel satılık ve kiralık ilanlarını GeldeSat'ta inceleyin, uygun fiyatlarla doğrudan satıcıyla iletişime geçin.`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { name: "robots", content: "index,follow" },
        { property: "og:site_name", content: "GeldeSat" },
        { property: "og:locale", content: "tr_TR" },
        { property: "og:type", content: "website" },
        { property: "og:url", content: pageUrl },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:image", content: `${BASE}/og.jpg` },
        { name: "twitter:card", content: "summary" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: desc },
        { name: "twitter:image", content: `${BASE}/og.jpg` },
      ],
      links: [{ rel: "canonical", href: pageUrl }],
      scripts: [
        {
          type: "application/ld+json",
          children: jsonLd({
            "@context": "https://schema.org",
            "@type": "LocalBusiness",
            name: store.name,
            description: desc,
            url: pageUrl,
            ...(store.city ? { address: { "@type": "PostalAddress", addressLocality: store.city, addressCountry: "TR" } } : {}),
          }),
        },
        {
          type: "application/ld+json",
          children: jsonLd({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Anasayfa", item: BASE },
              { "@type": "ListItem", position: 2, name: store.name, item: pageUrl },
            ],
          }),
        },
      ],
    };
  },
  pendingComponent: ProfilePageSkeleton,
  notFoundComponent: () => (
    <NotFound
      type="store"
      title="Mağaza Bulunamadı"
      message="Aradığınız kurumsal mağaza bulunamadı veya bağlantı geçersiz."
    />
  ),
  component: StorePage,
});

function StorePage() {
  const { store, listings } = Route.useLoaderData();
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="rounded-xl border border-border bg-surface p-6">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{store.name}</h1>
          <Badge tone="primary">{store.plan}</Badge>
        </div>
        <p className="mt-2 text-sm text-muted">{store.description}</p>
        {store.city ? <p className="mt-1 text-sm text-muted">{store.city}</p> : null}
        <Link to="/satici/$id" params={{ id: store.user_id }} className="mt-3 inline-block text-sm text-primary">
          Satıcı profili
        </Link>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-3">
        {listings.map((l: any) => (
          <ListingCard key={l.id} listing={l} />
        ))}
      </div>
    </div>
  );
}
