-- Los administradores no son elegibles: no aparecen como opción ni pueden recibir votos.
alter table public.participants add column eligible boolean not null default true;

-- Se calcula siempre por trigger (nadie puede marcarse como elegible a mano).
-- SECURITY DEFINER porque un votante normal no puede leer la tabla admins; al ser función
-- de trigger no se puede invocar como RPC, y search_path queda vacío.
create function public.participants_set_eligible()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.eligible := new.user_id is null
    or not exists (select 1 from public.admins a where a.user_id = new.user_id);
  return new;
end;
$$;
revoke execute on function public.participants_set_eligible() from public, anon, authenticated;
create trigger participants_eligible before insert or update on public.participants
  for each row execute function public.participants_set_eligible();

-- Al agregar o quitar un admin, se recalcula la elegibilidad de su participante
create function public.admins_sync_eligible()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.participants set eligible = eligible where user_id = coalesce(new.user_id, old.user_id);
  return null;
end;
$$;
revoke execute on function public.admins_sync_eligible() from public, anon, authenticated;
create trigger admins_sync_eligible after insert or delete on public.admins
  for each row execute function public.admins_sync_eligible();

-- Los admins que ya existen
update public.participants set eligible = eligible where user_id in (select user_id from public.admins);

-- Nadie puede votar por un no elegible (ronda 1)
alter policy nominations_ins on public.nominations
  with check (
    voter_id = (select public.my_voter_id())
    and (select noms_open from public.settings)
    and exists (select 1 from public.participants p where p.id = nominations.nominee_id and p.status = 'approved' and p.eligible)
  );
alter policy nominations_upd on public.nominations
  with check (
    voter_id = (select public.my_voter_id())
    and (select noms_open from public.settings)
    and exists (select 1 from public.participants p where p.id = nominations.nominee_id and p.status = 'approved' and p.eligible)
  );
