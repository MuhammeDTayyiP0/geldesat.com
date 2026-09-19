import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronRight, Heart, ImageIcon, MapPin, MessageCircle, Pencil, Phone, Share2, ShieldAlert, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { getListing, incrementView } from "@/lib/server/catalog";
import { favoriteIds, leaveReview, reportListing, startConversation, toggleFavorite } from "@/lib/server/social";
import { revealPhone } from "@/lib/server/account";
import { cleanPhone, formatDate, formatNumber, formatPhone, formatPrice, listingStatusLabel } from "@/lib/utils";
import { REPORT_REASONS } from "@/lib/data/geo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea, Select } from "@/components/ui/input";
import { ListingCard } from "@/components/listing/ListingCard";
import { ListingDetailSkeleton } from "@/components/listing/ListingDetailSkeleton";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { toast } from "sonner";

export const Route = createFileRoute("/ilan/$slug")({
  loader: async ({ params }) => getListing({ data: { slug: params.slug } }),
  pendingComponent: ListingDetailSkeleton,
  component: ListingPage,
});

function ListingPage() {
  const data = Route.useLoaderData();
  const nav = useNavigate();
  const { user } = useCurrentUserState();
  const [idx, setIdx] = useState(0);
  const [fav, setFav] = useState(false);
  const [phone, setPhone] = useState<string | null>(null);
  const [msg, setMsg] = useState("Merhaba, ilanınız hâlâ geçerli mi?");
  const [reportOn, setReportOn] = useState(false);
  const [msgBusy, setMsgBusy] = useState(false);

  useEffect(() => {
    if (!data) return;
    void incrementView({ data: { id: data.listing.id } });
  }, [data]);

  useEffect(() => {
    if (!data || !user) return;
    favoriteIds()
      .then((ids) => setFav(ids.includes(data.listing.id)))
      .catch(() => undefined);
  }, [data, user]);

  if (!data) return <p className="p-12 text-center">İlan bulunamadı.</p>;
  const { listing, path, similar, seller, history } = data;
  const images = listing.images.length ? listing.images : [];
  const dropped = history.length >= 2 && history[history.length - 1].price < history[0].price;
  const expired = Boolean(listing.expires_at && new Date(listing.expires_at).getTime() <= Date.now());
  const live = listing.status === "ACTIVE" && !expired;

  async function needUser() {
    if (!user) {
      toast.message("Bu işlem için giriş yapın");
      void nav({ to: "/login" });
      return false;
    }
    return true;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {listing.status !== "ACTIVE" ? (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-warn/30 bg-warn/10 p-3 text-sm text-warn">
          <ShieldAlert className="size-4" />{" "}
          {listing.status === "PENDING"
            ? "Bu ilan onay bekliyor. Yayına alınca alıcılara görünür."
            : `Bu ilan şu an ${listingStatusLabel(listing.status, expired).toLocaleLowerCase("tr")}.`}
        </div>
      ) : listing.expires_at && new Date(listing.expires_at).getTime() <= Date.now() ? (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-warn/30 bg-warn/10 p-3 text-sm text-warn">
          <ShieldAlert className="size-4" /> Bu ilanın süresi doldu.
        </div>
      ) : null}
      <nav className="mb-4 flex flex-wrap items-center gap-1 text-sm text-muted">
        <Link to="/">Anasayfa</Link>
        {path.map((p) => (
          <span key={p.id} className="flex items-center gap-1">
            <ChevronRight className="size-3.5" />
            <Link to="/category/$slug" params={{ slug: p.slug }}>
              {p.name}
            </Link>
          </span>
        ))}
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1.4fr_0.8fr]">
        <div>
          <div className="overflow-hidden rounded-xl border border-border bg-elevated">
            {images[idx] ? (
              <img src={images[idx]} alt={listing.title} className="aspect-[16/10] w-full object-contain bg-ink/5" />
            ) : (
              <div className="grid aspect-[16/10] place-items-center text-center">
                <div>
                  <ImageIcon className="mx-auto size-10 text-subtle" />
                  <p className="mt-2 text-sm font-medium text-muted">{listing.category_name || "Fotoğraf yok"}</p>
                  <p className="text-xs text-subtle">Satıcı henüz fotoğraf eklemedi</p>
                </div>
              </div>
            )}
          </div>
          {images.length > 1 ? (
            <div className="mt-2 flex gap-2 overflow-auto">
              {images.map((im, i) => (
                <button key={im} type="button" onClick={() => setIdx(i)} className={`h-16 w-20 shrink-0 overflow-hidden rounded-md border ${i === idx ? "border-primary" : "border-border"}`}>
                  <img src={im} alt="" className="size-full object-cover" />
                </button>
              ))}
            </div>
          ) : null}

          <section className="mt-8">
            <h2 className="font-display text-xl font-semibold">Açıklama</h2>
            <p className="mt-3 whitespace-pre-wrap rounded-xl border border-border bg-surface p-5 text-sm leading-relaxed">{listing.description}</p>
          </section>

          <section className="mt-8">
            <h2 className="font-display text-xl font-semibold">Özellikler</h2>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border border-border bg-surface p-5 text-sm md:grid-cols-3">
              <div>
                <dt className="text-xs text-muted">İlan no</dt>
                <dd className="font-medium">{listing.id.slice(0, 10)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Tarih</dt>
                <dd className="font-medium">{formatDate(listing.created_at)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Görüntülenme</dt>
                <dd className="font-medium">{formatNumber(listing.view_count)}</dd>
              </div>
              {listing.expires_at ? (
                <div>
                  <dt className="text-xs text-muted">Yayın bitişi</dt>
                  <dd className="font-medium">{formatDate(listing.expires_at)}</dd>
                </div>
              ) : null}
              {Object.entries(listing.attrs).map(([k, v]) => {
                const text = String(v);
                const parts = text.includes(", ") ? text.split(", ").filter(Boolean) : null;
                return (
                  <div key={k} className={parts && parts.length > 3 ? "col-span-2 md:col-span-3" : ""}>
                    <dt className="text-xs text-muted">{k}</dt>
                    <dd className="font-medium">
                      {parts && parts.length > 1 ? (
                        <span className="mt-1 flex flex-wrap gap-1">
                          {parts.map((p) => (
                            <span key={p} className="rounded-full bg-elevated px-2 py-0.5 text-xs font-normal">
                              {p}
                            </span>
                          ))}
                        </span>
                      ) : (
                        text
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </section>

          {history.length > 1 ? (
            <section className="mt-8">
              <h2 className="font-display text-xl font-semibold">Fiyat geçmişi</h2>
              <p className="mt-1 text-sm text-muted">{dropped ? "Son kayıtta fiyat düşmüş." : "Fiyat değişimleri"}</p>
              <ul className="mt-3 space-y-1 text-sm">
                {history.map((h) => (
                  <li key={h.at} className="flex justify-between rounded-md bg-surface px-3 py-2">
                    <span>{formatDate(h.at)}</span>
                    <span className="font-medium">{formatPrice(h.price)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {listing.lat && listing.lng ? (
            <section className="mt-8">
              <h2 className="font-display text-xl font-semibold">Konum</h2>
              <p className="mt-1 text-sm text-muted">
                {[listing.city, listing.district, listing.neighborhood].filter(Boolean).join(" / ")}
              </p>
              <iframe
                title="Harita"
                className="mt-3 h-64 w-full rounded-xl border border-border"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${listing.lng - 0.04}%2C${listing.lat - 0.03}%2C${listing.lng + 0.04}%2C${listing.lat + 0.03}&layer=mapnik&marker=${listing.lat}%2C${listing.lng}`}
              />
            </section>
          ) : null}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
            <div className="flex flex-wrap gap-1">
              {listing.featured_until && new Date(listing.featured_until) > new Date() ? <Badge tone="ink">Vitrin</Badge> : null}
              {listing.boosts?.includes("ACIL") ? <Badge tone="danger">Acil</Badge> : null}
            </div>
            <h1 className="mt-2 font-display text-xl font-semibold leading-tight">{listing.title}</h1>
            <p className="mt-2 flex items-center gap-1 text-sm text-muted">
              <MapPin className="size-4" />
              {[listing.city, listing.district, listing.neighborhood].filter(Boolean).join(" / ")}
            </p>
            <p className="mt-3 font-display text-3xl font-semibold text-primary tabular-nums">{formatPrice(listing.price)}</p>
            {seller ? (
              <Link to="/satici/$id" params={{ id: seller.id }} className="mt-5 flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-elevated">
                <div className="grid size-11 place-items-center rounded-full bg-elevated text-sm font-semibold">
                  {seller.name.slice(0, 1)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{seller.name}</p>
                  <p className="flex items-center gap-1 text-xs text-muted">
                    <Star className="size-3" /> {seller.rating_avg.toFixed(1)} · {seller.listing_count} ilan · {new Date(seller.since).getFullYear()}
                  </p>
                </div>
              </Link>
            ) : null}

            <div className="mt-4 space-y-2">
              {user?.id === listing.user_id ? (
                <>
                  <p className="rounded-lg bg-elevated p-3 text-sm text-muted">Bu sizin ilanınız. Alıcı mesajları Mesajlar’da görünür.</p>
                  <Link to="/ilan-ver" search={{ id: listing.id }} className="block">
                    <Button className="w-full" variant="outline">
                      <Pencil className="size-4" /> Düzenle
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={async () => {
                      const url = window.location.href;
                      if (navigator.share) await navigator.share({ title: listing.title, url });
                      else {
                        await navigator.clipboard.writeText(url);
                        toast.success("Bağlantı kopyalandı");
                      }
                    }}
                  >
                    <Share2 className="size-4" /> Paylaş
                  </Button>
                </>
              ) : live ? (
                <>
                  {phone ? (
                    <div className="space-y-2">
                      <a
                        href={`tel:${cleanPhone(phone)}`}
                        className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-bold text-fg hover:bg-elevated transition-colors shadow-2xs font-mono tabular-nums"
                      >
                        <Phone className="size-4 text-ok" />
                        <span>{formatPhone(phone)}</span>
                      </a>
                      <a
                        className="block"
                        href={`https://wa.me/90${cleanPhone(phone).replace(/^0/, "")}?text=${encodeURIComponent(listing.title + " ilanınız hakkında bilgi almak istiyorum.")}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Button className="w-full bg-[#25D366] hover:bg-[#1EBE5D] text-white font-semibold">
                          WhatsApp ile İletişime Geç
                        </Button>
                      </a>
                    </div>
                  ) : (
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={async () => {
                        if (!(await needUser())) return;
                        try {
                          const r = await revealPhone({ data: { listingId: listing.id } });
                          setPhone(r.phone);
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Telefon yok");
                        }
                      }}
                    >
                      <Phone className="size-4" /> Telefonu Göster
                    </Button>
                  )}
                  <form
                    className="space-y-2"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!(await needUser())) return;
                      const content = msg.trim();
                      if (!content || msgBusy) return;
                      setMsgBusy(true);
                      try {
                        const r = await startConversation({ data: { listingId: listing.id, content } });
                        void nav({ to: "/mesajlar/$id", params: { id: r.conversationId } });
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Mesaj gönderilemedi");
                      } finally {
                        setMsgBusy(false);
                      }
                    }}
                  >
                    <Textarea
                      value={msg}
                      onChange={(e) => setMsg(e.target.value)}
                      placeholder="Satıcıya sorun"
                      maxLength={2000}
                      rows={3}
                      className="min-h-24"
                    />
                    <Button type="submit" className="w-full" disabled={msgBusy || !msg.trim()}>
                      <MessageCircle className="size-4" /> {msgBusy ? "Gönderiliyor…" : "Mesaj gönder"}
                    </Button>
                  </form>
                </>
              ) : (
                <p className="rounded-md bg-elevated p-3 text-sm text-muted">
                  {expired ? "Süresi dolan ilanda iletişim kapalı." : "Yayında olmayan ilanda iletişim kapalı."}
                </p>
              )}
              {user?.id === listing.user_id ? null : (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={async () => {
                      if (!(await needUser())) return;
                      const r = await toggleFavorite({ data: { listingId: listing.id } });
                      setFav(r.favorite);
                    }}
                  >
                    <Heart className={`size-4 ${fav ? "fill-danger text-danger" : ""}`} /> Favori
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={async () => {
                      const url = window.location.href;
                      if (navigator.share) await navigator.share({ title: listing.title, url });
                      else {
                        await navigator.clipboard.writeText(url);
                        toast.success("Bağlantı kopyalandı");
                      }
                    }}
                  >
                    <Share2 className="size-4" /> Paylaş
                  </Button>
                </div>
              )}
            </div>
            <p className="mt-4 text-xs text-muted">Kapora göndermeyin. Ürünü görmeden ödemeyin.</p>
            {user?.id === listing.user_id ? null : (
              <button type="button" className="mt-2 text-xs text-danger underline" onClick={() => setReportOn(true)}>
                İlanı şikayet et
              </button>
            )}
          </div>
        </aside>
      </div>

      {similar.length > 0 ? (
        <section className="mt-12">
          <h2 className="font-display text-xl font-semibold">Benzer ilanlar</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {similar.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        </section>
      ) : null}

      {seller && user && user.id !== seller.id ? (
        <section className="mt-10 rounded-xl border border-border bg-surface p-5">
          <h2 className="font-medium">Satıcıyı puanla</h2>
          <div className="mt-3 flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <Button
                key={n}
                size="sm"
                variant="outline"
                onClick={() =>
                  leaveReview({ data: { sellerId: seller.id, listingId: listing.id, rating: n } })
                    .then(() => toast.success("Puan kaydedildi"))
                    .catch((e) => toast.error(e instanceof Error ? e.message : "Puanlanamadı"))
                }
              >
                {n}
              </Button>
            ))}
          </div>
        </section>
      ) : null}

      {reportOn ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" onClick={() => setReportOn(false)}>
          <form
            className="w-full max-w-md space-y-3 rounded-xl bg-surface p-5"
            onClick={(e) => e.stopPropagation()}
            onSubmit={async (e) => {
              e.preventDefault();
              if (!(await needUser())) return;
              const fd = new FormData(e.currentTarget);
              try {
                await reportListing({ data: { listingId: listing.id, reason: String(fd.get("reason")), details: String(fd.get("details") || "") } });
                toast.success("Şikayet iletildi");
                setReportOn(false);
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Hata");
              }
            }}
          >
            <h3 className="font-semibold">Şikayet</h3>
            <Select name="reason" required>
              {REPORT_REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
            <Textarea name="details" placeholder="Ayrıntı (isteğe bağlı)" />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setReportOn(false)}>
                Vazgeç
              </Button>
              <Button type="submit">Gönder</Button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
