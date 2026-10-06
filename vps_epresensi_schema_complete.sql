-- =====================================================================
-- E-PRESENSI FULL SCHEMA & SEED DATA (PROD / VPS OVERWRITE)
-- Database: epresensi | Engine: InnoDB | Charset: utf8mb4
-- Sudah termasuk: Multi-PT (companies), Multi-Titik (office_settings),
-- Role Superadmin, Approval Izin/Sakit, dan Trigger Anti-Double Absen.
-- =====================================================================

CREATE DATABASE IF NOT EXISTS epresensi
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE epresensi;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS attendances;
DROP TABLE IF EXISTS office_settings;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS departments;
DROP TABLE IF EXISTS companies;

SET FOREIGN_KEY_CHECKS = 1;

-- -----------------------------------------------------
-- 1. Tabel companies (Daftar PT / Entitas Usaha)
-- -----------------------------------------------------
CREATE TABLE companies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- 2. Tabel departments (Master Data Departemen)
-- -----------------------------------------------------
CREATE TABLE departments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- 3. Tabel users (Akun Karyawan, Admin, dan Superadmin)
-- -----------------------------------------------------
CREATE TABLE users (
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
  CONSTRAINT fk_users_company FOREIGN KEY (company_id)
    REFERENCES companies(id) ON DELETE SET NULL,
  CONSTRAINT fk_users_created_by FOREIGN KEY (created_by)
    REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_users_email (email),
  INDEX idx_users_company (company_id),
  INDEX idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- 4. Tabel office_settings (Geofence Titik Kantor)
-- -----------------------------------------------------
CREATE TABLE office_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  office_name VARCHAR(255) NOT NULL DEFAULT 'Kantor Utama',
  latitude DOUBLE NOT NULL DEFAULT -6.2088,
  longitude DOUBLE NOT NULL DEFAULT 106.8456,
  radius_meters INT NOT NULL DEFAULT 150,
  color VARCHAR(7) NOT NULL DEFAULT '#2196F3',
  company_id INT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_office_company FOREIGN KEY (company_id)
    REFERENCES companies(id) ON DELETE SET NULL,
  INDEX idx_office_company (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- 5. Tabel attendances (Data Presensi & Perizinan)
-- -----------------------------------------------------
CREATE TABLE attendances (
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
  CONSTRAINT fk_att_company FOREIGN KEY (company_id)
    REFERENCES companies(id) ON DELETE SET NULL,
  INDEX idx_att_user_date (user_id, date),
  INDEX idx_att_date (date),
  INDEX idx_att_approval (approval_status),
  INDEX idx_att_email (user_email),
  INDEX idx_att_company (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- 6. Tabel audit_logs (Activity Audit Trail)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  user_name VARCHAR(255) NOT NULL,
  user_role VARCHAR(50) NOT NULL,
  company_id INT NULL,
  action VARCHAR(100) NOT NULL,
  description TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_company (company_id),
  INDEX idx_audit_user (user_id),
  INDEX idx_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- 7. Trigger Anti-Double Absen
-- -----------------------------------------------------
DELIMITER $$

DROP TRIGGER IF EXISTS trg_no_dup_absen$$

CREATE TRIGGER trg_no_dup_absen
BEFORE INSERT ON attendances
FOR EACH ROW
BEGIN
  DECLARE v_count INT;

  -- Blokir double absen masuk atau pulang pada tanggal yang sama
  IF NEW.session_type IN ('masuk', 'pulang') THEN
    SELECT COUNT(*) INTO v_count
    FROM attendances
    WHERE user_id = NEW.user_id
      AND date = NEW.date
      AND session_type = NEW.session_type;
    IF v_count > 0 THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Presensi sesi ini pada tanggal ini sudah tersimpan. Tidak bisa absen dua kali.';
    END IF;

  -- Blokir double pengajuan izin/sakit berstatus pending pada rentang tanggal yang sama
  ELSEIF NEW.session_type = 'izin_sakit' AND NEW.approval_status = 'pending' THEN
    SELECT COUNT(*) INTO v_count
    FROM attendances
    WHERE user_id = NEW.user_id
      AND session_type = 'izin_sakit'
      AND approval_status = 'pending'
      AND NEW.start_date = start_date
      AND NEW.end_date = end_date;
    IF v_count > 0 THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Pengajuan izin/sakit untuk tanggal ini sudah menunggu persetujuan admin.';
    END IF;
  END IF;
END$$

DELIMITER ;

-- =====================================================
-- SEED DATA AWAL (DEFAULT SETUP)
-- =====================================================

-- 1. Perusahaan Default (ID 1)
INSERT INTO companies (id, name) VALUES (1, 'PT SKMI');

-- 2. Departemen Default
INSERT INTO departments (name) VALUES
  ('Sales'),
  ('IT'),
  ('Drafter'),
  ('Human Capital'),
  ('Marketing');

-- 3. Akun Pengguna Awal (Semua Password: '123456')
-- Hash bcrypt 10 rounds: $2a$10$uFuLQnv39f6v4fLUVRh4L.4WDGvPkasENgz6eVJ4V2BIP6GI3Vn9.
INSERT INTO users (
  id, email, password_hash, full_name, role, department, company_id
) VALUES
  (1, 'admin@admin.com', '$2a$10$uFuLQnv39f6v4fLUVRh4L.4WDGvPkasENgz6eVJ4V2BIP6GI3Vn9.', 'Super Admin E-Presensi', 'superadmin', 'Management', 1),
  (2, 'admin@admin', '$2a$10$uFuLQnv39f6v4fLUVRh4L.4WDGvPkasENgz6eVJ4V2BIP6GI3Vn9.', 'Super Admin (Alias)', 'superadmin', 'Management', 1),
  (3, 'neil@gmail.com', '$2a$10$uFuLQnv39f6v4fLUVRh4L.4WDGvPkasENgz6eVJ4V2BIP6GI3Vn9.', 'Neil', 'employee', 'IT', 1),
  (4, 'satya@gmail.com', '$2a$10$uFuLQnv39f6v4fLUVRh4L.4WDGvPkasENgz6eVJ4V2BIP6GI3Vn9.', 'Satya', 'employee', 'Drafter', 1),
  (5, 'gabby@gmail.com', '$2a$10$uFuLQnv39f6v4fLUVRh4L.4WDGvPkasENgz6eVJ4V2BIP6GI3Vn9.', 'Gabby', 'employee', 'Human Capital', 1);

-- 4. Titik Kantor Default (ID 1)
INSERT INTO office_settings (
  id, office_name, latitude, longitude, radius_meters, color, company_id
) VALUES (
  1,
  'Kantor Pusat SKMI',
  -6.2088,
  106.8456,
  150,
  '#2196F3',
  1
);
