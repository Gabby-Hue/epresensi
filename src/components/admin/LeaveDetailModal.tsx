import React, { useState } from 'react';
import { Image, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { AttendanceRecord } from '../../types/attendance';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { Feather } from '@expo/vector-icons';
import { colors, fontSize, radius } from '../../theme';

interface LeaveDetailModalProps {
  visible: boolean;
  onClose: () => void;
  record: AttendanceRecord | null;
  /** Diisi admin saat record masih pending — memunculkan tombol Setujui/Tolak + catatan. */
  onApprove?: (note?: string) => Promise<void>;
  onReject?: (note?: string) => Promise<void>;
  processing?: boolean;
}

export const LeaveDetailModal: React.FC<LeaveDetailModalProps> = ({
  visible,
  onClose,
  record,
  onApprove,
  onReject,
  processing = false,
}) => {
  const [note, setNote] = useState('');
  if (!record) return null;

  const isPending = record.approvalStatus === 'pending';
  const showActions = isPending && (onApprove || onReject);

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title="Detail"
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.userCard}>
          <View style={styles.avatarBox}>
            <Text style={styles.avatarText}>{record.userName.substring(0, 2).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{record.userName}</Text>
            <Text style={styles.userEmail}>{record.userEmail}</Text>
          </View>
          <Badge type={record.type} />
        </View>

        <View style={styles.section}>
          <View style={styles.infoRow}>
            <Feather name="map-pin" size={16} color={colors.muted} style={styles.infoIcon} />
            <Text style={styles.infoValue}>
              {record.officeColor ? <Text style={{ color: record.officeColor }}>● </Text> : null}
              {record.officeName || (record.type === 'luring' ? 'Kantor' : record.type === 'daring' ? 'Rumah' : '-')}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Feather name="calendar" size={16} color={colors.muted} style={styles.infoIcon} />
            <Text style={styles.infoValue}>
              {record.startDate && record.endDate && record.startDate !== record.endDate
                ? `${record.startDate} - ${record.endDate}`
                : record.date}
              {' • '}
              {new Date(record.clockInTime).toLocaleTimeString('id-ID', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.reasonBox}>
            <Text style={styles.reasonText}>
              {record.reason || '-'}
            </Text>
          </View>
        </View>

        {record.documentUrl && (
          <View style={styles.section}>
            <Text style={styles.docTitle}>Dokumen surat:</Text>
            {/\.(png|jpe?g|webp|gif)(\?|#|$)/i.test(record.documentUrl) ? (
              <View style={styles.imageBox}>
                <Image source={{ uri: record.documentUrl }} style={styles.docImage} resizeMode="contain" />
              </View>
            ) : (
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.docOpenBtn}
                onPress={() => Linking.openURL(record.documentUrl as string).catch(() => {})}
              >
                <Feather name="file-text" size={18} color={colors.primaryDark} style={{ marginRight: 8 }} />
                <Text style={styles.docOpenText}>Buka Dokumen Surat</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {record.photoUrl && (
          <View style={styles.section}>
            <View style={styles.imageBox}>
              <Image source={{ uri: record.photoUrl }} style={styles.docImage} resizeMode="cover" />
            </View>
          </View>
        )}

        {isPending && (
          <View style={styles.pendingBanner}>
            <Feather name="clock" size={18} color="#B45309" style={{ marginRight: 8 }} />
            <Text style={styles.pendingText}>Menunggu keputusan admin.</Text>
          </View>
        )}

        {record.approvalStatus === 'rejected' && (
          <View style={styles.rejectedBanner}>
            <Feather name="x-circle" size={18} color="#475569" style={{ marginRight: 8 }} />
            <Text style={styles.rejectedText}>
              Ditolak{record.reviewNote ? `: ${record.reviewNote}` : '.'}
            </Text>
          </View>
        )}

        {record.approvalStatus === 'approved' && record.reviewNote ? (
          <View style={styles.section}>
            <View style={styles.reasonBox}>
              <Text style={styles.reasonText}>Catatan admin: {record.reviewNote}</Text>
            </View>
          </View>
        ) : null}

        {showActions && (
          <View style={styles.actionSection}>
            <Text style={styles.noteLabel}>Catatan keputusan (opsional)</Text>
            <TextInput
              style={styles.noteInput}
              value={note}
              onChangeText={setNote}
              placeholder="Contoh: surat dokter valid / stok cuti habis"
              placeholderTextColor={colors.faint}
              multiline
            />
            <View style={styles.actionRow}>
              {onReject && (
                <TouchableOpacity
                  activeOpacity={0.8}
                  disabled={processing}
                  onPress={() => onReject(note)}
                  style={[styles.actionBtn, styles.rejectBtn]}
                >
                  <Feather name="x" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.actionText}>{processing ? 'Memproses...' : 'Tolak'}</Text>
                </TouchableOpacity>
              )}
              {onApprove && (
                <TouchableOpacity
                  activeOpacity={0.8}
                  disabled={processing}
                  onPress={() => onApprove(note)}
                  style={[styles.actionBtn, styles.approveBtn]}
                >
                  <Feather name="check" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.actionText}>{processing ? 'Memproses...' : 'Setujui'}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: 20,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 12,
    borderRadius: radius.md,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarBox: {
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
    fontSize: 14,
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
  section: {
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  infoIcon: {
    marginRight: 6,
  },
  infoValue: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.ink,
  },
  reasonBox: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    borderRadius: radius.md,
  },
  reasonText: {
    fontSize: fontSize.xs,
    color: colors.ink,
    lineHeight: 20,
  },
  imageBox: {
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  docImage: {
    width: '100%',
    height: 200,
  },
  docTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 10,
  },
  docOpenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primaryDark,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  docOpenText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 16,
  },
  pendingText: {
    flex: 1,
    fontSize: fontSize.xs,
    color: '#B45309',
    fontWeight: '700',
  },
  rejectedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E2E8F0',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 16,
  },
  rejectedText: {
    flex: 1,
    fontSize: fontSize.xs,
    color: '#475569',
    fontWeight: '700',
  },
  actionSection: {
    marginTop: 4,
    marginBottom: 16,
  },
  noteLabel: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 6,
  },
  noteInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: fontSize.sm,
    color: colors.ink,
    minHeight: 56,
    marginBottom: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: radius.md,
    minHeight: 56,
  },
  rejectBtn: {
    backgroundColor: colors.danger,
  },
  approveBtn: {
    backgroundColor: colors.primary,
  },
  actionText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
