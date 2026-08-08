-- ============================================================================
--  FDFP · MIP-PPA — PHASE 7
--  Calendrier du projet : date de lancement et date de fin
--  À coller dans Supabase → SQL Editor → New query → Run
-- ----------------------------------------------------------------------------
--  CE SCRIPT NE DÉTRUIT RIEN.
--  Comme les phases 3, 4, 5 et 6, il ajoute des colonnes et peut etre reexecute
--  sans effet de bord. Rien a voir avec « supabase-phase2_4.sql », qui commence
--  par des « drop table ... cascade » et qu'il ne faut JAMAIS rejouer sur une
--  base en service.
-- ============================================================================


-- ============================================================================
--  POURQUOI
-- ----------------------------------------------------------------------------
--  Le modele MIP-PPA annonce un suivi a M+3 / M+6 / M+12. Jusqu'ici, ces trois
--  echeances etaient calculees a partir du jour ou le projet etait SAISI dans
--  l'application : c'etait la seule date connue. Un projet termine en mars et
--  enregistre en aout recevait donc un « M+3 » en novembre, soit huit mois
--  apres la fin de la formation. Le jalon ne mesurait plus ce que le modele
--  dit qu'il mesure.
--
--  Deux dates suffisent a le retablir, et la base ne les portait pas :
--    date_debut   lancement du projet ;
--    date_fin     fin du projet — c'est elle qui devient le point d'origine du
--                 suivi post-formation.
--
--  Les deux sont FACULTATIVES : un projet s'enregistre souvent avant que son
--  calendrier ne soit arrete. L'application fonctionne aussi sans cette
--  migration ; elle detecte l'absence des colonnes a la lecture, n'ecrit alors
--  ni l'une ni l'autre, et le dit a l'ecran.
-- ============================================================================

alter table public.projets
  add column if not exists date_debut date,
  add column if not exists date_fin   date;

comment on column public.projets.date_debut is
  'Date de lancement du projet de formation. NULL = non renseignee. '
  'Facultative : un projet peut etre saisi avant que son calendrier ne soit arrete.';

comment on column public.projets.date_fin is
  'Date de fin du projet. Sert de POINT D''ORIGINE aux echeances de suivi '
  'M+3 / M+6 / M+12 : le modele MIP-PPA compte ces trois jalons a partir de la '
  'fin de la formation, non de la saisie de la fiche.';


-- ----------------------------------------------------------------------------
--  Coherence des deux dates, garantie par la base et pas seulement par l'ecran.
--  L'application refuse deja une fin anterieure au lancement, mais la cle
--  « anon » est publique : la console du navigateur suffit a ecrire dans
--  PostgREST sans passer par le formulaire. C'est le meme raisonnement que
--  celui qui a conduit aux politiques RLS de la phase 6.
--
--  « not valid » : la contrainte s'applique aux ecritures A VENIR sans exiger
--  que les lignes deja presentes la respectent. Aucune ecriture existante
--  n'est donc rejetee au moment ou vous executez ce script.
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'projets_dates_coherentes'
       and conrelid = 'public.projets'::regclass
  ) then
    alter table public.projets
      add constraint projets_dates_coherentes
      check (date_debut is null or date_fin is null or date_fin >= date_debut)
      not valid;
  end if;
end $$;

-- Pour valider aussi l'existant, une fois les eventuelles lignes fautives
-- corrigees (la requete de controle plus bas les liste) :
--     alter table public.projets validate constraint projets_dates_coherentes;


-- Les listes et la page Alertes trient et filtrent sur la date de fin.
-- L'index exclut la corbeille lorsque la phase 5 a ete passee ; sinon il porte
-- sur toute la table, plutot que d'echouer sur une colonne absente et
-- d'interrompre le script au milieu.
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'projets'
       and column_name = 'supprime_le'
  ) then
    create index if not exists projets_date_fin_idx
      on public.projets (date_fin) where supprime_le is null;
  else
    create index if not exists projets_date_fin_idx
      on public.projets (date_fin);
  end if;
end $$;


-- ============================================================================
--  ⚠ A FAIRE AUSSI, HORS SQL : le lien « mot de passe oublie »
-- ----------------------------------------------------------------------------
--  La reinitialisation du mot de passe est desormais offerte sur l'ecran de
--  connexion. Elle repose entierement sur Supabase Auth, et deux reglages
--  doivent etre faits DANS LE TABLEAU DE BORD, pas ici :
--
--  1. Authentication → URL Configuration
--       Site URL      : l'adresse de production (ex. https://votre-app.vercel.app)
--       Redirect URLs : ajouter cette meme adresse, ET http://localhost:5173
--                       pour le serveur de developpement.
--     Sans cela, le lien recu par courriel renvoie sur localhost et le
--     destinataire tombe sur une page morte.
--
--  2. Authentication → Emails → « Reset Password »
--     Le gabarit par defaut est en anglais. Le traduire en francais, en
--     conservant la variable {{ .ConfirmationURL }}, qui porte le jeton.
--
--  3. Le fournisseur d'email par defaut de Supabase est BRIDE (quelques
--     messages par heure, projets gratuits). Pour un usage reel, brancher un
--     service SMTP dans Authentication → SMTP Settings, sinon les demandes de
--     reinitialisation seront silencieusement etranglees aux heures de pointe.
--
--  Rien de tout cela n'est destructif, et rien n'exige de migration.
-- ============================================================================


-- ============================================================================
--  CONTRÔLES
-- ============================================================================
select 'colonnes calendrier' as controle, column_name, data_type, is_nullable
  from information_schema.columns
 where table_schema = 'public'
   and table_name   = 'projets'
   and column_name in ('date_debut', 'date_fin')
 order by column_name;

-- Combien de projets portent deja un calendrier ?
select count(*)                                            as projets,
       count(date_debut)                                   as avec_date_debut,
       count(date_fin)                                     as avec_date_fin,
       count(*) filter (where date_debut is not null
                          and date_fin   is not null)      as avec_les_deux
  from public.projets;

-- Lignes qui violeraient la contrainte (doit rendre zero ligne). Ce sont
-- celles a corriger avant « validate constraint ».
select id, titre, date_debut, date_fin
  from public.projets
 where date_debut is not null
   and date_fin   is not null
   and date_fin   <  date_debut;

-- ============================================================================
--  Termine.
--  Cote application, les echeances de suivi se recalent sur la date de fin des
--  qu'elle est renseignee — sauf pour les jalons deja marques « effectue »,
--  dont la date est un fait constate et non une prevision.
-- ============================================================================
