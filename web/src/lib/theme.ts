import { useSyncExternalStore } from "react";
import { createServerFn } from "@tanstack/react-start";

/** Appearance choice: follow the device, or force light / dark. */
export type ThemePref = "system" | "light" | "dark";

export const THEME_COOKIE = "gs-theme";
const ONE_YEAR = 60 * 60 * 24 * 365;

export function parseThemePref(value: unknown): ThemePref {
  return value === "light" || value === "dark" ? value : "system";
}

/**
 * The saved choice, read from a cookie during server rendering so the first
 * paint already has the right colours (no inline script, so the CSP stays strict).
 */
export const getThemePref = createServerFn({ method: "GET" }).handler(async () => {
  const { getCookie } = await import("@tanstack/react-start/server");
  return parseThemePref(getCookie(THEME_COOKIE));
});

let current: ThemePref | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Current choice; `initial` (from the server) is used until the person changes it. */
export function useThemePref(initial: ThemePref): ThemePref {
  return useSyncExternalStore(
    subscribe,
    () => current ?? initial,
    () => initial,
  );
}

export function setThemePref(pref: ThemePref) {
  current = pref;
  document.cookie = `${THEME_COOKIE}=${pref}; Path=/; Max-Age=${ONE_YEAR}; SameSite=Lax; Secure`;
  for (const listener of listeners) listener();
}
