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

          <CardGridSkeleton count={6} className="xl:grid-cols-3" />
        </div>
      </div>
    </div>
  );
}

/** Route pending screen for a profile page (seller, store): header block plus cards. */
export function ProfilePageSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 animate-in fade-in duration-300" aria-busy>
      <div className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-5">
        <Skeleton className="size-16 shrink-0 rounded-full bg-border/60" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-48 rounded bg-border/70" />
          <Skeleton className="h-4 w-64 max-w-full rounded bg-border/50" />
        </div>
      </div>
      <CardGridSkeleton count={6} className="mt-6 lg:grid-cols-3" />
    </div>
  );
}

/** Placeholder cards shaped like ListingCard (two per row on phones, as in the app). */
export function CardGridSkeleton({ count = 6, className = "" }: { count?: number; className?: string }) {
  return (
    <div className={`grid grid-cols-2 gap-2.5 sm:gap-4 ${className}`} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="overflow-hidden rounded-[14px] border border-border bg-surface">
          <Skeleton className="aspect-[4/3] w-full rounded-none bg-border/50" />
          <div className="space-y-2 p-2.5">
            <Skeleton className="h-5 w-24 rounded bg-border/70" />
            <Skeleton className="h-4 w-4/5 rounded bg-border/50" />
            <Skeleton className="h-3 w-1/2 rounded bg-border/40" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Placeholder rows shaped like the list variant of ListingCard. */
export function CardListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-3" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex min-h-[110px] overflow-hidden rounded-[14px] border border-border bg-surface">
          <Skeleton className="w-[128px] shrink-0 rounded-none bg-border/50 sm:w-[200px]" />
          <div className="flex-1 space-y-2 p-3">
            <Skeleton className="h-5 w-24 rounded bg-border/70" />
            <Skeleton className="h-4 w-4/5 rounded bg-border/50" />
            <Skeleton className="h-3 w-1/3 rounded bg-border/40" />
          </div>
        </div>
      ))}
    </div>
  );
}
