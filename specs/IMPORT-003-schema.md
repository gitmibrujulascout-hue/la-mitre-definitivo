# Extracción compatible con esquemas estrictos

La prueba en producción no muestra la vista previa ni conserva el error. Agregar estado visible y seguro con etapa y código HTTP para distinguir carga, extracción y procesamiento sin mostrar datos del proveedor.

Normalizar recursivamente los esquemas enviados a ai-extract: cada objeto declara additionalProperties false y requiere todas sus propiedades. Conservar el original sin mutarlo. Aplicar a ambas entradas de integración para cubrir beneficiarios y comprobantes. Verificar con pruebas de objetos anidados y arrays, lint y build.

Riesgos pendientes: validar archivos XLSX y PDF reales de prueba, acceso a Storage y límites del proveedor. La corrección del esquema no certifica el circuito completo.

## Validación 2026-09-08

Se corrigió además UploadFile: sus consumidores pasan `{ file }`, mientras la implementación esperaba el Blob directamente. Ahora acepta ambas formas y rechaza valores que no son Blob.

En producción, con sesión de superadmin y tenant La Mitre, los archivos sintéticos `import-test.pdf` y `import-test.xlsx` llegaron a la vista previa con exactamente PRUEBA FICTICIA ALFA (99000001) y PRUEBA FICTICIA BETA (99000002), ambas Tropa. Se canceló antes de persistir beneficiarios. Compilación y 17 pruebas aprobadas. Lint general mantiene errores previos ajenos a esta corrección.

Límites de esta validación: no prueba importación final, archivos grandes, PDF escaneado ni cuenta con solo rol de tenant. El bucket existente sigue público; no se cambió su configuración en este trabajo.
