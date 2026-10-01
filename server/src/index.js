// E-Presensi API - Express + MySQL/MariaDB. Pengganti Supabase.
// Alur: Expo App -> API ini -> MySQL Laragon (db epresensi).
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const pool = require('./db');
const {
  signToken,
  authRequired,
  adminOnly,
  hashPassword,
  verifyPassword,
  publicUser,
  publicAttendance,
  publicOffice,
} = require('./auth');

const app = express();
const PORT = Number(process.env.PORT || 3001);

app.use(cors());
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});
app.use(express.json({ limit: '5mb' }));

// ---- File upload (pengganti Supabase Storage) ----
const uploadDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });
app.use('/uploads', express.static(uploadDir));

const KIND_DIRS = { avatar: 'avatar', photo: 'photo', document: 'document' };
Object.values(KIND_DIRS).forEach((d) => {
  fs.mkdirSync(path.join(uploadDir, d), { recursive: true });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(uploadDir, KIND_DIRS[req.params.kind] || 'misc');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '') || '.jpg';
    const base = path.basename(file.originalname || 'file', ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, Date.now() + '-' + (base || 'file') + ext);
  },
});
const upload = multer({ storage, limits: { fileSize: 30 * 1024 * 1024 } });

// ---- Root & Health ----
app.get('/', (req, res) => {
  res.json({
    name: 'E-Presensi API',
    status: 'running',
    health: '/health'
  });
});

app.get('/health', async (req, res) => {
  try {
    const [r] = await pool.query('SELECT 1 AS ok');
    res.json({ ok: true, db: r[0].ok === 1 });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ================= AUTH =================
// Register: akun PERTAMA harus admin dan boleh tanpa token (bootstrap).
// Setelah admin ada, hanya admin (pakai token) yang boleh mendaftarkan akun.
app.post('/auth/register', async (req, res) => {
  try {
    const { email, password, fullName, role, department, phoneNumber } = req.body || {};
    if (!email || !password || !fullName) {
      return res.status(400).json({ error: 'email, password, fullName wajib diisi' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Kata sandi minimal 6 karakter.' });
    }
    const wantRole = role === 'admin' ? 'admin' : 'employee';
    const [[c]] = await pool.query("SELECT COUNT(*) AS n FROM users WHERE role='admin'");
    let createdBy = null;
    if (c.n > 0) {
      const h = req.headers.authorization || '';
      if (!h.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Hanya admin yang boleh mendaftarkan akun.' });
      }
      const jwt = require('jsonwebtoken');
      try {
        const p = jwt.verify(h.slice(7), process.env.JWT_SECRET || 'dev-secret-change-me');
        if (p.role !== 'admin') return res.status(403).json({ error: 'Hanya admin yang boleh mendaftarkan akun.' });
        createdBy = p.id;
      } catch {
        return res.status(401).json({ error: 'Token tidak valid.' });
      }
    } else if (wantRole !== 'admin') {
      return res.status(400).json({ error: 'Akun pertama harus admin.' });
    }
    const hash = await hashPassword(password);
    const [r] = await pool.query(
      'INSERT INTO users (email, password_hash, full_name, role, department, phone_number, created_by) VALUES (?,?,?,?,?,?,?)',
      [String(email).trim().toLowerCase(), hash, String(fullName).trim(), wantRole, department || 'General', phoneNumber || null, createdBy]
    );
    const [[row]] = await pool.query('SELECT * FROM users WHERE id=?', [r.insertId]);
    res.status(201).json({ user: publicUser(row) });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Email ini sudah terdaftar.' });
    res.status(500).json({ error: e.message });
  }
});

// Login + device lock (admin bebas, employee dikunci ke device pertama)
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password, deviceModel, deviceId } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email dan kata sandi wajib diisi.' });
    const [[row]] = await pool.query('SELECT * FROM users WHERE email=?', [String(email).trim().toLowerCase()]);
    if (!row || !(await verifyPassword(password, row.password_hash))) {
      return res.status(401).json({ error: 'Email atau kata sandi salah.' });
    }
    if (row.role !== 'admin') {
      if (row.device_id && deviceId && row.device_id !== deviceId) {
        return res.status(403).json({
          error: `Akun terkunci di perangkat ${row.device_model || row.device_id}. Hubungi admin untuk atur ulang.`,
        });
      }
      if (!row.device_id && deviceId) {
        await pool.query('UPDATE users SET device_model=?, device_id=? WHERE id=?', [deviceModel || null, deviceId, row.id]);
        row.device_model = deviceModel || null;
        row.device_id = deviceId;
      }
    }
    res.json({ token: signToken(row), user: publicUser(row) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/me', authRequired, async (req, res) => {
  const [[row]] = await pool.query('SELECT * FROM users WHERE id=?', [req.auth.id]);
  if (!row) return res.status(404).json({ error: 'Akun tidak ditemukan.' });
  res.json({ user: publicUser(row) });
});

app.patch('/me/avatar', authRequired, async (req, res) => {
  const { avatarUrl } = req.body || {};
  if (!avatarUrl) return res.status(400).json({ error: 'avatarUrl wajib diisi.' });
  await pool.query('UPDATE users SET avatar_url=? WHERE id=?', [avatarUrl, req.auth.id]);
  const [[row]] = await pool.query('SELECT * FROM users WHERE id=?', [req.auth.id]);
  res.json({ user: publicUser(row) });
});

// ================= USERS =================
app.get('/users', authRequired, adminOnly, async (req, res) => {
  const where = req.query.role ? 'WHERE role=?' : '';
  const args = req.query.role ? [req.query.role] : [];
  const [rows] = await pool.query(`SELECT * FROM users ${where} ORDER BY full_name`, args);
  res.json({ users: rows.map(publicUser) });
});

// Update data profil / user (admin bisa edit siapapun, user biasa bisa edit diri sendiri seperti avatar)
app.patch('/users/:id', authRequired, async (req, res) => {
  const targetId = Number(req.params.id);
  const isSelf = targetId === req.auth.id;
  const isAdmin = req.auth.role === 'admin';

  if (!isSelf && !isAdmin) {
    return res.status(403).json({ error: 'Tidak memiliki izin mengubah data pengguna ini.' });
  }

  const { fullName, department, phoneNumber, avatarUrl } = req.body || {};
  await pool.query(
    'UPDATE users SET full_name=COALESCE(?,full_name), department=COALESCE(?,department), phone_number=COALESCE(?,phone_number), avatar_url=COALESCE(?,avatar_url) WHERE id=?',
    [fullName || null, department || null, phoneNumber || null, avatarUrl || null, targetId]
  );
  const [[row]] = await pool.query('SELECT * FROM users WHERE id=?', [targetId]);
  res.json({ user: publicUser(row) });
});

// Buka kunci perangkat karyawan (ganti reset device di Supabase)
app.patch('/users/:id/reset-device', authRequired, adminOnly, async (req, res) => {
  await pool.query('UPDATE users SET device_model=NULL, device_id=NULL WHERE id=?', [req.params.id]);
  const [[row]] = await pool.query('SELECT * FROM users WHERE id=?', [req.params.id]);
  res.json({ user: publicUser(row) });
});

app.delete('/users/:id', authRequired, adminOnly, async (req, res) => {
  if (Number(req.params.id) === req.auth.id) {
    return res.status(400).json({ error: 'Tidak bisa menghapus akun sendiri.' });
  }
  await pool.query('DELETE FROM users WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

// ================= DEPARTMENTS =================
app.get('/departments', authRequired, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT name FROM departments ORDER BY name ASC');
    const list = rows.map((r) => r.name);
    res.json({ departments: list });
  } catch {
    const [uRows] = await pool.query('SELECT DISTINCT department FROM users WHERE department IS NOT NULL');
    const set = new Set(['Sales', 'IT', 'Drafter', 'Human Capital', 'Marketing']);
    uRows.forEach((r) => r.department && set.add(r.department));
    res.json({ departments: Array.from(set) });
  }
});

app.post('/departments', authRequired, adminOnly, async (req, res) => {
  try {
    const { name } = req.body || {};
    const trimmed = String(name || '').trim();
    if (!trimmed) {
      return res.status(400).json({ error: 'Nama departemen tidak boleh kosong.' });
    }
    await pool.query('INSERT IGNORE INTO departments (name) VALUES (?)', [trimmed]);
    const [rows] = await pool.query('SELECT name FROM departments ORDER BY name ASC');
    res.status(201).json({ departments: rows.map((r) => r.name), added: trimmed });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ================= OFFICES =================
app.get('/offices', authRequired, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM office_settings ORDER BY id');
  res.json({ offices: rows.map(publicOffice) });
});

app.post('/offices', authRequired, adminOnly, async (req, res) => {
  const { officeName, latitude, longitude, radiusMeters, color } = req.body || {};
  const [r] = await pool.query(
    'INSERT INTO office_settings (office_name, latitude, longitude, radius_meters, color) VALUES (?,?,?,?,?)',
    [officeName || 'Kantor', Number(latitude), Number(longitude), Number(radiusMeters) || 150, color || '#2196F3']
  );
  const [[row]] = await pool.query('SELECT * FROM office_settings WHERE id=?', [r.insertId]);
  res.status(201).json({ office: publicOffice(row) });
});

app.patch('/offices/:id', authRequired, adminOnly, async (req, res) => {
  const { officeName, latitude, longitude, radiusMeters, color } = req.body || {};
  await pool.query(
    'UPDATE office_settings SET office_name=COALESCE(?,office_name), latitude=COALESCE(?,latitude), longitude=COALESCE(?,longitude), radius_meters=COALESCE(?,radius_meters), color=COALESCE(?,color) WHERE id=?',
    [officeName || null, latitude ?? null, longitude ?? null, radiusMeters ?? null, color || null, req.params.id]
  );
  const [[row]] = await pool.query('SELECT * FROM office_settings WHERE id=?', [req.params.id]);
  res.json({ office: publicOffice(row) });
});

app.delete('/offices/:id', authRequired, adminOnly, async (req, res) => {
  await pool.query('DELETE FROM office_settings WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

// ================= ATTENDANCES =================
app.get('/attendances', authRequired, async (req, res) => {
  const conds = [];
  const args = [];
  // Karyawan hanya boleh lihat miliknya sendiri
  const userId = req.auth.role === 'admin' ? req.query.user_id : req.auth.id;
  if (userId) { conds.push('user_id=?'); args.push(userId); }
  if (req.query.month) { conds.push("DATE_FORMAT(date,'%Y-%m')=?"); args.push(req.query.month); }
  if (req.query.approval) { conds.push('approval_status=?'); args.push(req.query.approval); }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const [rows] = await pool.query(`SELECT * FROM attendances ${where} ORDER BY date DESC, id DESC LIMIT 1000`, args);
  res.json({ attendances: rows.map(publicAttendance) });
});

app.post('/attendances', authRequired, async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.type || !b.status || !b.date) {
      return res.status(400).json({ error: 'type, status, date wajib diisi.' });
    }
    const [[me]] = await pool.query('SELECT * FROM users WHERE id=?', [req.auth.id]);
    if (!me) return res.status(404).json({ error: 'Akun tidak ditemukan.' });
    const sessionType = b.sessionType || b.session_type || 'masuk';
    const approval = sessionType === 'izin_sakit' ? 'pending' : 'approved';
    const [r] = await pool.query(
      `INSERT INTO attendances (user_id, user_name, user_email, type, session_type, status, date,
        clock_in_time, latitude, longitude, distance_meters, office_name, office_color,
        reason, start_date, end_date, photo_url, document_url, approval_status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        me.id, me.full_name, me.email, b.type, sessionType, b.status, b.date,
        b.clockInTime || b.clock_in_time || new Date().toISOString().slice(0, 19).replace('T', ' '),
        b.latitude ?? null, b.longitude ?? null, b.distanceMeters ?? b.distance_meters ?? null,
        b.officeName ?? b.office_name ?? null, b.officeColor ?? b.office_color ?? null,
        b.reason ?? null, b.startDate ?? b.start_date ?? null, b.endDate ?? b.end_date ?? null,
        b.photoUrl ?? b.photo_url ?? null, b.documentUrl ?? b.document_url ?? null, approval,
      ]
    );
    const [[row]] = await pool.query('SELECT * FROM attendances WHERE id=?', [r.insertId]);
    res.status(201).json({ attendance: publicAttendance(row) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Review izin/sakit oleh admin
app.patch('/attendances/:id/review', authRequired, adminOnly, async (req, res) => {
  const { decision, note } = req.body || {};
  if (!['approved', 'rejected'].includes(decision)) {
    return res.status(400).json({ error: 'decision harus approved atau rejected.' });
  }
  await pool.query('UPDATE attendances SET approval_status=?, reviewed_by=?, reviewed_at=NOW(), review_note=? WHERE id=?', [
    decision, req.auth.id, note || null, req.params.id,
  ]);
  const [[row]] = await pool.query('SELECT * FROM attendances WHERE id=?', [req.params.id]);
  res.json({ attendance: publicAttendance(row) });
});

// ================= UPLOAD (pengganti Storage buckets) =================
// kind: avatar | photo | document. Form field: file. Return: { url }
app.post('/upload/:kind', authRequired, (req, res) => {
  if (!KIND_DIRS[req.params.kind]) return res.status(400).json({ error: 'kind harus avatar, photo, atau document.' });
  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error('Upload error:', err);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Ukuran file melebihi batas maksimal (30MB).' });
      }
      return res.status(400).json({ error: err.message || 'Gagal memproses file upload.' });
    }
    if (!req.file) return res.status(400).json({ error: 'File wajib dikirim (field: file).' });
    const url = `${req.protocol}://${req.get('host')}/uploads/${req.params.kind}/${req.file.filename}`;
    res.status(201).json({ url });
  });
});

app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Terjadi kesalahan pada server.' });
});

app.listen(PORT, () => console.log(`epresensi-api jalan di http://localhost:${PORT}`));
