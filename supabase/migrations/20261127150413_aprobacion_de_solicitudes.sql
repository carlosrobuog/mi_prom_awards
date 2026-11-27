-- Aprobación de solicitudes: quien se registra queda "pending" hasta que un admin lo apruebe.
-- Estado de cada solicitud: pending | approved | rejected (las filas existentes quedan aprobadas)
alter table public.participants
  add column status text not null default 'approved' check (status in ('pending', 'approved', 'rejected'));
alter table public.participants alter column status set default 'pending';

-- Votante = participante aprobado de la cuenta actual
create function public.my_voter_id()
returns uuid
language sql stable security invoker set search_path = ''
as $$
  select id from public.participants where user_id = (select auth.uid()) and status = 'approved';
$$;

-- Solo un admin puede cambiar el estado
create function public.guard_participant_status()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  -- Las cuentas de la API siempre traen auth.uid(); el SQL Editor y el service role no:
  -- el dueño del proyecto puede corregir estados desde SQL, pero ningún usuario puede auto-aprobarse.
  if new.status is distinct from old.status
     and (select auth.uid()) is not null
     and not (select public.is_admin()) then
    raise exception 'Solo un administrador puede cambiar el estado de una solicitud';
  end if;
  return new;
end;
$$;
create trigger participants_guard_status before update on public.participants
  for each row execute function public.guard_participant_status();

-- Los compañeros solo ven a los aprobados; cada quien ve su propia fila; el admin ve todo
alter policy participants_read on public.participants
  using (status = 'approved' or user_id = (select auth.uid()) or (select public.is_admin()));
-- Quien se registra entra siempre como pendiente
alter policy participants_self_ins on public.participants
  with check (user_id = (select auth.uid()) and status = 'pending');

-- Solo participantes aprobados pueden nominar, y solo a aprobados
alter policy nominations_ins on public.nominations
  with check (
    voter_id = (select public.my_voter_id())
    and not exists (select 1 from public.submissions s where s.voter_id = nominations.voter_id)
    and (select noms_open from public.settings)
    and exists (select 1 from public.participants p where p.id = nominations.nominee_id and p.status = 'approved')
  );
alter policy nominations_upd on public.nominations
  using (
    voter_id = (select public.my_voter_id())
    and not exists (select 1 from public.submissions s where s.voter_id = nominations.voter_id)
  )
  with check (
    voter_id = (select public.my_voter_id())
    and exists (select 1 from public.participants p where p.id = nominations.nominee_id and p.status = 'approved')
  );
alter policy nominations_del on public.nominations
  using (
    voter_id = (select public.my_voter_id())
    and not exists (select 1 from public.submissions s where s.voter_id = nominations.voter_id)
  );
alter policy submissions_ins on public.submissions
  with check (voter_id = (select public.my_voter_id()));
