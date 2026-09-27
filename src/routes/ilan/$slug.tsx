import { createFileRoute, Link, useNavigate, notFound } from "@tanstack/react-router";
import { NotFound } from "@/components/common/NotFound";
import { buildListingSeo } from "@/lib/seo";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  Heart,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  RefreshCw,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Star,
  Tag,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getListing, incrementView } from "@/lib/server/catalog";
import {
  checkReviewEligibility,
  favoriteIds,
  leaveReview,
  reportListing,
  startConversation,
  toggleFavorite,
} from "@/lib/server/social";
import { deleteListing, renewListing, revealPhone, setListingStatus } from "@/lib/server/account";
import {
  cleanPhone,
  formatDate,
  formatNumber,
  formatPhone,
  formatPrice,
  listingStatusLabel,
} from "@/lib/utils";
import { REPORT_REASONS } from "@/lib/data/geo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea, Select } from "@/components/ui/input";
import { ListingCard } from "@/components/listing/ListingCard";
import { ListingDetailSkeleton } from "@/components/listing/ListingDetailSkeleton";
import { ListingImageGallery } from "@/components/listing/ListingImageGallery";
import { StickyContactBar } from "@/components/listing/StickyContactBar";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { toast } from "sonner";

export const Route = createFileRoute("/ilan/$slug")({
  loader: async ({ params }) => {
    const data = await getListing({ data: { slug: params.slug } });
    if (!data || !data.listing) {
      throw notFound();
    }
    return data;
  },
  notFoundComponent: () => (
    <NotFound
      type="listing"
      title="İlan Bulunamadı veya Yayından Kaldırıldı"
      message="Aradığınız ilan satılmış, süresi dolmuş veya sahibi tarafından yayından kaldırılmış olabilir. Benzer ilanları arayabilir veya yeni bir arama yapabilirsiniz."
    />
  ),
  head: ({ loaderData }) => {
    if (!loaderData || !loaderData.listing) {
      return {
        meta: [
          { title: "İlan Bulunamadı | GeldeSat" },
          { name: "robots", content: "noindex,nofollow" },
        ],
      };
    }
    const { listing, path, seller } = loaderData;
    const seo = buildListingSeo({ listing, path, seller });

    const datePublished = listing.created_at
      ? new Date(listing.created_at).toISOString()
      : undefined;
    const dateModified = listing.updated_at
      ? new Date(listing.updated_at).toISOString()
      : datePublished;

    return {
      meta: [
        { title: seo.title },
        { name: "description", content: seo.description },
        { name: "robots", content: listing.status === "ACTIVE" ? "index,follow" : "noindex,nofollow" },
        ...(seller?.name ? [{ name: "author", content: seller.name }] : []),
        // Open Graph
        { property: "og:site_name", content: "GeldeSat" },
        { property: "og:locale", content: "tr_TR" },
        { property: "og:type", content: "product" },
        { property: "og:url", content: seo.pageUrl },
        { property: "og:title", content: seo.title },
        { property: "og:description", content: seo.description },
        { property: "og:image", content: seo.coverImage },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        ...(dateModified ? [{ property: "og:updated_time", content: dateModified }] : []),
        ...(datePublished ? [{ property: "article:published_time", content: datePublished }] : []),
        ...(dateModified ? [{ property: "article:modified_time", content: dateModified }] : []),
        // Twitter / X
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: seo.title },
        { name: "twitter:description", content: seo.description },
        { name: "twitter:image", content: seo.coverImage },
      ],
      links: [{ rel: "canonical", href: seo.canonicalUrl }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(seo.structuredData),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org/",
            "@type": "BreadcrumbList",
            itemListElement: seo.breadcrumbItems,
          }),
        },
      ],
    };
  },
  pendingComponent: ListingDetailSkeleton,
  component: ListingPage,
});

const QUICK_QUESTIONS = [
  "Merhaba, ilanınız hâlâ geçerli mi?",
  "Pazarlık payı var mı?",
  "Son fiyat ne olur?",
  "Takas düşünüyor musunuz?",
];

function ListingPage() {
  const data = Route.useLoaderData();
  const nav = useNavigate();
  const { user } = useCurrentUserState();

  const [fav, setFav] = useState(false);
  const [favLoading, setFavLoading] = useState(false);
  const [phone, setPhone] = useState<string | null>(null);
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [msg, setMsg] = useState(QUICK_QUESTIONS[0]);
  const [msgBusy, setMsgBusy] = useState(false);
  const [reportOn, setReportOn] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);

  // Review states
  const [reviewEligibility, setReviewEligibility] = useState<{
    eligible: boolean;
    reason: string | null;
    existing: { rating: number; comment: string | null } | null;
  } | null>(null);
  const [userRating, setUserRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [userComment, setUserComment] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);

  // Owner management states
  const [ownerActionBusy, setOwnerActionBusy] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const contactSectionRef = useRef<HTMLDivElement>(null);

  // Increment view count
  useEffect(() => {
    if (!data) return;
    // Don't count owner's own views
    if (user && user.id === data.listing.user_id) return;
    void incrementView({ data: { id: data.listing.id } });
  }, [data, user]);

  // Load favorite status
  useEffect(() => {
    if (!data || !user) return;
    favoriteIds()
      .then((ids) => setFav(ids.includes(data.listing.id)))
      .catch(() => undefined);
  }, [data, user]);

  // Check review eligibility
  useEffect(() => {
    if (!data || !data.seller || !user || user.id === data.seller.id) return;
    checkReviewEligibility({ data: { sellerId: data.seller.id, listingId: data.listing.id } })
      .then((res) => {
        setReviewEligibility(res);
        if (res.existing) {
          setUserRating(res.existing.rating);
          setUserComment(res.existing.comment || "");
        }
      })
      .catch(() => undefined);
  }, [data, user]);

  if (!data) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-warn/10 text-warn mb-4">
          <AlertCircle className="size-8" />
        </div>
        <h1 className="font-display text-2xl font-bold text-fg">İlan Bulunamadı</h1>
        <p className="mt-2 text-sm text-muted">
          Aradığınız ilan yayından kaldırılmış, süresi dolmuş veya silinmiş olabilir.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/">
            <Button>Anasayfaya Dön</Button>
          </Link>
          <Link to="/search">
            <Button variant="outline">Tüm İlanlarda Ara</Button>
          </Link>
        </div>
      </div>
    );
  }

  const { listing, path, similar, seller, store, history, has_phone, fav_count, phone_reveal_count } = data;
  const isOwner = Boolean(user && user.id === listing.user_id);
  const expired = Boolean(listing.expires_at && new Date(listing.expires_at).getTime() <= Date.now());
  const isLive = listing.status === "ACTIVE" && !expired;

  // Price history calculations
  const hasHistory = history.length > 1;
  const latestPrice = history.length > 0 ? history[history.length - 1].price : listing.price;
  const firstPrice = history.length > 0 ? history[0].price : listing.price;
  const priceDiff = latestPrice - firstPrice;
  const dropPercent = firstPrice > 0 ? Math.round((Math.abs(priceDiff) / firstPrice) * 100) : 0;

  async function needUser() {
    if (!user) {
      toast.message("Bu işlem için lütfen giriş yapın");
      void nav({ to: "/login" });
      return false;
    }
    return true;
  }

  const handleToggleFav = async () => {
    if (!(await needUser())) return;
    if (favLoading) return;
    setFavLoading(true);
    // Optimistic toggle
    setFav((prev) => !prev);
    try {
      const res = await toggleFavorite({ data: { listingId: listing.id } });
      setFav(res.favorite);
      toast.success(res.favorite ? "İlan favorilere eklendi" : "İlan favorilerden çıkarıldı");
    } catch {
      setFav((prev) => !prev); // revert
      toast.error("Favori işlemi başarısız oldu");
    } finally {
      setFavLoading(false);
    }
  };

  const handleRevealPhone = async () => {
    if (!(await needUser())) return;
    setPhoneLoading(true);
    try {
      const res = await revealPhone({ data: { listingId: listing.id } });
      setPhone(res.phone);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Telefon numarası bulunamadı");
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleCopyPhone = async () => {
    if (!phone) return;
    await navigator.clipboard.writeText(formatPhone(phone));
    toast.success("Telefon numarası kopyalandı");
  };

  const handleCopyListingId = async () => {
    await navigator.clipboard.writeText(listing.id);
    toast.success("İlan numarası kopyalandı");
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: listing.title, url });
        return;
      } catch {
        // user cancelled
      }
    }
    await navigator.clipboard.writeText(url);
    toast.success("İlan bağlantısı panoya kopyalandı");
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(await needUser())) return;
    const content = msg.trim();
    if (!content || msgBusy) return;
    setMsgBusy(true);
    try {
      const res = await startConversation({ data: { listingId: listing.id, content } });
      void nav({ to: "/mesajlar/$id", params: { id: res.conversationId } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Mesaj gönderilemedi");
    } finally {
      setMsgBusy(false);
    }
  };

  const handleReviewSubmit = async () => {
    if (!(await needUser()) || !seller) return;
    setReviewBusy(true);
    try {
      await leaveReview({
        data: {
          sellerId: seller.id,
          listingId: listing.id,
          rating: userRating,
          comment: userComment.trim() || undefined,
        },
      });
      toast.success("Değerlendirmeniz başarıyla kaydedildi");
      setReviewEligibility((prev) =>
        prev
          ? {
              ...prev,
              existing: { rating: userRating, comment: userComment.trim() || null },
            }
          : null
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Puan kaydedilemedi");
    } finally {
      setReviewBusy(false);
    }
  };

  // Owner management actions
  const handleOwnerStatusToggle = async (targetStatus: "ACTIVE" | "INACTIVE" | "SOLD") => {
    setOwnerActionBusy(true);
    try {
      await setListingStatus({ data: { id: listing.id, status: targetStatus } });
      toast.success(
        targetStatus === "SOLD"
          ? "İlan satıldı olarak işaretlendi."
          : targetStatus === "INACTIVE"
          ? "İlan yayından kaldırıldı (pasife alındı)."
          : "İlan tekrar yayına alındı."
      );
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Durum güncellenemedi");
    } finally {
      setOwnerActionBusy(false);
    }
  };

  const handleOwnerDelete = async () => {
    setOwnerActionBusy(true);
    try {
      await deleteListing({ data: { id: listing.id } });
      toast.success("İlan başarıyla silindi");
      void nav({ to: "/ilanlarim" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "İlan silinemedi");
    } finally {
      setOwnerActionBusy(false);
      setDeleteConfirmOpen(false);
    }
  };

  const handleOwnerRenew = async () => {
    setOwnerActionBusy(true);
    try {
      await renewListing({ data: { id: listing.id } });
      toast.success("İlan süresi 30 gün uzatıldı");
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "İlan süresi uzatılamadı");
    } finally {
      setOwnerActionBusy(false);
    }
  };

  // Safe phone and WhatsApp URLs
  const cleanDigits = phone ? cleanPhone(phone) : "";
  const tenDigit = cleanDigits.startsWith("0") ? cleanDigits.slice(1) : cleanDigits;
  const whatsappUrl = phone
    ? `https://wa.me/90${tenDigit}?text=${encodeURIComponent(
        `${listing.title} ilanınız hakkında bilgi almak istiyorum.`
      )}`
    : "";

  const locationString = [listing.city, listing.district, listing.neighborhood]
    .filter(Boolean)
    .join(" / ");

  const googleMapsUrl =
    listing.lat && listing.lng
      ? `https://www.google.com/maps/search/?api=1&query=${listing.lat},${listing.lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationString)}`;

  const yandexMapsUrl =
    listing.lat && listing.lng
      ? `https://yandex.com.tr/harita/?ll=${listing.lng}%2C${listing.lat}&z=14`
      : `https://yandex.com.tr/harita/?text=${encodeURIComponent(locationString)}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8 pb-24 lg:pb-12">
      {/* Non-active or Expired Notice Banner */}
      {listing.status !== "ACTIVE" ? (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-warn/30 bg-warn/10 p-4 text-sm text-warn shadow-2xs">
          <ShieldAlert className="size-5 shrink-0" />
          <div>
            <p className="font-semibold">
              {listing.status === "PENDING"
                ? "Bu ilan yönetici onayı bekliyor."
                : `Bu ilan şu an ${listingStatusLabel(listing.status, expired).toLocaleLowerCase("tr")}.`}
            </p>
            <p className="mt-0.5 text-xs text-warn/80">
              {listing.status === "PENDING"
                ? "İlanınız kontrol edildikten sonra onaylanacak ve tüm alıcılara görünecektir."
                : "Yayında olmayan ilanlarda alıcı iletişimi ve yeni teklifler kapalıdır."}
            </p>
          </div>
        </div>
      ) : expired ? (
        <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-warn/30 bg-warn/10 p-4 text-sm text-warn shadow-2xs">
          <div className="flex items-center gap-3">
            <ShieldAlert className="size-5 shrink-0" />
            <div>
              <p className="font-semibold">Bu ilanın yayın süresi doldu.</p>
              <p className="text-xs text-warn/80">
                {isOwner
                  ? "İlanınızı tekrar aktifleştirmek için süresini uzatabilirsiniz."
                  : "Bu ilan şu anda yayında değildir."}
              </p>
            </div>
          </div>
          {isOwner ? (
            <Button size="sm" onClick={handleOwnerRenew} disabled={ownerActionBusy}>
              <RefreshCw className="size-3.5" /> 30 Gün Uzat
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* Breadcrumbs Navigation */}
      <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-muted">
        <Link to="/" className="hover:text-fg hover:underline transition-colors">
          Anasayfa
        </Link>
        {path.map((p: any) => (
          <span key={p.id} className="flex items-center gap-1.5">
            <ChevronRight className="size-3.5 text-subtle" />
            <Link
              to="/category/$slug"
              params={{ slug: p.slug }}
              className="hover:text-fg hover:underline transition-colors"
            >
              {p.name}
            </Link>
          </span>
        ))}
        <span className="flex items-center gap-1.5 truncate">
          <ChevronRight className="size-3.5 text-subtle shrink-0" />
          <span className="max-w-[200px] sm:max-w-xs truncate font-medium text-fg">
            {listing.title}
          </span>
        </span>
      </nav>

      {/* Mobile-Only Header (Title, Price & Badges) */}
      <div className="mb-4 lg:hidden">
        <div className="flex flex-wrap items-center gap-1.5 mb-2">
          {listing.featured_until && new Date(listing.featured_until) > new Date() ? (
            <Badge tone="ink">Vitrin</Badge>
          ) : null}
          {listing.boosts?.includes("ACIL") ? <Badge tone="danger">Acil</Badge> : null}
          {listing.status === "SOLD" ? <Badge tone="warn">Satıldı</Badge> : null}
        </div>
        <h1 className="font-display text-xl font-bold leading-tight text-fg">{listing.title}</h1>
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
          <MapPin className="size-3.5 text-subtle shrink-0" />
          <span className="truncate">{locationString || "Türkiye"}</span>
        </p>
        <p className="mt-2.5 font-display text-2xl font-bold text-primary tabular-nums">
          {formatPrice(listing.price)}
        </p>
      </div>

      {/* Main Grid: Left (Media & Details) / Right (Sticky Actions & Info) */}
      <div className="grid gap-8 lg:grid-cols-[1.4fr_0.8fr]">
        {/* Left Column */}
        <div className="min-w-0 space-y-8">
          {/* Gallery */}
          <ListingImageGallery
            images={listing.images}
            title={listing.title}
            categoryName={listing.category_name}
          />

          {/* Specifications / Attributes Table */}
          <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6 shadow-card">
            <div className="flex items-center justify-between border-b border-border/80 pb-4 mb-4">
              <h2 className="font-display text-lg font-semibold text-fg">İlan Bilgileri</h2>
              <button
                type="button"
                onClick={handleCopyListingId}
                className="flex items-center gap-1.5 text-xs text-muted hover:text-primary transition-colors bg-elevated px-2.5 py-1 rounded-md"
                title="İlan Numarasını Kopyala"
              >
                <Copy className="size-3.5" />
                <span>İlan No: #{listing.id.slice(-8)}</span>
              </button>
            </div>

            <dl className="grid grid-cols-1 gap-y-2.5 sm:grid-cols-2 sm:gap-x-6 text-sm">
              <div className="flex items-center justify-between py-1.5 border-b border-border/40">
                <dt className="text-muted flex items-center gap-1.5">
                  <Tag className="size-3.5 text-subtle" /> İlan No
                </dt>
                <dd className="font-mono font-medium">{listing.id}</dd>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-border/40">
                <dt className="text-muted flex items-center gap-1.5">
                  <Clock className="size-3.5 text-subtle" /> İlan Tarihi
                </dt>
                <dd className="font-medium">{formatDate(listing.created_at)}</dd>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-border/40">
                <dt className="text-muted flex items-center gap-1.5">
                  <Eye className="size-3.5 text-subtle" /> Görüntülenme
                </dt>
                <dd className="font-medium tabular-nums">{formatNumber(listing.view_count)}</dd>
              </div>

              {listing.expires_at ? (
                <div className="flex items-center justify-between py-1.5 border-b border-border/40">
                  <dt className="text-muted">Bitiş Tarihi</dt>
                  <dd className="font-medium">{formatDate(listing.expires_at)}</dd>
                </div>
              ) : null}

              {store ? (
                <div className="flex items-center justify-between py-1.5 border-b border-border/40">
                  <dt className="text-muted">Kimden</dt>
                  <dd className="font-medium text-primary flex items-center gap-1">
                    <Link to="/magaza/$slug" params={{ slug: store.slug }} className="hover:underline">
                      {store.name}
                    </Link>
                  </dd>
                </div>
              ) : (
                <div className="flex items-center justify-between py-1.5 border-b border-border/40">
                  <dt className="text-muted">Kimden</dt>
                  <dd className="font-medium">Sahibinden</dd>
                </div>
              )}

              {/* Dynamic Category Attributes */}
              {Object.entries(listing.attrs).map(([key, value]) => {
                const strVal = String(value);
                const isBool = strVal === "true" || strVal === "false";
                const boolVal = strVal === "true";
                const parts = strVal.includes(", ") ? strVal.split(", ").filter(Boolean) : null;

                return (
                  <div
                    key={key}
                    className={`flex items-center justify-between py-1.5 border-b border-border/40 ${
                      parts && parts.length > 2 ? "sm:col-span-2" : ""
                    }`}
                  >
                    <dt className="text-muted">{key}</dt>
                    <dd className="font-medium text-right">
                      {isBool ? (
                        boolVal ? (
                          <span className="inline-flex items-center gap-1 text-ok font-semibold text-xs bg-ok/10 px-2 py-0.5 rounded-full">
                            <Check className="size-3" /> Evet
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-muted font-normal text-xs bg-elevated px-2 py-0.5 rounded-full">
                            Hayır
                          </span>
                        )
                      ) : parts && parts.length > 1 ? (
                        <span className="flex flex-wrap justify-end gap-1">
                          {parts.map((p) => (
                            <span
                              key={p}
                              className="rounded-md bg-elevated px-2 py-0.5 text-xs font-normal text-fg"
                            >
                              {p}
                            </span>
                          ))}
                        </span>
                      ) : (
                        strVal
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </section>

          {/* Description Section */}
          <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6 shadow-card">
            <h2 className="font-display text-lg font-semibold text-fg">Açıklama</h2>
            <div
              className={`mt-4 relative transition-all duration-200 ${
                listing.description && listing.description.length > 450 && !descExpanded
                  ? "max-h-52 overflow-hidden"
                  : ""
              }`}
            >
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-fg/90 font-sans">
                {listing.description || "Satıcı bu ilan için özel bir açıklama metni eklemedi."}
              </p>
              {listing.description && listing.description.length > 450 && !descExpanded ? (
                <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-surface to-transparent pointer-events-none" />
              ) : null}
            </div>

            {listing.description && listing.description.length > 450 ? (
              <button
                type="button"
                onClick={() => setDescExpanded((prev) => !prev)}
                className="mt-3 flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
              >
                {descExpanded ? (
                  <>
                    <ChevronUp className="size-4" /> Daha Az Göster
                  </>
                ) : (
                  <>
                    <ChevronDown className="size-4" /> Devamını Göster
                  </>
                )}
              </button>
            ) : null}
          </section>

          {/* Price History Section */}
          {hasHistory ? (
            <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6 shadow-card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display text-lg font-semibold text-fg">Fiyat Geçmişi</h2>
                {priceDiff < 0 ? (
                  <Badge tone="ok" className="gap-1 font-semibold">
                    <TrendingDown className="size-3.5" /> %{dropPercent} Fiyatı Düştü
                  </Badge>
                ) : priceDiff > 0 ? (
                  <Badge tone="warn" className="gap-1 font-semibold">
                    <TrendingUp className="size-3.5" /> +%{dropPercent} Fiyat Arttı
                  </Badge>
                ) : null}
              </div>
              <p className="text-xs text-muted mb-4">
                Bu ilanın fiyatındaki geçmiş değişimler ve kayıt tarihleri:
              </p>
              <ul className="space-y-2 text-sm">
                {history.map((h: any, i: number) => {
                  const isLatest = i === history.length - 1;
                  return (
                    <li
                      key={`${h.at}-${i}`}
                      className={`flex items-center justify-between rounded-xl px-4 py-2.5 transition-colors ${
                        isLatest
                          ? "bg-primary/5 border border-primary/20 font-semibold"
                          : "bg-elevated/70"
                      }`}
                    >
                      <span className="text-muted text-xs sm:text-sm">{formatDate(h.at)}</span>
                      <span className="tabular-nums font-medium text-fg">
                        {formatPrice(h.price)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {/* Location & Map Section */}
          {listing.city ? (
            <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6 shadow-card">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                <div>
                  <h2 className="font-display text-lg font-semibold text-fg">Konum</h2>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                    <MapPin className="size-3.5 text-primary shrink-0" />
                    <span>{locationString || listing.city}</span>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={googleMapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-primary bg-elevated hover:bg-border/60 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Google Haritalar <ExternalLink className="size-3" />
                  </a>
                  <a
                    href={yandexMapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-primary bg-elevated hover:bg-border/60 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Yandex <ExternalLink className="size-3" />
                  </a>
                </div>
              </div>

              {listing.lat && listing.lng ? (
                <div className="overflow-hidden rounded-xl border border-border shadow-2xs">
                  <iframe
                    title="İlan Konumu"
                    loading="lazy"
                    className="h-64 w-full bg-elevated"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${listing.lng - 0.04}%2C${
                      listing.lat - 0.03
                    }%2C${listing.lng + 0.04}%2C${listing.lat + 0.03}&layer=mapnik&marker=${listing.lat}%2C${
                      listing.lng
                    }`}
                  />
                </div>
              ) : null}
            </section>
          ) : null}

          {/* Seller Review Section */}
          {seller && user && user.id !== seller.id ? (
            <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6 shadow-card">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-display text-lg font-semibold text-fg">Satıcıyı Değerlendir</h2>
                {reviewEligibility?.existing ? (
                  <Badge tone="ok">Değerlendirmeniz Kayıtlı</Badge>
                ) : null}
              </div>

              {reviewEligibility?.eligible ? (
                <div className="mt-4 space-y-4">
                  <p className="text-xs text-muted">
                    Bu satıcıyla mesajlaştınız. Alışveriş veya iletişim deneyiminizi puanlayın:
                  </p>

                  {/* Star Rating Buttons */}
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => {
                      const isFilled = (hoverRating || userRating) >= star;
                      return (
                        <button
                          key={star}
                          type="button"
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          onClick={() => setUserRating(star)}
                          className="p-1 text-subtle transition-transform hover:scale-115 focus:outline-none"
                          title={`${star} Yıldız`}
                        >
                          <Star
                            className={`size-7 transition-colors ${
                              isFilled ? "fill-amber-400 text-amber-400" : "text-border"
                            }`}
                          />
                        </button>
                      );
                    })}
                    <span className="ml-2 text-sm font-semibold text-fg tabular-nums">
                      {userRating} / 5
                    </span>
                  </div>

                  {/* Optional Comment */}
                  <Textarea
                    value={userComment}
                    onChange={(e) => setUserComment(e.target.value)}
                    placeholder="Deneyiminiz hakkında kısa bir yorum ekleyin (isteğe bağlı)..."
                    maxLength={400}
                    rows={2}
                    className="min-h-20 text-sm"
                  />

                  <Button onClick={handleReviewSubmit} disabled={reviewBusy}>
                    {reviewBusy ? "Kaydediliyor…" : reviewEligibility.existing ? "Puanı Güncelle" : "Puanı Gönder"}
                  </Button>
                </div>
              ) : (
                <div className="mt-3 flex items-start gap-3 rounded-xl bg-elevated/70 p-4 text-xs text-muted leading-relaxed">
                  <ShieldCheck className="size-5 shrink-0 text-primary" />
                  <div>
                    <p className="font-medium text-fg">Puanlama Kriteri</p>
                    <p className="mt-0.5">
                      GeldeSat topluluk güvenliği gereği, yalnızca bu satıcıyla mesajlaşmış kullanıcılar satıcıya puan verebilir.
                    </p>
                    <button
                      type="button"
                      onClick={() => contactSectionRef.current?.scrollIntoView({ behavior: "smooth" })}
                      className="mt-2 text-primary font-semibold hover:underline"
                    >
                      Satıcıya mesaj gönder →
                    </button>
                  </div>
                </div>
              )}
            </section>
          ) : null}

          {/* Safe Shopping Tips */}
          <div className="rounded-2xl border border-border bg-gradient-to-br from-surface to-elevated/50 p-5 sm:p-6 shadow-2xs">
            <div className="flex items-center gap-2.5 text-primary font-semibold text-sm mb-3">
              <ShieldCheck className="size-5" />
              <span>Güvenli Alışveriş İpuçları</span>
            </div>
            <ul className="space-y-2 text-xs text-muted leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="size-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
                <span>Hiçbir şart altında ürünü fiziki olarak görmeden kapora veya ön ödeme göndermeyin.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="size-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
                <span>Alışverişlerinizi kalabalık ve güvenli ortak alanlarda yüz yüze gerçekleştirmeyi tercih edin.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="size-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
                <span>Şüpheli durumlarda veya sahte ilanlarda sayfadaki "İlanı Şikayet Et" butonunu kullanın.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Right Sticky Sidebar (Desktop Title, Price, Contact & Controls) */}
        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6 shadow-card" ref={contactSectionRef}>
            {/* Desktop Badges & Title */}
            <div className="hidden lg:block">
              <div className="flex flex-wrap gap-1.5">
                {listing.featured_until && new Date(listing.featured_until) > new Date() ? (
                  <Badge tone="ink">Vitrin</Badge>
                ) : null}
                {listing.boosts?.includes("ACIL") ? <Badge tone="danger">Acil</Badge> : null}
                {listing.status === "SOLD" ? <Badge tone="warn">Satıldı</Badge> : null}
              </div>
              <h1 className="mt-2.5 font-display text-xl font-bold leading-snug text-fg">
                {listing.title}
              </h1>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
                <MapPin className="size-3.5 text-subtle shrink-0" />
                <span>{locationString || "Türkiye"}</span>
              </p>
              <p className="mt-3 font-display text-3xl font-extrabold text-primary tabular-nums">
                {formatPrice(listing.price)}
              </p>
            </div>

            {/* Seller Card */}
            {seller ? (
              <div className="mt-4 lg:mt-5 rounded-xl border border-border/80 bg-elevated/50 p-3.5 transition-colors">
                <Link
                  to="/satici/$id"
                  params={{ id: seller.id }}
                  className="group flex items-center gap-3"
                >
                  {seller.avatar ? (
                    <img
                      src={seller.avatar}
                      alt={seller.name}
                      className="size-12 rounded-full object-cover border border-border"
                    />
                  ) : (
                    <div className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary font-bold text-base">
                      {seller.name.slice(0, 1).toUpperCase()}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-fg group-hover:text-primary transition-colors">
                      {seller.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted">
                      {seller.rating_count > 0 ? (
                        <span className="flex items-center gap-1 font-medium text-amber-600">
                          <Star className="size-3 fill-amber-500 text-amber-500" />
                          <span>{seller.rating_avg.toFixed(1)}</span>
                          <span className="text-muted font-normal">({seller.rating_count})</span>
                        </span>
                      ) : (
                        <span className="text-subtle font-normal">Yeni Satıcı</span>
                      )}
                      <span>·</span>
                      <span>{seller.listing_count} ilan</span>
                    </div>
                  </div>
                  <ChevronRight className="size-4 text-subtle group-hover:text-fg group-hover:translate-x-0.5 transition-all" />
                </Link>

                {store ? (
                  <div className="mt-2.5 pt-2.5 border-t border-border/60 flex items-center justify-between text-xs">
                    <span className="text-muted">Kurumsal Mağaza</span>
                    <Link
                      to="/magaza/$slug"
                      params={{ slug: store.slug }}
                      className="font-semibold text-primary hover:underline"
                    >
                      {store.name} →
                    </Link>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Owner Actions Panel */}
            {isOwner ? (
              <div className="mt-5 space-y-3 rounded-xl bg-elevated/70 p-4 border border-border/80">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                  İlan Yönetim Paneli
                </p>

                {/* Owner Stats */}
                <div className="grid grid-cols-3 gap-2 py-2 text-center border-y border-border/60">
                  <div>
                    <p className="text-2xs text-muted">Görüntülenme</p>
                    <p className="font-display font-bold text-fg tabular-nums">{listing.view_count}</p>
                  </div>
                  <div>
                    <p className="text-2xs text-muted">Favori</p>
                    <p className="font-display font-bold text-fg tabular-nums">{fav_count}</p>
                  </div>
                  <div>
                    <p className="text-2xs text-muted">Telefon Bakan</p>
                    <p className="font-display font-bold text-fg tabular-nums">{phone_reveal_count}</p>
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  <Link to="/ilan-ver" search={{ id: listing.id }} className="block">
                    <Button className="w-full" variant="outline">
                      <Pencil className="size-4" /> İlanı Düzenle
                    </Button>
                  </Link>

                  <Link to="/doping" search={{ id: listing.id }} className="block">
                    <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold">
                      <Zap className="size-4" /> İlanı Öne Çıkar (Doping Al)
                    </Button>
                  </Link>

                  {listing.status === "ACTIVE" ? (
                    <>
                      <Button
                        variant="outline"
                        className="w-full"
                        disabled={ownerActionBusy}
                        onClick={() => handleOwnerStatusToggle("INACTIVE")}
                      >
                        Yayından Kaldır (Pasife Al)
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full"
                        disabled={ownerActionBusy}
                        onClick={() => handleOwnerStatusToggle("SOLD")}
                      >
                        Satıldı Olarak İşaretle
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={ownerActionBusy}
                      onClick={() => handleOwnerStatusToggle("ACTIVE")}
                    >
                      Tekrar Yayına Al
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    className="w-full text-danger hover:bg-danger/10 hover:border-danger/30"
                    disabled={ownerActionBusy}
                    onClick={() => setDeleteConfirmOpen(true)}
                  >
                    <Trash2 className="size-4" /> İlanı Sil
                  </Button>

                  <Button variant="ghost" className="w-full" onClick={handleShare}>
                    <Share2 className="size-4" /> İlanı Paylaş
                  </Button>
                </div>
              </div>
            ) : isLive ? (
              /* Buyer Actions */
              <div className="mt-5 space-y-3">
                {/* Phone & WhatsApp Actions */}
                {phone ? (
                  <div className="space-y-2 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2">
                      <a
                        href={`tel:${cleanDigits}`}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-bold text-fg hover:bg-elevated transition-colors shadow-2xs font-mono tabular-nums"
                      >
                        <Phone className="size-4 text-ok" />
                        <span>{formatPhone(phone)}</span>
                      </a>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={handleCopyPhone}
                        title="Numarayı Kopyala"
                        className="size-11 shrink-0"
                      >
                        <Copy className="size-4" />
                      </Button>
                    </div>

                    <a href={whatsappUrl} target="_blank" rel="noreferrer" className="block">
                      <Button className="w-full bg-[#25D366] hover:bg-[#1EBE5D] text-white font-semibold gap-2">
                        <Phone className="size-4" /> WhatsApp ile İletişime Geç
                      </Button>
                    </a>
                  </div>
                ) : has_phone ? (
                  <Button
                    className="w-full gap-2 font-semibold"
                    variant="outline"
                    disabled={phoneLoading}
                    onClick={handleRevealPhone}
                  >
                    <Phone className="size-4 text-ok" />
                    <span>{phoneLoading ? "Telefon Açılıyor…" : "Telefon Numarasını Göster"}</span>
                  </Button>
                ) : (
                  <div className="rounded-xl bg-elevated/70 p-3 text-center text-xs text-muted">
                    Satıcı telefon numarası paylaşmadı. Lütfen mesajla iletişime geçin.
                  </div>
                )}

                {/* Direct Message Form with Quick Questions */}
                <form className="space-y-2.5 pt-2" onSubmit={handleSendMessage}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted uppercase tracking-wider">
                      Satıcıya Mesaj Gönder
                    </p>
                  </div>

                  {/* Quick Question Chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_QUESTIONS.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setMsg(q)}
                        className={`rounded-lg px-2.5 py-1 text-2xs transition-colors border ${
                          msg === q
                            ? "bg-primary/10 border-primary/30 text-primary font-medium"
                            : "bg-elevated/80 border-border/80 text-muted hover:text-fg hover:bg-elevated"
                        }`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>

                  <Textarea
                    value={msg}
                    onChange={(e) => setMsg(e.target.value)}
                    placeholder="Satıcıya soru veya teklifinizi yazın..."
                    maxLength={2000}
                    rows={3}
                    className="min-h-24 text-sm resize-none"
                  />

                  <Button
                    type="submit"
                    className="w-full gap-2 font-semibold"
                    disabled={msgBusy || !msg.trim()}
                  >
                    <MessageCircle className="size-4" />
                    <span>{msgBusy ? "Gönderiliyor…" : "Mesajı Gönder"}</span>
                  </Button>
                </form>

                {/* Favorite & Share Buttons */}
                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    className={`flex-1 gap-2 ${fav ? "border-danger/30 text-danger bg-danger/5" : ""}`}
                    onClick={handleToggleFav}
                    disabled={favLoading}
                  >
                    <Heart className={`size-4 ${fav ? "fill-danger text-danger" : ""}`} />
                    <span>{fav ? "Favoride" : "Favoriye Ekle"}</span>
                  </Button>

                  <Button type="button" variant="outline" className="flex-1 gap-2" onClick={handleShare}>
                    <Share2 className="size-4" />
                    <span>Paylaş</span>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-xl bg-elevated p-4 text-center text-sm text-muted">
                {expired
                  ? "Süresi dolan ilanlarda iletişim kapalıdır."
                  : "Yayında olmayan ilanlarda alıcı iletişimi kapalıdır."}
              </div>
            )}

            {/* Report Button */}
            {!isOwner ? (
              <div className="mt-4 pt-3 border-t border-border/60 text-center">
                <button
                  type="button"
                  className="text-xs text-muted hover:text-danger underline transition-colors"
                  onClick={async () => {
                    if (!(await needUser())) return;
                    setReportOn(true);
                  }}
                >
                  Bu ilanı şikayet et
                </button>
              </div>
            ) : null}
          </div>
        </aside>
      </div>

      {/* Similar Listings Section */}
      {similar && similar.length > 0 ? (
        <section className="mt-14 border-t border-border/80 pt-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-display text-xl font-bold text-fg">Benzer İlanlar</h2>
              <p className="text-xs text-muted mt-0.5">Bu kategorideki diğer popüler ilanlar</p>
            </div>
            <Link
              to="/category/$slug"
              params={{ slug: listing.category_slug || "emlak" }}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Tümünü Gör →
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {similar.map((l: any) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        </section>
      ) : null}

      {/* Mobile Sticky Contact Bar */}
      <StickyContactBar
        price={listing.price}
        isOwner={isOwner}
        isLive={isLive}
        phone={phone}
        hasPhone={has_phone}
        onRevealPhone={handleRevealPhone}
        isFav={fav}
        onToggleFav={handleToggleFav}
        onScrollToContact={() => contactSectionRef.current?.scrollIntoView({ behavior: "smooth" })}
        listingId={listing.id}
        listingTitle={listing.title}
      />

      {/* Report Modal Dialog */}
      {reportOn ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
          onClick={() => setReportOn(false)}
        >
          <form
            className="w-full max-w-md space-y-4 rounded-2xl bg-surface p-6 shadow-xl border border-border animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              try {
                await reportListing({
                  data: {
                    listingId: listing.id,
                    reason: String(fd.get("reason")),
                    details: String(fd.get("details") || ""),
                  },
                });
                toast.success("Şikayetiniz inceleme ekibimize iletildi.");
                setReportOn(false);
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Şikayet gönderilemedi");
              }
            }}
          >
            <div className="flex items-center justify-between border-b border-border/80 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="size-5 text-danger" />
                <h3 className="font-semibold text-fg">İlanı Şikayet Et</h3>
              </div>
              <button
                type="button"
                onClick={() => setReportOn(false)}
                className="rounded-lg p-1 text-muted hover:text-fg hover:bg-elevated"
              >
                <X className="size-5" />
              </button>
            </div>

            <p className="text-xs text-muted">
              Lütfen bu ilanın kurallarımızı veya kanunları ihlal ettiğini düşündüğünüz sebebi seçin:
            </p>

            <div>
              <label className="block text-xs font-medium text-fg mb-1">Şikayet Nedeni *</label>
              <Select name="reason" required className="w-full">
                {REPORT_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-xs font-medium text-fg mb-1">Ayrıntı (İsteğe Bağlı)</label>
              <Textarea
                name="details"
                placeholder="Lütfen varsa ek detay veya kanıt belirtin..."
                maxLength={500}
                rows={3}
                className="text-sm resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border/80">
              <Button type="button" variant="ghost" onClick={() => setReportOn(false)}>
                Vazgeç
              </Button>
              <Button type="submit" className="bg-danger hover:bg-danger/90 text-white font-semibold">
                Şikayeti Gönder
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {/* Delete Confirmation Modal */}
      {deleteConfirmOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
          onClick={() => setDeleteConfirmOpen(false)}
        >
          <div
            className="w-full max-w-md space-y-4 rounded-2xl bg-surface p-6 shadow-xl border border-border animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-danger">
              <div className="grid size-10 place-items-center rounded-full bg-danger/10">
                <Trash2 className="size-5" />
              </div>
              <h3 className="font-semibold text-fg">İlanı Silmek İstiyor Musunuz?</h3>
            </div>

            <p className="text-sm text-muted leading-relaxed">
              Bu ilan kalıcı olarak silinecektir. Bu işlem geri alınamaz ve tüm mesajlar ile favori kayıtları etkilenecektir.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDeleteConfirmOpen(false)}
                disabled={ownerActionBusy}
              >
                Vazgeç
              </Button>
              <Button
                type="button"
                className="bg-danger hover:bg-danger/90 text-white font-semibold"
                onClick={handleOwnerDelete}
                disabled={ownerActionBusy}
              >
                {ownerActionBusy ? "Siliniyor…" : "Evet, İlanı Sil"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
