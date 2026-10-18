import { Skeleton } from "@/components/ui/skeleton";
import { ImageIcon } from "lucide-react";

export function ListingDetailSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8 animate-in fade-in duration-200">
      {/* Breadcrumb Skeleton */}
      <div className="mb-4 flex items-center gap-2">
        <Skeleton className="h-3.5 w-16 rounded bg-border/60" />
        <Skeleton className="size-3.5 rounded bg-border/40" />
        <Skeleton className="h-3.5 w-24 rounded bg-border/60" />
        <Skeleton className="size-3.5 rounded bg-border/40" />
        <Skeleton className="h-3.5 w-32 rounded bg-border/60" />
      </div>

      {/* Mobile-Only Header Skeleton */}
      <div className="mb-4 lg:hidden space-y-2">
        <Skeleton className="h-5 w-24 rounded bg-border/60" />
        <Skeleton className="h-7 w-3/4 rounded-lg bg-border/70" />
        <Skeleton className="h-4 w-40 rounded bg-border/50" />
        <Skeleton className="h-8 w-32 rounded-lg bg-border/80 mt-1" />
      </div>

      {/* Main Grid: Gallery + Info */}
      <div className="grid gap-8 lg:grid-cols-[1.4fr_0.8fr]">
        {/* Left Column: Media & Details */}
        <div className="space-y-6">
          {/* Main Photo Skeleton */}
          <div className="relative flex aspect-[16/10] w-full items-center justify-center overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
            <Skeleton className="absolute inset-0 size-full" />
            <div className="relative z-10 flex flex-col items-center gap-2 text-muted/30">
              <ImageIcon className="size-12 stroke-[1.5]" />
            </div>
          </div>

          {/* Thumbnails row */}
          <div className="flex gap-2.5 overflow-x-auto pb-1">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton
                key={i}
                className="h-18 w-24 shrink-0 rounded-xl border border-border bg-border/40"
              />
            ))}
          </div>

          {/* Attributes Grid Skeleton */}
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-card space-y-3">
            <Skeleton className="mb-2 h-5 w-32 rounded bg-border/70" />
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="flex justify-between py-1.5 border-b border-border/40">
                  <Skeleton className="h-4 w-24 rounded bg-border/50" />
                  <Skeleton className="h-4 w-28 rounded bg-border/70" />
                </div>
              ))}
            </div>
          </div>

          {/* Description Skeleton */}
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-card space-y-3">
            <Skeleton className="h-5 w-28 rounded bg-border/70" />
            <Skeleton className="h-4 w-full rounded bg-border/50" />
            <Skeleton className="h-4 w-[92%] rounded bg-border/50" />
            <Skeleton className="h-4 w-[85%] rounded bg-border/50" />
            <Skeleton className="h-4 w-[60%] rounded bg-border/50" />
          </div>
        </div>

        {/* Right Column: Sticky Sidebar Skeleton */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-card space-y-5">
            {/* Desktop Title & Price */}
            <div className="hidden lg:block space-y-2.5">
              <Skeleton className="h-5 w-24 rounded bg-border/60" />
              <Skeleton className="h-7 w-full rounded-lg bg-border/80" />
              <Skeleton className="h-4 w-40 rounded bg-border/50" />
              <Skeleton className="h-9 w-44 rounded-lg bg-border/80 mt-1" />
            </div>

            {/* Seller info box skeleton */}
            <div className="rounded-xl bg-elevated/50 p-3.5 border border-border/70">
              <div className="flex items-center gap-3">
                <Skeleton className="size-12 rounded-full bg-border/70 shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-28 rounded bg-border/70" />
                  <Skeleton className="h-3 w-20 rounded bg-border/50" />
                </div>
              </div>
            </div>

            {/* Contact buttons skeleton */}
            <div className="space-y-2.5">
              <Skeleton className="h-11 w-full rounded-xl bg-primary/20" />
              <Skeleton className="h-24 w-full rounded-xl bg-border/40" />
              <div className="flex gap-2">
                <Skeleton className="h-10 flex-1 rounded-xl bg-border/50" />
                <Skeleton className="h-10 flex-1 rounded-xl bg-border/50" />
              </div>
            </div>
          </div>

          {/* Safe Shopping Box Skeleton */}
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-card space-y-2">
            <Skeleton className="h-4 w-36 rounded bg-border/70" />
            <Skeleton className="h-3.5 w-full rounded bg-border/40" />
            <Skeleton className="h-3.5 w-4/5 rounded bg-border/40" />
          </div>
        </div>
      </div>
    </div>
  );
}
