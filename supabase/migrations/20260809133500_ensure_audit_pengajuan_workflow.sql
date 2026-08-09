create extension if not exists pgcrypto;

create table if not exists public.audit_pengajuan (
  id uuid primary key default gen_random_uuid(),
  pengajuan_id uuid not null references public.pengajuan_surat(id) on delete cascade,
  petugas_id uuid references public.petugas(id),
  nama_petugas text,
  role text,
  tahap text,
  aksi text,
  status_sebelum text,
  status_sesudah text,
  catatan text,
  created_at timestamptz default now()
);

alter table public.audit_pengajuan add column if not exists pengajuan_id uuid references public.pengajuan_surat(id) on delete cascade;
alter table public.audit_pengajuan add column if not exists petugas_id uuid references public.petugas(id);
alter table public.audit_pengajuan add column if not exists nama_petugas text;
alter table public.audit_pengajuan add column if not exists role text;
alter table public.audit_pengajuan add column if not exists tahap text;
alter table public.audit_pengajuan add column if not exists aksi text;
alter table public.audit_pengajuan add column if not exists status_sebelum text;
alter table public.audit_pengajuan add column if not exists status_sesudah text;
alter table public.audit_pengajuan add column if not exists catatan text;
alter table public.audit_pengajuan add column if not exists created_at timestamptz default now();

-- Backward-compatible columns for older code paths that may still read/write them.
alter table public.audit_pengajuan add column if not exists user_id uuid references public.petugas(id);
alter table public.audit_pengajuan add column if not exists status text;
alter table public.audit_pengajuan add column if not exists action text;
alter table public.audit_pengajuan add column if not exists jabatan text;
alter table public.audit_pengajuan add column if not exists metadata jsonb default '{}'::jsonb;

update public.audit_pengajuan
set
  petugas_id = coalesce(petugas_id, user_id),
  aksi = coalesce(aksi, action),
  status_sesudah = coalesce(status_sesudah, status),
  role = coalesce(role, metadata->>'role')
where petugas_id is null
   or aksi is null
   or status_sesudah is null
   or role is null;

create index if not exists audit_pengajuan_pengajuan_id_idx on public.audit_pengajuan(pengajuan_id);
create index if not exists audit_pengajuan_petugas_id_idx on public.audit_pengajuan(petugas_id);
create index if not exists audit_pengajuan_user_id_idx on public.audit_pengajuan(user_id);
create index if not exists audit_pengajuan_created_at_idx on public.audit_pengajuan(created_at);
create index if not exists audit_pengajuan_status_sesudah_idx on public.audit_pengajuan(status_sesudah);
create index if not exists audit_pengajuan_tahap_idx on public.audit_pengajuan(tahap);

alter table public.audit_pengajuan enable row level security;

drop policy if exists "audit_pengajuan_no_anon_access" on public.audit_pengajuan;
create policy "audit_pengajuan_no_anon_access"
on public.audit_pengajuan
for all
to anon
using (false)
with check (false);

drop policy if exists "audit_pengajuan_authenticated_read" on public.audit_pengajuan;
create policy "audit_pengajuan_authenticated_read"
on public.audit_pengajuan
for select
to authenticated
using (true);

drop policy if exists "audit_pengajuan_authenticated_no_update" on public.audit_pengajuan;
create policy "audit_pengajuan_authenticated_no_update"
on public.audit_pengajuan
for update
to authenticated
using (false)
with check (false);

drop policy if exists "audit_pengajuan_authenticated_no_delete" on public.audit_pengajuan;
create policy "audit_pengajuan_authenticated_no_delete"
on public.audit_pengajuan
for delete
to authenticated
using (false);