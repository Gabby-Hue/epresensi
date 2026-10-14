# Panduan Deploy Backend E-Presensi di VPS (Ubuntu / Debian)

Folder ini berisi seluruh source code backend Express, konfigurasi PM2, dan file database `schema.sql` yang siap di-upload ke server VPS.

---

## 1. Persiapan Server VPS

Pastikan di VPS sudah terpasang:
- **Node.js** (v18 ke atas / v20 LTS disarankan)
- **MySQL** atau **MariaDB Server**
- **Nginx** (Reverse Proxy)
- **PM2** (`npm install -g pm2`)

---

## 2. Setup Database MySQL di VPS

1. Masuk ke terminal MySQL VPS:
   ```bash
   sudo mysql -u root -p
   ```
2. Buat database `epresensi` jika belum ada:
   ```sql
   CREATE DATABASE IF NOT EXISTS epresensi CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   EXIT;
   ```
3. Import file `schema.sql`:
   ```bash
   mysql -u root -p epresensi < schema.sql
   ```
4. **Akun Superadmin Awal:**
   - **Email:** `admin@admin`
   - **Kata Sandi:** `123456`
   *(Sudah bersih, tanpa alias admin@admin.com)*

---

## 3. Konfigurasi Environment (.env)

Salin `.env.example` menjadi `.env`:
```bash
cp .env.example .env
nano .env
```
Isi konfigurasi berikut:
```env
PORT=3001
DB_HOST=127.0.0.1
DB_USER=root
DB_PASSWORD=password_mysql_kamu
DB_NAME=epresensi
JWT_SECRET=rahasia_jwt_produksi_kamu_yang_panjang_dan_acak
```

---

## 4. Install Dependencies & Jalankan dengan PM2

1. Install modul:
   ```bash
   npm install --production
   ```
2. Pastikan folder uploads memiliki izin tulis:
   ```bash
   mkdir -p uploads/photo uploads/document uploads/avatar
   chmod -R 775 uploads
   ```
3. Jalankan aplikasi menggunakan PM2:
   ```bash
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup
   ```
4. Cek status liveness backend:
   ```bash
   curl http://localhost:3001/health
   # Respon yang benar: {"ok":true,"db":true}
   ```

---

## 5. Konfigurasi Nginx & HTTPS (Domain VPS)

1. Buat file konfigurasi Nginx:
   ```bash
   sudo nano /etc/nginx/sites-available/epresensi-api
   ```
2. Masukkan konfigurasi berikut (ganti `api-epresensi.namadomain.com` dengan domain Anda):
   ```nginx
   server {
       server_name api-epresensi.namadomain.com;

       client_max_body_size 25M;

       location / {
           proxy_pass http://127.0.0.1:3001;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```
3. Aktifkan dan reload Nginx:
   ```bash
   sudo ln -s /etc/nginx/sites-available/epresensi-api /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```
4. Pasang SSL gratis dengan Certbot:
   ```bash
   sudo apt install certbot python3-certbot-nginx -y
   sudo certbot --nginx -d api-epresensi.namadomain.com
   ```
5. Ubah URL API di Frontend Expo/Vercel:
   Set `EXPO_PUBLIC_API_URL=https://api-epresensi.namadomain.com`
