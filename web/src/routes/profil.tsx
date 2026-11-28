import { ErrorState } from "@/components/common/ErrorState";
import { useFlag } from "@/lib/use-flag";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronRight, LayoutGrid, MessageCircle, Pencil, PlusCircle, Rocket, Settings, Star, Store } from "lucide-react";
import { getMe } from "@/lib/server/account";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AccountShell, MenuRows, UserAvatar } from "@/components/account/AccountShell";
import { ACCOUNT_ITEMS, useAccountMeta } from "@/components/account/account-nav";
import { formatNumber } from "@/lib/utils";

export const Route = createFileRoute("/profil")({
  head: () => ({ meta: [{ title: "Hesabım | GeldeSat" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: AccountHub,
});

type Me = Awaited<ReturnType<typeof getMe>>;

/**
 * "Hesabım": only a menu of your own things. What others see lives on the
 * public profile (/satici/$id, "Profilimi gör"); editing lives under /ayarlar.
 */
function AccountHub() {
  const dopingOn = useFlag("doping_enabled");
  const { user, isPending } = useCurrentUserState();
  const [me, setMe] = useState<Me | null>(null);
  const { counts } = useAccountMeta();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    setFailed(false);
    getMe()
      .then((m) => alive && setMe(m))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [user, attempt]);

  if (!isPending && !user) return <RedirectToSignIn />;

  const p = me?.profile;
  const name = p?.display_name || user?.displayName || "Üye";

  return (
    <AccountShell title="Hesabım" hub>
      <section className="rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-5">
        {failed ? (
          <ErrorState message="Profil bilgileriniz yüklenemedi." onRetry={() => setAttempt((n) => n + 1)} />
        ) : !me || !user ? (
          <div className="flex items-center gap-4" aria-busy>
            <Skeleton className="size-16 rounded-full bg-border/60" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-40 rounded bg-border/70" />
              <Skeleton className="h-4 w-56 max-w-full rounded bg-border/50" />
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-4">
              <Link to="/satici/$id" params={{ id: me.userId }} className="group flex min-w-0 flex-1 items-center gap-4">
                <UserAvatar src={p?.avatar_url ?? user.profileImageUrl} name={name} className="size-16 text-2xl" />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-lg font-semibold">{name}</span>
                    <Badge tone={me.profile?.account_type === "CORPORATE" ? "primary" : "muted"}>
                      {me.profile?.account_type === "CORPORATE" ? "Kurumsal" : "Bireysel"}
                    </Badge>
                  </span>
                  <span className="block truncate text-sm text-muted">{user.primaryEmail}</span>
                  <span className="mt-0.5 inline-flex items-center text-sm font-medium text-primary group-hover:underline">
                    Profilimi gör <ChevronRight className="size-4" />
                  </span>
                </span>
              </Link>
              <Link to="/ayarlar/profil" className={buttonVariants({ variant: "outline", size: "sm", className: "shrink-0 gap-1.5" })}>
                <Pencil className="size-3.5" /> Düzenle
              </Link>
            </div>
            <dl className="mt-4 grid grid-cols-3 divide-x divide-border rounded-xl bg-elevated/60 text-center">
              <StatLink
                to="/ilanlarim"
                label={!me.store && me.listingLimit ? `Yayında (${me.listingLimit.used}/${me.listingLimit.max})` : "Yayında"}
                value={formatNumber(p?.active_count ?? 0)}
              />
              <StatLink to="/favoriler" label="Favori" value={formatNumber(p?.favorite_count ?? 0)} />
              <StatLink
                to="/satici/$id"
                params={{ id: me.userId }}
                label={p?.rating_count ? `${p.rating_count} değerlendirme` : "Puan"}
                value={
                  p?.rating_count ? (
                    <span className="inline-flex items-center gap-1">
                      <Star className="size-4 fill-amber-400 text-amber-400" /> {p.rating_avg.toFixed(1)}
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
            </dl>
          </>
        )}
        {me && !p?.phone ? (
          <Link
            to="/ayarlar/profil"
            className="mt-3 block rounded-xl border border-warn/30 bg-warn/8 px-3 py-2.5 text-sm text-warn hover:bg-warn/12"
          >
            İlan verebilmek için profilinize telefon numarası ekleyin →
          </Link>
        ) : null}
      </section>

      <div className="mt-4 space-y-4">
        <div className="md:hidden">
          <MenuRows items={ACCOUNT_ITEMS.filter((i) => i.to !== "/profil")} counts={counts} />
        </div>

        <div className="hidden md:grid md:grid-cols-2 md:gap-3">
          <QuickCard to="/ilan-ver" icon={<PlusCircle className="size-5" />} label="Yeni ilan ver" hint="Hızlıca yeni ilan oluştur" />
          <QuickCard to="/ilanlarim" icon={<LayoutGrid className="size-5" />} label="İlanlarım" hint="Yayındaki, bekleyen ve pasif ilanlar" />
          <QuickCard
            to="/mesajlar"
            icon={<MessageCircle className="size-5" />}
            label="Mesajlar"
            hint="Alıcı ve satıcılarla yazışmalar"
            badge={counts.messages}
          />
          <QuickCard to="/ayarlar" icon={<Settings className="size-5" />} label="Ayarlar" hint="Profil, güvenlik, gizlilik, bildirimler" />
        </div>

        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {me?.store ? (
            <HubRow to="/ayarlar/magaza" icon={<Store className="size-4.5" />} label="Mağazam" hint={me.store.name} />
          ) : (
            <HubRow
              to="/ayarlar/magaza"
              icon={<Store className="size-4.5" />}
              label="Kurumsal Hesaba Geç"
              hint="İşletme başvurusu ile mağaza vitrini ve yüksek ilan limiti"
            />
          )}
          {dopingOn ? <HubRow to="/doping" icon={<Rocket className="size-4.5" />} label="Doping" hint="İlanınızı öne çıkarın" /> : null}
        </ul>

        {/* On phones the account sidebar is hidden, so settings get their own row. */}
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface md:hidden">
          <HubRow to="/ayarlar" icon={<Settings className="size-4.5" />} label="Ayarlar" hint="Profil, güvenlik, bildirimler, çıkış" />
        </ul>
      </div>
    </AccountShell>
  );
}

function HubRow({ to, icon, label, hint }: { to: "/ayarlar/magaza" | "/doping" | "/ayarlar"; icon: React.ReactNode; label: string; hint: string }) {
  return (
    <li>
      <Link to={to} className="flex min-h-14 items-center gap-3 px-4 py-2.5 hover:bg-elevated/60 active:bg-elevated">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium">{label}</span>
          <span className="block truncate text-xs text-muted">{hint}</span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-subtle" />
      </Link>
    </li>
  );
}

function QuickCard({
  to,
  icon,
  label,
  hint,
  badge = 0,
}: {
  to: "/ilan-ver" | "/ilanlarim" | "/mesajlar" | "/ayarlar";
  icon: React.ReactNode;
  label: string;
  hint: string;
  badge?: number;
}) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card transition-colors hover:bg-elevated/60">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block truncate text-xs text-muted">{hint}</span>
      </span>
      {badge > 0 ? (
        <span className="min-w-5 rounded-full bg-primary-solid px-1.5 text-center text-[11px] font-bold leading-5 text-primary-fg">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : (
        <ChevronRight className="size-4 shrink-0 text-subtle" />
      )}
    </Link>
  );
}

function StatLink({
  to,
  params,
  label,
  value,
}: {
  to: "/ilanlarim" | "/favoriler" | "/satici/$id";
  params?: { id: string };
  label: string;
  value: React.ReactNode;
}) {
  const inner = (
    <div className="flex min-w-0 flex-col-reverse px-1 py-2.5 transition-colors hover:bg-elevated">
      <dt className="truncate text-xs text-muted">{label}</dt>
      <dd className="text-base font-semibold tabular-nums sm:text-lg">{value}</dd>
    </div>
  );
  return params ? (
    <Link to={to} params={params} className="block first:rounded-l-xl last:rounded-r-xl">
      {inner}
    </Link>
  ) : (
    <Link to={to} className="block first:rounded-l-xl last:rounded-r-xl">
      {inner}
    </Link>
  );
}
