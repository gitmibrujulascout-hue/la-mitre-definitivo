-- All statements execute in one transaction with the caller's RLS permissions.
create or replace function public.apply_tenant_batch(target_tenant_id uuid, target_table text, operations jsonb)
returns jsonb language plpgsql security invoker set search_path = public
as $$
declare
  op jsonb; vals jsonb; saved jsonb; existing jsonb; rows jsonb := '[]';
  columns_sql text; values_sql text; assignments text; affected integer; key text;
begin
  if auth.uid() is null or target_tenant_id is null or not public.can_access_tenant(target_tenant_id) then raise exception 'ACCESS_DENIED'; end if;
  if target_table not in ('beneficiario','pre_encargo_tienda') or target_table is null then raise exception 'INVALID_TABLE'; end if;
  if operations is null or jsonb_typeof(operations) <> 'array' then raise exception 'INVALID_BATCH'; end if;
  if jsonb_array_length(operations) < 1 or jsonb_array_length(operations) > 1000 or octet_length(operations::text) > 1048576 then raise exception 'INVALID_BATCH'; end if;
  if exists(select 1 from jsonb_array_elements(operations) e where e->>'type'='update' group by e->>'id' having count(*)>1) then raise exception 'DUPLICATE_ID'; end if;

  -- Lock every source in a stable order before any insert (also serializes fusion retries).
  for op in select e from jsonb_array_elements(operations) e where e->>'type'='update' order by e->>'id' loop
    execute format('select to_jsonb(t) from public.%I t where id=$1 and tenant_id=$2 for update',target_table)
      into existing using (op->>'id')::uuid,target_tenant_id;
    if existing is null then raise exception 'ROW_NOT_ACCESSIBLE'; end if;
    if op ? 'expected_updated_at' and (existing->>'updated_at')::timestamptz is distinct from (op->>'expected_updated_at')::timestamptz then raise exception 'STALE_ROW'; end if;
  end loop;

  for op in select e from jsonb_array_elements(operations) e loop
    if jsonb_typeof(op)<>'object' or coalesce(op->>'type','') not in ('update','create') then raise exception 'INVALID_OPERATION'; end if;
    vals := op->'values';
    if vals is null or jsonb_typeof(vals)<>'object' or vals='{}'::jsonb then raise exception 'INVALID_VALUES'; end if;
    if vals ? 'tenant_id' and vals->>'tenant_id' is distinct from target_tenant_id::text then raise exception 'TENANT_MISMATCH'; end if;
    vals := vals - 'tenant_id';
    for key in select jsonb_object_keys(vals) loop
      if key in ('id','created_at','updated_at') or not exists (
        select 1 from pg_attribute a where a.attrelid=format('public.%I',target_table)::regclass and a.attname=key and a.attnum>0 and not a.attisdropped and a.attgenerated=''
      ) then raise exception 'INVALID_COLUMN'; end if;
    end loop;
    vals := vals || jsonb_build_object('updated_at',now());
    if op->>'type'='update' then
      select string_agg(format('%I = p.%I',k,k),',') into assignments from jsonb_object_keys(vals) k;
      execute format('update public.%I t set %s from jsonb_populate_record(null::public.%I,$1) p where t.id=$2 and t.tenant_id=$3 returning to_jsonb(t)',target_table,assignments,target_table)
        into saved using vals,(op->>'id')::uuid,target_tenant_id;
      get diagnostics affected = row_count;
      if affected<>1 then raise exception 'ROW_NOT_WRITABLE'; end if;
    else
      -- Store creation is solely for a version-checked fusion; member creation can accompany family updates.
      if target_table='pre_encargo_tienda' and not exists(select 1 from jsonb_array_elements(operations) e where e->>'type'='update' and e ? 'expected_updated_at') then raise exception 'CREATE_NOT_ALLOWED'; end if;
      vals := vals || jsonb_build_object('tenant_id',target_tenant_id);
      select string_agg(format('%I',k),','),string_agg(format('p.%I',k),',') into columns_sql,values_sql from jsonb_object_keys(vals) k;
      execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I,$1) p returning to_jsonb(%I)',target_table,columns_sql,values_sql,target_table,target_table)
        into saved using vals;
    end if;
    rows := rows || jsonb_build_array(saved);
  end loop;
  return rows;
end;
$$;
revoke all on function public.apply_tenant_batch(uuid,text,jsonb) from public,anon;
grant execute on function public.apply_tenant_batch(uuid,text,jsonb) to authenticated;
