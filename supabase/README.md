# Migración de Base44 a Supabase

Este directorio contiene las migraciones SQL y las funciones de Supabase para reemplazar progresivamente la dependencia de Base44.

## Proyecto de desarrollo

- Proyecto: `mibrujulascout`
- Referencia: `wwqktbfgviutrclrmklg`
- Región: `us-east-1`

## Orden de migración

1. Auth y perfiles de usuario.
2. Beneficiarios y datos de salud.
3. Cuotas, pagos y créditos.
4. Afiliaciones.
5. Caja, gastos y movimientos bancarios.
6. Campamentos.
7. Actividades económicas.
8. Tienda.
9. Archivos, importaciones e integraciones externas.

Las políticas RLS deben quedar definidas junto con cada módulo antes de conectar ese módulo al frontend.
