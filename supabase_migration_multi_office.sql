-- ===================================================
-- MIGRASI MULTI-TITIK KANTOR (jalankan sekali di Supabase SQL Editor)
-- ===================================================

-- 1. Nama kantor tercatat di tiap baris presensi
ALTER TABLE public.attendances
  ADD COLUMN IF NOT EXISTS office_name TEXT;

-- 2. Admin boleh hapus titik kantor (sebelumnya hanya select/insert/update)
DROP POLICY IF EXISTS "Office settings delete policy" ON public.office_settings;
CREATE POLICY "Office settings delete policy" ON public.office_settings FOR DELETE USING (true);

-- 3. Backfill: presensi kantor lama yang office_name masih NULL pakai nama titik terbaru
UPDATE public.attendances a
SET office_name = (
  SELECT o.office_name FROM public.office_settings o ORDER BY o.updated_at DESC LIMIT 1
)
WHERE a.office_name IS NULL AND a.type = 'luring';
