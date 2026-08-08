create extension if not exists pgcrypto;

alter table public.petugas
add column if not exists updated_at timestamptz default now();

create table if not exists public.verifikasi_pengajuan (
  id uuid primary key default gen_random_uuid(),
  pengajuan_id uuid not null references public.pengajuan_surat(id) on delete cascade,
  tahap integer not null,
  nama_tahap varchar not null,
  role_petugas varchar not null,
  status varchar not null default 'Menunggu',
  petugas_id uuid references public.petugas(id),
  catatan text,
  created_at timestamptz default now(),
  acted_at timestamptz,
  constraint verifikasi_pengajuan_unique_tahap unique (pengajuan_id, tahap),
  constraint verifikasi_pengajuan_status_check check (status in ('Menunggu', 'Disetujui', 'Ditolak')),
  constraint verifikasi_pengajuan_role_check check (role_petugas in ('staff_pelayanan', 'petugas_lapangan', 'kepala_seksi', 'seklur', 'lurah'))
);

create index if not exists verifikasi_pengajuan_pengajuan_id_idx on public.verifikasi_pengajuan(pengajuan_id);
create index if not exists verifikasi_pengajuan_role_status_idx on public.verifikasi_pengajuan(role_petugas, status);