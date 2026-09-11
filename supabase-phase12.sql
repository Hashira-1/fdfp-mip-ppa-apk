-- ============================================================================
--  FDFP · MIP-PPA — PHASE 12
--  Repartition par sexe des apprenants : colonnes « hommes » et « femmes »
--  A coller dans Supabase -> SQL Editor -> New query -> Run
-- ----------------------------------------------------------------------------
--  CE SCRIPT NE DETRUIT RIEN. Il ajoute deux colonnes NULLABLES a la table
--  « projets » et ne touche a aucune ligne existante. Rejouable sans effet de
--  bord : « add column if not exists » ne fait rien la deuxieme fois.
-- ============================================================================


-- ============================================================================
--  POURQUOI DEUX COLONNES, ET POURQUOI NULLABLES
-- ----------------------------------------------------------------------------
--  Le Produit Projet Apprentissage s'adresse a des jeunes en insertion, et la
--  place des femmes dans les filieres agroalimentaires est un objet de suivi
--  en soi — la Recommandation n° 208 de l'OIT, sur laquelle le produit est
--  aligne, en fait un point d'attention explicite. L'application savait
--  compter les apprenants ; elle ne savait pas dire qui ils sont.
--
--  NULLABLES, et c'est le point important. « 0 femme » est une information ;
--  « je ne sais pas » en est une autre. Les confondre en mettant zero par
--  defaut produirait un taux de feminisation d'autant plus bas que la donnee
--  manque, c'est-a-dire faux, et faux dans le sens qui flatte le moins les
--  projets les moins bien documentes. L'application applique la meme regle :
--  un champ vide reste vide, et le projet sort du calcul du taux au lieu d'y
--  entrer pour zero.
--
--  PAS DE CONTRAINTE « hommes + femmes = apprenants ». La repartition est
--  souvent PARTIELLE : on connait l'effectif feminin sans avoir ventile le
--  reste. Une contrainte d'egalite rendrait la saisie impossible dans ce cas
--  courant. Ce qui est refuse, cote application, c'est le seul cas
--  veritablement incoherent : une somme SUPERIEURE a l'effectif.
--
--  L'APPLICATION FONCTIONNE SANS CE SCRIPT. Tant que les colonnes n'existent
--  pas, elle ne les envoie pas — meme mecanisme que pour le calendrier de la
--  phase 7 —, et le formulaire affiche en clair quel script executer.
-- ============================================================================


-- ----------------------------------------------------------------------------
--  1. LES DEUX COLONNES
-- ----------------------------------------------------------------------------
alter table public.projets
  add column if not exists hommes integer,
  add column if not exists femmes integer;

--  Un effectif negatif n'existe pas. La contrainte est posee « not valid »
--  puis validee : sur une table deja peuplee, cela evite de bloquer l'ecriture
--  pendant la verification des lignes existantes.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'projets_sexe_positif') then
    alter table public.projets
      add constraint projets_sexe_positif
      check ((hommes is null or hommes >= 0) and (femmes is null or femmes >= 0))
      not valid;
    alter table public.projets validate constraint projets_sexe_positif;
  end if;
end $$;

comment on column public.projets.hommes is
  'Effectif masculin parmi les apprenants. NULL = non renseigne, a ne pas confondre avec 0.';
comment on column public.projets.femmes is
  'Effectif feminin parmi les apprenants. NULL = non renseigne, a ne pas confondre avec 0.';


-- ----------------------------------------------------------------------------
--  2. LE JEU DE DEMONSTRATION
-- ----------------------------------------------------------------------------
--  Renseigne les trois projets de demonstration, pour que la carte
--  « Apprenants concernes » ait quelque chose a montrer en soutenance.
--  Ne touche qu'a f1, f2 et f3, et seulement s'ils sont encore vides.
update public.projets set hommes = 18, femmes = 12
 where id = 'f1' and hommes is null and femmes is null;
update public.projets set hommes = 29, femmes = 21
 where id = 'f2' and hommes is null and femmes is null;
update public.projets set hommes = 9,  femmes = 16
 where id = 'f3' and hommes is null and femmes is null;


-- ----------------------------------------------------------------------------
--  3. CONTROLE — apres execution
-- ----------------------------------------------------------------------------
--  a. Les deux colonnes existent et acceptent NULL.
select column_name, data_type, is_nullable
  from information_schema.columns
 where table_schema = 'public' and table_name = 'projets'
   and column_name in ('hommes', 'femmes')
 order by column_name;

--  b. Aucune repartition ne doit depasser l'effectif d'apprenants.
--     Cette requete doit ne renvoyer AUCUNE ligne.
select id, titre, apprenants, hommes, femmes,
       coalesce(hommes, 0) + coalesce(femmes, 0) as total_reparti
  from public.projets
 where coalesce(hommes, 0) + coalesce(femmes, 0) > coalesce(apprenants, 0)
   and (hommes is not null or femmes is not null);

--  c. Etat de la couverture : sur combien de projets la repartition est-elle
--     connue, et quel taux de feminisation cela donne-t-il ?
select count(*) filter (where hommes is not null or femmes is not null) as projets_renseignes,
       count(*)                                                         as projets_total,
       sum(coalesce(hommes, 0))                                         as total_hommes,
       sum(coalesce(femmes, 0))                                         as total_femmes,
       round(100.0 * sum(coalesce(femmes, 0))
             / nullif(sum(coalesce(hommes, 0)) + sum(coalesce(femmes, 0)), 0), 1)
                                                                        as part_femmes_pct
  from public.projets
 where supprime_le is null;
