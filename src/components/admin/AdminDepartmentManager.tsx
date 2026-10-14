import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { DepartmentItem, UserProfile } from '../../types/attendance';
import { AttendanceService } from '../../services/attendanceService';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Feather } from '@expo/vector-icons';
import { colors, fontSize, radius } from '../../theme';
import { select, succeed, fail } from '../../services/feedbackService';

interface AdminDepartmentManagerProps {
  currentAdmin: UserProfile;
  users: UserProfile[];
  onChanged: () => void;
}

export const AdminDepartmentManager: React.FC<AdminDepartmentManagerProps> = ({
  currentAdmin,
  users,
  onChanged,
}) => {
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDeptName, setNewDeptName] = useState('');
  const [adding, setAdding] = useState(false);

  // Edit (Rename) Modal State
  const [editingDept, setEditingDept] = useState<DepartmentItem | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);

  // Reassign Modal State
  const [reassignSource, setReassignSource] = useState<DepartmentItem | null>(null);
  const [reassignTarget, setReassignTarget] = useState<string>('');
  const [reassigning, setReassigning] = useState(false);

  // Delete State
  const [deletingDept, setDeletingDept] = useState<DepartmentItem | null>(null);
  const [deleteFallbackDept, setDeleteFallbackDept] = useState<string>('');
  const [deleting, setDeleting] = useState(false);

  // Feedback Notification Modal
  const [feedbackDialog, setFeedbackDialog] = useState<{
    title: string;
    message: string;
    variant: 'primary' | 'danger';
  } | null>(null);

  const fetchDepartments = async () => {
    setLoading(true);
    const list = await AttendanceService.getDepartmentItems(currentAdmin.companyId || undefined);
    setDepartments(list);
    setLoading(false);
  };

  useEffect(() => {
    fetchDepartments();
  }, [currentAdmin.companyId, users]);

  const handleAddDepartment = async () => {
    const trimmed = newDeptName.trim();
    if (!trimmed) {
      setFeedbackDialog({
        title: 'Nama Kosong',
        message: 'Ketik nama departemen baru terlebih dahulu.',
        variant: 'danger',
      });
      return;
    }
    setAdding(true);
    const res = await AttendanceService.addDepartment(trimmed, currentAdmin.companyId || undefined);
    setAdding(false);
    if (!res.success) {
      fail();
      setFeedbackDialog({
        title: 'Gagal Menambah',
        message: res.message,
        variant: 'danger',
      });
      return;
    }
    succeed();
    setNewDeptName('');
    setFeedbackDialog({
      title: 'Berhasil',
      message: res.message,
      variant: 'primary',
    });
    await fetchDepartments();
    onChanged();
  };

  const openRename = (dept: DepartmentItem) => {
    select();
    setEditingDept(dept);
    setRenameValue(dept.name);
  };

  const handleSaveRename = async () => {
    if (!editingDept) return;
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setFeedbackDialog({
        title: 'Nama Kosong',
        message: 'Nama departemen tidak boleh kosong.',
        variant: 'danger',
      });
      return;
    }
    if (trimmed.toLowerCase() === editingDept.name.toLowerCase()) {
      setEditingDept(null);
      return;
    }
    setRenaming(true);
    const res = await AttendanceService.updateDepartment(editingDept.id, trimmed);
    setRenaming(false);
    if (!res.success) {
      fail();
      setFeedbackDialog({
        title: 'Gagal Mengubah Nama',
        message: res.message,
        variant: 'danger',
      });
      return;
    }
    succeed();
    setEditingDept(null);
    setFeedbackDialog({
      title: 'Berhasil',
      message: res.message,
      variant: 'primary',
    });
    await fetchDepartments();
    onChanged();
  };

  const openReassign = (dept: DepartmentItem) => {
    select();
    setReassignSource(dept);
    const targets = departments.filter((d) => d.id !== dept.id);
    setReassignTarget(targets[0]?.name || '');
  };

  const handleConfirmReassign = async () => {
    if (!reassignSource || !reassignTarget) return;
    setReassigning(true);
    const res = await AttendanceService.reassignDepartment(
      reassignSource.name,
      reassignTarget,
      currentAdmin.companyId || undefined
    );
    setReassigning(false);
    if (!res.success) {
      fail();
      setFeedbackDialog({
        title: 'Gagal Memindahkan',
        message: res.message,
        variant: 'danger',
      });
      return;
    }
    succeed();
    setReassignSource(null);
    setFeedbackDialog({
      title: 'Karyawan Berhasil Dipindahkan',
      message: res.message,
      variant: 'primary',
    });
    await fetchDepartments();
    onChanged();
  };

  const openDelete = (dept: DepartmentItem) => {
    select();
    setDeletingDept(dept);
    const availableTargets = departments.filter((d) => d.id !== dept.id);
    setDeleteFallbackDept(availableTargets[0]?.name || '');
  };

  const handleConfirmDelete = async () => {
    if (!deletingDept) return;
    setDeleting(true);
    const fallback = deletingDept.employeeCount > 0 ? deleteFallbackDept : undefined;
    const res = await AttendanceService.deleteDepartment(deletingDept.id, fallback);
    setDeleting(false);
    if (!res.success) {
      fail();
      setFeedbackDialog({
        title: 'Gagal Menghapus',
        message: res.message,
        variant: 'danger',
      });
      return;
    }
    succeed();
    setDeletingDept(null);
    setFeedbackDialog({
      title: 'Departemen Dihapus',
      message: res.message,
      variant: 'primary',
    });
    await fetchDepartments();
    onChanged();
  };

  const otherDepartmentsForReassign = reassignSource
    ? departments.filter((d) => d.id !== reassignSource.id)
    : [];

  const otherDepartmentsForDelete = deletingDept
    ? departments.filter((d) => d.id !== deletingDept.id)
    : [];

  return (
    <View style={styles.container}>
      {/* 1. KARTU HEADER & FORM TAMBAH DEPARTEMEN */}
      <Card
        title="Pengaturan Departemen"
        subtitle={`Kelola struktur departemen di ${currentAdmin.companyName || 'Cabang Anda'}`}
        icon="grid"
      >
        <Text style={styles.headerNotice}>
          Struktur departemen standar awal cabang: <Text style={styles.headerNoticeBold}>HR, Engginer, dan Sales</Text>. Anda dapat menambah divisi baru, mengubah nama, memindahkan karyawan, atau menghapus departemen yang sudah tidak digunakan.
        </Text>

        <View style={styles.addFormRow}>
          <TextInput
            style={styles.addInput}
            value={newDeptName}
            onChangeText={setNewDeptName}
            placeholder="Ketik nama departemen baru (contoh: Marketing, Finance)..."
            placeholderTextColor={colors.faint}
            onSubmitEditing={handleAddDepartment}
          />
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleAddDepartment}
            disabled={adding}
            style={styles.addBtn}
          >
            {adding ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Feather name="plus" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.addBtnText}>Tambah</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </Card>

      {/* 2. DAFTAR DEPARTEMEN AKTIF */}
      <Card
        title={`Daftar Departemen (${departments.length})`}
        subtitle="Daftar divisi dan jumlah karyawan yang terdaftar"
        icon="layers"
      >
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingText}>Memuat departemen...</Text>
          </View>
        ) : departments.length === 0 ? (
          <View style={styles.emptyBox}>
            <Feather name="folder" size={28} color={colors.faint} style={{ marginBottom: 6 }} />
            <Text style={styles.emptyText}>Belum ada departemen yang terdaftar.</Text>
          </View>
        ) : (
          departments.map((dept) => {
            const hasEmployees = dept.employeeCount > 0;
            return (
              <View key={dept.id} style={styles.deptRow}>
                <View style={styles.deptIconBadge}>
                  <Feather name="briefcase" size={18} color={colors.primary} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.deptName}>{dept.name}</Text>
                  <View style={styles.deptMetaRow}>
                    <View
                      style={[
                        styles.empCountBadge,
                        hasEmployees ? styles.empCountBadgeActive : styles.empCountBadgeEmpty,
                      ]}
                    >
                      <Feather
                        name="users"
                        size={11}
                        color={hasEmployees ? colors.primaryDark : colors.muted}
                        style={{ marginRight: 4 }}
                      />
                      <Text
                        style={[
                          styles.empCountText,
                          hasEmployees ? styles.empCountTextActive : styles.empCountTextEmpty,
                        ]}
                      >
                        {hasEmployees ? `${dept.employeeCount} Karyawan` : '0 Karyawan'}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.actionsRow}>
                  {/* Tombol Reassign Karyawan */}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => openReassign(dept)}
                    disabled={!hasEmployees}
                    style={[styles.actionBtn, !hasEmployees && styles.actionBtnDisabled]}
                    hitSlop={8}
                    accessibilityLabel="Pindahkan Karyawan"
                  >
                    <Feather
                      name="repeat"
                      size={15}
                      color={hasEmployees ? colors.primary : colors.faint}
                    />
                  </TouchableOpacity>

                  {/* Tombol Rename */}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => openRename(dept)}
                    style={styles.actionBtn}
                    hitSlop={8}
                    accessibilityLabel="Ubah Nama Departemen"
                  >
                    <Feather name="edit-2" size={15} color={colors.primary} />
                  </TouchableOpacity>

                  {/* Tombol Hapus */}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => openDelete(dept)}
                    style={styles.actionBtnDanger}
                    hitSlop={8}
                    accessibilityLabel="Hapus Departemen"
                  >
                    <Feather name="trash-2" size={15} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </Card>

      {/* 3. MODAL UBAH NAMA (RENAME) */}
      <Modal
        visible={!!editingDept}
        onClose={() => setEditingDept(null)}
        title={`Ubah Nama: ${editingDept?.name || ''}`}
      >
        <Text style={styles.modalLabel}>Nama Departemen Baru</Text>
        <TextInput
          style={styles.modalInput}
          value={renameValue}
          onChangeText={setRenameValue}
          placeholder="Nama departemen"
          placeholderTextColor={colors.faint}
          autoFocus
        />
        <Text style={styles.modalHint}>
          Seluruh karyawan yang berada di departemen ini otomatis disesuaikan dengan nama baru.
        </Text>
        <View style={styles.modalBtnRow}>
          <Button
            title="Batal"
            variant="outline"
            onPress={() => setEditingDept(null)}
            style={{ flex: 1 }}
          />
          <Button
            title={renaming ? 'Menyimpan...' : 'Simpan Nama'}
            icon="check"
            loading={renaming}
            onPress={handleSaveRename}
            style={{ flex: 1.2 }}
          />
        </View>
      </Modal>

      {/* 4. MODAL REASSIGN (PINDAHKAN KARYAWAN) */}
      <Modal
        visible={!!reassignSource}
        onClose={() => setReassignSource(null)}
        title="Pindahkan Karyawan Departemen"
      >
        <View style={styles.reassignInfoBox}>
          <Feather name="info" size={18} color={colors.primary} style={{ marginRight: 8, marginTop: 2 }} />
          <Text style={styles.reassignInfoText}>
            Pindahkan seluruh <Text style={{ fontWeight: '700' }}>{reassignSource?.employeeCount} karyawan</Text> dari departemen <Text style={{ fontWeight: '700' }}>"{reassignSource?.name}"</Text> ke departemen lain di bawah ini.
          </Text>
        </View>

        <Text style={[styles.modalLabel, { marginTop: 14 }]}>Pilih Departemen Tujuan:</Text>
        <View style={styles.chipGrid}>
          {otherDepartmentsForReassign.map((target) => {
            const isSelected = reassignTarget === target.name;
            return (
              <TouchableOpacity
                key={target.id}
                activeOpacity={0.7}
                onPress={() => {
                  select();
                  setReassignTarget(target.name);
                }}
                style={[styles.chipItem, isSelected && styles.chipItemActive]}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                  {target.name} ({target.employeeCount} orang)
                </Text>
                {isSelected && (
                  <Feather name="check" size={13} color={colors.primaryDark} style={{ marginLeft: 6 }} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.modalBtnRow}>
          <Button
            title="Batal"
            variant="outline"
            onPress={() => setReassignSource(null)}
            style={{ flex: 1 }}
          />
          <Button
            title={reassigning ? 'Memindahkan...' : 'Pindahkan Semua'}
            icon="repeat"
            loading={reassigning}
            disabled={!reassignTarget || otherDepartmentsForReassign.length === 0}
            onPress={handleConfirmReassign}
            style={{ flex: 1.4 }}
          />
        </View>
      </Modal>

      {/* 5. MODAL HAPUS DEPARTEMEN DENGAN PILIHAN REASSIGN */}
      {deletingDept && deletingDept.employeeCount > 0 && (
        <Modal
          visible={true}
          onClose={() => setDeletingDept(null)}
          title="Departemen Masih Berisi Karyawan"
        >
          <View style={styles.deleteWarnBox}>
            <Feather name="alert-triangle" size={20} color="#B45309" style={{ marginRight: 8, marginTop: 2 }} />
            <Text style={styles.deleteWarnText}>
              Departemen <Text style={{ fontWeight: '700' }}>"{deletingDept.name}"</Text> masih memiliki <Text style={{ fontWeight: '700' }}>{deletingDept.employeeCount} karyawan aktif</Text>.
            </Text>
          </View>
          <Text style={[styles.modalLabel, { marginTop: 12 }]}>
            Pindahkan karyawan yang tersisa ke departemen berikut sebelum menghapus:
          </Text>
          <View style={styles.chipGrid}>
            {otherDepartmentsForDelete.map((target) => {
              const isSelected = deleteFallbackDept === target.name;
              return (
                <TouchableOpacity
                  key={target.id}
                  activeOpacity={0.7}
                  onPress={() => {
                    select();
                    setDeleteFallbackDept(target.name);
                  }}
                  style={[styles.chipItem, isSelected && styles.chipItemActive]}
                >
                  <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                    {target.name}
                  </Text>
                  {isSelected && (
                    <Feather name="check" size={13} color={colors.primaryDark} style={{ marginLeft: 6 }} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.modalBtnRow}>
            <Button
              title="Batal"
              variant="outline"
              onPress={() => setDeletingDept(null)}
              style={{ flex: 1 }}
            />
            <Button
              title={deleting ? 'Memproses...' : 'Pindahkan & Hapus'}
              variant="danger"
              icon="trash-2"
              loading={deleting}
              disabled={!deleteFallbackDept || otherDepartmentsForDelete.length === 0}
              onPress={handleConfirmDelete}
              style={{ flex: 1.4 }}
            />
          </View>
        </Modal>
      )}

      {/* 6. CONFIRM DIALOG HAPUS KOSONG (0 KARYAWAN) */}
      {deletingDept && deletingDept.employeeCount === 0 && (
        <ConfirmDialog
          visible={true}
          onClose={() => setDeletingDept(null)}
          onConfirm={handleConfirmDelete}
          title="Hapus Departemen?"
          message={`Apakah Anda yakin ingin menghapus departemen "${deletingDept.name}"? Departemen ini tidak memiliki karyawan.`}
          confirmText={deleting ? 'Menghapus...' : 'Ya, Hapus'}
          cancelText="Batal"
          icon="trash-2"
          variant="danger"
        />
      )}

      {/* 7. DIALOG FEEDBACK */}
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
  container: {
    paddingBottom: 24,
  },
  headerNotice: {
    fontSize: fontSize.xs,
    color: colors.muted,
    lineHeight: 18,
    marginBottom: 14,
  },
  headerNoticeBold: {
    fontWeight: '700',
    color: colors.ink,
  },
  addFormRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: fontSize.sm,
    color: colors.ink,
    minHeight: 48,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radius.sm,
    minHeight: 48,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: fontSize.xs,
  },
  loadingBox: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  loadingText: {
    fontSize: fontSize.xs,
    color: colors.muted,
  },
  emptyBox: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: fontSize.xs,
    color: colors.muted,
  },
  deptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  deptIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  deptName: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.ink,
  },
  deptMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  empCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  empCountBadgeActive: {
    backgroundColor: colors.primarySoft,
  },
  empCountBadgeEmpty: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  empCountText: {
    fontSize: 11,
    fontWeight: '700',
  },
  empCountTextActive: {
    color: colors.primaryDark,
  },
  empCountTextEmpty: {
    color: colors.muted,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnDisabled: {
    opacity: 0.4,
  },
  actionBtnDanger: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalLabel: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: fontSize.sm,
    color: colors.ink,
    minHeight: 48,
  },
  modalHint: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 6,
    lineHeight: 16,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  reassignInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.primarySoft,
    padding: 12,
    borderRadius: radius.sm,
  },
  reassignInfoText: {
    flex: 1,
    fontSize: fontSize.xs,
    color: colors.primaryDark,
    lineHeight: 18,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
    marginBottom: 8,
  },
  chipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipItemActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: fontSize.xs,
    color: colors.muted,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  deleteWarnBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    padding: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  deleteWarnText: {
    flex: 1,
    fontSize: fontSize.xs,
    color: '#92400E',
    lineHeight: 18,
  },
});
