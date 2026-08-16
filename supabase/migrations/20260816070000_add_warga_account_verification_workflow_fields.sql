alter table public.warga_profiles
add column if not exists tahap_verifikasi text,
add column if not exists verification_history jsonb not null default '[]'::jsonb,
add column if not exists handled_by uuid references public.petugas(id) on delete set null,
add column if not exists returned_to_role text;

alter table public.warga_notifikasi alter column pengajuan_id drop not null;

create table if not exists public.petugas_notifikasi (
    id uuid primary key default gen_random_uuid(),
    petugas_id uuid not null references public.petugas(id) on delete cascade,
    title text not null,
    message text not null,
    type text not null default 'workflow',
    metadata jsonb not null default '{}'::jsonb,
    read boolean not null default false,
    created_at timestamptz not null default now()
);

create index if not exists petugas_notifikasi_petugas_created_idx on public.petugas_notifikasi (petugas_id, created_at desc);
