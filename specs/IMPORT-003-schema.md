# Extracción compatible con esquemas estrictos

La prueba en producción no muestra la vista previa ni conserva el error. Agregar estado visible y seguro con etapa y código HTTP para distinguir carga, extracción y procesamiento sin mostrar datos del proveedor.

Normalizar recursivamente los esquemas enviados a ai-extract: cada objeto declara additionalProperties false y requiere todas sus propiedades. Conservar el original sin mutarlo. Aplicar a ambas entradas de integración para cubrir beneficiarios y comprobantes. Verificar con pruebas de objetos anidados y arrays, lint y build.

Riesgos pendientes: validar archivos XLSX y PDF reales de prueba, acceso a Storage y límites del proveedor. La corrección del esquema no certifica el circuito completo.
