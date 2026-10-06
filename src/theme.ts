// E-Presensi Design System — Modern Shadcn Clean (Slick, Flat, Refined)
// Zero 3D slop, zero harsh dark borders. Pure crisp surfaces, subtle hairline borders, and elegant micro-tokens.

import { Platform } from 'react-native';

export const colors = {
  // Neutral Canvas & Surfaces (Shadcn Slate)
  background: '#F8FAFC', // Slate-50: Bersih, sejuk, tenang
  surface: '#FFFFFF', // Solid pure white
  surfaceSoft: '#F1F5F9', // Slate-100: Kontras lembut
  surfaceMuted: '#E2E8F0', // Slate-200: Garis pemisah halus

  // Typography & Inks
  ink: '#0F172A', // Slate-900: Teks tajam natural berbobot
  muted: '#64748B', // Slate-500: Label & teks sekunder
  faint: '#94A3B8', // Slate-400: Placeholder / batas pasif

  // Structural Hairline Borders (Crisp & Subtle)
  border: '#E2E8F0', // Slate-200: Garis batas standar shadcn
  borderMuted: '#F1F5F9', // Slate-100: Garis pemisah internal
  borderStrong: '#CBD5E1', // Slate-300: Garis tombol / input aktif
  borderDark: '#0284C7',

  // Sesi Absensi & Aksen Utama (Pertahankan warna identitas)
  primary: '#0284C7', // Sky-600: Biru segar profesional
  primaryDark: '#0369A1', // Sky-700
  primarySoft: '#E0F2FE', // Sky-100
  primaryBorder: '#BAE6FD', // Sky-200

  secondary: '#EA580C', // Orange-600: Aksen oranye tegas
  secondaryDark: '#C2410C', // Orange-700
  secondarySoft: '#FFEDD5', // Orange-100
  secondaryBorder: '#FED7AA', // Orange-200

  // Semantik Sesi Absensi
  masuk: '#0284C7', // Sky-600
  masukSoft: '#E0F2FE', // Sky-100
  masukBorder: '#BAE6FD', // Sky-200

  pulang: '#EA580C', // Orange-600
  pulangSoft: '#FFEDD5', // Orange-100
  pulangBorder: '#FED7AA', // Orange-200

  izin: '#DC2626', // Red-600
  izinSoft: '#FEE2E2', // Red-100
  izinBorder: '#FECACA', // Red-200

  // Status Alerts
  danger: '#DC2626',
  dangerSoft: '#FEE2E2',
  dangerInk: '#991B1B',
  success: '#16A34A',
  successSoft: '#DCFCE7',
  successInk: '#15803D',
  warning: '#D97706',
  warningSoft: '#FEF3C7',
  warningInk: '#B45309',
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 26,
  display: 32,
} as const;

export const spacing = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  xxl: 28,
} as const;

// Shadcn standard corner radii: wajar, proporsional, lembut
export const radius = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

export const touch = {
  buttonMinHeight: 48,
  inputMinHeight: 48,
} as const;

// Clean modern ambient micro-shadows (Tanpa efek 3D block)
export const neoShadow = {
  sm: Platform.select({
    ios: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 3,
    },
    android: { elevation: 1 },
    web: { boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)' },
    default: {},
  }),
  md: Platform.select({
    ios: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
    },
    android: { elevation: 2 },
    web: { boxShadow: '0 2px 8px rgba(15, 23, 42, 0.05)' },
    default: {},
  }),
  lg: Platform.select({
    ios: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
    },
    android: { elevation: 4 },
    web: { boxShadow: '0 4px 16px rgba(15, 23, 42, 0.08)' },
    default: {},
  }),
  none: Platform.select({
    ios: {
      shadowColor: 'transparent',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
    },
    android: { elevation: 0 },
    web: { boxShadow: 'none' },
    default: {},
  }),
} as const;

export const session = {
  masuk: { main: colors.masuk, soft: colors.masukSoft, border: colors.masukBorder },
  pulang: { main: colors.pulang, soft: colors.pulangSoft, border: colors.pulangBorder },
  izin: { main: colors.izin, soft: colors.izinSoft, border: colors.izinBorder },
} as const;
