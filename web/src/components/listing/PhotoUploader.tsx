import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Camera,
  GripVertical,
  ImagePlus,
  Info,
  Loader2,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Star,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { checkPhotoFile, photoSrc, preparePhoto, type PhotoRotation } from "@/lib/images";
import { discardPhoto, uploadPhoto } from "@/lib/listing-photos";
import { cn } from "@/lib/utils";

export const MAX_PHOTOS = 10;
/** Photos prepared and uploaded at once; the server does the heavy processing. */
const CONCURRENCY = 3;

export type PhotoOriginal = { file: File; rotate: PhotoRotation };

type Pending = {
  key: string;
  file: File;
  preview: string;
  status: "waiting" | "preparing" | "uploading" | "processing" | "done" | "error";
  progress: number;
  url?: string;
  error?: string;
};

type Props = {
  images: string[];
  setImages: Dispatch<SetStateAction<string[]>>;
  /** Source files of photos uploaded in this session, by URL; owned by the form so they survive step changes. */
  originals: Map<string, PhotoOriginal>;
  onBusyChange: (busy: boolean) => void;
  required?: boolean;
  /** Editing a published listing: adding photos sends it back to moderation. */
  editing?: boolean;
};

type Drag = { from: number; over: number; x: number; y: number; dx: number; dy: number; w: number; h: number; pointerId: number };

let keySeq = 0;

function reorder<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function PhotoUploader({ images, setImages, originals, onBusyChange, required, editing }: Props) {
  const [pending, setPending] = useState<Pending[]>([]);
  const [dropActive, setDropActive] = useState(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [rotating, setRotating] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const controllers = useRef(new Map<string, AbortController>());
  const batch = useRef({ added: 0, failed: 0 });
  const pendingRef = useRef(pending);
  pendingRef.current = pending;

  const used = images.length + pending.length;
  const slotsLeft = MAX_PHOTOS - used;
  const busy = pending.some((p) => p.status !== "error");

  useEffect(() => onBusyChange(busy), [busy, onBusyChange]);

  // Cancel in-flight work and free previews if the step unmounts.
  useEffect(() => {
    const ctrls = controllers.current;
    return () => {
      for (const c of ctrls.values()) c.abort();
      for (const p of pendingRef.current) URL.revokeObjectURL(p.preview);
    };
  }, []);

  // Move finished uploads into the listing in selection order, skipping failed ones.
  useEffect(() => {
    const ready: Pending[] = [];
    for (const p of pending) {
      if (p.status === "done") ready.push(p);
      else if (p.status !== "error") break;
    }
    if (!ready.length) return;
    for (const p of ready) {
      originals.set(p.url!, { file: p.file, rotate: 0 });
      URL.revokeObjectURL(p.preview);
    }
    setImages((prev) => [...prev, ...ready.map((p) => p.url!)]);
    setPending((list) => list.filter((p) => !ready.some((r) => r.key === p.key)));
  }, [pending, originals, setImages]);

  // Start queued photos up to the concurrency limit, and report when a batch settles.
  useEffect(() => {
    const active = pending.filter((p) => p.status === "preparing" || p.status === "uploading" || p.status === "processing").length;
    const next = pending.filter((p) => p.status === "waiting").slice(0, Math.max(0, CONCURRENCY - active));
    for (const p of next) if (!controllers.current.has(p.key)) void run(p);
    if (!busy && batch.current.added + batch.current.failed > 0) {
      const { added, failed } = batch.current;
      batch.current = { added: 0, failed: 0 };
      if (failed) toast.error(`${failed} fotoğraf yüklenemedi. İşaretli olanları tekrar deneyebilirsiniz.`);
      else toast.success(added === 1 ? "Fotoğraf eklendi" : `${added} fotoğraf eklendi`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `run` only uses refs and state setters
  }, [pending, busy]);

  function patch(key: string, change: Partial<Pending>) {
    setPending((list) => list.map((p) => (p.key === key ? { ...p, ...change } : p)));
  }

  async function run(p: Pending) {
    const ctrl = new AbortController();
    controllers.current.set(p.key, ctrl);
    patch(p.key, { status: "preparing", progress: 0, error: undefined });
    try {
      const blob = await preparePhoto(p.file);
      if (ctrl.signal.aborted) return;
      patch(p.key, { status: "uploading" });
      const url = await uploadPhoto(
        blob,
        (progress) => patch(p.key, progress >= 1 ? { status: "processing", progress } : { progress }),
        ctrl.signal,
      );
      batch.current.added++;
      patch(p.key, { status: "done", url, progress: 1 });
    } catch (e) {
      if (ctrl.signal.aborted) return;
      batch.current.failed++;
      patch(p.key, { status: "error", error: e instanceof Error ? e.message : "Fotoğraf yüklenemedi" });
    } finally {
      controllers.current.delete(p.key);
    }
  }

  function addFiles(list: FileList | File[] | null) {
    const files = Array.from(list ?? []);
    if (!files.length) return;
    const accepted: Pending[] = [];
    for (const [i, file] of files.entries()) {
      const problem = checkPhotoFile(file);
      if (problem) {
        toast.error(`${file.name}: ${problem}`);
        continue;
      }
      if (accepted.length >= slotsLeft) {
        toast.warning(`En fazla ${MAX_PHOTOS} fotoğraf ekleyebilirsiniz. ${files.length - i} fotoğraf eklenmedi.`);
        break;
      }
      accepted.push({ key: `p${++keySeq}`, file, preview: URL.createObjectURL(file), status: "waiting", progress: 0 });
    }
    if (accepted.length) setPending((prev) => [...prev, ...accepted]);
  }

  // Paste photos straight from the clipboard (screenshots, copied images).
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
      if (!files.length) return;
      e.preventDefault();
      addFiles(files);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  });

  function removeImage(url: string) {
    setImages((prev) => prev.filter((u) => u !== url));
    if (originals.delete(url)) discardPhoto(url);
  }

  function removePending(key: string) {
    controllers.current.get(key)?.abort();
    setPending((list) => {
      const gone = list.find((p) => p.key === key);
      if (gone) URL.revokeObjectURL(gone.preview);
      return list.filter((p) => p.key !== key);
    });
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= images.length || from === to) return;
    setImages((prev) => reorder(prev, from, to));
  }

  // Pointer-based dragging works the same with mouse, touch and pen.
  function startDrag(e: ReactPointerEvent, index: number) {
    if (e.button !== 0 || images.length < 2) return;
    const tile = (e.currentTarget as HTMLElement).closest<HTMLElement>("[data-photo-index]");
    if (!tile) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const r = tile.getBoundingClientRect();
    setDrag({ from: index, over: index, x: e.clientX, y: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top, w: r.width, h: r.height, pointerId: e.pointerId });
  }

  function moveDrag(e: ReactPointerEvent) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-photo-index]");
    const over = hit ? Number(hit.dataset.photoIndex) : drag.over;
    setDrag({ ...drag, x: e.clientX, y: e.clientY, over });
  }

  function endDrag(e: ReactPointerEvent) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    move(drag.from, drag.over);
    setDrag(null);
  }

  /** Re-upload a photo from its original file, turned by `quarterTurns` × 90° clockwise. */
  async function rotateImage(url: string, quarterTurns: number) {
    const original = originals.get(url);
    if (!original || quarterTurns % 4 === 0) return;
    const rotate = ((((original.rotate + quarterTurns * 90) % 360) + 360) % 360) as PhotoRotation;
    setRotating(url);
    try {
      const next = await uploadPhoto(await preparePhoto(original.file, rotate));
      originals.delete(url);
      originals.set(next, { file: original.file, rotate });
      setImages((prev) => prev.map((u) => (u === url ? next : u)));
      discardPhoto(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fotoğraf döndürülemedi");
    } finally {
      setRotating(null);
    }
  }

  const [rotateTarget, setRotateTarget] = useState<string | null>(null);

  const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer.types).includes("Files");
  const order = drag ? reorder(images, drag.from, drag.over) : images;

  return (
    <div
      className="relative"
      onDragOver={(e) => {
        if (!hasFiles(e) || slotsLeft <= 0) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setDropActive(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropActive(false);
      }}
      onDrop={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        setDropActive(false);
        addFiles(e.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight">Fotoğraflar</h2>
          <p className="mt-0.5 text-sm text-muted">İlk fotoğraf kapak olur. Tutup sürükleyerek sırayı değiştirin.</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold tabular-nums">
            {used}
            <span className="text-subtle">/{MAX_PHOTOS}</span>
          </p>
          <div className="mt-1 flex gap-0.5" aria-hidden="true">
            {Array.from({ length: MAX_PHOTOS }, (_, i) => (
              <span key={i} className={cn("h-1.5 w-2 rounded-full", i < used ? "bg-primary" : "bg-elevated")} />
            ))}
          </div>
        </div>
      </div>

      {required && images.length === 0 ? (
        <p className="mt-4 flex items-center gap-2 rounded-lg border border-warn/25 bg-warn/8 px-3 py-2 text-sm text-warn">
          <AlertCircle className="size-4 shrink-0" />
          Emlak ve vasıta ilanlarında en az 1 fotoğraf zorunludur.
        </p>
      ) : null}
      {editing ? (
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-elevated px-3 py-2 text-sm text-muted">
          <Info className="mt-0.5 size-4 shrink-0" />
          Yeni fotoğraf eklemek ilanı tekrar onaya gönderir. Sıralamak ve silmek onay gerektirmez.
        </p>
      ) : null}

      {used === 0 ? (
        <div
          className={cn(
            "mt-5 rounded-2xl border-2 border-dashed px-5 py-10 text-center transition-colors sm:py-14",
            dropActive ? "border-primary bg-primary/8" : "border-border bg-elevated/40",
          )}
        >
          <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary">
            <ImagePlus className="size-8" />
          </span>
          <p className="mt-4 text-base font-semibold">Fotoğraflarınızı ekleyin</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            <span className="md:hidden">Kameranızla çekin veya galeriden birden fazla fotoğraf seçin.</span>
            <span className="hidden md:inline">Dosyaları buraya sürükleyip bırakın, yapıştırın (Ctrl+V) ya da bilgisayarınızdan seçin.</span>
          </p>
          <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
            <Button type="button" onClick={() => inputRef.current?.click()}>
              <ImagePlus className="size-4" /> Galeriden seç
            </Button>
            <Button type="button" variant="outline" className="md:hidden" onClick={() => cameraRef.current?.click()}>
              <Camera className="size-4" /> Fotoğraf çek
            </Button>
          </div>
          <p className="mt-4 text-xs text-subtle">JPEG, PNG veya WebP · fotoğraf başına en fazla 30 MB · en fazla {MAX_PHOTOS} fotoğraf</p>
        </div>
      ) : (
        <ul className="mt-5 grid touch-pan-y grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3" onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={() => setDrag(null)}>
          {order.map((url, i) => {
            const dragging = drag && drag.over === i;
            const cover = i === 0;
            return (
              <li
                key={url}
                data-photo-index={i}
                className={cn(
                  "group relative overflow-hidden rounded-xl bg-elevated",
                  cover && "col-span-2 row-span-2",
                  dragging ? "border-2 border-dashed border-primary bg-primary/5" : "border border-border shadow-xs",
                )}
              >
                <div className={cn("relative aspect-4/3 size-full", dragging && "opacity-0")}>
                  <img
                    src={photoSrc(url, cover ? 800 : 480)}
                    alt={cover ? "Kapak fotoğrafı" : `Fotoğraf ${i + 1}`}
                    className="size-full object-cover"
                    draggable={false}
                  />
                  {rotating === url ? (
                    <div className="absolute inset-0 grid place-items-center bg-ink/40">
                      <Loader2 className="size-6 animate-spin text-white" />
                    </div>
                  ) : null}

                  <div className="absolute inset-x-0 top-0 flex items-start justify-between p-1.5 sm:p-2">
                    <button
                      type="button"
                      onPointerDown={(e) => startDrag(e, i)}
                      aria-label={`Fotoğraf ${i + 1}: sürükleyerek taşı`}
                      className="flex h-8 touch-none cursor-grab items-center gap-1 rounded-full bg-ink/65 pl-1.5 pr-2.5 text-xs font-semibold text-white backdrop-blur-sm active:cursor-grabbing"
                    >
                      <GripVertical className="size-4" />
                      {cover ? (
                        <span className="inline-flex items-center gap-1">
                          <Star className="size-3 fill-current text-amber-300" /> Kapak
                        </span>
                      ) : (
                        <span className="tabular-nums">{i + 1}</span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeImage(url)}
                      aria-label={`Fotoğraf ${i + 1}'i sil`}
                      className="grid size-8 place-items-center rounded-full bg-ink/65 text-white backdrop-blur-sm transition-colors hover:bg-danger"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>

                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-ink/70 to-transparent p-1.5 pt-6 sm:p-2 sm:pt-8">
                    <div className="flex gap-1">
                      <TileButton label="Öne al" disabled={i === 0} onClick={() => move(i, i - 1)}>
                        <ArrowLeft className="size-4" />
                      </TileButton>
                      <TileButton label="Arkaya al" disabled={i === images.length - 1} onClick={() => move(i, i + 1)}>
                        <ArrowRight className="size-4" />
                      </TileButton>
                    </div>
                    <div className="flex gap-1">
                      {originals.has(url) ? (
                        <TileButton label="Döndür" onClick={() => setRotateTarget(url)}>
                          <RotateCw className="size-4" />
                        </TileButton>
                      ) : null}
                      {!cover ? (
                        <TileButton label="Kapak yap" onClick={() => move(i, 0)} wide>
                          <Star className="size-3.5" />
                          <span className="hidden sm:inline">Kapak yap</span>
                        </TileButton>
                      ) : null}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}

          {pending.map((p) => (
            <li key={p.key} className="relative overflow-hidden rounded-xl border border-border bg-elevated">
              <div className="relative aspect-4/3">
                <img src={p.preview} alt="" className="size-full object-cover" />
                <div className="absolute inset-0 grid place-items-center bg-ink/55 p-3 text-center text-white">
                  {p.status === "error" ? (
                    <div className="space-y-2">
                      <AlertCircle className="mx-auto size-6" />
                      <p className="line-clamp-3 text-xs font-medium">{p.error}</p>
                      <button
                        type="button"
                        onClick={() => patch(p.key, { status: "waiting", error: undefined })}
                        className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink"
                      >
                        <RefreshCw className="size-3" /> Tekrar dene
                      </button>
                    </div>
                  ) : (
                    <div className="w-full max-w-32 space-y-2">
                      <p className="text-xs font-semibold">
                        {p.status === "waiting"
                          ? "Sırada"
                          : p.status === "preparing"
                            ? "Hazırlanıyor"
                            : p.status === "processing"
                              ? "İşleniyor"
                              : `Yükleniyor %${Math.round(p.progress * 100)}`}
                      </p>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/25">
                        <div
                          className={cn("h-full rounded-full bg-white transition-[width] duration-200", p.status === "processing" && "animate-pulse")}
                          style={{ width: `${p.status === "uploading" ? Math.max(4, p.progress * 100) : p.status === "processing" ? 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removePending(p.key)}
                  aria-label="Fotoğrafı kaldır"
                  className="absolute right-1.5 top-1.5 grid size-8 place-items-center rounded-full bg-ink/65 text-white hover:bg-danger sm:right-2 sm:top-2"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </li>
          ))}

          {slotsLeft > 0 ? (
            <li className="grid aspect-4/3 grid-rows-[1fr_auto] overflow-hidden rounded-xl border-2 border-dashed border-border transition-colors hover:border-primary/50">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-1 text-sm font-medium text-muted transition-colors hover:bg-primary/5 hover:text-primary"
              >
                <ImagePlus className="size-6" />
                Fotoğraf ekle
                <span className="text-xs font-normal text-subtle">{slotsLeft} yer kaldı</span>
              </button>
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                className="flex items-center justify-center gap-1.5 border-t border-dashed border-border py-2 text-xs font-medium text-muted hover:text-primary md:hidden"
              >
                <Camera className="size-4" /> Çek
              </button>
            </li>
          ) : null}
        </ul>
      )}

      {drag ? (
        <div
          className="pointer-events-none fixed z-50 overflow-hidden rounded-xl shadow-2xl ring-2 ring-primary"
          style={{ left: drag.x - drag.dx, top: drag.y - drag.dy, width: drag.w, height: drag.h, transform: "rotate(2deg) scale(1.03)" }}
        >
          <img src={photoSrc(images[drag.from], 480)} alt="" className="size-full object-cover" />
        </div>
      ) : null}

      {dropActive && used > 0 ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center rounded-2xl border-2 border-dashed border-primary bg-primary/10 text-sm font-semibold text-primary backdrop-blur-[1px]">
          Fotoğrafları buraya bırakın
        </div>
      ) : null}

      {rotateTarget ? (
        <RotateDialog
          file={originals.get(rotateTarget)?.file}
          start={originals.get(rotateTarget)?.rotate ?? 0}
          onClose={() => setRotateTarget(null)}
          onApply={(delta) => {
            const url = rotateTarget;
            setRotateTarget(null);
            void rotateImage(url, delta);
          }}
        />
      ) : null}
    </div>
  );
}

function TileButton({
  label,
  onClick,
  disabled,
  wide,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-8 items-center justify-center gap-1 rounded-full bg-white/90 text-xs font-semibold text-ink shadow-sm transition-colors hover:bg-white disabled:opacity-35",
        wide ? "px-2.5" : "w-8",
      )}
    >
      {children}
    </button>
  );
}

/** Preview rotation instantly with CSS; the upload happens once, on apply. */
function RotateDialog({
  file,
  start,
  onClose,
  onApply,
}: {
  file?: File;
  start: PhotoRotation;
  onClose: () => void;
  onApply: (quarterTurns: number) => void;
}) {
  const [turns, setTurns] = useState(0);
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const angle = start + turns * 90;
  const sideways = Math.abs(angle / 90) % 2 === 1;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="border-border bg-surface sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Fotoğrafı döndür</DialogTitle>
          <DialogDescription>Fotoğraf yan veya ters görünüyorsa düzeltin.</DialogDescription>
        </DialogHeader>
        <div className="grid aspect-square place-items-center overflow-hidden rounded-lg bg-elevated sm:aspect-4/3">
          {src ? (
            <img
              src={src}
              alt="Döndürülen fotoğraf"
              className="max-h-full max-w-full object-contain transition-transform duration-200"
              style={{ transform: `rotate(${angle}deg) scale(${sideways ? 0.75 : 1})` }}
            />
          ) : (
            <Loader2 className="size-6 animate-spin text-muted" />
          )}
        </div>
        <div className="flex justify-center gap-2">
          <Button type="button" variant="outline" onClick={() => setTurns((t) => t - 1)}>
            <RotateCcw className="size-4" /> Sola
          </Button>
          <Button type="button" variant="outline" onClick={() => setTurns((t) => t + 1)}>
            <RotateCw className="size-4" /> Sağa
          </Button>
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Vazgeç
          </Button>
          <Button type="button" disabled={turns % 4 === 0} onClick={() => onApply(turns)}>
            Uygula
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
