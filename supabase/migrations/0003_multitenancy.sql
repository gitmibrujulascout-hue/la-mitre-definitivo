create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tenant_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('admin', 'member')),
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

alter table public.profiles add column if not exists is_super_admin boolean not null default false;
alter table public.profiles enable row level security;
alter table public.tenants enable row level security;
alter table public.tenant_memberships enable row level security;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and is_super_admin = true); $$;

create or replace function public.is_tenant_admin(target_tenant uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select public.is_super_admin() or exists (
  select 1 from public.tenant_memberships
  where tenant_id = target_tenant and user_id = auth.uid() and role = 'admin'
); $$;

drop policy if exists "Super admins manage tenants" on public.tenants;
create policy "Super admins manage tenants" on public.tenants for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists "Members can read their tenants" on public.tenants;
create policy "Members can read their tenants" on public.tenants for select to authenticated using (
  exists (select 1 from public.tenant_memberships m where m.tenant_id = tenants.id and m.user_id = auth.uid())
);

drop policy if exists "Super admins manage memberships" on public.tenant_memberships;
create policy "Super admins manage memberships" on public.tenant_memberships for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists "Users read own memberships" on public.tenant_memberships;
create policy "Users read own memberships" on public.tenant_memberships for select to authenticated using (user_id = auth.uid());
