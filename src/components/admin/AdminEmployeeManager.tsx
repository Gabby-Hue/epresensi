import React, { useEffect, useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { UserProfile } from '../../types/attendance';
import { AttendanceService } from '../../services/attendanceService';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { DepartmentDropdown } from '../ui/DepartmentDropdown';
import { Feather } from '@expo/vector-icons';
import { colors, fontSize, radius } from '../../theme';
import { select, succeed, fail } from '../../services/feedbackService';

interface AdminEmployeeManagerProps {
  currentAdmin: UserProfile;
  users: UserProfile[];
  onChanged: () => void;
  onSelectEmployee?: (u: UserProfile) => void;
}

export const AdminEmployeeManager: React.FC<AdminEmployeeManagerProps> = ({
  currentAdmin,
  users,
  onChanged,
  onSelectEmployee,
}) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [department, setDepartment] = useState('');
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    AttendanceService.getDepartments(currentAdmin.companyId || undefined).then((list) => {
      if (list && list.length > 0) setDepartments(list);
    });
  }, [currentAdmin.companyId, users]);

  const [editing, setEditing] = useState<UserProfile | null>(null);
  const [editName, setEditName] = useState('');
  const [editDept, setEditDept] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [userToResetDevice, setUserToResetDevice] = useState<UserProfile | null>(null);
  const [feedbackModal, setFeedbackModal] = useState<{
    title: string;
    message: string;
    variant: 'primary' | 'danger';
  } | null>(null);

  const toggleRevealPassword = (userId: string) => {
    select();
    setRevealedPasswords((prev) => ({ ...prev, [userId]: !prev[userId] }));
  };

  const handleCreateAccount = async () => {
    setFormError(null);
    if (!fullName.trim() || !email.trim() || !password) {
      setFormError('Lengkapi nama, email, dan kata sandi dulu.');
      return;
    }
    if (password.length < 6) {
      setFormError('Kata sandi minimal 6 karakter.');
      return;
    }
    setLoading(true);
    const { success, message } = await AttendanceService.createEmployeeAccount({
      email,
      password,
      fullName: fullName.trim(),
      department: department.trim() || 'General',
      role: 'employee',
      companyId: currentAdmin.companyId ?? null,
      createdBy: currentAdmin.id,
    });
    setLoading(false);
    if (!success) {
      fail();
      setFormError(message);
      return;
    }
    succeed();
    setFullName('');
    setEmail('');
    setPassword('');
    setDepartment('');
    setFeedbackModal({
      title: 'Berhasil',
      message,
      variant: 'primary',
    });
    onChanged();
  };

  const openEdit = (item: UserProfile) => {
    select();
    setEditing(item);
    setEditName(item.fullName);
    setEditDept(item.department || '');
    setEditPassword('');
    setShowEditPassword(false);
    setEditError(null);
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    setEditError(null);
    if (!editName.trim()) {
      setEditError('Nama tidak boleh kosong.');
      return;
    }
    if (editPassword && editPassword.length < 6) {
      setEditError('Kata sandi baru minimal 6 karakter.');
      return;
    }
    setEditSaving(true);
    const { success, message } = await AttendanceService.updateEmployeeAccount({
      id: editing.id,
      fullName: editName.trim(),
      department: editDept.trim() || 'General',
      password: editPassword.trim() || undefined,
    });
    setEditSaving(false);
    if (!success) {
      fail();
      setEditError(message);
      return;
    }
    succeed();
    setEditing(null);
    setEditPassword('');
    setFeedbackModal({
      title: 'Berhasil',
      message,
      variant: 'primary',
    });
    onChanged();
  };

  const handleResetDevice = (item: UserProfile) => {
    select();
    setUserToResetDevice(item);
  };

  const confirmResetDevice = async () => {
    if (!userToResetDevice) return;
    const target = userToResetDevice;
    setUserToResetDevice(null);
    setResettingId(target.id);
    const { success, message } = await AttendanceService.resetEmployeeDevice(target.id);
    setResettingId(null);
    if (success) {
      succeed();
      onChanged();
    } else {
      fail();
    }
    setFeedbackModal({
      title: success ? 'Berhasil' : 'Gagal',
      message,
      variant: success ? 'primary' : 'danger',
    });
  };

  const handleDelete = (item: UserProfile) => {
    select();
    setUserToDelete(item);
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    const target = userToDelete;
    setUserToDelete(null);
    setDeletingId(target.id);
    const { success, message } = await AttendanceService.deleteEmployeeAccount(target.id);
    setDeletingId(null);
    if (success) {
      succeed();
      onChanged();
    } else {
      fail();
    }
    setFeedbackModal({
      title: success ? 'Berhasil' : 'Gagal',
      message,
      variant: success ? 'primary' : 'danger',
    });
  };

  const employees = users.filter((u) => u.role === 'employee');

  return (
    <View style={styles.container}>
      <Card
        title="Tambah akun karyawan"
        subtitle="Akun tercatat sebagai buatan Anda"
        icon="user-plus"
      >
        {formError && (
          <View style={styles.errorBox}>
            <Feather name="alert-circle" size={18} color={colors.danger} style={{ marginRight: 8 }} />
            <Text style={styles.errorText}>{formError}</Text>
          </View>
        )}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Nama lengkap</Text>
          <TextInput
            style={styles.input}
            placeholder="Contoh: Budi Pratama"
            placeholderTextColor={colors.faint}
            value={fullName}
            onChangeText={setFullName}
          />
        </View>
        <View style={styles.formGroup}>
          <Text style={styles.label}>Departemen</Text>
          <DepartmentDropdown
            value={department}
            onChange={setDepartment}
            departments={departments}
            onDepartmentsChange={setDepartments}
            placeholder="Pilih departemen karyawan"
          />
        </View>
        <View style={styles.formGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="Contoh: budi@instansi.go.id"
            placeholderTextColor={colors.faint}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>
        <View style={styles.formGroup}>
          <Text style={styles.label}>Kata sandi</Text>
          <View style={styles.createPasswordRow}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Minimal 6 karakter"
              placeholderTextColor={colors.faint}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={styles.createEyeBtn} hitSlop={12}>
              <Feather name={showPassword ? 'eye-off' : 'eye'} size={20} color={colors.muted} />
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>Perangkat terkunci otomatis saat karyawan pertama kali login dari HP-nya.</Text>
        </View>
        <Button
          title={loading ? 'Mendaftarkan...' : 'Daftarkan akun'}
          icon="user-check"
          loading={loading}
          onPress={handleCreateAccount}
          style={{ marginTop: 6 }}
        />
      </Card>

      <Card
        title={`Daftar Karyawan (${employees.length})`}
        subtitle="Kelola data, reset kunci perangkat, atau hapus akun"
        icon="users"
      >
        {employees.length === 0 ? (
          <Text style={styles.emptyText}>Belum ada akun karyawan.</Text>
        ) : (
          employees.map((item) => (
            <View key={item.id} style={styles.userRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {item.fullName.substring(0, 2).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.userName}>{item.fullName}</Text>
                <Text style={styles.userEmail}>{item.email}</Text>
                <Text style={styles.userEmail}>{item.department || 'Staff'}</Text>
                <View style={styles.passwordRow}>
                  <Text style={styles.passwordLabel}>Sandi: </Text>
                  <Text style={styles.passwordVal}>
                    {revealedPasswords[item.id] ? (item.plainPassword || '123456') : '••••••••'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => toggleRevealPassword(item.id)}
                    hitSlop={8}
                    style={{ marginLeft: 6 }}
                  >
                    <Feather
                      name={revealedPasswords[item.id] ? 'eye-off' : 'eye'}
                      size={14}
                      color={colors.primary}
                    />
                  </TouchableOpacity>
                </View>
                <Text style={styles.deviceText}>
                  {item.deviceModel || item.deviceId
                    ? `Terkunci: ${item.deviceModel || item.deviceId}`
                    : 'Belum ada perangkat terkunci'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  select();
                  onSelectEmployee?.(item);
                }}
                style={styles.iconBtn}
                hitSlop={12}
              >
                <Feather name="calendar" size={18} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleResetDevice(item)}
                style={styles.iconBtn}
                hitSlop={12}
                disabled={resettingId === item.id || (!item.deviceId && !item.deviceModel)}
              >
                <Feather
                  name="smartphone"
                  size={18}
                  color={resettingId === item.id || (!item.deviceId && !item.deviceModel) ? colors.faint : colors.primary}
                />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => openEdit(item)} style={styles.iconBtn} hitSlop={12}>
                <Feather name="edit-2" size={18} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item)} style={styles.iconBtn} hitSlop={12} disabled={deletingId === item.id}>
                <Feather name="trash-2" size={18} color={deletingId === item.id ? colors.faint : colors.danger} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </Card>

      <Modal visible={!!editing} onClose={() => setEditing(null)} title="Ubah data karyawan">
        {editError && (
          <View style={styles.errorBox}>
            <Feather name="alert-circle" size={18} color={colors.danger} style={{ marginRight: 8 }} />
            <Text style={styles.errorText}>{editError}</Text>
          </View>
        )}
        <Text style={styles.label}>Nama lengkap</Text>
        <TextInput
          style={styles.input}
          value={editName}
          onChangeText={setEditName}
          placeholder="Nama lengkap"
          placeholderTextColor={colors.faint}
        />
        <Text style={[styles.label, { marginTop: 12 }]}>Departemen</Text>
        <DepartmentDropdown
          value={editDept}
          onChange={setEditDept}
          departments={departments}
          onDepartmentsChange={setDepartments}
          placeholder="Pilih departemen"
        />
        <Text style={[styles.label, { marginTop: 12 }]}>Ganti Kata Sandi (Opsional)</Text>
        <View style={styles.passwordWrap}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={editPassword}
            onChangeText={setEditPassword}
            placeholder="Biarkan kosong jika tidak diubah"
            placeholderTextColor={colors.faint}
            secureTextEntry={!showEditPassword}
          />
          <TouchableOpacity
            style={styles.eyeBtn}
            onPress={() => setShowEditPassword(!showEditPassword)}
            hitSlop={8}
          >
            <Feather name={showEditPassword ? 'eye-off' : 'eye'} size={18} color={colors.muted} />
          </TouchableOpacity>
        </View>
        <Text style={styles.hint}>Minimal 6 karakter jika ingin mengganti sandi karyawan ini.</Text>
        <Button
          title={editSaving ? 'Menyimpan...' : 'Simpan perubahan'}
          icon="check"
          loading={editSaving}
          onPress={handleSaveEdit}
          style={{ marginTop: 16 }}
        />
      </Modal>

      {/* Dialog Konfirmasi Hapus Akun Karyawan */}
      <ConfirmDialog
        visible={!!userToDelete}
        onClose={() => setUserToDelete(null)}
        onConfirm={confirmDelete}
        title="Hapus Akun Karyawan?"
        message={`Akun "${userToDelete?.fullName}" (${userToDelete?.email}) akan dihapus permanen beserta seluruh riwayat presensinya. Lanjutkan?`}
        confirmText="Ya, Hapus"
        cancelText="Batal"
        icon="trash-2"
        variant="danger"
      />

      {/* Dialog Konfirmasi Buka Kunci Perangkat */}
      <ConfirmDialog
        visible={!!userToResetDevice}
        onClose={() => setUserToResetDevice(null)}
        onConfirm={confirmResetDevice}
        title="Buka Kunci Perangkat?"
        message={`Karyawan "${userToResetDevice?.fullName}" akan bisa login dari HP baru. HP baru itu otomatis tersimpan sebagai perangkat resminya.`}
        confirmText="Buka Kunci"
        cancelText="Batal"
        icon="smartphone"
        variant="primary"
      />

      {/* Dialog Notifikasi Berhasil / Gagal */}
      <ConfirmDialog
        visible={!!feedbackModal}
        onClose={() => setFeedbackModal(null)}
        onConfirm={() => setFeedbackModal(null)}
        title={feedbackModal?.title || ''}
        message={feedbackModal?.message || ''}
        confirmText="Tutup"
        singleButton={true}
        icon={feedbackModal?.variant === 'primary' ? 'check-circle' : 'alert-circle'}
        variant={feedbackModal?.variant || 'primary'}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  departmentPicker: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  departmentOption: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 16, backgroundColor: colors.surface },
  departmentOptionActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  departmentOptionText: { color: colors.muted, fontWeight: '600' },
  departmentOptionTextActive: { color: colors.primaryDark },
  container: {
    paddingBottom: 20,
  },
  formGroup: {
    marginBottom: 12,
  },
  hint: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 6,
    lineHeight: 18,
  },
  label: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: fontSize.sm,
    color: colors.ink,
    minHeight: 56,
  },
  createPasswordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingRight: 4,
    minHeight: 56,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 12,
    fontSize: fontSize.sm,
    color: colors.ink,
  },
  createEyeBtn: {
    padding: 10,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    flex: 1,
    fontSize: fontSize.xs,
    color: colors.danger,
    fontWeight: '700',
    lineHeight: 20,
  },
  emptyText: {
    fontSize: fontSize.xs,
    color: colors.faint,
    textAlign: 'center',
    paddingVertical: 16,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: {
    color: colors.ink,
    fontWeight: '700',
    fontSize: 13,
  },
  userName: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.ink,
  },
  userEmail: {
    fontSize: fontSize.xs,
    color: colors.muted,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  passwordLabel: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: '600',
  },
  passwordVal: {
    fontSize: 12,
    color: colors.ink,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  passwordWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deviceText: {
    fontSize: 11,
    color: colors.primaryDark,
    fontWeight: '700',
    marginTop: 2,
  },
  deptBadge: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  deptText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.muted,
  },
  iconBtn: {
    padding: 10,
  },
});
