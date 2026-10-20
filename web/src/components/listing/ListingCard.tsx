import { Link } from "@tanstack/react-router";
import { Heart, ImageIcon, MapPin } from "lucide-react";
import { useState } from "react";
import { cn, formatPrice, listingAge, listingHighlights } from "@/lib/utils";
import type { ListingCard as Listing } from "@/lib/server/helpers";
import { Badge } from "@/components/ui/badge";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { toggleFavorite } from "@/lib/server/social";
import { toast } from "sonner";
import { photoSrc, photoSrcSet } from "@/lib/images";
import { setFavorite, useFavoriteIds } from "@/lib/favorites-store";

export function ListingCard({
  listing,
  variant = "grid",
  initialFavorite = false,
  priority = false,
  onFavoriteChange,
}: {
  listing: Listing;
  /** grid: responsive grid cell; list: horizontal row; rail: fixed-width card in a sideways row. */
  variant?: "grid" | "list" | "rail";
  initialFavorite?: boolean;
  /** Above the fold on load: fetch the photo right away instead of lazily. */
  priority?: boolean;
  /** Called after the heart toggles, e.g. so the favorites page can drop the card. */
  onFavoriteChange?: (favorite: boolean) => void;
}) {
  const [favLoading, setFavLoading] = useState(false);
  const { user } = useCurrentUserState();
  const favIds = useFavoriteIds(user?.id);
  const fav = favIds.has(listing.id) || (initialFavorite && !favIds.size);

  const img = listing.images[0];
  const featured =
    Boolean(listing.featured_until && new Date(listing.featured_until) > new Date()) || Boolean(listing.boosts?.includes("VITRIN"));
  const acil = listing.boosts?.includes("ACIL");
  const kalin = listing.boosts?.includes("KALIN");
  const extra = listingHighlights(listing.attrs);
  const place = [listing.district, listing.city].filter(Boolean).join(", ");

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
        setFavorite(listing.id, res.favorite);
        onFavoriteChange?.(res.favorite);
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
          ? "relative w-[128px] shrink-0 self-stretch overflow-hidden bg-elevated sm:w-[200px]"
          : "relative aspect-[4/3] w-full overflow-hidden bg-elevated"
      }
    >
      {img ? (
        <img
          src={photoSrc(img, 480)}
          srcSet={photoSrcSet(img, [240, 480, 800])}
          sizes={variant === "list" ? "(min-width: 640px) 200px, 128px" : variant === "rail" ? "200px" : "(min-width: 1024px) 300px, (min-width: 640px) 33vw, 50vw"}
          alt={listing.title}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : undefined}
          decoding="async"
          className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center px-2 text-center">
          <div>
            <ImageIcon className="mx-auto size-6 text-subtle sm:size-8" />
            <p className="mt-1 line-clamp-1 text-[11px] font-medium text-muted sm:text-xs">
              {listing.category_name || "Fotoğraf yok"}
            </p>
          </div>
        </div>
      )}
      {featured || acil ? (
        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          {acil ? <Badge tone="urgent" className="px-1.5 py-0.5 text-[10px] tracking-wide">ACİL</Badge> : null}
          {featured && variant !== "list" ? (
            <Badge tone="primary" className="bg-surface/90 px-1.5 py-0.5 text-[10px] font-bold tracking-wide backdrop-blur-xs">VİTRİN</Badge>
          ) : null}
        </div>
      ) : null}
      <button
        type="button"
        onClick={handleFav}
        disabled={favLoading}
        aria-label={fav ? "Favorilerden çıkar" : "Favoriye ekle"}
        className="absolute right-1 top-1 z-10 grid size-9 place-items-center transition-transform hover:scale-110 active:scale-95"
      >
        <Heart
          className={cn("size-[18px] drop-shadow-[0_1px_2px_rgb(0_0_0/0.45)]", fav ? "fill-[#f04438] text-[#f04438]" : "fill-black/25 text-white")}
          strokeWidth={2.2}
        />
      </button>
    </div>
  );

  const body = (
    <div className={cn("flex min-w-0 flex-1 flex-col gap-0.5 p-2.5", variant === "list" && "sm:p-4")}>
      <p className="truncate text-base font-semibold tracking-tight text-primary tabular-nums sm:text-[17px]">
        {formatPrice(listing.price, listing.currency)}
      </p>
      <h3
        className={cn(
          "line-clamp-2 min-h-[2.5em] text-[13px] leading-snug text-fg group-hover:text-primary sm:text-sm",
          kalin ? "font-bold" : "font-medium",
        )}
      >
        {listing.title}
      </h3>
      {extra.length ? <p className="truncate text-xs text-muted">{extra.join(" · ")}</p> : null}
      <div className="mt-auto flex items-center gap-1 pt-1 text-[11px] text-subtle sm:text-xs">
        {place ? <MapPin className="size-3 shrink-0" /> : null}
        <span className="min-w-0 flex-1 truncate">{place || listing.category_name || ""}</span>
        {variant !== "rail" ? <span className="shrink-0">{listingAge(listing.created_at)}</span> : null}
      </div>
    </div>
  );

  return (
    <Link
      to="/ilan/$slug"
      params={{ slug: listing.slug }}
      className={cn(
        "group flex overflow-hidden rounded-[14px] border border-border bg-surface transition-[box-shadow,transform,border-color] duration-150 hover:-translate-y-px hover:shadow-lift",
        variant === "list" ? "min-h-[110px] flex-row" : "flex-col",
        variant === "rail" && "w-[168px] shrink-0 snap-start sm:w-[200px]",
        acil && variant === "list" && "border-urgent",
      )}
    >
      {media}
      {body}
    </Link>
  );
}
