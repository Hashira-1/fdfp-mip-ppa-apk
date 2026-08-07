-- ============================================================================
--  FDFP · MIP-PPA — PHASE 2 : Centralisation des données metier
--  À coller dans Supabase → SQL Editor → New query → Run
--  (Le script de la phase 1 — profiles / user_roles — doit deja avoir ete execute.)
-- ============================================================================
--
--   ############################################################
--   ##  AVERTISSEMENT : CE SCRIPT DETRUIT LES DONNEES.        ##
--   ############################################################
--
--   Les lignes « drop table ... cascade » du paragraphe 1 SUPPRIMENT les
--   tables « suivis » et « projets » AVANT de les recreer. Tout projet, tout
--   suivi, toute note et tout document deja saisis sont PERDUS, sans
--   confirmation ni possibilite d'annulation.
--
--   C'est un script d'INSTALLATION INITIALE. Il est sans danger sur une base
--   vide ou sur une base de demonstration. Il est fatal sur une base en
--   service.
--
--   AVANT DE L'EXECUTER SUR UNE BASE QUI CONTIENT DES DONNEES :
--     1. faire une sauvegarde (Supabase > Database > Backups), ou exporter
--        les tables concernees ;
--     2. se demander si une simple migration ne suffirait pas — c'est ce que
--        font « supabase-phase3.sql » et « supabase-phase4.sql », qui
--        ajoutent des colonnes sans rien detruire et peuvent etre rejoues
--        sans effet de bord.
--
--   Pour reexecuter ce script sans perdre les donnees : commenter les deux
--   « drop table » (paragraphe 1). Les « create table if not exists » qui
--   suivent laisseront alors les tables existantes en place.
-- ============================================================================

-- Fonction utilitaire : role de l'utilisateur courant
create or replace function public.mon_role()
returns text language sql stable security definer set search_path = public
as $$ select role from public.user_roles where user_id = auth.uid() $$;

-- Fonction utilitaire : l'organisation (org) de l'utilisateur courant
create or replace function public.mon_org()
returns text language sql stable security definer set search_path = public
as $$ select coalesce(org,'') from public.profiles where id = auth.uid() $$;

-- Les roles "FDFP" ont acces a tout ; promoteur/operateur seulement a leurs projets
create or replace function public.est_fdfp()
returns boolean language sql stable security definer set search_path = public
as $$ select public.mon_role() in
  ('Administrateur lead','Administrateur FDFP','Agent FDFP') $$;

-- ---------------------------------------------------------------------------
-- 1) TABLE DES PROJETS (ex-"formations")
-- ---------------------------------------------------------------------------
drop table if exists public.suivis cascade;
drop table if exists public.projets cascade;

create table if not exists public.projets (
  id           text primary key,
  titre        text not null default '',
  promoteur    text not null default '',
  operateur    text not null default '',
  beneficiaire text not null default '',
  secteur      text not null default '',
  secteur_grand text not null default '',
  domaine      text not null default '',
  region       text not null default '',
  apprenants   int  not null default 0,
  budget       bigint not null default 0,
  statut       text not null default 'Planifiée',
  notes        jsonb not null default '{}'::jsonb,   -- { "P1":4, "EP2":3, ... }
  cree_le      timestamptz not null default now(),
  maj_le       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2) TABLE DES SUIVIS POST-FORMATION (M+3 / M+6 / M+12)
-- ---------------------------------------------------------------------------
create table if not exists public.suivis (
  id         text primary key,
  projet_id  text not null references public.projets(id) on delete cascade,
  jalon      text not null,           -- 'M+3' | 'M+6' | 'M+12'
  echeance   date,
  statut     text not null default 'programmé',   -- 'programmé' | 'effectué'
  note       text not null default '',
  docs       jsonb not null default '[]'::jsonb,   -- [{nom,type,taille,date,data}]
  maj_le     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3) CONFIGURATION PARTAGEE (referentiel, secteurs, phases) : 1 seule ligne
-- ---------------------------------------------------------------------------
create table if not exists public.configuration (
  id          int primary key default 1,
  referentiel jsonb not null default '[]'::jsonb,
  secteurs    jsonb not null default '[]'::jsonb,
  phases      jsonb not null default '[]'::jsonb,
  maj_le      timestamptz not null default now(),
  constraint config_unique check (id = 1)
);
insert into public.configuration (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 4) SECURITE (Row Level Security)
-- ---------------------------------------------------------------------------
alter table public.projets       enable row level security;
alter table public.suivis        enable row level security;
alter table public.configuration enable row level security;

-- Visibilite d'un projet : FDFP voit tout ; promoteur/operateur voient les leurs
create or replace function public.peut_voir_projet(p public.projets)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.est_fdfp()
    or lower(trim(p.promoteur)) = lower(trim(public.mon_org()))
    or lower(trim(p.operateur)) = lower(trim(public.mon_org()))
$$;

drop policy if exists "projets_select" on public.projets;
drop policy if exists "projets_ecriture_fdfp" on public.projets;
create policy "projets_select" on public.projets for select to authenticated
  using (public.peut_voir_projet(projets));
-- Seuls les roles FDFP creent / modifient / suppriment
create policy "projets_ecriture_fdfp" on public.projets for all to authenticated
  using (public.est_fdfp()) with check (public.est_fdfp());

drop policy if exists "suivis_select" on public.suivis;
drop policy if exists "suivis_ecriture_fdfp" on public.suivis;
create policy "suivis_select" on public.suivis for select to authenticated
  using (exists (select 1 from public.projets p where p.id = suivis.projet_id and public.peut_voir_projet(p)));
create policy "suivis_ecriture_fdfp" on public.suivis for all to authenticated
  using (public.est_fdfp()) with check (public.est_fdfp());

-- Configuration : lecture pour tous les connectes ; ecriture pour les admins
drop policy if exists "config_select" on public.configuration;
drop policy if exists "config_ecriture_admin" on public.configuration;
create policy "config_select" on public.configuration for select to authenticated using (true);
create policy "config_ecriture_admin" on public.configuration for all to authenticated
  using (public.mon_role() in ('Administrateur lead','Administrateur FDFP'))
  with check (public.mon_role() in ('Administrateur lead','Administrateur FDFP'));

-- ---------------------------------------------------------------------------
-- 5) TEMPS REEL : diffuser les changements aux autres utilisateurs connectes
-- ---------------------------------------------------------------------------
-- Ajout idempotent : ne fait rien si la table est deja publiee
do $$
begin
  begin alter publication supabase_realtime add table public.projets; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.suivis; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.configuration; exception when duplicate_object then null; end;
end $$;

-- ============================================================================
--  Termine. Les tables projets / suivis / configuration apparaissent dans
--  Table Editor. Au premier lancement, l'application y injecte le referentiel
--  MIP-PPA par defaut et (si vide) les 3 projets de demonstration.
-- ============================================================================
