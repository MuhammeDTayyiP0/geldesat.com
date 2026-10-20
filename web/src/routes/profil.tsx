import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronRight, Rocket, Settings, Star, Store } from "lucide-react";
import { getMe } from "@/lib/server/account";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
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
  const { user, isPending } = useCurrentUserState();
  const [me, setMe] = useState<Me | null>(null);
  const { counts } = useAccountMeta();

  useEffect(() => {
    if (!user) return;
    let alive = true;
    getMe()
      .then((m) => alive && setMe(m))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [user]);

  if (!isPending && !user) return <RedirectToSignIn />;

  const p = me?.profile;
  const name = p?.display_name || user?.displayName || "Üye";

  return (
    <AccountShell title="Hesabım" hub>
      <section className="rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-5">
        {!me || !user ? (
          <div className="flex items-center gap-4" aria-busy>
            <Skeleton className="size-16 rounded-full bg-border/60" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-40 rounded bg-border/70" />
              <Skeleton className="h-4 w-56 max-w-full rounded bg-border/50" />
            </div>
          </div>
        ) : (
          <>
            <Link to="/satici/$id" params={{ id: me.userId }} className="group flex items-center gap-4">
              <UserAvatar src={p?.avatar_url ?? user.profileImageUrl} name={name} className="size-16 text-2xl" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-lg font-semibold">{name}</span>
                <span className="block truncate text-sm text-muted">{user.primaryEmail}</span>
                <span className="mt-0.5 inline-flex items-center text-sm font-medium text-primary group-hover:underline">
                  Profilimi gör <ChevronRight className="size-4" />
                </span>
              </span>
            </Link>
            <dl className="mt-4 grid grid-cols-3 divide-x divide-border rounded-xl bg-elevated/60 py-2.5 text-center">
              <Stat label="Yayında" value={formatNumber(p?.active_count ?? 0)} />
              <Stat label="Favori" value={formatNumber(p?.favorite_count ?? 0)} />
              <Stat
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
        <MenuRows items={ACCOUNT_ITEMS.filter((i) => i.to !== "/profil")} counts={counts} />

        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {me?.store ? (
            <HubRow to="/ayarlar/magaza" icon={<Store className="size-4.5" />} label="Mağazam" hint={me.store.name} />
          ) : null}
          <HubRow to="/doping" icon={<Rocket className="size-4.5" />} label="Doping" hint="İlanınızı öne çıkarın" />
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

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col-reverse px-1">
      <dt className="truncate text-xs text-muted">{label}</dt>
      <dd className="text-base font-semibold tabular-nums sm:text-lg">{value}</dd>
    </div>
  );
}
