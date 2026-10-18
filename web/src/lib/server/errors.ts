/**
 * Message safe to return to API clients. Errors the app throws on purpose
 * (`throw new Error("Kategori bulunamadı")`) are shown as-is; driver, system
 * and programming errors (SQL text, file paths, stack-ish detail) are logged
 * server-side and replaced by `fallback`.
 */
export function publicErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && !isInternalError(error)) return error.message;
  console.error("[api]", error);
  return fallback;
}

function isInternalError(error: Error): boolean {
  if (typeof (error as { code?: unknown }).code === "string") return true; // pg, PGLite, Node system errors
  return (
    error instanceof TypeError ||
    error instanceof RangeError ||
    error instanceof ReferenceError ||
    error instanceof SyntaxError
  );
}
