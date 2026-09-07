# SEC-001 — Aislamiento por tenant, permisos e invitaciones multirrol

## Objetivo

Convertir la autenticación básica actual en una base multi-tenant segura para
Brújula. Cada usuario debe operar únicamente dentro de tenants a los que esté
asignado y sólo con los permisos derivados de sus roles activos.

Esta fase preserva los módulos operativos existentes. No incorpora el
onboarding de la aplicación anterior ni crea todavía portales específicos para
familias o miembros juveniles.

## Alcance

### Base de datos

- Mantener `profiles.is_super_admin` como privilegio global independiente.
- Mantener una membresía única por usuario y tenant.
- Permitir múltiples roles por membresía mediante
  `tenant_membership_roles`.
- Soportar estos roles canónicos:
  - `tenant_admin`
  - `group_leadership`
  - `administration`
  - `treasury`
  - `branch_leader`
  - `support`
  - `institutional`
  - `family`
  - `youth`
  - `viewer`
- Migrar las membresías heredadas `admin` a `tenant_admin` y `member` a
  `viewer` sin perder accesos actuales.
- Crear invitaciones de un solo uso, con vencimiento y token almacenado como
  hash.
- Registrar en auditoría altas, aceptaciones, cambios de roles y suspensiones.
- Impedir que un tenant quede sin ningún administrador activo.
- Las mutaciones de membresías, roles e invitaciones se realizan únicamente
  mediante funciones SQL controladas; el cliente no escribe directamente esas
  tablas.

### Aplicación

- Resolver roles y permisos desde una única fuente en
  `src/services/access/`.
- Validar el tenant guardado antes de usarlo; `localStorage` es sólo una
  preferencia y nunca una autorización.
- Proteger cada ruta administrativa con un permiso explícito.
- Mostrar en el menú únicamente módulos autorizados.
- Agregar `/usuarios` para listar accesos, crear invitaciones, copiar el enlace
  seguro, editar roles y suspender/reactivar usuarios.
- Agregar `/aceptar-invitacion` para iniciar sesión o crear una cuenta y aceptar
  una invitación.
- Mantener a un superadministrador con acceso global y, a la vez, con sus roles
  propios dentro de cada tenant.

## Matriz inicial de acceso

La aplicación actual contiene módulos administrativos con controles de edición
integrados. Para evitar mostrar acciones que luego serían denegadas, esta fase
habilita esos módulos sólo a roles operativos compatibles:

- `tenant_admin`: todos los módulos del tenant y gestión de usuarios.
- `administration`: miembros, campamentos, configuración, afiliaciones,
  consultas familiares, reportes y usuarios.
- `treasury`: pagos, gastos, cuenta corriente, caja, cuotas, tienda,
  actividades económicas, afiliaciones y reportes.
- `group_leadership`: miembros, campamentos, emergencias, reportes y usuarios.
- Los roles de rama, apoyo, institucional, familia, juvenil y consulta quedan
  registrados para las siguientes fases, pero no reciben acceso a pantallas
  administrativas incompatibles.

## Seguridad de tablas operativas

Se entrega una migración separada para las políticas RLS de las entidades
operativas. Su activación debe coordinarse con la protección de las tres rutas
públicas heredadas (`estado-cuenta`, `ficha-emergencia` y campamentos por
código), porque actualmente consultan tablas completas desde el navegador.
Hasta resolver ese acceso público no se debe aplicar una política que rompa esas
rutas ni conservar políticas anónimas que permitan leer datos entre tenants.

## Estados de interfaz

- Cargando: esqueletos en listado de usuarios e invitaciones.
- Vacío: explicación y acción para crear la primera invitación.
- Error: mensaje seguro, sin detalles internos de Supabase, y botón para
  reintentar.
- Éxito: enlace copiable, confirmación de roles actualizados y confirmación de
  aceptación.

## Criterios de aceptación

1. Un superadministrador siempre entra en la consola global, aunque también sea
   administrador de un tenant.
2. Un administrador de tenant sólo ve sus tenants y puede gestionar usuarios
   dentro de ellos.
3. Un usuario puede tener más de un rol simultáneamente.
4. Una ruta no autorizada muestra una denegación clara y no renderiza el módulo.
5. El menú y las rutas usan la misma matriz central de permisos.
6. Alterar el tenant en `localStorage` no concede acceso.
7. Una invitación sólo puede aceptarla una sesión con el mismo email, antes de
   su vencimiento y una única vez.
8. No se puede suspender al propio usuario ni eliminar el último
   `tenant_admin` activo.
9. Existen pruebas para accesos permitidos y denegados.
10. La experiencia funciona a 360 px, 768 px y 1280 px y hereda light/dark mode.

## Riesgos y decisiones pendientes

- Las páginas públicas heredadas exponen información sensible con mecanismos
  insuficientes. Antes de activar RLS estricto sobre sus tablas se debe decidir
  si se mantienen con código seguro, pasan al futuro portal familiar o exigen
  inicio de sesión.
- El envío automático por email requiere una función backend con proveedor de
  correo. Esta fase entrega un enlace seguro copiable y aceptable sin usar
  `service_role` en el cliente.
- La tabla heredada `beneficiario` mezcla datos generales y médicos. Separar sus
  columnas sensibles será parte de la fase de gobierno médico.

## Validación de cierre

- Pruebas unitarias de matriz de permisos y validaciones de invitación.
- Compilación de producción.
- Lint de todos los archivos modificados.
- Revisión manual del SQL antes de aplicarlo en Supabase.

