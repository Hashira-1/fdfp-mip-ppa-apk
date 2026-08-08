/* referentiel.js — Le vocabulaire métier de la plateforme.
 *
 * Ce que le FDFP évalue (les 5 dimensions et leurs 23 indicateurs), avec quoi
 * il le range (secteurs, matières premières, domaines), où il opère (les huit
 * implantations et les 108 localités qu'elles couvrent), et qui a le droit de
 * quoi (les rôles et leur matrice de permissions).
 *
 * Sorti d'« App.jsx » pour la même raison que « calculs.js » et
 * « geo-civ.js » : ce sont des données et des fonctions pures, sans état ni
 * rendu. Elles se lisent, se relisent et se discutent — un référentiel se
 * défend en soutenance — sans avoir à traverser trois mille lignes
 * d'interface. La contrainte du dépôt est « à plat », c'est-à-dire sans
 * sous-dossier ; elle n'a jamais voulu dire « un seul fichier ».
 *
 * Les valeurs ci-dessous sont des valeurs PAR DÉFAUT : le référentiel et la
 * nomenclature sectorielle sont modifiables dans l'application et rechargés
 * depuis Supabase. Elles servent au premier démarrage et au bouton
 * « Restaurer la nomenclature par défaut ».
 */
import { DEPARTEMENTS } from "./geo-civ.js";

export const REFERENTIEL_DEFAUT = [
  {
    id: "P", nom: "Pertinence", poids: 20,
    desc: "Alignement de la formation aux besoins métiers et aux normes de l'agro-industrie.",
    indicateurs: [
      { id: "P1", phase: "À la conception", label: "Part des objectifs pédagogiques rattachés à un besoin en compétences identifié par diagnostic formalisé avec l'entreprise, validée avant le démarrage (cible : 100 %)" },
      { id: "P2", phase: "À la conception", label: "Part des modules du programme alignés sur les référentiels métiers du secteur, vérifiée à l'instruction du dossier (cible : 100 %)" },
      { id: "P3", phase: "À la conception", label: "Part des formateurs justifiant d'une qualification et d'une expérience conformes aux contenus dispensés, contrôlée avant le démarrage (cible : 100 %)" },
      { id: "P4", phase: "À la conception", label: "Part des exigences HACCP et réglementaires applicables couvertes par le programme, vérifiée avant le démarrage (cible : 100 %)" },
    ],
  },
  {
    id: "EP", nom: "Efficacité pédagogique", poids: 25,
    desc: "Acquisition réelle des connaissances et gestes techniques.",
    indicateurs: [
      { id: "EP1", phase: "En fin de formation", label: "Progression moyenne des connaissances théoriques entre le test initial et le test final (cible : ≥ 30 points de pourcentage)" },
      { id: "EP2", phase: "En fin de formation", label: "Part des apprenants maîtrisant les gestes techniques évalués en situation de travail en fin de formation (cible : ≥ 80 %)" },
      { id: "EP3", phase: "En fin de formation", label: "Taux d'assiduité moyen des apprenants sur la durée totale de la formation (cible : ≥ 90 %)" },
      { id: "EP4", phase: "En fin de formation", label: "Taux de satisfaction des apprenants mesuré par questionnaire en fin de formation (cible : ≥ 80 %)" },
      { id: "EP5", phase: "En fin de formation", label: "Taux de satisfaction des tuteurs en entreprise sur la qualité pédagogique, recueilli en fin de formation (cible : ≥ 80 %)" },
      { id: "EP6", phase: "En fin de formation", label: "Taux de réussite aux épreuves de certification ou d'attestation en fin de formation (cible : ≥ 85 %)" },
    ],
  },
  {
    id: "IE", nom: "Insertion et employabilité", poids: 20,
    desc: "Insertion professionnelle des apprenants à l'issue du projet : accès à l'emploi, adéquation emploi-qualification et reconnaissance des compétences (OIT, Recommandation n° 208 sur les apprentissages de qualité, 2023).",
    indicateurs: [
      { id: "IE1", phase: "Suivi post-formation (3 / 6 / 12 mois)", label: "Taux d'insertion des apprenants dans l'emploi (salarié ou auto-emploi) mesuré au suivi M+6 (cible : ≥ 70 %)" },
      { id: "IE2", phase: "Suivi post-formation (3 / 6 / 12 mois)", label: "Part des apprenants insérés occupant un emploi en adéquation avec la qualification visée, mesurée à M+6 (cible : ≥ 80 %)" },
      { id: "IE3", phase: "Suivi post-formation (3 / 6 / 12 mois)", label: "Part des apprenants insérés en emploi stable (contrat ≥ 6 mois ou CDI, rémunération ≥ SMIG) mesurée à M+12 (cible : ≥ 60 %)" },
      { id: "IE4", phase: "En fin de formation", label: "Part des apprenants ayant reçu leur certification officielle (CQP, titre, attestation) dans le mois suivant la fin de la formation, la délivrance systématique étant attendue (cible : 100 % dans le délai)" },
    ],
  },
  {
    id: "IO", nom: "Impact organisationnel", poids: 25,
    desc: "Effets mesurables sur la qualité, la productivité et la sécurité.",
    indicateurs: [
      { id: "IO1", phase: "Suivi post-formation (3 / 6 / 12 mois)", label: "Réduction du taux de non-conformité qualité sur les postes concernés entre M+0 et M+6 (cible : ≥ 20 %)" },
      { id: "IO2", phase: "Suivi post-formation (3 / 6 / 12 mois)", label: "Amélioration de la productivité de la ligne ou du poste concerné entre M+0 et M+6 (cible : ≥ 10 %)" },
      { id: "IO3", phase: "Suivi post-formation (3 / 6 / 12 mois)", label: "Réduction du nombre d'accidents et d'incidents de sécurité alimentaire sur les postes concernés entre M+0 et M+12 (cible : ≥ 25 %)" },
      { id: "IO4", phase: "Suivi post-formation (3 / 6 / 12 mois)", label: "Part des compétences acquises effectivement mobilisées au poste de travail, constatée par le management à M+3 (cible : ≥ 70 %)" },
      { id: "IO5", phase: "Suivi post-formation (3 / 6 / 12 mois)", label: "Taux de satisfaction du management sur l'atteinte des objectifs de performance du projet, mesuré à M+6 (cible : ≥ 80 %)" },
    ],
  },
  {
    id: "DC", nom: "Durabilité des compétences", poids: 10,
    desc: "Ancrage durable des compétences acquises (6 et 12 mois).",
    indicateurs: [
      { id: "DC1", phase: "Suivi post-formation (3 / 6 / 12 mois)", label: "Taux de rétention des apprenants dans l'entreprise mesuré à M+6 (cible : ≥ 80 %)" },
      { id: "DC2", phase: "Suivi post-formation (3 / 6 / 12 mois)", label: "Part des apprenants promus ou ayant évolué vers un poste supérieur, mesurée à M+12 (cible : ≥ 30 %)" },
      { id: "DC3", phase: "Suivi post-formation (3 / 6 / 12 mois)", label: "Part des compétences acquises intégrées aux fiches de poste et procédures internes, vérifiée à M+12 (cible : ≥ 50 %)" },
      { id: "DC4", phase: "Suivi post-formation (3 / 6 / 12 mois)", label: "Part des apprenants appliquant les pratiques apprises sans supervision, constatée par observation à M+6 puis M+12 (cible : ≥ 70 %)" },
    ],
  },
];

export const ROLES = ["Administrateur lead", "Administrateur FDFP", "Agent FDFP", "Promoteur", "Opérateur", "En attente d'activation"];
export const SECTEURS_DEFAUT = {
  "Secteur primaire": {
    "Cultures de rente": ["Cacao", "Café", "Anacarde", "Coton", "Hévéa", "Palmier à huile"],
    "Cultures vivrières et maraîchères": ["Riz", "Manioc", "Igname", "Banane plantain", "Maraîchage", "Fruits"],
    "Élevage et aviculture": ["Bovins", "Petits ruminants", "Porcins", "Aviculture", "Apiculture"],
    "Pêche et aquaculture": ["Pêche artisanale", "Pêche industrielle", "Pisciculture"],
    "Sylviculture et exploitation forestière": ["Reboisement", "Exploitation du bois"],
    "Extraction minière": ["Or", "Manganèse", "Autres minerais"],
  },
  "Secteur secondaire": {
    "Transformation du cacao et du café": ["Fèves et masse de cacao", "Beurre et poudre", "Chocolaterie", "Torréfaction café"],
    "Transformation de l'anacarde": ["Décorticage", "Calibrage et conditionnement", "Valorisation des coques et pommes"],
    "Transformation des fruits et légumes": ["Jus et concentrés", "Séchage", "Conserves"],
    "Industrie laitière": ["Lait et yaourts", "Fromages", "Crèmes glacées"],
    "Meunerie et céréales": ["Farines", "Boulangerie-pâtisserie", "Biscuiterie", "Brasserie et boissons"],
    "Corps gras et huilerie": ["Huile de palme", "Huile de coton", "Savonnerie"],
    "Produits halieutiques": ["Conserverie de thon", "Fumage et salaison"],
    "Conditionnement et emballage": ["Emballages plastiques", "Cartons", "Étiquetage"],
    "Autres industries": ["Chimie et pharmacie", "Textile", "Métallurgie", "BTP", "Énergie"],
  },
  // Dans le tertiaire, le service ne transforme pas la matière première : il
  // l'accompagne. Le niveau intermédiaire désigne donc la matière première
  // concernée par la prestation, et le domaine précise le service rendu.
  // « Toutes matières premières » recueille les services support qui ne sont
  // rattachés à aucun produit en particulier (banque, numérique, formation).
  "Secteur tertiaire": {
    "Cacao et café": ["Négoce et exportation", "Logistique portuaire", "Certification et traçabilité"],
    "Anacarde": ["Négoce et exportation", "Entreposage et contrôle qualité"],
    "Fruits et légumes": ["Chaîne du froid", "Distribution et grande surface", "Exportation"],
    "Produits halieutiques": ["Chaîne du froid", "Distribution et mareyage"],
    "Céréales et vivriers": ["Stockage et conservation", "Commerce de gros", "Distribution de détail"],
    "Produits laitiers et carnés": ["Chaîne du froid", "Restauration collective", "Distribution"],
    "Toutes matières premières": ["Transport routier", "Banque et assurance agricoles", "Conseil et audit", "Numérique et traçabilité", "Formation professionnelle", "Administration et appui public"],
  },
};
// Accepte les anciens formats et les convertit vers {secteur: {branche: [domaines]}}
export const normaliserSecteurs = (s) => {
  if (Array.isArray(s)) { const o = {}; s.forEach((b) => { o[b] = ["Général"]; }); return { "Secteur secondaire": o }; }
  if (s && typeof s === "object" && Object.keys(s).length) {
    const o = {};
    for (const [grand, val] of Object.entries(s)) {
      if (Array.isArray(val)) { const bo = {}; val.forEach((b) => { bo[b] = ["Général"]; }); o[grand] = bo; }
      else if (val && typeof val === "object") o[grand] = val;
    }
    return Object.keys(o).length ? o : SECTEURS_DEFAUT;
  }
  return SECTEURS_DEFAUT;
};
// Retrouve le grand secteur d'une matiere premiere donnee
export const grandSecteurDe = (secteurs, branche) => {
  const n = normaliserSecteurs(secteurs);
  for (const [grand, branches] of Object.entries(n)) if (Object.keys(branches || {}).includes(branche)) return grand;
  return "";
};
// Libelle complet : "Secteur secondaire · Transformation de l'anacarde · Décorticage"
export const libelleSecteur = (f, secteurs) => {
  const grand = f.secteurGrand || grandSecteurDe(secteurs, f.filiere);
  const morceaux = [grand, f.filiere, f.domaine].filter(Boolean);
  return morceaux.join(" · ");
};
export const listeSecteursPlate = (s) => Object.values(normaliserSecteurs(s)).map((b) => Object.keys(b)).flat();

// Libellé « Base », puis « Base 2 », « Base 3 »… sans collision avec l'existant.
// Sans cela, un ajout pouvait réutiliser une clé déjà prise et écraser la ligne.
export const nomLibre = (base, existants) => {
  if (!existants.includes(base)) return base;
  let k = 2; while (existants.includes(`${base} ${k}`)) k++;
  return `${base} ${k}`;
};

// ----------------- IMPLANTATIONS FDFP (champ « Zone ») -----------
// Note : le champ reste stocké sous le nom « region » (colonne Supabase).
export const ANTENNES_FDFP = ["Abengourou", "Bouaké", "Daloa", "Korhogo", "Man", "San-Pédro", "Yamoussoukro"];
export const IMPLANTATIONS = ["Siège Abidjan", ...ANTENNES_FDFP.map((a) => `Antenne ${a}`)];
/* Comparaison de noms propres, indifférente aux accents ET aux séparateurs.
   « sensitivity: base » suffit pour les accents, mais pas pour le trait
   d'union ni l'apostrophe : le document de la DACD écrit « SAN PEDRO » et
   « M'BENGUE » là où l'application écrit « San-Pédro » et « M'Bengué ». Sans
   cette tolérance, les deux formes n'étaient pas reconnues comme une seule, et
   un projet repris sous la forme du document restait hors nomenclature —
   invisible aux filtres, absent de la carte. */
export const memeNom = (a, b) => {
  const pivot = (x) => String(x == null ? "" : x).replace(/[\s\-'’]+/g, "").toLowerCase();
  return pivot(a).localeCompare(pivot(b), "fr", { sensitivity: "base" }) === 0;
};

// Convertit les valeurs historiques (« Abidjan », « San-Pédro », « antenne de Bouaké »…)
// vers la nomenclature officielle ; laisse la valeur intacte si elle est inconnue.
export const normaliserRegion = (r) => {
  const v = String(r || "").trim();
  if (!v || IMPLANTATIONS.includes(v)) return v;
  const nu = v.replace(/^(si[eè]ge|antenne)\s*(d[eu']\s*)?/i, "").trim();
  const memeMot = (a, b) => memeNom(a, b);
  /* « SIEGE » tout seul — l'intitulé de la colonne dans le tableau B du
     document de la DACD. Il n'y a qu'un siège, et il est à Abidjan. */
  if (!nu && /^si[eè]ge/i.test(v)) return "Siège Abidjan";
  if (memeMot(nu, "Abidjan")) return "Siège Abidjan";
  const antenne = ANTENNES_FDFP.find((a) => memeMot(a, nu));
  return antenne ? `Antenne ${antenne}` : v;
};

// ----------------- LOCALITÉS (champ « Localité ») ----------------
// Une zone n'est pas un point : c'est un ensemble de départements. Le champ
// « Localité » désigne celui où le projet se déroule réellement, ce que la
// zone seule ne dit pas — huit implantations pour 108 départements.
// La liste proposée est donc toujours celle de la zone choisie, jamais les
// 108 : on ne peut pas se tromper d'antenne en choisissant sa localité.
/* Deux notions à ne pas confondre, et c'est la distinction du FDFP lui-même :
     — la ZONE d'occupation couvre tout le territoire. Chaque département
       relève d'une antenne ou du Siège ; c'est ce que la carte colorie.
     — les VILLES CIBLES (« t ») sont celles que le document de la DACD nomme,
       là où le FDFP intervient effectivement. Ce sont elles, et elles seules,
       qui sont proposées à la saisie.
   Un département sans ville cible appartient donc bien à une antenne : il est
   colorié comme elle, simplement aucun projet ne s'y localise. */
export const LOCALITES_PAR_ZONE = DEPARTEMENTS.reduce((acc, d) => {
  if (!d.t) return acc;
  (acc[d.z] = acc[d.z] || []).push(d.n);
  return acc;
}, {});
Object.values(LOCALITES_PAR_ZONE).forEach((l) => l.sort((a, b) => a.localeCompare(b, "fr")));

export const DEP_PAR_LOCALITE = DEPARTEMENTS.reduce((acc, d) => { acc[d.n] = d; return acc; }, {});

export const localitesDe = (zone) => LOCALITES_PAR_ZONE[normaliserRegion(zone)] || [];

// Chef-lieu de l'implantation elle-même : « Antenne Bouaké » → « Bouaké ».
// C'est la localité la plus probable, donc celle proposée par défaut.
export const localiteParDefaut = (zone) => {
  const z = normaliserRegion(zone);
  const liste = localitesDe(z);
  if (!liste.length) return "";
  const chef = z.replace(/^(Siège|Antenne)\s+/, "");
  return liste.find((n) => memeNom(n, chef)) || liste[0];
};

/* Ramène une localité à la nomenclature, dans le périmètre de sa zone. Une
   valeur venue d'un import ou d'une zone modifiée depuis peut ne plus
   appartenir à la zone : elle est alors remplacée par le chef-lieu, pour que
   carte et liste ne se contredisent jamais. */
export const normaliserLocalite = (loc, zone) => {
  const liste = localitesDe(zone);
  const v = String(loc || "").trim();
  if (!v) return localiteParDefaut(zone);
  const exact = liste.find((n) => memeNom(n, v));
  return exact || localiteParDefaut(zone);
};

/* Formulaire de projet à l'état neuf. Une fonction, pas un objet partagé :
   quatre endroits le réinitialisent (ouverture, création, modification,
   état initial) et ils écrivaient jusqu'ici quatre copies du même littéral —
   de quoi oublier un champ dans l'une d'elles en en ajoutant un. */
export const PROJET_VIERGE = () => ({
  titre: "", entreprise: "", operateur: "", beneficiaire: "",
  secteurGrand: "Secteur secondaire",
  filiere: "Transformation du cacao et du café",
  domaine: "Fèves et masse de cacao",
  region: "Siège Abidjan", localite: localiteParDefaut("Siège Abidjan"),
  apprenants: 10, budget: 5000000, statut: "Planifié",
});

// ----------------- MATRICE DES PERMISSIONS PAR RÔLE -------------
/* « exports » recouvrait trois choses très différentes, et c'est ce qui a
   ouvert la porte : sortir la fiche PDF d'un projet, extraire le classeur du
   portefeuille, et sauvegarder ou restaurer la base. Elles sont désormais
   distinctes.
     fichePdf        la fiche d'évaluation d'UN projet. Un promoteur y a droit
                     pour les siens : c'est son dossier.
     exportXlsx      le classeur Excel mis en forme, avec bandeau de
                     certification : c'est un document institutionnel, réservé
                     au FDFP.
     exportCsv       les mêmes données, brutes. Ouvert jusqu'au promoteur et à
                     l'opérateur : chacun peut relire ses propres chiffres dans
                     son tableur, sans que cela engage le FDFP.
     sauvegarde      sauvegarder, restaurer, reprendre un ancien classeur.
                     Ce sont des actes d'administration de la base, pas de
                     consultation. Réservé aux administrateurs.
   « Remplacer par la démo » reste sous « supprimerFormation » : c'est bien
   une suppression de masse, et le seul rôle qui l'a est l'administrateur
   lead. */
export const PERMS = {
  "Administrateur lead":     { pages: ["dashboard", "formations", "evaluation", "suivi", "indicateurs", "alertes", "exports", "guide", "users"], evalDims: "toutes", creerFormation: true,  editerFormation: true,  supprimerFormation: true,  referentiel: true,  secteurs: true,  users: true,  fichePdf: true,  exportXlsx: true,  exportCsv: true,  sauvegarde: true,  suivisJalons: "tous", suiviValider: true,  portee: "tous" },
  "Administrateur FDFP":     { pages: ["dashboard", "formations", "evaluation", "suivi", "indicateurs", "alertes", "exports", "guide"],          evalDims: "toutes", creerFormation: true,  editerFormation: true,  supprimerFormation: false, referentiel: true,  secteurs: false, users: false, fichePdf: true,  exportXlsx: true,  exportCsv: true,  sauvegarde: true,  suivisJalons: "tous", suiviValider: true,  portee: "tous" },
  "Agent FDFP":              { pages: ["dashboard", "formations", "evaluation", "suivi", "indicateurs", "alertes", "exports", "guide"],          evalDims: "toutes", creerFormation: false, editerFormation: false, supprimerFormation: false, referentiel: false, secteurs: false, users: false, fichePdf: true,  exportXlsx: true,  exportCsv: true,  sauvegarde: false,  suivisJalons: "tous", suiviValider: true,  portee: "tous" },
  "Promoteur":               { pages: ["dashboard", "formations", "evaluation", "suivi", "exports", "guide"],                          evalDims: "aucune", creerFormation: false, editerFormation: false, supprimerFormation: false, referentiel: false, secteurs: false, users: false, fichePdf: true,  exportXlsx: false, exportCsv: true, sauvegarde: false,  suivisJalons: "tous", suiviValider: false, portee: "entreprise", lectureSeule: true },
  "Opérateur":               { pages: ["dashboard", "formations", "evaluation", "suivi", "guide"],                                     evalDims: "aucune", creerFormation: false, editerFormation: false, supprimerFormation: false, referentiel: false, secteurs: false, users: false, fichePdf: false, exportXlsx: false, exportCsv: true, sauvegarde: false, suivisJalons: "tous", suiviValider: false, portee: "entreprise", lectureSeule: true },
  "En attente d'activation": { pages: ["guide"], evalDims: null, creerFormation: false, editerFormation: false, supprimerFormation: false, referentiel: false, secteurs: false, users: false, fichePdf: false, exportXlsx: false, exportCsv: false, sauvegarde: false, suivisJalons: "aucun", suiviValider: false, portee: "aucune" },
};

/* Le statut qualifie le PROJET de formation, pas la formation : « Planifié »,
   « Terminé », au masculin. Le féminin était un reste de l'époque où
   l'application parlait de « formations ». */
export const STATUTS_PROJET = ["Planifié", "En cours", "Terminé"];

/* Les projets déjà enregistrés portent l'ancienne forme. Elle est convertie à
   la lecture, comme « region » l'est par « normaliserRegion » : rien à migrer
   en base, et une valeur inconnue est laissée intacte plutôt que perdue. */
export const normaliserStatut = (v) => {
  const t = String(v || "").trim();
  if (!t) return "Planifié";
  if (STATUTS_PROJET.includes(t)) return t;
  const sansAccentFinal = { "Planifiée": "Planifié", "Terminée": "Terminé", "Planifiee": "Planifié", "Terminee": "Terminé" };
  if (sansAccentFinal[t]) return sansAccentFinal[t];
  const bas = t.toLowerCase();
  if (bas.startsWith("planifi")) return "Planifié";
  if (bas.startsWith("termin")) return "Terminé";
  if (bas.startsWith("en cours")) return "En cours";
  return t;
};
