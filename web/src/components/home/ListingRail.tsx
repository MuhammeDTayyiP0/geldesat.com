import { Link, type LinkProps } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { ListingCard } from "@/components/listing/ListingCard";
import { Skeleton } from "@/components/ui/skeleton";
import type { ListingCard as Listing } from "@/lib/server/helpers";

/** A titled row of listing cards that scrolls sideways, like the app's home rails. */
export function ListingRail({
  title,
  subtitle,
  items,
  loading = false,
  seeAll,
  action,
}: {
  title: string;
  subtitle?: string;
  items: Listing[] | null | undefined;
  loading?: boolean;
  /** Where "Tümü" goes; omitted for rails without a full list. */
  seeAll?: LinkProps;
  /** Extra control next to the title (e.g. "Şehri değiştir"). */
  action?: React.ReactNode;
}) {
  if (!loading && !items?.length) return null;
  return (
    <section className="py-3 sm:py-4">
      <div className="mb-2.5 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-[17px] font-semibold tracking-tight sm:text-lg">{title}</h2>
          {subtitle ? <p className="truncate text-xs text-muted sm:text-sm">{subtitle}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {action}
          {seeAll ? (
            <Link {...seeAll} className="inline-flex items-center text-sm font-medium text-primary hover:underline">
              Tümü <ChevronRight className="size-4" />
            </Link>
          ) : null}
        </div>
      </div>
      <div className="-mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:gap-3 [&::-webkit-scrollbar]:hidden">
        {loading && !items?.length
          ? Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="w-[168px] shrink-0 overflow-hidden rounded-[14px] border border-border bg-surface sm:w-[200px]">
                <Skeleton className="aspect-[4/3] w-full rounded-none bg-border/50" />
                <div className="space-y-2 p-2.5">
                  <Skeleton className="h-5 w-20 rounded bg-border/70" />
                  <Skeleton className="h-4 w-4/5 rounded bg-border/50" />
                </div>
              </div>
            ))
          : items?.map((l) => <ListingCard key={l.id} listing={l} variant="rail" />)}
      </div>
    </section>
  );
}
