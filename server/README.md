# E-Presensi API - Backend Service

REST API Backend untuk aplikasi E-Presensi (Expo Mobile/Web) berbasis Node.js Express dan MySQL/MariaDB.

---

## 1. System Requirements (Prasyarat Sistem)

### Lingkungan Server / Hosting (VPS):
- **Operating System:** Linux (Ubuntu 20.04/22.04 LTS direkomendasikan) atau Windows Server
- **Node.js:** Versi 18.x LTS atau lebih baru (v20.x direkomendasikan)
- **NPM:** Versi 9.x atau lebih baru
- **Database:** MySQL 8.0+ atau MariaDB 10.4+
- **Process Manager:** PM2 (untuk menjaga service tetap hidup di latar belakang)
- **Web Server / Reverse Proxy:** Nginx (untuk SSL/HTTPS dan forwarding port 3001)
- **Spesifikasi Minimal VPS:** 1 vCPU, 1 GB RAM, 20 GB SSD Storage (disesuaikan dengan estimasi jumlah upload foto absensi)

### Lingkungan Lokal (Pengembangan):
- Laragon atau XAMPP (dengan servis MySQL aktif)
- Node.js LTS terinstal di komputer

---

## 2. Arsitektur Sistem & Deployment (VPS + cPanel + Mobile APK)

Aplikasi E-Presensi menggunakan arsitektur hybrid yang memisahkan frontend dan backend secara independen:

```
[ Karyawan: Mobile APK Android ] ──┐
                                   ├──> [ HTTPS: api.domain-vps.com ]
[ Admin/User: Web di cPanel ]    ──┘           │
  (File HTML/JS/CSS statis di public_html)     ▼
                                     ┌─────────────────────────────┐
                                     │        SERVER VPS           │
                                     │ ─────────────────────────── │
                                     │ 1. Nginx Reverse Proxy      │
                                     │ 2. Express API (Port 3001)  │
                                     │ 3. Storage Folder (uploads) │
                                     │ 4. Database MySQL           │
                                     └─────────────────────────────┘
```

### Mengapa File Fisik di Folder `uploads/` dan URL di MySQL?
- **Folder `uploads/avatar/`:** Menyimpan foto profil akun pengguna.
- **Folder `uploads/photo/`:** Menyimpan foto selfie bukti absensi masuk/pulang saat verifikasi wajah.
- **Folder `uploads/document/`:** Menyimpan dokumen/surat izin atau surat dokter (JPG/PNG/PDF).
- **Di Database MySQL:** Hanya menyimpan alamat URL-nya (kolom `photo_url`, `document_url`, `avatar_url`).
- **Alasan Teknis:** Menyimpan file fisik gambar di disk dan hanya menyimpan string URL di database merupakan best practice agar database MySQL tetap ringan, performa query cepat, penggunaan RAM hemat, dan proses backup database harian berukuran kecil.

---

## 3. Langkah Menjalankan di Lokal (Local Development)

1. **Siapkan Database MySQL:**
   - Buka Laragon atau XAMPP, pastikan modul MySQL aktif.
   - Buat database baru bernama `epresensi`.
   - Impor file `mysql_schema.sql` ke dalam database `epresensi`.

2. **Konfigurasi Environment:**
   - Salin file `.env.example` menjadi `.env`.
   - Sesuaikan konfigurasi koneksi:
     ```env
     PORT=3001
     DB_HOST=127.0.0.1
     DB_USER=root
     DB_PASSWORD=
     DB_NAME=epresensi
     JWT_SECRET=rahasia-jwt-lokal-bebas-diubah
     ```

3. **Install Dependensi & Jalankan:**
   ```bash
   npm install
   npm start
   ```

4. **Uji Coba Service:**
   - Root URL: `http://localhost:3001/` -> mengembalikan status running
   - Health Check: `http://localhost:3001/health` -> `{"ok": true, "db": true}`

---

## 4. Panduan Deployment Production (VPS + cPanel)

### A. Konfigurasi Backend di VPS
1. Upload folder backend (kecuali `node_modules`) ke VPS (misal di `/var/www/epresensi-api`).
2. Jalankan `npm install --production`.
3. Buat database di MySQL VPS dan impor `mysql_schema.sql`.
4. Buat file `.env` di VPS dengan `JWT_SECRET` yang kuat dan kredensial database VPS.
5. Jalankan aplikasi menggunakan PM2:
   ```bash
   pm2 start src/index.js --name epresensi-api
   pm2 save
   pm2 startup
   ```
6. Konfigurasikan Nginx sebagai reverse proxy ke `http://127.0.0.1:3001` dan pasang sertifikat SSL (Let's Encrypt / Certbot).

### B. Konfigurasi Frontend di cPanel
1. Di proyek frontend Expo (`D:/Magang/absen/epresensi`), ubah file `.env`:
   ```env
   EXPO_PUBLIC_API_URL=https://api.domain-vps-kamu.com
   ```
2. Build frontend web statis:
   ```bash
   npx expo export --platform web
   ```
3. Upload seluruh isi folder `dist/` hasil build ke dalam direktori `public_html` di cPanel.
4. Frontend di cPanel dan APK di HP sekarang terhubung langsung ke backend VPS.

---

## 5. Ringkasan Endpoint API

### Health & Info
- `GET /` : Informasi status API berjalan
- `GET /health` : Status kesehatan server dan koneksi database MySQL

### Autentikasi (`/auth`)
- `POST /auth/register` : Pendaftaran akun. Pendaftaran akun pertama otomatis menjadi Admin. Pendaftaran berikutnya wajib menggunakan token Admin.
- `POST /auth/login` : Login akun (email & password). Mendukung binding device ID & model. Mengembalikan token JWT.

### Pengguna (`/users` & `/me`)
- `GET /me` : Mengambil profil pengguna yang sedang login.
- `GET /users?role=employee` : (Admin) Melihat daftar semua karyawan.
- `PATCH /users/:id` : (Admin) Mengubah data karyawan (nama, departemen, role, dsb).
- `PATCH /users/:id/reset-device` : (Admin) Mereset binding perangkat pengguna.
- `DELETE /users/:id` : (Admin) Menghapus akun pengguna.

### Kantor & Geofence (`/offices`)
- `GET /offices` : Mengambil daftar titik lokasi kantor (koordinat latitude, longitude, radius batas presensi).
- `POST /offices` : (Admin) Menambahkan titik lokasi kantor baru.
- `PATCH /offices/:id` : (Admin) Memperbarui data lokasi atau radius kantor.
- `DELETE /offices/:id` : (Admin) Menghapus titik lokasi kantor.

### Presensi & Izin (`/attendances`)
- `GET /attendances?user_id=&month=YYYY-MM&approval=pending` : Mengambil riwayat absensi bulanan. Karyawan hanya bisa melihat miliknya sendiri, Admin dapat melihat seluruhnya atau memfilter per karyawan.
- `POST /attendances` : Mencatat absensi (clock-in/clock-out) atau permohonan izin/sakit. (Izin/sakit otomatis berstatus pending approval).
- `PATCH /attendances/:id/review` : (Admin) Menyetujui (approve) atau menolak (reject) pengajuan izin karyawan.

### File Upload (`/upload`)
- `POST /upload/:kind` : Upload file (multipart/form-data field `file`). Parameter `kind`: `avatar`, `photo`, atau `document`. Mengembalikan `{ "url": "https://domain/uploads/:kind/filename.jpg" }`.
- Static File Serving: Tersedia publik di `/uploads/avatar/*`, `/uploads/photo/*`, dan `/uploads/document/*`.
