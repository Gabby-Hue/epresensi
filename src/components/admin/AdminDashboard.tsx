import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { AttendanceService } from '../../services/attendanceService';
import { AttendanceRecord, AuditLog, OfficeSettings, UserProfile } from '../../types/attendance';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { GeofenceSettings } from './GeofenceSettings';
import { AttendanceFeed } from './AttendanceFeed';
import { LeaveDetailModal } from './LeaveDetailModal';
import { AdminEmployeeManager } from './AdminEmployeeManager';
import { AdminCompanyManager } from './AdminCompanyManager';
import { AdminEmployeeRecap } from './AdminEmployeeRecap';
import { AdminApprovalQueue } from './AdminApprovalQueue';
import { AdminDepartmentReport } from './AdminDepartmentReport';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { succeed, fail, select, tap } from '../../services/feedbackService';
import { Feather } from '@expo/vector-icons';
import { colors, fontSize, neoShadow, radius } from '../../theme';

interface AdminDashboardProps {
  currentAdmin: UserProfile;
  users: UserProfile[];
  todayAttendances: AttendanceRecord[];
  pendingApprovals: AttendanceRecord[];
  officeSettings: OfficeSettings;
  officeList: OfficeSettings[];
  onUpdateOfficeSettings: (newSettings: Partial<OfficeSettings>) => Promise<void>;
  onRefreshOffices: () => Promise<void>;
  onRefreshUsers: () => void;
  onLogout: () => void;
  onPressProfile?: () => void;
}

type TabKey = 'companies' | 'monitoring' | 'report' | 'geofence' | 'employees' | 'approval';

const TABS: Array<{
  key: TabKey;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  superOnly?: boolean;
  branchOnly?: boolean;
}> = [
  { key: 'companies', label: 'PT & Admin Cabang', icon: 'briefcase', superOnly: true },
  { key: 'monitoring', label: 'Monitoring', icon: 'pie-chart' },
  { key: 'report', label: 'Laporan', icon: 'bar-chart-2', branchOnly: true },
  { key: 'geofence', label: 'Titik & Radius', icon: 'map', branchOnly: true },
  { key: 'employees', label: 'Kelola Karyawan', icon: 'user-plus', branchOnly: true },
  { key: 'approval', label: 'Persetujuan', icon: 'inbox', branchOnly: true },
];

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
  const isSuper = currentAdmin.role === 'superadmin';
  const [activeTab, setActiveTab] = useState<TabKey>(isSuper ? 'companies' : 'monitoring');
  const [companiesList, setCompaniesList] = useState<{ id: string; name: string }[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [recapEmployee, setRecapEmployee] = useState<UserProfile | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  // Load companies & audit logs for superadmin overview
  useEffect(() => {
    if (isSuper) {
      AttendanceService.getCompanies().then((res) => setCompaniesList(res));
      AttendanceService.getAuditLogs().then((res) => setAuditLogs(res));
    }
  }, [isSuper, users]);

  const employees = users.filter((u) => u.role === 'employee');

  const totalEmployees = employees.length;
  const luringCount = todayAttendances.filter((a) => a.type === 'luring').length;
  const daringCount = todayAttendances.filter((a) => a.type === 'daring').length;
  const izinSakitCount = todayAttendances.filter((a) => a.type === 'izin_sakit').length;

  const clockedInUserIds = new Set(todayAttendances.map((a) => a.userId));
  const unabsentEmployees = employees.filter((e) => !clockedInUserIds.has(e.id));

  const presentCount = luringCount + daringCount;
  const presentPct = totalEmployees > 0 ? Math.round((presentCount / totalEmployees) * 100) : 0;
  const leavePct = totalEmployees > 0 ? Math.round((izinSakitCount / totalEmployees) * 100) : 0;
  const unabsentCount = unabsentEmployees.length;
  const unabsentPct = totalEmployees > 0 ? Math.round((unabsentCount / totalEmployees) * 100) : 0;

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

  // Superadmin HANYA melihat menu PT & Admin dan Monitoring Cabang (Pusat)
  // Admin Branch HANYA melihat menu operasional cabang
  const visibleTabs = TABS.filter((t) => {
    if (isSuper) {
      return t.superOnly || (t.key === 'monitoring' && !t.branchOnly);
    } else {
      return !t.superOnly;
    }
  });

  const PAGE_META: Record<TabKey, { title: string; sub: string }> = {
    companies: {
      title: 'PT & Admin Cabang',
      sub: 'Pusat: Kelola perusahaan dan akun admin penanggung jawab tiap cabang',
    },
    monitoring: isSuper
      ? { title: 'Monitoring Seluruh Cabang', sub: 'Executive Overview: Pantau kesehatan presensi & admin seluruh PT' }
      : { title: 'Monitoring Kehadiran', sub: 'Pantau absen karyawan cabang hari ini' },
    report: { title: 'Laporan Departemen', sub: 'Bandingkan kehadiran departemen cabang' },
    geofence: { title: 'Titik & Radius', sub: 'Kelola lokasi dan radius absen kantor cabang' },
    employees: { title: 'Kelola Karyawan', sub: 'Akun dan perangkat karyawan cabang' },
    approval: { title: 'Persetujuan Izin', sub: 'Pengajuan yang menunggu keputusan admin cabang' },
  };

  const initials = currentAdmin.fullName
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const tabContent = (
    <>
      {/* 1. KONTEN TAB MONITORING */}
      {activeTab === 'monitoring' && isSuper && (
        <>
          {/* Executive Holding Status Banner */}
          <View style={[styles.statusBanner, neoShadow.md]}>
            <View style={styles.statusBannerTop}>
              <View style={styles.statusLiveWrap}>
                <View style={styles.statusLiveDot} />
                <Text style={styles.statusLiveText}>SISTEM PUSAT AKTIF</Text>
              </View>
              <View style={styles.syncPill}>
                <Feather name="shield" size={11} color={colors.primaryDark} style={{ marginRight: 5 }} />
                <Text style={[styles.syncText, { color: colors.primaryDark, fontWeight: '700' }]}>Superadmin Holding</Text>
              </View>
            </View>
            <Text style={styles.statusTitle}>Monitoring Eksekutif Seluruh Cabang</Text>
            <Text style={styles.statusDate}>
              Pantau performa kehadiran, admin penanggung jawab, dan kesehatan operasional tiap entitas PT
            </Text>
          </View>

          {/* 4 KPI Holding Counters */}
          <View style={styles.kpiContainer}>
            <View style={[styles.kpiCard, neoShadow.sm, isWide && styles.kpiCardWide]}>
              <View style={styles.kpiContent}>
                <View style={styles.kpiTopRow}>
                  <View>
                    <Text style={styles.kpiLabel}>Total PT / Cabang</Text>
                    <View style={styles.kpiValueRow}>
                      <Text style={styles.kpiNumber}>{companiesList.length || 1}</Text>
                      <Text style={styles.kpiSub}>Entitas</Text>
                    </View>
                  </View>
                  <View style={[styles.kpiBadge, { backgroundColor: colors.primarySoft }]}>
                    <Feather name="briefcase" size={13} color={colors.primary} />
                  </View>
                </View>
              </View>
            </View>

            <View style={[styles.kpiCard, neoShadow.sm, isWide && styles.kpiCardWide]}>
              <View style={styles.kpiContent}>
                <View style={styles.kpiTopRow}>
                  <View>
                    <Text style={styles.kpiLabel}>Admin Cabang Bertugas</Text>
                    <View style={styles.kpiValueRow}>
                      <Text style={styles.kpiNumber}>
                        {users.filter((u) => u.role === 'admin').length}
                      </Text>
                      <Text style={styles.kpiSub}>Orang</Text>
                    </View>
                  </View>
                  <View style={[styles.kpiBadge, { backgroundColor: colors.primarySoft }]}>
                    <Feather name="users" size={13} color={colors.primary} />
                  </View>
                </View>
              </View>
            </View>

            <View style={[styles.kpiCard, neoShadow.sm, isWide && styles.kpiCardWide]}>
              <View style={styles.kpiContent}>
                <View style={styles.kpiTopRow}>
                  <View>
                    <Text style={styles.kpiLabel}>Total Karyawan Grup</Text>
                    <View style={styles.kpiValueRow}>
                      <Text style={styles.kpiNumber}>{totalEmployees}</Text>
                      <Text style={styles.kpiSub}>Karyawan</Text>
                    </View>
                  </View>
                  <View style={[styles.kpiBadge, { backgroundColor: colors.primarySoft }]}>
                    <Feather name="user-check" size={13} color={colors.primary} />
                  </View>
                </View>
              </View>
            </View>

            <View style={[styles.kpiCard, neoShadow.sm, isWide && styles.kpiCardWide]}>
              <View style={styles.kpiContent}>
                <View style={styles.kpiTopRow}>
                  <View>
                    <Text style={styles.kpiLabel}>Rata-rata Kehadiran Hari Ini</Text>
                    <View style={styles.kpiValueRow}>
                      <Text style={styles.kpiNumber}>{presentPct}%</Text>
                      <Text style={styles.kpiSub}>Nasional</Text>
                    </View>
                  </View>
                  <View style={[styles.kpiBadge, { backgroundColor: colors.primarySoft }]}>
                    <Feather name="trending-up" size={13} color={colors.primary} />
                  </View>
                </View>
                <View style={styles.kpiTrack}>
                  <View style={[styles.kpiBar, { width: `${presentPct}%`, backgroundColor: colors.primary }]} />
                </View>
              </View>
            </View>
          </View>

          {/* Ringkasan Komparasi Tiap PT */}
          <Card
            title={`Ringkasan Operasional Tiap Cabang (${companiesList.length || 1})`}
            subtitle="Admin penanggung jawab dan rekap kehadiran hari ini per entitas PT"
            icon="server"
          >
            {companiesList.length === 0 ? (
              <Text style={styles.muted}>Belum ada data PT.</Text>
            ) : (
              companiesList.map((comp) => {
                const bStaff = users.filter((u) => (u.companyId ?? '') === comp.id && u.role === 'employee');
                const bAdmins = users.filter((u) => (u.companyId ?? '') === comp.id && u.role === 'admin');
                const bStaffIds = new Set(bStaff.map((s) => s.id));
                const bAtt = todayAttendances.filter((a) => bStaffIds.has(a.userId));
                const bPresent = bAtt.filter((a) => a.type === 'luring' || a.type === 'daring').length;
                const bIzin = bAtt.filter((a) => a.type === 'izin_sakit').length;
                const bTotal = bStaff.length;
                const bPct = bTotal > 0 ? Math.round((bPresent / bTotal) * 100) : 0;
                const adminNames = bAdmins.map((a) => a.fullName).join(', ') || 'Belum ada admin ditugaskan';

                return (
                  <View key={comp.id} style={[styles.branchCard, neoShadow.sm]}>
                    <View style={styles.branchHeaderRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.branchName}>{comp.name}</Text>
                        <Text style={styles.branchAdminText}>
                          Penanggung Jawab: <Text style={{ fontWeight: '700', color: colors.ink }}>{adminNames}</Text>
                        </Text>
                      </View>
                      <View style={[styles.kpiBadge, { backgroundColor: colors.primarySoft }]}>
                        <Text style={[styles.kpiBadgeText, { color: colors.primaryDark }]}>{bPct}% Hadir</Text>
                      </View>
                    </View>

                    <View style={styles.branchStatsRow}>
                      <View style={styles.branchStatItem}>
                        <Text style={styles.branchStatLabel}>Karyawan</Text>
                        <Text style={styles.branchStatVal}>{bTotal} orang</Text>
                      </View>
                      <View style={styles.branchStatItem}>
                        <Text style={styles.branchStatLabel}>Hadir</Text>
                        <Text style={[styles.branchStatVal, { color: colors.primaryDark }]}>{bPresent} orang</Text>
                      </View>
                      <View style={styles.branchStatItem}>
                        <Text style={styles.branchStatLabel}>Izin/Sakit</Text>
                        <Text style={[styles.branchStatVal, { color: colors.izin }]}>{bIzin} orang</Text>
                      </View>
                      <View style={styles.branchStatItem}>
                        <Text style={styles.branchStatLabel}>Belum Hadir</Text>
                        <Text style={[styles.branchStatVal, { color: colors.pulang }]}>{bTotal - bPresent - bIzin} orang</Text>
                      </View>
                    </View>

                    <View style={styles.kpiTrack}>
                      <View style={[styles.kpiBar, { width: `${bPct}%`, backgroundColor: colors.primary }]} />
                    </View>

                    <TouchableOpacity
                      style={styles.branchManageBtn}
                      activeOpacity={0.8}
                      onPress={() => {
                        select();
                        setActiveTab('companies');
                      }}
                    >
                      <Feather name="settings" size={13} color={colors.primaryDark} style={{ marginRight: 6 }} />
                      <Text style={styles.branchManageBtnText}>Kelola PT & Admin Cabang Ini</Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </Card>

          {/* Activity Audit Trail: Catatan Log Keaktifan Admin Cabang */}
          <Card
            title={`Activity Audit Trail (${auditLogs.length})`}
            subtitle="Pantau admin cabang yang rajin vs lambat memproses izin & login"
            icon="activity"
          >
            {auditLogs.length === 0 ? (
              <Text style={styles.muted}>Belum ada riwayat aktivitas tercatat.</Text>
            ) : (
              auditLogs.map((log) => {
                const isApproval = log.action === 'approve_leave';
                const isReject = log.action === 'reject_leave';
                const isReset = log.action === 'reset_device';
                const isLogin = log.action === 'login';

                const iconName: keyof typeof Feather.glyphMap = isApproval
                  ? 'check-circle'
                  : isReject
                  ? 'x-circle'
                  : isReset
                  ? 'smartphone'
                  : isLogin
                  ? 'log-in'
                  : 'activity';

                const badgeBg = isApproval
                  ? colors.successSoft
                  : isReject
                  ? colors.dangerSoft
                  : isReset
                  ? colors.pulangSoft
                  : colors.primarySoft;

                const badgeColor = isApproval
                  ? colors.successInk
                  : isReject
                  ? colors.danger
                  : isReset
                  ? colors.pulang
                  : colors.primaryDark;

                const timeStr = new Date(log.createdAt).toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                const dateStr = new Date(log.createdAt).toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'short',
                });

                return (
                  <View key={log.id} style={styles.auditRow}>
                    <View style={[styles.auditIconBox, { backgroundColor: badgeBg }]}>
                      <Feather name={iconName} size={15} color={badgeColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={styles.auditActor}>{log.userName}</Text>
                        <Text style={styles.auditTime}>{dateStr} • {timeStr} WIB</Text>
                      </View>
                      <Text style={styles.auditDesc}>{log.description || log.action}</Text>
                      <Text style={styles.auditCompany}>{log.companyName ? `PT: ${log.companyName}` : 'Holding'}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </Card>
        </>
      )}

      {/* 1B. KONTEN TAB MONITORING CABANG (ADMIN BIASA) */}
      {activeTab === 'monitoring' && !isSuper && (
        <>
          {/* Live Operational Status Banner */}
          <View style={[styles.statusBanner, neoShadow.md]}>
            <View style={styles.statusBannerTop}>
              <View style={styles.statusLiveWrap}>
                <View style={styles.statusLiveDot} />
                <Text style={styles.statusLiveText}>SISTEM AKTIF</Text>
              </View>
              <View style={styles.syncPill}>
                <Feather name="refresh-cw" size={11} color={colors.muted} style={{ marginRight: 5 }} />
                <Text style={styles.syncText}>Realtime Sync</Text>
              </View>
            </View>
            <Text style={styles.statusTitle}>Monitoring & Analitik Kehadiran</Text>
            <Text style={styles.statusDate}>
              {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </Text>
          </View>

          {/* 3 Real-time Attendance KPI Counters */}
          <View style={styles.kpiContainer}>
            {/* Card 1: Hadir Hari Ini */}
            <View style={[styles.kpiCard, neoShadow.sm, isWide && styles.kpiCardWide]}>
              <View style={styles.kpiContent}>
                <View style={styles.kpiTopRow}>
                  <View>
                    <Text style={styles.kpiLabel}>Hadir Hari Ini</Text>
                    <View style={styles.kpiValueRow}>
                      <Text style={styles.kpiNumber}>{presentCount}</Text>
                      <Text style={styles.kpiSub}>/ {totalEmployees} Karyawan</Text>
                    </View>
                  </View>
                  <View style={[styles.kpiBadge, { backgroundColor: colors.primarySoft }]}>
                    <Feather name="trending-up" size={13} color={colors.primary} style={{ marginRight: 4 }} />
                    <Text style={[styles.kpiBadgeText, { color: colors.primaryDark }]}>{presentPct}%</Text>
                  </View>
                </View>
                <View style={styles.kpiTrack}>
                  <View style={[styles.kpiBar, { width: `${presentPct}%`, backgroundColor: colors.primary }]} />
                </View>
              </View>
            </View>

            {/* Card 2: Izin / Sakit */}
            <View style={[styles.kpiCard, neoShadow.sm, isWide && styles.kpiCardWide]}>
              <View style={styles.kpiContent}>
                <View style={styles.kpiTopRow}>
                  <View>
                    <Text style={styles.kpiLabel}>Izin / Sakit</Text>
                    <View style={styles.kpiValueRow}>
                      <Text style={styles.kpiNumber}>{izinSakitCount}</Text>
                      <Text style={styles.kpiSub}>Karyawan</Text>
                    </View>
                  </View>
                  <View style={[styles.kpiBadge, { backgroundColor: colors.izinSoft }]}>
                    <Feather name="activity" size={13} color={colors.izin} style={{ marginRight: 4 }} />
                    <Text style={[styles.kpiBadgeText, { color: colors.izin }]}>{leavePct}%</Text>
                  </View>
                </View>
                <View style={styles.kpiTrack}>
                  <View style={[styles.kpiBar, { width: `${leavePct}%`, backgroundColor: colors.izin }]} />
                </View>
              </View>
            </View>

            {/* Card 3: Belum Hadir / Alpa */}
            <View style={[styles.kpiCard, neoShadow.sm, isWide && styles.kpiCardWide]}>
              <View style={styles.kpiContent}>
                <View style={styles.kpiTopRow}>
                  <View>
                    <Text style={styles.kpiLabel}>Belum Hadir / Alpa</Text>
                    <View style={styles.kpiValueRow}>
                      <Text style={styles.kpiNumber}>{unabsentCount}</Text>
                      <Text style={styles.kpiSub}>Karyawan</Text>
                    </View>
                  </View>
                  <View style={[styles.kpiBadge, { backgroundColor: colors.pulangSoft }]}>
                    <Feather name="clock" size={13} color={colors.pulang} style={{ marginRight: 4 }} />
                    <Text style={[styles.kpiBadgeText, { color: colors.pulang }]}>{unabsentPct}%</Text>
                  </View>
                </View>
                <View style={styles.kpiTrack}>
                  <View style={[styles.kpiBar, { width: `${unabsentPct}%`, backgroundColor: colors.pulang }]} />
                </View>
              </View>
            </View>
          </View>

          {/* Department Breakdown Section */}
          <AdminDepartmentReport users={users} />

          {/* Unabsent Employees Warning Banner */}
          <Card
            title={`Belum absen hari ini (${unabsentEmployees.length})`}
            subtitle="Karyawan yang belum absen: ketuk untuk lihat rekap"
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

      {/* 2. TAB LAPORAN (HANYA ADMIN CABANG) */}
      {activeTab === 'report' && !isSuper && <AdminDepartmentReport users={users} />}

      {/* 3. TAB TITIK & RADIUS GEOFENCE (HANYA ADMIN CABANG) */}
      {activeTab === 'geofence' && !isSuper && (
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
            if (res.success) await onRefreshOffices();
            return { success: res.success, message: res.message };
          }}
        />
      )}

      {/* 4. TAB KELOLA KARYAWAN (HANYA ADMIN CABANG) */}
      {activeTab === 'employees' && !isSuper && (
        <AdminEmployeeManager
          currentAdmin={currentAdmin}
          users={users}
          onChanged={onRefreshUsers}
          onSelectEmployee={(u) => setRecapEmployee(u)}
        />
      )}

      {/* 5. TAB PERSETUJUAN IZIN (HANYA ADMIN CABANG) */}
      {activeTab === 'approval' && !isSuper && (
        <AdminApprovalQueue
          requests={pendingApprovals}
          onSelect={(rec) => setSelectedRecord(rec)}
        />
      )}

      {/* 6. TAB PT & ADMIN CABANG (HANYA SUPERADMIN) */}
      {activeTab === 'companies' && isSuper && (
        <AdminCompanyManager
          currentAdmin={currentAdmin}
          users={users}
          onChanged={onRefreshUsers}
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
              <Image
                source={require('../../../assets/skmi-logo3.png')}
                style={styles.brandIcon}
                resizeMode="contain"
              />
              <View>
                <Text style={styles.brandTitle}>E-Presensi</Text>
                <Text style={styles.brandSub}>Panel Admin</Text>
              </View>
            </View>

            {visibleTabs.map((tab) => {
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
            {visibleTabs.map((tab) => {
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
    borderRightWidth: 2,
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
    width: 36,
    height: 36,
    marginRight: 10,
  },
  brandTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.ink,
  },
  brandSub: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '700',
  },
  sideNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    marginBottom: 4,
  },
  sideNavActive: {
    backgroundColor: colors.primarySoft,
  },
  sideNavText: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.muted,
  },
  sideNavTextActive: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  countBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: radius.sm,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
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
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    borderWidth: 1.5,
    borderColor: colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  adminAvatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
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
  statusBanner: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 14,
  },
  statusBannerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusLiveWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.primary,
    marginRight: 6,
  },
  statusLiveText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: colors.primary,
  },
  syncPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  syncText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted,
  },
  statusTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.ink,
  },
  statusDate: {
    fontSize: fontSize.xs,
    color: colors.muted,
    marginTop: 2,
  },
  kpiContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  kpiCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  kpiCardWide: {
    width: '31.8%',
  },
  kpiContent: {
    padding: 14,
  },
  kpiTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  kpiLabel: {
    fontSize: fontSize.xs,
    color: colors.muted,
    fontWeight: '600',
  },
  kpiValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 4,
    gap: 6,
  },
  kpiNumber: {
    fontSize: fontSize.xl,
    fontWeight: '800',
    color: colors.ink,
  },
  kpiSub: {
    fontSize: fontSize.xs,
    color: colors.muted,
    fontWeight: '500',
  },
  kpiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  kpiBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  kpiTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceSoft,
    overflow: 'hidden',
  },
  kpiBar: {
    height: '100%',
    borderRadius: 3,
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
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: '#DC2626',
    borderWidth: 1,
    borderColor: '#B91C1C',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 40,
  },
  branchCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 12,
  },
  branchHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  branchName: {
    fontSize: fontSize.md,
    fontWeight: '800',
    color: colors.ink,
  },
  branchAdminText: {
    fontSize: fontSize.xs,
    color: colors.muted,
    marginTop: 2,
  },
  branchStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceSoft,
    padding: 12,
    borderRadius: radius.md,
    marginBottom: 12,
  },
  branchStatItem: {
    alignItems: 'center',
  },
  branchStatLabel: {
    fontSize: 10,
    color: colors.muted,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  branchStatVal: {
    fontSize: fontSize.sm,
    fontWeight: '800',
    color: colors.ink,
    marginTop: 2,
  },
  branchManageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginTop: 10,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  branchManageBtnText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  muted: {
    fontSize: fontSize.xs,
    color: colors.muted,
  },
  auditRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  auditIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  auditActor: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.ink,
  },
  auditTime: {
    fontSize: 10,
    color: colors.muted,
  },
  auditDesc: {
    fontSize: fontSize.xs,
    color: colors.ink,
    marginTop: 2,
    lineHeight: 18,
  },
  auditCompany: {
    fontSize: 10,
    color: colors.primaryDark,
    fontWeight: '600',
    marginTop: 2,
  },
});
