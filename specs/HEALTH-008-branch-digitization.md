# HEALTH-008 — Digitalización de salud por rama

Cada responsable de rama digitaliza las fichas de los beneficiarios activos
de sus ramas asignadas. Todos los adultos autorizados conservan la lectura de
emergencias del grupo. Se agrega escritura acotada de salud mediante RPC;
no se habilita UPDATE general de beneficiario al responsable.

Un aviso persistente en el layout al ingresar muestra la cantidad de fichas
sin digitalización confirmada y lleva a Mis ramas. No se deduce la entrega
de una ficha a partir de campos importados. Sin regla anual nueva: la marca
representa una digitalización revisada, con fecha y autor. Las fichas actuales
se pueden revisar y confirmar en el mismo flujo sin volver a transcribirlas.

Flujo: elegir persona de su rama → cámara trasera o PDF/imagen → extracción
privada → revisar identidad y cada campo → confirmar guardado. Hasta cuatro
archivos, JPEG/PNG/WebP/PDF, máximo 12 MB en total. Captura mediante input
capture=environment; la disponibilidad de cámara depende del celular/browser.
Las imágenes se envían al backend autenticado y al proveedor configurado con
store:false. No se publican ni guardan copias en app-files. La ficha digital
canónica conserva los datos revisados, no una segunda ficha ni fotos públicas.

La extracción sólo transcribe: no diagnostica, no inventa valores ni confunde
ausente con “No tiene”. Devuelve evidencia y dudas por campo. Si el DNI leído
difiere del seleccionado o aparecen varias personas, se bloquea ese resultado.
Los campos existentes se mantienen salvo selección explícita del reemplazo.
Una lectura fallida permite revisar manualmente. La confirmación de identidad
y revisión es obligatoria. Ninguna IA garantiza lectura perfecta de manuscritos;
se debe validar con documentos representativos anonimizados antes del despliegue.

Seguridad: validación de sesión y alcance antes de gastar IA; límite de tamaño,
tipos y respuesta; sin URLs arbitrarias, sin logs médicos, sin service role
cliente. RPC guarda sólo whitelist de salud; validación numérica y control
de concurrencia sobre el contenido médico; autor y fecha auditables sin payload
médico en auditoría. Reasignación/revocación impide guardar. Roles de apoyo,
familia y tesorería solos no obtienen escritura. Administradores conservan gestión.

Validación: tests de identidad, números, preservación de valores, respuestas
ilegibles, RLS/RPC permitida y denegada por rama/tenant/rol, concurrencia y marca
de pendiente. Navegador mock 360/768/1280 para captura, revisión, aviso y guardado.
Lint/test/build. Nueva función health-extract y migración antes del frontend.

Referencias de integración: https://developers.openai.com/api/docs/guides/images-vision
y https://developers.openai.com/api/docs/guides/file-inputs (consultadas en esta tarea).

## Fase 5 — Resultado y despliegue
- Se unificó la importación médica en un diálogo con cámara, galería/PDF,
  vista de fotos originales en memoria, evidencia por campo y revisión explícita.
  El importador anterior se retiró por duplicar esquemas, usar URLs públicas
  y descartar declaraciones negativas. La importación del editor anterior
  también pasa por el nuevo servicio privado; la edición manual se conserva.
- 38 pruebas unitarias, PostgreSQL aislado (migración repetida, rama/tenant,
  números, revisión, campos prohibidos, concurrencia, revocación y pendientes),
  validación de tipos del backend y un test del handler con proveedor simulado.
  Nueve escenarios de navegador mock a 360/768/1280: captura, lectura,
  identidad incorrecta, error con alternativa manual, confirmación y aviso.
- Lint y build de producción. No se usaron fichas médicas reales ni se verificó
  una cámara física. No se afirma precisión OCR real sin esa evaluación.
- Sin nuevos paquetes de runtime frontend. El backend usa Supabase y Zod con
  versiones fijadas. La verificación con Deno se ejecuta sin alterar dependencias:
  `npx --yes deno test --no-lock --node-modules-dir=none --allow-env supabase/functions/health-extract/handler_test.ts`.
- Activación: aplicar `202609090004_branch_health_digitization.sql`, desplegar
  `health-extract` con verificación JWT activa y el secreto OPENAI_API_KEY
  existente, y después publicar frontend. Modelo predeterminado o4-mini, igual
  al extractor ya usado; HEALTH_EXTRACTION_MODEL permite configuración backend.
- No se archivaron documentos originales: se conserva la ficha estructurada
  revisada con fecha y autor. No se migraron ni eliminaron archivos antiguos
  que pudieran existir en app-files; su revisión es una tarea separada.
