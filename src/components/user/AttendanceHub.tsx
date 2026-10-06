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
import { isWeekendDateString, isAfterTimeOfDay, todayWIB } from '../../utils/dates';
import { getHolidayName, isNationalHoliday } from '../../utils/holidays';
import { printAttendanceSlip } from '../../services/exportService';
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
  const [leaveViewMode, setLeaveViewMode] = useState<'list' | 'create'>('list');
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
    // Lewat pukul 10:00 dikategorikan Terlambat (presisi sekond: 10:00:01 sudah terlambat).
    const isLateCheckIn = isAfterTimeOfDay(currentTime, 10, 0);

  // Aturan jam pulang: terkunci sebelum pukul 17:00 WIB hingga batas 00:00 (23:59:59).
  const isClockOutUnlocked = curHour >= 17;

  // Countdown jam pulang menuju pukul 17:00 WIB
  const getClockOutCountdown = () => {
    if (curHour >= 17) return '';
    const target = new Date(currentTime);
    target.setHours(17, 0, 0, 0);
    const diffMs = Math.max(0, target.getTime() - currentTime.getTime());
    const h = Math.floor(diffMs / (1000 * 60 * 60));
    const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (h > 0) return `${h} jam ${m} mnt lagi`;
    return `${m} mnt lagi`;
  };
  const clockOutCountdownText = getClockOutCountdown();

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
      return !isAfterTimeOfDay(new Date(r.clockInTime), 10, 0);
    }).length;

    const lateCount = monthAllRecords.filter((r) => {
      if (r.sessionType !== 'masuk') return false;
      return isAfterTimeOfDay(new Date(r.clockInTime), 10, 0);
    }).length;

  const leaveCount = monthAllRecords.filter(
    (r) => r.type === 'izin_sakit' || r.sessionType === 'izin_sakit'
  ).length;

  // ---- Data untuk tombol & logs (sesi masuk, pulang, dan izin) ----
  const todayStr = todayWIB();
  const todayMasuk = userHistory.find((r) => r.date === todayStr && r.sessionType === 'masuk');
  const todayPulang = userHistory.find((r) => r.date === todayStr && r.sessionType === 'pulang');

  // Izin / sakit yang mencakup hari ini
  const todayLeave = userHistory.find((r) => {
    if (r.type !== 'izin_sakit' && r.sessionType !== 'izin_sakit') return false;
    const start = r.startDate || r.date;
    const end = r.endDate || r.date;
    return todayStr >= start && todayStr <= end;
  });

  // Semua riwayat izin/sakit pengguna
  const userLeaves = userHistory
    .filter((r) => r.type === 'izin_sakit' || r.sessionType === 'izin_sakit')
    .sort((a, b) => new Date(b.clockInTime || b.createdAt).getTime() - new Date(a.clockInTime || a.createdAt).getTime());

  // Log kehadiran lengkap (masuk, pulang, dan izin/sakit)
  const allLogs = [...userHistory].sort(
    (a, b) => new Date(b.clockInTime || b.createdAt).getTime() - new Date(a.clockInTime || a.createdAt).getTime()
  );

  const weekStart = getWeekStart();
  const monthStart = getMonthStart();
  const weekLogs = allLogs.filter((r) => new Date(r.clockInTime || r.createdAt) >= weekStart);
  const monthLogs = allLogs.filter((r) => new Date(r.clockInTime || r.createdAt) >= monthStart);

  // Status izin aktif hari ini (pending atau approved): memblokir absen masuk & pulang
  const isLeaveActiveToday = !!todayLeave && todayLeave.approvalStatus !== 'rejected';

  const handleMainAction = () => {
    // 1. Blokir presensi jika sudah mengajukan izin / sakit hari ini (izin overwrite kehadiran)
    if (isLeaveActiveToday) {
      setBlockedMessage(
        `Anda memiliki pengajuan ${todayLeave.status === 'sakit' ? 'sakit' : 'izin'} yang aktif untuk hari ini (${todayLeave.approvalStatus === 'approved' ? 'sudah disetujui' : 'menunggu persetujuan admin'}). Anda tidak perlu melakukan presensi masuk atau pulang.`
      );
      setShowBlockedDialog(true);
      return;
    }

    // 2. Anti duplikat: sudah masuk/pulang hari ini -> blok (klient atau server block).
    if ((mode === 'masuk' && todayMasuk) || (mode === 'pulang' && todayPulang)) {
      const sesi = mode === 'masuk' ? 'masuk' : 'pulang';
      const sudah = (mode === 'masuk' ? todayMasuk : todayPulang)!;
      setBlockedMessage(
        `Presensi ${sesi} hari ini sudah tersimpan jam ${formatLogTime(sudah.clockInTime)} WIB. Tidak bisa absen dua kali.`
      );
      setShowBlockedDialog(true);
      return;
    }

    // 3. Jika memilih mode pulang dan belum jam 17:00 WIB
    if (mode === 'pulang' && !isClockOutUnlocked) {
      setBlockedMessage(
        `Presensi pulang saat ini terkunci. Sesuai jam operasional, presensi pulang dibuka dalam ${clockOutCountdownText || 'pukul 17:00 WIB'}.`
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
                const isLate = mode === 'masuk' && isAfterTimeOfDay(now, 10, 0);
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

  const isSessionDone = !!
    ((mode === 'masuk' && todayMasuk) || (mode === 'pulang' && todayPulang));

  const mainButtonTitle =
    isLeaveActiveToday
      ? `Izin ${todayLeave?.status === 'sakit' ? 'Sakit' : 'Izin'} Aktif (Tidak Perlu Absen)`
      : isSessionDone
      ? `Presensi ${mode === 'masuk' ? 'Masuk' : 'Pulang'} Sudah Selesai`
      : mode === 'masuk'
        ? isLateCheckIn
          ? 'Ambil Foto & Absen Masuk (Terlambat)'
          : 'Ambil Foto & Absen Masuk'
        : !isClockOutUnlocked
          ? `Presensi Pulang Terkunci (${clockOutCountdownText || 'Buka 17:00'})`
          : 'Ambil Foto & Absen Pulang';

  const renderLogRow = (item: AttendanceRecord) => {
    const isMasuk = item.sessionType === 'masuk';
    // Absen di Sabtu/Minggu atau Hari Libur Nasional = lembur (override tanggal merah)
    const isLembur =
      (isWeekendDateString(item.date) || isNationalHoliday(item.date)) &&
      (item.sessionType === 'masuk' || item.sessionType === 'pulang');
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
        {/* 1. Header Profil & Informasi Kerja */}
        <View style={[styles.masthead, neoShadow.sm]}>
          <View style={styles.mastheadTopRow}>
            <View style={styles.employeeInfo}>
              <Text style={styles.greetingText}>{greeting},</Text>
              <Text style={styles.employeeName} numberOfLines={1}>
                {user.fullName}
              </Text>
              <Text style={styles.employeeMeta}>
                {user.department || 'Karyawan'}
              </Text>
            </View>

            <View style={styles.dateBadge}>
              <Text style={styles.dateBadgeDay}>{todayLabel}</Text>
              <Text style={styles.dateBadgeTime}>
                {String(curHour).padStart(2, '0')}:{String(curMin).padStart(2, '0')} WIB
              </Text>
            </View>
          </View>

          <View style={styles.mastheadDivider} />

          <View style={styles.mastheadBottomRow}>
            <View style={styles.shiftCol}>
              <Text style={styles.bottomRowLabel}>Jadwal Kerja</Text>
              <View style={styles.shiftValueRow}>
                <Text style={styles.shiftTimeText}>08:00 - 17:00 WIB</Text>
                <Text style={isLateCheckIn ? styles.lateStatusText : styles.onTimeStatusText}>
                  {isLateCheckIn ? '• Terlambat (> 10:00)' : '• Tepat Waktu'}
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
                <Text style={styles.bottomRowLabel}>Rekap Bulan Ini</Text>
                <Text style={styles.recapValueText}>
                  {onTimeCount} Hadir • {leaveCount} Izin
                </Text>
              </View>
              <Feather name="chevron-right" size={16} color={colors.primary} style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Banner Status Presensi Hari Ini (Jika sudah pernah absen masuk/pulang) */}
        {userTodayStatus && (
          <View style={[styles.todaySuccessBanner, neoShadow.sm]}>
            <Feather name="check-circle" size={18} color={colors.successInk} style={{ marginRight: 8 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.todaySuccessTitle}>
                Presensi {userTodayStatus.sessionType === 'pulang' ? 'pulang' : 'masuk'} sudah tercatat jam {new Date(userTodayStatus.clockInTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
              </Text>
              {lastSavedAt && (
                <Text style={styles.todaySuccessSub}>
                  Tersimpan di server: {new Date(lastSavedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Banner Status Izin / Sakit Hari Ini */}
        {todayLeave && (
          <View style={[styles.todayLeaveBanner, neoShadow.sm]}>
            <View style={styles.todayLeaveTopRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                <View style={[
                  styles.leaveCategoryIconWrap,
                  { backgroundColor: todayLeave.status === 'sakit' ? colors.izinSoft : colors.primarySoft }
                ]}>
                  <Feather
                    name={todayLeave.status === 'sakit' ? 'activity' : 'calendar'}
                    size={15}
                    color={todayLeave.status === 'sakit' ? colors.izin : colors.primary}
                  />
                </View>
                <View>
                  <Text style={styles.todayLeaveTitle}>
                    Status Hari Ini: Pengajuan {todayLeave.status === 'sakit' ? 'Sakit' : 'Izin'}
                  </Text>
                  <Text style={styles.todayLeaveSub}>
                    Periode: {todayLeave.startDate || todayLeave.date} s.d. {todayLeave.endDate || todayLeave.date}
                  </Text>
                </View>
              </View>
              <View style={[
                styles.leaveApprovalBadge,
                todayLeave.approvalStatus === 'approved' && { backgroundColor: colors.successSoft },
                todayLeave.approvalStatus === 'rejected' && { backgroundColor: colors.dangerSoft },
                todayLeave.approvalStatus === 'pending' && { backgroundColor: colors.pulangSoft },
              ]}>
                <Feather
                  name={
                    todayLeave.approvalStatus === 'approved'
                      ? 'check-circle'
                      : todayLeave.approvalStatus === 'rejected'
                      ? 'x-circle'
                      : 'clock'
                  }
                  size={12}
                  color={
                    todayLeave.approvalStatus === 'approved'
                      ? colors.successInk
                      : todayLeave.approvalStatus === 'rejected'
                      ? colors.danger
                      : colors.pulang
                  }
                  style={{ marginRight: 4 }}
                />
                <Text style={[
                  styles.leaveApprovalBadgeText,
                  todayLeave.approvalStatus === 'approved' && { color: colors.successInk },
                  todayLeave.approvalStatus === 'rejected' && { color: colors.danger },
                  todayLeave.approvalStatus === 'pending' && { color: colors.pulang },
                ]}>
                  {todayLeave.approvalStatus === 'approved'
                    ? 'Disetujui'
                    : todayLeave.approvalStatus === 'rejected'
                    ? 'Ditolak'
                    : 'Menunggu Persetujuan'}
                </Text>
              </View>
            </View>

            {todayLeave.reason ? (
              <Text style={styles.todayLeaveReasonText}>Alasan: "{todayLeave.reason}"</Text>
            ) : null}

            {todayLeave.reviewNote ? (
              <View style={styles.todayLeaveNoteBox}>
                <Text style={styles.todayLeaveNoteText}>
                  Catatan Admin: {todayLeave.reviewNote}
                </Text>
              </View>
            ) : null}
          </View>
        )}

        {/* 2. Konsol Presensi Utama */}
        <View style={[styles.consoleCard, neoShadow.sm]}>
          {/* A. Pemilihan Sesi (Masuk / Pulang) */}
          <View style={styles.sessionSection}>
            <Text style={styles.stepTitle}>1. Sesi Presensi</Text>
            <View style={styles.segmentedConsole}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  select();
                  setMode('masuk');
                }}
                style={[
                  styles.segmentBtn,
                  mode === 'masuk' && styles.segmentBtnActiveMasuk,
                ]}
              >
                <Feather
                  name="sunrise"
                  size={18}
                  color={mode === 'masuk' ? colors.masuk : colors.muted}
                  style={{ marginBottom: 4 }}
                />
                <Text
                  style={[
                    styles.segmentText,
                    mode === 'masuk' && styles.segmentTextActiveMasuk,
                  ]}
                >
                  Masuk
                </Text>
                <Text
                  style={[
                    styles.segmentSub,
                    mode === 'masuk' && { color: colors.masuk },
                  ]}
                >
                  {isLeaveActiveToday
                    ? 'Status Izin'
                    : todayMasuk
                    ? `Sudah jam ${formatLogTime(todayMasuk.clockInTime)}`
                    : 'Batas 10:00 WIB'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  select();
                  if (!isClockOutUnlocked) {
                    setBlockedMessage(
                      `Presensi pulang terkunci sebelum pukul 17:00 WIB. Dibuka dalam ${clockOutCountdownText || 'pukul 17:00 WIB'}.`
                    );
                    setShowBlockedDialog(true);
                    return;
                  }
                  setMode('pulang');
                }}
                style={[
                  styles.segmentBtn,
                  mode === 'pulang' && styles.segmentBtnActivePulang,
                  !isClockOutUnlocked && styles.segmentBtnLocked,
                ]}
              >
                <Feather
                  name={!isClockOutUnlocked ? 'lock' : 'sunset'}
                  size={18}
                  color={
                    mode === 'pulang'
                      ? colors.pulang
                      : !isClockOutUnlocked
                        ? colors.faint
                        : colors.muted
                  }
                  style={{ marginBottom: 4 }}
                />
                <Text
                  style={[
                    styles.segmentText,
                    mode === 'pulang' && styles.segmentTextActivePulang,
                    !isClockOutUnlocked && { color: colors.faint },
                  ]}
                >
                  Pulang {!isClockOutUnlocked ? '(Kunci)' : ''}
                </Text>
                <Text
                  style={[
                    styles.segmentSub,
                    mode === 'pulang' && { color: colors.pulang },
                  ]}
                >
                  {isLeaveActiveToday
                    ? 'Status Izin'
                    : todayPulang
                    ? `Sudah jam ${formatLogTime(todayPulang.clockInTime)}`
                    : !isClockOutUnlocked
                      ? `Buka dalam ${clockOutCountdownText}`
                      : '17:00 - 00:00 WIB'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* B. Lokasi Presensi */}
          <View style={styles.locationSection}>
            <View style={styles.locationToggleRow}>
              <Text style={styles.stepTitle}>2. Lokasi Kehadiran</Text>
              <View style={styles.locationPillSwitch}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    select();
                    setPlace('kantor');
                  }}
                  style={[styles.locationPillBtn, place === 'kantor' && styles.locationPillActive]}
                >
                  <Feather
                    name="briefcase"
                    size={14}
                    color={place === 'kantor' ? '#FFFFFF' : colors.muted}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.locationPillText,
                      place === 'kantor' && styles.locationPillTextActive,
                    ]}
                  >
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
                  <Feather
                    name="home"
                    size={14}
                    color={place === 'rumah' ? '#FFFFFF' : colors.muted}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.locationPillText,
                      place === 'rumah' && styles.locationPillTextActive,
                    ]}
                  >
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
                <Text
                  style={[
                    styles.reasonLabel,
                    reasonTouched && !reason.trim() && { color: colors.danger },
                  ]}
                >
                  Alasan kerja dari rumah (wajib)
                </Text>
                <TextInput
                  ref={reasonInputRef}
                  style={[
                    styles.reasonInput,
                    reasonTouched && !reason.trim() && styles.reasonInputError,
                  ]}
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

            {/* D. Status Lokasi GPS Bersih */}
            <View style={styles.locationStatusBar}>
              <View style={styles.locationStatusLeft}>
                <View
                  style={[
                    styles.statusIndicatorDot,
                    {
                      backgroundColor:
                        place === 'kantor'
                          ? isWithinRadius
                            ? colors.success
                            : colors.warning
                          : colors.primary,
                    },
                  ]}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.locationStatusTitle} numberOfLines={1}>
                    {place === 'kantor' ? nearestOffice.officeName : 'Presensi Dari Rumah (WFH)'}
                  </Text>
                  <Text style={styles.locationStatusSub} numberOfLines={1}>
                    {place === 'kantor'
                      ? locLoading
                        ? 'Sedang mencari koordinat GPS...'
                        : currentDistance !== null
                          ? `${formatDistance(currentDistance)} • ${
                              isWithinRadius
                                ? 'Dalam radius kantor'
                                : `Di luar radius (${nearestOffice.radiusMeters} m)`
                            }`
                          : 'Sinyal GPS belum terbaca'
                      : 'Pastikan alasan telah diisi dengan benar'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={fetchLocation}
                style={styles.refreshLocationBtn}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Perbarui GPS"
              >
                <Feather name="refresh-cw" size={14} color={colors.primary} />
                <Text style={styles.refreshLocationText}>Perbarui</Text>
              </TouchableOpacity>
            </View>

            {(locError || gpsStale) && (
              <View style={styles.warnBanner}>
                <Feather name="alert-triangle" size={16} color={colors.danger} style={{ marginRight: 8 }} />
                <Text style={styles.warnText}>
                  {locError || 'GPS belum valid. Aktifkan lokasi perangkat Anda.'}
                </Text>
              </View>
            )}
          </View>

          {/* E. Tombol Aksi Utama Presensi */}
          <Button
            title={submitting ? 'Menyimpan...' : mainButtonTitle}
            icon={isLeaveActiveToday ? (todayLeave?.status === 'sakit' ? 'activity' : 'calendar') : (mode === 'pulang' && !isClockOutUnlocked ? 'lock' : 'camera')}
            loading={submitting}
            disabled={isSessionDone || isLeaveActiveToday || (mode === 'pulang' && !isClockOutUnlocked)}
            onPress={handleMainAction}
            textColor="#FFFFFF"
            style={[
              styles.consoleActionBtn,
              isLeaveActiveToday && { backgroundColor: colors.muted, borderColor: colors.border },
              !isLeaveActiveToday && isSessionDone && { backgroundColor: colors.success, borderColor: colors.success },
              !isLeaveActiveToday &&
                !isSessionDone &&
                mode === 'pulang' &&
                isClockOutUnlocked && {
                  backgroundColor: colors.pulang,
                  borderColor: colors.pulang,
                },
              !isLeaveActiveToday &&
                !isSessionDone &&
                mode === 'pulang' &&
                !isClockOutUnlocked && {
                  backgroundColor: colors.faint,
                  borderColor: colors.border,
                },
              !isLeaveActiveToday &&
                !isSessionDone &&
                mode === 'masuk' && {
                  backgroundColor: colors.masuk,
                  borderColor: colors.masuk,
                },
            ]}
          />
        </View>

        {/* 3. Riwayat Kehadiran Minggu Ini */}
        <View style={styles.ledgerContainer}>
          <View style={styles.ledgerHeaderRow}>
            <Text style={styles.ledgerSectionTitle}>Riwayat Kehadiran Minggu Ini</Text>
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
      <View style={styles.tabHeaderRow}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={styles.greeting}>Kalender Absensi</Text>
          <Text style={styles.date}>Pantau rekap kehadiran dan status bulanan Anda</Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            select();
            printAttendanceSlip({
              user,
              year: calYear,
              month: calMonth,
              records: userHistory,
            });
          }}
          style={styles.printSlipBtn}
          accessibilityRole="button"
          accessibilityLabel="Cetak Slip Presensi"
        >
          <Feather name="printer" size={15} color={colors.primaryDark} style={{ marginRight: 6 }} />
          <Text style={styles.printSlipText}>Cetak Slip (PDF)</Text>
        </TouchableOpacity>
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
              const holidayName = getHolidayName(key);
              if (dayLogs.length === 0) {
                if (holidayName) {
                  return (
                    <View style={styles.holidayBannerBox}>
                      <Feather name="flag" size={16} color={colors.danger} style={{ marginRight: 8 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.holidayBannerTitle}>Libur Nasional</Text>
                        <Text style={styles.holidayBannerSub}>{holidayName}</Text>
                      </View>
                    </View>
                  );
                }
                const isWeekend = isWeekendDateString(key);
                if (isWeekend) {
                  return <Text style={styles.calDetailEmpty}>Hari libur akhir pekan (Sabtu/Minggu).</Text>;
                }
                return <Text style={styles.calDetailEmpty}>Tidak ada absen di tanggal ini.</Text>;
              }
              return dayLogs.map(renderLogRow);
            })()}
          </View>
        )}
      </Card>
    </ScrollView>
  );

  const renderIzinTab = () => {
    if (leaveViewMode === 'create') {
      return (
        <View style={{ flex: 1 }}>
          <LeaveRequestForm
            onSubmit={async (data) => {
              await handleLeaveFormSubmit(data);
              setLeaveViewMode('list');
            }}
            onBack={() => setLeaveViewMode('list')}
            loading={submitting}
          />
        </View>
      );
    }

    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.tabHeaderRow}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.greeting}>Pengajuan Izin & Sakit</Text>
            <Text style={styles.date}>Pantau status persetujuan surat izin/sakit dari admin cabang</Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              select();
              setLeaveViewMode('create');
            }}
            style={styles.newLeaveBtn}
          >
            <Feather name="plus" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.newLeaveBtnText}>Ajukan Baru</Text>
          </TouchableOpacity>
        </View>

        {userLeaves.length === 0 ? (
          <View style={[styles.emptyLeaveCard, neoShadow.sm]}>
            <View style={styles.emptyLeaveIconWrap}>
              <Feather name="file-text" size={32} color={colors.primary} />
            </View>
            <Text style={styles.emptyLeaveTitle}>Belum Ada Pengajuan Izin</Text>
            <Text style={styles.emptyLeaveSub}>
              Jika Anda berhalangan hadir karena sakit atau ada keperluan mendesak, ajukan surat izin/sakit di sini.
            </Text>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                select();
                setLeaveViewMode('create');
              }}
              style={styles.emptyActionBtn}
            >
              <Feather name="plus" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.emptyActionBtnText}>Buat Pengajuan Sekarang</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {userLeaves.map((item) => {
              const isSakit = item.status === 'sakit';
              const isApproved = item.approvalStatus === 'approved';
              const isRejected = item.approvalStatus === 'rejected';
              const isPending = item.approvalStatus === 'pending';

              const badgeBg = isApproved
                ? colors.successSoft
                : isRejected
                ? colors.dangerSoft
                : colors.pulangSoft;

              const badgeText = isApproved
                ? colors.successInk
                : isRejected
                ? colors.danger
                : colors.pulang;

              const statusLabel = isApproved
                ? 'Disetujui Admin'
                : isRejected
                ? 'Ditolak'
                : 'Menunggu Persetujuan';

              return (
                <View key={item.id} style={[styles.leaveHistoryCard, neoShadow.sm]}>
                  <View style={styles.leaveHistoryTop}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                      <View style={[
                        styles.leaveHistoryIconWrap,
                        { backgroundColor: isSakit ? colors.izinSoft : colors.primarySoft }
                      ]}>
                        <Feather
                          name={isSakit ? 'activity' : 'calendar'}
                          size={18}
                          color={isSakit ? colors.izin : colors.primary}
                        />
                      </View>
                      <View>
                        <Text style={styles.leaveHistoryTitle}>
                          {isSakit ? 'Surat Sakit' : 'Pengajuan Izin'}
                        </Text>
                        <Text style={styles.leaveHistoryDates}>
                          {item.startDate || item.date} s.d. {item.endDate || item.date}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.leaveStatusPill, { backgroundColor: badgeBg }]}>
                      <Feather
                        name={isApproved ? 'check-circle' : isRejected ? 'x-circle' : 'clock'}
                        size={12}
                        color={badgeText}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={[styles.leaveStatusPillText, { color: badgeText }]}>
                        {statusLabel}
                      </Text>
                    </View>
                  </View>

                  {item.reason ? (
                    <View style={styles.leaveReasonBox}>
                      <Text style={styles.leaveReasonLabel}>Keterangan Alasan:</Text>
                      <Text style={styles.leaveReasonContent}>"{item.reason}"</Text>
                    </View>
                  ) : null}

                  {item.reviewNote ? (
                    <View style={styles.leaveAdminNoteBox}>
                      <Text style={styles.leaveAdminNoteLabel}>Catatan dari Admin Cabang:</Text>
                      <Text style={styles.leaveAdminNoteContent}>"{item.reviewNote}"</Text>
                    </View>
                  ) : null}

                  {(item.documentUrl || item.photoUrl) ? (
                    <View style={styles.leaveAttachmentRow}>
                      {item.documentUrl ? (
                        <TouchableOpacity
                          style={styles.attachmentChip}
                          onPress={() => setSelectedLog(item)}
                          activeOpacity={0.7}
                        >
                          <Feather name="paperclip" size={13} color={colors.primaryDark} style={{ marginRight: 4 }} />
                          <Text style={styles.attachmentChipText}>Dokumen Surat</Text>
                        </TouchableOpacity>
                      ) : null}
                      {item.photoUrl ? (
                        <TouchableOpacity
                          style={styles.attachmentChip}
                          onPress={() => setSelectedLog(item)}
                          activeOpacity={0.7}
                        >
                          <Feather name="image" size={13} color={colors.primaryDark} style={{ marginRight: 4 }} />
                          <Text style={styles.attachmentChipText}>Foto Bukti</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ) : null}

                  <View style={styles.leaveCardFooter}>
                    <Text style={styles.leaveCardFooterText}>
                      Diajukan: {formatLogDate(item.createdAt || item.clockInTime)} • {formatLogTime(item.createdAt || item.clockInTime)} WIB
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    );
  };

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
        metadata={{
          userName: user.fullName,
          department: user.department || 'Operasional',
          companyName: 'E-Presensi SKMI',
          sessionLabel: mode === 'masuk' ? 'PRESENSI MASUK' : 'PRESENSI PULANG',
          statusLabel: mode === 'masuk' ? (isLateCheckIn ? 'Terlambat' : 'Tepat Waktu') : 'Selesai',
          officeName: place === 'kantor' ? nearestOffice.officeName : 'Kerja Dari Rumah (WFH)',
          distanceText:
            place === 'kantor'
              ? currentDistance !== null
                ? `${formatDistance(currentDistance)} (${isWithinRadius ? 'Sah' : 'Di Luar Radius'})`
                : 'Jarak Terdeteksi'
              : 'Mode WFH',
          latitude: currentCoords.latitude,
          longitude: currentCoords.longitude,
          deviceModel: user.deviceModel,
        }}
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
  tabHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  printSlipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  printSlipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryDark,
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
  holidayBannerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.izinSoft,
    borderWidth: 1,
    borderColor: colors.izinBorder,
    borderRadius: radius.md,
    padding: 12,
    marginVertical: 6,
  },
  holidayBannerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.dangerInk,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  holidayBannerSub: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink,
    marginTop: 2,
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
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  mastheadTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  employeeInfo: {
    flex: 1,
    marginRight: 12,
  },
  greetingText: {
    fontSize: 13,
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
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
    fontWeight: '500',
  },
  dateBadge: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.md,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: 'flex-end',
    borderWidth: 1,
    borderColor: colors.borderMuted,
  },
  dateBadgeDay: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.ink,
  },
  dateBadgeTime: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primaryDark,
    marginTop: 1,
  },
  mastheadDivider: {
    height: 1,
    backgroundColor: colors.borderMuted,
    marginVertical: 12,
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

  // Konsol Presensi
  consoleCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 8,
  },
  sessionSection: {
    marginBottom: 14,
  },
  segmentedConsole: {
    flexDirection: 'row',
    gap: 10,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1.5,
    borderColor: colors.border,
    minHeight: 64,
  },
  segmentBtnActiveMasuk: {
    backgroundColor: colors.masukSoft,
    borderColor: colors.masukBorder,
  },
  segmentBtnActivePulang: {
    backgroundColor: colors.pulangSoft,
    borderColor: colors.pulangBorder,
  },
  segmentBtnLocked: {
    opacity: 0.55,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
  },
  segmentTextActiveMasuk: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  segmentTextActivePulang: {
    color: colors.secondaryDark,
    fontWeight: '700',
  },
  segmentSub: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
    fontWeight: '500',
  },
  locationSection: {
    marginBottom: 8,
  },
  locationToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  locationPillSwitch: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.md,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  locationPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  locationPillActive: {
    backgroundColor: colors.primary,
  },
  locationPillText: {
    fontSize: 12,
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
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  locationStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  locationStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  statusIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  locationStatusTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  locationStatusSub: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 1,
    fontWeight: '500',
  },
  refreshLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  refreshLocationText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primaryDark,
  },
  consoleActionBtn: {
    marginTop: 14,
    minHeight: 52,
    borderRadius: radius.md,
  },

  // Riwayat List
  ledgerContainer: {
    marginBottom: 32,
  },
  ledgerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  ledgerSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.2,
  },
  ledgerCount: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.muted,
  },
  ledgerCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 2,
  },
  todayLeaveBanner: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 14,
  },
  todayLeaveTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  leaveCategoryIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayLeaveTitle: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.ink,
  },
  todayLeaveSub: {
    fontSize: 11,
    color: colors.muted,
  },
  leaveApprovalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  leaveApprovalBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  todayLeaveReasonText: {
    fontSize: fontSize.xs,
    color: colors.ink,
    fontStyle: 'italic',
    marginTop: 4,
    lineHeight: 18,
  },
  todayLeaveNoteBox: {
    backgroundColor: colors.surfaceSoft,
    padding: 8,
    borderRadius: 6,
    marginTop: 6,
  },
  todayLeaveNoteText: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: '600',
  },
  newLeaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  newLeaveBtnText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyLeaveCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  emptyLeaveIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyLeaveTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.ink,
  },
  emptyLeaveSub: {
    fontSize: fontSize.xs,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
    lineHeight: 18,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  emptyActionBtnText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  leaveHistoryCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
  },
  leaveHistoryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  leaveHistoryIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaveHistoryTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.ink,
  },
  leaveHistoryDates: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
    fontWeight: '500',
  },
  leaveStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  leaveStatusPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  leaveReasonBox: {
    backgroundColor: colors.surfaceSoft,
    padding: 10,
    borderRadius: radius.sm,
    marginBottom: 8,
  },
  leaveReasonLabel: {
    fontSize: 10,
    color: colors.muted,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  leaveReasonContent: {
    fontSize: fontSize.xs,
    color: colors.ink,
    marginTop: 2,
    lineHeight: 18,
  },
  leaveAdminNoteBox: {
    backgroundColor: colors.dangerSoft,
    padding: 10,
    borderRadius: radius.sm,
    marginBottom: 8,
  },
  leaveAdminNoteLabel: {
    fontSize: 10,
    color: colors.danger,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  leaveAdminNoteContent: {
    fontSize: fontSize.xs,
    color: colors.danger,
    marginTop: 2,
    lineHeight: 18,
  },
  leaveAttachmentRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  attachmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  attachmentChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primaryDark,
  },
  leaveCardFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    marginTop: 4,
  },
  leaveCardFooterText: {
    fontSize: 10,
    color: colors.muted,
  },
});
