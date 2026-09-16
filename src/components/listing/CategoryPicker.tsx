import { useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatNumber } from "@/lib/utils";
import type { CategoryRow } from "@/lib/server/helpers";

export function sortedCats(list: CategoryRow[]) {
  return [...list].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "tr"));
}

const POPULAR_NAMES = new Set([
  "BMW",
  "Mercedes-Benz",
  "Audi",
  "Volkswagen",
  "Renault",
  "Fiat",
  "Ford",
  "Toyota",
  "Honda",
  "Hyundai",
  "Opel",
  "Peugeot",
  "Citroen",
  "Volvo",
  "Nissan",
  "Skoda",
  "Seat",
  "Dacia",
  "Tesla",
  "Togg",
  "Yamaha",
  "Kawasaki",
  "Suzuki",
  "KTM",
  "Vespa",
]);

const LETTER_ORDER = "#ABCÇDEFGĞHIİJKLMNOÖPQRSŞTUÜVWXYZ";

function firstLetter(name: string) {
  const ch = name.trim().charAt(0);
  if (!ch || /\d/.test(ch)) return "#";
  return ch.toLocaleUpperCase("tr");
}

function sortLetters(a: string, b: string) {
  const ia = LETTER_ORDER.indexOf(a);
  const ib = LETTER_ORDER.indexOf(b);
  if (ia >= 0 && ib >= 0) return ia - ib;
  if (ia >= 0) return -1;
  if (ib >= 0) return 1;
  return a.localeCompare(b, "tr");
}

const ROW =
  "flex min-h-12 w-full items-center justify-between gap-3 px-3 text-left text-sm transition-colors duration-150 hover:bg-elevated focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary";

type DirectoryProps = {
  items: CategoryRow[];
  counts?: Record<string, number>;
  onPick?: (c: CategoryRow) => void;
  placeholder?: string;
};

function CategoryDirectory({ items, counts, onPick, placeholder }: DirectoryProps) {
  const [q, setQ] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const headingRefs = useRef<Record<string, HTMLElement | null>>({});

  const list = useMemo(() => sortedCats(items), [items]);
  const shown = useMemo(() => {
    const s = q.trim().toLocaleLowerCase("tr");
    if (!s) return list;
    return list.filter((c) => c.name.toLocaleLowerCase("tr").includes(s));
  }, [list, q]);

  const searching = q.trim().length > 0;
  const useLetters = !searching && shown.length >= 18;
  const popular = useMemo(() => {
    if (searching) return [];
    return list.filter((c) => POPULAR_NAMES.has(c.name)).slice(0, 10);
  }, [list, searching]);

  const groups = useMemo(() => {
    if (!useLetters) return [{ letter: "", items: shown }];
    const map = new Map<string, CategoryRow[]>();
    for (const c of shown) {
      const letter = firstLetter(c.name);
      const arr = map.get(letter) ?? [];
      arr.push(c);
      map.set(letter, arr);
    }
    return [...map.keys()].sort(sortLetters).map((letter) => ({ letter, items: map.get(letter) ?? [] }));
  }, [shown, useLetters]);

  const letters = groups.map((g) => g.letter).filter(Boolean);

  function jump(letter: string) {
    const el = headingRefs.current[letter];
    const box = listRef.current;
    if (!el || !box) return;
    box.scrollTo({ top: el.offsetTop, behavior: "smooth" });
  }

  function meta(c: CategoryRow) {
    const n = counts?.[c.id];
    return (
      <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
        {n != null && n > 0 ? <span className="tabular-nums">{formatNumber(n)}</span> : null}
        {c.has_children ? <ChevronRight className="size-4 text-subtle" aria-hidden /> : null}
      </span>
    );
  }

  function row(c: CategoryRow) {
    if (onPick) {
      return (
        <button key={c.id} type="button" className={ROW} onClick={() => onPick(c)}>
          <span className="truncate font-medium">{c.name}</span>
          {meta(c)}
        </button>
      );
    }
    return (
      <Link key={c.id} to="/category/$slug" params={{ slug: c.slug }} className={ROW}>
        <span className="truncate font-medium">{c.name}</span>
        {meta(c)}
      </Link>
    );
  }

  return (
    <div>
      {items.length > 8 ? (
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={placeholder ?? "Marka veya model ara"}
            className="pl-9"
          />
        </div>
      ) : null}

      {popular.length >= 4 ? (
        <div className="mb-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Popüler</p>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {popular.map((c) =>
              onPick ? (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onPick(c)}
                  className="shrink-0 rounded-full border border-border bg-elevated px-3 py-2 text-sm hover:border-primary"
                >
                  {c.name}
                </button>
              ) : (
                <Link
                  key={c.id}
                  to="/category/$slug"
                  params={{ slug: c.slug }}
                  className="shrink-0 rounded-full border border-border bg-elevated px-3 py-2 text-sm hover:border-primary"
                >
                  {c.name}
                </Link>
              ),
            )}
          </div>
        </div>
      ) : null}

      {useLetters ? (
        <div className="mb-2 flex gap-1 overflow-x-auto pb-1 md:flex-wrap">
          {letters.map((letter) => (
            <button
              key={letter}
              type="button"
              onClick={() => jump(letter)}
              className="flex size-9 shrink-0 items-center justify-center rounded-md text-xs font-semibold text-muted hover:bg-elevated hover:text-fg"
              aria-label={`${letter} harfine git`}
            >
              {letter}
            </button>
          ))}
        </div>
      ) : null}

      <div
        ref={listRef}
        className="relative max-h-96 overflow-auto rounded-lg border border-border bg-surface md:max-h-[28rem]"
      >
        {groups.map((g) => (
          <section
            key={g.letter || "all"}
            ref={(el) => {
              if (g.letter) headingRefs.current[g.letter] = el;
            }}
          >
            {g.letter ? (
              <h3 className="border-b border-border bg-elevated px-3 py-1.5 text-xs font-semibold tracking-wide text-muted">
                {g.letter}
              </h3>
            ) : null}
            <ul>
              {g.items.map((c) => (
                <li key={c.id} className="border-b border-border last:border-b-0">
                  {row(c)}
                </li>
              ))}
            </ul>
          </section>
        ))}
        {shown.length === 0 ? <p className="px-3 py-6 text-sm text-muted">Eşleşen kategori yok.</p> : null}
      </div>
      <p className="mt-2 text-xs text-subtle">{shown.length} kategori</p>
    </div>
  );
}

export function SubcategoryGrid({
  items,
  counts,
}: {
  items: CategoryRow[];
  counts?: Record<string, number>;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mt-4">
      <CategoryDirectory items={items} counts={counts} />
    </div>
  );
}

export function CategoryButtons({
  items,
  counts,
  onPick,
}: {
  items: CategoryRow[];
  counts?: Record<string, number>;
  onPick: (c: CategoryRow) => void;
}) {
  return (
    <CategoryDirectory
      items={items}
      counts={counts}
      onPick={onPick}
      placeholder="Ara (ör. BMW, Civic, Satılık Daire)"
    />
  );
}
