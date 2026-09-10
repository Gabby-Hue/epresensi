import React, { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { OfficeSettings } from '../../types/attendance';

interface MapViewProps {
  userLat: number;
  userLng: number;
  officeLat: number;
  officeLng: number;
  radiusMeters: number;
  /** Semua titik kantor untuk digambar sekaligus (opsional, fallback ke 1 titik di atas). */
  offices?: Pick<OfficeSettings, 'id' | 'officeName' | 'latitude' | 'longitude' | 'radiusMeters'>[];
  /** Nama titik yang sedang aktif / terpilih (untuk highlight). */
  activeOfficeId?: string | null;
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
  }));
  const spotsJson = JSON.stringify(spots);
  const activeIdJson = JSON.stringify(activeOfficeId ?? null);

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background: #eaf2fb; }
          .user-icon { background: #2196F3; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 8px rgba(33, 150, 243, 0.7); }
          .office-icon { background: #1565C0; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 8px rgba(21, 101, 192, 0.7); }
          .spot-icon { background: #7FB8EC; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 6px rgba(33, 150, 243, 0.5); }
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

          // Batasi zoom out minimal level 10 (area regional) agar tidak bisa ke skala benua/dunia
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
            color: '#2196F3',
            fillColor: '#2196F3',
            fillOpacity: 0.25,
            radius: rad
          }).addTo(map);

          // Office Marker (titik utama / terpilih)
          var officeIcon = L.divIcon({ className: 'office-icon', iconSize: [18, 18] });
          var officeMarker = L.marker([oLat, oLng], { icon: officeIcon }).addTo(map).bindPopup("<b>Titik Kantor</b>");

          // Semua titik kantor: lingkaran + penanda + nama
          try {
            var spotIcon = function(isActive) {
              return L.divIcon({
                className: isActive ? 'office-icon' : 'spot-icon',
                iconSize: [14, 14],
              });
            };
            spots.forEach(function(s) {
              var isActive = activeId && s.id === activeId;
              L.circle([s.lat, s.lng], {
                color: isActive ? '#EA580C' : '#2196F3',
                fillColor: isActive ? '#EA580C' : '#2196F3',
                fillOpacity: isActive ? 0.3 : 0.18,
                radius: s.rad || rad,
              }).addTo(map);
              L.marker([s.lat, s.lng], { icon: spotIcon(isActive) })
                .addTo(map)
                .bindTooltip(s.name, { permanent: false, direction: 'top' });
            });
          } catch(e) {}

          // User Marker
          var userIcon = L.divIcon({ className: 'user-icon', iconSize: [18, 18] });
          var userMarker = L.marker([uLat, uLng], { icon: userIcon }).addTo(map).bindPopup("<b>Lokasi Anda</b>");

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
            map.fitBounds(bounds, { padding: [30, 30], maxZoom: 17 });
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
          style={{ width: '100%', height: '100%', border: 'none', borderRadius: 12 }}
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
        style={{ flex: 1, borderRadius: 12 }}
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
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#DFE9F4',
    backgroundColor: '#F4F7FD',
  },
});
