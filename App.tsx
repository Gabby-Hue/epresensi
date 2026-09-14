import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StatusBar,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
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
import { supabase } from './src/lib/supabase';
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
  // Di dashboard web admin sudah ada sidebar + topbar sendiri — header aplikasi disembunyikan
  const hideHeaderForWideAdmin =
    !!currentUser && currentUser.role === 'admin' && Platform.OS === 'web' && width >= 768;

  // Initialize Supabase Auth Session Listener
  useEffect(() => {
    checkCurrentSession();
    void initFeedback();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const profile = await AttendanceService.getCurrentProfile(session.user.id);
        setCurrentUser(profile);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Reload data whenever currentUser changes
  useEffect(() => {
    if (currentUser) {
      loadDataForRole();
    }
  }, [currentUser]);

  const checkCurrentSession = async () => {
    setLoading(true);
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) {
      const profile = await AttendanceService.getCurrentProfile(data.session.user.id);
      setCurrentUser(profile);
    }
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

      if (currentUser.role === 'admin') {
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
          {currentUser.role === 'admin' ? (
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
                color: '#2196F3',
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
                color: '#2196F3',
                updatedAt: new Date().toISOString(),
              }}
              officeList={officeList}
              userTodayStatus={userTodayStatus}
              userHistory={userHistory}
              onClockIn={handleUserClockIn}
              onLogout={handleLogout}
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
