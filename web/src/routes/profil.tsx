import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CalendarDays, ExternalLink, MapPin, Plus, Settings, Star } from "lucide-react";
import { getMe, myListings } from "@/lib/server/account";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { BrandSpinner } from "@/components/brand/BrandSpinner";
import { Button } from "@/components/ui/button";
import { ListingCard } from "@/components/listing/ListingCard";
import { AccountMenuList, AccountShell, UserAvatar } from "@/components/account/AccountShell";
import type { ListingCard as Listing } from "@/lib/server/helpers";
import { cn, formatNumber } from "@/lib/utils";

export const Route = createFileRoute("/profil")({
  head: () => ({ meta: [{ title: "Hesabım | GeldeSat" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: ProfilePage,
});

type Me = Awaited<ReturnType<typeof getMe>>;

function memberSince(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
}

function isLive(l: Listing) {
  return l.status === "ACTIVE" && !(l.expires_at && new Date(l.expires_at).getTime() <= Date.now());
}

/** Your own profile, as others would see it, plus the account menu on phones. */
function ProfilePage() {
  const { user, isPending } = useCurrentUserState();
  const [me, setMe] = useState<Me | null>(null);
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [tab, setTab] = useState<"live" | "other">("live");

  useEffect(() => {
    if (!user) return;
    let alive = true;
    getMe()
      .then((m) => alive && setMe(m))
      .catch(() => undefined);
    myListings()
      .then((rows) => alive && setListings(rows))
      .catch(() => alive && setListings([]));
    return () => {
      alive = false;
    };
  }, [user]);

  if (isPending || (user && !me)) return <BrandSpinner fullPage text="Hesabınız yükleniyor…" />;
  if (!user || !me) return <RedirectToSignIn />;

  const p = me.profile;
  const name = p?.display_name || user.displayName || "Üye";
  const live = (listings ?? []).filter(isLive);
  const other = (listings ?? []).filter((l) => !isLive(l));
  const shown = tab === "live" ? live : other;

  return (
    <AccountShell
      title="Hesabım"
      hub
      actions={
        <Link to="/ayarlar/profil" aria-label="Ayarlar" className="grid size-10 place-items-center rounded-full hover:bg-elevated md:hidden">
          <Settings className="size-5" />
        </Link>
      }
    >
      <section className="rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-6">
        <div className="flex items-center gap-4 sm:gap-6">
          <UserAvatar src={p?.avatar_url ?? user.profileImageUrl} name={name} className="size-20 text-2xl sm:size-24 sm:text-3xl" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-semibold sm:text-xl">{name}</p>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center sm:max-w-sm sm:text-left">
              <Stat label="Yayında" value={formatNumber(p?.active_count ?? 0)} />
              <Stat label="Toplam ilan" value={formatNumber(p?.listing_count ?? 0)} />
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
          </div>
        </div>

        {p?.bio ? <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{p.bio}</p> : null}
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {p?.city ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" /> {[p.district, p.city].filter(Boolean).join(", ")}
            </span>
          ) : null}
          {p?.created_at ? (
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3.5" /> {memberSince(p.created_at)} tarihinden beri üye
            </span>
          ) : null}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:flex">
          <Link to="/ayarlar/profil" className="sm:w-auto">
            <Button variant="outline" size="sm" className="w-full">
              Profili düzenle
            </Button>
          </Link>
          <Link to="/satici/$id" params={{ id: me.userId }} className="sm:w-auto">
            <Button variant="outline" size="sm" className="w-full">
              <ExternalLink className="size-3.5" /> Herkese açık profil
            </Button>
          </Link>
        </div>

        {!p?.phone ? (
          <Link
            to="/ayarlar/profil"
            className="mt-4 block rounded-xl border border-warn/30 bg-warn/8 px-3 py-2.5 text-sm text-warn hover:bg-warn/12"
          >
            İlan verebilmek için profilinize telefon numarası ekleyin →
          </Link>
        ) : null}
      </section>

      <AccountMenuList className="mt-6 md:hidden" />

      <section className="mt-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="inline-flex rounded-lg bg-elevated p-1" role="tablist" aria-label="İlanlar">
            {(
              [
                ["live", `Yayında (${live.length})`],
                ["other", `Diğer (${other.length})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={cn("h-8 rounded-md px-3 text-sm", tab === key ? "bg-surface font-semibold shadow-xs" : "text-muted hover:text-fg")}
              >
                {label}
              </button>
            ))}
          </div>
          <Link to="/ilanlarim" className="text-sm font-medium text-primary hover:underline">
            İlanlarımı yönet
          </Link>
        </div>

        {listings === null ? (
          <p className="py-10 text-center text-sm text-muted">İlanlar yükleniyor…</p>
        ) : shown.length ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            {shown.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-surface px-6 py-12 text-center">
            <p className="text-sm text-muted">{tab === "live" ? "Yayında ilanınız yok." : "Bekleyen, pasif veya satılmış ilanınız yok."}</p>
            {tab === "live" ? (
              <Link to="/ilan-ver" className="mt-4 inline-block">
                <Button size="sm">
                  <Plus className="size-4" /> Ücretsiz ilan ver
                </Button>
              </Link>
            ) : null}
          </div>
        )}
      </section>
    </AccountShell>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col-reverse">
      <dt className="truncate text-xs text-muted">{label}</dt>
      <dd className="text-base font-semibold tabular-nums sm:text-lg">{value}</dd>
    </div>
  );
}
