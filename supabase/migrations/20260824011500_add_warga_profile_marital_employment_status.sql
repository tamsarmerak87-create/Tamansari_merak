alter table public.warga_profiles
    add column if not exists agama text,
    add column if not exists status_perkawinan text,
    add column if not exists status_pekerjaan text;

alter table public.warga_profiles
    drop constraint if exists warga_profiles_status_perkawinan_check;
alter table public.warga_profiles
    add constraint warga_profiles_status_perkawinan_check
    check (status_perkawinan is null or status_perkawinan in ('Menikah', 'Belum Menikah', 'Janda', 'Duda'));

alter table public.warga_profiles
    drop constraint if exists warga_profiles_status_pekerjaan_check;
alter table public.warga_profiles
    add constraint warga_profiles_status_pekerjaan_check
    check (status_pekerjaan is null or status_pekerjaan in ('Bekerja', 'Belum Bekerja'));