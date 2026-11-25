import { createElement, forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { mapHtml, type MapCenter, type MapEvent, type MapMarker, type MarkerRenderOpts } from './mapHtml';

export type MapCanvasHandle = { flyTo: (lat: number, lng: number, zoom?: number) => void };

type Props = {
  initial: MapCenter;
  dark: boolean;
  onEvent: (event: MapEvent) => void;
  markers?: MapMarker[];
  onMarkerPress?: (id: string) => void;
  cluster?: boolean;
  selectedId?: string | null;
};

type MapFrameWindow = Window & {
  __fly?: (a: number, b: number, c: number) => void;
  __setTheme?: (dark: boolean) => void;
  __setMarkers?: (list: MapMarker[], opts?: MarkerRenderOpts) => void;
};

/** Browser build: the same Leaflet page in an iframe, talking over postMessage. */
export const MapCanvas = forwardRef<MapCanvasHandle, Props>(function MapCanvas(
  { initial, dark, onEvent, markers, onMarkerPress, cluster = false, selectedId = null },
  ref,
) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const readyRef = useRef(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const html = useMemo(() => mapHtml(initial, dark), []);
  const handler = useRef(onEvent);
  const markerHandler = useRef(onMarkerPress);
  const latestRef = useRef({ markers, cluster, selectedId, dark });
  useEffect(() => {
    handler.current = onEvent;
    markerHandler.current = onMarkerPress;
    latestRef.current = { markers, cluster, selectedId, dark };
  }, [onEvent, onMarkerPress, markers, cluster, selectedId, dark]);

  useEffect(() => {
    if (!readyRef.current) return;
    const win = frame.current?.contentWindow as MapFrameWindow | null | undefined;
    win?.__setTheme?.(dark);
  }, [dark]);

  useEffect(() => {
    if (!readyRef.current) return;
    const win = frame.current?.contentWindow as MapFrameWindow | null | undefined;
    win?.__setMarkers?.(markers ?? [], { cluster, selectedId });
  }, [markers, cluster, selectedId]);

  useEffect(() => {
    const listen = (e: MessageEvent) => {
      const payload = e.data as { __geldesatMap?: boolean; data?: string } | null;
      if (!payload?.__geldesatMap || e.source !== frame.current?.contentWindow) return;
      try {
        const parsed = JSON.parse(payload.data ?? '') as MapEvent | { type: 'marker'; id: string };
        if (parsed.type === 'marker') {
          markerHandler.current?.(parsed.id);
          return;
        }
        if (parsed.type === 'ready') {
          readyRef.current = true;
          const win = frame.current?.contentWindow as MapFrameWindow | null | undefined;
          const cur = latestRef.current;
          win?.__setTheme?.(cur.dark);
          if (cur.markers?.length) {
            win?.__setMarkers?.(cur.markers, { cluster: cur.cluster, selectedId: cur.selectedId });
          }
        }
        handler.current(parsed);
      } catch {
        // Ignore malformed messages.
      }
    };
    window.addEventListener('message', listen);
    return () => window.removeEventListener('message', listen);
  }, []);

  useImperativeHandle(ref, () => ({
    flyTo: (lat, lng, zoom = 17) => {
      const win = frame.current?.contentWindow as MapFrameWindow | null | undefined;
      win?.__fly?.(lat, lng, zoom);
    },
  }));

  return createElement('iframe', {
    ref: frame,
    srcDoc: html,
    title: 'Harita',
    style: { position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 },
  });
});
