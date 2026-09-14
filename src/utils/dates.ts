/** True kalau string YYYY-MM-DD jatuh pada Sabtu/Minggu. Tanpa geser timezone. */
export function isWeekendDateString(dateStr: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr || '');
  if (!m) return new Date(dateStr).getDay() % 6 === 0;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const day = d.getDay();
  return day === 0 || day === 6;
}
