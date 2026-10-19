import { useMemo, useState } from "react";
import { ChevronRight, CornerLeftUp, FolderTree, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCategoryTree, type PickedCategory } from "./hooks";
import { n } from "./format";
import { Modal, SearchInput, Spinner } from "./ui";

/** Browse or search the tree and pick one category (or the root). */
export function CategoryPickerDialog({
  options,
  resolve,
}: {
  options: { title: string; description?: string; excludeSubtreeOf?: string; allowRoot?: boolean; confirmLabel?: string };
  resolve: (v: PickedCategory | "root" | undefined) => void;
}) {
  const { index, isLoading } = useCategoryTree();
  const [q, setQ] = useState("");
  const [cwd, setCwd] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | "root" | null>(null);

  const excluded = useMemo(() => {
    const set = new Set<string>();
    if (!index || !options.excludeSubtreeOf) return set;
    const stack = [options.excludeSubtreeOf];
    while (stack.length) {
      const id = stack.pop()!;
      set.add(id);
      for (const c of index.children.get(id) ?? []) stack.push(c);
    }
    return set;
  }, [index, options.excludeSubtreeOf]);

  const needle = q.trim().toLocaleLowerCase("tr");
  const matches = useMemo(() => {
    if (!index || !needle) return [];
    const out: string[] = [];
    for (const c of index.byId.values()) {
      if (excluded.has(c.id)) continue;
      if (c.name.toLocaleLowerCase("tr").includes(needle) || c.id === needle) out.push(c.id);
    }
    out.sort((a, b) => (index.depth.get(a) ?? 0) - (index.depth.get(b) ?? 0) || index.byId.get(a)!.name.localeCompare(index.byId.get(b)!.name, "tr"));
    return out.slice(0, 150);
  }, [index, needle, excluded]);

  const list = needle ? matches : (index?.children.get(cwd) ?? []).filter((id) => !excluded.has(id));
  const crumbs = index && cwd ? index.path(cwd) : [];

  function choose() {
    if (!index || !selected) return;
    if (selected === "root") return resolve("root");
    const c = index.byId.get(selected);
    if (c) resolve({ id: c.id, name: c.name, path: index.pathLabel(c.id) });
  }

  return (
    <Modal
      open
      onOpenChange={(o) => {
        if (!o) resolve(undefined);
      }}
      title={options.title}
      description={options.description}
      size="lg"
      footer={
        <>
          <span className="mr-auto min-w-0 truncate text-xs text-muted">
            {selected === "root" ? "Seçilen: En üst seviye" : selected && index ? `Seçilen: ${index.pathLabel(selected)}` : "Bir kategori seçin"}
          </span>
          <Button variant="outline" size="sm" onClick={() => resolve(undefined)}>
            Vazgeç
          </Button>
          <Button size="sm" disabled={!selected} onClick={choose}>
            {options.confirmLabel ?? "Seç"}
          </Button>
        </>
      }
    >
      <SearchInput value={q} onChange={setQ} placeholder="Kategori ara (ör. Satılık Daire, 520i)" autoFocus />
      {!needle ? (
        <div className="mt-3 flex flex-wrap items-center gap-1 text-xs">
          <button type="button" onClick={() => setCwd(null)} className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 font-medium text-muted hover:bg-elevated hover:text-fg">
            <Home className="size-3.5" /> Tümü
          </button>
          {crumbs.map((c) => (
            <span key={c.id} className="inline-flex items-center gap-1">
              <ChevronRight className="size-3 text-subtle" />
              <button type="button" onClick={() => setCwd(c.id)} className="rounded-md px-1.5 py-1 font-medium text-muted hover:bg-elevated hover:text-fg">
                {c.name}
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <div className="mt-2 max-h-[50vh] overflow-y-auto rounded-xl border border-border">
        {isLoading || !index ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
            <Spinner /> Kategoriler yükleniyor…
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {options.allowRoot && !needle && !cwd ? (
              <li>
                <button
                  type="button"
                  onClick={() => setSelected("root")}
                  className={cn("flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm", selected === "root" ? "bg-primary/8" : "hover:bg-elevated")}
                >
                  <FolderTree className="size-4 text-primary" />
                  <span className="font-semibold">En üst seviye (ana kategori)</span>
                </button>
              </li>
            ) : null}
            {!needle && cwd ? (
              <li>
                <button
                  type="button"
                  onClick={() => setCwd(index.byId.get(cwd)?.parent_id ?? null)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-xs font-medium text-muted hover:bg-elevated"
                >
                  <CornerLeftUp className="size-3.5" /> Üst seviyeye dön
                </button>
              </li>
            ) : null}
            {list.map((id) => {
              const c = index.byId.get(id)!;
              const kids = (index.children.get(id) ?? []).filter((k) => !excluded.has(k)).length;
              return (
                <li key={id} className={cn("flex items-center", selected === id ? "bg-primary/8" : "hover:bg-elevated")}>
                  <button
                    type="button"
                    onClick={() => setSelected(id)}
                    onDoubleClick={() => {
                      setSelected(id);
                      const picked = index.byId.get(id);
                      if (picked) resolve({ id: picked.id, name: picked.name, path: index.pathLabel(picked.id) });
                    }}
                    className="min-w-0 flex-1 px-3 py-2 text-left"
                  >
                    <span className={cn("block truncate text-sm", selected === id ? "font-semibold text-primary" : "font-medium")}>{c.name}</span>
                    {needle ? <span className="block truncate text-[11px] text-muted">{index.pathLabel(id)}</span> : null}
                  </button>
                  <span className="shrink-0 px-2 text-[11px] tabular-nums text-subtle">{n(index.subtreeListings.get(id) ?? 0)} ilan</span>
                  {kids && !needle ? (
                    <button
                      type="button"
                      onClick={() => {
                        setCwd(id);
                        setSelected(id);
                      }}
                      className="mr-1 flex h-8 shrink-0 items-center gap-1 rounded-lg px-2 text-xs text-muted hover:bg-surface hover:text-fg"
                      aria-label={`${c.name} alt kategorileri`}
                    >
                      {kids} <ChevronRight className="size-3.5" />
                    </button>
                  ) : null}
                </li>
              );
            })}
            {!list.length ? <li className="px-3 py-8 text-center text-sm text-muted">{needle ? "Eşleşen kategori yok." : "Alt kategori yok."}</li> : null}
          </ul>
        )}
      </div>
      {needle && matches.length === 150 ? <p className="mt-2 text-xs text-muted">İlk 150 sonuç gösteriliyor; aramayı daraltın.</p> : null}
    </Modal>
  );
}
