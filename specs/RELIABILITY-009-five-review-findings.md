# Correcciones de confiabilidad — septiembre de 2026

## Alcance
1. Operaciones masivas: transacción SQL con RLS del usuario (SECURITY INVOKER), tenant obligatorio, tablas explícitas y validación de columnas. Si falta un registro autorizado, falla todo. Pañuelos, confirmación de pedidos, marcado a proveedor, familias y fusión usan el mismo contrato. La fusión verifica versiones antes de crear/cancelar para impedir duplicación por concurrencia o reintento.
2. Contexto del grupo: todas las operaciones genéricas exigen tenant; rechazar tenant ajeno en filtros/payload y modificaciones de identidad. Errores públicos sin detalles internos. Sin fallback sin aislamiento.
3. Fechas: aceptar fecha ISO, día/mes/año con uno o dos dígitos y timestamp ISO con zona; validar calendario y hora antes de construir Date. Rechazar formatos desconocidos y fechas imposibles.
4. Exportación: generación compartida con ExcelJS ya instalado, encabezados aun sin filas, estado de progreso, error con reintento y descarga limpia. Sin carga externa de código.
5. Dependencias: actualizar versiones compatibles y evaluar alertas restantes. Eliminar dependencias sin uso; overrides transitivos únicamente compatibles y justificados por auditoría. No forzar downgrades que rompan funciones.

## Riesgos y entrega
Auditoría inicial: 26 alertas. Tras actualizaciones compatibles: 6 moderadas. `react-quill` no tiene consumidores y se elimina. ExcelJS usa únicamente uuid.v4 (sin buffers externos); override a uuid 11.1.1 conserva require/v4 y corrige límites de buffer. React Router 6 no tiene corrección publicada para las alertas actuales: se especifica migrar react-router-dom a 7.18.3 conservando BrowserRouter/Routes/Route/Navigate y React 18, y verificar navegación/login en navegador. No se adopta SSR ni router de framework.
La operación masiva requiere aplicar la migración nueva antes del frontend. Si falta, debe fallar con indicación de actualización; nunca recurrir a escrituras parciales. RLS real continúa siendo la autoridad. No cambiar datos reales durante pruebas. No prometer cero vulnerabilidades sin auditoría final.

## Validación
Se agrega @electric-sql/pglite como dependencia de desarrollo para que las pruebas SQL de rollback/RLS sean reproducibles desde npm test y no dependan de archivos locales sin seguimiento. Sin nuevas dependencias de ejecución para esta función.
Playwright se declara como dependencia de desarrollo para repetir la verificación de navegador; en Windows usa Edge instalado, en otros sistemas requiere instalar Chromium para pruebas. scripts/check-review-ui.mjs prueba nueve exportaciones (tres reportes, tres anchos), fallo, reintento, modo oscuro y bloqueo de rutas privadas del bundle con React Router actualizado. Se monta el Toaster de Sonner que faltaba en App: sin él los avisos enviados no eran visibles.
Tests de fechas, tenant ausente/ajeno, RLS, rollback al fallar segundo registro, versiones de fusión, exportación con datos ficticios y error. npm test/lint/build y auditoría. Verificar UI a 360/768/1280. Propuesta Git en documentación, sin cambiar protecciones remotas sin pedido.

## Fase 5 — validación de entrega
- npm test: 53 pruebas correctas, incluida ejecución real de la migración dos veces en PostgreSQL aislado, rollback, registro de otro tenant, denegación RLS, columnas prohibidas, reintento de fusión y fallo al crear el destino.
- npm run lint y npm run build: correctos.
- scripts/check-scoped-access.mjs: correctos los permisos por rama, salud, becas y aislamiento existentes.
- scripts/check-review-ui.mjs: nueve exportaciones XLSX con fallo provocado y reintento en los tres tamaños; descarga PDF, modo oscuro y navegación a login/recuperación. Datos ficticios y sin escrituras remotas.
- npm audit: cero alertas (antes 26). Se retiraron react-quill y lodash porque no tenían consumidores; ExcelJS se conserva con override compatible. La actualización de dependencias se fija en package-lock.json.
- La edición masiva de beneficiarios, pañuelos, pedidos, fusión y vínculos familiares utiliza RPC transaccional. Las altas individuales y los filtros genéricos exigen tenant y no tienen reintentos sin filtro.
- Pendiente de activación: aplicar 202609140001_atomic_tenant_batches.sql en el proyecto Supabase y después integrar/publicar la rama. No se aplicó SQL remoto durante esta entrega. La propuesta de protección de main queda documentada, sin modificar la configuración de GitHub.
