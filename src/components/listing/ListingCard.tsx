import { Link } from "@tanstack/react-router";
import { Heart, ImageIcon, MapPin } from "lucide-react";
import { useState } from "react";
import { formatDate, formatPrice, cn } from "@/lib/utils";
import type { ListingCard as Listing } from "@/lib/server/helpers";
import { Badge } from "@/components/ui/badge";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { toggleFavorite } from "@/lib/server/social";
import { toast } from "sonner";

export function ListingCard({
  listing,
  variant = "grid",
  initialFavorite = false,
}: {
  listing: Listing;
  variant?: "grid" | "list";
  initialFavorite?: boolean;
}) {
  const [fav, setFav] = useState(initialFavorite);
  const [favLoading, setFavLoading] = useState(false);
  const { user } = useCurrentUserState();

  const img = listing.images[0];
  const featured = listing.featured_until && new Date(listing.featured_until) > new Date();
  const acil = listing.boosts?.includes("ACIL");
  const kalin = listing.boosts?.includes("KALIN") || featured;

  function handleFav(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toast.error("Favorilere eklemek için lütfen giriş yapın");
      return;
    }
    setFavLoading(true);
    toggleFavorite({ data: { listingId: listing.id } })
      .then((res) => {
        setFav(res.favorite);
        toast.success(res.favorite ? "İlan favorilerinize eklendi" : "İlan favorilerinizden çıkarıldı");
      })
      .catch(() => {
        toast.error("İşlem gerçekleştirilemedi");
      })
      .finally(() => setFavLoading(false));
  }

  const media = (
    <div
      className={
        variant === "list"
          ? "relative h-full min-h-[110px] w-[110px] shrink-0 overflow-hidden bg-elevated sm:w-[180px] md:w-[220px]"
          : "relative aspect-[4/3] w-full overflow-hidden bg-elevated"
      }
    >
      {img ? (
        <img
          src={img}
          alt={listing.title}
          loading="lazy"
          decoding="async"
          className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
      ) : (
        <div className="grid size-full place-items-center px-2 text-center">
          <div>
            <ImageIcon className="mx-auto size-6 text-subtle sm:size-8" />
            <p className="mt-1 line-clamp-1 text-[11px] font-medium text-muted sm:text-xs">
              {listing.category_name || "Fotoğraf yok"}
            </p>
          </div>
        </div>
      )}
      <div className="absolute left-1.5 top-1.5 flex flex-wrap gap-1 sm:left-2 sm:top-2">
        {featured ? <Badge tone="ink" className="text-[10px] px-1.5 py-0.5 sm:text-xs">Vitrin</Badge> : null}
        {acil ? <Badge tone="danger" className="text-[10px] px-1.5 py-0.5 sm:text-xs">Acil</Badge> : null}
      </div>
      <button
        type="button"
        onClick={handleFav}
        disabled={favLoading}
        aria-label={fav ? "Favorilerden çıkar" : "Favoriye ekle"}
        className="absolute right-1.5 top-1.5 z-10 grid size-7 place-items-center rounded-full bg-surface/85 backdrop-blur-xs text-muted shadow-sm transition-transform hover:scale-110 active:scale-95 sm:right-2 sm:top-2 sm:size-8"
      >
        <Heart className={cn("size-3.5 transition-colors sm:size-4", fav ? "fill-danger text-danger" : "text-fg/70")} />
      </button>
    </div>
  );

  const body = (
    <div className={variant === "list" ? "flex flex-1 min-w-0 flex-col p-2.5 sm:p-4" : "flex flex-1 flex-col p-2.5 sm:p-4"}>
      <p className="text-sm font-semibold tracking-tight text-primary tabular-nums sm:text-base md:text-lg">
        {formatPrice(listing.price)}
      </p>
      <h3
        className={cn(
          "mt-0.5 line-clamp-2 text-xs leading-snug text-fg group-hover:text-primary sm:mt-1 sm:text-sm",
          kalin ? "font-bold" : "font-medium",
        )}
      >
        {listing.title}
      </h3>
      <div className="mt-1.5 flex flex-wrap gap-1 sm:mt-2">
        {Object.values(listing.attrs)
          .slice(0, 3)
          .map((v) => (
            <span
              key={String(v)}
              className="rounded bg-elevated px-1 py-0.5 text-[10px] text-muted sm:rounded-md sm:px-1.5 sm:text-xs"
            >
              {String(v)}
            </span>
          ))}
      </div>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-1 pt-2 text-[10px] text-muted sm:pt-3 sm:text-xs">
        <span className="flex min-w-0 items-center gap-1 truncate max-w-[65%] sm:max-w-[70%]">
          <MapPin className="size-3 shrink-0 sm:size-3.5" />
          <span className="truncate">
            {[listing.city, listing.district].filter(Boolean).join(" / ") || "Konum yok"}
          </span>
        </span>
        <span className="shrink-0">{formatDate(listing.created_at)}</span>
      </div>
    </div>
  );

  return (
    <Link
      to="/ilan/$slug"
      params={{ slug: listing.slug }}
      className={`group flex overflow-hidden rounded-xl border border-border bg-surface shadow-card transition-[box-shadow,transform,border-color] duration-150 hover:-translate-y-px hover:shadow-lift ${variant === "list" ? "flex-row" : "flex-col"}`}
    >
      {variant === "list" ? (
        <div className="flex w-full flex-row">
          {media}
          {body}
        </div>
      ) : (
        <>
          {media}
          {body}
        </>
      )}
    </Link>
  );
}