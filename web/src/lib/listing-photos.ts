/** Header the web client sends; a cross-site form cannot set it and a cross-origin fetch fails preflight. */
export const UPLOAD_HEADER = "x-geldesat-upload";

/** Upload one processed photo as multipart, reporting byte progress (0–1). Resolves to its public URL. */
export function uploadPhoto(blob: Blob, onProgress?: (fraction: number) => void, signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.setRequestHeader(UPLOAD_HEADER, "1");
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      const body = (xhr.response ?? {}) as { url?: string; error?: string };
      if (xhr.status >= 200 && xhr.status < 300 && body.url) resolve(body.url);
      else reject(new Error(body.error || (xhr.status === 413 ? "Fotoğraf çok büyük." : "Fotoğraf yüklenemedi.")));
    };
    xhr.onerror = () => reject(new Error("Bağlantı hatası. İnternetinizi kontrol edip tekrar deneyin."));
    xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    const form = new FormData();
    form.append("file", blob, blob.type === "image/webp" ? "photo.webp" : "photo.jpg");
    xhr.send(form);
  });
}

/** Best-effort removal of a photo the user dropped before saving; the server keeps anything a listing uses. */
export function discardPhoto(url: string): void {
  void fetch("/api/upload", {
    method: "DELETE",
    headers: { "Content-Type": "application/json", [UPLOAD_HEADER]: "1" },
    body: JSON.stringify({ url }),
  }).catch(() => {});
}

/** Upload a new profile photo; resolves to its versioned URL. */
export async function uploadAvatar(file: Blob): Promise<string> {
  const form = new FormData();
  form.append("file", file, "avatar");
  const res = await fetch("/api/avatar", { method: "POST", headers: { [UPLOAD_HEADER]: "1" }, body: form });
  const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !body.url) throw new Error(body.error || "Fotoğraf yüklenemedi.");
  return body.url;
}

/** Remove the profile photo. */
export async function removeAvatar(): Promise<void> {
  const res = await fetch("/api/avatar", { method: "DELETE", headers: { [UPLOAD_HEADER]: "1" } });
  if (!res.ok) throw new Error("Fotoğraf kaldırılamadı.");
}
