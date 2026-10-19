import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { adminDeleteReviews, adminListReviews } from "@/lib/server/admin/moderation";
import { useRunner, useSheets } from "@/components/admin/hooks";
import { dateTime, n, relative } from "@/components/admin/format";
import { int, str } from "@/components/admin/search";
import { BulkBar, BulkButton, Card, Checkbox, EmptyState, ErrorState, PageHeader, Pagination, SearchInput, SkeletonRows, Table, Td, Th, useConfirm } from "@/components/admin/ui";

type Search = { q?: string; rating?: number; page?: number };

export const Route = createFileRoute("/admin/yorumlar")({
  validateSearch: (s: Record<string, unknown>): Search => ({ q: str(s.q), rating: int(s.rating, 0, 5), page: int(s.page, 1, 100_000) }),
  component: ReviewsPage,
});

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} yıldız`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn("size-3.5", i <= value ? "fill-amber-400 text-amber-400" : "text-border")} />
      ))}
    </span>
  );
}

function ReviewsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const set = (patch: Partial<Search>, resetPage = true) =>
    void navigate({ search: (prev) => ({ ...prev, ...(resetPage ? { page: undefined } : {}), ...patch }), replace: true });
  const filter = { q: search.q, rating: search.rating ?? 0, page: search.page ?? 1, pageSize: 25 };
  const query = useQuery({ queryKey: ["admin", "reviews", filter], queryFn: () => adminListReviews({ data: filter }), placeholderData: keepPreviousData });
  const { openUser } = useSheets();
  const { run } = useRunner();
  const { prompt } = useConfirm();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const rows = query.data?.rows ?? [];
  const dist = query.data?.distribution ?? {};
  const total = Object.values(dist).reduce((a, b) => a + b, 0);
  const avg = total ? Object.entries(dist).reduce((a, [r, c]) => a + Number(r) * c, 0) / total : 0;

  async function remove(ids: string[]) {
    const reason = await prompt({
      title: ids.length > 1 ? `${ids.length} değerlendirme silinsin mi?` : "Değerlendirme silinsin mi?",
      body: "Satıcının puan ortalaması yeniden hesaplanır. Bu işlem geri alınamaz.",
      label: "Gerekçe (işlem kaydı için)",
      presets: ["Hakaret / küfür", "Sahte değerlendirme", "Alakasız içerik", "Kişisel bilgi paylaşımı"],
      required: false,
      confirmLabel: "Sil",
      danger: true,
    });
    if (reason == null) return;
    const r = await run(() => adminDeleteReviews({ data: { ids, reason: reason || undefined } }), (res) => `${res.count} değerlendirme silindi.`);
    if (r) setSelected(new Set());
  }

  return (
    <div className="mx-auto max-w-[1300px]">
      <PageHeader icon={Star} title="Değerlendirmeler" description="Satıcılara bırakılan puan ve yorumları denetleyin; kurallara aykırı olanları kaldırın." />

      <div className="mb-4 grid gap-3 md:grid-cols-[220px_1fr]">
        <Card className="flex flex-col items-center justify-center p-5">
          <p className="text-4xl font-bold tabular-nums">{avg ? avg.toFixed(2) : "—"}</p>
          <Stars value={Math.round(avg)} />
          <p className="mt-1 text-xs text-muted">{n(total)} değerlendirme</p>
        </Card>
        <Card className="space-y-1.5 p-4">
          {[5, 4, 3, 2, 1].map((r) => {
            const c = dist[r] ?? 0;
            const active = search.rating === r;
            return (
              <button key={r} type="button" onClick={() => set({ rating: active ? undefined : r })} className={cn("flex w-full items-center gap-3 rounded-lg px-2 py-1 text-left text-sm", active ? "bg-primary/8" : "hover:bg-elevated")}>
                <span className="w-10 shrink-0 font-medium tabular-nums">{r} ★</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-elevated">
                  <span className="block h-full rounded-full bg-[#2a78d6]" style={{ width: `${total ? (c / total) * 100 : 0}%` }} />
                </span>
                <span className="w-12 shrink-0 text-right text-xs tabular-nums text-muted">{n(c)}</span>
              </button>
            );
          })}
        </Card>
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <SearchInput value={search.q ?? ""} onChange={(q) => set({ q: q || undefined })} placeholder="Yorum metni, satıcı veya yazan" className="w-full sm:w-80" />
          {search.rating ? (
            <Button size="sm" variant="ghost" onClick={() => set({ rating: undefined })}>
              {search.rating} ★ filtresini kaldır
            </Button>
          ) : null}
        </div>
        {query.error ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : query.isLoading ? (
          <SkeletonRows rows={6} />
        ) : !rows.length ? (
          <EmptyState icon={Star} title="Değerlendirme bulunamadı" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th className="w-10">
                  <Checkbox
                    label="Tümünü seç"
                    checked={rows.every((r) => selected.has(r.id))}
                    indeterminate={rows.some((r) => selected.has(r.id)) && !rows.every((r) => selected.has(r.id))}
                    onChange={(v) => setSelected(v ? new Set(rows.map((r) => r.id)) : new Set())}
                  />
                </Th>
                <Th>Puan</Th>
                <Th>Yorum</Th>
                <Th>Satıcı</Th>
                <Th>Yazan</Th>
                <Th>Tarih</Th>
                <Th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={selected.has(r.id) ? "bg-primary/5" : "hover:bg-elevated/50"}>
                  <Td>
                    <Checkbox
                      label="Seç"
                      checked={selected.has(r.id)}
                      onChange={(v) =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (v) next.add(r.id);
                          else next.delete(r.id);
                          return next;
                        })
                      }
                    />
                  </Td>
                  <Td>
                    <Stars value={r.rating} />
                  </Td>
                  <Td className="max-w-[420px]">
                    <p className="line-clamp-2 text-sm">{r.comment ?? <span className="text-subtle">Yorum yazılmamış</span>}</p>
                    {r.listing_title ? <p className="truncate text-[11px] text-muted">İlan #{r.listing_no}: {r.listing_title}</p> : null}
                  </Td>
                  <Td>
                    <button type="button" onClick={() => openUser(r.seller_id)} className="text-sm font-medium hover:text-primary hover:underline">
                      {r.seller_name}
                    </button>
                  </Td>
                  <Td>
                    <button type="button" onClick={() => openUser(r.reviewer_id)} className="text-sm text-muted hover:text-primary hover:underline">
                      {r.reviewer_name}
                    </button>
                  </Td>
                  <Td className="whitespace-nowrap text-xs text-muted" >
                    <span title={dateTime(r.created_at)}>{relative(r.created_at)}</span>
                  </Td>
                  <Td>
                    <button type="button" onClick={() => void remove([r.id])} className="rounded-lg p-1.5 text-muted hover:bg-danger/10 hover:text-danger" aria-label="Sil">
                      <Trash2 className="size-4" />
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {query.data && query.data.total > query.data.pageSize ? (
          <Pagination page={query.data.page} pages={query.data.pages} total={query.data.total} pageSize={query.data.pageSize} onPage={(page) => set({ page }, false)} />
        ) : null}
      </Card>

      <BulkBar count={selected.size} onClear={() => setSelected(new Set())}>
        <BulkButton danger onClick={() => void remove([...selected])}>
          <Trash2 className="size-3.5" /> Seçilenleri sil
        </BulkButton>
      </BulkBar>
    </div>
  );
}
