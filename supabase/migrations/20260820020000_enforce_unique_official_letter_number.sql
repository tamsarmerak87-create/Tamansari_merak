-- Fail closed: never repair or renumber existing official letters.
do $$
declare
  v_duplicates text;
begin
  select string_agg(format('%s (%s rows)', nomor_surat, duplicate_count), ', ' order by nomor_surat)
    into v_duplicates
    from (
      select nomor_surat, count(*) as duplicate_count
        from public.pengajuan_surat
       where nomor_surat is not null
         and btrim(nomor_surat) <> ''
       group by nomor_surat
      having count(*) > 1
    ) duplicates;

  if v_duplicates is not null then
    raise exception 'Duplicate nomor_surat ditemukan; migration dihentikan tanpa mengubah data: %', v_duplicates
      using errcode = '23505';
  end if;
end;
$$;

create unique index if not exists pengajuan_surat_nomor_surat_uidx
  on public.pengajuan_surat(nomor_surat)
  where nomor_surat is not null;

-- Claims one submission under a row lock and allocates at most one number.
-- A failed statement rolls its counter update back in the same transaction.
create or replace function public.claim_official_letter_finalization(
  p_pengajuan_id uuid,
  p_service_id uuid,
  p_year integer
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_locked boolean;
  v_issued_at timestamptz;
  v_existing_number text;
  v_number text;
begin
  select document_locked, issued_at, nomor_surat
    into v_locked, v_issued_at, v_existing_number
    from public.pengajuan_surat
   where id = p_pengajuan_id
   for update;

  if not found then
    raise exception 'Pengajuan tidak ditemukan.' using errcode = 'P0002';
  end if;
  if v_locked or v_issued_at is not null or nullif(btrim(coalesce(v_existing_number, '')), '') is not null then
    raise exception 'Dokumen sudah pernah diklaim atau difinalisasi.' using errcode = 'P0001';
  end if;

  v_number := public.allocate_official_letter_number(p_service_id, p_year);

  update public.pengajuan_surat
     set nomor_surat = v_number,
         updated_at = now()
   where id = p_pengajuan_id
     and document_locked = false
     and issued_at is null
     and nomor_surat is null;

  if not found then
    raise exception 'Pengajuan telah berubah atau sedang difinalisasi.' using errcode = 'P0001';
  end if;

  return v_number;
end;
$$;

revoke all on function public.claim_official_letter_finalization(uuid, uuid, integer) from public;
revoke all on function public.claim_official_letter_finalization(uuid, uuid, integer) from anon;
revoke all on function public.claim_official_letter_finalization(uuid, uuid, integer) from authenticated;
grant execute on function public.claim_official_letter_finalization(uuid, uuid, integer) to service_role;