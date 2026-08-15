create table if not exists public.warga_notifikasi (
    id uuid primary key default gen_random_uuid(),
    warga_id uuid not null references public.warga_profiles(id) on delete cascade,
    pengajuan_id uuid not null references public.pengajuan_surat(id) on delete cascade,
    title text not null default 'Notifikasi Pengajuan',
    message text not null,
    catatan text,
    type text not null default 'pengajuan',
    read boolean not null default false,
    created_at timestamptz not null default now()
);

create index if not exists warga_notifikasi_warga_created_idx on public.warga_notifikasi (warga_id, created_at desc);
create index if not exists warga_notifikasi_warga_read_idx on public.warga_notifikasi (warga_id, read);
create index if not exists warga_notifikasi_pengajuan_idx on public.warga_notifikasi (pengajuan_id);

alter table public.warga_notifikasi enable row level security;

drop policy if exists "Warga dapat membaca notifikasi sendiri" on public.warga_notifikasi;
create policy "Warga dapat membaca notifikasi sendiri"
on public.warga_notifikasi
for select
to authenticated
using (warga_id = auth.uid());

drop policy if exists "Warga dapat menandai notifikasi sendiri" on public.warga_notifikasi;
create policy "Warga dapat menandai notifikasi sendiri"
on public.warga_notifikasi
for update
to authenticated
using (warga_id = auth.uid())
with check (warga_id = auth.uid());

drop policy if exists "Warga dapat menghapus notifikasi sendiri" on public.warga_notifikasi;
create policy "Warga dapat menghapus notifikasi sendiri"
on public.warga_notifikasi
for delete
to authenticated
using (warga_id = auth.uid());