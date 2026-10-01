// Hallmark Component · MapView (Geofence & Precision Radar HUD)
// Anti-AI-slop: Precision geographic HUD, clean radar pulse (redup nyala), crisp hairline boundaries.

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
  /** Nama titik yang sedang aktif / terpilih (untuk highlight). */
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

  const spots = (offices && offices.length > 0
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
  const spotsJson = JSON.stringify(spots);
  const activeIdJson = JSON.stringify(activeOfficeId ?? null);
  const main = /^#[0-9a-fA-F]{6}$/.test(mainColor || '') ? mainColor as string : colors.primary;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
          .leaflet-control-attribution { font-size: 9px !important; background: rgba(255,255,255,0.7) !important; padding: 2px 6px !important; }
          
          /* Calibrated Precision Radar Pulse (Redup Nyala) */
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
          .office-icon {
            background: #0061A4;
            border: 2px solid #FFFFFF;
            border-radius: 50%;
            box-shadow: 0 2px 6px rgba(15, 23, 42, 0.25);
          }
          .spot-icon {
            background: #38BDF8;
            border: 2px solid #FFFFFF;
            border-radius: 50%;
            box-shadow: 0 1px 4px rgba(15, 23, 42, 0.2);
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var oLat = Number(${officeLat}) || -6.2088;
          var oLng = Number(${officeLng}) || 106.8456;
          var uLat = Number(${userLat}) || oLat;
          var uLng = Number(${userLng}) || oLng;
          var rad = Number(${radiusMeters}) || 150;
          var spots = ${spotsJson};
          var activeId = ${activeIdJson};
          var mainC = '${main}';

          var map = L.map('map', {
            zoomControl: false,
            minZoom: 10,
            maxZoom: 19
          }).setView([oLat, oLng], 16);

          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            minZoom: 10,
            maxZoom: 19,
            attribution: 'OpenStreetMap'
          }).addTo(map);

          // Geofence Circle (titik utama / terpilih)
          var circle = L.circle([oLat, oLng], {
            color: mainC,
            fillColor: mainC,
            fillOpacity: 0.16,
            weight: 1.5,
            radius: rad
          }).addTo(map);

          // Office Marker (titik utama / terpilih)
          var officeIcon = L.divIcon({
            className: 'office-icon',
            html: '<div style="width:16px;height:16px;border-radius:50%;background:' + mainC + ';border:2px solid #FFFFFF;box-shadow:0 1px 5px rgba(15,23,42,0.3);"></div>',
            iconSize: [16, 16]
          });
          var officeMarker = L.marker([oLat, oLng], { icon: officeIcon }).addTo(map).bindPopup("<b>Titik Kantor</b>");

          // Semua titik kantor: lingkaran + penanda + nama
          try {
            var spotIcon = function(isActive, color) {
              var c = (/^#[0-9a-fA-F]{6}$/.test(color || '') ? color : '#0061A4');
              if (isActive) {
                return L.divIcon({
                  className: 'office-icon',
                  iconSize: [16, 16],
                });
              }
              return L.divIcon({
                className: 'spot-icon',
                html: '<div style="width:12px;height:12px;border-radius:50%;background:' + c + ';border:2px solid #FFFFFF;box-shadow:0 1px 4px rgba(15,23,42,0.2);"></div>',
                iconSize: [12, 12],
              });
            };
            spots.forEach(function(s) {
              var isActive = activeId && s.id === activeId;
              var sc = (/^#[0-9a-fA-F]{6}$/.test(s.color || '') ? s.color : '#0061A4');
              var isMainSpot = isActive || (s.lat === oLat && s.lng === oLng);
              if (!isMainSpot) {
                L.circle([s.lat, s.lng], {
                  color: sc,
                  fillColor: sc,
                  fillOpacity: 0.12,
                  weight: 1,
                  radius: s.rad || rad,
                }).addTo(map);
              }
              L.marker([s.lat, s.lng], { icon: spotIcon(isActive, sc) })
                .addTo(map)
                .bindTooltip(s.name, { permanent: false, direction: 'top' });
            });
          } catch(e) {}

          // User Marker (Animated Pulsing Radar Point)
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
          var userMarker = L.marker([uLat, uLng], { icon: userIcon }).addTo(map).bindPopup("<b>Posisi Anda Saat Ini</b>");

          ${
            interactivePicker
              ? `
          // Interactive Click Listener to Pick Office Location
          map.on('click', function(e) {
            var lat = Number(e.latlng.lat.toFixed(6));
            var lng = Number(e.latlng.lng.toFixed(6));

            officeMarker.setLatLng([lat, lng]);
            circle.setLatLng([lat, lng]);

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

          // Otomatis fokus: mencakup user + semua titik kantor
          try {
            var bounds = [[uLat, uLng], [oLat, oLng]];
            spots.forEach(function(s) { bounds.push([s.lat, s.lng]); });
            map.fitBounds(bounds, { padding: [28, 28], maxZoom: 17 });
          } catch(e) {
            map.setView([oLat, oLng], 16);
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
