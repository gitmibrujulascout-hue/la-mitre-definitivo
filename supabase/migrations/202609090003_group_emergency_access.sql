begin;

-- Acceso de lectura del equipo adulto, asignado explícitamente por el admin.
-- No amplía SELECT/UPDATE sobre beneficiario ni la consulta de Mis ramas.
create or replace function public.list_tenant_emergency_people(
  target_tenant_id uuid, target_offset integer default 0, target_limit integer default 500
)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
  if not public.can_access_tenant(target_tenant_id) or not (
    public.is_super_admin() or public.has_tenant_role(target_tenant_id,
      array['tenant_admin','administration','group_leadership','treasury','branch_leader','support','institutional'])
  ) then raise exception 'ACCESS_DENIED'; end if;
  if target_offset is null or target_limit is null or target_offset<0 or target_limit<1 or target_limit>500 then
    raise exception 'INVALID_PAGE';
  end if;
  select coalesce(jsonb_agg(records.payload),'[]'::jsonb) into result from (
    select (select jsonb_object_agg(field.key,field.value) from jsonb_each(to_jsonb(b)) field
      where field.key = any(array[
        'id','tenant_id','nombre','dni','rama','tipo','activo','fecha_nacimiento',
        'sexo','nacionalidad','telefono_contacto','telefono_contacto_2','email_contacto',
        'calle','localidad','provincia','codigo_postal',
        'grupo_sanguineo','factor_rh','peso_kg','talla_m','alergias','condicion_medica',
        'medicacion_habitual','regimen_dietario','anticoagulacion','salud_mental',
        'discapacidad','detalle_discapacidad','obra_social','numero_obra_social',
        'contacto_emergencia_nombre','contacto_emergencia_telefono',
        'contacto_emergencia_relacion','observaciones_salud'
      ])) as payload
    from public.beneficiario b
    where b.tenant_id=target_tenant_id and b.activo is distinct from false
      and coalesce(b.tipo,'Beneficiario') <> 'Voluntario'
      and coalesce(b.rama,'') not in ('Voluntario','Educador')
    order by b.id offset target_offset limit target_limit
  ) records;
  return result;
end $$;
revoke all on function public.list_tenant_emergency_people(uuid,integer,integer) from public,anon;
grant execute on function public.list_tenant_emergency_people(uuid,integer,integer) to authenticated;
commit;
