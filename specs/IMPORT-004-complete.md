# Importación completa de miembros

Problema verificado: los dos archivos del usuario contienen 144 DNI distintos; la llamada única a IA puede devolver solo cinco y la UI acepta ese resultado.

Leer XLSX localmente con ExcelJS, sin usar el lector xlsx vulnerable. Leer texto PDF con pdfjs-dist; agrupar por documento y procesar bloques acotados con IA. Comprobar correspondencia exacta de DNI por bloque y rechazar respuestas incompletas. PDF sin texto debe pedir Excel o PDF con texto por ahora, sin simular éxito. Agregar límites de tamaño y filas, validación de nombre y DNI, duplicados y progreso. No registrar contenido personal ni subir archivos originales para este flujo.

Dependencias justificadas: exceljs para celdas y fechas estructuradas; pdfjs-dist para extraer texto del PDF en el navegador. La IA recibe solo bloques de texto para PDF. Excel no necesita IA. Mantener selección previa al guardado; no seleccionar sobrescrituras por defecto. Consultar todos los beneficiarios del tenant para detectar duplicados.

Validación: 144 registros del XLSX adjunto, correspondencia de 144 DNI en PDF, pruebas sintéticas de omisiones, duplicados, fechas y columnas. No guardar los archivos personales en Git. Riesgos restantes: importación masiva no transaccional y PDF escaneado fuera de este cambio; informar explícitamente errores de guardado.
