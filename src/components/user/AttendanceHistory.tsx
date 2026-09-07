import React, { useState } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { AttendanceRecord } from '../../types/attendance';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { Feather } from '@expo/vector-icons';
import { colors, fontSize, radius } from '../../theme';

interface AttendanceHistoryProps {
  history: AttendanceRecord[];
}

export const AttendanceHistory: React.FC<AttendanceHistoryProps> = ({ history }) => {
  const [selectedItem, setSelectedItem] = useState<AttendanceRecord | null>(null);

  return (
    <Card
      title="Riwayat Presensi Saya"
      subtitle="Catatan waktu, lokasi, dan bukti swafoto kehadiran Anda"
      icon="clock"
    >
      {history.length === 0 ? (
        <View style={styles.emptyBox}>
          <Feather name="calendar" size={36} color={colors.faint} />
          <Text style={styles.emptyText}>Belum ada riwayat presensi.</Text>
        </View>
      ) : (
        history.map((record) => (
          <TouchableOpacity
            key={record.id}
            activeOpacity={0.7}
            onPress={() => setSelectedItem(record)}
            style={styles.historyRow}
          >
            <View style={styles.leftGroup}>
              {record.photoUrl ? (
                <Image source={{ uri: record.photoUrl }} style={styles.photoThumb} />
              ) : (
                <View style={styles.photoFallback}>
                  <Feather name="user-check" size={18} color={colors.ink} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.dateText}>{record.date}</Text>
                <Text style={styles.timeText}>
                  Jam masuk:{' '}
                  {new Date(record.clockInTime).toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  WIB {record.distanceMeters ? `• ${record.distanceMeters}m` : ''}
                </Text>
                {record.reason && (
                  <Text style={styles.reasonText} numberOfLines={1}>
                    "{record.reason}"
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.rightGroup}>
              <Badge type={record.type} size="sm" />
              <Feather name="chevron-right" size={16} color={colors.faint} style={{ marginTop: 4 }} />
            </View>
          </TouchableOpacity>
        ))
      )}

      {/* Detail Modal */}
      <Modal
        visible={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        title="Detail Presensi Saya"
      >
        {selectedItem && (
          <View>
            <View style={styles.modalHeaderRow}>
              <Badge type={selectedItem.type} />
              <Text style={styles.modalDate}>{selectedItem.date}</Text>
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                Waktu: {new Date(selectedItem.clockInTime).toLocaleTimeString('id-ID')} WIB
              </Text>
              {selectedItem.distanceMeters ? (
                <Text style={styles.infoText}>
                  Jarak ke kantor: {selectedItem.distanceMeters} meter
                </Text>
              ) : null}
              {selectedItem.reason ? (
                <Text style={styles.infoText}>Catatan: {selectedItem.reason}</Text>
              ) : null}
            </View>

            {selectedItem.photoUrl && (
              <View style={styles.photoSection}>
                <Text style={styles.sectionTitle}>Foto swafoto presensi:</Text>
                <Image source={{ uri: selectedItem.photoUrl }} style={styles.fullPhoto} />
              </View>
            )}
          </View>
        )}
      </Modal>
    </Card>
  );
};

const styles = StyleSheet.create({
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 28,
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.muted,
    marginTop: 10,
    fontWeight: '600',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  photoThumb: {
    width: 52,
    height: 52,
    borderRadius: 8,
    marginRight: 14,
  },
  photoFallback: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  dateText: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.ink,
  },
  timeText: {
    fontSize: fontSize.xs,
    color: colors.muted,
    marginTop: 3,
    fontWeight: '600',
  },
  reasonText: {
    fontSize: fontSize.xs,
    color: colors.muted,
    fontStyle: 'italic',
    marginTop: 3,
    fontWeight: '600',
  },
  rightGroup: {
    alignItems: 'flex-end',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalDate: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.ink,
  },
  infoBox: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    borderRadius: radius.md,
    marginBottom: 16,
  },
  infoText: {
    fontSize: fontSize.sm,
    color: colors.ink,
    marginBottom: 6,
    fontWeight: '600',
  },
  photoSection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 10,
  },
  fullPhoto: {
    width: '100%',
    height: 260,
    borderRadius: radius.md,
  },
});
