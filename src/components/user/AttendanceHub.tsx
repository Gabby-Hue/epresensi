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
import { MonthAttendanceCalendar } from './MonthAttendanceCalendar';
import { ProfileScreen } from './ProfileScreen';
import { BottomNavBar, UserTabKey } from '../ui/BottomNavBar';
import { StorageService } from '../../services/storageService';
import { succeed, fail, select } from '../../services/feedbackService';
import { isWeekendDateString } from '../../utils/dates';
import { Feather } from '@expo/vector-icons';
import { colors, fontSize, neoShadow, radius, spacing } from '../../theme';

interface AttendanceHubProps {
  user: UserProfile;
  officeSettings: OfficeSettings;
  officeList: OfficeSettings[];
  userTodayStatus: AttendanceRecord | null;
  userHistory: AttendanceRecord[];
  onClockIn: (data: {
    type: AttendanceType;
    sessionType: SessionType;
    latitude?: number;
    longitude?: number;
    distanceMeters?: number;
    officeName?: string;
    officeColor?: string;
    reason?: string;
    startDate?: string;
    endDate?: string;
    photoUrl?: string;
    documentUrl?: string;
  }) => Promise<void>;
  onLogout: () => void;
  onUpdateUser?: (updated: UserProfile) => void;
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
  officeList,
  userTodayStatus,
  userHistory,
  onClockIn,
  onLogout,
  onUpdateUser,
}) => {
  const offices = officeList.length > 0 ? officeList : [officeSettings];
  const [activeTab, setActiveTab] = useState<UserTabKey | 'izin'>('presensi');
  const [mode, setMode] = useState<'masuk' | 'pulang'>('masuk');
  const [place, setPlace] = useState<'kantor' | 'rumah'>('kantor');
  const [currentDistance, setCurrentDistance] = useState<number | null>(null);
  const [nearestOffice, setNearestOffice] = useState<OfficeSettings>(offices[0]);
  const [currentCoords, setCurrentCoords] = useState({ latitude: offices[0].latitude, longitude: offices[0].longitude });
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
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [calDay, setCalDay] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Toast "belum absen" — muncul sesaat menggantung dari atas, oranye, bisa disilang.
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastSlide = useRef(new Animated.Value(-80)).current;

  useEffect(() => {
    setNearestOffice(offices[0]);
    fetchLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [officeSettings.id, offices.length]);

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
    // Cari titik kantor terdekat dari posisi user
    let best = offices[0];
    let bestDist = calculateDistanceMeters(coords.latitude, coords.longitude, best.latitude, best.longitude);
    for (const office of offices.slice(1)) {
      const d = calculateDistanceMeters(coords.latitude, coords.longitude, office.latitude, office.longitude);
      if (d < bestDist) {
        best = office;
        bestDist = d;
      }
    }
    setNearestOffice(best);
    setCurrentDistance(bestDist);
    if (errorMsg) {
      setLocError(errorMsg);
      setGpsStale(true);
    }
    setLocLoading(false);
  };

  const isWithinRadius = !gpsStale && currentDistance !== null && currentDistance <= nearestOffice.radiusMeters;
  const blockReason =
    gpsStale || locError
      ? 'Lokasi belum valid. Nyalakan GPS dan tekan Cek ulang sampai jarak tampil.'
      : place === 'kantor' && currentDistance !== null && !isWithinRadius
        ? `Anda ${formatDistance(currentDistance)} dari ${nearestOffice.officeName}, batas ${nearestOffice.radiusMeters} m. Pilih Dari rumah atau mendekat dulu.`
        : null;
  const firstName = user.fullName.split(' ')[0];
  const todayLabel = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Waktu real-time & salam
  const curHour = currentTime.getHours();
  const curMin = currentTime.getMinutes();
  const curSec = currentTime.getSeconds();
  const currentTimeString = `${String(curHour).padStart(2, '0')}:${String(curMin).padStart(2, '0')}:${String(curSec).padStart(2, '0')}`;

  const getGreeting = (h: number) => {
    if (h >= 4 && h < 11) return 'Selamat Pagi';
    if (h >= 11 && h < 15) return 'Selamat Siang';
    if (h >= 15 && h < 18) return 'Selamat Sore';
    return 'Selamat Malam';
  };
  const greeting = getGreeting(curHour);

  // Aturan jam datang: 08:00 - 10:00 (sebelum 08:00 tetap sah tepat waktu).
  // Lewat pukul 10:00 dikategorikan Terlambat.
  const isLateCheckIn = curHour > 10 || (curHour === 10 && curMin > 0);

  // Aturan jam pulang: terkunci sebelum pukul 17:00 WIB hingga batas 00:00 (23:59:59).
  const isClockOutUnlocked = curHour >= 17;

  // Inisial foto profil
  const initials = user.fullName
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  // Rekap Presensi Bulan Ini (ala Stitch Enterprise: Hadir Tepat, Terlambat, Izin/Cuti)
  const currentMonthStart = getMonthStart();
  const currentMonthName = new Date().toLocaleDateString('id-ID', { month: 'long' });
  const monthAllRecords = userHistory.filter((r) => new Date(r.clockInTime) >= currentMonthStart);

  const onTimeCount = monthAllRecords.filter((r) => {
    if (r.sessionType !== 'masuk') return false;
    const d = new Date(r.clockInTime);
    const h = d.getHours();
    const m = d.getMinutes();
    return h < 10 || (h === 10 && m === 0);
  }).length;

  const lateCount = monthAllRecords.filter((r) => {
    if (r.sessionType !== 'masuk') return false;
    const d = new Date(r.clockInTime);
    const h = d.getHours();
    const m = d.getMinutes();
    return h > 10 || (h === 10 && m > 0);
  }).length;

  const leaveCount = monthAllRecords.filter(
    (r) => r.type === 'izin_sakit' || r.sessionType === 'izin_sakit'
  ).length;

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
    // Jika memilih mode pulang dan belum jam 17:00 WIB
    if (mode === 'pulang' && !isClockOutUnlocked) {
      setBlockedMessage(
        'Presensi pulang saat ini terkunci. Sesuai jam operasional, presensi pulang hanya dapat direkam mulai pukul 17:00 hingga 00:00 WIB.'
      );
      setShowBlockedDialog(true);
      return;
    }

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

  const handleLeaveFormSubmit = async (data: {
    startDate: string;
    endDate: string;
    reason: string;
    documentUrl?: string;
  }) => {
    setSubmitting(true);
    try {
      let publicDocUrl: string | undefined = undefined;
      const localDoc = data.documentUrl;
      if (localDoc && !localDoc.startsWith('http')) {
        const fileName = localDoc.split('/').pop() || 'dokumen';
        publicDocUrl = await StorageService.uploadDocument(user.id, fileName, localDoc);
      } else if (localDoc) {
        publicDocUrl = localDoc;
      }

      await onClockIn({
        type: 'izin_sakit',
        sessionType: 'izin_sakit',
        reason: data.reason,
        startDate: data.startDate,
        endDate: data.endDate,
        documentUrl: publicDocUrl,
      });

      succeed();
      Alert.alert(
        'Berhasil',
        'Pengajuan izin/sakit berhasil dikirim dan menunggu persetujuan admin.'
      );
      setActiveTab('presensi');
    } catch (e: any) {
      fail();
      Alert.alert('Gagal Mengajukan', e?.message || 'Pengajuan gagal dikirim. Silakan coba lagi.');
    } finally {
      setSubmitting(false);
    }
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
        const now = new Date();
        const h = now.getHours();
        const m = now.getMinutes();
        const isLate = mode === 'masuk' && (h > 10 || (h === 10 && m > 0));
        let finalReason = place === 'rumah' ? reason.trim() : undefined;
        if (isLate) {
          finalReason = finalReason ? `${finalReason} (Terlambat: Masuk > 10:00)` : 'Terlambat (> 10:00 WIB)';
        }

        await onClockIn({
          type: place === 'kantor' ? 'luring' : 'daring',
          sessionType: mode,
          latitude: currentCoords.latitude,
          longitude: currentCoords.longitude,
          distanceMeters: currentDistance || 0,
          officeName: place === 'kantor' ? nearestOffice.officeName : undefined,
          officeColor: place === 'kantor' ? nearestOffice.color : undefined,
          reason: finalReason,
          photoUrl: publicPhotoUrl,
        });
        setReason('');
      }
      setLastSavedAt(new Date().toISOString());
      succeed();
      Alert.alert(
        'Berhasil',
        pendingLeaveData
          ? 'Pengajuan dikirim dan menunggu persetujuan admin.'
          : 'Absensi Anda sudah tersimpan di sistem (foto, tanggal, jam, status).'
      );
    } catch (e: any) {
      fail();
      Alert.alert('Gagal menyimpan', e?.message || 'Upload foto atau simpan absen gagal. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  const mainButtonTitle =
    mode === 'masuk'
      ? isLateCheckIn
        ? 'Absen Masuk (Terlambat)'
        : 'Absen Masuk (Tepat Waktu)'
      : !isClockOutUnlocked
        ? 'Presensi Pulang Terkunci (Buka 17:00)'
        : 'Absen Pulang';

  const renderLogRow = (item: AttendanceRecord) => {
    const isMasuk = item.sessionType === 'masuk';
    // Absen di Sabtu/Minggu = lembur (override tanggal merah)
    const isLembur =
      isWeekendDateString(item.date) && (item.sessionType === 'masuk' || item.sessionType === 'pulang');
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
            {isLembur ? 'Lembur' : isMasuk ? 'Masuk' : 'Pulang'}
            {' • '}
            {formatLogDate(item.clockInTime)}
          </Text>
          <Text style={styles.logSub}>
            {formatLogTime(item.clockInTime)} WIB
            {item.distanceMeters ? ` • ${item.distanceMeters} m` : ''}
            {item.officeName ? (
              <>
                {' • '}
                {item.officeColor ? <Text style={{ color: item.officeColor }}>● </Text> : null}
                {item.officeName}
              </>
            ) : ''}
          </Text>
        </View>
        {item.type === 'izin_sakit' && item.approvalStatus === 'pending' ? (
          <Badge type="menunggu" size="sm" />
        ) : item.type === 'izin_sakit' && item.approvalStatus === 'rejected' ? (
          <Badge type="ditolak" size="sm" />
        ) : (
          <Badge type={item.type} size="sm" />
        )}
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

  const renderPresensiTab = () => (
    <View style={{ flex: 1 }}>
      {/* Toast "belum absen" */}
      {toastVisible && (
        <Animated.View style={[styles.toast, neoShadow.md, { transform: [{ translateY: toastSlide }] }]}>
          <Feather name="alert-circle" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.toastText}>Anda belum melakukan presensi hari ini.</Text>
          <TouchableOpacity onPress={dismissToast} hitSlop={12} style={styles.toastClose}>
            <Feather name="x" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </Animated.View>
      )}

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* 1. Header Profil & Telemetri Waktu */}
        <View style={styles.masthead}>
          <View style={styles.mastheadTopRow}>
            <View style={styles.employeeInfo}>
              <Text style={styles.greetingText}>{greeting},</Text>
              <Text style={styles.employeeName} numberOfLines={1}>
                {user.fullName}
              </Text>
              <Text style={styles.employeeMeta}>
                {user.department || 'Operasional'} • ID {user.id ? `EP-${String(user.id).padStart(4, '0')}` : 'EP-0001'}
              </Text>
            </View>

            <View style={styles.clockTelemetry}>
              <Text style={styles.clockDigits}>{currentTimeString}</Text>
              <Text style={styles.clockDateText}>{todayLabel}</Text>
            </View>
          </View>

          <View style={styles.mastheadDivider} />

          <View style={styles.mastheadBottomRow}>
            <View style={styles.shiftCol}>
              <Text style={styles.bottomRowLabel}>Jadwal Shift</Text>
              <View style={styles.shiftValueRow}>
                <Text style={styles.shiftTimeText}>08:00 – 17:00</Text>
                <Text style={isLateCheckIn ? styles.lateStatusText : styles.onTimeStatusText}>
                  • {isLateCheckIn ? 'Terlambat (> 10:00)' : 'Tepat Waktu'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                select();
                setActiveTab('kalender');
              }}
              style={styles.recapLink}
            >
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.bottomRowLabel}>Bulan Ini</Text>
                <Text style={styles.recapValueText}>
                  {onTimeCount} Hadir • {leaveCount} Izin
                </Text>
              </View>
              <Feather name="chevron-right" size={16} color={colors.primary} style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Banner Status Presensi Hari Ini (Jika sudah pernah absen) */}
        {userTodayStatus && (
          <View style={[styles.todaySuccessBanner, neoShadow.sm]}>
            <Feather name="check-circle" size={18} color={colors.successInk} style={{ marginRight: 8 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.todaySuccessTitle}>
                Sudah absen {userTodayStatus.sessionType === 'pulang' ? 'pulang' : 'masuk'} jam {new Date(userTodayStatus.clockInTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
              </Text>
              {lastSavedAt && (
                <Text style={styles.todaySuccessSub}>
                  Tersimpan di server: {new Date(lastSavedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* 2. THE UNIFIED ATTENDANCE WORKBENCH CONSOLE */}
        <View style={[styles.consoleCard, neoShadow.md]}>
          {/* A. Session Selector (Masuk / Pulang / Pengajuan Izin) */}
          <View style={styles.segmentedConsole}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                select();
                setMode('masuk');
              }}
              style={[styles.segmentBtn, mode === 'masuk' && styles.segmentBtnActive]}
            >
              <Feather name="sunrise" size={16} color={mode === 'masuk' ? colors.masuk : colors.muted} style={{ marginBottom: 2 }} />
              <Text style={[styles.segmentText, mode === 'masuk' && styles.segmentTextActive]}>
                Masuk
              </Text>
              <Text style={[styles.segmentSub, mode === 'masuk' && { color: colors.masuk }]}>
                {todayMasuk ? formatLogTime(todayMasuk.clockInTime) : 'Batas 10:00'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                select();
                if (!isClockOutUnlocked) {
                  setBlockedMessage(
                    'Presensi pulang terkunci sebelum pukul 17:00 WIB sesuai jam operasional kantor.'
                  );
                  setShowBlockedDialog(true);
                  return;
                }
                setMode('pulang');
              }}
              style={[
                styles.segmentBtn,
                mode === 'pulang' && styles.segmentBtnActive,
                !isClockOutUnlocked && styles.segmentBtnLocked,
              ]}
            >
              <Feather
                name={!isClockOutUnlocked ? 'lock' : 'sunset'}
                size={16}
                color={mode === 'pulang' ? colors.pulang : !isClockOutUnlocked ? colors.faint : colors.muted}
                style={{ marginBottom: 2 }}
              />
              <Text style={[
                styles.segmentText,
                mode === 'pulang' && styles.segmentTextActive,
                !isClockOutUnlocked && { color: colors.faint },
              ]}>
                Pulang {!isClockOutUnlocked ? '(Kunci)' : ''}
              </Text>
              <Text style={[styles.segmentSub, mode === 'pulang' && { color: colors.pulang }]}>
                {todayPulang ? formatLogTime(todayPulang.clockInTime) : !isClockOutUnlocked ? 'Buka 17:00' : '17:00 – 00:00'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* B. Location Mode Switch (Di Kantor vs Dari Rumah) */}
          <View style={styles.locationToggleRow}>
            <Text style={styles.locationSectionLabel}>Lokasi Presensi</Text>
            <View style={styles.locationPillSwitch}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  select();
                  setPlace('kantor');
                }}
                style={[styles.locationPillBtn, place === 'kantor' && styles.locationPillActive]}
              >
                <Feather name="briefcase" size={13} color={place === 'kantor' ? '#FFFFFF' : colors.muted} style={{ marginRight: 4 }} />
                <Text style={[styles.locationPillText, place === 'kantor' && styles.locationPillTextActive]}>
                  Di Kantor
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  select();
                  setPlace('rumah');
                }}
                style={[styles.locationPillBtn, place === 'rumah' && styles.locationPillActive]}
              >
                <Feather name="home" size={13} color={place === 'rumah' ? '#FFFFFF' : colors.muted} style={{ marginRight: 4 }} />
                <Text style={[styles.locationPillText, place === 'rumah' && styles.locationPillTextActive]}>
                  Dari Rumah
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Reason Input if "Dari Rumah" */}
          {place === 'rumah' && (
            <View
              onLayout={(e) => setReasonCardY(e.nativeEvent.layout.y)}
              style={styles.reasonContainer}
            >
              <Text style={[styles.reasonLabel, reasonTouched && !reason.trim() && { color: colors.danger }]}>
                Alasan kerja dari rumah (wajib)
              </Text>
              <TextInput
                ref={reasonInputRef}
                style={[styles.reasonInput, reasonTouched && !reason.trim() && styles.reasonInputError]}
                placeholder="Contoh: dinas luar kota / penugasan WFH"
                placeholderTextColor={colors.faint}
                value={reason}
                onChangeText={(text) => {
                  setReason(text);
                  if (text.trim().length > 0 && reasonTouched) setReasonTouched(false);
                }}
              />
              {reasonTouched && !reason.trim() && (
                <Text style={styles.fieldError}>Isi alasan sebelum melakukan presensi.</Text>
              )}
            </View>
          )}

          {/* C. Interactive Geofence Map */}
          <View style={styles.mapContainer}>
            <MapView
              userLat={currentCoords.latitude}
              userLng={currentCoords.longitude}
              officeLat={nearestOffice.latitude}
              officeLng={nearestOffice.longitude}
              radiusMeters={nearestOffice.radiusMeters}
              offices={offices}
              activeOfficeId={nearestOffice.id}
              mainColor={nearestOffice.color}
              height={180}
            />
          </View>

          {/* D. Live GPS Telemetry Strip */}
          <View style={styles.radarTelemetryBar}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 }}>
              <View style={[styles.radarIndicatorDot, { backgroundColor: isWithinRadius ? colors.success : colors.warning }]} />
              <Text style={styles.radarStatusText} numberOfLines={1}>
                {place === 'kantor' ? (
                  `${nearestOffice.officeName} • ${locLoading ? 'Mengukur...' : currentDistance !== null ? formatDistance(currentDistance) : 'Mencari GPS'} (${isWithinRadius ? 'Dalam Radius' : 'Di Luar Radius'})`
                ) : (
                  'Mode Presensi dari Rumah'
                )}
              </Text>
            </View>
            <TouchableOpacity onPress={fetchLocation} style={styles.radarRefreshBtn} hitSlop={10}>
              <Feather name="refresh-cw" size={13} color={colors.primary} />
              <Text style={styles.radarRefreshText}>Cek GPS</Text>
            </TouchableOpacity>
          </View>

          {(locError || gpsStale) && (
            <View style={styles.warnBanner}>
              <Feather name="alert-triangle" size={16} color={colors.danger} style={{ marginRight: 6 }} />
              <Text style={styles.warnText}>{locError || 'GPS belum valid. Aktifkan lokasi perangkat Anda.'}</Text>
            </View>
          )}

          {/* E. Definitive Primary Attendance Action Button */}
          <Button
            title={submitting ? 'Menyimpan...' : mainButtonTitle}
            icon={mode === 'pulang' && !isClockOutUnlocked ? 'lock' : 'camera'}
            loading={submitting}
            disabled={mode === 'pulang' && !isClockOutUnlocked}
            onPress={handleMainAction}
            textColor="#FFFFFF"
            style={[
              styles.consoleActionBtn,
              mode === 'pulang' && isClockOutUnlocked && { backgroundColor: colors.pulang, borderColor: colors.pulang },
              mode === 'pulang' && !isClockOutUnlocked && { backgroundColor: colors.faint, borderColor: colors.border },
            ]}
          />
        </View>

        {/* 3. Riwayat Kehadiran Minggu Ini (Clean Ledger Table) */}
        <View style={styles.ledgerContainer}>
          <View style={styles.ledgerHeaderRow}>
            <Text style={styles.ledgerSectionTitle}>Riwayat Minggu Ini</Text>
            <Text style={styles.ledgerCount}>{weekLogs.length} Catatan</Text>
          </View>
          <View style={[styles.ledgerCard, neoShadow.sm]}>
            {weekLogs.length === 0 ? renderEmptyLogs() : weekLogs.map(renderLogRow)}
          </View>
        </View>
      </ScrollView>
    </View>
  );

  const renderKalenderTab = () => (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
    >
      <View style={styles.tabHeader}>
        <Text style={styles.greeting}>Kalender Absensi</Text>
        <Text style={styles.date}>Pantau rekap kehadiran dan status bulanan Anda</Text>
      </View>

      <Card style={styles.logCard}>
        <MonthAttendanceCalendar
          attendances={userHistory}
          year={calYear}
          month={calMonth}
          onMonthChange={(y, m) => {
            setCalYear(y);
            setCalMonth(m);
            setCalDay(null);
          }}
          selectedDay={calDay}
          onSelectDay={(d) => setCalDay((prev) => (prev === d ? null : d))}
        />
        {calDay !== null && (
          <View style={styles.calDetailBox}>
            <Text style={styles.calDetailTitle}>
              {calDay}{' '}
              {new Date(calYear, calMonth, 1).toLocaleDateString('id-ID', {
                month: 'long',
                year: 'numeric',
              })}
            </Text>
            {(() => {
              const key = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(calDay).padStart(2, '0')}`;
              const dayLogs = userHistory.filter((r) => r.date === key);
              if (dayLogs.length === 0) {
                return <Text style={styles.calDetailEmpty}>Tidak ada absen di tanggal ini.</Text>;
              }
              return dayLogs.map(renderLogRow);
            })()}
          </View>
        )}
      </Card>
    </ScrollView>
  );

  const renderIzinTab = () => (
    <View style={{ flex: 1 }}>
      <LeaveRequestForm
        onSubmit={handleLeaveFormSubmit}
        onBack={() => setActiveTab('presensi')}
        loading={submitting}
      />
    </View>
  );

  const renderProfilTab = () => (
    <View style={{ flex: 1 }}>
      <ProfileScreen
        user={user}
        onBack={() => setActiveTab('presensi')}
        onLogout={confirmLogout}
        onUpdateUser={onUpdateUser}
      />
    </View>
  );

  return (
    <View style={styles.outer}>
      {activeTab === 'presensi' && renderPresensiTab()}
      {activeTab === 'kalender' && renderKalenderTab()}
      {activeTab === 'izin' && renderIzinTab()}
      {activeTab === 'profil' && renderProfilTab()}

      {/* Persistent Bottom Navbar */}
      <BottomNavBar activeTab={activeTab} onTabChange={setActiveTab} />

      <CameraModal
        visible={cameraVisible}
        onClose={() => {
          setCameraVisible(false);
          setPendingLeaveData(null);
        }}
        onConfirmPhoto={handleConfirmPhotoSubmit}
        attendanceTypeLabel={`${mode === 'masuk' ? 'Masuk' : 'Pulang'} (${place === 'kantor' ? nearestOffice.officeName : 'Rumah'})`}
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
        message={blockedMessage || `Anda berada di luar radius kantor (batas ${nearestOffice.radiusMeters} meter). Silakan mendekat ke area ${nearestOffice.officeName} untuk melakukan presensi.`}
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
              {selectedLog.type === 'izin_sakit' && selectedLog.approvalStatus === 'pending' ? (
                <Badge type="menunggu" />
              ) : selectedLog.type === 'izin_sakit' && selectedLog.approvalStatus === 'rejected' ? (
                <Badge type="ditolak" />
              ) : (
                <Badge type={selectedLog.type} />
              )}
              <Text style={styles.modalDate}>{formatLogDate(selectedLog.clockInTime)}</Text>
            </View>
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                {selectedLog.sessionType === 'izin_sakit'
                  ? 'Izin/Sakit'
                  : isWeekendDateString(selectedLog.date)
                    ? `Lembur (${selectedLog.sessionType === 'pulang' ? 'pulang' : 'masuk'})`
                    : selectedLog.sessionType === 'pulang'
                      ? 'Pulang'
                      : 'Masuk'}
                : {formatLogTime(selectedLog.clockInTime)} WIB
              </Text>
              {selectedLog.officeName ? (
                <Text style={styles.infoText}>
                  Kantor: {selectedLog.officeName}
                </Text>
              ) : null}
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
    backgroundColor: colors.secondary,
    borderWidth: 1,
    borderColor: colors.secondaryBorder,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
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
  tabHeader: {
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
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  izinIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.izinSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.izinBorder,
  },
  izinTextWrap: {
    flex: 1,
  },
  izinTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.ink,
  },
  izinSub: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.muted,
    marginTop: 2,
  },
  izinArrow: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
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
  officeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  officeBadgeText: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.ink,
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
    borderBottomWidth: 1.5,
    borderBottomColor: colors.surfaceMuted,
  },
  logThumb: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    marginRight: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
  },
  logFallback: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    marginRight: 12,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
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
  floatingScrollTopBtn: {
    position: 'absolute',
    bottom: 76,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: colors.ink,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: { elevation: 4 },
      web: { boxShadow: '0 2px 8px rgba(15, 23, 42, 0.08)' },
    }),
    zIndex: 40,
  },
  // --- Modal detail log ---
  calDetailBox: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  calDetailTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 4,
  },
  calDetailEmpty: {
    fontSize: fontSize.sm,
    color: colors.muted,
    fontWeight: '600',
    paddingVertical: 8,
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
  // Modern Clean Dashboard Header
  masthead: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  mastheadTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  employeeInfo: {
    flex: 1,
    marginRight: 12,
  },
  greetingText: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: '500',
  },
  employeeName: {
    fontSize: 19,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.3,
    marginTop: 1,
  },
  employeeMeta: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 3,
    fontWeight: '500',
  },
  clockTelemetry: {
    alignItems: 'flex-end',
  },
  clockDigits: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.ink,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  clockDateText: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
    fontWeight: '500',
  },
  mastheadDivider: {
    height: 1,
    backgroundColor: colors.borderMuted,
    marginVertical: 14,
  },
  mastheadBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shiftCol: {
    flex: 1,
  },
  bottomRowLabel: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: '500',
    marginBottom: 2,
  },
  shiftValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  shiftTimeText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink,
  },
  onTimeStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.success,
  },
  lateStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.danger,
  },
  recapLink: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recapValueText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },

  // Banner status jika sudah absen
  todaySuccessBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successSoft,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  todaySuccessTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.successInk,
  },
  todaySuccessSub: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
    fontWeight: '500',
  },

  // Hallmark Unified Attendance Console
  consoleCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  segmentedConsole: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.md,
    padding: 3,
    marginBottom: 12,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  segmentBtnActive: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentBtnLocked: {
    opacity: 0.6,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
  },
  segmentTextActive: {
    color: colors.ink,
    fontWeight: '700',
  },
  segmentSub: {
    fontSize: 10,
    color: colors.faint,
    marginTop: 1,
  },
  locationToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    marginBottom: 10,
  },
  locationSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
  },
  locationPillSwitch: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.sm,
    padding: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  locationPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  locationPillActive: {
    backgroundColor: colors.primary,
  },
  locationPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted,
  },
  locationPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  reasonContainer: {
    marginBottom: 10,
    padding: 10,
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reasonLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 6,
  },
  reasonInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.ink,
    minHeight: 44,
  },
  reasonInputError: {
    borderColor: colors.danger,
  },
  mapContainer: {
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  radarTelemetryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  radarIndicatorDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 6,
  },
  radarStatusText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.ink,
    flex: 1,
  },
  radarRefreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 8,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: radius.xs,
  },
  radarRefreshText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  consoleActionBtn: {
    marginTop: 12,
    minHeight: 52,
    borderRadius: radius.md,
  },

  // Ledger / Riwayat List
  ledgerContainer: {
    marginBottom: 32,
  },
  ledgerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  ledgerSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  ledgerCount: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.faint,
  },
  ledgerCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 2,
  },
});
