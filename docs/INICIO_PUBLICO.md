# Inicio público

## Objetivo

La raíz pública de `la-mitre-definitivo` presenta la nueva plataforma antes de
pedir autenticación. Desde allí se puede iniciar sesión o acceder a la consulta
pública de estado de cuenta.

## Límites del cambio

- No se reemplaza el dashboard autenticado.
- No se cambia el onboarding existente.
- No se modifican permisos, datos, Supabase ni módulos operativos.
- Las rutas públicas de estado de cuenta, ficha de emergencia y campamentos se
  conservan.

## Resultado esperado

- Toda persona que visita `/`, tenga o no una sesión guardada, ve primero la
  portada pública de Brújula.
- La portada replica únicamente la identidad visual pública verde, crema y
  naranja de Brújula. No importa layouts, navegación ni módulos internos de la
  aplicación anterior.
- `Ingresar` abre `/login`, que mantiene la misma identidad visual pública y
  permite autenticarse con email y contraseña.
- Una sesión administrativa ya activa que abre `/login` continúa directamente
  al dashboard nuevo.
- `Consultar estado de cuenta` abre `/estado-cuenta`.
- Un administrador autenticado ve el dashboard actual en `/app`; su diseño,
  menú lateral y módulos no cambian.
- La ruta heredada `/app/administracion/inicio` redirige a `/app` para evitar que
  marcadores de la plataforma anterior mezclen ambas aplicaciones.
- Una sesión vencida o un error al recuperar el perfil no bloquean la portada
  ni el login; las rutas operativas continúan protegidas.
- Vercel reescribe las rutas internas hacia `index.html`, permitiendo abrir o
  actualizar enlaces profundos sin recibir un error 404.
