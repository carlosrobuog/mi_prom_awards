-- El administrador no vota: "votante" = participante aprobado y elegible (los admins no son elegibles).
-- Todas las reglas de voto (nominations, runoff_votes, submissions) usan esta función.
create or replace function public.my_voter_id()
returns uuid
language sql stable security invoker set search_path = ''
as $$
  select id from public.participants
  where user_id = (select auth.uid()) and status = 'approved' and eligible;
$$;
