# Estado de migración Mi Brújula Scout

## Completado

- Repositorio original conectado a Vercel desde `main`.
- Autenticación, perfiles, esquema inicial y superadministradores en Supabase.
- Multi-tenancy base, 24 columnas `tenant_id` y Storage `app-files` preparados.
- Tenant `la-mitre` creado; Sebastián y Facundo son `admin` del tenant y superadministradores globales.
- Adaptador de datos y subida de archivos conectados a Supabase.
- Contexto de tenant activo agregado al adaptador: consultas, altas y operaciones masivas quedan asociadas a La Mitre.
- Edge Function `ai-extract` preparada para reemplazar IA y extracción estructurada de Base44 mediante OpenAI Structured Outputs.
- Plugin de compilación de Base44 retirado.

## Próximas fases

1. Asignar `tenant_id` a los registros históricos cuando se importen.
2. Importar los datos históricos mediante una exportación autorizada.
3. Publicar `ai-extract` y configurar `OPENAI_API_KEY` en secretos de Supabase.
4. Migrar imágenes/documentos externos al bucket `app-files`.
5. Reemplazar progresivamente `base44Client` por módulos nativos.
6. Crear políticas específicas por tenant y probar cada rol.
7. Configurar dominio de prueba y pruebas de aceptación.

No se elimina Base44 ni se modifican datos productivos hasta validar cada módulo.
