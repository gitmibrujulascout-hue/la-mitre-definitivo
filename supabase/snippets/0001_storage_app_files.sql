-- Bucket público para documentos e imágenes de la aplicación.
insert into storage.buckets (id, name, public)
values ('app-files', 'app-files', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "app files public read" on storage.objects;
create policy "app files public read" on storage.objects for select
using (bucket_id = 'app-files');

drop policy if exists "app files authenticated upload" on storage.objects;
create policy "app files authenticated upload" on storage.objects for insert
to authenticated with check (bucket_id = 'app-files');

drop policy if exists "app files authenticated delete" on storage.objects;
create policy "app files authenticated delete" on storage.objects for delete
to authenticated using (bucket_id = 'app-files');
