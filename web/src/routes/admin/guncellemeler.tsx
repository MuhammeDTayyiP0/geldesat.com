import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, History, Pause, Percent, Play, Rocket, Smartphone, Undo2 } from "lucide-react";
import { adminListOtaUpdates, adminRepublishOta, adminRollbackOtaToEmbedded, adminSetOtaRollout, type AdminOtaUpdate } from "@/lib/server/admin/ota";
import { useRunner } from "@/components/admin/hooks";
import { bytes, dateTime, relative } from "@/components/admin/format";
import { Card, CardHead, EmptyState, ErrorState, Menu, MenuItem, MenuLabel, MenuSeparator, PageHeader, Pill, SkeletonRows, Table, Td, Th, useConfirm } from "@/components/admin/ui";

export const Route = createFileRoute("/admin/guncellemeler")({
  component: OtaPage,
});

const PLATFORM_LABEL = { ios: "iOS", android: "Android" } as const;

function OtaPage() {
  const q = useQuery({ queryKey: ["admin", "ota"], queryFn: () => adminListOtaUpdates() });
  const { run } = useRunner();
  const { confirm, prompt } = useConfirm();

  // The update each runtime/channel is currently serving at 100% (newest first).
  const live = new Set<string>();
  const seen = new Set<string>();
  for (const u of q.data?.updates ?? []) {
    const lane = `${u.runtimeVersion}|${u.channel}`;
    if (seen.has(lane) || u.rollout < 100) continue;
    seen.add(lane);
    live.add(u.groupId);
  }

  async function setRollout(u: AdminOtaUpdate) {
    const value = await prompt({
      title: "Yayılım yüzdesi",
      body: "Bu güncellemeyi cihazların yüzde kaçı alsın? Aynı cihaz hep aynı sonucu alır; yüzdeyi artırınca önceden alanlar almaya devam eder.",
      label: "Yüzde (0-100)",
      presets: ["1", "5", "10", "25", "50", "100"],
      defaultValue: String(u.rollout),
      required: true,
      multiline: false,
    });
    if (value == null) return;
    const rollout = Math.round(Number(value.replace("%", "")));
    if (!Number.isFinite(rollout) || rollout < 0 || rollout > 100) return;
    await run(() => adminSetOtaRollout({ data: { groupId: u.groupId, rollout } }), `Yayılım %${rollout} yapıldı.`);
  }

  async function pause(u: AdminOtaUpdate) {
    const ok = await confirm({
      title: "Güncelleme durdurulsun mu?",
      body: "Henüz almamış cihazlara gönderilmez. Zaten indirmiş cihazlar bu sürümde kalır; onları geri almak için daha eski bir güncellemede “Bu sürüme geri dön”ü kullanın.",
      confirmLabel: "Durdur",
    });
    if (ok) await run(() => adminSetOtaRollout({ data: { groupId: u.groupId, rollout: 0 } }), "Güncelleme durduruldu.");
  }

  async function republish(u: AdminOtaUpdate) {
    const ok = await confirm({
      title: "Bu sürüme geri dönülsün mü?",
      body: "Bu güncellemenin bir kopyası en yeni güncelleme olarak herkese yayınlanır. Telefonlar uygulamayı bir sonraki açışlarında bu koda döner.",
      confirmLabel: "Geri dön",
    });
    if (ok) await run(() => adminRepublishOta({ data: { groupId: u.groupId } }), "Eski sürüm yeniden yayınlandı.");
  }

  async function toEmbedded(u: AdminOtaUpdate) {
    const ok = await confirm({
      title: "Mağaza sürümüne dönülsün mü?",
      body: `${u.runtimeVersion} sürümündeki (${u.channel}) tüm telefonlar, mağazadan yüklenen uygulamanın kendi koduna döner. Tüm OTA güncellemeleri devre dışı kalır; yeni bir güncelleme yayınlayınca tekrar başlar.`,
      confirmLabel: "Mağaza sürümüne dön",
      danger: true,
    });
    if (ok) await run(() => adminRollbackOtaToEmbedded({ data: { runtimeVersion: u.runtimeVersion, channel: u.channel, platforms: u.platforms } }), "Telefonlar mağaza sürümüne döndürülüyor.");
  }

  return (
    <div className="mx-auto max-w-[1100px] space-y-4">
      <PageHeader
        icon={Rocket}
        title="Uygulama güncellemeleri"
        description="Mağaza onayı beklemeden yayınlanan mobil uygulama güncellemeleri (OTA). Telefonlar yeni kodu açılışta indirir, bir sonraki açılışta kullanır."
      />

      {q.data && !q.data.publishingEnabled ? (
        <Card className="border-warn/40">
          <div className="flex gap-3 p-4 text-sm">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warn" />
            <div>
              <p className="font-semibold">Yayınlama kapalı</p>
              <p className="mt-1 text-muted">
                Coolify'da web servisine en az 24 karakterlik bir <code className="font-mono">OTA_PUBLISH_TOKEN</code> ortam değişkeni ekleyin. Aynı değeri bilgisayarınızda{" "}
                <code className="font-mono">GELDESAT_OTA_TOKEN</code> olarak tanımlayınca <code className="font-mono">mobile-app</code> klasöründe{" "}
                <code className="font-mono">npm run ota -- --message "…"</code> ile güncelleme yayınlayabilirsiniz.
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      <Card>
        <CardHead title="Yayınlanan güncellemeler" description="En yenisi üstte. Her telefon, kendi sürümü ve kanalı için alabileceği en yeni güncellemeyi kullanır." />
        {q.error ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        ) : !q.data ? (
          <SkeletonRows rows={4} />
        ) : !q.data.updates.length ? (
          <EmptyState
            icon={Smartphone}
            title="Henüz güncelleme yok"
            description={
              <>
                <code className="font-mono">mobile-app</code> klasöründe <code className="font-mono">npm run ota -- --message "Ne değişti?"</code> komutu ilk güncellemeyi yayınlar.
              </>
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Güncelleme</Th>
                <Th>Uygulama sürümü</Th>
                <Th>Platform</Th>
                <Th>Yayılım</Th>
                <Th>Boyut</Th>
                <Th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {q.data.updates.map((u) => (
                <tr key={u.groupId} className="hover:bg-elevated/40">
                  <Td>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">{u.kind === "rollback" ? "Mağaza sürümüne dönüş" : u.message || "Açıklamasız güncelleme"}</span>
                      {live.has(u.groupId) ? <Pill tone="ok" dot>Yayında</Pill> : null}
                      {u.critical ? <Pill tone="danger">Kritik</Pill> : null}
                      {u.republishedFrom ? <Pill tone="violet">Geri dönüş</Pill> : null}
                    </div>
                    <p className="mt-0.5 text-xs text-muted" title={dateTime(u.createdAt)}>
                      {relative(u.createdAt)}
                      {u.createdBy ? ` · ${u.createdBy}` : ""}
                    </p>
                  </Td>
                  <Td>
                    <span className="font-mono text-xs">{u.runtimeVersion}</span>
                    <span className="ml-1.5 text-xs text-muted">{u.channel}</span>
                  </Td>
                  <Td className="text-xs">{u.platforms.map((p) => PLATFORM_LABEL[p]).join(" · ")}</Td>
                  <Td>
                    {u.kind === "rollback" ? (
                      <Pill>Herkes</Pill>
                    ) : u.rollout >= 100 ? (
                      <Pill tone="ok">%100</Pill>
                    ) : u.rollout <= 0 ? (
                      <Pill tone="muted">Durduruldu</Pill>
                    ) : (
                      <Pill tone="warn">%{u.rollout}</Pill>
                    )}
                  </Td>
                  <Td className="text-xs tabular-nums text-muted">{u.kind === "rollback" ? "—" : bytes(u.bytes)}</Td>
                  <Td>
                    <Menu>
                      {u.kind === "update" ? (
                        <>
                          <MenuLabel>Yayılım</MenuLabel>
                          <MenuItem icon={Percent} onSelect={() => void setRollout(u)}>
                            Yüzdeyi değiştir
                          </MenuItem>
                          {u.rollout < 100 ? (
                            <MenuItem icon={Play} onSelect={() => void run(() => adminSetOtaRollout({ data: { groupId: u.groupId, rollout: 100 } }), "Güncelleme herkese açıldı.")}>
                              Herkese aç (%100)
                            </MenuItem>
                          ) : null}
                          {u.rollout > 0 ? (
                            <MenuItem icon={Pause} onSelect={() => void pause(u)}>
                              Durdur
                            </MenuItem>
                          ) : null}
                          <MenuSeparator />
                          <MenuItem icon={History} onSelect={() => void republish(u)}>
                            Bu sürüme geri dön
                          </MenuItem>
                        </>
                      ) : null}
                      <MenuItem icon={Undo2} danger onSelect={() => void toEmbedded(u)}>
                        Herkesi mağaza sürümüne döndür
                      </MenuItem>
                    </Menu>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
