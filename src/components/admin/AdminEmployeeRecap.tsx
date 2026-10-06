import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AttendanceRecord, UserProfile } from '../../types/attendance';
import { AttendanceService } from '../../services/attendanceService';
import { MonthAttendanceCalendar, buildAttendanceMap, getDayStatus } from '../user/MonthAttendanceCalendar';
import { isWeekendDateString } from '../../utils/dates';
import { isNationalHoliday, getHolidayName } from '../../utils/holidays';
import { printAttendanceSlip } from '../../services/exportService';
import { Badge } from '../ui/Badge';
import { colors, fontSize, radius, spacing } from '../../theme';

interface AdminEmployeeRecapProps {
  visible: boolean;
  employee: UserProfile | null;
  onClose: () => void;
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

export const AdminEmployeeRecap: React.FC<AdminEmployeeRecapProps> = ({
  visible,
  employee,
  onClose,
}) => {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [day, setDay] = useState<number | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && employee) {
      const n = new Date();
      setYear(n.getFullYear());
      setMonth(n.getMonth());
      setDay(null);
      load(employee.id);
    }
  }, [visible, employee?.id]);

  const load = async (userId: string) => {
    setLoading(true);
    const rows = await AttendanceService.getUserAttendances(userId);
    setRecords(rows);
    setLoading(false);
  };

  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  const monthRecords = useMemo(
    () => records.filter((r) => r.date.startsWith(monthKey)),
    [records, monthKey]
  );

  const summary = useMemo(() => {
    const map = buildAttendanceMap(records, year, month);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const isCurrent = year === now.getFullYear() && month === now.getMonth();
    const isPastMonth =
      year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth());
    let lengkap = 0;
    let satuSesi = 0;
    let izin = 0;
    let libur = 0;
    let tanpaKabar = 0;
    let terhitung = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const isPast = isPastMonth || (isCurrent && d < now.getDate());
      const isToday = isCurrent && d === now.getDate();
      const weekday = new Date(year, month, d).getDay();
      const st = getDayStatus(map[d], isPast, isToday, weekday === 0 || weekday === 6);
      // Hari yang akan datang & hari ini yang masih kosong tidak dihitung
      if (st === 'akan_datang' || st === 'hari_ini_kosong') continue;
      if (st !== 'libur') terhitung++;
      if (st === 'lengkap') lengkap++;
      else if (st === 'satu_sesi') satuSesi++;
      else if (st === 'izin') izin++;
      else if (st === 'libur') libur++;
      else if (st === 'absen') tanpaKabar++;
    }
    return { lengkap, satuSesi, izin, libur, tanpaKabar, persentase: terhitung ? Math.round(((lengkap + satuSesi) / terhitung) * 100) : 0 };
  }, [records, year, month]);

  const dayKey = day !== null ? `${monthKey}-${String(day).padStart(2, '0')}` : null;
  const dayLogs = dayKey ? records.filter((r) => r.date === dayKey) : [];

  if (!visible || !employee) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Rekap {employee.fullName}</Text>
            <Text style={styles.sub}>
              {employee.email} • {employee.department || 'Staff'}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={12}>
            <Feather name="x" size={22} color={colors.ink} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Memuat rekap...</Text>
            </View>
          ) : (
            <>
              <View style={styles.statsRow}>
                <View style={[styles.statBox, { backgroundColor: '#DCFCE7' }]}>
                  <Text style={[styles.statNum, { color: '#15803D' }]}>{summary.persentase}%</Text>
                  <Text style={styles.statLbl}>Kehadiran</Text>
                </View>
                <View style={[styles.statBox, { backgroundColor: colors.primarySoft }]}>
                  <Text style={[styles.statNum, { color: colors.primary }]}>{summary.lengkap}</Text>
                  <Text style={styles.statLbl}>Lengkap</Text>
                </View>
                <View style={[styles.statBox, { backgroundColor: '#FEF3C7' }]}>
                  <Text style={[styles.statNum, { color: '#B45309' }]}>{summary.satuSesi}</Text>
                  <Text style={styles.statLbl}>1 Sesi</Text>
                </View>
                <View style={[styles.statBox, { backgroundColor: '#FFFFFF', borderColor: colors.izin, borderWidth: 1.5 }]}>
                  <Text style={[styles.statNum, { color: colors.izin }]}>{summary.izin}</Text>
                  <Text style={styles.statLbl}>Izin</Text>
                </View>
                <View style={[styles.statBox, { backgroundColor: colors.izinSoft }]}>
                  <Text style={[styles.statNum, { color: colors.izin }]}>{summary.libur}</Text>
                  <Text style={styles.statLbl}>Libur</Text>
                </View>
                <View style={[styles.statBox, { backgroundColor: '#E2E8F0' }]}>
                  <Text style={[styles.statNum, { color: '#475569' }]}>{summary.tanpaKabar}</Text>
                  <Text style={styles.statLbl}>Tanpa kabar</Text>
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  printAttendanceSlip({
                    user: employee,
                    year,
                    month,
                    records,
                  });
                }}
                style={styles.printSlipBtn}
                accessibilityRole="button"
                accessibilityLabel="Cetak Slip Presensi Karyawan"
              >
                <Feather name="printer" size={15} color={colors.primaryDark} style={{ marginRight: 8 }} />
                <Text style={styles.printSlipText}>Cetak Slip Presensi Bulanan (PDF)</Text>
              </TouchableOpacity>

              <MonthAttendanceCalendar
                attendances={records}
                year={year}
                month={month}
                onMonthChange={(y, m) => {
                  setYear(y);
                  setMonth(m);
                  setDay(null);
                }}
                selectedDay={day}
                onSelectDay={(d) => setDay((prev) => (prev === d ? null : d))}
              />

              {day !== null && (
                <View style={styles.dayBox}>
                  <Text style={styles.dayTitle}>
                    {day}{' '}
                    {new Date(year, month, 1).toLocaleDateString('id-ID', {
                      month: 'long',
                      year: 'numeric',
                    })}
                  </Text>
                  {dayLogs.length === 0 ? (
                    (() => {
                      const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      const holiday = getHolidayName(key);
                      if (holiday) {
                        return (
                          <Text style={[styles.dayEmpty, { color: colors.danger, fontWeight: '600' }]}>
                            Hari Libur Nasional: {holiday}
                          </Text>
                        );
                      }
                      if (isWeekendDateString(key)) {
                        return <Text style={styles.dayEmpty}>Hari libur akhir pekan (Sabtu/Minggu).</Text>;
                      }
                      return <Text style={styles.dayEmpty}>Tidak ada absen di tanggal ini.</Text>;
                    })()
                  ) : (
                    dayLogs.map((r) => (
                      <View key={r.id} style={styles.logRow}>
                        {r.photoUrl ? (
                          <Image source={{ uri: r.photoUrl }} style={styles.thumb} />
                        ) : (
                          <View style={styles.thumbFallback}>
                            <Feather name="camera" size={18} color={colors.faint} />
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={styles.logTitle}>
                            {r.sessionType === 'izin_sakit'
                              ? 'Izin/Sakit'
                              : isWeekendDateString(r.date) || isNationalHoliday(r.date)
                                ? 'Lembur'
                                : r.sessionType === 'pulang'
                                  ? 'Pulang'
                                  : 'Masuk'} • {formatTime(r.clockInTime)} WIB
                          </Text>
                          <Text style={styles.logSub}>
                            {r.officeName ? (
                              <>
                                {r.officeColor ? <Text style={{ color: r.officeColor }}>● </Text> : null}
                                {`${r.officeName} • `}
                              </>
                            ) : ''}
                            {r.distanceMeters ? `${r.distanceMeters} m` : ''}
                            {r.reason ? ` • ${r.reason}` : ''}
                          </Text>
                        </View>
                        <Badge type={r.type} size="sm" />
                      </View>
                    ))
                  )}
                </View>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(30, 41, 59, 0.45)',
    justifyContent: 'flex-end',
    zIndex: 60,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: '92%',
    minHeight: '60%',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.borderStrong,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.ink,
  },
  sub: {
    fontSize: fontSize.xs,
    color: colors.muted,
    marginTop: 2,
    fontWeight: '600',
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  body: {
    paddingTop: spacing.md,
    paddingBottom: 20,
  },
  loadingBox: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 10,
    fontSize: fontSize.sm,
    color: colors.muted,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.md,
  },
  statBox: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  statNum: {
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  statLbl: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: '700',
    marginTop: 2,
  },
  printSlipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: spacing.md,
  },
  printSlipText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  dayBox: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  dayTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 6,
  },
  dayEmpty: {
    fontSize: fontSize.sm,
    color: colors.muted,
    fontWeight: '600',
    paddingVertical: 8,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    marginRight: 10,
    backgroundColor: colors.surfaceSoft,
  },
  thumbFallback: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    marginRight: 10,
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.ink,
  },
  logSub: {
    fontSize: fontSize.xs,
    color: colors.muted,
    marginTop: 2,
    fontWeight: '600',
  },
});
