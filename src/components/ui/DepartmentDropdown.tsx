import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, fontSize, radius, touch } from '../../theme';
import { select, succeed, fail } from '../../services/feedbackService';
import { AttendanceService } from '../../services/attendanceService';

interface DepartmentDropdownProps {
  value: string;
  onChange: (value: string) => void;
  departments?: string[];
  onDepartmentsChange?: (departments: string[]) => void;
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
}

export const DepartmentDropdown: React.FC<DepartmentDropdownProps> = ({
  value,
  onChange,
  departments: propDepartments,
  onDepartmentsChange,
  placeholder = 'Pilih Departemen',
  style,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [localDepartments, setLocalDepartments] = useState<string[]>(
    propDepartments && propDepartments.length > 0
      ? propDepartments
      : ['Sales', 'IT', 'Drafter', 'Human Capital', 'Marketing']
  );
  const [isAdding, setIsAdding] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [addingLoading, setAddingLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Sinkronisasi data departemen dari backend jika prop tidak diberikan
  useEffect(() => {
    if (propDepartments && propDepartments.length > 0) {
      setLocalDepartments(propDepartments);
    } else {
      AttendanceService.getDepartments().then((list) => {
        if (list && list.length > 0) {
          setLocalDepartments(list);
          onDepartmentsChange?.(list);
        }
      });
    }
  }, [propDepartments]);

  const toggleDropdown = () => {
    select();
    setIsOpen((prev) => !prev);
    if (isOpen) {
      setIsAdding(false);
      setAddError(null);
    }
  };

  const handleSelectItem = (dept: string) => {
    select();
    onChange(dept);
    setIsOpen(false);
    setIsAdding(false);
    setAddError(null);
  };

  const handleStartAdd = () => {
    select();
    setIsAdding(true);
    setAddError(null);
    setNewDeptName('');
  };

  const handleCancelAdd = () => {
    select();
    setIsAdding(false);
    setAddError(null);
    setNewDeptName('');
  };

  const handleSaveDepartment = async () => {
    const trimmed = newDeptName.trim();
    if (!trimmed) {
      setAddError('Nama departemen tidak boleh kosong.');
      fail();
      return;
    }

    // Cek duplikasi lokal
    const exists = localDepartments.some(
      (d) => d.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) {
      setAddError('Departemen ini sudah ada.');
      fail();
      return;
    }

    setAddingLoading(true);
    setAddError(null);

    const res = await AttendanceService.addDepartment(trimmed);
    setAddingLoading(false);

    if (!res.success) {
      fail();
      setAddError(res.message);
      return;
    }

    succeed();
    const updatedList = res.departments.length > 0
      ? res.departments
      : Array.from(new Set([...localDepartments, trimmed])).sort();

    setLocalDepartments(updatedList);
    onDepartmentsChange?.(updatedList);
    onChange(trimmed); // Otomatis pilih departemen baru
    setNewDeptName('');
    setIsAdding(false);
    setIsOpen(false);
  };

  return (
    <View style={[styles.container, style]}>
      {/* Trigger Box */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={toggleDropdown}
        style={[
          styles.triggerBox,
          isOpen && styles.triggerBoxOpen,
        ]}
      >
        <View style={styles.triggerLeft}>
          <View style={[styles.iconWrap, value ? styles.iconWrapActive : null]}>
            <Feather
              name="briefcase"
              size={16}
              color={value ? colors.primaryDark : colors.muted}
            />
          </View>
          <Text
            style={[
              styles.triggerText,
              !value && styles.triggerPlaceholder,
            ]}
            numberOfLines={1}
          >
            {value || placeholder}
          </Text>
        </View>
        <Feather
          name={isOpen ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={isOpen ? colors.primary : colors.muted}
        />
      </TouchableOpacity>

      {/* Dropdown Panel */}
      {isOpen && (
        <View style={styles.dropdownPanel}>
          <ScrollView
            style={styles.listScroll}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            {localDepartments.map((dept) => {
              const isSelected = value === dept;
              return (
                <TouchableOpacity
                  key={dept}
                  activeOpacity={0.7}
                  onPress={() => handleSelectItem(dept)}
                  style={[
                    styles.itemRow,
                    isSelected && styles.itemRowSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.itemText,
                      isSelected && styles.itemTextSelected,
                    ]}
                  >
                    {dept}
                  </Text>
                  {isSelected && (
                    <Feather name="check" size={16} color={colors.primary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Section Tambah Departemen Baru */}
          <View style={styles.footerSection}>
            {isAdding ? (
              <View style={styles.addForm}>
                <View style={styles.addInputRow}>
                  <TextInput
                    style={styles.addInput}
                    placeholder="Nama departemen baru..."
                    placeholderTextColor={colors.faint}
                    value={newDeptName}
                    onChangeText={(t) => {
                      setNewDeptName(t);
                      if (addError) setAddError(null);
                    }}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={handleSaveDepartment}
                  />
                  <TouchableOpacity
                    onPress={handleCancelAdd}
                    style={styles.cancelAddBtn}
                    hitSlop={8}
                    disabled={addingLoading}
                  >
                    <Feather name="x" size={18} color={colors.muted} />
                  </TouchableOpacity>
                </View>

                {addError && (
                  <Text style={styles.addErrorText}>{addError}</Text>
                )}

                <TouchableOpacity
                  onPress={handleSaveDepartment}
                  style={styles.saveAddBtn}
                  disabled={addingLoading}
                  activeOpacity={0.85}
                >
                  {addingLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Feather name="check" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.saveAddBtnText}>Simpan Departemen</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={handleStartAdd}
                style={styles.startAddBtn}
                activeOpacity={0.7}
              >
                <Feather name="plus-circle" size={16} color={colors.primary} style={{ marginRight: 8 }} />
                <Text style={styles.startAddBtnText}>+ Tambah Departemen</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 10,
  },
  triggerBox: {
    minHeight: touch.inputMinHeight,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  triggerBoxOpen: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  triggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  iconWrapActive: {
    backgroundColor: colors.primarySoft,
  },
  triggerText: {
    fontSize: fontSize.sm,
    color: colors.ink,
    fontWeight: '600',
  },
  triggerPlaceholder: {
    color: colors.faint,
    fontWeight: '400',
  },
  dropdownPanel: {
    marginTop: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    overflow: 'hidden',
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  listScroll: {
    maxHeight: 200,
  },
  itemRow: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceSoft,
  },
  itemRowSelected: {
    backgroundColor: colors.primarySoft,
  },
  itemText: {
    fontSize: fontSize.sm,
    color: colors.ink,
    fontWeight: '500',
  },
  itemTextSelected: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  footerSection: {
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 10,
  },
  startAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  startAddBtnText: {
    fontSize: fontSize.xs,
    color: colors.primary,
    fontWeight: '700',
  },
  addForm: {
    gap: 8,
  },
  addInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingRight: 6,
  },
  addInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: fontSize.xs,
    color: colors.ink,
    height: 40,
  },
  cancelAddBtn: {
    padding: 6,
  },
  addErrorText: {
    fontSize: 11,
    color: colors.danger,
    fontWeight: '600',
    paddingHorizontal: 4,
  },
  saveAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  saveAddBtnText: {
    fontSize: fontSize.xs,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
