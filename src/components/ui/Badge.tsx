import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, radius } from '../../theme';

interface BadgeProps {
  type: 'luring' | 'daring' | 'izin_sakit' | 'hadir' | 'izin' | 'sakit' | 'belum_absen';
  label?: string;
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({ type, label, size = 'md' }) => {
  const config = (() => {
    switch (type) {
      case 'luring':
        return { bg: colors.masukSoft, text: colors.masuk, label: 'Kantor' };
      case 'hadir':
        return { bg: colors.masukSoft, text: colors.masuk, label: 'Hadir' };
      case 'daring':
        return { bg: colors.surfaceSoft, text: colors.muted, label: 'Dari rumah' };
      case 'izin_sakit':
        return { bg: colors.izinSoft, text: colors.izin, label: 'Izin / Sakit' };
      case 'izin':
        return { bg: colors.izinSoft, text: colors.izin, label: 'Izin' };
      case 'sakit':
        return { bg: colors.izinSoft, text: colors.izin, label: 'Sakit' };
      default:
        return { bg: colors.surfaceSoft, text: colors.muted, label: 'Belum absen' };
    }
  })();
  const isSm = size === 'sm';
  return (
    <View style={[styles.badge, { backgroundColor: config.bg }, isSm ? styles.sm : styles.md]}>
      <Text style={[styles.text, { color: config.text }, isSm && styles.textSm]}>
        {label || config.label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: { borderRadius: radius.sm, alignSelf: 'flex-start' },
  md: { paddingHorizontal: 12, paddingVertical: 7 },
  sm: { paddingHorizontal: 10, paddingVertical: 5 },
  text: { fontWeight: '700', fontSize: fontSize.sm },
  textSm: { fontSize: fontSize.xs },
});
