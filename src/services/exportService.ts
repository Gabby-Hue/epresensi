import * as XLSX from 'xlsx';
import { AttendanceRecord, UserProfile } from '../types/attendance';

const BLUE_FILL = { patternType: 'solid', fgColor: { rgb: 'FFDCEBFF' }, bgColor: { rgb: 'FFDCEBFF' } };
const YELLOW_FILL = { patternType: 'solid', fgColor: { rgb: 'FFFFF3CD' }, bgColor: { rgb: 'FFFFF3CD' } };
const HEADER_FILL = { patternType: 'solid', fgColor: { rgb: 'FF1C1917' }, bgColor: { rgb: 'FF1C1917' } };
const HEADER_FONT = { color: { rgb: 'FFFFFFFF' }, bold: true, sz: 11 };
const BORDER = {
  top: { style: 'thin', color: { rgb: 'FFE4EBF3' } },
  bottom: { style: 'thin', color: { rgb: 'FFE4EBF3' } },
  left: { style: 'thin', color: { rgb: 'FFE4EBF3' } },
  right: { style: 'thin', color: { rgb: 'FFE4EBF3' } },
};

const jam = (iso?: string) => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
};

const tgl = (isoDate: string) => {
  try {
    const [y, m, d] = isoDate.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return isoDate;
  }
};

/** Gabungkan sesi masuk + pulang per orang per tanggal jadi satu baris. */
export interface RekapRow {
  nama: string;
  departemen: string;
  pt: string;
  tanggalISO: string;
  tanggal: string;
  masuk: string;
  pulang: string;
  status: string;
  persetujuan: string;
  kantor: string;
  jarak: string;
  alasan: string;
}

export function buildRekap(
  users: UserProfile[],
  records: AttendanceRecord[],
  filter?: { department?: string; companyId?: string }
): RekapRow[] {
  let staff = users.filter((u) => u.role === 'employee');
  if (filter?.department) staff = staff.filter((u) => u.department === filter.department);
  if (filter?.companyId) staff = staff.filter((u) => (u.companyId ?? '') === filter.companyId);
  const byId = new Map(staff.map((u) => [u.id, u]));
  // Kelompokkan per user+date
  const groups = new Map<string, AttendanceRecord[]>();
  for (const r of records) {
    if (!byId.has(r.userId)) continue;
    if (r.approvalStatus === 'rejected') continue;
    const key = `${r.userId}__${r.date}`;
    const arr = groups.get(key) || [];
    arr.push(r);
    groups.set(key, arr);
  }
  const rows: RekapRow[] = [];
  for (const [key, arr] of groups) {
    const [uid, date] = key.split('__');
    const u = byId.get(uid);
    if (!u) continue;
    const masuk = arr.find((r) => r.sessionType === 'masuk');
    const pulang = arr.find((r) => r.sessionType === 'pulang');
    const izin = arr.find((r) => r.sessionType === 'izin_sakit');
    const status = izin ? (izin.status === 'sakit' ? 'Sakit' : 'Izin') : 'Hadir';
    const appr = arr.some((r) => r.approvalStatus === 'pending') ? 'Menunggu' : 'Disetujui';
    const kantor = masuk?.officeName || pulang?.officeName || izin?.officeName || '-';
    const jarak = masuk?.distanceMeters ?? pulang?.distanceMeters;
    rows.push({
      nama: u.fullName,
      departemen: u.department || 'General',
      pt: u.companyName || '-',
      tanggalISO: date,
      tanggal: tgl(date),
      masuk: masuk ? jam(masuk.clockInTime) : '-',
      pulang: pulang ? jam(pulang.clockInTime) : '-',
      status,
      persetujuan: appr,
      kantor,
      jarak: jarak != null ? `${jarak} m` : '-',
      alasan: izin?.reason || '-',
    });
  }
  rows.sort((a, b) => a.tanggalISO.localeCompare(b.tanggalISO) || a.nama.localeCompare(b.nama));
  return rows;
}

const HEADERS = [
  'No', 'Nama', 'Departemen', 'PT', 'Tanggal',
  'Jam Masuk', 'Jam Pulang', 'Status', 'Persetujuan', 'Kantor', 'Jarak', 'Alasan',
];
const COL_W = [5, 24, 16, 18, 14, 11, 11, 10, 12, 18, 9, 26];

/** Export XLSX berwarna: header gelap, Jam Masuk biru, Jam Pulang kuning. */
export function exportRekapXLSX(rows: RekapRow[], fileName: string) {
  const aoa: any[][] = [HEADERS];
  rows.forEach((r, i) => {
    aoa.push([
      i + 1, r.nama, r.departemen, r.pt, r.tanggal,
      r.masuk, r.pulang, r.status, r.persetujuan, r.kantor, r.jarak, r.alasan,
    ]);
  });
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = COL_W.map((w) => ({ wch: w }));
  // Style header
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    ws[addr].s = { fill: HEADER_FILL, font: HEADER_FONT, border: BORDER, alignment: { horizontal: 'center', vertical: 'center' } };
  }
  // Style body: kolom F (index 5) biru, kolom G (index 6) kuning
  for (let r = 1; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (!cell) continue;
      const base: any = { border: BORDER, alignment: { vertical: 'center', horizontal: c <= 1 ? 'left' : 'center' } };
      if (c === 5) base.fill = BLUE_FILL;
      if (c === 6) base.fill = YELLOW_FILL;
      cell.s = { ...(cell.s || {}), ...base };
    }
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Rekap');
  XLSX.writeFile(wb, fileName);
}

/** CSV polos (tanpa warna) sebagai cadangan. */
export function exportRekapCSV(rows: RekapRow[], fileName: string) {
  const cell = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = '\ufeff' + [HEADERS.map(cell).join(','),
    ...rows.map((r, i) => [i + 1, r.nama, r.departemen, r.pt, r.tanggal, r.masuk, r.pulang,
      r.status, r.persetujuan, r.kantor, r.jarak, r.alasan].map(cell).join(',')),
  ].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
