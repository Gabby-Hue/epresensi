import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { UserProfile } from '../../types/attendance';
import { colors, fontSize, radius, spacing } from '../../theme';

interface HeaderProps {
  user: UserProfile;
}

export const Header: React.FC<HeaderProps> = ({ user }) => {
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

      <View style={styles.user}>
        {user.avatarUrl ? (
          <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        )}
        <Text style={styles.userName} numberOfLines={1}>
          {user.fullName.split(' ')[0]}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
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
  user: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: 160,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 8,
  },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  avatarText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.primary,
  },
  userName: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.ink,
    maxWidth: 105,
  },
});
