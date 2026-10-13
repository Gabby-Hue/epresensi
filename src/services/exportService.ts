import * as XLSX from 'xlsx';
import { AttendanceRecord, UserProfile } from '../types/attendance';
import { isWeekendDateString } from '../utils/dates';
import { getHolidayName, isNationalHoliday } from '../utils/holidays';
import { resolveMediaUrl } from '../lib/api';

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

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

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
  koordinat: string;
  alasan: string;
  fotoMasuk: string;
  fotoPulang: string;
  dokumenIzin: string;
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
    const kantor = masuk?.officeName || pulang?.officeName || izin?.officeName || (masuk?.type === 'daring' ? 'Rumah (WFH)' : '-');
    const jarak = masuk?.distanceMeters ?? pulang?.distanceMeters;

    const lat = masuk?.latitude ?? pulang?.latitude;
    const lng = masuk?.longitude ?? pulang?.longitude;
    const koordinat = lat != null && lng != null ? `${lat.toFixed(6)}, ${lng.toFixed(6)}` : '-';

    const fotoMasuk = resolveMediaUrl(masuk?.photoUrl) || '-';
    const fotoPulang = resolveMediaUrl(pulang?.photoUrl) || '-';
    const dokumenIzin = resolveMediaUrl(izin?.documentUrl) || '-';

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
      koordinat,
      alasan: izin?.reason || masuk?.reason || pulang?.reason || '-',
      fotoMasuk,
      fotoPulang,
      dokumenIzin,
    });
  }
  rows.sort((a, b) => a.tanggalISO.localeCompare(b.tanggalISO) || a.nama.localeCompare(b.nama));
  return rows;
}

const HEADERS = [
  'No', 'Nama', 'Departemen', 'PT', 'Tanggal',
  'Jam Masuk', 'Jam Pulang', 'Status', 'Persetujuan', 'Kantor', 'Jarak', 'Koordinat GPS', 'Alasan',
  'Foto Masuk', 'Foto Pulang', 'Dokumen Surat',
];
const COL_W = [5, 24, 16, 18, 14, 11, 11, 10, 12, 18, 9, 22, 26, 32, 32, 32];

/** Export XLSX berwarna: header gelap, Jam Masuk biru, Jam Pulang kuning. */
export function exportRekapXLSX(rows: RekapRow[], fileName: string) {
  const aoa: any[][] = [HEADERS];
  rows.forEach((r, i) => {
    aoa.push([
      i + 1, r.nama, r.departemen, r.pt, r.tanggal,
      r.masuk, r.pulang, r.status, r.persetujuan, r.kantor, r.jarak, r.koordinat, r.alasan,
      r.fotoMasuk, r.fotoPulang, r.dokumenIzin,
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
      // Hyperlink untuk kolom Foto Masuk (13), Foto Pulang (14), Dokumen Surat (15)
      if ((c === 13 || c === 14 || c === 15) && typeof cell.v === 'string' && cell.v.startsWith('http')) {
        cell.l = { Target: cell.v, Tooltip: 'Klik untuk membuka foto bukti presensi' };
        base.font = { color: { rgb: 'FF0284C7' }, underline: true };
      }
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
      r.status, r.persetujuan, r.kantor, r.jarak, r.koordinat, r.alasan,
      r.fotoMasuk, r.fotoPulang, r.dokumenIzin].map(cell).join(',')),
  ].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export interface SlipPrintData {
  user: UserProfile;
  year: number;
  month: number; // 0-indexed
  records: AttendanceRecord[];
}

/** Cetak Slip / Lembar Rekapitulasi Presensi Bulanan Karyawan (Print / PDF View) */
export function printAttendanceSlip(data: SlipPrintData) {
  const { user, year, month, records } = data;
  const monthName = MONTH_NAMES[month];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const now = new Date();

  // Filter records untuk bulan & tahun terpilih
  const monthRecords = records.filter((r) => {
    let ry = -1;
    let rm = -1;
    if (r.date && /^\d{4}-\d{2}-\d{2}/.test(r.date)) {
      const parts = r.date.split('-');
      ry = Number(parts[0]);
      rm = Number(parts[1]) - 1;
    } else {
      const rd = new Date(r.clockInTime || r.date);
      ry = rd.getFullYear();
      rm = rd.getMonth();
    }
    return ry === year && rm === month && r.approvalStatus !== 'rejected';
  });

  // Petakan record harian
  const dayRows: Array<{
    day: number;
    dateStr: string;
    dayName: string;
    masuk: string;
    pulang: string;
    lokasi: string;
    koordinat: string;
    mapsUrl: string | null;
    status: string;
    keterangan: string;
    isWeekend: boolean;
    isHoliday: boolean;
  }> = [];

  let countLengkap = 0;
  let countSatuSesi = 0;
  let countIzin = 0;
  let countLibur = 0;
  let countAlpa = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month, d);
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayName = dateObj.toLocaleDateString('id-ID', { weekday: 'short' });
    const isWeekend = isWeekendDateString(dateStr);
    const holidayName = getHolidayName(dateStr);
    const isHoliday = Boolean(holidayName);

    const isPast = dateObj < new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const isToday = dateObj.getTime() === new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const dRecords = monthRecords.filter((r) => r.date === dateStr);
    const masuk = dRecords.find((r) => r.sessionType === 'masuk');
    const pulang = dRecords.find((r) => r.sessionType === 'pulang');
    const izin = dRecords.find((r) => r.sessionType === 'izin_sakit');

    let masukTime = masuk ? jam(masuk.clockInTime) : '-';
    let pulangTime = pulang ? jam(pulang.clockInTime) : '-';
    let status = '-';
    let lokasi = '-';
    let koordinat = '-';
    let mapsUrl: string | null = null;
    let keterangan = '-';

    const activeRec = masuk || pulang;
    if (activeRec) {
      if (activeRec.latitude != null && activeRec.longitude != null) {
        const lat = activeRec.latitude;
        const lng = activeRec.longitude;
        koordinat = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
      }

      if (activeRec.type === 'daring') {
        lokasi = 'Dari Rumah (WFH)';
      } else {
        lokasi = activeRec.officeName || 'Kantor';
        if (activeRec.distanceMeters != null) {
          lokasi += ` (${activeRec.distanceMeters} m)`;
        }
      }

      if (activeRec.reason) {
        keterangan = activeRec.reason;
      }
    }

    if (izin) {
      status = izin.status === 'sakit' ? 'Sakit' : 'Izin';
      keterangan = izin.reason || (izin.status === 'sakit' ? 'Surat Sakit' : 'Pengajuan Izin');
      countIzin++;
    } else if (masuk && pulang) {
      status = (isWeekend || isHoliday) ? 'Lembur Lengkap' : 'Hadir Lengkap';
      countLengkap++;
    } else if (masuk || pulang) {
      status = (isWeekend || isHoliday) ? 'Lembur (1 Sesi)' : 'Hadir 1 Sesi';
      countSatuSesi++;
    } else if (isHoliday) {
      status = 'Libur Resmi';
      keterangan = holidayName || 'Hari Libur Nasional';
      countLibur++;
    } else if (isWeekend) {
      status = 'Libur Pekan';
      keterangan = 'Sabtu / Minggu';
      countLibur++;
    } else if (isPast) {
      status = 'Alpa';
      keterangan = 'Tidak Hadir';
      countAlpa++;
    } else if (isToday) {
      status = 'Belum Absen';
      keterangan = 'Hari ini berjalan';
    } else {
      status = '-';
      keterangan = '-';
    }

    dayRows.push({
      day: d,
      dateStr,
      dayName,
      masuk: masukTime,
      pulang: pulangTime,
      lokasi,
      koordinat,
      mapsUrl,
      status,
      keterangan,
      isWeekend,
      isHoliday,
    });
  }

  const printDateStr = now.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>Slip Presensi - ${user.fullName} (${monthName} ${year})</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 12mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #0F172A;
      margin: 0;
      padding: 10px;
      font-size: 11px;
      line-height: 1.35;
    }
    .header-box {
      border-bottom: 2.5px solid #0284C7;
      padding-bottom: 8px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .brand-title {
      font-size: 18px;
      font-weight: 800;
      color: #0284C7;
      letter-spacing: -0.3px;
      margin: 0;
    }
    .brand-sub {
      font-size: 11px;
      color: #64748B;
      margin: 2px 0 0 0;
      font-weight: 500;
    }
    .doc-title {
      text-align: right;
    }
    .doc-title h2 {
      margin: 0;
      font-size: 14px;
      font-weight: 700;
      color: #0F172A;
      text-transform: uppercase;
    }
    .doc-title p {
      margin: 2px 0 0 0;
      font-size: 11px;
      color: #0284C7;
      font-weight: 600;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 6px;
      padding: 10px 14px;
      margin-bottom: 12px;
    }
    .meta-row {
      display: flex;
      margin-bottom: 3px;
    }
    .meta-label {
      width: 110px;
      color: #64748B;
      font-weight: 500;
    }
    .meta-val {
      font-weight: 700;
      color: #0F172A;
      flex: 1;
    }
    .stats-summary {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
    }
    .stat-card {
      flex: 1;
      border: 1px solid #E2E8F0;
      background: #FFFFFF;
      border-radius: 6px;
      padding: 6px 10px;
      text-align: center;
    }
    .stat-val {
      font-size: 14px;
      font-weight: 800;
      color: #0F172A;
    }
    .stat-lbl {
      font-size: 9.5px;
      color: #64748B;
      font-weight: 600;
      text-transform: uppercase;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
      margin-bottom: 16px;
    }
    th {
      background: #0F172A;
      color: #FFFFFF;
      font-weight: 700;
      text-align: center;
      padding: 6px 4px;
      border: 1px solid #0F172A;
      font-size: 9.5px;
      letter-spacing: 0.2px;
    }
    td {
      padding: 4px 6px;
      border: 1px solid #CBD5E1;
      vertical-align: middle;
    }
    .row-weekend {
      background: #FEF2F2;
    }
    .row-holiday {
      background: #FEE2E2;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .coords-link {
      color: #0284C7;
      text-decoration: none;
      font-family: monospace;
      font-size: 9px;
      font-weight: 600;
    }
    .badge-status {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 9px;
      font-weight: 700;
    }
    .badge-hadir { background: #E0F2FE; color: #0369A1; }
    .badge-satusesi { background: #FEF3C7; color: #B45309; }
    .badge-izin { background: #FEE2E2; color: #DC2626; border: 1px solid #FECACA; }
    .badge-libur { background: #FEE2E2; color: #DC2626; }
    .badge-alpa { background: #F1F5F9; color: #64748B; }
    .sig-section {
      display: flex;
      justify-content: space-between;
      margin-top: 18px;
      padding: 0 30px;
      page-break-inside: avoid;
    }
    .sig-box {
      width: 200px;
      text-align: center;
    }
    .sig-line {
      margin-top: 55px;
      border-bottom: 1.5px solid #0F172A;
      font-weight: 700;
      padding-bottom: 2px;
    }
    .sig-role {
      font-size: 10px;
      color: #64748B;
      margin-top: 2px;
    }
    @media print {
      .no-print { display: none; }
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="header-box">
    <div>
      <h1 class="brand-title">E-PRESENSI SKMI</h1>
      <p class="brand-sub">Sistem Informasi Kehadiran & Verifikasi Swafoto Karyawan</p>
    </div>
    <div class="doc-title">
      <h2>LEMBAR REKAPITULASI PRESENSI</h2>
      <p>Periode: ${monthName} ${year}</p>
    </div>
  </div>

  <div class="meta-grid">
    <div>
      <div class="meta-row">
        <span class="meta-label">Nama Karyawan</span>
        <span class="meta-val">: ${user.fullName}</span>
      </div>
      <div class="meta-row">
        <span class="meta-label">Departemen / Unit</span>
        <span class="meta-val">: ${user.department || 'Operasional'}</span>
      </div>
      <div class="meta-row">
        <span class="meta-label">ID Karyawan</span>
        <span class="meta-val">: EP-${String(user.id).padStart(4, '0')}</span>
      </div>
    </div>
    <div>
      <div class="meta-row">
        <span class="meta-label">Instansi / PT</span>
        <span class="meta-val">: ${user.companyName || 'PT Solusi Karya Mandiri Indonesia'}</span>
      </div>
      <div class="meta-row">
        <span class="meta-label">Perangkat Terkunci</span>
        <span class="meta-val">: ${user.deviceModel || 'HP Resmi'}</span>
      </div>
      <div class="meta-row">
        <span class="meta-label">Tanggal Dicetak</span>
        <span class="meta-val">: ${printDateStr}</span>
      </div>
    </div>
  </div>

  <div class="stats-summary">
    <div class="stat-card">
      <div class="stat-val" style="color: #0284C7;">${countLengkap}</div>
      <div class="stat-lbl">Hadir Lengkap</div>
    </div>
    <div class="stat-card">
      <div class="stat-val" style="color: #D97706;">${countSatuSesi}</div>
      <div class="stat-lbl">1 Sesi (Belum Pulang)</div>
    </div>
    <div class="stat-card">
      <div class="stat-val" style="color: #DC2626;">${countIzin}</div>
      <div class="stat-lbl">Izin / Sakit</div>
    </div>
    <div class="stat-card">
      <div class="stat-val" style="color: #DC2626;">${countLibur}</div>
      <div class="stat-lbl">Libur Pekan / Nasional</div>
    </div>
    <div class="stat-card">
      <div class="stat-val" style="color: #64748B;">${countAlpa}</div>
      <div class="stat-lbl">Alpa (Tanpa Keterangan)</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 26px;">No</th>
        <th style="width: 70px;">Tanggal</th>
        <th style="width: 40px;">Hari</th>
        <th style="width: 55px;">Masuk</th>
        <th style="width: 55px;">Pulang</th>
        <th style="width: 110px;">Lokasi / Tipe</th>
        <th style="width: 140px;">Koordinat GPS (Lat, Long)</th>
        <th style="width: 90px;">Status</th>
        <th>Keterangan / Alasan</th>
      </tr>
    </thead>
    <tbody>
      ${dayRows.map((r) => {
        let badgeClass = 'badge-alpa';
        if (r.status.includes('Hadir Lengkap') || r.status.includes('Lembur Lengkap')) badgeClass = 'badge-hadir';
        else if (r.status.includes('1 Sesi')) badgeClass = 'badge-satusesi';
        else if (r.status === 'Izin' || r.status === 'Sakit') badgeClass = 'badge-izin';
        else if (r.status.includes('Libur')) badgeClass = 'badge-libur';

        const rowClass = r.isHoliday ? 'row-holiday' : r.isWeekend ? 'row-weekend' : '';
        const coordsHtml = r.mapsUrl
          ? `<a href="${r.mapsUrl}" target="_blank" class="coords-link" title="Buka di Google Maps">${r.koordinat}</a>`
          : `<span style="font-family: monospace; font-size: 9px; color: #94A3B8;">${r.koordinat}</span>`;

        return `
        <tr class="${rowClass}">
          <td class="text-center">${r.day}</td>
          <td class="text-center" style="font-weight: 600;">${r.dateStr}</td>
          <td class="text-center">${r.dayName}</td>
          <td class="text-center" style="font-weight: 700; color: #0284C7;">${r.masuk}</td>
          <td class="text-center" style="font-weight: 700; color: #EA580C;">${r.pulang}</td>
          <td>${r.lokasi}</td>
          <td>${coordsHtml}</td>
          <td class="text-center"><span class="badge-status ${badgeClass}">${r.status}</span></td>
          <td>${r.keterangan}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>

  <div class="sig-section">
    <div class="sig-box">
      <div>Karyawan Yang Bersangkutan,</div>
      <div class="sig-line">${user.fullName}</div>
      <div class="sig-role">${user.department || 'Karyawan'}</div>
    </div>
    <div class="sig-box">
      <div>Mengetahui / Menyetujui,</div>
      <div class="sig-line">Pimpinan / Pembimbing</div>
      <div class="sig-role">${user.companyName || 'SKMI'}</div>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 350);
    };
  </script>
</body>
</html>`;

  // Buka jendela print baru (pada platform Web)
  if (typeof window !== 'undefined') {
    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.open();
      printWin.document.write(html);
      printWin.document.close();
    } else {
      // Fallback jika popup diblokir browser: gunakan iframe tersembunyi
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
      const doc = iframe.contentWindow?.document || iframe.contentDocument;
      if (doc) {
        doc.open();
        doc.write(html);
        doc.close();
      }
    }
  }
}
