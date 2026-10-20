import { createFileRoute, Link, notFound, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Copy,
  Eye,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Phone,
  Share2,
  ShieldAlert,
  Star,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { NotFound } from "@/components/common/NotFound";
import { buildListingSeo, isListingIndexable, jsonLd } from "@/lib/seo";
import { getListing, incrementView } from "@/lib/server/catalog";
import { setFavorite } from "@/lib/favorites-store";
import { checkReviewEligibility, favoriteIds, leaveReview, reportListing, toggleFavorite } from "@/lib/server/social";
import { startConversation } from "@/lib/server/chat";
import { deleteListing, renewListing, revealPhone, setListingStatus } from "@/lib/server/account";
import { cleanPhone, cn, formatDate, formatNumber, formatPhone, formatPrice } from "@/lib/utils";
import { REPORT_REASONS } from "@/lib/data/geo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, Textarea } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ListingCard } from "@/components/listing/ListingCard";
import { ListingDetailSkeleton } from "@/components/listing/ListingDetailSkeleton";
import { ListingImageGallery } from "@/components/listing/ListingImageGallery";
import {
  Breadcrumbs,
  DescriptionSection,
  KeyFacts,
  LocationSection,
  PriceHistorySection,
  SafetyNote,
  SellerCard,
  SpecsSection,
  StatusBanner,
} from "@/components/listing/detail/ListingSections";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/ilan/$slug")({
  loader: async ({ params }) => {
    const data = await getListing({ data: { slug: params.slug } });
    if (!data?.listing) throw notFound();
    // One URL per listing: old slugs, a changed title, ids and case variants all
    // land on the current canonical slug with a permanent redirect.
    if (data.listing.slug !== params.slug) {
      throw redirect({ to: "/ilan/$slug", params: { slug: data.listing.slug }, statusCode: 301, replace: true });
    }
    return data;
  },
  notFoundComponent: () => (
    <NotFound
      type="listing"
      title="İlan bulunamadı veya yayından kaldırıldı"
      message="Aradığınız ilan satılmış, süresi dolmuş veya sahibi tarafından kaldırılmış olabilir. Benzer ilanlara göz atabilirsiniz."
    />
  ),
  head: ({ loaderData }) => {
    if (!loaderData?.listing) {
      return { meta: [{ title: "İlan Bulunamadı | GeldeSat" }, { name: "robots", content: "noindex,nofollow" }] };
    }
    const { listing, path, seller } = loaderData;
    const seo = buildListingSeo({ listing, path, seller });
    const published = listing.created_at ? new Date(listing.created_at).toISOString() : undefined;
    const modified = listing.updated_at ? new Date(listing.updated_at).toISOString() : published;
    return {
      meta: [
        { title: seo.title },
        { name: "description", content: seo.description },
        { name: "robots", content: isListingIndexable(listing.status, listing.expires_at) ? "index,follow" : "noindex,nofollow" },
        { property: "og:site_name", content: "GeldeSat" },
        { property: "og:locale", content: "tr_TR" },
        { property: "og:type", content: "product" },
        { property: "og:url", content: seo.pageUrl },
        { property: "og:title", content: seo.title },
        { property: "og:description", content: seo.description },
        { property: "og:image", content: seo.coverImage },
        { property: "og:image:alt", content: listing.title },
        ...(modified ? [{ property: "og:updated_time", content: modified }] : []),
        ...(published ? [{ property: "article:published_time", content: published }] : []),
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: seo.title },
        { name: "twitter:description", content: seo.description },
        { name: "twitter:image", content: seo.coverImage },
      ],
      links: [{ rel: "canonical", href: seo.canonicalUrl }],
      scripts: [
        { type: "application/ld+json", children: jsonLd(seo.structuredData) },
        {
          type: "application/ld+json",
          children: jsonLd({ "@context": "https://schema.org/", "@type": "BreadcrumbList", itemListElement: seo.breadcrumbItems }),
        },
      ],
    };
  },
  pendingComponent: ListingDetailSkeleton,
  component: ListingPage,
});

const QUICK_QUESTIONS = ["Merhaba, ilan hâlâ geçerli mi?", "Pazarlık payı var mı?", "Takas düşünür müsünüz?", "Ürünü ne zaman görebilirim?"];

async function copyText(text: string, done: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(done);
  } catch {
    toast.error("Kopyalanamadı. Lütfen elle seçip kopyalayın.");
  }
}

/** WhatsApp only works for Turkish mobile numbers (5xx…). */
function whatsappLink(phone: string, title: string): string | null {
  const ten = cleanPhone(phone).replace(/^0/, "");
  if (!/^5\d{9}$/.test(ten)) return null;
  return `https://wa.me/90${ten}?text=${encodeURIComponent(`Merhaba, GeldeSat'taki “${title}” ilanınız hakkında yazıyorum.`)}`;
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.08.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.79h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.88 9.88m8.41-18.29A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.31-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.89 0-3.18-1.24-6.16-3.49-8.41" />
    </svg>
  );
}

function ListingPage() {
  const data = Route.useLoaderData();
  const nav = useNavigate();
  const router = useRouter();
  const { user, isPending } = useCurrentUserState();
  const { listing, path, similar, seller, store, history, has_phone, phone_visibility, show_whatsapp, approved, fav_count, phone_reveal_count } = data;

  const [fav, setFav] = useState(false);
  const [favBusy, setFavBusy] = useState(false);
  const [phone, setPhone] = useState<string | null>(null);
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [msg, setMsg] = useState(QUICK_QUESTIONS[0]);
  const [msgBusy, setMsgBusy] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [ownerBusy, setOwnerBusy] = useState(false);
  const [review, setReview] = useState<{ eligible: boolean; existing: { rating: number; comment: string | null } | null } | null>(null);
  const counted = useRef<string | null>(null);
  const ownerPanelRef = useRef<HTMLDivElement>(null);

  const isOwner = Boolean(user && user.id === listing.user_id);
  const expired = Boolean(listing.expires_at && new Date(listing.expires_at).getTime() <= Date.now());
  const isLive = listing.status === "ACTIVE" && !expired;
  const featured = Boolean(listing.featured_until && new Date(listing.featured_until).getTime() > Date.now());
  const location = [listing.neighborhood, listing.district, listing.city].filter(Boolean).join(", ");
  const firstPrice = history[0]?.price ?? listing.price;
  const priceDrop = history.length > 1 && listing.price < firstPrice ? firstPrice - listing.price : 0;
  const whatsapp = phone && show_whatsapp ? whatsappLink(phone, listing.title) : null;

  // Count a view once per page visit, after we know the visitor is not the owner.
  useEffect(() => {
    if (isPending || counted.current === listing.id) return;
    counted.current = listing.id;
    if (user?.id === listing.user_id) return;
    void incrementView({ data: { id: listing.id } }).catch(() => undefined);
  }, [isPending, user?.id, listing.id, listing.user_id]);

  useEffect(() => {
    setPhone(null);
    if (!user) return setFav(false);
    let alive = true;
    favoriteIds()
      .then((ids) => alive && setFav(ids.includes(listing.id)))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [user, listing.id]);

  useEffect(() => {
    if (!seller || !user || user.id === seller.id) return setReview(null);
    let alive = true;
    checkReviewEligibility({ data: { sellerId: seller.id, listingId: listing.id } })
      .then((r) => alive && setReview(r))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [seller, user, listing.id]);

  /** Signed-in user, or a trip to login that brings them back to this listing. */
  function requireUser(): boolean {
    if (user) return true;
    toast.message("Bu işlem için giriş yapın");
    void nav({ to: "/login", search: { redirect: `/ilan/${listing.slug}` } });
    return false;
  }

  async function onToggleFav() {
    if (!requireUser() || favBusy) return;
    setFavBusy(true);
    setFav((v) => !v);
    try {
      const res = await toggleFavorite({ data: { listingId: listing.id } });
      setFav(res.favorite);
      setFavorite(listing.id, res.favorite);
      toast.success(res.favorite ? "Favorilere eklendi" : "Favorilerden çıkarıldı");
    } catch {
      setFav((v) => !v);
      toast.error("Favori işlemi başarısız oldu");
    } finally {
      setFavBusy(false);
    }
  }

  async function onRevealPhone() {
    // Sellers who show their phone to everyone don't make buyers sign in first.
    if ((phone_visibility !== "everyone" && !requireUser()) || phoneBusy) return;
    setPhoneBusy(true);
    try {
      setPhone((await revealPhone({ data: { listingId: listing.id } })).phone);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Telefon numarası alınamadı");
    } finally {
      setPhoneBusy(false);
    }
  }

  async function onShare() {
    const url = `${window.location.origin}/ilan/${listing.slug}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: listing.title, text: `${listing.title} – ${formatPrice(listing.price)}`, url });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    await copyText(url, "İlan bağlantısı kopyalandı");
  }

  async function onSendMessage(e: FormEvent) {
    e.preventDefault();
    if (!requireUser()) return;
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
  }

  async function ownerAction(run: () => Promise<unknown>, done: string) {
    setOwnerBusy(true);
    try {
      await run();
      toast.success(done);
      await router.invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "İşlem başarısız oldu");
    } finally {
      setOwnerBusy(false);
    }
  }

  const setStatus = (status: "ACTIVE" | "INACTIVE" | "SOLD", done: string) =>
    ownerAction(() => setListingStatus({ data: { id: listing.id, status } }), done);
  const renew = () => ownerAction(() => renewListing({ data: { id: listing.id } }), "İlan süresi 30 gün uzatıldı");

  async function onDelete() {
    setOwnerBusy(true);
    try {
      await deleteListing({ data: { id: listing.id } });
      toast.success("İlan silindi");
      void nav({ to: "/ilanlarim" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "İlan silinemedi");
      setOwnerBusy(false);
    }
  }

  const messageForm = (
    <form onSubmit={onSendMessage} className="space-y-2.5">
      <div className="flex flex-wrap gap-1.5">
        {QUICK_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => setMsg(q)}
            aria-pressed={msg === q}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs transition-colors",
              msg === q ? "border-primary/40 bg-primary/10 font-medium text-primary" : "border-border text-muted hover:text-fg",
            )}
          >
            {q}
          </button>
        ))}
      </div>
      <Textarea
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        placeholder="Sorunuzu veya teklifinizi yazın…"
        aria-label="Satıcıya mesaj"
        maxLength={2000}
        rows={3}
        className="min-h-24 resize-none"
      />
      <Button type="submit" className="w-full" disabled={msgBusy || !msg.trim()}>
        <MessageCircle className="size-4" /> {msgBusy ? "Gönderiliyor…" : "Mesaj gönder"}
      </Button>
    </form>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 pb-28 pt-4 sm:pt-6 lg:pb-12">
      <Breadcrumbs path={path} title={listing.title} />
      <StatusBanner status={listing.status} expired={expired} isOwner={isOwner} onRenew={renew} busy={ownerBusy} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8">
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <ListingImageGallery images={listing.images} title={listing.title} categoryName={listing.category_name} />
        </div>

        {/* Title, price, contact and seller: right after the photos on phones, a sticky column on desktop. */}
        <aside className="min-w-0 space-y-4 lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
          <div className="rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-5">
            {featured || listing.status === "SOLD" || listing.boosts?.includes("ACIL") ? (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {listing.status === "SOLD" ? <Badge tone="warn">Satıldı</Badge> : null}
                {listing.boosts?.includes("ACIL") ? <Badge tone="danger">Acil</Badge> : null}
                {featured ? <Badge tone="ink">Vitrin</Badge> : null}
              </div>
            ) : null}
            <h1 className="text-lg font-semibold leading-snug break-words sm:text-xl">{listing.title}</h1>
            <p className={cn("mt-3 font-display text-2xl font-bold tabular-nums sm:text-3xl", listing.status === "SOLD" ? "text-muted line-through" : "text-primary")}>
              {formatPrice(listing.price)}
            </p>
            {priceDrop > 0 ? (
              <p className="mt-1 text-xs font-medium text-ok">
                Fiyat {formatPrice(priceDrop)} düştü <span className="text-muted line-through">{formatPrice(firstPrice)}</span>
              </p>
            ) : null}
            <p className="mt-2 text-sm text-muted">{location || "Türkiye"}</p>

            <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted">
              <button
                type="button"
                onClick={() => void copyText(String(listing.listing_no), "İlan numarası kopyalandı")}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-elevated hover:text-fg"
                title="İlan numarasını kopyala"
              >
                İlan no <span className="font-semibold tabular-nums text-fg">{listing.listing_no}</span>
                <Copy className="size-3" aria-hidden="true" />
              </button>
              <span>{formatDate(listing.created_at)}</span>
              <span className="inline-flex items-center gap-1" title="Görüntülenme">
                <Eye className="size-3.5" aria-hidden="true" /> {formatNumber(listing.view_count)}
              </span>
            </div>

            {!isOwner ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void onToggleFav()}
                  disabled={favBusy}
                  aria-pressed={fav}
                  className={cn(fav && "border-danger/30 bg-danger/5 text-danger")}
                >
                  <Heart className={cn("size-4", fav && "fill-current")} /> {fav ? "Favoride" : "Favorile"}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => void onShare()}>
                  <Share2 className="size-4" /> Paylaş
                </Button>
              </div>
            ) : null}
          </div>

          {isOwner ? (
            <div ref={ownerPanelRef} className="scroll-mt-24 rounded-2xl border border-primary/25 bg-surface p-4 shadow-card sm:p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-subtle">İlanınız</p>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                {[
                  ["Görüntülenme", listing.view_count],
                  ["Favori", fav_count],
                  ["Telefon", phone_reveal_count],
                ].map(([label, value]) => (
                  <div key={label} className="flex flex-col-reverse rounded-lg bg-elevated/70 px-2 py-2">
                    <dt className="text-[11px] text-muted">{label}</dt>
                    <dd className="font-display text-lg font-bold tabular-nums">{formatNumber(value)}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4 grid gap-2">
                <Link to="/ilan-ver" search={{ id: listing.id }} className="block">
                  <Button className="w-full">
                    <Pencil className="size-4" /> İlanı düzenle
                  </Button>
                </Link>
                {isLive ? (
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" disabled={ownerBusy} onClick={() => void setStatus("SOLD", "İlan satıldı olarak işaretlendi")}>
                      Satıldı
                    </Button>
                    <Button variant="outline" size="sm" disabled={ownerBusy} onClick={() => void setStatus("INACTIVE", "İlan yayından kaldırıldı")}>
                      Yayından kaldır
                    </Button>
                  </div>
                ) : null}
                {(listing.status === "INACTIVE" || listing.status === "SOLD") && approved && !expired ? (
                  <Button variant="outline" disabled={ownerBusy} onClick={() => void setStatus("ACTIVE", "İlan tekrar yayında")}>
                    Tekrar yayına al
                  </Button>
                ) : null}
                <div className="flex items-center justify-between pt-1">
                  <Button variant="ghost" size="sm" onClick={() => void onShare()}>
                    <Share2 className="size-4" /> Paylaş
                  </Button>
                  <Button variant="ghost" size="sm" className="text-danger hover:bg-danger/10" disabled={ownerBusy} onClick={() => setDeleteOpen(true)}>
                    <Trash2 className="size-4" /> Sil
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div id="iletisim" className="hidden rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-5 lg:block">
              {isLive ? (
                <div className="space-y-4">
                  {has_phone ? (
                    phone ? (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <a
                            href={`tel:${cleanPhone(phone)}`}
                            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-md border border-border font-semibold tabular-nums hover:bg-elevated"
                          >
                            <Phone className="size-4 text-ok" /> {formatPhone(phone)}
                          </a>
                          <Button variant="outline" size="icon" aria-label="Numarayı kopyala" onClick={() => void copyText(formatPhone(phone), "Numara kopyalandı")}>
                            <Copy className="size-4" />
                          </Button>
                        </div>
                        {whatsapp ? (
                          <a
                            href={whatsapp}
                            target="_blank"
                            rel="noreferrer"
                            className="flex h-11 items-center justify-center gap-2 rounded-md bg-[#25D366] text-sm font-semibold text-white hover:bg-[#1EBE5D]"
                          >
                            <WhatsAppIcon className="size-4" /> WhatsApp ile yaz
                          </a>
                        ) : null}
                      </div>
                    ) : (
                      <Button variant="outline" className="w-full" disabled={phoneBusy} onClick={() => void onRevealPhone()}>
                        <Phone className="size-4 text-ok" /> {phoneBusy ? "Numara alınıyor…" : "Telefonu göster"}
                      </Button>
                    )
                  ) : (
                    <p className="rounded-lg bg-elevated/70 p-3 text-center text-xs text-muted">Satıcı telefon paylaşmıyor; mesajla ulaşabilirsiniz.</p>
                  )}
                  <div>
                    <p className="mb-2 text-sm font-semibold">Satıcıya sor</p>
                    {messageForm}
                  </div>
                </div>
              ) : (
                <p className="text-center text-sm text-muted">
                  {expired ? "Süresi dolan ilanlarda iletişim kapalıdır." : "Yayında olmayan ilanlarda iletişim kapalıdır."}
                </p>
              )}
            </div>
          )}

          {seller ? (
            <SellerCard
              seller={seller}
              store={store}
              onReview={review?.eligible ? () => setReviewOpen(true) : undefined}
            />
          ) : null}

          <div className="hidden lg:block">
            <SafetyNote />
          </div>
          {!isOwner ? (
            <button
              type="button"
              onClick={() => requireUser() && setReportOpen(true)}
              className="mx-auto hidden items-center gap-1.5 text-xs text-muted hover:text-danger lg:flex"
            >
              <ShieldAlert className="size-3.5" /> İlanı şikayet et
            </button>
          ) : null}
        </aside>

        <div className="min-w-0 space-y-5 lg:col-start-1 lg:row-start-2">
          <KeyFacts attrs={listing.attrs} />
          <SpecsSection attrs={listing.attrs} />
          <DescriptionSection text={listing.description} />
          <PriceHistorySection history={history} />
          <LocationSection city={listing.city} district={listing.district} neighborhood={listing.neighborhood} />
          <div className="space-y-3 lg:hidden">
            <SafetyNote />
            {!isOwner ? (
              <button
                type="button"
                onClick={() => requireUser() && setReportOpen(true)}
                className="mx-auto flex items-center gap-1.5 py-2 text-xs text-muted hover:text-danger"
              >
                <ShieldAlert className="size-3.5" /> İlanı şikayet et
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {similar.length ? (
        <section className="mt-12 border-t border-border pt-8">
          <div className="mb-5 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight sm:text-xl">Benzer ilanlar</h2>
              <p className="mt-0.5 text-xs text-muted">{listing.category_name} kategorisinden</p>
            </div>
            {listing.category_slug ? (
              <Link to="/category/$slug" params={{ slug: listing.category_slug }} className="text-sm font-medium text-primary hover:underline">
                Tümünü gör
              </Link>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {similar.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        </section>
      ) : null}

      {/* Phone action bar: the main contact actions always in thumb reach. */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 px-4 pt-2.5 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] backdrop-blur-md lg:hidden"
        style={{ paddingBottom: "max(0.625rem, env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="mx-auto flex max-w-xl items-center gap-2">
          {isOwner ? (
            <>
              <Link to="/ilan-ver" search={{ id: listing.id }} className="flex-1">
                <Button className="w-full">
                  <Pencil className="size-4" /> Düzenle
                </Button>
              </Link>
              <Button variant="outline" onClick={() => ownerPanelRef.current?.scrollIntoView({ behavior: "smooth" })}>
                <MoreHorizontal className="size-4" /> Yönet
              </Button>
            </>
          ) : isLive ? (
            <>
              <Button
                variant="outline"
                size="icon"
                aria-label={fav ? "Favorilerden çıkar" : "Favorilere ekle"}
                aria-pressed={fav}
                onClick={() => void onToggleFav()}
                className={cn("shrink-0", fav && "border-danger/30 text-danger")}
              >
                <Heart className={cn("size-5", fav && "fill-current")} />
              </Button>
              {has_phone ? (
                phone ? (
                  <a href={`tel:${cleanPhone(phone)}`} className="flex-1">
                    <Button variant="outline" className="w-full">
                      <Phone className="size-4 text-ok" /> Ara
                    </Button>
                  </a>
                ) : (
                  <Button variant="outline" className="flex-1" disabled={phoneBusy} onClick={() => void onRevealPhone()}>
                    <Phone className="size-4 text-ok" /> {phoneBusy ? "…" : "Telefon"}
                  </Button>
                )
              ) : null}
              {whatsapp ? (
                <a href={whatsapp} target="_blank" rel="noreferrer" aria-label="WhatsApp ile yaz" className="grid size-11 shrink-0 place-items-center rounded-md bg-[#25D366] text-white">
                  <WhatsAppIcon className="size-5" />
                </a>
              ) : null}
              <Button className="flex-1" onClick={() => requireUser() && setMessageOpen(true)}>
                <MessageCircle className="size-4" /> Mesaj
              </Button>
            </>
          ) : (
            <p className="flex-1 py-2.5 text-center text-sm text-muted">İletişim kapalı</p>
          )}
        </div>
      </div>

      <Dialog open={messageOpen} onOpenChange={setMessageOpen}>
        <DialogContent className="border-border bg-surface">
          <DialogHeader>
            <DialogTitle>Satıcıya sor</DialogTitle>
            <DialogDescription className="line-clamp-1">{listing.title}</DialogDescription>
          </DialogHeader>
          {messageForm}
        </DialogContent>
      </Dialog>

      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} listingId={listing.id} />

      <Dialog open={deleteOpen} onOpenChange={(o) => !ownerBusy && setDeleteOpen(o)}>
        <DialogContent className="border-border bg-surface">
          <DialogHeader>
            <DialogTitle>İlan silinsin mi?</DialogTitle>
            <DialogDescription>
              İlan ve fotoğrafları kalıcı olarak silinir, bu işlem geri alınamaz. Sadece gizlemek istiyorsanız “Yayından kaldır”ı kullanın.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" disabled={ownerBusy} onClick={() => setDeleteOpen(false)}>
              Vazgeç
            </Button>
            <Button variant="danger" disabled={ownerBusy} onClick={() => void onDelete()}>
              {ownerBusy ? "Siliniyor…" : "Evet, sil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {seller && review?.eligible ? (
        <ReviewDialog
          open={reviewOpen}
          onOpenChange={setReviewOpen}
          sellerId={seller.id}
          sellerName={seller.name}
          listingId={listing.id}
          existing={review.existing}
          onSaved={(existing) => setReview({ ...review, existing })}
        />
      ) : null}
    </div>
  );
}

function ReportDialog({ open, onOpenChange, listingId }: { open: boolean; onOpenChange: (o: boolean) => void; listingId: string }) {
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await reportListing({ data: { listingId, reason: String(fd.get("reason")), details: String(fd.get("details") || "") } });
      toast.success("Şikayetiniz incelemeye alındı. Teşekkürler.");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Şikayet gönderilemedi");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-surface">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>İlanı şikayet et</DialogTitle>
            <DialogDescription>Bu ilanın kurallara aykırı olduğunu düşünüyorsanız sebebini seçin.</DialogDescription>
          </DialogHeader>
          <div>
            <label htmlFor="report-reason" className="mb-1.5 block text-sm font-medium">
              Sebep
            </label>
            <Select id="report-reason" name="reason" required>
              {REPORT_REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="report-details" className="mb-1.5 block text-sm font-medium">
              Ayrıntı <span className="font-normal text-muted">(isteğe bağlı)</span>
            </label>
            <Textarea id="report-details" name="details" maxLength={500} rows={3} className="resize-none" />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Vazgeç
            </Button>
            <Button type="submit" variant="danger" disabled={busy}>
              {busy ? "Gönderiliyor…" : "Şikayeti gönder"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReviewDialog({
  open,
  onOpenChange,
  sellerId,
  sellerName,
  listingId,
  existing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  sellerId: string;
  sellerName: string;
  listingId: string;
  existing: { rating: number; comment: string | null } | null;
  onSaved: (existing: { rating: number; comment: string | null }) => void;
}) {
  const [rating, setRating] = useState(existing?.rating ?? 5);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      await leaveReview({ data: { sellerId, listingId, rating, comment: comment.trim() || undefined } });
      onSaved({ rating, comment: comment.trim() || null });
      toast.success("Değerlendirmeniz kaydedildi");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Değerlendirme kaydedilemedi");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-surface">
        <DialogHeader>
          <DialogTitle>{sellerName} adlı satıcıyı değerlendirin</DialogTitle>
          <DialogDescription>Bu satıcıyla iletişim deneyiminizi puanlayın.</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-1" role="radiogroup" aria-label="Puan" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} yıldız`}
              onMouseEnter={() => setHover(n)}
              onClick={() => setRating(n)}
              className="p-1"
            >
              <Star className={cn("size-8 transition-colors", (hover || rating) >= n ? "fill-amber-400 text-amber-400" : "text-border")} />
            </button>
          ))}
          <span className="ml-2 text-sm font-semibold tabular-nums">{rating}/5</span>
        </div>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Kısa bir yorum (isteğe bağlı)"
          maxLength={400}
          rows={3}
          className="resize-none"
        />
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button disabled={busy} onClick={() => void save()}>
            {busy ? "Kaydediliyor…" : existing ? "Güncelle" : "Gönder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
