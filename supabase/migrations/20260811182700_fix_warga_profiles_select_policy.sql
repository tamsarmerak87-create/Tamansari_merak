alter table public.warga_profiles enable row level security;

drop policy if exists "warga_profiles_select_own_profile" on public.warga_profiles;
create policy "warga_profiles_select_own_profile"
on public.warga_profiles
for select
to authenticated
using (id = auth.uid() or email = auth.email());

drop policy if exists "warga_profiles_update_own_profile" on public.warga_profiles;
create policy "warga_profiles_update_own_profile"
on public.warga_profiles
for update
to authenticated
using (id = auth.uid() or email = auth.email())
with check (id = auth.uid() or email = auth.email());

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'warga_profiles'
      and column_name = 'user_id'
  ) then
    drop policy if exists "warga_profiles_select_own_profile_user_id" on public.warga_profiles;
    create policy "warga_profiles_select_own_profile_user_id"
    on public.warga_profiles
    for select
    to authenticated
    using (user_id = auth.uid());

    drop policy if exists "warga_profiles_update_own_profile_user_id" on public.warga_profiles;
    create policy "warga_profiles_update_own_profile_user_id"
    on public.warga_profiles
    for update
    to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());
  end if;
end $$;