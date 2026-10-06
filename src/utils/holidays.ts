/**
 * Preset Daftar Hari Libur Nasional Resmi Indonesia (SKB 3 Menteri).
 * Format key: YYYY-MM-DD
 */
export const INDONESIAN_HOLIDAYS: Record<string, string> = {
  // 2025
  '2025-01-01': 'Tahun Baru 2025 Masehi',
  '2025-01-27': "Isra Mi'raj Nabi Muhammad SAW",
  '2025-01-29': 'Tahun Baru Imlek 2576 Kongzili',
  '2025-03-29': 'Hari Suci Nyepi (Saka 1947)',
  '2025-03-31': 'Hari Raya Idul Fitri 1446 H',
  '2025-04-01': 'Hari Raya Idul Fitri 1446 H (Hari Ke-2)',
  '2025-04-18': 'Wafat Yesus Kristus (Jumat Agung)',
  '2025-04-20': 'Kebangkitan Yesus Kristus (Paskah)',
  '2025-05-01': 'Hari Buruh Internasional',
  '2025-05-12': 'Hari Raya Waisak 2569 BE',
  '2025-05-29': 'Kenaikan Yesus Kristus',
  '2025-06-01': 'Hari Lahir Pancasila',
  '2025-06-07': 'Hari Raya Idul Adha 1446 H',
  '2025-06-27': 'Tahun Baru Islam 1447 H',
  '2025-08-17': 'Hari Proklamasi Kemerdekaan RI',
  '2025-09-05': 'Maulid Nabi Muhammad SAW',
  '2025-12-25': 'Hari Raya Natal',

  // 2026 (Tahun Berjalan)
  '2026-01-01': 'Tahun Baru 2026 Masehi',
  '2026-01-16': "Isra Mi'raj Nabi Muhammad SAW",
  '2026-02-17': 'Tahun Baru Imlek 2577 Kongzili',
  '2026-03-19': 'Hari Suci Nyepi (Saka 1948)',
  '2026-03-20': 'Hari Raya Idul Fitri 1447 H',
  '2026-03-21': 'Hari Raya Idul Fitri 1447 H (Hari Ke-2)',
  '2026-04-03': 'Wafat Yesus Kristus (Jumat Agung)',
  '2026-04-05': 'Kebangkitan Yesus Kristus (Paskah)',
  '2026-05-01': 'Hari Buruh Internasional',
  '2026-05-14': 'Kenaikan Yesus Kristus',
  '2026-05-27': 'Hari Raya Idul Adha 1447 H',
  '2026-05-31': 'Hari Raya Waisak 2570 BE',
  '2026-06-01': 'Hari Lahir Pancasila',
  '2026-06-16': 'Tahun Baru Islam 1448 H',
  '2026-08-17': 'Hari Proklamasi Kemerdekaan RI Ke-81',
  '2026-08-25': 'Maulid Nabi Muhammad SAW',
  '2026-12-25': 'Hari Raya Natal',

  // 2027
  '2027-01-01': 'Tahun Baru 2027 Masehi',
  '2027-01-06': "Isra Mi'raj Nabi Muhammad SAW",
  '2027-02-06': 'Tahun Baru Imlek 2578 Kongzili',
  '2027-03-09': 'Hari Raya Idul Fitri 1448 H',
  '2027-03-10': 'Hari Raya Idul Fitri 1448 H (Hari Ke-2)',
  '2027-03-26': 'Wafat Yesus Kristus (Jumat Agung)',
  '2027-03-28': 'Hari Paskah',
  '2027-05-01': 'Hari Buruh Internasional',
  '2027-05-06': 'Kenaikan Yesus Kristus',
  '2027-05-18': 'Hari Raya Idul Adha 1448 H',
  '2027-05-20': 'Hari Raya Waisak 2571 BE',
  '2027-06-01': 'Hari Lahir Pancasila',
  '2027-06-06': 'Tahun Baru Islam 1449 H',
  '2027-08-17': 'Hari Proklamasi Kemerdekaan RI Ke-82',
  '2027-08-14': 'Maulid Nabi Muhammad SAW',
  '2027-12-25': 'Hari Raya Natal',
};

/** Mendapatkan nama hari libur nasional jika tanggal tsb adalah hari libur */
export function getHolidayName(dateStr: string): string | null {
  return INDONESIAN_HOLIDAYS[dateStr] || null;
}

/** Cek apakah tanggal YYYY-MM-DD merupakan hari libur nasional */
export function isNationalHoliday(dateStr: string): boolean {
  return Boolean(INDONESIAN_HOLIDAYS[dateStr]);
}
