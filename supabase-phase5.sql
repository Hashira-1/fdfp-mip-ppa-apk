-- ============================================================================
--  FDFP · MIP-PPA — PHASE 5
--  Corbeille : la suppression d'un projet devient reversible
--  À coller dans Supabase → SQL Editor → New query → Run
-- ----------------------------------------------------------------------------
--  CE SCRIPT NE DÉTRUIT RIEN.
--  Comme les phases 3 et 4, il ajoute des colonnes et peut etre reexecute
--  sans effet de bord. Rien a voir avec « supabase-phase2_4.sql », qui
--  commence par des « drop table ... cascade » et qu'il ne faut JAMAIS rejouer
--  sur une base en service.
-- ============================================================================


-- ============================================================================
--  POURQUOI
-- ----------------------------------------------------------------------------
--  Le 8 aout 2026, un clic sur « Donnees demo » a efface le portefeuille : le
--  bouton remplacait la liste des projets, et l'application supprimait de la
--  base tout ce qui n'etait plus dans la liste. Sans confirmation, sans
--  annulation, sans trace.
--
--  Le bouton a ete corrige, et l'application refuse desormais toute
--  suppression multiple non confirmee. Mais tant que « supprimer » veut dire
--  « DELETE », la moindre erreur reste definitive.
--
--  Cette phase remplace l'effacement par un MARQUAGE. Un projet supprime n'est
--  plus visible dans l'application, mais sa ligne existe toujours : elle peut
--  etre restauree tant qu'elle n'a pas ete purgee.
-- ============================================================================

alter table public.projets
  add column if not exists supprime_le timestamptz,
  add column if not exists supprime_par text;

alter table public.suivis
  add column if not exists supprime_le timestamptz;

comment on column public.projets.supprime_le is
  'Date de mise a la corbeille. NULL = projet actif. Une ligne marquee reste '
  'en base et reste restaurable : l''application ne l''affiche plus, c''est tout.';

comment on column public.projets.supprime_par is
  'Courriel du compte qui a mis le projet a la corbeille, pour savoir a qui '
  'demander avant de purger.';

-- Les listes ne demandent que les lignes actives : l'index evite de parcourir
-- la corbeille a chaque lecture.
create index if not exists projets_actifs_idx
  on public.projets (cree_le) where supprime_le is null;

create index if not exists suivis_actifs_idx
  on public.suivis (projet_id) where supprime_le is null;


-- ============================================================================
--  PURGE — a executer a la main, jamais automatiquement
-- ----------------------------------------------------------------------------
--  La corbeille ne se vide pas toute seule : une purge automatique
--  reintroduirait exactement le probleme qu'on vient de corriger, avec un
--  delai en plus. Quand vous voudrez faire le menage, LISEZ D'ABORD ce que
--  vous allez detruire :
--
--     select id, titre, promoteur, supprime_le, supprime_par
--       from public.projets
--      where supprime_le is not null
--      order by supprime_le;
--
--  Puis, seulement si la liste est bien celle attendue :
--
--     delete from public.suivis
--      where projet_id in (select id from public.projets
--                           where supprime_le < now() - interval '90 days');
--     delete from public.projets
--      where supprime_le < now() - interval '90 days';
-- ============================================================================


-- ============================================================================
--  CONTRÔLES
-- ============================================================================
select 'colonnes corbeille' as controle, table_name, column_name, data_type
  from information_schema.columns
 where table_schema = 'public'
   and column_name in ('supprime_le', 'supprime_par')
 order by table_name, column_name;

select count(*) filter (where supprime_le is null)     as projets_actifs,
       count(*) filter (where supprime_le is not null) as projets_en_corbeille
  from public.projets;

-- ============================================================================
--  Termine.
--  L'application fonctionne SANS cette migration : tant que la colonne
--  n'existe pas, elle revient a l'ancien comportement (suppression definitive)
--  et le dit a l'ecran. Une fois la colonne en place, la corbeille s'active
--  toute seule.
-- ============================================================================
