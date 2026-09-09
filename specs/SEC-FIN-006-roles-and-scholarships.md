# SEC-FIN-006 — Roles con alcance y becas configurables

## Decisiones
La fuente de personas continúa siendo beneficiario: reutilizar nombre y email
para invitar, sin crear otra ficha ni conceder accesos por una importación.
Los roles se acumulan; el rol de rama requiere una o varias ramas explícitas.
El usuario confirmó acceso de rama a datos básicos y contactos de emergencia,
no a historia médica, finanzas ni administración de usuarios.

## Seguridad
Rutas y menú consumen permisos centrales. La base refuerza permisos por tabla
con políticas restrictivas que no pueden ampliarse mediante políticas viejas.
Tesorería obtiene una proyección de personas sin información médica. Rama
obtiene únicamente sus personas y contactos. Familias conservan su RPC privada.
La eliminación de un rol de rama elimina sus alcances. No hay fallback a admin
si falla la lectura de roles. Refrescar sesión y limpiar caché al cambiar acceso.
El inicio sin permiso de caja no carga ni presenta datos de tesorería.

## Becas
Cada tenant configura una lista de ramas con beca completa de cuota mensual.
Por persona: null = heredar regla, true = beca individual, false = cobra cuota.
La base calcula becado para que listados, reportes, cuotas y directorios usen
el mismo resultado. La regla nunca cambia pagos registrados ni campamentos.
La migración conserva becas verdaderas existentes como excepciones individuales;
los demás miembros heredan una regla inicialmente vacía. No se identifica el
tenant actual por nombre ni se aplica Rovers globalmente: su admin selecciona
Rovers en Configuración de cuotas. Los importes históricos calculados dinámicamente
pueden cambiar al cambiar la beca, igual que con la edición individual actual;
se muestra este efecto antes de guardar.

## Validación
Tests permitidos/denegados para multirrol, rama, salud, campos prohibidos y becas
en dos tenants con reglas distintas. Lint, tests y build; UI móvil y desktop.
La migración debe aplicarse antes del frontend. No se alteran datos productivos
en la validación. La política SQL requiere prueba con sesiones reales al desplegar.

## Fase 5 — Resultado y límites
- 31 pruebas automatizadas aprobadas; lint y compilación de producción correctos.
- PostgreSQL aislado: migración ejecutada dos veces; políticas permisivas antiguas
  no amplían acceso; rama no puede leer ni modificar la tabla médica; Tesorería
  recibe una proyección sin salud; multirrol sólo recibe contactos en su rama;
  revocar el rol elimina alcances; reglas y excepciones no cruzan tenants.
- 15 escenarios de navegador mock a 360, 768 y 1280 px: CSV, ficha Rover,
  edición masiva, regla de becas y vista de ramas con multirrol. Sin desbordes
  horizontales ni errores de página. Inspección visual móvil de becas realizada.
- Para reproducir PostgreSQL se usa PGlite exclusivamente como herramienta
  aislada: `npm install --prefix test-artifacts/pg-check --no-save --package-lock=false @electric-sql/pglite`
  y `node scripts/check-scoped-access.mjs`. No se agrega al bundle ni a las
  dependencias de la aplicación. La fixture reemplaza auth y omite pgcrypto,
  conserva las tablas y funciones reales de autorización que se prueban.
- Aplicar `202609090002_scoped_roles_and_scholarships.sql` antes del frontend.
  No utiliza public.groups. No se ejecutó en producción ni se desplegó.
  La configuración y los accesos requieren comprobarse con sesiones reales allí.
- Rovers no se activa automáticamente en ningún tenant: su administración
  selecciona esa rama en Cuotas y becas. Las becas ya existentes se conservan.
- El autocompletado de invitaciones reutiliza nombre y email de voluntarios;
  no crea vínculos familiares ni otorga roles a partir de una importación.
  Los roles reservados siguen sin pantallas operativas. No se afirma haber
  completado la normalización de todos los módulos de la aplicación heredada.
