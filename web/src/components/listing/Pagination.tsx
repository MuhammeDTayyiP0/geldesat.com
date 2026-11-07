import { Link } from "@tanstack/react-router";
import type { CatalogSearch } from "@/lib/search-params";
import { cn } from "@/lib/utils";

/** 1 2 … current±1 … last, so any page count stays on one line. */
export function buildPageRange(page: number, pages: number): (number | "...")[] {
  if (pages <= 10) return Array.from({ length: pages }, (_, i) => i + 1);
  const near = new Set([1, 2, page - 1, page, page + 1, pages - 1, pages].filter((p) => p >= 1 && p <= pages));
  const sorted = Array.from(near).sort((a, b) => a - b);
  const out: (number | "...")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push("...");
    out.push(sorted[i]);
  }
  return out;
}

const STEP = "rounded-lg border border-border px-3.5 py-2 text-sm font-medium transition-colors hover:bg-elevated";
const OFF = "pointer-events-none opacity-40";

/**
 * Real links, so pages can be crawled and opened in a new tab. A page change
 * keeps what is in the URL; filters typed but not applied stay out of it.
 */
export function Pagination({
  page,
  pages,
  search,
  slug,
}: {
  page: number;
  pages: number;
  search: CatalogSearch;
  /** Category page slug; without it the links go to /search. */
  slug?: string;
}) {
  if (pages <= 1) return null;
  const link = (target: number) =>
    slug
      ? ({ to: "/category/$slug", params: { slug }, search: { ...search, page: String(target) } } as const)
      : ({ to: "/search", search: { ...search, page: String(target) } } as const);
  return (
    <nav aria-label="Sayfalar" className="mt-8">
      <div className="flex items-center justify-between gap-2 sm:hidden">
        <Link {...link(page - 1)} aria-disabled={page <= 1} tabIndex={page <= 1 ? -1 : undefined} className={cn(STEP, page <= 1 && OFF)}>
          ← Önceki
        </Link>
        <span className="text-xs font-bold text-fg">
          Sayfa {page} / {pages}
        </span>
        <Link {...link(page + 1)} aria-disabled={page >= pages} tabIndex={page >= pages ? -1 : undefined} className={cn(STEP, page >= pages && OFF)}>
          Sonraki →
        </Link>
      </div>
      <div className="hidden flex-wrap items-center justify-center gap-1 sm:flex">
        <Link {...link(page - 1)} aria-disabled={page <= 1} tabIndex={page <= 1 ? -1 : undefined} className={cn(STEP, page <= 1 && OFF)}>
          ← Önceki
        </Link>
        {buildPageRange(page, pages).map((p, i) =>
          p === "..." ? (
            <span key={`e${i}`} className="grid size-10 select-none place-items-center text-muted">
              …
            </span>
          ) : (
            <Link
              key={p}
              {...link(p)}
              aria-current={p === page ? "page" : undefined}
              className={cn(
                "grid size-10 place-items-center rounded-lg text-sm font-semibold transition-colors",
                p === page ? "bg-primary-solid text-primary-fg shadow-2xs" : "border border-border hover:bg-elevated",
              )}
            >
              {p}
            </Link>
          ),
        )}
        <Link {...link(page + 1)} aria-disabled={page >= pages} tabIndex={page >= pages ? -1 : undefined} className={cn(STEP, page >= pages && OFF)}>
          Sonraki →
        </Link>
      </div>
    </nav>
  );
}
