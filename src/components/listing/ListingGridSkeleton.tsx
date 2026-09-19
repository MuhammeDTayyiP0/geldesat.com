import { Skeleton } from "@/components/ui/skeleton";

export function ListingGridSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 animate-in fade-in duration-300">
      {/* Breadcrumb Skeleton */}
      <div className="mb-4 flex items-center gap-2">
        <Skeleton className="h-4 w-16 rounded bg-border/60" />
        <Skeleton className="size-3.5 rounded bg-border/40" />
        <Skeleton className="h-4 w-24 rounded bg-border/60" />
      </div>

      {/* Header & Subcategories */}
      <div className="mb-6 space-y-3">
        <Skeleton className="h-8 w-56 rounded-lg bg-border/70" />
        <Skeleton className="h-4 w-24 rounded bg-border/50" />

        {/* Subcategory Pills */}
        <div className="mt-4 flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-9 w-28 rounded-full bg-border/50" />
          ))}
        </div>
      </div>

      {/* Main Content: Sidebar + Grid */}
      <div className="mt-8 grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Left Sidebar Filter Skeleton */}
        <aside className="hidden space-y-5 rounded-2xl border border-border bg-surface p-5 shadow-card lg:block h-fit">
          <Skeleton className="h-5 w-24 rounded bg-border/70" />

          {/* Location */}
          <div className="space-y-2 border-t border-border pt-4">
            <Skeleton className="h-4 w-16 rounded bg-border/60" />
            <Skeleton className="h-10 w-full rounded-lg bg-border/40" />
          </div>

          {/* Price Range */}
          <div className="space-y-2 border-t border-border pt-4">
            <Skeleton className="h-4 w-20 rounded bg-border/60" />
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="h-10 w-full rounded-lg bg-border/40" />
              <Skeleton className="h-10 w-full rounded-lg bg-border/40" />
            </div>
          </div>

          {/* Filter Button */}
          <div className="border-t border-border pt-4">
            <Skeleton className="h-11 w-full rounded-xl bg-primary/20" />
          </div>
        </aside>

        {/* Right Area: Toolbar + Listing Cards Grid */}
        <div className="space-y-4">
          {/* Top Sort / Filter Bar */}
          <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-3 shadow-card">
            <Skeleton className="h-4 w-32 rounded bg-border/60" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-28 rounded-lg bg-border/50" />
              <Skeleton className="size-9 rounded-lg bg-border/50" />
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card space-y-3 p-3"
              >
                {/* Image */}
                <Skeleton className="aspect-[4/3] w-full rounded-xl bg-border/50" />
                
                {/* Details */}
                <div className="space-y-2 px-1 pb-1">
                  <Skeleton className="h-5 w-4/5 rounded bg-border/70" />
                  <Skeleton className="h-6 w-28 rounded-md bg-border/80" />
                  
                  <div className="flex items-center justify-between pt-2 border-t border-border/50">
                    <Skeleton className="h-3.5 w-24 rounded bg-border/40" />
                    <Skeleton className="h-3.5 w-16 rounded bg-border/40" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
