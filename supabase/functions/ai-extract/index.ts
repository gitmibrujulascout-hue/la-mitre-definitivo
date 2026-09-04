import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { prompt, file_urls = [], response_json_schema } = await req.json();
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) throw new Error('Falta configurar OPENAI_API_KEY en los secretos de Supabase.');
    const content = [{ type: 'input_text', text: prompt }, ...file_urls.map((url: string) => ({ type: 'input_file', file_url: url }))];
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'o4-mini', input: [{ role: 'user', content }], store: false,
        text: response_json_schema ? { format: { type: 'json_schema', name: 'extracted_data', strict: true, schema: response_json_schema } } : undefined })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error?.message || 'Error del proveedor de IA.');
    const text = result.output?.flatMap((item: any) => item.content || []).find((item: any) => item.type === 'output_text')?.text || '{}';
    return new Response(text, { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Error inesperado' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
