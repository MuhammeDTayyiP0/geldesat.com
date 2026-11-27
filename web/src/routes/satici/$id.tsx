import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  CalendarDays,
  Eye,
  LayoutGrid,
  MapPin,
  MessageCircle,
  Pencil,
  Search,
  Share2,
  Star,
  Store as StoreIcon,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { ProfilePageSkeleton } from "@/components/listing/ListingGridSkeleton";
import { getSeller, getSellerReviews } from "@/lib/server/account";
import { followSeller, getFollowStatus, unfollowSeller } from "@/lib/server/follows";
import { errorText } from "@/lib/error-text";
import { searchCatalog } from "@/lib/server/catalog";
import { ListingCard } from "@/components/listing/ListingCard";
import { NotFound } from "@/components/common/NotFound";
import { UserAvatar } from "@/components/account/AccountShell";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useFlag } from "@/lib/use-flag";
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
    const rawImg = store?.logo || seller.avatar;
    const ogImage = rawImg ? (rawImg.startsWith("http") ? rawImg : `${BASE}${rawImg.startsWith("/") ? "" : "/"}${rawImg}`) : `${BASE}/og.jpg`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { name: "robots", content: seller.listing_count > 0 || seller.rating_count > 0 ? "index,follow" : "noindex,nofollow" },
        { property: "og:site_name", content: "GeldeSat" },
        { property: "og:locale", content: "tr_TR" },
        { property: "og:type", content: "profile" },
        { property: "og:url", content: pageUrl },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:image", content: ogImage },
        { name: "twitter:card", content: "summary" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: desc },
        { name: "twitter:image", content: ogImage },
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
            ...(store && seller.rating_count > 0
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

const LISTINGS_PAGE_SIZE = 24;
const REVIEWS_PAGE_SIZE = 20;

/** The one public profile: what everyone sees, with an owner bar when it is your own. */
function SellerPage() {
  const { seller, listings: firstListings } = Route.useLoaderData();
  const takipAcik = useFlag("satici_takip");
  const navigate = useNavigate();
  const { user } = useCurrentUserState();
  const isOwner = user?.id === seller.id;

  const [listings, setListings] = useState(firstListings);
  const [reviews, setReviews] = useState(seller.reviews);
  const [page, setPage] = useState(1);
  const [totalListings, setTotalListings] = useState(seller.listing_count);
  const [hasMoreListings, setHasMoreListings] = useState(
    firstListings.length >= LISTINGS_PAGE_SIZE && firstListings.length < seller.listing_count,
  );
  const [hasMoreReviews, setHasMoreReviews] = useState(
    seller.reviews.length >= REVIEWS_PAGE_SIZE && seller.reviews.length < seller.rating_count,
  );
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [filtering, setFiltering] = useState(false);
  const [followState, setFollowState] = useState<{ following: boolean; followers: number } | null>(null);
  const [followBusy, setFollowBusy] = useState(false);
  const [tab, setTab] = useState<"listings" | "reviews">("listings");
  const store = seller.store;
  const responseStats = seller.responseStats;

  const categoryOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of firstListings) {
      if (l.category_id && l.category_name) map.set(l.category_id, l.category_name);
    }
    for (const l of listings) {
      if (l.category_id && l.category_name && !map.has(l.category_id)) map.set(l.category_id, l.category_name);
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }, [firstListings, listings]);

  useEffect(() => {
    setListings(firstListings);
    setReviews(seller.reviews);
    setPage(1);
    setQ("");
    setCategory("");
    setTotalListings(seller.listing_count);
    setHasMoreListings(firstListings.length >= LISTINGS_PAGE_SIZE && firstListings.length < seller.listing_count);
    setHasMoreReviews(seller.reviews.length >= REVIEWS_PAGE_SIZE && seller.reviews.length < seller.rating_count);
  }, [seller.id, firstListings, seller.reviews, seller.listing_count, seller.rating_count]);

  useEffect(() => {
    if (!takipAcik) {
      setFollowState(null);
      return;
    }
    let cancelled = false;
    getFollowStatus({ data: { sellerId: seller.id } })
      .then((res) => {
        if (!cancelled) setFollowState(res);
      })
      .catch(() => {
        if (!cancelled) setFollowState(null);
      });
    return () => {
      cancelled = true;
    };
  }, [takipAcik, seller.id, user?.id]);

  const hasFilter = Boolean(q.trim() || category);

  useEffect(() => {
    if (!q.trim() && !category) {
      setListings(firstListings);
      setPage(1);
      setTotalListings(seller.listing_count);
      setHasMoreListings(firstListings.length >= LISTINGS_PAGE_SIZE && firstListings.length < seller.listing_count);
      setFiltering(false);
      return;
    }

    let cancelled = false;
    setFiltering(true);
    const timer = window.setTimeout(() => {
      searchCatalog({
        data: {
          userId: seller.id,
          q: q.trim() || undefined,
          category: category || undefined,
          limit: LISTINGS_PAGE_SIZE,
          page: 1,
        },
      })
        .then((res) => {
          if (cancelled) return;
          setListings(res.listings);
          setPage(1);
          setTotalListings(res.total);
          setHasMoreListings(res.listings.length >= LISTINGS_PAGE_SIZE && res.listings.length < res.total);
        })
        .catch((err) => {
          if (!cancelled) toast.error(errorText(err, "İlanlar filtrelenemedi"));
        })
        .finally(() => {
          if (!cancelled) setFiltering(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [q, category, seller.id, firstListings, seller.listing_count]);

  async function moreListings() {
    setBusy(true);
    try {
      const next = await searchCatalog({
        data: {
          userId: seller.id,
          q: q.trim() || undefined,
          category: category || undefined,
          limit: LISTINGS_PAGE_SIZE,
          page: page + 1,
        },
      });
      setListings((prev) => {
        const seen = new Set(prev.map((l) => l.id));
        const merged = [...prev, ...next.listings.filter((l) => !seen.has(l.id))];
        setHasMoreListings(next.listings.length >= LISTINGS_PAGE_SIZE && merged.length < next.total);
        return merged;
      });
      setTotalListings(next.total);
      setPage(page + 1);
    } catch (err) {
      toast.error(errorText(err, "İlanlar yüklenemedi"));
    } finally {
      setBusy(false);
    }
  }

  async function moreReviews() {
    setBusy(true);
    try {
      const next = await getSellerReviews({ data: { id: seller.id, offset: reviews.length } });
      setReviews((prev) => [...prev, ...next]);
      if (next.length < REVIEWS_PAGE_SIZE) setHasMoreReviews(false);
    } catch (err) {
      toast.error(errorText(err, "Değerlendirmeler yüklenemedi"));
    } finally {
      setBusy(false);
    }
  }

  async function toggleFollow() {
    if (!user) {
      void navigate({ to: "/login", search: { redirect: `/satici/${seller.id}` } });
      return;
    }
    setFollowBusy(true);
    try {
      const res = followState?.following
        ? await unfollowSeller({ data: { sellerId: seller.id } })
        : await followSeller({ data: { sellerId: seller.id } });
      setFollowState(res);
      toast.success(res.following ? "Satıcı takip edildi" : "Takipten çıkıldı");
    } catch (err) {
      toast.error(errorText(err, "İşlem gerçekleştirilemedi"));
    } finally {
      setFollowBusy(false);
    }
  }

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
            <Link to="/ayarlar/profil" className={buttonVariants({ variant: "outline", size: "sm" })}>
                <Pencil className="size-3.5" /> Profili düzenle
              </Link>
            {store ? (
              <Link to="/ayarlar/magaza" className={buttonVariants({ variant: "outline", size: "sm" })}>
                  <StoreIcon className="size-3.5" /> Mağaza
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
          <div className="flex shrink-0 items-center gap-2">
            {takipAcik && !isOwner && followState !== null ? (
              <Button
                type="button"
                size="sm"
                variant={followState.following ? "outline" : "default"}
                disabled={followBusy}
                onClick={() => void toggleFollow()}
                aria-pressed={followState.following}
              >
                {followState.following ? <UserCheck className="size-4" /> : <UserPlus className="size-4" />}
                <span>{followState.following ? "Takip ediliyor" : "Takip et"}</span>
              </Button>
            ) : null}
            <button
              type="button"
              onClick={() => void share()}
              aria-label="Profili paylaş"
              className="grid size-10 shrink-0 place-items-center rounded-full text-muted hover:bg-elevated hover:text-fg"
            >
              <Share2 className="size-5" />
            </button>
          </div>
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
          {takipAcik && !isOwner && followState !== null ? (
            <li className="inline-flex items-center gap-1.5">
              <Users className="size-4 text-subtle" /> {followState.followers} takipçi
            </li>
          ) : null}
          {responseStats ? (
            <li className="inline-flex items-center gap-1.5 text-ok">
              <MessageCircle className="size-4 shrink-0" />
              <span>
                Yanıt oranı %{Math.round(responseStats.responseRate)} · Ort. {Math.round(responseStats.avgReplyMinutes)} dk
              </span>
            </li>
          ) : null}
        </ul>
        {store?.description ? <p className="mt-3 max-w-3xl whitespace-pre-wrap text-sm leading-relaxed">{store.description}</p> : null}
        {seller.bio ? <p className="mt-3 max-w-3xl whitespace-pre-wrap text-sm leading-relaxed">{seller.bio}</p> : null}
      </section>

      <div aria-label="Profil" className="mt-6 flex gap-2">
        {(
          [
            ["listings", `İlanlar (${seller.listing_count})`],
            ["reviews", `Değerlendirmeler (${seller.rating_count})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              "h-9 rounded-full border px-4 text-sm font-medium transition-colors",
              tab === key ? "border-primary bg-primary-solid text-primary-fg" : "border-border bg-surface hover:bg-elevated",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "listings" ? (
        <>
          {seller.listing_count > 0 ? (
            <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Satıcının ilanlarında ara…"
                  aria-label="Satıcının ilanlarında ara"
                  className="h-10 pl-9"
                />
              </div>
              <Select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                aria-label="Kategoriye göre filtrele"
                className="h-10 sm:w-56"
              >
                <option value="">Tüm kategoriler</option>
                {categoryOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              {hasFilter ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setQ("");
                    setCategory("");
                  }}
                  className="h-10"
                >
                  <X className="size-4" /> Temizle
                </Button>
              ) : null}
            </div>
          ) : null}

          {filtering ? (
            <div className="mt-4 rounded-[14px] border border-border bg-surface p-8 text-center text-sm text-muted">
              İlanlar filtreleniyor…
            </div>
          ) : listings.length ? (
            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              {listings.map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
              {hasMoreListings && listings.length < totalListings ? (
                <div className="col-span-full flex justify-center pt-2">
                  <Button variant="outline" disabled={busy} onClick={() => void moreListings()}>
                    {busy ? "Yükleniyor…" : "Daha fazla ilan göster"}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : hasFilter ? (
            <div className="mt-4 rounded-[14px] border border-dashed border-border bg-surface p-10 text-center">
              <Search className="mx-auto size-7 text-subtle" />
              <p className="mt-2 text-sm text-muted">Aramanızla eşleşen ilan bulunamadı.</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => {
                  setQ("");
                  setCategory("");
                }}
              >
                Filtreleri temizle
              </Button>
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
          )}
        </>
      ) : reviews.length ? (
        <ul className="mt-4 space-y-3">
          {reviews.map((r) => (
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
          {hasMoreReviews && reviews.length < seller.rating_count ? (
            <li className="flex justify-center pt-1">
              <Button variant="outline" disabled={busy} onClick={() => void moreReviews()}>
                {busy ? "Yükleniyor…" : "Daha fazla değerlendirme göster"}
              </Button>
            </li>
          ) : null}
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
