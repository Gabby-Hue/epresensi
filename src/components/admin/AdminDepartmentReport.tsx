import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { UserProfile, AttendanceRecord } from '../../types/attendance';
import { AttendanceService } from '../../services/attendanceService';
import { todayWIB } from '../../utils/dates';
import { buildRekap, exportRekapCSV, exportRekapXLSX } from '../../services/exportService';
import { Card } from '../ui/Card';
import { Feather } from '@expo/vector-icons';
import { colors, fontSize, radius } from '../../theme';
import { select } from '../../services/feedbackService';

const csvCell = (value: string) => `"${String(value).replace(/"/g, '""')}"`;

export const AdminDepartmentReport: React.FC<{ users: UserProfile[] }> = ({ users }) => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [departmentList, setDepartmentList] = useState<string[]>([
    'Sales',
    'IT',
    'Drafter',
    'Human Capital',
    'Marketing',
  ]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      AttendanceService.getAllAttendances(),
      AttendanceService.getDepartments(),
    ])
      .then(([recs, depts]) => {
        setRecords(recs);
        if (depts && depts.length > 0) {
          setDepartmentList(depts);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const allDepartments = useMemo(() => {
    const set = new Set(departmentList);
    users.forEach((u) => {
      if (u.role === 'employee' && u.department) set.add(u.department);
    });
    return Array.from(set);
  }, [departmentList, users]);

  const report = useMemo(
    () =>
      allDepartments.map((department) => {
        const staff = users.filter((u) => u.role === 'employee' && u.department === department);
        const ids = new Set(staff.map((u) => u.id));
        const present = new Set(
          records
            .filter((r) => ids.has(r.userId) && r.approvalStatus !== 'rejected' && r.sessionType !== 'izin_sakit')
            .map((r) => r.userId)
        );
        const leave = new Set(
          records
            .filter((r) => ids.has(r.userId) && r.sessionType === 'izin_sakit' && r.approvalStatus === 'approved')
            .map((r) => r.userId)
        );
        return {
          department,
          total: staff.length,
          present: present.size,
          leave: leave.size,
          percentage: staff.length ? Math.round((present.size / staff.length) * 100) : 0,
        };
      }),
    [allDepartments, users, records]
  );

  const guardWeb = (label: string) => {
    select();
    if (Platform.OS !== 'web') {
      Alert.alert(label, 'Export saat ini tersedia melalui dashboard web.');
      return false;
    }
    return true;
  };

  const stamp = todayWIB();
  const fname = (scope: string, ext: string) => `laporan-absensi-${scope}-${stamp}.${ext}`;

  // Format baru: 1 baris per orang per tanggal, Jam Masuk (biru) + Jam Pulang (kuning di XLSX),
  // kolom tambahan: PT, Kantor, Jarak, Alasan. CSV tetap tersedia sebagai cadangan polos.
  const exportDepartment = (department: string) => {
    if (!guardWeb('Export Excel')) return;
    const rows = buildRekap(users, records, { department });
    exportRekapXLSX(rows, fname(`${department.toLowerCase()}-rekap`, 'xlsx'));
  };

  const exportDepartmentCSV = (department: string) => {
    if (!guardWeb('Export CSV')) return;
    const rows = buildRekap(users, records, { department });
    exportRekapCSV(rows, fname(`${department.toLowerCase()}-rekap`, 'csv'));
  };

  const exportAll = () => {
    if (!guardWeb('Export Excel')) return;
    const rows = buildRekap(users, records);
    exportRekapXLSX(rows, fname('semua-rekap', 'xlsx'));
  };

  const exportAllCSV = () => {
    if (!guardWeb('Export CSV')) return;
    const rows = buildRekap(users, records);
    exportRekapCSV(rows, fname('semua-rekap', 'csv'));
  };

  return (
    <Card
      title="Rincian Departemen"
      subtitle="Tingkat kehadiran dan statistik per divisi kerja"
      icon="briefcase"
      action={
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            style={styles.exportAllBtn}
            onPress={exportAll}
            activeOpacity={0.8}
          >
            <Feather name="download" size={14} color={colors.primaryDark} style={{ marginRight: 6 }} />
            <Text style={styles.exportAllText}>Excel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.exportAllBtn, { backgroundColor: colors.surfaceSoft }]}
            onPress={exportAllCSV}
            activeOpacity={0.8}
          >
            <Text style={[styles.exportAllText, { color: colors.muted }]}>CSV</Text>
          </TouchableOpacity>
        </View>
      }
    >
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.muted}>Memuat statistik departemen...</Text>
        </View>
      ) : (
        report.map((item) => {
          const unabsent = Math.max(0, item.total - item.present - item.leave);
          return (
            <View key={item.department} style={styles.deptCard}>
              <View style={styles.deptCardTop}>
                <View style={styles.deptNameWrap}>
                  <View style={styles.deptIconBadge}>
                    <Feather name="layers" size={14} color={colors.primaryDark} />
                  </View>
                  <Text style={styles.deptName}>{item.department}</Text>
                </View>
                <Text style={styles.deptPercent}>{item.percentage}%</Text>
              </View>

              {/* Progress Bar */}
              <View style={styles.track}>
                <View
                  style={[
                    styles.bar,
                    {
                      width: `${Math.min(100, Math.max(0, item.percentage))}%`,
                      backgroundColor:
                        item.percentage >= 90
                          ? colors.primary
                          : item.percentage >= 70
                          ? colors.pulang
                          : colors.izin,
                    },
                  ]}
                />
              </View>

              {/* Footer Info & Badges */}
              <View style={styles.deptCardBottom}>
                <Text style={styles.deptStaffCount}>
                  {item.present} / {item.total} Hadir
                </Text>

                <View style={styles.badgeRow}>
                  {item.total === 0 ? (
                    <View style={[styles.statusPill, { backgroundColor: colors.surfaceSoft }]}>
                      <Text style={[styles.statusPillText, { color: colors.muted }]}>Belum ada staf</Text>
                    </View>
                  ) : item.present === item.total ? (
                    <View style={[styles.statusPill, { backgroundColor: colors.primarySoft }]}>
                      <Text style={[styles.statusPillText, { color: colors.primaryDark }]}>Lengkap</Text>
                    </View>
                  ) : (
                    <>
                      {item.leave > 0 && (
                        <View style={[styles.statusPill, { backgroundColor: colors.izinSoft, marginRight: 6 }]}>
                          <Text style={[styles.statusPillText, { color: colors.izin }]}>
                            {item.leave} Izin Sakit
                          </Text>
                        </View>
                      )}
                      {unabsent > 0 && (
                        <View style={[styles.statusPill, { backgroundColor: colors.pulangSoft }]}>
                          <Text style={[styles.statusPillText, { color: colors.pulang }]}>
                            {unabsent} Belum Absen
                          </Text>
                        </View>
                      )}
                    </>
                  )}

                  <TouchableOpacity
                    style={styles.deptExportBtn}
                    onPress={() => exportDepartment(item.department)}
                    hitSlop={8}
                  >
                    <Feather name="download" size={12} color={colors.primaryDark} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.deptExportBtn, { marginLeft: 4 }]}
                    onPress={() => exportDepartmentCSV(item.department)}
                    hitSlop={8}
                  >
                    <Text style={{ fontSize: 10, color: colors.muted, fontWeight: '700' }}>CSV</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  loading: {
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  muted: {
    color: colors.muted,
    fontSize: fontSize.xs,
  },
  exportAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  exportAllText: {
    color: colors.primaryDark,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  deptCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 10,
  },
  deptCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deptNameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  deptIconBadge: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  deptName: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.ink,
  },
  deptPercent: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceSoft,
    overflow: 'hidden',
    marginVertical: 10,
  },
  bar: {
    height: '100%',
    borderRadius: 4,
  },
  deptCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deptStaffCount: {
    fontSize: fontSize.xs,
    color: colors.muted,
    fontWeight: '600',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  deptExportBtn: {
    marginLeft: 8,
    padding: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
});
