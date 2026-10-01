// E-Presensi UI · Modern Shadcn Badge
// Clean semantic pill badge with soft pastel tones, clear typography, and subtle border.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, radius } from '../../theme';

interface BadgeProps {
  type: 'luring' | 'daring' | 'izin_sakit' | 'hadir' | 'izin' | 'sakit' | 'belum_absen' | 'menunggu' | 'ditolak';
  label?: string;
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({ type, label, size = 'md' }) => {
  const config = (() => {
    switch (type) {
      case 'luring':
      case 'hadir':
        return { bg: colors.masukSoft, text: colors.primaryDark, border: colors.masukBorder, label: 'Kantor' };
      case 'daring':
        return { bg: colors.surfaceSoft, text: colors.ink, border: colors.border, label: 'Dari Rumah' };
      case 'izin_sakit':
      case 'izin':
      case 'sakit':
        return { bg: colors.izinSoft, text: colors.dangerInk, border: colors.izinBorder, label: type === 'sakit' ? 'Sakit' : 'Izin' };
      case 'menunggu':
        return { bg: colors.warningSoft, text: colors.warningInk, border: colors.secondaryBorder, label: 'Menunggu' };
      case 'ditolak':
        return { bg: colors.surfaceSoft, text: colors.muted, border: colors.border, label: 'Ditolak' };
      default:
        return { bg: colors.surfaceSoft, text: colors.muted, border: colors.border, label: 'Belum Absen' };
    }
  })();

  const isSm = size === 'sm';
  return (
    <View style={[styles.badge, { backgroundColor: config.bg, borderColor: config.border }, isSm ? styles.sm : styles.md]}>
      <Text style={[styles.text, { color: config.text }, isSm && styles.textSm]}>
        {label || config.label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: radius.sm,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  md: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
  },
  sm: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
  },
  text: {
    fontWeight: '600',
    fontSize: fontSize.xs,
    letterSpacing: -0.1,
  },
  textSm: {
    fontSize: 11,
  },
});
