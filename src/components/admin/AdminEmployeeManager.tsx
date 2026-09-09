import React, { useState } from 'react';
import {
  Alert,
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
import { Feather } from '@expo/vector-icons';
import { colors, fontSize, radius } from '../../theme';

interface AdminEmployeeManagerProps {
  currentAdmin: UserProfile;
  users: UserProfile[];
  onChanged: () => void;
}

export const AdminEmployeeManager: React.FC<AdminEmployeeManagerProps> = ({
  currentAdmin,
  users,
  onChanged,
}) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [department, setDepartment] = useState('');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [editing, setEditing] = useState<UserProfile | null>(null);
  const [editName, setEditName] = useState('');
  const [editDept, setEditDept] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);

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
      createdBy: currentAdmin.id,
    });
    setLoading(false);
    if (!success) {
      setFormError(message);
      return;
    }
    setFullName('');
    setEmail('');
    setPassword('');
    setDepartment('');
    Alert.alert('Berhasil', message);
    onChanged();
  };

  const openEdit = (item: UserProfile) => {
    setEditing(item);
    setEditName(item.fullName);
    setEditDept(item.department || '');
    setEditError(null);
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    setEditError(null);
    if (!editName.trim()) {
      setEditError('Nama tidak boleh kosong.');
      return;
    }
    setEditSaving(true);
    const { success, message } = await AttendanceService.updateEmployeeAccount({
      id: editing.id,
      fullName: editName.trim(),
      department: editDept.trim() || 'General',
    });
    setEditSaving(false);
    if (!success) {
      setEditError(message);
      return;
    }
    setEditing(null);
    Alert.alert('Berhasil', message);
    onChanged();
  };

  const handleResetDevice = (item: UserProfile) => {
    Alert.alert(
      'Atur ulang perangkat?',
      `${item.fullName} bisa login dari HP baru. HP baru itu otomatis jadi perangkat resminya.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Reset',
          onPress: async () => {
            setResettingId(item.id);
            const { success, message } = await AttendanceService.resetEmployeeDevice(item.id);
            setResettingId(null);
            Alert.alert(success ? 'Berhasil' : 'Gagal', message);
            if (success) onChanged();
          },
        },
      ]
    );
  };

  const handleDelete = (item: UserProfile) => {
    Alert.alert(
      'Hapus akun?',
      `${item.fullName} (${item.email}) tidak bisa absen lagi. Lanjutkan?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(item.id);
            const { success, message } = await AttendanceService.deleteEmployeeAccount(item.id);
            setDeletingId(null);
            Alert.alert(success ? 'Berhasil' : 'Gagal', message);
            if (success) onChanged();
          },
        },
      ]
    );
  };

  const employees = users.filter((u) => u.role === 'employee');
  const mine = employees.filter((e) => e.createdBy === currentAdmin.id);

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
          <TextInput
            style={styles.input}
            placeholder="Contoh: Umum, Keuangan"
            placeholderTextColor={colors.faint}
            value={department}
            onChangeText={setDepartment}
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
          <View style={styles.passwordRow}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Minimal 6 karakter"
              placeholderTextColor={colors.faint}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn} hitSlop={12}>
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
        title={`Akun buatan saya (${mine.length})`}
        subtitle="Bisa diubah dan dihapus"
        icon="user-check"
      >
        {mine.length === 0 ? (
          <Text style={styles.emptyText}>Belum ada akun yang Anda buat.</Text>
        ) : (
          mine.map((item) => (
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
                <Text style={styles.deviceText}>
                  {item.deviceModel || item.deviceId
                    ? `Terkunci: ${item.deviceModel || item.deviceId}`
                    : 'Belum ada perangkat terkunci'}
                </Text>
              </View>
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

      <Card
        title={`Semua karyawan (${employees.length})`}
        subtitle="Termasuk akun dari admin lain"
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
              </View>
              <View style={styles.deptBadge}>
                <Text style={styles.deptText}>{item.department || 'Staff'}</Text>
              </View>
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
        <TextInput
          style={styles.input}
          value={editDept}
          onChangeText={setEditDept}
          placeholder="Departemen"
          placeholderTextColor={colors.faint}
        />
        <Button
          title={editSaving ? 'Menyimpan...' : 'Simpan perubahan'}
          icon="check"
          loading={editSaving}
          onPress={handleSaveEdit}
          style={{ marginTop: 16 }}
        />
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
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
  passwordRow: {
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
  eyeBtn: {
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
