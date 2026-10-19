import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, CheckCircle2, Database, HardDrive, Mail, PlayCircle, RefreshCw, Server, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminRunMaintenance, adminSystemInfo } from "@/lib/server/admin/content";
import { useRunner } from "@/components/admin/hooks";
import { bytes, dateTime, n } from "@/components/admin/format";
import { Card, CardHead, ErrorState, PageHeader, Pill, Spinner, StatCard, useConfirm } from "@/components/admin/ui";

export const Route = createFileRoute("/admin/sistem")({
  component: SystemPage,
});

const TABLE_LABEL: Record<string, string> = {
  listings: "İlanlar",
  categories: "Kategoriler",
  attribute_defs: "İlan özellikleri",
  profiles: "Üye profilleri",
  stores: "Mağazalar",
  conversations: "Sohbetler",
  messages: "Mesajlar",
  notifications: "Bildirimler",
  reports: "Şikayetler",
  reviews: "Değerlendirmeler",
  favorites: "Favoriler",
  mobile_listing_images: "İlan fotoğrafları",
  chat_images: "Sohbet fotoğrafları",
  user_avatars: "Profil fotoğrafları",
  mobile_push_tokens: "Mobil cihazlar",
  admin_audit_log: "İşlem kayıtları",
};

function uptime(s: number) {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return d ? `${d} gün ${h} sa` : h ? `${h} sa ${m} dk` : `${m} dk`;
}

function SystemPage() {
  const q = useQuery({ queryKey: ["admin", "system"], queryFn: () => adminSystemInfo(), refetchInterval: 60_000 });
  const { run, busy } = useRunner();
  const { confirm } = useConfirm();

  async function maintenance(task: "expiry" | "retention" | "digest", title: string, body: string) {
    const ok = await confirm({ title, body, confirmLabel: "Şimdi çalıştır" });
    if (ok) await run(() => adminRunMaintenance({ data: { task } }), (r) => r.detail);
  }

  if (q.error) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const d = q.data;

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader
        icon={Activity}
        title="Sistem durumu"
        description="Sunucu, veritabanı ve yapılandırma kontrolleri; bakım görevlerini elle çalıştırma."
        actions={
          <Button size="sm" variant="outline" onClick={() => void q.refetch()} disabled={q.isFetching}>
            <RefreshCw className="size-4" /> Yenile
          </Button>
        }
      />
      {!d ? (
        <Card className="flex items-center justify-center gap-2 py-24 text-sm text-muted">
          <Spinner /> Sistem bilgileri alınıyor…
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Veritabanı boyutu" value={d.database.size ? bytes(d.database.size) : "—"} icon={Database} hint={d.database.source === "postgres" ? "PostgreSQL" : "PGLite (bellek içi)"} tone={d.database.source === "postgres" ? "primary" : "danger"} />
            <StatCard label="Görsel verisi" value={bytes(d.database.imageBytes)} icon={HardDrive} tone="violet" hint="ilan, sohbet, profil fotoğrafları" />
            <StatCard label="Açık oturum" value={n(d.database.sessions)} icon={Server} tone="ok" />
            <StatCard label="Çalışma süresi" value={uptime(d.runtime.uptime)} icon={Activity} hint={`Node ${d.runtime.node} · ${d.runtime.env}`} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHead title="Yapılandırma kontrolleri" description="Ortam değişkenlerinin varlığı (değerler gösterilmez)" />
              <ul className="divide-y divide-border">
                {d.checks.map((c) => (
                  <li key={c.key} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    {c.ok ? <CheckCircle2 className="size-4 text-ok" /> : <XCircle className="size-4 text-danger" />}
                    <span className="flex-1">{c.label}</span>
                    <Pill tone={c.ok ? "ok" : "danger"}>{c.ok ? "Tamam" : "Eksik"}</Pill>
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <CardHead title="Bakım görevleri" description="Normalde zamanlanmış görev (cron) çalıştırır; gerekirse buradan tetikleyin." />
              <ul className="divide-y divide-border">
                {[
                  { task: "expiry" as const, icon: PlayCircle, title: "Süre hatırlatmaları", body: "Süresi dolmak üzere olan ilanların sahiplerine hatırlatma bildirimi gönderir." },
                  { task: "digest" as const, icon: Mail, title: "Okunmamış mesaj e-postaları", body: "Okunmamış mesajı olan üyelere özet e-postası gönderir (SMTP gerekli)." },
                  { task: "retention" as const, icon: Trash2, title: "Hesap ve sohbet temizliği", body: "30 günlük süresi dolan silinmiş hesapları ve saklama süresi biten sohbetleri kalıcı olarak temizler." },
                ].map((m) => (
                  <li key={m.task} className="flex items-center gap-3 px-4 py-3">
                    <m.icon className="size-4 shrink-0 text-muted" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{m.title}</p>
                      <p className="text-xs text-muted">{m.body}</p>
                    </div>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => void maintenance(m.task, `${m.title} çalıştırılsın mı?`, m.body)}>
                      Çalıştır
                    </Button>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <Card>
              <CardHead title="Kayıt sayıları" />
              <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3">
                {Object.entries(d.counts).map(([table, count]) => (
                  <div key={table} className="bg-surface px-4 py-3">
                    <p className="text-[11px] text-muted">{TABLE_LABEL[table] ?? table}</p>
                    <p className="text-lg font-bold tabular-nums">{count < 0 ? "—" : n(count)}</p>
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <CardHead title="Son veritabanı geçişleri (migration)" description={d.database.version} />
              <ul className="divide-y divide-border">
                {d.migrations.map((m) => (
                  <li key={m.name} className="flex items-center justify-between gap-3 px-4 py-2 text-xs">
                    <span className="truncate font-mono">{m.name}</span>
                    <span className="shrink-0 text-muted">{dateTime(m.applied_at)}</span>
                  </li>
                ))}
              </ul>
              <p className="border-t border-border px-4 py-2 text-[11px] text-muted">
                Bellek: {bytes(d.runtime.rss)} (heap {bytes(d.runtime.heapUsed)})
              </p>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
