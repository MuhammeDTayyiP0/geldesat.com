import { Link } from "@tanstack/react-router";
import { ImageIcon, MapPin } from "lucide-react";
import { formatDate, formatPrice } from "@/lib/utils";
import type { ListingCard as Listing } from "@/lib/server/helpers";
import { Badge } from "@/components/ui/badge";

export function ListingCard({ listing, variant = "grid" }: { listing: Listing; variant?: "grid" | "list" }) {
  const img = listing.images[0];
  const featured = listing.featured_until && new Date(listing.featured_until) > new Date();
  const acil = listing.boosts?.includes("ACIL");
  const kalin = listing.boosts?.includes("KALIN") || featured;

  const media = (
    <div
      className={
        variant === "list"
          ? "relative h-full min-h-[115px] w-[115px] shrink-0 overflow-hidden bg-elevated sm:w-[180px] md:w-[220px]"
          : "relative aspect-[4/3] overflow-hidden bg-elevated"
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
            <ImageIcon className="mx-auto size-8 text-subtle" />
            <p className="mt-1 text-xs font-medium text-muted">{listing.category_name || "Fotoğraf yok"}</p>
          </div>
        </div>
      )}
      <div className="absolute left-2 top-2 flex flex-wrap gap-1">
        {featured ? <Badge tone="ink">Vitrin</Badge> : null}
        {acil ? <Badge tone="danger">Acil</Badge> : null}
      </div>
    </div>
  );

  const body = (
    <div className={variant === "list" ? "flex flex-1 min-w-0 flex-col p-3 sm:p-4" : "flex flex-1 flex-col p-4"}>
      <p className="text-lg font-semibold tracking-tight text-primary tabular-nums">{formatPrice(listing.price)}</p>
      <h3 className={`mt-1 line-clamp-2 text-sm leading-snug text-fg group-hover:text-primary ${kalin ? "font-bold" : "font-medium"}`}>
        {listing.title}
      </h3>
      <div className="mt-2 flex flex-wrap gap-1">
        {Object.values(listing.attrs)
          .slice(0, 3)
          .map((v) => (
            <span key={String(v)} className="rounded-md bg-elevated px-1.5 py-0.5 text-xs text-muted">
              {String(v)}
            </span>
          ))}
      </div>
      <div className="mt-auto flex items-center justify-between pt-3 text-xs text-muted">
        <span className="flex min-w-0 items-center gap-1 truncate">
          <MapPin className="size-3.5 shrink-0" />
          <span className="truncate">{[listing.city, listing.district].filter(Boolean).join(" / ") || "Konum yok"}</span>
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