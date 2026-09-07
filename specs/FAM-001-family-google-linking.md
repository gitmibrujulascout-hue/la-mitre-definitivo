# FAM-001 — Acceso familiar con Google y vínculo automático

## Objetivo

Permitir que una familia ingrese con una cuenta Google verificada y acceda a
los menores que coincidan exactamente con los datos existentes del tenant,
sin obligar al equipo voluntario a aprobar cada alta normal.

## Reglas

- La cuenta Google debe tener email verificado.
- La coincidencia automática exige tenant, DNI, nombre completo normalizado y
  fecha de nacimiento exactos.
- Una cuenta puede vincularse con varios menores y un menor puede tener varias
  cuentas familiares autorizadas.
- Las coincidencias ambiguas o incompletas quedan pendientes y no revelan si
  el menor existe.
- La familia visualiza la ficha médica digitalizada, pero no la edita.
- Las correcciones se solicitan al tenant.
- No se consultan tablas operativas directamente desde rutas públicas.
- Los intentos se registran y tienen límite para evitar enumeración de datos.

## Alcance de esta fase

Crear tablas, RLS y funciones RPC para el vínculo familiar. La pantalla Google
y la configuración del proveedor OAuth se realizan en la siguiente fase.
