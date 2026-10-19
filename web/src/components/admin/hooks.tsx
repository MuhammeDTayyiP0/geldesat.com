import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminCategoryTree, type AdminCategory } from "@/lib/server/admin/categories";
import { adminListingsAction } from "@/lib/server/admin/listings";
import { errorMessage } from "./format";
import { useConfirm } from "./ui";

/** Runs a server call with toasts, then refreshes every admin query. */
export function useRunner() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    async <T,>(fn: () => Promise<T>, success?: string | ((r: T) => string)): Promise<T | undefined> => {
      setBusy(true);
      try {
        const r = await fn();
        if (success) toast.success(typeof success === "function" ? success(r) : success);
        await qc.invalidateQueries({ queryKey: ["admin"] });
        return r;
      } catch (e) {
        toast.error(errorMessage(e));
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [qc],
  );
  return { run, busy };
}

/* ───────────────────────────── Category tree data ───────────────────────────── */

export type CategoryIndex = {
  byId: Map<string, AdminCategory>;
  children: Map<string | null, string[]>;
  /** Listings in the node and everything below it. */
  subtreeListings: Map<string, number>;
  subtreeLive: Map<string, number>;
  /** Number of nodes below. */
  descendants: Map<string, number>;
  depth: Map<string, number>;
  path: (id: string) => AdminCategory[];
  pathLabel: (id: string) => string;
};

export function buildCategoryIndex(rows: AdminCategory[]): CategoryIndex {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const children = new Map<string | null, string[]>();
  for (const r of rows) {
    const key = r.parent_id && byId.has(r.parent_id) ? r.parent_id : null;
    const arr = children.get(key);
    if (arr) arr.push(r.id);
    else children.set(key, [r.id]);
  }
  for (const arr of children.values()) {
    arr.sort((a, b) => {
      const x = byId.get(a)!;
      const y = byId.get(b)!;
      return x.sort_order - y.sort_order || x.name.localeCompare(y.name, "tr");
    });
  }
  const subtreeListings = new Map<string, number>();
  const subtreeLive = new Map<string, number>();
  const descendants = new Map<string, number>();
  const depth = new Map<string, number>();
  // Iterative post-order so deep trees cannot overflow the stack.
  const stack: Array<{ id: string; d: number; done: boolean }> = (children.get(null) ?? []).map((id) => ({ id, d: 0, done: false }));
  while (stack.length) {
    const top = stack[stack.length - 1];
    if (!top.done) {
      top.done = true;
      depth.set(top.id, top.d);
      for (const c of children.get(top.id) ?? []) stack.push({ id: c, d: top.d + 1, done: false });
      continue;
    }
    stack.pop();
    const node = byId.get(top.id)!;
    let total = node.listings;
    let live = node.live;
    let desc = 0;
    for (const c of children.get(top.id) ?? []) {
      total += subtreeListings.get(c) ?? 0;
      live += subtreeLive.get(c) ?? 0;
      desc += 1 + (descendants.get(c) ?? 0);
    }
    subtreeListings.set(top.id, total);
    subtreeLive.set(top.id, live);
    descendants.set(top.id, desc);
  }
  const path = (id: string) => {
    const out: AdminCategory[] = [];
    for (let cur = byId.get(id); cur; cur = cur.parent_id ? byId.get(cur.parent_id) : undefined) {
      out.unshift(cur);
      if (out.length > 50) break;
    }
    return out;
  };
  return {
    byId,
    children,
    subtreeListings,
    subtreeLive,
    descendants,
    depth,
    path,
    pathLabel: (id: string) =>
      path(id)
        .map((c) => c.name)
        .join(" › "),
  };
}

export function useCategoryTree() {
  const query = useQuery({
    queryKey: ["admin", "categories", "tree"],
    queryFn: () => adminCategoryTree(),
    staleTime: 60_000,
  });
  const index = useMemo(() => (query.data ? buildCategoryIndex(query.data.categories) : null), [query.data]);
  return { ...query, index };
}

/* ───────────────────────────── Category picker ───────────────────────────── */

export type PickedCategory = { id: string; name: string; path: string } | null;

type PickerOptions = { title: string; description?: string; excludeSubtreeOf?: string; allowRoot?: boolean; confirmLabel?: string };

const PickerContext = createContext<((o: PickerOptions) => Promise<PickedCategory | "root" | undefined>) | null>(null);

export function CategoryPickerProvider({ children, render }: { children: ReactNode; render: (props: { options: PickerOptions; resolve: (v: PickedCategory | "root" | undefined) => void }) => ReactNode }) {
  const [state, setState] = useState<{ options: PickerOptions; resolve: (v: PickedCategory | "root" | undefined) => void } | null>(null);
  const pick = useCallback(
    (options: PickerOptions) =>
      new Promise<PickedCategory | "root" | undefined>((resolve) => {
        setState({ options, resolve });
      }),
    [],
  );
  return (
    <PickerContext.Provider value={pick}>
      {children}
      {state
        ? render({
            options: state.options,
            resolve: (v) => {
              state.resolve(v);
              setState(null);
            },
          })
        : null}
    </PickerContext.Provider>
  );
}

/** Opens the category picker; resolves to the chosen category, "root", or undefined when cancelled. */
export function usePickCategory() {
  const ctx = useContext(PickerContext);
  if (!ctx) throw new Error("usePickCategory must be used inside CategoryPickerProvider");
  return ctx;
}

/* ───────────────────────────── Detail sheets ───────────────────────────── */

type SheetEntry = { type: "listing" | "user"; id: string };

const SheetContext = createContext<{
  stack: SheetEntry[];
  openListing: (id: string) => void;
  openUser: (id: string) => void;
  back: () => void;
  close: () => void;
} | null>(null);

export function SheetProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<SheetEntry[]>([]);
  const value = useMemo(
    () => ({
      stack,
      openListing: (id: string) => setStack((s) => [...s.slice(-4), { type: "listing" as const, id }]),
      openUser: (id: string) => setStack((s) => [...s.slice(-4), { type: "user" as const, id }]),
      back: () => setStack((s) => s.slice(0, -1)),
      close: () => setStack([]),
    }),
    [stack],
  );
  return <SheetContext.Provider value={value}>{children}</SheetContext.Provider>;
}

export function useSheets() {
  const ctx = useContext(SheetContext);
  if (!ctx) throw new Error("useSheets must be used inside SheetProvider");
  return ctx;
}

/* ───────────────────────────── Listing actions ───────────────────────────── */

export const REJECT_REASONS = [
  "Yasaklı veya mevzuata aykırı ürün/içerik",
  "Yanlış kategori seçimi",
  "Yanıltıcı veya sembolik fiyat",
  "Görseller yetersiz, alakasız veya başka kaynaktan alınmış",
  "Başlık veya açıklamada iletişim bilgisi / yönlendirme",
  "Aynı ilanın tekrarı (mükerrer ilan)",
  "Eksik veya anlaşılmaz açıklama",
];

type ActionKind = "approve" | "reject" | "deactivate" | "activate" | "sold" | "extend" | "feature" | "unfeature" | "move" | "delete";

/** Every listing action with its confirmation step, for single rows and bulk selections. */
export function useListingActions() {
  const { confirm, prompt } = useConfirm();
  const pick = usePickCategory();
  const { run, busy } = useRunner();

  const act = useCallback(
    async (ids: string[], action: ActionKind, label?: string): Promise<boolean> => {
      if (!ids.length) return false;
      const many = ids.length > 1 ? `${ids.length} ilan` : label ? `"${label}"` : "Bu ilan";
      let reason: string | undefined;
      let days: number | undefined;
      let categoryId: string | undefined;
      if (action === "reject") {
        const r = await prompt({
          title: ids.length > 1 ? `${ids.length} ilanı reddet` : "İlanı reddet",
          body: "Gerekçe ilan sahibine bildirim olarak gönderilir.",
          label: "Ret gerekçesi",
          presets: REJECT_REASONS,
          confirmLabel: "Reddet",
          danger: true,
        });
        if (r == null) return false;
        reason = r;
      } else if (action === "deactivate") {
        const r = await prompt({
          title: ids.length > 1 ? `${ids.length} ilanı yayından kaldır` : "İlanı yayından kaldır",
          body: "İlan pasife alınır; onayı korunduğu için sahibi tekrar yayına alabilir. Kalıcı kaldırma için Reddet'i kullanın.",
          label: "Gerekçe (isteğe bağlı)",
          required: false,
          confirmLabel: "Yayından kaldır",
          danger: true,
        });
        if (r == null) return false;
        reason = r || undefined;
      } else if (action === "extend" || action === "feature") {
        const r = await prompt({
          title: action === "extend" ? "Yayın süresini uzat" : "Vitrine al",
          body: action === "extend" ? `${many} için yayın süresine eklenecek gün sayısı.` : `${many} arama ve kategori sayfalarında en üstte gösterilir.`,
          label: "Gün",
          presets: action === "extend" ? ["7", "15", "30", "60", "90"] : ["3", "7", "14", "30"],
          defaultValue: action === "extend" ? "30" : "7",
          multiline: false,
          confirmLabel: action === "extend" ? "Uzat" : "Vitrine al",
        });
        if (r == null) return false;
        days = Math.max(1, Math.min(365, Number.parseInt(r, 10) || 0));
        if (!days) return false;
      } else if (action === "move") {
        const picked = await pick({ title: ids.length > 1 ? `${ids.length} ilanı taşı` : "İlanın kategorisini değiştir", confirmLabel: "Taşı" });
        if (!picked || picked === "root") return false;
        categoryId = picked.id;
      } else if (action === "delete") {
        const ok = await confirm({
          title: ids.length > 1 ? `${ids.length} ilan kalıcı olarak silinsin mi?` : "İlan kalıcı olarak silinsin mi?",
          body: "İlan, fotoğrafları, favorileri ve fiyat geçmişi silinir. Bu işlem geri alınamaz.",
          confirmLabel: "Kalıcı olarak sil",
          danger: true,
        });
        if (!ok) return false;
      } else if (action === "sold" || action === "unfeature") {
        // No questions.
      } else if (ids.length > 5) {
        const ok = await confirm({ title: `${ids.length} ilan için işlem yapılsın mı?`, confirmLabel: "Devam et" });
        if (!ok) return false;
      }
      const result = await run(
        () => adminListingsAction({ data: { ids, action, reason, days, categoryId, notify: true } }),
        (r) => (r.count > 1 ? `${r.count} ilan güncellendi.` : "İlan güncellendi."),
      );
      return Boolean(result);
    },
    [confirm, prompt, pick, run],
  );

  return { act, busy };
}
