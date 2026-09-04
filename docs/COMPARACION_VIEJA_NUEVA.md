# Comparación controlada: aplicación actual y aplicación nueva

Fecha de revisión: 2026-09-04

## Hallazgo principal

La aplicación publicada en `mibrujulascout.com.ar` ya tiene una implementación Supabase propia. No es seguro copiar tablas o reemplazar el dominio directamente porque la aplicación vieja contiene información productiva y capacidades que todavía no existen en este repositorio.

## Funciones observadas en la aplicación vieja

- Consola de superadministración.
- Gestión de tenants y estado del onboarding.
- Búsqueda de tenant o usuario.
- Invitaciones y creación de tenants.
- Alertas y tickets.
- Métricas globales: tenants, activos, alertas y deuda total.
- Filtros por estado y plan.
- Cambio de plan.
- Acceso “ver como admin”.
- Estado de salud del tenant.
- Sesión Supabase real con impacto en datos productivos.

## Situación de la aplicación nueva

- GitHub y Vercel conectados al repositorio `gitmibrujulascout-hue/la-mitre-definitivo`.
- Supabase nuevo configurado para `mibrujulascout`.
- Auth, perfiles, tenant La Mitre y membresías creados.
- Sebastián y Facundo son superadministradores y administradores de La Mitre.
- 24 tablas preparadas con `tenant_id`.
- Storage `app-files` creado.
- Contexto de tenant activo implementado.
- Función `ai-extract` publicada con modelo `o4-mini`.
- Módulos operativos heredados disponibles: beneficiarios, pagos, gastos, caja, campamentos, afiliaciones, tienda, actividades y reportes.

## Diferencias críticas antes de hacerla principal

| Área | Aplicación vieja | Aplicación nueva | Acción segura |
|---|---|---|---|
| Datos | Supabase productivo | Supabase nuevo vacío | Exportar y mapear, nunca copiar a ciegas |
| Super admin | Consola avanzada | Roles preparados, sin consola equivalente | Implementar panel después del inventario |
| Tenants | Varios tenants reales | La Mitre inicial | Crear importación por tenant |
| Onboarding | Flujo y alertas existentes | Flujo propio de la nueva aplicación | Conservarlo; comparar sólo campos faltantes, sin duplicarlo |
| Archivos | Recursos históricos | Bucket nuevo | Migrar archivos con inventario y verificación |
| IA | Funciones existentes en la aplicación vieja | `ai-extract` con `o4-mini` | Probar con archivos reales |
| Dominio | `mibrujulascout.com.ar` | Dominio temporal de Vercel | Mantener ambos hasta aceptar la nueva |
| Seguridad | Políticas productivas existentes | RLS base y tenant activo | Auditar antes de mover usuarios |

## Orden de migración recomendado

1. Congelar cambios estructurales en la aplicación vieja durante la comparación.
2. Obtener un inventario/exportación de tablas, archivos, usuarios y funciones de la aplicación vieja.
3. Mapear cada tabla vieja contra las tablas nuevas y definir transformaciones.
4. Importar primero configuración, tenant y usuarios de prueba.
5. Importar datos de La Mitre en una carga reversible, con `tenant_id`.
6. Verificar conteos, totales financieros y archivos.
7. Comparar módulo por módulo con usuarios de prueba.
8. Hacer una prueba de aceptación con Sebastián y Facundo.
9. Recién entonces asignar el dominio principal a Vercel.

## Criterio para no romper la aplicación

La aplicación vieja conserva el dominio principal hasta que la nueva pase la lista de aceptación. La nueva se prueba en su URL de Vercel. Ninguna migración debe borrar datos viejos; toda carga debe ser idempotente y registrar errores.

## Próximo paso técnico

Conservar el onboarding de la nueva aplicación. El siguiente trabajo será inventariar datos, permisos y funciones de la aplicación vieja, sin reemplazar ese flujo. El repositorio no contiene una exportación histórica, por lo que esa parte no puede ejecutarse automáticamente todavía.
