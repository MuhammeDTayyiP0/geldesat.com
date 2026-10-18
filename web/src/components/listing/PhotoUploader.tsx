import { useEffect, useRef, useState, type Dispatch, type DragEvent, type ReactNode, type SetStateAction } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Camera,
  Crop,
  GripVertical,
  ImagePlus,
  Lightbulb,
  Loader2,
  Maximize,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Star,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { checkPhotoFile, DEFAULT_EDIT, processPhoto, type PhotoEdit, type PhotoRotation } from "@/lib/images";
import { discardPhoto, uploadPhoto } from "@/lib/listing-photos";
import { cn } from "@/lib/utils";

export const MAX_PHOTOS = 10;
/** Photos processed and uploaded at once; more would hold several full-size bitmaps in phone memory. */
const CONCURRENCY = 2;
const REORDER_TYPE = "application/x-geldesat-photo";

type Pending = {
  key: string;
  file: File;
  preview: string;
  edit: PhotoEdit;
  status: "waiting" | "processing" | "uploading" | "done" | "error";
  progress: number;
  url?: string;
  error?: string;
};

type Props = {
  images: string[];
  setImages: Dispatch<SetStateAction<string[]>>;
  /** Source files of photos uploaded in this session, by URL; kept by the form so edits survive step changes. */
  originals: Map<string, { file: File; edit: PhotoEdit }>;
  onBusyChange: (busy: boolean) => void;
  required?: boolean;
  /** Editing a published listing: adding photos sends it back to moderation. */
  editing?: boolean;
};

let keySeq = 0;

export function PhotoUploader({ images, setImages, originals, onBusyChange, required, editing }: Props) {
  const [pending, setPending] = useState<Pending[]>([]);
  const [dropActive, setDropActive] = useState(false);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [editTarget, setEditTarget] = useState<{ index: number; file: File; edit: PhotoEdit } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const controllers = useRef(new Map<string, AbortController>());
  const batch = useRef({ added: 0, failed: 0 });
  const pendingRef = useRef(pending);
  pendingRef.current = pending;

  const slotsLeft = MAX_PHOTOS - images.length - pending.length;
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
      originals.set(p.url!, { file: p.file, edit: p.edit });
      URL.revokeObjectURL(p.preview);
    }
    setImages((prev) => [...prev, ...ready.map((p) => p.url!)]);
    setPending((list) => list.filter((p) => !ready.some((r) => r.key === p.key)));
  }, [pending, originals, setImages]);

  // Start queued photos up to the concurrency limit.
  useEffect(() => {
    const active = pending.filter((p) => p.status === "processing" || p.status === "uploading").length;
    const next = pending.filter((p) => p.status === "waiting").slice(0, Math.max(0, CONCURRENCY - active));
    for (const p of next) if (!controllers.current.has(p.key)) void run(p);
    if (!busy && batch.current.added + batch.current.failed > 0) {
      const { added, failed } = batch.current;
      batch.current = { added: 0, failed: 0 };
      if (failed) toast.error(`${failed} fotoğraf yüklenemedi. Kırmızı işaretli olanları tekrar deneyebilirsiniz.`);
      else toast.success(added === 1 ? "Fotoğraf eklendi" : `${added} fotoğraf eklendi`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `run` only reads stable refs and setters
  }, [pending, busy]);

  function patch(key: string, change: Partial<Pending>) {
    setPending((list) => list.map((p) => (p.key === key ? { ...p, ...change } : p)));
  }

  async function run(p: Pending) {
    const ctrl = new AbortController();
    controllers.current.set(p.key, ctrl);
    patch(p.key, { status: "processing", progress: 0, error: undefined });
    try {
      const blob = await processPhoto(p.file, p.edit);
      if (ctrl.signal.aborted) return;
      patch(p.key, { status: "uploading" });
      const url = await uploadPhoto(blob, (progress) => patch(p.key, { progress }), ctrl.signal);
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
    for (const file of files) {
      const problem = checkPhotoFile(file);
      if (problem) {
        toast.error(`${file.name}: ${problem}`);
        continue;
      }
      if (accepted.length >= slotsLeft) {
        toast.warning(`En fazla ${MAX_PHOTOS} fotoğraf ekleyebilirsiniz. ${files.length - accepted.length} fotoğraf eklenmedi.`);
        break;
      }
      accepted.push({
        key: `p${++keySeq}`,
        file,
        preview: URL.createObjectURL(file),
        edit: DEFAULT_EDIT,
        status: "waiting",
        progress: 0,
      });
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

  function removeImage(index: number) {
    const url = images[index];
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
    setImages((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer.types).includes("Files");
  const isReorder = (e: DragEvent) => Array.from(e.dataTransfer.types).includes(REORDER_TYPE);

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

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Fotoğraflar</h2>
          <p className="mt-0.5 text-sm text-muted">
            İlk fotoğraf kapak olur. Sıralamak için sürükleyin veya oklara dokunun.
          </p>
        </div>
        <div className="w-28 text-right">
          <p className="text-xs font-semibold tabular-nums text-muted">
            {images.length + pending.length}/{MAX_PHOTOS} fotoğraf
          </p>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-elevated">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300"
              style={{ width: `${((images.length + pending.length) / MAX_PHOTOS) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {required && images.length === 0 ? (
        <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-warn/10 px-3 py-2 text-xs font-medium text-warn">
          <AlertCircle className="size-4 shrink-0" />
          Emlak ve vasıta ilanlarında en az 1 fotoğraf zorunludur.
        </p>
      ) : null}
      {editing ? (
        <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-elevated px-3 py-2 text-xs text-muted">
          <AlertCircle className="size-4 shrink-0" />
          Yeni fotoğraf eklemek yayındaki ilanı tekrar onaya gönderir. Sıralama ve silme onay gerektirmez.
        </p>
      ) : null}

      {images.length + pending.length === 0 ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cn(
            "mt-4 flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors",
            dropActive ? "border-primary bg-primary/10" : "border-border bg-elevated/40 hover:border-primary/50 hover:bg-primary/5",
          )}
        >
          <span className="grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
            <Camera className="size-7" />
          </span>
          <span>
            <span className="block text-base font-semibold text-fg">Fotoğraf ekleyin</span>
            <span className="mt-1 block text-sm text-muted">
              <span className="sm:hidden">Fotoğraf çekin veya galeriden seçin</span>
              <span className="hidden sm:inline">Dosyaları buraya sürükleyin, yapıştırın (Ctrl+V) veya seçin</span>
            </span>
          </span>
          <span className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-fg">
            <Upload className="size-4" /> Fotoğraf seç
          </span>
          <span className="text-xs text-subtle">JPEG, PNG veya WebP · en fazla {MAX_PHOTOS} fotoğraf</span>
        </button>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {images.map((url, i) => {
            const editable = originals.has(url);
            return (
              <li
                key={url}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(REORDER_TYPE, String(i));
                  e.dataTransfer.effectAllowed = "move";
                  setDragFrom(i);
                }}
                onDragEnd={() => {
                  setDragFrom(null);
                  setDragOver(null);
                }}
                onDragOver={(e) => {
                  if (!isReorder(e)) return;
                  e.preventDefault();
                  e.stopPropagation();
                  setDragOver(i);
                }}
                onDrop={(e) => {
                  if (!isReorder(e)) return;
                  e.preventDefault();
                  e.stopPropagation();
                  move(Number(e.dataTransfer.getData(REORDER_TYPE)), i);
                  setDragFrom(null);
                  setDragOver(null);
                }}
                className={cn(
                  "group relative overflow-hidden rounded-xl border bg-elevated shadow-xs transition",
                  i === 0 ? "col-span-2 row-span-2 border-primary/60 ring-2 ring-primary/20" : "border-border",
                  dragFrom === i && "opacity-40",
                  dragOver === i && dragFrom !== i && "ring-2 ring-primary",
                )}
              >
                <img
                  src={url}
                  alt={i === 0 ? "Fotoğraf 1 (kapak)" : `Fotoğraf ${i + 1}`}
                  className="aspect-4/3 size-full object-cover"
                  draggable={false}
                />
                <span className="pointer-events-none absolute left-2 top-2 hidden items-center rounded-md bg-ink/60 p-1 text-primary-fg sm:flex sm:opacity-0 sm:group-hover:opacity-100">
                  <GripVertical className="size-4" />
                </span>
                {i === 0 ? (
                  <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-fg shadow sm:left-9">
                    <Star className="size-3 fill-current" /> Kapak
                  </span>
                ) : (
                  <span className="absolute left-2 top-2 rounded-full bg-ink/60 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-primary-fg sm:left-9">
                    {i + 1}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  aria-label={`Fotoğraf ${i + 1}'i sil`}
                  className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-ink/70 text-primary-fg shadow transition-colors hover:bg-danger"
                >
                  <Trash2 className="size-4" />
                </button>
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-ink/80 to-transparent p-1.5 pt-6 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                  <div className="flex gap-1">
                    <TileButton label="Sola taşı" disabled={i === 0} onClick={() => move(i, i - 1)}>
                      <ArrowLeft className="size-4" />
                    </TileButton>
                    <TileButton label="Sağa taşı" disabled={i === images.length - 1} onClick={() => move(i, i + 1)}>
                      <ArrowRight className="size-4" />
                    </TileButton>
                  </div>
                  <div className="flex gap-1">
                    {editable ? (
                      <TileButton
                        label="Düzenle"
                        onClick={() => {
                          const o = originals.get(url)!;
                          setEditTarget({ index: i, file: o.file, edit: o.edit });
                        }}
                      >
                        <Crop className="size-4" />
                      </TileButton>
                    ) : null}
                    {i !== 0 ? (
                      <TileButton label="Kapak yap" onClick={() => move(i, 0)}>
                        <Star className="size-4" />
                      </TileButton>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}

          {pending.map((p) => (
            <li key={p.key} className="relative overflow-hidden rounded-xl border border-border bg-elevated">
              <img src={p.preview} alt="" className="aspect-4/3 size-full object-cover opacity-60" />
              <div className="absolute inset-0 grid place-items-center bg-ink/30 p-3 text-center text-primary-fg">
                {p.status === "error" ? (
                  <div className="space-y-2">
                    <AlertCircle className="mx-auto size-6 text-white" />
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
                  <div className="w-full max-w-28 space-y-2">
                    <Loader2 className="mx-auto size-6 animate-spin" />
                    <p className="text-xs font-semibold">
                      {p.status === "waiting" ? "Sırada" : p.status === "processing" ? "Hazırlanıyor" : `%${Math.round(p.progress * 100)}`}
                    </p>
                    <div className="h-1 overflow-hidden rounded-full bg-white/30">
                      <div
                        className="h-full rounded-full bg-white transition-[width]"
                        style={{ width: `${p.status === "uploading" ? Math.max(5, p.progress * 100) : 0}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => removePending(p.key)}
                aria-label="Fotoğrafı kaldır"
                className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-ink/70 text-primary-fg hover:bg-danger"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}

          {slotsLeft > 0 ? (
            <li>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className={cn(
                  "flex aspect-4/3 size-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed text-sm font-medium transition-colors",
                  dropActive ? "border-primary bg-primary/10 text-primary" : "border-border text-muted hover:border-primary/50 hover:text-primary",
                )}
              >
                <ImagePlus className="size-6" />
                Fotoğraf ekle
                <span className="text-xs font-normal text-subtle">{slotsLeft} yer kaldı</span>
              </button>
            </li>
          ) : null}
        </ul>
      )}

      {dropActive && images.length + pending.length > 0 ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center rounded-xl border-2 border-dashed border-primary bg-primary/10 text-sm font-semibold text-primary">
          Fotoğrafları bırakın
        </div>
      ) : null}

      <div className="mt-5 flex gap-3 rounded-xl bg-elevated/60 p-3 text-xs text-muted">
        <Lightbulb className="size-4 shrink-0 text-warn" />
        <p>
          Gün ışığında, ürünün tamamını gösteren ve yatay çekilmiş fotoğraflar daha çok ilgi görür. Fotoğraflar 4:3 oranına
          getirilir ve GeldeSat filigranı eklenir.
        </p>
      </div>

      {editTarget ? (
        <PhotoEditDialog
          file={editTarget.file}
          initial={editTarget.edit}
          onClose={() => setEditTarget(null)}
          onSaved={(url, edit) => {
            const old = images[editTarget.index];
            originals.set(url, { file: editTarget.file, edit });
            setImages((prev) => prev.map((u) => (u === old ? url : u)));
            if (originals.delete(old)) discardPhoto(old);
            setEditTarget(null);
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
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-8 place-items-center rounded-lg bg-white/90 text-ink shadow-sm transition-colors hover:bg-white disabled:opacity-30"
    >
      {children}
    </button>
  );
}

/** Rotate and choose fit/crop for a photo, re-processing from the original file and uploading the result. */
function PhotoEditDialog({
  file,
  initial,
  onClose,
  onSaved,
}: {
  file: File;
  initial: PhotoEdit;
  onClose: () => void;
  onSaved: (url: string, edit: PhotoEdit) => void;
}) {
  const [edit, setEdit] = useState(initial);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);

  // Re-render the photo for each change; the previous preview stays up until the new one is ready.
  useEffect(() => {
    let cancelled = false;
    setBlob(null);
    processPhoto(file, edit)
      .then((next) => {
        if (cancelled) return;
        setBlob(next);
        setPreview((old) => {
          if (old) URL.revokeObjectURL(old);
          return URL.createObjectURL(next);
        });
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Görsel işlenemedi"));
    return () => {
      cancelled = true;
    };
  }, [file, edit]);

  const previewRef = useRef(preview);
  previewRef.current = preview;
  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
  }, []);

  const rotate = (delta: number) =>
    setEdit((e) => ({ ...e, rotate: ((((e.rotate + delta) % 360) + 360) % 360) as PhotoRotation }));

  async function save() {
    if (!blob) return;
    setSaving(true);
    try {
      onSaved(await uploadPhoto(blob), edit);
      toast.success("Fotoğraf güncellendi");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fotoğraf kaydedilemedi");
    } finally {
      setSaving(false);
    }
  }

  const unchanged = edit.rotate === initial.rotate && edit.fit === initial.fit;

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="border-border bg-surface sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Fotoğrafı düzenle</DialogTitle>
          <DialogDescription>Döndürün veya fotoğrafın çerçeveye nasıl yerleşeceğini seçin.</DialogDescription>
        </DialogHeader>
        <div className="relative aspect-4/3 overflow-hidden rounded-lg bg-elevated">
          {preview ? <img src={preview} alt="Düzenlenen fotoğraf önizlemesi" className="size-full object-contain" /> : null}
          {!blob ? (
            <div className="absolute inset-0 grid place-items-center">
              <Loader2 className="size-6 animate-spin text-muted" />
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => rotate(-90)} aria-label="Sola döndür">
              <RotateCcw className="size-4" />
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => rotate(90)} aria-label="Sağa döndür">
              <RotateCw className="size-4" />
            </Button>
          </div>
          <div className="inline-flex rounded-md border border-border p-0.5" role="radiogroup" aria-label="Yerleşim">
            {(
              [
                ["contain", "Sığdır", Maximize],
                ["cover", "Kırp ve doldur", Crop],
              ] as const
            ).map(([fit, label, Icon]) => (
              <button
                key={fit}
                type="button"
                role="radio"
                aria-checked={edit.fit === fit}
                onClick={() => setEdit((e) => ({ ...e, fit }))}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded px-3 text-sm",
                  edit.fit === fit ? "bg-primary text-primary-fg" : "text-muted hover:text-fg",
                )}
              >
                <Icon className="size-4" /> {label}
              </button>
            ))}
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Vazgeç
          </Button>
          <Button type="button" onClick={() => void save()} disabled={saving || unchanged || !blob}>
            {saving ? "Kaydediliyor…" : "Uygula"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
