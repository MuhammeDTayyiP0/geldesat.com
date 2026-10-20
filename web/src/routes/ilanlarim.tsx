import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CircleCheck, Eye, EyeOff, ImageIcon, LayoutGrid, MoreVertical, Pencil, Plus, RefreshCw, Rocket, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteListing, myListings, renewListing, setListingStatus } from "@/lib/server/account";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";
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
import type { ListingCard as Listing } from "@/lib/server/helpers";

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

function tabOf(l: Listing): Tab {
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
  const { user, isPending } = useCurrentUserState();
  const [rows, setRows] = useState<Listing[] | null>(null);
  const [tab, setTab] = useState<Tab>("live");
  const [toDelete, setToDelete] = useState<Listing | null>(null);
  const [busy, setBusy] = useState(false);

  function reload() {
    myListings()
      .then(setRows)
      .catch(() => setRows([]));
  }
  useEffect(() => {
    if (user) reload();
  }, [user]);

  const groups = useMemo(() => {
    const map: Record<Tab, Listing[]> = { live: [], pending: [], off: [], sold: [], rejected: [] };
    for (const l of rows ?? []) map[tabOf(l)].push(l);
    return map;
  }, [rows]);

  if (!isPending && !user) return <RedirectToSignIn />;

  /** Run an owner action, report the server's answer and refresh the list. */
  async function act(run: () => Promise<unknown>, done: string) {
    setBusy(true);
    try {
      await run();
      toast.success(done);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "İşlem başarısız oldu");
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
        <Link to="/ilan-ver">
          <Button size="sm">
            <Plus className="size-4" /> Yeni
          </Button>
        </Link>
      }
    >
      <div role="tablist" aria-label="İlan durumu" className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((t) => {
          const n = groups[t.key].length;
          const selected = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setTab(t.key)}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors",
                selected ? "border-primary bg-primary text-primary-fg" : "border-border bg-surface text-fg hover:bg-elevated",
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

      {isPending || !rows ? (
        <CardListSkeleton count={4} />
      ) : list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center">
          <LayoutGrid className="mx-auto size-8 text-subtle" />
          <p className="mt-3 font-medium">{tab === "live" ? "Yayında ilanınız yok" : "Bu bölümde ilan yok"}</p>
          {tab === "live" ? (
            <>
              <p className="mt-1 text-sm text-muted">İlan vermek ücretsiz. Birkaç dakikada ilanınızı yayınlayın.</p>
              <Link to="/ilan-ver" className="mt-4 inline-block">
                <Button>
                  <Plus className="size-4" /> İlan ver
                </Button>
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
              onStatus={(status, done) => void act(() => setListingStatus({ data: { id: l.id, status } }), done)}
              onRenew={() => void act(() => renewListing({ data: { id: l.id } }), "İlan süresi 30 gün uzatıldı")}
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
                void act(() => deleteListing({ data: { id: target.id } }), "İlan silindi").then(() => setToDelete(null));
              }}
            >
              {busy ? "Siliniyor…" : "Evet, sil"}
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
  onStatus,
  onRenew,
  onDelete,
}: {
  listing: Listing;
  busy: boolean;
  onStatus: (status: "ACTIVE" | "INACTIVE" | "SOLD", done: string) => void;
  onRenew: () => void;
  onDelete: () => void;
}) {
  const nav = useNavigate();
  const expired = isListingExpired(l);
  const live = l.status === "ACTIVE" && !expired;
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
          <span className="text-xs text-subtle">{formatNumber(l.view_count)} görüntülenme</span>
          {l.expires_at && l.status === "ACTIVE" ? (
            <span className={cn("text-xs", expired ? "text-warn" : "text-subtle")}>
              {expired ? "Bitti" : "Bitiş"}: {formatDate(l.expires_at)}
            </span>
          ) : null}
        </div>
        {l.status === "PENDING" ? <p className="text-xs text-warn">İnceleme bitince yayına alınır.</p> : null}
        {live && left != null && left > 0 && left <= 7 ? <p className="text-xs text-warn">{left} gün içinde süresi doluyor</p> : null}
        {expired && l.status === "ACTIVE" ? (
          <Button size="sm" variant="outline" className="mt-1" disabled={busy} onClick={onRenew}>
            <RefreshCw className="size-3.5" /> Yenile ve yayına al
          </Button>
        ) : null}
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
          {l.status !== "SOLD" ? (
            <DropdownMenuItem onSelect={() => void nav({ to: "/ilan-ver", search: { id: l.id } })}>
              <Pencil className="size-4" /> Düzenle
            </DropdownMenuItem>
          ) : null}
          {live ? (
            <DropdownMenuItem onSelect={() => onStatus("INACTIVE", "Yayından kaldırıldı")}>
              <EyeOff className="size-4" /> Yayından kaldır
            </DropdownMenuItem>
          ) : null}
          {l.status === "INACTIVE" ? (
            <DropdownMenuItem onSelect={() => onStatus("ACTIVE", "İlan yayına alındı")}>
              <Eye className="size-4" /> Yayına al
            </DropdownMenuItem>
          ) : null}
          {l.status === "ACTIVE" || l.status === "INACTIVE" ? (
            <DropdownMenuItem onSelect={() => onStatus("SOLD", "Satıldı olarak işaretlendi")}>
              <CircleCheck className="size-4" /> Satıldı olarak işaretle
            </DropdownMenuItem>
          ) : null}
          {l.status !== "REJECTED" && l.status !== "SOLD" && l.status !== "PENDING" ? (
            <DropdownMenuItem onSelect={onRenew}>
              <RefreshCw className="size-4" /> Süreyi 30 gün uzat
            </DropdownMenuItem>
          ) : null}
          {l.status === "ACTIVE" ? (
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
