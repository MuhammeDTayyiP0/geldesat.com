import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  AlertTriangle,
  BarChart3,
  Check,
  Clock,
  CreditCard,
  Eye,
  LayoutList,
  MessageCircle,
  MessageSquareWarning,
  Store,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { photoSrc } from "@/lib/images";
import { adminDashboard } from "@/lib/server/admin/dashboard";
import { useListingActions, useSheets } from "@/components/admin/hooks";
import { age, delta, LISTING_STATUS, money, n, nCompact, relative } from "@/components/admin/format";
import { AuditList } from "@/components/admin/AuditList";
import { Avatar, Card, CardHead, EmptyState, ErrorState, PageHeader, Pill, Segmented, StatCard, Thumb } from "@/components/admin/ui";

export const Route = createFileRoute("/admin/")({
  component: Dashboard,
});

const SERIES = {
  listings: { label: "Yeni ilan" },
  users: { label: "Yeni üye" },
  messages: { label: "Mesaj" },
  reports: { label: "Şikayet" },
} as const;
type SeriesKey = keyof typeof SERIES;

const BAR = "#2a78d6";

function Dashboard() {
  const q = useQuery({ queryKey: ["admin", "dashboard"], queryFn: () => adminDashboard(), refetchInterval: 120_000 });
  const { openListing, openUser } = useSheets();
  const { act, busy } = useListingActions();
  const [series, setSeries] = useState<SeriesKey>("listings");

  const chart = useMemo(
    () =>
      (q.data?.series ?? []).map((d) => ({
        ...d,
        label: new Date(`${d.day}T12:00:00`).toLocaleDateString("tr-TR", { day: "numeric", month: "short" }),
      })),
    [q.data],
  );

  if (q.error) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const d = q.data;
  const k = d?.kpi ?? {};
  const seriesTotal = chart.reduce((sum, r) => sum + r[series], 0);
  const maxRoot = Math.max(1, ...(d?.byRoot ?? []).map((r) => r.active));
  const maxCity = Math.max(1, ...(d?.byCity ?? []).map((r) => r.n));
  const statusTotal = Object.values(d?.byStatus ?? {}).reduce((a, b) => a + b, 0) || 1;

  const alerts: Array<{ tone: "warn" | "danger" | "primary"; text: string; to: "/admin/moderasyon" | "/admin/sikayetler" | "/admin/finans" }> = [];
  if (k.listings_pending) {
    alerts.push({
      tone: "warn",
      text: `${n(k.listings_pending)} ilan onay bekliyor${d?.oldestPendingAt ? `; en eskisi ${age(d.oldestPendingAt)}dır bekliyor` : ""}.`,
      to: "/admin/moderasyon",
    });
  }
  if (k.reports_open) alerts.push({ tone: "danger", text: `${n(k.reports_open)} açık şikayet incelenmeyi bekliyor.`, to: "/admin/sikayetler" });
  if (k.orders_pending) alerts.push({ tone: "primary", text: `${n(k.orders_pending)} havale bildirimi onay bekliyor.`, to: "/admin/finans" });

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        icon={BarChart3}
        title="Kontrol paneli"
        description={`Platformun anlık durumu · ${new Date().toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" })}`}
        actions={
          <Button size="sm" variant="outline" onClick={() => void q.refetch()} disabled={q.isFetching}>
            {q.isFetching ? "Yenileniyor…" : "Yenile"}
          </Button>
        }
      />

      {alerts.length ? (
        <div className="mb-5 grid gap-2 md:grid-cols-3">
          {alerts.map((a) => (
            <Link
              key={a.to}
              to={a.to}
              className={
                a.tone === "danger"
                  ? "flex items-center gap-2.5 rounded-xl border border-danger/20 bg-danger/5 px-3.5 py-2.5 text-sm text-danger hover:bg-danger/10"
                  : a.tone === "warn"
                    ? "flex items-center gap-2.5 rounded-xl border border-warn/25 bg-warn/5 px-3.5 py-2.5 text-sm text-warn hover:bg-warn/10"
                    : "flex items-center gap-2.5 rounded-xl border border-primary/20 bg-primary/5 px-3.5 py-2.5 text-sm text-primary hover:bg-primary/10"
              }
            >
              <AlertTriangle className="size-4 shrink-0" />
              <span className="flex-1 font-medium">{a.text}</span>
              <span className="text-xs font-semibold underline-offset-2 hover:underline">Git →</span>
            </Link>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Yayındaki ilan" value={d ? n(k.listings_live) : "—"} icon={LayoutList} tone="ok" hint={`${n(k.listings_total)} toplam`} />
        <StatCard
          label="Bugün eklenen ilan"
          value={d ? n(k.listings_today) : "—"}
          icon={BarChart3}
          trend={d ? delta(k.listings_7d, k.listings_prev_7d) : null}
          hint="7 günlük değişim"
        />
        <StatCard label="Onay bekleyen" value={d ? n(k.listings_pending) : "—"} icon={Clock} tone="warn" hint={d?.oldestPendingAt ? `en eski ${age(d.oldestPendingAt)}` : "kuyruk boş"} />
        <StatCard label="Kayıtlı üye" value={d ? n(k.users_total) : "—"} icon={Users} tone="primary" trend={d ? delta(k.users_7d, k.users_prev_7d) : null} hint={`bugün +${n(k.users_today)}`} />
        <StatCard label="Son 24 saatte aktif" value={d ? n(k.users_active_24h) : "—"} icon={UserPlus} tone="violet" hint={`${n(k.users_banned)} askıda`} />
        <StatCard
          label="Bugünkü mesaj"
          value={d ? n(k.messages_today) : "—"}
          icon={MessageCircle}
          tone="primary"
          trend={d ? delta(k.messages_7d, k.messages_prev_7d) : null}
          hint="7 günlük değişim"
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHead
            title={`Son 30 gün · ${SERIES[series].label}`}
            description={`Toplam ${n(seriesTotal)} · günlük ortalama ${n(Math.round(seriesTotal / Math.max(1, chart.length)))}`}
            actions={
              <Segmented
                value={series}
                onChange={setSeries}
                items={(Object.keys(SERIES) as SeriesKey[]).map((key) => ({ value: key, label: SERIES[key].label }))}
              />
            }
          />
          <div className="h-72 px-2 pb-3 pt-4">
            {d ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart} margin={{ top: 4, right: 12, left: -12, bottom: 0 }} barCategoryGap={2}>
                  <CartesianGrid vertical={false} stroke="#e7ebf0" />
                  <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "#d8dee6" }} tick={{ fontSize: 11, fill: "#8a929e" }} interval="preserveStartEnd" minTickGap={18} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#8a929e" }} width={40} />
                  <Tooltip
                    cursor={{ fill: "rgba(42,120,214,0.08)" }}
                    contentStyle={{ borderRadius: 10, border: "1px solid #d8dee6", fontSize: 12, boxShadow: "0 8px 24px -12px rgba(13,17,23,.25)" }}
                    labelStyle={{ fontWeight: 600, color: "#12151c" }}
                    formatter={(value) => [n(Number(value)), SERIES[series].label]}
                  />
                  <Bar dataKey={series} fill={BAR} radius={[4, 4, 0, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="size-full animate-pulse rounded-lg bg-elevated" />
            )}
          </div>
        </Card>

        <Card>
          <CardHead title="İlan durumları" description="Tüm ilanların dağılımı" />
          <ul className="space-y-3 p-4">
            {Object.entries(LISTING_STATUS)
              .filter(([key]) => key !== "EXPIRED")
              .map(([key, meta]) => {
                const value = d?.byStatus[key] ?? 0;
                return (
                  <li key={key}>
                    <Link to="/admin/ilanlar" search={{ status: key as "ACTIVE" }} className="group block">
                      <div className="flex items-center justify-between text-sm">
                        <Pill tone={meta.tone} dot>
                          {meta.label}
                        </Pill>
                        <span className="font-semibold tabular-nums group-hover:text-primary">{n(value)}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-elevated">
                        <div className="h-full rounded-full bg-[#2a78d6]" style={{ width: `${(value / statusTotal) * 100}%` }} />
                      </div>
                    </Link>
                  </li>
                );
              })}
            <li className="flex items-center justify-between border-t border-border pt-3 text-xs text-muted">
              <span>Süresi dolmuş (yayında görünmeyen)</span>
              <span className="font-semibold tabular-nums text-fg">{n(k.listings_expired)}</span>
            </li>
          </ul>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHead
            title="Onay bekleyen ilanlar"
            description="En uzun bekleyenden başlayarak"
            actions={
              <Link to="/admin/moderasyon" className="text-xs font-semibold text-primary hover:underline">
                Kuyruğa git →
              </Link>
            }
          />
          {d && !d.pending.length ? (
            <EmptyState icon={Check} title="Kuyruk boş" description="Onay bekleyen ilan yok." />
          ) : (
            <ul className="divide-y divide-border">
              {(d?.pending ?? []).map((l) => (
                <li key={l.id} className="flex items-center gap-3 px-4 py-2.5">
                  <button type="button" onClick={() => openListing(l.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <Thumb src={l.cover ? photoSrc(l.cover, 240) : null} className="size-11" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium hover:text-primary">{l.title}</p>
                      <p className="truncate text-xs text-muted">
                        {l.category_name} · {money(l.price, l.currency)} · {l.seller_name} · <span className="font-medium text-warn">{age(l.created_at)}</span>
                      </p>
                    </div>
                  </button>
                  <div className="flex shrink-0 gap-1">
                    <Button size="sm" className="h-8 bg-ok px-2.5 text-white hover:bg-ok/90" disabled={busy} onClick={() => void act([l.id], "approve", l.title)} aria-label="Onayla">
                      <Check className="size-4" />
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 px-2.5 text-danger" disabled={busy} onClick={() => void act([l.id], "reject", l.title)} aria-label="Reddet">
                      <X className="size-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHead title="Haftalık etkileşim" />
          <div className="grid grid-cols-2 gap-px bg-border">
            {[
              { label: "Yeni sohbet", value: k.conversations_7d, icon: MessageCircle },
              { label: "Telefon gösterimi", value: k.phone_reveals_7d, icon: Eye },
              { label: "Favoriye ekleme", value: k.favorites_7d, icon: Check },
              { label: "Yeni şikayet", value: k.reports_7d, icon: MessageSquareWarning },
              { label: "Mağaza", value: k.stores_total, icon: Store },
              { label: "Bekleyen havale", value: k.orders_pending, icon: CreditCard },
            ].map((item) => (
              <div key={item.label} className="bg-surface p-4">
                <item.icon className="size-4 text-muted" />
                <div className="mt-2 text-xl font-bold tabular-nums">{d ? nCompact(item.value) : "—"}</div>
                <div className="text-[11px] text-muted">{item.label}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHead title="Ana kategoriler" description="Yayındaki ilan sayısına göre" />
          <ul className="space-y-2.5 p-4">
            {(d?.byRoot ?? []).map((r) => (
              <li key={r.id} title={`${r.name}: ${n(r.active)} yayında, ${n(r.total)} toplam`}>
                <Link to="/admin/ilanlar" search={{ categoryId: r.id }} className="group block">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate group-hover:text-primary">{r.name}</span>
                    <span className="shrink-0 tabular-nums text-muted">
                      <span className="font-semibold text-fg">{n(r.active)}</span> / {n(r.total)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-elevated">
                    <div className="h-full rounded-full bg-[#2a78d6]" style={{ width: `${(r.active / maxRoot) * 100}%` }} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHead title="En çok ilan olan iller" description="Yayındaki ilanlar" />
          {d && !d.byCity.length ? (
            <EmptyState title="Henüz veri yok" />
          ) : (
            <ul className="space-y-2.5 p-4">
              {(d?.byCity ?? []).map((c, i) => (
                <li key={c.city} title={`${c.city}: ${n(c.n)} ilan`}>
                  <Link to="/admin/ilanlar" search={{ city: c.city }} className="group block">
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="group-hover:text-primary">
                        <span className="mr-2 inline-block w-4 text-right text-xs tabular-nums text-subtle">{i + 1}</span>
                        {c.city}
                      </span>
                      <span className="font-semibold tabular-nums">{n(c.n)}</span>
                    </div>
                    <div className="ml-6 mt-1 h-1.5 overflow-hidden rounded-full bg-elevated">
                      <div className="h-full rounded-full bg-[#2a78d6]" style={{ width: `${(c.n / maxCity) * 100}%` }} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-2 xl:col-span-1">
          <CardHead
            title="Yeni üyeler"
            actions={
              <Link to="/admin/kullanicilar" className="text-xs font-semibold text-primary hover:underline">
                Tümü →
              </Link>
            }
          />
          <ul className="divide-y divide-border">
            {(d?.recentUsers ?? []).map((u) => (
              <li key={u.user_id}>
                <button type="button" onClick={() => openUser(u.user_id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-elevated/60">
                  <Avatar name={u.display_name} src={u.avatar_url} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{u.display_name}</p>
                    <p className="truncate text-xs text-muted">{u.email ?? u.city ?? "—"}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-muted">{relative(u.created_at)}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHead
          title="Son yönetici işlemleri"
          actions={
            <Link to="/admin/kayitlar" className="text-xs font-semibold text-primary hover:underline">
              Tüm kayıtlar →
            </Link>
          }
        />
        <div className="p-4">
          <AuditList entries={d?.recentAudit ?? []} empty="Henüz kayıtlı yönetici işlemi yok." />
        </div>
      </Card>
    </div>
  );
}
