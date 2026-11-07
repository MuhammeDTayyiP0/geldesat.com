import { ErrorState } from "@/components/common/ErrorState";
import { createFileRoute, Link } from "@tanstack/react-router";
import { History, ImageIcon, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { myRecentListings, removeRecentListing } from "@/lib/server/social";
import type { RecentListing } from "@/lib/server/recently-viewed";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { AccountShell } from "@/components/account/AccountShell";
import { CardListSkeleton } from "@/components/listing/ListingGridSkeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { photoSrc } from "@/lib/images";
import { formatPrice, isListingExpired, listingAge, listingStatusLabel } from "@/lib/utils";

export const Route = createFileRoute("/son-bakilanlar")({
  head: () => ({
    meta: [
      { title: "Son baktıklarım | GeldeSat" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: RecentPage,
});

function viewedLabel(iso: string): string {
  const days = (Date.now() - new Date(iso).getTime()) / 86_400_000;
  if (days < 1 / 1440) return "az önce baktınız";
  if (days > 30) return `${new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" })} tarihinde baktınız`;
  return `${listingAge(iso)} baktınız`;
}

/** The account's last 50 viewed listings; each can be removed, or the whole list cleared. */
function RecentPage() {
  const { user, isPending } = useCurrentUserState();
  const [rows, setRows] = useState<RecentListing[] | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    setFailed(false);
    myRecentListings()
      .then((r) => alive && setRows(r))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [user, attempt]);

  if (!isPending && !user) return <RedirectToSignIn />;

  async function remove(id: string) {
    const before = rows;
    setRows((r) => r?.filter((x) => x.id !== id) ?? r);
    try {
      await removeRecentListing({ data: { listingId: id } });
    } catch {
      setRows(before);
      toast.error("Kaldırılamadı");
    }
  }

  async function clearAll() {
    setConfirmClear(false);
    const before = rows;
    setRows([]);
    try {
      await removeRecentListing({ data: { listingId: null } });
      toast.success("Geçmiş temizlendi");
    } catch {
      setRows(before);
      toast.error("Geçmiş temizlenemedi");
    }
  }

  return (
    <AccountShell
      title="Son baktıklarım"
      description={rows?.length ? `Son baktığınız ${rows.length} ilan · en fazla 50 ilan saklanır` : "Son baktığınız 50 ilan burada görünür."}
      actions={
        rows?.length ? (
          confirmClear ? (
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="danger" onClick={() => void clearAll()}>
                Evet, temizle
              </Button>
              <Button size="sm" variant="outline" onClick={() => setConfirmClear(false)}>
                Vazgeç
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setConfirmClear(true)}>
              <Trash2 className="size-4" /> Tümünü temizle
            </Button>
          )
        ) : null
      }
    >
      {failed ? (
        <ErrorState message="Geçmişiniz yüklenemedi." onRetry={() => setAttempt((n) => n + 1)} />
      ) : isPending || !rows ? (
        <CardListSkeleton count={5} />
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center">
          <History className="mx-auto size-8 text-subtle" />
          <p className="mt-3 font-medium">Henüz baktığınız ilan yok</p>
          <p className="mt-1 text-sm text-muted">İncelediğiniz ilanlar hesabınıza kaydedilir; buradan tekrar açabilir veya silebilirsiniz.</p>
          <Link to="/search" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
            İlanlara göz at
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-[14px] border border-border bg-surface">
          {rows.map((l) => (
            <li key={l.id} className="relative flex items-stretch">
              <Link
                to="/ilan/$slug"
                params={{ slug: l.slug }}
                // Only hidden listings have nowhere to go; sold and expired ones still open.
                disabled={l.status === "REJECTED" || l.status === "INACTIVE" || l.status === "PENDING"}
                className={`flex min-w-0 flex-1 gap-3 p-3 pr-12 hover:bg-elevated ${l.live ? "" : "opacity-70"}`}
              >
                <span className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-elevated sm:h-20 sm:w-28">
                  {l.images[0] ? (
                    <img src={photoSrc(l.images[0], 240)} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
                  ) : (
                    <ImageIcon className="absolute inset-0 m-auto size-6 text-subtle" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-primary tabular-nums">{formatPrice(l.price, l.currency)}</span>
                  <span className="line-clamp-2 text-sm font-medium text-fg">{l.title}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-subtle">
                    {!l.live ? <Badge tone="warn">{listingStatusLabel(l.status, isListingExpired(l))}</Badge> : null}
                    <span className="truncate">{[l.district, l.city].filter(Boolean).join(", ")}</span>
                    <span>· {viewedLabel(l.viewed_at)}</span>
                  </span>
                </span>
              </Link>
              <button
                type="button"
                onClick={() => void remove(l.id)}
                aria-label={`${l.title} geçmişten kaldır`}
                className="absolute right-2 top-2 grid size-9 place-items-center rounded-full text-subtle hover:bg-elevated hover:text-fg"
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </AccountShell>
  );
}
