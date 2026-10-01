const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role, company_id: user.company_id || null }, SECRET, { expiresIn: '30d' });
}

function authRequired(req, res, next) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token tidak ditemukan. Silakan login ulang.' });
  }
  try {
    req.auth = jwt.verify(h.slice(7), SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Sesi kedaluwarsa. Silakan login ulang.' });
  }
}

function adminOnly(req, res, next) {
  if (req.auth && (req.auth.role === 'admin' || req.auth.role === 'superadmin')) return next();
  return res.status(403).json({ error: 'Hanya admin yang boleh melakukan ini.' });
}

function superOnly(req, res, next) {
  if (req.auth && req.auth.role === 'superadmin') return next();
  return res.status(403).json({ error: 'Hanya superadmin yang boleh melakukan ini.' });
}

function hashPassword(pw) {
  return bcrypt.hash(pw, 10);
}

function verifyPassword(pw, hash) {
  if (!pw || !hash) return Promise.resolve(false);
  return bcrypt.compare(pw, hash);
}

// Baris users (snake_case DB) -> profil camelCase (samakan dgn tipe frontend)
function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    department: row.department,
    companyId: row.company_id ?? null,
    companyName: row.company_name ?? undefined,
    avatarUrl: row.avatar_url || undefined,
    phoneNumber: row.phone_number || undefined,
    deviceModel: row.device_model || undefined,
    deviceId: row.device_id || undefined,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

// Baris attendances (snake_case DB) -> AttendanceRecord camelCase frontend
function publicAttendance(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    userEmail: row.user_email,
    type: row.type,
    sessionType: row.session_type,
    status: row.status,
    date: row.date,
    clockInTime: row.clock_in_time,
    latitude: row.latitude,
    longitude: row.longitude,
    distanceMeters: row.distance_meters,
    officeName: row.office_name,
    officeColor: row.office_color,
    reason: row.reason,
    startDate: row.start_date,
    endDate: row.end_date,
    photoUrl: row.photo_url,
    documentUrl: row.document_url,
    createdAt: row.created_at,
    approvalStatus: row.approval_status,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    reviewNote: row.review_note,
    companyId: row.company_id ?? null,
  };
}

function publicOffice(row) {
  if (!row) return null;
  return {
    id: row.id,
    officeName: row.office_name,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    radiusMeters: Number(row.radius_meters),
    color: row.color,
    companyId: row.company_id ?? null,
    updatedAt: row.updated_at,
  };
}

module.exports = {
  signToken,
  authRequired,
  adminOnly,
  superOnly,
  hashPassword,
  verifyPassword,
  publicUser,
  publicAttendance,
  publicOffice,
};
