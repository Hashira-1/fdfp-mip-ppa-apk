-- ============================================================================
--  FDFP · MIP-PPA — PHASE 6
--  Le cloisonnement des donnees, verifie et applique COTE BASE
--  À coller dans Supabase → SQL Editor → New query → Run
-- ----------------------------------------------------------------------------
--  CE SCRIPT NE DÉTRUIT AUCUNE DONNÉE.
--  Il remplace des politiques de securite ; les tables et leur contenu ne sont
--  pas touches. Il peut etre reexecute sans effet de bord.
-- ============================================================================


-- ============================================================================
--  POURQUOI
-- ----------------------------------------------------------------------------
--  Jusqu'ici, ce qu'un promoteur ne devait pas faire etait empeche par
--  l'INTERFACE : un bouton absent, une page non proposee. C'est necessaire mais
--  ce n'est pas une securite. La cle « anon » est publique par construction,
--  et n'importe qui peut ouvrir la console du navigateur et ecrire :
--
--      sb.from('projets').select('*')
--      sb.from('projets').update({ budget: 0 }).eq('id', '...')
--
--  Seules les politiques RLS decident vraiment. Ce script les ecrit pour que
--  la regle soit la meme des deux cotes :
--
--    LECTURE   le FDFP voit tout ; un promoteur ou un operateur ne voit que
--              les projets ou son organisation est promoteur ou operateur.
--    ECRITURE  reservee au FDFP. Un promoteur ne modifie RIEN, meme ses
--              propres projets : la saisie est le metier des agents.
--
--  Note : cacher un bouton reste utile — cela evite de proposer une action qui
--  echouera. Mais c'est le confort, pas la serrure.
-- ============================================================================


-- ----------------------------------------------------------------------------
--  1) Fonctions d'appui (rappel : deja creees en phase 2, recreees ici pour
--     que ce script soit autonome et rejouable)
-- ----------------------------------------------------------------------------
create or replace function public.mon_role()
returns text language sql stable security definer set search_path = public
as $$ select role from public.user_roles where user_id = auth.uid() $$;

create or replace function public.mon_org()
returns text language sql stable security definer set search_path = public
as $$ select coalesce(org,'') from public.profiles where id = auth.uid() $$;

create or replace function public.est_fdfp()
returns boolean language sql stable security definer set search_path = public
as $$ select public.mon_role() in
  ('Administrateur lead','Administrateur FDFP','Agent FDFP') $$;

-- Un projet est-il dans le perimetre de l'utilisateur courant ?
create or replace function public.peut_voir_projet(promoteur text, operateur text)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.est_fdfp()
      or (coalesce(public.mon_org(),'') <> ''
          and (coalesce(promoteur,'') = public.mon_org()
            or coalesce(operateur,'') = public.mon_org()))
$$;


-- ----------------------------------------------------------------------------
--  2) PROJETS
-- ----------------------------------------------------------------------------
alter table public.projets enable row level security;

drop policy if exists projets_select          on public.projets;
drop policy if exists projets_ecriture_fdfp   on public.projets;
drop policy if exists projets_insert_fdfp     on public.projets;
drop policy if exists projets_update_fdfp     on public.projets;
drop policy if exists projets_delete_fdfp     on public.projets;

-- Lecture : le FDFP voit tout, les autres voient leur perimetre.
create policy projets_select on public.projets
  for select to authenticated
  using (public.peut_voir_projet(promoteur, operateur));

-- Ecriture : FDFP uniquement, et separee en trois politiques explicites.
-- Une seule politique « for all » melangeait lecture et ecriture, ce qui rend
-- la relecture du schema beaucoup plus difficile.
create policy projets_insert_fdfp on public.projets
  for insert to authenticated with check (public.est_fdfp());

create policy projets_update_fdfp on public.projets
  for update to authenticated using (public.est_fdfp()) with check (public.est_fdfp());

create policy projets_delete_fdfp on public.projets
  for delete to authenticated using (public.est_fdfp());


-- ----------------------------------------------------------------------------
--  3) SUIVIS — meme regle, par rebond sur le projet
-- ----------------------------------------------------------------------------
alter table public.suivis enable row level security;

drop policy if exists suivis_select        on public.suivis;
drop policy if exists suivis_ecriture_fdfp on public.suivis;
drop policy if exists suivis_insert_fdfp   on public.suivis;
drop policy if exists suivis_update_fdfp   on public.suivis;
drop policy if exists suivis_delete_fdfp   on public.suivis;

create policy suivis_select on public.suivis
  for select to authenticated
  using (exists (select 1 from public.projets p
                  where p.id = suivis.projet_id
                    and public.peut_voir_projet(p.promoteur, p.operateur)));

create policy suivis_insert_fdfp on public.suivis
  for insert to authenticated with check (public.est_fdfp());

create policy suivis_update_fdfp on public.suivis
  for update to authenticated using (public.est_fdfp()) with check (public.est_fdfp());

create policy suivis_delete_fdfp on public.suivis
  for delete to authenticated using (public.est_fdfp());


-- ----------------------------------------------------------------------------
--  4) CONFIGURATION — le referentiel se lit par tous, ne s'ecrit que par
--     les administrateurs. Un agent ne redefinit pas le modele d'evaluation.
-- ----------------------------------------------------------------------------
alter table public.configuration enable row level security;

drop policy if exists configuration_select        on public.configuration;
drop policy if exists configuration_ecriture      on public.configuration;
drop policy if exists configuration_update_admin  on public.configuration;

create policy configuration_select on public.configuration
  for select to authenticated using (true);

create policy configuration_update_admin on public.configuration
  for update to authenticated
  using (public.mon_role() in ('Administrateur lead','Administrateur FDFP'))
  with check (public.mon_role() in ('Administrateur lead','Administrateur FDFP'));


-- ============================================================================
--  CONTRÔLES
-- ============================================================================
--  1. RLS active partout : les trois lignes doivent afficher « true ».
select relname as table_name, relrowsecurity as rls_active
  from pg_class
 where relnamespace = 'public'::regnamespace
   and relname in ('projets','suivis','configuration')
 order by relname;

--  2. Politiques en place. Attendu :
--     projets       : 1 select + 1 insert + 1 update + 1 delete
--     suivis        : idem
--     configuration : 1 select + 1 update
select tablename, cmd, policyname
  from pg_policies
 where schemaname = 'public'
   and tablename in ('projets','suivis','configuration')
 order by tablename, cmd, policyname;

-- ============================================================================
--  COMMENT VÉRIFIER POUR DE BON
--  Connectez-vous avec un compte Promoteur, ouvrez la console du navigateur
--  (F12) et essayez :
--
--      const { data } = await sb.from('projets').select('id,titre')
--      console.log(data.length)        // seulement SES projets
--
--      const { error } = await sb.from('projets')
--        .update({ budget: 1 }).eq('id', <un de ses projets>)
--      console.log(error)              // doit etre non nul : ecriture refusee
--
--  Si la seconde commande passe, la politique d'update n'est pas appliquee :
--  reexecutez ce script et relisez le controle n° 2.
-- ============================================================================
