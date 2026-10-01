import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { AttendanceService } from '../../services/attendanceService';
import { UserProfile } from '../../types/attendance';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Feather } from '@expo/vector-icons';
import { colors, fontSize, radius } from '../../theme';
import { select, succeed, fail } from '../../services/feedbackService';

interface AdminCompanyManagerProps {
  currentAdmin: UserProfile;
  users: UserProfile[];
  onChanged: () => void;
}

export const AdminCompanyManager: React.FC<AdminCompanyManagerProps> = ({
  currentAdmin,
  users,
  onChanged,
}) => {
  const isSuper = currentAdmin.role === 'superadmin';
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // Form admin cabang
  const [aName, setAName] = useState('');
  const [aEmail, setAEmail] = useState('');
  const [aPass, setAPass] = useState('');
  const [aCompany, setACompany] = useState('');
  const [aSaving, setASaving] = useState(false);
  const [aError, setAError] = useState<string | null>(null);

  const reload = async () => {
    const list = await AttendanceService.getCompanies();
    setCompanies(list);
    if (!aCompany && list.length > 0) setACompany(list[0].id);
  };

  useEffect(() => {
    reload();
  }, []);

  useEffect(() => {
    if (currentAdmin.companyId) setACompany(currentAdmin.companyId);
  }, [currentAdmin.companyId]);

  if (!isSuper) {
    return (
      <Card title="PT / Perusahaan" subtitle={currentAdmin.companyName || 'Cabang Anda'} icon="briefcase">
        <Text style={styles.muted}>Anda mengelola {currentAdmin.companyName || 'PT Anda sendiri'}.</Text>
      </Card>
    );
  }

  const handleCreateCompany = async () => {
    setError(null);
    setOkMsg(null);
    if (!name.trim()) {
      setError('Nama PT tidak boleh kosong.');
      return;
    }
    setSaving(true);
    const res = await AttendanceService.createCompany(name.trim());
    setSaving(false);
    if (!res.success) {
      fail();
      setError(res.message);
      return;
    }
    succeed();
    setName('');
    setOkMsg(res.message);
    await reload();
    onChanged();
  };

  const handleCreateBranchAdmin = async () => {
    setAError(null);
    if (!aName.trim() || !aEmail.trim() || !aPass) {
      setAError('Lengkapi nama, email, dan kata sandi admin cabang.');
      return;
    }
    if (aPass.length < 6) {
      setAError('Kata sandi minimal 6 karakter.');
      return;
    }
    const targetCompany = aCompany || companies[0]?.id || currentAdmin.companyId || '';
    if (!targetCompany) {
      setAError('Pilih PT dulu.');
      return;
    }
    select();
    setASaving(true);
    const res = await AttendanceService.createEmployeeAccount({
      email: aEmail,
      password: aPass,
      fullName: aName.trim(),
      department: 'Human Capital',
      role: 'admin',
      companyId: targetCompany,
      createdBy: currentAdmin.id,
    });
    setASaving(false);
    if (!res.success) {
      fail();
      setAError(res.message);
      return;
    }
    succeed();
    setAName('');
    setAEmail('');
    setAPass('');
    setOkMsg(res.message);
    onChanged();
  };

  const admins = users.filter((u) => u.role === 'admin' || u.role === 'superadmin');

  return (
    <View style={{ gap: 12 }}>
      <Card title="Daftar PT" subtitle="Setiap PT terpisah total: karyawan, titik kantor, dan absensi" icon="briefcase">
        {companies.length === 0 ? (
          <Text style={styles.muted}>Belum ada PT.</Text>
        ) : (
          companies.map((c) => {
            const staff = users.filter((u) => (u.companyId ?? '') === c.id && u.role === 'employee').length;
            const adm = users.filter((u) => (u.companyId ?? '') === c.id && (u.role === 'admin' || u.role === 'superadmin')).length;
            return (
              <View key={c.id} style={styles.row}>
                <View style={styles.iconBadge}>
                  <Feather name="briefcase" size={14} color={colors.primaryDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{c.name}</Text>
                  <Text style={styles.rowSub}>{adm} admin • {staff} karyawan</Text>
                </View>
              </View>
            );
          })
        )}
        {error && <Text style={styles.error}>{error}</Text>}
        {okMsg && <Text style={styles.ok}>{okMsg}</Text>}
        <View style={styles.inlineForm}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Contoh: PT SKMI Cabang Surabaya"
            placeholderTextColor={colors.faint}
            value={name}
            onChangeText={setName}
          />
          <TouchableOpacity style={styles.addBtn} onPress={handleCreateCompany} disabled={saving} activeOpacity={0.8}>
            <Feather name="plus" size={16} color="#fff" />
            <Text style={styles.addBtnText}>{saving ? '...' : 'Tambah PT'}</Text>
          </TouchableOpacity>
        </View>
      </Card>

      <Card title="Buat admin cabang" subtitle="Admin cabang hanya lihat dan kelola PT-nya sendiri" icon="user-check">
        {aError && <Text style={styles.error}>{aError}</Text>}
        <Text style={styles.label}>Nama admin</Text>
        <TextInput style={styles.input} placeholder="Contoh: Admin Surabaya" placeholderTextColor={colors.faint} value={aName} onChangeText={setAName} />
        <Text style={styles.label}>Email</Text>
        <TextInput style={styles.input} placeholder="admin.surabaya@pt.co.id" placeholderTextColor={colors.faint} value={aEmail} onChangeText={setAEmail} autoCapitalize="none" keyboardType="email-address" />
        <Text style={styles.label}>Kata sandi</Text>
        <TextInput style={styles.input} placeholder="Minimal 6 karakter" placeholderTextColor={colors.faint} value={aPass} onChangeText={setAPass} secureTextEntry />
        <Text style={styles.label}>PT yang dikelola</Text>
        <View style={styles.chipRow}>
          {companies.map((c) => {
            const active = (aCompany || companies[0]?.id) === c.id;
            return (
              <TouchableOpacity
                key={c.id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => {
                  select();
                  setACompany(c.id);
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Button title={aSaving ? 'Membuat...' : 'Buat admin cabang'} icon="user-check" loading={aSaving} onPress={handleCreateBranchAdmin} style={{ marginTop: 8 }} />
      </Card>

      <Card title={`Daftar Admin (${admins.length})`} subtitle="Superadmin dan admin tiap PT" icon="users">
        {admins.map((a) => (
          <View key={a.id} style={styles.row}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{a.fullName.substring(0, 2).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{a.fullName}</Text>
              <Text style={styles.rowSub}>
                {a.role === 'superadmin' ? 'Superadmin' : 'Admin'} • {a.companyName || '-'}
              </Text>
            </View>
          </View>
        ))}
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  muted: { color: colors.muted, fontSize: fontSize.sm },
  error: { color: colors.danger, fontSize: fontSize.xs, marginTop: 8 },
  ok: { color: colors.primaryDark, fontSize: fontSize.xs, marginTop: 8 },
  label: { fontSize: fontSize.xs, fontWeight: '700', color: colors.ink, marginTop: 10, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#E4EBF3',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: fontSize.sm,
    color: colors.ink,
    backgroundColor: '#fff',
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  rowTitle: { fontSize: fontSize.sm, fontWeight: '700', color: colors.ink },
  rowSub: { fontSize: fontSize.xs, color: colors.muted, marginTop: 2 },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: fontSize.xs, fontWeight: '800', color: colors.primaryDark },
  inlineForm: { flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  addBtnText: { color: '#fff', fontSize: fontSize.xs, fontWeight: '800' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: {
    borderWidth: 1,
    borderColor: '#E4EBF3',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#fff',
  },
  chipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  chipText: { fontSize: fontSize.xs, color: colors.muted, fontWeight: '600' },
  chipTextActive: { color: colors.primaryDark, fontWeight: '800' },
});
