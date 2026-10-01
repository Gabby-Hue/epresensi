-- ===================================================
-- E-PRESENSI MySQL/MariaDB SCHEMA (Laragon)
-- Mirror dari supabase_schema.sql + 3 migrasi
-- DB: epresensi | Charset: utf8mb4
-- Catatan: server Laragon kamu MariaDB 10.4, jadi
-- pakai ENUM (idiom MySQL) pengganti CHECK Supabase.
-- Password tidak bisa dimigrasi dari Supabase Auth,
-- semua user wajib reset password sekali via backend.
-- ===================================================

CREATE DATABASE IF NOT EXISTS epresensi
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE epresensi;

-- 1. Users (pengganti public.profiles + auth.users)
CREATE TABLE IF NOT EXISTS companies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL DEFAULT '',
  full_name VARCHAR(255) NOT NULL,
  role ENUM('superadmin','admin','employee') NOT NULL DEFAULT 'employee',
  department VARCHAR(100) NOT NULL DEFAULT 'General',
  company_id INT NULL,
  avatar_url TEXT NULL,
  phone_number VARCHAR(30) NULL,
  device_model VARCHAR(100) NULL,
  device_id VARCHAR(100) NULL,
  created_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_created_by FOREIGN KEY (created_by)
    REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 2. Office settings (multi-titik + warna)
CREATE TABLE IF NOT EXISTS office_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  office_name VARCHAR(255) NOT NULL DEFAULT 'Kantor Utama',
  latitude DOUBLE NOT NULL DEFAULT -6.2088,
  longitude DOUBLE NOT NULL DEFAULT 106.8456,
  radius_meters INT NOT NULL DEFAULT 150,
  color VARCHAR(7) NOT NULL DEFAULT '#2196F3',
  company_id INT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 3. Attendances (clock-in/out + izin/sakit + approval)
CREATE TABLE IF NOT EXISTS attendances (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  user_name VARCHAR(255) NOT NULL,
  user_email VARCHAR(255) NOT NULL,
  type ENUM('luring','daring','izin_sakit') NOT NULL,
  session_type ENUM('masuk','pulang','izin_sakit') NOT NULL DEFAULT 'masuk',
  status ENUM('hadir','izin','sakit') NOT NULL,
  date DATE NOT NULL,
  clock_in_time TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  latitude DOUBLE NULL,
  longitude DOUBLE NULL,
  distance_meters INT NULL,
  office_name VARCHAR(255) NULL,
  office_color VARCHAR(7) NULL,
  reason TEXT NULL,
  start_date DATE NULL,
  end_date DATE NULL,
  photo_url TEXT NULL,
  document_url TEXT NULL,
  approval_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'approved',
  reviewed_by INT NULL,
  reviewed_at TIMESTAMP NULL,
  review_note TEXT NULL,
  company_id INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_att_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_att_reviewer FOREIGN KEY (reviewed_by)
    REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_att_user_date (user_id, date),
  INDEX idx_att_date (date),
  INDEX idx_att_approval (approval_status),
  INDEX idx_att_email (user_email)
) ENGINE=InnoDB;

-- 4. Departments (master data departemen)
CREATE TABLE IF NOT EXISTS departments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Data awal departemen
INSERT IGNORE INTO departments (name) VALUES
  ('Sales'), ('IT'), ('Drafter'), ('Human Capital'), ('Marketing');

-- Data awal: 1 titik kantor default (id 1)
INSERT INTO office_settings (office_name, latitude, longitude, radius_meters, color)
SELECT 'Kantor Utama', -6.2088, 106.8456, 150, '#2196F3'
WHERE NOT EXISTS (SELECT 1 FROM office_settings);
