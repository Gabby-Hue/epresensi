import React, { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

interface MapViewProps {
  userLat: number;
  userLng: number;
  officeLat: number;
  officeLng: number;
  radiusMeters: number;
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

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background: #f8fafc; }
          .user-icon { background: #0284c7; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 8px rgba(2, 132, 199, 0.7); }
          .office-icon { background: #0f172a; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 8px rgba(15, 23, 42, 0.7); }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var map = L.map('map', { zoomControl: false }).setView([${officeLat}, ${officeLng}], 16);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: 'OpenStreetMap'
          }).addTo(map);

          // Geofence Circle
          var circle = L.circle([${officeLat}, ${officeLng}], {
            color: '#0f172a',
            fillColor: '#64748b',
            fillOpacity: 0.2,
            radius: ${radiusMeters}
          }).addTo(map);

          // Office Marker
          var officeIcon = L.divIcon({ className: 'office-icon', iconSize: [16, 16] });
          var officeMarker = L.marker([${officeLat}, ${officeLng}], { icon: officeIcon }).addTo(map).bindPopup("<b>Titik Kantor</b>");

          // User Marker
          var userIcon = L.divIcon({ className: 'user-icon', iconSize: [16, 16] });
          L.marker([${userLat}, ${userLng}], { icon: userIcon }).addTo(map).bindPopup("<b>Lokasi Anda</b>");

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

          // Fit map bounds
          var group = new L.featureGroup([
            L.marker([${officeLat}, ${officeLng}]),
            L.marker([${userLat}, ${userLng}])
          ]);
          map.fitBounds(group.getBounds().pad(0.2));
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
    borderColor: '#E3E1DD',
    backgroundColor: '#F7F6F3',
  },
});
