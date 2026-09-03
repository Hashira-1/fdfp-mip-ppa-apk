-- ============================================================================
--  FDFP · MIP-PPA — PHASE 9
--  Journal des connexions — « dernieres sessions » de la page Utilisateurs
--  A coller dans Supabase -> SQL Editor -> New query -> Run
-- ----------------------------------------------------------------------------
--  CE SCRIPT NE DETRUIT RIEN.
--  Il cree UNE table nouvelle, « public.connexions », et ses politiques.
--  Aucune table existante n'est lue, modifiee ni supprimee. Rejouable sans
--  effet de bord : tout est en « if not exists », ou en « drop policy if
--  exists » suivi d'un « create policy ».
--  Rien a voir avec « supabase-phase2_4.sql », qui commence par des
--  « drop table ... cascade » et qu'il ne faut JAMAIS rejouer.
-- ============================================================================


-- ============================================================================
--  POURQUOI UNE TABLE, ALORS QUE LA PRESENCE EXISTE DEJA
-- ----------------------------------------------------------------------------
--  La page « Utilisateurs & roles » affiche depuis le 8 aout une pastille
--  « En ligne », alimentee par la presence de Supabase Realtime. Elle repond a
--  une seule question : QUI EST DEVANT SON ECRAN MAINTENANT. Elle ne garde
--  aucune trace : quand l'onglet se ferme, l'annonce disparait, et avec elle
--  toute possibilite de dire « ce compte s'est connecte hier a 9 h ».
--
--  La question « quelles sont les dernieres sessions de connexion » demande
--  donc autre chose : un journal qui PERSISTE. Et il ne peut pas etre lu dans
--  « auth.sessions » : ce schema appartient a GoTrue, la cle publique du
--  navigateur ne l'atteint pas — et ne DOIT pas l'atteindre. Y acceder
--  supposerait de livrer la cle de service au client, c'est-a-dire de publier
--  les pleins pouvoirs sur la base dans un fichier JavaScript.
--
--  D'ou cette table : chaque onglet qui ouvre une session y depose UNE ligne,
--  pour lui-meme et seulement pour lui-meme. C'est peu, c'est ecrit par le
--  titulaire du compte, et c'est lisible par l'administrateur lead.
--
--  ⚠ CE QUE LE JOURNAL MESURE EXACTEMENT : les ouvertures de session par
--  l'application, pas les authentifications au sens de GoTrue. Une personne
--  qui ouvre deux onglets depose deux lignes ; un jeton renouvele en arriere-
--  plan n'en depose aucune. C'est la bonne definition pour de la supervision,
--  mais il faut savoir le dire — l'ecran l'ecrit d'ailleurs en toutes lettres.
--
--  ⚠ LE JOURNAL NE COMMENCE QU'AUJOURD'HUI. Les connexions anterieures a
--  l'execution de ce script n'existent nulle part et ne peuvent pas etre
--  reconstituees. Un compte ancien s'affichera « Aucune connexion
--  enregistree » tant qu'il ne se sera pas reconnecte — ce n'est pas une
--  panne, et l'ecran ne dit surtout pas « jamais connecte ».
-- ============================================================================


-- ----------------------------------------------------------------------------
--  1. LA TABLE
-- ----------------------------------------------------------------------------
--  « on delete cascade » : supprimer un compte dans Supabase efface son
--  journal avec lui. Un journal de connexions qui survit a son titulaire est
--  une donnee personnelle sans finalite.
--
--  « email » et « role » sont recopies a l'instant de la connexion plutot que
--  joints a « profiles » : ils disent ce qu'ETAIT le compte ce jour-la. Un
--  role retire plus tard ne doit pas reecrire l'histoire.
create table if not exists public.connexions (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  email       text,
  role        text,
  appareil    text,
  ouverte_le  timestamptz not null default now()
);

alter table public.connexions enable row level security;

--  Deux index, deux usages : la liste generale (les cinquante dernieres, tous
--  comptes confondus) et la derniere connexion d'un compte donne.
create index if not exists connexions_recentes_idx
  on public.connexions (ouverte_le desc);
create index if not exists connexions_par_compte_idx
  on public.connexions (user_id, ouverte_le desc);


-- ----------------------------------------------------------------------------
--  2. QUI ECRIT — soi-meme, et personne d'autre
-- ----------------------------------------------------------------------------
--  « with check (user_id = auth.uid()) » : un compte ne peut inscrire que SA
--  propre connexion. Il ne peut pas fabriquer une ligne au nom d'un tiers,
--  ni pour se donner un alibi, ni pour polluer le journal de quelqu'un.
drop policy if exists connexions_insert_self on public.connexions;
create policy connexions_insert_self
  on public.connexions
  for insert to authenticated
  with check (user_id = auth.uid());


-- ----------------------------------------------------------------------------
--  3. QUI LIT — soi-meme, et l'administrateur lead
-- ----------------------------------------------------------------------------
--  Chacun peut relire ses propres connexions : c'est la contrepartie normale
--  d'un journal qui le concerne. L'administrateur lead lit tout le journal :
--  c'est sa fonction de supervision, et c'est le seul role a qui l'interface
--  ouvre la page Utilisateurs.
--
--  « est_admin_lead() » vient de la phase 1. Elle est en « security definer »
--  et lit « user_roles » : une politique ne peut pas s'en passer sans se
--  mordre la queue.
drop policy if exists connexions_select on public.connexions;
create policy connexions_select
  on public.connexions
  for select to authenticated
  using (user_id = auth.uid() or public.est_admin_lead());


-- ----------------------------------------------------------------------------
--  4. AUCUNE POLITIQUE DE MODIFICATION NI DE SUPPRESSION — c'est voulu
-- ----------------------------------------------------------------------------
--  RLS refuse par defaut tout ce qu'aucune politique n'autorise. En n'ecrivant
--  ni « for update » ni « for delete », on rend le journal INALTERABLE depuis
--  l'application : personne, pas meme l'administrateur lead, ne peut effacer
--  une ligne depuis le navigateur. Un journal qu'on peut nettoyer soi-meme ne
--  prouve rien.
--  La purge du paragraphe 5 y echappe parce qu'elle s'execute en « security
--  definer », donc avec les droits du proprietaire de la fonction et non ceux
--  de l'appelant.


-- ----------------------------------------------------------------------------
--  5. PURGE AUTOMATIQUE — vingt lignes par compte au maximum
-- ----------------------------------------------------------------------------
--  Sans borne, la table grossit d'une ligne par ouverture d'onglet, pour
--  toujours. Deux facons de la borner : une tache planifiee (pg_cron, absent
--  des projets Supabase gratuits) ou un declencheur. C'est le declencheur qui
--  est retenu : il ne demande aucune extension et s'execute exactement quand
--  il le faut, a l'insertion.
--
--  Vingt lignes par compte : de quoi montrer les dernieres sessions et
--  repondre a « depuis quand ce compte ne s'est-il plus connecte ? », sans
--  constituer un historique de frequentation que personne n'a demande. C'est
--  aussi une limite de minimisation : on ne conserve pas ce dont on n'a pas
--  l'usage.
create or replace function public.connexions_borner()
returns trigger language plpgsql security definer set search_path = public
as $fn$
begin
  delete from public.connexions c
   where c.user_id = new.user_id
     and c.id not in (
       select id from public.connexions
        where user_id = new.user_id
        order by ouverte_le desc, id desc
        limit 20);
  return null;   -- declencheur AFTER : la valeur rendue est ignoree
end $fn$;

drop trigger if exists connexions_borner_trg on public.connexions;
create trigger connexions_borner_trg
  after insert on public.connexions
  for each row execute function public.connexions_borner();


-- ============================================================================
--  VERIFICATION — a executer apres coup, dans le meme editeur
-- ----------------------------------------------------------------------------
--  1) La table existe et RLS est actif :
--       select relrowsecurity from pg_class where relname = 'connexions';
--     -> doit rendre « true ».
--
--  2) Les politiques posees sont exactement au nombre de deux :
--       select policyname, cmd from pg_policies where tablename = 'connexions';
--     -> « connexions_insert_self / INSERT » et « connexions_select / SELECT ».
--
--  3) Le journal se remplit : se deconnecter, se reconnecter, puis
--       select email, role, appareil, ouverte_le
--         from public.connexions order by ouverte_le desc limit 5;
--
--  Tant que ce script n'est pas execute, l'application ne tombe PAS en panne :
--  la page Utilisateurs affiche un encart qui explique que le journal n'est
--  pas installe et renvoie a ce fichier. La pastille « En ligne » continue de
--  fonctionner, elle ne depend pas de cette table.
-- ============================================================================
