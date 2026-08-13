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
  user_id uuid references public.petugas(id),
  nama_petugas varchar,
  jabatan varchar,
  catatan text,
  hasil_verifikasi text,
  dokumentasi_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  acted_at timestamptz,
  approved_at timestamptz,
  constraint verifikasi_pengajuan_unique_tahap unique (pengajuan_id, tahap),
  constraint verifikasi_pengajuan_status_check check (status in ('Menunggu', 'Diproses', 'Disetujui', 'Ditolak')),
  constraint verifikasi_pengajuan_role_check check (role_petugas in ('staff_pelayanan', 'petugas_lapangan', 'kepala_seksi', 'seklur', 'lurah'))
);

alter table public.verifikasi_pengajuan drop constraint if exists verifikasi_pengajuan_status_check;
alter table public.verifikasi_pengajuan
  add constraint verifikasi_pengajuan_status_check check (status in ('Menunggu', 'Diproses', 'Disetujui', 'Ditolak'));

create index if not exists verifikasi_pengajuan_pengajuan_id_idx on public.verifikasi_pengajuan(pengajuan_id);
create index if not exists verifikasi_pengajuan_role_status_idx on public.verifikasi_pengajuan(role_petugas, status);

alter table public.verifikasi_pengajuan add column if not exists user_id uuid references public.petugas(id);
alter table public.verifikasi_pengajuan add column if not exists nama_petugas varchar;
alter table public.verifikasi_pengajuan add column if not exists jabatan varchar;
alter table public.verifikasi_pengajuan add column if not exists hasil_verifikasi text;
alter table public.verifikasi_pengajuan add column if not exists dokumentasi_url text;
alter table public.verifikasi_pengajuan add column if not exists updated_at timestamptz default now();
alter table public.verifikasi_pengajuan add column if not exists approved_at timestamptz;

alter table public.pengajuan_surat add column if not exists workflow_status varchar;
alter table public.pengajuan_surat add column if not exists validated_by uuid references public.petugas(id);
alter table public.pengajuan_surat add column if not exists validated_at timestamptz;
alter table public.pengajuan_surat add column if not exists lurah_id uuid references public.petugas(id);
alter table public.pengajuan_surat add column if not exists lurah_name varchar;
alter table public.pengajuan_surat add column if not exists nomor_surat varchar;
alter table public.pengajuan_surat add column if not exists tanggal_surat date;
alter table public.pengajuan_surat add column if not exists verification_token varchar;
alter table public.pengajuan_surat add column if not exists verification_url text;
alter table public.pengajuan_surat add column if not exists final_pdf_url text;
alter table public.pengajuan_surat add column if not exists surat_version integer default 1;
alter table public.pengajuan_surat add column if not exists cancelled_at timestamptz;
alter table public.pengajuan_surat add column if not exists cancelled_by uuid references public.petugas(id);
alter table public.pengajuan_surat add column if not exists cancellation_reason text;

create unique index if not exists pengajuan_surat_verification_token_uidx on public.pengajuan_surat(verification_token) where verification_token is not null;
create index if not exists pengajuan_surat_workflow_status_idx on public.pengajuan_surat(workflow_status);

create table if not exists public.audit_pengajuan (
  id uuid primary key default gen_random_uuid(),
  pengajuan_id uuid not null references public.pengajuan_surat(id) on delete cascade,
  tahap varchar,
  status varchar not null,
  action varchar not null,
  user_id uuid references public.petugas(id),
  nama_petugas varchar,
  jabatan varchar,
  catatan text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

alter table public.audit_pengajuan add column if not exists tahap varchar;
alter table public.audit_pengajuan add column if not exists status varchar;
alter table public.audit_pengajuan add column if not exists action varchar;
alter table public.audit_pengajuan add column if not exists aksi varchar;
alter table public.audit_pengajuan add column if not exists role varchar;
alter table public.audit_pengajuan add column if not exists status_sebelum varchar;
alter table public.audit_pengajuan add column if not exists status_sesudah varchar;
alter table public.audit_pengajuan add column if not exists user_id uuid references public.petugas(id);
alter table public.audit_pengajuan add column if not exists nama_petugas varchar;
alter table public.audit_pengajuan add column if not exists jabatan varchar;
alter table public.audit_pengajuan add column if not exists catatan text;
alter table public.audit_pengajuan add column if not exists metadata jsonb default '{}'::jsonb;
alter table public.audit_pengajuan add column if not exists created_at timestamptz default now();

create index if not exists audit_pengajuan_pengajuan_id_idx on public.audit_pengajuan(pengajuan_id, created_at);