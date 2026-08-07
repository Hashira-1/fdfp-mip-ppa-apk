-- ============================================================================
--  FDFP · MIP-PPA — PHASE 3
--  Partie A : historique des évaluations (trajectoire M+3 / M+6 / M+12)
--  Partie B : correctif de sécurité — verrouillage du champ « org »
--  À coller dans Supabase → SQL Editor → New query → Run
-- ----------------------------------------------------------------------------
--  CE SCRIPT NE DÉTRUIT RIEN.
--  Contrairement à « supabase-phase2_4.sql », qui commence par des
--  « drop table ... cascade », celui-ci ajoute une colonne et un déclencheur.
--  Il peut être exécuté plusieurs fois sans effet de bord.
-- ============================================================================


-- ============================================================================
--  PARTIE A — HISTORIQUE DES ÉVALUATIONS
-- ----------------------------------------------------------------------------
--  Pourquoi une colonne et non une table ?
--  L'historique appartient au projet et ne se consulte jamais séparément. En
--  restant dans « projets », il hérite automatiquement des politiques RLS déjà
--  en place (projets_select, projets_ecriture_fdfp) : aucune règle de sécurité
--  supplémentaire à écrire, donc aucune à oublier.
-- ============================================================================

-- [ { "jalon": "M+3", "date": "2026-05-14", "score": 59.375,
--     "couverture": 45, "notees": 10,
--     "dimensions": { "P": 43.75, "EP": 62.5, "IE": null, ... } }, ... ]
alter table public.projets
  add column if not exists historique jsonb not null default '[]'::jsonb;

comment on column public.projets.historique is
  'Instantanes dates de l''evaluation, un par jalon (Initiale, M+3, M+6, M+12). '
  'Le score et les scores de dimension y sont figes : une modification '
  'ulterieure du referentiel ne reecrit pas le passe.';


-- ============================================================================
--  PARTIE B — CORRECTIF DE SÉCURITÉ : le champ « org » doit être gelé
-- ----------------------------------------------------------------------------
--  LE PROBLÈME
--  La politique « profils: modifier le sien » autorise tout utilisateur
--  authentifie a modifier sa propre ligne de « profiles » :
--
--      UPDATE  qual = (id = auth.uid())   with_check = (id = auth.uid())
--
--  Or PostgreSQL ne sait pas restreindre une politique RLS a certaines
--  COLONNES : l'autorisation porte sur la ligne entiere, donc sur « org ».
--
--  Et « org » commande la visibilite des projets, via la chaine :
--      mon_org()          lit profiles.org de l'utilisateur courant
--      peut_voir_projet() compare promoteur/operateur du projet a mon_org()
--      projets_select     applique peut_voir_projet()
--
--  Consequence : un compte Promoteur ou Operateur peut, depuis la console du
--  navigateur, executer
--      sb.from('profiles').update({ org: 'UNE AUTRE ENTREPRISE' }).eq('id', ...)
--  et acceder aux projets d'un concurrent. Ce n'est pas une escalade de ROLE
--  — les politiques de « user_roles » sont correctes — mais une escalade de
--  PERIMETRE, qui donne acces a des donnees d'entreprises tierces.
--
--  LA CORRECTION
--  Un declencheur gele « org » une fois qu'il est renseigne. L'inscription
--  reste possible (l'ecran de finalisation renseigne un « org » encore vide),
--  et l'administrateur lead conserve le droit de le corriger.
-- ============================================================================

create or replace function public.profils_geler_org()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- L'administrateur lead peut tout corriger.
  if public.est_admin_lead() then
    return new;
  end if;

  -- Sinon : « org » ne se renseigne qu'une fois, tant qu'il est encore vide.
  if new.org is distinct from old.org and coalesce(old.org, '') <> '' then
    raise exception
      'Le champ « org » ne peut plus etre modifie. Contactez l''administrateur lead.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists profils_geler_org on public.profiles;
create trigger profils_geler_org
  before update on public.profiles
  for each row
  execute function public.profils_geler_org();


-- ============================================================================
--  CONTRÔLES — les deux requêtes doivent renvoyer une ligne
-- ============================================================================
select 'Partie A : colonne historique' as controle, column_name, data_type
  from information_schema.columns
 where table_schema = 'public' and table_name = 'projets' and column_name = 'historique';

select 'Partie B : declencheur' as controle, tgname, tgenabled
  from pg_trigger
 where tgname = 'profils_geler_org' and not tgisinternal;

-- ============================================================================
--  Termine.
--  Partie A : l'application lit et ecrit « historique » automatiquement ; les
--             projets existants demarrent avec un historique vide.
--  Partie B : verifiez qu'un compte Promoteur ne peut plus changer son « org ».
--             Les comptes dont « org » est deja renseigne sont proteges ;
--             ceux dont « org » est vide pourront le renseigner une fois.
-- ============================================================================
