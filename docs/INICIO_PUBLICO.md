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

- Una persona sin sesión que visita `/` ve la portada de Mi Brújula Scout.
- `Ingresar` abre `/login`.
- `Consultar estado de cuenta` abre `/estado-cuenta`.
- Un administrador autenticado continúa viendo el dashboard actual en `/`.
- La ruta heredada `/app/administracion/inicio` redirige a `/` para evitar que
  marcadores de la plataforma anterior mezclen ambas aplicaciones.
- Una sesión vencida o un error al recuperar el perfil no bloquean la portada
  ni el login; las rutas operativas continúan protegidas.
