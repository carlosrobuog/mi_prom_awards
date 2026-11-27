-- La portada (sin sesión) muestra las categorías activas; el admin sube fotos de participantes
-- que aún no tienen cuenta (carpeta admin/ del bucket avatars).

grant select on public.categories to anon;
create policy categories_public_read on public.categories for select to anon using (active);

create policy avatars_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (select public.is_admin()));
create policy avatars_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (select public.is_admin()))
  with check (bucket_id = 'avatars' and (select public.is_admin()));
create policy avatars_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (select public.is_admin()));
