-- Migrasi multi-PT (companies): tiap PT terpisah total (beda PT, bukan beda titik).
-- Aman dijalankan ulang (idempotent). DB: epresensi. MariaDB 10.4 compatible.
USE epresensi;

CREATE TABLE IF NOT EXISTS companies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT IGNORE INTO companies (name) VALUES ('PT SKMI');

ALTER TABLE users MODIFY role ENUM('superadmin','admin','employee') NOT NULL DEFAULT 'employee';

SET @has_uci = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA='epresensi' AND TABLE_NAME='users' AND COLUMN_NAME='company_id');
SET @sql_u = IF(@has_uci = 0, 'ALTER TABLE users ADD COLUMN company_id INT NULL', 'SELECT 1');
PREPARE s1 FROM @sql_u; EXECUTE s1; DEALLOCATE PREPARE s1;

SET @has_oci = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA='epresensi' AND TABLE_NAME='office_settings' AND COLUMN_NAME='company_id');
SET @sql_o = IF(@has_oci = 0, 'ALTER TABLE office_settings ADD COLUMN company_id INT NULL', 'SELECT 1');
PREPARE s2 FROM @sql_o; EXECUTE s2; DEALLOCATE PREPARE s2;

SET @has_aci = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA='epresensi' AND TABLE_NAME='attendances' AND COLUMN_NAME='company_id');
SET @sql_a = IF(@has_aci = 0, 'ALTER TABLE attendances ADD COLUMN company_id INT NULL', 'SELECT 1');
PREPARE s3 FROM @sql_a; EXECUTE s3; DEALLOCATE PREPARE s3;

-- Data lama (sebelum multi-PT) digabung ke PT pertama
UPDATE users SET company_id = (SELECT id FROM companies ORDER BY id LIMIT 1) WHERE company_id IS NULL;
UPDATE office_settings SET company_id = (SELECT id FROM companies ORDER BY id LIMIT 1) WHERE company_id IS NULL;
UPDATE attendances SET company_id = (SELECT id FROM companies ORDER BY id LIMIT 1) WHERE company_id IS NULL;
