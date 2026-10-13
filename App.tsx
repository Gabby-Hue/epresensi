import './src/utils/alertPolyfill';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StatusBar,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';

// Reset border/outline hitam bawaan browser saat input teks aktif di Web
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const existing = document.getElementById('epresensi-global-input-style');
  if (!existing) {
    const style = document.createElement('style');
    style.id = 'epresensi-global-input-style';
    style.textContent = `
      input, textarea, select {
        outline: none !important;
        outline-width: 0 !important;
        box-shadow: none !important;
      }
      input:focus, textarea:focus, select:focus {
        outline: none !important;
        outline-width: 0 !important;
        box-shadow: none !important;
      }
    `;
    document.head.appendChild(style);
  }
}
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  AttendanceRecord,
  AttendanceType,
  OfficeSettings,
  SessionType,
  UserProfile,
} from './src/types/attendance';
import { AttendanceService } from './src/services/attendanceService';
import { initFeedback } from './src/services/feedbackService';
import { getToken } from './src/lib/api';
import { Header } from './src/components/ui/Header';
import { colors } from './src/theme';
import { LoginScreen } from './src/components/auth/LoginScreen';
import { AdminDashboard } from './src/components/admin/AdminDashboard';
import { AttendanceHub } from './src/components/user/AttendanceHub';
import { ProfileScreen } from './src/components/user/ProfileScreen';

function AppContent() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [officeSettings, setOfficeSettings] = useState<OfficeSettings | null>(null);
  const [officeList, setOfficeList] = useState<OfficeSettings[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [todayAttendances, setTodayAttendances] = useState<AttendanceRecord[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<AttendanceRecord[]>([]);
  const [userHistory, setUserHistory] = useState<AttendanceRecord[]>([]);
  const [userTodayStatus, setUserTodayStatus] = useState<AttendanceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [showProfilePage, setShowProfilePage] = useState(false);
  const { width } = useWindowDimensions();
  const isAdminRole = (r?: string) => r === 'admin' || r === 'superadmin';
  // Di dashboard web admin sudah ada sidebar + topbar sendiri — header aplikasi disembunyikan
  const hideHeaderForWideAdmin =
    !!currentUser && isAdminRole(currentUser.role) && Platform.OS === 'web' && width >= 768;

  // Restore sesi login tersimpan (token JWT) saat aplikasi dibuka
  useEffect(() => {
    checkCurrentSession();
    void initFeedback();
  }, []);

  // Reload data whenever currentUser changes
  useEffect(() => {
    if (currentUser) {
      loadDataForRole();
    }
  }, [currentUser]);

  const checkCurrentSession = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      if (token) {
        const profile = await AttendanceService.getCurrentProfile();
        setCurrentUser(profile);
      }
    } catch {}
    setLoading(false);
  };

  const handleLoginSuccess = async (user?: UserProfile) => {
    if (user) {
      setCurrentUser(user);
    } else {
      await checkCurrentSession();
    }
  };

  const loadDataForRole = async () => {
    const offices = await AttendanceService.getOfficeList();
    setOfficeList(offices);
    const settings = offices.length > 0 ? offices[0] : await AttendanceService.getOfficeSettings();
    setOfficeSettings(settings);

    if (currentUser) {
      const history = await AttendanceService.getUserAttendances(currentUser.id);
      const today = await AttendanceService.getUserTodayStatus(currentUser.id);
      setUserHistory(history);
      setUserTodayStatus(today);

      if (isAdminRole(currentUser.role)) {
        const users = await AttendanceService.getAllUsers();
        const attendances = await AttendanceService.getTodayAttendances();
        const pending = await AttendanceService.getPendingApprovals();
        setAllUsers(users);
        setTodayAttendances(attendances);
        setPendingApprovals(pending);
      }
    }
  };

  const handleRefreshOffices = async () => {
    const offices = await AttendanceService.getOfficeList();
    setOfficeList(offices);
    if (offices.length > 0) setOfficeSettings({ ...offices[0] });
  };

  useEffect(() => {
    if (!currentUser || !isAdminRole(currentUser.role)) return;
    const refreshAdminData = async () => {
      const offices = await AttendanceService.getOfficeList();
      setOfficeList(offices);
      if (offices.length > 0) setOfficeSettings({ ...offices[0] });
      setAllUsers(await AttendanceService.getAllUsers());
    };
    const timer = setInterval(refreshAdminData, 10000);
    return () => clearInterval(timer);
  }, [currentUser?.id, currentUser?.role]);

  const handleLogout = async () => {
    setLoading(true);
    await AttendanceService.signOut();
    setCurrentUser(null);
    setShowProfilePage(false);
    setLoading(false);
  };

  const handleUpdateOfficeSettings = async (newSettings: Partial<OfficeSettings>) => {
    await AttendanceService.updateOfficeSettings(newSettings);
    const fresh = await AttendanceService.getOfficeSettings();
    setOfficeSettings({ ...fresh });
  };

  const handleUserClockIn = async (data: {
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
  }) => {
    if (!currentUser) return;

    await AttendanceService.submitAttendance({
      user: currentUser,
      ...data,
    });

    await loadDataForRole();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1C1917" />
      </View>
    );
  }

  // If not logged in, render real LoginScreen
  if (!currentUser) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  // If viewing User Profile screen (contoh.jpeg)
  if (showProfilePage) {
    return (
      <ProfileScreen
        user={currentUser}
        onBack={() => setShowProfilePage(false)}
        onUpdateUser={(updated) => setCurrentUser(updated)}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

        {/* Header (disembunyikan di dashboard web admin) */}
        {!hideHeaderForWideAdmin && (
          <Header
            user={currentUser}
            onPressProfile={() => setShowProfilePage(true)}
          />
        )}

        {/* Main View */}
        <View style={styles.content}>
          {isAdminRole(currentUser.role) ? (
            <AdminDashboard
              currentAdmin={currentUser}
              users={allUsers}
              todayAttendances={todayAttendances}
              pendingApprovals={pendingApprovals}
              officeSettings={officeSettings || {
                id: '1',
                officeName: 'Kantor Utama',
                latitude: -6.2088,
                longitude: 106.8456,
                radiusMeters: 150,
                color: colors.primary,
                updatedAt: new Date().toISOString(),
              }}
              officeList={officeList}
              onUpdateOfficeSettings={handleUpdateOfficeSettings}
              onRefreshOffices={handleRefreshOffices}
              onRefreshUsers={loadDataForRole}
              onLogout={handleLogout}
              onPressProfile={() => setShowProfilePage(true)}
            />
          ) : (
            <AttendanceHub
              user={currentUser}
              officeSettings={officeSettings || {
                id: '1',
                officeName: 'Kantor Utama',
                latitude: -6.2088,
                longitude: 106.8456,
                radiusMeters: 150,
                color: colors.primary,
                updatedAt: new Date().toISOString(),
              }}
              officeList={officeList}
              userTodayStatus={userTodayStatus}
              userHistory={userHistory}
              onClockIn={handleUserClockIn}
              onLogout={handleLogout}
              onUpdateUser={(updated) => setCurrentUser(updated)}
            />
          )}
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
