-- Evita la recursión de RLS provocada por consultar profiles desde una policy
-- aplicada sobre la misma tabla. La lectura propia se mantiene en la policy
-- existente y el acceso global se delega en la función security definer.

drop policy if exists "Admins can read all profiles" on public.profiles;

drop policy if exists "Super admins can read all profiles" on public.profiles;
create policy "Super admins can read all profiles"
  on public.profiles
  for select
  to authenticated
  using (public.is_super_admin());

grant execute on function public.is_super_admin() to authenticated;
