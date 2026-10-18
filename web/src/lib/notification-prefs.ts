/** Notification kinds a user can tune, shared by the server (notify) and the settings page. */
export const NOTIFY_TYPES = [
  { type: "message", label: "Yeni mesajlar", hint: "Biri ilanınız hakkında yazdığında" },
  { type: "favorite", label: "Favoriler", hint: "İlanınız favorilere eklendiğinde" },
  { type: "listing", label: "İlan durumu", hint: "Onay, ret ve tekrar inceleme", inappLocked: true },
  { type: "expiry", label: "Süre hatırlatması", hint: "İlanınızın süresi dolmak üzereyken" },
] as const;

export type NotifyType = (typeof NOTIFY_TYPES)[number]["type"];
export type NotifyChannelPrefs = { inapp: boolean; push: boolean };
export type NotifyPrefs = Record<NotifyType, NotifyChannelPrefs>;

export type PhoneVisibility = "everyone" | "members" | "hidden";

/** Stored prefs with defaults filled in: every channel is on unless turned off. */
export function resolveNotifyPrefs(raw: unknown): NotifyPrefs {
  const stored = (raw && typeof raw === "object" ? raw : {}) as Record<string, Partial<NotifyChannelPrefs> | undefined>;
  return Object.fromEntries(
    NOTIFY_TYPES.map(({ type, ...meta }) => {
      const s = stored[type] ?? {};
      return [type, { inapp: "inappLocked" in meta ? true : s.inapp !== false, push: s.push !== false }];
    }),
  ) as NotifyPrefs;
}
