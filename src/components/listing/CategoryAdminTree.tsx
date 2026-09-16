import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminDeleteCategory, adminSaveCategory } from "@/lib/server/account";
import type { CategoryRow } from "@/lib/server/helpers";
import { toast } from "sonner";

type Node = CategoryRow & { children: Node[] };

function buildTree(rows: CategoryRow[]): Node[] {
  const byParent = new Map<string | null, CategoryRow[]>();
  for (const r of rows) {
    const k = r.parent_id;
    const arr = byParent.get(k) ?? [];
    arr.push(r);
    byParent.set(k, arr);
  }
  for (const arr of byParent.values()) {
    arr.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "tr"));
  }
  function walk(parent: string | null): Node[] {
    return (byParent.get(parent) ?? []).map((c) => ({
      ...c,
      children: walk(c.id),
    }));
  }
  return walk(null);
}

function TreeNode({
  node,
  matchIds,
  isOpen,
  renaming,
  renameVal,
  addingUnder,
  addVal,
  busy,
  onToggle,
  onRenameVal,
  onAddVal,
  onStartRename,
  onCancelRename,
  onSaveRename,
  onStartAdd,
  onCancelAdd,
  onSaveAdd,
  onRemove,
}: {
  node: Node;
  matchIds: Set<string> | null;
  isOpen: (id: string) => boolean;
  renaming: string | null;
  renameVal: string;
  addingUnder: string | "root" | null;
  addVal: string;
  busy: boolean;
  onToggle: (id: string) => void;
  onRenameVal: (v: string) => void;
  onAddVal: (v: string) => void;
  onStartRename: (node: Node) => void;
  onCancelRename: () => void;
  onSaveRename: (id: string) => void;
  onStartAdd: (id: string) => void;
  onCancelAdd: () => void;
  onSaveAdd: (parentId: string | null) => void;
  onRemove: (id: string) => void;
}) {
  if (matchIds && !matchIds.has(node.id)) return null;
  const kids = node.children.length;
  const expanded = kids > 0 && isOpen(node.id);
  return (
    <li>
      <div className="flex min-h-11 items-center gap-1 px-2 hover:bg-elevated">
        {kids > 0 ? (
          <button
            type="button"
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted hover:bg-surface hover:text-fg"
            onClick={() => onToggle(node.id)}
            aria-label={expanded ? "Daralt" : "Aç"}
          >
            {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
        ) : (
          <span className="size-8 shrink-0" />
        )}
        {renaming === node.id ? (
          <form
            className="flex min-w-0 flex-1 items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              onSaveRename(node.id);
            }}
          >
            <Input
              value={renameVal}
              onChange={(e) => onRenameVal(e.target.value)}
              autoFocus
              className="h-9"
              disabled={busy}
            />
            <Button type="submit" size="sm" disabled={busy}>
              Kaydet
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onCancelRename}>
              Vazgeç
            </Button>
          </form>
        ) : (
          <>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{node.name}</span>
            <span className="shrink-0 text-xs tabular-nums text-subtle">{kids ? `${kids} alt` : "yaprak"}</span>
            <button
              type="button"
              className="flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface hover:text-fg"
              aria-label="Yeniden adlandır"
              onClick={() => onStartRename(node)}
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              type="button"
              className="flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface hover:text-fg"
              aria-label="Alt kategori ekle"
              onClick={() => onStartAdd(node.id)}
            >
              <Plus className="size-3.5" />
            </button>
            {kids === 0 ? (
              <button
                type="button"
                className="flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface hover:text-danger"
                aria-label="Sil"
                onClick={() => onRemove(node.id)}
              >
                <Trash2 className="size-3.5" />
              </button>
            ) : null}
          </>
        )}
      </div>
      {addingUnder === node.id ? (
        <form
          className="ml-10 flex items-center gap-2 px-2 py-2"
          onSubmit={(e) => {
            e.preventDefault();
            onSaveAdd(node.id);
          }}
        >
          <Input
            value={addVal}
            onChange={(e) => onAddVal(e.target.value)}
            placeholder="Yeni alt kategori"
            autoFocus
            className="h-9"
            disabled={busy}
          />
          <Button type="submit" size="sm" disabled={busy}>
            Ekle
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onCancelAdd}>
            Vazgeç
          </Button>
        </form>
      ) : null}
      {expanded ? (
        <ul className="ml-4 border-l border-border">
          {node.children.map((ch) => (
            <TreeNode
              key={ch.id}
              node={ch}
              matchIds={matchIds}
              isOpen={isOpen}
              renaming={renaming}
              renameVal={renameVal}
              addingUnder={addingUnder}
              addVal={addVal}
              busy={busy}
              onToggle={onToggle}
              onRenameVal={onRenameVal}
              onAddVal={onAddVal}
              onStartRename={onStartRename}
              onCancelRename={onCancelRename}
              onSaveRename={onSaveRename}
              onStartAdd={onStartAdd}
              onCancelAdd={onCancelAdd}
              onSaveAdd={onSaveAdd}
              onRemove={onRemove}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function CategoryAdminTree({
  categories,
  onRefresh,
}: {
  categories: CategoryRow[];
  onRefresh: () => Promise<void> | void;
}) {
  const tree = useMemo(() => buildTree(categories), [categories]);
  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Set<string>>(() => new Set(tree.map((n) => n.id)));
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [addingUnder, setAddingUnder] = useState<string | "root" | null>(null);
  const [addVal, setAddVal] = useState("");
  const [busy, setBusy] = useState(false);

  const needle = q.trim().toLocaleLowerCase("tr");
  const matchIds = useMemo(() => {
    if (!needle) return null;
    const hits = new Set<string>();
    for (const c of categories) {
      if (c.name.toLocaleLowerCase("tr").includes(needle)) hits.add(c.id);
    }
    for (const id of [...hits]) {
      let cur = byId.get(id);
      while (cur?.parent_id) {
        hits.add(cur.parent_id);
        cur = byId.get(cur.parent_id);
      }
    }
    return hits;
  }, [categories, byId, needle]);

  function isOpen(id: string) {
    if (matchIds) return matchIds.has(id);
    return open.has(id);
  }

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function saveRename(id: string) {
    const name = renameVal.trim();
    if (!name) return;
    setBusy(true);
    try {
      await adminSaveCategory({ data: { id, name } });
      toast.success("Ad güncellendi");
      setRenaming(null);
      await onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kaydedilemedi");
    } finally {
      setBusy(false);
    }
  }

  async function saveAdd(parentId: string | null) {
    const name = addVal.trim();
    if (!name) return;
    setBusy(true);
    try {
      await adminSaveCategory({ data: { parentId, name } });
      toast.success("Kategori eklendi");
      setAddingUnder(null);
      setAddVal("");
      if (parentId) setOpen((prev) => new Set(prev).add(parentId));
      await onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Eklenemedi");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Bu kategoriyi silmek istiyor musunuz?")) return;
    setBusy(true);
    try {
      await adminDeleteCategory({ data: { id } });
      toast.success("Silindi");
      await onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Silinemedi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ağaçta ara (ör. i Serisi, 520i)"
          className="sm:max-w-sm"
        />
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setAddingUnder("root");
              setAddVal("");
            }}
          >
            Kök ekle
          </Button>
        </div>
      </div>
      {addingUnder === "root" ? (
        <form
          className="mb-3 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void saveAdd(null);
          }}
        >
          <Input
            value={addVal}
            onChange={(e) => setAddVal(e.target.value)}
            placeholder="Yeni ana kategori"
            autoFocus
            className="h-9 max-w-sm"
            disabled={busy}
          />
          <Button type="submit" size="sm" disabled={busy}>
            Ekle
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setAddingUnder(null)}>
            Vazgeç
          </Button>
        </form>
      ) : null}
      <p className="mb-2 text-xs text-muted">{categories.length} kategori · soldaki ok ile dalları açın</p>
      <ul className="overflow-hidden rounded-xl border border-border bg-surface">
        {tree.map((n) => (
          <TreeNode
            key={n.id}
            node={n}
            matchIds={matchIds}
            isOpen={isOpen}
            renaming={renaming}
            renameVal={renameVal}
            addingUnder={addingUnder}
            addVal={addVal}
            busy={busy}
            onToggle={toggle}
            onRenameVal={setRenameVal}
            onAddVal={setAddVal}
            onStartRename={(node) => {
              setRenaming(node.id);
              setRenameVal(node.name);
              setAddingUnder(null);
            }}
            onCancelRename={() => setRenaming(null)}
            onSaveRename={(id) => void saveRename(id)}
            onStartAdd={(id) => {
              setAddingUnder(id);
              setAddVal("");
              setRenaming(null);
            }}
            onCancelAdd={() => setAddingUnder(null)}
            onSaveAdd={(parentId) => void saveAdd(parentId)}
            onRemove={(id) => void remove(id)}
          />
        ))}
      </ul>
    </div>
  );
}
