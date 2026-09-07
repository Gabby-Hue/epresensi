import React, { useEffect, useState } from 'react';
import {
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { UserProfile } from '../../types/attendance';
import { getDeviceInfo } from '../../services/deviceService';
import { colors, fontSize, radius, spacing } from '../../theme';

interface ProfileScreenProps {
  user: UserProfile;
  onBack: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ user, onBack }) => {
  const [deviceModel, setDeviceModel] = useState<string>(user.deviceModel || 'Memuat...');
  const [deviceId, setDeviceId] = useState<string>(user.deviceId || 'Memuat...');

  useEffect(() => {
    let isMounted = true;
    getDeviceInfo().then((info) => {
      if (isMounted) {
        setDeviceModel(user.deviceModel || info.modelName);
        setDeviceId(user.deviceId || info.deviceId);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [user]);

  const phoneNumberOrId = user.phoneNumber || '0084973597';
  const departmentName = user.department || 'Rekayasa Perangkat Lunak';

  const initials = user.fullName
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Navbar Header — Mengikuti style Header dashboard */}
      <View style={styles.topNav}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onBack}
          style={styles.backBtn}
          hitSlop={12}
        >
          <Feather name="arrow-left" size={22} color={colors.ink} />
        </TouchableOpacity>
        <View style={styles.navTitleWrap}>
          <Text style={styles.navTitle}>Profil Pengguna</Text>
          <Text style={styles.navSubtitle}>Informasi Akun & Perangkat</Text>
        </View>
        <View style={{ width: 42 }} />
      </View>

      <View style={styles.contentWrapper}>
        {/* Decorative subtle accent curves — Menyesuaikan warna dashboard (primary soft & border) */}
        <View style={styles.accentCircleTop} />
        <View style={styles.accentCircleBottom} />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContainer}
        >
          {/* Avatar Section */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarOuterCircle}>
              {user.avatarUrl ? (
                <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
              )}
            </View>
            <Text style={styles.avatarName}>{user.fullName}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>
                {user.role === 'admin' ? 'Admin' : 'Karyawan'}
              </Text>
            </View>
          </View>

          {/* Pill Card 1: ID / Nomor Handphone */}
          <View style={styles.pillCard}>
            <View style={styles.iconWrap}>
              <Feather name="phone" size={20} color={colors.primary} />
            </View>
            <View style={styles.pillTextWrap}>
              <Text style={styles.pillLabel}>Nomor Identitas / HP</Text>
              <Text style={styles.pillValue}>{phoneNumberOrId}</Text>
            </View>
          </View>

          {/* Pill Card 2: Nama Lengkap */}
          <View style={styles.pillCard}>
            <View style={styles.iconWrap}>
              <Feather name="user" size={20} color={colors.primary} />
            </View>
            <View style={styles.pillTextWrap}>
              <Text style={styles.pillLabel}>Nama Lengkap</Text>
              <Text style={styles.pillValue}>{user.fullName}</Text>
            </View>
          </View>

          {/* Pill Card 3: Departemen / Unit Kerja */}
          <View style={styles.pillCard}>
            <View style={styles.iconWrap}>
              <Feather name="briefcase" size={20} color={colors.primary} />
            </View>
            <View style={styles.pillTextWrap}>
              <Text style={styles.pillLabel}>Departemen / Unit</Text>
              <Text style={styles.pillValue}>{departmentName}</Text>
            </View>
          </View>

          {/* Pill Card 4: Device ID (Kode Perangkat) */}
          <View style={styles.pillCard}>
            <View style={styles.iconWrap}>
              <Feather name="cpu" size={20} color={colors.primary} />
            </View>
            <View style={styles.pillTextWrap}>
              <Text style={styles.pillLabel}>Kode Perangkat (Device ID)</Text>
              <Text style={styles.pillValue}>{deviceId}</Text>
            </View>
          </View>

          {/* Pill Card 5: Merk & Tipe Handphone */}
          <View style={styles.pillCard}>
            <View style={styles.iconWrap}>
              <Feather name="smartphone" size={20} color={colors.primary} />
            </View>
            <View style={styles.pillTextWrap}>
              <Text style={styles.pillLabel}>Model Perangkat</Text>
              <Text style={styles.pillValue}>{deviceModel}</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitleWrap: {
    alignItems: 'center',
  },
  navTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.ink,
  },
  navSubtitle: {
    fontSize: fontSize.xs,
    color: colors.muted,
    marginTop: 2,
  },
  contentWrapper: {
    flex: 1,
    position: 'relative',
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  accentCircleTop: {
    position: 'absolute',
    top: -50,
    left: -70,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: colors.primarySoft,
    opacity: 0.65,
  },
  accentCircleBottom: {
    position: 'absolute',
    bottom: -60,
    left: -80,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: colors.surfaceSoft,
    opacity: 0.75,
  },
  scrollContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: 40,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  avatarSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  avatarOuterCircle: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: colors.surface,
    borderWidth: 3,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 12,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  avatarText: {
    fontSize: 40,
    fontWeight: '800',
    color: colors.primary,
  },
  avatarName: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.ink,
  },
  roleBadge: {
    marginTop: 6,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  roleBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  pillCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  pillTextWrap: {
    flex: 1,
  },
  pillLabel: {
    fontSize: fontSize.xs,
    color: colors.muted,
    fontWeight: '600',
    marginBottom: 2,
  },
  pillValue: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.ink,
  },
});
