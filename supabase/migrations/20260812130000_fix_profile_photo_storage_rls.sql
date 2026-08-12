-- RLS Supabase Storage untuk foto profil warga.
-- Bucket yang benar-benar dipakai project saat ini: surat.
-- Path foto profil warga: profile-photos/{auth.uid()}/profile-{timestamp}.{ext}

insert into storage.buckets (id, name, public)
values ('surat', 'surat', true)
on conflict (id) do nothing;

drop policy if exists "warga_profile_photos_select_own" on storage.objects;
drop policy if exists "warga_profile_photos_insert_own" on storage.objects;
drop policy if exists "warga_profile_photos_update_own" on storage.objects;
drop policy if exists "warga_profile_photos_delete_own" on storage.objects;

create policy "warga_profile_photos_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'surat'
  and (storage.foldername(name))[1] = 'profile-photos'
  and (storage.foldername(name))[2] = auth.uid()::text
);

create policy "warga_profile_photos_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'surat'
  and (storage.foldername(name))[1] = 'profile-photos'
  and (storage.foldername(name))[2] = auth.uid()::text
  and lower(coalesce(metadata->>'mimetype', '')) in ('image/jpeg', 'image/png', 'image/webp')
  and coalesce((metadata->>'size')::bigint, 0) <= 5242880
);

create policy "warga_profile_photos_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'surat'
  and (storage.foldername(name))[1] = 'profile-photos'
  and (storage.foldername(name))[2] = auth.uid()::text
)
with check (
  bucket_id = 'surat'
  and (storage.foldername(name))[1] = 'profile-photos'
  and (storage.foldername(name))[2] = auth.uid()::text
  and lower(coalesce(metadata->>'mimetype', '')) in ('image/jpeg', 'image/png', 'image/webp')
  and coalesce((metadata->>'size')::bigint, 0) <= 5242880
);

create policy "warga_profile_photos_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'surat'
  and (storage.foldername(name))[1] = 'profile-photos'
  and (storage.foldername(name))[2] = auth.uid()::text
);