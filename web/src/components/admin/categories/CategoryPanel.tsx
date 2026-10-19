import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowDown,
  ArrowDownAZ,
  ArrowDownZA,
  ArrowUp,
  ChevronRight,
  Copy,
  ExternalLink,
  FolderInput,
  LayoutList,
  ListOrdered,
  Plus,
  Save,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn, slugify } from "@/lib/utils";
import { adminListAttributes } from "@/lib/server/admin/attributes";
import {
  adminCategoryDetail,
  adminCreateCategories,
  adminMoveCategory,
  adminMoveCategoryListings,
  adminReorderCategories,
  adminSetCategoryAttributes,
  adminUpdateCategory,
  type AdminCategoryDetail,
} from "@/lib/server/admin/categories";
import { usePickCategory, useRunner, type CategoryIndex } from "../hooks";
import { ATTRIBUTE_TYPE_LABEL, n } from "../format";
import { ErrorState, Field, inputClass, MiniStat, Pill, Spinner, TabBar, textareaClass } from "../ui";
import { CATEGORY_ICONS, categoryIcon } from "./icons";

type Tab = "info" | "children" | "attributes" | "manage";

export function CategoryPanel({ id, index, onSelect, onRequestDelete }: { id: string; index: CategoryIndex; onSelect: (id: string) => void; onRequestDelete: (id: string) => void }) {
  const q = useQuery({ queryKey: ["admin", "category", id], queryFn: () => adminCategoryDetail({ data: { id } }) });
  const [tab, setTab] = useState<Tab>("info");
  const node = index.byId.get(id);
  const Icon = categoryIcon(node?.icon);
  const path = index.path(id);

  if (!node) return null;
  const kids = index.children.get(id) ?? [];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border px-5 py-4">
        <nav className="flex flex-wrap items-center gap-1 text-xs text-muted">
          {path.slice(0, -1).map((p) => (
            <span key={p.id} className="inline-flex items-center gap-1">
              <button type="button" onClick={() => onSelect(p.id)} className="hover:text-primary hover:underline">
                {p.name}
              </button>
              <ChevronRight className="size-3 text-subtle" />
            </span>
          ))}
        </nav>
        <div className="mt-1.5 flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-bold">{node.name}</h2>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(node.id).then(() => toast.success("Kimlik kopyalandı."));
                }}
                className="inline-flex items-center gap-1 rounded bg-elevated px-1.5 py-0.5 font-mono hover:text-fg"
                title="Kimliği kopyala"
              >
                {node.id} <Copy className="size-3" />
              </button>
              <span>/category/{node.slug}</span>
              <span>· {path.length}. seviye</span>
            </div>
          </div>
          <div className="flex shrink-0 gap-1">
            <Link
              to="/admin/ilanlar"
              search={{ categoryId: id }}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-2 text-xs font-medium text-muted hover:bg-elevated hover:text-fg"
              title="Bu daldaki ilanlar"
            >
              <LayoutList className="size-3.5" /> İlanlar
            </Link>
            <a
              href={`/category/${node.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-2 text-xs font-medium text-muted hover:bg-elevated hover:text-fg"
              title="Sitede gör"
            >
              <ExternalLink className="size-3.5" />
            </a>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 xl:grid-cols-5">
          <MiniStat label="Alt kategori" value={n(kids.length)} />
          <MiniStat label="Tüm alt dallar" value={n(index.descendants.get(id) ?? 0)} />
          <MiniStat label="Yayında ilan" value={n(index.subtreeLive.get(id) ?? 0)} tone="ok" />
          <MiniStat label="Toplam ilan" value={n(index.subtreeListings.get(id) ?? 0)} />
          <MiniStat label="Doğrudan ilan" value={n(node.listings)} />
        </div>
      </div>

      <TabBar
        value={tab}
        onChange={setTab}
        items={[
          { value: "info", label: "Bilgiler" },
          { value: "children", label: "Alt kategoriler", count: kids.length },
          { value: "attributes", label: "Özellikler", count: q.data ? q.data.ownAttributes.length + q.data.inheritedAttributes.length : undefined },
          { value: "manage", label: "Taşı / Sil" },
        ]}
      />

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {q.error ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        ) : !q.data ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted">
            <Spinner /> Yükleniyor…
          </div>
        ) : tab === "info" ? (
          <InfoTab key={`${id}:${node.name}:${node.slug}:${node.icon}`} detail={q.data} isRoot={!node.parent_id} />
        ) : tab === "children" ? (
          <ChildrenTab id={id} index={index} onSelect={onSelect} />
        ) : tab === "attributes" ? (
          <AttributesTab key={id} detail={q.data} onSelect={onSelect} />
        ) : (
          <ManageTab id={id} index={index} detail={q.data} onRequestDelete={onRequestDelete} />
        )}
      </div>
    </div>
  );
}

/* ───────────────────────────── Info ───────────────────────────── */

function InfoTab({ detail, isRoot }: { detail: AdminCategoryDetail; isRoot: boolean }) {
  const c = detail.category;
  const { run, busy } = useRunner();
  const [name, setName] = useState(c.name);
  const [slug, setSlug] = useState(c.slug);
  const [icon, setIcon] = useState(c.icon ?? "");
  const dirty = name.trim() !== c.name || slugify(slug) !== c.slug || (icon || null) !== (c.icon || null);
  const slugChanged = slugify(slug) !== c.slug;

  return (
    <form
      className="max-w-xl space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void run(() => adminUpdateCategory({ data: { id: c.id, name: name.trim(), slug, icon: icon || null } }), "Kategori kaydedildi.");
      }}
    >
      <Field label="Kategori adı">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={inputClass} required />
      </Field>
      <Field
        label="Adres (slug)"
        hint={slugChanged ? undefined : "Kategori sayfasının adresi: geldesat.com/category/…"}
        error={slugChanged ? "Adres değişirse eski kategori bağlantıları ve arama motoru kayıtları çalışmaz." : null}
      >
        <div className="flex gap-2">
          <input value={slug} onChange={(e) => setSlug(e.target.value)} maxLength={100} className={cn(inputClass, "font-mono")} />
          <Button type="button" variant="outline" size="sm" className="h-10 shrink-0" onClick={() => setSlug(slugify(name))}>
            Addan üret
          </Button>
        </div>
      </Field>
      <Field label="İkon" hint={isRoot ? "Ana kategorilerde menüde ve mobil uygulamada görünür." : "Alt kategorilerde genelde gerekmez."}>
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
          <button
            type="button"
            onClick={() => setIcon("")}
            className={cn("flex h-14 flex-col items-center justify-center gap-1 rounded-lg border text-[10px]", !icon ? "border-primary bg-primary/8 text-primary" : "border-border text-muted hover:border-primary/40")}
          >
            <X className="size-4" /> Yok
          </button>
          {CATEGORY_ICONS.map((i) => (
            <button
              key={i.key}
              type="button"
              title={i.label}
              onClick={() => setIcon(i.key)}
              className={cn("flex h-14 flex-col items-center justify-center gap-1 rounded-lg border text-[10px]", icon === i.key ? "border-primary bg-primary/8 text-primary" : "border-border text-muted hover:border-primary/40")}
            >
              <i.icon className="size-4" />
              {i.key}
            </button>
          ))}
        </div>
      </Field>
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={!dirty || busy || !name.trim()}>
          {busy ? <Spinner /> : <Save className="size-4" />} Kaydet
        </Button>
        {dirty ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setName(c.name);
              setSlug(c.slug);
              setIcon(c.icon ?? "");
            }}
          >
            Değişiklikleri geri al
          </Button>
        ) : null}
      </div>
    </form>
  );
}

/* ───────────────────────────── Children ───────────────────────────── */

function ChildrenTab({ id, index, onSelect }: { id: string; index: CategoryIndex; onSelect: (id: string) => void }) {
  const { run, busy } = useRunner();
  const kids = index.children.get(id) ?? [];
  const [bulk, setBulk] = useState("");
  const lines = bulk
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  async function move(childId: string, dir: -1 | 1) {
    const i = kids.indexOf(childId);
    const j = i + dir;
    if (j < 0 || j >= kids.length) return;
    await run(() => adminMoveCategory({ data: { id: childId, parentId: id, index: j } }));
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-auto text-sm font-semibold">{n(kids.length)} alt kategori</span>
        <Button size="sm" variant="outline" disabled={busy || kids.length < 2} onClick={() => void run(() => adminReorderCategories({ data: { parentId: id, mode: "alpha" } }), "A→Z sıralandı.")}>
          <ArrowDownAZ className="size-4" /> A→Z
        </Button>
        <Button size="sm" variant="outline" disabled={busy || kids.length < 2} onClick={() => void run(() => adminReorderCategories({ data: { parentId: id, mode: "alpha_desc" } }), "Z→A sıralandı.")}>
          <ArrowDownZA className="size-4" /> Z→A
        </Button>
        <Button size="sm" variant="outline" disabled={busy || kids.length < 2} onClick={() => void run(() => adminReorderCategories({ data: { parentId: id, mode: "listings" } }), "İlan sayısına göre sıralandı.")}>
          <ListOrdered className="size-4" /> İlan sayısına göre
        </Button>
      </div>

      {kids.length ? (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {kids.map((kid, i) => {
            const c = index.byId.get(kid)!;
            return (
              <li key={kid} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-elevated/50">
                <span className="w-6 text-right text-[11px] tabular-nums text-subtle">{i + 1}</span>
                <button type="button" onClick={() => onSelect(kid)} className="min-w-0 flex-1 truncate text-left font-medium hover:text-primary">
                  {c.name}
                </button>
                <span className="text-[11px] tabular-nums text-muted">{n(index.subtreeListings.get(kid) ?? 0)} ilan</span>
                {(index.children.get(kid)?.length ?? 0) > 0 ? <span className="rounded bg-elevated px-1.5 text-[10px] text-muted">{index.children.get(kid)!.length} alt</span> : null}
                <button type="button" disabled={busy || i === 0} onClick={() => void move(kid, -1)} className="rounded p-1 text-muted hover:bg-surface hover:text-fg disabled:opacity-30" aria-label="Yukarı">
                  <ArrowUp className="size-3.5" />
                </button>
                <button type="button" disabled={busy || i === kids.length - 1} onClick={() => void move(kid, 1)} className="rounded p-1 text-muted hover:bg-surface hover:text-fg disabled:opacity-30" aria-label="Aşağı">
                  <ArrowDown className="size-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted">Bu kategori bir yaprak; altında kategori yok.</p>
      )}

      <section className="rounded-xl border border-border bg-elevated/30 p-4">
        <h3 className="text-sm font-semibold">Toplu alt kategori ekle</h3>
        <p className="mt-0.5 text-xs text-muted">Her satıra bir ad yazın veya Excel'den yapıştırın. Aynı adla var olanlar atlanır; yeni kategoriler listenin sonuna eklenir.</p>
        <textarea value={bulk} onChange={(e) => setBulk(e.target.value)} rows={5} placeholder={"Ör.\n520i\n520d\n530i xDrive"} className={cn(textareaClass, "mt-3 font-mono")} />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-muted">{lines.length ? `${lines.length} kategori eklenecek` : ""}</span>
          <Button
            size="sm"
            disabled={busy || !lines.length}
            onClick={() =>
              void run(
                () => adminCreateCategories({ data: { parentId: id, names: lines.slice(0, 500) } }),
                (r) => `${r.created.length} kategori eklendi${r.skipped ? `, ${r.skipped} tanesi zaten vardı` : ""}.`,
              ).then((r) => {
                if (r) setBulk("");
              })
            }
          >
            <Plus className="size-4" /> Ekle
          </Button>
        </div>
      </section>
    </div>
  );
}

/* ───────────────────────────── Attributes ───────────────────────────── */

type OwnItem = { id: string; name: string; type: string; required: boolean; options: string[] | null; unit: string | null };

function AttributesTab({ detail, onSelect }: { detail: AdminCategoryDetail; onSelect: (id: string) => void }) {
  const { run, busy } = useRunner();
  const library = useQuery({ queryKey: ["admin", "attributes"], queryFn: () => adminListAttributes(), staleTime: 60_000 });
  const initial = useMemo<OwnItem[]>(() => detail.ownAttributes.map((a) => ({ ...a })), [detail.ownAttributes]);
  const [items, setItems] = useState<OwnItem[]>(initial);
  const [adding, setAdding] = useState("");
  useEffect(() => setItems(initial), [initial]);

  const dirty = JSON.stringify(items.map((i) => [i.id, i.required])) !== JSON.stringify(initial.map((i) => [i.id, i.required]));
  const inheritedIds = new Set(detail.inheritedAttributes.map((a) => a.id));
  const needle = adding.trim().toLocaleLowerCase("tr");
  const candidates = (library.data ?? [])
    .filter((a) => !items.some((i) => i.id === a.id))
    .filter((a) => !needle || a.name.toLocaleLowerCase("tr").includes(needle) || a.id.includes(needle))
    .slice(0, 12);

  const bySource = new Map<string, { name: string; attrs: typeof detail.inheritedAttributes }>();
  for (const a of detail.inheritedAttributes) {
    const entry = bySource.get(a.source_id) ?? { name: a.source_name, attrs: [] };
    entry.attrs.push(a);
    bySource.set(a.source_id, entry);
  }

  return (
    <div className="space-y-6">
      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Bu kategoriye özel özellikler</h3>
            <p className="text-xs text-muted">İlan verirken sorulur ve filtrelerde görünür. Tüm alt kategoriler bunları devralır.</p>
          </div>
          <Link to="/admin/ozellikler" className="text-xs font-semibold text-primary hover:underline">
            Özellik kütüphanesi →
          </Link>
        </div>

        <ul className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border">
          {items.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <SlidersHorizontal className="size-4 shrink-0 text-violet-600" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {a.name} {a.unit ? <span className="text-xs text-muted">({a.unit})</span> : null}
                  {inheritedIds.has(a.id) ? <span className="ml-1.5 text-[11px] text-warn">· üst kategoride de var</span> : null}
                </p>
                <p className="truncate text-xs text-muted">
                  {ATTRIBUTE_TYPE_LABEL[a.type] ?? a.type}
                  {a.options?.length ? ` · ${a.options.slice(0, 5).join(", ")}${a.options.length > 5 ? ` +${a.options.length - 5}` : ""}` : ""}
                </p>
              </div>
              <label className="flex shrink-0 items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={a.required}
                  onChange={(e) => setItems((list) => list.map((x) => (x.id === a.id ? { ...x, required: e.target.checked } : x)))}
                  className="size-4 accent-primary"
                />
                Zorunlu
              </label>
              <button type="button" onClick={() => setItems((list) => list.filter((x) => x.id !== a.id))} className="rounded p-1 text-muted hover:bg-danger/10 hover:text-danger" aria-label="Kaldır">
                <X className="size-4" />
              </button>
            </li>
          ))}
          {!items.length ? <li className="px-3 py-5 text-center text-sm text-muted">Bu kategoriye doğrudan bağlı özellik yok.</li> : null}
        </ul>

        <div className="relative mt-3">
          <input value={adding} onChange={(e) => setAdding(e.target.value)} placeholder="Kütüphaneden özellik ekle: ad yazın (ör. Oda Sayısı, Yakıt)…" className={inputClass} />
          {needle ? (
            <ul className="absolute inset-x-0 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-xl">
              {candidates.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setItems((list) => [...list, { id: a.id, name: a.name, type: a.type, options: a.options, unit: a.unit, required: false }]);
                      setAdding("");
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-elevated"
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">{a.name}</span>
                    <span className="shrink-0 text-xs text-muted">{ATTRIBUTE_TYPE_LABEL[a.type] ?? a.type}</span>
                    <span className="shrink-0 text-[11px] text-subtle">{a.categories} kategoride</span>
                  </button>
                </li>
              ))}
              {!candidates.length ? <li className="px-2.5 py-3 text-center text-xs text-muted">Eşleşen özellik yok. Önce kütüphaneden oluşturun.</li> : null}
            </ul>
          ) : null}
        </div>

        {dirty ? (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/5 px-3 py-2">
            <span className="flex-1 text-xs font-medium text-primary">Kaydedilmemiş değişiklikler var.</span>
            <Button size="sm" variant="ghost" onClick={() => setItems(initial)}>
              Geri al
            </Button>
            <Button
              size="sm"
              disabled={busy}
              onClick={() =>
                void run(
                  () => adminSetCategoryAttributes({ data: { categoryId: detail.category.id, items: items.map((i) => ({ attributeId: i.id, required: i.required })) } }),
                  "Özellikler kaydedildi.",
                )
              }
            >
              {busy ? <Spinner /> : <Save className="size-4" />} Kaydet
            </Button>
          </div>
        ) : null}
      </section>

      <section>
        <h3 className="text-sm font-semibold">Üst kategorilerden devralınanlar</h3>
        <p className="text-xs text-muted">Burada değiştirilemez; kaynağı olan kategoriden düzenleyin.</p>
        {bySource.size ? (
          <div className="mt-3 space-y-3">
            {[...bySource.entries()].map(([sourceId, s]) => (
              <div key={sourceId} className="rounded-xl border border-border">
                <button type="button" onClick={() => onSelect(sourceId)} className="flex w-full items-center gap-1.5 border-b border-border bg-elevated/40 px-3 py-2 text-left text-xs font-semibold hover:text-primary">
                  {s.name} <ChevronRight className="size-3" />
                </button>
                <ul className="flex flex-wrap gap-1.5 p-3">
                  {s.attrs.map((a) => (
                    <li key={a.id}>
                      <Pill tone={a.required ? "primary" : "muted"}>
                        {a.name}
                        {a.required ? " *" : ""}
                      </Pill>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">Devralınan özellik yok.</p>
        )}
      </section>
    </div>
  );
}

/* ───────────────────────────── Manage ───────────────────────────── */

function ManageTab({ id, index, detail, onRequestDelete }: { id: string; index: CategoryIndex; detail: AdminCategoryDetail; onRequestDelete: (id: string) => void }) {
  const { run, busy } = useRunner();
  const pick = usePickCategory();
  const node = index.byId.get(id)!;
  const c = detail.counts;

  return (
    <div className="max-w-xl space-y-4">
      <section className="rounded-xl border border-border p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <FolderInput className="size-4 text-primary" /> Başka bir üst kategoriye taşı
        </h3>
        <p className="mt-1 text-xs text-muted">Kategori, {n(c.descendants)} alt dalı ve {n(c.subtree_listings)} ilanıyla birlikte taşınır. İlanların kategori bağlantısı değişmez.</p>
        <Button
          size="sm"
          variant="outline"
          className="mt-3"
          disabled={busy}
          onClick={() =>
            void pick({ title: `"${node.name}" nereye taşınsın?`, excludeSubtreeOf: id, allowRoot: true, confirmLabel: "Buraya taşı" }).then((p) => {
              if (p === undefined || p === null) return;
              const parent = p === "root" ? null : p.id;
              if (parent === node.parent_id) return;
              void run(() => adminMoveCategory({ data: { id, parentId: parent, index: (index.children.get(parent) ?? []).length } }), "Kategori taşındı.");
            })
          }
        >
          Hedef seç…
        </Button>
      </section>

      <section className="rounded-xl border border-border p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <LayoutList className="size-4 text-primary" /> İlanları başka kategoriye aktar
        </h3>
        <p className="mt-1 text-xs text-muted">Bu daldaki {n(c.subtree_listings)} ilanın tamamı seçilen kategoriye taşınır (birleştirme). Kategori silinmez.</p>
        <Button
          size="sm"
          variant="outline"
          className="mt-3"
          disabled={busy || !c.subtree_listings}
          onClick={() =>
            void pick({ title: `${n(c.subtree_listings)} ilan hangi kategoriye aktarılsın?`, excludeSubtreeOf: id, confirmLabel: "İlanları aktar" }).then((p) => {
              if (!p || p === "root") return;
              void run(() => adminMoveCategoryListings({ data: { fromId: id, toId: p.id, includeSubtree: true } }), (r) => `${r.moved} ilan "${p.name}" kategorisine aktarıldı.`);
            })
          }
        >
          Hedef seç…
        </Button>
      </section>

      <section className="rounded-xl border border-danger/25 bg-danger/[0.03] p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-danger">
          <Trash2 className="size-4" /> Kategoriyi sil
        </h3>
        <p className="mt-1 text-xs text-muted">
          {c.descendants ? `${n(c.descendants)} alt kategori de silinir. ` : ""}
          {c.subtree_listings ? `Bu dalda ${n(c.subtree_listings)} ilan var; silmeden önce taşınacakları kategoriyi seçeceksiniz.` : "Bu dalda ilan yok."}
        </p>
        {c.subtree_listings ? (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-warn">
            <AlertTriangle className="size-3.5" /> İlanlar silinmez; seçtiğiniz kategoriye taşınır.
          </p>
        ) : null}
        <Button size="sm" variant="danger" className="mt-3" disabled={busy} onClick={() => onRequestDelete(id)}>
          Sil…
        </Button>
      </section>
    </div>
  );
}
