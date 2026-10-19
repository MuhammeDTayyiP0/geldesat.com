import { TILE_ATTRIBUTION, TILE_SUBDOMAINS, TILE_URL } from './tiles';

export type MapCenter = { lat: number; lng: number; zoom: number };

/** Messages the map page sends back. */
export type MapEvent = { type: 'movestart' } | ({ type: 'moveend' } & MapCenter) | { type: 'ready' };

/**
 * A full-page Leaflet map for a WebView / iframe. It reports pans with
 * `movestart` / `moveend` and exposes `window.__fly(lat, lng, zoom)`.
 * The pin is drawn by the app over the map, so the map itself has no markers.
 */
export function mapHtml(initial: MapCenter, dark: boolean): string {
  return `<!doctype html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
  html,body,#map{margin:0;padding:0;height:100%;width:100%;background:${dark ? '#0b0e13' : '#e9edf2'}}
  .leaflet-control-attribution{font-size:9px}
  ${dark ? '.leaflet-tile-pane{filter:brightness(.72) contrast(1.1) saturate(.85)}' : ''}
</style>
</head><body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  function post(msg){
    var s = JSON.stringify(msg);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(s);
    else if (window.parent !== window) window.parent.postMessage({ __geldesatMap: true, data: s }, '*');
  }
  var map = L.map('map', { zoomControl: false, attributionControl: true })
    .setView([${initial.lat}, ${initial.lng}], ${initial.zoom});
  L.tileLayer('${TILE_URL}', { subdomains: '${TILE_SUBDOMAINS}', maxZoom: 19, detectRetina: true,
    attribution: '${TILE_ATTRIBUTION.replace(/'/g, "\\'")}' }).addTo(map);
  map.on('movestart', function(){ post({ type: 'movestart' }); });
  map.on('moveend', function(){ var c = map.getCenter(); post({ type: 'moveend', lat: c.lat, lng: c.lng, zoom: map.getZoom() }); });
  window.__fly = function(lat, lng, zoom){ map.flyTo([lat, lng], zoom || 17, { duration: 0.8 }); };
  post({ type: 'ready' });
</script>
</body></html>`;
}
