-- ===================================================
-- E-PRESENSI PRO - FULL PERMISSIVE SUPABASE SCHEMA
-- ===================================================

-- 1. Create Profiles Table (Users & Admin)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'employee')) DEFAULT 'employee',
  department TEXT DEFAULT 'General',
  avatar_url TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Permissive RLS Policies for Profiles
DROP POLICY IF EXISTS "Profiles select policy" ON public.profiles;
CREATE POLICY "Profiles select policy" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Profiles insert policy" ON public.profiles;
CREATE POLICY "Profiles insert policy" ON public.profiles FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Profiles update policy" ON public.profiles;
CREATE POLICY "Profiles update policy" ON public.profiles FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Profiles delete policy" ON public.profiles;
CREATE POLICY "Profiles delete policy" ON public.profiles FOR DELETE USING (true);

-- 2. Create Office Settings Table (Geofence Location & Radius)
CREATE TABLE IF NOT EXISTS public.office_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_name TEXT NOT NULL DEFAULT 'Kantor Utama',
  latitude DOUBLE PRECISION NOT NULL DEFAULT -6.2088,
  longitude DOUBLE PRECISION NOT NULL DEFAULT 106.8456,
  radius_meters INTEGER NOT NULL DEFAULT 150,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.office_settings ENABLE ROW LEVEL SECURITY;

-- Permissive RLS Policies for Office Settings
DROP POLICY IF EXISTS "Office settings select policy" ON public.office_settings;
CREATE POLICY "Office settings select policy" ON public.office_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Office settings insert policy" ON public.office_settings;
CREATE POLICY "Office settings insert policy" ON public.office_settings FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Office settings update policy" ON public.office_settings;
CREATE POLICY "Office settings update policy" ON public.office_settings FOR UPDATE USING (true);

-- Insert Default Fixed Office Setting Row
INSERT INTO public.office_settings (id, office_name, latitude, longitude, radius_meters)
VALUES ('00000000-0000-0000-0000-000000000001', 'Kantor Utama', -6.2088, 106.8456, 150)
ON CONFLICT (id) DO UPDATE SET
  office_name = EXCLUDED.office_name;

-- 3. Create Attendances Table (Clock-in / Clock-out & Leaves)
CREATE TABLE IF NOT EXISTS public.attendances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('luring', 'daring', 'izin_sakit')),
  session_type TEXT NOT NULL DEFAULT 'masuk' CHECK (session_type IN ('masuk', 'pulang', 'izin_sakit')),
  status TEXT NOT NULL CHECK (status IN ('hadir', 'izin', 'sakit')),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  clock_in_time TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  distance_meters INTEGER,
  reason TEXT,
  start_date DATE,
  end_date DATE,
  photo_url TEXT,
  document_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;

-- Permissive RLS Policies for Attendances
DROP POLICY IF EXISTS "Attendances select policy" ON public.attendances;
CREATE POLICY "Attendances select policy" ON public.attendances FOR SELECT USING (true);

DROP POLICY IF EXISTS "Attendances insert policy" ON public.attendances;
CREATE POLICY "Attendances insert policy" ON public.attendances FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Attendances update policy" ON public.attendances;
CREATE POLICY "Attendances update policy" ON public.attendances FOR UPDATE USING (true);

-- Grant Access Roles
GRANT ALL ON TABLE public.profiles TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.office_settings TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.attendances TO anon, authenticated, service_role;

-- ===================================================
-- 4. Storage Buckets (foto presensi, dokumen izin, avatar)
-- WAJIB dijalankan supaya upload foto tidak gagal "Bucket not found".
-- ===================================================
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('attendance-photos', 'attendance-photos', true),
  ('attendance-docs', 'attendance-docs', true),
  ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- Permissive Storage Policies (baca publik, upload/update/delete bebas)
DROP POLICY IF EXISTS "Public read" ON storage.objects;
CREATE POLICY "Public read" ON storage.objects FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow upload" ON storage.objects;
CREATE POLICY "Allow upload" ON storage.objects FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update" ON storage.objects;
CREATE POLICY "Allow update" ON storage.objects FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow delete" ON storage.objects;
CREATE POLICY "Allow delete" ON storage.objects FOR DELETE USING (true);
