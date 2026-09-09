import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
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
        <View style={styles.logo}>
          <Feather name="check-square" size={20} color="#FFFFFF" />
        </View>
        <View>
          <Text style={styles.appName}>E-Presensi</Text>
          <Text style={styles.role}>
            {user.role === 'admin' ? 'Admin' : user.department || 'Karyawan'}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPressProfile}
        disabled={!onPressProfile}
        style={styles.userBtn}
        hitSlop={8}
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
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  appName: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.ink,
  },
  role: {
    fontSize: fontSize.xs,
    color: colors.muted,
    marginTop: 2,
  },
  userBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  avatarText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.primary,
  },
});
