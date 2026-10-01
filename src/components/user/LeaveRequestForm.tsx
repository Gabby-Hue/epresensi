import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Feather } from '@expo/vector-icons';
import { colors, fontSize, radius, spacing } from '../../theme';
import { select } from '../../services/feedbackService';
import { todayWIB } from '../../utils/dates';

const CAL_MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const CAL_MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

const toDateKey = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

const parseDateKey = (key: string): { y: number; m: number; d: number } | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(key || '');
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]) - 1, d: Number(m[3]) };
};

const formatDisplayDate = (key: string): string => {
  const p = parseDateKey(key);
  if (!p) return key;
  return `${p.d} ${CAL_MONTH_SHORT[p.m]} ${p.y}`;
};

interface LeaveRequestFormProps {
  onSubmit: (data: {
    startDate: string;
    endDate: string;
    reason: string;
    documentUrl?: string;
  }) => void;
  onBack: () => void;
  loading?: boolean;
}

export const LeaveRequestForm: React.FC<LeaveRequestFormProps> = ({ onSubmit, onBack, loading = false }) => {
  const today = todayWIB();
  const [leaveCategory, setLeaveCategory] = useState<'sakit' | 'izin'>('sakit');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [reason, setReason] = useState('');
  const [attachedUri, setAttachedUri] = useState<string | undefined>(undefined);
  const [attachedName, setAttachedName] = useState<string>('');
  const [pickerFor, setPickerFor] = useState<'start' | 'end' | null>(null);
  const [pickerYear, setPickerYear] = useState(() => new Date().getFullYear());
  const [pickerMonth, setPickerMonth] = useState(() => new Date().getMonth());

  const openPicker = (which: 'start' | 'end') => {
    select();
    const current = which === 'start' ? startDate : endDate;
    const p = parseDateKey(current);
    const now = new Date();
    setPickerYear(p ? p.y : now.getFullYear());
    setPickerMonth(p ? p.m : now.getMonth());
    setPickerFor(which);
  };

  const handlePickDay = (day: number) => {
    select();
    const picked = toDateKey(pickerYear, pickerMonth, day);
    if (pickerFor === 'start') {
      setStartDate(picked);
      // Kalau tanggal mulai melewati tanggal sampai, geser tanggal sampai ikut maju.
      if (picked > endDate) setEndDate(picked);
    } else if (pickerFor === 'end') {
      setEndDate(picked);
      // Kalau tanggal sampai mundur melewati tanggal mulai, geser tanggal mulai ikut mundur.
      if (picked < startDate) setStartDate(picked);
    }
    setPickerFor(null);
  };

  const handlePickDocument = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const asset = res.assets[0];
        setAttachedUri(asset.uri);
        setAttachedName(asset.name);
      }
    } catch {
      const imgRes = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
      });

      if (!imgRes.canceled && imgRes.assets[0]?.uri) {
        setAttachedUri(imgRes.assets[0].uri);
        setAttachedName('Surat_Keterangan.jpg');
      }
    }
  };

  const handleSubmit = () => {
    if (!reason.trim()) {
      Alert.alert('Alasan Diperlukan', 'Mohon isi keterangan atau alasan pengajuan secara jelas.');
      return;
    }

    const fullReason = `[${leaveCategory.toUpperCase()}] ${reason.trim()}`;

    onSubmit({
      startDate,
      endDate,
      reason: fullReason,
      documentUrl: attachedUri,
    });
  };

  return (
    <View style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        {/* Top App Bar Header */}
        <View style={styles.topBar}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onBack}
            style={styles.backButton}
            hitSlop={12}
          >
            <Feather name="arrow-left" size={22} color={colors.ink} />
          </TouchableOpacity>
          <View style={styles.topBarTextWrap}>
            <Text style={styles.topBarTitle}>Pengajuan Izin / Sakit</Text>
            <Text style={styles.topBarSubtitle}>Formulir Kehadiran Karyawan</Text>
          </View>
          <View style={{ width: 42 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Card: Tipe Pengajuan */}
          <View style={styles.sectionCard}>
            <Text style={styles.label}>Pilih Jenis Pengajuan</Text>
            <View style={styles.typeRow}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setLeaveCategory('sakit')}
                style={[
                  styles.typeTab,
                  leaveCategory === 'sakit' && styles.typeTabSakitActive,
                ]}
              >
                <View
                  style={[
                    styles.typeIconWrap,
                    leaveCategory === 'sakit' && styles.typeIconWrapActive,
                  ]}
                >
                  <Feather
                    name="activity"
                    size={20}
                    color={leaveCategory === 'sakit' ? '#FFFFFF' : colors.izin}
                  />
                </View>
                <Text
                  style={[
                    styles.typeTabText,
                    leaveCategory === 'sakit' && styles.typeTabTextActive,
                  ]}
                >
                  Sakit
                </Text>
                <Text
                  style={[
                    styles.typeTabSub,
                    leaveCategory === 'sakit' && styles.typeTabSubActive,
                  ]}
                >
                  Lampirkan surat dokter
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setLeaveCategory('izin')}
                style={[
                  styles.typeTab,
                  leaveCategory === 'izin' && styles.typeTabIzinActive,
                ]}
              >
                <View
                  style={[
                    styles.typeIconWrap,
                    leaveCategory === 'izin' && styles.typeIconWrapActive,
                  ]}
                >
                  <Feather
                    name="calendar"
                    size={20}
                    color={leaveCategory === 'izin' ? '#FFFFFF' : colors.primary}
                  />
                </View>
                <Text
                  style={[
                    styles.typeTabText,
                    leaveCategory === 'izin' && styles.typeTabTextActive,
                  ]}
                >
                  Izin
                </Text>
                <Text
                  style={[
                    styles.typeTabSub,
                    leaveCategory === 'izin' && styles.typeTabSubActive,
                  ]}
                >
                  Urusan penting / cuti
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Card: Periode Tanggal */}
          <View style={styles.sectionCard}>
            <Text style={styles.label}>Periode Tanggal</Text>
            <View style={styles.dateRow}>
              <View style={[styles.dateCol, { marginRight: 8 }]}>
                <Text style={styles.subLabel}>Mulai Tanggal</Text>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => openPicker('start')}
                  style={styles.inputWrap}
                >
                  <Feather name="calendar" size={16} color={colors.primary} style={styles.inputIcon} />
                  <Text style={styles.dateValue}>{formatDisplayDate(startDate)}</Text>
                  <Feather name="chevron-down" size={16} color={colors.faint} />
                </TouchableOpacity>
              </View>

              <View style={[styles.dateCol, { marginLeft: 8 }]}>
                <Text style={styles.subLabel}>Sampai Tanggal</Text>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => openPicker('end')}
                  style={styles.inputWrap}
                >
                  <Feather name="calendar" size={16} color={colors.primary} style={styles.inputIcon} />
                  <Text style={styles.dateValue}>{formatDisplayDate(endDate)}</Text>
                  <Feather name="chevron-down" size={16} color={colors.faint} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Card: Keterangan / Alasan */}
          <View style={styles.sectionCard}>
            <Text style={styles.label}>
              Keterangan Alasan <Text style={styles.requiredStar}>*</Text>
            </Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={reason}
              onChangeText={setReason}
              multiline
              numberOfLines={4}
              placeholder={
                leaveCategory === 'sakit'
                  ? 'Contoh: Demam tinggi dan flu, disarankan istirahat oleh dokter...'
                  : 'Contoh: Keperluan keluarga mendesak di luar kota...'
              }
              placeholderTextColor={colors.faint}
              textAlignVertical="top"
            />
          </View>

          {/* Card: Berkas / Surat Dokter */}
          <View style={styles.sectionCard}>
            <Text style={styles.label}>
              Surat Bukti / Berkas Pendukung{' '}
              <Text style={styles.optionalText}>(Opsional)</Text>
            </Text>
            {attachedUri ? (
              <View style={styles.attachmentBox}>
                <View style={styles.attachmentIconCircle}>
                  <Feather name="file-text" size={18} color={colors.primary} />
                </View>
                <View style={styles.attachmentInfo}>
                  <Text style={styles.attachmentName} numberOfLines={1}>
                    {attachedName || 'Berkas_Terlampir'}
                  </Text>
                  <Text style={styles.attachmentSub}>Berkas siap diunggah</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setAttachedUri(undefined)}
                  style={styles.removeBtn}
                  hitSlop={12}
                >
                  <Feather name="trash-2" size={18} color={colors.danger} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={handlePickDocument}
                style={styles.uploadArea}
              >
                <View style={styles.uploadIconWrap}>
                  <Feather name="upload-cloud" size={24} color={colors.primary} />
                </View>
                <Text style={styles.uploadTitle}>
                  {leaveCategory === 'sakit' ? 'Unggah Surat Dokter' : 'Unggah Dokumen Pendukung'}
                </Text>
                <Text style={styles.uploadHint}>Mendukung format JPG, PNG, atau PDF</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Info Banner */}
          <View style={styles.infoBanner}>
            <Feather name="info" size={18} color={colors.primary} style={{ marginRight: 10 }} />
            <Text style={styles.infoText}>
              Pengajuan izin/sakit akan langsung dikirim ke sistem dan masuk ke antrean persetujuan admin.
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <Button
              title={loading ? 'Mengajukan...' : 'Ajukan'}
              variant="primary"
              icon="send"
              loading={loading}
              disabled={loading}
              onPress={handleSubmit}
              style={styles.submitButton}
            />
            <Button
              title="Kembali ke Dashboard"
              variant="outline"
              icon="arrow-left"
              disabled={loading}
              onPress={onBack}
              style={styles.backActionButton}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={pickerFor !== null}
        onClose={() => setPickerFor(null)}
        title={pickerFor === 'start' ? 'Pilih Tanggal Mulai' : 'Pilih Tanggal Selesai'}
      >
        {/* Navigasi bulan */}
        <View style={styles.calNav}>
          <TouchableOpacity
            activeOpacity={0.7}
            hitSlop={8}
            onPress={() => {
              select();
              const d = new Date(pickerYear, pickerMonth - 1, 1);
              setPickerYear(d.getFullYear());
              setPickerMonth(d.getMonth());
            }}
            style={styles.calNavBtn}
          >
            <Feather name="chevron-left" size={18} color={colors.ink} />
          </TouchableOpacity>
          <Text style={styles.calNavTitle}>
            {CAL_MONTH_NAMES[pickerMonth]} {pickerYear}
          </Text>
          <TouchableOpacity
            activeOpacity={0.7}
            hitSlop={8}
            onPress={() => {
              select();
              const d = new Date(pickerYear, pickerMonth + 1, 1);
              setPickerYear(d.getFullYear());
              setPickerMonth(d.getMonth());
            }}
            style={styles.calNavBtn}
          >
            <Feather name="chevron-right" size={18} color={colors.ink} />
          </TouchableOpacity>
        </View>

        {/* Nama hari */}
        <View style={styles.calWeekRow}>
          {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map((lbl, idx) => (
            <View key={lbl} style={styles.calWeekCell}>
              <Text
                style={[
                  styles.calWeekText,
                  (idx === 0 || idx === 6) && { color: colors.izin },
                ]}
              >
                {lbl}
              </Text>
            </View>
          ))}
        </View>

        {/* Grid tanggal */}
        <View style={styles.calGrid}>
          {(() => {
            const firstDay = new Date(pickerYear, pickerMonth, 1).getDay();
            const daysInMonth = new Date(pickerYear, pickerMonth + 1, 0).getDate();
            const activeKey = pickerFor === 'start' ? startDate : endDate;
            const cells: Array<number | null> = [];
            for (let i = 0; i < firstDay; i++) cells.push(null);
            for (let d = 1; d <= daysInMonth; d++) cells.push(d);
            return cells.map((day, idx) => {
              if (day === null) {
                return <View key={`e-${idx}`} style={styles.calCell} />;
              }
              const key = toDateKey(pickerYear, pickerMonth, day);
              const isActive = key === activeKey;
              const weekday = new Date(pickerYear, pickerMonth, day).getDay();
              const isWeekend = weekday === 0 || weekday === 6;
              return (
                <View key={`d-${day}`} style={styles.calCell}>
                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={() => handlePickDay(day)}
                    style={[
                      styles.calDay,
                      isActive && styles.calDayActive,
                      !isActive && isWeekend && styles.calDayWeekend,
                    ]}
                  >
                    <Text
                      style={[
                        styles.calDayText,
                        isActive && styles.calDayTextActive,
                        !isActive && isWeekend && styles.calDayTextWeekend,
                      ]}
                    >
                      {day}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            });
          })()}
        </View>

        <Text style={styles.calHint}>
          Terpilih: {formatDisplayDate(pickerFor === 'start' ? startDate : endDate)}
        </Text>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTextWrap: {
    alignItems: 'center',
  },
  topBarTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.ink,
  },
  topBarSubtitle: {
    fontSize: fontSize.xs,
    color: colors.muted,
    marginTop: 2,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: 40,
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 10,
  },
  subLabel: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.muted,
    marginBottom: 6,
  },
  requiredStar: {
    color: colors.danger,
  },
  optionalText: {
    fontSize: fontSize.xs,
    fontWeight: '500',
    color: colors.muted,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  typeTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  typeTabSakitActive: {
    backgroundColor: colors.izinSoft,
    borderColor: colors.izin,
  },
  typeTabIzinActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  typeIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  typeIconWrapActive: {
    backgroundColor: colors.izin,
  },
  typeTabText: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.ink,
  },
  typeTabTextActive: {
    color: colors.ink,
  },
  typeTabSub: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
    textAlign: 'center',
  },
  typeTabSubActive: {
    color: colors.ink,
    fontWeight: '600',
  },
  dateRow: {
    flexDirection: 'row',
  },
  dateCol: {
    flex: 1,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FBFE',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 50,
    gap: 4,
  },
  dateValue: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.ink,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#F8FBFE',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: fontSize.sm,
    color: colors.ink,
    minHeight: 50,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  attachmentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.md,
    padding: 12,
  },
  attachmentIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  attachmentInfo: {
    flex: 1,
  },
  attachmentName: {
    fontSize: fontSize.sm,
    color: colors.ink,
    fontWeight: '700',
  },
  attachmentSub: {
    fontSize: fontSize.xs,
    color: colors.muted,
    marginTop: 2,
  },
  removeBtn: {
    padding: 8,
  },
  uploadArea: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    backgroundColor: '#F8FBFE',
    borderRadius: radius.md,
    paddingVertical: 22,
    paddingHorizontal: 16,
  },
  uploadIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  uploadTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.ink,
  },
  uploadHint: {
    fontSize: fontSize.xs,
    color: colors.muted,
    marginTop: 4,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoText: {
    flex: 1,
    fontSize: fontSize.xs,
    color: colors.muted,
    lineHeight: 18,
    fontWeight: '500',
  },
  buttonContainer: {
    gap: 10,
  },
  submitButton: {
    backgroundColor: colors.izin,
    borderColor: colors.izin,
  },
  backActionButton: {
    borderColor: colors.borderStrong,
  },
  calNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  calNavBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calNavTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.ink,
  },
  calWeekRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  calWeekCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
  },
  calWeekText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.muted,
  },
  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
  },
  calDay: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceSoft,
  },
  calDayActive: {
    backgroundColor: colors.primary,
  },
  calDayWeekend: {
    backgroundColor: colors.izinSoft,
  },
  calDayText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.ink,
  },
  calDayTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  calDayTextWeekend: {
    color: colors.izin,
  },
  calHint: {
    fontSize: fontSize.xs,
    color: colors.muted,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
