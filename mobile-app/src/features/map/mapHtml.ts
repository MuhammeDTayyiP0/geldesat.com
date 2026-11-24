import { API_BASE_URL } from '@/lib/config';
import { TILE_ATTRIBUTION, TILE_URL } from './tiles';

export type MapCenter = { lat: number; lng: number; zoom: number };

export type MapBounds = { north: number; south: number; east: number; west: number };

export type MapMarker = { id: string; lat: number; lng: number; label: string; badge?: string };

/** Messages the map page sends back. */
export type MapEvent =
  | { type: 'movestart' }
  | ({ type: 'moveend'; bounds?: MapBounds } & MapCenter)
  | { type: 'ready'; bounds?: MapBounds };

/**
 * A full-page Leaflet map for a WebView / iframe. It reports pans with
 * `movestart` / `moveend` and exposes `window.__fly(lat, lng, zoom)` and
 * `window.__setMarkers(markers)`.
 */
export function mapHtml(initial: MapCenter, dark: boolean): string {
  return `<!doctype html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="stylesheet" href="${API_BASE_URL}/vendor/leaflet/leaflet.css">
<style>
  html,body,#map{margin:0;padding:0;height:100%;width:100%;background:${dark ? '#0b0e13' : '#e9edf2'}}
  .leaflet-control-attribution{font-size:9px}
  .gd-marker{display:inline-flex;align-items:center;justify-content:center;min-width:28px;height:26px;padding:0 7px;border-radius:999px;background:#1a4fd8;color:#fff;font:700 11px/1 sans-serif;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.28);white-space:nowrap;cursor:pointer}
  ${dark ? '.leaflet-tile-pane{filter:brightness(.72) contrast(1.1) saturate(.85)}' : ''}
</style>
</head><body>
<div id="map"></div>
<script src="${API_BASE_URL}/vendor/leaflet/leaflet.js" onerror="document.body.innerHTML='<p style=&quot;font:14px sans-serif;color:#888;text-align:center;margin-top:40%&quot;>Harita yüklenemedi. İnternet bağlantınızı kontrol edin.</p>'"></script>
<script>
  (function(){
    if (typeof L === 'undefined') return;
    function post(msg){
      var s = JSON.stringify(msg);
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(s);
      else if (window.parent !== window) window.parent.postMessage({ __geldesatMap: true, data: s }, '*');
    }
    function getBounds(){
      var b = map.getBounds();
      return { north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() };
    }
    var map = L.map('map', { zoomControl: false, attributionControl: true })
      .setView([${initial.lat}, ${initial.lng}], ${initial.zoom});
    L.tileLayer('${TILE_URL}', { maxZoom: 19,
      attribution: '${TILE_ATTRIBUTION.replace(/'/g, "\\'")}' }).addTo(map);
    var layer = L.layerGroup().addTo(map);
    function esc(t){ return String(t).replace(/[&<>"']/g, function(ch){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]; }); }
    window.__setMarkers = function(list){
      layer.clearLayers();
      if (!Array.isArray(list)) return;
      for (var i = 0; i < list.length; i++){
        (function(m){
          var text = m.badge != null ? m.badge : m.label;
          var icon = L.divIcon({ className: '', html: '<span class="gd-marker">' + esc(text) + '</span>', iconSize: [32, 26], iconAnchor: [16, 13] });
          L.marker([m.lat, m.lng], { icon: icon, title: m.label, alt: m.label })
            .addTo(layer)
            .on('click', function(){ post({ type: 'marker', id: m.id }); });
        })(list[i]);
      }
    };
    map.on('movestart', function(){ post({ type: 'movestart' }); });
    map.on('moveend', function(){ var c = map.getCenter(); post({ type: 'moveend', lat: c.lat, lng: c.lng, zoom: map.getZoom(), bounds: getBounds() }); });
    window.__fly = function(lat, lng, zoom){ map.flyTo([lat, lng], zoom || 17, { duration: 0.8 }); };
    post({ type: 'ready', bounds: getBounds() });
  })();
</script>
</body></html>`;
}
