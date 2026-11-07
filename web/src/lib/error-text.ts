/**
 * Text for an error shown to a person. A validation error reaches the browser
 * as a JSON list of issues, which must never be printed as it is.
 */
export function errorText(err: unknown, fallback = "İşlem tamamlanamadı. Lütfen tekrar deneyin."): string {
  const message = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  if (!message) return fallback;
  if (message.startsWith("[")) {
    try {
      const issues = JSON.parse(message) as Array<{ message?: string }>;
      return issues[0]?.message || "Girdiğiniz bilgileri kontrol edin.";
    } catch {
      return fallback;
    }
  }
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(message)) {
    return "Bağlantı kurulamadı. İnternetinizi kontrol edip tekrar deneyin.";
  }
  return message;
}
