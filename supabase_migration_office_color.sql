-- ===================================================
-- MIGRASI WARNA TITIK KANTOR (jalankan sekali di Supabase SQL Editor)
-- Tiap titik punya warna sendiri; warna ikut tersimpan
-- di baris presensi supaya ketahuan absen di mana.
-- ===================================================

ALTER TABLE public.office_settings
  ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#2196F3';

UPDATE public.office_settings
SET color = '#2196F3'
WHERE color IS NULL OR color = '';

ALTER TABLE public.attendances
  ADD COLUMN IF NOT EXISTS office_color TEXT;
