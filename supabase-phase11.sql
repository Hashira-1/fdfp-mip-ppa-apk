-- ============================================================================
--  FDFP · MIP-PPA — PHASE 11
--  Report du zonage redimensionne : l'antenne de Yamoussoukro disparait
--  A coller dans Supabase -> SQL Editor -> New query -> Run
-- ----------------------------------------------------------------------------
--  CE SCRIPT NE DETRUIT RIEN, NE SUPPRIME AUCUNE LIGNE, NE TOUCHE A AUCUNE
--  NOTE. Il ne fait que RENOMMER la zone des projets qui portent encore
--  « Antenne Yamoussoukro », vers l'antenne qui couvre desormais leur
--  localite. Rejouable sans effet de bord : a la deuxieme execution, plus
--  aucune ligne ne correspond.
-- ============================================================================


-- ============================================================================
--  CE QUI A CHANGE, ET POURQUOI CE SCRIPT EXISTE
-- ----------------------------------------------------------------------------
--  Le Departement charge du Developpement Local a redimensionne les zones de
--  couverture. L'antenne regionale de Yamoussoukro n'existe plus dans le
--  zonage : ses douze departements sont repris par trois antennes.
--
--      District autonome de Yamoussoukro   Yamoussoukro, Attiegouakro
--      Belier                              Tiebissou, Toumodi, Didievi,
--                                          Djekanou                 -> BOUAKE
--      N'Zi                                Dimbokro, Bocanda,
--                                          Kouassi-Kouassikro
--
--      Marahoue                            Bouafle, Sinfra          -> DALOA
--                                          (Daloa recupere ainsi toute
--                                           la Marahoue, Zuenoula compris)
--
--      Goh                                 Oume                     -> SAN-PEDRO
--                                          (Gagnoa y etait deja)
--
--  Aucune autre zone ne bouge. Le Siege garde ses quatorze departements : le
--  document du DDL ne couvre pas son perimetre.
--
--  L'APPLICATION SAIT DEJA LIRE L'ANCIENNE VALEUR. « normaliserRegion »
--  rattrape « Antenne Yamoussoukro » a la lecture et la rapporte a l'antenne
--  qui couvre la localite du projet. Rien ne casse donc sans ce script : la
--  carte, les filtres et les exports sont justes des le deploiement.
--  Ce que ce script apporte, c'est que la BASE dise la meme chose que
--  l'ecran — sans quoi une requete SQL, un export fait hors application ou
--  un futur outil branche sur PostgREST continueraient de lire une antenne
--  qui n'existe plus.
--
--  LA LOCALITE TRANCHE, PAS LA ZONE. Un projet a Oume releve de San-Pedro,
--  pas de Bouake : c'est pourquoi la mise a jour se fait localite par
--  localite et non par un simple remplacement de chaine.
-- ============================================================================


-- ----------------------------------------------------------------------------
--  1. ETAT DES LIEUX — a lire AVANT d'executer la suite
-- ----------------------------------------------------------------------------
--  S'il ne renvoie aucune ligne, il n'y a rien a migrer : le script est sans
--  objet, et c'est une bonne nouvelle.
select id, titre, region, localite
  from public.projets
 where region ilike '%yamoussoukro%'
 order by localite, id;


-- ----------------------------------------------------------------------------
--  2. LA MIGRATION
-- ----------------------------------------------------------------------------
--  « unaccent » n'est pas suppose installe : la comparaison se fait donc sur
--  les formes accentuees ET non accentuees, ce qui couvre les saisies faites
--  depuis le document du FDFP, qui ecrit en capitales sans accents.
update public.projets
   set region = case
         when localite ilike any (array['Bouafl_', 'BOUAFLE', 'Sinfra', 'SINFRA'])
           then 'Antenne Daloa'
         when localite ilike any (array['Oum_', 'OUME'])
           then 'Antenne San-Pédro'
         else 'Antenne Bouaké'   -- District autonome, Belier, N'Zi, et defaut
       end,
       maj_le = now()
 where region ilike '%yamoussoukro%';


-- ----------------------------------------------------------------------------
--  3. CONTROLE — apres execution
-- ----------------------------------------------------------------------------
--  a. Plus aucun projet ne doit porter l'ancienne antenne.
select count(*) as restants_yamoussoukro
  from public.projets
 where region ilike '%yamoussoukro%';

--  b. Repartition des projets par zone, pour verifier d'un coup d'oeil que
--     rien n'a atterri dans une antenne qui ne couvre pas sa localite.
select region, localite, count(*) as projets
  from public.projets
 group by region, localite
 order by region, localite;
