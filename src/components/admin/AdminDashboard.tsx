import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { AttendanceService } from '../../services/attendanceService';
import { AttendanceRecord, OfficeSettings, UserProfile } from '../../types/attendance';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { GeofenceSettings } from './GeofenceSettings';
import { AttendanceFeed } from './AttendanceFeed';
import { LeaveDetailModal } from './LeaveDetailModal';
import { AdminEmployeeManager } from './AdminEmployeeManager';
import { AdminEmployeeRecap } from './AdminEmployeeRecap';
import { AdminApprovalQueue } from './AdminApprovalQueue';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { succeed, fail, select, tap } from '../../services/feedbackService';
import { Feather } from '@expo/vector-icons';
import { colors, fontSize, radius } from '../../theme';

interface AdminDashboardProps {
  currentAdmin: UserProfile;
  users: UserProfile[];
  todayAttendances: AttendanceRecord[];
  pendingApprovals: AttendanceRecord[];
  officeSettings: OfficeSettings;
  officeList: OfficeSettings[];
  onUpdateOfficeSettings: (newSettings: Partial<OfficeSettings>) => Promise<void>;
  onRefreshOffices: () => void;
  onRefreshUsers: () => void;
  onLogout: () => void;
  onPressProfile?: () => void;
}

type TabKey = 'monitoring' | 'geofence' | 'employees' | 'approval';

const TABS: Array<{ key: TabKey; label: string; icon: keyof typeof Feather.glyphMap }> = [
  { key: 'monitoring', label: 'Monitoring', icon: 'pie-chart' },
  { key: 'geofence', label: 'Titik & Radius', icon: 'map' },
  { key: 'employees', label: 'Kelola Karyawan', icon: 'user-plus' },
  { key: 'approval', label: 'Persetujuan', icon: 'inbox' },
];

const PAGE_META: Record<TabKey, { title: string; sub: string }> = {
  monitoring: { title: 'Monitoring Kehadiran', sub: 'Pantau absen karyawan hari ini' },
  geofence: { title: 'Titik & Radius', sub: 'Kelola lokasi dan radius absen kantor' },
  employees: { title: 'Kelola Karyawan', sub: 'Akun dan perangkat karyawan' },
  approval: { title: 'Persetujuan Izin', sub: 'Pengajuan yang menunggu keputusan' },
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentAdmin,
  users,
  todayAttendances,
  pendingApprovals,
  officeSettings,
  officeList,
  onUpdateOfficeSettings,
  onRefreshOffices,
  onRefreshUsers,
  onLogout,
  onPressProfile,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>('monitoring');
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [recapEmployee, setRecapEmployee] = useState<UserProfile | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const employees = users.filter((u) => u.role === 'employee');

  const totalEmployees = employees.length;
  const luringCount = todayAttendances.filter((a) => a.type === 'luring').length;
  const daringCount = todayAttendances.filter((a) => a.type === 'daring').length;
  const izinSakitCount = todayAttendances.filter((a) => a.type === 'izin_sakit').length;

  const clockedInUserIds = new Set(todayAttendances.map((a) => a.userId));
  const unabsentEmployees = employees.filter((e) => !clockedInUserIds.has(e.id));

  const confirmLogout = () => {
    tap();
    setShowLogoutDialog(true);
  };

  const handleReview = async (decision: 'approved' | 'rejected', note?: string) => {
    if (!selectedRecord) return;
    setReviewing(true);
    const res = await AttendanceService.reviewApproval(
      selectedRecord.id,
      decision,
      currentAdmin.id,
      note
    );
    setReviewing(false);
    if (!res.success) {
      fail();
      Alert.alert('Gagal', res.message);
      return;
    }
    succeed();
    setSelectedRecord(null);
    onRefreshUsers();
  };

  const initials = currentAdmin.fullName
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const tabContent = (
    <>
      {activeTab === 'monitoring' && (
        <>
          {/* Stats Overview */}
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { width: isWide ? '23.5%' : '48.5%' }]}>
              <Text style={styles.statNumber}>{totalEmployees}</Text>
              <Text style={styles.statLabel}>Total Karyawan</Text>
            </View>

            <View style={[styles.statCard, { width: isWide ? '23.5%' : '48.5%' }]}>
              <Text style={[styles.statNumber, { color: colors.masuk }]}>{luringCount}</Text>
              <Text style={styles.statLabel}>Absen Kantor</Text>
            </View>

            <View style={[styles.statCard, { width: isWide ? '23.5%' : '48.5%' }]}>
              <Text style={[styles.statNumber, { color: colors.primaryDark }]}>{daringCount}</Text>
              <Text style={styles.statLabel}>Absen Rumah</Text>
            </View>

            <View style={[styles.statCard, { width: isWide ? '23.5%' : '48.5%' }]}>
              <Text style={[styles.statNumber, { color: colors.izin }]}>{izinSakitCount}</Text>
              <Text style={styles.statLabel}>Izin / Sakit</Text>
            </View>
          </View>

          {/* Unabsent Employees Warning Banner */}
          <Card
            title={`Belum absen hari ini (${unabsentEmployees.length})`}
            subtitle="Karyawan yang belum absen — ketuk untuk lihat rekap"
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
                <TouchableOpacity
                  key={emp.id}
                  activeOpacity={0.7}
                  onPress={() => {
                    select();
                    setRecapEmployee(emp);
                  }}
                  style={styles.unabsentRow}
                >
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
                </TouchableOpacity>
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
        <GeofenceSettings
          offices={officeList.length > 0 ? officeList : [officeSettings]}
          onAdd={async (params) => {
            const res = await AttendanceService.addOffice(params);
            if (res.success) onRefreshOffices();
            return { success: res.success, message: res.message };
          }}
          onUpdate={async (id, params) => {
            const res = await AttendanceService.updateOffice(id, params);
            if (res.success) {
              onRefreshOffices();
              await onUpdateOfficeSettings({});
            }
            return { success: res.success, message: res.message };
          }}
          onDelete={async (id) => {
            const res = await AttendanceService.deleteOffice(id);
            if (res.success) {
              onRefreshOffices();
              await onUpdateOfficeSettings({});
            }
            return { success: res.success, message: res.message };
          }}
        />
      )}

      {activeTab === 'employees' && (
        <AdminEmployeeManager
          currentAdmin={currentAdmin}
          users={users}
          onChanged={onRefreshUsers}
          onSelectEmployee={(u) => setRecapEmployee(u)}
        />
      )}

      {activeTab === 'approval' && (
        <AdminApprovalQueue
          requests={pendingApprovals}
          onSelect={(rec) => setSelectedRecord(rec)}
        />
      )}
    </>
  );

  const pageMeta = PAGE_META[activeTab];

  return (
    <View style={styles.container}>
      {isWide ? (
        /* Layout web: sidebar + konten */
        <View style={styles.webLayout}>
          <View style={styles.sidebar}>
            <View style={styles.brandRow}>
              <View style={styles.brandIcon}>
                <Feather name="check-square" size={20} color="#FFFFFF" />
              </View>
              <View>
                <Text style={styles.brandTitle}>E-Presensi</Text>
                <Text style={styles.brandSub}>Panel Admin</Text>
              </View>
            </View>

            {TABS.map((tab) => {
              const active = activeTab === tab.key;
              const count = tab.key === 'approval' ? pendingApprovals.length : 0;
              return (
                <TouchableOpacity
                  key={tab.key}
                  activeOpacity={0.8}
                  onPress={() => {
                    select();
                    setActiveTab(tab.key);
                  }}
                  style={[styles.sideNav, active && styles.sideNavActive]}
                >
                  <Feather
                    name={tab.icon}
                    size={18}
                    color={active ? colors.primaryDark : colors.muted}
                    style={{ marginRight: 10 }}
                  />
                  <Text style={[styles.sideNavText, active && styles.sideNavTextActive]}>
                    {tab.label}
                  </Text>
                  {count > 0 && (
                    <View style={styles.countBadge}>
                      <Text style={styles.countText}>{count}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}

            <View style={{ flex: 1 }} />

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={confirmLogout}
              style={styles.sideLogout}
            >
              <Feather name="power" size={18} color={colors.danger} style={{ marginRight: 10 }} />
              <Text style={styles.sideLogoutText}>Keluar</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.mainCol}>
            <View style={styles.webTopbar}>
              <View>
                <Text style={styles.pageTitle}>{pageMeta.title}</Text>
                <Text style={styles.pageSub}>{pageMeta.sub}</Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={onPressProfile}
                style={styles.adminChip}
              >
                <View style={styles.adminAvatar}>
                  <Text style={styles.adminAvatarText}>{initials}</Text>
                </View>
                <View>
                  <Text style={styles.adminName}>{currentAdmin.fullName}</Text>
                  <Text style={styles.adminDept}>{currentAdmin.department || 'Admin'}</Text>
                </View>
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[styles.scroll, styles.scrollWide]}
            >
              {tabContent}
            </ScrollView>
          </View>
        </View>
      ) : (
        /* Layout HP: tab atas + konten */
        <>
          <View style={styles.tabHeader}>
            {TABS.map((tab) => {
              const active = activeTab === tab.key;
              const count = tab.key === 'approval' ? pendingApprovals.length : 0;
              return (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => {
                    select();
                    setActiveTab(tab.key);
                  }}
                  style={[styles.navTab, active && styles.activeNavTab]}
                >
                  <Feather
                    name={tab.icon}
                    size={16}
                    color={active ? '#FFFFFF' : colors.muted}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={[styles.navTabText, active && styles.activeNavText]}>
                    {tab.label}{count > 0 ? ` (${count})` : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scroll}
          >
            {tabContent}
          </ScrollView>

          {/* Floating Red Shutdown / Logout Button */}
          <TouchableOpacity activeOpacity={0.85} onPress={confirmLogout} style={styles.floatingLogoutBtn}>
            <Feather name="power" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </>
      )}

      {/* Modal Detail */}
      <LeaveDetailModal
        visible={!!selectedRecord}
        onClose={() => setSelectedRecord(null)}
        record={selectedRecord}
        onApprove={(note) => handleReview('approved', note)}
        onReject={(note) => handleReview('rejected', note)}
        processing={reviewing}
      />

      {/* Rekap tanggalan per karyawan */}
      <AdminEmployeeRecap
        visible={!!recapEmployee}
        employee={recapEmployee}
        onClose={() => setRecapEmployee(null)}
      />

      {/* Pop-up Modal Konfirmasi Keluar */}
      <ConfirmDialog
        visible={showLogoutDialog}
        onClose={() => setShowLogoutDialog(false)}
        onConfirm={onLogout}
        title="Konfirmasi Keluar"
        message="Apakah Anda yakin ingin keluar dari akun admin? Sesi kerja saat ini akan diakhiri."
        confirmText="Ya, Keluar"
        cancelText="Batal"
        icon="log-out"
        variant="danger"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  /* Tab HP: grid 2x2 */
  tabHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  navTab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
    flexBasis: '45%',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
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
  /* Lebar konten dashboard web — di browser dibatasi biar rapi */
  scrollWide: {
    maxWidth: 1024,
    width: '100%',
    alignSelf: 'center',
  },
  /* Layout web */
  webLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: 250,
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    padding: 16,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  brandIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  brandTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.ink,
  },
  brandSub: {
    fontSize: fontSize.xs,
    color: colors.muted,
    fontWeight: '600',
  },
  sideNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginBottom: 4,
  },
  sideNavActive: {
    backgroundColor: colors.primarySoft,
  },
  sideNavText: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.muted,
  },
  sideNavTextActive: {
    color: colors.primaryDark,
  },
  countBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sideLogout: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sideLogoutText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.danger,
  },
  mainCol: {
    flex: 1,
  },
  webTopbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pageTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.ink,
  },
  pageSub: {
    fontSize: fontSize.sm,
    color: colors.muted,
    marginTop: 2,
    fontWeight: '600',
  },
  adminChip: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  adminAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  adminAvatarText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  adminName: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.ink,
  },
  adminDept: {
    fontSize: fontSize.xs,
    color: colors.muted,
    fontWeight: '600',
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
});
