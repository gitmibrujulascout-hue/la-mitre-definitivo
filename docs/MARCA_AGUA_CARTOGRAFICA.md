# Marca de agua cartográfica

## Objetivo

Recuperar en la aplicación nueva la marca de agua del mapa centrado en
Argentina utilizada por la versión anterior de Brújula.

## Alcance

- El mapa aparece detrás del área de trabajo autenticada de cada tenant.
- La consola superadmin utiliza la misma marca para mantener una identidad
  visual única.
- La portada pública conserva su sello de brújula actual y no se modifica.
- El recurso se sirve localmente desde la aplicación y queda disponible en
  caché, sin depender de Base44 ni de una URL externa.

## Comportamiento visual

- La capa ocupa como máximo el primer alto de pantalla y queda fuera del flujo.
- En modo claro usa baja opacidad y mezcla `multiply` sobre el fondo crema.
- En modo oscuro usa mezcla `screen`, menor opacidad e inversión cromática.
- El contenido siempre queda por encima de la imagen.
- La marca tiene `pointer-events: none` y `aria-hidden`, por lo que no bloquea
  controles ni agrega ruido a lectores de pantalla.

## Límites

- No se modifican rutas, permisos, datos ni lógica de negocio.
- No se aplica la marca a documentos imprimibles ni pantallas públicas.

## Validación

- El panel de tenant y la consola superadmin compilan con la capa compartida.
- El mapa no altera el scroll, los clics ni la legibilidad del contenido.
- Las pruebas de acceso existentes continúan pasando.
