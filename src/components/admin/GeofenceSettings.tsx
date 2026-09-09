import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { OfficeSettings } from '../../types/attendance';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { MapView } from '../ui/MapView';
import { getCurrentLocation } from '../../services/locationService';
import { colors, fontSize, radius } from '../../theme';

interface GeofenceSettingsProps {
  settings: OfficeSettings;
  onSave: (newSettings: Partial<OfficeSettings>) => Promise<void>;
}

export const GeofenceSettings: React.FC<GeofenceSettingsProps> = ({
  settings,
  onSave,
}) => {
  const [officeName, setOfficeName] = useState(settings.officeName);
  const [latitude, setLatitude] = useState(settings.latitude.toString());
  const [longitude, setLongitude] = useState(settings.longitude.toString());
  const [radiusMeters, setRadiusMeters] = useState(settings.radiusMeters.toString());
  const [saving, setSaving] = useState(false);
  const [fetchingGps, setFetchingGps] = useState(false);

  // Sync state whenever settings prop updates
  useEffect(() => {
    if (settings) {
      setOfficeName(settings.officeName);
      setLatitude(settings.latitude.toString());
      setLongitude(settings.longitude.toString());
      setRadiusMeters(settings.radiusMeters.toString());
    }
  }, [settings]);

  const latNum = parseFloat(latitude) || settings.latitude;
  const lngNum = parseFloat(longitude) || settings.longitude;
  const radNum = parseInt(radiusMeters, 10) || settings.radiusMeters;

  const handleUseCurrentGps = async () => {
    setFetchingGps(true);
    const { coords, errorMsg } = await getCurrentLocation();
    setFetchingGps(false);

    if (errorMsg) {
      Alert.alert('GPS', errorMsg);
    }

    setLatitude(coords.latitude.toFixed(6));
    setLongitude(coords.longitude.toFixed(6));
  };

  const handleMapLocationSelect = (selectedLat: number, selectedLng: number) => {
    setLatitude(selectedLat.toFixed(6));
    setLongitude(selectedLng.toFixed(6));
  };

  const handleSave = async () => {
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const rad = parseInt(radiusMeters, 10);

    if (isNaN(lat) || isNaN(lng) || isNaN(rad) || rad <= 0) {
      Alert.alert('Tidak valid', 'Periksa lat, lng, dan radius.');
      return;
    }

    setSaving(true);
    await onSave({
      officeName,
      latitude: lat,
      longitude: lng,
      radiusMeters: rad,
    });
    setSaving(false);

    Alert.alert('Berhasil', 'Lokasi tersimpan.');
  };

  return (
    <Card
      title="Lokasi Kantor"
      icon="map-pin"
    >
      {/* Interactive Map Picker Section */}
      <View style={styles.mapPickerBox}>
        <MapView
          userLat={latNum}
          userLng={lngNum}
          officeLat={latNum}
          officeLng={lngNum}
          radiusMeters={radNum}
          height={240}
          interactivePicker={true}
          onLocationSelect={handleMapLocationSelect}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Nama</Text>
        <TextInput
          style={styles.input}
          value={officeName}
          onChangeText={setOfficeName}
          placeholder="Kantor Utama"
        />
      </View>

      <View style={styles.row}>
        <View style={[styles.formGroup, { flex: 1, marginRight: 6 }]}>
          <Text style={styles.label}>Lat</Text>
          <TextInput
            style={styles.input}
            value={latitude}
            onChangeText={setLatitude}
            keyboardType="numeric"
            placeholder="-6.2088"
          />
        </View>
        <View style={[styles.formGroup, { flex: 1, marginLeft: 6 }]}>
          <Text style={styles.label}>Lng</Text>
          <TextInput
            style={styles.input}
            value={longitude}
            onChangeText={setLongitude}
            keyboardType="numeric"
            placeholder="106.8456"
          />
        </View>
      </View>

      <Button
        title={fetchingGps ? 'Mengambil GPS...' : 'Pakai GPS saat ini'}
        variant="outline"
        icon="crosshair"
        loading={fetchingGps}
        onPress={handleUseCurrentGps}
        style={styles.gpsBtn}
      />

      <View style={styles.formGroup}>
        <Text style={styles.label}>Radius (m)</Text>
        <View style={styles.radiusRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={radiusMeters}
            onChangeText={setRadiusMeters}
            keyboardType="numeric"
            placeholder="150"
          />
          <View style={styles.unitBox}>
            <Text style={styles.unitText}>m</Text>
          </View>
        </View>
      </View>

      <Button
        title={saving ? 'Menyimpan...' : 'Simpan'}
        variant="primary"
        icon="save"
        loading={saving}
        onPress={handleSave}
      />
    </Card>
  );
};

const styles = StyleSheet.create({
  mapPickerBox: {
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 4,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: fontSize.sm,
    color: colors.ink,
    minHeight: 56,
  },
  row: {
    flexDirection: 'row',
  },
  gpsBtn: {
    marginBottom: 12,
  },
  radiusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unitBox: {
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopRightRadius: radius.sm,
    borderBottomRightRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 0,
  },
  unitText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.ink,
  },
});
