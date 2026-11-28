import { useEffect, useRef } from "react";
import { toast } from "sonner";

export const CURRENT_BUILD_ID = typeof __APP_BUILD_ID__ !== "undefined" ? __APP_BUILD_ID__ : "dev";

const RELOAD_GUARD_KEY = "gds_last_reload_at";
const RELOAD_COOLDOWN_MS = 20_000;
const CHECK_INTERVAL_MS = 60_000;

export function isChunkLoadError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  if (!msg) return false;
  return (
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("Importing a module script failed") ||
    msg.includes("ChunkLoadError") ||
    msg.includes("Loading chunk") ||
    msg.includes("Unable to preload CSS")
  );
}

export function safeReloadOnce(_reason: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.sessionStorage.getItem(RELOAD_GUARD_KEY);
    const last = raw ? Number(raw) : 0;
    if (Number.isFinite(last) && Date.now() - last < RELOAD_COOLDOWN_MS) {
      return false;
    }
    window.sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
  } catch {
    // sessionStorage might be unavailable in strict private mode; still allow reload once.
  }
  window.location.reload();
  return true;
}

export async function checkServerVersion(): Promise<{ outdated: boolean; latest: string | null }> {
  try {
    const res = await fetch("/api/version", { cache: "no-store" });
    if (!res.ok) return { outdated: false, latest: null };
    const body = (await res.json().catch(() => null)) as { version?: string } | null;
    const latest = body?.version ?? null;
    if (!latest || CURRENT_BUILD_ID === "dev") return { outdated: false, latest };
    return { outdated: latest !== CURRENT_BUILD_ID, latest };
  } catch {
    return { outdated: false, latest: null };
  }
}

function isEditingForm(): boolean {
  if (typeof document === "undefined" || typeof window === "undefined") return false;
  if (window.location.pathname.startsWith("/ilan-ver")) return true;
  const tag = document.activeElement?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/**
 * Keeps long-lived tabs & standalone PWAs in sync across deployments without
 * breaking active form input.
 */
export function useAutoVersionCheck() {
  const lastCheckRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onPreloadError = (e: Event) => {
      e.preventDefault();
      safeReloadOnce("preload");
    };

    const runCheck = async (force = false) => {
      const now = Date.now();
      if (!force && now - lastCheckRef.current < CHECK_INTERVAL_MS) return;
      lastCheckRef.current = now;
      const { outdated } = await checkServerVersion();
      if (!outdated) return;
      if (isEditingForm()) {
        toast.info("GeldeSat güncellendi", {
          id: "app-update",
          description: "Yeni sürümü yüklemek için yenileyin.",
          duration: Infinity,
          action: {
            label: "Yenile",
            onClick: () => window.location.reload(),
          },
        });
      } else {
        safeReloadOnce("version");
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void runCheck(false);
      }
    };

    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) void runCheck(true);
    };

    window.addEventListener("vite:preloadError", onPreloadError);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      window.removeEventListener("vite:preloadError", onPreloadError);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);
}
