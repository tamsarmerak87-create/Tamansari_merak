-- Authoritative legal identity snapshot copied by the finalizer from warga_profiles.
-- Idempotent: safe to apply repeatedly and preserves all existing columns/data.
alter table public.pengajuan_surat
    add column if not exists agama text,
    add column if not exists status_perkawinan text,
    add column if not exists status_pekerjaan text;