import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Check, ExternalLink, Inbox, LayoutList, Pencil, Plus, Store, Trash2, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { slugify } from "@/lib/utils";
import {
  adminDeleteStore,
  adminListStoreApplications,
  adminListStores,
  adminResolveStoreApplication,
  adminSaveStore,
  STORE_PLANS,
  type AdminStoreApplicationRow,
  type AdminStoreRow,
} from "@/lib/server/admin/business";
import { adminListUsers } from "@/lib/server/admin/users";
import { useRunner, useSheets } from "@/components/admin/hooks";
import { dateOnly, dateTime, n } from "@/components/admin/format";
import { int, oneOf, str } from "@/components/admin/search";
import {
  Avatar,
  Card,
  EmptyState,
  ErrorState,
  Field,
  inputClass,
  Menu,
  MenuItem,
  MenuSeparator,
  Modal,
  PageHeader,
  Pagination,
  Pill,
  SearchInput,
  Segmented,
  SelectBox,
  SkeletonRows,
  Spinner,
  TabBar,
  Table,
  Td,
  textareaClass,
  Th,
  useConfirm,
} from "@/components/admin/ui";

const TABS = ["stores", "applications"] as const;
const APP_STATUSES = ["ALL", "PENDING", "APPROVED", "REJECTED"] as const;
type StorePlan = (typeof STORE_PLANS)[number];

type Search = { tab?: (typeof TABS)[number]; q?: string; plan?: string; status?: (typeof APP_STATUSES)[number]; page?: number };

export const Route = createFileRoute("/admin/magazalar")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    tab: oneOf(s.tab, TABS),
    q: str(s.q),
    plan: str(s.plan, 20),
    status: oneOf(s.status, APP_STATUSES),
    page: int(s.page, 1, 100_000),
  }),
  component: StoresPage,
});

const PLAN_LABEL: Record<string, string> = { BASIC: "Standart", PRO: "Pro", PREMIUM: "Premium" };
const APP_STATUS_META: Record<string, { label: string; tone: "warn" | "ok" | "danger" | "muted" }> = {
  PENDING: { label: "Bekliyor", tone: "warn" },
  APPROVED: { label: "Onaylandı", tone: "ok" },
  REJECTED: { label: "Reddedildi", tone: "danger" },
};

function StoresPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const tab = search.tab ?? "stores";
  const set = (patch: Partial<Search>, resetPage = true) =>
    void navigate({ search: (prev) => ({ ...prev, ...(resetPage ? { page: undefined } : {}), ...patch }), replace: true });
  const filter = { q: tab === "stores" ? search.q : undefined, plan: tab === "stores" ? search.plan : undefined, page: tab === "stores" ? (search.page ?? 1) : 1, pageSize: 25 };
  const query = useQuery({ queryKey: ["admin", "stores", filter], queryFn: () => adminListStores({ data: filter }), placeholderData: keepPreviousData });
  const appsFilter = {
    status: tab === "applications" ? (search.status ?? "ALL") : ("PENDING" as const),
    q: tab === "applications" ? search.q : undefined,
    page: tab === "applications" ? (search.page ?? 1) : 1,
    pageSize: tab === "applications" ? 25 : 5,
  };
  const appsQuery = useQuery({
    queryKey: ["admin", "store-applications", appsFilter],
    queryFn: () => adminListStoreApplications({ data: appsFilter }),
    placeholderData: keepPreviousData,
  });
  const [editing, setEditing] = useState<AdminStoreRow | "new" | null>(null);
  const { openUser } = useSheets();
  const { run } = useRunner();
  const { confirm } = useConfirm();
  const rows = query.data?.rows ?? [];

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        icon={Store}
        title="Mağazalar"
        description="Kurumsal mağazaları ve mağaza başvurularını yönetin."
        actions={
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus className="size-4" /> Mağaza aç
          </Button>
        }
      />
      <Card>
        <TabBar
          value={tab}
          onChange={(v) => set({ tab: v === "stores" ? undefined : v, q: undefined, plan: undefined, status: undefined })}
          items={[
            { value: "stores", label: "Mağazalar", count: query.data?.total },
            { value: "applications", label: "Başvurular", count: appsQuery.data?.totals.pending },
          ]}
        />
        {tab === "stores" ? (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
              <SearchInput value={search.q ?? ""} onChange={(q) => set({ q: q || undefined })} placeholder="Mağaza adı, adres, sahip veya e-posta" className="w-full sm:w-80" />
              <SelectBox
                label="Paket"
                value={search.plan ?? ""}
                onChange={(v) => set({ plan: v || undefined })}
                options={[{ value: "", label: "Tüm paketler" }, ...STORE_PLANS.map((p) => ({ value: p, label: PLAN_LABEL[p] }))]}
              />
            </div>
            {query.error && !query.data ? (
              <ErrorState error={query.error} onRetry={() => void query.refetch()} />
            ) : query.isLoading ? (
              <SkeletonRows rows={5} />
            ) : !rows.length ? (
              <EmptyState
                icon={Store}
                title={search.q || search.plan ? "Eşleşen mağaza yok" : "Henüz mağaza yok"}
                description={
                  search.q || search.plan
                    ? "Arama veya paket filtresini değiştirerek tekrar deneyin."
                    : "Kurumsal üyeler için ilk mağazayı açın; üyenin mevcut ilanları mağazaya bağlanabilir."
                }
                action={
                  search.q || search.plan ? (
                    <Button size="sm" variant="outline" onClick={() => set({ q: undefined, plan: undefined })}>
                      Filtreleri temizle
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => setEditing("new")}>
                      <Plus className="size-4" /> Mağaza aç
                    </Button>
                  )
                }
              />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Mağaza</Th>
                    <Th>Sahibi</Th>
                    <Th>Paket</Th>
                    <Th className="text-right">İlan</Th>
                    <Th>İl</Th>
                    <Th>Açılış</Th>
                    <Th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => (
                    <tr key={s.id} className="hover:bg-elevated/50">
                      <Td>
                        <div className="flex items-center gap-3">
                          <span className="flex size-10 items-center justify-center rounded-lg bg-violet-500/10 text-violet">
                            <Store className="size-5" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{s.name}</p>
                            <p className="truncate text-xs text-muted">/magaza/{s.slug}</p>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <button type="button" onClick={() => openUser(s.user_id)} className="flex items-center gap-2 text-left hover:text-primary">
                          <Avatar name={s.owner_name} size={26} />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{s.owner_name}</span>
                            <span className="block truncate text-xs text-muted">{s.owner_email}</span>
                          </span>
                        </button>
                        {s.owner_banned ? <Pill tone="danger">Sahibi askıda</Pill> : null}
                      </Td>
                      <Td>
                        <Pill tone={s.plan === "PREMIUM" ? "violet" : s.plan === "PRO" ? "primary" : "muted"}>{PLAN_LABEL[s.plan] ?? s.plan}</Pill>
                      </Td>
                      <Td className="text-right tabular-nums">
                        <span className="font-semibold">{n(s.active_count)}</span>
                        <span className="text-xs text-muted"> / {n(s.listing_count)}</span>
                      </Td>
                      <Td className="text-xs text-muted">{s.city ?? "—"}</Td>
                      <Td className="whitespace-nowrap text-xs text-muted">{dateOnly(s.created_at)}</Td>
                      <Td>
                        <Menu>
                          <MenuItem icon={Pencil} onSelect={() => setEditing(s)}>
                            Düzenle
                          </MenuItem>
                          <MenuItem icon={ExternalLink} onSelect={() => window.open(`/magaza/${s.slug}`, "_blank", "noopener")}>
                            Mağaza sayfası
                          </MenuItem>
                          <MenuItem icon={LayoutList} onSelect={() => void navigate({ to: "/admin/ilanlar", search: { userId: s.user_id } })}>
                            İlanları
                          </MenuItem>
                          <MenuItem icon={User} onSelect={() => openUser(s.user_id)}>
                            Sahibinin profili
                          </MenuItem>
                          <MenuSeparator />
                          <MenuItem
                            icon={Trash2}
                            danger
                            onSelect={() =>
                              void confirm({
                                title: `"${s.name}" mağazası kapatılsın mı?`,
                                body: "Mağaza sayfası kaldırılır; ilanlar üyenin bireysel ilanı olarak yayında kalır.",
                                confirmLabel: "Mağazayı kapat",
                                danger: true,
                              }).then((ok) => {
                                if (ok) void run(() => adminDeleteStore({ data: { id: s.id } }), "Mağaza kapatıldı.");
                              })
                            }
                          >
                            Mağazayı kapat
                          </MenuItem>
                        </Menu>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
            {query.data && query.data.total > query.data.pageSize ? (
              <Pagination page={query.data.page} pages={query.data.pages} total={query.data.total} pageSize={query.data.pageSize} onPage={(page) => set({ page }, false)} />
            ) : null}
          </>
        ) : (
          <ApplicationsTab
            rows={appsQuery.data?.rows ?? []}
            totals={appsQuery.data?.totals}
            isLoading={appsQuery.isLoading}
            error={appsQuery.error}
            hasData={Boolean(appsQuery.data)}
            onRetry={() => void appsQuery.refetch()}
            pagination={
              appsQuery.data && appsQuery.data.total > appsQuery.data.pageSize
                ? { page: appsQuery.data.page, pages: appsQuery.data.pages, total: appsQuery.data.total, pageSize: appsQuery.data.pageSize }
                : null
            }
            search={search}
            set={set}
          />
        )}
      </Card>

      {editing ? <StoreModal store={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

function ApplicationsTab({
  rows,
  totals,
  isLoading,
  error,
  hasData,
  onRetry,
  pagination,
  search,
  set,
}: {
  rows: AdminStoreApplicationRow[];
  totals?: { all: number; pending: number; approved: number; rejected: number };
  isLoading: boolean;
  error: unknown;
  hasData: boolean;
  onRetry: () => void;
  pagination: { page: number; pages: number; total: number; pageSize: number } | null;
  search: Search;
  set: (patch: Partial<Search>, resetPage?: boolean) => void;
}) {
  const { openUser } = useSheets();
  const { run, busy } = useRunner();
  const { confirm, prompt } = useConfirm();
  const [plans, setPlans] = useState<Record<string, StorePlan>>({});
  const [detailApp, setDetailApp] = useState<AdminStoreApplicationRow | null>(null);

  async function approve(a: AdminStoreApplicationRow) {
    if (a.applicant_banned) return;
    const plan = plans[a.id] ?? "BASIC";
    const ok = await confirm({
      title: `"${a.name}" başvurusu onaylansın mı?`,
      body: a.existing_store_id
        ? `Başvuranın mevcut mağazasının paketi ${PLAN_LABEL[plan]} olarak güncellenir ve başvuru onaylanır.`
        : `Üye için ${PLAN_LABEL[plan]} paketli mağaza açılır ve bildirim gönderilir.`,
      confirmLabel: "Onayla",
    });
    if (!ok) return;
    await run(() => adminResolveStoreApplication({ data: { id: a.id, action: "approve", plan } }), "Başvuru onaylandı.");
  }

  async function reject(a: AdminStoreApplicationRow) {
    const note = await prompt({
      title: `"${a.name}" başvurusu reddedilsin mi?`,
      body: "İsteğe bağlı olarak ret gerekçesi ekleyebilirsiniz; üyeye bildirilir.",
      label: "Ret gerekçesi (isteğe bağlı)",
      required: false,
      confirmLabel: "Reddet",
      danger: true,
    });
    if (note == null) return;
    await run(() => adminResolveStoreApplication({ data: { id: a.id, action: "reject", note: note || undefined } }), "Başvuru reddedildi.");
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <Segmented
          value={search.status ?? "ALL"}
          onChange={(s) => set({ status: s === "ALL" ? undefined : s })}
          items={[
            { value: "ALL", label: "Tümü", count: totals?.all },
            { value: "PENDING", label: "Bekleyen", count: totals?.pending, tone: "warn" },
            { value: "APPROVED", label: "Onaylanan", count: totals?.approved },
            { value: "REJECTED", label: "Reddedilen", count: totals?.rejected },
          ]}
        />
        <SearchInput value={search.q ?? ""} onChange={(q) => set({ q: q || undefined })} placeholder="Mağaza adı, üye, e-posta veya vergi no" className="ml-auto w-full sm:w-80" />
      </div>
      {error && !hasData ? (
        <ErrorState error={error} onRetry={onRetry} />
      ) : isLoading ? (
        <SkeletonRows rows={5} />
      ) : !rows.length ? (
        <EmptyState icon={Inbox} title="Başvuru yok" description="Yeni kurumsal mağaza başvuruları geldiğinde burada listelenir." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Mağaza talebi</Th>
              <Th>Başvuran</Th>
              <Th>Vergi / Not</Th>
              <Th>Durum</Th>
              <Th>Tarih</Th>
              <Th className="text-right">İşlem</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const st = APP_STATUS_META[a.status] ?? { label: a.status, tone: "muted" as const };
              const plan = plans[a.id] ?? "BASIC";
              return (
                <tr key={a.id} className="hover:bg-elevated/50">
                  <Td>
                    <p className="font-semibold">{a.name}</p>
                    <p className="text-xs text-muted">{[a.city, a.phone].filter(Boolean).join(" · ") || "—"}</p>
                  </Td>
                  <Td>
                    <button type="button" onClick={() => openUser(a.user_id)} className="flex items-center gap-2 text-left hover:text-primary">
                      <Avatar name={a.applicant_name} src={a.applicant_avatar} size={28} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{a.applicant_name}</span>
                        <span className="block truncate text-xs text-muted">{a.applicant_email ?? a.user_id}</span>
                      </span>
                    </button>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {a.applicant_banned ? <Pill tone="danger">Askıda</Pill> : null}
                      {a.existing_store_id ? <Pill tone="primary">Mağazası var</Pill> : null}
                    </div>
                  </Td>
                  <Td className="max-w-xs text-xs">
                    {a.tax_no ? <p className="font-mono text-fg">VN: {a.tax_no}</p> : null}
                    {a.notes ? (
                      <button type="button" onClick={() => setDetailApp(a)} className="mt-0.5 text-left text-muted hover:text-primary">
                        <span className="line-clamp-2">{a.notes}</span>
                        {a.notes.length > 80 ? <span className="text-[11px] font-medium text-primary">Tamamını oku</span> : null}
                      </button>
                    ) : !a.tax_no ? (
                      <span className="text-subtle">—</span>
                    ) : null}
                  </Td>
                  <Td>
                    <Pill tone={st.tone} dot>
                      {st.label}
                    </Pill>
                    {a.review_note ? <p className="mt-1 max-w-xs text-xs text-muted">{a.review_note}</p> : null}
                    {a.reviewed_at ? (
                      <p className="mt-0.5 text-[11px] text-subtle">
                        {a.reviewed_by_name ? `${a.reviewed_by_name} · ` : ""}
                        {dateTime(a.reviewed_at)}
                      </p>
                    ) : null}
                  </Td>
                  <Td className="whitespace-nowrap text-xs text-muted">{dateOnly(a.created_at)}</Td>
                  <Td className="text-right">
                    {a.status === "PENDING" ? (
                      <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                        <select
                          aria-label="Mağaza paketi"
                          value={plan}
                          disabled={busy}
                          onChange={(e) => setPlans((prev) => ({ ...prev, [a.id]: e.target.value as StorePlan }))}
                          className="admin-select h-8 text-xs"
                        >
                          {STORE_PLANS.map((p) => (
                            <option key={p} value={p}>
                              {PLAN_LABEL[p]}
                            </option>
                          ))}
                        </select>
                        <Button
                          size="sm"
                          className="h-8 bg-ok-solid text-white hover:bg-ok-solid/90"
                          disabled={busy || a.applicant_banned}
                          title={a.applicant_banned ? "Askıda olan üyenin başvurusu onaylanamaz" : undefined}
                          onClick={() => void approve(a)}
                        >
                          <Check className="size-3.5" /> Onayla
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 text-danger" disabled={busy} onClick={() => void reject(a)}>
                          <X className="size-3.5" /> Reddet
                        </Button>
                      </div>
                    ) : a.existing_store_slug ? (
                      <a href={`/magaza/${a.existing_store_slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                        Mağaza <ExternalLink className="size-3" />
                      </a>
                    ) : (
                      <span className="text-xs text-subtle">—</span>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
      {pagination ? (
        <Pagination page={pagination.page} pages={pagination.pages} total={pagination.total} pageSize={pagination.pageSize} onPage={(page) => set({ page }, false)} />
      ) : null}
      {detailApp ? (
        <Modal open onOpenChange={(o) => !o && setDetailApp(null)} title={`${detailApp.name} — Başvuru notu`} size="md">
          <div className="space-y-3 text-sm">
            <p className="text-xs text-muted">
              Başvuran: <strong className="text-fg">{detailApp.applicant_name}</strong>
              {detailApp.tax_no ? ` · VN: ${detailApp.tax_no}` : ""}
            </p>
            <p className="whitespace-pre-wrap break-words rounded-xl border border-border bg-elevated/40 p-3">{detailApp.notes}</p>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

function StoreModal({ store, onClose }: { store: AdminStoreRow | null; onClose: () => void }) {
  const { run, busy } = useRunner();
  const { confirm } = useConfirm();
  const [ownerQuery, setOwnerQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<{ user_id: string; display_name: string; email: string | null; store_name: string | null; banned_at: string | null } | null>(null);
  const userSearch = useQuery({
    queryKey: ["admin", "store-owner-search", ownerQuery],
    queryFn: () => adminListUsers({ data: { q: ownerQuery, role: "ALL", state: "all", sort: "newest", page: 1, pageSize: 8 } }),
    enabled: !store && !selectedUser && ownerQuery.trim().length >= 2,
  });

  const initial = {
    owner: "",
    name: store?.name ?? "",
    slug: store?.slug ?? "",
    description: store?.description ?? "",
    city: store?.city ?? "",
    phone: store?.phone ?? "",
    plan: (store?.plan as (typeof STORE_PLANS)[number]) ?? "BASIC",
    attachListings: true,
  };
  const [form, setForm] = useState(initial);
  const [slugTouched, setSlugTouched] = useState(Boolean(store));
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const dirty = JSON.stringify(form) !== JSON.stringify(initial) || Boolean(selectedUser);
  const resolvedOwner = selectedUser?.user_id ?? form.owner.trim();
  const effectiveSlug = slugify(form.slug.trim() || (store ? store.slug : form.name));

  async function requestClose() {
    if (dirty) {
      const ok = await confirm({ title: "Kaydedilmemiş değişiklikler silinsin mi?", confirmLabel: "Kapat", danger: true });
      if (!ok) return;
    }
    onClose();
  }

  return (
    <Modal
      open
      onOpenChange={(o) => {
        if (!o) void requestClose();
      }}
      title={store ? `"${store.name}" mağazasını düzenle` : "Yeni mağaza aç"}
      description={store ? undefined : "Mağaza seçilen üyeye bağlanır. Üyeye bildirim gönderilir."}
      size="lg"
      footer={
        <>
          <Button size="sm" variant="outline" onClick={() => void requestClose()}>
            Vazgeç
          </Button>
          <Button
            size="sm"
            disabled={busy || form.name.trim().length < 3 || !effectiveSlug || (!store && !resolvedOwner)}
            onClick={() =>
              void run(
                () =>
                  adminSaveStore({
                    data: {
                      id: store?.id,
                      owner: store ? undefined : resolvedOwner,
                      name: form.name,
                      slug: store ? form.slug.trim() || store.slug : form.slug.trim() || undefined,
                      description: form.description,
                      city: form.city,
                      phone: form.phone,
                      plan: form.plan,
                      attachListings: form.attachListings,
                    },
                  }),
                store ? "Mağaza güncellendi." : "Mağaza açıldı.",
              ).then((r) => {
                if (r) onClose();
              })
            }
          >
            {busy ? <Spinner /> : null} {store ? "Kaydet" : "Mağazayı aç"}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {!store ? (
          <Field label="Mağaza sahibi" hint="Ad, e-posta veya kullanıcı kimliğiyle arayın" className="sm:col-span-2">
            {selectedUser ? (
              <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-2.5">
                <Avatar name={selectedUser.display_name} size={30} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{selectedUser.display_name}</p>
                  <p className="truncate text-xs text-muted">{selectedUser.email ?? selectedUser.user_id}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setSelectedUser(null)}>
                  Değiştir
                </Button>
              </div>
            ) : (
              <div>
                <SearchInput
                  value={ownerQuery}
                  onChange={(v) => {
                    setOwnerQuery(v);
                    setForm((f) => ({ ...f, owner: v }));
                  }}
                  placeholder="Üye adı, e-posta veya kullanıcı kimliği…"
                  autoFocus
                />
                {userSearch.isFetching ? (
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
                    <Spinner className="size-3.5" /> Üyeler aranıyor…
                  </p>
                ) : ownerQuery.trim().length >= 2 && userSearch.data && !userSearch.data.rows.length ? (
                  <p className="mt-1.5 text-xs text-muted">Eşleşen üye bulunamadı (tam kullanıcı kimliği veya e-posta yazabilirsiniz).</p>
                ) : userSearch.data?.rows.length ? (
                  <ul className="mt-1.5 max-h-44 divide-y divide-border overflow-y-auto rounded-lg border border-border">
                    {userSearch.data.rows.map((u) => {
                      const blocked = Boolean(u.banned_at || u.store_name);
                      return (
                        <li key={u.user_id}>
                          <button
                            type="button"
                            disabled={blocked}
                            onClick={() => setSelectedUser(u)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-elevated disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Avatar name={u.display_name} src={u.avatar_url} size={24} />
                            <span className="min-w-0 flex-1 truncate font-medium">{u.display_name}</span>
                            <span className="truncate text-xs text-muted">{u.email}</span>
                            {u.store_name ? <Pill>Mağazası var</Pill> : u.banned_at ? <Pill tone="danger">Askıda</Pill> : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            )}
          </Field>
        ) : null}
        <Field label="Mağaza adı">
          <input
            value={form.name}
            onChange={(e) => {
              const name = e.target.value;
              setForm((f) => ({ ...f, name, slug: slugTouched ? f.slug : slugify(name) }));
            }}
            maxLength={60}
            className={inputClass}
          />
        </Field>
        <Field label="Adres (geldesat.com/magaza/…)" hint="Değiştirirseniz eski bağlantılar çalışmaz." error={!effectiveSlug && form.name ? "Geçerli harf/rakam içermeli." : null}>
          <input
            value={form.slug}
            onChange={(e) => {
              setSlugTouched(true);
              setForm((f) => ({ ...f, slug: e.target.value }));
            }}
            maxLength={80}
            className={inputClass}
          />
        </Field>
        <Field label="Paket">
          <select value={form.plan} onChange={(e) => setForm((f) => ({ ...f, plan: e.target.value as typeof f.plan }))} className="admin-select h-10 w-full">
            {STORE_PLANS.map((p) => (
              <option key={p} value={p}>
                {PLAN_LABEL[p]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="İl">
          <input value={form.city} onChange={set("city")} maxLength={40} className={inputClass} />
        </Field>
        <Field label="Mağaza telefonu" className="sm:col-span-2">
          <input value={form.phone} onChange={set("phone")} maxLength={20} className={inputClass} placeholder="05xx xxx xx xx" />
        </Field>
        <Field label="Açıklama" className="sm:col-span-2">
          <textarea value={form.description} onChange={set("description")} rows={3} maxLength={400} className={textareaClass} />
        </Field>
        {!store ? (
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={form.attachListings} onChange={(e) => setForm((f) => ({ ...f, attachListings: e.target.checked }))} className="size-4 accent-primary" />
            Üyenin mevcut ilanlarını bu mağazaya bağla
          </label>
        ) : null}
      </div>
    </Modal>
  );
}
