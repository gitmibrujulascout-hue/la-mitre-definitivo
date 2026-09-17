# ACCESS-011 — Perfiles, ramas y asociación civil

## Decisiones confirmadas por el dueño (16/09/2026)

Una cuenta puede acumular cargos, sin ampliar el alcance de un cargo por pertenecer a otra rama. Administrador y jefe de grupo administran cargos generales. Jefe de rama nombra subjefe/ayudantes entre adultos ya pertenecientes al grupo; delega edición, inactivación y cambio de rama. Un jefe por rama, una jefatura de rama por persona. Las asignaciones adicionales deben ser de ayudante/subjefe.

Asociación opcional, única por grupo: presidente, representante legal, secretario y vocales. Tesorería unificada. Apoyo, voluntarios y asociación: contactos de emergencia y resumen de alergias, medicación y alertas; educadores: ficha completa del grupo. Padres: sólo hijos vinculados explícitamente. Caminantes/Rover: calendario, su cuenta y caja de su rama.

Jefe digitaliza fichas. Padre confirma o informa error, nunca modifica el contenido. Corrección de transcripción contra original con registro. Nueva información requiere documento nuevo. Vinculación familiar por administrador/jefe de grupo/jefe de rama; sugerencias por apellido no autorizan acceso.

Cajas por rama/actividad; movimientos visibles a jefe de esa rama, jefatura, tesorería y asociación. Transferencias aprobadas por tesorero y jefes de origen/destino. Votaciones secretas creadas por jefe de grupo, padrón explícito de adultos/padres y Caminantes/Rover; una persona/un voto, sin vínculo voto-identidad en tablas de aplicación.

Becas porcentuales por período, individual prevalece sobre rama. Afiliaciones excluidas. Campamentos/actividades requieren tesorero y jefe de grupo. Baja reversible, conserva deuda anterior, no genera cuotas durante inactividad. Mandatos con vencimiento, alertas persistentes, prórroga con motivo; vencimiento no revoca acceso.

## Implementación y límites

Migraciones incrementales sobre el esquema real `beneficiario`, nunca `groups`. RLS y RPC validan tenant, rol, alcance y estado activo. Las tablas nuevas no permiten escrituras directas. Reutilizar padrón y cuentas existentes. Mantener compatibilidad de lecturas existentes sin ampliar permisos. No asignar cargos ni vincular personas reales automáticamente durante el despliegue.

Las becas/estados históricos requieren conservar períodos para evitar alterar deuda pasada. Cajas nuevas no inventan saldos iniciales ni duplican movimientos existentes. No registrar datos médicos ni votos en auditorías; sólo metadatos de operaciones. Las alertas son internas a la aplicación; no se envían correos ni WhatsApp sin autorización específica.

## Validación obligatoria

Tests permitidos/denegados, entre tenants y entre ramas, multirrol sin escalada; unicidad de jefaturas; parentesco explícito; proyecciones médicas; secreto y voto único; aprobaciones de transferencias/becas; vencimientos; lint, tests y build; UI 360/768/1280. Aplicar SQL antes de activar cliente dependiente y verificar despliegue real. No declarar producción completa mientras falte migración o verificación.

## Fase 5

Implementación local (17/09/2026): espacio Mi grupo, resolver de roles y permisos, asignaciones por rama con delegación, asociación opcional, mandatos, vínculos e invitaciones familiares, cuenta juvenil, proyecciones de salud, revisión familiar, calendario/tareas, cajas con aprobaciones, voto secreto y becas por período. Se reutilizan padrón, cuentas, calendario y digitalización existentes.

Las becas se pueden revisar desde hoy o una fecha futura dentro de su vigencia; se conserva el tramo anterior. Campamentos/actividades vuelven a requerir las dos aprobaciones. Se revalidan cargos de aprobadores pendientes y del emisor de una invitación. La elegibilidad juvenil se verifica también al votar.

Se retira la condonación automática con pagos ficticios de importe cero al dar una baja. Los nuevos cobros de varios meses se separan por mes según sus valores y becas; los pagos parciales distribuyen proporcionalmente el importe y conservan todos los centavos. El alta conjunta de pagos usa una sola inserción. Las lecturas individuales de créditos recuperan un método del adaptador que faltaba, siempre limitado por tenant.

Validación local: lint correcto; 71 pruebas aprobadas, incluyendo migraciones reales en PGlite con RLS y escenarios permitidos/denegados entre tenants y ramas, aprobaciones revocadas, doble voto, edición de becas, fechas imposibles, invitación familiar y separación de cobros por mes; build correcto. No se instalaron dependencias nuevas. UI simulada con datos ficticios: ocho secciones sin desborde horizontal en marcos de 360/768/1280 px, confirmación médica que retira el recordatorio, voto que desaparece al completarse, familia sin gestión, juvenil con caja de sólo lectura y error con reintento.

Límites que requieren verificación antes de publicar: pruebas de navegador con servidor simulado, no autenticación real de cada perfil contra producción; cotejar esquema y migraciones ya aplicadas en el proyecto correcto. Las cajas nuevas comienzan sin saldo y no trasladan automáticamente movimientos de las cajas heredadas. Se conservan becas heredadas fuera de los períodos nuevos. Los valores históricos por defecto y bonificaciones de cuotas heredados no se redefinen en esta entrega; deben revisarse por grupo antes de uso financiero en tenants nuevos. No se migran pagos históricos ni se recalculan sus imputaciones. Los flujos heredados de consumo de créditos todavía actualizan crédito y pago en operaciones distintas; su transacción completa es un pendiente identificado, fuera de las transferencias nuevas que sí son atómicas.

Estado de publicación: pendiente. La sesión de Supabase disponible no da acceso al proyecto wwqktbfgviutrclrmklg. No se aplicó ninguna de estas cuatro migraciones a producción. No integrar en main ni declarar despliegue hasta verificar la base y las sesiones reales.

## Orden de publicación

1. Confirmar repositorio la-mitre-definitivo y proyecto Supabase wwqktbfgviutrclrmklg; recuperar el estado actualizado de main antes de integrar.
2. Inspeccionar el registro de migraciones y respaldo del proyecto. Aplicar una sola vez, en orden, las migraciones 202609160001, 202609160002, 202609160003 y 202609160004 de este repositorio. No pegar de nuevo el SQL antiguo que referencia public.groups.
3. Si aparece REVIEW_EXISTING_BRANCH_ASSIGNMENTS, resolver con el administrador qué jefatura conservar: la migración no decide cargos por su cuenta. Si aparece REVIEW_LEGACY_ACTIVITY_DATES, revisar fechas de bajas/reingresos existentes antes de continuar. No quitar estas validaciones para forzar el despliegue.
4. Verificar permisos y proyecciones con perfiles de prueba autorizados. Coordinar la activación del cliente: se reemplazan RPC familiares antiguas y el nuevo cliente requiere las nuevas proyecciones.
5. Integrar la rama, comprobar el commit publicado por Vercel y verificar navegación, permisos y consultas reales sin crear movimientos financieros ficticios.
