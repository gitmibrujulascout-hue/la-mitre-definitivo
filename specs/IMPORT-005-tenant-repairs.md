# IMPORT-005 — Reparación de importaciones y operación del tenant

## Alcance y esquema
La aplicación afectada es la-mitre-definitivo (commit e38060e), con tablas
beneficiario, config_general y tenants. No utiliza public.groups. No aplicar
migraciones del proyecto Brújula nuevo en esta base. El SQL fallido debe
identificarse antes de proponer una sustitución.

## Comportamiento
- Editar en lote exige campos con valores explícitos y limita la escritura a
  los IDs elegidos y al tenant activo, conservando RLS. Informar errores.
- Beca es una decisión explícita y editable también para Rovers. Cambiar rama
  o edad no modifica becas. No recalcular deudas históricas.
- CSV admite coma, punto y coma, tabulador, BOM, comillas y saltos en celdas.
- Rama explícita (incluidos alias scout) prevalece sobre edad. Categoría se
  usa como rama cuando corresponde. Una rama desconocida requiere corrección.
- Importar bajas, becas y grupos familiares explícitos; ausencia no equivale
  a falso. Conflictos con datos existentes requieren selección, incluso booleanos.
- Familia importada no crea cuentas, permisos ni parentescos legales.
- Fechas imposibles se rechazan antes de escribir. Tipo documental y empresa
  requieren migración aditiva en beneficiario.
- Recibos: extracción es borrador; no sustituir fechas ilegibles por hoy ni
  importes ilegibles por cero. Validar antes de guardar y exigir revisión.

## Riesgos y validación
El SQL recibido corresponde a 202607220001_autonomous_tenant_onboarding.sql
del proyecto nuevo y falla en su primera instrucción sobre public.groups.
No es una dependencia de esta aplicación; no se debe adaptar creando tablas
vacías. El CSV real todavía no está disponible. Los alias desconocidos
no se adivinan. Migraciones y Edge Functions requieren despliegue para surtir
efecto. Validar CSV, fechas, roles, booleanos, familia explícita, aislamiento
de actualización masiva, lint, tests y build. No modificar datos productivos
durante estas comprobaciones.

## Fase 5 — Validación
Se corrigieron parámetros de edición masiva, importación CSV, precedencia de
rama, fechas, estados booleanos, becas editables y borradores de recibos. Se
eliminaron imports sin uso detectados por ESLint (sin eliminar funcionalidad).
La migración aditiva solo agrega tipo_documento y empresa; no cambia filas.
La extracción visual sigue requiriendo revisión humana, no acredita pagos.
No hay un wizard de onboarding en este repositorio: el hallazgo anterior sobre
su finalización pertenecía al proyecto nuevo. La configuración integral de
cuotas, saldos y datos del grupo debe diseñarse sobre el esquema real.
El resumen informa becas, bajas y familias nuevas, y advierte sobre los valores
financieros predeterminados con acceso a Configuración de cuotas.

Resultado: 28 pruebas unitarias correctas; lint y build correctos. Prueba de
navegador con servicios simulados: nueve escenarios (edición masiva, beca Rover
e importación CSV en 360, 768 y 1280 px). No valida RLS productiva ni la calidad
de extracción contra los recibos reales del usuario, aún no disponibles.
