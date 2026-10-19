import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  ArrowDownAZ,
  ChevronDown,
  ChevronRight,
  ChevronsDown,
  ChevronsUp,
  CornerDownRight,
  ExternalLink,
  FolderInput,
  GripVertical,
  LayoutList,
  Pencil,
  Plus,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { adminCreateCategories, adminMoveCategory, adminReorderCategories, adminUpdateCategory } from "@/lib/server/admin/categories";
import { usePickCategory, useRunner, type CategoryIndex } from "../hooks";
import { n } from "../format";
import { Menu, MenuItem, MenuLabel, MenuSeparator, Spinner } from "../ui";
import { categoryIcon } from "./icons";

const ROW_H = 36;
const OVERSCAN = 12;

type Row = { kind: "node"; id: string; depth: number } | { kind: "add"; parentId: string | null; depth: number };
type DropPos = "before" | "after" | "inside";
type Editing = { mode: "rename"; id: string } | { mode: "add"; parentId: string | null } | null;

export type CategoryTreeHandle = {
  expandTo: (id: string) => void;
  startAdd: (parentId: string | null) => void;
  startRename: (id: string) => void;
  collapseAll: () => void;
  expandLevel: (depth: number) => void;
  focus: () => void;
};

type Props = {
  index: CategoryIndex;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRequestDelete: (id: string) => void;
  search: string;
  height: string;
};

export const CategoryTree = forwardRef<CategoryTreeHandle, Props>(function CategoryTree({ index, selectedId, onSelect, onRequestDelete, search, height }, ref) {
  const { run, busy } = useRunner();
  const pick = usePickCategory();
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewH, setViewH] = useState(600);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [editing, setEditing] = useState<Editing>(null);
  const [editValue, setEditValue] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [drop, setDrop] = useState<{ id: string; pos: DropPos } | null>(null);
  const hoverTimer = useRef<{ id: string; t: ReturnType<typeof setTimeout> } | null>(null);

  /* ── search ── */
  const needle = search.trim().toLocaleLowerCase("tr");
  const { matches, visibleInSearch } = useMemo(() => {
    if (!needle) return { matches: null as Set<string> | null, visibleInSearch: null as Set<string> | null };
    const m = new Set<string>();
    for (const c of index.byId.values()) {
      if (c.name.toLocaleLowerCase("tr").includes(needle) || c.id === needle || c.slug === needle) m.add(c.id);
    }
    const vis = new Set<string>(m);
    for (const id of m) {
      for (let cur = index.byId.get(id); cur?.parent_id; cur = index.byId.get(cur.parent_id)) {
        if (vis.has(cur.parent_id)) break;
        vis.add(cur.parent_id);
      }
    }
    return { matches: m, visibleInSearch: vis };
  }, [index, needle]);

  /* ── flatten visible rows ── */
  const rows = useMemo(() => {
    const out: Row[] = [];
    const visit = (parent: string | null, depth: number, filtered: boolean) => {
      for (const id of index.children.get(parent) ?? []) {
        if (filtered && visibleInSearch && !visibleInSearch.has(id)) continue;
        out.push({ kind: "node", id, depth });
        const isAncestorOfMatch = filtered && visibleInSearch && !matches?.has(id) && visibleInSearch.has(id);
        if (isAncestorOfMatch || expanded.has(id)) {
          // Children of a node opened by hand are shown in full, even while searching.
          visit(id, depth + 1, Boolean(filtered && isAncestorOfMatch && !expanded.has(id)));
        }
        if (editing?.mode === "add" && editing.parentId === id) out.push({ kind: "add", parentId: id, depth: depth + 1 });
      }
    };
    visit(null, 0, Boolean(visibleInSearch));
    if (editing?.mode === "add" && editing.parentId === null) out.push({ kind: "add", parentId: null, depth: 0 });
    return out;
  }, [index, expanded, visibleInSearch, matches, editing]);

  const rowIndex = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r, i) => {
      if (r.kind === "node") m.set(r.id, i);
    });
    return m;
  }, [rows]);

  /* ── viewport ── */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewH(el.clientHeight));
    ro.observe(el);
    setViewH(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  const scrollToRow = useCallback((i: number) => {
    const el = scrollRef.current;
    if (!el || i < 0) return;
    const top = i * ROW_H;
    if (top < el.scrollTop) el.scrollTop = top - ROW_H;
    else if (top + ROW_H > el.scrollTop + el.clientHeight) el.scrollTop = top - el.clientHeight + ROW_H * 2;
  }, []);

  const expandTo = useCallback(
    (id: string) => {
      setExpanded((prev) => {
        const next = new Set(prev);
        for (let cur = index.byId.get(id); cur?.parent_id; cur = index.byId.get(cur.parent_id)) next.add(cur.parent_id);
        return next;
      });
    },
    [index],
  );

  // Reveal the selected node (deep links, palette, panel breadcrumbs).
  useEffect(() => {
    if (selectedId && index.byId.has(selectedId)) expandTo(selectedId);
  }, [selectedId, index, expandTo]);

  const pendingScroll = useRef<string | null>(null);
  useEffect(() => {
    pendingScroll.current = selectedId;
  }, [selectedId]);
  useEffect(() => {
    const id = pendingScroll.current;
    if (id && rowIndex.has(id)) {
      scrollToRow(rowIndex.get(id)!);
      pendingScroll.current = null;
    }
  }, [rowIndex, scrollToRow]);

  useImperativeHandle(
    ref,
    () => ({
      expandTo,
      startAdd: (parentId) => {
        if (parentId) setExpanded((prev) => new Set(prev).add(parentId));
        setEditing({ mode: "add", parentId });
        setEditValue("");
        if (parentId === null) setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 0);
      },
      startRename: (id) => {
        setEditing({ mode: "rename", id });
        setEditValue(index.byId.get(id)?.name ?? "");
      },
      collapseAll: () => setExpanded(new Set()),
      expandLevel: (depth) => {
        const next = new Set<string>();
        for (const [id, d] of index.depth) if (d < depth && (index.children.get(id)?.length ?? 0) > 0) next.add(id);
        setExpanded(next);
      },
      focus: () => scrollRef.current?.focus(),
    }),
    [expandTo, index],
  );

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /* ── mutations ── */
  // Enter and the blur that follows it must not save twice.
  const committing = useRef(false);

  async function commitEdit() {
    const value = editValue.trim();
    if (!editing || committing.current) return;
    if (editing.mode === "rename") {
      const c = index.byId.get(editing.id);
      setEditing(null);
      committing.current = true;
      setTimeout(() => {
        committing.current = false;
      }, 0);
      if (!c || !value || value === c.name) return;
      await run(() => adminUpdateCategory({ data: { id: c.id, name: value, slug: c.slug, icon: c.icon } }), "Kategori adı güncellendi.");
    } else {
      if (!value) {
        setEditing(null);
        return;
      }
      const names = value
        .split(/[\n;]/)
        .map((s) => s.trim())
        .filter(Boolean);
      const r = await run(() => adminCreateCategories({ data: { parentId: editing.parentId, names } }), (res) => (res.created.length > 1 ? `${res.created.length} kategori eklendi.` : `"${res.created[0]?.name}" eklendi.`));
      // Keep the input open for quick consecutive entries.
      if (r) setEditValue("");
    }
  }

  async function moveTo(id: string, parentId: string | null, at: number) {
    await run(() => adminMoveCategory({ data: { id, parentId, index: at } }), "Kategori taşındı.");
    if (parentId) setExpanded((prev) => new Set(prev).add(parentId));
  }

  function siblingsOf(id: string) {
    const parent = index.byId.get(id)?.parent_id ?? null;
    return { parent, list: index.children.get(parent) ?? [] };
  }

  async function shift(id: string, dir: -1 | 1) {
    const { parent, list } = siblingsOf(id);
    const i = list.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    await moveTo(id, parent, j);
  }

  function isInSubtree(rootId: string, id: string): boolean {
    for (let cur = index.byId.get(id); cur; cur = cur.parent_id ? index.byId.get(cur.parent_id) : undefined) {
      if (cur.id === rootId) return true;
    }
    return false;
  }

  async function performDrop(targetId: string, pos: DropPos) {
    const id = dragId;
    setDragId(null);
    setDrop(null);
    if (!id || id === targetId || isInSubtree(id, targetId)) return;
    const target = index.byId.get(targetId);
    if (!target) return;
    if (pos === "inside") {
      const kids = (index.children.get(targetId) ?? []).filter((k) => k !== id);
      await moveTo(id, targetId, kids.length);
      return;
    }
    const parent = target.parent_id ?? null;
    const sibs = (index.children.get(parent) ?? []).filter((k) => k !== id);
    const at = sibs.indexOf(targetId) + (pos === "after" ? 1 : 0);
    await moveTo(id, parent, at);
  }

  /* ── keyboard ── */
  function onKeyDown(e: React.KeyboardEvent) {
    if (editing) return;
    const nodeRows = rows.filter((r): r is Extract<Row, { kind: "node" }> => r.kind === "node");
    const cur = selectedId ? nodeRows.findIndex((r) => r.id === selectedId) : -1;
    const sel = (i: number) => {
      const r = nodeRows[Math.max(0, Math.min(nodeRows.length - 1, i))];
      if (r) {
        onSelect(r.id);
        scrollToRow(rowIndex.get(r.id) ?? 0);
      }
    };
    if (e.key === "ArrowDown") {
      e.preventDefault();
      sel(cur + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      sel(cur - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      sel(0);
    } else if (e.key === "End") {
      e.preventDefault();
      sel(nodeRows.length - 1);
    } else if (e.key === "ArrowRight" && selectedId) {
      e.preventDefault();
      const kids = index.children.get(selectedId) ?? [];
      if (kids.length && !expanded.has(selectedId)) toggle(selectedId);
      else if (kids.length) sel(cur + 1);
    } else if (e.key === "ArrowLeft" && selectedId) {
      e.preventDefault();
      if (expanded.has(selectedId)) toggle(selectedId);
      else {
        const parent = index.byId.get(selectedId)?.parent_id;
        if (parent) {
          onSelect(parent);
          const pi = rowIndex.get(parent);
          if (pi != null) scrollToRow(pi);
        }
      }
    } else if (e.key === "F2" && selectedId) {
      e.preventDefault();
      setEditing({ mode: "rename", id: selectedId });
      setEditValue(index.byId.get(selectedId)?.name ?? "");
    } else if (e.key === "Delete" && selectedId) {
      e.preventDefault();
      onRequestDelete(selectedId);
    } else if ((e.key === "n" || e.key === "N") && selectedId && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      setExpanded((prev) => new Set(prev).add(selectedId));
      setEditing({ mode: "add", parentId: selectedId });
      setEditValue("");
    }
  }

  /* ── render ── */
  const start = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const end = Math.min(rows.length, Math.ceil((scrollTop + viewH) / ROW_H) + OVERSCAN);
  const slice = rows.slice(start, end);

  return (
    <div
      ref={scrollRef}
      tabIndex={0}
      role="tree"
      aria-label="Kategori ağacı"
      onKeyDown={onKeyDown}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      onDragOver={(e) => {
        // Auto-scroll near the edges while dragging.
        const el = scrollRef.current;
        if (!el || !dragId) return;
        const rect = el.getBoundingClientRect();
        if (e.clientY < rect.top + 48) el.scrollTop -= 14;
        else if (e.clientY > rect.bottom - 48) el.scrollTop += 14;
      }}
      style={{ height }}
      className="relative overflow-y-auto overscroll-contain outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30"
    >
      <div style={{ height: rows.length * ROW_H }} className="relative">
        {slice.map((row, k) => {
          const i = start + k;
          const top = i * ROW_H;
          if (row.kind === "add") {
            return (
              <div key={`add:${row.parentId ?? "root"}`} style={{ top, height: ROW_H, paddingLeft: 8 + row.depth * 18 + 22 }} className="absolute inset-x-0 flex items-center gap-2 pr-2">
                <CornerDownRight className="size-3.5 shrink-0 text-primary" />
                <input
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onPaste={(e) => {
                    const text = e.clipboardData.getData("text");
                    if (text.includes("\n")) {
                      e.preventDefault();
                      setEditValue(text);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void commitEdit();
                    } else if (e.key === "Escape") {
                      setEditing(null);
                    }
                  }}
                  onBlur={() => {
                    if (!editValue.trim()) setEditing(null);
                  }}
                  disabled={busy}
                  placeholder={row.parentId ? "Yeni alt kategori adı · Enter ile ekle (; ile birden fazla)" : "Yeni ana kategori adı"}
                  className="h-7 min-w-0 flex-1 rounded-md border border-primary bg-surface px-2 text-sm outline-none ring-2 ring-primary/15"
                />
                {busy ? <Spinner className="text-primary" /> : <span className="hidden text-[10px] text-subtle sm:inline">Esc ile kapat</span>}
              </div>
            );
          }
          const c = index.byId.get(row.id);
          if (!c) return null;
          const kids = index.children.get(c.id)?.length ?? 0;
          const isOpen = expanded.has(c.id) || Boolean(visibleInSearch && visibleInSearch.has(c.id) && !matches?.has(c.id));
          const selected = c.id === selectedId;
          const matched = matches?.has(c.id);
          const Icon = categoryIcon(c.icon);
          const total = index.subtreeListings.get(c.id) ?? 0;
          const live = index.subtreeLive.get(c.id) ?? 0;
          const dropHere = drop?.id === c.id ? drop.pos : null;
          const renaming = editing?.mode === "rename" && editing.id === c.id;
          return (
            <div
              key={c.id}
              role="treeitem"
              aria-selected={selected}
              aria-expanded={kids ? isOpen : undefined}
              aria-level={row.depth + 1}
              draggable={!renaming && !busy}
              onDragStart={(e) => {
                setDragId(c.id);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", c.id);
              }}
              onDragEnd={() => {
                setDragId(null);
                setDrop(null);
              }}
              onDragOver={(e) => {
                if (!dragId || dragId === c.id || isInSubtree(dragId, c.id)) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                const rect = e.currentTarget.getBoundingClientRect();
                const y = (e.clientY - rect.top) / rect.height;
                const pos: DropPos = y < 0.28 ? "before" : y > 0.72 ? "after" : "inside";
                if (drop?.id !== c.id || drop.pos !== pos) setDrop({ id: c.id, pos });
                // Hovering "inside" a closed branch opens it.
                if (pos === "inside" && kids && !expanded.has(c.id)) {
                  if (hoverTimer.current?.id !== c.id) {
                    if (hoverTimer.current) clearTimeout(hoverTimer.current.t);
                    hoverTimer.current = { id: c.id, t: setTimeout(() => setExpanded((p) => new Set(p).add(c.id)), 650) };
                  }
                }
              }}
              onDragLeave={() => {
                if (hoverTimer.current?.id === c.id) {
                  clearTimeout(hoverTimer.current.t);
                  hoverTimer.current = null;
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (drop?.id === c.id) void performDrop(c.id, drop.pos);
              }}
              onClick={() => onSelect(c.id)}
              onDoubleClick={() => kids && toggle(c.id)}
              style={{ top, height: ROW_H, paddingLeft: 4 + row.depth * 18 }}
              className={cn(
                "group absolute inset-x-0 flex cursor-pointer select-none items-center gap-1 pr-1.5 text-sm",
                selected ? "bg-primary/10" : "hover:bg-elevated/70",
                dragId === c.id && "opacity-40",
                dropHere === "inside" && "bg-primary/15 ring-2 ring-inset ring-primary",
              )}
            >
              {dropHere === "before" ? <span className="pointer-events-none absolute inset-x-2 top-0 h-0.5 rounded bg-primary" style={{ left: 4 + row.depth * 18 }} /> : null}
              {dropHere === "after" ? <span className="pointer-events-none absolute inset-x-2 bottom-0 h-0.5 rounded bg-primary" style={{ left: 4 + row.depth * 18 }} /> : null}
              {selected ? <span className="absolute inset-y-1 left-0 w-0.5 rounded-r bg-primary" /> : null}

              <GripVertical className="size-3.5 shrink-0 cursor-grab text-subtle opacity-0 group-hover:opacity-100" aria-hidden />
              {kids ? (
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(c.id);
                  }}
                  className="flex size-6 shrink-0 items-center justify-center rounded text-muted hover:bg-surface hover:text-fg"
                  aria-label={isOpen ? "Daralt" : "Genişlet"}
                >
                  {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                </button>
              ) : (
                <span className="size-6 shrink-0" />
              )}
              <Icon className={cn("size-4 shrink-0", row.depth === 0 ? "text-primary" : kids ? "text-muted" : "text-subtle")} />

              {renaming ? (
                <input
                  autoFocus
                  value={editValue}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") void commitEdit();
                    if (e.key === "Escape") setEditing(null);
                  }}
                  onBlur={() => void commitEdit()}
                  maxLength={80}
                  className="ml-1 h-7 min-w-0 flex-1 rounded-md border border-primary bg-surface px-2 text-sm outline-none ring-2 ring-primary/15"
                />
              ) : (
                <span className={cn("ml-1 min-w-0 flex-1 truncate", row.depth === 0 && "font-semibold", selected && "font-semibold text-primary")}>
                  <Highlight text={c.name} needle={matched ? needle : ""} />
                </span>
              )}

              {!renaming ? (
                <>
                  {c.attrs ? (
                    <span className="hidden shrink-0 items-center gap-0.5 text-[10px] text-violet-700 sm:inline-flex" title={`${c.attrs} özellik tanımlı`}>
                      <SlidersHorizontal className="size-3" />
                      {c.attrs}
                    </span>
                  ) : null}
                  {kids ? <span className="hidden shrink-0 rounded bg-elevated px-1.5 text-[10px] tabular-nums text-muted md:inline">{n(kids)} alt</span> : null}
                  <span className={cn("w-14 shrink-0 text-right text-[11px] tabular-nums", total ? "text-fg" : "text-subtle")} title={`${n(live)} yayında / ${n(total)} toplam ilan`}>
                    {total ? n(live) : "–"}
                    {total && total !== live ? <span className="text-subtle">/{nShort(total)}</span> : null}
                  </span>
                  <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      tabIndex={-1}
                      title="Alt kategori ekle (N)"
                      onClick={() => {
                        setExpanded((prev) => new Set(prev).add(c.id));
                        setEditing({ mode: "add", parentId: c.id });
                        setEditValue("");
                      }}
                      className="flex size-7 items-center justify-center rounded text-muted hover:bg-surface hover:text-primary"
                    >
                      <Plus className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      tabIndex={-1}
                      title="Yeniden adlandır (F2)"
                      onClick={() => {
                        setEditing({ mode: "rename", id: c.id });
                        setEditValue(c.name);
                      }}
                      className="flex size-7 items-center justify-center rounded text-muted hover:bg-surface hover:text-primary"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <Menu
                      trigger={
                        <button type="button" tabIndex={-1} className="flex size-7 items-center justify-center rounded text-muted hover:bg-surface hover:text-fg data-[state=open]:bg-surface" aria-label="Diğer işlemler">
                          <span className="text-base leading-none">⋯</span>
                        </button>
                      }
                    >
                      <MenuLabel>{c.name}</MenuLabel>
                      <MenuItem icon={ChevronsUp} onSelect={() => void shift(c.id, -1)} disabled={siblingsOf(c.id).list[0] === c.id}>
                        Yukarı taşı
                      </MenuItem>
                      <MenuItem icon={ChevronsDown} onSelect={() => void shift(c.id, 1)} disabled={siblingsOf(c.id).list.at(-1) === c.id}>
                        Aşağı taşı
                      </MenuItem>
                      <MenuItem
                        icon={FolderInput}
                        onSelect={() =>
                          void pick({ title: `"${c.name}" nereye taşınsın?`, description: "Kategori tüm alt dallarıyla birlikte taşınır.", excludeSubtreeOf: c.id, allowRoot: true, confirmLabel: "Buraya taşı" }).then((p) => {
                            if (p === undefined) return;
                            const parent = p === "root" ? null : p ? p.id : null;
                            void moveTo(c.id, parent, (index.children.get(parent) ?? []).filter((x) => x !== c.id).length);
                          })
                        }
                      >
                        Başka yere taşı…
                      </MenuItem>
                      {kids > 1 ? (
                        <MenuItem icon={ArrowDownAZ} onSelect={() => void run(() => adminReorderCategories({ data: { parentId: c.id, mode: "alpha" } }), "Alt kategoriler A→Z sıralandı.")}>
                          Alt kategorileri A→Z sırala
                        </MenuItem>
                      ) : null}
                      <MenuSeparator />
                      <MenuItem icon={LayoutList} onSelect={() => void navigate({ to: "/admin/ilanlar", search: { categoryId: c.id } })}>
                        İlanlarını listele
                      </MenuItem>
                      <MenuItem icon={ExternalLink} onSelect={() => window.open(`/category/${c.slug}`, "_blank", "noopener")}>
                        Sitede gör
                      </MenuItem>
                      <MenuSeparator />
                      <MenuItem icon={Trash2} danger onSelect={() => onRequestDelete(c.id)}>
                        Sil…
                      </MenuItem>
                    </Menu>
                  </div>
                </>
              ) : null}
            </div>
          );
        })}
      </div>
      {!rows.length ? <p className="absolute inset-x-0 top-10 text-center text-sm text-muted">{needle ? "Eşleşen kategori yok." : "Henüz kategori yok."}</p> : null}
    </div>
  );
});

function nShort(v: number) {
  return v >= 1000 ? `${Math.round(v / 100) / 10}B` : String(v);
}

function Highlight({ text, needle }: { text: string; needle: string }) {
  if (!needle) return <>{text}</>;
  const i = text.toLocaleLowerCase("tr").indexOf(needle);
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded bg-amber-200/70 px-0.5 text-fg">{text.slice(i, i + needle.length)}</mark>
      {text.slice(i + needle.length)}
    </>
  );
}
