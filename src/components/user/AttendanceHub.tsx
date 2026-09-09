import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  Platform,
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
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { MapView } from '../ui/MapView';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { CameraModal } from './CameraModal';
import { LeaveRequestForm } from './LeaveRequestForm';
import { StorageService } from '../../services/storageService';
import { Feather } from '@expo/vector-icons';
import { colors, fontSize, radius, spacing } from '../../theme';

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

// Awal minggu (Senin jam 00:00) untuk filter "Kehadiran Minggu Ini".
const getWeekStart = (): Date => {
  const d = new Date();
  const day = (d.getDay() + 6) % 7; // Senin = 0, Minggu = 6
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
};

// Awal bulan berjalan untuk filter "Absensi Bulan Ini".
const getMonthStart = (): Date => {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), 1, 0, 0, 0, 0);
};

const formatLogDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

const formatLogTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });

export const AttendanceHub: React.FC<AttendanceHubProps> = ({
  user,
  officeSettings,
  userTodayStatus,
  userHistory,
  onClockIn,
  onLogout,
}) => {
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'leave_form'>('dashboard');
  const [mode, setMode] = useState<'masuk' | 'pulang'>('masuk');
  const [place, setPlace] = useState<'kantor' | 'rumah'>('kantor');
  const [currentDistance, setCurrentDistance] = useState<number | null>(null);
  const [currentCoords, setCurrentCoords] = useState({ latitude: officeSettings.latitude, longitude: officeSettings.longitude });
  const [locLoading, setLocLoading] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonTouched, setReasonTouched] = useState(false);
  const reasonInputRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);
  const [reasonCardY, setReasonCardY] = useState(0);
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
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AttendanceRecord | null>(null);

  const [showScrollTop, setShowScrollTop] = useState(false);

  // Toast "belum absen" — muncul sesaat menggantung dari atas, oranye, bisa disilang.
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastSlide = useRef(new Animated.Value(-80)).current;

  useEffect(() => {
    fetchLocation();
  }, [officeSettings]);

  // Tampilkan toast tiap user belum absen hari ini (tutup otomatis / silang).
  useEffect(() => {
    if (!userTodayStatus) {
      setToastVisible(true);
      Animated.spring(toastSlide, { toValue: 0, useNativeDriver: true }).start();
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => dismissToast(), 5000);
    } else {
      dismissToast();
    }
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userTodayStatus]);

  const dismissToast = () => {
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
      toastTimer.current = null;
    }
    Animated.timing(toastSlide, { toValue: -80, duration: 250, useNativeDriver: true }).start(() => {
      setToastVisible(false);
    });
  };

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
      : place === 'kantor' && currentDistance !== null && !isWithinRadius
        ? `Anda ${formatDistance(currentDistance)} dari kantor, batas ${officeSettings.radiusMeters} m. Pilih Dari rumah atau mendekat dulu.`
        : null;
  const firstName = user.fullName.split(' ')[0];
  const todayLabel = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  // ---- Data untuk tombol & logs (khusus sesi masuk / pulang) ----
  const todayStr = new Date().toISOString().split('T')[0];
  const todayMasuk = userHistory.find((r) => r.date === todayStr && r.sessionType === 'masuk');
  const todayPulang = userHistory.find((r) => r.date === todayStr && r.sessionType === 'pulang');

  const masukPulangLogs = userHistory
    .filter((r) => r.sessionType === 'masuk' || r.sessionType === 'pulang')
    .sort((a, b) => new Date(b.clockInTime).getTime() - new Date(a.clockInTime).getTime());

  const weekStart = getWeekStart();
  const monthStart = getMonthStart();
  const weekLogs = masukPulangLogs.filter((r) => new Date(r.clockInTime) >= weekStart);
  const monthLogs = masukPulangLogs.filter((r) => new Date(r.clockInTime) >= monthStart);

  const handleMainAction = () => {
    // Jika memilih dari rumah dan alasan masih kosong
    if (place === 'rumah' && !reason.trim()) {
      setReasonTouched(true);
      if (reasonCardY > 0) {
        // Posisikan kartu alasan tepat di tengah layar (central)
        const screenHeight = Dimensions.get('window').height;
        const targetScroll = Math.max(0, reasonCardY - (screenHeight / 2) + 100);
        scrollRef.current?.scrollTo({ y: targetScroll, animated: true });
      }
      setTimeout(() => {
        reasonInputRef.current?.focus();
      }, 200);
      return;
    }

    if (blockReason) {
      setBlockedMessage(blockReason);
      setShowBlockedDialog(true);
      return;
    }
    setCameraVisible(true);
  };

  const handleLeaveFormSubmit = (data: { startDate: string; endDate: string; reason: string; documentUrl?: string }) => {
    setPendingLeaveData(data);
    setCurrentPage('dashboard');
    setCameraVisible(true);
  };

  const handleConfirmPhotoSubmit = async (photoUri: string) => {
    setSubmitting(true);
    try {
      // 1. Upload swafoto ke Storage dulu -> dapat URL publik.
      const publicPhotoUrl = await StorageService.uploadAttendancePhoto(user.id, photoUri);

      if (pendingLeaveData) {
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
          sessionType: mode,
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

  const mainButtonTitle = mode === 'masuk' ? 'Absen Masuk' : 'Absen Pulang';

  const renderLogRow = (item: AttendanceRecord) => {
    const isMasuk = item.sessionType === 'masuk';
    return (
      <TouchableOpacity
        key={item.id}
        activeOpacity={0.7}
        onPress={() => setSelectedLog(item)}
        style={styles.logRow}
      >
        {item.photoUrl ? (
          <Image source={{ uri: item.photoUrl }} style={styles.logThumb} />
        ) : (
          <View style={styles.logFallback}>
            <Feather name="camera" size={20} color={colors.faint} />
          </View>
        )}
        <View style={styles.logInfo}>
          <Text style={styles.logTitle}>
            {isMasuk ? 'Masuk' : 'Pulang'}
            {' • '}
            {formatLogDate(item.clockInTime)}
          </Text>
          <Text style={styles.logSub}>
            {formatLogTime(item.clockInTime)} WIB
            {item.distanceMeters ? ` • ${item.distanceMeters} m` : ''}
          </Text>
        </View>
        <Badge type={item.type} size="sm" />
      </TouchableOpacity>
    );
  };

  const confirmLogout = () => {
    setShowLogoutDialog(true);
  };

  const renderEmptyLogs = () => (
    <View style={styles.emptyBox}>
      <Feather name="calendar" size={32} color={colors.faint} />
      <Text style={styles.emptyText}>Tidak ada data</Text>
    </View>
  );

  // Jika sedang di halaman formulir izin / sakit
  if (currentPage === 'leave_form') {
    return (
      <View style={styles.outer}>
        <LeaveRequestForm
          onSubmit={handleLeaveFormSubmit}
          onBack={() => setCurrentPage('dashboard')}
        />
        <CameraModal
          visible={cameraVisible}
          onClose={() => {
            setCameraVisible(false);
            setPendingLeaveData(null);
          }}
          onConfirmPhoto={handleConfirmPhotoSubmit}
          attendanceTypeLabel="Izin / Sakit"
        />
      </View>
    );
  }

  return (
    <View style={styles.outer}>
      {/* Toast "belum absen" — menggantung dari atas, oranye, auto-hilang + silang */}
      {toastVisible && (
        <Animated.View style={[styles.toast, { transform: [{ translateY: toastSlide }] }]}>
          <Feather name="alert-circle" size={20} color="#FFFFFF" style={{ marginRight: 10 }} />
          <Text style={styles.toastText}>Anda belum absen hari ini. Yuk, absen dulu di bawah.</Text>
          <TouchableOpacity onPress={dismissToast} hitSlop={12} style={styles.toastClose}>
            <Feather name="x" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </Animated.View>
      )}
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        onScroll={(e) => {
          const offsetY = e.nativeEvent.contentOffset.y;
          if (offsetY > 250) {
            if (!showScrollTop) setShowScrollTop(true);
          } else {
            if (showScrollTop) setShowScrollTop(false);
          }
        }}
        scrollEventThrottle={16}
      >
        {/* Kartu status hanya tampil kalau sudah absen — kalau belum, cukup toast di atas */}
        {userTodayStatus && (
        <Card style={styles.statusCard}>
          <View style={styles.statusRow}>
            <Feather
              name={userTodayStatus ? 'check-circle' : 'clock'}
              size={28}
              color={userTodayStatus ? colors.primary : colors.faint}
            />
            <View style={styles.statusText}>
              <Text style={styles.statusTitle}>
                {userTodayStatus
                  ? `Sudah absen ${userTodayStatus.sessionType === 'pulang' ? 'pulang' : 'masuk'} jam ${new Date(userTodayStatus.clockInTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
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
        )}

        {/* 1. Pilih Kehadiran — Masuk & Pulang sejajar */}
        <Text style={styles.sectionTitle}>Pilih Kehadiran</Text>
        <View style={styles.duoRow}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setMode('masuk')}
            style={[
              styles.actionBtn,
              mode === 'masuk' && { backgroundColor: colors.masuk, borderColor: colors.masuk },
            ]}
          >
            <Feather name="sunrise" size={20} color={mode === 'masuk' ? '#FFFFFF' : colors.masuk} />
            <Text style={[styles.actionText, mode === 'masuk' && styles.actionTextActive]}>Masuk</Text>
            <Text style={[styles.actionSub, mode === 'masuk' && styles.actionTextActive]}>
              {todayMasuk ? formatLogTime(todayMasuk.clockInTime) : 'Datang'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setMode('pulang')}
            style={[
              styles.actionBtn,
              mode === 'pulang' && { backgroundColor: colors.pulang, borderColor: colors.pulang },
            ]}
          >
            <Feather name="sunset" size={20} color={mode === 'pulang' ? '#FFFFFF' : colors.pulang} />
            <Text style={[styles.actionText, mode === 'pulang' && styles.actionTextActive]}>Pulang</Text>
            <Text style={[styles.actionSub, mode === 'pulang' && styles.actionTextActive]}>
              {todayPulang ? formatLogTime(todayPulang.clockInTime) : 'Pulang kerja'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 2. Tombol Navigasi ke Halaman Izin / Sakit */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setCurrentPage('leave_form')}
          style={styles.izinCard}
        >
          <View style={styles.izinIconWrap}>
            <Feather name="file-text" size={22} color={colors.izin} />
          </View>
          <View style={styles.izinTextWrap}>
            <Text style={styles.izinTitle}>
              Absensi / Izin / Sakit
            </Text>
            <Text style={styles.izinSub}>
              Buka formulir pengajuan izin atau sakit
            </Text>
          </View>
          <View style={styles.izinArrow}>
            <Feather
              name="chevron-right"
              size={20}
              color={colors.ink}
            />
          </View>
        </TouchableOpacity>

        {/* Lokasi absen: kantor / rumah */}
        <Text style={styles.sectionTitle}>Lokasi Absen</Text>
        <View style={styles.duoRow}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setPlace('kantor')}
            style={[styles.placeBtn, place === 'kantor' && styles.placeBtnActive]}
          >
            <Feather name="briefcase" size={22} color={place === 'kantor' ? '#FFFFFF' : colors.primary} />
            <Text style={[styles.placeText, place === 'kantor' && styles.actionTextActive]}>Kantor</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setPlace('rumah')}
            style={[styles.placeBtn, place === 'rumah' && styles.placeBtnActive]}
          >
            <Feather name="home" size={22} color={place === 'rumah' ? '#FFFFFF' : colors.primary} />
            <Text style={[styles.placeText, place === 'rumah' && styles.actionTextActive]}>Rumah</Text>
          </TouchableOpacity>
        </View>

        {place === 'rumah' && (
          <View
            onLayout={(e) => {
              setReasonCardY(e.nativeEvent.layout.y);
            }}
          >
            <Card>
              <Text
                style={[
                  styles.label,
                  reasonTouched && !reason.trim() && { color: colors.danger },
                ]}
              >
                Alasan kerja dari rumah (wajib)
              </Text>
              <TextInput
                ref={reasonInputRef}
                style={[
                  styles.input,
                  reasonTouched && !reason.trim() && styles.inputError,
                ]}
                placeholder="Contoh: dinas luar kota"
                placeholderTextColor={colors.faint}
                value={reason}
                onChangeText={(text) => {
                  setReason(text);
                  if (text.trim().length > 0 && reasonTouched) {
                    setReasonTouched(false);
                  }
                }}
              />
              {reasonTouched && !reason.trim() && (
                <Text style={styles.fieldError}>Isi alasan dulu sebelum menekan tombol absen.</Text>
              )}
            </Card>
          </View>
        )}

        {/* 3. Div terpisah — Lokasimu Saat Ini + peta */}
        <Text style={styles.sectionTitle}>Lokasimu Saat Ini</Text>
        <Card>
          <MapView
            userLat={currentCoords.latitude}
            userLng={currentCoords.longitude}
            officeLat={officeSettings.latitude}
            officeLng={officeSettings.longitude}
            radiusMeters={officeSettings.radiusMeters}
            height={200}
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
          <Button
            title={submitting ? 'Menyimpan...' : mainButtonTitle}
            icon="camera"
            loading={submitting}
            onPress={handleMainAction}
            textColor="#FFFFFF"
            style={styles.mainBtn}
          />
        </Card>

        {/* 4. Logs Kehadiran Minggu Ini — masuk & pulang + foto bukti */}
        <Text style={styles.sectionTitle}>Kehadiran Minggu Ini</Text>
        <Card style={styles.logCard}>
          {weekLogs.length === 0 ? renderEmptyLogs() : weekLogs.map(renderLogRow)}
        </Card>

        {/* 5. Logs Absensi Bulan Ini — masuk & pulang + foto bukti */}
        <Text style={styles.sectionTitle}>Absensi Bulan Ini</Text>
        <Card style={styles.logCard}>
          {monthLogs.length === 0 ? renderEmptyLogs() : monthLogs.map(renderLogRow)}
        </Card>
      </ScrollView>

      {/* Floating Scroll To Top Button */}
      {showScrollTop && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            scrollRef.current?.scrollTo({ y: 0, animated: true });
          }}
          style={styles.floatingScrollTopBtn}
          hitSlop={8}
        >
          <Feather name="arrow-up" size={22} color={colors.ink} />
        </TouchableOpacity>
      )}

      {/* Floating Shutdown / Logout Button di pojok kanan bawah */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={confirmLogout}
        style={styles.floatingLogoutBtn}
        hitSlop={8}
      >
        <Feather name="power" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      <CameraModal
        visible={cameraVisible}
        onClose={() => {
          setCameraVisible(false);
          setPendingLeaveData(null);
        }}
        onConfirmPhoto={handleConfirmPhotoSubmit}
        attendanceTypeLabel={`${mode === 'masuk' ? 'Masuk' : 'Pulang'} (${place === 'kantor' ? 'Kantor' : 'Rumah'})`}
      />

      <ConfirmDialog
        visible={showLogoutDialog}
        onClose={() => setShowLogoutDialog(false)}
        onConfirm={onLogout}
        title="Konfirmasi Keluar"
        message="Apakah Anda yakin ingin keluar dari akun ini?"
        confirmText="Ya, Keluar"
        cancelText="Batal"
        icon="log-out"
        variant="danger"
      />

      <ConfirmDialog
        visible={showBlockedDialog}
        onClose={() => setShowBlockedDialog(false)}
        onConfirm={() => setShowBlockedDialog(false)}
        title="Di Luar Area Kantor"
        message={blockedMessage || `Anda berada di luar radius kantor (batas ${officeSettings.radiusMeters} meter). Silakan mendekat ke area kantor untuk melakukan presensi.`}
        confirmText="Kembali"
        icon="x"
        variant="danger"
        singleButton={true}
      />

      {/* Detail log + foto bukti */}
      <Modal visible={!!selectedLog} onClose={() => setSelectedLog(null)} title="Bukti Kehadiran">
        {selectedLog && (
          <View>
            <View style={styles.modalHeaderRow}>
              <Badge type={selectedLog.type} />
              <Text style={styles.modalDate}>{formatLogDate(selectedLog.clockInTime)}</Text>
            </View>
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                {selectedLog.sessionType === 'pulang' ? 'Pulang' : 'Masuk'}: {formatLogTime(selectedLog.clockInTime)} WIB
              </Text>
              {selectedLog.distanceMeters ? (
                <Text style={styles.infoText}>
                  Jarak ke kantor: {selectedLog.distanceMeters} meter
                </Text>
              ) : null}
              {selectedLog.reason ? (
                <Text style={styles.infoText}>Catatan: {selectedLog.reason}</Text>
              ) : null}
            </View>
            {selectedLog.photoUrl ? (
              <View style={styles.photoSection}>
                <Text style={styles.photoTitle}>Foto bukti presensi:</Text>
                <Image source={{ uri: selectedLog.photoUrl }} style={styles.fullPhoto} />
              </View>
            ) : (
              <Text style={styles.noPhotoText}>Tidak ada foto bukti untuk catatan ini.</Text>
            )}
          </View>
        )}
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // Toast "belum absen" — menggantung dari atas, oranye
  toast: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    zIndex: 50,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.pulang,
    borderRadius: radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  toastText: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 22,
  },
  toastClose: {
    padding: 6,
    marginLeft: 8,
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
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.ink,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  // --- Masuk & Pulang sejajar ---
  duoRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    minHeight: 62,
    justifyContent: 'center',
  },
  actionText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.ink,
    marginTop: 4,
  },
  actionSub: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted,
    marginTop: 1,
  },
  actionTextActive: {
    color: '#FFFFFF',
  },
  // --- Div terpisah izin/sakit ---
  izinCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  izinIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.izinSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  izinTextWrap: {
    flex: 1,
  },
  izinTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.ink,
  },
  izinSub: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.muted,
    marginTop: 2,
  },
  izinArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // --- Lokasi kantor/rumah ---
  placeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  placeBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  placeText: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.ink,
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
  // --- Lokasi + peta ---
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
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  // --- Logs mingguan & bulanan ---
  logCard: {
    paddingVertical: spacing.sm,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  logThumb: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: colors.surfaceSoft,
  },
  logFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 12,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logInfo: {
    flex: 1,
    marginRight: 8,
  },
  logTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.ink,
  },
  logSub: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.muted,
    marginTop: 3,
  },
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
  floatingLogoutBtn: {
    position: 'absolute',
    bottom: 22,
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 40,
  },
  floatingScrollTopBtn: {
    position: 'absolute',
    bottom: 90,
    right: 24,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 6,
    zIndex: 40,
  },
  // --- Modal detail log ---
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
  photoTitle: {
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
  noPhotoText: {
    fontSize: fontSize.sm,
    color: colors.muted,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 12,
  },
});
