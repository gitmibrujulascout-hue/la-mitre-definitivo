# Propuesta simple para trabajar de a dos

1. Antes de empezar: actualizar main desde GitHub y crear una rama para el tema (por ejemplo codex/corregir-fechas o socio/mejorar-tienda).
2. Avisarse qué pantalla o servicio está tomando cada uno. Subir la rama al terminar cada bloque, sin subir secretos ni archivos de prueba locales.
3. Abrir una solicitud de integración (Pull Request). Revisar el resumen, las pruebas y la vista previa de Vercel.
4. Integrar a main solo con pruebas y compilación correctas. Si hay SQL nuevo, aplicar primero la migración de esa entrega. Actualizar la rama si main cambió durante el trabajo.
5. Después de integrar: ambos actualizan main antes de la próxima tarea. No usar force push en main.

## Automatización propuesta
En GitHub: proteger main, exigir Pull Request, al menos una revisión del otro socio y checks de lint/test/build/audit. Configurar una vista previa Vercel por PR y producción únicamente desde main. Esta propuesta no modifica permisos ni protecciones remotas.

## Esta entrega
Rama codex/fix-five-review-findings. Aplicar supabase/migrations/202609140001_atomic_tenant_batches.sql antes de publicar su frontend. Mantener los artefactos locales y credenciales fuera del commit. No instalar Docker para estas pruebas: PostgreSQL de prueba corre dentro de Node mediante PGlite.
