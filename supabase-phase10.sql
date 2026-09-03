-- ============================================================================
--  FDFP · MIP-PPA — PHASE 10
--  Date de derniere connexion de CHAQUE compte, y compris avant la phase 9
--  A coller dans Supabase -> SQL Editor -> New query -> Run
-- ----------------------------------------------------------------------------
--  CE SCRIPT NE DETRUIT RIEN, ET NE CREE AUCUNE TABLE.
--  Il ajoute UNE fonction de lecture, « public.dernieres_connexions() ».
--  Aucune donnee n'est modifiee ni supprimee. Rejouable sans effet de bord.
--  Il complete la phase 9, il ne la remplace pas : les deux servent.
-- ============================================================================


-- ============================================================================
--  LE PROBLEME QU'IL RESOUT
-- ----------------------------------------------------------------------------
--  La phase 9 a installe un journal applicatif : chaque onglet qui ouvre une
--  session y depose une ligne. Il fonctionne — mais il ne peut rien dire des
--  connexions ANTERIEURES a son installation, parce qu'elles n'y ont jamais
--  ete inscrites. Resultat a l'ecran : la plupart des comptes affichaient
--  « Connexion non enregistree », y compris des comptes qui se connectent
--  regulierement depuis des semaines. Ce n'etait pas faux, mais c'etait
--  inutile.
--
--  Or la date existe, et depuis toujours : GoTrue tient « last_sign_in_at »
--  dans « auth.users », mis a jour a chaque authentification. Le probleme
--  n'est pas qu'elle manque, c'est qu'elle est HORS D'ATTEINTE du navigateur :
--  le schema « auth » n'est pas expose par PostgREST, et la cle publique n'y
--  accede pas — ce qui est heureux, cette table contient aussi les empreintes
--  de mots de passe et les jetons de recuperation.
--
--  La solution N'EST PAS de livrer la cle de service au client : ce serait
--  publier les pleins pouvoirs sur la base dans un fichier JavaScript. C'est
--  d'ouvrir une porte etroite — une fonction qui ne rend QUE deux colonnes,
--  et seulement a l'administrateur lead.
-- ============================================================================


-- ----------------------------------------------------------------------------
--  1. LA FONCTION
-- ----------------------------------------------------------------------------
--  CE QU'ELLE REND, ET RIEN D'AUTRE : un identifiant de compte, et la date de
--  sa derniere authentification. Pas d'email, pas d'empreinte de mot de passe,
--  pas de jeton, pas de metadonnees. C'est le strict necessaire pour ecrire
--  « Derniere connexion il y a 5 jours » sous un compte.
--
--  « security definer » : la fonction s'execute avec les droits de son
--  proprietaire, ce qui lui donne acces a « auth.users ». C'est ce qui rend le
--  garde-fou de la ligne « where » INDISPENSABLE — sans lui, n'importe quel
--  compte authentifie lirait la liste. « public.est_admin_lead() » vient de la
--  phase 1 ; pour tout autre appelant, la fonction rend ZERO ligne. Ce n'est
--  pas une erreur : c'est un resultat vide, que l'application traite comme
--  « pas d'information ».
--
--  « set search_path = '' » : tout est qualifie par son schema dans le corps
--  (« auth.users », « public.est_admin_lead »). Une fonction « security
--  definer » qui laisse un search_path modifiable peut etre detournee en
--  interposant un objet homonyme dans un schema place devant ; ici, il n'y a
--  aucun nom a resoudre.
create or replace function public.dernieres_connexions()
returns table (user_id uuid, derniere timestamptz)
language sql
stable
security definer
set search_path = ''
as $fn$
  select u.id, u.last_sign_in_at
    from auth.users u
   where public.est_admin_lead()
$fn$;


-- ----------------------------------------------------------------------------
--  2. QUI PEUT L'APPELER
-- ----------------------------------------------------------------------------
--  PostgreSQL accorde l'execution a « public » par defaut : on la retire, puis
--  on ne la rend qu'aux comptes authentifies. Le filtre de la fonction suffit
--  deja a proteger le contenu, mais une porte fermee vaut mieux qu'une porte
--  ouverte sur une piece vide — un visiteur anonyme n'a aucune raison de
--  pouvoir seulement appeler cette fonction.
revoke execute on function public.dernieres_connexions() from public;
revoke execute on function public.dernieres_connexions() from anon;
grant  execute on function public.dernieres_connexions() to authenticated;


-- ============================================================================
--  CE QUE L'APPLICATION EN FAIT
-- ----------------------------------------------------------------------------
--  Elle croise DEUX sources et retient la plus recente :
--
--   - « last_sign_in_at » (cette fonction) : la derniere AUTHENTIFICATION.
--     Elle remonte a la creation du compte, mais ne bouge pas tant que la
--     personne reste connectee — quelqu'un qui revient tous les jours sans se
--     deconnecter garde une date ancienne.
--
--   - la table « connexions » (phase 9) : la derniere OUVERTURE DE SESSION par
--     l'application. Elle ne remonte pas avant son installation, mais elle
--     suit les retours quotidiens.
--
--  Aucune des deux ne suffit seule ; leur maximum est la bonne reponse a la
--  question « depuis quand ce compte n'est-il plus venu ? ». Si aucune n'a de
--  valeur, l'ecran ecrit « Connexion non enregistree » — jamais « jamais
--  connecte ».
--
--  Si ce script n'est PAS execute, rien ne casse : l'appel echoue, il est
--  ignore, et l'affichage retombe sur le seul journal de la phase 9.
-- ============================================================================


-- ============================================================================
--  VERIFICATION — a executer apres coup, dans le meme editeur
-- ----------------------------------------------------------------------------
--  1) La fonction repond, et rend une ligne par compte :
--       select * from public.dernieres_connexions() order by derniere desc;
--     Execute depuis l'editeur SQL (donc en proprietaire), elle rend tout.
--     Depuis l'application, elle ne rend quelque chose qu'a l'administrateur
--     lead — c'est le comportement voulu, pas une panne.
--
--  2) Les droits sont bien ceux qu'on croit :
--       select grantee, privilege_type
--         from information_schema.routine_privileges
--        where routine_name = 'dernieres_connexions';
--     -> « authenticated / EXECUTE », et ni « anon » ni « PUBLIC ».
-- ============================================================================
