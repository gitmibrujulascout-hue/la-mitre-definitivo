# Entrada y consola de superadministración

## Objetivo

Separar la experiencia global de Brújula de la operación diaria de cada grupo
scout. Una persona superadministradora no debe ingresar por defecto al
dashboard de un tenant.

## Reglas de entrada

- `/` continúa siendo la portada pública para cualquier visitante, incluso si
  conserva una sesión.
- Una cuenta administradora de tenant inicia en `/app`.
- Una cuenta con `is_super_admin = true` inicia en `/super-admin`, aunque además
  tenga el rol `admin` dentro de un tenant.
- La condición de superadministrador tiene prioridad al decidir el destino
  inicial.
- Una cuenta sin ninguno de esos permisos no accede a áreas administrativas.

## Consola superadmin

- Usa una navegación global propia y no muestra el menú ni la identidad visual
  de La Mitre.
- Permite listar todos los tenants visibles por RLS, revisar su estado y crear
  un tenant nuevo.
- Si la persona también pertenece a un tenant, ofrece una acción explícita para
  abrir su panel operativo. Ese acceso no cambia el destino inicial de la
  cuenta.
- La autorización real continúa en Supabase mediante RLS y
  `public.is_super_admin()`; la interfaz no sustituye esas políticas.

## Límites

- No se modifica la portada pública.
- No se modifica el dashboard ni los módulos operativos del tenant.
- No se cambian tablas, políticas ni datos de Supabase.
- No se importa ninguna estructura interna de la aplicación anterior.

## Validación

- Cuenta superadmin, incluso con rol adicional de tenant: destino
  `/super-admin`.
- Cuenta admin de tenant sin privilegio global: destino `/app`.
- Cuenta sin permiso administrativo: acceso rechazado.
