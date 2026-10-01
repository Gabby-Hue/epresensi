// E-Presensi UI · Modern Header
// SKMI logo, crisp typography, clean avatar widget.

import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { UserProfile } from '../../types/attendance';
import { colors, fontSize, radius, spacing } from '../../theme';

interface HeaderProps {
  user: UserProfile;
  onPressProfile?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ user, onPressProfile }) => {
  const initials = user.fullName
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <Image
          source={require('../../../assets/skmi-logo3.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <View>
          <Text style={styles.appName}>E-Presensi</Text>
          <Text style={styles.role}>
            {user.role === 'admin' ? 'Admin Sistem' : user.department || 'Karyawan'}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPressProfile}
        disabled={!onPressProfile}
        style={styles.userBtn}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Buka Profil Pengguna"
      >
        {user.avatarUrl ? (
          <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 40,
    height: 40,
    marginRight: spacing.sm,
  },
  appName: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.2,
  },
  role: {
    fontSize: 11,
    color: colors.primary,
    marginTop: 1,
    fontWeight: '600',
  },
  userBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.primaryBorder,
  },
  avatarFallback: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
});
