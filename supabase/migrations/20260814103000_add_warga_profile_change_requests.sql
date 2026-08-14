-- Data change requests submitted by warga from /dashboard/profil.
create table if not exists public.warga_profile_change_requests (
  id uuid primary key default gen_random_uuid(),
  change_request_id uuid generated always as (id) stored,
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null references public.warga_profiles(id) on delete cascade,
  jenis_perubahan text not null,
  data_lama text,
  data_baru text not null,
  alasan text not null,
  dokumen_pendukung text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  alasan_petugas text,
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  verified_by uuid
);

create index if not exists warga_profile_change_requests_user_id_idx on public.warga_profile_change_requests(user_id);
create index if not exists warga_profile_change_requests_profile_id_idx on public.warga_profile_change_requests(profile_id);
create index if not exists warga_profile_change_requests_status_idx on public.warga_profile_change_requests(status);

alter table public.warga_profile_change_requests enable row level security;

drop policy if exists "warga_change_requests_select_own" on public.warga_profile_change_requests;
create policy "warga_change_requests_select_own"
on public.warga_profile_change_requests
for select
using (auth.uid() = user_id);

drop policy if exists "warga_change_requests_insert_own" on public.warga_profile_change_requests;
create policy "warga_change_requests_insert_own"
on public.warga_profile_change_requests
for insert
with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('profile-change-documents', 'profile-change-documents', false)
on conflict (id) do nothing;

drop policy if exists "profile_change_documents_select_own" on storage.objects;
create policy "profile_change_documents_select_own"
on storage.objects
for select
using (
  bucket_id = 'profile-change-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "profile_change_documents_insert_own" on storage.objects;
create policy "profile_change_documents_insert_own"
on storage.objects
for insert
with check (
  bucket_id = 'profile-change-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);