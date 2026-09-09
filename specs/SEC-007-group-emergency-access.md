# SEC-007 — Emergencias para el equipo adulto del grupo

El dueño confirmó que educadores, dirigentes y colaboradores del mismo grupo
deben consultar fichas médicas digitales y contactos sin restricción de rama.
Esta decisión reemplaza la restricción médica de SEC-FIN-006 sólo en Emergencias.

Se autoriza a roles activos de administración, jefatura, tesorería, responsable
de rama, apoyo e institucional. Familia, juvenil y consulta no reciben este
acceso; una función importada o la mayoría de edad no otorgan permisos.
El administrador asigna Equipo de apoyo a colaboradores sin otro rol operativo.

Una RPC de sólo lectura entrega identidad, salud y contactos de beneficiarios activos
del tenant autorizado. No entrega finanzas ni permite modificar fichas. Las
fichas de voluntarios y educadores quedan fuera de esta consulta compartida.
consultas habituales de personas conservan sus alcances; Mis ramas no cambia.
El directorio reutiliza la ficha existente, con búsqueda por nombre o DNI,
sin duplicar personas. Se protegen la ruta antigua y la ruta del directorio.

Validación: casos permitidos y denegados, tenant ajeno, membresía suspendida,
sin sesión, ausencia de permisos de escritura y proyección sin finanzas;
lint, test, build y revisión de interfaz en 360, 768 y 1280 px.
La migración es aditiva porque SEC-FIN-006 ya fue aplicada por el usuario.

## Fase 5 — Validación
33 pruebas unitarias aprobadas. PostgreSQL aislado valida la nueva migración
repetida, acceso desde otra rama, todos los roles del equipo adulto, exclusión
de finanzas y fichas de voluntarios, denegación a familias, juveniles, consulta,
cuentas suspendidas, anónimas y de otro tenant. No amplía escritura médica.
Nueve escenarios mock de navegador verifican ficha de otra rama, error y vacío
en 360, 768 y 1280 px. Lint y compilación de producción verificados.

Aplicar 202609090003_group_emergency_access.sql antes de publicar este frontend.
No se ejecutó en producción durante estas pruebas. El SQL anterior no incluye
esta ampliación, acordada después. Las fichas muestran los datos disponibles:
esta mejora no inventa ni completa antecedentes médicos ausentes.
