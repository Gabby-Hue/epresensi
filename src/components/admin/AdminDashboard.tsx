import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { AttendanceRecord, OfficeSettings, UserProfile } from '../../types/attendance';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { GeofenceSettings } from './GeofenceSettings';
import { AttendanceFeed } from './AttendanceFeed';
import { LeaveDetailModal } from './LeaveDetailModal';
import { AdminEmployeeManager } from './AdminEmployeeManager';
import { Feather } from '@expo/vector-icons';
import { colors, fontSize, radius } from '../../theme';

interface AdminDashboardProps {
  currentAdmin: UserProfile;
  users: UserProfile[];
  todayAttendances: AttendanceRecord[];
  officeSettings: OfficeSettings;
  onUpdateOfficeSettings: (newSettings: Partial<OfficeSettings>) => Promise<void>;
  onRefreshUsers: () => void;
  onLogout: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentAdmin,
  users,
  todayAttendances,
  officeSettings,
  onUpdateOfficeSettings,
  onRefreshUsers,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'monitoring' | 'geofence' | 'employees'>('monitoring');
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);

  const employees = users.filter((u) => u.role === 'employee');

  const totalEmployees = employees.length;
  const luringCount = todayAttendances.filter((a) => a.type === 'luring').length;
  const daringCount = todayAttendances.filter((a) => a.type === 'daring').length;
  const izinSakitCount = todayAttendances.filter((a) => a.type === 'izin_sakit').length;

  const clockedInUserIds = new Set(todayAttendances.map((a) => a.userId));
  const unabsentEmployees = employees.filter((e) => !clockedInUserIds.has(e.id));

  return (
    <View style={styles.container}>
      <View style={styles.tabHeader}>
        <TouchableOpacity
          onPress={() => setActiveTab('monitoring')}
          style={[styles.navTab, activeTab === 'monitoring' && styles.activeNavTab]}
        >
          <Feather
            name="pie-chart"
            size={16}
            color={activeTab === 'monitoring' ? '#FFFFFF' : colors.muted}
            style={{ marginRight: 4 }}
          />
          <Text style={[styles.navTabText, activeTab === 'monitoring' && styles.activeNavText]}>
            Monitoring
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('geofence')}
          style={[styles.navTab, activeTab === 'geofence' && styles.activeNavTab]}
        >
          <Feather
            name="map"
            size={16}
            color={activeTab === 'geofence' ? '#FFFFFF' : colors.muted}
            style={{ marginRight: 4 }}
          />
          <Text style={[styles.navTabText, activeTab === 'geofence' && styles.activeNavText]}>
            Titik & Radius
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('employees')}
          style={[styles.navTab, activeTab === 'employees' && styles.activeNavTab]}
        >
          <Feather
            name="user-plus"
            size={16}
            color={activeTab === 'employees' ? '#FFFFFF' : colors.muted}
            style={{ marginRight: 4 }}
          />
          <Text style={[styles.navTabText, activeTab === 'employees' && styles.activeNavText]}>
            Kelola Karyawan
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {activeTab === 'monitoring' && (
          <>
            {/* Stats Overview */}
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{totalEmployees}</Text>
                <Text style={styles.statLabel}>Total Karyawan</Text>
              </View>

              <View style={styles.statCard}>
                <Text style={[styles.statNumber, { color: colors.masuk }]}>{luringCount}</Text>
                <Text style={styles.statLabel}>Absen Kantor</Text>
              </View>

              <View style={styles.statCard}>
                <Text style={[styles.statNumber, { color: colors.primaryDark }]}>{daringCount}</Text>
                <Text style={styles.statLabel}>Absen Rumah</Text>
              </View>

              <View style={styles.statCard}>
                <Text style={[styles.statNumber, { color: colors.izin }]}>{izinSakitCount}</Text>
                <Text style={styles.statLabel}>Izin / Sakit</Text>
              </View>
            </View>

            {/* Unabsent Employees Warning Banner */}
            <Card
              title={`Belum absen hari ini (${unabsentEmployees.length})`}
              subtitle="Karyawan yang belum absen"
              icon="alert-circle"
            >
              {unabsentEmployees.length === 0 ? (
                <View style={styles.allPresentBox}>
                  <Feather name="check" size={16} color={colors.successInk} />
                  <Text style={styles.allPresentText}>
                    Semua karyawan sudah absen hari ini.
                  </Text>
                </View>
              ) : (
                unabsentEmployees.map((emp) => (
                  <View key={emp.id} style={styles.unabsentRow}>
                    <View style={styles.unabsentLeft}>
                      <View style={styles.unabsentAvatar}>
                        <Text style={styles.unabsentAvatarText}>
                          {emp.fullName.substring(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View>
                        <Text style={styles.unabsentName}>{emp.fullName}</Text>
                        <Text style={styles.unabsentDept}>{emp.department || 'Staff'}</Text>
                      </View>
                    </View>
                    <Badge type="belum_absen" size="sm" />
                  </View>
                ))
              )}
            </Card>

            {/* Attendance Feed */}
            <AttendanceFeed
              attendances={todayAttendances}
              onSelectRecord={(rec) => setSelectedRecord(rec)}
            />
          </>
        )}

        {activeTab === 'geofence' && (
          <GeofenceSettings settings={officeSettings} onSave={onUpdateOfficeSettings} />
        )}

        {activeTab === 'employees' && (
          <AdminEmployeeManager currentAdmin={currentAdmin} users={users} onChanged={onRefreshUsers} />
        )}
      </ScrollView>

      {/* Minimal Floating Logout Button */}
      <TouchableOpacity activeOpacity={0.85} onPress={onLogout} style={styles.floatingLogoutBtn}>
        <Feather name="power" size={20} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Modal Detail */}
      <LeaveDetailModal
        visible={!!selectedRecord}
        onClose={() => setSelectedRecord(null)}
        record={selectedRecord}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  tabHeader: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  navTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    marginRight: 6,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activeNavTab: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  navTabText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.muted,
  },
  activeNavText: {
    color: '#FFFFFF',
  },
  scroll: {
    padding: 16,
    paddingBottom: 85,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  statCard: {
    width: '48.5%',
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: radius.md,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statNumber: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.ink,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.muted,
    marginTop: 2,
    fontWeight: '600',
  },
  allPresentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successSoft,
    padding: 10,
    borderRadius: radius.sm,
  },
  allPresentText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.successInk,
    marginLeft: 6,
  },
  unabsentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  unabsentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unabsentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  unabsentAvatarText: {
    color: colors.ink,
    fontWeight: '700',
    fontSize: fontSize.xs,
  },
  unabsentName: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.ink,
  },
  unabsentDept: {
    fontSize: fontSize.xs,
    color: colors.muted,
  },
  floatingLogoutBtn: {
    position: 'absolute',
    bottom: 18,
    right: 18,
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
