import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronDown, ChevronUp, History, Pause, Percent, Play, RefreshCw, Rocket, Smartphone, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { adminListOtaUpdates, adminRepublishOta, adminRollbackOtaToEmbedded, adminSetOtaRollout, type AdminOtaUpdate } from "@/lib/server/admin/ota";
import { useRunner } from "@/components/admin/hooks";
import { bytes, dateTime, relative } from "@/components/admin/format";
import { Card, CardHead, EmptyState, ErrorState, Menu, MenuItem, MenuLabel, MenuSeparator, PageHeader, Pill, SearchInput, Segmented, SkeletonRows, Table, Td, Th, useConfirm } from "@/components/admin/ui";

export const Route = createFileRoute("/admin/guncellemeler")({
  component: OtaPage,
});

const PLATFORM_LABEL = { ios: "iOS", android: "Android" } as const;

function OtaPage() {
  const q = useQuery({ queryKey: ["admin", "ota"], queryFn: () => adminListOtaUpdates() });
  const { run, busy } = useRunner();
  const { confirm, prompt } = useConfirm();
  const [platformFilter, setPlatformFilter] = useState<"all" | "ios" | "android">("all");
  const [fatalOnly, setFatalOnly] = useState(false);
  const [errorQuery, setErrorQuery] = useState("");
  const [selectedUpdateFilter, setSelectedUpdateFilter] = useState<{ label: string; ids: string[] } | null>(null);
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());

  const filteredErrors = useMemo(() => {
    const errors = q.data?.recentErrors ?? [];
    const needle = errorQuery.trim().toLocaleLowerCase("tr");
    const allowedIds = selectedUpdateFilter ? new Set(selectedUpdateFilter.ids.map((id) => id.toLowerCase())) : null;
    return errors.filter((e) => {
      if (platformFilter !== "all" && e.platform !== platformFilter) return false;
      if (fatalOnly && !e.fatal) return false;
      if (allowedIds && (!e.updateId || !allowedIds.has(e.updateId.toLowerCase()))) return false;
      if (needle) {
        const hay = [e.message, e.stack, e.screen, e.deviceId, e.updateId, e.appVersion]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase("tr");
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [q.data?.recentErrors, platformFilter, fatalOnly, selectedUpdateFilter, errorQuery]);

  function toggleErrorStack(id: string) {
    setExpandedErrors((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  // The update each runtime/channel is currently serving at 100% (newest first).
  const live = new Set<string>();
  const seen = new Set<string>();
  for (const u of q.data?.updates ?? []) {
    if (u.rollout < 100) continue;
    // Platforms update separately: a new Android build must not hide the iOS one still serving.
    for (const platform of u.platforms) {
      const lane = `${u.runtimeVersion}|${u.channel}|${platform}`;
      if (seen.has(lane)) continue;
      seen.add(lane);
      live.add(u.groupId);
    }
  }

  /** Phones keep what they download, so widening is the step that cannot be taken back. */
  async function openToAll(u: AdminOtaUpdate) {
    const ok = await confirm({
      title: "Güncelleme herkese açılsın mı?",
      body: "Tüm telefonlar bir sonraki açılışta indirir. İndirenler kodu tutar; geri dönmek için yeniden yayın gerekir.",
      confirmLabel: "Herkese aç",
      danger: true,
    });
    if (ok) await run(() => adminSetOtaRollout({ data: { groupId: u.groupId, rollout: 100 } }), "Güncelleme herkese açıldı.");
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
    const raw = value.replace(/%/g, "").trim();
    const rollout = raw && /^\d+$/.test(raw) ? Number(raw) : Number.NaN;
    if (!Number.isFinite(rollout) || rollout < 0 || rollout > 100) {
      toast.error("0 ile 100 arasında bir tam sayı girin.");
      return;
    }
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
    if (ok) await run(() => adminRollbackOtaToEmbedded({ data: { runtimeVersion: u.runtimeVersion, channel: u.channel } }), "Telefonlar mağaza sürümüne döndürülüyor.");
  }

  return (
    <div className="mx-auto max-w-[1100px] space-y-4">
      <PageHeader
        icon={Rocket}
        title="Uygulama güncellemeleri"
        description="Mağaza onayı beklemeden yayınlanan mobil uygulama güncellemeleri (OTA). Telefonlar yeni kodu açılışta indirir, bir sonraki açılışta kullanır."
        actions={
          <Button size="sm" variant="outline" onClick={() => void q.refetch()} disabled={q.isFetching}>
            <RefreshCw className={cn("size-4", q.isFetching && "animate-spin")} /> Yenile
          </Button>
        }
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
        {q.error && !q.data ? (
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
                <Th>Hata raporu</Th>
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
                  <Td className="text-xs tabular-nums">
                    {u.kind === "rollback" ? (
                      <span className="text-muted">—</span>
                    ) : u.errors ? (
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedUpdateFilter({
                            label: u.message || u.groupId,
                            ids: u.updateIds,
                          })
                        }
                        className="font-medium text-danger hover:underline"
                      >
                        {u.errors} hata · {u.errorDevices} cihaz
                      </button>
                    ) : (
                      <span className="text-muted">Yok</span>
                    )}
                  </Td>
                  <Td>
                    {u.kind === "update" ? (
                      <Menu>
                        <MenuLabel>Yayılım</MenuLabel>
                        <MenuItem icon={Percent} disabled={busy} onSelect={() => void setRollout(u)}>
                          Yüzdeyi değiştir
                        </MenuItem>
                        {u.rollout < 100 ? (
                          <MenuItem icon={Play} disabled={busy} onSelect={() => void openToAll(u)}>
                            Herkese aç (%100)
                          </MenuItem>
                        ) : null}
                        {u.rollout > 0 ? (
                          <MenuItem icon={Pause} disabled={busy} onSelect={() => void pause(u)}>
                            Durdur
                          </MenuItem>
                        ) : null}
                        <MenuSeparator />
                        <MenuItem icon={History} disabled={busy} onSelect={() => void republish(u)}>
                          Bu sürüme geri dön
                        </MenuItem>
                        <MenuItem icon={Undo2} danger disabled={busy} onSelect={() => void toEmbedded(u)}>
                          Herkesi mağaza sürümüne döndür
                        </MenuItem>
                      </Menu>
                    ) : null}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {q.data ? (
        <Card className="mt-4">
          <CardHead
            title="Uygulamadan gelen son hatalar"
            description="Uygulama çöktüğünde ya da bir ekran açılamadığında gönderilir. Yayılımı genişletmeden önce yeni güncellemenin satırına bakın. 30 gün saklanır."
          />
          {q.data.recentErrors.length ? (
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
              <Segmented
                value={platformFilter}
                onChange={setPlatformFilter}
                items={[
                  { value: "all", label: "Tümü" },
                  { value: "ios", label: "iOS" },
                  { value: "android", label: "Android" },
                ]}
              />
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-elevated/60">
                <input
                  type="checkbox"
                  checked={fatalOnly}
                  onChange={(e) => setFatalOnly(e.target.checked)}
                  className="size-3.5 accent-primary"
                />
                Sadece çökmeler
              </label>
              <SearchInput
                value={errorQuery}
                onChange={setErrorQuery}
                placeholder="Mesaj, ekran, cihaz veya güncelleme ara…"
                className="ml-auto w-full sm:w-72"
              />
            </div>
          ) : null}
          {selectedUpdateFilter ? (
            <div className="flex items-center gap-2 border-b border-border bg-elevated/30 px-4 py-2 text-xs text-muted">
              <span>
                Güncelleme hatası filtrelendi: <strong className="text-fg">{selectedUpdateFilter.label}</strong>
              </span>
              <button type="button" onClick={() => setSelectedUpdateFilter(null)} className="font-semibold text-primary hover:underline">
                Temizle
              </button>
            </div>
          ) : null}
          {!q.data.recentErrors.length ? (
            <EmptyState icon={Smartphone} title="Hata raporu yok" />
          ) : !filteredErrors.length ? (
            <EmptyState icon={Smartphone} title="Filtreyle eşleşen hata yok" />
          ) : (
            <ul className="divide-y divide-border">
              {filteredErrors.map((e) => {
                const isExpanded = expandedErrors.has(e.id);
                return (
                  <li key={e.id} className="px-4 py-2.5">
                    <div className="flex flex-wrap items-start gap-1.5">
                      {e.fatal ? <Pill tone="danger">Çökme</Pill> : <Pill>Hata</Pill>}
                      <span className="min-w-0 flex-1 break-words text-sm">{e.message}</span>
                      {e.stack ? (
                        <button
                          type="button"
                          onClick={() => toggleErrorStack(e.id)}
                          aria-expanded={isExpanded}
                          className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium text-muted hover:bg-elevated hover:text-fg"
                        >
                          {isExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                          {isExpanded ? "Yığın izini gizle" : "Yığın izi"}
                        </button>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-xs text-muted" title={dateTime(e.createdAt)}>
                      {relative(e.createdAt)} · {PLATFORM_LABEL[e.platform]} {e.appVersion ?? ""}
                      {e.updateId ? ` · güncelleme ${e.updateId.slice(0, 8)}` : " · mağaza sürümü"}
                      {e.screen ? ` · ${e.screen}` : ""}
                      {e.deviceId ? (
                        <>
                          {" · cihaz "}
                          <span className="font-mono" title={e.deviceId}>
                            {e.deviceId.slice(0, 12)}
                          </span>
                        </>
                      ) : null}
                    </p>
                    {e.stack && isExpanded ? (
                      <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-border bg-elevated/60 p-2.5 font-mono text-[11px] leading-relaxed text-fg">
                        {e.stack}
                      </pre>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      ) : null}
    </div>
  );
}
