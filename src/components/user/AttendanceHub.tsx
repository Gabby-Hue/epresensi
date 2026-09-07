import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  AttendanceRecord,
  AttendanceType,
  OfficeSettings,
  SessionType,
  UserProfile,
} from '../../types/attendance';
import {
  calculateDistanceMeters,
  formatDistance,
  getCurrentLocation,
} from '../../services/locationService';
import { Modal } from '../ui/Modal';
import { MapView } from '../ui/MapView';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { CameraModal } from './CameraModal';
import { LeaveRequestForm } from './LeaveRequestForm';
import { StorageService } from '../../services/storageService';
import { Feather } from '@expo/vector-icons';
import { colors, fontSize, radius, session, spacing } from '../../theme';

interface AttendanceHubProps {
  user: UserProfile;
  officeSettings: OfficeSettings;
  userTodayStatus: AttendanceRecord | null;
  userHistory: AttendanceRecord[];
  onClockIn: (data: {
    type: AttendanceType;
    sessionType: SessionType;
    latitude?: number;
    longitude?: number;
    distanceMeters?: number;
    reason?: string;
    startDate?: string;
    endDate?: string;
    photoUrl?: string;
    documentUrl?: string;
  }) => Promise<void>;
  onLogout: () => void;
}

export const AttendanceHub: React.FC<AttendanceHubProps> = ({
  user,
  officeSettings,
  userTodayStatus,
  userHistory,
  onClockIn,
  onLogout,
}) => {
  const [mode, setMode] = useState<'masuk' | 'pulang' | 'izin'>('masuk');
  const [place, setPlace] = useState<'kantor' | 'rumah'>('kantor');
  const [currentDistance, setCurrentDistance] = useState<number | null>(null);
  const [currentCoords, setCurrentCoords] = useState({ latitude: officeSettings.latitude, longitude: officeSettings.longitude });
  const [locLoading, setLocLoading] = useState(false);
  const [reason, setReason] = useState('');
  const [pendingLeaveData, setPendingLeaveData] = useState<{
    startDate: string;
    endDate: string;
    reason: string;
    documentUrl?: string;
  } | null>(null);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [gpsStale, setGpsStale] = useState(false);
  const [showBlockedDialog, setShowBlockedDialog] = useState(false);
  const [blockedMessage, setBlockedMessage] = useState('');

  useEffect(() => {
    fetchLocation();
  }, [officeSettings]);

  const fetchLocation = async () => {
    setLocLoading(true);
    setLocError(null);
    setGpsStale(false);
    const { coords, errorMsg } = await getCurrentLocation();
    setCurrentCoords(coords);
    setCurrentDistance(
      calculateDistanceMeters(coords.latitude, coords.longitude, officeSettings.latitude, officeSettings.longitude)
    );
    if (errorMsg) {
      setLocError(errorMsg);
      setGpsStale(true);
    }
    setLocLoading(false);
  };

  const isWithinRadius = !gpsStale && currentDistance !== null && currentDistance <= officeSettings.radiusMeters;
  const blockReason =
    gpsStale || locError
      ? 'Lokasi belum valid. Nyalakan GPS dan tekan Cek ulang sampai jarak tampil.'
      : mode !== 'izin' && place === 'kantor' && currentDistance !== null && !isWithinRadius
        ? `Anda ${formatDistance(currentDistance)} dari kantor, batas ${officeSettings.radiusMeters} m. Pilih Dari rumah atau mendekat dulu.`
        : mode !== 'izin' && place === 'rumah' && !reason.trim()
          ? 'Tulis alasan kerja dari rumah dulu, contoh: dinas luar kota.'
          : null;
  const firstName = user.fullName.split(' ')[0];
  const todayLabel = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const handleMainAction = () => {
    if (blockReason) {
      setBlockedMessage(blockReason);
      setShowBlockedDialog(true);
      return;
    }
    setCameraVisible(true);
  };

  const handleLeaveFormSubmit = (data: { startDate: string; endDate: string; reason: string; documentUrl?: string }) => {
    setPendingLeaveData(data);
    setCameraVisible(true);
  };

  const handleConfirmPhotoSubmit = async (photoUri: string) => {
    setSubmitting(true);
    try {
      // 1. Upload swafoto ke Storage dulu -> dapat URL publik.
      const publicPhotoUrl = await StorageService.uploadAttendancePhoto(user.id, photoUri);

      if (mode === 'izin' && pendingLeaveData) {
        // Dokumen izin selama ini cuma path lokal HP -> upload juga bila ada.
        let publicDocUrl: string | undefined = undefined;
        const localDoc = pendingLeaveData.documentUrl;
        if (localDoc && !localDoc.startsWith('http')) {
          const fileName = localDoc.split('/').pop() || 'dokumen';
          publicDocUrl = await StorageService.uploadDocument(user.id, fileName, localDoc);
        } else if (localDoc) {
          publicDocUrl = localDoc;
        }

        await onClockIn({
          type: 'izin_sakit',
          sessionType: 'izin_sakit',
          reason: pendingLeaveData.reason,
          startDate: pendingLeaveData.startDate,
          endDate: pendingLeaveData.endDate,
          documentUrl: publicDocUrl,
          photoUrl: publicPhotoUrl,
        });
        setPendingLeaveData(null);
      } else {
        await onClockIn({
          type: place === 'kantor' ? 'luring' : 'daring',
          sessionType: mode === 'izin' ? 'izin_sakit' : mode,
          latitude: currentCoords.latitude,
          longitude: currentCoords.longitude,
          distanceMeters: currentDistance || 0,
          reason: place === 'rumah' ? reason : undefined,
          photoUrl: publicPhotoUrl,
        });
        setReason('');
      }
      setLastSavedAt(new Date().toISOString());
      Alert.alert('Berhasil', 'Absensi Anda sudah tersimpan di Supabase (foto, tanggal, jam, nama).');
    } catch (e: any) {
      Alert.alert('Gagal menyimpan', e?.message || 'Upload foto atau simpan absen gagal. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  const mainButtonTitle =
    mode === 'masuk' ? 'Absen Datang' : mode === 'pulang' ? 'Absen Pulang' : 'Kirim Pengajuan';

  return (
    <View style={styles.outer}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.greeting}>Halo, {firstName}</Text>
        <Text style={styles.date}>{todayLabel}</Text>

        <Card style={styles.statusCard}>
          <View style={styles.statusRow}>
            <Feather
              name={userTodayStatus ? 'check-circle' : 'clock'}
              size={28}
              color={userTodayStatus ? colors.successInk : colors.faint}
            />
            <View style={styles.statusText}>
              <Text style={styles.statusTitle}>
                {userTodayStatus
                  ? `Sudah absen ${userTodayStatus.sessionType === 'pulang' ? 'pulang' : 'datang'} jam ${new Date(userTodayStatus.clockInTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
                  : 'Belum absen hari ini'}
              </Text>
              <Text style={styles.statusSub}>
                {userTodayStatus ? 'Terima kasih, kehadiran tercatat.' : 'Yuk, absen dulu di bawah.'}
              </Text>
              {lastSavedAt && (
                <Text style={styles.savedNote}>
                  Terakhir tersimpan {new Date(lastSavedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} ke Supabase
                </Text>
              )}
            </View>
          </View>
        </Card>

        <View style={styles.progressRow}>
          <View style={[styles.progressDot, styles.progressDone]} />
          <View style={[styles.progressDot, mode === 'izin' ? styles.progressDone : styles.progressTodo]} />
          <View style={[styles.progressDot, styles.progressTodo]} />
        </View>
        <Text style={styles.step}>Langkah 1 dari 3 — Mau absen apa?</Text>
        <View style={styles.modeRow}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setMode('masuk')}
            style={[
              styles.modeBtn,
              mode === 'masuk' && { backgroundColor: session.masuk.main, borderColor: session.masuk.main },
            ]}
          >
            <Feather name="sunrise" size={28} color={mode === 'masuk' ? '#FFFFFF' : colors.ink} />
            <Text style={[styles.modeText, mode === 'masuk' && styles.modeTextActive]}>Datang</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setMode('pulang')}
            style={[
              styles.modeBtn,
              mode === 'pulang' && { backgroundColor: session.pulang.main, borderColor: session.pulang.main },
            ]}
          >
            <Feather name="sunset" size={28} color={mode === 'pulang' ? '#FFFFFF' : colors.ink} />
            <Text style={[styles.modeText, mode === 'pulang' && styles.modeTextActive]}>Pulang</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setMode('izin')}
            style={[
              styles.modeBtn,
              mode === 'izin' && { backgroundColor: session.izin.main, borderColor: session.izin.main },
            ]}
          >
            <Feather name="file-text" size={28} color={mode === 'izin' ? '#FFFFFF' : colors.ink} />
            <Text style={[styles.modeText, mode === 'izin' && styles.modeTextActive]}>Izin</Text>
          </TouchableOpacity>
        </View>

        {mode !== 'izin' && (
          <>
            <Text style={styles.step}>Langkah 2 dari 3 — Absen dari mana?</Text>
            <View style={styles.modeRow}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setPlace('kantor')}
                style={[styles.modeBtn, place === 'kantor' && styles.modeBtnActive]}
              >
                <Feather name="briefcase" size={28} color={place === 'kantor' ? '#FFFFFF' : colors.ink} />
                <Text style={[styles.modeText, place === 'kantor' && styles.modeTextActive]}>Kantor</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setPlace('rumah')}
                style={[styles.modeBtn, place === 'rumah' && styles.modeBtnActive]}
              >
                <Feather name="home" size={28} color={place === 'rumah' ? '#FFFFFF' : colors.ink} />
                <Text style={[styles.modeText, place === 'rumah' && styles.modeTextActive]}>Rumah</Text>
              </TouchableOpacity>
            </View>

            {place === 'rumah' && (
              <Card>
                <Text style={styles.label}>Alasan kerja dari rumah (wajib)</Text>
                <TextInput
                  style={[styles.input, !reason.trim() && styles.inputError]}
                  placeholder="Contoh: dinas luar kota"
                  placeholderTextColor={colors.faint}
                  value={reason}
                  onChangeText={setReason}
                />
                {!reason.trim() && (
                  <Text style={styles.fieldError}>Isi alasan dulu supaya tombol bisa ditekan.</Text>
                )}
              </Card>
            )}

            <Text style={styles.step}>Langkah 3 dari 3 — Cek posisi dan foto</Text>
            <Card>
              <MapView
                userLat={currentCoords.latitude}
                userLng={currentCoords.longitude}
                officeLat={officeSettings.latitude}
                officeLng={officeSettings.longitude}
                radiusMeters={officeSettings.radiusMeters}
                height={180}
              />
              <View style={styles.locRow}>
                <Text style={styles.locText}>
                  {locLoading ? 'Mengukur jarak...' : gpsStale || currentDistance === null ? 'Jarak: belum valid' : `Jarak: ${formatDistance(currentDistance)}`}
                </Text>
                <TouchableOpacity onPress={fetchLocation} style={styles.refresh} hitSlop={12}>
                  <Feather name="refresh-cw" size={18} color={colors.primary} />
                  <Text style={styles.refreshText}>Cek ulang</Text>
                </TouchableOpacity>
              </View>
              {(locError || gpsStale) && (
                <View style={styles.warnBanner}>
                  <Feather name="alert-triangle" size={18} color={colors.danger} style={{ marginRight: 8 }} />
                  <Text style={styles.warnText}>{locError || 'GPS belum valid.'}</Text>
                </View>
              )}
              <View style={[styles.locBadge, isWithinRadius ? styles.inBadge : styles.outBadge]}>
                <Text style={[styles.locBadgeText, { color: isWithinRadius ? colors.successInk : colors.danger }]}>
                  {locLoading
                    ? 'Mengukur posisi...'
                    : gpsStale
                      ? 'Nyalakan GPS lalu cek ulang'
                      : isWithinRadius
                        ? 'Posisi di dalam area kantor'
                        : `Di luar area (batas ${officeSettings.radiusMeters} m)`}
                </Text>
              </View>
              {blockReason && (
                <View style={styles.blockBanner}>
                  <Feather name="info" size={18} color={colors.danger} style={{ marginRight: 8 }} />
                  <Text style={styles.blockText}>{blockReason}</Text>
                </View>
              )}
              <Button
                title={submitting ? 'Menyimpan...' : mainButtonTitle}
                icon="camera"
                loading={submitting}
                disabled={submitting || !!blockReason}
                onPress={handleMainAction}
                style={[
                  styles.mainBtn,
                  {
                    backgroundColor: mode === 'masuk' ? session.masuk.main : session.pulang.main,
                    borderColor: mode === 'masuk' ? session.masuk.main : session.pulang.main,
                  },
                ]}
              />
            </Card>
          </>
        )}

        {mode === 'izin' && (
          <LeaveRequestForm onSubmit={handleLeaveFormSubmit} />
        )}

        <Text style={styles.step}>Riwayat absensi</Text>
        {userHistory.length === 0 ? (
          <Card>
            <Text style={styles.empty}>Belum ada riwayat absensi.</Text>
          </Card>
        ) : (
          userHistory.slice(0, 10).map((item) => (
            <Card key={item.id} style={styles.historyCard}>
              <View style={styles.historyRow}>
                <View style={styles.historyLeft}>
                  <Text style={styles.historyTitle}>
                    {item.sessionType === 'pulang' ? 'Pulang' : item.sessionType === 'izin_sakit' ? 'Izin' : 'Datang'}
                  </Text>
                  <Text style={styles.historyDate}>
                    {new Date(item.clockInTime).toLocaleDateString('id-ID', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })}
                    {' • '}
                    {new Date(item.clockInTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <Badge type={item.type} size="sm" />
              </View>
            </Card>
          ))
        )}

        <Button title="Keluar" variant="outline" icon="log-out" onPress={onLogout} style={styles.logout} />
      </ScrollView>

      <CameraModal
        visible={cameraVisible}
        onClose={() => setCameraVisible(false)}
        onConfirmPhoto={handleConfirmPhotoSubmit}
        attendanceTypeLabel={
          mode === 'izin' ? 'Izin' : `${mode === 'masuk' ? 'Datang' : 'Pulang'} (${place === 'kantor' ? 'Kantor' : 'Rumah'})`
        }
      />
      <Modal visible={showBlockedDialog} onClose={() => setShowBlockedDialog(false)} title="Belum bisa absen">
        <View style={styles.dialogBody}>
          <Text style={styles.dialogText}>{blockedMessage}</Text>
          <Button title="Mengerti" icon="check" onPress={() => setShowBlockedDialog(false)} style={{ marginTop: 16 }} />
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    padding: spacing.md,
    paddingBottom: 40,
  },
  greeting: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.ink,
  },
  date: {
    fontSize: fontSize.md,
    color: colors.muted,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  statusCard: {
    backgroundColor: colors.surface,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    flex: 1,
    marginLeft: spacing.md,
  },
  statusTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.ink,
    lineHeight: 24,
  },
  statusSub: {
    fontSize: fontSize.sm,
    color: colors.muted,
    marginTop: 2,
  },
  savedNote: {
    fontSize: fontSize.xs,
    color: colors.successInk,
    marginTop: 4,
    fontWeight: '700',
  },
  step: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.ink,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: spacing.lg,
    marginBottom: 4,
  },
  progressDot: {
    flex: 1,
    height: 6,
    borderRadius: 3,
  },
  progressDone: {
    backgroundColor: colors.primary,
  },
  progressTodo: {
    backgroundColor: colors.border,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modeBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 96,
    justifyContent: 'center',
  },
  modeBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  modeText: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.ink,
    marginTop: 6,
  },
  modeTextActive: {
    color: '#FFFFFF',
  },
  label: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: fontSize.md,
    color: colors.ink,
    minHeight: 56,
  },
  inputError: {
    borderColor: colors.danger,
  },
  fieldError: {
    fontSize: fontSize.xs,
    color: colors.danger,
    fontWeight: '700',
    marginTop: 6,
  },
  warnBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  warnText: {
    flex: 1,
    fontSize: fontSize.xs,
    color: colors.danger,
    fontWeight: '700',
    lineHeight: 20,
  },
  blockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  blockText: {
    flex: 1,
    fontSize: fontSize.xs,
    color: colors.ink,
    fontWeight: '600',
    lineHeight: 20,
  },
  dialogBody: {
    paddingBottom: spacing.sm,
  },
  dialogText: {
    fontSize: fontSize.md,
    color: colors.ink,
    lineHeight: 26,
  },
  locRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  locText: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.ink,
  },
  refresh: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
  },
  refreshText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.primary,
  },
  locBadge: {
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
    alignItems: 'center',
  },
  inBadge: {
    backgroundColor: colors.successSoft,
  },
  outBadge: {
    backgroundColor: colors.dangerSoft,
  },
  locBadgeText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  mainBtn: {
    marginTop: spacing.md,
  },
  historyCard: {
    marginBottom: spacing.sm,
    paddingVertical: spacing.md,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyLeft: {
    flex: 1,
    marginRight: spacing.sm,
  },
  historyTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.ink,
  },
  historyDate: {
    fontSize: fontSize.sm,
    color: colors.muted,
    marginTop: 2,
  },
  empty: {
    fontSize: fontSize.sm,
    color: colors.muted,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  logout: {
    marginTop: spacing.lg,
  },
});
