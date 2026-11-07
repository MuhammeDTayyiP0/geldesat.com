/** A message that survives a full page change, shown once by the next page. */
const KEY = "geldesat:flash";

export function setFlash(message: string): void {
  try {
    sessionStorage.setItem(KEY, message);
  } catch {
    // Blocked storage: the message is simply skipped.
  }
}

export function takeFlash(): string | null {
  try {
    const message = sessionStorage.getItem(KEY);
    if (message) sessionStorage.removeItem(KEY);
    return message;
  } catch {
    return null;
  }
}
