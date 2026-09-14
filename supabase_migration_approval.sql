-- ===================================================
-- MIGRASI PERSETUJUAN IZIN (jalankan sekali di Supabase SQL Editor)
-- Pengajuan izin/sakit karyawan masuk sebagai "pending"
-- sampai disetujui/ditolak admin.
-- ===================================================

ALTER TABLE public.attendances
  ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'approved'
    CHECK (approval_status IN ('pending', 'approved', 'rejected'));

ALTER TABLE public.attendances
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.attendances
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.attendances
  ADD COLUMN IF NOT EXISTS review_note TEXT;

-- Data lama: semua pengajuan izin/sakit yang sudah tercatat dianggap disetujui
UPDATE public.attendances
SET approval_status = 'approved'
WHERE approval_status IS NULL OR approval_status = '';

-- Absen masuk/pulang biasa selalu approved (tidak butuh persetujuan)
UPDATE public.attendances
SET approval_status = 'approved'
WHERE session_type IN ('masuk', 'pulang');
