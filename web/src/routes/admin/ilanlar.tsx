import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  Ban,
  CalendarPlus,
  Check,
  Download,
  ExternalLink,
  Eye,
  FolderInput,
  FolderTree,
  LayoutList,
  ListChecks,
  Sparkles,
  Tag,
  Trash2,
  Undo2,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { photoSrc } from "@/lib/images";
import { adminListingCities, adminListListings, type AdminListingRow } from "@/lib/server/admin/listings";
import { useCategoryTree, useListingActions, usePickCategory, useSheets } from "@/components/admin/hooks";
import { dateOnly, listingStatus, money, n, relative } from "@/components/admin/format";
import { downloadCsv, int, oneOf, str } from "@/components/admin/search";
import { ListingStats } from "@/components/admin/ListingSheet";
import {
  BulkBar,
  BulkButton,
  Card,
  Checkbox,
  EmptyState,
  ErrorState,
  Menu,
  MenuItem,
  MenuSeparator,
  PageHeader,
  Pagination,
  Pill,
  SearchInput,
  Segmented,
  SelectBox,
  SkeletonRows,
  Table,
  Td,
  Th,
  Thumb,
} from "@/components/admin/ui";

const STATUSES = ["ALL", "PENDING", "ACTIVE", "EXPIRED", "INACTIVE", "SOLD", "REJECTED"] as const;
const FLAGS = ["none", "featured", "reported", "no_photo"] as const;
const SORTS = ["newest", "oldest", "updated", "price_desc", "price_asc", "views", "expires"] as const;

type Search = {
  q?: string;
  status?: (typeof STATUSES)[number];
  categoryId?: string;
  city?: string;
  userId?: string;
  flag?: (typeof FLAGS)[number];
  sort?: (typeof SORTS)[number];
  page?: number;
  pageSize?: number;
};

export const Route = createFileRoute("/admin/ilanlar")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    q: str(s.q),
    status: oneOf(s.status, STATUSES),
    categoryId: str(s.categoryId),
    city: str(s.city, 60),
    userId: str(s.userId),
    flag: oneOf(s.flag, FLAGS),
    sort: oneOf(s.sort, SORTS),
    page: int(s.page, 1, 100_000),
    pageSize: int(s.pageSize, 5, 200),
  }),
  component: ListingsPage,
});

function ListingsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const set = (patch: Partial<Search>, resetPage = true) =>
    void navigate({ search: (prev) => ({ ...prev, ...(resetPage ? { page: undefined } : {}), ...patch }), replace: true });

  const filter = {
    q: search.q,
    status: search.status ?? "ALL",
    categoryId: search.categoryId,
    city: search.city,
    userId: search.userId,
    flag: search.flag ?? "none",
    sort: search.sort ?? "newest",
    page: search.page ?? 1,
    pageSize: search.pageSize ?? 25,
  } as const;

  const query = useQuery({
    queryKey: ["admin", "listings", filter],
    queryFn: () => adminListListings({ data: filter }),
    placeholderData: keepPreviousData,
  });
  const cities = useQuery({ queryKey: ["admin", "listing-cities"], queryFn: () => adminListingCities(), staleTime: 300_000 });
  const { index } = useCategoryTree();
  const pick = usePickCategory();
  const { openListing } = useSheets();
  const { act, busy } = useListingActions();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const rows = query.data?.rows ?? [];
  const counts = query.data?.statusCounts;
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const someSelected = rows.some((r) => selected.has(r.id));
  const selectedIds = useMemo(() => [...selected], [selected]);

  async function bulk(action: Parameters<typeof act>[1]) {
    const ok = await act(selectedIds, action);
    if (ok) setSelected(new Set());
  }

  function exportCsv() {
    downloadCsv(
      `ilanlar-${new Date().toISOString().slice(0, 10)}.csv`,
      ["İlan No", "Başlık", "Durum", "Fiyat", "Kategori", "İl", "İlçe", "Satıcı", "Görüntülenme", "Favori", "Oluşturulma", "Bitiş"],
      rows.map((r) => [
        r.listing_no,
        r.title,
        listingStatus(r.status, r.expires_at).label,
        r.price,
        r.category_name,
        r.city,
        r.district,
        r.seller_name,
        r.view_count,
        r.fav_count,
        r.created_at.slice(0, 10),
        r.expires_at?.slice(0, 10),
      ]),
    );
  }

  const categoryLabel = search.categoryId && index ? index.pathLabel(search.categoryId) || search.categoryId : null;

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        icon={LayoutList}
        title="İlanlar"
        description="Tüm ilanları arayın, filtreleyin ve toplu işlem yapın."
        actions={
          <>
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={!rows.length}>
              <Download className="size-4" /> CSV (bu sayfa)
            </Button>
            <Link to="/admin/moderasyon" className="inline-flex h-9 items-center gap-2 rounded-md bg-ink px-3 text-sm font-medium text-white hover:bg-ink/90">
              <ListChecks className="size-4" /> Onay kuyruğu {counts?.PENDING ? `(${n(counts.PENDING)})` : ""}
            </Link>
          </>
        }
      />

      <Segmented
        value={filter.status}
        onChange={(status) => set({ status: status === "ALL" ? undefined : status })}
        items={[
          { value: "ALL", label: "Tümü", count: counts?.ALL },
          { value: "PENDING", label: "Onay bekleyen", count: counts?.PENDING, tone: "warn" },
          { value: "ACTIVE", label: "Yayında", count: counts?.ACTIVE },
          { value: "EXPIRED", label: "Süresi dolan", count: counts?.EXPIRED },
          { value: "INACTIVE", label: "Pasif", count: counts?.INACTIVE },
          { value: "SOLD", label: "Satıldı", count: counts?.SOLD },
          { value: "REJECTED", label: "Reddedilen", count: counts?.REJECTED },
        ]}
      />

      <Card className="mt-3">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <SearchInput value={search.q ?? ""} onChange={(q) => set({ q: q || undefined })} placeholder="Başlık, ilan no veya satıcı adı" className="w-full sm:w-72" />
          <button
            type="button"
            onClick={() =>
              void pick({ title: "Kategoriye göre filtrele", description: "Seçilen kategori ve tüm alt dalları listelenir." }).then((c) => {
                if (c && c !== "root") set({ categoryId: c.id });
              })
            }
            className="inline-flex h-9 max-w-xs items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm text-muted hover:border-primary/40 hover:text-fg"
          >
            <FolderTree className="size-4 shrink-0" />
            <span className="truncate">{categoryLabel ?? "Kategori"}</span>
          </button>
          <SelectBox
            label="İl"
            value={search.city ?? ""}
            onChange={(v) => set({ city: v || undefined })}
            options={[{ value: "", label: "Tüm iller" }, ...(cities.data ?? []).map((c) => ({ value: c.city, label: `${c.city} (${n(c.n)})` }))]}
            className="max-w-44"
          />
          <SelectBox
            label="Özel filtre"
            value={filter.flag}
            onChange={(v) => set({ flag: v === "none" ? undefined : (v as Search["flag"]) })}
            options={[
              { value: "none", label: "Özel filtre yok" },
              { value: "featured", label: "Vitrindekiler" },
              { value: "reported", label: "Açık şikayeti olanlar" },
              { value: "no_photo", label: "Fotoğrafsızlar" },
            ]}
          />
          <SelectBox
            label="Sıralama"
            value={filter.sort}
            onChange={(v) => set({ sort: v === "newest" ? undefined : (v as Search["sort"]) })}
            options={[
              { value: "newest", label: "En yeni" },
              { value: "oldest", label: "En eski" },
              { value: "updated", label: "Son güncellenen" },
              { value: "price_desc", label: "Fiyat (yüksek → düşük)" },
              { value: "price_asc", label: "Fiyat (düşük → yüksek)" },
              { value: "views", label: "En çok görüntülenen" },
              { value: "expires", label: "Süresi ilk dolacak" },
            ]}
          />
          {(search.categoryId || search.city || search.userId || search.q || search.flag) ? (
            <button type="button" onClick={() => set({ q: undefined, categoryId: undefined, city: undefined, userId: undefined, flag: undefined })} className="text-xs font-semibold text-primary hover:underline">
              Filtreleri temizle
            </button>
          ) : null}
        </div>
        {categoryLabel || search.userId ? (
          <div className="flex flex-wrap gap-2 border-b border-border bg-elevated/30 px-3 py-2">
            {categoryLabel ? (
              <FilterChip icon={FolderTree} onClear={() => set({ categoryId: undefined })}>
                {categoryLabel}
              </FilterChip>
            ) : null}
            {search.userId ? (
              <FilterChip icon={User} onClear={() => set({ userId: undefined })}>
                Üye: {rows[0]?.user_id === search.userId ? rows[0].seller_name : search.userId}
              </FilterChip>
            ) : null}
          </div>
        ) : null}

        {query.error ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : query.isLoading ? (
          <SkeletonRows rows={8} />
        ) : !rows.length ? (
          <EmptyState title="İlan bulunamadı" description="Filtreleri değiştirerek tekrar deneyin." />
        ) : (
          <Table className={query.isFetching ? "opacity-70 transition-opacity" : undefined}>
            <thead>
              <tr>
                <Th className="w-10">
                  <Checkbox
                    label="Tümünü seç"
                    checked={allSelected}
                    indeterminate={!allSelected && someSelected}
                    onChange={(v) =>
                      setSelected((prev) => {
                        const next = new Set(prev);
                        for (const r of rows) {
                          if (v) next.add(r.id);
                          else next.delete(r.id);
                        }
                        return next;
                      })
                    }
                  />
                </Th>
                <Th>İlan</Th>
                <Th>Kategori</Th>
                <Th className="text-right">Fiyat</Th>
                <Th>Satıcı</Th>
                <Th>Durum</Th>
                <Th>Tarih</Th>
                <Th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <ListingRow
                  key={r.id}
                  row={r}
                  selected={selected.has(r.id)}
                  onSelect={(v) =>
                    setSelected((prev) => {
                      const next = new Set(prev);
                      if (v) next.add(r.id);
                      else next.delete(r.id);
                      return next;
                    })
                  }
                  onOpen={() => openListing(r.id)}
                  onSeller={() => set({ userId: r.user_id })}
                  act={act}
                />
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

      <BulkBar count={selected.size} onClear={() => setSelected(new Set())}>
        <BulkButton onClick={() => void bulk("approve")}>
          <Check className="size-3.5" /> Onayla
        </BulkButton>
        <BulkButton onClick={() => void bulk("reject")}>
          <X className="size-3.5" /> Reddet
        </BulkButton>
        <BulkButton onClick={() => void bulk("deactivate")}>
          <Ban className="size-3.5" /> Yayından kaldır
        </BulkButton>
        <BulkButton onClick={() => void bulk("extend")}>
          <CalendarPlus className="size-3.5" /> Süre uzat
        </BulkButton>
        <BulkButton onClick={() => void bulk("feature")}>
          <Sparkles className="size-3.5" /> Vitrin
        </BulkButton>
        <BulkButton onClick={() => void bulk("move")}>
          <FolderInput className="size-3.5" /> Taşı
        </BulkButton>
        <BulkButton danger onClick={() => void bulk("delete")}>
          <Trash2 className="size-3.5" /> Sil
        </BulkButton>
        {busy ? <span className="px-2 text-xs text-white/60">İşleniyor…</span> : null}
      </BulkBar>
    </div>
  );
}

function FilterChip({ children, onClear, icon: Icon }: { children: React.ReactNode; onClear: () => void; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary/25 bg-primary/5 py-1 pl-2.5 pr-1 text-xs font-medium text-primary">
      <Icon className="size-3.5 shrink-0" />
      <span className="truncate">{children}</span>
      <button type="button" onClick={onClear} className="rounded-full p-0.5 hover:bg-primary/15" aria-label="Filtreyi kaldır">
        <X className="size-3" />
      </button>
    </span>
  );
}

function ListingRow({
  row: r,
  selected,
  onSelect,
  onOpen,
  onSeller,
  act,
}: {
  row: AdminListingRow;
  selected: boolean;
  onSelect: (v: boolean) => void;
  onOpen: () => void;
  onSeller: () => void;
  act: ReturnType<typeof useListingActions>["act"];
}) {
  const st = listingStatus(r.status, r.expires_at);
  const featured = r.featured_until && new Date(r.featured_until) > new Date();
  const ids = [r.id];
  return (
    <tr onClick={onOpen} className={selected ? "cursor-pointer bg-primary/5" : "cursor-pointer hover:bg-elevated/50"}>
      <Td>
        <Checkbox label="Seç" checked={selected} onChange={onSelect} />
      </Td>
      <Td>
        <div className="flex min-w-0 items-center gap-3">
          <Thumb src={r.cover ? photoSrc(r.cover, 240) : null} className="size-12" />
          <div className="min-w-0 max-w-[340px]">
            <p className="truncate font-medium">{r.title}</p>
            <p className="mt-0.5 flex items-center gap-2 text-xs text-muted">
              <span className="font-mono">#{r.listing_no}</span>
              <ListingStats views={r.view_count} favs={r.fav_count} reports={r.open_reports} />
              {r.photo_count ? <span>{r.photo_count} foto</span> : <span className="text-warn">fotoğrafsız</span>}
            </p>
          </div>
        </div>
      </Td>
      <Td className="max-w-[180px]">
        <span className="block truncate text-xs text-muted" title={r.category_name}>
          {r.category_name}
        </span>
        <span className="block truncate text-xs text-subtle">{[r.city, r.district].filter(Boolean).join(" / ")}</span>
      </Td>
      <Td className="whitespace-nowrap text-right font-semibold tabular-nums">{money(r.price, r.currency)}</Td>
      <Td>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSeller();
          }}
          className="max-w-[150px] truncate text-left text-xs font-medium hover:text-primary hover:underline"
          title="Bu satıcının ilanlarını filtrele"
        >
          {r.seller_name}
        </button>
        {r.store_name ? <span className="block truncate text-[11px] text-violet-700">{r.store_name}</span> : null}
        {r.seller_banned ? <span className="block text-[11px] font-semibold text-danger">askıda</span> : null}
      </Td>
      <Td>
        <div className="flex flex-col items-start gap-1">
          <Pill tone={st.tone} dot>
            {st.label}
          </Pill>
          {featured ? <Pill tone="violet">Vitrin</Pill> : null}
        </div>
      </Td>
      <Td className="whitespace-nowrap text-xs text-muted">
        <span className="block" title="Oluşturulma">
          {dateOnly(r.created_at)}
        </span>
        {r.expires_at ? <span className="block text-subtle">bitiş {relative(r.expires_at)}</span> : null}
      </Td>
      <Td onClick={(e) => e.stopPropagation()}>
        <Menu>
          <MenuItem icon={Eye} onSelect={onOpen}>
            Ayrıntılar
          </MenuItem>
          <MenuItem icon={ExternalLink} onSelect={() => window.open(`/ilan/${r.slug}`, "_blank", "noopener")}>
            Sitede gör
          </MenuItem>
          <MenuSeparator />
          {r.status !== "ACTIVE" ? (
            <MenuItem icon={Check} onSelect={() => void act(ids, "approve", r.title)}>
              Onayla / yayına al
            </MenuItem>
          ) : (
            <MenuItem icon={Ban} onSelect={() => void act(ids, "deactivate", r.title)}>
              Yayından kaldır
            </MenuItem>
          )}
          {r.status !== "REJECTED" ? (
            <MenuItem icon={X} onSelect={() => void act(ids, "reject", r.title)}>
              Reddet
            </MenuItem>
          ) : null}
          <MenuItem icon={CalendarPlus} onSelect={() => void act(ids, "extend", r.title)}>
            Süre uzat
          </MenuItem>
          {featured ? (
            <MenuItem icon={Undo2} onSelect={() => void act(ids, "unfeature", r.title)}>
              Vitrinden çıkar
            </MenuItem>
          ) : (
            <MenuItem icon={Sparkles} onSelect={() => void act(ids, "feature", r.title)}>
              Vitrine al
            </MenuItem>
          )}
          <MenuItem icon={FolderInput} onSelect={() => void act(ids, "move", r.title)}>
            Kategori değiştir
          </MenuItem>
          {r.status !== "SOLD" ? (
            <MenuItem icon={Tag} onSelect={() => void act(ids, "sold", r.title)}>
              Satıldı işaretle
            </MenuItem>
          ) : null}
          <MenuSeparator />
          <MenuItem icon={Trash2} danger onSelect={() => void act(ids, "delete", r.title)}>
            Kalıcı olarak sil
          </MenuItem>
        </Menu>
      </Td>
    </tr>
  );
}
