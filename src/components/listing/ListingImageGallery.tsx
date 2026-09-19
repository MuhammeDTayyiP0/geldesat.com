import * as React from "react";
import { ChevronLeft, ChevronRight, Maximize2, X, ImageIcon } from "lucide-react";

interface ListingImageGalleryProps {
  images: string[];
  title: string;
  categoryName?: string;
}

export function ListingImageGallery({ images, title, categoryName }: ListingImageGalleryProps) {
  const [currentIdx, setCurrentIdx] = React.useState(0);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const touchStartX = React.useRef<number | null>(null);
  const touchEndX = React.useRef<number | null>(null);

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

  // Keyboard navigation for fullscreen lightbox
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isFullscreen) return;
      if (e.key === "Escape") setIsFullscreen(false);
      else if (e.key === "ArrowRight") nextImage();
      else if (e.key === "ArrowLeft") prevImage();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen, nextImage, prevImage]);

  // Lock body scroll when fullscreen lightbox is active
  React.useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isFullscreen]);

  // Touch swipe handling
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current == null || touchEndX.current == null) return;
    const distance = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 45;
    if (distance > minSwipeDistance) {
      nextImage();
    } else if (distance < -minSwipeDistance) {
      prevImage();
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  if (total === 0) {
    return (
      <div className="flex aspect-[16/10] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-elevated/60 p-6 text-center text-muted">
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
        className="group relative aspect-[16/10] w-full overflow-hidden rounded-2xl border border-border bg-ink/90 shadow-card select-none"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <img
          src={validImages[currentIdx]}
          alt={`${title} - Görsel ${currentIdx + 1}`}
          className="size-full cursor-zoom-in object-contain transition-transform duration-300 group-hover:scale-[1.01]"
          onClick={() => setIsFullscreen(true)}
          loading="eager"
        />

        {/* Counter Badge */}
        {total > 1 ? (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-ink/75 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md shadow-xs pointer-events-none">
            <span>{currentIdx + 1}</span>
            <span className="opacity-50">/</span>
            <span>{total}</span>
          </div>
        ) : null}

        {/* Fullscreen Button */}
        <button
          type="button"
          onClick={() => setIsFullscreen(true)}
          className="absolute top-3 right-3 grid size-9 place-items-center rounded-full bg-ink/75 text-white backdrop-blur-md transition-transform hover:scale-105 active:scale-95 shadow-xs"
          title="Tam Ekran Aç"
          aria-label="Tam Ekran Aç"
        >
          <Maximize2 className="size-4" />
        </button>

        {/* Navigation Arrows */}
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
                <img src={img} alt="" className="size-full object-cover" loading="lazy" />
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Fullscreen Lightbox Modal */}
      {isFullscreen ? (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-xl animate-in fade-in duration-200"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Top Bar */}
          <div className="flex h-16 w-full items-center justify-between px-4 sm:px-6 bg-gradient-to-b from-black/80 to-transparent">
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium tracking-wider text-white backdrop-blur-md">
                {currentIdx + 1} / {total}
              </span>
              <span className="hidden sm:inline-block max-w-md truncate text-sm font-medium text-white/80">
                {title}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsFullscreen(false)}
              className="grid size-10 place-items-center rounded-full bg-white/10 text-white backdrop-blur-md transition-all hover:bg-white/20 hover:scale-105 active:scale-95"
              title="Kapat (ESC)"
              aria-label="Kapat"
            >
              <X className="size-6" />
            </button>
          </div>

          {/* Main Viewer Area */}
          <div className="relative flex flex-1 items-center justify-center p-2 sm:p-6 overflow-hidden">
            <img
              src={validImages[currentIdx]}
              alt={`${title} - Büyük Görsel ${currentIdx + 1}`}
              className="max-h-[82vh] max-w-full object-contain select-none transition-all duration-200"
            />

            {/* Arrows in Fullscreen */}
            {total > 1 ? (
              <>
                <button
                  type="button"
                  onClick={prevImage}
                  className="absolute left-4 top-1/2 -translate-y-1/2 grid size-12 place-items-center rounded-full bg-white/10 text-white backdrop-blur-md transition-all hover:bg-white/25 hover:scale-110 active:scale-95"
                  title="Önceki"
                  aria-label="Önceki"
                >
                  <ChevronLeft className="size-7" />
                </button>
                <button
                  type="button"
                  onClick={nextImage}
                  className="absolute right-4 top-1/2 -translate-y-1/2 grid size-12 place-items-center rounded-full bg-white/10 text-white backdrop-blur-md transition-all hover:bg-white/25 hover:scale-110 active:scale-95"
                  title="Sonraki"
                  aria-label="Sonraki"
                >
                  <ChevronRight className="size-7" />
                </button>
              </>
            ) : null}
          </div>

          {/* Bottom Thumbnails Strip in Fullscreen */}
          {total > 1 ? (
            <div className="flex h-20 w-full items-center justify-center gap-2 overflow-x-auto px-4 pb-4 pt-1 bg-gradient-to-t from-black/80 to-transparent scrollbar-none">
              {validImages.map((img, i) => (
                <button
                  key={`fs-${img}-${i}`}
                  type="button"
                  onClick={() => setCurrentIdx(i)}
                  className={`relative h-14 w-18 shrink-0 overflow-hidden rounded-lg transition-all duration-150 ${
                    i === currentIdx
                      ? "ring-2 ring-primary scale-110 opacity-100"
                      : "opacity-40 hover:opacity-80"
                  }`}
                >
                  <img src={img} alt="" className="size-full object-cover" />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
