import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { OfficeSettings } from '../../types/attendance';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { MapView } from '../ui/MapView';
import { getCurrentLocation } from '../../services/locationService';
import { Feather } from '@expo/vector-icons';
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
      Alert.alert('Info Lokasi', errorMsg);
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
      Alert.alert('Input Tidak Valid', 'Mohon isi latitude, longitude, dan radius yang valid.');
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

    Alert.alert('Berhasil', 'Titik presensi & radius kantor berhasil disimpan ke Supabase!');
  };

  return (
    <Card
      title="Pengaturan Titik & Radius Absensi"
      subtitle="Klik pada peta di bawah atau isi koordinat untuk memilih lokasi kantor"
      icon="map-pin"
    >
      {/* Interactive Map Picker Section */}
      <View style={styles.mapPickerBox}>
        <View style={styles.pickerGuideBanner}>
          <Feather name="mouse-pointer" size={14} color={colors.ink} style={{ marginRight: 6 }} />
          <Text style={styles.pickerGuideText}>
            PILIH LOKASI: Klik/Ketuk mana saja pada peta untuk menentukan titik kantor
          </Text>
        </View>

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
        <Text style={styles.label}>Nama Kantor / Lokasi:</Text>
        <TextInput
          style={styles.input}
          value={officeName}
          onChangeText={setOfficeName}
          placeholder="Nama Kantor Utama"
        />
      </View>

      <View style={styles.row}>
        <View style={[styles.formGroup, { flex: 1, marginRight: 6 }]}>
          <Text style={styles.label}>Latitude:</Text>
          <TextInput
            style={styles.input}
            value={latitude}
            onChangeText={setLatitude}
            keyboardType="numeric"
            placeholder="-6.2088"
          />
        </View>
        <View style={[styles.formGroup, { flex: 1, marginLeft: 6 }]}>
          <Text style={styles.label}>Longitude:</Text>
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
        title={fetchingGps ? 'Mengambil GPS...' : 'Gunakan Koordinat GPS Perangkat'}
        variant="outline"
        icon="crosshair"
        loading={fetchingGps}
        onPress={handleUseCurrentGps}
        style={styles.gpsBtn}
      />

      <View style={styles.formGroup}>
        <Text style={styles.label}>Radius Absensi Luring (Meter):</Text>
        <View style={styles.radiusRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={radiusMeters}
            onChangeText={setRadiusMeters}
            keyboardType="numeric"
            placeholder="150"
          />
          <View style={styles.unitBox}>
            <Text style={styles.unitText}>Meter</Text>
          </View>
        </View>
        <Text style={styles.helpText}>
          Karyawan harus berada maksimal {radiusMeters || 0} meter dari titik koordinat di atas untuk absen Luring.
        </Text>
      </View>

      <View style={styles.activePreviewBox}>
        <Feather name="info" size={15} color={colors.masuk} style={{ marginRight: 6 }} />
        <Text style={styles.activePreviewText}>
          Koordinat Terpilih: {latitude}, {longitude} (Radius {radiusMeters}m)
        </Text>
      </View>

      <Button
        title={saving ? 'Menyimpan ke Database...' : 'Simpan Titik Absen ke Supabase'}
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
  pickerGuideBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.sm,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pickerGuideText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.ink,
    flex: 1,
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
  helpText: {
    fontSize: fontSize.xs,
    color: colors.muted,
    marginTop: 4,
  },
  activePreviewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.masukSoft,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    borderRadius: radius.sm,
    marginBottom: 14,
  },
  activePreviewText: {
    fontSize: fontSize.xs,
    color: colors.masuk,
    fontWeight: '700',
  },
});
