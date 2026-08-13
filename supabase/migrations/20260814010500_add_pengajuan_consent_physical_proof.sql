alter table if exists public.pengajuan_surat
    add column if not exists consent_given boolean not null default false,
    add column if not exists declaration_accepted boolean not null default false,
    add column if not exists physical_proof_generated boolean not null default false,
    add column if not exists physical_proof_viewed boolean not null default false,
    add column if not exists physical_proof_approved boolean not null default false,
    add column if not exists physical_proof_generated_at timestamptz,
    add column if not exists physical_proof_path text,
    add column if not exists materai_status text not null default 'NOT_CONFIGURED',
    add column if not exists materai_provider text,
    add column if not exists materai_document_id text,
    add column if not exists materai_applied_at timestamptz,
    add column if not exists materai_reference text;

create table if not exists public.pengajuan_audit_logs (
    id uuid primary key default gen_random_uuid(),
    pengajuan_id uuid not null references public.pengajuan_surat(id) on delete cascade,
    user_id uuid,
    action text not null,
    created_at timestamptz not null default now()
);

create index if not exists pengajuan_audit_logs_pengajuan_id_idx on public.pengajuan_audit_logs(pengajuan_id);
