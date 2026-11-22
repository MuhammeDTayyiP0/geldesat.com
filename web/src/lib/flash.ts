/** A message that survives a full page change, shown once by the next page. */
const KEY = "geldesat:flash";

export type FlashTone = "success" | "error";
export type FlashMessage = { message: string; tone: FlashTone };

export function setFlash(message: string, tone: FlashTone = "success"): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ message, tone }));
  } catch {
    // Blocked storage: the message is simply skipped.
  }
}

export function takeFlash(): FlashMessage | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    try {
      const parsed = JSON.parse(raw) as Partial<FlashMessage>;
      if (typeof parsed?.message === "string") {
        return { message: parsed.message, tone: parsed.tone === "error" ? "error" : "success" };
      }
    } catch {
      // Legacy plain-string flash value.
    }
    return { message: raw, tone: "success" };
  } catch {
    return null;
  }
}
