/**
 * Message safe to return to API clients. Errors the app throws on purpose
 * (`throw new Error("Kategori bulunamadı")`) are shown as-is; driver, system
 * and programming errors (SQL text, file paths, stack-ish detail) are logged
 * server-side and replaced by `fallback`.
 */
export class RateLimitError extends Error {
  constructor(message = "Çok fazla istek. Lütfen biraz bekleyin.") {
    super(message);
    this.name = "RateLimitError";
  }
}

/** HTTP status for a caught error: limits keep their meaning, everything else uses `fallback`. */
export function errorStatus(error: unknown, fallback: number): number {
  if (error instanceof RateLimitError) return 429;
  if (error instanceof Error && error.name === "BodyTooLargeError") return 413;
  if (error instanceof Error && error.name === "BadRequestError") return 400;
  return fallback;
}

export function publicErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && !isInternalError(error)) return error.message;
  console.error("[api]", error);
  return fallback;
}

function isInternalError(error: Error): boolean {
  if (typeof (error as { code?: unknown }).code === "string") return true; // pg, PGLite, Node system errors
  // Library messages without a code: pool timeouts, sharp/libvips, Expo fetch failures.
  if (/timeout|connect|socket|vips|^Input |fetch failed/i.test(error.message)) return true;
  return (
    error instanceof TypeError ||
    error instanceof RangeError ||
    error instanceof ReferenceError ||
    error instanceof SyntaxError
  );
}
