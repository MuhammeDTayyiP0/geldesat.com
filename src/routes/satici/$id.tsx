import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { getSeller } from "@/lib/server/account";
import { searchCatalog } from "@/lib/server/catalog";
import { ListingCard } from "@/components/listing/ListingCard";
import { NotFound } from "@/components/common/NotFound";
import { BrandSpinner } from "@/components/brand/BrandSpinner";

export const Route = createFileRoute("/satici/$id")({
  loader: async ({ params }) => {
    const seller = await getSeller({ data: { id: params.id } });
    if (!seller) {
      throw notFound();
    }
    const listings = await searchCatalog({ data: { userId: params.id, limit: 24, page: 1 } });
    return { seller, listings: listings.listings };
  },
  head: ({ loaderData }) => {
    if (!loaderData?.seller) return { meta: [] };
    const { seller } = loaderData;
    const BASE = "https://geldesat.com";
    const pageUrl = `${BASE}/satici/${seller.id}`;
    const title = `${seller.name} | GeldeSat Satıcı Profili`;
    const desc = seller.bio
      ? seller.bio.slice(0, 160)
      : `${seller.name} satıcısının tüm ilanlarını GeldeSat'ta inceleyin.${seller.rating_count > 0 ? ` Puan: ${seller.rating_avg.toFixed(1)}/5 (${seller.rating_count} değerlendirme).` : ""}`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { name: "robots", content: "index,follow" },
        { property: "og:site_name", content: "GeldeSat" },
        { property: "og:locale", content: "tr_TR" },
        { property: "og:type", content: "profile" },
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
    };
  },
  pendingComponent: () => <BrandSpinner fullPage text="Satıcı profili yükleniyor…" />,
  notFoundComponent: () => (
    <NotFound
      type="seller"
      title="Satıcı Profili Bulunamadı"
      message="Aradığınız satıcı hesabı bulunamadı, silinmiş veya kapatılmış olabilir."
    />
  ),
  component: SellerPage,
});

function SellerPage() {
  const { seller, listings } = Route.useLoaderData();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="rounded-xl border border-border bg-surface p-6">
        <h1 className="text-2xl font-semibold tracking-tight">{seller.name}</h1>
        <p className="mt-2 flex items-center gap-2 text-sm text-muted">
          <Star className="size-4" /> {seller.rating_avg.toFixed(1)} ({seller.rating_count} değerlendirme) · {seller.listing_count} ilan
          {seller.city ? ` · ${seller.city}` : ""}
        </p>
        {seller.bio ? <p className="mt-3 max-w-2xl text-sm">{seller.bio}</p> : null}
        {seller.store ? (
          <Link to="/magaza/$slug" params={{ slug: seller.store.slug }} className="mt-3 inline-block text-sm text-primary">
            {seller.store.name} mağazası
          </Link>
        ) : null}
      </div>
      <h2 className="mt-10 font-display text-xl font-semibold">İlanları</h2>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {listings.map((l: any) => (
          <ListingCard key={l.id} listing={l} />
        ))}
      </div>
      {seller.reviews.length > 0 ? (
        <section className="mt-10">
          <h2 className="font-display text-xl font-semibold">Yorumlar</h2>
          <ul className="mt-4 space-y-3">
            {seller.reviews.map((r: any) => (
              <li key={r.id} className="rounded-xl border border-border bg-surface p-4">
                <p className="text-sm font-medium">
                  {r.reviewer} · {r.rating}/5
                </p>
                <p className="mt-1 text-sm text-muted">{r.comment}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
