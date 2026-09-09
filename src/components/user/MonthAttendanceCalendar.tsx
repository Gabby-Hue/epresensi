import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AttendanceRecord } from '../../types/attendance';
import { colors, fontSize, spacing } from '../../theme';

interface MonthAttendanceCalendarProps {
  attendances: AttendanceRecord[];
}

export const MonthAttendanceCalendar: React.FC<MonthAttendanceCalendarProps> = ({ attendances }) => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const todayDate = now.getDate();

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();

  // Kelompokkan absensi per tanggal
  const attendanceMap: Record<number, { hasMasuk: boolean; hasPulang: boolean; hasIzin: boolean }> = {};

  attendances.forEach((record) => {
    const recordDate = new Date(record.clockInTime || record.date);
    if (recordDate.getFullYear() === currentYear && recordDate.getMonth() === currentMonth) {
      const day = recordDate.getDate();
      if (!attendanceMap[day]) {
        attendanceMap[day] = { hasMasuk: false, hasPulang: false, hasIzin: false };
      }
      if (record.sessionType === 'masuk') attendanceMap[day].hasMasuk = true;
      if (record.sessionType === 'pulang') attendanceMap[day].hasPulang = true;
      if (record.type === 'izin_sakit' || record.sessionType === 'izin_sakit') {
        attendanceMap[day].hasIzin = true;
      }
    }
  });

  const dayLabels = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

  // Buat array sel kalender (offset hari kosong + tanggal)
  const calendarCells: Array<{ day: number | null }> = [];
  for (let i = 0; i < firstDayIndex; i++) {
    calendarCells.push({ day: null });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarCells.push({ day });
  }

  // Warna block solid per tanggal
  const getDayColors = (day: number) => {
    const info = attendanceMap[day];
    const isPast = day < todayDate;
    const isToday = day === todayDate;

    if (info) {
      if (info.hasIzin || (info.hasMasuk && info.hasPulang)) {
        // Lengkap -> Biru block solid
        return { bg: colors.primary, text: '#FFFFFF' };
      }
      if (info.hasMasuk || info.hasPulang) {
        // 1 sesi -> Kuning block solid
        return { bg: '#F59E0B', text: '#FFFFFF' };
      }
    }

    if (isToday) {
      // Hari ini -> background putih bersih dengan border biru tegas agar menonjol
      return { bg: '#FFFFFF', text: colors.primary, border: colors.primary };
    }

    if (isPast) {
      // Lewat tanpa absen -> Abu-abu gelap block solid
      return { bg: '#475569', text: '#CBD5E1' };
    }

    // Belum tiba -> Putih kebiruan
    return { bg: '#E8F0FE', text: '#64748B' };
  };

  return (
    <View style={styles.container}>
      {/* Header Bulan */}
      <Text style={styles.monthTitle}>{monthNames[currentMonth]} {currentYear}</Text>

      {/* Label Hari */}
      <View style={styles.weekRow}>
        {dayLabels.map((lbl, idx) => (
          <View key={idx} style={styles.weekCell}>
            <Text style={[styles.weekText, idx === 0 && { color: colors.danger }]}>{lbl}</Text>
          </View>
        ))}
      </View>

      {/* Grid Tanggal Block Warna */}
      <View style={styles.grid}>
        {calendarCells.map((cell, index) => {
          if (cell.day === null) {
            return <View key={`e-${index}`} style={styles.cell} />;
          }

          const c = getDayColors(cell.day);

          return (
            <View key={`d-${cell.day}`} style={styles.cell}>
              <View
                style={[
                  styles.block,
                  {
                    backgroundColor: c.bg,
                    borderColor: c.border || 'transparent',
                    borderWidth: c.border ? 2 : 0,
                  },
                ]}
              >
                <Text style={[styles.dayText, { color: c.text }]}>{cell.day}</Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* Legenda */}
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
          <View
            style={[
              styles.legendDot,
              { backgroundColor: '#FFFFFF', borderColor: colors.primary, borderWidth: 1.5 },
            ]}
          />
          <Text style={styles.legendText}>Hari Ini</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#475569' }]} />
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
  monthTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: spacing.sm,
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
