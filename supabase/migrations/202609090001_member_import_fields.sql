-- Esquema de la-mitre-definitivo. No requiere ni crea public.groups.
begin;
do $$
begin
  if to_regclass('public.beneficiario') is null then
    raise exception 'Esquema incompatible: esta migración requiere public.beneficiario';
  end if;
end $$;
alter table public.beneficiario add column if not exists tipo_documento text;
alter table public.beneficiario add column if not exists empresa text;
commit;
