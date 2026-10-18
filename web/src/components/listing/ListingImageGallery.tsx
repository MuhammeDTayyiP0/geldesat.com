import * as React from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Maximize2, X, ImageIcon } from "lucide-react";
import { photoSrc } from "@/lib/images";

interface ListingImageGalleryProps {
  images: string[];
  title: string;
  categoryName?: string;
}

export function ListingImageGallery({ images, title, categoryName }: ListingImageGalleryProps) {
  const [currentIdx, setCurrentIdx] = React.useState(0);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  const touchStartX = React.useRef<number | null>(null);
  const touchStartY = React.useRef<number | null>(null);
  const touchEndX = React.useRef<number | null>(null);
  const touchEndY = React.useRef<number | null>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const validImages = React.useMemo(() => {
    return Array.isArray(images) ? images.filter((img): img is string => Boolean(img && img.trim())) : [];
  }, [images]);

  const total = validImages.length;

  const nextImage = React.useCallback(() => {
    if (total <= 1) return;
    setCurrentIdx((prev) => (prev + 1) % total);
  }, [total]);

  const prevImage = React.useCallback(() => {
    if (total <= 1) return;
    setCurrentIdx((prev) => (prev - 1 + total) % total);
  }, [total]);

  const closeFullscreen = React.useCallback(() => {
    setIsFullscreen(false);
    if (typeof window !== "undefined" && window.history.state?.gallery_fullscreen) {
      window.history.back();
    }
  }, []);

  const openFullscreen = React.useCallback(() => {
    setIsFullscreen(true);
    if (typeof window !== "undefined") {
      window.history.pushState({ gallery_fullscreen: true }, "");
    }
  }, []);

  // History back button (Android & browser back button) listener
  React.useEffect(() => {
    if (!isFullscreen) return;
    const handlePopState = () => {
      setIsFullscreen(false);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [isFullscreen]);

  // Keyboard navigation for fullscreen lightbox (ESC, ArrowLeft, ArrowRight)
  React.useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeFullscreen();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        nextImage();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prevImage();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen, nextImage, prevImage, closeFullscreen]);

  // Lock body scroll when fullscreen lightbox is active
  React.useEffect(() => {
    if (isFullscreen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isFullscreen]);

  // Touch swipe handling (both horizontal next/prev and vertical pull-down-to-close)
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
    touchStartY.current = e.targetTouches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
    touchEndY.current = e.targetTouches[0].clientY;
  };

  const handleTouchEnd = (inFullscreen = false) => {
    if (
      touchStartX.current == null ||
      touchEndX.current == null ||
      touchStartY.current == null ||
      touchEndY.current == null
    ) {
      return;
    }

    const diffX = touchStartX.current - touchEndX.current;
    const diffY = touchEndY.current - touchStartY.current; // positive means swipe down

    // In fullscreen: if user swipes down distinctly, close fullscreen!
    if (inFullscreen && diffY > 70 && Math.abs(diffY) > Math.abs(diffX)) {
      closeFullscreen();
    } else if (Math.abs(diffX) > 40) {
      if (diffX > 0) {
        nextImage();
      } else {
        prevImage();
      }
    }

    touchStartX.current = null;
    touchEndX.current = null;
    touchStartY.current = null;
    touchEndY.current = null;
  };

  if (total === 0) {
    return (
      <div className="flex aspect-4/3 sm:aspect-[16/10] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-elevated/60 p-6 text-center text-muted">
        <div className="grid size-16 place-items-center rounded-2xl bg-surface shadow-2xs">
          <ImageIcon className="size-8 text-subtle" />
        </div>
        <p className="mt-3 font-medium text-fg">{categoryName || "Fotoğraf Yok"}</p>
        <p className="mt-1 text-xs text-muted">Satıcı henüz bu ilana fotoğraf yüklemedi</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Main Image Container */}
      <div
        className="group relative aspect-4/3 sm:aspect-[16/10] w-full overflow-hidden rounded-2xl border border-border bg-ink/90 shadow-card select-none cursor-pointer"
        onClick={openFullscreen}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={() => handleTouchEnd(false)}
      >
        {/* Photos keep their own ratio; a blurred copy fills the frame instead of empty bars. */}
        <img
          src={photoSrc(validImages[currentIdx], 240)}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 size-full scale-125 object-cover opacity-70 blur-2xl"
        />
        <img
          src={validImages[currentIdx]}
          alt={`${title} - Görsel ${currentIdx + 1}`}
          className="relative size-full cursor-zoom-in object-contain transition-transform duration-300 group-hover:scale-[1.01]"
          loading="eager"
        />

        {/* Counter Badge */}
        {total > 1 ? (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-ink/80 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md shadow-xs pointer-events-none">
            <span>{currentIdx + 1}</span>
            <span className="opacity-50">/</span>
            <span>{total}</span>
          </div>
        ) : null}

        {/* Fullscreen Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openFullscreen();
          }}
          className="absolute top-3 right-3 grid size-9 place-items-center rounded-full bg-ink/80 text-white backdrop-blur-md transition-transform hover:scale-105 active:scale-95 shadow-xs"
          title="Tam Ekran Aç"
          aria-label="Tam Ekran Aç"
        >
          <Maximize2 className="size-4" />
        </button>

        {/* Navigation Arrows on Main Image */}
        {total > 1 ? (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                prevImage();
              }}
              className="absolute left-3 top-1/2 -translate-y-1/2 grid size-10 place-items-center rounded-full bg-surface/90 text-fg backdrop-blur-md shadow-md transition-all hover:bg-surface hover:scale-105 active:scale-95 opacity-90 sm:opacity-0 sm:group-hover:opacity-100"
              title="Önceki Fotoğraf"
              aria-label="Önceki Fotoğraf"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                nextImage();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 grid size-10 place-items-center rounded-full bg-surface/90 text-fg backdrop-blur-md shadow-md transition-all hover:bg-surface hover:scale-105 active:scale-95 opacity-90 sm:opacity-0 sm:group-hover:opacity-100"
              title="Sonraki Fotoğraf"
              aria-label="Sonraki Fotoğraf"
            >
              <ChevronRight className="size-5" />
            </button>
          </>
        ) : null}
      </div>

      {/* Thumbnails Row */}
      {total > 1 ? (
        <div className="flex gap-2.5 overflow-x-auto pb-1 pt-0.5 scrollbar-none">
          {validImages.map((img, i) => {
            const isActive = i === currentIdx;
            return (
              <button
                key={`${img}-${i}`}
                type="button"
                onClick={() => setCurrentIdx(i)}
                className={`relative h-18 w-24 shrink-0 overflow-hidden rounded-xl border-2 transition-all duration-200 ${
                  isActive
                    ? "border-primary ring-2 ring-primary/40 scale-[1.03] shadow-xs"
                    : "border-border/80 opacity-70 hover:opacity-100 hover:border-muted"
                }`}
                title={`Görsel ${i + 1}`}
              >
                <img src={photoSrc(img, 240)} alt="" className="size-full object-cover" loading="lazy" />
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Fullscreen Lightbox Modal (Rendered in Document Body Portal above everything with z-[99999]) */}
      {isFullscreen && mounted
        ? createPortal(
            <div
              className="fixed inset-0 z-[99999] flex flex-col bg-black/95 backdrop-blur-2xl animate-in fade-in duration-150 select-none cursor-zoom-out"
              onClick={closeFullscreen}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={() => handleTouchEnd(true)}
            >
              {/* Top Navigation Bar */}
              <div
                className="listing-lightbox-header relative z-50 flex w-full items-center justify-between px-4 pb-2 sm:px-6 bg-gradient-to-b from-black/90 via-black/60 to-transparent pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold tracking-wider text-white backdrop-blur-md">
                    {currentIdx + 1} / {total}
                  </span>
                  <span className="hidden sm:inline-block max-w-md truncate text-sm font-medium text-white/80">
                    {title}
                  </span>
                </div>

                {/* Prominent, Highly Visible Close Button */}
                <button
                  type="button"
                  onClick={closeFullscreen}
                  className="flex items-center gap-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white px-3.5 py-2 backdrop-blur-md transition-all hover:scale-105 active:scale-95 shadow-md cursor-pointer"
                  title="Kapat (ESC / Tıkla)"
                  aria-label="Kapat"
                >
                  <X className="size-5" />
                  <span className="text-xs font-semibold">Kapat</span>
                </button>
              </div>

              {/* Main Viewer Area (Clicking empty background closes lightbox) */}
              <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-2 py-2 sm:px-20 sm:py-4">
                {/* Fill the viewer box and let object-contain fit the photo, so smaller
                    photos are scaled up to the screen instead of sitting at their pixel size. */}
                <img
                  src={validImages[currentIdx]}
                  alt={`${title} - Büyük Görsel ${currentIdx + 1}`}
                  className="size-full cursor-default object-contain"
                  onClick={(e) => e.stopPropagation()}
                />

                {/* Left/Right Arrows in Fullscreen */}
                {total > 1 ? (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        prevImage();
                      }}
                      className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 grid size-12 place-items-center rounded-full bg-white/15 hover:bg-white/30 text-white backdrop-blur-md transition-all hover:scale-110 active:scale-95 shadow-lg cursor-pointer z-20"
                      title="Önceki (Sol Ok)"
                      aria-label="Önceki"
                    >
                      <ChevronLeft className="size-7" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        nextImage();
                      }}
                      className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 grid size-12 place-items-center rounded-full bg-white/15 hover:bg-white/30 text-white backdrop-blur-md transition-all hover:scale-110 active:scale-95 shadow-lg cursor-pointer z-20"
                      title="Sonraki (Sağ Ok)"
                      aria-label="Sonraki"
                    >
                      <ChevronRight className="size-7" />
                    </button>
                  </>
                ) : null}
              </div>

              {/* Bottom Thumbnails Strip in Fullscreen */}
              {total > 1 ? (
                <div
                  className="listing-lightbox-thumbnails relative z-50 flex w-full items-center justify-center gap-2 overflow-x-auto px-4 pt-1 bg-gradient-to-t from-black/90 via-black/60 to-transparent scrollbar-none pointer-events-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  {validImages.map((img, i) => (
                    <button
                      key={`fs-${img}-${i}`}
                      type="button"
                      onClick={() => setCurrentIdx(i)}
                      className={`relative h-14 w-18 shrink-0 overflow-hidden rounded-lg transition-all duration-150 cursor-pointer ${
                        i === currentIdx
                          ? "ring-2 ring-primary scale-110 opacity-100 shadow-md"
                          : "opacity-40 hover:opacity-80"
                      }`}
                    >
                      <img src={photoSrc(img, 240)} alt="" className="size-full object-cover" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
