-- PROM AWARDS 2026 · Fase 1 (nominaciones) · esquema inicial
-- Modelo: participantes y categorías las administra el admin; cada persona entra con
-- enlace al correo (Supabase Auth) y su correo se asocia a un participante vía `invites`.
-- Seguridad: RLS en todas las tablas; sin SECURITY DEFINER; sin user_metadata.

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------
create table public.participants (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 80),
  photo_url  text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- Correo de cada participante: tabla aparte para que los compañeros no lo vean.
create table public.invites (
  email          text primary key check (email = lower(email)),
  participant_id uuid not null unique references public.participants (id) on delete cascade
);

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 80),
  description text not null default '' check (char_length(description) <= 240),
  icon        text not null default 'star',
  position    integer not null default 0,
  active      boolean not null default true
);

create table public.nominations (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete cascade,
  voter_id    uuid not null references public.participants (id) on delete cascade,
  nominee_id  uuid not null references public.participants (id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (category_id, voter_id),
  check (voter_id <> nominee_id)
);

-- Una fila = esa persona confirmó su envío (queda bloqueada).
create table public.submissions (
  voter_id     uuid primary key references public.participants (id) on delete cascade,
  confirmed_at timestamptz not null default now()
);

-- Una sola fila de configuración.
create table public.settings (
  id           boolean primary key default true check (id),
  name         text not null default 'PROM AWARDS 2026',
  event_date   timestamptz not null default '2026-12-19 20:00:00-05',
  noms_open    boolean not null default true
);
insert into public.settings (id) values (true);

-- Índices en las llaves foráneas (Postgres no los crea solo).
create index nominations_voter_idx    on public.nominations (voter_id);
create index nominations_nominee_idx  on public.nominations (nominee_id);
create index nominations_category_idx on public.nominations (category_id);

-- ---------------------------------------------------------------------------
-- Funciones auxiliares (SECURITY INVOKER: respetan RLS de quien llama)
-- ---------------------------------------------------------------------------
create function public.is_admin()
returns boolean
language sql stable security invoker set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

create function public.my_participant_id()
returns uuid
language sql stable security invoker set search_path = ''
as $$
  select participant_id from public.invites
  where email = lower((select auth.jwt() ->> 'email'));
$$;

-- ---------------------------------------------------------------------------
-- Resultados agregados (la vista usa los permisos de quien consulta → solo admin ve datos)
-- ---------------------------------------------------------------------------
create view public.nomination_results
with (security_invoker = true) as
select category_id, nominee_id, count(*)::int as votes
from public.nominations
group by category_id, nominee_id;

-- ---------------------------------------------------------------------------
-- Permisos de la API de datos (explícitos) + RLS
-- ---------------------------------------------------------------------------
revoke all on public.participants, public.invites, public.admins, public.categories,
              public.nominations, public.submissions, public.settings,
              public.nomination_results from anon, authenticated;

grant select on public.settings to anon, authenticated;
grant update on public.settings to authenticated;
grant select, insert, update, delete on public.participants, public.categories to authenticated;
grant select, insert, update, delete on public.invites to authenticated;
grant select on public.admins to authenticated;
grant select, insert, update, delete on public.nominations to authenticated;
grant select, insert, delete on public.submissions to authenticated;
grant select on public.nomination_results to authenticated;

alter table public.participants enable row level security;
alter table public.invites     enable row level security;
alter table public.admins      enable row level security;
alter table public.categories  enable row level security;
alter table public.nominations enable row level security;
alter table public.submissions enable row level security;
alter table public.settings    enable row level security;

-- settings: lo ve cualquiera (cuenta regresiva de la portada); solo admin edita
create policy settings_read  on public.settings for select to anon, authenticated using (true);
create policy settings_admin on public.settings for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- participants / categories: los ven los usuarios con sesión; solo admin modifica
create policy participants_read on public.participants for select to authenticated using (true);
create policy participants_admin_ins on public.participants for insert to authenticated
  with check ((select public.is_admin()));
create policy participants_admin_upd on public.participants for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy participants_admin_del on public.participants for delete to authenticated
  using ((select public.is_admin()));

create policy categories_read on public.categories for select to authenticated using (true);
create policy categories_admin_ins on public.categories for insert to authenticated
  with check ((select public.is_admin()));
create policy categories_admin_upd on public.categories for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy categories_admin_del on public.categories for delete to authenticated
  using ((select public.is_admin()));

-- invites: cada quien ve solo su correo; admin ve y gestiona todos
create policy invites_read on public.invites for select to authenticated
  using (email = lower((select auth.jwt() ->> 'email')) or (select public.is_admin()));
create policy invites_admin_ins on public.invites for insert to authenticated
  with check ((select public.is_admin()));
create policy invites_admin_upd on public.invites for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy invites_admin_del on public.invites for delete to authenticated
  using ((select public.is_admin()));

-- admins: cada quien puede comprobar si él mismo es admin (sin poder agregarse)
create policy admins_self on public.admins for select to authenticated
  using (user_id = (select auth.uid()));

-- nominations: cada persona gestiona solo las suyas y solo antes de confirmar; admin las ve todas
create policy nominations_read on public.nominations for select to authenticated
  using (voter_id = (select public.my_participant_id()) or (select public.is_admin()));
create policy nominations_ins on public.nominations for insert to authenticated
  with check (
    voter_id = (select public.my_participant_id())
    and not exists (select 1 from public.submissions s where s.voter_id = nominations.voter_id)
    and (select noms_open from public.settings)
  );
create policy nominations_upd on public.nominations for update to authenticated
  using (
    voter_id = (select public.my_participant_id())
    and not exists (select 1 from public.submissions s where s.voter_id = nominations.voter_id)
  )
  with check (voter_id = (select public.my_participant_id()));
create policy nominations_del on public.nominations for delete to authenticated
  using (
    voter_id = (select public.my_participant_id())
    and not exists (select 1 from public.submissions s where s.voter_id = nominations.voter_id)
  );

-- submissions: ve e inserta la suya; solo admin puede reabrir (borrar) un envío
create policy submissions_read on public.submissions for select to authenticated
  using (voter_id = (select public.my_participant_id()) or (select public.is_admin()));
create policy submissions_ins on public.submissions for insert to authenticated
  with check (voter_id = (select public.my_participant_id()));
create policy submissions_admin_del on public.submissions for delete to authenticated
  using ((select public.is_admin()));
