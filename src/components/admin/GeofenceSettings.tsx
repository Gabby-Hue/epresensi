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
  onAdd: (params: {
    officeName: string;
    latitude: number;
    longitude: number;
    radiusMeters: number;
    color?: string;
    workStartTime?: string;
    workEndTime?: string;
    lateDeadline?: string;
    address?: string;
  }) => Promise<{ success: boolean; message: string }>;
  onUpdate: (
    id: string,
    params: {
      officeName: string;
      latitude: number;
      longitude: number;
      radiusMeters: number;
      color?: string;
      workStartTime?: string;
      workEndTime?: string;
      lateDeadline?: string;
      address?: string;
    }
  ) => Promise<{ success: boolean; message: string }>;
  onDelete: (id: string) => Promise<{ success: boolean; message: string }>;
}

const EMPTY_FORM = {
  officeName: '',
  latitude: '',
  longitude: '',
  radiusMeters: '150',
  color: '#2196F3',
  workStartTime: '08:00',
  workEndTime: '17:00',
  lateDeadline: '10:00',
  address: '',
};

export const OFFICE_COLORS = ['#2196F3', '#16A34A', '#EA580C', '#7C3AED', '#0D9488', '#DC2626'];

export const GeofenceSettings: React.FC<OfficeManagerProps> = ({
  offices,
  onAdd,
  onUpdate,
  onDelete,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(offices.length === 0);
  const [form, setForm] = useState(EMPTY_FORM);
  const [addressQuery, setAddressQuery] = useState('');
  const [searchingAddress, setSearchingAddress] = useState(false);
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
        workStartTime: editing.workStartTime || '08:00',
        workEndTime: editing.workEndTime || '17:00',
        lateDeadline: editing.lateDeadline || '10:00',
        address: editing.address || '',
      });
      setAddressQuery(editing.address || '');
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
    setAddressQuery('');
    setShowForm(true);
  };

  const startEdit = (office: OfficeSettings) => {
    select();
    setEditingId(office.id);
    setShowForm(true);
    setAddressQuery(office.address || '');
    setForm({
      officeName: office.officeName,
      latitude: office.latitude.toString(),
      longitude: office.longitude.toString(),
      radiusMeters: office.radiusMeters.toString(),
      color: office.color || '#2196F3',
      workStartTime: office.workStartTime || '08:00',
      workEndTime: office.workEndTime || '17:00',
      lateDeadline: office.lateDeadline || '10:00',
      address: office.address || '',
    });
  };

  const cancelForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setAddressQuery('');
    setShowForm(offices.length === 0);
  };

  const handleSearchAddress = async () => {
    const q = addressQuery.trim();
    if (!q) {
      setFeedbackDialog({
        title: 'Alamat Kosong',
        message: 'Ketik nama jalan atau daerah yang ingin dicari (contoh: Jl. Benowo, Surabaya).',
        variant: 'danger',
      });
      return;
    }
    setSearchingAddress(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1&countrycodes=id`;
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'EPresensiApp/1.0',
        },
      });
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const item = data[0];
        const lat = parseFloat(item.lat).toFixed(6);
        const lng = parseFloat(item.lon).toFixed(6);
        setForm((f) => ({
          ...f,
          latitude: lat,
          longitude: lng,
          address: item.display_name,
          officeName: f.officeName ? f.officeName : (item.name || q),
        }));
        succeed();
        setFeedbackDialog({
          title: 'Lokasi Ditemukan',
          message: `Titik koordinat berhasil disesuaikan ke:\n${item.display_name}`,
          variant: 'primary',
        });
      } else {
        fail();
        setFeedbackDialog({
          title: 'Tidak Ditemukan',
          message: `Alamat "${q}" tidak ditemukan. Coba tambahkan nama kota, misal: "${q}, Surabaya".`,
          variant: 'danger',
        });
      }
    } catch {
      fail();
      setFeedbackDialog({
        title: 'Pencarian Gagal',
        message: 'Gagal terhubung ke layanan geocoding. Pastikan koneksi internet aktif.',
        variant: 'danger',
      });
    } finally {
      setSearchingAddress(false);
    }
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
    const payload = {
      officeName: form.officeName,
      latitude: lat,
      longitude: lng,
      radiusMeters: rad,
      color: form.color,
      workStartTime: form.workStartTime || '08:00',
      workEndTime: form.workEndTime || '17:00',
      lateDeadline: form.lateDeadline || '10:00',
      address: form.address || undefined,
    };
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
      setAddressQuery('');
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
            height={320}
            interactivePicker={true}
            onLocationSelect={(lat, lng) =>
              setForm((f) => ({ ...f, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }))
            }
          />
        </View>
        <Text style={styles.hint}>
          Ketuk peta untuk menaruh titik kantor. Gunakan tombol + / - atau scroll untuk zoom hingga detail jalan/bangunan.
        </Text>

        {/* Daftar titik */}
        {visibleOffices.length === 0 ? (
          <View style={styles.emptyBox}>
            <Feather name="alert-triangle" size={26} color={colors.warning} style={{ marginBottom: 6 }} />
            <Text style={styles.emptyTitle}>Lokasi Kantor Cabang Belum Dikonfigurasi</Text>
            <Text style={styles.emptySub}>
              Sebagai admin cabang pertama, Anda harus menginput titik lokasi kantor dan jam kerja operasional terlebih dahulu pada form di bawah agar sistem presensi karyawan dapat mulai digunakan.
            </Text>
          </View>
        ) : (
          visibleOffices.map((office) => {
            const active = editingId === office.id;
            return (
              <View key={office.id} style={[styles.officeRow, active && styles.officeRowActive]}>
                <TouchableOpacity style={styles.officeInfo} activeOpacity={0.7} onPress={() => startEdit(office)}>
                  <View style={[styles.officeDot, { backgroundColor: office.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.officeName}>{office.officeName}</Text>
                    {office.address ? (
                      <Text style={styles.officeAddress} numberOfLines={1}>
                        Alamat: {office.address}
                      </Text>
                    ) : null}
                    <Text style={styles.officeSub}>
                      {office.latitude.toFixed(5)}, {office.longitude.toFixed(5)} • radius {office.radiusMeters} m
                    </Text>
                    <Text style={styles.officeHours}>
                      Jam Kerja: {office.workStartTime || '08:00'} - {office.workEndTime || '17:00'} WIB (Batas {office.lateDeadline || '10:00'})
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
          })
        )}

        <Button
          title={visibleOffices.length === 0 ? 'Input Titik Kantor Sekarang' : 'Tambah titik baru'}
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

        <View style={styles.formGroup}>
          <Text style={styles.label}>Cari Alamat Jalan (Geocoding)</Text>
          <View style={styles.addressSearchRow}>
            <TextInput
              style={[styles.input, { flex: 1, minHeight: 48 }]}
              value={addressQuery}
              onChangeText={setAddressQuery}
              placeholder="Contoh: Jl. Benowo, Surabaya..."
              placeholderTextColor={colors.faint}
              onSubmitEditing={handleSearchAddress}
            />
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleSearchAddress}
              disabled={searchingAddress}
              style={styles.searchAddrBtn}
            >
              <Feather name="search" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.searchAddrBtnText}>{searchingAddress ? 'Mencari...' : 'Cari'}</Text>
            </TouchableOpacity>
          </View>
          {form.address ? (
            <View style={styles.foundAddressBox}>
              <Feather name="map-pin" size={13} color={colors.primary} style={{ marginTop: 2, marginRight: 6 }} />
              <Text style={styles.foundAddressText}>{form.address}</Text>
            </View>
          ) : null}
          <Text style={styles.hint}>
            Ketik alamat/nama jalan lalu tekan Cari untuk otomatis menaruh pin peta dan koordinat.
          </Text>
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

        <View style={styles.formGroup}>
          <Text style={styles.label}>Jam Operasional & Shift</Text>
          <View style={styles.row}>
            <View style={[styles.formGroup, { flex: 1, marginRight: 4 }]}>
              <Text style={styles.subLabel}>Jam Masuk</Text>
              <TextInput
                style={styles.input}
                value={form.workStartTime}
                onChangeText={(v) => setForm((f) => ({ ...f, workStartTime: v }))}
                placeholder="08:00"
              />
            </View>
            <View style={[styles.formGroup, { flex: 1, marginHorizontal: 4 }]}>
              <Text style={styles.subLabel}>Batas Terlambat</Text>
              <TextInput
                style={styles.input}
                value={form.lateDeadline}
                onChangeText={(v) => setForm((f) => ({ ...f, lateDeadline: v }))}
                placeholder="10:00"
              />
            </View>
            <View style={[styles.formGroup, { flex: 1, marginLeft: 4 }]}>
              <Text style={styles.subLabel}>Jam Pulang</Text>
              <TextInput
                style={styles.input}
                value={form.workEndTime}
                onChangeText={(v) => setForm((f) => ({ ...f, workEndTime: v }))}
                placeholder="17:00"
              />
            </View>
          </View>
          <Text style={styles.hint}>Format JJ:MM (WIB). Mengatur jam toleransi keterlambatan dan pembukaan presensi pulang.</Text>
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
  officeAddress: { fontSize: fontSize.xs, color: colors.muted, marginTop: 1, fontWeight: '500' },
  officeSub: { fontSize: fontSize.xs, color: colors.muted, marginTop: 2, fontWeight: '600' },
  officeHours: { fontSize: fontSize.xs, color: colors.primaryDark, marginTop: 3, fontWeight: '700' },
  addressSearchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  searchAddrBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    minHeight: 48,
  },
  searchAddrBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: fontSize.xs },
  foundAddressBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.primarySoft,
    padding: 8,
    borderRadius: radius.sm,
    marginBottom: 6,
  },
  foundAddressText: {
    fontSize: fontSize.xs,
    color: colors.primaryDark,
    fontWeight: '600',
    flex: 1,
    lineHeight: 16,
  },
  emptyBox: {
    padding: 20,
    backgroundColor: '#FFFBEB',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#FDE68A',
    alignItems: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 4,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: fontSize.xs,
    color: '#B45309',
    textAlign: 'center',
    lineHeight: 18,
  },
  deleteBtn: { paddingVertical: 8, paddingHorizontal: 10, marginRight: 8, borderWidth: 1, borderColor: '#E8B4B4', borderRadius: radius.sm, backgroundColor: '#FFF8F8' },
  deleteText: { color: colors.danger, fontSize: fontSize.xs, fontWeight: '700' },
  addBtn: { marginTop: 4, marginBottom: 4 },
  formGroup: { marginBottom: 12 },
  label: { fontSize: fontSize.xs, fontWeight: '700', color: colors.ink, marginBottom: 4 },
  subLabel: { fontSize: fontSize.xs, fontWeight: '600', color: colors.muted, marginBottom: 4 },
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
