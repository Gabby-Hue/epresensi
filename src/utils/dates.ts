/** True kalau string YYYY-MM-DD jatuh pada Sabtu/Minggu. Tanpa geser timezone. */
export function isWeekendDateString(dateStr: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr || '');
  if (!m) return new Date(dateStr).getDay() % 6 === 0;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const day = d.getDay();
  return day === 0 || day === 6;
}

/** Lewat deadline jam (h, m) — presisi sekond: 10:00:15 > 10:00:00. Date/timestamp input, local WIB. */
export function isAfterTimeOfDay(d: Date, h: number, m: number): boolean {
  return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds() > h * 3600 + m * 60;
}

/** Tanggal lokal (WIB / UTC+7) sebagai YYYY-MM-DD — bukan tanggal UTC dari toISOString. */
export function todayWIB(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
