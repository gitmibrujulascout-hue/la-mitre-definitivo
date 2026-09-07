-- SEC-001: aislamiento de acceso, membresías multirrol e invitaciones seguras.
-- Esta migración es idempotente y conserva la columna legacy
-- tenant_memberships.role mientras el frontend termina su transición.

create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists email text;

update public.profiles profile
set email = lower(auth_user.email)
from auth.users auth_user
where profile.id = auth_user.id
  and (profile.email is null or profile.email = '');

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    lower(new.email)
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(nullif(public.profiles.full_name, ''), excluded.full_name),
      updated_at = now();
  return new;
end;
$$;

alter table public.tenant_memberships
  add column if not exists status text;

update public.tenant_memberships
set status = 'active'
where status is null;

alter table public.tenant_memberships
  alter column status set default 'active',
  alter column status set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tenant_memberships_status_check'
      and conrelid = 'public.tenant_memberships'::regclass
  ) then
    alter table public.tenant_memberships
      add constraint tenant_memberships_status_check
      check (status in ('active', 'suspended'));
  end if;
end;
$$;

create table if not exists public.tenant_membership_roles (
  tenant_id uuid not null,
  user_id uuid not null,
  role text not null check (role in (
    'tenant_admin',
    'group_leadership',
    'administration',
    'treasury',
    'branch_leader',
    'support',
    'institutional',
    'family',
    'youth',
    'viewer'
  )),
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id, role),
  foreign key (tenant_id, user_id)
    references public.tenant_memberships (tenant_id, user_id)
    on delete cascade
);

insert into public.tenant_membership_roles (tenant_id, user_id, role)
select
  membership.tenant_id,
  membership.user_id,
  case when membership.role = 'admin' then 'tenant_admin' else 'viewer' end
from public.tenant_memberships membership
on conflict do nothing;

create table if not exists public.tenant_invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email text not null,
  full_name text not null,
  roles text[] not null default '{}',
  token_hash text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'cancelled', 'expired')),
  invited_by uuid references auth.users(id) on delete set null,
  accepted_user_id uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists tenant_invitations_pending_email_idx
  on public.tenant_invitations (tenant_id, lower(email))
  where status = 'pending';

create index if not exists tenant_invitations_tenant_status_idx
  on public.tenant_invitations (tenant_id, status, created_at desc);

create table if not exists public.tenant_access_audit (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  invitation_id uuid references public.tenant_invitations(id) on delete set null,
  action text not null,
  previous_value jsonb,
  next_value jsonb,
  created_at timestamptz not null default now()
);

create index if not exists tenant_access_audit_tenant_created_idx
  on public.tenant_access_audit (tenant_id, created_at desc);

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.is_super_admin = true
  );
$$;

create or replace function public.has_tenant_role(
  target_tenant_id uuid,
  requested_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_memberships membership
    join public.tenant_membership_roles membership_role
      on membership_role.tenant_id = membership.tenant_id
     and membership_role.user_id = membership.user_id
    where membership.tenant_id = target_tenant_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and membership_role.role = any(requested_roles)
  );
$$;

create or replace function public.can_access_tenant(row_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select row_tenant_id is not null
    and (
      public.is_super_admin()
      or exists (
        select 1
        from public.tenant_memberships membership
        join public.tenants tenant on tenant.id = membership.tenant_id
        where membership.tenant_id = row_tenant_id
          and membership.user_id = auth.uid()
          and membership.status = 'active'
          and tenant.active = true
      )
    );
$$;

create or replace function public.can_manage_tenant_users(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or public.has_tenant_role(
      target_tenant_id,
      array['tenant_admin', 'administration', 'group_leadership']::text[]
    );
$$;

create or replace function public.assert_valid_tenant_roles(requested_roles text[])
returns void
language plpgsql
immutable
set search_path = public
as $$
declare
  allowed_roles constant text[] := array[
    'tenant_admin',
    'group_leadership',
    'administration',
    'treasury',
    'branch_leader',
    'support',
    'institutional',
    'family',
    'youth',
    'viewer'
  ]::text[];
begin
  if requested_roles is null or cardinality(requested_roles) = 0 then
    raise exception 'ROLES_REQUIRED';
  end if;

  if exists (
    select 1
    from unnest(requested_roles) requested_role
    where not (requested_role = any(allowed_roles))
  ) then
    raise exception 'INVALID_ROLE';
  end if;
end;
$$;

create or replace function public.create_tenant_invitation(
  target_tenant_id uuid,
  invitation_email text,
  invitation_full_name text,
  invitation_roles text[]
)
returns table (
  invitation_id uuid,
  invitation_token text,
  invitation_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text := lower(trim(invitation_email));
  normalized_name text := trim(invitation_full_name);
  raw_token text := encode(gen_random_bytes(32), 'hex');
  saved_invitation public.tenant_invitations%rowtype;
begin
  if not public.can_manage_tenant_users(target_tenant_id) then
    raise exception 'ACCESS_DENIED';
  end if;

  perform public.assert_valid_tenant_roles(invitation_roles);

  if normalized_name = '' or normalized_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'INVALID_INVITATION';
  end if;

  if 'tenant_admin' = any(invitation_roles)
     and not (
       public.is_super_admin()
       or public.has_tenant_role(target_tenant_id, array['tenant_admin']::text[])
     ) then
    raise exception 'TENANT_ADMIN_REQUIRED';
  end if;

  update public.tenant_invitations invitation
  set full_name = normalized_name,
      roles = array(select distinct unnest(invitation_roles)),
      token_hash = encode(digest(raw_token, 'sha256'), 'hex'),
      status = 'pending',
      invited_by = auth.uid(),
      accepted_user_id = null,
      accepted_at = null,
      expires_at = now() + interval '7 days',
      updated_at = now()
  where invitation.tenant_id = target_tenant_id
    and lower(invitation.email) = normalized_email
    and invitation.status = 'pending'
  returning invitation.* into saved_invitation;

  if saved_invitation.id is null then
    insert into public.tenant_invitations (
      tenant_id,
      email,
      full_name,
      roles,
      token_hash,
      invited_by
    ) values (
      target_tenant_id,
      normalized_email,
      normalized_name,
      array(select distinct unnest(invitation_roles)),
      encode(digest(raw_token, 'sha256'), 'hex'),
      auth.uid()
    )
    returning * into saved_invitation;
  end if;

  insert into public.tenant_access_audit (
    tenant_id,
    actor_user_id,
    invitation_id,
    action,
    next_value
  ) values (
    target_tenant_id,
    auth.uid(),
    saved_invitation.id,
    'invitation_created',
    jsonb_build_object('email', normalized_email, 'roles', saved_invitation.roles)
  );

  return query
  select saved_invitation.id, raw_token, saved_invitation.expires_at;
end;
$$;

create or replace function public.get_tenant_invitation(invitation_token text)
returns table (
  invitation_status text,
  invitation_email text,
  invitation_full_name text,
  invitation_roles text[],
  tenant_name text,
  invitation_expires_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    case
      when invitation.status = 'pending' and invitation.expires_at <= now() then 'expired'
      else invitation.status
    end,
    invitation.email,
    invitation.full_name,
    invitation.roles,
    tenant.name,
    invitation.expires_at
  from public.tenant_invitations invitation
  join public.tenants tenant on tenant.id = invitation.tenant_id
  where invitation.token_hash = encode(digest(invitation_token, 'sha256'), 'hex')
  limit 1;
$$;

create or replace function public.accept_tenant_invitation(invitation_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation public.tenant_invitations%rowtype;
  session_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  select * into invitation
  from public.tenant_invitations candidate
  where candidate.token_hash = encode(digest(invitation_token, 'sha256'), 'hex')
  for update;

  if invitation.id is null
     or invitation.status <> 'pending'
     or invitation.expires_at <= now() then
    raise exception 'INVITATION_NOT_AVAILABLE';
  end if;

  if lower(invitation.email) <> session_email then
    raise exception 'INVITATION_EMAIL_MISMATCH';
  end if;

  insert into public.tenant_memberships (tenant_id, user_id, role, status)
  values (
    invitation.tenant_id,
    auth.uid(),
    case
      when invitation.roles && array[
        'tenant_admin', 'group_leadership', 'administration', 'treasury'
      ]::text[] then 'admin'
      else 'member'
    end,
    'active'
  )
  on conflict (tenant_id, user_id) do update
  set status = 'active',
      role = excluded.role;

  delete from public.tenant_membership_roles membership_role
  where membership_role.tenant_id = invitation.tenant_id
    and membership_role.user_id = auth.uid();

  insert into public.tenant_membership_roles (tenant_id, user_id, role)
  select invitation.tenant_id, auth.uid(), requested_role
  from unnest(invitation.roles) requested_role
  on conflict do nothing;

  update public.profiles profile
  set email = session_email,
      full_name = coalesce(nullif(profile.full_name, ''), invitation.full_name),
      updated_at = now()
  where profile.id = auth.uid();

  update public.tenant_invitations
  set status = 'accepted',
      accepted_user_id = auth.uid(),
      accepted_at = now(),
      updated_at = now()
  where id = invitation.id;

  insert into public.tenant_access_audit (
    tenant_id,
    actor_user_id,
    target_user_id,
    invitation_id,
    action,
    next_value
  ) values (
    invitation.tenant_id,
    auth.uid(),
    auth.uid(),
    invitation.id,
    'invitation_accepted',
    jsonb_build_object('roles', invitation.roles)
  );

  return invitation.tenant_id;
end;
$$;

create or replace function public.set_tenant_member_roles(
  target_tenant_id uuid,
  target_user_id uuid,
  requested_roles text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_roles text[];
  removing_admin boolean;
  other_admins integer;
begin
  if not public.can_manage_tenant_users(target_tenant_id) then
    raise exception 'ACCESS_DENIED';
  end if;

  perform public.assert_valid_tenant_roles(requested_roles);

  if target_user_id = auth.uid() and not public.is_super_admin() then
    raise exception 'SELF_ROLE_CHANGE_NOT_ALLOWED';
  end if;

  if 'tenant_admin' = any(requested_roles)
     and not (
       public.is_super_admin()
       or public.has_tenant_role(target_tenant_id, array['tenant_admin']::text[])
     ) then
    raise exception 'TENANT_ADMIN_REQUIRED';
  end if;

  if not exists (
    select 1 from public.tenant_memberships membership
    where membership.tenant_id = target_tenant_id
      and membership.user_id = target_user_id
  ) then
    raise exception 'MEMBERSHIP_NOT_FOUND';
  end if;

  select coalesce(array_agg(role order by role), '{}')
  into previous_roles
  from public.tenant_membership_roles
  where tenant_id = target_tenant_id
    and user_id = target_user_id;

  removing_admin := 'tenant_admin' = any(previous_roles)
    and not ('tenant_admin' = any(requested_roles));

  if removing_admin then
    select count(*) into other_admins
    from public.tenant_memberships membership
    join public.tenant_membership_roles membership_role
      on membership_role.tenant_id = membership.tenant_id
     and membership_role.user_id = membership.user_id
    where membership.tenant_id = target_tenant_id
      and membership.status = 'active'
      and membership.user_id <> target_user_id
      and membership_role.role = 'tenant_admin';

    if other_admins = 0 then
      raise exception 'LAST_TENANT_ADMIN';
    end if;
  end if;

  delete from public.tenant_membership_roles
  where tenant_id = target_tenant_id
    and user_id = target_user_id;

  insert into public.tenant_membership_roles (tenant_id, user_id, role)
  select target_tenant_id, target_user_id, requested_role
  from unnest(requested_roles) requested_role
  on conflict do nothing;

  update public.tenant_memberships
  set role = case
      when requested_roles && array[
        'tenant_admin', 'group_leadership', 'administration', 'treasury'
      ]::text[] then 'admin'
      else 'member'
    end
  where tenant_id = target_tenant_id
    and user_id = target_user_id;

  insert into public.tenant_access_audit (
    tenant_id,
    actor_user_id,
    target_user_id,
    action,
    previous_value,
    next_value
  ) values (
    target_tenant_id,
    auth.uid(),
    target_user_id,
    'member_roles_updated',
    jsonb_build_object('roles', previous_roles),
    jsonb_build_object('roles', requested_roles)
  );
end;
$$;

create or replace function public.set_tenant_member_status(
  target_tenant_id uuid,
  target_user_id uuid,
  requested_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_status text;
  target_is_admin boolean;
  other_admins integer;
begin
  if not public.can_manage_tenant_users(target_tenant_id) then
    raise exception 'ACCESS_DENIED';
  end if;

  if requested_status not in ('active', 'suspended') then
    raise exception 'INVALID_STATUS';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'SELF_STATUS_CHANGE_NOT_ALLOWED';
  end if;

  select status into previous_status
  from public.tenant_memberships
  where tenant_id = target_tenant_id
    and user_id = target_user_id
  for update;

  if previous_status is null then
    raise exception 'MEMBERSHIP_NOT_FOUND';
  end if;

  select exists (
    select 1 from public.tenant_membership_roles
    where tenant_id = target_tenant_id
      and user_id = target_user_id
      and role = 'tenant_admin'
  ) into target_is_admin;

  if requested_status = 'suspended' and target_is_admin then
    select count(*) into other_admins
    from public.tenant_memberships membership
    join public.tenant_membership_roles membership_role
      on membership_role.tenant_id = membership.tenant_id
     and membership_role.user_id = membership.user_id
    where membership.tenant_id = target_tenant_id
      and membership.status = 'active'
      and membership.user_id <> target_user_id
      and membership_role.role = 'tenant_admin';

    if other_admins = 0 then
      raise exception 'LAST_TENANT_ADMIN';
    end if;
  end if;

  update public.tenant_memberships
  set status = requested_status
  where tenant_id = target_tenant_id
    and user_id = target_user_id;

  insert into public.tenant_access_audit (
    tenant_id,
    actor_user_id,
    target_user_id,
    action,
    previous_value,
    next_value
  ) values (
    target_tenant_id,
    auth.uid(),
    target_user_id,
    'member_status_updated',
    jsonb_build_object('status', previous_status),
    jsonb_build_object('status', requested_status)
  );
end;
$$;

create or replace function public.cancel_tenant_invitation(invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation public.tenant_invitations%rowtype;
begin
  select * into invitation
  from public.tenant_invitations candidate
  where candidate.id = invitation_id
  for update;

  if invitation.id is null
     or not public.can_manage_tenant_users(invitation.tenant_id) then
    raise exception 'ACCESS_DENIED';
  end if;

  if invitation.status <> 'pending' then
    raise exception 'INVITATION_NOT_PENDING';
  end if;

  update public.tenant_invitations
  set status = 'cancelled', updated_at = now()
  where id = invitation.id;

  insert into public.tenant_access_audit (
    tenant_id,
    actor_user_id,
    invitation_id,
    action,
    previous_value,
    next_value
  ) values (
    invitation.tenant_id,
    auth.uid(),
    invitation.id,
    'invitation_cancelled',
    jsonb_build_object('status', invitation.status),
    jsonb_build_object('status', 'cancelled')
  );
end;
$$;

alter table public.profiles enable row level security;
alter table public.tenant_memberships enable row level security;
alter table public.tenant_membership_roles enable row level security;
alter table public.tenant_invitations enable row level security;
alter table public.tenant_access_audit enable row level security;

drop policy if exists "Admins can read all profiles" on public.profiles;
drop policy if exists "Super admins can read all profiles" on public.profiles;
drop policy if exists "Tenant access managers read profiles" on public.profiles;
create policy "Tenant access managers read profiles"
  on public.profiles for select to authenticated
  using (
    auth.uid() = id
    or public.is_super_admin()
    or exists (
      select 1
      from public.tenant_memberships target_membership
      where target_membership.user_id = profiles.id
        and public.can_manage_tenant_users(target_membership.tenant_id)
    )
  );

drop policy if exists "Users update their own profile" on public.profiles;
create policy "Users update their own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Super admins manage memberships" on public.tenant_memberships;
drop policy if exists "Users read own memberships" on public.tenant_memberships;
drop policy if exists "Tenant users read memberships" on public.tenant_memberships;
create policy "Tenant users read memberships"
  on public.tenant_memberships for select to authenticated
  using (
    user_id = auth.uid()
    or public.can_manage_tenant_users(tenant_id)
  );

drop policy if exists "Tenant users read membership roles" on public.tenant_membership_roles;
create policy "Tenant users read membership roles"
  on public.tenant_membership_roles for select to authenticated
  using (
    user_id = auth.uid()
    or public.can_manage_tenant_users(tenant_id)
  );

drop policy if exists "Tenant managers read invitations" on public.tenant_invitations;
create policy "Tenant managers read invitations"
  on public.tenant_invitations for select to authenticated
  using (public.can_manage_tenant_users(tenant_id));

drop policy if exists "Tenant managers read access audit" on public.tenant_access_audit;
create policy "Tenant managers read access audit"
  on public.tenant_access_audit for select to authenticated
  using (public.can_manage_tenant_users(tenant_id));

revoke insert, update, delete on public.tenant_memberships from authenticated;
revoke insert, update, delete on public.tenant_membership_roles from authenticated;
revoke insert, update, delete on public.tenant_invitations from authenticated;
revoke insert, update, delete on public.tenant_access_audit from authenticated;

grant select on public.tenant_memberships to authenticated;
grant select on public.tenant_membership_roles to authenticated;
grant select on public.tenant_invitations to authenticated;
grant select on public.tenant_access_audit to authenticated;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.is_super_admin() from public, anon;
revoke execute on function public.has_tenant_role(uuid, text[]) from public, anon;
revoke execute on function public.can_access_tenant(uuid) from public, anon;
revoke execute on function public.can_manage_tenant_users(uuid) from public, anon;
revoke execute on function public.create_tenant_invitation(uuid, text, text, text[]) from public, anon;
revoke execute on function public.get_tenant_invitation(text) from public;
revoke execute on function public.accept_tenant_invitation(text) from public, anon;
revoke execute on function public.set_tenant_member_roles(uuid, uuid, text[]) from public, anon;
revoke execute on function public.set_tenant_member_status(uuid, uuid, text) from public, anon;
revoke execute on function public.cancel_tenant_invitation(uuid) from public, anon;

grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.has_tenant_role(uuid, text[]) to authenticated;
grant execute on function public.can_access_tenant(uuid) to authenticated;
grant execute on function public.can_manage_tenant_users(uuid) to authenticated;
grant execute on function public.create_tenant_invitation(uuid, text, text, text[]) to authenticated;
grant execute on function public.get_tenant_invitation(text) to anon, authenticated;
grant execute on function public.accept_tenant_invitation(text) to authenticated;
grant execute on function public.set_tenant_member_roles(uuid, uuid, text[]) to authenticated;
grant execute on function public.set_tenant_member_status(uuid, uuid, text) to authenticated;
grant execute on function public.cancel_tenant_invitation(uuid) to authenticated;

revoke execute on function public.assert_valid_tenant_roles(text[]) from public, anon, authenticated;
