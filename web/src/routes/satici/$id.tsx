import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { BadgeCheck, CalendarDays, Eye, LayoutGrid, MapPin, Pencil, Share2, Star, Store as StoreIcon } from "lucide-react";
import { toast } from "sonner";
import { ProfilePageSkeleton } from "@/components/listing/ListingGridSkeleton";
import { getSeller } from "@/lib/server/account";
import { searchCatalog } from "@/lib/server/catalog";
import { ListingCard } from "@/components/listing/ListingCard";
import { NotFound } from "@/components/common/NotFound";
import { UserAvatar } from "@/components/account/AccountShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cn, formatDate } from "@/lib/utils";
import { jsonLd } from "@/lib/seo";

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
    if (!loaderData?.seller) {
      return {
        meta: [
          { title: "Satıcı Bulunamadı | GeldeSat" },
          { name: "robots", content: "noindex,nofollow" },
        ],
      };
    }
    const { seller } = loaderData;
    const BASE = "https://www.geldesat.com";
    const pageUrl = `${BASE}/satici/${seller.id}`;
    const store = seller.store;
    const title = store
      ? `${store.name} Mağazası İlanları ve Fiyatları | GeldeSat`
      : `${seller.name} Satıcı Profili ve Güncel İlanları | GeldeSat`;
    const about = store?.description || seller.bio;
    const desc = about
      ? about.slice(0, 160)
      : `${seller.name} kullanıcısının GeldeSat üzerindeki tüm aktif ilanlarını inceleyin.${seller.rating_count > 0 ? ` Değerlendirme Puanı: ${seller.rating_avg.toFixed(1)}/5 (${seller.rating_count} yorum).` : ""} Güvenli alışveriş ve hızlı iletişim.`;
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
      scripts: [
        {
          type: "application/ld+json",
          children: jsonLd({
            "@context": "https://schema.org",
            "@type": store ? "LocalBusiness" : "Person",
            name: store?.name ?? seller.name,
            description: about ?? desc,
            url: pageUrl,
            ...(seller.city ? { address: { "@type": "PostalAddress", addressLocality: seller.city, addressCountry: "TR" } } : {}),
            ...(seller.rating_count > 0
              ? {
                  aggregateRating: {
                    "@type": "AggregateRating",
                    ratingValue: seller.rating_avg.toFixed(1),
                    reviewCount: seller.rating_count,
                    bestRating: "5",
                    worstRating: "1",
                  },
                }
              : {}),
          }),
        },
        {
          type: "application/ld+json",
          children: jsonLd({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Anasayfa", item: BASE },
              { "@type": "ListItem", position: 2, name: seller.name, item: pageUrl },
            ],
          }),
        },
      ],
    };
  },
  pendingComponent: ProfilePageSkeleton,
  notFoundComponent: () => (
    <NotFound
      type="seller"
      title="Satıcı Profili Bulunamadı"
      message="Aradığınız satıcı hesabı bulunamadı, silinmiş veya kapatılmış olabilir."
    />
  ),
  component: SellerPage,
});

/** The one public profile: what everyone sees, with an owner bar when it is your own. */
function SellerPage() {
  const { seller, listings } = Route.useLoaderData();
  const { user } = useCurrentUserState();
  const isOwner = user?.id === seller.id;
  const [tab, setTab] = useState<"listings" | "reviews">("listings");
  const store = seller.store;

  async function share() {
    const url = `${window.location.origin}/satici/${seller.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${store?.name ?? seller.name} – GeldeSat`, url });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Profil bağlantısı kopyalandı");
    } catch {
      toast.error("Bağlantı kopyalanamadı");
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-12 pt-4 sm:pt-6">
      {isOwner ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-[14px] border border-primary/30 bg-primary/8 px-4 py-3">
          <Eye className="size-5 shrink-0 text-primary" />
          <p className="min-w-0 flex-1 text-sm">
            <span className="font-semibold">Bu sizin profiliniz.</span>{" "}
            <span className="text-muted">Alıcılar sayfanızı böyle görür.</span>
          </p>
          <div className="flex gap-2">
            <Link to="/ayarlar/profil">
              <Button size="sm" variant="outline">
                <Pencil className="size-3.5" /> Profili düzenle
              </Button>
            </Link>
            {store ? (
              <Link to="/ayarlar/magaza">
                <Button size="sm" variant="outline">
                  <StoreIcon className="size-3.5" /> Mağaza
                </Button>
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      <section className="rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-6">
        <div className="flex items-start gap-4">
          {store?.logo ? (
            <img src={store.logo} alt="" className="size-16 shrink-0 rounded-2xl border border-border object-cover sm:size-20" />
          ) : (
            <UserAvatar src={seller.avatar} name={store?.name ?? seller.name} className="size-16 text-2xl sm:size-20 sm:text-3xl" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{store?.name ?? seller.name}</h1>
              {store ? (
                <Badge tone="primary" className="gap-1">
                  <BadgeCheck className="size-3.5" /> Kurumsal mağaza
                </Badge>
              ) : null}
            </div>
            {store ? <p className="text-sm text-muted">{seller.name}</p> : null}
            <div className="mt-1.5 flex items-center gap-1.5 text-sm">
              {seller.rating_count > 0 ? (
                <>
                  <Star className="size-4 fill-amber-400 text-amber-400" />
                  <span className="font-semibold">{seller.rating_avg.toFixed(1)}</span>
                  <span className="text-muted">({seller.rating_count} değerlendirme)</span>
                </>
              ) : (
                <span className="text-muted">Henüz değerlendirme yok</span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void share()}
            aria-label="Profili paylaş"
            className="grid size-10 shrink-0 place-items-center rounded-full text-muted hover:bg-elevated hover:text-fg"
          >
            <Share2 className="size-5" />
          </button>
        </div>

        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted">
          {store?.city || seller.city ? (
            <li className="inline-flex items-center gap-1.5">
              <MapPin className="size-4 text-subtle" /> {store?.city || seller.city}
            </li>
          ) : null}
          <li className="inline-flex items-center gap-1.5">
            <CalendarDays className="size-4 text-subtle" /> {memberSince(seller.since)}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <LayoutGrid className="size-4 text-subtle" /> {seller.listing_count} yayında ilan
          </li>
        </ul>
        {store?.description ? <p className="mt-3 max-w-3xl whitespace-pre-wrap text-sm leading-relaxed">{store.description}</p> : null}
        {seller.bio ? <p className="mt-3 max-w-3xl whitespace-pre-wrap text-sm leading-relaxed">{seller.bio}</p> : null}
      </section>

      <div role="tablist" aria-label="Profil" className="mt-6 flex gap-2">
        {(
          [
            ["listings", `İlanlar (${seller.listing_count})`],
            ["reviews", `Değerlendirmeler (${seller.rating_count})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              "h-9 rounded-full border px-4 text-sm font-medium transition-colors",
              tab === key ? "border-primary bg-primary text-primary-fg" : "border-border bg-surface hover:bg-elevated",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "listings" ? (
        listings.length ? (
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {listings.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-[14px] border border-dashed border-border bg-surface p-10 text-center">
            <LayoutGrid className="mx-auto size-7 text-subtle" />
            <p className="mt-2 text-sm text-muted">Yayında ilanı yok.</p>
            {isOwner ? (
              <Link to="/ilan-ver" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
                Ücretsiz ilan ver
              </Link>
            ) : null}
          </div>
        )
      ) : seller.reviews.length ? (
        <ul className="mt-4 space-y-3">
          {seller.reviews.map((r) => (
            <li key={r.id} className="rounded-[14px] border border-border bg-surface p-4">
              <div className="flex items-center gap-2 text-sm">
                <span className="inline-flex">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className={cn("size-3.5", i <= r.rating ? "fill-amber-400 text-amber-400" : "text-border")} />
                  ))}
                </span>
                <span className="font-medium">{r.reviewer}</span>
                <span className="text-xs text-subtle">· {formatDate(r.at)}</span>
              </div>
              {r.comment ? <p className="mt-1.5 text-sm text-muted">{r.comment}</p> : null}
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-4 rounded-[14px] border border-dashed border-border bg-surface p-10 text-center">
          <Star className="mx-auto size-7 text-subtle" />
          <p className="mt-2 text-sm text-muted">Henüz değerlendirme yok.</p>
        </div>
      )}
    </div>
  );
}

function memberSince(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "GeldeSat üyesi" : `${d.toLocaleDateString("tr-TR", { month: "long", year: "numeric" })} tarihinden beri üye`;
}
