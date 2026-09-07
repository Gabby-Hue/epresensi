// Design tokens — netral sejuk + biru langit instansi + warna semantik sesi.
// Aturan: netral untuk layout, biru langit (#0284C7) untuk brand dan tombol
// utama, warna sesi hanya untuk makna (datang = biru langit, pulang =
// oranye, izin = merah). Satu keluarga abu sejuk, tidak campur hangat-dingin.

export const colors = {
  background: '#F2F6FA',
  surface: '#FFFFFF',
  surfaceSoft: '#E9F2F9',
  ink: '#0C1B2A',
  muted: '#526277',
  faint: '#8AA0B4',
  border: '#E1E9F1',
  borderStrong: '#C3D4E3',
  primary: '#0284C7',
  primaryDark: '#0369A1',
  primarySoft: '#E0F2FE',
  // Semantik sesi — satu-satunya warna bermakna selain brand
  masuk: '#0284C7',
  masukSoft: '#E0F2FE',
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
