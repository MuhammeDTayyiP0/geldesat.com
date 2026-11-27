import { useEffect, useState, useSyncExternalStore } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowLeftRight, ImageIcon, Trash2, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { photoSrc } from "@/lib/images";
import { cn, formatPrice } from "@/lib/utils";

export const COMPARE_STORAGE_KEY = "geldesat.compare.v1";
export const MAX_COMPARE_ITEMS = 4;
const COMPARE_EVENT = "geldesat:compare";

export type CompareItem = {
  id: string;
  title: string;
  price: number;
  currency: string;
  image: string | null;
};

const EMPTY_COMPARE: CompareItem[] = [];
const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined = undefined;
let cachedItems: CompareItem[] = EMPTY_COMPARE;

function sanitizeItems(raw: unknown): CompareItem[] {
  if (!Array.isArray(raw)) return EMPTY_COMPARE;
  const seen = new Set<string>();
  const out: CompareItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Partial<CompareItem>;
    if (typeof item.id !== "string" || !item.id || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push({
      id: item.id,
      title: typeof item.title === "string" ? item.title : "İlan",
      price: typeof item.price === "number" && Number.isFinite(item.price) ? item.price : 0,
      currency: typeof item.currency === "string" && item.currency ? item.currency : "TRY",
      image: typeof item.image === "string" && item.image ? item.image : null,
    });
    if (out.length >= MAX_COMPARE_ITEMS) break;
  }
  return out;
}

function readSnapshot(): CompareItem[] {
  if (typeof window === "undefined") return EMPTY_COMPARE;
  try {
    const raw = window.localStorage.getItem(COMPARE_STORAGE_KEY);
    if (raw === cachedRaw) return cachedItems;
    cachedRaw = raw;
    cachedItems = raw ? sanitizeItems(JSON.parse(raw)) : EMPTY_COMPARE;
    return cachedItems;
  } catch {
    return cachedItems;
  }
}

function writeItems(next: CompareItem[]) {
  const sanitized = sanitizeItems(next);
  const serialized = JSON.stringify(sanitized);
  cachedRaw = serialized;
  cachedItems = sanitized;
  if (typeof window !== "undefined") {
    try {
      if (sanitized.length === 0) window.localStorage.removeItem(COMPARE_STORAGE_KEY);
      else window.localStorage.setItem(COMPARE_STORAGE_KEY, serialized);
    } catch {
      // Storage may be full or disabled; in-memory state still updates.
    }
    window.dispatchEvent(new CustomEvent(COMPARE_EVENT));
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (typeof window === "undefined") return () => listeners.delete(listener);
  const onExternal = () => {
    cachedRaw = undefined;
    listener();
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key === COMPARE_STORAGE_KEY || e.key === null) onExternal();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(COMPARE_EVENT, onExternal);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(COMPARE_EVENT, onExternal);
  };
}

/** Reactive list of up to 4 listings queued for side-by-side comparison. */
export function useCompareList(): CompareItem[] {
  useEffect(() => {
    cachedRaw = undefined;
    for (const listener of listeners) listener();
  }, []);
  return useSyncExternalStore(subscribe, readSnapshot, () => EMPTY_COMPARE);
}

/** Adds or removes `item` in the comparison queue (max 4 items). */
export function toggleCompare(item: CompareItem): { added: boolean; full: boolean } {
  const current = readSnapshot();
  if (current.some((x) => x.id === item.id)) {
    writeItems(current.filter((x) => x.id !== item.id));
    return { added: false, full: false };
  }
  if (current.length >= MAX_COMPARE_ITEMS) {
    return { added: false, full: true };
  }
  writeItems([...current, item]);
  return { added: true, full: false };
}

/** Removes one listing by id from the comparison queue. */
export function removeCompare(id: string): void {
  const current = readSnapshot();
  if (!current.some((x) => x.id === id)) return;
  writeItems(current.filter((x) => x.id !== id));
}

/** Empties the comparison queue. */
export function clearCompare(): void {
  if (readSnapshot().length === 0) return;
  writeItems(EMPTY_COMPARE);
}

export function CompareBar() {
  const items = useCompareList();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [cookieOpen, setCookieOpen] = useState(false);

  useEffect(() => {
    const sync = () => setCookieOpen(document.documentElement.dataset.cookieBanner === "1");
    sync();
    window.addEventListener("geldesat:ui-bars", sync);
    return () => window.removeEventListener("geldesat:ui-bars", sync);
  }, []);

  if (
    cookieOpen ||
    items.length < 1 ||
    pathname === "/karsilastir" ||
    pathname.startsWith("/ilan-ver") ||
    pathname.startsWith("/mesajlar/")
  ) {
    return null;
  }

  const isListingDetail = pathname.startsWith("/ilan/");

  return (
    <aside
      aria-label="Karşılaştırma listesi"
      className={cn(
        "fixed left-1/2 z-40 w-[calc(100%-1.5rem)] max-w-3xl -translate-x-1/2",
        isListingDetail
          ? "bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] lg:bottom-5"
          : "bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] md:bottom-5",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-border bg-surface/95 px-3.5 py-2.5 shadow-lg backdrop-blur-md">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto [scrollbar-width:none]">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex max-w-[170px] shrink-0 items-center gap-2 rounded-xl border border-border bg-elevated/70 py-1 pl-1 pr-1.5"
            >
              <div className="relative grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-elevated">
                {item.image ? (
                  <img src={photoSrc(item.image, 240)} alt="" className="size-full object-cover" />
                ) : (
                  <ImageIcon className="size-4 text-subtle" />
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-fg">{item.title}</p>
                <p className="truncate text-[11px] font-semibold tabular-nums text-primary">
                  {formatPrice(item.price, item.currency)}
                </p>
              </div>
              <button
                type="button"
                aria-label={`${item.title} karşılaştırmadan kaldır`}
                onClick={() => removeCompare(item.id)}
                className="grid size-5 shrink-0 place-items-center rounded-full text-muted hover:bg-surface hover:text-fg"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearCompare}
            aria-label="Karşılaştırmayı temizle"
            className="h-9 px-2.5 text-muted hover:text-danger"
          >
            <Trash2 className="size-4" />
            <span className="hidden sm:inline">Temizle</span>
          </Button>
          <Link to="/karsilastir" className={buttonVariants({ size: "sm", className: "h-9 whitespace-nowrap" })}>
            <ArrowLeftRight className="size-4" /> Karşılaştır ({items.length})
          </Link>
        </div>
      </div>
    </aside>
  );
}
