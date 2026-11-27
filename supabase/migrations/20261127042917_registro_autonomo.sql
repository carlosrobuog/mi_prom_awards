-- PROM AWARDS 2026 · registro autónomo
-- Cada persona se registra (correo + contraseña, sin correo de confirmación), completa
-- nombre completo, alias y foto (opcional → icono aleatorio). Reemplaza la tabla `invites`.

-- ---------------------------------------------------------------------------
-- participants: vínculo con la cuenta, alias y avatar de respaldo
-- ---------------------------------------------------------------------------
alter table public.participants
  add column user_id     uuid unique references auth.users (id) on delete cascade,
  add column alias       text check (alias is null or char_length(alias) between 1 and 40),
  add column avatar_icon text;   -- nombre de icono (ej. 'ghost'); se usa cuando no hay foto

-- ---------------------------------------------------------------------------
-- my_participant_id() ahora se resuelve por user_id (las políticas existentes lo siguen usando)
-- ---------------------------------------------------------------------------
create or replace function public.my_participant_id()
returns uuid
language sql stable security invoker set search_path = ''
as $$
  select id from public.participants where user_id = (select auth.uid());
$$;

drop table public.invites;

-- ---------------------------------------------------------------------------
-- Cada persona crea y edita SOLO su propio participante (el admin ya puede todo)
-- ---------------------------------------------------------------------------
create policy participants_self_ins on public.participants for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy participants_self_upd on public.participants for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Storage: bucket público de avatares; cada quien escribe solo en su carpeta (<uid>/...)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy avatars_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_select on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
