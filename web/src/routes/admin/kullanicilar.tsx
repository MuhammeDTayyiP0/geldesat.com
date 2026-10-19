import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { BadgeCheck, Download, Eye, LayoutList, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminListUsers } from "@/lib/server/admin/users";
import { useSheets } from "@/components/admin/hooks";
import { dateOnly, n, relative } from "@/components/admin/format";
import { downloadCsv, int, oneOf, str } from "@/components/admin/search";
import {
  Avatar,
  Card,
  EmptyState,
  ErrorState,
  Menu,
  MenuItem,
  PageHeader,
  Pagination,
  Pill,
  SearchInput,
  Segmented,
  SelectBox,
  SkeletonRows,
  StatCard,
  Table,
  Td,
  Th,
} from "@/components/admin/ui";

const STATES = ["all", "active", "banned", "closing", "unverified", "store", "no_phone"] as const;
const ROLES = ["ALL", "ADMIN", "USER"] as const;
const SORTS = ["newest", "oldest", "last_seen", "listings", "name"] as const;

type Search = {
  q?: string;
  state?: (typeof STATES)[number];
  role?: (typeof ROLES)[number];
  sort?: (typeof SORTS)[number];
  page?: number;
  pageSize?: number;
};

export const Route = createFileRoute("/admin/kullanicilar")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    q: str(s.q),
    state: oneOf(s.state, STATES),
    role: oneOf(s.role, ROLES),
    sort: oneOf(s.sort, SORTS),
    page: int(s.page, 1, 100_000),
    pageSize: int(s.pageSize, 5, 200),
  }),
  component: UsersPage,
});

function UsersPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const set = (patch: Partial<Search>, resetPage = true) =>
    void navigate({ search: (prev) => ({ ...prev, ...(resetPage ? { page: undefined } : {}), ...patch }), replace: true });
  const { openUser } = useSheets();

  const filter = {
    q: search.q,
    state: search.state ?? "all",
    role: search.role ?? "ALL",
    sort: search.sort ?? "newest",
    page: search.page ?? 1,
    pageSize: search.pageSize ?? 25,
  } as const;
  const query = useQuery({ queryKey: ["admin", "users", filter], queryFn: () => adminListUsers({ data: filter }), placeholderData: keepPreviousData });
  const rows = query.data?.rows ?? [];
  const t = query.data?.totals;

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        icon={Users}
        title="Kullanıcılar"
        description="Üyeleri arayın; profil, oturum, askıya alma ve yetki işlemlerini yönetin."
        actions={
          <Button
            size="sm"
            variant="outline"
            disabled={!rows.length}
            onClick={() =>
              downloadCsv(
                `uyeler-${new Date().toISOString().slice(0, 10)}.csv`,
                ["Ad", "E-posta", "Telefon", "İl", "Rol", "İlan", "Yayında", "Kayıt", "Son görülme", "Durum"],
                rows.map((u) => [
                  u.display_name,
                  u.email,
                  u.phone,
                  u.city,
                  u.role,
                  u.listing_count,
                  u.active_count,
                  u.created_at.slice(0, 10),
                  u.last_seen_at?.slice(0, 10),
                  u.banned_at ? "Askıda" : u.deletion_requested_at ? "Silinme sürecinde" : "Aktif",
                ]),
              )
            }
          >
            <Download className="size-4" /> CSV (bu sayfa)
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Toplam üye" value={t ? n(t.all) : "—"} hint={`${t ? n(t.admins) : "—"} yönetici`} />
        <StatCard label="Son 7 günde katılan" value={t ? n(t.new_7d) : "—"} tone="ok" />
        <StatCard label="Son 24 saatte aktif" value={t ? n(t.active_24h) : "—"} tone="violet" />
        <StatCard label="Askıdaki hesap" value={t ? n(t.banned) : "—"} tone="danger" hint={`${t ? n(t.closing) : "—"} silinme sürecinde`} onClick={() => set({ state: "banned" })} />
      </div>

      <Segmented
        value={filter.state}
        onChange={(state) => set({ state: state === "all" ? undefined : state })}
        items={[
          { value: "all", label: "Tümü", count: t?.all },
          { value: "active", label: "Aktif" },
          { value: "banned", label: "Askıda", count: t?.banned, tone: "danger" },
          { value: "closing", label: "Silinme sürecinde", count: t?.closing },
          { value: "unverified", label: "E-postası doğrulanmamış" },
          { value: "store", label: "Mağaza sahipleri" },
          { value: "no_phone", label: "Telefonsuz" },
        ]}
      />

      <Card className="mt-3">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <SearchInput value={search.q ?? ""} onChange={(q) => set({ q: q || undefined })} placeholder="Ad, e-posta, telefon, il veya kimlik" className="w-full sm:w-80" />
          <SelectBox
            label="Rol"
            value={filter.role}
            onChange={(v) => set({ role: v === "ALL" ? undefined : (v as Search["role"]) })}
            options={[
              { value: "ALL", label: "Tüm roller" },
              { value: "ADMIN", label: "Yöneticiler" },
              { value: "USER", label: "Üyeler" },
            ]}
          />
          <SelectBox
            label="Sıralama"
            value={filter.sort}
            onChange={(v) => set({ sort: v === "newest" ? undefined : (v as Search["sort"]) })}
            options={[
              { value: "newest", label: "En yeni kayıt" },
              { value: "oldest", label: "En eski kayıt" },
              { value: "last_seen", label: "Son görülme" },
              { value: "listings", label: "En çok ilan" },
              { value: "name", label: "Ada göre (A-Z)" },
            ]}
          />
        </div>

        {query.error ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : query.isLoading ? (
          <SkeletonRows rows={8} />
        ) : !rows.length ? (
          <EmptyState icon={Users} title="Üye bulunamadı" description="Arama veya filtreleri değiştirin." />
        ) : (
          <Table className={query.isFetching ? "opacity-70" : undefined}>
            <thead>
              <tr>
                <Th>Üye</Th>
                <Th>Telefon</Th>
                <Th>İl</Th>
                <Th className="text-right">İlan</Th>
                <Th>Durum</Th>
                <Th>Kayıt</Th>
                <Th>Son görülme</Th>
                <Th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.user_id} onClick={() => openUser(u.user_id)} className="cursor-pointer hover:bg-elevated/50">
                  <Td>
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar name={u.display_name} src={u.avatar_url} size={36} />
                      <div className="min-w-0 max-w-[280px]">
                        <p className="flex items-center gap-1.5 truncate font-medium">
                          {u.display_name || "İsimsiz"}
                          {u.role === "ADMIN" ? <Pill tone="ink">Yönetici</Pill> : null}
                        </p>
                        <p className="flex items-center gap-1 truncate text-xs text-muted">
                          {u.email ?? "—"}
                          {u.email && u.email_verified ? <BadgeCheck className="size-3.5 shrink-0 text-ok" aria-label="Doğrulanmış" /> : null}
                        </p>
                      </div>
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap text-xs tabular-nums text-muted">{u.phone ?? "—"}</Td>
                  <Td className="text-xs text-muted">{u.city ?? "—"}</Td>
                  <Td className="text-right tabular-nums">
                    <span className="font-semibold">{n(u.active_count)}</span>
                    <span className="text-xs text-muted"> / {n(u.listing_count)}</span>
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {u.banned_at ? (
                        <Pill tone="danger" dot>
                          Askıda
                        </Pill>
                      ) : u.deletion_requested_at ? (
                        <Pill tone="warn" dot>
                          Siliniyor
                        </Pill>
                      ) : (
                        <Pill tone="ok" dot>
                          Aktif
                        </Pill>
                      )}
                      {u.store_name ? <Pill tone="violet">Mağaza</Pill> : null}
                      {u.providers.includes("google") ? <Pill>Google</Pill> : null}
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap text-xs text-muted">{dateOnly(u.created_at)}</Td>
                  <Td className="whitespace-nowrap text-xs text-muted">{relative(u.last_seen_at)}</Td>
                  <Td onClick={(e) => e.stopPropagation()}>
                    <Menu>
                      <MenuItem icon={Eye} onSelect={() => openUser(u.user_id)}>
                        Ayrıntılar ve işlemler
                      </MenuItem>
                      <MenuItem icon={LayoutList} onSelect={() => void navigate({ to: "/admin/ilanlar", search: { userId: u.user_id } })}>
                        İlanlarını listele
                      </MenuItem>
                    </Menu>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {query.data && query.data.total > 0 ? (
          <Pagination
            page={query.data.page}
            pages={query.data.pages}
            total={query.data.total}
            pageSize={query.data.pageSize}
            onPage={(page) => set({ page }, false)}
            onPageSize={(pageSize) => set({ pageSize })}
          />
        ) : null}
      </Card>
    </div>
  );
}
