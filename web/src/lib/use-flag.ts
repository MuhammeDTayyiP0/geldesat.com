import { useEffect, useSyncExternalStore } from "react";
import { getRouteApi } from "@tanstack/react-router";
import { getWebFlags } from "@/lib/server/config";
import type { ThemePref } from "@/lib/theme";

/**
 * Website feature flags. The server computes them while rendering the first
 * page (root loader), so a flagged feature never flickers in; open tabs then
 * re-check every few minutes, so turning a flag off reaches them too.
 *
 *   const offers = useFlag("teklif_ver");
 *   return offers ? <OfferButton /> : null;
 */

const REFRESH_MS = 5 * 60_000;

let current: Record<string, boolean> | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function publish(next: Record<string, boolean>) {
  current = next;
  for (const listener of listeners) listener();
}

/** What the root route loads once per page load (see routes/__root.tsx). */
export type RootLoaderData = { theme: ThemePref; flags: Record<string, boolean> };

const root = getRouteApi("__root__");
const NONE: Record<string, boolean> = {};

/** Every flag for this visitor. */
export function useFlags(): Record<string, boolean> {
  const initial = (root.useLoaderData() as RootLoaderData | undefined)?.flags ?? NONE;
  return useSyncExternalStore(
    subscribe,
    () => current ?? initial,
    () => initial,
  );
}

/** Whether one flag is on. Unknown flags are off. */
export function useFlag(name: string): boolean {
  return useFlags()[name] === true;
}

/** Keeps the flags fresh while the tab is open. Mounted once, in the root shell. */
export function useFlagRefresh() {
  useEffect(() => {
    let last = Date.now();
    const refresh = () => {
      last = Date.now();
      getWebFlags()
        .then(publish)
        .catch(() => {});
    };
    const timer = window.setInterval(refresh, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - last > REFRESH_MS) refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
}
