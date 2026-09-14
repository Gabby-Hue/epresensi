import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AttendanceRecord } from '../../types/attendance';
import { colors, fontSize, spacing } from '../../theme';
import { select } from '../../services/feedbackService';

export type DayStatus = 'lengkap' | 'satu_sesi' | 'izin' | 'menunggu' | 'libur' | 'absen' | 'akan_datang' | 'hari_ini_kosong';

export interface DayInfo {
  hasMasuk: boolean;
  hasPulang: boolean;
  hasIzin: boolean;
  hasPending: boolean;
}

export const buildAttendanceMap = (
  attendances: AttendanceRecord[],
  year: number,
  month: number
): Record<number, DayInfo> => {
  const map: Record<number, DayInfo> = {};
  attendances.forEach((record) => {
    // Pakai field date YYYY-MM-DD biar tidak geser timezone seperti clockInTime
    let y = -1;
    let m = -1;
    let d = -1;
    if (record.date && /^\d{4}-\d{2}-\d{2}/.test(record.date)) {
      const parts = record.date.split('-');
      y = Number(parts[0]);
      m = Number(parts[1]) - 1;
      d = Number(parts[2]);
    } else {
      const rd = new Date(record.clockInTime || record.date);
      y = rd.getFullYear();
      m = rd.getMonth();
      d = rd.getDate();
    }
    if (y === year && m === month) {
      if (!map[d]) map[d] = { hasMasuk: false, hasPulang: false, hasIzin: false, hasPending: false };
      if (record.sessionType === 'masuk') map[d].hasMasuk = true;
      if (record.sessionType === 'pulang') map[d].hasPulang = true;
      if (record.type === 'izin_sakit' || record.sessionType === 'izin_sakit') {
        // Pengajuan yang masih menunggu tidak dihitung sebagai izin sah
        if (record.approvalStatus === 'pending') {
          map[d].hasPending = true;
        } else if (record.approvalStatus === 'approved') {
          map[d].hasIzin = true;
        }
      }
    }
  });
  return map;
};

export const getDayStatus = (
  info: DayInfo | undefined,
  isPast: boolean,
  isToday: boolean,
  isWeekend = false
): DayStatus => {
  if (info?.hasIzin) return 'izin';
  if (info?.hasMasuk && info?.hasPulang) return 'lengkap';
  if (info?.hasMasuk || info?.hasPulang) return 'satu_sesi';
  if (info?.hasPending) return 'menunggu';
  // Sabtu-Minggu selalu merah libur — berlaku di bulan lalu, bulan ini, maupun bulan depan
  if (!info && isWeekend) return 'libur';
  if (isToday) return 'hari_ini_kosong';
  if (isPast) return 'absen';
  return 'akan_datang';
};

interface MonthAttendanceCalendarProps {
  attendances: AttendanceRecord[];
  /** Kalau diisi, kalender dikontrol dari luar (dipakai admin untuk lihat bulan lain). */
  year?: number;
  month?: number;
  onMonthChange?: (year: number, month: number) => void;
  selectedDay?: number | null;
  onSelectDay?: (day: number) => void;
  showNav?: boolean;
}

const monthNames = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export const MonthAttendanceCalendar: React.FC<MonthAttendanceCalendarProps> = ({
  attendances,
  year: yearProp,
  month: monthProp,
  onMonthChange,
  selectedDay,
  onSelectDay,
  showNav = true,
}) => {
  const now = new Date();
  const [innerYear, setInnerYear] = useState(now.getFullYear());
  const [innerMonth, setInnerMonth] = useState(now.getMonth());

  const year = yearProp ?? innerYear;
  const month = monthProp ?? innerMonth;

  const setMonth = (y: number, m: number) => {
    if (yearProp === undefined || monthProp === undefined) {
      setInnerYear(y);
      setInnerMonth(m);
    }
    onMonthChange?.(y, m);
  };

  const goPrev = () => {
    const d = new Date(year, month - 1, 1);
    setMonth(d.getFullYear(), d.getMonth());
  };
  const goNext = () => {
    const d = new Date(year, month + 1, 1);
    setMonth(d.getFullYear(), d.getMonth());
  };

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();

  const attendanceMap = useMemo(
    () => buildAttendanceMap(attendances, year, month),
    [attendances, year, month]
  );

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const isPastMonth =
    year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth());
  const todayDate = now.getDate();

  const dayLabels = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

  const calendarCells: Array<{ day: number | null }> = [];
  for (let i = 0; i < firstDayIndex; i++) {
    calendarCells.push({ day: null });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarCells.push({ day });
  }

  // Aturan warna: alpa = abu-abu solid, 1 sesi = kuning, lengkap = biru,
  // izin = merah hollow (putih + border merah), Sabtu-Minggu kosong = merah solid
  const getDayColors = (day: number) => {
    const info = attendanceMap[day];
    const isPast = isPastMonth || (isCurrentMonth && day < todayDate);
    const isToday = isCurrentMonth && day === todayDate;
    const weekday = new Date(year, month, day).getDay();
    const isWeekend = weekday === 0 || weekday === 6;
    const status = getDayStatus(info, isPast, isToday, isWeekend);

    switch (status) {
      case 'izin':
        return { bg: '#FFFFFF', text: colors.izin, border: colors.izin };
      case 'menunggu':
        return { bg: '#FFFFFF', text: '#B45309', border: '#F59E0B' };
      case 'libur':
        return { bg: colors.izin, text: '#FFFFFF' };
      case 'lengkap':
        return { bg: colors.primary, text: '#FFFFFF' };
      case 'satu_sesi':
        return { bg: '#F59E0B', text: '#0C1B2A' };
      case 'absen':
        return { bg: '#64748B', text: '#FFFFFF' };
      case 'hari_ini_kosong':
        return { bg: '#FFFFFF', text: colors.primary, border: colors.primary };
      default:
        return { bg: '#E8F0FE', text: '#64748B' };
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.monthRow}>
        <Text style={styles.monthTitle}>{monthNames[month]} {year}</Text>
        {showNav && (
          <View style={styles.navRow}>
            <TouchableOpacity onPress={goPrev} style={styles.navBtn} hitSlop={12}>
              <Feather name="chevron-left" size={20} color={colors.ink} />
            </TouchableOpacity>
            <TouchableOpacity onPress={goNext} style={styles.navBtn} hitSlop={12}>
              <Feather name="chevron-right" size={20} color={colors.ink} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.weekRow}>
        {dayLabels.map((lbl, idx) => (
          <View key={idx} style={styles.weekCell}>
            <Text style={[styles.weekText, idx === 0 && { color: colors.danger }]}>{lbl}</Text>
          </View>
        ))}
      </View>

      <View style={styles.grid}>
        {calendarCells.map((cell, index) => {
          if (cell.day === null) {
            return <View key={`e-${index}`} style={styles.cell} />;
          }

          const c = getDayColors(cell.day);
          const isSelected = selectedDay === cell.day;

          return (
            <View key={`d-${cell.day}`} style={styles.cell}>
              <TouchableOpacity
                activeOpacity={0.75}
                disabled={!onSelectDay}
                onPress={() => {
                  select();
                  onSelectDay?.(cell.day!);
                }}
                style={[
                  styles.block,
                  {
                    backgroundColor: c.bg,
                    borderColor: isSelected ? colors.ink : c.border || 'transparent',
                    borderWidth: isSelected || c.border ? 2 : 0,
                  },
                ]}
              >
                <Text style={[styles.dayText, { color: c.text }]}>{cell.day}</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
          <Text style={styles.legendText}>Lengkap</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
          <Text style={styles.legendText}>1 Sesi</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#FFFFFF', borderColor: colors.izin, borderWidth: 1.5 }]} />
          <Text style={styles.legendText}>Izin/Sakit</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#FFFFFF', borderColor: '#F59E0B', borderWidth: 1.5 }]} />
          <Text style={styles.legendText}>Menunggu</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.izin }]} />
          <Text style={styles.legendText}>Libur</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#64748B' }]} />
          <Text style={styles.legendText}>Tidak Hadir</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#E8F0FE' }]} />
          <Text style={styles.legendText}>Akan Datang</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  monthTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.ink,
  },
  navRow: {
    flexDirection: 'row',
    gap: 4,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  weekCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
  },
  weekText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '14.28%',
    aspectRatio: 1,
    padding: 2,
  },
  block: {
    flex: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: 13,
    fontWeight: '700',
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: '600',
  },
});
