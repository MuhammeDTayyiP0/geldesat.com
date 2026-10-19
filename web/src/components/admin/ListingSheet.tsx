import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Ban,
  CalendarPlus,
  Check,
  ExternalLink,
  Eye,
  FolderInput,
  Heart,
  Pencil,
  ShieldAlert,
  Sparkles,
  Tag,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { photoSrc } from "@/lib/images";
import { cn } from "@/lib/utils";
import { adminListingDetail, adminUpdateListing, type AdminListingDetail } from "@/lib/server/admin/listings";
import { useListingActions, useRunner, useSheets } from "./hooks";
import { dateTime, listingStatus, money, n, relative } from "./format";
import { AuditList } from "./AuditList";
import { Avatar, ErrorState, Field, inputClass, KeyValue, Menu, MenuItem, MenuSeparator, MiniStat, Pill, SheetHeader, Spinner, TabBar, textareaClass } from "./ui";

export function ListingSheetBody({ id, canGoBack }: { id: string; canGoBack: boolean }) {
  const { back, close, openUser } = useSheets();
  const query = useQuery({ queryKey: ["admin", "listing", id], queryFn: () => adminListingDetail({ data: { id } }) });
  const [tab, setTab] = useState<"overview" | "seller" | "reports" | "history">("overview");
  const [editing, setEditing] = useState(false);

  if (query.isLoading) {
    return (
      <>
        <SheetHeader onClose={close}>
          <div className="h-5 w-48 animate-pulse rounded bg-elevated" />
        </SheetHeader>
        <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted">
          <Spinner /> İlan yükleniyor…
        </div>
      </>
    );
  }
  if (query.error || !query.data) {
    return (
      <>
        <SheetHeader onClose={close}>
          <span className="font-semibold">İlan</span>
        </SheetHeader>
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </>
    );
  }

  const d = query.data;
  const l = d.listing;
  const st = listingStatus(l.status, l.expires_at);

  return (
    <>
      <SheetHeader onClose={close}>
        <div className="flex items-start gap-3">
          {canGoBack ? (
            <button type="button" onClick={back} className="mt-0.5 rounded-lg p-1 text-muted hover:bg-elevated hover:text-fg" aria-label="Geri">
              <ArrowLeft className="size-4" />
            </button>
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <Pill tone={st.tone} dot>
                {st.label}
              </Pill>
              <span className="font-mono text-xs text-muted">#{l.listing_no}</span>
              {l.featured_until && new Date(l.featured_until) > new Date() ? <Pill tone="violet">Vitrin · {relative(l.featured_until)}</Pill> : null}
              {l.open_reports ? <Pill tone="danger">{l.open_reports} açık şikayet</Pill> : null}
              {l.seller_banned ? <Pill tone="danger">Satıcı askıda</Pill> : null}
            </div>
            <h2 className="mt-1.5 text-lg font-bold leading-snug">{l.title}</h2>
            <p className="mt-0.5 text-sm text-muted">
              <span className="font-semibold text-fg">{money(l.price, l.currency)}</span> · {d.path.map((p) => p.name).join(" › ")}
            </p>
          </div>
        </div>
      </SheetHeader>

      <ListingActionBar detail={d} onEdit={() => setEditing(true)} />

      <TabBar
        value={tab}
        onChange={setTab}
        items={[
          { value: "overview", label: "Genel" },
          { value: "seller", label: "Satıcı" },
          { value: "reports", label: "Şikayetler", count: d.reports.length },
          { value: "history", label: "Geçmiş", count: d.log.length },
        ]}
      />

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {editing ? <EditListingForm detail={d} onDone={() => setEditing(false)} /> : null}

        {tab === "overview" && !editing ? (
          <div className="space-y-5">
            {l.images.length ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {l.images.map((img, i) => (
                  <a key={img + i} href={photoSrc(img, 800)} target="_blank" rel="noreferrer" className={cn("group relative overflow-hidden rounded-lg border border-border bg-elevated", i === 0 && "col-span-2 row-span-2")}>
                    <img src={photoSrc(img, i === 0 ? 800 : 480)} alt="" loading="lazy" className="aspect-square size-full object-cover transition-transform group-hover:scale-105" />
                    {i === 0 ? <span className="absolute left-2 top-2 rounded bg-ink/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">Kapak</span> : null}
                  </a>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-surface p-6 text-center text-sm text-muted">Bu ilanda fotoğraf yok.</div>
            )}

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <MiniStat label="Görüntülenme" value={n(l.view_count)} />
              <MiniStat label="Favori" value={n(l.fav_count)} />
              <MiniStat label="Telefon gösterimi" value={n(l.phone_reveals)} />
              <MiniStat label="Mesajlaşma" value={n(l.conversations)} />
            </div>

            <section className="rounded-xl border border-border bg-surface p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">İlan bilgileri</h3>
              <KeyValue
                items={[
                  { label: "Konum", value: [l.city, l.district, l.neighborhood].filter(Boolean).join(" / ") || "—" },
                  { label: "Mağaza", value: l.store_name ?? "—" },
                  { label: "Oluşturulma", value: dateTime(l.created_at) },
                  { label: "Son güncelleme", value: dateTime(l.updated_at) },
                  { label: "Onay", value: l.approved_at ? dateTime(l.approved_at) : "Onaysız" },
                  { label: "Bitiş", value: l.expires_at ? `${dateTime(l.expires_at)} (${relative(l.expires_at)})` : "—" },
                  { label: "İlana özel telefon", value: l.phone_override ?? "Profil telefonu" },
                  { label: "Kimlik", value: <span className="font-mono text-xs">{l.id}</span> },
                ]}
              />
            </section>

            {Object.keys(l.attrs).length ? (
              <section className="rounded-xl border border-border bg-surface p-4">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Özellikler</h3>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                  {Object.entries(l.attrs).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3 border-b border-dashed border-border py-1">
                      <dt className="text-muted">{k}</dt>
                      <dd className="text-right font-medium">{Array.isArray(v) ? v.join(", ") : String(v)}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : null}

            <section className="rounded-xl border border-border bg-surface p-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Açıklama</h3>
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{l.description}</p>
            </section>
          </div>
        ) : null}

        {tab === "seller" && !editing ? (
          d.seller ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4">
                <Avatar name={d.seller.display_name} src={d.seller.avatar_url} size={48} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold">{d.seller.display_name}</span>
                    {d.seller.role === "ADMIN" ? <Pill tone="ink">Yönetici</Pill> : null}
                    {d.seller.banned ? <Pill tone="danger">Askıda</Pill> : null}
                    {d.seller.email_verified ? <Pill tone="ok">E-posta doğrulandı</Pill> : <Pill tone="warn">Doğrulanmamış</Pill>}
                  </div>
                  <p className="truncate text-xs text-muted">
                    {d.seller.email ?? "E-posta yok"} · {d.seller.phone ?? "Telefon yok"} · Üyelik {relative(d.seller.created_at)}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => openUser(d.seller!.user_id)}>
                  Profili aç
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <MiniStat label="Toplam ilan" value={n(d.seller.listings_total)} />
                <MiniStat label="Yayında" value={n(d.seller.listings_active)} tone="ok" />
                <MiniStat label="Reddedilen" value={n(d.seller.listings_rejected)} tone={d.seller.listings_rejected ? "warn" : undefined} />
                <MiniStat label="Hakkında şikayet" value={n(d.seller.reports_against)} tone={d.seller.reports_against ? "danger" : undefined} />
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">Satıcı profili bulunamadı (hesap silinmiş olabilir).</p>
          )
        ) : null}

        {tab === "reports" && !editing ? (
          d.reports.length ? (
            <ul className="space-y-2">
              {d.reports.map((r) => (
                <li key={r.id} className="rounded-xl border border-border bg-surface p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone={r.status === "OPEN" ? "danger" : "muted"}>{r.status === "OPEN" ? "Açık" : "Kapalı"}</Pill>
                    <span className="font-semibold">{r.reason}</span>
                    <span className="ml-auto text-xs text-muted">
                      {r.reporter_name} · {relative(r.created_at)}
                    </span>
                  </div>
                  {r.details ? <p className="mt-1.5 text-muted">“{r.details}”</p> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Bu ilan hakkında şikayet yok.</p>
          )
        ) : null}

        {tab === "history" && !editing ? (
          <div className="space-y-5">
            {d.priceHistory.length > 1 ? (
              <section className="rounded-xl border border-border bg-surface p-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Fiyat geçmişi</h3>
                <ul className="space-y-1 text-sm">
                  {d.priceHistory.map((h, i) => (
                    <li key={i} className="flex justify-between">
                      <span className="text-muted">{dateTime(h.at)}</span>
                      <span className="font-semibold tabular-nums">{money(h.price, l.currency)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Yönetici işlemleri</h3>
              <AuditList entries={d.log} empty="Bu ilan üzerinde henüz yönetici işlemi yapılmadı." />
            </section>
          </div>
        ) : null}
      </div>
    </>
  );
}

function ListingActionBar({ detail, onEdit }: { detail: AdminListingDetail; onEdit: () => void }) {
  const { act, busy } = useListingActions();
  const { close } = useSheets();
  const l = detail.listing;
  const ids = [l.id];
  const featured = l.featured_until && new Date(l.featured_until) > new Date();
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-5 py-2.5">
      {l.status === "PENDING" || l.status === "REJECTED" || l.status === "INACTIVE" ? (
        <Button size="sm" className="bg-ok text-white hover:bg-ok/90" disabled={busy} onClick={() => void act(ids, "approve", l.title)}>
          <Check className="size-4" /> {l.status === "PENDING" ? "Onayla" : "Onayla ve yayına al"}
        </Button>
      ) : null}
      {l.status !== "REJECTED" ? (
        <Button size="sm" variant="outline" className="text-danger" disabled={busy} onClick={() => void act(ids, "reject", l.title)}>
          <X className="size-4" /> Reddet
        </Button>
      ) : null}
      {l.status === "ACTIVE" ? (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void act(ids, "deactivate", l.title)}>
          <Ban className="size-4" /> Yayından kaldır
        </Button>
      ) : null}
      <Button size="sm" variant="outline" disabled={busy} onClick={() => void act(ids, "extend", l.title)}>
        <CalendarPlus className="size-4" /> Süre uzat
      </Button>
      <a href={`/ilan/${l.slug}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-muted hover:bg-elevated hover:text-fg">
        <ExternalLink className="size-4" /> Sitede gör
      </a>
      <div className="ml-auto">
        <Menu>
          <MenuItem icon={Pencil} onSelect={onEdit}>
            Bilgileri düzenle
          </MenuItem>
          <MenuItem icon={FolderInput} onSelect={() => void act(ids, "move", l.title)}>
            Kategori değiştir
          </MenuItem>
          {featured ? (
            <MenuItem icon={Undo2} onSelect={() => void act(ids, "unfeature", l.title)}>
              Vitrinden çıkar
            </MenuItem>
          ) : (
            <MenuItem icon={Sparkles} onSelect={() => void act(ids, "feature", l.title)}>
              Vitrine al
            </MenuItem>
          )}
          {l.status !== "SOLD" ? (
            <MenuItem icon={Tag} onSelect={() => void act(ids, "sold", l.title)}>
              Satıldı olarak işaretle
            </MenuItem>
          ) : null}
          {l.status === "ACTIVE" ? null : (
            <MenuItem icon={Eye} onSelect={() => void act(ids, "activate", l.title)}>
              Doğrudan yayına al
            </MenuItem>
          )}
          <MenuSeparator />
          <MenuItem
            icon={Trash2}
            danger
            onSelect={() =>
              void act(ids, "delete", l.title).then((ok) => {
                if (ok) close();
              })
            }
          >
            Kalıcı olarak sil
          </MenuItem>
        </Menu>
      </div>
    </div>
  );
}

function EditListingForm({ detail, onDone }: { detail: AdminListingDetail; onDone: () => void }) {
  const l = detail.listing;
  const { run, busy } = useRunner();
  const [title, setTitle] = useState(l.title);
  const [description, setDescription] = useState(l.description);
  const [price, setPrice] = useState(String(l.price));
  const [city, setCity] = useState(l.city ?? "");
  const [district, setDistrict] = useState(l.district ?? "");
  return (
    <form
      className="mb-5 space-y-3 rounded-xl border border-primary/30 bg-surface p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void run(
          () => adminUpdateListing({ data: { id: l.id, title, description, price: Number(price.replace(/\D/g, "")) || 0, city, district } }),
          "İlan güncellendi.",
        ).then((r) => {
          if (r) onDone();
        });
      }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">İlan bilgilerini düzenle</h3>
        <span className="text-xs text-muted">Değişiklik işlem kaydına yazılır.</span>
      </div>
      <Field label="Başlık">
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} className={inputClass} required minLength={5} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Fiyat (TL)">
          <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="numeric" className={inputClass} />
        </Field>
        <Field label="İl">
          <input value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} />
        </Field>
        <Field label="İlçe">
          <input value={district} onChange={(e) => setDistrict(e.target.value)} className={inputClass} />
        </Field>
      </div>
      <Field label="Açıklama">
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={8} className={textareaClass} required minLength={10} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onDone}>
          Vazgeç
        </Button>
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? <Spinner /> : null} Kaydet
        </Button>
      </div>
    </form>
  );
}

/** Small icon row used in list rows. */
export function ListingStats({ views, favs, reports }: { views: number; favs: number; reports?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5 text-[11px] tabular-nums text-muted">
      <span className="inline-flex items-center gap-0.5" title="Görüntülenme">
        <Eye className="size-3" /> {n(views)}
      </span>
      <span className="inline-flex items-center gap-0.5" title="Favori">
        <Heart className="size-3" /> {n(favs)}
      </span>
      {reports ? (
        <span className="inline-flex items-center gap-0.5 font-semibold text-danger" title="Açık şikayet">
          <ShieldAlert className="size-3" /> {n(reports)}
        </span>
      ) : null}
    </span>
  );
}
