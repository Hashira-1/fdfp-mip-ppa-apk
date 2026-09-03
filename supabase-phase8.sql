-- ============================================================================
--  FDFP · MIP-PPA — PHASE 8
--  Politiques d'acces manquantes sur « profiles »
--  A coller dans Supabase -> SQL Editor -> New query -> Run
-- ----------------------------------------------------------------------------
--  CE SCRIPT NE DETRUIT RIEN.
--  Il ne touche qu'aux POLITIQUES de la table « profiles » : aucune donnee
--  n'est lue, modifiee ni supprimee. Rejouable sans effet de bord.
--  Rien a voir avec « supabase-phase2_4.sql », qui commence par des
--  « drop table ... cascade » et qu'il ne faut JAMAIS rejouer.
-- ============================================================================


-- ============================================================================
--  POURQUOI — deux pannes, une seule cause
-- ----------------------------------------------------------------------------
--  Le 9 aout 2026, deux fonctions ont echoue en service :
--
--   1. UN INVITE NE POUVAIT PAS TERMINER SON PROFIL. L'ecran affichait
--      « la base a refuse l'ecriture », alors que la personne remplissait
--      correctement son organisation.
--
--   2. LA CORRECTION D'UNE ORGANISATION PAR L'ADMINISTRATEUR LEAD NE FAISAIT
--      RIEN. Pire : l'application annoncait un succes, la liste se rechargeait,
--      et l'ancienne valeur revenait.
--
--  La cause est commune, et elle tient a la politique posee en phase 1 :
--
--      alter policy ... on public.profiles
--        using       (id = auth.uid())
--        with check  (id = auth.uid());
--
--  Elle dit : « chacun ne peut toucher QUE sa propre ligne ». Deux
--  consequences que personne n'avait mesurees :
--
--   - un compte invite n'a pas encore de ligne dans « profiles ». Un UPDATE
--     ne trouve donc rien a mettre a jour, et un INSERT est refuse faute de
--     politique d'insertion. L'invite est bloque dehors.
--
--   - l'administrateur lead n'atteint pas la ligne d'un tiers. Le declencheur
--     « profils_geler_org » de la phase 3 lui menage pourtant une exception
--     explicite (« if public.est_admin_lead() then return new; end if; »),
--     mais ce declencheur NE S'EXECUTE JAMAIS : la politique filtre la ligne
--     avant qu'il n'ait la parole. Une exception posee derriere une porte
--     fermee ne sert a rien.
--
--  PostgREST repond « 204 No Content » pour « 0 ligne modifiee » comme pour
--  « modification reussie » : c'est ce qui a rendu la panne silencieuse.
--  L'application teste desormais le nombre de lignes reellement ecrites.
-- ============================================================================


-- ----------------------------------------------------------------------------
--  1. INSERTION DE SA PROPRE LIGNE — debloque les invitations
-- ----------------------------------------------------------------------------
--  « with check (id = auth.uid()) » : on ne peut creer QUE sa propre ligne,
--  jamais celle d'un tiers. C'est le strict necessaire.
drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self
  on public.profiles
  for insert
  to authenticated
  with check (id = auth.uid());


-- ----------------------------------------------------------------------------
--  2. CORRECTION D'UN PROFIL PAR L'ADMINISTRATEUR LEAD
-- ----------------------------------------------------------------------------
--  Politique SEPAREE de celle de la phase 1, qui reste en place : PostgreSQL
--  applique les politiques d'une meme commande en OU logique. Chacun garde
--  donc le droit sur sa ligne, et l'administrateur lead l'obtient sur toutes.
--
--  « est_admin_lead() » est la fonction posee en phase 1 ; elle lit le role
--  dans « user_roles », que personne ne peut s'attribuer. La verification
--  figure en USING *et* en WITH CHECK : sans le second, un administrateur
--  pourrait modifier une ligne vers un etat qu'il n'aurait plus le droit de
--  relire.
drop policy if exists profiles_update_admin_lead on public.profiles;
create policy profiles_update_admin_lead
  on public.profiles
  for update
  to authenticated
  using      (public.est_admin_lead())
  with check (public.est_admin_lead());


-- ----------------------------------------------------------------------------
--  3. CREATION D'UNE LIGNE DE ROLE PAR L'ADMINISTRATEUR LEAD
-- ----------------------------------------------------------------------------
--  LE DEFAUT LE PLUS GRAVE DES TROIS : un compte ACTIVE restait bloque sur
--  l'ecran « Compte en attente d'activation ».
--
--  Le releve du 7 aout notait que « user_roles » possede une politique UPDATE
--  correcte (est_admin_lead() en USING et en WITH CHECK) et « aucune politique
--  INSERT ». C'etait juste, et c'etait presente comme une bonne nouvelle :
--  personne ne peut s'attribuer un role. Mais la consequence n'avait pas ete
--  tiree : PERSONNE NE PEUT EN CREER UN, l'administrateur lead compris.
--
--  Or un compte invite n'a pas de ligne dans « user_roles » : elle n'est creee
--  qu'a l'inscription ordinaire. L'administrateur choisissait un role,
--  l'application faisait un UPDATE, zero ligne etait touchee, PostgREST
--  repondait 204 — et « Role mis a jour » s'affichait sans que rien ne soit
--  ecrit. L'utilisateur restait devant l'ecran d'attente ; ni lui ni
--  l'administrateur ne pouvaient comprendre pourquoi.
--
--  La politique ci-dessous ouvre l'INSERT au SEUL administrateur lead. La
--  propriete verifiee le 7 aout est preservee : un utilisateur ordinaire ne
--  peut toujours pas creer sa propre ligne de role, et le test d'escalade
--  anonyme reste rejete.
drop policy if exists user_roles_insert_admin_lead on public.user_roles;
create policy user_roles_insert_admin_lead
  on public.user_roles
  for insert
  to authenticated
  with check (public.est_admin_lead());

--  « upsert » exige une contrainte d'unicite sur la colonne de conflit, sans
--  quoi PostgREST renvoie « there is no unique or exclusion constraint
--  matching the ON CONFLICT specification ». Elle existe normalement deja
--  (cle primaire) ; on la pose si elle manque, sans rien detruire.
do $$
begin
  if not exists (
    select 1 from pg_indexes
     where schemaname = 'public' and tablename = 'user_roles'
       and indexdef ilike '%unique%' and indexdef ilike '%(user_id)%')
  then
    create unique index user_roles_user_id_key on public.user_roles (user_id);
    raise notice 'index unique cree sur user_roles(user_id)';
  else
    raise notice 'contrainte d unicite deja presente sur user_roles(user_id)';
  end if;
end $$;


-- ----------------------------------------------------------------------------
--  4. CE QUI N'EST PAS OUVERT, ET POURQUOI
-- ----------------------------------------------------------------------------
--  Aucune politique DELETE n'est creee, ni sur « profiles » ni sur
--  « user_roles ». Supprimer un compte reste une operation d'administration, a
--  faire depuis le tableau de bord Supabase ou en SQL avec la cle de service.
--  Une application qui livre sa cle « anon » au navigateur ne doit pas pouvoir
--  effacer des comptes ni des roles.
--
--  Retirer un acces ne supprime rien : l'application repasse le role a
--  « En attente d'activation », ce qui est un UPDATE.


-- ============================================================================
--  CONTROLES — a lire apres execution
-- ============================================================================
--  Les deux nouvelles politiques doivent apparaitre.
select tablename, policyname, cmd, roles, qual, with_check
  from pg_policies
 where schemaname = 'public' and tablename in ('profiles', 'user_roles')
 order by tablename, cmd, policyname;

--  Le declencheur de la phase 3 doit toujours etre actif : il continue de
--  figer « org » pour tout le monde SAUF l'administrateur lead.
select tgname, tgenabled
  from pg_trigger
 where tgname = 'profils_geler_org' and not tgisinternal;

--  Combien de comptes n'ont pas encore d'organisation ? Ce sont eux que
--  l'application enverra vers l'ecran de completion a leur prochaine connexion.
select count(*) filter (where coalesce(org, '') = '') as sans_organisation,
       count(*)                                      as comptes
  from public.profiles;


-- ============================================================================
--  VERIFICATION EN CONDITIONS REELLES — a faire apres execution
-- ----------------------------------------------------------------------------
--   1. Avec un compte ADMINISTRATEUR LEAD : page Utilisateurs, lien
--      « modifier » a cote d'une organisation. La valeur doit changer ET
--      SURVIVRE au bouton « Actualiser ». C'est ce second point qui prouve que
--      l'ecriture a eu lieu en base et non seulement a l'ecran.
--
--   2. Avec un compte NON administrateur, depuis la console du navigateur :
--        sb.from('profiles').update({ org: 'X' }).eq('id', '<id d_un tiers>')
--      doit renvoyer 0 ligne. Si une ligne revient, la politique de la phase 1
--      a ete remplacee au lieu d'etre completee : reprendre le point 2.
--
--   3. LE CYCLE D'ACTIVATION, DE BOUT EN BOUT. C'est celui qui etait casse :
--      administrateur lead -> page Utilisateurs -> attribuer un role a un
--      compte « En attente ». Le message doit annoncer le role attribue, ET la
--      valeur doit survivre au bouton « Actualiser ». Cote utilisateur, le
--      bouton « Verifier a nouveau » de l'ecran d'attente doit alors ouvrir
--      l'application. Verification en base :
--        select p.email, r.role from public.profiles p
--          left join public.user_roles r on r.user_id = p.id order by p.email;
--
--   4. NON-REGRESSION DE SECURITE. Avec un compte NON administrateur lead,
--      depuis la console : sb.from('user_roles').insert({ user_id: '<son
--      propre id>', role: 'Administrateur lead' }) doit etre REJETE (42501).
--      C'est la propriete que la nouvelle politique INSERT ne doit pas avoir
--      affaiblie.
-- ============================================================================
--  Termine.
--  L'application fonctionne SANS ce script, mais deux fonctions restent
--  inoperantes : la finalisation d'un profil invite, et la correction d'une
--  organisation par l'administrateur lead. Les deux le disent desormais a
--  l'ecran, en nommant ce fichier, au lieu d'echouer en silence.
-- ============================================================================
