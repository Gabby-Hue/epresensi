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
  superOnly,
  hashPassword,
  verifyPassword,
  publicUser,
  publicAttendance,
  publicOffice,
} = require('./auth');

const app = express();
app.set('trust proxy', 1);
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

// ---- Helper datetime: normalisasi timestamps ke WIB (UTC+7) ----
// Client send ISO UTC (toISOString) atau naive 'YYYY-MM-DD HH:MM:SS' WIB.
// Konversion: input de-timestamp (Z/offset) digeser ke WIB; naive = passthrough.
function wibNowNaive() {
  const w = new Date(Date.now() + 7 * 3600 * 1000);
  return w.toISOString().slice(0, 19).replace('T', ' ');
}

function toMySQLDatetime(v) {
  if (!v) return wibNowNaive();
  const s = String(v).trim();
  // Naif MySQL format sudah WIB → passthrough
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(s)) return s.length === 16 ? s + ':00' : s;
  const d = new Date(s);
  if (isNaN(d.getTime())) return wibNowNaive();
  // Kezikka eksplisit (Z atau ±HH:MM) → instant absoluto, geser ke WIB
  if (/(Z|[+-]\d{2}:\d{2})\s*$/i.test(s)) {
    return new Date(d.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');
  }
  // Naif ISO (no timezone) → asumsi sudah WIB, format saja
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

// ---- Audit Trail Logger (Log Aktivitas Admin Cabang & Superadmin) ----
async function logActivity(userId, userName, userRole, companyId, action, description) {
  try {
    await pool.query(
      'INSERT INTO audit_logs (user_id, user_name, user_role, company_id, action, description) VALUES (?,?,?,?,?,?)',
      [userId, userName || 'User', userRole || 'admin', companyId || null, action, description || null]
    );
  } catch (err) {
    console.error('Audit log error:', err.message);
  }
}

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
// Register: akun PERTAMA harus superadmin dan boleh tanpa token (bootstrap).
// Setelah itu: superadmin bisa buat superadmin/admin/employee di PT mana pun,
// admin hanya bisa buat admin/employee di PT-nya sendiri.
app.post('/auth/register', async (req, res) => {
  try {
    const { email, password, fullName, role, department, phoneNumber, companyId, company_id } = req.body || {};
    if (!email || !password || !fullName) {
      return res.status(400).json({ error: 'email, password, fullName wajib diisi' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Kata sandi minimal 6 karakter.' });
    }
    const wantRole = role === 'superadmin' ? 'superadmin' : role === 'admin' ? 'admin' : 'employee';
    const [[c]] = await pool.query('SELECT COUNT(*) AS n FROM users');
    let createdBy = null;
    let targetCompany = companyId ?? company_id ?? null;
    if (c.n === 0) {
      if (wantRole !== 'superadmin') {
        return res.status(400).json({ error: 'Akun pertama harus superadmin.' });
      }
      // PT pertama: pakai yang sudah ada atau buat baru
      const [[co]] = await pool.query('SELECT id FROM companies ORDER BY id LIMIT 1');
      targetCompany = co ? co.id : null;
      if (!targetCompany) {
        const [cr] = await pool.query('INSERT INTO companies (name) VALUES (?)', ['PT SKMI']);
        targetCompany = cr.insertId;
      }
    } else {
      const h = req.headers.authorization || '';
      if (!h.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Hanya admin yang boleh mendaftarkan akun.' });
      }
      const jwt = require('jsonwebtoken');
      let p;
      try {
        p = jwt.verify(h.slice(7), process.env.JWT_SECRET || 'dev-secret-change-me');
      } catch {
        return res.status(401).json({ error: 'Token tidak valid.' });
      }
      const [[creator]] = await pool.query('SELECT * FROM users WHERE id=?', [p.id]);
      if (!creator || (creator.role !== 'admin' && creator.role !== 'superadmin')) {
        return res.status(403).json({ error: 'Hanya admin yang boleh mendaftarkan akun.' });
      }
      createdBy = creator.id;
      if (creator.role === 'superadmin') {
        if (wantRole === 'superadmin' && !targetCompany) targetCompany = creator.company_id;
      } else {
        // admin biasa: tidak boleh buat superadmin, PT dikunci ke PT-nya
        if (wantRole === 'superadmin') {
          return res.status(403).json({ error: 'Hanya superadmin yang boleh membuat superadmin.' });
        }
        targetCompany = creator.company_id;
      }
      if ((wantRole === 'admin' || wantRole === 'employee') && !targetCompany) {
        return res.status(400).json({ error: 'PT (company) wajib dipilih.' });
      }
    }
    const hash = await hashPassword(password);
    let r;
    try {
      const [resIns] = await pool.query(
        'INSERT INTO users (email, password_hash, full_name, role, department, phone_number, created_by, company_id, plain_password) VALUES (?,?,?,?,?,?,?,?,?)',
        [String(email).trim().toLowerCase(), hash, String(fullName).trim(), wantRole, department || 'General', phoneNumber || null, createdBy, targetCompany, String(password)]
      );
      r = resIns;
    } catch (e) {
      const [resIns] = await pool.query(
        'INSERT INTO users (email, password_hash, full_name, role, department, phone_number, created_by, company_id) VALUES (?,?,?,?,?,?,?,?)',
        [String(email).trim().toLowerCase(), hash, String(fullName).trim(), wantRole, department || 'General', phoneNumber || null, createdBy, targetCompany]
      );
      r = resIns;
    }
    const [[row]] = await pool.query(
      'SELECT u.*, c.name AS company_name FROM users u LEFT JOIN companies c ON c.id=u.company_id WHERE u.id=?', [r.insertId]);
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
    if (row.role !== 'admin' && row.role !== 'superadmin') {
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
    } else {
      // Admin & Superadmin bebas device lock total
      row.device_model = null;
      row.device_id = null;
      void logActivity(
        row.id,
        row.full_name,
        row.role,
        row.company_id,
        'login',
        `Masuk ke sistem (${deviceModel || 'Web Client'})`
      );
    }
    res.json({ token: signToken(row), user: publicUser(row) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/me', authRequired, async (req, res) => {
  const [[row]] = await pool.query(
    'SELECT u.*, c.name AS company_name FROM users u LEFT JOIN companies c ON c.id=u.company_id WHERE u.id=?', [req.auth.id]);
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

// ================= COMPANIES (PT / cabang beda PT) =================
// Hanya superadmin yang boleh kelola daftar PT.
app.get('/companies', authRequired, adminOnly, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM companies ORDER BY name');
  res.json({ companies: rows.map((c) => ({ id: c.id, name: c.name, createdAt: c.created_at })) });
});

app.post('/companies', authRequired, superOnly, async (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Nama PT wajib diisi.' });
  try {
    const [r] = await pool.query('INSERT INTO companies (name) VALUES (?)', [name]);
    const [[row]] = await pool.query('SELECT * FROM companies WHERE id=?', [r.insertId]);
    res.status(201).json({ company: { id: row.id, name: row.name, createdAt: row.created_at } });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'PT ini sudah ada.' });
    res.status(500).json({ error: e.message });
  }
});

app.patch('/companies/:id', authRequired, superOnly, async (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Nama PT wajib diisi.' });
  await pool.query('UPDATE companies SET name=? WHERE id=?', [name, req.params.id]);
  const [[row]] = await pool.query('SELECT * FROM companies WHERE id=?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'PT tidak ditemukan.' });
  res.json({ company: { id: row.id, name: row.name, createdAt: row.created_at } });
});

app.delete('/companies/:id', authRequired, superOnly, async (req, res) => {
  try {
    const [[targetComp]] = await pool.query('SELECT * FROM companies WHERE id=?', [req.params.id]);
    if (!targetComp) return res.status(404).json({ error: 'PT tidak ditemukan.' });

    const isForce = String(req.query?.force) === 'true';
    const [[empCount]] = await pool.query(
      "SELECT COUNT(*) AS n FROM users WHERE company_id=? AND role='employee'",
      [req.params.id]
    );

    if (empCount.n > 0 && !isForce) {
      return res.status(400).json({
        error: `PT ${targetComp.name} masih memiliki ${empCount.n} karyawan aktif. Pindahkan karyawan terlebih dahulu sebelum menghapus PT.`,
      });
    }

    // Jika force atau karyawan sudah 0:
    if (empCount.n > 0) {
      await pool.query('UPDATE users SET company_id=NULL WHERE company_id=? AND role="employee"', [req.params.id]);
    }
    await pool.query('DELETE FROM users WHERE company_id=? AND role="admin"', [req.params.id]);
    await pool.query('DELETE FROM office_settings WHERE company_id=?', [req.params.id]);
    await pool.query('DELETE FROM companies WHERE id=?', [req.params.id]);

    const [[me]] = await pool.query('SELECT * FROM users WHERE id=?', [req.auth.id]);
    void logActivity(
      req.auth.id,
      me ? me.full_name : 'Superadmin',
      'superadmin',
      null,
      'delete_company',
      `Menghapus entitas PT: ${targetComp.name} (ID: ${req.params.id})`
    );

    res.json({ ok: true, message: `PT ${targetComp.name} berhasil dihapus.` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Helper: PT milik peminta (admin dikunci ke PT-nya, superadmin bebas + filter ?company_id=)
async function requesterCompany(req) {
  const [[me]] = await pool.query('SELECT * FROM users WHERE id=?', [req.auth.id]);
  if (!me) return { me: null, companyId: null };
  if (me.role === 'superadmin') {
    const q = req.query?.company_id ? Number(req.query.company_id) : null;
    return { me, companyId: q || null, isSuper: true };
  }
  return { me, companyId: me.company_id, isSuper: false };
}

// ================= USERS =================
app.get('/users', authRequired, adminOnly, async (req, res) => {
  const { companyId, isSuper } = await requesterCompany(req);
  let where = '';
  const args = [];
  if (!isSuper) {
    where = 'WHERE u.company_id=?';
    args.push(companyId);
  } else if (req.query.company_id) {
    where = 'WHERE u.company_id=?';
    args.push(Number(req.query.company_id));
  }
  if (req.query.role) {
    where += (where ? ' AND' : 'WHERE') + ' u.role=?';
    args.push(req.query.role);
  }
  const [rows] = await pool.query(
    `SELECT u.*, c.name AS company_name FROM users u LEFT JOIN companies c ON c.id=u.company_id ${where} ORDER BY u.full_name`, args);
  res.json({ users: rows.map(publicUser) });
});

// Update data profil / user (admin bisa edit siapapun, user biasa bisa edit diri sendiri seperti avatar)
app.patch('/users/:id', authRequired, async (req, res) => {
  const targetId = Number(req.params.id);
  const isSelf = targetId === req.auth.id;
  const isAdmin = req.auth.role === 'admin' || req.auth.role === 'superadmin';

  if (!isSelf && !isAdmin) {
    return res.status(403).json({ error: 'Tidak memiliki izin mengubah data pengguna ini.' });
  }
  // Admin biasa tidak boleh menyentuh akun PT lain
  if (!isSelf && req.auth.role === 'admin') {
    const [[t]] = await pool.query('SELECT company_id FROM users WHERE id=?', [targetId]);
    const [[s]] = await pool.query('SELECT company_id FROM users WHERE id=?', [req.auth.id]);
    if (!t || t.company_id !== s.company_id) {
      return res.status(403).json({ error: 'Akun ini milik PT lain.' });
    }
  }

  const { fullName, department, phoneNumber, avatarUrl, password } = req.body || {};
  let updatePasswordSql = '';
  const updateArgs = [fullName || null, department || null, phoneNumber || null, avatarUrl || null];
  if (password && String(password).length >= 6) {
    const hash = await hashPassword(password);
    updatePasswordSql = ', password_hash=?, plain_password=?';
    updateArgs.push(hash, String(password));
  }
  updateArgs.push(targetId);

  try {
    await pool.query(
      `UPDATE users SET full_name=COALESCE(?,full_name), department=COALESCE(?,department), phone_number=COALESCE(?,phone_number), avatar_url=COALESCE(?,avatar_url)${updatePasswordSql} WHERE id=?`,
      updateArgs
    );
  } catch (e) {
    if (password && String(password).length >= 6) {
      await pool.query(
        'UPDATE users SET full_name=COALESCE(?,full_name), department=COALESCE(?,department), phone_number=COALESCE(?,phone_number), avatar_url=COALESCE(?,avatar_url), password_hash=? WHERE id=?',
        [fullName || null, department || null, phoneNumber || null, avatarUrl || null, await hashPassword(password), targetId]
      );
    } else {
      await pool.query(
        'UPDATE users SET full_name=COALESCE(?,full_name), department=COALESCE(?,department), phone_number=COALESCE(?,phone_number), avatar_url=COALESCE(?,avatar_url) WHERE id=?',
        [fullName || null, department || null, phoneNumber || null, avatarUrl || null, targetId]
      );
    }
  }
  const [[row]] = await pool.query('SELECT * FROM users WHERE id=?', [targetId]);
  res.json({ user: publicUser(row) });
});

// Buka kunci perangkat karyawan (ganti reset device di Supabase)
app.patch('/users/:id/reset-device', authRequired, adminOnly, async (req, res) => {
  await pool.query('UPDATE users SET device_model=NULL, device_id=NULL WHERE id=?', [req.params.id]);
  const [[row]] = await pool.query('SELECT * FROM users WHERE id=?', [req.params.id]);
  const [[me]] = await pool.query('SELECT * FROM users WHERE id=?', [req.auth.id]);
  void logActivity(
    req.auth.id,
    me ? me.full_name : 'Admin',
    req.auth.role,
    row ? row.company_id : null,
    'reset_device',
    `Mereset kunci perangkat karyawan: ${row ? row.full_name : ''} (${row ? row.email : ''})`
  );
  res.json({ user: publicUser(row) });
});

app.delete('/users/:id', authRequired, adminOnly, async (req, res) => {
  if (Number(req.params.id) === req.auth.id) {
    return res.status(400).json({ error: 'Tidak bisa menghapus akun sendiri.' });
  }
  const [[targetUser]] = await pool.query('SELECT * FROM users WHERE id=?', [req.params.id]);
  if (!targetUser) return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });

  // Admin biasa tidak boleh menghapus admin lain / akun PT lain
  if (req.auth.role !== 'superadmin') {
    if (targetUser.role === 'admin' || targetUser.role === 'superadmin') {
      return res.status(403).json({ error: 'Hanya superadmin yang boleh menghapus akun admin.' });
    }
    const [[me]] = await pool.query('SELECT company_id FROM users WHERE id=?', [req.auth.id]);
    if (targetUser.company_id !== me.company_id) {
      return res.status(403).json({ error: 'Akun ini milik PT lain.' });
    }
  }

  await pool.query('DELETE FROM users WHERE id=?', [req.params.id]);

  const [[me]] = await pool.query('SELECT * FROM users WHERE id=?', [req.auth.id]);
  void logActivity(
    req.auth.id,
    me ? me.full_name : 'Admin',
    req.auth.role,
    targetUser.company_id,
    'delete_user',
    `Menghapus akun ${targetUser.role === 'admin' ? 'Admin Cabang' : 'Karyawan'}: ${targetUser.full_name} (${targetUser.email})`
  );

  res.json({ ok: true, message: 'Akun berhasil dihapus.' });
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
  const { companyId, isSuper } = await requesterCompany(req);
  let where = '';
  const args = [];
  if (!isSuper) {
    where = 'WHERE company_id=?';
    args.push(companyId);
  } else if (req.query.company_id) {
    where = 'WHERE company_id=?';
    args.push(Number(req.query.company_id));
  }
  const [rows] = await pool.query(`SELECT * FROM office_settings ${where} ORDER BY id`, args);
  res.json({ offices: rows.map(publicOffice) });
});

// Auto-migration kolom jam kerja kantor & plain_password jika belum ada
(async () => {
  try {
    await pool.query("ALTER TABLE office_settings ADD COLUMN IF NOT EXISTS work_start_time VARCHAR(8) DEFAULT '08:00'");
    await pool.query("ALTER TABLE office_settings ADD COLUMN IF NOT EXISTS work_end_time VARCHAR(8) DEFAULT '17:00'");
    await pool.query("ALTER TABLE office_settings ADD COLUMN IF NOT EXISTS late_deadline VARCHAR(8) DEFAULT '10:00'");
    await pool.query("ALTER TABLE office_settings ADD COLUMN IF NOT EXISTS address TEXT NULL");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS plain_password VARCHAR(255) NULL");
    await pool.query("UPDATE users SET plain_password='123456' WHERE plain_password IS NULL");
  } catch (e) {
    // MariaDB/MySQL tanpa support IF NOT EXISTS bisa diabaikan
  }
})();

app.post('/offices', authRequired, adminOnly, async (req, res) => {
  const { companyId, isSuper, me } = await requesterCompany(req);
  const targetCompany = isSuper ? (Number(req.body?.companyId ?? req.body?.company_id) || me.company_id) : companyId;
  if (!targetCompany) return res.status(400).json({ error: 'PT (company) wajib dipilih.' });
  const { officeName, latitude, longitude, radiusMeters, color, workStartTime, workEndTime, lateDeadline, address } = req.body || {};
  let r;
  try {
    const [resInsert] = await pool.query(
      'INSERT INTO office_settings (office_name, latitude, longitude, radius_meters, color, company_id, work_start_time, work_end_time, late_deadline, address) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [officeName || 'Kantor', Number(latitude), Number(longitude), Number(radiusMeters) || 150, color || '#2196F3', targetCompany, workStartTime || '08:00', workEndTime || '17:00', lateDeadline || '10:00', address || null]
    );
    r = resInsert;
  } catch (e) {
    const [resInsert] = await pool.query(
      'INSERT INTO office_settings (office_name, latitude, longitude, radius_meters, color, company_id) VALUES (?,?,?,?,?,?)',
      [officeName || 'Kantor', Number(latitude), Number(longitude), Number(radiusMeters) || 150, color || '#2196F3', targetCompany]
    );
    r = resInsert;
  }
  const [[row]] = await pool.query('SELECT * FROM office_settings WHERE id=?', [r.insertId]);
  res.status(201).json({ office: publicOffice(row) });
});

app.patch('/offices/:id', authRequired, adminOnly, async (req, res) => {
  const { companyId, isSuper } = await requesterCompany(req);
  if (!isSuper) {
    const [[o]] = await pool.query('SELECT company_id FROM office_settings WHERE id=?', [req.params.id]);
    if (!o || o.company_id !== companyId) return res.status(403).json({ error: 'Titik kantor ini milik PT lain.' });
  }
  const { officeName, latitude, longitude, radiusMeters, color, workStartTime, workEndTime, lateDeadline, address } = req.body || {};
  try {
    await pool.query(
      'UPDATE office_settings SET office_name=COALESCE(?,office_name), latitude=COALESCE(?,latitude), longitude=COALESCE(?,longitude), radius_meters=COALESCE(?,radius_meters), color=COALESCE(?,color), work_start_time=COALESCE(?,work_start_time), work_end_time=COALESCE(?,work_end_time), late_deadline=COALESCE(?,late_deadline), address=COALESCE(?,address) WHERE id=?',
      [officeName || null, latitude ?? null, longitude ?? null, radiusMeters ?? null, color || null, workStartTime || null, workEndTime || null, lateDeadline || null, address || null, req.params.id]
    );
  } catch (e) {
    await pool.query(
      'UPDATE office_settings SET office_name=COALESCE(?,office_name), latitude=COALESCE(?,latitude), longitude=COALESCE(?,longitude), radius_meters=COALESCE(?,radius_meters), color=COALESCE(?,color) WHERE id=?',
      [officeName || null, latitude ?? null, longitude ?? null, radiusMeters ?? null, color || null, req.params.id]
    );
  }
  const [[row]] = await pool.query('SELECT * FROM office_settings WHERE id=?', [req.params.id]);
  res.json({ office: publicOffice(row) });
});

app.delete('/offices/:id', authRequired, adminOnly, async (req, res) => {
  const { companyId, isSuper } = await requesterCompany(req);
  if (!isSuper) {
    const [[o]] = await pool.query('SELECT company_id FROM office_settings WHERE id=?', [req.params.id]);
    if (!o || o.company_id !== companyId) return res.status(403).json({ error: 'Titik kantor ini milik PT lain.' });
  }
  await pool.query('DELETE FROM office_settings WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

// ================= ATTENDANCES =================
app.get('/attendances', authRequired, async (req, res) => {
  const { companyId, isSuper } = await requesterCompany(req);
  const conds = [];
  const args = [];
  if (!isSuper) {
    // Karyawan: hanya miliknya. Admin: hanya PT-nya.
    conds.push(req.auth.role === 'employee' ? 'user_id=?' : 'company_id=?');
    args.push(req.auth.role === 'employee' ? req.auth.id : companyId);
    if (req.auth.role === 'admin' && req.query.user_id) { conds.push('user_id=?'); args.push(req.query.user_id); }
  } else {
    if (req.query.company_id) { conds.push('company_id=?'); args.push(Number(req.query.company_id)); }
    if (req.query.user_id) { conds.push('user_id=?'); args.push(req.query.user_id); }
  }
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

    // Guard duplikat: satu masuk / pulang per user per tanggal; izin/sakit per rentang tanggal.
    if (sessionType === 'masuk' || sessionType === 'pulang') {
      // 1. Cek apakah ada izin/sakit aktif di tanggal ini (pending atau approved)
      const [[activeLeave]] = await pool.query(
        `SELECT id, status, approval_status, start_date, end_date FROM attendances 
         WHERE user_id=? AND session_type='izin_sakit' 
           AND approval_status IN ('pending', 'approved')
           AND ? >= COALESCE(start_date, date) AND ? <= COALESCE(end_date, date) 
         LIMIT 1`,
        [me.id, b.date, b.date]
      );
      if (activeLeave) {
        return res.status(409).json({
          error: `Anda memiliki pengajuan ${activeLeave.status === 'sakit' ? 'sakit' : 'izin'} (${activeLeave.approvalStatus === 'approved' ? 'disetujui' : 'menunggu persetujuan'}) pada ${b.date}. Tidak dapat melakukan presensi masuk atau pulang saat izin aktif.`,
        });
      }

      // 2. Cek apakah sesi ini sudah pernah tercatat
      const [[dup]] = await pool.query(
        "SELECT id FROM attendances WHERE user_id=? AND date=? AND session_type=? LIMIT 1",
        [me.id, b.date, sessionType]
      );
      if (dup) {
        return res.status(409).json({
          error: `Presensi ${sessionType === 'masuk' ? 'masuk' : 'pulang'} pada ${b.date} sudah tersimpan. Tidak bisa absen dua kali.`,
        });
      }
    } else if (sessionType === 'izin_sakit') {
      const sDate = b.startDate || b.start_date || b.date;
      const eDate = b.endDate || b.end_date || b.date;

      // Fitur Overwrite: jika ada presensi masuk/pulang sebelumnya di rentang tanggal ini,
      // izin akan menimpa (overwrite) presensi tersebut.
      await pool.query(
        `DELETE FROM attendances 
         WHERE user_id=? AND session_type IN ('masuk', 'pulang') 
           AND date >= ? AND date <= ?`,
        [me.id, sDate, eDate]
      );

      // Timpa izin pending lama pada rentang tanggal yang sama agar tidak bentrok
      await pool.query(
        `DELETE FROM attendances 
         WHERE user_id=? AND session_type='izin_sakit' AND approval_status='pending' 
           AND start_date=? AND end_date=?`,
        [me.id, sDate, eDate]
      );
    }

    const [r] = await pool.query(
      `INSERT INTO attendances (user_id, user_name, user_email, type, session_type, status, date,
        clock_in_time, latitude, longitude, distance_meters, office_name, office_color, company_id,
        reason, start_date, end_date, photo_url, document_url, approval_status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        me.id, me.full_name, me.email, b.type, sessionType, b.status, b.date,
        toMySQLDatetime(b.clockInTime || b.clock_in_time),
        b.latitude ?? null, b.longitude ?? null, b.distanceMeters ?? b.distance_meters ?? null,
        b.officeName ?? b.office_name ?? null, b.officeColor ?? b.office_color ?? null, me.company_id ?? null,
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

// Review izin/sakit oleh admin (dikunci per PT, kecuali superadmin)
app.patch('/attendances/:id/review', authRequired, adminOnly, async (req, res) => {
  const { decision, note } = req.body || {};
  if (!['approved', 'rejected'].includes(decision)) {
    return res.status(400).json({ error: 'decision harus approved atau rejected.' });
  }
  if (req.auth.role !== 'superadmin') {
    const [[me]] = await pool.query('SELECT company_id FROM users WHERE id=?', [req.auth.id]);
    const [[att]] = await pool.query('SELECT company_id FROM attendances WHERE id=?', [req.params.id]);
    if (!att || att.company_id !== me.company_id) {
      return res.status(403).json({ error: 'Pengajuan ini milik PT lain.' });
    }
  }
  await pool.query('UPDATE attendances SET approval_status=?, reviewed_by=?, reviewed_at=NOW(), review_note=? WHERE id=?', [
    decision, req.auth.id, note || null, req.params.id,
  ]);
  const [[row]] = await pool.query('SELECT * FROM attendances WHERE id=?', [req.params.id]);
  const [[me]] = await pool.query('SELECT * FROM users WHERE id=?', [req.auth.id]);
  void logActivity(
    req.auth.id,
    me ? me.full_name : 'Admin',
    req.auth.role,
    row ? row.company_id : null,
    decision === 'approved' ? 'approve_leave' : 'reject_leave',
    `${decision === 'approved' ? 'Menyetujui' : 'Menolak'} pengajuan izin ${row ? row.user_name : ''}${note ? `: "${note}"` : ''}`
  );
  res.json({ attendance: publicAttendance(row) });
});

// ================= AUDIT LOGS (Superadmin & Admin Cabang) =================
app.get('/audit-logs', authRequired, adminOnly, async (req, res) => {
  try {
    const { companyId, isSuper } = await requesterCompany(req);
    let where = '';
    const args = [];
    if (!isSuper) {
      where = 'WHERE a.company_id=?';
      args.push(companyId);
    } else if (req.query.company_id) {
      where = 'WHERE a.company_id=?';
      args.push(Number(req.query.company_id));
    }
    const [rows] = await pool.query(
      `SELECT a.*, c.name AS company_name 
       FROM audit_logs a 
       LEFT JOIN companies c ON c.id=a.company_id 
       ${where} 
       ORDER BY a.id DESC LIMIT 100`,
      args
    );
    res.json({
      logs: rows.map((r) => ({
        id: String(r.id),
        userId: String(r.user_id),
        userName: r.user_name,
        userRole: r.user_role,
        companyId: r.company_id ? String(r.company_id) : null,
        companyName: r.company_name || null,
        action: r.action,
        description: r.description,
        createdAt: r.created_at,
      })),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
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
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const url = `${proto}://${host}/uploads/${req.params.kind}/${req.file.filename}`;
    res.status(201).json({ url });
  });
});

app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Terjadi kesalahan pada server.' });
});

app.listen(PORT, () => console.log(`epresensi-api jalan di http://localhost:${PORT}`));
