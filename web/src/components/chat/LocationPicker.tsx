import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import { Loader2, LocateFixed, MapPin, Search, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { TILE_ATTRIBUTION, TILE_SUBDOMAINS, TILE_URL, TURKEY_CENTER } from "@/lib/map-tiles";
import { cn } from "@/lib/utils";
import "leaflet/dist/leaflet.css";

type Place = { label: string; lat: number; lng: number };

async function geo<T>(params: Record<string, string>): Promise<T> {
  const res = await fetch(`/api/geo?${new URLSearchParams(params)}`);
  if (!res.ok) throw new Error("Adres bilgisi alınamadı");
  return (await res.json()) as T;
}

/**
 * WhatsApp-style meeting-point picker: pan the map under a fixed pin, search
 * for a place, or jump to the device location; the address under the pin is
 * looked up as the map stops.
 */
export function LocationPicker({
  open,
  onOpenChange,
  onSend,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (place: { label: string; lat: number; lng: number }) => Promise<void>;
}) {
  const mapEl = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [label, setLabel] = useState("");
  const [resolving, setResolving] = useState(false);
  const [moving, setMoving] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);
  const lookup = useRef(0);

  // Create the map when the dialog opens (Leaflet needs the browser and a sized element).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let instance: LeafletMap | null = null;
    void import("leaflet").then((L) => {
      if (cancelled || !mapEl.current) return;
      instance = L.map(mapEl.current, { zoomControl: false, attributionControl: true }).setView(
        [TURKEY_CENTER.lat, TURKEY_CENTER.lng],
        TURKEY_CENTER.zoom,
      );
      L.tileLayer(TILE_URL, { subdomains: TILE_SUBDOMAINS, attribution: TILE_ATTRIBUTION, maxZoom: 19, detectRetina: true }).addTo(instance);
      L.control.zoom({ position: "bottomright" }).addTo(instance);
      instance.on("movestart", () => setMoving(true));
      instance.on("moveend", () => {
        setMoving(false);
        const c = instance!.getCenter();
        setCenter({ lat: c.lat, lng: c.lng });
      });
      map.current = instance;
      setTimeout(() => instance?.invalidateSize(), 150);
      locate(true);
    });
    return () => {
      cancelled = true;
      instance?.remove();
      map.current = null;
      setCenter(null);
      setLabel("");
      setQ("");
      setResults([]);
    };
  }, [open]);

  // Address of the point under the pin once the map settles (zoomed in far enough to mean a place).
  useEffect(() => {
    if (!center || (map.current?.getZoom() ?? 0) < 12) return;
    const id = ++lookup.current;
    setResolving(true);
    const t = setTimeout(() => {
      void geo<{ label?: string }>({ lat: String(center.lat), lng: String(center.lng) })
        .then((r) => id === lookup.current && setLabel(r.label || "Seçilen konum"))
        .catch(() => id === lookup.current && setLabel("Seçilen konum"))
        .finally(() => id === lookup.current && setResolving(false));
    }, 500);
    return () => clearTimeout(t);
  }, [center]);

  // Place search, debounced.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      const c = map.current?.getCenter();
      void geo<{ results: Place[] }>({ q: term, ...(c ? { near: `${c.lat},${c.lng}` } : {}) })
        .then((r) => setResults(r.results))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 450);
    return () => clearTimeout(t);
  }, [q]);

  function locate(quiet = false) {
    if (!navigator.geolocation) {
      if (!quiet) toast.error("Tarayıcınız konum bilgisini desteklemiyor.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        map.current?.flyTo([pos.coords.latitude, pos.coords.longitude], 17, { duration: 0.8 });
        setLocating(false);
      },
      () => {
        setLocating(false);
        if (!quiet) toast.error("Konumunuz alınamadı. Haritayı kaydırarak bir yer seçin.");
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  function pick(p: Place) {
    setQ("");
    setResults([]);
    lookup.current++;
    setLabel(p.label);
    map.current?.flyTo([p.lat, p.lng], 17, { duration: 0.8 });
  }

  const zoomedIn = (map.current?.getZoom() ?? 0) >= 12;
  const canSend = Boolean(center && zoomedIn && !moving && !resolving && label);

  async function send() {
    if (!center || !label) return;
    setBusy(true);
    try {
      await onSend({ label: label.slice(0, 120), lat: center.lat, lng: center.lng });
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Konum gönderilemedi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[100dvh] max-h-[100dvh] w-full max-w-none flex-col gap-0 overflow-hidden rounded-none border-border bg-surface p-0 sm:h-[640px] sm:max-h-[90dvh] sm:max-w-lg sm:rounded-2xl"
      >
        <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
          <button type="button" onClick={() => onOpenChange(false)} aria-label="Kapat" className="grid size-9 place-items-center rounded-full hover:bg-elevated">
            <X className="size-5" />
          </button>
          <div className="min-w-0">
            <DialogTitle className="text-base">Konum gönder</DialogTitle>
            <DialogDescription className="text-xs">Haritayı kaydırarak buluşma noktasını seçin</DialogDescription>
          </div>
        </div>

        <div className="relative px-3 py-2">
          <label className="flex h-10 items-center gap-2 rounded-xl bg-elevated px-3">
            <Search className="size-4 text-subtle" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Yer, cadde veya semt ara"
              aria-label="Yer ara"
              className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-subtle"
            />
            {searching ? <Loader2 className="size-4 animate-spin text-subtle" /> : null}
          </label>
          {results.length ? (
            <ul className="absolute inset-x-3 top-full z-[1000] max-h-72 overflow-y-auto rounded-xl border border-border bg-surface shadow-lift">
              {results.map((r) => (
                <li key={`${r.lat},${r.lng}`}>
                  <button type="button" onClick={() => pick(r)} className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm hover:bg-elevated">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                    {r.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="relative min-h-0 flex-1">
          <div ref={mapEl} className="absolute inset-0 z-0" />
          {/* Fixed pin: the map moves underneath it. */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-[500] -translate-x-1/2 -translate-y-full">
            <MapPin className={cn("size-10 fill-danger text-white drop-shadow-lg transition-transform", moving && "-translate-y-2")} strokeWidth={1.5} />
          </div>
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-[499] size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/30" />
          <button
            type="button"
            onClick={() => locate()}
            disabled={locating}
            aria-label="Konumuma git"
            className="absolute right-3 top-3 z-[500] grid size-11 place-items-center rounded-full border border-border bg-surface shadow-card hover:bg-elevated"
          >
            {locating ? <Loader2 className="size-5 animate-spin text-primary" /> : <LocateFixed className="size-5 text-primary" />}
          </button>
        </div>

        <div className="space-y-3 border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
              <MapPin className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted">{zoomedIn ? "Buluşma noktası" : "Bir yer seçmek için yakınlaştırın"}</p>
              <input
                value={resolving ? "Adres bulunuyor…" : label}
                onChange={(e) => setLabel(e.target.value.slice(0, 120))}
                disabled={resolving || !zoomedIn}
                aria-label="Yer adı"
                className="w-full bg-transparent font-medium outline-none disabled:text-muted"
              />
            </div>
          </div>
          <Button type="button" className="w-full" disabled={!canSend || busy} onClick={() => void send()}>
            <Send className="size-4" /> {busy ? "Gönderiliyor…" : "Bu konumu gönder"}
          </Button>
          <p className="text-center text-[11px] text-subtle">Kalabalık ve herkese açık bir yer seçin; ev adresinizi paylaşmayın.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
