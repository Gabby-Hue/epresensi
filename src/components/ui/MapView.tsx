// Hallmark Component · MapView (Geofence & Precision Radar HUD)
// Anti-AI-slop: Precision geographic HUD, clean radar pulse (redup nyala), crisp hairline boundaries, super zoom enabled.

import React, { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { OfficeSettings } from '../../types/attendance';
import { colors, radius } from '../../theme';

interface MapViewProps {
  userLat: number;
  userLng: number;
  officeLat: number;
  officeLng: number;
  radiusMeters: number;
  /** Semua titik kantor untuk digambar sekaligus (opsional, fallback ke 1 titik di atas). */
  offices?: Pick<OfficeSettings, 'id' | 'officeName' | 'latitude' | 'longitude' | 'radiusMeters' | 'color'>[];
  /** ID titik kantor yang sedang aktif / terpilih (untuk highlight). */
  activeOfficeId?: string | null;
  /** Warna lingkaran + penanda utama (default biru). */
  mainColor?: string;
  height?: number;
  interactivePicker?: boolean;
  onLocationSelect?: (lat: number, lng: number) => void;
}

export const MapView: React.FC<MapViewProps> = ({
  userLat,
  userLng,
  officeLat,
  officeLng,
  radiusMeters,
  offices,
  activeOfficeId,
  mainColor,
  height = 220,
  interactivePicker = false,
  onLocationSelect,
}) => {
  // Web window message listener for Web platform
  useEffect(() => {
    if (Platform.OS === 'web' && interactivePicker && onLocationSelect) {
      const handleWebMessage = (event: MessageEvent) => {
        try {
          const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          if (data && data.type === 'MAP_CLICK') {
            onLocationSelect(data.latitude, data.longitude);
          }
        } catch {
          // Ignore
        }
      };

      window.addEventListener('message', handleWebMessage);
      return () => {
        window.removeEventListener('message', handleWebMessage);
      };
    }
  }, [interactivePicker, onLocationSelect]);

  const rawSpots = (offices && offices.length > 0
    ? offices
    : [{ id: 'single', officeName: 'Titik Kantor', latitude: officeLat, longitude: officeLng, radiusMeters }]
  ).map((o) => ({
    id: String(o.id),
    name: o.officeName.replace(/'/g, ''),
    lat: Number(o.latitude),
    lng: Number(o.longitude),
    rad: Number(o.radiusMeters),
    color: /^#[0-9a-fA-F]{6}$/.test((o as any).color || '') ? (o as any).color : colors.primary,
  }));

  // Deteksi duplikasi koordinat agar tidak menumpuk 100% pada titik yang sama
  const coordCounts: Record<string, number> = {};
  const spots = rawSpots.map((s) => {
    const key = `${s.lat.toFixed(6)},${s.lng.toFixed(6)}`;
    const count = coordCounts[key] || 0;
    coordCounts[key] = count + 1;
    if (count > 0) {
      // Sedikit offset mikro (sekitar 3-5 meter) agar dua titik yang belum disetel posisinya tetap terlihat terpisah
      const angle = (count * 2 * Math.PI) / 6;
      return {
        ...s,
        displayLat: Number((s.lat + 0.00004 * Math.sin(angle)).toFixed(6)),
        displayLng: Number((s.lng + 0.00004 * Math.cos(angle)).toFixed(6)),
        isStacked: true,
      };
    }
    return { ...s, displayLat: s.lat, displayLng: s.lng, isStacked: false };
  });

  const spotsJson = JSON.stringify(spots);
  const activeIdJson = JSON.stringify(activeOfficeId ?? null);
  const main = /^#[0-9a-fA-F]{6}$/.test(mainColor || '') ? (mainColor as string) : colors.primary;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
          .leaflet-control-attribution { font-size: 9px !important; background: rgba(255,255,255,0.8) !important; padding: 2px 6px !important; }
          .leaflet-bar { border-radius: 8px !important; box-shadow: 0 2px 6px rgba(15,23,42,0.18) !important; border: 1px solid #E2E8F0 !important; overflow: hidden; }
          .leaflet-bar a { background-color: #FFFFFF !important; color: #1E293B !important; width: 32px !important; height: 32px !important; line-height: 32px !important; font-size: 16px !important; font-weight: bold !important; }
          .leaflet-bar a:hover { background-color: #F1F5F9 !important; }
          
          /* Calibrated Precision Radar Pulse */
          @keyframes radar-pulse {
            0% { transform: scale(0.6); opacity: 0.9; }
            45% { opacity: 0.35; }
            100% { transform: scale(2.4); opacity: 0; }
          }
          @keyframes radar-core {
            0%, 100% { transform: scale(1); filter: drop-shadow(0 2px 4px rgba(15,23,42,0.2)); }
            50% { transform: scale(1.15); filter: drop-shadow(0 2px 8px rgba(0,97,164,0.45)); }
          }
          
          .user-marker-wrapper { background: transparent; border: none; }
          .user-location-marker {
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 38px;
            height: 38px;
          }
          .user-location-pulse {
            position: absolute;
            width: 38px;
            height: 38px;
            border-radius: 50%;
            background: rgba(0, 97, 164, 0.28);
            animation: radar-pulse 2.2s cubic-bezier(0.2, 0.6, 0.35, 1) infinite;
            pointer-events: none;
          }
          .user-location-pulse-delayed {
            position: absolute;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: rgba(0, 97, 164, 0.2);
            animation: radar-pulse 2.2s cubic-bezier(0.2, 0.6, 0.35, 1) infinite;
            animation-delay: 0.85s;
            pointer-events: none;
          }
          .user-location-core {
            position: relative;
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background: #0061A4;
            border: 2.5px solid #FFFFFF;
            animation: radar-core 2.2s ease-in-out infinite;
            z-index: 2;
          }
          
          /* Target Picker Pin (Khusus Mode Pilih Lokasi Admin) */
          .picker-pin-wrap {
            position: relative;
            width: 32px;
            height: 42px;
            cursor: pointer;
            filter: drop-shadow(0 3px 6px rgba(15, 23, 42, 0.35));
          }
          .picker-pin-pulse {
            position: absolute;
            bottom: 0px;
            left: 7px;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: rgba(234, 88, 12, 0.4);
            animation: radar-pulse 1.8s ease-out infinite;
          }
          
          .zoom-hud-badge {
            position: absolute;
            bottom: 12px;
            right: 12px;
            z-index: 1000;
            background: rgba(255, 255, 255, 0.92);
            backdrop-filter: blur(4px);
            padding: 4px 8px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 700;
            color: #334155;
            border: 1px solid #CBD5E1;
            pointer-events: none;
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <div id="zoom-badge" class="zoom-hud-badge">Zoom: 17x</div>
        <script>
          var oLat = Number(${officeLat}) || -6.2088;
          var oLng = Number(${officeLng}) || 106.8456;
          var uLat = Number(${userLat}) || oLat;
          var uLng = Number(${userLng}) || oLng;
          var rad = Number(${radiusMeters}) || 150;
          var spots = ${spotsJson};
          var activeId = ${activeIdJson};
          var mainC = '${main}';
          var isPicker = ${interactivePicker ? 'true' : 'false'};

          // Konfigurasi Peta dengan SUPER-ZOOM (mendukung hingga zoom 21)
          var map = L.map('map', {
            zoomControl: true,
            minZoom: 3,
            maxZoom: 21,
            scrollWheelZoom: true,
            touchZoom: true,
            doubleClickZoom: true
          }).setView([oLat, oLng], 17);

          // Tile layer dengan overscaling (maxNativeZoom 19, maxZoom 21) untuk detail maksimal
          L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
            minZoom: 3,
            maxNativeZoom: 19,
            maxZoom: 21,
            attribution: '&copy; OpenStreetMap contributors'
          }).addTo(map);

          // Update HUD zoom indicator
          var zoomBadge = document.getElementById('zoom-badge');
          map.on('zoomend', function() {
            if (zoomBadge) zoomBadge.innerText = 'Zoom: ' + map.getZoom() + 'x';
          });
          zoomBadge.innerText = 'Zoom: ' + map.getZoom() + 'x';

          // Geofence Circle untuk titik yang sedang aktif / diedit
          var targetCircle = L.circle([oLat, oLng], {
            color: mainC,
            fillColor: mainC,
            fillOpacity: 0.16,
            weight: 2,
            radius: rad
          }).addTo(map);

          // Marker Target / Titik Terpilih
          // Jika mode interactivePicker: gunakan Pin Penanda Target yang jelas agar tidak mirip spot bulat
          var targetIcon = isPicker
            ? L.divIcon({
                className: 'picker-pin-wrapper',
                html: '<div class="picker-pin-wrap">' +
                        '<div class="picker-pin-pulse"></div>' +
                        '<svg width="32" height="42" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg">' +
                          '<path d="M16 0C7.16344 0 0 7.16344 0 16C0 26.5 14.5 40.5 15.3 41.3C15.7 41.7 16.3 41.7 16.7 41.3C17.5 40.5 32 26.5 32 16C32 7.16344 24.8366 0 16 0Z" fill="' + mainC + '"/>' +
                          '<circle cx="16" cy="16" r="6.5" fill="#FFFFFF"/>' +
                        '</svg>' +
                      '</div>',
                iconSize: [32, 42],
                iconAnchor: [16, 42],
                popupAnchor: [0, -42]
              })
            : L.divIcon({
                className: 'office-icon',
                html: '<div style="width:18px;height:18px;border-radius:50%;background:' + mainC + ';border:2.5px solid #FFFFFF;box-shadow:0 2px 6px rgba(15,23,42,0.35);"></div>',
                iconSize: [18, 18],
                iconAnchor: [9, 9]
              });

          var targetMarker = L.marker([oLat, oLng], { icon: targetIcon, zIndexOffset: 1000 }).addTo(map);
          targetMarker.bindPopup("<b>" + (isPicker ? "Titik Terpilih (Geser/Ketuk Peta)" : "Titik Kantor Utama") + "</b>");

          // RENDER TITIK-TITIK KANTOR LAINNYA
          // KUNCI PERBAIKAN: Jika titik kantor ini adalah titik yang sedang diedit (activeId) ATAU koordinatnya sama persis dengan oLat,oLng,
          // JANGAN dirender lagi agar tidak ada marker ganda yang saling menumpuk!
          try {
            var spotIcon = function(c) {
              return L.divIcon({
                className: 'spot-icon',
                html: '<div style="width:14px;height:14px;border-radius:50%;background:' + c + ';border:2px solid #FFFFFF;box-shadow:0 1px 4px rgba(15,23,42,0.25);"></div>',
                iconSize: [14, 14],
                iconAnchor: [7, 7]
              });
            };

            spots.forEach(function(s) {
              // Jika ini adalah spot yang sedang aktif/diedit, lewati karena posisinya sudah diwakili oleh targetMarker & targetCircle
              var isCurrentTarget = (activeId && s.id === activeId) || (Math.abs(s.lat - oLat) < 0.000005 && Math.abs(s.lng - oLng) < 0.000005);
              if (isCurrentTarget) {
                targetMarker.bindTooltip(s.name, { permanent: false, direction: 'top' });
                return; // STOP! Jangan buat marker kedua di titik yang sama
              }

              var sc = (/^#[0-9a-fA-F]{6}$/.test(s.color || '') ? s.color : '#0061A4');
              var lat = s.displayLat || s.lat;
              var lng = s.displayLng || s.lng;

              // Lingkaran radius spot kantor lain
              L.circle([lat, lng], {
                color: sc,
                fillColor: sc,
                fillOpacity: 0.10,
                weight: 1,
                radius: s.rad || rad,
              }).addTo(map);

              // Marker spot kantor lain
              var sm = L.marker([lat, lng], { icon: spotIcon(sc) }).addTo(map);
              sm.bindTooltip(s.name + (s.isStacked ? " (Posisi berdekatan)" : ""), { permanent: false, direction: 'top' });
              
              sm.on('click', function() {
                map.flyTo([lat, lng], 19, { animate: true, duration: 0.8 });
              });
            });
          } catch(e) {}

          // User Marker (Animated Pulsing Radar Point) — hanya jika bukan picker murni atau lokasi user beda
          if (!isPicker || (Math.abs(uLat - oLat) > 0.0001 || Math.abs(uLng - oLng) > 0.0001)) {
            var userIcon = L.divIcon({
              className: 'user-marker-wrapper',
              html: '<div class="user-location-marker">' +
                      '<div class="user-location-pulse"></div>' +
                      '<div class="user-location-pulse-delayed"></div>' +
                      '<div class="user-location-core"></div>' +
                    '</div>',
              iconSize: [38, 38],
              iconAnchor: [19, 19],
              popupAnchor: [0, -19]
            });
            var userMarker = L.marker([uLat, uLng], { icon: userIcon, zIndexOffset: 500 }).addTo(map);
            userMarker.bindPopup("<b>Posisi Anda Saat Ini</b>");
          }

          ${
            interactivePicker
              ? `
          // Interactive Click Listener to Pick Office Location
          map.on('click', function(e) {
            var lat = Number(e.latlng.lat.toFixed(6));
            var lng = Number(e.latlng.lng.toFixed(6));

            targetMarker.setLatLng([lat, lng]);
            targetCircle.setLatLng([lat, lng]);

            var payload = JSON.stringify({ type: 'MAP_CLICK', latitude: lat, longitude: lng });

            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(payload);
            } else if (window.parent) {
              window.parent.postMessage(payload, '*');
            }
          });
          `
              : ''
          }

          // Otomatis fokus: jika mode picker atau ada activeId, langsung fokus zoom ke titik tersebut
          try {
            if (isPicker || activeId) {
              map.setView([oLat, oLng], 17);
            } else {
              var bounds = [[uLat, uLng], [oLat, oLng]];
              spots.forEach(function(s) { bounds.push([s.lat, s.lng]); });
              map.fitBounds(bounds, { padding: [28, 28], maxZoom: 18 });
            }
          } catch(e) {
            map.setView([oLat, oLng], 17);
          }
        </script>
      </body>
    </html>
  `;

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, { height }]}>
        <iframe
          srcDoc={htmlContent}
          style={{ width: '100%', height: '100%', border: 'none', borderRadius: radius.md }}
          title="Interactive Map"
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        originWhitelist={['*']}
        source={{ html: htmlContent }}
        style={{ flex: 1, borderRadius: radius.md }}
        scrollEnabled={false}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data && data.type === 'MAP_CLICK' && onLocationSelect) {
              onLocationSelect(data.latitude, data.longitude);
            }
          } catch {
            // Ignore
          }
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
  },
});
