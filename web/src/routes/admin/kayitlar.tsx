import { Fragment, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, History } from "lucide-react";
import { adminListAudit } from "@/lib/server/admin/content";
import { useSheets } from "@/components/admin/hooks";
import { actionTone, dateTime, relative, TARGET_LABEL } from "@/components/admin/format";
import { int, str } from "@/components/admin/search";
import { Avatar, Card, EmptyState, ErrorState, PageHeader, Pagination, Pill, SearchInput, SelectBox, SkeletonRows, Table, Td, Th } from "@/components/admin/ui";

type Search = { q?: string; type?: string; admin?: string; page?: number };

export const Route = createFileRoute("/admin/kayitlar")({
  validateSearch: (s: Record<string, unknown>): Search => ({ q: str(s.q), type: str(s.type, 40), admin: str(s.admin), page: int(s.page, 1, 100_000) }),
  component: AuditPage,
});

function AuditPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const set = (patch: Partial<Search>, resetPage = true) =>
    void navigate({ search: (prev) => ({ ...prev, ...(resetPage ? { page: undefined } : {}), ...patch }), replace: true });
  const filter = { q: search.q, targetType: search.type, adminId: search.admin, page: search.page ?? 1, pageSize: 50 };
  const q = useQuery({ queryKey: ["admin", "audit", filter], queryFn: () => adminListAudit({ data: filter }), placeholderData: keepPreviousData });
  const { openListing, openUser } = useSheets();
  const [open, setOpen] = useState<string | null>(null);
  const rows = q.data?.rows ?? [];

  return (
    <div className="mx-auto max-w-[1300px]">
      <PageHeader icon={History} title="İşlem kayıtları" description="Yöneticilerin yaptığı her değişiklik: kim, ne zaman, neyi, neden. Kayıtlar silinemez." />
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <SearchInput value={search.q ?? ""} onChange={(v) => set({ q: v || undefined })} placeholder="Özet veya işlem türünde ara" className="w-full sm:w-80" />
          <SelectBox
            label="Kayıt türü"
            value={search.type ?? ""}
            onChange={(v) => set({ type: v || undefined })}
            options={[{ value: "", label: "Tüm türler" }, ...Object.entries(TARGET_LABEL).map(([value, label]) => ({ value, label }))]}
          />
          <SelectBox
            label="Yönetici"
            value={search.admin ?? ""}
            onChange={(v) => set({ admin: v || undefined })}
            options={[{ value: "", label: "Tüm yöneticiler" }, ...(q.data?.admins ?? []).map((a) => ({ value: a.user_id, label: a.display_name }))]}
          />
        </div>
        {q.error ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        ) : q.isLoading ? (
          <SkeletonRows rows={10} />
        ) : !rows.length ? (
          <EmptyState icon={History} title="Kayıt yok" description="Yönetici işlemleri burada görünür." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th className="w-8" />
                <Th>Zaman</Th>
                <Th>Yönetici</Th>
                <Th>Tür</Th>
                <Th>İşlem</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                const expanded = open === e.id;
                return (
                  <Fragment key={e.id}>
                    <tr className="cursor-pointer hover:bg-elevated/50" onClick={() => setOpen(expanded ? null : e.id)}>
                      <Td>{e.meta ? expanded ? <ChevronDown className="size-4 text-muted" /> : <ChevronRight className="size-4 text-muted" /> : null}</Td>
                      <Td className="whitespace-nowrap text-xs">
                        <span className="block font-medium">{relative(e.created_at)}</span>
                        <span className="text-muted">{dateTime(e.created_at)}</span>
                      </Td>
                      <Td>
                        <span className="flex items-center gap-2">
                          <Avatar name={e.admin_name} size={24} />
                          <span className="text-sm">{e.admin_name}</span>
                        </span>
                      </Td>
                      <Td>
                        <Pill tone={actionTone(e.action)}>{TARGET_LABEL[e.target_type] ?? e.target_type}</Pill>
                        <span className="mt-0.5 block font-mono text-[10px] text-subtle">{e.action}</span>
                      </Td>
                      <Td className="max-w-[560px]">
                        <p className="text-sm">{e.summary}</p>
                        {e.target_id && (e.target_type === "listing" || e.target_type === "user") ? (
                          <button
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              if (e.target_type === "listing") openListing(e.target_id!);
                              else openUser(e.target_id!);
                            }}
                            className="mt-0.5 text-xs font-medium text-primary hover:underline"
                          >
                            {e.target_type === "listing" ? "İlanı aç" : "Üyeyi aç"} →
                          </button>
                        ) : e.target_id && e.target_type === "category" ? (
                          <button
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              void navigate({ to: "/admin/kategoriler", search: { id: e.target_id! } });
                            }}
                            className="mt-0.5 text-xs font-medium text-primary hover:underline"
                          >
                            Kategoriyi aç →
                          </button>
                        ) : null}
                      </Td>
                    </tr>
                    {expanded && e.meta ? (
                      <tr>
                        <td colSpan={5} className="border-b border-border bg-elevated/40 px-4 py-3">
                          <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] text-muted">{prettyJson(e.meta)}</pre>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </Table>
        )}
        {q.data && q.data.total > q.data.pageSize ? (
          <Pagination page={q.data.page} pages={q.data.pages} total={q.data.total} pageSize={q.data.pageSize} onPage={(page) => set({ page }, false)} />
        ) : null}
      </Card>
    </div>
  );
}

function prettyJson(text: string) {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}
