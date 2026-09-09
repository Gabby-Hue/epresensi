import React from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AttendanceRecord } from '../../types/attendance';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { Feather } from '@expo/vector-icons';
import { colors, fontSize, radius } from '../../theme';

interface LeaveDetailModalProps {
  visible: boolean;
  onClose: () => void;
  record: AttendanceRecord | null;
}

export const LeaveDetailModal: React.FC<LeaveDetailModalProps> = ({
  visible,
  onClose,
  record,
}) => {
  if (!record) return null;

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
            <View style={styles.imageBox}>
              <Image source={{ uri: record.documentUrl }} style={styles.docImage} resizeMode="cover" />
            </View>
          </View>
        )}

        {record.photoUrl && (
          <View style={styles.section}>
            <View style={styles.imageBox}>
              <Image source={{ uri: record.photoUrl }} style={styles.docImage} resizeMode="cover" />
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
});
