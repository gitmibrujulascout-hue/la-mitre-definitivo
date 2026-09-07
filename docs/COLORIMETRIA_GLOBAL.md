# Colorimetría global de Brújula

## Objetivo

La portada pública es la fuente visual de la marca. Toda la aplicación —sitio
público, acceso, panel de cada tenant y consola superadmin— debe compartir la
misma familia cromática verde bosque, naranja y crema.

## Alcance

- Unificar fondos, superficies, navegación, acciones, foco, gráficos y estados
  informativos mediante tokens globales.
- Conservar la portada pública actual sin alterar su composición.
- Reemplazar los azules, celestes, violetas y grises fríos heredados por tonos
  de bosque, salvia, naranja y neutros cálidos.
- Mantener diferencias reconocibles entre ramas scouts usando variaciones de la
  misma paleta.
- Conservar rojo únicamente para errores, deuda, acciones destructivas o alertas
  críticas, y verde para estados positivos.
- Aplicar equivalentes de la misma identidad en modo oscuro.

## Mapa semántico

- Fondo general: crema.
- Tarjetas y formularios: crema claro.
- Navegación principal: verde bosque profundo.
- Acción principal y selección activa: naranja oscuro con contraste AA.
- Información secundaria y hover: verde salvia suave.
- Texto principal: verde casi negro.
- Bordes: beige cálido.
- Foco: naranja.

## Límites

- No se modifican rutas, permisos, datos, Supabase ni lógica de negocio.
- Los colores funcionales de error y seguridad no se eliminan.
- Los documentos imprimibles conservan sus reglas propias cuando el color tiene
  significado contable o médico.

## Validación

- La portada, el login, el dashboard de tenant y la consola superadmin se ven
  como partes del mismo producto.
- No quedan superficies principales azules o celestes.
- Los estados de foco y los textos esenciales mantienen contraste legible.
- La aplicación compila y las pruebas de acceso continúan pasando.
