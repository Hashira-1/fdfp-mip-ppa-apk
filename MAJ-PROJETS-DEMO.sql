-- =====================================================================
-- MISE À JOUR DES TROIS PROJETS DE DÉMONSTRATION
-- =====================================================================
-- À coller dans Supabase → SQL Editor, puis « Run ».
--
-- POURQUOI CE SCRIPT. Déployer l'application ne change pas les données :
-- le code part sur Vercel, les projets vivent dans PostgreSQL. Les intitulés
-- affichés viennent de la table « projets », pas de « FORMATIONS_DEMO » —
-- ce tableau ne sert qu'au tout premier amorçage, sur une base vide.
--
-- CE QU'IL FAIT. Il met à jour les trois lignes f1, f2 et f3, et rien d'autre.
-- Aucune suppression, aucune création. Les notes des vingt-trois indicateurs
-- ne sont pas touchées : les scores restent 84 %, 59 % et 91 %.
--
-- Rejouable sans risque : le résultat est le même à la deuxième exécution.
--
-- ⚠ N'UTILISEZ PAS le bouton « Remplacer par la démo » pour cela : il
-- supprime tout projet absent du jeu de démonstration.
-- =====================================================================

update public.projets set
  titre        = 'Formation de 30 jeunes au métier de superviseur HACCP en ligne de conditionnement cacao',
  promoteur    = 'SACO',
  operateur    = 'A.C.A',
  beneficiaire = 'SCINPA',
  secteur_grand= 'Secteur secondaire',
  secteur      = 'Transformation du cacao et du café',
  domaine      = 'Fèves et masse de cacao',
  region       = 'Siège Abidjan',
  localite     = 'Abidjan',
  apprenants   = 30,
  budget       = 12500000,
  statut       = 'Terminé',
  date_debut   = '2025-11-03',
  date_fin     = '2026-02-20',
  maj_le       = now()
where id = 'f1';

update public.projets set
  titre        = 'Formation de 50 jeunes au métier d''agent contrôleur de processus de décorticage de l''anacarde',
  promoteur    = 'DIAOUNE AGRO-ALIMENTAIRE',
  operateur    = 'Emergence',
  beneficiaire = 'DIAOUNE AGRO-ALIMENTAIRE',
  secteur_grand= 'Secteur secondaire',
  secteur      = 'Transformation de l''anacarde',
  domaine      = 'Décorticage',
  region       = 'Antenne Bouaké',
  localite     = 'Bouaké',
  apprenants   = 50,
  budget       = 5000000,
  statut       = 'Terminé',
  date_debut   = '2026-01-12',
  date_fin     = '2026-04-17',
  maj_le       = now()
where id = 'f2';

update public.projets set
  titre        = 'Formation de 25 jeunes au métier de superviseur de la sécurité alimentaire et de la traçabilité ISO 22000',
  promoteur    = 'FrieslandCampina',
  operateur    = 'Domny',
  beneficiaire = 'FrieslandCampina',
  secteur_grand= 'Secteur secondaire',
  secteur      = 'Industrie laitière',
  domaine      = 'Lait et yaourts',
  region       = 'Antenne San-Pédro',
  localite     = 'San-Pédro',
  apprenants   = 25,
  budget       = 15200000,
  statut       = 'Terminé',
  date_debut   = '2026-02-09',
  date_fin     = '2026-06-02',
  maj_le       = now()
where id = 'f3';

-- Contrôle : les trois lignes doivent porter les nouveaux intitulés.
select id, titre, promoteur, secteur, region, localite, apprenants, budget
  from public.projets
 where id in ('f1', 'f2', 'f3')
 order by id;
