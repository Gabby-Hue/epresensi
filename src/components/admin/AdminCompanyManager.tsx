import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { AttendanceService } from '../../services/attendanceService';
import { UserProfile } from '../../types/attendance';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
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

  // Reset password admin
  const [resetAdminTarget, setResetAdminTarget] = useState<UserProfile | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetSaving, setResetSaving] = useState(false);

  // Hapus PT dialog
  const [deleteCompanyTarget, setDeleteCompanyTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteCompanySaving, setDeleteCompanySaving] = useState(false);

  // Hapus admin dialog
  const [deleteAdminTarget, setDeleteAdminTarget] = useState<UserProfile | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

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

  const handleResetPassword = async () => {
    if (!resetAdminTarget || newPassword.length < 6) return;
    setResetSaving(true);
    const res = await AttendanceService.resetUserPassword(resetAdminTarget.id, newPassword);
    setResetSaving(false);
    if (res.success) {
      succeed();
      setOkMsg(`Kata sandi untuk ${resetAdminTarget.fullName} berhasil diperbarui.`);
      setResetAdminTarget(null);
      setNewPassword('');
    } else {
      fail();
      setError(res.message);
    }
  };

  const handleDeleteAdmin = async () => {
    if (!deleteAdminTarget) return;
    setDeleteSaving(true);
    const res = await AttendanceService.deleteEmployeeAccount(deleteAdminTarget.id);
    setDeleteSaving(false);
    if (res.success) {
      succeed();
      setOkMsg(`Admin ${deleteAdminTarget.fullName} berhasil dihapus.`);
      setDeleteAdminTarget(null);
      onChanged();
    } else {
      fail();
      setError(res.message);
    }
  };

  const handleDeleteCompany = async () => {
    if (!deleteCompanyTarget) return;
    setDeleteCompanySaving(true);
    const res = await AttendanceService.deleteCompany(deleteCompanyTarget.id);
    setDeleteCompanySaving(false);
    if (res.success) {
      succeed();
      setOkMsg(`PT ${deleteCompanyTarget.name} berhasil dihapus.`);
      setDeleteCompanyTarget(null);
      await reload();
      onChanged();
    } else {
      fail();
      setError(res.message);
      setDeleteCompanyTarget(null);
    }
  };

  const admins = users.filter((u) => u.role === 'admin' || u.role === 'superadmin');

  return (
    <View style={{ gap: 14 }}>
      {/* 1. KELOLA DAFTAR PT */}
      <Card title="Daftar PT / Entitas Cabang" subtitle="Setiap PT terpisah total: admin, karyawan, titik kantor, dan absensi" icon="briefcase">
        {companies.length === 0 ? (
          <Text style={styles.muted}>Belum ada PT terdaftar.</Text>
        ) : (
          companies.map((c) => {
            const staff = users.filter((u) => (u.companyId ?? '') === c.id && u.role === 'employee').length;
            const adm = users.filter((u) => (u.companyId ?? '') === c.id && (u.role === 'admin' || u.role === 'superadmin')).length;
            return (
              <View key={c.id} style={styles.row}>
                <View style={styles.iconBadge}>
                  <Feather name="briefcase" size={15} color={colors.primaryDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{c.name}</Text>
                  <Text style={styles.rowSub}>{adm} Admin Penanggung Jawab • {staff} Karyawan</Text>
                </View>
                {companies.length > 1 && (
                  <TouchableOpacity
                    style={styles.actionIconBtnDanger}
                    onPress={() => {
                      select();
                      setDeleteCompanyTarget(c);
                    }}
                    hitSlop={10}
                  >
                    <Feather name="trash-2" size={15} color={colors.danger} />
                  </TouchableOpacity>
                )}
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
            <Text style={styles.addBtnText}>{saving ? 'Menyimpan...' : 'Tambah PT'}</Text>
          </TouchableOpacity>
        </View>
      </Card>

      {/* 2. FORM BUAT ADMIN CABANG */}
      <Card title="Buat Admin Cabang Baru" subtitle="Admin cabang hanya melihat dan mengelola PT yang ditugaskan kepadanya" icon="user-plus">
        {aError && <Text style={styles.error}>{aError}</Text>}
        <Text style={styles.label}>Nama Admin Cabang</Text>
        <TextInput style={styles.input} placeholder="Contoh: Budi Santoso" placeholderTextColor={colors.faint} value={aName} onChangeText={setAName} />
        
        <Text style={styles.label}>Email Login</Text>
        <TextInput style={styles.input} placeholder="budi@kantor.co.id" placeholderTextColor={colors.faint} value={aEmail} onChangeText={setAEmail} autoCapitalize="none" keyboardType="email-address" />
        
        <Text style={styles.label}>Kata Sandi Awal</Text>
        <TextInput style={styles.input} placeholder="Minimal 6 karakter" placeholderTextColor={colors.faint} value={aPass} onChangeText={setAPass} secureTextEntry />
        
        <Text style={styles.label}>PT yang Dikelola</Text>
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
        <Button title={aSaving ? 'Membuat...' : 'Buat Akun Admin Cabang'} icon="user-check" loading={aSaving} onPress={handleCreateBranchAdmin} style={{ marginTop: 12 }} />
      </Card>

      {/* 3. DAFTAR ADMIN CABANG AKTIF */}
      <Card title={`Daftar Admin Cabang (${admins.length})`} subtitle="Superadmin pusat dan seluruh admin tiap cabang PT" icon="users">
        {admins.map((a) => {
          const isMe = a.id === currentAdmin.id;
          return (
            <View key={a.id} style={styles.adminCardRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{a.fullName.substring(0, 2).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.rowTitle}>{a.fullName}</Text>
                  {isMe && <Text style={styles.meBadge}>Anda</Text>}
                </View>
                <Text style={styles.rowEmail}>{a.email}</Text>
                <Text style={styles.rowSub}>
                  {a.role === 'superadmin' ? 'Superadmin Pusat' : 'Admin Cabang'} • {a.companyName || 'Holding'}
                </Text>
              </View>

              {!isMe && a.role !== 'superadmin' && (
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity
                    style={styles.actionIconBtn}
                    onPress={() => {
                      select();
                      setResetAdminTarget(a);
                      setNewPassword('');
                    }}
                    hitSlop={10}
                  >
                    <Feather name="key" size={16} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionIconBtnDanger}
                    onPress={() => {
                      select();
                      setDeleteAdminTarget(a);
                    }}
                    hitSlop={10}
                  >
                    <Feather name="trash-2" size={16} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
      </Card>

      {/* DIALOG RESET PASSWORD ADMIN */}
      {resetAdminTarget && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Ganti Kata Sandi Admin</Text>
            <Text style={styles.modalSub}>Atur ulang sandi login untuk {resetAdminTarget.fullName} ({resetAdminTarget.email}).</Text>
            <TextInput
              style={[styles.input, { marginTop: 12 }]}
              placeholder="Kata sandi baru (minimal 6 karakter)"
              placeholderTextColor={colors.faint}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <Button title="Batal" variant="outline" onPress={() => setResetAdminTarget(null)} style={{ flex: 1 }} />
              <Button
                title={resetSaving ? 'Menyimpan...' : 'Simpan Sandi Baru'}
                onPress={handleResetPassword}
                disabled={resetSaving || newPassword.length < 6}
                style={{ flex: 1.2 }}
              />
            </View>
          </View>
        </View>
      )}

      {/* DIALOG KONFIRMASI HAPUS ADMIN */}
      {deleteAdminTarget && (
        <ConfirmDialog
          visible={true}
          title="Hapus Admin Cabang?"
          message={`Yakin ingin menghapus akses admin untuk ${deleteAdminTarget.fullName} (${deleteAdminTarget.email})?`}
          confirmText={deleteSaving ? 'Menghapus...' : 'Ya, Hapus'}
          cancelText="Batal"
          variant="danger"
          onConfirm={handleDeleteAdmin}
          onClose={() => setDeleteAdminTarget(null)}
        />
      )}

      {/* DIALOG KONFIRMASI HAPUS PT */}
      {deleteCompanyTarget && (
        <ConfirmDialog
          visible={true}
          title="Hapus Entitas PT?"
          message={`Yakin ingin menghapus ${deleteCompanyTarget.name}? Semua titik kantor dan admin cabang terkait akan dihapus.`}
          confirmText={deleteCompanySaving ? 'Menghapus...' : 'Ya, Hapus PT'}
          cancelText="Batal"
          variant="danger"
          onConfirm={handleDeleteCompany}
          onClose={() => setDeleteCompanyTarget(null)}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  muted: { color: colors.muted, fontSize: fontSize.sm },
  error: { color: colors.danger, fontSize: fontSize.xs, marginTop: 8 },
  ok: { color: colors.primaryDark, fontSize: fontSize.xs, marginTop: 8, fontWeight: '700' },
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
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  adminCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  rowTitle: { fontSize: fontSize.sm, fontWeight: '700', color: colors.ink },
  rowEmail: { fontSize: fontSize.xs, color: colors.muted, marginTop: 1 },
  rowSub: { fontSize: 11, color: colors.primaryDark, marginTop: 2, fontWeight: '600' },
  meBadge: {
    fontSize: 10,
    fontWeight: '800',
    backgroundColor: colors.primarySoft,
    color: colors.primaryDark,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: fontSize.xs, fontWeight: '800', color: colors.primaryDark },
  inlineForm: { flexDirection: 'row', gap: 8, marginTop: 14, alignItems: 'center' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  addBtnText: { color: '#fff', fontSize: fontSize.xs, fontWeight: '800' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: {
    borderWidth: 1,
    borderColor: '#E4EBF3',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  chipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  chipText: { fontSize: fontSize.xs, color: colors.muted, fontWeight: '600' },
  chipTextActive: { color: colors.primaryDark, fontWeight: '800' },
  actionIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconBtnDanger: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15,23,42,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    zIndex: 9999,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  modalTitle: { fontSize: fontSize.md, fontWeight: '800', color: colors.ink },
  modalSub: { fontSize: fontSize.xs, color: colors.muted, marginTop: 4 },
});
