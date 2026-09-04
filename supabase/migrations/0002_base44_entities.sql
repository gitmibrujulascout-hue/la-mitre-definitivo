-- Generated from Base44 entity definitions. Review business constraints before production.
create extension if not exists pgcrypto;

create table if not exists public.acceso_campamento (
  id uuid primary key default gen_random_uuid(),
  campamento_id text,
  campamento_nombre text,
  codigo text,
  activo boolean,
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.acceso_campamento enable row level security;
create index if not exists acceso_campamento_created_at_idx on public.acceso_campamento(created_at desc);

create table if not exists public.actividad_economica (
  id uuid primary key default gen_random_uuid(),
  nombre text,
  descripcion text,
  fecha text,
  fecha_cierre_pedidos text,
  fecha_pago text,
  estado text,
  tipo_producto text,
  precio_venta_unitario numeric,
  precio_costo_unitario numeric,
  precio_adultos_unitario numeric,
  cantidad_total numeric,
  ingreso_total numeric,
  costo_total numeric,
  ganancia_neta numeric,
  porcentaje_grupo numeric,
  porcentaje_beneficiario numeric,
  ramas_participantes jsonb,
  adultos_ids jsonb,
  ganancia_grupo_acreditada boolean,
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.actividad_economica enable row level security;
create index if not exists actividad_economica_created_at_idx on public.actividad_economica(created_at desc);

create table if not exists public.afiliacion (
  id uuid primary key default gen_random_uuid(),
  beneficiario_id text,
  beneficiario_nombre text,
  beneficiario_dni text,
  anio numeric,
  monto numeric,
  monto_pagado numeric,
  monto_pagado_credito numeric,
  fecha_pago text,
  forma_pago text,
  es_primera_vez boolean,
  rama text,
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.afiliacion enable row level security;
create index if not exists afiliacion_created_at_idx on public.afiliacion(created_at desc);

create table if not exists public.beneficiario (
  id uuid primary key default gen_random_uuid(),
  nombre text,
  dni text,
  telefono_contacto text,
  telefono_contacto_2 text,
  fecha_nacimiento text,
  funcion text,
  categoria text,
  zona text,
  distrito text,
  codigo text,
  organismo text,
  religion text,
  religion_descripcion text,
  estado_panuelo text,
  rama text,
  rama_educador text,
  tipo text,
  tipo_afiliacion text,
  becado boolean,
  grupo_familiar text,
  email_contacto text,
  activo boolean,
  fecha_baja text,
  fecha_reingreso text,
  fecha_primer_afiliacion text,
  provincia text,
  localidad text,
  calle text,
  codigo_postal text,
  nacionalidad text,
  sexo text,
  estado_civil text,
  estudios text,
  titulo text,
  discapacidad text,
  detalle_discapacidad text,
  alergias text,
  condicion_medica text,
  medicacion_habitual text,
  grupo_sanguineo text,
  factor_rh text,
  peso_kg numeric,
  talla_m numeric,
  regimen_dietario text,
  anticoagulacion text,
  salud_mental text,
  obra_social text,
  numero_obra_social text,
  contacto_emergencia_nombre text,
  contacto_emergencia_telefono text,
  contacto_emergencia_relacion text,
  observaciones_salud text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.beneficiario enable row level security;
create index if not exists beneficiario_created_at_idx on public.beneficiario(created_at desc);

create table if not exists public.caja_chica (
  id uuid primary key default gen_random_uuid(),
  monto numeric,
  fecha text,
  concepto text,
  responsable text,
  estado text,
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.caja_chica enable row level security;
create index if not exists caja_chica_created_at_idx on public.caja_chica(created_at desc);

create table if not exists public.campamento (
  id uuid primary key default gen_random_uuid(),
  nombre text,
  fecha_inicio text,
  fecha_fin text,
  costo_por_persona numeric,
  costo_adultos numeric,
  adultos_pagan boolean,
  es_privado boolean,
  costos_individuales jsonb,
  presupuesto jsonb,
  ramas_participantes jsonb,
  beneficiarios_ids jsonb,
  adultos_ids jsonb,
  autorizaciones_ids jsonb,
  confirmaciones_ids jsonb,
  autorizacion_activa boolean,
  autorizacion_texto text,
  circular_url text,
  ubicacion text,
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.campamento enable row level security;
create index if not exists campamento_created_at_idx on public.campamento(created_at desc);

create table if not exists public.config_afiliacion (
  id uuid primary key default gen_random_uuid(),
  anio numeric,
  monto_general numeric,
  monto_acompanante numeric,
  fecha_limite_primera_vez text,
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.config_afiliacion enable row level security;
create index if not exists config_afiliacion_created_at_idx on public.config_afiliacion(created_at desc);

create table if not exists public.config_cuota (
  id uuid primary key default gen_random_uuid(),
  mes text,
  anio numeric,
  monto_efectivo numeric,
  monto_transferencia numeric,
  es_bonificado_credito boolean,
  porcentaje_credito numeric,
  monto_credito numeric,
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.config_cuota enable row level security;
create index if not exists config_cuota_created_at_idx on public.config_cuota(created_at desc);

create table if not exists public.config_general (
  id uuid primary key default gen_random_uuid(),
  clave_admin text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.config_general enable row level security;
create index if not exists config_general_created_at_idx on public.config_general(created_at desc);

create table if not exists public.consulta_dni (
  id uuid primary key default gen_random_uuid(),
  dni_buscado text,
  encontrado boolean,
  beneficiario_id text,
  beneficiario_nombre text,
  grupo_familiar text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.consulta_dni enable row level security;
create index if not exists consulta_dni_created_at_idx on public.consulta_dni(created_at desc);

create table if not exists public.credito_beneficiario (
  id uuid primary key default gen_random_uuid(),
  beneficiario_id text,
  beneficiario_nombre text,
  actividad_id text,
  actividad_nombre text,
  monto_original numeric,
  monto_disponible numeric,
  fecha text,
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.credito_beneficiario enable row level security;
create index if not exists credito_beneficiario_created_at_idx on public.credito_beneficiario(created_at desc);

create table if not exists public.evento_calendario (
  id uuid primary key default gen_random_uuid(),
  nombre text,
  descripcion text,
  fecha text,
  fecha_fin text,
  tipo text,
  todo_el_grupo boolean,
  ramas_participantes jsonb,
  ubicacion text,
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.evento_calendario enable row level security;
create index if not exists evento_calendario_created_at_idx on public.evento_calendario(created_at desc);

create table if not exists public.gasto (
  id uuid primary key default gen_random_uuid(),
  descripcion text,
  monto numeric,
  fecha text,
  categoria text,
  proveedor text,
  numero_factura text,
  archivo_url text,
  forma_pago text,
  destino text,
  campamento_id text,
  campamento_nombre text,
  actividad_id text,
  actividad_nombre text,
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.gasto enable row level security;
create index if not exists gasto_created_at_idx on public.gasto(created_at desc);

create table if not exists public.gasto_actividad (
  id uuid primary key default gen_random_uuid(),
  actividad_id text,
  actividad_nombre text,
  descripcion text,
  monto numeric,
  fecha text,
  categoria text,
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.gasto_actividad enable row level security;
create index if not exists gasto_actividad_created_at_idx on public.gasto_actividad(created_at desc);

create table if not exists public.movimiento_banco (
  id uuid primary key default gen_random_uuid(),
  fecha text,
  tipo text,
  concepto text,
  monto numeric,
  cuenta text,
  origen text,
  referencia_id text,
  saldo_resultante numeric,
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.movimiento_banco enable row level security;
create index if not exists movimiento_banco_created_at_idx on public.movimiento_banco(created_at desc);

create table if not exists public.pago (
  id uuid primary key default gen_random_uuid(),
  beneficiario_id text,
  beneficiario_nombre text,
  tipo_pago text,
  meses jsonb,
  mes text,
  anio numeric,
  campamento_id text,
  campamento_nombre text,
  forma_pago text,
  destino text,
  monto numeric,
  fecha_pago text,
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.pago enable row level security;
create index if not exists pago_created_at_idx on public.pago(created_at desc);

create table if not exists public.pre_encargo_tienda (
  id uuid primary key default gen_random_uuid(),
  beneficiario_id text,
  beneficiario_nombre text,
  es_grupo boolean,
  es_pedido_proveedor boolean,
  producto_id text,
  producto_nombre text,
  producto_imagen_url text,
  talle text,
  cantidad numeric,
  precio_unitario numeric,
  monto_total numeric,
  monto_pagado numeric,
  fecha_pago text,
  forma_pago text,
  estado text,
  stock_reservado boolean,
  fecha text,
  fecha_confirmacion text,
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.pre_encargo_tienda enable row level security;
create index if not exists pre_encargo_tienda_created_at_idx on public.pre_encargo_tienda(created_at desc);

create table if not exists public.producto_actividad (
  id uuid primary key default gen_random_uuid(),
  actividad_id text,
  actividad_nombre text,
  nombre text,
  grupo text,
  descripcion text,
  es_promo boolean,
  cantidad_promo numeric,
  precio_venta numeric,
  precio_costo numeric,
  orden numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.producto_actividad enable row level security;
create index if not exists producto_actividad_created_at_idx on public.producto_actividad(created_at desc);

create table if not exists public.producto_tienda (
  id uuid primary key default gen_random_uuid(),
  nombre text,
  descripcion text,
  categoria text,
  precio_venta numeric,
  precio_costo numeric,
  imagen_url text,
  imagenes_url jsonb,
  tabla_talles_url text,
  visible_familias boolean,
  tiene_talles boolean,
  talles jsonb,
  stock_por_talle jsonb,
  stock numeric,
  stock_minimo numeric,
  es_combo boolean,
  productos_combo jsonb,
  descuento_familiar_pct numeric,
  caja_exclusiva boolean,
  activo boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.producto_tienda enable row level security;
create index if not exists producto_tienda_created_at_idx on public.producto_tienda(created_at desc);

create table if not exists public.rendicion_afiliacion (
  id uuid primary key default gen_random_uuid(),
  anio numeric,
  fecha text,
  monto_depositado numeric,
  monto_recaudado numeric,
  monto_faltante numeric,
  comprobante text,
  archivo_url text,
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.rendicion_afiliacion enable row level security;
create index if not exists rendicion_afiliacion_created_at_idx on public.rendicion_afiliacion(created_at desc);

create table if not exists public.solicitud_cambio_salud (
  id uuid primary key default gen_random_uuid(),
  beneficiario_id text,
  beneficiario_nombre text,
  datos_propuestos jsonb,
  estado text,
  observaciones_admin text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.solicitud_cambio_salud enable row level security;
create index if not exists solicitud_cambio_salud_created_at_idx on public.solicitud_cambio_salud(created_at desc);

create table if not exists public.user (
  id uuid primary key default gen_random_uuid(),
  role text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.user enable row level security;
create index if not exists user_created_at_idx on public.user(created_at desc);

create table if not exists public.venta_actividad (
  id uuid primary key default gen_random_uuid(),
  actividad_id text,
  actividad_nombre text,
  beneficiario_id text,
  beneficiario_nombre text,
  producto_id text,
  producto_nombre text,
  precio_unitario_aplicado numeric,
  es_promo boolean,
  cantidad_promo numeric,
  cantidad_vendida numeric,
  monto_recaudado numeric,
  credito_beneficiario numeric,
  credito_grupo numeric,
  comprador_nombre text,
  entregado boolean,
  pagado boolean,
  fecha_entrega text,
  estado_rendicion text,
  monto_rendido numeric,
  fecha_rendicion text,
  acreditado boolean,
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.venta_actividad enable row level security;
create index if not exists venta_actividad_created_at_idx on public.venta_actividad(created_at desc);

create table if not exists public.venta_tienda (
  id uuid primary key default gen_random_uuid(),
  producto_id text,
  producto_nombre text,
  beneficiario_id text,
  beneficiario_nombre text,
  comprador_nombre text,
  talle text,
  cantidad numeric,
  precio_unitario numeric,
  monto_total numeric,
  descuento_aplicado numeric,
  es_combo boolean,
  fecha text,
  forma_pago text,
  destino text,
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.venta_tienda enable row level security;
create index if not exists venta_tienda_created_at_idx on public.venta_tienda(created_at desc);

-- Access is intentionally restricted until each module receives its own RLS policy.
