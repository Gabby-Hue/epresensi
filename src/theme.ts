// Design tokens — putih-biru mengikuti referensi (1.jpeg / 2.jpeg).
// Background putih kebiruan, kartu putih, brand biru (#2196F3).
// Masuk = biru terang, pulang = oranye, izin/sakit = merah semantik.

export const colors = {
  background: '#F4F7FD',
  surface: '#FFFFFF',
  surfaceSoft: '#EAF2FB',
  ink: '#0C1B2A',
  muted: '#526277',
  faint: '#8AA0B4',
  border: '#DFE9F4',
  borderStrong: '#C3D4E3',
  primary: '#2196F3',
  primaryDark: '#1976D2',
  primarySoft: '#E3F2FD',
  // Semantik sesi — masuk biru, pulang oranye, izin merah
  masuk: '#2196F3',
  masukSoft: '#E3F2FD',
  pulang: '#EA580C',
  pulangSoft: '#FFEDD5',
  izin: '#DC2626',
  izinSoft: '#FEE2E2',
  danger: '#B3261E',
  dangerSoft: '#FDECEA',
  successSoft: '#E7F4EC',
  successInk: '#2F6B3C',
} as const;

export const fontSize = { xs: 14, sm: 16, md: 18, lg: 21, xl: 25, xxl: 32 } as const;
export const spacing = { xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32 } as const;
export const radius = { sm: 6, md: 10, lg: 12 } as const;
export const touch = { buttonMinHeight: 56, inputMinHeight: 56 } as const;

// Warna per sesi absen: datang = biru langit, pulang = oranye, izin = merah.
export const session = {
  masuk: { main: colors.masuk, soft: colors.masukSoft },
  pulang: { main: colors.pulang, soft: colors.pulangSoft },
  izin: { main: colors.izin, soft: colors.izinSoft },
} as const;
