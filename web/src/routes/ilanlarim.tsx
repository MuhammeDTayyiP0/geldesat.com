import { ErrorState } from "@/components/common/ErrorState";
import { ownerActions } from "@/lib/listing-status";
import { useFlag } from "@/lib/use-flag";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { errorText } from "@/lib/error-text";
import { useEffect, useMemo, useState } from "react";
import { CircleCheck, Copy, Eye, EyeOff, Heart, ImageIcon, LayoutGrid, MessageCircle, MoreVertical, Pencil, Phone, Plus, RefreshCw, Rocket, Trash2, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { deleteListing, myListings, quickUpdatePrice, renewListing, setListingStatus } from "@/lib/server/account";
import { Input } from "@/components/ui/input";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CardListSkeleton } from "@/components/listing/ListingGridSkeleton";
import { AccountShell } from "@/components/account/AccountShell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { photoSrc } from "@/lib/images";
import { cn, formatDate, formatNumber, formatPrice, isListingExpired, listingStatusLabel } from "@/lib/utils";

type MyListing = Awaited<ReturnType<typeof myListings>>[number];

export const Route = createFileRoute("/ilanlarim")({
  head: () => ({
    meta: [
      { title: "İlanlarım | GeldeSat" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: Mine,
});

/** Tabs, grouping and actions are the same as the app's İlanlarım screen. */
type Tab = "live" | "pending" | "off" | "sold" | "rejected";

const TABS: { key: Tab; label: string }[] = [
  { key: "live", label: "Yayında" },
  { key: "pending", label: "Onay bekleyen" },
  { key: "off", label: "Yayında değil" },
  { key: "sold", label: "Satıldı" },
  { key: "rejected", label: "Reddedilen" },
];

function tabOf(l: MyListing): Tab {
  if (l.status === "PENDING") return "pending";
  if (l.status === "SOLD") return "sold";
  if (l.status === "REJECTED") return "rejected";
  if (l.status === "ACTIVE" && !isListingExpired(l)) return "live";
  return "off";
}

function daysLeft(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

function Mine() {
  const istatistikler = useFlag("satici_istatistikleri");
  const { user, isPending } = useCurrentUserState();
  const [rows, setRows] = useState<MyListing[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [tab, setTab] = useState<Tab>("live");
  const [toDelete, setToDelete] = useState<MyListing | null>(null);
  const [priceTarget, setPriceTarget] = useState<MyListing | null>(null);
  const [priceInput, setPriceInput] = useState("");
  const [busy, setBusy] = useState(false);

  function reload() {
    setLoadFailed(false);
    myListings()
      .then((next) => {
        setRows(next);
        // Open on what is there: someone whose first listing waits for approval starts on that tab.
        setTab((current) => {
          const has = (key: Tab) => next.some((l) => tabOf(l) === key);
          return has(current) ? current : (TABS.find((t) => has(t.key))?.key ?? current);
        });
      })
      .catch(() => setLoadFailed(true));
  }
  useEffect(() => {
    if (user) reload();
  }, [user]);

  const groups = useMemo(() => {
    const map: Record<Tab, MyListing[]> = { live: [], pending: [], off: [], sold: [], rejected: [] };
    for (const l of rows ?? []) map[tabOf(l)].push(l);
    return map;
  }, [rows]);

  const totals = useMemo(() => {
    const acc = { views: 0, favs: 0, messages: 0, phones: 0 };
    for (const l of rows ?? []) {
      acc.views += l.view_count;
      acc.favs += l.fav_count;
      acc.messages += l.message_count;
      acc.phones += l.phone_reveal_count;
    }
    return acc;
  }, [rows]);

  if (!isPending && !user) return <RedirectToSignIn />;

  /** Run an owner action, report the server's answer and refresh the list. */
  async function act(run: () => Promise<unknown>, done: string): Promise<boolean> {
    setBusy(true);
    try {
      await run();
      toast.success(done);
      reload();
      return true;
    } catch (e) {
      toast.error(errorText(e, "İşlem başarısız oldu"));
      return false;
    } finally {
      setBusy(false);
    }
  }

  const list = groups[tab];

  return (
    <AccountShell
      title="İlanlarım"
      description={rows ? `${rows.length} ilan` : "Yayındaki, onay bekleyen ve pasif ilanlarınızı yönetin."}
      actions={
        <Link to="/ilan-ver" className={buttonVariants({ size: "sm" })}>
            <Plus className="size-4" /> Yeni
          </Link>
      }
    >
      {loadFailed ? <ErrorState message="İlanlarınız yüklenemedi." onRetry={reload} /> : null}
      {istatistikler && !loadFailed && rows && rows.length > 0 ? (
        <dl
          aria-label="Toplam ilan istatistikleri"
          className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4"
        >
          {[
            { label: "Toplam Görüntülenme", value: totals.views, icon: Eye },
            { label: "Favori", value: totals.favs, icon: Heart },
            { label: "Mesaj", value: totals.messages, icon: MessageCircle },
            { label: "Telefon", value: totals.phones, icon: Phone },
          ].map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="flex items-center gap-2.5 rounded-xl border border-border bg-surface px-3 py-2.5"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <dt className="truncate text-[11px] text-muted">{label}</dt>
                <dd className="text-sm font-semibold tabular-nums text-fg">{formatNumber(value)}</dd>
              </div>
            </div>
          ))}
        </dl>
      ) : null}
      <div aria-label="İlan durumu" className={cn(loadFailed && "hidden", "-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden")}>
        {TABS.map((t) => {
          const n = groups[t.key].length;
          const selected = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              aria-pressed={selected}
              onClick={() => setTab(t.key)}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors",
                selected ? "border-primary bg-primary-solid text-primary-fg" : "border-border bg-surface text-fg hover:bg-elevated",
              )}
            >
              {t.label}
              {n ? (
                <span className={cn("min-w-5 rounded-full px-1.5 text-center text-xs leading-5", selected ? "bg-white/20" : "bg-elevated text-muted")}>
                  {n}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {loadFailed ? null : isPending || !rows ? (
        <CardListSkeleton count={4} />
      ) : list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center">
          <LayoutGrid className="mx-auto size-8 text-subtle" />
          <p className="mt-3 font-medium">{tab === "live" ? "Yayında ilanınız yok" : "Bu bölümde ilan yok"}</p>
          {tab === "live" ? (
            <>
              <p className="mt-1 text-sm text-muted">İlan vermek ücretsiz. Birkaç dakikada ilanınızı yayınlayın.</p>
              <Link to="/ilan-ver" className={buttonVariants({ className: "mt-4" })}>
                  <Plus className="size-4" /> İlan ver
                </Link>
            </>
          ) : null}
        </div>
      ) : (
        <ul className="grid gap-3">
          {list.map((l) => (
            <MyListingRow
              key={l.id}
              listing={l}
              busy={busy}
              showStats={istatistikler}
              onStatus={(status, done) => void act(() => setListingStatus({ data: { id: l.id, status } }), done)}
              onRenew={() => void act(() => renewListing({ data: { id: l.id } }), "İlan süresi 30 gün uzatıldı")}
              onDropPrice={() => {
                setPriceTarget(l);
                setPriceInput(String(Math.max(1, Math.round(l.price * 0.9))));
              }}
              onDelete={() => setToDelete(l)}
            />
          ))}
        </ul>
      )}

      <Dialog open={Boolean(toDelete)} onOpenChange={(o) => !busy && !o && setToDelete(null)}>
        <DialogContent className="border-border bg-surface">
          <DialogHeader>
            <DialogTitle>İlan silinsin mi?</DialogTitle>
            <DialogDescription>
              “{toDelete?.title}” ve fotoğrafları kalıcı olarak silinir, bu işlem geri alınamaz.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" disabled={busy} onClick={() => setToDelete(null)}>
              Vazgeç
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => {
                const target = toDelete;
                if (!target) return;
                void act(() => deleteListing({ data: { id: target.id } }), "İlan silindi").then((ok) => {
                  if (ok) setToDelete(null);
                });
              }}
            >
              {busy ? "Siliniyor…" : "Evet, sil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(priceTarget)} onOpenChange={(o) => !busy && !o && setPriceTarget(null)}>
        <DialogContent className="border-border bg-surface">
          <DialogHeader>
            <DialogTitle>Fiyatı hızlı güncelle</DialogTitle>
            <DialogDescription>
              {priceTarget ? `Mevcut fiyat: ${formatPrice(priceTarget.price, priceTarget.currency)}. Fiyatı düşürdüğünüzde ilanı favorileyen alıcılara bildirim gider.` : ""}
            </DialogDescription>
          </DialogHeader>
          {priceTarget ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {[5, 10, 15].map((pct) => {
                  const next = Math.max(1, Math.round(priceTarget.price * (1 - pct / 100)));
                  return (
                    <Button
                      key={pct}
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setPriceInput(String(next))}
                    >
                      -%{pct} ({formatPrice(next, priceTarget.currency)})
                    </Button>
                  );
                })}
              </div>
              <Input
                inputMode="numeric"
                aria-label="Yeni fiyat"
                value={priceInput ? formatNumber(priceInput) : ""}
                onChange={(e) => setPriceInput(e.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 10))}
                className="text-lg font-semibold tabular-nums"
              />
            </div>
          ) : null}
          <DialogFooter className="gap-2">
            <Button variant="ghost" disabled={busy} onClick={() => setPriceTarget(null)}>
              Vazgeç
            </Button>
            <Button
              disabled={busy || !priceTarget || !(Number(priceInput) >= 1)}
              onClick={async () => {
                if (!priceTarget) return;
                const nextPrice = Number(priceInput);
                if (!Number.isFinite(nextPrice) || nextPrice < 1) return;
                const targetId = priceTarget.id;
                const ok = await act(() => quickUpdatePrice({ data: { id: targetId, price: nextPrice } }), "Fiyat güncellendi");
                if (ok) setPriceTarget(null);
              }}
            >
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AccountShell>
  );
}

function MyListingRow({
  listing: l,
  busy,
  showStats,
  onStatus,
  onRenew,
  onDropPrice,
  onDelete,
}: {
  listing: MyListing;
  busy: boolean;
  showStats: boolean;
  onStatus: (status: "ACTIVE" | "INACTIVE" | "SOLD", done: string) => void;
  onRenew: () => void;
  onDropPrice: () => void;
  onDelete: () => void;
}) {
  const nav = useNavigate();
  const dopingOn = useFlag("doping_enabled");
  const benzerIlanOn = useFlag("benzer_ilan_ver");
  const expired = isListingExpired(l);
  const live = l.status === "ACTIVE" && !expired;
  const actions = ownerActions({ status: l.status, approved: l.approved ?? true, expired });
  const left = daysLeft(l.expires_at);
  const tone = live ? "ok" : l.status === "REJECTED" ? "danger" : l.status === "SOLD" ? "muted" : "warn";

  return (
    <li className="flex gap-3 rounded-[14px] border border-border bg-surface p-3">
      <Link to="/ilan/$slug" params={{ slug: l.slug }} className="relative size-[88px] shrink-0 overflow-hidden rounded-[10px] bg-elevated">
        {l.images[0] ? (
          <img src={photoSrc(l.images[0], 240)} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
        ) : (
          <ImageIcon className="absolute inset-0 m-auto size-6 text-subtle" />
        )}
      </Link>
      <div className="min-w-0 flex-1 space-y-1">
        <Link to="/ilan/$slug" params={{ slug: l.slug }} className="line-clamp-2 text-sm font-semibold leading-snug hover:text-primary">
          {l.title}
        </Link>
        <p className="font-semibold text-primary tabular-nums">{formatPrice(l.price, l.currency)}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={tone}>{listingStatusLabel(l.status, expired)}</Badge>
          {!showStats ? (
            <span className="text-xs text-subtle">{formatNumber(l.view_count)} görüntülenme</span>
          ) : null}
          {l.expires_at && l.status === "ACTIVE" ? (
            <span className={cn("text-xs", expired ? "text-warn" : "text-subtle")}>
              {expired ? "Bitti" : "Bitiş"}: {formatDate(l.expires_at)}
            </span>
          ) : null}
        </div>
        {showStats ? (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {[
              { label: "Görüntülenme", value: l.view_count, icon: Eye },
              { label: "Favori", value: l.fav_count, icon: Heart },
              { label: "Mesaj", value: l.message_count, icon: MessageCircle },
              { label: "Telefon", value: l.phone_reveal_count, icon: Phone },
            ].map(({ label, value, icon: Icon }) => (
              <span
                key={label}
                title={label}
                aria-label={`${label}: ${formatNumber(value)}`}
                className="inline-flex items-center gap-1 rounded-md bg-elevated px-2 py-0.5 text-xs tabular-nums text-muted"
              >
                <Icon className="size-3 text-subtle" aria-hidden="true" />
                {formatNumber(value)}
              </span>
            ))}
          </div>
        ) : null}
        {l.status === "PENDING" ? <p className="text-xs text-warn">İnceleme bitince yayına alınır.</p> : null}
        {l.status === "REJECTED" && l.rejection_reason ? (
          <p className="rounded-lg border border-danger/25 bg-danger/6 px-2.5 py-1.5 text-xs text-danger">
            Reddetme gerekçesi: {l.rejection_reason}
          </p>
        ) : null}
        {live && left != null && left > 0 && left <= 7 ? <p className="text-xs text-warn">{left} gün içinde süresi doluyor</p> : null}
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          {live ? (
            <Button size="sm" variant="outline" className="h-8 text-xs" disabled={busy} onClick={onDropPrice}>
              <TrendingDown className="size-3.5" /> Fiyatı düşür
            </Button>
          ) : null}
          {expired && l.status === "ACTIVE" ? (
            <Button size="sm" variant="outline" className="h-8" disabled={busy} onClick={onRenew}>
              <RefreshCw className="size-3.5" /> Yenile ve yayına al
            </Button>
          ) : null}
          {benzerIlanOn ? (
            <Link
              to="/ilan-ver"
              search={{ copyFrom: l.id }}
              className={buttonVariants({ size: "sm", variant: "outline", className: "h-8 text-xs" })}
            >
              <Copy className="size-3.5" /> Benzer ilan ver
            </Link>
          ) : null}
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="İşlemler"
            disabled={busy}
            className="grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-elevated hover:text-fg"
          >
            <MoreVertical className="size-5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={() => void nav({ to: "/ilan/$slug", params: { slug: l.slug } })}>
            <Eye className="size-4" /> İlanı görüntüle
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void nav({ to: "/ilan-ver", search: { id: l.id } })}>
            <Pencil className="size-4" /> Düzenle
          </DropdownMenuItem>
          {benzerIlanOn ? (
            <DropdownMenuItem onSelect={() => void nav({ to: "/ilan-ver", search: { copyFrom: l.id } })}>
              <Copy className="size-4" /> Benzer ilan ver
            </DropdownMenuItem>
          ) : null}
          {live ? (
            <DropdownMenuItem onSelect={() => onStatus("INACTIVE", "Yayından kaldırıldı")}>
              <EyeOff className="size-4" /> Yayından kaldır
            </DropdownMenuItem>
          ) : null}
          {actions.includes("publish") ? (
            <DropdownMenuItem onSelect={() => onStatus("ACTIVE", "İlan yayına alındı")}>
              <Eye className="size-4" /> Yayına al
            </DropdownMenuItem>
          ) : null}
          {actions.includes("sold") ? (
            <DropdownMenuItem onSelect={() => onStatus("SOLD", "Satıldı olarak işaretlendi")}>
              <CircleCheck className="size-4" /> Satıldı olarak işaretle
            </DropdownMenuItem>
          ) : null}
          {actions.includes("renew") ? (
            <DropdownMenuItem onSelect={onRenew}>
              <RefreshCw className="size-4" /> Süreyi 30 gün uzat
            </DropdownMenuItem>
          ) : null}
          {dopingOn && l.status === "ACTIVE" && !expired ? (
            <DropdownMenuItem onSelect={() => void nav({ to: "/doping" })}>
              <Rocket className="size-4" /> Öne çıkar (doping)
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onDelete} className="text-danger focus:text-danger">
            <Trash2 className="size-4" /> Sil
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
