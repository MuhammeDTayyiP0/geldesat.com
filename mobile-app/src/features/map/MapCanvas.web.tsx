import { createElement, forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { mapHtml, type MapCenter, type MapEvent } from './mapHtml';

export type MapCanvasHandle = { flyTo: (lat: number, lng: number, zoom?: number) => void };

type Props = { initial: MapCenter; dark: boolean; onEvent: (event: MapEvent) => void };

/** Browser build: the same Leaflet page in an iframe, talking over postMessage. */
export const MapCanvas = forwardRef<MapCanvasHandle, Props>(function MapCanvas({ initial, dark, onEvent }, ref) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const html = useMemo(() => mapHtml(initial, dark), []);
  const handler = useRef(onEvent);
  useEffect(() => {
    handler.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    const listen = (e: MessageEvent) => {
      const payload = e.data as { __geldesatMap?: boolean; data?: string } | null;
      if (!payload?.__geldesatMap || e.source !== frame.current?.contentWindow) return;
      try {
        handler.current(JSON.parse(payload.data ?? '') as MapEvent);
      } catch {
        // Ignore malformed messages.
      }
    };
    window.addEventListener('message', listen);
    return () => window.removeEventListener('message', listen);
  }, []);

  useImperativeHandle(ref, () => ({
    flyTo: (lat, lng, zoom = 17) => {
      const win = frame.current?.contentWindow as (Window & { __fly?: (a: number, b: number, c: number) => void }) | null | undefined;
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
