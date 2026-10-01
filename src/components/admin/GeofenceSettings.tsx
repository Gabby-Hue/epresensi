import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { OfficeSettings } from '../../types/attendance';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { MapView } from '../ui/MapView';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { getCurrentLocation } from '../../services/locationService';
import { Feather } from '@expo/vector-icons';
import { colors, fontSize, radius } from '../../theme';
import { select, succeed, fail } from '../../services/feedbackService';

interface OfficeManagerProps {
  offices: OfficeSettings[];
  onAdd: (params: { officeName: string; latitude: number; longitude: number; radiusMeters: number; color?: string }) => Promise<{ success: boolean; message: string }>;
  onUpdate: (id: string, params: { officeName: string; latitude: number; longitude: number; radiusMeters: number; color?: string }) => Promise<{ success: boolean; message: string }>;
  onDelete: (id: string) => Promise<{ success: boolean; message: string }>;
}

const EMPTY_FORM = { officeName: '', latitude: '', longitude: '', radiusMeters: '150', color: '#2196F3' };

export const OFFICE_COLORS = ['#2196F3', '#16A34A', '#EA580C', '#7C3AED', '#0D9488', '#DC2626'];

export const GeofenceSettings: React.FC<OfficeManagerProps> = ({
  offices,
  onAdd,
  onUpdate,
  onDelete,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [fetchingGps, setFetchingGps] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [optimisticallyRemoved, setOptimisticallyRemoved] = useState<string[]>([]);
  const [officeToDelete, setOfficeToDelete] = useState<OfficeSettings | null>(null);
  const [feedbackDialog, setFeedbackDialog] = useState<{
    title: string;
    message: string;
    variant: 'primary' | 'danger';
  } | null>(null);

  useEffect(() => {
    setOptimisticallyRemoved([]);
  }, [offices]);

  const visibleOffices = offices.filter((office) => !optimisticallyRemoved.includes(office.id));
  const editing = editingId ? visibleOffices.find((o) => o.id === editingId) ?? null : null;

  useEffect(() => {
    if (editing) {
      setForm({
        officeName: editing.officeName,
        latitude: editing.latitude.toString(),
        longitude: editing.longitude.toString(),
        radiusMeters: editing.radiusMeters.toString(),
        color: editing.color || '#2196F3',
      });
    }
  }, [editingId]);

  const latNum = parseFloat(form.latitude);
  const lngNum = parseFloat(form.longitude);
  const radNum = parseInt(form.radiusMeters, 10);
  const previewLat = isFinite(latNum) ? latNum : (editing?.latitude ?? visibleOffices[0]?.latitude ?? -6.2088);
  const previewLng = isFinite(lngNum) ? lngNum : (editing?.longitude ?? visibleOffices[0]?.longitude ?? 106.8456);
  const previewRad = Number.isInteger(radNum) && radNum > 0 ? radNum : (editing?.radiusMeters ?? 150);

  const startAdd = () => {
    select();
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const startEdit = (office: OfficeSettings) => {
    select();
    setEditingId(office.id);
    setShowForm(true);
    setForm({
      officeName: office.officeName,
      latitude: office.latitude.toString(),
      longitude: office.longitude.toString(),
      radiusMeters: office.radiusMeters.toString(),
      color: office.color || '#2196F3',
    });
  };

  const cancelForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(false);
  };

  const handleUseCurrentGps = async () => {
    setFetchingGps(true);
    const { coords, errorMsg } = await getCurrentLocation();
    setFetchingGps(false);
    if (errorMsg) {
      setFeedbackDialog({
        title: 'GPS',
        message: errorMsg,
        variant: 'danger',
      });
    }
    setForm((f) => ({ ...f, latitude: coords.latitude.toFixed(6), longitude: coords.longitude.toFixed(6) }));
  };

  const handleSave = async () => {
    const lat = parseFloat(form.latitude);
    const lng = parseFloat(form.longitude);
    const rad = parseInt(form.radiusMeters, 10);
    if (!form.officeName.trim()) {
      setFeedbackDialog({
        title: 'Belum lengkap',
        message: 'Isi nama kantor dulu, contoh: Kantor Pusat / Cabang Sidoarjo.',
        variant: 'danger',
      });
      return;
    }
    if (!isFinite(lat) || !isFinite(lng) || !Number.isInteger(rad) || rad <= 0) {
      setFeedbackDialog({
        title: 'Tidak valid',
        message: 'Periksa koordinat dan radius (bilangan bulat meter).',
        variant: 'danger',
      });
      return;
    }
    setSaving(true);
    const payload = { officeName: form.officeName, latitude: lat, longitude: lng, radiusMeters: rad, color: form.color };
    const res = editingId
      ? await onUpdate(editingId, payload)
      : await onAdd(payload);
    setSaving(false);
    if (res.success) succeed();
    else fail();
    setFeedbackDialog({
      title: res.success ? 'Berhasil' : 'Gagal',
      message: res.message,
      variant: res.success ? 'primary' : 'danger',
    });
    if (res.success) {
      setEditingId(null);
      setForm(EMPTY_FORM);
      setShowForm(false);
    }
  };

  const handleDelete = (office: OfficeSettings) => {
    select();
    setOfficeToDelete(office);
  };

  const confirmDeleteOffice = async () => {
    if (!officeToDelete) return;
    const target = officeToDelete;
    setOfficeToDelete(null);
    setDeletingId(target.id);
    const res = await onDelete(target.id);
    setDeletingId(null);
    if (res.success) {
      setOptimisticallyRemoved((current) => current.includes(target.id) ? current : [...current, target.id]);
      if (editingId === target.id) {
        setEditingId(null);
        setForm(EMPTY_FORM);
        setShowForm(false);
      }
      succeed();
    } else {
      fail();
    }
    setFeedbackDialog({
      title: res.success ? 'Berhasil' : 'Gagal',
      message: res.message,
      variant: res.success ? 'primary' : 'danger',
    });
  };

  return (
    <View>
      <Card title={`Titik Kantor (${visibleOffices.length})`} icon="map-pin" subtitle="Tambah cabang, atur radius tiap titik">
        {/* Peta semua titik */}
        <View style={styles.mapBox}>
          <MapView
            userLat={previewLat}
            userLng={previewLng}
            officeLat={previewLat}
            officeLng={previewLng}
            radiusMeters={previewRad}
            offices={visibleOffices}
            activeOfficeId={editingId}
            mainColor={form.color}
            height={230}
            interactivePicker={true}
            onLocationSelect={(lat, lng) =>
              setForm((f) => ({ ...f, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }))
            }
          />
        </View>
        <Text style={styles.hint}>Ketuk peta untuk menaruh titik, atau pakai GPS saat ini.</Text>

        {/* Daftar titik */}
        {visibleOffices.map((office) => {
          const active = editingId === office.id;
          return (
            <View key={office.id} style={[styles.officeRow, active && styles.officeRowActive]}>
              <TouchableOpacity style={styles.officeInfo} activeOpacity={0.7} onPress={() => startEdit(office)}>
                <View style={[styles.officeDot, { backgroundColor: office.color }]} />
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
                <Text style={styles.deleteText}>{deletingId === office.id ? 'Menghapus...' : 'Hapus'}</Text>
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

      {showForm && (
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

        <View style={styles.formGroup}>
          <Text style={styles.label}>Warna titik</Text>
          <View style={styles.swatchRow}>
            {OFFICE_COLORS.map((c) => (
              <TouchableOpacity
                key={c}
                activeOpacity={0.8}
                onPress={() => {
                  select();
                  setForm((f) => ({ ...f, color: c }));
                }}
                style={[
                  styles.swatch,
                  { backgroundColor: c },
                  form.color === c && styles.swatchActive,
                ]}
                hitSlop={6}
              >
                {form.color === c && <Feather name="check" size={16} color="#FFFFFF" />}
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.hint}>Warna ini jadi penanda lokasi di daftar absen karyawan.</Text>
        </View>

        <Button
          title={saving ? 'Menyimpan...' : editingId ? 'Simpan perubahan' : 'Simpan titik'}
          variant="primary"
          icon="save"
          loading={saving}
          onPress={handleSave}
        />
        {showForm && (
          <Button title="Batalkan" variant="outline" onPress={cancelForm} style={styles.cancelBtn} />
        )}
      </Card>
      )}

      {/* Dialog Konfirmasi Hapus Titik Kantor */}
      <ConfirmDialog
        visible={!!officeToDelete}
        onClose={() => setOfficeToDelete(null)}
        onConfirm={confirmDeleteOffice}
        title="Hapus Titik Kantor?"
        message={`Titik "${officeToDelete?.officeName}" akan dihapus. Presensi lama yang tercatat di sini tidak ikut terhapus.`}
        confirmText="Ya, Hapus"
        cancelText="Batal"
        icon="trash-2"
        variant="danger"
      />

      {/* Dialog Feedback (Berhasil / Gagal) */}
      <ConfirmDialog
        visible={!!feedbackDialog}
        onClose={() => setFeedbackDialog(null)}
        onConfirm={() => setFeedbackDialog(null)}
        title={feedbackDialog?.title || ''}
        message={feedbackDialog?.message || ''}
        confirmText="Tutup"
        singleButton={true}
        icon={feedbackDialog?.variant === 'primary' ? 'check-circle' : 'alert-circle'}
        variant={feedbackDialog?.variant || 'primary'}
      />
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
  deleteBtn: { paddingVertical: 8, paddingHorizontal: 10, marginRight: 8, borderWidth: 1, borderColor: '#E8B4B4', borderRadius: radius.sm, backgroundColor: '#FFF8F8' },
  deleteText: { color: colors.danger, fontSize: fontSize.xs, fontWeight: '700' },
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
  swatchRow: { flexDirection: 'row', gap: 10, marginTop: 2, marginBottom: 6 },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchActive: { borderColor: colors.ink },
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
