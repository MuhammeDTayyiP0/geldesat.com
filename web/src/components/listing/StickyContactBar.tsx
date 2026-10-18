import * as React from "react";
import { Heart, MessageCircle, Phone, Pencil } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { cleanPhone, formatPrice } from "@/lib/utils";

interface StickyContactBarProps {
  price: number;
  isOwner: boolean;
  isLive: boolean;
  phone: string | null;
  hasPhone: boolean;
  onRevealPhone: () => Promise<void>;
  isFav: boolean;
  onToggleFav: () => Promise<void>;
  onScrollToContact: () => void;
  listingId: string;
  listingTitle: string;
}

export function StickyContactBar({
  price,
  isOwner,
  isLive,
  phone,
  hasPhone,
  onRevealPhone,
  isFav,
  onToggleFav,
  onScrollToContact,
  listingId,
  listingTitle,
}: StickyContactBarProps) {
  const [phoneLoading, setPhoneLoading] = React.useState(false);

  const handlePhoneClick = async () => {
    if (phone) return;
    setPhoneLoading(true);
    try {
      await onRevealPhone();
    } finally {
      setPhoneLoading(false);
    }
  };

  const clean = phone ? cleanPhone(phone) : "";
  const tenDigit = clean.startsWith("0") ? clean.slice(1) : clean;
  const whatsappUrl = phone
    ? `https://wa.me/90${tenDigit}?text=${encodeURIComponent(
        `${listingTitle} ilanınız hakkında bilgi almak istiyorum.`
      )}`
    : "";

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between gap-3 border-t border-border bg-surface/95 px-4 py-3 shadow-lg backdrop-blur-md lg:hidden"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))" }}
    >
      {/* Price section */}
      <div className="min-w-0">
        <p className="text-2xs font-medium text-muted uppercase tracking-wider">Fiyat</p>
        <p className="truncate font-display text-lg font-bold text-primary tabular-nums">
          {formatPrice(price)}
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        {isOwner ? (
          <Link to="/ilan-ver" search={{ id: listingId }}>
            <Button size="sm" className="gap-1.5 font-semibold">
              <Pencil className="size-4" /> Düzenle
            </Button>
          </Link>
        ) : isLive ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onToggleFav}
              className={`size-10 shrink-0 ${isFav ? "border-danger/30 text-danger bg-danger/5" : ""}`}
              title={isFav ? "Favorilerden Çıkar" : "Favoriye Ekle"}
              aria-label="Favori"
            >
              <Heart className={`size-4.5 ${isFav ? "fill-danger text-danger" : ""}`} />
            </Button>

            {phone ? (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex"
              >
                <Button size="sm" className="bg-[#25D366] hover:bg-[#1EBE5D] text-white font-semibold gap-1.5 px-3">
                  <Phone className="size-4" /> WhatsApp
                </Button>
              </a>
            ) : hasPhone ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={phoneLoading}
                onClick={handlePhoneClick}
                className="gap-1.5 px-3 font-semibold"
              >
                <Phone className="size-4 text-ok" />
                {phoneLoading ? "Açılıyor…" : "Ara"}
              </Button>
            ) : null}

            <Button
              type="button"
              size="sm"
              onClick={onScrollToContact}
              className="gap-1.5 px-3.5 font-semibold"
            >
              <MessageCircle className="size-4" /> Mesaj
            </Button>
          </>
        ) : (
          <span className="text-xs text-muted font-medium bg-elevated px-3 py-1.5 rounded-lg">
            İletişim Kapalı
          </span>
        )}
      </div>
    </div>
  );
}
