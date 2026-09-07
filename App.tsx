import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import {
  AttendanceRecord,
  AttendanceType,
  OfficeSettings,
  SessionType,
  UserProfile,
} from './src/types/attendance';
import { AttendanceService } from './src/services/attendanceService';
import { supabase } from './src/lib/supabase';
import { Header } from './src/components/ui/Header';
import { colors } from './src/theme';
import { LoginScreen } from './src/components/auth/LoginScreen';
import { AdminDashboard } from './src/components/admin/AdminDashboard';
import { AttendanceHub } from './src/components/user/AttendanceHub';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [officeSettings, setOfficeSettings] = useState<OfficeSettings | null>(null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [todayAttendances, setTodayAttendances] = useState<AttendanceRecord[]>([]);
  const [userHistory, setUserHistory] = useState<AttendanceRecord[]>([]);
  const [userTodayStatus, setUserTodayStatus] = useState<AttendanceRecord | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize Supabase Auth Session Listener
  useEffect(() => {
    checkCurrentSession();

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
    const settings = await AttendanceService.getOfficeSettings();
    setOfficeSettings(settings);

    if (currentUser) {
      const history = await AttendanceService.getUserAttendances(currentUser.id);
      const today = await AttendanceService.getUserTodayStatus(currentUser.id);
      setUserHistory(history);
      setUserTodayStatus(today);

      if (currentUser.role === 'admin') {
        const users = await AttendanceService.getAllUsers();
        const attendances = await AttendanceService.getTodayAttendances();
        setAllUsers(users);
        setTodayAttendances(attendances);
      }
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    await AttendanceService.signOut();
    setCurrentUser(null);
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <Header user={currentUser} />

      {/* Main View */}
      <View style={styles.content}>
        {currentUser.role === 'admin' ? (
          <AdminDashboard
            currentAdmin={currentUser}
            users={allUsers}
            todayAttendances={todayAttendances}
            officeSettings={officeSettings || {
              id: '1',
              officeName: 'Kantor Utama',
              latitude: -6.2088,
              longitude: 106.8456,
              radiusMeters: 150,
              updatedAt: new Date().toISOString(),
            }}
            onUpdateOfficeSettings={handleUpdateOfficeSettings}
            onRefreshUsers={loadDataForRole}
            onLogout={handleLogout}
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
              updatedAt: new Date().toISOString(),
            }}
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
