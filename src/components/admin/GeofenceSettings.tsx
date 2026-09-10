import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { OfficeSettings } from '../../types/attendance';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { MapView } from '../ui/MapView';
import { getCurrentLocation } from '../../services/locationService';
import { Feather } from '@expo/vector-icons';
import { colors, fontSize, radius } from '../../theme';

interface OfficeManagerProps {
  offices: OfficeSettings[];
  onAdd: (params: { officeName: string; latitude: number; longitude: number; radiusMeters: number }) => Promise<{ success: boolean; message: string }>;
  onUpdate: (id: string, params: { officeName: string; latitude: number; longitude: number; radiusMeters: number }) => Promise<{ success: boolean; message: string }>;
  onDelete: (id: string) => Promise<{ success: boolean; message: string }>;
}

const EMPTY_FORM = { officeName: '', latitude: '', longitude: '', radiusMeters: '150' };

export const GeofenceSettings: React.FC<OfficeManagerProps> = ({
  offices,
  onAdd,
  onUpdate,
  onDelete,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [fetchingGps, setFetchingGps] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const editing = editingId ? offices.find((o) => o.id === editingId) ?? null : null;

  useEffect(() => {
    if (editing) {
      setForm({
        officeName: editing.officeName,
        latitude: editing.latitude.toString(),
        longitude: editing.longitude.toString(),
        radiusMeters: editing.radiusMeters.toString(),
      });
    }
  }, [editingId]);

  const latNum = parseFloat(form.latitude);
  const lngNum = parseFloat(form.longitude);
  const radNum = parseInt(form.radiusMeters, 10);
  const previewLat = isFinite(latNum) ? latNum : (editing?.latitude ?? offices[0]?.latitude ?? -6.2088);
  const previewLng = isFinite(lngNum) ? lngNum : (editing?.longitude ?? offices[0]?.longitude ?? 106.8456);
  const previewRad = Number.isInteger(radNum) && radNum > 0 ? radNum : (editing?.radiusMeters ?? 150);

  const startAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const startEdit = (office: OfficeSettings) => {
    setEditingId(office.id);
    setForm({
      officeName: office.officeName,
      latitude: office.latitude.toString(),
      longitude: office.longitude.toString(),
      radiusMeters: office.radiusMeters.toString(),
    });
  };

  const handleUseCurrentGps = async () => {
    setFetchingGps(true);
    const { coords, errorMsg } = await getCurrentLocation();
    setFetchingGps(false);
    if (errorMsg) Alert.alert('GPS', errorMsg);
    setForm((f) => ({ ...f, latitude: coords.latitude.toFixed(6), longitude: coords.longitude.toFixed(6) }));
  };

  const handleSave = async () => {
    const lat = parseFloat(form.latitude);
    const lng = parseFloat(form.longitude);
    const rad = parseInt(form.radiusMeters, 10);
    if (!form.officeName.trim()) {
      Alert.alert('Belum lengkap', 'Isi nama kantor dulu, contoh: Kantor Pusat / Cabang Sidoarjo.');
      return;
    }
    if (!isFinite(lat) || !isFinite(lng) || !Number.isInteger(rad) || rad <= 0) {
      Alert.alert('Tidak valid', 'Periksa koordinat dan radius (bilangan bulat meter).');
      return;
    }
    setSaving(true);
    const res = editingId
      ? await onUpdate(editingId, { officeName: form.officeName, latitude: lat, longitude: lng, radiusMeters: rad })
      : await onAdd({ officeName: form.officeName, latitude: lat, longitude: lng, radiusMeters: rad });
    setSaving(false);
    Alert.alert(res.success ? 'Berhasil' : 'Gagal', res.message);
    if (res.success) {
      setEditingId(null);
      setForm(EMPTY_FORM);
    }
  };

  const handleDelete = (office: OfficeSettings) => {
    Alert.alert(
      'Hapus titik?',
      `Titik "${office.officeName}" akan dihapus. Presensi lama yang tercatat di sini tidak ikut terhapus.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(office.id);
            const res = await onDelete(office.id);
            setDeletingId(null);
            if (editingId === office.id) {
              setEditingId(null);
              setForm(EMPTY_FORM);
            }
            Alert.alert(res.success ? 'Berhasil' : 'Gagal', res.message);
          },
        },
      ]
    );
  };

  return (
    <View>
      <Card title={`Titik Kantor (${offices.length})`} icon="map-pin" subtitle="Tambah cabang, atur radius tiap titik">
        {/* Peta semua titik */}
        <View style={styles.mapBox}>
          <MapView
            userLat={previewLat}
            userLng={previewLng}
            officeLat={previewLat}
            officeLng={previewLng}
            radiusMeters={previewRad}
            offices={offices}
            activeOfficeId={editingId}
            height={230}
            interactivePicker={true}
            onLocationSelect={(lat, lng) =>
              setForm((f) => ({ ...f, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }))
            }
          />
        </View>
        <Text style={styles.hint}>Ketuk peta untuk menaruh titik, atau pakai GPS saat ini.</Text>

        {/* Daftar titik */}
        {offices.map((office) => {
          const active = editingId === office.id;
          return (
            <View key={office.id} style={[styles.officeRow, active && styles.officeRowActive]}>
              <TouchableOpacity style={styles.officeInfo} activeOpacity={0.7} onPress={() => startEdit(office)}>
                <View style={styles.officeDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.officeName}>{office.officeName}</Text>
                  <Text style={styles.officeSub}>
                    {office.latitude.toFixed(5)}, {office.longitude.toFixed(5)} • radius {office.radiusMeters} m
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.faint} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleDelete(office)}
                hitSlop={10}
                style={styles.deleteBtn}
                disabled={deletingId === office.id}
              >
                <Feather name="trash-2" size={17} color={colors.danger} />
              </TouchableOpacity>
            </View>
          );
        })}

        <Button
          title="Tambah titik baru"
          variant="outline"
          icon="plus"
          onPress={startAdd}
          style={styles.addBtn}
        />
      </Card>

      <Card title={editingId ? `Ubah: ${editing?.officeName}` : 'Titik baru'} icon={editingId ? 'edit' : 'plus-circle'}>
        <View style={styles.formGroup}>
          <Text style={styles.label}>Nama kantor</Text>
          <TextInput
            style={styles.input}
            value={form.officeName}
            onChangeText={(v) => setForm((f) => ({ ...f, officeName: v }))}
            placeholder="Contoh: Kantor Pusat, Cabang Sidoarjo"
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.formGroup, { flex: 1, marginRight: 6 }]}>
            <Text style={styles.label}>Lat</Text>
            <TextInput
              style={styles.input}
              value={form.latitude}
              onChangeText={(v) => setForm((f) => ({ ...f, latitude: v }))}
              keyboardType="numeric"
              placeholder="-7.2575"
            />
          </View>
          <View style={[styles.formGroup, { flex: 1, marginLeft: 6 }]}>
            <Text style={styles.label}>Lng</Text>
            <TextInput
              style={styles.input}
              value={form.longitude}
              onChangeText={(v) => setForm((f) => ({ ...f, longitude: v }))}
              keyboardType="numeric"
              placeholder="112.7521"
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
          <Text style={styles.label}>Radius (meter)</Text>
          <View style={styles.radiusRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={form.radiusMeters}
              onChangeText={(v) => setForm((f) => ({ ...f, radiusMeters: v.replace(/[^0-9]/g, '') }))}
              keyboardType="numeric"
              placeholder="150"
            />
            <View style={styles.unitBox}>
              <Text style={styles.unitText}>m</Text>
            </View>
          </View>
        </View>

        <Button
          title={saving ? 'Menyimpan...' : editingId ? 'Simpan perubahan' : 'Simpan titik'}
          variant="primary"
          icon="save"
          loading={saving}
          onPress={handleSave}
        />
        {editingId && (
          <Button title="Batalkan" variant="outline" onPress={startAdd} style={styles.cancelBtn} />
        )}
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  mapBox: { marginBottom: 8 },
  hint: { fontSize: fontSize.xs, color: colors.muted, fontWeight: '600', marginBottom: 12 },
  officeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    marginBottom: 8,
    backgroundColor: colors.surface,
  },
  officeRowActive: { borderColor: colors.primary },
  officeInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 12 },
  officeDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary, marginRight: 10 },
  officeName: { fontSize: fontSize.sm, fontWeight: '700', color: colors.ink },
  officeSub: { fontSize: fontSize.xs, color: colors.muted, marginTop: 2, fontWeight: '600' },
  deleteBtn: { padding: 12 },
  addBtn: { marginTop: 4, marginBottom: 4 },
  formGroup: { marginBottom: 12 },
  label: { fontSize: fontSize.xs, fontWeight: '700', color: colors.ink, marginBottom: 4 },
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
  row: { flexDirection: 'row' },
  gpsBtn: { marginBottom: 12 },
  radiusRow: { flexDirection: 'row', alignItems: 'center' },
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
  unitText: { fontSize: fontSize.xs, fontWeight: '700', color: colors.ink },
  cancelBtn: { marginTop: 8 },
});
