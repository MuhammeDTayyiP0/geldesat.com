import { createFileRoute, Link } from "@tanstack/react-router";
import { Store, UserCheck, UserMinus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AccountShell, UserAvatar } from "@/components/account/AccountShell";
import { BrandSpinner } from "@/components/brand/BrandSpinner";
import { ErrorState } from "@/components/common/ErrorState";
import { Button, buttonVariants } from "@/components/ui/button";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { errorText } from "@/lib/error-text";
import { myFollowedSellers, unfollowSeller } from "@/lib/server/follows";
import { useFlag } from "@/lib/use-flag";
import { formatDate } from "@/lib/utils";

type FollowedSeller = Awaited<ReturnType<typeof myFollowedSellers>>[number];

export const Route = createFileRoute("/ayarlar/takip-ettiklerim")({
  head: () => ({ meta: [{ title: "Takip ettiklerim | GeldeSat" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: FollowedSellersPage,
});

function FollowedSellersPage() {
  const followOn = useFlag("satici_takip");
  const { user, isPending } = useCurrentUserState();
  const [items, setItems] = useState<FollowedSeller[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!user || !followOn) return;
    let alive = true;
    myFollowedSellers()
      .then((rows) => {
        if (!alive) return;
        setFailed(false);
        setItems(rows);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [user, attempt, followOn]);

  if (!followOn) {
    return (
      <AccountShell title="Takip ettiklerim">
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <UserCheck className="mx-auto size-10 text-subtle" />
          <p className="mt-3 font-medium">Satıcı takibi şu anda kullanıma kapalı.</p>
          <p className="mt-1 text-sm text-muted">Bu özellik geçici olarak devre dışı bırakıldı.</p>
          <Link to="/ayarlar" className={buttonVariants({ variant: "outline", className: "mt-4" })}>
            Ayarlara dön
          </Link>
        </div>
      </AccountShell>
    );
  }

  if (failed && !items) {
    return (
      <AccountShell title="Takip ettiklerim">
        <ErrorState
          message="Takip ettiğiniz satıcılar yüklenemedi."
          onRetry={() => {
            setFailed(false);
            setAttempt((n) => n + 1);
          }}
        />
      </AccountShell>
    );
  }
  if (isPending || (user && !items)) return <BrandSpinner fullPage text="Yükleniyor…" />;
  if (!user || !items) return <RedirectToSignIn />;

  async function handleUnfollow(seller: FollowedSeller) {
    if (busyId) return;
    setBusyId(seller.id);
    const prev = items;
    setItems((cur) => (cur ?? []).filter((x) => x.id !== seller.id));
    try {
      await unfollowSeller({ data: { sellerId: seller.id } });
      toast.success("Satıcı takipten çıkarıldı");
    } catch (e) {
      setItems(prev);
      toast.error(errorText(e, "İşlem gerçekleştirilemedi"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AccountShell title="Takip ettiklerim" description="Yeni ilan yayınladıklarında bildirim alacağınız satıcılar.">
      {items.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-10 text-center">
          <UserCheck className="mx-auto size-10 text-subtle" />
          <p className="mt-3 font-medium">Henüz takip ettiğiniz bir satıcı yok</p>
          <p className="mt-1 text-sm text-muted">Beğendiğiniz satıcıların ilan veya profil sayfasından “Takip et” butonuna basabilirsiniz.</p>
          <Link to="/search" className={buttonVariants({ className: "mt-4" })}>
            İlanlara göz at
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {items.map((seller) => (
            <li key={seller.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <Link
                to="/satici/$id"
                params={{ id: seller.id }}
                className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-90"
              >
                <UserAvatar src={seller.avatar} name={seller.name} className="size-11 shrink-0 text-sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold">{seller.name}</span>
                    {seller.store_name ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                        <Store className="size-3" />
                        {seller.store_name}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    {seller.active_count} yayında ilan · {formatDate(seller.followed_at)} tarihinden beri
                  </p>
                </div>
              </Link>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busyId === seller.id}
                onClick={() => void handleUnfollow(seller)}
              >
                <UserMinus className="size-4" />
                Takibi bırak
              </Button>
            </li>
          ))}
        </ul>
      )}
    </AccountShell>
  );
}
