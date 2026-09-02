-- Apply with Supabase CLI. Client uses only the anon/publishable key; never service_role.
create extension if not exists pgcrypto;

create type public.user_role as enum ('admin', 'user');
create type public.attendance_type as enum ('LURING', 'DARING');
create type public.approval_status as enum ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED');

create table public.profiles (
  id uuid primary key default gen_random_uuid(), auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  employee_id text not null unique, full_name text not null, email text not null, role public.user_role not null default 'user',
  avatar_url text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.attendance_areas (
 id uuid primary key default gen_random_uuid(), name text not null, latitude double precision not null check (latitude between -90 and 90),
 longitude double precision not null check (longitude between -180 and 180), radius_meter integer not null check(radius_meter > 0),
 is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.attendance (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id), attendance_date date not null,
 attendance_type public.attendance_type not null, check_in timestamptz, check_out timestamptz,
 check_in_latitude double precision, check_in_longitude double precision, check_out_latitude double precision, check_out_longitude double precision,
 check_in_address text, check_out_address text, check_in_photo_path text, check_out_photo_path text, online_reason text,
 approval_status public.approval_status not null, area_id uuid references public.attendance_areas(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(user_id, attendance_date), check(check_out is null or check_in is not null),
 check((attendance_type = 'DARING' and nullif(trim(coalesce(online_reason,'')), '') is not null and approval_status = 'PENDING') or
       (attendance_type = 'LURING' and online_reason is null and approval_status = 'NOT_REQUIRED'))
);
create index attendance_date_idx on public.attendance(attendance_date desc);
create index attendance_user_date_idx on public.attendance(user_id, attendance_date desc);

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles where auth_user_id=auth.uid() and role='admin')
$$;
create or replace function public.current_profile_id() returns uuid language sql stable security definer set search_path=public as $$
 select id from public.profiles where auth_user_id=auth.uid()
$$;
create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger areas_updated before update on public.attendance_areas for each row execute function public.set_updated_at();
create trigger attendance_updated before update on public.attendance for each row execute function public.set_updated_at();

-- Security-definer RPC keeps client from supplying another user's ID and rechecks LURING radius in PostgreSQL.
create or replace function public.check_in_attendance(p_type public.attendance_type, p_lat double precision, p_lng double precision, p_address text, p_reason text, p_area_id uuid, p_photo_path text, p_attendance_id uuid)
returns public.attendance language plpgsql security definer set search_path=public as $$
declare v_profile uuid:=public.current_profile_id(); v_area public.attendance_areas; v_distance double precision; v_result public.attendance;
begin
 if v_profile is null then raise exception 'Unauthorized'; end if;
 if p_attendance_id is null or p_photo_path <> v_profile::text || '/' || p_attendance_id::text || '/check-in.jpg' then raise exception 'Invalid photo path'; end if;
 if p_type='DARING' and nullif(trim(coalesce(p_reason,'')), '') is null then raise exception 'Alasan presensi daring wajib diisi.'; end if;
 if p_type='LURING' then
  if p_lat is null or p_lng is null or p_area_id is null then raise exception 'Lokasi dan area aktif diperlukan.'; end if;
  select * into v_area from public.attendance_areas where id=p_area_id and is_active; if not found then raise exception 'Area tidak aktif.'; end if;
  v_distance:=6371000*2*asin(sqrt(power(sin(radians(p_lat-v_area.latitude)/2),2)+cos(radians(v_area.latitude))*cos(radians(p_lat))*power(sin(radians(p_lng-v_area.longitude)/2),2)));
  if v_distance>v_area.radius_meter then raise exception 'Anda berada di luar area presensi.'; end if;
 end if;
 insert into public.attendance(id,user_id,attendance_date,attendance_type,check_in,check_in_latitude,check_in_longitude,check_in_address,check_in_photo_path,online_reason,approval_status,area_id)
 values(p_attendance_id,v_profile,current_date,p_type,now(),p_lat,p_lng,p_address,p_photo_path,case when p_type='DARING' then trim(p_reason) end,case when p_type='DARING' then 'PENDING' else 'NOT_REQUIRED' end,case when p_type='LURING' then p_area_id end) returning * into v_result; return v_result;
end $$;
create or replace function public.check_out_attendance(p_lat double precision, p_lng double precision, p_address text, p_photo_path text)
returns public.attendance language plpgsql security definer set search_path=public as $$
declare v_profile uuid:=public.current_profile_id(); v_row public.attendance; v_area public.attendance_areas; v_distance double precision;
begin
 select * into v_row from public.attendance where user_id=v_profile and attendance_date=current_date for update;
 if not found or v_row.check_in is null then raise exception 'Check-out sebelum check-in tidak diizinkan.'; end if;
 if v_row.check_out is not null then raise exception 'Anda sudah melakukan presensi keluar hari ini.'; end if;
 if p_photo_path <> v_profile::text || '/' || v_row.id::text || '/check-out.jpg' then raise exception 'Invalid photo path'; end if;
 if v_row.attendance_type='LURING' then
  if p_lat is null or p_lng is null then raise exception 'Lokasi diperlukan untuk presensi luring.'; end if;
  select * into v_area from public.attendance_areas where id=v_row.area_id and is_active; if not found then raise exception 'Area tidak aktif.'; end if;
  v_distance:=6371000*2*asin(sqrt(power(sin(radians(p_lat-v_area.latitude)/2),2)+cos(radians(v_area.latitude))*cos(radians(p_lat))*power(sin(radians(p_lng-v_area.longitude)/2),2))); if v_distance>v_area.radius_meter then raise exception 'Anda berada di luar area presensi.'; end if;
 end if;
 update public.attendance set check_out=now(),check_out_latitude=p_lat,check_out_longitude=p_lng,check_out_address=p_address,check_out_photo_path=p_photo_path where id=v_row.id returning * into v_row; return v_row;
end $$;

alter table public.profiles enable row level security; alter table public.attendance enable row level security; alter table public.attendance_areas enable row level security;
create policy "profiles own or admin read" on public.profiles for select using(auth_user_id=auth.uid() or public.is_admin());
create policy "admin manages areas" on public.attendance_areas for all using(public.is_admin()) with check(public.is_admin());
create policy "authenticated sees active areas" on public.attendance_areas for select using(is_active or public.is_admin());
create policy "attendance own or admin read" on public.attendance for select using(user_id=public.current_profile_id() or public.is_admin());
create policy "admin approves attendance" on public.attendance for update using(public.is_admin()) with check(public.is_admin());
revoke update on public.attendance from authenticated;
grant update(approval_status) on public.attendance to authenticated;
-- No direct employee insert/update policy: all attendance writes go through RPC above.

insert into storage.buckets(id,name,public) values('attendance-photos','attendance-photos',false) on conflict(id) do nothing;
create policy "photo owner or admin read" on storage.objects for select using(bucket_id='attendance-photos' and (public.is_admin() or (storage.foldername(name))[1]=public.current_profile_id()::text));
create policy "photo owner uploads" on storage.objects for insert with check(bucket_id='attendance-photos' and (storage.foldername(name))[1]=public.current_profile_id()::text);
create policy "photo owner deletes" on storage.objects for delete using(bucket_id='attendance-photos' and (storage.foldername(name))[1]=public.current_profile_id()::text);
