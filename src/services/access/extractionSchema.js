export function extractionSchema(schema) {
  if (Array.isArray(schema)) return schema.map(extractionSchema);
  if (!schema || typeof schema !== 'object') return schema;
  const result = Object.fromEntries(Object.entries(schema).map(([key, value]) => [key, extractionSchema(value)]));
  if (result.type === 'object' || result.properties) {
    result.additionalProperties = false;
    result.required = Object.keys(result.properties || {});
  }
  return result;
}
