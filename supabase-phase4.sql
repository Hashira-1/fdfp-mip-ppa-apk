-- ============================================================================
--  FDFP · MIP-PPA — PHASE 4
--  Localisation des projets : colonne « localite » sur « projets »
--  À coller dans Supabase → SQL Editor → New query → Run
-- ----------------------------------------------------------------------------
--  CE SCRIPT NE DÉTRUIT RIEN.
--  Comme « supabase-phase3.sql », et contrairement à « supabase-phase2_4.sql »
--  qui commence par des « drop table ... cascade », celui-ci se contente
--  d'ajouter une colonne. Il peut être exécuté plusieurs fois sans effet de
--  bord.
-- ============================================================================


-- ============================================================================
--  POURQUOI CETTE COLONNE
-- ----------------------------------------------------------------------------
--  « region » porte l'implantation FDFP de rattachement : le Siège d'Abidjan
--  ou l'une des sept antennes. C'est une information de gestion, pas une
--  localisation : huit implantations se partagent les 108 departements du
--  pays. L'antenne de Korhogo en couvre a elle seule dix-sept, d'Odienne a
--  Kong — plus de 300 km d'un bout a l'autre. Savoir qu'un projet releve de
--  Korhogo ne disait donc pas ou il se deroulait.
--
--  « localite » porte le chef-lieu de departement ou le projet a lieu. Le
--  couple (region, localite) est contraint cote application : la liste
--  proposee est toujours celle de la zone choisie, et une valeur etrangere a
--  la zone est ramenee au chef-lieu de l'implantation.
--
--  POURQUOI PAS DE CONTRAINTE SQL SUR LA LISTE DES 108 LOCALITES
--  Le decoupage administratif ivoirien evolue (les regions ont ete redecoupees
--  en 2011, puis ajustees depuis) et le zonage des antennes releve d'une note
--  interne, revisee en 2002 puis en 2022. Figer les 108 noms dans une
--  contrainte « check » obligerait a une migration a chaque revision, et
--  ferait echouer l'enregistrement de projets valides entre-temps. La
--  nomenclature vit donc dans « geo-civ.js », avec ses sources, et la base
--  accepte la chaine.
-- ============================================================================

alter table public.projets
  add column if not exists localite text;

comment on column public.projets.localite is
  'Chef-lieu de departement ou se deroule le projet, dans la zone de '
  'couverture portee par « region ». Nomenclature et rattachement des '
  '108 departements aux huit implantations : voir « geo-civ.js » '
  '(sources OCHA/HDX et note DACD de juin 2026).';


-- ----------------------------------------------------------------------------
--  Reprise des projets deja saisis
-- ----------------------------------------------------------------------------
--  Les projets anterieurs n'ont pas de localite. L'application sait s'en
--  passer — elle affiche alors le chef-lieu de l'implantation — mais renseigner
--  la colonne evite que la carte les regroupe tous sur ce chef-lieu par defaut
--  sans que personne ne l'ait decide.
--
--  La requete ci-dessous ne fait que proposer la valeur par defaut : le
--  chef-lieu eponyme de l'implantation. A ajuster projet par projet ensuite,
--  depuis l'ecran « Modifier le projet ».
-- ----------------------------------------------------------------------------

update public.projets
   set localite = case
         when region ilike '%abidjan%'      then 'Abidjan'
         when region ilike '%abengourou%'   then 'Abengourou'
         when region ilike '%bouak%'        then 'Bouaké'
         when region ilike '%daloa%'        then 'Daloa'
         when region ilike '%korhogo%'      then 'Korhogo'
         when region ilike '%man%'          then 'Man'
         when region ilike '%pédro%'
           or region ilike '%pedro%'        then 'San-Pédro'
         when region ilike '%yamoussoukro%' then 'Yamoussoukro'
       end
 where localite is null
   and region is not null;


-- ============================================================================
--  CONTRÔLES
-- ============================================================================
--  1. La colonne existe : doit renvoyer une ligne.
select 'colonne localite' as controle, column_name, data_type, is_nullable
  from information_schema.columns
 where table_schema = 'public' and table_name = 'projets' and column_name = 'localite';

--  2. Repartition obtenue : verifiez qu'aucune zone connue ne reste sans
--     localite. Une ligne « region » renseignee avec « localite » vide
--     signale une zone hors nomenclature, a corriger dans l'application.
select coalesce(region, '(sans zone)') as zone,
       coalesce(localite, '(sans localite)') as localite,
       count(*) as projets
  from public.projets
 group by 1, 2
 order by 1, 2;

-- ============================================================================
--  Termine.
--  L'application lit et ecrit « localite » automatiquement. Tant que ce script
--  n'est pas passe, elle continue de fonctionner : la colonne n'est ecrite que
--  si le projet en porte une, et un message explicite remplace l'erreur brute
--  de PostgREST si elle manque.
-- ============================================================================
