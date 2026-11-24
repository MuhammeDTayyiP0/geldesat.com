import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, type ComponentType, type Ref } from 'react';
import { Linking, StyleSheet } from 'react-native';
import { WebView as RNWebView, type WebViewProps } from 'react-native-webview';
import { mapHtml, type MapCenter, type MapEvent, type MapMarker } from './mapHtml';

export type MapCanvasHandle = { flyTo: (lat: number, lng: number, zoom?: number) => void };

type Props = {
  initial: MapCenter;
  dark: boolean;
  onEvent: (event: MapEvent) => void;
  markers?: MapMarker[];
  onMarkerPress?: (id: string) => void;
};

type RawMapEvent = MapEvent | { type: 'marker'; id: string };

type WebViewHandle = { injectJavaScript: (script: string) => void };
// The package's class typings do not fit React 19.3's JSX types; describe what is used.
const WebView = RNWebView as unknown as ComponentType<WebViewProps & { ref?: Ref<WebViewHandle> }>;

/** Interactive map (Leaflet in a WebView); the web build uses MapCanvas.web.tsx. */
export const MapCanvas = forwardRef<MapCanvasHandle, Props>(function MapCanvas({ initial, dark, onEvent, markers, onMarkerPress }, ref) {
  const web = useRef<WebViewHandle>(null);
  const readyRef = useRef(false);
  // Built once: re-creating the page would reset the map.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const html = useMemo(() => mapHtml(initial, dark), []);

  useEffect(() => {
    if (!readyRef.current) return;
    web.current?.injectJavaScript(`window.__setMarkers?.(${JSON.stringify(markers ?? [])}); true;`);
  }, [markers]);

  useImperativeHandle(ref, () => ({
    flyTo: (lat, lng, zoom = 17) => web.current?.injectJavaScript(`window.__fly?.(${lat}, ${lng}, ${zoom}); true;`),
  }));

  return (
    <WebView
      ref={web}
      source={{ html, baseUrl: 'https://www.geldesat.com' }}
      originWhitelist={['*']}
      style={StyleSheet.absoluteFill}
      onShouldStartLoadWithRequest={(req) => {
        if (req.url === 'about:blank' || req.url.startsWith('data:')) return true;
        if ((req.url === 'https://www.geldesat.com' || req.url === 'https://www.geldesat.com/') && req.navigationType !== 'click') {
          return true;
        }
        if (/^https?:\/\//i.test(req.url)) {
          void Linking.openURL(req.url);
        }
        return false;
      }}
      onMessage={(e) => {
        try {
          const event = JSON.parse(e.nativeEvent.data) as RawMapEvent;
          if (event.type === 'marker') {
            onMarkerPress?.(event.id);
            return;
          }
          if (event.type === 'ready') {
            readyRef.current = true;
            if (markers?.length) {
              web.current?.injectJavaScript(`window.__setMarkers?.(${JSON.stringify(markers)}); true;`);
            }
          }
          onEvent(event);
        } catch {
          // Not ours.
        }
      }}
      javaScriptEnabled
      domStorageEnabled
      scrollEnabled={false}
      overScrollMode="never"
      bounces={false}
      setSupportMultipleWindows={false}
    />
  );
});
