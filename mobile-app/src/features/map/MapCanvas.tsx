import { forwardRef, useImperativeHandle, useMemo, useRef, type ComponentType, type Ref } from 'react';
import { StyleSheet } from 'react-native';
import { WebView as RNWebView, type WebViewProps } from 'react-native-webview';
import { mapHtml, type MapCenter, type MapEvent } from './mapHtml';

export type MapCanvasHandle = { flyTo: (lat: number, lng: number, zoom?: number) => void };

type Props = { initial: MapCenter; dark: boolean; onEvent: (event: MapEvent) => void };

type WebViewHandle = { injectJavaScript: (script: string) => void };
// The package's class typings do not fit React 19.3's JSX types; describe what is used.
const WebView = RNWebView as unknown as ComponentType<WebViewProps & { ref?: Ref<WebViewHandle> }>;

/** Interactive map (Leaflet in a WebView); the web build uses MapCanvas.web.tsx. */
export const MapCanvas = forwardRef<MapCanvasHandle, Props>(function MapCanvas({ initial, dark, onEvent }, ref) {
  const web = useRef<WebViewHandle>(null);
  // Built once: re-creating the page would reset the map.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const html = useMemo(() => mapHtml(initial, dark), []);
  useImperativeHandle(ref, () => ({
    flyTo: (lat, lng, zoom = 17) => web.current?.injectJavaScript(`window.__fly(${lat}, ${lng}, ${zoom}); true;`),
  }));
  return (
    <WebView
      ref={web}
      source={{ html, baseUrl: 'https://www.geldesat.com' }}
      originWhitelist={['*']}
      style={StyleSheet.absoluteFill}
      onMessage={(e) => {
        try {
          onEvent(JSON.parse(e.nativeEvent.data) as MapEvent);
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
