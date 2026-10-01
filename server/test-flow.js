// Smoke test alur Frontend -> Backend -> DB. Jalankan: node test-flow.js
// Pakai akun tes khusus, dihapus lagi di akhir via API/SQL.
require('dotenv').config();
const jwt = require('jsonwebtoken');
const pool = require('./src/db');
const BASE = 'http://127.0.0.1:3001';
const EMAIL = 'tes-admin@local.test';
let step = 0;
function ok(name, cond, extra = '') {
  step += 1;
  console.log(`${cond ? 'PASS' : 'FAIL'} ${step}. ${name}${extra ? ' -> ' + extra : ''}`);
  if (!cond) process.exitCode = 1;
}
async function req(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* kosong */ }
  return { status: res.status, data };
}
(async () => {
  const h = await req('GET', '/health');
  ok('health + db', h.status === 200 && h.data && h.data.db === true, JSON.stringify(h.data));

  // Buat token admin langsung jika admin sudah ada di DB
  const [admins] = await pool.query("SELECT * FROM users WHERE role='admin' LIMIT 1");
  let initAdminToken = admins.length > 0
    ? jwt.sign({ id: admins[0].id, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' })
    : null;

  let reg = await req('POST', '/auth/register', {
    email: EMAIL, password: 'admin123', fullName: 'Tes Admin', role: 'admin',
  }, initAdminToken);
  if (reg.status === 409) {
    ok('register bootstrap (sudah ada, lanjut login)', true);
  } else {
    ok('register bootstrap admin pertama', reg.status === 201, `status=${reg.status}`);
  }

  const login = await req('POST', '/auth/login', {
    email: EMAIL, password: 'admin123', deviceModel: 'Tes', deviceId: 'tes-device-1',
  });
  ok('login + token', login.status === 200 && !!login.data.token, `status=${login.status}`);
  const token = login.data.token;

  const bad = await req('POST', '/auth/login', { email: EMAIL, password: 'salah' });
  ok('login password salah ditolak', bad.status === 401, `status=${bad.status}`);

  const me = await req('GET', '/me', null, token);
  ok('GET /me', me.status === 200 && me.data.user.email === EMAIL);

  const offices = await req('GET', '/offices', null, token);
  ok('GET /offices ada default', offices.status === 200 && offices.data.offices.length >= 1,
    `n=${offices.data && offices.data.offices.length}`);

  const depts = await req('GET', '/departments', null, token);
  ok('GET /departments', depts.status === 200 && Array.isArray(depts.data.departments) && depts.data.departments.length >= 1,
    `depts=${depts.data && depts.data.departments ? depts.data.departments.join(', ') : ''}`);

  const addDept = await req('POST', '/departments', { name: 'QA Testing' }, token);
  ok('POST /departments', addDept.status === 201 && addDept.data.departments.includes('QA Testing'));

  const today = new Date().toISOString().slice(0, 10);
  const masuk = await req('POST', '/attendances', {
    type: 'luring', sessionType: 'masuk', status: 'hadir', date: today,
    latitude: -6.2088, longitude: 106.8456, officeName: 'Kantor Utama',
  }, token);
  ok('POST absen masuk langsung approved', masuk.status === 201 && masuk.data.attendance.approvalStatus === 'approved');

  const izin = await req('POST', '/attendances', {
    type: 'izin_sakit', sessionType: 'izin_sakit', status: 'izin', date: today, reason: 'Tes izin',
  }, token);
  ok('POST izin masuk pending', izin.status === 201 && izin.data.attendance.approvalStatus === 'pending');
  const izinId = izin.data.attendance.id;

  const pend = await req('GET', '/attendances?approval=pending', null, token);
  ok('GET antrian pending', pend.status === 200 && pend.data.attendances.length >= 1);

  const rev = await req('PATCH', `/attendances/${izinId}/review`, { decision: 'approved', note: 'Oke' }, token);
  ok('PATCH review approve', rev.status === 200 && rev.data.attendance.approvalStatus === 'approved');

  // Upload foto (file teks pura-pura gambar, server tidak validasi mime)
  const fd = new FormData();
  fd.append('file', new Blob(['foto-pura-pura'], { type: 'image/jpeg' }), 'tes.jpg');
  const upRes = await fetch(BASE + '/upload/photo', {
    method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: fd,
  });
  const up = await upRes.json();
  ok('POST /upload/photo', upRes.status === 201 && !!up.url, up.url || '');

  console.log(process.exitCode ? 'SEBAGIAN GAGAL' : 'SEMUA LOLOS');
  process.exit(process.exitCode ? 1 : 0);
})().catch((e) => { console.error('FAIL fatal:', e.message); process.exit(1); });
