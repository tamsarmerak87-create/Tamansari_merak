alter table public.warga_profiles
add column if not exists jenis_kelamin text,
add column if not exists foto_url text;

comment on column public.warga_profiles.jenis_kelamin is 'Opsional. Diisi dari form registrasi jika kolom sudah tersedia di database.';
comment on column public.warga_profiles.foto_url is 'Opsional. URL foto profil warga jika fitur upload foto profil diaktifkan.';
