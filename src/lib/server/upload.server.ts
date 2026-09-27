import { promises as fs } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const DATA_URL_REGEX = /^data:image\/(webp|jpeg|jpg|png);base64,(.+)$/i;

/**
 * Saves a base64 or binary image payload to the server's local persistent disk (public/uploads/).
 * Returns the public URL path: /uploads/<filename>.<ext>
 */
export async function saveImageToDisk(dataUrl: string, _userId?: string): Promise<string> {
  const match = dataUrl.match(DATA_URL_REGEX);
  if (!match) {
    throw new Error("Geçersiz görsel verisi. WebP, JPEG veya PNG bekleniyor.");
  }

  let ext = match[1].toLowerCase();
  if (ext === "jpeg") ext = "jpg";
  const base64Data = match[2];
  const buffer = Buffer.from(base64Data, "base64");

  // En fazla 2 MB sınır
  if (buffer.length > 2 * 1024 * 1024) {
    throw new Error("Görsel boyutu 2 MB sınırını aşıyor.");
  }

  // uploads klasörünü oluştur
  const uploadsDir = join(process.cwd(), "public", "uploads");
  await fs.mkdir(uploadsDir, { recursive: true });

  // Benzersiz dosya adı oluştur
  const filename = `${Date.now()}_${randomUUID().replace(/-/g, "").slice(0, 10)}.${ext}`;
  const filePath = join(uploadsDir, filename);

  await fs.writeFile(filePath, buffer);

  return `/uploads/${filename}`;
}
