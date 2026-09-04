-- Seed idempotente del tenant La Mitre y sus administradores.
-- Sebastián conserva ambos roles: superadministrador global y admin del tenant.

insert into public.tenants (name, slug)
values ('Grupo Scout La Mitre', 'la-mitre')
on conflict (slug) do update set name = excluded.name;

insert into public.tenant_memberships (tenant_id, user_id, role)
select t.id, u.id, 'admin'
from public.tenants t
join auth.users u on u.email in (
  'seba.grupo.mitre@gmail.com',
  'facundodiaz.consultor@gmail.com'
)
where t.slug = 'la-mitre'
on conflict (tenant_id, user_id) do update set role = excluded.role;

update public.profiles p
set role = 'admin', is_super_admin = true
from auth.users u
where p.id = u.id
  and u.email in (
    'seba.grupo.mitre@gmail.com',
    'facundodiaz.consultor@gmail.com'
  );

-- Verificación esperada: dos filas, role=admin e is_super_admin=true.
select t.name as tenant, u.email, tm.role, p.is_super_admin
from public.tenant_memberships tm
join public.tenants t on t.id = tm.tenant_id
join auth.users u on u.id = tm.user_id
join public.profiles p on p.id = u.id
where t.slug = 'la-mitre'
order by u.email;
