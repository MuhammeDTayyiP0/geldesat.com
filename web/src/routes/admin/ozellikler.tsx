import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FolderTree, Network, Pencil, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { adminAttributeUsage, adminDeleteAttribute, adminListAttributes, adminSaveAttribute, ATTRIBUTE_TYPES, type AdminAttribute, type AttributeType } from "@/lib/server/admin/attributes";
import { useRunner } from "@/components/admin/hooks";
import { ATTRIBUTE_TYPE_LABEL, n } from "@/components/admin/format";
import { oneOf, str } from "@/components/admin/search";
import {
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
  Pill,
  SearchInput,
  Segmented,
  SkeletonRows,
  Spinner,
  Table,
  Td,
  textareaClass,
  Th,
  useConfirm,
} from "@/components/admin/ui";

type Search = { q?: string; type?: AttributeType | "ALL"; usage?: "all" | "used" | "unused" };

export const Route = createFileRoute("/admin/ozellikler")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    q: str(s.q),
    type: oneOf(s.type, ["ALL", ...ATTRIBUTE_TYPES] as const),
    usage: oneOf(s.usage, ["all", "used", "unused"] as const),
  }),
  component: AttributesPage,
});

function AttributesPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const set = (patch: Partial<Search>) => void navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });
  const query = useQuery({ queryKey: ["admin", "attributes"], queryFn: () => adminListAttributes() });
  const [editing, setEditing] = useState<AdminAttribute | "new" | null>(null);
  const [usage, setUsage] = useState<AdminAttribute | null>(null);
  const { run } = useRunner();
  const { confirm } = useConfirm();

  const type = search.type ?? "ALL";
  const use = search.usage ?? "all";
  const all = useMemo(() => query.data ?? [], [query.data]);
  const rows = useMemo(() => {
    const needle = (search.q ?? "").toLocaleLowerCase("tr");
    return all.filter(
      (a) =>
        (type === "ALL" || a.type === type) &&
        (use === "all" || (use === "used" ? a.categories > 0 : a.categories === 0)) &&
        (!needle || a.name.toLocaleLowerCase("tr").includes(needle) || a.id.includes(needle) || (a.options ?? []).some((o) => o.toLocaleLowerCase("tr").includes(needle))),
    );
  }, [all, search.q, type, use]);

  const typeCounts = useMemo(() => {
    const m: Record<string, number> = { ALL: all.length };
    for (const a of all) m[a.type] = (m[a.type] ?? 0) + 1;
    return m;
  }, [all]);

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        icon={SlidersHorizontal}
        title="İlan özellikleri"
        description="İlan verirken sorulan ve filtrelerde kullanılan alanlar (oda sayısı, yakıt, km…). Kategoriye atamak için Kategori ağacı → Özellikler sekmesini kullanın."
        actions={
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus className="size-4" /> Yeni özellik
          </Button>
        }
      />
      <Segmented
        value={type}
        onChange={(t) => set({ type: t === "ALL" ? undefined : t })}
        items={[{ value: "ALL" as const, label: "Tümü", count: typeCounts.ALL }, ...ATTRIBUTE_TYPES.map((t) => ({ value: t, label: ATTRIBUTE_TYPE_LABEL[t], count: typeCounts[t] ?? 0 }))]}
      />
      <Card className="mt-3">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <SearchInput value={search.q ?? ""} onChange={(q) => set({ q: q || undefined })} placeholder="Özellik adı, kimlik veya seçenek" className="w-full sm:w-80" />
          <Segmented
            value={use}
            onChange={(u) => set({ usage: u === "all" ? undefined : u })}
            items={[
              { value: "all", label: "Hepsi" },
              { value: "used", label: "Kullanılanlar" },
              { value: "unused", label: "Hiçbir kategoride yok" },
            ]}
          />
          <span className="ml-auto text-xs text-muted">{n(rows.length)} özellik</span>
        </div>
        {query.error ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : query.isLoading ? (
          <SkeletonRows rows={8} />
        ) : !rows.length ? (
          <EmptyState icon={SlidersHorizontal} title="Özellik bulunamadı" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Özellik</Th>
                <Th>Tür</Th>
                <Th>Seçenekler</Th>
                <Th>Kullanım</Th>
                <Th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} className="hover:bg-elevated/50">
                  <Td>
                    <button type="button" onClick={() => setEditing(a)} className="text-left">
                      <p className="font-medium hover:text-primary">
                        {a.name} {a.unit ? <span className="text-xs font-normal text-muted">({a.unit})</span> : null}
                      </p>
                      <p className="font-mono text-[11px] text-subtle">{a.id}</p>
                    </button>
                  </Td>
                  <Td>
                    <Pill tone={a.type === "SELECT" || a.type === "MULTI" ? "primary" : a.type === "NUMBER" ? "violet" : "muted"}>{ATTRIBUTE_TYPE_LABEL[a.type] ?? a.type}</Pill>
                  </Td>
                  <Td className="max-w-[360px]">
                    {a.options?.length && a.type !== "BOOLEAN" ? (
                      <p className="truncate text-xs text-muted" title={a.options.join(", ")}>
                        <span className="font-semibold text-fg">{a.options.length}</span> · {a.options.slice(0, 6).join(", ")}
                        {a.options.length > 6 ? "…" : ""}
                      </p>
                    ) : (
                      <span className="text-xs text-subtle">—</span>
                    )}
                  </Td>
                  <Td>
                    <button type="button" onClick={() => setUsage(a)} className="text-left text-xs hover:text-primary">
                      {a.categories ? (
                        <>
                          <span className="font-semibold">{n(a.categories)} kategori</span>
                          {a.required_in ? <span className="text-muted"> · {a.required_in} zorunlu</span> : null}
                          <span className="block max-w-[260px] truncate text-subtle">{a.sample.join(", ")}</span>
                        </>
                      ) : (
                        <span className="text-warn">Kullanılmıyor</span>
                      )}
                    </button>
                  </Td>
                  <Td>
                    <Menu>
                      <MenuItem icon={Pencil} onSelect={() => setEditing(a)}>
                        Düzenle
                      </MenuItem>
                      <MenuItem icon={Network} onSelect={() => setUsage(a)}>
                        Kullanıldığı kategoriler
                      </MenuItem>
                      <MenuSeparator />
                      <MenuItem
                        icon={Trash2}
                        danger
                        onSelect={() =>
                          void confirm({
                            title: `"${a.name}" silinsin mi?`,
                            body: a.categories
                              ? `Özellik ${a.categories} kategoriden kaldırılır ve ilan verme formunda artık sorulmaz. Mevcut ilanlardaki değerler saklanır.`
                              : "Özellik hiçbir kategoride kullanılmıyor.",
                            confirmLabel: "Sil",
                            danger: true,
                          }).then((ok) => {
                            if (ok) void run(() => adminDeleteAttribute({ data: { id: a.id } }), "Özellik silindi.");
                          })
                        }
                      >
                        Sil
                      </MenuItem>
                    </Menu>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {editing ? <AttributeModal attr={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
      {usage ? <UsageModal attr={usage} onClose={() => setUsage(null)} /> : null}
    </div>
  );
}

function AttributeModal({ attr, onClose }: { attr: AdminAttribute | null; onClose: () => void }) {
  const { run, busy } = useRunner();
  const [name, setName] = useState(attr?.name ?? "");
  const [type, setType] = useState<AttributeType>((attr?.type as AttributeType) ?? "SELECT");
  const [options, setOptions] = useState((attr?.options ?? []).join("\n"));
  const [unit, setUnit] = useState(attr?.unit ?? "");
  const [migrate, setMigrate] = useState(true);
  const optionList = [...new Set(options.split("\n").map((o) => o.trim()).filter(Boolean))];
  const needsOptions = type === "SELECT" || type === "MULTI";
  const renamed = attr && name.trim() !== attr.name;
  const removedOptions = attr?.options && needsOptions ? attr.options.filter((o) => !optionList.includes(o)) : [];

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={attr ? `"${attr.name}" özelliğini düzenle` : "Yeni ilan özelliği"}
      size="lg"
      footer={
        <>
          <Button size="sm" variant="outline" onClick={onClose}>
            Vazgeç
          </Button>
          <Button
            size="sm"
            disabled={busy || !name.trim() || (needsOptions && optionList.length < 2)}
            onClick={() =>
              void run(
                () => adminSaveAttribute({ data: { id: attr?.id, name: name.trim(), type, options: needsOptions ? optionList : undefined, unit: unit || undefined, migrateValues: migrate } }),
                (r) => (r.migrated ? `Kaydedildi; ${r.migrated} ilandaki değer yeni ada taşındı.` : "Özellik kaydedildi."),
              ).then((r) => {
                if (r) onClose();
              })
            }
          >
            {busy ? <Spinner /> : null} Kaydet
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Özellik adı" hint="İlan formunda ve filtrelerde bu adla görünür; ilan değerleri de bu adla saklanır.">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className={inputClass} autoFocus />
        </Field>
        {renamed ? (
          <label className="flex items-start gap-2 rounded-lg border border-warn/30 bg-warn/5 p-3 text-xs">
            <input type="checkbox" checked={migrate} onChange={(e) => setMigrate(e.target.checked)} className="mt-0.5 size-4 accent-primary" />
            <span>
              <strong>Mevcut ilanlardaki değerleri yeni ada taşı.</strong> İşaretlemezseniz eski ilanlarda "{attr?.name}" değeri görünmeye devam eder ama formda boş gelir.
            </span>
          </label>
        ) : null}
        <Field label="Tür">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {ATTRIBUTE_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={cn("rounded-lg border px-2 py-2.5 text-xs font-medium", type === t ? "border-primary bg-primary/8 text-primary" : "border-border text-muted hover:border-primary/40")}
              >
                {ATTRIBUTE_TYPE_LABEL[t]}
              </button>
            ))}
          </div>
        </Field>
        {needsOptions ? (
          <Field label={`Seçenekler (${optionList.length})`} hint="Her satıra bir seçenek. Sıralama formdaki sırayı belirler.">
            <textarea value={options} onChange={(e) => setOptions(e.target.value)} rows={8} className={cn(textareaClass, "font-mono")} placeholder={"1+0\n1+1\n2+1"} />
          </Field>
        ) : null}
        {removedOptions.length ? <p className="text-xs text-warn">Kaldırılan seçenekler ({removedOptions.join(", ")}) mevcut ilanlarda değer olarak kalır ama artık seçilemez.</p> : null}
        {type === "NUMBER" ? (
          <Field label="Birim (isteğe bağlı)" hint="ör. m², km, TL, cc">
            <input value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={20} className={inputClass} />
          </Field>
        ) : null}
        {type === "BOOLEAN" ? <p className="text-xs text-muted">Evet / Hayır seçenekleri otomatik oluşturulur.</p> : null}
      </div>
    </Modal>
  );
}

function UsageModal({ attr, onClose }: { attr: AdminAttribute; onClose: () => void }) {
  const q = useQuery({ queryKey: ["admin", "attribute-usage", attr.id], queryFn: () => adminAttributeUsage({ data: { id: attr.id } }) });
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={`"${attr.name}" kullanımı`} description={q.data ? `${n(q.data.listingsWithValue)} ilanda bu özelliğe değer girilmiş.` : undefined} size="lg">
      {q.isLoading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
          <Spinner /> Yükleniyor…
        </div>
      ) : q.data?.links.length ? (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {q.data.links.map((l) => (
            <li key={l.category_id}>
              <Link to="/admin/kategoriler" search={{ id: l.category_id }} onClick={onClose} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-elevated">
                <FolderTree className="size-4 shrink-0 text-muted" />
                <span className="min-w-0 flex-1 truncate">{l.path}</span>
                {l.required ? <Pill tone="primary">Zorunlu</Pill> : <Pill>İsteğe bağlı</Pill>}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="Hiçbir kategoriye bağlı değil" description="Kategori ağacında bir kategori seçip Özellikler sekmesinden ekleyebilirsiniz." />
      )}
    </Modal>
  );
}
