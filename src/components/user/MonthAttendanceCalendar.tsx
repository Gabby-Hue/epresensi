// E-Presensi UI · Shadcn-Inspired Attendance Calendar
// Clean institutional calendar layout, monthly stat summary strip, polished nav controls,
// and authentic E-Presensi semantic session colors.

import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AttendanceRecord } from '../../types/attendance';
import { colors, fontSize, radius, spacing } from '../../theme';
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
  if (!info && isWeekend) return 'libur';
  if (isToday) return 'hari_ini_kosong';
  if (isPast) return 'absen';
  return 'akan_datang';
};

interface MonthAttendanceCalendarProps {
  attendances: AttendanceRecord[];
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

  // Ringkasan metrik bulanan ala Shadcn dashboard
  const monthStats = useMemo(() => {
    let hadir = 0;
    let satuSesi = 0;
    let izin = 0;
    let alpa = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const info = attendanceMap[d];
      const isPast = isPastMonth || (isCurrentMonth && d < todayDate);
      const isToday = isCurrentMonth && d === todayDate;
      const weekday = new Date(year, month, d).getDay();
      const isWeekend = weekday === 0 || weekday === 6;
      const st = getDayStatus(info, isPast, isToday, isWeekend);
      if (st === 'lengkap') hadir++;
      else if (st === 'satu_sesi') satuSesi++;
      else if (st === 'izin') izin++;
      else if (st === 'absen') alpa++;
    }
    return { hadir, satuSesi, izin, alpa };
  }, [attendanceMap, daysInMonth, isPastMonth, isCurrentMonth, todayDate, year, month]);

  // Skema warna asli E-Presensi:
  // alpa = abu-abu solid, 1 sesi = kuning solid, lengkap = biru solid,
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
        return { bg: '#FFFFFF', text: colors.izin, border: colors.izin, isToday };
      case 'menunggu':
        return { bg: '#FFFFFF', text: '#B45309', border: '#F59E0B', isToday };
      case 'libur':
        return { bg: colors.izin, text: '#FFFFFF', isToday };
      case 'lengkap':
        return { bg: colors.primary, text: '#FFFFFF', isToday };
      case 'satu_sesi':
        return { bg: '#F59E0B', text: '#FFFFFF', isToday };
      case 'absen':
        return { bg: '#64748B', text: '#FFFFFF', isToday };
      case 'hari_ini_kosong':
        return { bg: '#FFFFFF', text: colors.primary, border: colors.primary, isToday };
      default:
        return { bg: '#E8F0FE', text: '#64748B', isToday: false };
    }
  };

  const jumpToToday = () => {
    select();
    const t = new Date();
    setMonth(t.getFullYear(), t.getMonth());
    onSelectDay?.(t.getDate());
  };

  return (
    <View style={styles.container}>
      {/* 1. Shadcn-Style Month Navigator Header */}
      <View style={styles.monthHeader}>
        <View style={styles.titleGroup}>
          <Text style={styles.monthTitle}>{monthNames[month]} {year}</Text>
          {isCurrentMonth && (
            <View style={styles.currentMonthBadge}>
              <Text style={styles.currentMonthBadgeText}>Bulan Ini</Text>
            </View>
          )}
        </View>

        {showNav && (
          <View style={styles.navControls}>
            {!isCurrentMonth && (
              <TouchableOpacity
                onPress={jumpToToday}
                style={styles.todayShortcutBtn}
                hitSlop={8}
                activeOpacity={0.7}
              >
                <Text style={styles.todayShortcutText}>Hari Ini</Text>
              </TouchableOpacity>
            )}
            <View style={styles.chevronGroup}>
              <TouchableOpacity
                onPress={() => { select(); goPrev(); }}
                style={styles.chevronBtn}
                hitSlop={8}
                activeOpacity={0.7}
              >
                <Feather name="chevron-left" size={17} color={colors.ink} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { select(); goNext(); }}
                style={styles.chevronBtn}
                hitSlop={8}
                activeOpacity={0.7}
              >
                <Feather name="chevron-right" size={17} color={colors.ink} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* 2. Shadcn Monthly Stat Summary Chips */}
      <View style={styles.statSummaryGrid}>
        <View style={styles.statChip}>
          <Text style={styles.statChipLabel}>Lengkap</Text>
          <Text style={[styles.statChipValue, { color: colors.primary }]}>{monthStats.hadir}</Text>
        </View>
        <View style={styles.statChip}>
          <Text style={styles.statChipLabel}>1 Sesi</Text>
          <Text style={[styles.statChipValue, { color: '#D97706' }]}>{monthStats.satuSesi}</Text>
        </View>
        <View style={styles.statChip}>
          <Text style={styles.statChipLabel}>Izin/Sakit</Text>
          <Text style={[styles.statChipValue, { color: colors.izin }]}>{monthStats.izin}</Text>
        </View>
        <View style={styles.statChip}>
          <Text style={styles.statChipLabel}>Alpa</Text>
          <Text style={[styles.statChipValue, { color: colors.muted }]}>{monthStats.alpa}</Text>
        </View>
      </View>

      {/* 3. Weekday Columns */}
      <View style={styles.weekHeaderRow}>
        {dayLabels.map((lbl, idx) => {
          const isWeekend = idx === 0 || idx === 6;
          return (
            <View key={idx} style={styles.weekHeaderCell}>
              <Text style={[styles.weekHeaderText, isWeekend && styles.weekHeaderTextWeekend]}>
                {lbl}
              </Text>
            </View>
          );
        })}
      </View>

      {/* 4. Calendar Days Grid */}
      <View style={styles.daysGrid}>
        {calendarCells.map((cell, index) => {
          if (cell.day === null) {
            return <View key={`e-${index}`} style={styles.dayCellWrapper} />;
          }

          const c = getDayColors(cell.day);
          const isSelected = selectedDay === cell.day;

          return (
            <View key={`d-${cell.day}`} style={styles.dayCellWrapper}>
              <TouchableOpacity
                activeOpacity={0.75}
                disabled={!onSelectDay}
                onPress={() => {
                  select();
                  onSelectDay?.(cell.day!);
                }}
                style={[
                  styles.dayTile,
                  {
                    backgroundColor: c.bg,
                    borderColor: isSelected ? colors.ink : c.border || 'transparent',
                    borderWidth: isSelected ? 2 : c.border ? 1.5 : 0,
                  },
                ]}
              >
                <Text style={[styles.dayTileText, { color: c.text }]}>
                  {cell.day}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>

      {/* 5. Clean Semantic Status Legend */}
      <View style={styles.legendContainer}>
        <View style={styles.legendRow}>
          <View style={styles.legendPill}>
            <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
            <Text style={styles.legendLabel}>Lengkap</Text>
          </View>
          <View style={styles.legendPill}>
            <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
            <Text style={styles.legendLabel}>1 Sesi</Text>
          </View>
          <View style={styles.legendPill}>
            <View style={[styles.legendDot, { backgroundColor: '#FFFFFF', borderColor: colors.izin, borderWidth: 1.5 }]} />
            <Text style={styles.legendLabel}>Izin/Sakit</Text>
          </View>
          <View style={styles.legendPill}>
            <View style={[styles.legendDot, { backgroundColor: '#FFFFFF', borderColor: '#F59E0B', borderWidth: 1.5 }]} />
            <Text style={styles.legendLabel}>Menunggu</Text>
          </View>
          <View style={styles.legendPill}>
            <View style={[styles.legendDot, { backgroundColor: colors.izin }]} />
            <Text style={styles.legendLabel}>Libur</Text>
          </View>
          <View style={styles.legendPill}>
            <View style={[styles.legendDot, { backgroundColor: '#64748B' }]} />
            <Text style={styles.legendLabel}>Alpa</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 2,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.2,
  },
  currentMonthBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
  },
  currentMonthBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  navControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  todayShortcutBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 2,
  },
  todayShortcutText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.ink,
  },
  chevronGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chevronBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Stat Summary Strip (Shadcn style)
  statSummaryGrid: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: spacing.sm,
  },
  statChip: {
    flex: 1,
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.md,
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderMuted,
  },
  statChipLabel: {
    fontSize: 10,
    color: colors.muted,
    fontWeight: '600',
  },
  statChipValue: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  weekHeaderRow: {
    flexDirection: 'row',
    paddingBottom: 6,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderMuted,
  },
  weekHeaderCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 2,
  },
  weekHeaderText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted,
  },
  weekHeaderTextWeekend: {
    color: colors.danger,
    fontWeight: '600',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 2,
  },
  dayCellWrapper: {
    width: '14.2857%',
    aspectRatio: 1,
    padding: 2.5,
  },
  dayTile: {
    flex: 1,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayTileText: {
    fontSize: 13,
    fontWeight: '700',
  },
  legendContainer: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderMuted,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-start',
  },
  legendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  legendLabel: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: '500',
  },
});
