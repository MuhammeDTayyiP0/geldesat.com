import { useCallback, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronsDownUp, ChevronsUpDown, Download, FileJson, FileSpreadsheet, FolderPlus, FolderTree, Keyboard, MousePointerClick } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminDeleteCategory } from "@/lib/server/admin/categories";
import { useCategoryTree, usePickCategory, useRunner } from "@/components/admin/hooks";
import { n } from "@/components/admin/format";
import { downloadCsv, str } from "@/components/admin/search";
import { CategoryTree, type CategoryTreeHandle } from "@/components/admin/categories/CategoryTree";
import { CategoryPanel } from "@/components/admin/categories/CategoryPanel";
import { Card, EmptyState, ErrorState, Kbd, Menu, MenuItem, PageHeader, SearchInput, Spinner, useConfirm } from "@/components/admin/ui";

type Search = { id?: string; q?: string };

export const Route = createFileRoute("/admin/kategoriler")({
  validateSearch: (s: Record<string, unknown>): Search => ({ id: str(s.id), q: str(s.q, 80) }),
  component: CategoriesPage,
});

function CategoriesPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { index, error, refetch, isLoading } = useCategoryTree();
  const treeRef = useRef<CategoryTreeHandle>(null);
  const { run } = useRunner();
  const { confirm } = useConfirm();
  const pick = usePickCategory();
  const [help, setHelp] = useState(false);

  const select = useCallback((id: string) => void navigate({ search: (prev) => ({ ...prev, id }), replace: true }), [navigate]);
  const selectedId = search.id && index?.byId.has(search.id) ? search.id : null;

  async function requestDelete(id: string) {
    if (!index) return;
    const c = index.byId.get(id);
    if (!c) return;
    const listings = index.subtreeListings.get(id) ?? 0;
    const desc = index.descendants.get(id) ?? 0;
    let moveTo: { id: string; name: string } | null = null;
    if (listings > 0) {
      const p = await pick({
        title: `"${c.name}" silinmeden önce ${n(listings)} ilan nereye taşınsın?`,
        description: "İlanlar silinmez; seçtiğiniz kategoriye aktarılır.",
        excludeSubtreeOf: id,
        confirmLabel: "Devam",
      });
      if (!p || p === "root") return;
      moveTo = { id: p.id, name: p.name };
    }
    const ok = await confirm({
      title: `"${c.name}" silinsin mi?`,
      body: (
        <ul className="list-disc space-y-1 pl-5">
          {desc ? <li>{n(desc)} alt kategori de silinecek.</li> : null}
          {moveTo ? (
            <li>
              {n(listings)} ilan <strong>{moveTo.name}</strong> kategorisine taşınacak.
            </li>
          ) : (
            <li>Bu dalda ilan yok.</li>
          )}
          {c.attrs ? <li>Bu kategoriye bağlı {c.attrs} özellik bağlantısı kaldırılacak.</li> : null}
          <li>Bu işlem geri alınamaz.</li>
        </ul>
      ),
      confirmLabel: "Kalıcı olarak sil",
      danger: true,
    });
    if (!ok) return;
    const r = await run(() => adminDeleteCategory({ data: { id, moveListingsTo: moveTo?.id } }), (res) => `${res.removed} kategori silindi${res.movedListings ? `, ${res.movedListings} ilan taşındı` : ""}.`);
    if (r) {
      if (c.parent_id) select(c.parent_id);
      else void navigate({ search: (prev) => ({ ...prev, id: undefined }), replace: true });
    }
  }

  function exportJson() {
    if (!index) return;
    type NodeOut = { id: string; name: string; slug: string; icon: string | null; children?: NodeOut[] };
    const build = (parent: string | null): NodeOut[] =>
      (index.children.get(parent) ?? []).map((id) => {
        const c = index.byId.get(id)!;
        const kids = build(id);
        return { id: c.id, name: c.name, slug: c.slug, icon: c.icon, ...(kids.length ? { children: kids } : {}) };
      });
    const blob = new Blob([JSON.stringify(build(null), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kategori-agaci-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportCsv() {
    if (!index) return;
    const rows: Array<Array<string | number | null>> = [];
    const walk = (parent: string | null) => {
      for (const id of index.children.get(parent) ?? []) {
        const c = index.byId.get(id)!;
        rows.push([c.id, c.name, c.slug, c.parent_id, index.pathLabel(id), (index.depth.get(id) ?? 0) + 1, c.sort_order, index.subtreeLive.get(id) ?? 0, index.subtreeListings.get(id) ?? 0, c.attrs]);
        walk(id);
      }
    };
    walk(null);
    downloadCsv(`kategoriler-${new Date().toISOString().slice(0, 10)}.csv`, ["Kimlik", "Ad", "Adres", "Üst kimlik", "Yol", "Seviye", "Sıra", "Yayında ilan", "Toplam ilan", "Özellik"], rows);
  }

  const roots = index?.children.get(null)?.length ?? 0;
  const maxDepth = index ? Math.max(0, ...index.depth.values()) + 1 : 0;

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageHeader
        icon={FolderTree}
        title="Kategori ağacı"
        description={index ? `${n(index.byId.size)} kategori · ${n(roots)} ana kategori · ${maxDepth} seviye derinlik` : "Kategori hiyerarşisini düzenleyin"}
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => setHelp((h) => !h)}>
              <Keyboard className="size-4" /> Kullanım
            </Button>
            <Menu
              trigger={
                <Button size="sm" variant="outline" disabled={!index}>
                  <Download className="size-4" /> Dışa aktar
                </Button>
              }
            >
              <MenuItem icon={FileJson} onSelect={exportJson}>
                JSON (iç içe ağaç)
              </MenuItem>
              <MenuItem icon={FileSpreadsheet} onSelect={exportCsv}>
                CSV / Excel (düz liste, yollarla)
              </MenuItem>
            </Menu>
            <Button size="sm" onClick={() => treeRef.current?.startAdd(null)} disabled={!index}>
              <FolderPlus className="size-4" /> Ana kategori ekle
            </Button>
          </>
        }
      />

      {help ? (
        <Card className="mb-4 grid gap-4 p-4 text-sm md:grid-cols-3">
          <div>
            <p className="mb-2 flex items-center gap-1.5 font-semibold">
              <MousePointerClick className="size-4 text-primary" /> Fare ile
            </p>
            <ul className="space-y-1 text-xs text-muted">
              <li>Satırı sürükleyip başka bir satırın üst/alt kenarına bırakın → sırası değişir.</li>
              <li>Satırın ortasına bırakın → onun alt kategorisi olur (kapalı dal kendiliğinden açılır).</li>
              <li>Çift tıklama dalı açar/kapatır; + alt kategori ekler, kalem yeniden adlandırır.</li>
            </ul>
          </div>
          <div>
            <p className="mb-2 flex items-center gap-1.5 font-semibold">
              <Keyboard className="size-4 text-primary" /> Klavye ile (ağaç odaktayken)
            </p>
            <ul className="space-y-1 text-xs text-muted">
              <li>
                <Kbd>↑</Kbd> <Kbd>↓</Kbd> gezin · <Kbd>→</Kbd> aç · <Kbd>←</Kbd> kapat / üste çık
              </li>
              <li>
                <Kbd>N</Kbd> alt kategori ekle · <Kbd>F2</Kbd> yeniden adlandır · <Kbd>Del</Kbd> sil
              </li>
              <li>
                Ekleme kutusunda <Kbd>;</Kbd> ile ayırarak veya çok satır yapıştırarak birden fazla ekleyin.
              </li>
            </ul>
          </div>
          <div>
            <p className="mb-2 font-semibold">Güvenlik</p>
            <ul className="space-y-1 text-xs text-muted">
              <li>Bir kategori kendi alt dalına taşınamaz.</li>
              <li>İlanı olan bir dal silinirken ilanlar mutlaka başka kategoriye taşınır.</li>
              <li>Her değişiklik İşlem kayıtları'na yazılır.</li>
            </ul>
          </div>
        </Card>
      ) : null}

      {error ? (
        <Card>
          <ErrorState error={error} onRetry={() => void refetch()} />
        </Card>
      ) : isLoading || !index ? (
        <Card className="flex items-center justify-center gap-2 py-24 text-sm text-muted">
          <Spinner /> Kategori ağacı yükleniyor…
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          <Card className="flex min-w-0 flex-col overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
              <SearchInput value={search.q ?? ""} onChange={(q) => void navigate({ search: (prev) => ({ ...prev, q: q || undefined }), replace: true })} placeholder="Ağaçta ara (ör. Satılık Daire, 520i)" className="min-w-0 flex-1" />
              <Button size="sm" variant="ghost" className="h-9 px-2" title="Ana kategorileri aç" onClick={() => treeRef.current?.expandLevel(1)}>
                <ChevronsUpDown className="size-4" />
              </Button>
              <Button size="sm" variant="ghost" className="h-9 px-2" title="Tümünü daralt" onClick={() => treeRef.current?.collapseAll()}>
                <ChevronsDownUp className="size-4" />
              </Button>
            </div>
            <div className="flex items-center justify-between border-b border-border bg-elevated/40 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-subtle">
              <span>Kategori</span>
              <span className="pr-[92px]">Yayında / toplam ilan</span>
            </div>
            <CategoryTree ref={treeRef} index={index} selectedId={selectedId} onSelect={select} onRequestDelete={(id) => void requestDelete(id)} search={search.q ?? ""} height="max(420px, calc(100dvh - 17rem))" />
          </Card>

          <Card className="min-w-0 overflow-hidden xl:sticky xl:top-20 xl:h-[calc(100dvh-7rem)]">
            {selectedId ? (
              <CategoryPanel key={selectedId} id={selectedId} index={index} onSelect={select} onRequestDelete={(id) => void requestDelete(id)} />
            ) : (
              <EmptyState
                icon={FolderTree}
                title="Bir kategori seçin"
                description="Soldaki ağaçtan bir kategoriye tıklayın: bilgilerini düzenleyin, alt kategorilerini sıralayın, ilan özelliklerini atayın veya taşıyın."
                action={
                  <Button size="sm" variant="outline" onClick={() => treeRef.current?.startAdd(null)}>
                    <FolderPlus className="size-4" /> Ana kategori ekle
                  </Button>
                }
              />
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
