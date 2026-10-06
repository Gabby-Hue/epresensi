-- Trigger: block duplicate absen (masuk/pulang) at the DATABASE layer.
-- Guarantees "cannot double absen" regardless of client, race condition, or direct SQL.
-- Mirrors existing app-level guard in server/src/index.js (POST /attendances).
-- Run on: D:/Laragon/bin/mysql/mysql-8.4.3-winx64/bin/mysql.exe -u root epresensi

DELIMITER $$

DROP TRIGGER IF EXISTS trg_no_dup_absen$$

CREATE TRIGGER trg_no_dup_absen
BEFORE INSERT ON attendances
FOR EACH ROW
BEGIN
  DECLARE v_count INT;

  -- Masuk / Pulang: at most ONE per (user, date, session_type)
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

  -- Izin/sakit: only block duplicate PENDING submissions for the same date range
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