/**
 * Request bodies read with a hard limit. A Content-Length check alone is not
 * enough: a chunked request has none, and `request.text()`/`formData()` would
 * buffer whatever is sent.
 */
export class BodyTooLargeError extends Error {
  constructor(message = "İstek çok büyük.") {
    super(message);
    this.name = "BodyTooLargeError";
  }
}

/** The client sent something unusable: a 400 with this message, not a logged 500. */
export class BadRequestError extends Error {
  constructor(message = "İstek okunamadı.") {
    super(message);
    this.name = "BadRequestError";
  }
}

/** A JSON body with a limit. Larger than any form the API takes; photos have their own routes. */
export async function readJson(request: Request, maxBytes = 512 * 1024): Promise<Record<string, unknown>> {
  const bytes = await readLimited(request, maxBytes);
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new BadRequestError();
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new BadRequestError();
  return value as Record<string, unknown>;
}

export async function readLimited(request: Request, maxBytes: number, message?: string): Promise<Uint8Array<ArrayBuffer>> {
  if (Number(request.headers.get("content-length") ?? 0) > maxBytes) throw new BodyTooLargeError(message);
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = request.body?.getReader();
  if (reader) {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new BodyTooLargeError(message);
      }
      chunks.push(value);
    }
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function limitedFormData(request: Request, maxBytes: number, message?: string): Promise<FormData> {
  const bytes = await readLimited(request, maxBytes, message);
  return new Response(bytes, { headers: { "Content-Type": request.headers.get("content-type") ?? "" } }).formData();
}
