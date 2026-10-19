import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ExternalLink, LayoutList, Pencil, Plus, Store, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { slugify } from "@/lib/utils";
import { adminDeleteStore, adminListStores, adminSaveStore, STORE_PLANS, type AdminStoreRow } from "@/lib/server/admin/business";
import { useRunner, useSheets } from "@/components/admin/hooks";
import { dateOnly, n } from "@/components/admin/format";
import { int, str } from "@/components/admin/search";
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
  SelectBox,
  SkeletonRows,
  Spinner,
  Table,
  Td,
  textareaClass,
  Th,
  useConfirm,
} from "@/components/admin/ui";

type Search = { q?: string; plan?: string; page?: number };

export const Route = createFileRoute("/admin/magazalar")({
  validateSearch: (s: Record<string, unknown>): Search => ({ q: str(s.q), plan: str(s.plan, 20), page: int(s.page, 1, 100_000) }),
  component: StoresPage,
});

const PLAN_LABEL: Record<string, string> = { BASIC: "Standart", PRO: "Pro", PREMIUM: "Premium" };

function StoresPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const set = (patch: Partial<Search>, resetPage = true) =>
    void navigate({ search: (prev) => ({ ...prev, ...(resetPage ? { page: undefined } : {}), ...patch }), replace: true });
  const filter = { q: search.q, plan: search.plan, page: search.page ?? 1, pageSize: 25 };
  const query = useQuery({ queryKey: ["admin", "stores", filter], queryFn: () => adminListStores({ data: filter }), placeholderData: keepPreviousData });
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
        description="Kurumsal mağazalar ekip tarafından açılır. Başvuran üye için buradan mağaza oluşturun ve paketini yönetin."
        actions={
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus className="size-4" /> Mağaza aç
          </Button>
        }
      />
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <SearchInput value={search.q ?? ""} onChange={(q) => set({ q: q || undefined })} placeholder="Mağaza adı, adres, sahip veya e-posta" className="w-full sm:w-80" />
          <SelectBox
            label="Paket"
            value={search.plan ?? ""}
            onChange={(v) => set({ plan: v || undefined })}
            options={[{ value: "", label: "Tüm paketler" }, ...STORE_PLANS.map((p) => ({ value: p, label: PLAN_LABEL[p] }))]}
          />
        </div>
        {query.error ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : query.isLoading ? (
          <SkeletonRows rows={5} />
        ) : !rows.length ? (
          <EmptyState
            icon={Store}
            title="Henüz mağaza yok"
            description="Kurumsal üyeler için ilk mağazayı açın; üyenin mevcut ilanları mağazaya bağlanabilir."
            action={
              <Button size="sm" onClick={() => setEditing("new")}>
                <Plus className="size-4" /> Mağaza aç
              </Button>
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
                      <span className="flex size-10 items-center justify-center rounded-lg bg-violet-500/10 text-violet-700">
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
      </Card>

      {editing ? <StoreModal store={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

function StoreModal({ store, onClose }: { store: AdminStoreRow | null; onClose: () => void }) {
  const { run, busy } = useRunner();
  const [form, setForm] = useState({
    owner: "",
    name: store?.name ?? "",
    slug: store?.slug ?? "",
    description: store?.description ?? "",
    city: store?.city ?? "",
    phone: store?.phone ?? "",
    plan: (store?.plan as (typeof STORE_PLANS)[number]) ?? "BASIC",
    attachListings: true,
  });
  const [slugTouched, setSlugTouched] = useState(Boolean(store));
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={store ? `"${store.name}" mağazasını düzenle` : "Yeni mağaza aç"}
      description={store ? undefined : "Mağaza, e-postası veya kullanıcı kimliği girilen üyeye bağlanır. Üyeye bildirim gönderilir."}
      size="lg"
      footer={
        <>
          <Button size="sm" variant="outline" onClick={onClose}>
            Vazgeç
          </Button>
          <Button
            size="sm"
            disabled={busy || form.name.trim().length < 3 || (!store && !form.owner.trim())}
            onClick={() =>
              void run(
                () =>
                  adminSaveStore({
                    data: {
                      id: store?.id,
                      owner: store ? undefined : form.owner,
                      name: form.name,
                      slug: form.slug || undefined,
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
          <Field label="Mağaza sahibi" hint="Üyenin giriş e-postası veya kullanıcı kimliği" className="sm:col-span-2">
            <input value={form.owner} onChange={set("owner")} className={inputClass} placeholder="ornek@firma.com" autoFocus />
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
        <Field label="Adres (geldesat.com/magaza/…)" hint="Değiştirirseniz eski bağlantılar çalışmaz.">
          <input
            value={form.slug}
            onChange={(e) => {
              setSlugTouched(true);
              setForm((f) => ({ ...f, slug: e.target.value }));
            }}
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
          <input value={form.city} onChange={set("city")} className={inputClass} />
        </Field>
        <Field label="Mağaza telefonu" className="sm:col-span-2">
          <input value={form.phone} onChange={set("phone")} className={inputClass} placeholder="05xx xxx xx xx" />
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
