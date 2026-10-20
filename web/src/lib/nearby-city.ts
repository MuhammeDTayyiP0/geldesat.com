import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { CITY_COORDS } from "@/lib/data/geo";

/**
 * The visitor's city for the "… civarında" home rail: picked once (browser
 * location or the list) and kept in this browser, like the app keeps it on the device.
 */
const KEY = "geldesat.nearbyCity.v1";
let city: string | null | undefined;
const listeners = new Set<() => void>();

function read(): string | null {
  if (city !== undefined) return city;
  try {
    city = window.localStorage.getItem(KEY);
  } catch {
    city = null;
  }
  return city;
}

function write(next: string | null) {
  city = next;
  try {
    if (next) window.localStorage.setItem(KEY, next);
    else window.localStorage.removeItem(KEY);
  } catch {
    // private mode etc.: keep it for this visit only
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Closest province centre to a point (straight-line distance is enough at this scale). */
function nearestCity(lat: number, lng: number): string | null {
  let best: string | null = null;
  let bestD = Infinity;
  const k = Math.cos((lat * Math.PI) / 180);
  for (const [name, c] of Object.entries(CITY_COORDS)) {
    const d = (c.lat - lat) ** 2 + ((c.lng - lng) * k) ** 2;
    if (d < bestD) {
      bestD = d;
      best = name;
    }
  }
  return best;
}

export function useNearbyCity() {
  const current = useSyncExternalStore(subscribe, read, () => null);
  const [locating, setLocating] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  /** Ask the browser for the location and keep the nearest province. Resolves an error message on failure. */
  const locate = useCallback(
    () =>
      new Promise<string | null>((resolve) => {
        if (!("geolocation" in navigator)) return resolve("Tarayıcınız konum paylaşımını desteklemiyor. Şehrinizi listeden seçin.");
        setLocating(true);
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setLocating(false);
            const found = nearestCity(pos.coords.latitude, pos.coords.longitude);
            if (!found) return resolve("Konumunuz bir ile eşleştirilemedi. Şehrinizi listeden seçin.");
            write(found);
            resolve(null);
          },
          () => {
            setLocating(false);
            resolve("Konum izni verilmedi. Şehrinizi listeden seçebilirsiniz.");
          },
          { maximumAge: 60 * 60_000, timeout: 10_000 },
        );
      }),
    [],
  );

  return { city: hydrated ? current : null, hydrated, locating, locate, setCity: write };
}
