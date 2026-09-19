import { Skeleton } from "@/components/ui/skeleton";

export function ListingDetailSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 animate-in fade-in duration-300">
      {/* Breadcrumb Skeleton */}
      <div className="mb-4 flex items-center gap-2">
        <Skeleton className="h-4 w-16 rounded bg-border/60" />
        <Skeleton className="size-3.5 rounded bg-border/40" />
        <Skeleton className="h-4 w-24 rounded bg-border/60" />
        <Skeleton className="size-3.5 rounded bg-border/40" />
        <Skeleton className="h-4 w-32 rounded bg-border/60" />
      </div>

      {/* Title & Action Buttons Skeleton */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-72 sm:w-96 rounded-lg bg-border/70" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-28 rounded bg-border/50" />
            <Skeleton className="h-4 w-20 rounded bg-border/50" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="size-10 rounded-lg bg-border/60" />
          <Skeleton className="size-10 rounded-lg bg-border/60" />
        </div>
      </div>

      {/* Main Grid: Gallery + Info */}
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* Left Column: Media & Description */}
        <div className="space-y-6">
          {/* Main Photo Skeleton */}
          <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
            <Skeleton className="aspect-[4/3] w-full bg-border/50" />
          </div>

          {/* Thumbnails row */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton
                key={i}
                className="size-16 shrink-0 rounded-lg border border-border bg-border/40"
              />
            ))}
          </div>

          {/* Attributes Grid Skeleton */}
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-card">
            <Skeleton className="mb-4 h-5 w-32 rounded bg-border/70" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="rounded-lg bg-elevated/70 p-3 space-y-1.5">
                  <Skeleton className="h-3 w-16 rounded bg-border/50" />
                  <Skeleton className="h-4 w-24 rounded bg-border/70" />
                </div>
              ))}
            </div>
          </div>

          {/* Description Skeleton */}
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-card space-y-3">
            <Skeleton className="h-5 w-40 rounded bg-border/70" />
            <Skeleton className="h-4 w-full rounded bg-border/50" />
            <Skeleton className="h-4 w-[92%] rounded bg-border/50" />
            <Skeleton className="h-4 w-[85%] rounded bg-border/50" />
            <Skeleton className="h-4 w-[60%] rounded bg-border/50" />
          </div>
        </div>

        {/* Right Column: Price & Seller Card Skeleton */}
        <div className="space-y-6">
          {/* Price & Contact Box */}
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-card space-y-5">
            <div className="space-y-1">
              <Skeleton className="h-3.5 w-16 rounded bg-border/50" />
              <Skeleton className="h-9 w-44 rounded-lg bg-border/80" />
            </div>

            <div className="space-y-2.5">
              <Skeleton className="h-11 w-full rounded-xl bg-primary/20" />
              <Skeleton className="h-11 w-full rounded-xl bg-border/60" />
            </div>

            {/* Seller info */}
            <div className="border-t border-border pt-4">
              <div className="flex items-center gap-3">
                <Skeleton className="size-12 rounded-full bg-border/70" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-28 rounded bg-border/70" />
                  <Skeleton className="h-3 w-20 rounded bg-border/50" />
                </div>
              </div>
            </div>
          </div>

          {/* Safe Shopping Box */}
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-card space-y-2">
            <Skeleton className="h-4 w-32 rounded bg-border/70" />
            <Skeleton className="h-3 w-full rounded bg-border/40" />
            <Skeleton className="h-3 w-4/5 rounded bg-border/40" />
          </div>
        </div>
      </div>
    </div>
  );
}
