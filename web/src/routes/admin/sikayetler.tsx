import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Ban, Check, ExternalLink, MessageCircle, MessageSquareWarning, PanelRightOpen, RotateCcw, ShieldX, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { photoSrc } from "@/lib/images";
import { cn } from "@/lib/utils";
import { adminListReports, adminResolveReports, type AdminReportRow } from "@/lib/server/admin/moderation";
import { adminBanUser } from "@/lib/server/admin/users";
import { useRunner, useSheets } from "@/components/admin/hooks";
import { dateTime, listingStatus, relative } from "@/components/admin/format";
import { int, oneOf, str } from "@/components/admin/search";
import { BulkBar, BulkButton, Card, Checkbox, EmptyState, ErrorState, PageHeader, Pagination, Pill, SearchInput, Segmented, SkeletonRows, Thumb, useConfirm } from "@/components/admin/ui";

const STATUSES = ["OPEN", "CLOSED", "ALL"] as const;
const KINDS = ["all", "listing", "conversation"] as const;
type Search = { status?: (typeof STATUSES)[number]; kind?: (typeof KINDS)[number]; q?: string; page?: number };

export const Route = createFileRoute("/admin/sikayetler")({
  validateSearch: (s: Record<string, unknown>): Search => ({ status: oneOf(s.status, STATUSES), kind: oneOf(s.kind, KINDS), q: str(s.q), page: int(s.page, 1, 100_000) }),
  component: ReportsPage,
});

function ReportsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const set = (patch: Partial<Search>, resetPage = true) =>
    void navigate({ search: (prev) => ({ ...prev, ...(resetPage ? { page: undefined } : {}), ...patch }), replace: true });
  const filter = { status: search.status ?? "OPEN", kind: search.kind ?? "all", q: search.q, page: search.page ?? 1, pageSize: 20 } as const;
  const query = useQuery({ queryKey: ["admin", "reports", filter], queryFn: () => adminListReports({ data: filter }), placeholderData: keepPreviousData });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { run } = useRunner();
  const { prompt } = useConfirm();
  const rows = query.data?.rows ?? [];
  const totals = query.data?.totals;

  async function closeSelected(takeDown: boolean) {
    const ids = [...selected];
    const note = await prompt({
      title: takeDown ? `${ids.length} şikayet kapatılsın ve ilanlar kaldırılsın mı?` : `${ids.length} şikayet kapatılsın mı?`,
      label: "Çözüm notu (isteğe bağlı)",
      required: false,
      confirmLabel: "Kapat",
      danger: takeDown,
    });
    if (note == null) return;
    const r = await run(() => adminResolveReports({ data: { ids, status: "CLOSED", note: note || undefined, takeDownListing: takeDown } }), (res) => `${res.count} şikayet kapatıldı${res.takenDown ? `, ${res.takenDown} ilan kaldırıldı` : ""}.`);
    if (r) setSelected(new Set());
  }

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader icon={MessageSquareWarning} title="Şikayetler" description="Üyelerin ilan ve mesajlaşma şikayetlerini inceleyin; ilanı kaldırın veya kullanıcıyı askıya alın." />
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={filter.status}
          onChange={(status) => set({ status: status === "OPEN" ? undefined : status })}
          items={[
            { value: "OPEN", label: "Açık", count: totals?.OPEN, tone: "danger" },
            { value: "CLOSED", label: "Kapatılan", count: totals?.CLOSED },
            { value: "ALL", label: "Tümü", count: totals?.ALL },
          ]}
        />
        <Segmented
          value={filter.kind}
          onChange={(kind) => set({ kind: kind === "all" ? undefined : kind })}
          items={[
            { value: "all", label: "Hepsi" },
            { value: "listing", label: "İlan şikayetleri" },
            { value: "conversation", label: "Mesaj şikayetleri" },
          ]}
        />
        <SearchInput value={search.q ?? ""} onChange={(q) => set({ q: q || undefined })} placeholder="Gerekçe, açıklama, ilan veya üye" className="ml-auto w-full sm:w-72" />
      </div>

      <div className="mt-3 space-y-3">
        {query.error ? (
          <Card>
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          </Card>
        ) : query.isLoading ? (
          <Card>
            <SkeletonRows rows={5} />
          </Card>
        ) : !rows.length ? (
          <Card>
            <EmptyState icon={Check} title={filter.status === "OPEN" ? "Açık şikayet yok" : "Şikayet bulunamadı"} description={filter.status === "OPEN" ? "Tüm şikayetler incelenmiş görünüyor." : undefined} />
          </Card>
        ) : (
          rows.map((r) => (
            <ReportCard
              key={r.id}
              report={r}
              selected={selected.has(r.id)}
              onSelect={(v) =>
                setSelected((prev) => {
                  const next = new Set(prev);
                  if (v) next.add(r.id);
                  else next.delete(r.id);
                  return next;
                })
              }
            />
          ))
        )}
      </div>
      {query.data && query.data.total > query.data.pageSize ? (
        <Card className="mt-3">
          <Pagination page={query.data.page} pages={query.data.pages} total={query.data.total} pageSize={query.data.pageSize} onPage={(page) => set({ page }, false)} />
        </Card>
      ) : null}

      <BulkBar count={selected.size} onClear={() => setSelected(new Set())}>
        <BulkButton onClick={() => void closeSelected(false)}>
          <Check className="size-3.5" /> Kapat
        </BulkButton>
        <BulkButton danger onClick={() => void closeSelected(true)}>
          <ShieldX className="size-3.5" /> Kapat + ilanları kaldır
        </BulkButton>
      </BulkBar>
    </div>
  );
}

function ReportCard({ report: r, selected, onSelect }: { report: AdminReportRow; selected: boolean; onSelect: (v: boolean) => void }) {
  const { run, busy } = useRunner();
  const { prompt, confirm } = useConfirm();
  const { openListing, openUser } = useSheets();
  const open = r.status === "OPEN";
  const ls = r.listing_status ? listingStatus(r.listing_status, null) : null;

  async function close(takeDown: boolean) {
    const note = await prompt({
      title: takeDown ? "Şikayeti kapat ve ilanı kaldır" : "Şikayeti kapat",
      body: takeDown ? "İlan reddedilir ve satıcıya gerekçeyle bildirim gider." : "Şikayet incelendi olarak işaretlenir.",
      label: takeDown ? "Kaldırma gerekçesi (satıcıya gider)" : "Çözüm notu (isteğe bağlı)",
      required: takeDown,
      defaultValue: takeDown ? r.reason : "",
      confirmLabel: takeDown ? "Kapat ve kaldır" : "Kapat",
      danger: takeDown,
    });
    if (note == null) return;
    await run(() => adminResolveReports({ data: { ids: [r.id], status: "CLOSED", note: note || undefined, takeDownListing: takeDown } }), takeDown ? "Şikayet kapatıldı, ilan kaldırıldı." : "Şikayet kapatıldı.");
  }

  async function ban() {
    if (!r.reported_user_id) return;
    const reason = await prompt({
      title: `${r.reported_user_name ?? "Kullanıcı"} askıya alınsın mı?`,
      body: "Giriş yapamaz, oturumları kapanır, ilanları gizlenir. Şikayet de kapatılır.",
      label: "Gerekçe",
      defaultValue: r.reason,
      confirmLabel: "Askıya al",
      danger: true,
    });
    if (!reason) return;
    const ok = await run(() => adminBanUser({ data: { userId: r.reported_user_id!, reason } }), "Kullanıcı askıya alındı.");
    if (ok) await run(() => adminResolveReports({ data: { ids: [r.id], status: "CLOSED", note: `Kullanıcı askıya alındı: ${reason}` } }));
  }

  return (
    <Card className={cn("overflow-hidden", selected && "ring-2 ring-primary/40", !open && "opacity-80")}>
      <div className="flex gap-3 p-4">
        <div className="pt-1">
          <Checkbox label="Seç" checked={selected} onChange={onSelect} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={open ? "danger" : "muted"} dot>
              {open ? "Açık" : "Kapatıldı"}
            </Pill>
            {r.kind === "conversation" ? (
              <Pill tone="warn">
                <MessageCircle className="size-3" /> Mesajlaşma
              </Pill>
            ) : (
              <Pill tone="primary">İlan</Pill>
            )}
            <span className="font-semibold">{r.reason}</span>
            {r.same_listing_reports > 1 ? <Pill tone="danger">Bu ilan {r.same_listing_reports} kez şikayet edildi</Pill> : null}
            <span className="ml-auto text-xs text-muted" title={dateTime(r.created_at)}>
              {relative(r.created_at)}
            </span>
          </div>

          {r.details ? <p className="mt-2 rounded-lg bg-elevated/60 px-3 py-2 text-sm">“{r.details}”</p> : null}

          {r.listing_id ? (
            <button type="button" onClick={() => openListing(r.listing_id!)} className="mt-3 flex w-full items-center gap-3 rounded-xl border border-border p-2 text-left hover:border-primary/30 hover:bg-elevated/40">
              <Thumb src={r.cover ? photoSrc(r.cover, 240) : null} className="size-12" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.listing_title}</p>
                <p className="text-xs text-muted">
                  #{r.listing_no} · {r.reported_user_name ?? "Satıcı"}
                </p>
              </div>
              {ls ? <Pill tone={ls.tone}>{ls.label}</Pill> : null}
              <PanelRightOpen className="size-4 shrink-0 text-muted" />
            </button>
          ) : r.kind === "listing" ? (
            <p className="mt-2 text-xs text-muted">İlan silinmiş.</p>
          ) : null}

          {r.messages.length ? (
            <div className="mt-3 rounded-xl border border-border">
              <p className="border-b border-border bg-elevated/40 px-3 py-1.5 text-[11px] font-semibold text-muted">Son mesajlar (şikayet eden paylaştı)</p>
              <ul className="max-h-56 space-y-1.5 overflow-y-auto p-3 text-xs">
                {r.messages.map((m, i) => (
                  <li key={i} className={cn("flex", m.who === "Şikayet eden" ? "justify-end" : "justify-start")}>
                    <span
                      className={cn(
                        "max-w-[80%] whitespace-pre-wrap break-words rounded-xl px-2.5 py-1.5",
                        m.who === "Şikayet eden" ? "bg-primary/10" : "bg-elevated",
                        m.reported && "ring-2 ring-danger",
                      )}
                    >
                      <span className="mb-0.5 block text-[10px] font-semibold text-muted">
                        {m.who} · {relative(m.at)}
                        {m.reported ? " · şikayet edilen mesaj" : ""}
                      </span>
                      {m.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
            <button type="button" onClick={() => openUser(r.reporter_id)} className="inline-flex items-center gap-1 hover:text-primary">
              <User className="size-3.5" /> Şikayet eden: <span className="font-medium text-fg">{r.reporter_name}</span>
            </button>
            {r.reported_user_id ? (
              <button type="button" onClick={() => openUser(r.reported_user_id!)} className="inline-flex items-center gap-1 hover:text-primary">
                <User className="size-3.5" /> Şikayet edilen: <span className="font-medium text-fg">{r.reported_user_name ?? "—"}</span>
                {r.reported_user_banned ? <Pill tone="danger">askıda</Pill> : null}
              </button>
            ) : null}
            {!open && r.resolved_at ? (
              <span>
                Kapatan: {r.resolved_by_name ?? "—"} · {relative(r.resolved_at)}
                {r.resolution_note ? ` · “${r.resolution_note}”` : ""}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-border bg-elevated/30 px-4 py-2.5">
        {open ? (
          <>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void close(false)}>
              <Check className="size-4" /> Kapat (sorun yok)
            </Button>
            {r.listing_id && r.listing_status !== "REJECTED" ? (
              <Button size="sm" variant="outline" className="text-danger" disabled={busy} onClick={() => void close(true)}>
                <ShieldX className="size-4" /> İlanı kaldır ve kapat
              </Button>
            ) : null}
            {r.reported_user_id && !r.reported_user_banned ? (
              <Button size="sm" variant="outline" className="text-danger" disabled={busy} onClick={() => void ban()}>
                <Ban className="size-4" /> Kullanıcıyı askıya al
              </Button>
            ) : null}
          </>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() =>
              void confirm({ title: "Şikayet yeniden açılsın mı?", confirmLabel: "Yeniden aç" }).then((ok) => {
                if (ok) void run(() => adminResolveReports({ data: { ids: [r.id], status: "OPEN" } }), "Şikayet yeniden açıldı.");
              })
            }
          >
            <RotateCcw className="size-4" /> Yeniden aç
          </Button>
        )}
        {r.listing_slug ? (
          <a href={`/ilan/${r.listing_slug}`} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-fg">
            Sitede gör <ExternalLink className="size-3.5" />
          </a>
        ) : null}
      </div>
    </Card>
  );
}

