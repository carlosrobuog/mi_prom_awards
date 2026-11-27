-- Votación de una sola ronda, cierre real por el administrador y desempates por categoría.

-- Desempate por categoría: el admin abre una nueva ronda solo entre los empatados.
alter table public.categories
  add column round int not null default 1,
  add column runoff_open boolean not null default false,
  add column runoff_candidates uuid[] not null default '{}',
  add column shared_win boolean not null default false;

-- Votos de las rondas de desempate (ronda 2 en adelante)
create table public.runoff_votes (
  category_id uuid not null references public.categories (id) on delete cascade,
  round       int  not null check (round > 1),
  voter_id    uuid not null references public.participants (id) on delete cascade,
  nominee_id  uuid not null references public.participants (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (category_id, round, voter_id),
  check (voter_id <> nominee_id)
);
create index runoff_votes_voter_idx   on public.runoff_votes (voter_id);
create index runoff_votes_nominee_idx on public.runoff_votes (nominee_id);

revoke all on public.runoff_votes from anon, authenticated;
grant select, insert, update, delete on public.runoff_votes to authenticated;
alter table public.runoff_votes enable row level security;

create policy runoff_read on public.runoff_votes for select to authenticated
  using (voter_id = (select public.my_voter_id()) or (select public.is_admin()));
create policy runoff_ins on public.runoff_votes for insert to authenticated
  with check (
    voter_id = (select public.my_voter_id())
    and exists (
      select 1 from public.categories c
      where c.id = runoff_votes.category_id and c.runoff_open and c.round = runoff_votes.round
        and runoff_votes.nominee_id = any (c.runoff_candidates)
    )
  );
create policy runoff_upd on public.runoff_votes for update to authenticated
  using (
    voter_id = (select public.my_voter_id())
    and exists (select 1 from public.categories c where c.id = runoff_votes.category_id and c.runoff_open and c.round = runoff_votes.round)
  )
  with check (
    voter_id = (select public.my_voter_id())
    and exists (
      select 1 from public.categories c
      where c.id = runoff_votes.category_id and c.runoff_open and c.round = runoff_votes.round
        and runoff_votes.nominee_id = any (c.runoff_candidates)
    )
  );
create policy runoff_del on public.runoff_votes for delete to authenticated
  using (
    voter_id = (select public.my_voter_id())
    and exists (select 1 from public.categories c where c.id = runoff_votes.category_id and c.runoff_open and c.round = runoff_votes.round)
  );

-- El voto vale desde que se toca (sin paso de confirmar) y se puede cambiar mientras
-- las votaciones estén abiertas. Al cerrarlas, la base de datos rechaza cualquier cambio.
alter policy nominations_ins on public.nominations
  with check (
    voter_id = (select public.my_voter_id())
    and (select noms_open from public.settings)
    and exists (select 1 from public.participants p where p.id = nominations.nominee_id and p.status = 'approved')
  );
alter policy nominations_upd on public.nominations
  using (voter_id = (select public.my_voter_id()) and (select noms_open from public.settings))
  with check (
    voter_id = (select public.my_voter_id())
    and (select noms_open from public.settings)
    and exists (select 1 from public.participants p where p.id = nominations.nominee_id and p.status = 'approved')
  );
alter policy nominations_del on public.nominations
  using (voter_id = (select public.my_voter_id()) and (select noms_open from public.settings));
