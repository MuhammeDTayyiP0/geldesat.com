import { API_BASE_URL } from '@/lib/config';
import { TILE_ATTRIBUTION, TILE_URL } from './tiles';

export type MapCenter = { lat: number; lng: number; zoom: number };

export type MapBounds = { north: number; south: number; east: number; west: number };

export type MapMarker = { id: string; lat: number; lng: number; label: string; badge?: string };

/** Messages the map page sends back. */
export type MapEvent =
  | { type: 'movestart' }
  | ({ type: 'moveend'; bounds?: MapBounds } & MapCenter)
  | { type: 'ready'; bounds?: MapBounds; zoom?: number };

export type MarkerRenderOpts = { cluster?: boolean; selectedId?: string | null };

/**
 * A full-page Leaflet map for a WebView / iframe. It reports pans with
 * `movestart` / `moveend` and exposes `window.__fly(lat, lng, zoom)`,
 * `window.__setTheme(dark)`, and `window.__setMarkers(markers, opts)`.
 */
export function mapHtml(initial: MapCenter, dark: boolean): string {
  return `<!doctype html>
<html class="${dark ? 'dark-map' : ''}"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="stylesheet" href="${API_BASE_URL}/vendor/leaflet/leaflet.css">
<style>
  html,body,#map{margin:0;padding:0;height:100%;width:100%;background:#e9edf2}
  html.dark-map,html.dark-map body,html.dark-map #map{background:#0b0e13}
  .dark-map .leaflet-tile-pane{filter:brightness(.88) invert(1) contrast(.95) hue-rotate(195deg) saturate(.55)}
  .leaflet-control-attribution{font-size:9px}
  .gd-marker{display:inline-flex;align-items:center;justify-content:center;min-width:28px;height:26px;padding:0 7px;border-radius:999px;background:#1a4fd8;color:#fff;font:700 11px/1 sans-serif;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.28);white-space:nowrap;cursor:pointer}
  .gd-pin{display:inline-flex;align-items:center;justify-content:center;height:26px;padding:0 9px;border-radius:999px;background:#fff;color:#0d1117;font:600 11px/1 sans-serif;border:1px solid rgba(15,23,42,.18);box-shadow:0 2px 6px rgba(0,0,0,.22);white-space:nowrap;cursor:pointer}
  .dark-map .gd-pin{background:#171d27;color:#f3f5f8;border-color:rgba(255,255,255,.18)}
  .gd-pin-active{background:#1a4fd8!important;color:#fff!important;border-color:#1a4fd8!important;font-weight:700;box-shadow:0 4px 10px rgba(26,79,216,.38)}
  .gd-cluster{display:inline-flex;align-items:center;justify-content:center;min-width:34px;height:34px;padding:0 8px;border-radius:999px;background:#1a4fd8;color:#fff;font:700 12px/1 sans-serif;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3);white-space:nowrap;cursor:pointer}
  .gd-cluster-active{box-shadow:0 0 0 3px rgba(26,79,216,.45),0 4px 10px rgba(0,0,0,.35)}
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
    var lastList = [];
    var lastOpts = {};
    function esc(t){ return String(t).replace(/[&<>"']/g, function(ch){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]; }); }
    window.__setTheme = function(isDark){
      document.documentElement.classList.toggle('dark-map', !!isDark);
    };
    function renderMarkers(){
      layer.clearLayers();
      if (!Array.isArray(lastList) || !lastList.length) return;
      if (!lastOpts || !lastOpts.cluster) {
        for (var i = 0; i < lastList.length; i++){
          (function(m){
            var text = m.badge != null ? m.badge : m.label;
            var icon = L.divIcon({ className: '', html: '<span class="gd-marker">' + esc(text) + '</span>', iconSize: [32, 26], iconAnchor: [16, 13] });
            L.marker([m.lat, m.lng], { icon: icon, title: m.label, alt: m.label })
              .addTo(layer)
              .on('click', function(){ post({ type: 'marker', id: m.id }); });
          })(lastList[i]);
        }
        return;
      }
      var zoom = map.getZoom();
      var step = zoom >= 15 ? 0.0015 : 360 / Math.pow(2, zoom + 3);
      var selectedId = lastOpts.selectedId || null;
      var buckets = Object.create(null);
      var bucketKeys = [];
      for (var k = 0; k < lastList.length; k++){
        var p = lastList[k];
        if (typeof p.lat !== 'number' || typeof p.lng !== 'number') continue;
        var key = Math.floor(p.lat / step) + ':' + Math.floor(p.lng / step);
        if (!buckets[key]) { buckets[key] = []; bucketKeys.push(key); }
        buckets[key].push(p);
      }
      for (var b = 0; b < bucketKeys.length; b++){
        (function(items){
          if (items.length === 1) {
            var m = items[0];
            var active = m.id === selectedId;
            var label = m.badge != null ? m.badge : m.label;
            var cls = active ? 'gd-pin gd-pin-active' : 'gd-pin';
            var icon = L.divIcon({ className: '', html: '<span class="' + cls + '">' + esc(label) + '</span>', iconSize: [0, 0], iconAnchor: [0, 13] });
            L.marker([m.lat, m.lng], { icon: icon, title: m.label, alt: m.label, zIndexOffset: active ? 500 : 0 })
              .addTo(layer)
              .on('click', function(){ post({ type: 'marker', id: m.id }); });
            return;
          }
          var sumLat = 0, sumLng = 0, minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity, containsSelected = false;
          for (var j = 0; j < items.length; j++){
            var it = items[j];
            sumLat += it.lat; sumLng += it.lng;
            if (it.lat < minLat) minLat = it.lat;
            if (it.lat > maxLat) maxLat = it.lat;
            if (it.lng < minLng) minLng = it.lng;
            if (it.lng > maxLng) maxLng = it.lng;
            if (it.id === selectedId) containsSelected = true;
          }
          var avgLat = sumLat / items.length;
          var avgLng = sumLng / items.length;
          var spread = (maxLat - minLat > 0.0005) || (maxLng - minLng > 0.0005);
          var cCls = containsSelected ? 'gd-cluster gd-cluster-active' : 'gd-cluster';
          var cIcon = L.divIcon({ className: '', html: '<span class="' + cCls + '">' + items.length + '</span>', iconSize: [34, 34], iconAnchor: [17, 17] });
          L.marker([avgLat, avgLng], { icon: cIcon, title: items.length + ' ilan', alt: items.length + ' ilan' })
            .addTo(layer)
            .on('click', function(){
              if (spread && zoom < 15) {
                map.setView([avgLat, avgLng], Math.min(15, zoom + 2));
              } else {
                var idx = -1;
                for (var s = 0; s < items.length; s++) if (items[s].id === selectedId) { idx = s; break; }
                var next = items[(idx + 1) % items.length];
                if (next) post({ type: 'marker', id: next.id });
              }
            });
        })(buckets[bucketKeys[b]]);
      }
    }
    window.__setMarkers = function(list, opts){
      lastList = Array.isArray(list) ? list : [];
      lastOpts = opts || {};
      renderMarkers();
    };
    map.on('movestart', function(){ post({ type: 'movestart' }); });
    map.on('moveend', function(){ var c = map.getCenter(); post({ type: 'moveend', lat: c.lat, lng: c.lng, zoom: map.getZoom(), bounds: getBounds() }); });
    map.on('zoomend', function(){ if (lastOpts && lastOpts.cluster && lastList.length) renderMarkers(); });
    window.__fly = function(lat, lng, zoom){ map.flyTo([lat, lng], zoom || 17, { duration: 0.8 }); };
    post({ type: 'ready', bounds: getBounds(), zoom: map.getZoom() });
  })();
</script>
</body></html>`;
}
