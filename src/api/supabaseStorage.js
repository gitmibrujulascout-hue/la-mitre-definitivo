import { supabase } from './supabaseClient';

export const SUPABASE_BUCKET = 'app-files';

export async function uploadFile(file, folder = 'uploads') {
  if (!file) throw new Error('No se recibió ningún archivo.');
  const safeName = String(file.name || 'archivo').replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${folder}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from(SUPABASE_BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(path);
  return { file_url: data.publicUrl, path };
}
