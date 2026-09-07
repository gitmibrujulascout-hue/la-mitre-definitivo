# Extracción compatible con esquemas estrictos

Normalizar recursivamente los esquemas enviados a ai-extract: cada objeto declara additionalProperties false y requiere todas sus propiedades. Conservar el original sin mutarlo. Aplicar a ambas entradas de integración para cubrir beneficiarios y comprobantes. Verificar con pruebas de objetos anidados y arrays, lint y build.

Riesgos pendientes: validar archivos XLSX y PDF reales de prueba, acceso a Storage y límites del proveedor. La corrección del esquema no certifica el circuito completo.
