import { useCallback, useEffect, useId, useRef, useState } from "react";
import { FlipHorizontal2, Loader2, RotateCcw, RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type AvatarCropperDialogProps = {
  /** Selected image file to preview and crop; null keeps the dialog closed. */
  file: File | null;
  /** Preview cutout shape: circular for user avatars, rounded square for store logos. */
  shape?: "circle" | "rounded";
  title?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void | Promise<void>;
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const OUT_SIZE = 800;

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function pointerDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Instagram-style square/circular photo preview & crop dialog for web:
 * pan, pinch/wheel/slider zoom, double-click zoom, 90° rotate, horizontal flip,
 * and live circular or rounded-square cutout mask.
 */
export function AvatarCropperDialog({
  file,
  shape = "circle",
  title = "Fotoğrafı düzenle",
  busy = false,
  onCancel,
  onConfirm,
}: AvatarCropperDialogProps) {
  const maskId = useId();
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [nat, setNat] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [decodeError, setDecodeError] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [flipX, setFlipX] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [stageSize, setStageSize] = useState(300);

  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchStartRef = useRef<{ dist: number; zoom: number } | null>(null);
  const lastDragRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!file) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    setNat({ w: 0, h: 0 });
    setDecodeError(false);
    setZoom(1);
    setTx(0);
    setTy(0);
    setRotation(0);
    setFlipX(false);
    setDragging(false);
    pointersRef.current.clear();
    pinchStartRef.current = null;
    lastDragRef.current = null;
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const update = () => {
      const w = el.clientWidth;
      if (w > 0) setStageSize(w);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [objectUrl, decodeError]);

  const quarter = rotation === 90 || rotation === 270;
  const effW = quarter ? nat.h : nat.w;
  const effH = quarter ? nat.w : nat.h;
  const baseScale = effW > 0 && effH > 0 ? Math.max(stageSize / effW, stageSize / effH) : 1;

  const clampOffset = useCallback(
    (nx: number, ny: number, nz: number, rot = rotation) => {
      const q = rot === 90 || rot === 270;
      const ew = q ? nat.h : nat.w;
      const eh = q ? nat.w : nat.h;
      const bs = ew > 0 && eh > 0 ? Math.max(stageSize / ew, stageSize / eh) : 1;
      const maxX = Math.max(0, (ew * bs * nz - stageSize) / 2);
      const maxY = Math.max(0, (eh * bs * nz - stageSize) / 2);
      return { x: clamp(nx, -maxX, maxX), y: clamp(ny, -maxY, maxY) };
    },
    [nat.w, nat.h, rotation, stageSize],
  );

  const applyZoom = useCallback(
    (nextZoom: number) => {
      const z = clamp(Number(nextZoom.toFixed(2)), MIN_ZOOM, MAX_ZOOM);
      setZoom(z);
      const c = clampOffset(tx, ty, z);
      setTx(c.x);
      setTy(c.y);
    },
    [clampOffset, tx, ty],
  );

  useEffect(() => {
    const el = stageRef.current;
    if (!el || !objectUrl || decodeError) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = -e.deltaY * 0.0025;
      setZoom((prev) => {
        const next = clamp(Number((prev + delta).toFixed(2)), MIN_ZOOM, MAX_ZOOM);
        setTx((cx) => clampOffset(cx, ty, next).x);
        setTy((cy) => clampOffset(tx, cy, next).y);
        return next;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [objectUrl, decodeError, clampOffset, tx, ty]);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!nat.w || busy || exporting) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setDragging(true);
    if (pointersRef.current.size === 1) {
      lastDragRef.current = { x: e.clientX, y: e.clientY };
      pinchStartRef.current = null;
    } else if (pointersRef.current.size === 2) {
      const [a, b] = Array.from(pointersRef.current.values());
      pinchStartRef.current = { dist: Math.max(1, pointerDistance(a, b)), zoom };
      lastDragRef.current = null;
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 1 && lastDragRef.current) {
      const dx = e.clientX - lastDragRef.current.x;
      const dy = e.clientY - lastDragRef.current.y;
      lastDragRef.current = { x: e.clientX, y: e.clientY };
      const c = clampOffset(tx + dx, ty + dy, zoom);
      setTx(c.x);
      setTy(c.y);
    } else if (pointersRef.current.size === 2 && pinchStartRef.current) {
      const [a, b] = Array.from(pointersRef.current.values());
      const dist = pointerDistance(a, b);
      const next = clamp(Number(((dist / pinchStartRef.current.dist) * pinchStartRef.current.zoom).toFixed(2)), MIN_ZOOM, MAX_ZOOM);
      setZoom(next);
      const c = clampOffset(tx, ty, next);
      setTx(c.x);
      setTy(c.y);
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size === 1) {
      const [remaining] = Array.from(pointersRef.current.values());
      lastDragRef.current = { x: remaining.x, y: remaining.y };
      pinchStartRef.current = null;
    } else if (pointersRef.current.size === 0) {
      lastDragRef.current = null;
      pinchStartRef.current = null;
      setDragging(false);
    }
  }

  function handleDoubleClick() {
    if (!nat.w || busy || exporting) return;
    if (zoom > 1.15) {
      setZoom(1);
      setTx(0);
      setTy(0);
    } else {
      applyZoom(2);
    }
  }

  function handleRotate() {
    const nextRot = (rotation + 90) % 360;
    setRotation(nextRot);
    const c = clampOffset(tx, ty, zoom, nextRot);
    setTx(c.x);
    setTy(c.y);
  }

  function handleReset() {
    setZoom(1);
    setTx(0);
    setTy(0);
    setRotation(0);
    setFlipX(false);
  }

  async function handleConfirm() {
    if (!file || busy || exporting) return;
    if (decodeError) {
      await onConfirm(file);
      return;
    }
    const imgEl = imgRef.current;
    if (!imgEl || !nat.w || !nat.h) return;

    setExporting(true);
    try {
      const k = OUT_SIZE / stageSize;
      const canvas = document.createElement("canvas");
      canvas.width = OUT_SIZE;
      canvas.height = OUT_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Görsel işlenemedi.");

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, OUT_SIZE, OUT_SIZE);

      ctx.translate(OUT_SIZE / 2 + tx * k, OUT_SIZE / 2 + ty * k);
      ctx.scale(zoom * (flipX ? -1 : 1), zoom);
      ctx.rotate((rotation * Math.PI) / 180);
      const drawW = nat.w * baseScale * k;
      const drawH = nat.h * baseScale * k;
      ctx.drawImage(imgEl, -drawW / 2, -drawH / 2, drawW, drawH);

      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Görsel kaydedilemedi."))), "image/jpeg", 0.92),
      );
      canvas.width = 0;
      canvas.height = 0;
      await onConfirm(blob);
    } finally {
      setExporting(false);
    }
  }

  const working = busy || exporting;
  const ready = nat.w > 0 && nat.h > 0;

  return (
    <Dialog
      open={file !== null}
      onOpenChange={(open) => {
        if (!open && !working) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-md" showCloseButton={!working}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {decodeError
              ? "Bu dosya biçimi tarayıcıda önizlenemiyor."
              : "Sürükleyerek konumlandırın, tekerlek veya kaydırıcıyla yakınlaştırın."}
          </DialogDescription>
        </DialogHeader>

        {decodeError ? (
          <div className="rounded-xl border border-border bg-elevated p-4 text-sm text-muted">
            Bu dosya biçimi (ör. HEIC) tarayıcıda önizlenemiyor. Fotoğrafı olduğu gibi yükleyebilir veya JPEG/PNG seçebilirsiniz.
          </div>
        ) : (
          <div className="space-y-4">
            <div
              ref={stageRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onDoubleClick={handleDoubleClick}
              className="relative mx-auto aspect-square w-full max-w-[300px] touch-none select-none overflow-hidden rounded-2xl bg-black/90 cursor-grab active:cursor-grabbing"
            >
              {objectUrl ? (
                <div className="grid size-full place-items-center">
                  <img
                    ref={imgRef}
                    src={objectUrl}
                    alt="Fotoğraf önizleme"
                    draggable={false}
                    onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
                    onError={() => setDecodeError(true)}
                    style={{
                      width: ready ? nat.w * baseScale : "100%",
                      height: ready ? nat.h * baseScale : "100%",
                      maxWidth: "none",
                      transform: `translate(${tx}px, ${ty}px) scale(${zoom}) scaleX(${flipX ? -1 : 1}) rotate(${rotation}deg)`,
                      opacity: ready ? 1 : 0,
                    }}
                    className="pointer-events-none select-none object-fill transition-opacity duration-150"
                  />
                </div>
              ) : null}

              {!ready ? (
                <div className="absolute inset-0 grid place-items-center">
                  <Loader2 className="size-6 animate-spin text-white" />
                </div>
              ) : null}

              <svg className="pointer-events-none absolute inset-0 size-full" viewBox={`0 0 ${stageSize} ${stageSize}`}>
                <defs>
                  <mask id={maskId}>
                    <rect x={0} y={0} width={stageSize} height={stageSize} fill="#fff" />
                    {shape === "circle" ? (
                      <circle cx={stageSize / 2} cy={stageSize / 2} r={stageSize / 2 - 1} fill="#000" />
                    ) : (
                      <rect x={1} y={1} width={stageSize - 2} height={stageSize - 2} rx={26} ry={26} fill="#000" />
                    )}
                  </mask>
                </defs>
                <rect x={0} y={0} width={stageSize} height={stageSize} fill="rgba(0,0,0,0.58)" mask={`url(#${maskId})`} />
                {shape === "circle" ? (
                  <circle cx={stageSize / 2} cy={stageSize / 2} r={stageSize / 2 - 1} fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth={1.5} />
                ) : (
                  <rect x={1} y={1} width={stageSize - 2} height={stageSize - 2} rx={26} ry={26} fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth={1.5} />
                )}
              </svg>

              <div
                aria-hidden
                className={`pointer-events-none absolute inset-0 transition-opacity duration-200 ${dragging ? "opacity-100" : "opacity-0"} ${
                  shape === "circle" ? "rounded-full" : "rounded-[26px]"
                } overflow-hidden`}
              >
                <span className="absolute inset-y-0 left-1/3 w-px bg-white/40" />
                <span className="absolute inset-y-0 left-2/3 w-px bg-white/40" />
                <span className="absolute inset-x-0 top-1/3 h-px bg-white/40" />
                <span className="absolute inset-x-0 top-2/3 h-px bg-white/40" />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="icon"
                  className="size-8"
                  variant="outline"
                  disabled={working || !ready || zoom <= MIN_ZOOM}
                  onClick={() => applyZoom(zoom - 0.25)}
                  aria-label="Uzaklaştır"
                >
                  <ZoomOut className="size-4" />
                </Button>
                <input
                  type="range"
                  min={MIN_ZOOM}
                  max={MAX_ZOOM}
                  step={0.01}
                  value={zoom}
                  disabled={working || !ready}
                  onChange={(e) => applyZoom(Number(e.target.value))}
                  aria-label="Yakınlaştırma"
                  className="h-2 flex-1 cursor-pointer accent-primary"
                />
                <Button
                  type="button"
                  size="icon"
                  className="size-8"
                  variant="outline"
                  disabled={working || !ready || zoom >= MAX_ZOOM}
                  onClick={() => applyZoom(zoom + 0.25)}
                  aria-label="Yakınlaştır"
                >
                  <ZoomIn className="size-4" />
                </Button>
                <span className="w-10 text-right text-xs font-medium tabular-nums text-muted">{zoom.toFixed(1)}x</span>
              </div>

              <div className="flex items-center justify-center gap-2">
                <Button type="button" size="sm" variant="outline" disabled={working || !ready} onClick={handleRotate}>
                  <RotateCw className="size-4" /> Döndür
                </Button>
                <Button type="button" size="sm" variant="outline" disabled={working || !ready} onClick={() => setFlipX((v) => !v)}>
                  <FlipHorizontal2 className="size-4" /> Aynala
                </Button>
                <Button type="button" size="sm" variant="ghost" disabled={working || !ready} onClick={handleReset}>
                  <RotateCcw className="size-4" /> Sıfırla
                </Button>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" disabled={working} onClick={onCancel}>
            Vazgeç
          </Button>
          <Button type="button" disabled={working || (!ready && !decodeError)} onClick={() => void handleConfirm()}>
            {working ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Yükleniyor…
              </>
            ) : decodeError ? (
              "Olduğu gibi yükle"
            ) : (
              "Kaydet ve uygula"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
