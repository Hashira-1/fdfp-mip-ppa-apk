import React, { useState, useMemo, useEffect, useRef } from "react";
import { jsPDF } from "jspdf";
import { createClient } from "@supabase/supabase-js";
import {
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";

/* ================================================================
   FDFP · MIP-PPA — Suivi des projets de formation de type apprentissage dans l'agro-industrie
   Reconstruction fidèle de l'application (modèle : 5 dimensions,
   23 indicateurs, notes 0–4, suivi post-formation à 3/6/12 mois)
   ================================================================ */

// ----------------- RÉFÉRENTIEL PAR DÉFAUT -----------------------
const REFERENTIEL_DEFAUT = [
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
      { id: "IE4", phase: "En fin de formation", label: "Part des apprenants ayant reçu leur certification officielle (CQP, titre, attestation) dans le mois suivant la fin de la formation — délivrance systématique attendue (cible : 100 % dans le délai)" },
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

// ----------------- DONNÉES DÉMO ---------------------------------
const FORMATIONS_DEMO = [
  {
    id: "f1", titre: "Maîtrise HACCP en ligne de conditionnement cacao",
    entreprise: "SACO", operateur: "A.C.A", beneficiaire: "SCINPA", secteurGrand: "Secteur secondaire", filiere: "Transformation du cacao et du café", domaine: "Fèves et masse de cacao", region: "Siège Abidjan",
    apprenants: 18, budget: 12500000, statut: "Terminée",
    notes: { P1: 4, P2: 3, P3: 4, P4: 4, EP1: 3, EP2: 3, EP3: 4, EP4: 4, EP5: 3, EP6: 4, IE1: 3, IE2: 3, IE3: 4, IE4: 3, IO1: 3, IO2: 3, IO3: 4, IO4: 3, IO5: 3, DC1: 3, DC2: 2, DC3: 3, DC4: 3 },
  },
  {
    id: "f2", titre: "Conduite de séchoir industriel (fruits tropicaux)",
    entreprise: "AGROCI", operateur: "Emergence", beneficiaire: "AGROCI", secteurGrand: "Secteur secondaire", filiere: "Transformation des fruits et légumes", domaine: "Jus et concentrés", region: "Antenne Yamoussoukro",
    apprenants: 9, budget: 6800000, statut: "Terminée",
    notes: { P1: 3, P2: 2, P3: 3, P4: 2, EP1: 2, EP2: 2, EP3: 3, EP4: 4, EP5: 2, EP6: 2, IE1: 2, IE2: 3, IE3: 2, IE4: 2, IO1: 2, IO2: 2, IO3: 3, IO4: 2, IO5: 2, DC1: 3, DC2: 2, DC3: 2, DC4: 2 },
  },
  {
    id: "f3", titre: "Sécurité alimentaire & traçabilité ISO 22000",
    entreprise: "FrieslandCampina", operateur: "Domny", beneficiaire: "FrieslandCampina", secteurGrand: "Secteur secondaire", filiere: "Industrie laitière", domaine: "Lait et yaourts", region: "Antenne San-Pédro",
    apprenants: 24, budget: 15200000, statut: "Terminée",
    notes: { P1: 4, P2: 4, P3: 4, P4: 4, EP1: 4, EP2: 3, EP3: 4, EP4: 4, EP5: 4, EP6: 4, IE1: 3, IE2: 3, IE3: 4, IE4: 3, IO1: 4, IO2: 3, IO3: 4, IO4: 4, IO5: 3, DC1: 3, DC2: 3, DC3: 4, DC4: 3 },
  },
];

const SUIVIS_DEMO = [
  { id: "s1", formationId: "f1", jalon: "M+3", echeance: "2026-05-20", statut: "effectué", note: "Transfert observé sur la ligne 2." },
  { id: "s2", formationId: "f1", jalon: "M+6", echeance: "2026-08-20", statut: "programmé", note: "" },
  { id: "s3", formationId: "f1", jalon: "M+12", echeance: "2027-02-20", statut: "programmé", note: "" },
  { id: "s4", formationId: "f2", jalon: "M+3", echeance: "2026-07-17", statut: "programmé", note: "" },
  { id: "s5", formationId: "f2", jalon: "M+6", echeance: "2026-10-17", statut: "programmé", note: "" },
  { id: "s6", formationId: "f2", jalon: "M+12", echeance: "2027-04-17", statut: "programmé", note: "" },
  { id: "s7", formationId: "f3", jalon: "M+3", echeance: "2026-09-02", statut: "programmé", note: "" },
  { id: "s8", formationId: "f3", jalon: "M+6", echeance: "2026-12-02", statut: "programmé", note: "" },
  { id: "s9", formationId: "f3", jalon: "M+12", echeance: "2027-06-02", statut: "programmé", note: "" },
];

// ----------------- CONNEXION À SUPABASE --------------------------
// ⬇⬇ COLLEZ ICI LES DEUX CLÉS DE VOTRE PROJET (Settings → API) ⬇⬇
// La clé « anon public » est conçue pour être publique : la sécurité est
// assurée par les règles installées dans la base (supabase-installation.sql).
const SUPABASE_URL_INTEGREE = "https://reoxoigrfeaadfpwvjxo.supabase.co";
const SUPABASE_CLE_INTEGREE = "sb_publishable_ffjmtgfzAZ9eS_1w8FAChw_1fUOipUC";
// ⬆⬆ Une fois remplies, l'écran de configuration disparaît pour TOUS les
// appareils. (Laissées vides, l'app se rabat sur la saisie locale des clés.)

function creerClientSupabase() {
  if (SUPABASE_URL_INTEGREE.startsWith("https://") && SUPABASE_CLE_INTEGREE.length > 20)
    return createClient(SUPABASE_URL_INTEGREE, SUPABASE_CLE_INTEGREE);
  try {
    const c = JSON.parse(window.localStorage.getItem("mip-ppa-sb") || "null");
    if (c && c.url && c.url.startsWith("https://") && c.cle) return createClient(c.url, c.cle);
  } catch (e) {}
  return null;
}
const sb = creerClientSupabase();

// ----------------- COMPTES & AUTHENTIFICATION ------
function lireStock(cle, defaut) {
  try { const v = window.localStorage.getItem(cle); return v ? JSON.parse(v) : defaut; } catch (e) { return defaut; }
}
function ecrireStock(cle, val) {
  try { window.localStorage.setItem(cle, JSON.stringify(val)); } catch (e) {}
}

const ROLES = ["Administrateur lead", "Administrateur FDFP", "Agent FDFP", "Promoteur", "Opérateur", "En attente d'activation"];
const SECTEURS_DEFAUT = {
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
const normaliserSecteurs = (s) => {
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
const grandSecteurDe = (secteurs, branche) => {
  const n = normaliserSecteurs(secteurs);
  for (const [grand, branches] of Object.entries(n)) if (Object.keys(branches || {}).includes(branche)) return grand;
  return "";
};
// Libelle complet : "Secteur secondaire · Transformation de l'anacarde · Décorticage"
const libelleSecteur = (f, secteurs) => {
  const grand = f.secteurGrand || grandSecteurDe(secteurs, f.filiere);
  const morceaux = [grand, f.filiere, f.domaine].filter(Boolean);
  return morceaux.join(" · ");
};
const listeSecteursPlate = (s) => Object.values(normaliserSecteurs(s)).map((b) => Object.keys(b)).flat();

// Libellé « Base », puis « Base 2 », « Base 3 »… sans collision avec l'existant.
// Sans cela, un ajout pouvait réutiliser une clé déjà prise et écraser la ligne.
const nomLibre = (base, existants) => {
  if (!existants.includes(base)) return base;
  let k = 2; while (existants.includes(`${base} ${k}`)) k++;
  return `${base} ${k}`;
};

// ----------------- IMPLANTATIONS FDFP (champ « Zone ») -----------
// Note : le champ reste stocké sous le nom « region » (colonne Supabase).
const ANTENNES_FDFP = ["Abengourou", "Bouaké", "Daloa", "Korhogo", "Man", "San-Pédro", "Yamoussoukro"];
const IMPLANTATIONS = ["Siège Abidjan", ...ANTENNES_FDFP.map((a) => `Antenne ${a}`)];
// Convertit les valeurs historiques (« Abidjan », « San-Pédro », « antenne de Bouaké »…)
// vers la nomenclature officielle ; laisse la valeur intacte si elle est inconnue.
const normaliserRegion = (r) => {
  const v = String(r || "").trim();
  if (!v || IMPLANTATIONS.includes(v)) return v;
  const nu = v.replace(/^(si[eè]ge|antenne)\s*(d[eu']\s*)?/i, "").trim();
  const memeMot = (a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }) === 0;
  if (memeMot(nu, "Abidjan")) return "Siège Abidjan";
  const antenne = ANTENNES_FDFP.find((a) => memeMot(a, nu));
  return antenne ? `Antenne ${antenne}` : v;
};

// ----------------- MATRICE DES PERMISSIONS PAR RÔLE -------------
const PERMS = {
  "Administrateur lead":     { pages: ["dashboard", "formations", "evaluation", "suivi", "indicateurs", "alertes", "exports", "guide", "users"], evalDims: "toutes", creerFormation: true,  editerFormation: true,  supprimerFormation: true,  referentiel: true,  secteurs: true,  users: true,  exports: true,  suivisJalons: "tous", suiviValider: true,  portee: "tous" },
  "Administrateur FDFP":     { pages: ["dashboard", "formations", "evaluation", "suivi", "indicateurs", "alertes", "exports", "guide"],          evalDims: "toutes", creerFormation: true,  editerFormation: true,  supprimerFormation: false, referentiel: true,  secteurs: false, users: false, exports: true,  suivisJalons: "tous", suiviValider: true,  portee: "tous" },
  "Agent FDFP":              { pages: ["dashboard", "formations", "evaluation", "suivi", "indicateurs", "alertes", "exports", "guide"],          evalDims: "toutes", creerFormation: false, editerFormation: false, supprimerFormation: false, referentiel: false, secteurs: false, users: false, exports: true,  suivisJalons: "tous", suiviValider: true,  portee: "tous" },
  "Promoteur":               { pages: ["dashboard", "formations", "evaluation", "suivi", "exports", "guide"],                          evalDims: "aucune", creerFormation: false, editerFormation: false, supprimerFormation: false, referentiel: false, secteurs: false, users: false, exports: true,  suivisJalons: "tous", suiviValider: false, portee: "entreprise", lectureSeule: true },
  "Opérateur":               { pages: ["dashboard", "formations", "evaluation", "suivi", "guide"],                                     evalDims: "aucune", creerFormation: false, editerFormation: false, supprimerFormation: false, referentiel: false, secteurs: false, users: false, exports: false, suivisJalons: "tous", suiviValider: false, portee: "entreprise", lectureSeule: true },
  "En attente d'activation": { pages: ["guide"], evalDims: null, creerFormation: false, editerFormation: false, supprimerFormation: false, referentiel: false, secteurs: false, users: false, exports: false, suivisJalons: "aucun", suiviValider: false, portee: "aucune" },
};
// ----------------- TEMPS DE RÉFÉRENCE ---------------------------
// Toute la plateforme raisonne en temps universel (UTC / GMT+0), et non dans
// le fuseau du poste : le FDFP et ses antennes doivent voir le même « en
// retard » au même moment, et une échéance ne doit pas changer de jour selon
// l'appareil qui la consulte. L'heure affichée dans l'en-tête est celle-ci.
// Minuit UTC du jour courant, en millisecondes.
const aujourdhuiUTC = () => {
  const n = new Date();
  return Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate());
};


// ----------------- ICÔNES VECTORIELLES (traits, style lucide) ----
const IC = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></>,
  cap: <><path d="M21.42 10.92a1 1 0 0 0-.02-1.84L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.83l8.57 3.91a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/></>,
  clipboard: <><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/></>,
  calendrier: <><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></>,
  graphique: <><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></>,
  cloche: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></>,
  telecharger: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></>,
  livre: <><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></>,
  utilisateurs: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
  bouclier: <><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></>,
  crayon: <><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></>,
  poubelle: <><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></>,
  fermer: <><path d="M18 6 6 18"/><path d="m6 6 12 12"/></>,
  plus: <><path d="M5 12h14"/><path d="M12 5v14"/></>,
  fichier: <><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M16 13H8"/><path d="M16 17H8"/></>,
  trombone: <><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></>,
  oeil: <><path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/></>,
  oeilBarre: <><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><path d="m2 2 20 20"/></>,
  deconnexion: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></>,
  lune: <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>,
  soleil: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></>,
  coche: <><path d="M20 6 9 17l-5-5"/></>,
  rotation: <><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></>,
  alerte: <><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></>,
  cible: <><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></>,
  horloge: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
  cocheCercle: <><path d="M21.8 10A10 10 0 1 1 17 3.34"/><path d="m9 11 3 3L22 4"/></>,
  usine: <><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></>,
  disquette: <><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/></>,
  tendance: <><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></>,
  note: <><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 12h4"/><path d="M10 16h4"/></>,
};
function Icone({ n, t = 18, className = "" }) {
  return (
    <svg viewBox="0 0 24 24" width={t} height={t} fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={"inline-block shrink-0 " + className}>
      {IC[n]}
    </svg>
  );
}

// Descriptions affichées au survol des rubriques (info-bulles)
const DESCR_NAV = {
  dashboard: "Vision consolidée du portefeuille : scores, radar, secteurs",
  projets: "Portefeuille des projets de formation financés par le FDFP",
  evaluation: "Noter un projet sur les 5 dimensions et 23 indicateurs",
  suivi: "Suivi du niveau de performance : jalons M+3 / M+6 / M+12",
  indicateurs: "Référentiel MIP-PPA : dimensions, pondérations, indicateurs",
  alertes: "Projets de formation de type apprentissage sous-performantes et suivis en retard",
  exports: "Fiches PDF officielles et tableau Excel consolidé",
  guide: "Documentation complète de la plateforme",
  users: "Activer les comptes et attribuer les rôles",
};

// ----------------- COULEURS -------------------------------------
const C = {
  sidebar: "#0d2233", sidebarActive: "#1d3d57", gold: "#f2a33c",
  vert: "#1d6fa8", vertFonce: "#0e3c60", vertClair: "#2280bf",
  excellent: "#16a34a", satisfaisant: "#1d6fa8", dev: "#ef8f1c", insuffisant: "#dc2626",
};

// ----------------- CALCULS --------------------------------------
const noteLabel = (n) => (n === 4 ? "Excellent" : n === 3 ? "Bon" : n === 2 ? "Partiel" : n === 1 ? "Faible" : n === 0 ? "Insuffisant" : "—");

function scoreDimension(referentiel, dimId, notes) {
  const dim = referentiel.find((d) => d.id === dimId);
  const vals = dim.indicateurs.map((i) => notes[i.id]).filter((v) => v !== undefined && v !== null);
  if (!vals.length) return null;
  return (vals.reduce((a, b) => a + b, 0) / vals.length / 4) * 100;
}
function scoreGlobal(referentiel, notes) {
  let tot = 0, poidsTot = 0;
  referentiel.forEach((d) => {
    const s = scoreDimension(referentiel, d.id, notes);
    if (s !== null) { tot += s * d.poids; poidsTot += d.poids; }
  });
  return poidsTot ? tot / poidsTot : null;
}
function niveau(score) {
  if (score === null) return { txt: "Non évalué", bg: "#e7e5e4", fg: "#57534e" };
  if (score >= 80) return { txt: "Excellent", bg: C.excellent, fg: "#fff" };
  if (score >= 60) return { txt: "Satisfaisant", bg: C.satisfaisant, fg: "#fff" };
  if (score >= 40) return { txt: "Moyen", bg: C.dev, fg: "#fff" };
  return { txt: "Insuffisant", bg: C.insuffisant, fg: "#fff" };
}
const fmtPct = (v) => (v === null ? "—" : `${Math.round(v)} %`);
/* Montants : regroupement par tranches de trois chiffres — milliers, millions,
   milliards… — pour que l'ordre de grandeur se lise d'un coup d'œil.
   Le séparateur produit par Intl varie selon le moteur (espace fine insécable
   U+202F sur les versions récentes, insécable U+00A0 sur les plus anciennes) :
   on le normalise vers un caractère unique, pour que l'affichage soit
   identique partout et que l'export PDF n'ait qu'un seul cas à traiter. */
const ESPACE_MILLIERS = "\u00A0";   // espace insecable
const grouperNombre = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0";
  return Math.round(n).toLocaleString("fr-FR").replace(/[\u202F\u00A0\u2009 ]/g, ESPACE_MILLIERS);
};
const fmtFCFA = (v) => `${grouperNombre(v)} FCFA`;
// Jours pleins entre aujourd'hui et une échéance « AAAA-MM-JJ ». Les deux
// bornes sont ramenées à minuit UTC : l'écart est donc un multiple exact de
// 24 h, sans dérive liée à l'heure de consultation ni au changement d'heure.
const joursRestants = (dateStr) => {
  if (!dateStr) return 0;
  const cible = Date.parse(String(dateStr).slice(0, 10) + "T00:00:00Z");
  return Number.isNaN(cible) ? 0 : Math.round((cible - aujourdhuiUTC()) / 86400000);
};

function telecharger(nomFichier, contenu, type = "text/csv;charset=utf-8") {
  const blob = new Blob(["\ufeff" + contenu], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nomFichier; a.click();
  URL.revokeObjectURL(url);
}

/* ----------------- IMAGE D'ARRIÈRE-PLAN DE LA PAGE --------------
   Seule image externe de l'application. Déposez le fichier dans le
   dossier « public » à la racine du projet (Vite le sert alors à la
   racine du site). Absent, la couleur #e8edf2 prend le relais.   */
const CHEMIN_FOND = "/fond-page.jpg";

/* ----------------- BANDEAU DE CERTIFICATION FDFP ----------------
   Sigle FDFP, QR code de vérification et macaron ISO 9001, affichés
   en pied de chaque feuille.
   L'image est incorporée au code : ce sont les octets exacts du
   fichier fourni, vérifiés par empreinte SHA-256 aprés encodage.
   Ce qui s'affiche est donc rigoureusement l'image importée, sans
   reconstitution ni approximation d'aucune sorte.
   Aucun fichier externe : ni erreur 404, ni problème de casse de nom
   au déploiement. Pour changer de visuel, réencoder le nouveau
   fichier en base64 et remplacer la chaîne ci-dessous.          */
const CERTIFICATION_FDFP = "data:image/png;base64,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";

// ----------------- LOGO FDFP (reproduction vectorielle) ---------
// Logo officiel du FDFP (image incorporée au code — aucun fichier externe requis)
const LOGO_FDFP = "data:image/jpeg;base64,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";

function LogoFDFP({ h = 32 }) {
  return (
    <div className="cadre-logo bg-white rounded-lg px-2 py-1 flex items-center justify-center shadow-sm" style={{ height: h + 10 }}>
      <img src={LOGO_FDFP} alt="FDFP — Fonds de Développement de la Formation Professionnelle" style={{ height: h, width: "auto" }} />
    </div>
  );
}

// ----------------- PETITS COMPOSANTS ----------------------------
function Badge({ score }) {
  const n = niveau(score);
  return (
    <span className="text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: n.bg, color: n.fg }}>
      {n.txt}{score !== null ? ` · ${Math.round(score)}%` : ""}
    </span>
  );
}
// Statut du projet : même format de pastille que le niveau de performance,
// mais teintes claires et vives (jaune, rose, lilas) là où le niveau de
// performance utilise des aplats saturés (vert, bleu, orange, rouge). Deux
// informations différentes, deux registres chromatiques distincts.
// Texte noir ou violet foncé : contraste largement supérieur au seuil AA.
const STATUTS_PROJET = ["Planifiée", "En cours", "Terminée"];
const teinteStatut = (statut) => {
  if (statut === "Terminée") return { bg: "#FFE94A", fg: "#000000" };  // jaune lumineux
  if (statut === "En cours") return { bg: "#FBCFE8", fg: "#000000" };  // rose doux
  if (statut === "Planifiée") return { bg: "#ede9fe", fg: "#5b21b6" }; // violet très pâle
  return { bg: "#eceaf2", fg: "#5c5470" };
};
function PuceStatut({ statut }) {
  const t = teinteStatut(statut);
  return (
    <span className="text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: t.bg, color: t.fg }}>
      {statut || "Statut non défini"}
    </span>
  );
}

/* Champ texte à validation différée.
   Les éditeurs de secteurs / branches / domaines réécrivaient la hiérarchie
   à chaque frappe : la clé de l'objet changeait en cours de saisie, les lignes
   se réordonnaient et le texte partait sur une autre ligne. Ici la saisie reste
   locale et n'est propagée qu'au blur ou sur Entrée (Échap annule). */
function ChampEditable({ valeur, surValider, className = "", largeurAuto = false, largeurMin = 6, titre, placeholder }) {
  const [txt, setTxt] = useState(valeur ?? "");
  const [enEdition, setEnEdition] = useState(false);
  const annule = useRef(false);
  useEffect(() => { if (!enEdition) setTxt(valeur ?? ""); }, [valeur, enEdition]);
  const valider = () => {
    const v = txt.trim();
    if (!v || v === valeur || surValider(v) === false) setTxt(valeur ?? "");
  };
  return (
    <input value={txt} title={titre} placeholder={placeholder} className={className}
      style={largeurAuto ? { width: Math.max(largeurMin, txt.length) + "ch" } : undefined}
      onChange={(e) => setTxt(e.target.value)}
      onFocus={() => setEnEdition(true)}
      onBlur={() => {
        setEnEdition(false);
        if (annule.current) { annule.current = false; setTxt(valeur ?? ""); return; }
        valider();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
        else if (e.key === "Escape") { annule.current = true; e.currentTarget.blur(); }
      }} />
  );
}

/* Pied de page institutionnel : bandeau FDFP complet — sigle, QR code de
   vérification et macaron ISO 9001. C'est une marque de certification, pas
   un élément de navigation : elle se place donc en bas, présente sur toutes
   les feuilles sans jamais disputer la place au contenu.
   Fond blanc permanent (le bandeau est fourni sur fond blanc) et texte de
   remplacement détaillé, car l'image porte une information écrite.
   L'image étant incorporée au code, elle ne peut plus manquer : aucune
   gestion d'absence n'est nécessaire. */
function PiedCertification() {
  return (
    <footer className="pied-certification">
      <img src={CERTIFICATION_FDFP}
        alt="FDFP — Fonds de Développement de la Formation Professionnelle. Certifié ISO 9001 version 2015 par Bureau Norme Audit, référence BNA/SMQ-FDCS03112513, sur tous nos processus et tous nos sites." />
    </footer>
  );
}

/* Date et heure de référence de la plateforme, en temps universel (GMT+0).
   Affichée en permanence dans le bandeau supérieur : c'est cette horloge qui
   détermine les retards et les échéances, elle doit donc être vérifiable d'un
   coup d'œil plutôt que déduite de l'heure du poste. */
function HorlogeUTC() {
  const [maintenant, setMaintenant] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setMaintenant(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const jour = maintenant.toLocaleDateString("fr-FR", {
    timeZone: "UTC", weekday: "short", day: "numeric", month: "long", year: "numeric",
  });
  const heure = maintenant.toLocaleTimeString("fr-FR", {
    timeZone: "UTC", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  return (
    <div className="horloge-utc" title="Date et heure de référence de la plateforme — temps universel (GMT+0). C'est sur cette base que sont calculés les retards et les échéances.">
      <div className="horloge-date">{jour}</div>
      <div className="horloge-heure">{heure}<span>GMT+0</span></div>
    </div>
  );
}

/* Carte de statistique. Sans « surClic », c'est un simple bloc d'affichage
   (comportement inchangé, notamment sur la page Suivi). Avec « surClic »,
   elle devient un vrai bouton : chevron d'appel, curseur main et anneau de
   focus au clavier. */
function StatCard({ icone, titre, valeur, sous, teinte = "#e3eef7", fg = C.vert, surClic, indice }) {
  const classes = "carte-hover bg-white rounded-2xl border border-stone-200 p-5 flex items-start gap-4";
  const contenu = (
    <>
      <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: teinte, color: fg }}>{icone}</div>
      <div className="min-w-0 text-left">
        <div className="text-[11px] uppercase tracking-wide text-stone-500 font-medium">{titre}</div>
        <div className="text-3xl font-bold text-stone-900">{valeur}</div>
        {sous && <div className="text-xs text-stone-400 mt-0.5">{sous}</div>}
      </div>
    </>
  );
  if (!surClic) return <div className={classes}>{contenu}</div>;
  return (
    <button type="button" onClick={surClic} title={indice}
      className={classes + " stat-cliquable w-full relative"}>
      {contenu}
      <span className="stat-chevron" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
      </span>
    </button>
  );
}
function Toast({ msg }) {
  if (!msg) return null;
  return (
    <div className="toast-anim fixed bottom-5 right-5 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg z-50" style={{ background: C.vertFonce }}>
      <Icone n="coche" t={14} /> {msg}
    </div>
  );
}


// ================= ÉCRANS D'ACCÈS ================================
function CadreAccueil({ enfants }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10"
      style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: "radial-gradient(120% 120% at 20% 0%, #14506f 0%, #0d2637 55%, #0a1d2a 100%)" }}>
      <style>{`@keyframes pageIn { from { opacity: 0; transform: translateY(10px);} to { opacity: 1; transform: none;} } .page-anim{animation:pageIn .32s ease-out both}`}</style>
      <div className="flex items-center gap-3 mb-6">
        <LogoFDFP h={34} />
        <div>
          <div className="text-white font-bold text-lg leading-tight">FDFP · MIP-PPA</div>
          <div className="text-sky-200 text-sm">Suivi des projets de formation de type apprentissage (emploi-qualification) dans les industries agroalimentaires</div>
        </div>
      </div>
      {enfants}
    </div>
  );
}

// Premier lancement : coller les deux clés Supabase (une seule fois par appareil)
function EcranConfiguration() {
  const [url, setUrl] = useState("");
  const [cle, setCle] = useState("");
  const [err, setErr] = useState("");
  return (
    <CadreAccueil enfants={
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-7 page-anim">
        <div className="flex items-center gap-2 font-bold text-stone-900"><Icone n="bouclier" t={18} /> Configuration initiale</div>
        <p className="text-sm text-stone-500 mt-1">Collez les deux clés de votre projet Supabase (Settings → API). Cette étape n'est faite qu'une fois par appareil.</p>
        {err && <div className="mt-3 text-sm rounded-xl px-3.5 py-2.5 bg-red-50 text-red-700 border border-red-200">{err}</div>}
        <label className="block text-sm font-semibold text-stone-800 mt-4">URL du projet <span className="font-normal text-stone-400">(Project URL)</span>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co"
            className="mt-1.5 w-full border border-stone-300 rounded-xl px-3.5 py-2.5 font-normal outline-none focus:border-sky-600" />
        </label>
        <label className="block text-sm font-semibold text-stone-800 mt-4">Clé publique <span className="font-normal text-stone-400">(anon public)</span>
          <textarea rows={3} value={cle} onChange={(e) => setCle(e.target.value)} placeholder="eyJhbGciOi..."
            className="mt-1.5 w-full border border-stone-300 rounded-xl px-3.5 py-2.5 font-normal outline-none focus:border-sky-600 resize-y" />
        </label>
        <button onClick={() => {
          if (!url.trim().startsWith("https://") || cle.trim().length < 20) { setErr("Vérifiez les deux valeurs : l'URL commence par https:// et la clé est une longue chaîne."); return; }
          ecrireStock("mip-ppa-sb", { url: url.trim(), cle: cle.trim() });
          window.location.reload();
        }} className="w-full mt-6 text-white font-semibold py-3 rounded-xl" style={{ background: C.vertFonce }}>Enregistrer et démarrer</button>
      </div>
    } />
  );
}

// Compte authentifié mais sans rôle : accès bloqué
function EcranAttente({ session, surActualiser, surDeconnexion }) {
  return (
    <CadreAccueil enfants={
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-7 page-anim text-center">
        <div className="flex justify-center text-amber-500"><Icone n="horloge" t={36} /></div>
        <h2 className="font-bold text-lg mt-3">Compte en attente d'activation</h2>
        <p className="text-sm text-stone-500 mt-2">Bonjour {session.nom.split(" ")[0]} — votre compte ({session.email}) est bien créé et votre email est vérifié. L'administrateur lead doit maintenant vous attribuer un rôle pour activer votre accès.</p>
        <div className="flex justify-center gap-3 mt-6">
          <button onClick={surActualiser} className="border border-stone-300 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-stone-50 flex items-center gap-1.5"><Icone n="rotation" t={14} /> Vérifier à nouveau</button>
          <button onClick={surDeconnexion} className="text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-1.5" style={{ background: C.vertFonce }}><Icone n="deconnexion" t={14} /> Se déconnecter</button>
        </div>
      </div>
    } />
  );
}

function EcranFinalisation({ session, surTermine }) {
  const [nom, setNom] = useState("");
  const [org, setOrg] = useState("");
  const [mdp, setMdp] = useState("");
  const [voir, setVoir] = useState(false);
  const [msg, setMsg] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const valider = async () => {
    if (!nom.trim() || !org.trim()) return setMsg("Renseignez votre nom complet et votre organisation.");
    if (mdp.length < 6) return setMsg("Mot de passe : 6 caractères minimum.");
    setEnvoi(true);
    const { error: e1 } = await sb.auth.updateUser({ password: mdp, data: { nom: nom.trim(), org: org.trim() } });
    const { error: e2 } = await sb.from("profiles").update({ nom: nom.trim(), org: org.trim() }).eq("id", session.id);
    setEnvoi(false);
    if (e1 || e2) return setMsg((e1 || e2).message);
    surTermine({ nom: nom.trim(), org: org.trim() });
  };
  return (
    <CadreAccueil enfants={
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-7 page-anim">
        <div className="flex items-center gap-2 font-bold text-stone-900"><Icone n="bouclier" t={18} /> Bienvenue !</div>
        <p className="text-sm text-stone-500 mt-1">Votre invitation est validée ({session.email}). Complétez votre profil et choisissez votre mot de passe pour terminer.</p>
        {msg && <div className="mt-3 text-sm rounded-xl px-3.5 py-2.5 bg-red-50 text-red-700 border border-red-200">{msg}</div>}
        <label className="block text-sm font-semibold text-stone-800 mt-4">Nom complet
          <input value={nom} onChange={(e) => setNom(e.target.value)} className="mt-1.5 w-full border border-stone-300 rounded-xl px-3.5 py-2.5 font-normal outline-none focus:border-sky-600" />
        </label>
        <label className="block text-sm font-semibold text-stone-800 mt-4">Organisation <span className="font-normal text-stone-400">(entreprise / cabinet)</span>
          <input value={org} onChange={(e) => setOrg(e.target.value)} className="mt-1.5 w-full border border-stone-300 rounded-xl px-3.5 py-2.5 font-normal outline-none focus:border-sky-600" />
        </label>
        <label className="block text-sm font-semibold text-stone-800 mt-4">Mot de passe <span className="font-normal text-stone-400">(6 caractères min.)</span>
          <div className="relative mt-1.5">
            <input type={voir ? "text" : "password"} value={mdp} onChange={(e) => setMdp(e.target.value)}
              className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 pr-12 font-normal outline-none focus:border-sky-600" />
            <button type="button" onClick={() => setVoir(!voir)} tabIndex={-1} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700">
              {voir ? <Icone n="oeilBarre" t={19} /> : <Icone n="oeil" t={19} />}
            </button>
          </div>
        </label>
        <button onClick={valider} disabled={envoi}
          className="w-full mt-6 text-white font-semibold py-3 rounded-xl disabled:opacity-60" style={{ background: C.vertFonce }}>
          {envoi ? "Un instant…" : "Terminer et accéder à la plateforme"}
        </button>
      </div>
    } />
  );
}

function EcranConnexion() {
  const [onglet, setOnglet] = useState("connexion");
  const [email, setEmail] = useState("");
  const [mdp, setMdp] = useState("");
  const [nom, setNom] = useState("");
  const [org, setOrg] = useState("");
  const [msg, setMsg] = useState(null);
  const [voirMdp, setVoirMdp] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  const connecter = async () => {
    setEnvoi(true); setMsg(null);
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: mdp });
    setEnvoi(false);
    if (error) {
      const t = error.message.includes("Invalid login") ? "Email ou mot de passe incorrect."
        : error.message.includes("Email not confirmed") ? "Email non confirmé : cliquez d'abord sur le lien reçu dans votre boîte mail (vérifiez les spams)."
        : error.message;
      setMsg({ type: "erreur", txt: t });
    }
  };
  const creer = async () => {
    if (!nom.trim() || !org.trim()) return setMsg({ type: "erreur", txt: "Renseignez votre nom complet et votre organisation." });
    if (mdp.length < 6) return setMsg({ type: "erreur", txt: "Mot de passe : 6 caractères minimum." });
    setEnvoi(true); setMsg(null);
    const { error } = await sb.auth.signUp({ email: email.trim(), password: mdp, options: { data: { nom: nom.trim(), org: org.trim() } } });
    setEnvoi(false);
    if (error) return setMsg({ type: "erreur", txt: error.message.includes("already registered") ? "Un compte existe déjà pour cet email." : error.message });
    setMsg({ type: "ok", txt: "Compte créé ! Un email de confirmation vient de vous être envoyé : cliquez sur le lien pour vérifier votre adresse, puis revenez vous connecter. L'administrateur lead activera ensuite votre accès." });
    setOnglet("connexion"); setMdp("");
  };
  const champ = (label, type, val, set, aide) => (
    <label key={label} className="block text-sm font-semibold text-stone-800 mt-4">{label}{aide && <span className="font-normal text-stone-400"> {aide}</span>}
      <input type={type} value={val} onChange={(e) => set(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && (onglet === "connexion" ? connecter() : creer())}
        className="mt-1.5 w-full border border-stone-300 rounded-xl px-3.5 py-2.5 font-normal outline-none focus:border-sky-600" />
    </label>
  );
  return (
    <CadreAccueil enfants={
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-7 page-anim">
        <div className="flex items-center gap-2 font-bold text-stone-900"><Icone n="bouclier" t={18} /> Espace sécurisé</div>
        <p className="text-sm text-stone-500 mt-1">Connectez-vous ou créez un compte. Un administrateur lead activera votre accès.</p>
        <div className="grid grid-cols-2 bg-stone-100 rounded-full p-1 mt-5 text-sm font-semibold">
          {[["connexion", "Connexion"], ["creation", "Créer un compte"]].map(([id, lbl]) => (
            <button key={id} onClick={() => { setOnglet(id); setMsg(null); }}
              className={`py-2 rounded-full ${onglet === id ? "bg-white shadow text-stone-900" : "text-stone-500"}`}>{lbl}</button>
          ))}
        </div>
        {msg && <div className={`mt-4 text-sm rounded-xl px-3.5 py-2.5 ${msg.type === "erreur" ? "bg-red-50 text-red-700 border border-red-200" : "bg-emerald-50 text-emerald-800 border border-emerald-200"}`}>{msg.txt}</div>}
        {onglet === "creation" && <>
          {champ("Nom complet", "text", nom, setNom)}
          {champ("Organisation", "text", org, setOrg, "(entreprise / cabinet)")}
        </>}
        {champ("Email professionnel", "email", email, setEmail)}
        <label className="block text-sm font-semibold text-stone-800 mt-4">Mot de passe{onglet === "creation" && <span className="font-normal text-stone-400"> (6 caractères min.)</span>}
          <div className="relative mt-1.5">
            <input type={voirMdp ? "text" : "password"} value={mdp} onChange={(e) => setMdp(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (onglet === "connexion" ? connecter() : creer())}
              className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 pr-12 font-normal outline-none focus:border-sky-600" />
            <button type="button" onClick={() => setVoirMdp(!voirMdp)} tabIndex={-1}
              title={voirMdp ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700">
              {voirMdp ? <Icone n="oeilBarre" t={19} /> : <Icone n="oeil" t={19} />}
            </button>
          </div>
        </label>
        <button onClick={onglet === "connexion" ? connecter : creer} disabled={envoi}
          className="w-full mt-6 text-white font-semibold py-3 rounded-xl disabled:opacity-60" style={{ background: C.vertFonce }}>
          {envoi ? "Un instant…" : onglet === "connexion" ? "Se connecter" : "Créer le compte"}
        </button>
        <p className="text-xs text-stone-400 mt-4 text-center">
          {onglet === "creation"
            ? "Un email de confirmation vous sera envoyé pour vérifier votre adresse."
            : "Votre accès dépend du rôle attribué par l'administrateur lead."}
        </p>
      </div>
    } />
  );
}

// ================= APPLICATION ===================================
export default function MipPpaApp() {
  const [page, setPage] = useState("dashboard");
  // Donnees metier centralisees dans Supabase (phase 2)
  const [referentiel, setReferentielBrut] = useState(REFERENTIEL_DEFAUT);
  const [formations, setFormationsBrut] = useState([]);
  const [suivis, setSuivisBrut] = useState([]);
  const [secteurs, setSecteursBrut] = useState(SECTEURS_DEFAUT);
  const [phases, setPhasesBrut] = useState(["À la conception", "En fin de formation", "Suivi post-formation (3 / 6 / 12 mois)"]);
  const [chargementData, setChargementData] = useState(true);

  // --- Ecriture Supabase : projets (upsert individuel) ---
  const projetVersRow = (f) => ({ id: f.id, titre: f.titre || "", promoteur: f.entreprise || f.promoteur || "", operateur: f.operateur || "", beneficiaire: f.beneficiaire || "", secteur: f.filiere || f.secteur || "", secteur_grand: f.secteurGrand || "", domaine: f.domaine || "", region: f.region || "", apprenants: Number(f.apprenants) || 0, budget: Number(f.budget) || 0, statut: f.statut || "Planifiée", notes: f.notes || {}, maj_le: new Date().toISOString() });
  const rowVersProjet = (r) => ({ id: r.id, titre: r.titre, entreprise: r.promoteur, operateur: r.operateur, beneficiaire: r.beneficiaire, filiere: r.secteur, secteurGrand: r.secteur_grand || "", domaine: r.domaine || "", region: normaliserRegion(r.region), apprenants: r.apprenants, budget: r.budget, statut: r.statut, notes: r.notes || {} });
  const suiviVersRow = (s) => ({ id: s.id, projet_id: s.formationId, jalon: s.jalon, echeance: s.echeance || null, statut: s.statut || "programmé", note: s.note || "", docs: s.docs || [], maj_le: new Date().toISOString() });
  const rowVersSuivi = (r) => ({ id: r.id, formationId: r.projet_id, jalon: r.jalon, echeance: r.echeance, statut: r.statut, note: r.note || "", docs: r.docs || [] });

  // --- Anti-echo temps reel ---
  // Chaque ecriture locale declenche un evenement postgres_changes qui nous revient.
  // Sans garde, le rechargement qui suit ecrase l'etat local (note qui saute sur une
  // autre valeur, ligne de secteur en cours de saisie qui repart en arriere).
  // On note l'instant de la derniere ecriture locale et on repousse tout
  // rechargement tant qu'on est dans la fenetre de retour d'echo.
  const derniereEcritureLocale = useRef(0);
  const rechargeTimer = useRef(null);
  const DELAI_ECHO = 2500;
  const marquerEcritureLocale = () => { derniereEcritureLocale.current = Date.now(); };

  // Les setters gardent la meme signature qu'avant, mais propagent vers Supabase
  const setFormations = (fn) => setFormationsBrut((v) => {
    const n = typeof fn === "function" ? fn(v) : fn;
    if (sb) {
      marquerEcritureLocale();
      const avantIds = new Set(v.map((x) => x.id)), apresIds = new Set(n.map((x) => x.id));
      n.forEach((f) => { const a = v.find((x) => x.id === f.id); if (!a || JSON.stringify(a) !== JSON.stringify(f)) sb.from("projets").upsert(projetVersRow(f)).then(({ error }) => error && console.warn(error.message)); });
      v.forEach((f) => { if (!apresIds.has(f.id)) sb.from("projets").delete().eq("id", f.id).then(() => {}); });
    }
    return n;
  });
  const setSuivis = (fn) => setSuivisBrut((v) => {
    const n = typeof fn === "function" ? fn(v) : fn;
    if (sb) {
      marquerEcritureLocale();
      const apresIds = new Set(n.map((x) => x.id));
      n.forEach((s) => { const a = v.find((x) => x.id === s.id); if (!a || JSON.stringify(a) !== JSON.stringify(s)) sb.from("suivis").upsert(suiviVersRow(s)).then(({ error }) => error && console.warn(error.message)); });
      v.forEach((s) => { if (!apresIds.has(s.id)) sb.from("suivis").delete().eq("id", s.id).then(() => {}); });
    }
    return n;
  });
  const sauverConfig = (champ, valeur) => { if (sb) { marquerEcritureLocale(); sb.from("configuration").update({ [champ]: valeur, maj_le: new Date().toISOString() }).eq("id", 1).then(({ error }) => error && console.warn(error.message)); } };
  const setReferentiel = (fn) => setReferentielBrut((v) => { const n = typeof fn === "function" ? fn(v) : fn; sauverConfig("referentiel", n); return n; });
  const setSecteurs = (fn) => setSecteursBrut((v) => { const n = typeof fn === "function" ? fn(v) : fn; sauverConfig("secteurs", n); return n; });
  const setPhases = (fn) => setPhasesBrut((v) => { const n = typeof fn === "function" ? fn(v) : fn; sauverConfig("phases", n); return n; });
  const [comptes, setComptes] = useState([]);          // liste chargée depuis Supabase (page Utilisateurs)
  const [session, setSession] = useState(null);         // { id, email, nom, org, role }
  const [chargementAuth, setChargementAuth] = useState(true);
  const roleActif = session?.role ?? "";

  // Charger le profil + rôle de l'utilisateur connecté
  const chargerProfil = async (utilisateur) => {
    const { data: p } = await sb.from("profiles").select("*").eq("id", utilisateur.id).maybeSingle();
    const { data: r } = await sb.from("user_roles").select("role").eq("user_id", utilisateur.id).maybeSingle();
    setSession({ id: utilisateur.id, email: utilisateur.email, nom: p?.nom || "", org: p?.org || "", role: r?.role || "En attente d'activation", aFinaliser: !(p && p.nom) });
    setChargementAuth(false);
  };
  useEffect(() => {
    if (!sb) { setChargementAuth(false); return; }
    sb.auth.getSession().then(({ data }) => { if (data.session?.user) chargerProfil(data.session.user); else setChargementAuth(false); });
    const { data: abo } = sb.auth.onAuthStateChange((_ev, s) => { if (s?.user) chargerProfil(s.user); else { setSession(null); setChargementAuth(false); } });
    return () => abo.subscription.unsubscribe();
  }, []);

  // Liste des comptes (réservée au lead — la sécurité est aussi appliquée côté serveur)
  const chargerComptes = async () => {
    const { data: profils } = await sb.from("profiles").select("*").order("cree_le");
    const { data: roles } = await sb.from("user_roles").select("*");
    setComptes((profils || []).map((p) => ({ id: p.id, email: p.email, nom: p.nom || p.email, org: p.org || "—", role: (roles || []).find((r) => r.user_id === p.id)?.role || "En attente d'activation" })));
  };
  const attribuerRole = async (userId, role) => {
    const { error } = await sb.from("user_roles").update({ role }).eq("user_id", userId);
    if (error) { notif("Échec : " + error.message); return; }
    notif("Rôle mis à jour"); chargerComptes();
  };
  const [evalId, setEvalId] = useState(null);
  const [recherche, setRecherche] = useState("");
  const [formOuvert, setFormOuvert] = useState(false);
  const [menuCompte, setMenuCompte] = useState(false);
  const [menuMobile, setMenuMobile] = useState(false);
  const [sombre, setSombre] = useState(() => { try { return localStorage.getItem("mip-ppa-theme") === "sombre"; } catch { return false; } });
  const basculerTheme = () => setSombre((v) => { const n = !v; try { localStorage.setItem("mip-ppa-theme", n ? "sombre" : "clair"); } catch {} return n; });
  const [estMobile, setEstMobile] = useState(typeof window !== "undefined" && window.innerWidth < 768);
  useEffect(() => {
    const maj = () => setEstMobile(window.innerWidth < 768);
    window.addEventListener("resize", maj);
    return () => window.removeEventListener("resize", maj);
  }, []);
  const [editionId, setEditionId] = useState(null);
  const [suiviEdit, setSuiviEdit] = useState(null); // fenêtre Notes & date & documents
  const [dimEdit, setDimEdit] = useState(null);     // fenêtre Modifier la dimension
  const [indEdit, setIndEdit] = useState(null);     // fenêtre Modifier l'indicateur
  const [docVu, setDocVu] = useState(null);          // visionneuse de document
  const [detailStat, setDetailStat] = useState(null); // "projets" | "apprenants" | "scores"
  const lead = roleActif === "Administrateur lead";
  const P = PERMS[roleActif] || PERMS["En attente d'activation"];
  const monCompte = session;
  useEffect(() => { if (session && !P.pages.includes(page)) setPage(P.pages[0]); }, [roleActif, session]); // redirection selon le rôle
  useEffect(() => { if (page === "users" && P.users && sb) chargerComptes(); }, [page, roleActif]);

  // --- Chargement initial des donnees metier depuis Supabase + temps reel ---
  const chargerDonnees = async () => {
    if (!sb) { setChargementData(false); return; }
    try {
      // Configuration partagee (referentiel / secteurs / phases)
      const { data: cfg } = await sb.from("configuration").select("*").eq("id", 1).maybeSingle();
      if (cfg) {
        if (Array.isArray(cfg.referentiel) && cfg.referentiel.length) setReferentielBrut(cfg.referentiel);
        else sauverConfig("referentiel", REFERENTIEL_DEFAUT); // 1re initialisation
        if (cfg.secteurs && Object.keys(cfg.secteurs).length) setSecteursBrut(normaliserSecteurs(cfg.secteurs));
        else sauverConfig("secteurs", SECTEURS_DEFAUT);
        if (Array.isArray(cfg.phases) && cfg.phases.length) setPhasesBrut(cfg.phases);
        else sauverConfig("phases", ["À la conception", "En fin de formation", "Suivi post-formation (3 / 6 / 12 mois)"]);
      }
      // Projets + suivis
      const { data: projs } = await sb.from("projets").select("*").order("cree_le");
      const { data: suivs } = await sb.from("suivis").select("*");
      let listeProjets = (projs || []).map(rowVersProjet);
      let listeSuivis = (suivs || []).map(rowVersSuivi);
      // Amorçage : si la base est vide ET qu'on est admin, injecter les donnees de demo
      if (!listeProjets.length && est_admin_amorcage()) {
        for (const f of FORMATIONS_DEMO) { await sb.from("projets").upsert(projetVersRow(f)); }
        for (const s of SUIVIS_DEMO) { await sb.from("suivis").upsert(suiviVersRow(s)); }
        listeProjets = FORMATIONS_DEMO.map((f) => ({ ...f }));
        listeSuivis = SUIVIS_DEMO.map((s) => ({ ...s }));
      }
      setFormationsBrut(listeProjets);
      setSuivisBrut(listeSuivis);
    } catch (e) { console.warn("Chargement donnees:", e.message); }
    setChargementData(false);
  };
  const est_admin_amorcage = () => ["Administrateur lead", "Administrateur FDFP"].includes(roleActif);

  useEffect(() => {
    if (!session || roleActif === "En attente d'activation") return;
    chargerDonnees();
    if (!sb) return;
    // Temps reel : quand un autre utilisateur modifie, on recharge
    const canal = sb.channel("mip-ppa-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "projets" }, () => rechargerLeger())
      .on("postgres_changes", { event: "*", schema: "public", table: "suivis" }, () => rechargerLeger())
      .on("postgres_changes", { event: "*", schema: "public", table: "configuration" }, () => rechargerLeger())
      .subscribe();
    return () => { sb.removeChannel(canal); };
  }, [session, roleActif]);

  // Rechargement silencieux (declenche par le temps reel des autres utilisateurs).
  // Le minuteur vit dans une ref : l'ancienne variable locale etait recreee a chaque
  // rendu, donc la protection anti-rafale ne fonctionnait jamais.
  const rechargerLeger = () => {
    if (!sb) return;
    if (rechargeTimer.current) clearTimeout(rechargeTimer.current);
    const executer = async () => {
      rechargeTimer.current = null;
      // Ecriture locale recente : c'est notre propre echo, ou l'utilisateur est en
      // train de saisir. On repousse plutot que d'ecraser ce qu'il vient de faire.
      const depuis = Date.now() - derniereEcritureLocale.current;
      if (depuis < DELAI_ECHO) { rechargeTimer.current = setTimeout(executer, DELAI_ECHO - depuis); return; }
      try {
        // On lit tout d'abord, puis on applique en bloc : appliquer la configuration
        // avant la fin des autres requetes rouvrait la fenetre d'ecrasement.
        const { data: cfg } = await sb.from("configuration").select("*").eq("id", 1).maybeSingle();
        const { data: projs } = await sb.from("projets").select("*").order("cree_le");
        const { data: suivs } = await sb.from("suivis").select("*");
        // Une ecriture locale a pu partir pendant les requetes : on abandonne ce lot.
        if (Date.now() - derniereEcritureLocale.current < DELAI_ECHO) { rechargerLeger(); return; }
        if (cfg) { if (Array.isArray(cfg.referentiel) && cfg.referentiel.length) setReferentielBrut(cfg.referentiel); if (cfg.secteurs) setSecteursBrut(normaliserSecteurs(cfg.secteurs)); if (Array.isArray(cfg.phases)) setPhasesBrut(cfg.phases); }
        setFormationsBrut((projs || []).map(rowVersProjet));
        setSuivisBrut((suivs || []).map(rowVersSuivi));
      } catch (e) {}
    };
    rechargeTimer.current = setTimeout(executer, 600);
  };
  useEffect(() => () => { if (rechargeTimer.current) clearTimeout(rechargeTimer.current); }, []);
  const [nouvelle, setNouvelle] = useState({ titre: "", entreprise: "", operateur: "", beneficiaire: "", secteurGrand: "Secteur secondaire", filiere: "Transformation du cacao et du café", domaine: "Fèves et masse de cacao", region: "Siège Abidjan", apprenants: 10, budget: 5000000, statut: "Planifiée" });
  const [toast, setToast] = useState("");
  const notif = (m) => { setToast(m); setTimeout(() => setToast(""), 2500); };
  const [emailInvite, setEmailInvite] = useState("");
  const [roleInvite, setRoleInvite] = useState("Agent FDFP");
  const urlApp = (typeof window !== "undefined" && window.location && window.location.origin) ? window.location.origin : "https://fdfp-mip-ppa-apk.vercel.app";
  const [envoiInvite, setEnvoiInvite] = useState(false);
  // Regex proche RFC 5322 (raisonnable côté navigateur) : rejette les espaces, doubles points,
  // domaines sans TLD valide, etc. — première barrière contre les emails qui rebondiraient.
  const REGEX_EMAIL = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  // Fautes de frappe fréquentes sur les domaines grand public -> avertissement (non bloquant)
  const DOMAINES_PROCHES = {
    "gmial.com": "gmail.com", "gmai.com": "gmail.com", "gmail.co": "gmail.com", "gmal.com": "gmail.com",
    "yahou.com": "yahoo.com", "yaho.com": "yahoo.com", "yahoo.co": "yahoo.com",
    "hotmial.com": "hotmail.com", "hotmail.co": "hotmail.com", "hotnail.com": "hotmail.com",
    "outlok.com": "outlook.com", "outlook.co": "outlook.com",
  };
  const suggestionDomaine = (email) => {
    const d = email.split("@")[1]?.toLowerCase();
    return d && DOMAINES_PROCHES[d] ? DOMAINES_PROCHES[d] : null;
  };
  const envoyerInvitation = async () => {
    const email = emailInvite.trim().toLowerCase();
    if (!REGEX_EMAIL.test(email)) { notif("Adresse email invalide — vérifiez le format (ex. nom@organisation.ci)"); return; }
    const suggestion = suggestionDomaine(email);
    if (suggestion) {
      const corrige = email.split("@")[0] + "@" + suggestion;
      const veutCorriger = window.confirm(`Vouliez-vous dire « ${corrige} » au lieu de « ${email} » ?\n\nOK pour corriger automatiquement, Annuler pour envoyer tel quel.`);
      if (veutCorriger) { setEmailInvite(corrige); notif("Adresse corrigée — cliquez à nouveau sur Envoyer pour confirmer"); return; }
    }
    setEnvoiInvite(true);
    try {
      const { data, error } = await sb.functions.invoke("inviter", { body: { email } });
      if (error || (data && data.erreur)) throw new Error((data && data.erreur) || error.message);
      notif("Invitation envoyée à " + email);
      setEmailInvite("");
    } catch (e) {
      // Repli : la fonction serveur n'est pas (encore) déployée -> messagerie pré-remplie
      notif("Envoi direct indisponible (" + (e.message || e) + ") — ouverture de votre messagerie");
      const sujet = "Invitation - Plateforme FDFP MIP-PPA";
      const corps = ["Bonjour,", "", "Vous etes invite(e) a rejoindre la plateforme FDFP MIP-PPA.", "", "1. Rendez-vous sur : " + urlApp, "2. Cliquez sur \"Creer un compte\".", "3. Confirmez votre email puis attendez l'activation de votre acces (role prevu : " + roleInvite + ").", "", "L'equipe FDFP"].join("\n");
      window.location.href = "mailto:" + encodeURIComponent(email) + "?subject=" + encodeURIComponent(sujet) + "&body=" + encodeURIComponent(corps);
    }
    setEnvoiInvite(false);
  };


  const admin = P.referentiel;

  // ---------- Portée des données selon le rôle ----------
  const formationsVisibles = useMemo(() =>
    P.portee === "entreprise"
      ? formations.filter((f) => {
          const moi = (monCompte?.org || "").trim().toLowerCase();
          return moi && ((f.entreprise || "").trim().toLowerCase() === moi || (f.operateur || "").trim().toLowerCase() === moi);
        })
      : P.portee === "tous" ? formations : [],
    [formations, P, monCompte]);

  // ---------- Calculs consolidés ----------
  const stats = useMemo(() => {
    const scores = formationsVisibles.map((f) => scoreGlobal(referentiel, f.notes)).filter((s) => s !== null);
    const moy = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    const alertesScore = formationsVisibles.filter((f) => { const s = scoreGlobal(referentiel, f.notes); return s !== null && s < 40; });
    const enRetard = suivis.filter((s) => s.statut === "programmé" && joursRestants(s.echeance) < 0);
    return {
      nb: formationsVisibles.length,
      apprenants: formationsVisibles.reduce((a, f) => a + Number(f.apprenants || 0), 0),
      budget: formationsVisibles.reduce((a, f) => a + Number(f.budget || 0), 0),
      moy, alertes: alertesScore.length + enRetard.length, alertesScore, enRetard,
    };
  }, [formationsVisibles, suivis, referentiel]);

  const radarData = useMemo(() =>
    referentiel.map((d) => {
      const vals = formationsVisibles.map((f) => scoreDimension(referentiel, d.id, f.notes)).filter((v) => v !== null);
      return { dim: d.nom, score: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0 };
    }), [formationsVisibles, referentiel]);

  const filiereData = useMemo(() => {
    const map = {};
    formationsVisibles.forEach((f) => {
      const s = scoreGlobal(referentiel, f.notes);
      if (s === null) return;
      const cle = libelleSecteur(f, secteurs); if (!map[cle]) map[cle] = []; map[cle].push(s);
    });
    return Object.entries(map).map(([fil, arr]) => ({ filiere: fil, score: arr.reduce((a, b) => a + b, 0) / arr.length }));
  }, [formationsVisibles, referentiel]);

  // ---------- Actions ----------
  /* Répercussion d'un renommage du référentiel sur les données déjà saisies.
     Les projets désignent leur secteur, leur branche et leur domaine par le
     libellé, pas par un identifiant : sans cette propagation, renommer une
     branche laissait les projets existants accrochés à l'ancien nom — ils
     disparaissaient des regroupements sectoriels et des graphiques.
     Renvoie le nombre de projets mis à jour, pour le message de confirmation. */
  const propagerRenommage = (champ, ancien, nouveau, concerne = () => true) => {
    const touches = formations.filter((f) => f[champ] === ancien && concerne(f));
    if (touches.length) {
      const ids = new Set(touches.map((f) => f.id));
      setFormations((fs) => fs.map((f) => (ids.has(f.id) ? { ...f, [champ]: nouveau } : f)));
    }
    return touches.length;
  };
  // Même principe pour les phases de mesure, référencées par libellé dans
  // chaque indicateur du référentiel.
  const propagerRenommagePhase = (ancien, nouveau) => {
    let touches = 0;
    referentiel.forEach((d) => d.indicateurs.forEach((i) => { if (i.phase === ancien) touches++; }));
    if (touches) {
      setReferentiel((r) => r.map((d) => ({
        ...d,
        indicateurs: d.indicateurs.map((i) => (i.phase === ancien ? { ...i, phase: nouveau } : i)),
      })));
    }
    return touches;
  };
  // « 3 projets mis à jour » / « aucun projet concerné »
  const messagePropagation = (n, mot = "projet") =>
    n ? ` — ${n} ${mot}${n > 1 ? "s" : ""} mis à jour` : "";

  const noter = (fid, indId, note) => {
    setFormations((fs) => fs.map((f) => {
      if (f.id !== fid) return f;
      const notes = { ...f.notes };
      if (notes[indId] === note) delete notes[indId]; else notes[indId] = note;
      return { ...f, notes };
    }));
  };
  const ajouterFormation = () => {
    if (!nouvelle.titre.trim() || !nouvelle.entreprise.trim()) { notif("Renseignez au minimum l'intitulé et le promoteur"); return; }
    if (editionId) {
      setFormations((fs) => fs.map((f) => f.id === editionId ? { ...f, ...nouvelle } : f));
      setEditionId(null); setFormOuvert(false);
      setNouvelle({ titre: "", entreprise: "", operateur: "", beneficiaire: "", secteurGrand: "Secteur secondaire", filiere: "Transformation du cacao et du café", domaine: "Fèves et masse de cacao", region: "Siège Abidjan", apprenants: 10, budget: 5000000, statut: "Planifiée" });
      notif("Formation mise à jour"); return;
    }
    const id = "f" + Date.now();
    setFormations((fs) => [...fs, { id, ...nouvelle, notes: {} }]);
    ["M+3", "M+6", "M+12"].forEach((j, i) => {
      // Échéances calculées à partir de la date réelle du jour, en UTC.
      const d = new Date(aujourdhuiUTC()); d.setUTCMonth(d.getUTCMonth() + [3, 6, 12][i]);
      setSuivis((ss) => [...ss, { id: "s" + Date.now() + i, formationId: id, jalon: j, echeance: d.toISOString().slice(0, 10), statut: "programmé", note: "", docs: [] }]);
    });
    setFormOuvert(false);
    setNouvelle({ titre: "", entreprise: "", operateur: "", beneficiaire: "", secteurGrand: "Secteur secondaire", filiere: "Transformation du cacao et du café", domaine: "Fèves et masse de cacao", region: "Siège Abidjan", apprenants: 10, budget: 5000000, statut: "Planifiée" });
    notif("Formation créée — 3 suivis (M+3/M+6/M+12) planifiés");
  };
  const editerFormation = (f) => {
    setNouvelle({ titre: f.titre, entreprise: f.entreprise, operateur: f.operateur || "", beneficiaire: f.beneficiaire || "", secteurGrand: f.secteurGrand || grandSecteurDe(secteurs, f.filiere), filiere: f.filiere, domaine: f.domaine || "", region: normaliserRegion(f.region), apprenants: f.apprenants, budget: f.budget, statut: f.statut });
    setEditionId(f.id); setFormOuvert(true); setPage("formations");
  };

  const exportExcel = () => {
    const entetes = ["Projet", "Promoteur", "Secteur", "Matière première", "Domaine", "Zone", "Apprenants", "Budget FCFA", "Statut",
      ...referentiel.map((d) => `${d.nom} (%)`), "Score global (%)", "Niveau"];
    const lignes = formationsVisibles.map((f) => {
      const g = scoreGlobal(referentiel, f.notes);
      return [f.titre, f.entreprise, f.secteurGrand || grandSecteurDe(secteurs, f.filiere), f.filiere, f.domaine || "", f.region, f.apprenants, f.budget, f.statut,
        ...referentiel.map((d) => { const s = scoreDimension(referentiel, d.id, f.notes); return s === null ? "" : Math.round(s); }),
        g === null ? "" : Math.round(g), niveau(g).txt].join(";");
    });
    telecharger("MIP-PPA_export_consolide.csv", [entetes.join(";"), ...lignes].join("\n"));
    notif("Export Excel (CSV) téléchargé");
  };
  const nettoyerPdf = (t) => {
    let s = String(t == null ? "" : t);
    // Ponctuation typographique -> ASCII
    s = s.replace(/\u2019/g, "'").replace(/\u2018/g, "'")
         .replace(/[\u2013\u2014]/g, "-").replace(/[\u201C\u201D]/g, '"')
         .replace(/\u2026/g, "...").replace(/\u00A0/g, " ")
         .replace(/[\u00B7\u2022]/g, "-"); // point median / puce -> tiret
    // Accents et ligatures -> lettres de base (la police standard des PDF gere mal l'UTF-8)
    const map = {
      "à":"a","â":"a","ä":"a","á":"a","ã":"a","å":"a",
      "è":"e","é":"e","ê":"e","ë":"e",
      "ì":"i","î":"i","ï":"i","í":"i",
      "ò":"o","ô":"o","ö":"o","ó":"o","õ":"o",
      "ù":"u","û":"u","ü":"u","ú":"u",
      "ç":"c","ñ":"n","ÿ":"y",
      "À":"A","Â":"A","Ä":"A","Á":"A",
      "È":"E","É":"E","Ê":"E","Ë":"E",
      "Ì":"I","Î":"I","Ï":"I",
      "Ò":"O","Ô":"O","Ö":"O",
      "Ù":"U","Û":"U","Ü":"U",
      "Ç":"C","Ñ":"N",
      "œ":"oe","Œ":"OE","æ":"ae","Æ":"AE",
      // Espaces non ASCII : sans cette conversion, le séparateur de milliers
      // des montants était purement et simplement supprimé et le budget
      // s'imprimait d'un seul bloc (« 12500000 » au lieu de « 12 500 000 »).
      "\u00A0":" ","\u202F":" ","\u2009":" ","\u2007":" "
    };
    s = s.replace(/[^\x00-\x7F]/g, (c) => map[c] || "");
    return s;
  };
  const fichePDF = async (f) => {
    const g = scoreGlobal(referentiel, f.notes);
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const W = 210, M = 16;
    let y = 0;
    const bleu = [29, 111, 168], orange = [242, 163, 60], gris = [90, 90, 90];
    const nv = niveau(g);
    const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

    // ------ En-tête institutionnel ------
    doc.setFillColor(13, 34, 51); doc.rect(0, 0, W, 30, "F");
    try { doc.addImage(LOGO_FDFP, "JPEG", M, 5.5, 42, 19); } catch (e) {}
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(14);
    doc.text(nettoyerPdf("FICHE D'EVALUATION MIP-PPA"), W - M, 13, { align: "right" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.text(nettoyerPdf("Projet Apprentissage - Agro-industrie"), W - M, 19, { align: "right" });
    doc.setDrawColor(...orange); doc.setLineWidth(1.6); doc.line(0, 30, W, 30);
    y = 40;

    // ------ Identification de la formation ------
    doc.setTextColor(20, 20, 20); doc.setFont("helvetica", "bold"); doc.setFontSize(13);
    doc.text(doc.splitTextToSize(nettoyerPdf(f.titre), W - 2 * M), M, y); y += 7 * doc.splitTextToSize(nettoyerPdf(f.titre), W - 2 * M).length;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...gris);
    doc.text(nettoyerPdf(`Promoteur : ${f.entreprise}  -  ${f.filiere}  -  ${f.region}`), M, y); y += 5.5;
    if (f.operateur || f.beneficiaire) { doc.text(nettoyerPdf(`${f.operateur ? "Operateur : " + f.operateur : ""}${f.operateur && f.beneficiaire ? "  -  " : ""}${f.beneficiaire ? "Beneficiaire : " + f.beneficiaire : ""}`), M, y); y += 5.5; }
    doc.text(nettoyerPdf(`${f.apprenants} apprenants  -  Budget : ${fmtFCFA(f.budget)}  -  Statut : ${f.statut}`), M, y); y += 9;

    // ------ Score global ------
    doc.setFillColor(...hexRgb(nv.bg === "#e7e5e4" ? "#a8a29e" : nv.bg)); doc.roundedRect(M, y, W - 2 * M, 16, 2.5, 2.5, "F");
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(12);
    doc.text(nettoyerPdf(`SCORE GLOBAL MIP-PPA : ${fmtPct(g)} - ${nv.txt}`), W / 2, y + 10, { align: "center" });
    y += 24;

    // ------ Tableau des dimensions ------
    doc.setTextColor(...bleu); doc.setFontSize(11.5);
    doc.text(nettoyerPdf("Synthese par dimension"), M, y); y += 6;
    doc.setFontSize(9.5);
    referentiel.forEach((d) => {
      const s = scoreDimension(referentiel, d.id, f.notes);
      doc.setTextColor(30, 30, 30); doc.setFont("helvetica", "bold");
      doc.text(nettoyerPdf(`${d.nom} (${d.poids} %)`), M, y);
      doc.setFont("helvetica", "normal");
      doc.text(fmtPct(s), W - M - 24, y, { align: "right" });
      // barre de progression
      doc.setFillColor(230, 230, 230); doc.roundedRect(W - M - 22, y - 3, 22, 3.4, 1.2, 1.2, "F");
      if (s !== null) { doc.setFillColor(...bleu); doc.roundedRect(W - M - 22, y - 3, Math.max(1.5, 22 * s / 100), 3.4, 1.2, 1.2, "F"); }
      y += 6.5;
    });
    y += 3;

    // ------ Détail des indicateurs ------
    const pied = () => {
      const pages = doc.getNumberOfPages();
      for (let p = 1; p <= pages; p++) {
        doc.setPage(p);
        doc.setDrawColor(...orange); doc.setLineWidth(0.6); doc.line(M, 285, W - M, 285);
        doc.setFontSize(7.5); doc.setTextColor(...gris); doc.setFont("helvetica", "normal");
        doc.text(nettoyerPdf("FDFP - Fonds de Developpement de la Formation Professionnelle - Modele MIP-PPA - PFE ESA/INP-HB"), M, 290);
        doc.text(nettoyerPdf(`Page ${p} / ${pages} - Edite le ${new Date().toLocaleDateString("fr-FR")}`), W - M, 290, { align: "right" });
      }
    };
    const sautSiBesoin = (h) => { if (y + h > 278) { doc.addPage(); y = 20; } };

    referentiel.forEach((d) => {
      sautSiBesoin(14);
      doc.setFillColor(232, 240, 247); doc.rect(M, y - 4.5, W - 2 * M, 7.5, "F");
      doc.setTextColor(...bleu); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
      doc.text(nettoyerPdf(`${d.nom} - ${fmtPct(scoreDimension(referentiel, d.id, f.notes))}`), M + 2, y); y += 8;
      doc.setFontSize(8.8);
      d.indicateurs.forEach((ind) => {
        const lignes = doc.splitTextToSize(nettoyerPdf(`${ind.id} · ${ind.label}`), W - 2 * M - 30);
        sautSiBesoin(lignes.length * 4 + 3);
        doc.setTextColor(45, 45, 45); doc.setFont("helvetica", "normal");
        doc.text(lignes, M + 2, y);
        const n = f.notes[ind.id];
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...(n >= 3 ? [22, 122, 61] : n === 2 ? [200, 130, 20] : n !== undefined && n !== null ? [190, 40, 40] : gris));
        doc.text(nettoyerPdf(`${n ?? "-"} / 4  -  ${noteLabel(n)}`), W - M - 2, y, { align: "right" });
        y += lignes.length * 4 + 2.5;
      });
      y += 3;
    });

    // ------ Documents de suivi rattachés ------
    const suivisF = suivis.filter((s) => s.formationId === f.id && (s.docs || []).length > 0);
    if (suivisF.length) {
      sautSiBesoin(16);
      doc.setFillColor(232, 240, 247); doc.rect(M, y - 4.5, W - 2 * M, 7.5, "F");
      doc.setTextColor(...bleu); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
      doc.text(nettoyerPdf("Documents de suivi rattaches"), M + 2, y); y += 8;
      doc.setFontSize(8.8);
      suivisF.forEach((s) => {
        (s.docs || []).forEach((d) => {
          const estImage = d.type && d.type.startsWith("image/");
          if (estImage) {
            // L'image est incorporee en pleine page (largeur max, ratio conserve)
            sautSiBesoin(14);
            doc.setTextColor(45, 45, 45); doc.setFont("helvetica", "bold");
            doc.text(nettoyerPdf(`${s.jalon} - ${d.nom}`), M + 2, y); y += 5;
            doc.setFont("helvetica", "normal"); doc.setTextColor(...gris); doc.setFontSize(7.5);
            doc.text(nettoyerPdf(`${(d.taille / 1024).toFixed(0)} Ko - ajoute le ${d.date}`), M + 2, y); y += 4;
            doc.setFontSize(8.8);
            try {
              const props = doc.getImageProperties(d.data);
              const largeurMax = W - 2 * M - 4;
              const hauteur = Math.min(150, largeurMax * props.height / props.width);
              const largeur = hauteur * props.width / props.height;
              sautSiBesoin(hauteur + 4);
              doc.addImage(d.data, props.fileType || "JPEG", M + 2, y, largeur, hauteur);
              doc.setDrawColor(220, 220, 220); doc.rect(M + 2, y, largeur, hauteur);
              y += hauteur + 6;
            } catch (e) {
              doc.setTextColor(190, 40, 40); doc.text(nettoyerPdf("[image illisible]"), M + 2, y); y += 6;
            }
          } else {
            // Encart descriptif (pour tous les non-images) — les PDF seront en plus annexes a la fin
            sautSiBesoin(16);
            doc.setDrawColor(210, 210, 210); doc.setFillColor(248, 248, 246);
            doc.roundedRect(M + 2, y - 3, W - 2 * M - 4, 13, 2, 2, "FD");
            doc.setTextColor(45, 45, 45); doc.setFont("helvetica", "bold");
            doc.text(nettoyerPdf(`${s.jalon} - ${d.nom}`), M + 6, y + 2);
            doc.setFont("helvetica", "normal"); doc.setTextColor(...gris); doc.setFontSize(7.5);
            const estPdf = (d.type || "").includes("pdf") || /\.pdf$/i.test(d.nom);
            const typeLisible = estPdf ? "Document PDF (joint en annexe de cette fiche)"
              : (d.type || "").includes("word") || d.nom.match(/\.docx$/i) ? "Document Word (texte integre en annexe de cette fiche)"
              : d.nom.match(/\.doc$/i) ? "Document Word ancien format (a consulter dans la plateforme)"
              : (d.type || "").includes("sheet") || d.nom.match(/\.xlsx?$/i) ? "Classeur Excel (a consulter dans la plateforme)" : "Document (a consulter dans la plateforme)";
            doc.text(nettoyerPdf(`${typeLisible} - ${(d.taille / 1024).toFixed(0)} Ko - ajoute le ${d.date}`), M + 6, y + 6.5);
            doc.setFontSize(8.8);
            y += 15;
          }
        });
        if (s.note) {
          const ln = doc.splitTextToSize(nettoyerPdf(`Observations ${s.jalon} : ${s.note}`), W - 2 * M - 4);
          sautSiBesoin(ln.length * 4 + 3);
          doc.setTextColor(...gris); doc.setFont("helvetica", "italic");
          doc.text(ln, M + 2, y); y += ln.length * 4 + 2;
        }
      });
    }

    // ------ Annexe : contenu texte des documents Word (.docx) ------
    const suivisFx = suivis.filter((s) => s.formationId === f.id && (s.docs || []).length > 0);
    const docsWord = [];
    suivisFx.forEach((s) => (s.docs || []).forEach((d) => {
      const estDocx = (d.type || "").includes("officedocument.wordprocessingml") || /\.docx$/i.test(d.nom);
      if (estDocx && d.data) docsWord.push({ jalon: s.jalon, d });
    }));
    for (const { jalon, d } of docsWord) {
      try {
        const mod = await import("https://cdn.jsdelivr.net/npm/mammoth@1.8.0/+esm");
        const mammoth = mod.default || mod;
        const bin = atob(d.data.split(",")[1]);
        const buf = new ArrayBuffer(bin.length); const u8 = new Uint8Array(buf);
        for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        const res = await mammoth.extractRawText({ arrayBuffer: buf });
        const texte = ((res && res.value) || "").trim();
        doc.addPage(); y = 20;
        doc.setFillColor(232, 240, 247); doc.rect(M, y - 5, W - 2 * M, 8, "F");
        doc.setTextColor(...bleu); doc.setFont("helvetica", "bold"); doc.setFontSize(10.5);
        doc.text(nettoyerPdf(`Annexe ${jalon} - ${d.nom} (contenu du document Word)`), M + 2, y); y += 9;
        doc.setTextColor(45, 45, 45); doc.setFont("helvetica", "normal"); doc.setFontSize(9);
        const lignesTxt = doc.splitTextToSize(nettoyerPdf(texte || "(document vide ou non lisible)"), W - 2 * M);
        for (const lt of lignesTxt) {
          if (y > 280) { doc.addPage(); y = 20; }
          doc.text(lt, M, y); y += 4.4;
        }
      } catch (e) { /* extraction indisponible (hors ligne) : l'encart descriptif reste */ }
    }

    pied();
    // ------ Annexe : fusion des PDF joints, page a page ------
    const pdfsJoints = [];
    suivisF.forEach((s) => (s.docs || []).forEach((d) => {
      if (((d.type || "").includes("pdf") || /\.pdf$/i.test(d.nom)) && d.data) pdfsJoints.push({ jalon: s.jalon, d });
    }));
    if (pdfsJoints.length) {
      try {
        const { PDFDocument } = await import("https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm");
        // On recupere le PDF genere par jsPDF, puis on y ajoute les pages des PDF joints
        const base = await PDFDocument.load(doc.output("arraybuffer"));
        for (const { jalon, d } of pdfsJoints) {
          try {
            const octets = Uint8Array.from(atob(d.data.split(",")[1]), (c) => c.charCodeAt(0));
            const ext = await PDFDocument.load(octets);
            // page de garde de l'annexe
            const garde = base.addPage();
            const { width, height } = garde.getSize();
            garde.drawText(nettoyerPdf(`Annexe - ${jalon} - ${d.nom}`), { x: 40, y: height - 60, size: 13 });
            garde.drawText(nettoyerPdf("Document joint dans la plateforme MIP-PPA"), { x: 40, y: height - 80, size: 9 });
            const pages = await base.copyPages(ext, ext.getPageIndices());
            pages.forEach((p) => base.addPage(p));
          } catch (e) { /* PDF joint illisible : on ignore, l'encart descriptif reste */ }
        }
        const octetsFinal = await base.save();
        const blob = new Blob([octetsFinal], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url;
        a.download = `Fiche_MIP-PPA_${f.entreprise.replace(/\s+/g, "_")}.pdf`; a.click();
        URL.revokeObjectURL(url);
        notif("Fiche PDF (avec annexes) téléchargée");
        return;
      } catch (e) {
        // pdf-lib indisponible (hors ligne) : on retombe sur le PDF simple
      }
    }
    pied();
    doc.save(`Fiche_MIP-PPA_${f.entreprise.replace(/\s+/g, "_")}.pdf`);
    notif("Fiche PDF téléchargée");
  };

  const fEval = formationsVisibles.find((f) => f.id === evalId);
  const poidsTotal = referentiel.reduce((a, d) => a + Number(d.poids), 0);

  const NAV = [
    { section: "Pilotage", items: [
      ["dashboard", "grid", "Tableau de bord"], ["formations", "cap", "Projets"],
      ["evaluation", "clipboard", "Évaluation"], ["suivi", "calendrier", "Suivi niveau de performance"],
      ["indicateurs", "graphique", "Indicateurs"], ["alertes", "cloche", "Alertes"], ["exports", "telecharger", "Exports"],
    ].filter(([id]) => P.pages.includes(id)) },
    { section: "Aide", items: [["guide", "livre", "Guide d'utilisation"]] },
    ...(P.users ? [{ section: "Administration", items: [["users", "utilisateurs", "Utilisateurs & rôles"]] }] : []),
  ];
  const titres = {
    dashboard: ["Tableau de bord MIP-PPA", "Vision consolidée des projets de formation de type Apprentissage (emploi-qualification) dans les industries agroalimentaires"],
    formations: ["Projets de formation de type apprentissage", "Portefeuille des projets de formation financés par le FDFP"],
    evaluation: ["Évaluation", fEval ? fEval.titre : "Sélectionnez une formation à évaluer"],
    suivi: ["Suivi du niveau de performance", "Évaluations à 3, 6 et 12 mois"],
    indicateurs: ["Référentiel des indicateurs", "Modèle MIP-PPA (dimensions, pondérations, indicateurs)"],
    alertes: ["Alertes & risques", "Formations sous-performantes et suivis en retard"],
    exports: ["Exports", "Fiches PDF et tableaux Excel pour les rapports FDFP"],
    guide: ["Guide d'utilisation", "Tout ce qu'il faut savoir pour utiliser la plateforme MIP-PPA"],
    users: ["Utilisateurs & rôles", "Attribution des accès à la plateforme"],
  };

  // =================== GARDE D'ACCÈS =============================
  if (!sb) return <EcranConfiguration />;
  if (chargementAuth) {
    return <CadreAccueil enfants={<div className="text-sky-100 text-sm page-anim">Connexion au serveur…</div>} />;
  }
  if (!session) return (<><EcranConnexion /><Toast msg={toast} /></>);
  if (session?.aFinaliser) {
    return <EcranFinalisation session={session} surTermine={(maj) => setSession({ ...session, ...maj, aFinaliser: false })} />;
  }
  if (roleActif === "En attente d'activation") {
    return <EcranAttente session={session}
      surActualiser={() => sb.auth.getUser().then(({ data }) => data.user && chargerProfil(data.user))}
      surDeconnexion={() => { sb.auth.signOut(); setSession(null); }} />;
  }
  if (chargementData) {
    return <CadreAccueil enfants={<div className="text-sky-100 text-sm page-anim">Chargement des données de la plateforme…</div>} />;
  }

  // =================== RENDU =====================================
  return (
    <div className={"cadre-app min-h-screen flex text-stone-900" + (sombre ? " sombre" : "")} style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", maxWidth: "100vw" }}>
      <style>{`
        /* ================= ARRIÈRE-PLAN DE LA PAGE =================
           L'image est portée par l'élément body : elle défile donc
           avec le contenu (background-attachment: scroll, la valeur par
           défaut). C'est elle que le bandeau supérieur laisse deviner,
           floutée, pendant le défilement.
           Chemin défini par CHEMIN_FOND — voir l'en-tête du fichier.    */
        body{
          background-color:#e8edf2;                 /* visible si l'image manque */
          background-image:url('${CHEMIN_FOND}');
          background-repeat:no-repeat;
          background-position:top center;
          background-size:cover;
          background-attachment:scroll;
        }
        /* Le cadre laisse passer l'image. Voile très léger seulement : le
           texte est porté par des cartes opaques, la lisibilité ne dépend
           donc pas de lui, et l'image reste franchement perceptible sous
           le bandeau flouté. En mode sombre le voile devient couvrant,
           sans quoi le thème perdrait ses contrastes.                    */
        .cadre-app{ background:rgba(255,255,255,.18); }
        .sombre.cadre-app{ background:rgba(13,23,33,.82)!important; }

        /* ---------- BANDE SUPÉRIEURE FIXE, TRANSLUCIDE ET FLOUTÉE ----------
           Ces conteneurs utilisaient « overflow-x: hidden » : le navigateur en
           faisait des conteneurs de défilement, ce qui neutralisait le
           « position: sticky » de l'en-tête, qui repartait donc vers le haut.
           « overflow-x: clip » masque le débordement horizontal sans créer de
           conteneur de défilement — l'en-tête reste alors collé en haut.        */
        .cadre-app, .zone-contenu { overflow-x: clip; }
        /* Repli pour les navigateurs sans « overflow: clip » : on renonce au
           masquage horizontal plutôt qu'à l'en-tête fixe.                       */
        @supports not (overflow-x: clip) {
          .cadre-app, .zone-contenu { overflow-x: visible; }
        }

        .bandeau-haut{
          position:sticky; top:0; z-index:30;
          display:flex; align-items:center; justify-content:space-between;
          gap:clamp(.75rem,2vw,1.5rem);
          padding:clamp(.5rem,1.4vw,.9rem) clamp(.85rem,2.5vw,1.6rem);
          background:rgba(255,255,255,.72);         /* blanc semi-transparent */
          -webkit-backdrop-filter:blur(10px) saturate(150%);
          backdrop-filter:blur(10px) saturate(150%);
          border-bottom:1px solid rgba(255,255,255,.55);
          box-shadow:0 2px 14px rgba(13,34,51,.10);
        }
        /* Sans backdrop-filter, on remonte l'opacité : le texte reste lisible. */
        @supports not ((backdrop-filter:blur(10px)) or (-webkit-backdrop-filter:blur(10px))) {
          .bandeau-haut{ background:rgba(255,255,255,.94); }
        }
        .sombre .bandeau-haut{
          background:rgba(18,30,42,.68);
          border-bottom-color:rgba(255,255,255,.10);
        }
        .bandeau-gauche{ display:flex; align-items:center; gap:clamp(.6rem,1.5vw,1rem); min-width:0; }
        .bandeau-droite{ display:flex; align-items:center; gap:clamp(.75rem,2vw,1.25rem); flex:0 0 auto; }
        .bandeau-titre{
          font-size:clamp(.95rem,1.9vw,1.2rem); font-weight:700; line-height:1.2;
          overflow-wrap:anywhere;
        }
        .bandeau-sous-titre{
          font-size:clamp(.68rem,1.15vw,.78rem); color:#57534e; line-height:1.35;
          overflow-wrap:anywhere; margin-top:.1rem;
        }
        .sombre .bandeau-sous-titre{ color:#a9b4bf; }
        /* Horloge de référence (GMT+0). Chiffres tabulaires : la largeur ne
           bouge pas au défilement des secondes, le bandeau reste stable.     */
        .horloge-utc{
          text-align:right; line-height:1.2; white-space:nowrap;
          padding-right:clamp(.6rem,1.4vw,1rem);
          border-right:1px solid rgba(13,34,51,.15);
        }
        .sombre .horloge-utc{ border-right-color:rgba(255,255,255,.14); }
        .horloge-date{ font-size:.7rem; color:#57534e; text-transform:capitalize; }
        .horloge-heure{
          font-size:.92rem; font-weight:700; letter-spacing:.02em;
          font-variant-numeric:tabular-nums;
        }
        .horloge-heure span{ font-size:.6rem; font-weight:600; color:#57534e; margin-left:.3rem; }
        .sombre .horloge-date, .sombre .horloge-heure span{ color:#a9b4bf; }
        /* Sous 820 px, le bandeau n'a plus la place : l'horloge s'efface. */
        @media (max-width:820px){ .horloge-utc{ display:none; } }
        /* Sur mobile le sous-titre mange toute la hauteur : on le limite. */
        @media (max-width:560px){
          .bandeau-sous-titre{
            display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;
            overflow:hidden;
          }
        }

        /* ---------- DELTA DESKTOP ≥1024px : sidebar fixe ---------- */
        @media (min-width: 1024px) {
          .barre-laterale {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            height: 100vh !important;
            overflow-y: auto !important;
            z-index: 20;
          }
          .zone-principale {
            margin-left: 256px !important; /* largeur sidebar : w-64 = 16rem */
          }
        }
        /* ---------- MODE SOMBRE ---------- */
        .sombre{background:#0d1721!important;color:#d6d3d1!important}
        .sombre .bg-stone-100{background:#0d1721!important}
        .sombre .bg-white{background:#152230!important;color:#d6d3d1}
        /* Exception : le rectangle du logo reste blanc en mode nuit. Le logo
           FDFP est une image à fond blanc — sur une plaque sombre, il
           découperait un rectangle blanc disgracieux au milieu du cadre.
           Règle placée APRÈS « .sombre .bg-white » : à spécificité égale,
           c'est la dernière déclarée qui l'emporte.                        */
        .sombre .cadre-logo{background:#FFFFFF!important}
        .sombre .bg-stone-50{background:#1a2a3a!important}
        /* Survol des lignes de tableau et des boutons en mode nuit.
           ATTENTION à la double barre oblique inverse : cette feuille est un
           littéral de gabarit JavaScript, où « \\: » ne serait pas reconnu
           comme échappement et deviendrait « : ». Le sélecteur émis serait
           alors « .hover:bg-stone-50 », une pseudo-classe inconnue, donc une
           règle entière invalidée et ignorée — le survol repassait au gris
           très clair de Tailwind, éblouissant sur fond sombre.
           « \\\\: » dans la source produit bien « \\: » dans la feuille.       */
        .sombre .hover\\:bg-stone-50:hover{background:#263b50!important}
        .sombre .hover\\:bg-stone-100:hover{background:#263b50!important}
        .sombre .border-stone-200,.sombre .border-stone-100,.sombre .border-stone-300{border-color:#2b3d50!important}
        .sombre .border-stone-50{border-color:#223446!important}
        .sombre .text-stone-900,.sombre .text-stone-800{color:#e7e5e4!important}
        .sombre .text-stone-700,.sombre .text-stone-600{color:#b8c0c9!important}
        .sombre .text-stone-500{color:#93a1af!important}
        .sombre .text-stone-400{color:#7b8896!important}
        .sombre input,.sombre select,.sombre textarea{background:#1a2a3a!important;color:#e7e5e4!important;border-color:#2b3d50!important}
        .sombre input::placeholder,.sombre textarea::placeholder{color:#64748b}
        .sombre .bg-sky-50{background:rgba(56,130,190,.16)!important}
        .sombre .bg-red-50{background:rgba(220,60,60,.14)!important}
        .sombre .hover\\:bg-red-50:hover{background:rgba(220,60,60,.28)!important}
        .sombre .bg-amber-50{background:rgba(217,160,40,.14)!important}
        .sombre .bg-emerald-50{background:rgba(30,160,110,.15)!important}
        .sombre .text-stone-300{color:#a8b3bd!important}
        .sombre .shadow-xl,.sombre .shadow-2xl{box-shadow:0 18px 45px rgba(0,0,0,.55)!important}
        .sombre svg text{fill:#b8c0c9}

        /* ---------- GRAPHIQUES EN MODE NUIT ----------
           Même problème que sur les lignes de tableau : au survol, Recharts
           dessine un « curseur » (bande sur l'histogramme, rayon sur le
           radar) rempli de gris clair, qui éblouit sur fond sombre. On le
           repasse en bleu nuit translucide.
           Les couleurs des grilles sont posées en attribut de présentation
           dans le JSX (stroke="#e7e5e4") : ces attributs ont la priorité la
           plus faible, donc n'importe quelle règle CSS les emporte — inutile
           de toucher au balisage.                                          */
        .sombre .recharts-tooltip-cursor{fill:rgba(56,130,190,.22)!important;stroke:rgba(56,130,190,.45)!important}
        .sombre .recharts-cartesian-grid line{stroke:#2b3d50!important}
        .sombre .recharts-polar-grid line,
        .sombre .recharts-polar-grid path,
        .sombre .recharts-polar-grid polygon,
        .sombre .recharts-polar-grid circle{stroke:#2b3d50!important}
        .sombre .recharts-cartesian-axis-line,
        .sombre .recharts-cartesian-axis-tick-line,
        .sombre .recharts-polar-angle-axis-tick-line,
        .sombre .recharts-polar-radius-axis-line{stroke:#3a4d61!important}
        /* Infobulle : le cadre était déjà traité, mais Recharts fixe la
           couleur de chaque série en style en ligne — d'où le !important. */
        .sombre .recharts-default-tooltip{background:#152230!important;border-color:#2b3d50!important;color:#e7e5e4!important}
        .sombre .recharts-tooltip-label,
        .sombre .recharts-tooltip-item,
        .sombre .recharts-tooltip-item-name,
        .sombre .recharts-tooltip-item-value,
        .sombre .recharts-tooltip-item-separator{color:#e7e5e4!important}

        @keyframes pageIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        @keyframes toastIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        .page-anim { animation: pageIn .32s ease-out both; }
        .toast-anim { animation: toastIn .25s ease-out both; }
        /* Pied de page institutionnel : bandeau de certification FDFP.
           Fond blanc permanent — l'image est fournie sur fond blanc, une
           plaque sombre y découperait un rectangle disgracieux. */
        .pied-certification{
          max-width:64rem;                  /* aligné sur la largeur du contenu */
          width:100%;
          margin:0 auto clamp(1rem,2.5vw,1.75rem);
          padding:clamp(.7rem,1.6vw,1.1rem);
          background:#FFFFFF;
          border:1px solid rgba(13,34,51,.10);
          border-radius:16px;
          box-shadow:0 2px 10px rgba(13,34,51,.07);
          display:flex; justify-content:center;
        }
        .sombre .pied-certification{
          background:#FFFFFF!important;
          border-color:rgba(255,255,255,.20);
        }
        .pied-certification img{
          width:100%; max-width:30rem; height:auto; display:block;
        }
        /* Sur mobile, le bandeau colle aux bords de l'écran : on lui rend
           une gouttière équivalente à celle du contenu. */
        @media (max-width:640px){
          .pied-certification{ width:calc(100% - 2rem); }
        }

        /* Cartes d'indicateur cliquables du tableau de bord : le chevron
           signale l'action, il se décale légèrement au survol. */
        .stat-cliquable{ cursor:pointer; }
        .stat-cliquable:focus-visible{ outline:2px solid #1d6fa8; outline-offset:2px; }
        .stat-chevron{
          position:absolute; top:.85rem; right:.85rem;
          color:#a8a29e; display:flex; opacity:.75;
          transition:transform .18s ease, opacity .18s ease, color .18s ease;
        }
        .stat-cliquable:hover .stat-chevron{ transform:translateX(3px); opacity:1; color:#1d6fa8; }
        .sombre .stat-chevron{ color:#7b8896; }
        .sombre .stat-cliquable:hover .stat-chevron{ color:#6fb3e0; }

        .carte-hover { transition: transform .18s ease, box-shadow .18s ease; }
        .carte-hover:hover { transform: translateY(-2px); box-shadow: 0 8px 22px rgba(13,34,51,.10); }
        button { transition: background-color .15s ease, color .15s ease, border-color .15s ease, transform .12s ease, opacity .15s ease; }
        button:active { transform: scale(.97); }
        .nav-item { color: #cbd5d8; transition: background-color .18s ease, color .18s ease, padding-left .18s ease; }
        .nav-item:hover { background: rgba(255,255,255,.08); color: #fff; padding-left: 1rem; }
        .nav-actif { background: #1c4a66; color: #fff; font-weight: 600; }
        .nav-actif:hover { background: #1c4a66; }
        * { scrollbar-width: thin; }
        html { scroll-behavior: smooth; }
      `}</style>
      {/* ---------------- SIDEBAR ---------------- */}
      {menuMobile && <div className="fixed inset-0 z-40 md:hidden" style={{ background: "rgba(10,25,38,.55)" }} onClick={() => setMenuMobile(false)} />}
      <aside className={(menuMobile ? "flex fixed inset-y-0 left-0 z-50 " : "hidden ") + "md:flex md:sticky md:top-0 barre-laterale w-64 shrink-0 flex-col text-stone-300 h-screen overflow-y-auto overflow-x-hidden"} style={{ background: C.sidebar }}>
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="cadre-logo bg-white rounded-xl px-2 py-1.5 flex items-center justify-center shrink-0">
            <LogoFDFP h={30} />
          </div>
          <div className="min-w-0">
            <div className="text-white font-bold leading-tight">MIP-PPA</div>
            <div className="text-xs text-stone-400 break-words">Modèle d'Indicateurs de Performance - Produit Projet Apprentissage</div>
          </div>
        </div>
        <nav className="flex-1 px-3 space-y-5 pb-4">
          {NAV.map((g) => (
            <div key={g.section}>
              <div className="text-[11px] uppercase tracking-wider text-stone-500 px-3 mb-1.5">{g.section}</div>
              {g.items.map(([id, ic, lbl]) => (
                <button key={id} onClick={() => { setPage(id); setMenuMobile(false); }} title={DESCR_NAV[id] || lbl}
                  className={"nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left " + (page === id ? "nav-actif" : "")}>
                  <Icone n={ic} t={17} />{lbl}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="px-5 py-4 border-t" style={{ borderColor: "#1c4a66" }}>
          <div className="flex items-center gap-2 text-sm" style={{ color: C.gold }}><Icone n="bouclier" t={16} /> {roleActif}</div>
          <button onClick={() => { if (sb) sb.auth.signOut(); setSession(null); setPage("dashboard"); }}
            className="mt-2 text-xs text-stone-400 hover:text-white flex items-center gap-1.5" title="Fermer votre session"><Icone n="deconnexion" t={13} /> Se déconnecter</button>
        </div>
      </aside>

      {/* ---------------- ZONE PRINCIPALE ---------------- */}
      <div className="zone-principale flex-1 min-w-0 flex flex-col">
        <header className="bandeau-haut">
          <div className="bandeau-gauche">
            <button onClick={() => setMenuMobile(true)} className="md:hidden text-stone-600 shrink-0" title="Ouvrir le menu">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/></svg>
            </button>
            <div className="min-w-0">
              <h1 className="bandeau-titre">{titres[page][0]}</h1>
              <div className="bandeau-sous-titre">{titres[page][1]}</div>
            </div>
          </div>
          <div className="bandeau-droite">
            <HorlogeUTC />
            <button onClick={() => setPage("guide")} className="hidden sm:flex text-sm text-stone-600 hover:text-stone-900 items-center gap-1.5" title="Ouvrir le guide d'utilisation"><Icone n="livre" t={16} /> Guide</button>
            <button onClick={basculerTheme} className="hidden sm:block text-stone-500 hover:text-stone-800 shrink-0" title={sombre ? "Passer en mode éclairé" : "Passer en mode sombre"}>
              <Icone n={sombre ? "soleil" : "lune"} t={19} />
            </button>
            <div className="relative">
              <button onClick={() => setMenuCompte(!menuCompte)} title="Ouvrir le menu du compte" className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full text-white flex items-center justify-center text-sm font-semibold" style={{ background: C.vert }}>{(session?.nom || "?").split(" ").map((m) => m[0]).slice(0, 2).join("").toUpperCase()}</div>
                <div className="hidden md:block text-left">
                  <div className="text-sm font-semibold leading-tight">{session?.nom}</div>
                  <div className="text-xs text-stone-500">{roleActif}</div>
                </div>
              </button>
              {menuCompte && (
                <div className="absolute right-0 top-12 bg-white border border-stone-200 rounded-xl shadow-xl w-64 max-w-[88vw] p-2 z-40 page-anim">
                  <div className="px-3 py-2 border-b border-stone-100">
                    <div className="text-sm font-semibold break-words">{session?.nom}</div>
                    <div className="text-xs text-stone-500 break-words">{session?.email}</div>
                    <div className="text-xs text-stone-400 mt-0.5">{session?.org} · {roleActif}</div>
                  </div>
                  {P.users && <button onClick={() => { setPage("users"); setMenuCompte(false); }}
                    className="w-full text-left text-sm px-3 py-2 rounded-lg hover:bg-stone-50 flex items-center gap-2"><Icone n="utilisateurs" t={15} /> Utilisateurs & rôles</button>}
                  <button onClick={() => { setPage("guide"); setMenuCompte(false); }}
                    className="sm:hidden w-full text-left text-sm px-3 py-2 rounded-lg hover:bg-stone-50 flex items-center gap-2"><Icone n="livre" t={15} /> Guide d'utilisation</button>
                  <button onClick={() => { basculerTheme(); }}
                    className="sm:hidden w-full text-left text-sm px-3 py-2 rounded-lg hover:bg-stone-50 flex items-center gap-2"><Icone n={sombre ? "soleil" : "lune"} t={15} /> {sombre ? "Mode éclairé" : "Mode sombre"}</button>
                  <div className="my-1 border-t border-stone-100" />
                  <button onClick={() => { if (sb) sb.auth.signOut(); setSession(null); setMenuCompte(false); }}
                    className="w-full text-left text-sm px-3 py-2 rounded-lg hover:bg-red-50 text-red-600 flex items-center gap-2"><Icone n="deconnexion" t={15} /> Déconnexion</button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main key={page + (evalId || "")} className="zone-contenu page-anim flex-1 p-4 md:p-6 space-y-5 max-w-5xl w-full mx-auto min-w-0">
          {P.lectureSeule && <div className="rounded-xl px-4 py-2.5 text-sm flex items-center gap-2" style={{ background: "#e0f0fb", color: "#0d3b57" }}><Icone n="oeil" t={16} /> Mode consultation</div>}

          {/* =========== TABLEAU DE BORD =========== */}
          {page === "dashboard" && (<>
            <section className="rounded-3xl p-8 text-white" style={{ background: "linear-gradient(120deg,#0e3c60 0%,#1d6fa8 100%)" }}>
              <span className="text-xs font-semibold px-3 py-1 rounded-full text-stone-900" style={{ background: C.gold }}>FDFP · Côte d'Ivoire</span>
              <h2 className="text-2xl md:text-4xl font-bold mt-4 leading-tight">Mesurer la vraie valeur<br />des projets de formation de type apprentissage</h2>
              <p className="mt-3 text-sky-100 max-w-2xl">
                Le modèle MIP-PPA évalue chaque projet de formation de type apprentissage sur {referentiel.length} dimensions et {referentiel.reduce((a, d) => a + d.indicateurs.length, 0)} indicateurs,
                de la conception jusqu'à 12 mois après pour des décisions éclairées au service de l'industrie agroalimentaire ivoirienne.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button onClick={() => setPage("formations")} className="bg-white text-stone-900 font-semibold px-5 py-2.5 rounded-xl hover:bg-stone-100">Évaluer un projet →</button>
                <button onClick={() => setPage("formations")} className="border border-sky-300/50 text-white px-5 py-2.5 rounded-xl hover:bg-white/10">Voir le portefeuille</button>
              </div>
            </section>

            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              <StatCard icone={<Icone n="cap" t={20} />} titre="Projets suivis" valeur={stats.nb}
                surClic={() => setDetailStat("projets")} indice="Voir l'intitulé de chaque projet" />
              <StatCard icone={<Icone n="usine" t={20} />} titre="Apprenants concernés" valeur={stats.apprenants} teinte="#fdf0da" fg="#b07515"
                surClic={() => setDetailStat("apprenants")} indice="Voir le nombre d'apprentis par projet" />
              <StatCard icone={<Icone n="cible" t={20} />} titre="Score moyen MIP-PPA" valeur={fmtPct(stats.moy)} sous="Moyenne pondérée du portefeuille" teinte="#dcebf7" fg={C.vert}
                surClic={() => setDetailStat("scores")} indice="Voir le score de chaque projet" />
              {/* La feuille Alertes n'est pas ouverte à tous les rôles : sans
                  l'autorisation, la carte reste un simple indicateur. */}
              <StatCard icone={<Icone n="alerte" t={20} />} titre="Alertes actives" valeur={stats.alertes} sous={stats.alertes ? "À traiter en priorité" : "Rien à signaler"} teinte="#fde8e8" fg={C.insuffisant}
                surClic={P.pages.includes("alertes") ? () => setPage("alertes") : undefined} indice="Ouvrir la feuille Alertes & risques" />
            </section>

            <section className="bg-white rounded-2xl border border-stone-200 p-5">
              <h3 className="font-bold">Niveau de performance moyenne par dimension</h3>
              <p className="text-sm text-stone-500 mb-2">Profil consolidé du portefeuille PPA en cours.</p>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#e7e5e4" />
                  <PolarAngleAxis dataKey="dim" tick={{ fontSize: 11 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9 }} />
                  <Radar dataKey="score" stroke={C.vert} fill={C.vert} fillOpacity={0.35} />
                  <Tooltip formatter={(v) => `${Math.round(v)} %`} />
                </RadarChart>
              </ResponsiveContainer>
            </section>

            <section className="bg-white rounded-2xl border border-stone-200 p-5">
              <h3 className="font-bold">Score moyen par secteur</h3>
              <p className="text-sm text-stone-500 mb-2">Comparaison sectorielle.</p>
              <ResponsiveContainer width="100%" height={Math.max(72, 66 * filiereData.length) + 40}>
                <BarChart data={filiereData} layout="vertical" margin={{ left: 6, right: 18 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="filiere" width={estMobile ? 150 : 240} interval={0}
                    tick={({ x, y, payload }) => {
                      // Découpe le libellé en lignes complètes (aucune condensation)
                      const larg = estMobile ? 22 : 36;
                      const mots = String(payload.value).split(" ");
                      const lignes = [];
                      let cour = "";
                      mots.forEach((m) => { if ((cour + " " + m).trim().length > larg) { if (cour) lignes.push(cour); cour = m; } else cour = (cour + " " + m).trim(); });
                      if (cour) lignes.push(cour);
                      return (
                        <text x={x} y={y} textAnchor="end" fill="#57534e" fontSize={estMobile ? 10 : 11}>
                          {lignes.map((l, i) => <tspan key={i} x={x - 4} dy={i === 0 ? -((lignes.length - 1) * 5.5) + 4 : 12}>{l}</tspan>)}
                        </text>
                      );
                    }} />
                  <Tooltip formatter={(v) => `${Math.round(v)} %`} />
                  <Bar dataKey="score" fill={C.vert} radius={[0, 6, 6, 0]} barSize={26} />
                </BarChart>
              </ResponsiveContainer>
            </section>

            <section className="bg-white rounded-2xl border border-stone-200 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><h3 className="font-bold">Projets de formation de type apprentissage (emploi-qualifcation) récents</h3><p className="text-sm text-stone-500">Cliquez pour évaluer ou consulter.</p></div>
                <button onClick={() => setPage("formations")} className="text-sm font-semibold hover:underline" style={{ color: C.vert }}>Tout voir →</button>
              </div>
              <div className="divide-y divide-stone-100 mt-2">
                {formationsVisibles.slice(-4).map((f) => (
                  <button key={f.id} onClick={() => { setEvalId(f.id); setPage("evaluation"); }}
                    className="w-full flex items-center justify-between gap-4 py-3.5 text-left hover:bg-stone-50 px-2 rounded-lg">
                    <div>
                      <div className="font-semibold">{f.titre}</div>
                      <div className="text-sm text-stone-500">{f.entreprise} · {libelleSecteur(f, secteurs)} · {f.apprenants} apprenants</div>
                    </div>
                    <Badge score={scoreGlobal(referentiel, f.notes)} />
                  </button>
                ))}
              </div>
            </section>

            <section className="bg-white rounded-2xl border border-stone-200 p-5">
              <h3 className="font-bold flex items-center gap-2"><Icone n="tendance" t={18} /> Niveaux de performance</h3>
              <p className="text-sm text-stone-500 mb-3">Lecture du score global MIP-PPA (Modèle d'Indicateurs de Performance - Produit Projet Apprentissage).</p>
              <div className="flex flex-wrap gap-2">
                {[["Insuffisant (0–40 %)", C.insuffisant], ["Moyen (40–60 %)", C.dev], ["Satisfaisant (60–80 %)", C.satisfaisant], ["Excellent (80–100 %)", C.excellent]].map(([t, c]) => (
                  <span key={t} className="text-xs font-semibold text-white px-3 py-1.5 rounded-full" style={{ background: c }}>{t}</span>
                ))}
              </div>
              <p className="text-xs text-stone-500 mt-3">
                Pondérations : {referentiel.map((d) => `${d.nom} ${d.poids} %`).join(" · ")}.
              </p>
            </section>
          </>)}

          {/* =========== FORMATIONS =========== */}
          {page === "formations" && (<>
            <div className="flex flex-wrap items-center gap-3">
              <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher entreprise, formation, secteur…"
                className="flex-1 min-w-[240px] bg-white border border-stone-200 rounded-full px-5 py-2.5 text-sm outline-none focus:border-stone-400" />
              {P.exports && <button onClick={exportExcel} className="bg-white border border-stone-200 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-stone-50" title="Télécharger le tableau Excel consolidé"><Icone n="telecharger" t={15} /> Exporter Excel</button>}
              <button onClick={() => { setFormations(FORMATIONS_DEMO); setSuivis(SUIVIS_DEMO); notif("Données démo restaurées"); }}
                className="text-sm text-stone-600 hover:text-stone-900" title="Restaurer les 3 projets de démonstration"><Icone n="rotation" t={14} /> Données démo</button>
            </div>
            {P.creerFormation && <button onClick={() => { setEditionId(null); setNouvelle({ titre: "", entreprise: "", operateur: "", beneficiaire: "", secteurGrand: "Secteur secondaire", filiere: "Transformation du cacao et du café", domaine: "Fèves et masse de cacao", region: "Siège Abidjan", apprenants: 10, budget: 5000000, statut: "Planifiée" }); setFormOuvert(!formOuvert); }}
              className="text-white font-semibold px-5 py-2.5 rounded-xl text-sm" style={{ background: C.vertFonce }}>
              + Nouveau projet
            </button>}

            {formOuvert && (
              <div className="bg-white rounded-2xl border border-stone-200 p-5 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                <div className="md:col-span-2 font-bold text-stone-800">{editionId ? "Modifier le projet" : "Nouveau projet"}</div>
                <label className="text-sm md:col-span-2">Intitulé du projet
                  <input value={nouvelle.titre} onChange={(e) => setNouvelle({ ...nouvelle, titre: e.target.value })} className="mt-1 w-full border border-stone-300 rounded-lg px-3 py-2" placeholder="Ex. Bonnes pratiques de décorticage du cajou" />
                </label>
                <label className="text-sm">Promoteur <span className="text-stone-400">(donne l'accès)</span>
                  <input value={nouvelle.entreprise} onChange={(e) => setNouvelle({ ...nouvelle, entreprise: e.target.value })} className="mt-1 w-full border border-stone-300 rounded-lg px-3 py-2" placeholder="Ex. CocoaPro Côte d'Ivoire" />
                </label>
                <label className="text-sm">Opérateur <span className="text-stone-400">(donne l'accès)</span>
                  <input value={nouvelle.operateur} onChange={(e) => setNouvelle({ ...nouvelle, operateur: e.target.value })} className="mt-1 w-full border border-stone-300 rounded-lg px-3 py-2" placeholder="Ex. Cabinet de formation" />
                </label>
                <label className="text-sm md:col-span-2">Entreprise bénéficiaire <span className="text-stone-400">(informatif)</span>
                  <input value={nouvelle.beneficiaire} onChange={(e) => setNouvelle({ ...nouvelle, beneficiaire: e.target.value })} className="mt-1 w-full border border-stone-300 rounded-lg px-3 py-2" placeholder="Ex. Coopérative bénéficiaire de la formation" />
                </label>
                <label className="text-sm">Secteur
                  <select value={nouvelle.secteurGrand || ""} onChange={(e) => { const g = e.target.value; const branches = Object.keys(normaliserSecteurs(secteurs)[g] || {}); const b0 = branches[0] || ""; const doms = (normaliserSecteurs(secteurs)[g] || {})[b0] || []; setNouvelle({ ...nouvelle, secteurGrand: g, filiere: b0, domaine: doms[0] || "" }); }}
                    className="mt-1 w-full border border-stone-300 rounded-lg px-3 py-2 bg-white">
                    {Object.keys(normaliserSecteurs(secteurs)).map((g) => <option key={g}>{g}</option>)}
                  </select>
                </label>
                <label className="text-sm">Matière première
                  <select value={nouvelle.filiere} onChange={(e) => { const b = e.target.value; const doms = (normaliserSecteurs(secteurs)[nouvelle.secteurGrand] || {})[b] || []; setNouvelle({ ...nouvelle, filiere: b, domaine: doms[0] || "" }); }}
                    className="mt-1 w-full border border-stone-300 rounded-lg px-3 py-2 bg-white">
                    {Object.keys(normaliserSecteurs(secteurs)[nouvelle.secteurGrand] || {}).map((f) => <option key={f}>{f}</option>)}
                  </select>
                </label>
                <label className="text-sm">Domaine
                  <select value={nouvelle.domaine || ""} onChange={(e) => setNouvelle({ ...nouvelle, domaine: e.target.value })} className="mt-1 w-full border border-stone-300 rounded-lg px-3 py-2 bg-white">
                    {((normaliserSecteurs(secteurs)[nouvelle.secteurGrand] || {})[nouvelle.filiere] || []).map((d) => <option key={d}>{d}</option>)}
                  </select>
                </label>
                <label className="text-sm">Zone <span className="text-stone-400">(couverture FDFP)</span>
                  <select value={normaliserRegion(nouvelle.region)} onChange={(e) => setNouvelle({ ...nouvelle, region: e.target.value })}
                    className="mt-1 w-full border border-stone-300 rounded-lg px-3 py-2 bg-white">
                    {IMPLANTATIONS.map((r) => <option key={r}>{r}</option>)}
                    {/* Valeur historique hors nomenclature : conservée tant qu'elle n'est pas remplacée */}
                    {nouvelle.region && !IMPLANTATIONS.includes(normaliserRegion(nouvelle.region)) && <option>{normaliserRegion(nouvelle.region)}</option>}
                  </select>
                </label>
                <label className="text-sm">Nombre d'apprenants
                  <input type="number" value={nouvelle.apprenants} onChange={(e) => setNouvelle({ ...nouvelle, apprenants: e.target.value })} className="mt-1 w-full border border-stone-300 rounded-lg px-3 py-2" />
                </label>
                <label className="text-sm">Budget (FCFA)
                  <input type="number" min="0" step="1000" value={nouvelle.budget} onChange={(e) => setNouvelle({ ...nouvelle, budget: e.target.value })} className="mt-1 w-full border border-stone-300 rounded-lg px-3 py-2" />
                  {/* Un champ numérique ne peut pas afficher de séparateurs :
                      on rappelle le montant groupé sous la saisie, pour repérer
                      un zéro de trop avant d'enregistrer. */}
                  <div className="text-xs mt-1 font-medium" style={{ color: C.vert }}>
                    {String(nouvelle.budget).trim() === "" ? "—" : fmtFCFA(nouvelle.budget)}
                  </div>
                </label>
                <label className="text-sm">Statut
                  <select value={nouvelle.statut} onChange={(e) => setNouvelle({ ...nouvelle, statut: e.target.value })} className="mt-1 w-full border border-stone-300 rounded-lg px-3 py-2 bg-white">
                    {STATUTS_PROJET.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </label>
                <div className="md:col-span-2 flex gap-3">
                  <button onClick={ajouterFormation} className="text-white font-semibold px-5 py-2 rounded-xl text-sm" style={{ background: C.vertFonce }}>{editionId ? "Enregistrer les modifications" : "Créer la formation"}</button>
                  <button onClick={() => setFormOuvert(false)} className="text-sm text-stone-500">Annuler</button>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
              {/* Vue tableau — ordinateur / tablette large */}
              <div className="hidden md:grid grid-cols-12 px-5 py-3 text-sm font-semibold text-stone-600 border-b border-stone-100">
                <div className="col-span-6">Projet de formation de type apprentissage</div><div className="col-span-2">Secteur</div><div className="col-span-2">Score MIP &amp; statut</div><div className="col-span-2 text-right">Actions</div>
              </div>
              {formationsVisibles.filter((f) => (f.titre + f.entreprise + f.filiere + (f.secteurGrand || "") + (f.domaine || "")).toLowerCase().includes(recherche.toLowerCase())).map((f) => (
                <div key={f.id} className="hidden md:grid grid-cols-12 items-center px-5 py-4 border-b border-stone-50 hover:bg-stone-50">
                  <div className="col-span-6 pr-3 min-w-0">
                    <div className="font-semibold break-words">{f.titre}</div>
                    <div className="text-sm text-stone-500 break-words">Promoteur : {f.entreprise}{f.operateur ? ` · Opérateur : ${f.operateur}` : ""} · {f.region}</div>
                    {f.beneficiaire && <div className="text-xs text-stone-400 break-words">Bénéficiaire : {f.beneficiaire}</div>}
                  </div>
                  <div className="col-span-2 text-sm min-w-0"><div className="font-medium break-words">{f.secteurGrand || grandSecteurDe(secteurs, f.filiere)}</div><div className="text-stone-500 text-xs break-words">{f.filiere}{f.domaine ? " · " + f.domaine : ""}</div></div>
                  <div className="col-span-2 flex flex-wrap items-center gap-1.5"><Badge score={scoreGlobal(referentiel, f.notes)} /><PuceStatut statut={f.statut} /></div>
                  <div className="col-span-2 flex justify-end items-center gap-3">
                    <button onClick={() => { setEvalId(f.id); setPage("evaluation"); }} className="text-sm font-medium hover:underline" style={{ color: C.vert }}>Évaluer</button>
                    {P.editerFormation && <button title="Modifier la formation" onClick={() => editerFormation(f)} className="text-stone-500 hover:text-stone-800"><Icone n="crayon" t={16} /></button>}
                    {P.supprimerFormation && <button onClick={() => { if (window.confirm(`Supprimer « ${f.titre} » et ses suivis ?`)) { setFormations((fs) => fs.filter((x) => x.id !== f.id)); setSuivis((ss) => ss.filter((x) => x.formationId !== f.id)); } }} className="text-red-500 hover:text-red-700" ><Icone n="poubelle" t={16} /></button>}
                  </div>
                </div>
              ))}
              {/* Vue cartes — mobile : chaque projet entièrement visible, sans défilement horizontal */}
              <div className="md:hidden divide-y divide-stone-100">
                {formationsVisibles.filter((f) => (f.titre + f.entreprise + f.filiere + (f.secteurGrand || "") + (f.domaine || "")).toLowerCase().includes(recherche.toLowerCase())).map((f) => (
                  <div key={f.id} className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold break-words min-w-0">{f.titre}</div>
                      <div className="shrink-0 flex flex-col items-end gap-1"><Badge score={scoreGlobal(referentiel, f.notes)} /><PuceStatut statut={f.statut} /></div>
                    </div>
                    <div className="text-sm text-stone-500 break-words mt-1">Promoteur : {f.entreprise}{f.operateur ? ` · Opérateur : ${f.operateur}` : ""} · {f.region}</div>
                    {f.beneficiaire && <div className="text-xs text-stone-400 break-words mt-0.5">Bénéficiaire : {f.beneficiaire}</div>}
                    <div className="text-xs text-stone-500 break-words mt-1.5">
                      <span className="font-medium">{f.secteurGrand || grandSecteurDe(secteurs, f.filiere)}</span>{f.filiere ? " · " + f.filiere : ""}{f.domaine ? " · " + f.domaine : ""}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3">
                      <button onClick={() => { setEvalId(f.id); setPage("evaluation"); }} className="text-sm font-medium hover:underline" style={{ color: C.vert }}>Évaluer</button>
                      {P.editerFormation && <button title="Modifier la formation" onClick={() => editerFormation(f)} className="text-stone-500 hover:text-stone-800"><Icone n="crayon" t={16} /></button>}
                      {P.supprimerFormation && <button onClick={() => { if (window.confirm(`Supprimer « ${f.titre} » et ses suivis ?`)) { setFormations((fs) => fs.filter((x) => x.id !== f.id)); setSuivis((ss) => ss.filter((x) => x.formationId !== f.id)); } }} className="text-red-500 hover:text-red-700" ><Icone n="poubelle" t={16} /></button>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>)}

          {/* =========== ÉVALUATION MIP =========== */}
          {page === "evaluation" && (!fEval ? (
            <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center">
              <p className="text-stone-600 mb-4">Sélectionnez le Projet de formation de type apprentissage à évaluer :</p>
              <div className="flex flex-col gap-2 max-w-xl mx-auto">
                {formationsVisibles.map((f) => (
                  <button key={f.id} onClick={() => setEvalId(f.id)} className="flex items-center justify-between gap-3 border border-stone-200 rounded-xl px-4 py-3 hover:bg-stone-50 text-left">
                    <span className="font-medium break-words min-w-0">{f.titre}</span><span className="shrink-0"><Badge score={scoreGlobal(referentiel, f.notes)} /></span>
                  </button>
                ))}
              </div>
            </div>
          ) : (<>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <button onClick={() => setEvalId(null)} className="text-sm text-stone-600 hover:text-stone-900">← Retour</button>
              <div className="flex gap-3">
                {P.exports && <button onClick={() => fichePDF(fEval)} className="bg-white border border-stone-200 px-4 py-2 rounded-xl text-sm font-medium hover:bg-stone-50" title="Générer la fiche d'évaluation officielle en PDF"><Icone n="telecharger" t={15} /> Fiche PDF</button>}
                {!P.lectureSeule && <button onClick={() => notif("Évaluation enregistrée")} className="text-white px-4 py-2 rounded-xl text-sm font-semibold" style={{ background: C.vertFonce }} title="Enregistrer l'évaluation"><Icone n="disquette" t={15} /> Enregistrer</button>}
              </div>
            </div>

            <section className="rounded-2xl p-6 text-white flex flex-wrap items-start justify-between gap-4" style={{ background: "linear-gradient(120deg,#0e3c60,#2280bf)" }}>
              <div>
                <div className="text-xs uppercase tracking-wider text-sky-200">Promoteur : {fEval.entreprise}</div>
                <h2 className="text-2xl font-bold mt-1">{fEval.titre}</h2>
                <div className="text-sm text-sky-100 mt-1">{libelleSecteur(fEval, secteurs)} · {fEval.region} · {fEval.apprenants} apprenants · {fmtFCFA(fEval.budget)}</div>
                {(fEval.operateur || fEval.beneficiaire) && <div className="text-xs text-sky-200 mt-1">{[fEval.operateur ? `Opérateur : ${fEval.operateur}` : "", fEval.beneficiaire ? `Bénéficiaire : ${fEval.beneficiaire}` : ""].filter(Boolean).join(" · ")}</div>}
              </div>
              <div className="text-right">
                <div className="text-xs uppercase tracking-wider text-sky-200">Score global MIP-PPA</div>
                <div className="text-5xl font-bold">{fmtPct(scoreGlobal(referentiel, fEval.notes))}</div>
                <div className="mt-1.5 flex flex-wrap justify-end items-center gap-2">
                  <Badge score={scoreGlobal(referentiel, fEval.notes)} />
                  <PuceStatut statut={fEval.statut} />
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              {referentiel.map((d) => {
                const s = scoreDimension(referentiel, d.id, fEval.notes);
                return (
                  <div key={d.id} className="bg-white rounded-2xl border border-stone-200 p-5">
                    <div className="flex justify-between text-xs uppercase tracking-wide text-stone-500 font-semibold"><span>{d.nom}</span><span>{d.poids}%</span></div>
                    <div className="text-3xl font-bold mt-1">{fmtPct(s)}</div>
                    <div className="h-2 bg-stone-200 rounded-full mt-3 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${s ?? 0}%`, background: C.vert }} />
                    </div>
                  </div>
                );
              })}
            </section>

            {referentiel.map((d) => {
              const s = scoreDimension(referentiel, d.id, fEval.notes);
              const notable = !P.lectureSeule && (P.evalDims === "toutes" || d.id === P.evalDims);
              return (
                <section key={d.id} className="bg-white rounded-2xl border border-stone-200 p-5" style={notable ? {} : { opacity: 0.55 }}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <h3 className="font-bold">{d.nom} <span className="text-stone-400 font-normal">· {d.poids}%</span></h3>
                      <p className="text-sm text-stone-500">{d.desc}</p>
                    </div>
                    <Badge score={s} />
                  </div>
                  <div className="space-y-4 mt-4">
                    {d.indicateurs.map((ind) => (
                      <div key={ind.id} className="border border-stone-200 rounded-xl p-4">
                        <div className="flex justify-between items-start gap-3">
                          <div>
                            <div className="text-xs text-stone-500 font-mono">{ind.id} · {ind.phase}</div>
                            <div className="font-semibold mt-0.5">{ind.label}</div>
                          </div>
                          <span className="text-sm text-stone-500 shrink-0">{noteLabel(fEval.notes[ind.id])}</span>
                        </div>
                        <div className="grid grid-cols-5 gap-2 mt-3">
                          {[0, 1, 2, 3, 4].map((n) => {
                            const sel = fEval.notes[ind.id] === n;
                            return (
                              <button key={n} disabled={!notable} title={notable ? "" : "Votre rôle ne permet pas de noter cette dimension"}
                                onClick={() => notable && noter(fEval.id, ind.id, n)}
                                className="py-2.5 rounded-xl border text-sm font-semibold transition"
                                style={sel ? { background: C.vertFonce, color: "#fff", borderColor: C.vertFonce } : { background: "#fafaf8", borderColor: "#e7e5e4" }}>
                                {n}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </>))}

          {/* =========== SUIVI POST-FORMATION =========== */}
          {page === "suivi" && (() => {
            const enrichis = suivis.map((s) => ({ ...s, f: formationsVisibles.find((f) => f.id === s.formationId) })).filter((s) => s.f && (P.suivisJalons === "tous" || s.jalon === P.suivisJalons));
            const retard = enrichis.filter((s) => s.statut === "programmé" && joursRestants(s.echeance) < 0);
            const sous14 = enrichis.filter((s) => s.statut === "programmé" && joursRestants(s.echeance) >= 0 && joursRestants(s.echeance) <= 14);
            const programmes = enrichis.filter((s) => s.statut === "programmé" && joursRestants(s.echeance) > 14);
            const effectues = enrichis.filter((s) => s.statut === "effectué");
            const Pile = ({ titre, icone, liste, teinte }) => (
              <section className="bg-white rounded-2xl border border-stone-200 p-5">
                <h3 className="font-bold flex items-center gap-2">{icone} {titre} <span className="text-xs bg-stone-100 px-2 py-0.5 rounded-full">{liste.length}</span></h3>
                {!liste.length ? <p className="text-sm text-stone-400 mt-2">Aucun élément.</p> : liste.map((s) => (
                  <div key={s.id} className="border-t border-stone-100 py-3.5 flex flex-wrap items-center justify-between gap-3 first:border-t-0 mt-1">
                    <div>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full mr-2" style={{ background: teinte, color: "#1c1917" }}>{s.jalon}</span>
                      <span className="font-semibold">{s.f.titre}</span>
                      <div className="text-sm text-stone-500 mt-0.5">{s.f.entreprise} · {libelleSecteur(s.f, secteurs)} · échéance {s.echeance}{s.statut === "programmé" ? ` · ${joursRestants(s.echeance) < 0 ? Math.abs(joursRestants(s.echeance)) + " j de retard" : "dans " + joursRestants(s.echeance) + " j"}` : ""}</div>
                      {s.note && <div className="text-xs text-stone-500 italic mt-1"><Icone n="note" t={13} /> {s.note}</div>}
                      {(s.docs || []).length > 0 && <div className="text-xs text-sky-700 mt-1"><Icone n="trombone" t={13} /> {s.docs.length} document{s.docs.length > 1 ? "s" : ""} de suivi rattaché{s.docs.length > 1 ? "s" : ""}</div>}
                    </div>
                    <div className="flex gap-2">
                      {!P.lectureSeule && <button onClick={() => setSuiviEdit({ id: s.id, jalon: s.jalon, titreF: s.f.titre + " — " + s.f.entreprise, echeance: s.echeance, note: s.note, docs: s.docs || [] })}
                        className="text-sm border border-stone-200 px-3 py-1.5 rounded-lg hover:bg-stone-50" title="Modifier la date, les observations et les documents"><Icone n="crayon" t={14} /> Notes & date</button>}
                      {P.suiviValider && (s.statut === "programmé"
                        ? <button onClick={() => { setSuivis((ss) => ss.map((x) => x.id === s.id ? { ...x, statut: "effectué" } : x)); notif("Suivi marqué effectué"); }} className="text-sm border border-stone-200 px-3 py-1.5 rounded-lg hover:bg-stone-50" title="Valider la réalisation de ce suivi"><Icone n="coche" t={14} /> Marquer effectué</button>
                        : <button onClick={() => setSuivis((ss) => ss.map((x) => x.id === s.id ? { ...x, statut: "programmé" } : x))} className="text-sm text-stone-500 hover:text-stone-800" title="Repasser ce suivi en programmé"><Icone n="rotation" t={14} /> Ré-ouvrir</button>)}
                    </div>
                  </div>
                ))}
              </section>
            );
            return (<>
              <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                <StatCard icone={<Icone n="calendrier" t={20} />} titre="Suivis planifiés" valeur={enrichis.length} />
                <StatCard icone={<Icone n="alerte" t={20} />} titre="En retard" valeur={retard.length} sous="À traiter en priorité" teinte="#fde8e8" fg={C.insuffisant} />
                <StatCard icone={<Icone n="horloge" t={20} />} titre="À faire sous 14 j" valeur={sous14.length} teinte="#fdf0da" fg="#b07515" />
                <StatCard icone={<Icone n="cocheCercle" t={20} />} titre="Taux de réalisation" valeur={`${enrichis.length ? Math.round((effectues.length / enrichis.length) * 100) : 0} %`} sous={`${effectues.length} sur ${enrichis.length} effectués`} teinte="#e3f4e8" fg={C.excellent} />
              </section>
              {retard.length > 0 && <Pile titre="En retard" icone={<Icone n="alerte" t={17} className="text-red-600" />} liste={retard} teinte="#fecaca" />}
              <Pile titre="À faire sous 14 jours" icone={<Icone n="horloge" t={17} className="text-amber-600" />} liste={sous14} teinte="#dcebf7" />
              <Pile titre="Programmés" icone={<Icone n="calendrier" t={17} className="text-stone-500" />} liste={programmes} teinte="#f0efe9" />
              <Pile titre="Effectués" icone={<Icone n="cocheCercle" t={17} className="text-emerald-600" />} liste={effectues} teinte="#cfe6f6" />
            </>);
          })()}

          {/* =========== RÉFÉRENTIEL DES INDICATEURS =========== */}
          {page === "indicateurs" && (<>
            <section className="bg-white rounded-2xl border border-stone-200 p-5">
              <h3 className="font-bold">Lecture du score global</h3>
              <p className="text-sm text-stone-500">Quatre niveaux d'interprétation. Pondération totale actuelle : <b style={{ color: poidsTotal === 100 ? C.excellent : C.insuffisant }}>{poidsTotal} %</b>{poidsTotal !== 100 && " — ajustez pour revenir à 100 %"}</p>
              {admin && (
                <div className="flex flex-wrap gap-3 mt-3">
                  <button onClick={() => setReferentiel((r) => {
                    // Code unique : deux dimensions homonymes fausseraient le score.
                    let k = r.length + 1;
                    while (r.some((x) => x.id === "D" + k)) k++;
                    return [...r, { id: "D" + k, nom: "Nouvelle dimension", poids: 0, desc: "Description à compléter.", indicateurs: [] }];
                  })}
                    className="text-white text-sm font-semibold px-4 py-2 rounded-xl" style={{ background: C.vertFonce }}>+ Nouvelle dimension</button>
                  <button onClick={() => { setReferentiel(REFERENTIEL_DEFAUT); notif("Référentiel par défaut restauré"); }}
                    className="bg-white border border-stone-200 text-sm px-4 py-2 rounded-xl hover:bg-stone-50" title="Revenir aux 5 dimensions et 23 indicateurs d'origine"><Icone n="rotation" t={14} /> Restaurer le référentiel par défaut</button>
                </div>
              )}
              <div className="flex flex-wrap gap-2 mt-4">
                {[["Insuffisant (0–40 %)", C.insuffisant], ["Moyen (40–60 %)", C.dev], ["Satisfaisant (60–80 %)", C.satisfaisant], ["Excellent (80–100 %)", C.excellent]].map(([t, c]) => (
                  <span key={t} className="text-xs font-semibold text-white px-3 py-1.5 rounded-full" style={{ background: c }}>{t}</span>
                ))}
              </div>
            </section>

            {P.secteurs && (
              <section className="bg-white rounded-2xl border border-stone-200 p-5">
                <h3 className="font-bold">Secteurs, matières premières et domaines</h3>
                <p className="text-sm text-stone-500 mb-3">Trois niveaux : le grand secteur, ses matières premières, et les domaines de chacune. Tout est modifiable — cette hiérarchie alimente le formulaire de projet.</p>
                {/* La hiérarchie est stockée en base : sans ce bouton, une mise
                    à jour de la nomenclature livrée avec l'application resterait
                    invisible sur une installation déjà en service. */}
                <button onClick={() => {
                  if (!window.confirm("Remplacer toute la hiérarchie actuelle par la nomenclature d'origine ?\n\nLes secteurs, matières premières et domaines que vous avez ajoutés ou renommés seront perdus. Les projets déjà saisis conservent leurs libellés actuels.")) return;
                  setSecteurs(SECTEURS_DEFAUT); notif("Nomenclature par défaut restaurée");
                }}
                  className="bg-white border border-stone-200 text-sm px-4 py-2 rounded-xl hover:bg-stone-50 mb-4" title="Revenir aux secteurs, matières premières et domaines d'origine"><Icone n="rotation" t={14} /> Restaurer la nomenclature par défaut</button>
                <div className="space-y-4">
                  {Object.entries(normaliserSecteurs(secteurs)).map(([grand, branches]) => (
                    <div key={grand} className="border border-stone-200 rounded-xl p-4">
                      <div className="flex items-center justify-between gap-2">
                        <ChampEditable valeur={grand} titre="Renommer ce secteur (Entrée pour valider, Échap pour annuler)"
                          surValider={(nom) => {
                            if (normaliserSecteurs(secteurs)[nom]) { notif("Un secteur porte déjà ce nom"); return false; }
                            setSecteurs((s) => { const n = normaliserSecteurs(s), o = {}; Object.entries(n).forEach(([k, v]) => { o[k === grand ? nom : k] = v; }); return o; });
                            notif(`Secteur renommé${messagePropagation(propagerRenommage("secteurGrand", grand, nom))}`);
                          }}
                          className="font-semibold bg-transparent outline-none border-b border-transparent focus:border-stone-300 flex-1" />
                        <span className="text-xs text-stone-400">{Object.keys(branches || {}).length} matières premières</span>
                        <button onClick={() => { if (window.confirm(`Supprimer « ${grand} » et tout son contenu ?`)) setSecteurs((s) => { const n = { ...normaliserSecteurs(s) }; delete n[grand]; return n; }); }}
                          className="text-red-400 hover:text-red-600" title="Supprimer ce secteur"><Icone n="poubelle" t={15} /></button>
                      </div>
                      <div className="space-y-3 mt-3">
                        {Object.entries(branches || {}).map(([branche, domaines]) => (
                          <div key={branche} className="bg-stone-50 rounded-lg p-3">
                            <div className="flex items-center justify-between gap-2">
                              <ChampEditable valeur={branche} titre="Renommer cette matière première (Entrée pour valider, Échap pour annuler)"
                                surValider={(nom) => {
                                  if ((normaliserSecteurs(secteurs)[grand] || {})[nom]) { notif("Une matière première porte déjà ce nom dans ce secteur"); return false; }
                                  setSecteurs((s) => { const n = { ...normaliserSecteurs(s) }; const bo = {}; Object.entries(n[grand] || {}).forEach(([k, v]) => { bo[k === branche ? nom : k] = v; }); n[grand] = bo; return n; });
                                  // Seuls les projets rattachés à CE secteur : deux secteurs
                                  // peuvent héberger une matière première de même nom.
                                  const n2 = propagerRenommage("filiere", branche, nom,
                                    (f) => (f.secteurGrand || grandSecteurDe(secteurs, f.filiere)) === grand);
                                  notif(`Matière première renommée${messagePropagation(n2)}`);
                                }}
                                className="text-sm font-medium bg-transparent outline-none border-b border-transparent focus:border-stone-300 flex-1" />
                              <button onClick={() => setSecteurs((s) => { const n = { ...normaliserSecteurs(s) }; const bo = { ...n[grand] }; delete bo[branche]; n[grand] = bo; return n; })}
                                className="text-red-400 hover:text-red-600" title="Supprimer cette matière première"><Icone n="fermer" t={13} /></button>
                            </div>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {(domaines || []).map((d, i) => (
                                <span key={i} className="flex items-center gap-1 bg-white border border-stone-200 rounded-full pl-2.5 pr-1 py-0.5 text-xs">
                                  <ChampEditable valeur={d} largeurAuto titre="Renommer ce domaine (Entrée pour valider, Échap pour annuler)"
                                    surValider={(nom) => {
                                      const liste = (normaliserSecteurs(secteurs)[grand] || {})[branche] || [];
                                      if (liste.some((x, j) => j !== i && x === nom)) { notif("Ce domaine existe déjà dans la branche"); return false; }
                                      setSecteurs((s) => { const n = { ...normaliserSecteurs(s) }; n[grand] = { ...n[grand], [branche]: (n[grand][branche] || []).map((x, j) => j === i ? nom : x) }; return n; });
                                      const n3 = propagerRenommage("domaine", d, nom, (f) => f.filiere === branche);
                                      notif(`Domaine renommé${messagePropagation(n3)}`);
                                    }}
                                    className="bg-transparent outline-none" />
                                  <button onClick={() => setSecteurs((s) => { const n = { ...normaliserSecteurs(s) }; n[grand] = { ...n[grand], [branche]: n[grand][branche].filter((_, j) => j !== i) }; return n; })}
                                    className="text-stone-300 hover:text-red-600" title="Supprimer ce domaine"><Icone n="fermer" t={10} /></button>
                                </span>
                              ))}
                              <button onClick={() => setSecteurs((s) => { const n = { ...normaliserSecteurs(s) }; n[grand] = { ...n[grand], [branche]: [...(n[grand][branche] || []), nomLibre("Nouveau domaine", n[grand][branche] || [])] }; return n; })}
                                className="text-xs border border-dashed border-stone-300 rounded-full px-2.5 py-0.5 text-stone-500 hover:bg-white">+ Domaine</button>
                            </div>
                          </div>
                        ))}
                        <button onClick={() => setSecteurs((s) => { const n = { ...normaliserSecteurs(s) }; n[grand] = { ...n[grand], [nomLibre("Nouvelle matière première", Object.keys(n[grand] || {}))]: ["Général"] }; return n; })}
                          className="text-sm border border-dashed border-stone-300 rounded-lg px-3 py-1.5 text-stone-500 hover:bg-stone-50 w-full">+ Ajouter une matière première</button>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => setSecteurs((s) => ({ ...normaliserSecteurs(s), [nomLibre("Nouveau secteur", Object.keys(normaliserSecteurs(s)))]: { "Nouvelle matière première": ["Général"] } }))}
                    className="text-sm border border-dashed border-stone-300 rounded-xl px-4 py-2 text-stone-500 hover:bg-stone-50 w-full">+ Ajouter un grand secteur</button>
                </div>
                <h3 className="font-bold mt-6">Phases de mesure</h3>
                <p className="text-sm text-stone-500 mb-3">Moments où chaque indicateur est renseigné (proposés dans la fenêtre d'un indicateur).</p>
                <div className="flex flex-wrap gap-2">
                  {phases.map((s, i) => (
                    <span key={i} className="flex items-center gap-1.5 bg-stone-100 rounded-full pl-3 pr-1.5 py-1 text-sm">
                      <ChampEditable valeur={s} largeurAuto largeurMin={10} titre="Renommer cette phase (Entrée pour valider, Échap pour annuler)"
                        surValider={(nom) => {
                          if (phases.some((x, j) => j !== i && x === nom)) { notif("Cette phase existe déjà"); return false; }
                          setPhases((ss) => ss.map((x, j) => j === i ? nom : x));
                          // Les indicateurs désignent leur phase par le libellé.
                          notif(`Phase renommée${messagePropagation(propagerRenommagePhase(s, nom), "indicateur")}`);
                        }}
                        className="bg-transparent outline-none" />
                      <button onClick={() => setPhases((ss) => ss.filter((_, j) => j !== i))}
                        className="text-stone-400 hover:text-red-600 w-5 h-5 rounded-full flex items-center justify-center" title="Supprimer cette phase"><Icone n="fermer" t={12} /></button>
                    </span>
                  ))}
                  <button onClick={() => setPhases((ss) => [...ss, "Nouvelle phase"])}
                    className="text-sm border border-dashed border-stone-300 rounded-full px-3 py-1 text-stone-500 hover:bg-stone-50">+ Ajouter</button>
                </div>
              </section>
            )}

            {referentiel.map((d) => (
              <section key={d.id} className="bg-white rounded-2xl border border-stone-200 p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="font-bold"><span className="text-xs font-mono text-stone-400 mr-2">{d.id}</span>{d.nom}</h3>
                    <p className="text-sm text-stone-500">{d.desc}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm bg-stone-100 px-3 py-1 rounded-full">{d.poids} %</span>
                    {admin && <button title="Modifier cette dimension (code, nom, pondération, description)"
                      onClick={() => setDimEdit({ ancienId: d.id, id: d.id, nom: d.nom, poids: d.poids, desc: d.desc })}
                      className="text-stone-500 hover:text-stone-800"><Icone n="crayon" t={16} /></button>}
                    {admin && <button title="Supprimer cette dimension et ses indicateurs" onClick={() => { if (window.confirm(`Supprimer la dimension « ${d.nom} » et ses indicateurs ?`)) setReferentiel((r) => r.filter((x) => x.id !== d.id)); }} className="text-red-500 hover:text-red-700"><Icone n="poubelle" t={16} /></button>}
                  </div>
                </div>
                <div className="space-y-2.5 mt-4">
                  {d.indicateurs.map((ind) => (
                    <div key={ind.id} className="border border-stone-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-mono text-stone-400">{ind.id} <span className="uppercase tracking-wide ml-2">{ind.phase}</span></div>
                        <div className="font-medium mt-0.5 leading-snug whitespace-normal break-words">{ind.label}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {admin && <button title="Modifier cet indicateur (code, intitulé, phase)"
                          onClick={() => setIndEdit({ dimId: d.id, ancienId: ind.id, id: ind.id, label: ind.label, phase: ind.phase })}
                          className="text-stone-500 hover:text-stone-800"><Icone n="crayon" t={15} /></button>}
                        {admin && <button title="Supprimer cet indicateur" onClick={() => setReferentiel((r) => r.map((x) => x.id === d.id ? { ...x, indicateurs: x.indicateurs.filter((i) => i.id !== ind.id) } : x))} className="text-red-400 hover:text-red-600"><Icone n="poubelle" t={15} /></button>}
                      </div>
                    </div>
                  ))}
                  {admin && (
                    <button onClick={() => setReferentiel((r) => {
                      // Le code doit rester unique dans tout le référentiel : deux
                      // indicateurs de même code partagent la même note et se
                      // sélectionnent l'un l'autre à l'évaluation.
                      const dim = r.find((x) => x.id === d.id);
                      if (!dim) return r;
                      const pris = new Set(r.flatMap((x) => x.indicateurs.map((i) => i.id)));
                      let k = dim.indicateurs.length + 1;
                      while (pris.has(d.id + k)) k++;
                      return r.map((x) => x.id === d.id ? { ...x, indicateurs: [...x.indicateurs, { id: d.id + k, phase: "À définir", label: "Nouvel indicateur — à définir" }] } : x);
                    })}
                      className="w-full border border-dashed border-stone-300 rounded-xl py-2.5 text-sm text-stone-500 hover:bg-stone-50">+ Ajouter un indicateur</button>
                  )}
                </div>
              </section>
            ))}
          </>)}

          {/* =========== ALERTES =========== */}
          {page === "alertes" && (
            stats.alertes === 0 ? (
              <section className="bg-white rounded-2xl border border-stone-200 p-14 text-center">
                <div className="flex justify-center text-emerald-600"><Icone n="cocheCercle" t={34} /></div>
                <p className="text-stone-500 mt-3">Aucune alerte active. Tout est sous contrôle.</p>
              </section>
            ) : (<>
              {stats.alertesScore.map((f) => (
                <section key={f.id} className="bg-white rounded-2xl border-l-4 border border-stone-200 p-5" style={{ borderLeftColor: C.insuffisant }}>
                  <div className="flex justify-between items-center gap-3 flex-wrap">
                    <div>
                      <div className="font-bold">Score critique — {f.titre}</div>
                      <div className="text-sm text-stone-500">{f.entreprise} · score global inférieur à 40 %</div>
                    </div>
                    <button onClick={() => { setEvalId(f.id); setPage("evaluation"); }} className="text-sm font-medium hover:underline" style={{ color: C.vert }}>Ouvrir l'évaluation →</button>
                  </div>
                </section>
              ))}
              {stats.enRetard.map((s) => {
                const f = formations.find((x) => x.id === s.formationId);
                return (
                  <section key={s.id} className="bg-white rounded-2xl border-l-4 border border-stone-200 p-5" style={{ borderLeftColor: C.dev }}>
                    <div className="font-bold">Suivi {s.jalon} en retard — {f?.titre}</div>
                    <div className="text-sm text-stone-500">{f?.entreprise} · échéance dépassée : {s.echeance}</div>
                  </section>
                );
              })}
            </>)
          )}

          {/* =========== EXPORTS =========== */}
          {page === "exports" && (<>
            <section className="bg-white rounded-2xl border border-stone-200 p-6">
              <h3 className="font-bold">Export consolidé</h3>
              <p className="text-sm text-stone-500 mb-4">Tous les projets de formation de type apprentissage et indicateurs en une feuille Excel.</p>
              <button onClick={exportExcel} className="text-white font-semibold px-5 py-2.5 rounded-xl text-sm" style={{ background: C.vertFonce }} title="Toutes les formations et indicateurs en une feuille">
                <Icone n="telecharger" t={15} /> Télécharger l'Excel ({formationsVisibles.length} formations)
              </button>
            </section>
            <section className="bg-white rounded-2xl border border-stone-200 p-6">
              <h3 className="font-bold">Fiches d'évaluation PDF</h3>
              <p className="text-sm text-stone-500">Une fiche officielle par projet de formation de type apprentissage.</p>
              <div className="divide-y divide-stone-100 mt-2">
                {formationsVisibles.map((f) => (
                  <div key={f.id} className="flex items-center justify-between gap-3 py-3.5">
                    <div>
                      <div className="font-semibold">{f.titre}</div>
                      <div className="text-sm text-stone-500">{f.entreprise} · {libelleSecteur(f, secteurs)}</div>
                    </div>
                    <button onClick={() => fichePDF(f)} className="bg-white border border-stone-200 px-4 py-2 rounded-xl text-sm font-medium hover:bg-stone-50 shrink-0" title="Générer la fiche PDF de cette formation"><Icone n="fichier" t={15} /> Fiche PDF</button>
                  </div>
                ))}
              </div>
            </section>
          </>)}

          {/* =========== GUIDE =========== */}
          {page === "guide" && (<>
            <section className="rounded-2xl p-7 text-white" style={{ background: "linear-gradient(120deg,#0e3c60,#1d6fa8)" }}>
              <span className="text-xs font-semibold px-3 py-1 rounded-full text-stone-900" style={{ background: C.gold }}>Documentation officielle</span>
              <h2 className="text-3xl font-bold mt-3">Bienvenue sur MIP-PPA</h2>
              <p className="mt-2 text-sky-100">Ce guide est conçu pour <b>tout public</b> : agents du FDFP, référents en entreprise, formateurs. Aucune connaissance technique n'est requise (prise en main ≈ 10 minutes).</p>
            </section>
            {(P.lectureSeule ? [
              ["1. Votre accès en consultation", "Votre profil (" + roleActif + ") vous donne un accès en lecture seule aux projets dont votre organisation est promoteur ou opérateur. Vous consultez les évaluations, les suivis et les documents, sans pouvoir les modifier — la saisie est assurée par les équipes du FDFP."],
              ["2. Tableau de bord", "Vue d'ensemble de vos projets : nombre d'apprenants, score moyen MIP, radar des 5 dimensions, comparaison par secteur. Les chiffres sont recalculés en continu à partir des évaluations saisies par le FDFP."],
              ["3. Lire une évaluation", "Ouvrez un projet depuis la page Projets pour consulter sa fiche : score global (0-100 %), niveau (Insuffisant / En développement / Satisfaisant / Excellent), détail des 5 dimensions et des 23 indicateurs notés de 0 à 4."],
              ["4. Suivi post-formation", "Chaque projet comporte 3 jalons (M+3, M+6, M+12) : vous suivez leur état (programmé, effectué, en retard), lisez les observations de terrain et consultez les documents joints en cliquant dessus (visionneuse plein écran)."],
              ["5. Exports", "Le bouton Fiche PDF génère la fiche officielle d'évaluation d'un projet (avec les images et PDF joints en annexe) ; l'export Excel produit la synthèse de vos projets. Ces documents sont partageables en interne."],
              ["6. Besoin d'une correction ?", "Si une information vous semble inexacte (score, échéance, document), contactez votre interlocuteur FDFP ou l'administrateur de la plateforme : lui seul peut modifier les données."],
            ] : [
              ["1. Démarrer", "Créez votre compte (nom, organisation, email, mot de passe), attendez l'activation par l'administrateur lead qui vous attribue un rôle, puis connectez-vous. Le tout premier compte créé devient automatiquement Administrateur lead."],
              ["2. Comptes & rôles", "Cinq niveaux d'accès : Administrateur lead (tous les droits, distribue les accès) ; Administrateur FDFP (pilotage global, validation, configuration) ; Agent FDFP (évaluation MIP-PPA, suivis, exports) ; Promoteur (consultation en lecture seule de l'ensemble du portefeuille) ; Opérateur (saisie des indicateurs pédagogiques et suivi des apprenants). Les rôles sont protégés côté serveur : aucun utilisateur ne peut s'auto-attribuer un accès."],
              ["3. Gérer les projets", "Créez un projet de formation de type apprentissage (intitulé, entreprise bénéficiaire, secteur, zone, apprenants, budget FCFA), suivez son statut (Planifiée / En cours / Terminée), puis cliquez dessus pour ouvrir sa fiche d'évaluation."],
              ["4. Évaluer (modèle MIP-PPA)", "Le modèle mesure la valeur réelle d'une formation à travers 5 dimensions et 23 indicateurs notés de 0 à 4. Les indicateurs non encore mesurables peuvent rester vides ; le score se calcule automatiquement et l'enregistrement est instantané."],
              ["5. Suivi à 3, 6 et 12 mois", "Chaque formation déclenche automatiquement 3 points de suivi : à 3 mois (transfert des acquis au poste), 6 mois (effets organisationnels mesurables) et 12 mois (pérennité et retour sur investissement). Les jalons sont regroupés en 4 piles : En retard, À faire sous 14 j, Programmés, Effectués. Ces suivis alimentent directement les dimensions Impact organisationnel et Durabilité des compétences."],
              ["6. Tableaux de bord & référentiel", "Le tableau de bord offre la vision consolidée (formations, apprenants, score moyen, radar des 5 dimensions, comparaison par secteur). L'administrateur lead peut ajouter, modifier ou supprimer dimensions et indicateurs ; la somme des pondérations doit rester à 100 %. Un bouton permet de restaurer le référentiel MIP-PPA d'origine."],
              ["7. Alertes", "Deux événements remontent automatiquement : formations dont le score global est inférieur à 40 %, et suivis post-formation en retard sur leur échéance."],
              ["8. Exports PDF & Excel", "PDF : fiche d'évaluation individuelle par formation (comités de pilotage, transmission aux entreprises). Excel : synthèse globale du portefeuille pour le reporting institutionnel."],
            ]).map(([t, txt]) => (
              <section key={t} className="bg-white rounded-2xl border border-stone-200 p-6">
                <h3 className="font-bold mb-2">{t}</h3>
                <p className="text-sm text-stone-600 leading-relaxed">{txt}</p>
              </section>
            ))}
          </>)}

          {/* =========== UTILISATEURS & RÔLES =========== */}
          {page === "users" && (P.users ? (<>
            <section className="bg-white rounded-2xl border border-stone-200 p-6">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <h3 className="font-bold">Comptes ({comptes.length})</h3>
                <div className="flex items-center gap-2">
                  <button onClick={chargerComptes} title="Recharger la liste depuis la base"
                    className="text-sm border border-stone-200 px-3 py-1.5 rounded-lg hover:bg-stone-50 flex items-center gap-1.5"><Icone n="rotation" t={14} /> Actualiser</button>
                  <select defaultValue="" onChange={(e) => { if (e.target.value === "deconnexion") { if (sb) sb.auth.signOut(); setSession(null); } e.target.value = ""; }}
                    className="text-sm border border-stone-200 px-3 py-1.5 rounded-lg bg-white cursor-pointer" title="Options du compte">
                    <option value="" disabled>Options ▾</option>
                    <option value="deconnexion">Déconnexion</option>
                  </select>
                </div>
              </div>
              <p className="text-sm text-stone-500 mb-4">Sélectionnez un rôle pour chaque utilisateur. Les comptes « En attente » n'ont aucun accès tant qu'aucun rôle ne leur est attribué. Seul l'administrateur lead peut modifier les rôles.</p>
              <div className="divide-y divide-stone-100">
                {comptes.map((u) => (
                  <div key={u.id} className="py-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full text-white flex items-center justify-center text-sm font-semibold" style={{ background: u.role === "En attente d'activation" ? "#a8a29e" : C.vert }}>
                        {u.nom.split(" ").map((m) => m[0]).slice(0, 2).join("").toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold break-words">{u.nom} {session?.id === u.id && <span className="text-xs font-normal text-stone-400">(vous)</span>}</div>
                        <div className="text-sm text-stone-500 break-words">{u.email} · {u.org}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${u.role === "En attente d'activation" ? "bg-stone-100 text-stone-500" : "bg-sky-100 text-sky-800"}`}>{u.role}</span>
                      <select value={u.role} disabled={roleActif !== "Administrateur lead" || session?.id === u.id}
                        onChange={(e) => attribuerRole(u.id, e.target.value)}
                        className="text-sm border border-stone-200 rounded-lg px-3 py-2 bg-stone-50">
                        <option value="En attente d'activation">Choisir…</option>
                        {ROLES.filter((r) => r !== "En attente d'activation").map((r) => <option key={r}>{r}</option>)}
                      </select>
                      {roleActif === "Administrateur lead" && session?.id !== u.id && u.role !== "En attente d'activation" && (
                        <button title="Retirer l'accès (repasse le compte en attente)" onClick={() => attribuerRole(u.id, "En attente d'activation")}
                          className="text-red-500 hover:text-red-700"><Icone n="poubelle" t={16} /></button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <section className="bg-white rounded-2xl border border-stone-200 p-6">
              <h3 className="font-bold mb-1"><Icone n="plus" t={16} /> Inviter un nouvel utilisateur</h3>
              <p className="text-sm text-stone-600 mb-4">Saisissez l'email d'un partenaire : un email d'invitation contenant le lien de la plateforme lui sera envoyé directement (comme l'email de confirmation d'inscription). Après inscription, il apparaîtra ci-dessus en statut « En attente », prêt à recevoir son rôle.</p>
              <div className="flex flex-wrap items-end gap-3">
                <label className="text-sm font-semibold text-stone-800 flex-1 min-w-[220px]">Email du partenaire
                  <input type="email" value={emailInvite} onChange={(e) => setEmailInvite(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && envoyerInvitation()}
                    placeholder="prenom.nom@organisation.ci"
                    className="mt-1.5 w-full border border-stone-300 rounded-xl px-3.5 py-2.5 font-normal outline-none focus:border-sky-600" />
                </label>
                <label className="text-sm font-semibold text-stone-800">Rôle prévu <span className="font-normal text-stone-400">(indicatif)</span>
                  <select value={roleInvite} onChange={(e) => setRoleInvite(e.target.value)}
                    className="mt-1.5 w-full border border-stone-300 rounded-xl px-3 py-2.5 font-normal bg-white outline-none focus:border-sky-600">
                    {ROLES.filter((r) => r !== "En attente d'activation").map((r) => <option key={r}>{r}</option>)}
                  </select>
                </label>
                <button onClick={envoyerInvitation} className="text-white font-semibold px-5 py-2.5 rounded-xl text-sm flex items-center gap-1.5" style={{ background: C.vertFonce }}>
                  <Icone n="telecharger" t={15} /> {envoiInvite ? "Envoi en cours…" : "Envoyer l'invitation"}
                </button>
              </div>
              <p className="text-xs text-stone-400 mt-3">Le lien communiqué est celui de cette plateforme : <span className="font-mono">{urlApp}</span></p>
            </section>
          </>) : (
            <section className="bg-white rounded-2xl border border-stone-200 p-10 text-center text-stone-500">
              Accès réservé aux administrateurs. Votre rôle actuel : {roleActif}.
            </section>
          ))}

        </main>
        <PiedCertification />
        <footer className="text-center text-[11px] text-stone-400 pb-5">
          Prototype MIP-PPA — PFE ESA / INP-HB × FDFP · EHOUNI Luc-Emmanuel Behira Levy · Données de démonstration
        </footer>
      </div>

      {/* ---------- VISIONNEUSE DE DOCUMENT ---------- */}
      {docVu && (
        <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: "rgba(8,20,30,.92)" }}
          onClick={(e) => e.target === e.currentTarget && setDocVu(null)}>
          <div className="flex items-center justify-between px-5 py-3 text-white shrink-0">
            <div className="min-w-0">
              <div className="font-semibold break-words">{docVu.nom}</div>
              <div className="text-xs text-stone-300">{(docVu.taille / 1024).toFixed(0)} Ko · ajouté le {docVu.date}</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <a href={docVu.data} download={docVu.nom} className="text-sm bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg flex items-center gap-1.5"><Icone n="telecharger" t={15} /> Télécharger</a>
              <button onClick={() => setDocVu(null)} className="text-sm bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg flex items-center gap-1.5"><Icone n="fermer" t={15} /> Fermer</button>
            </div>
          </div>
          <div className="flex-1 min-h-0 px-4 pb-4" onClick={(e) => e.target === e.currentTarget && setDocVu(null)}>
            {docVu.type.startsWith("image/") ? (
              <div className="w-full h-full flex items-center justify-center overflow-auto">
                <img src={docVu.data} alt={docVu.nom} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
              </div>
            ) : docVu.type === "application/pdf" ? (
              <iframe src={docVu.data} title={docVu.nom} className="w-full h-full rounded-lg bg-white" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="bg-white rounded-2xl p-8 text-center max-w-md">
                  <div className="flex justify-center text-stone-400"><Icone n="fichier" t={44} /></div>
                  <div className="font-semibold mt-3">{docVu.nom}</div>
                  <p className="text-sm text-stone-500 mt-2">Ce type de fichier (Word, Excel…) ne peut pas être prévisualisé directement dans le navigateur. Téléchargez-le pour l'ouvrir avec le logiciel adapté.</p>
                  <a href={docVu.data} download={docVu.nom} className="inline-flex items-center gap-1.5 mt-4 text-white px-4 py-2 rounded-xl text-sm font-semibold" style={{ background: C.vertFonce }}><Icone n="telecharger" t={15} /> Télécharger le document</a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------- FENÊTRE : DÉTAIL D'UN INDICATEUR DU TABLEAU DE BORD ----------
          Ouverte depuis les cartes « Projets suivis », « Apprenants concernés »
          et « Score moyen MIP-PPA ». Chaque ligne renvoie vers la fiche
          d'évaluation du projet concerné. */}
      {detailStat && (() => {
        const entetes = {
          projets:    ["Projets suivis", "Intitulé de chaque projet du portefeuille"],
          apprenants: ["Apprenants concernés", "Nombre d'apprentis par projet"],
          scores:     ["Score moyen MIP-PPA", "Score global de chaque projet"],
        }[detailStat];
        // Tri par la grandeur affichée : la lecture est immédiate.
        const liste = [...formationsVisibles];
        if (detailStat === "apprenants") liste.sort((a, b) => (Number(b.apprenants) || 0) - (Number(a.apprenants) || 0));
        if (detailStat === "scores") liste.sort((a, b) => (scoreGlobal(referentiel, b.notes) ?? -1) - (scoreGlobal(referentiel, a.notes) ?? -1));
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(10,25,38,.55)" }}
            onClick={(e) => e.target === e.currentTarget && setDetailStat(null)}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-5 md:p-7 page-anim max-h-[92vh] overflow-y-auto">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-xl font-bold break-words">{entetes[0]}</h3>
                  <p className="text-sm text-stone-500 break-words">{entetes[1]}</p>
                </div>
                <button onClick={() => setDetailStat(null)} className="text-stone-400 hover:text-stone-700 shrink-0" title="Fermer"><Icone n="fermer" t={18} /></button>
              </div>

              {!liste.length ? (
                <p className="text-sm text-stone-500 mt-6">Aucun projet dans votre portefeuille pour le moment.</p>
              ) : (<>
                <div className="mt-5 border-t border-stone-100">
                  {liste.map((f, i) => (
                    <button key={f.id} onClick={() => { setDetailStat(null); setEvalId(f.id); setPage("evaluation"); }}
                      title="Ouvrir la fiche d'évaluation de ce projet"
                      className="w-full text-left flex items-center justify-between gap-3 py-3 px-2 rounded-lg border-b border-stone-50 hover:bg-stone-50">
                      <div className="min-w-0">
                        <div className="font-medium break-words">{f.titre}</div>
                        <div className="text-xs text-stone-500 break-words">
                          {f.entreprise}{f.region ? ` · ${f.region}` : ""}{f.statut ? ` · ${f.statut}` : ""}
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        {detailStat === "projets" && <span className="text-xs text-stone-400 font-mono">{i + 1}</span>}
                        {detailStat === "apprenants" && <span className="text-lg font-bold">{Number(f.apprenants) || 0}</span>}
                        {detailStat === "scores" && <Badge score={scoreGlobal(referentiel, f.notes)} />}
                      </div>
                    </button>
                  ))}
                </div>
                <div className="mt-4 pt-3 border-t border-stone-200 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="text-stone-500">{liste.length} projet{liste.length > 1 ? "s" : ""}</span>
                  {detailStat === "apprenants" && <span className="font-semibold">Total : {stats.apprenants} apprentis</span>}
                  {detailStat === "scores" && <span className="font-semibold">Moyenne pondérée : {fmtPct(stats.moy)}</span>}
                </div>
              </>)}
            </div>
          </div>
        );
      })()}

      {/* ---------- FENÊTRE : MODIFIER LA DIMENSION ---------- */}
      {dimEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(10,25,38,.55)" }}
          onClick={(e) => e.target === e.currentTarget && setDimEdit(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl p-5 md:p-7 page-anim max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <h3 className="text-xl font-bold">Modifier la dimension</h3>
              <button onClick={() => setDimEdit(null)} className="text-stone-400 hover:text-stone-700" title="Fermer"><Icone n="fermer" t={18} /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
              <label className="text-sm font-semibold text-stone-800">Code court
                <input value={dimEdit.id} onChange={(e) => setDimEdit({ ...dimEdit, id: e.target.value.toUpperCase().slice(0, 4) })}
                  className="mt-1.5 w-full border border-stone-300 rounded-xl px-3.5 py-2.5 font-normal outline-none focus:border-sky-600" />
              </label>
              <label className="text-sm font-semibold text-stone-800">Pondération (%)
                <input type="number" value={dimEdit.poids} onChange={(e) => setDimEdit({ ...dimEdit, poids: Number(e.target.value) })}
                  className="mt-1.5 w-full border border-stone-300 rounded-xl px-3.5 py-2.5 font-normal outline-none focus:border-sky-600" />
              </label>
            </div>
            <label className="block text-sm font-semibold text-stone-800 mt-4">Nom
              <input value={dimEdit.nom} onChange={(e) => setDimEdit({ ...dimEdit, nom: e.target.value })}
                className="mt-1.5 w-full border border-stone-300 rounded-xl px-3.5 py-2.5 font-normal outline-none focus:border-sky-600" />
            </label>
            <label className="block text-sm font-semibold text-stone-800 mt-4">Description
              <textarea rows={3} value={dimEdit.desc} onChange={(e) => setDimEdit({ ...dimEdit, desc: e.target.value })}
                className="mt-1.5 w-full border border-stone-300 rounded-xl px-3.5 py-2.5 font-normal outline-none focus:border-sky-600 resize-y" />
            </label>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setDimEdit(null)} className="border border-stone-300 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-stone-50">Annuler</button>
              <button onClick={() => {
                if (!dimEdit.id.trim() || !dimEdit.nom.trim()) { notif("Le code et le nom sont obligatoires"); return; }
                if (dimEdit.id !== dimEdit.ancienId && referentiel.some((x) => x.id === dimEdit.id)) { notif("Ce code est déjà utilisé par une autre dimension"); return; }
                setReferentiel((r) => r.map((x) => x.id === dimEdit.ancienId ? { ...x, id: dimEdit.id, nom: dimEdit.nom, poids: dimEdit.poids, desc: dimEdit.desc } : x));
                setDimEdit(null); notif("Dimension mise à jour");
              }} className="text-white px-6 py-2.5 rounded-xl text-sm font-semibold" style={{ background: C.vertFonce }}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- FENÊTRE : MODIFIER L'INDICATEUR ---------- */}
      {indEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(10,25,38,.55)" }}
          onClick={(e) => e.target === e.currentTarget && setIndEdit(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl p-5 md:p-7 page-anim max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <h3 className="text-xl font-bold">Modifier l'indicateur</h3>
              <button onClick={() => setIndEdit(null)} className="text-stone-400 hover:text-stone-700" title="Fermer"><Icone n="fermer" t={18} /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
              <label className="text-sm font-semibold text-stone-800">Code
                <input value={indEdit.id} onChange={(e) => setIndEdit({ ...indEdit, id: e.target.value.toUpperCase().slice(0, 5) })}
                  className="mt-1.5 w-full border border-stone-300 rounded-xl px-3.5 py-2.5 font-normal outline-none focus:border-sky-600" />
              </label>
              <label className="text-sm font-semibold text-stone-800">Phase de mesure
                <select value={indEdit.phase} onChange={(e) => setIndEdit({ ...indEdit, phase: e.target.value })}
                  className="mt-1.5 w-full border border-stone-300 rounded-xl px-3 py-2.5 font-normal bg-white outline-none focus:border-sky-600">
                  {phases.map((p) => <option key={p}>{p}</option>)}
                </select>
              </label>
            </div>
            <label className="block text-sm font-semibold text-stone-800 mt-4">Intitulé complet
              <textarea rows={3} value={indEdit.label} onChange={(e) => setIndEdit({ ...indEdit, label: e.target.value })}
                className="mt-1.5 w-full border border-stone-300 rounded-xl px-3.5 py-2.5 font-normal outline-none focus:border-sky-600 resize-y" />
            </label>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setIndEdit(null)} className="border border-stone-300 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-stone-50">Annuler</button>
              <button onClick={() => {
                if (!indEdit.id.trim() || !indEdit.label.trim()) { notif("Le code et l'intitulé sont obligatoires"); return; }
                if (indEdit.id !== indEdit.ancienId && referentiel.some((x) => x.indicateurs.some((i) => i.id === indEdit.id))) { notif("Ce code est déjà utilisé par un autre indicateur"); return; }
                setReferentiel((r) => r.map((x) => x.id !== indEdit.dimId ? x : { ...x, indicateurs: x.indicateurs.map((i) => i.id === indEdit.ancienId ? { id: indEdit.id, label: indEdit.label, phase: indEdit.phase } : i) }));
                // conserver les notes déjà saisies si le code change
                if (indEdit.id !== indEdit.ancienId) setFormations((fs) => fs.map((f) => { const n = { ...f.notes }; if (n[indEdit.ancienId] !== undefined) { n[indEdit.id] = n[indEdit.ancienId]; delete n[indEdit.ancienId]; } return { ...f, notes: n }; }));
                setIndEdit(null); notif("Indicateur mis à jour");
              }} className="text-white px-6 py-2.5 rounded-xl text-sm font-semibold" style={{ background: C.vertFonce }}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- FENÊTRE : NOTES, DATE & DOCUMENTS DE SUIVI ---------- */}
      {suiviEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(10,25,38,.55)" }}
          onClick={(e) => e.target === e.currentTarget && setSuiviEdit(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl p-5 md:p-7 page-anim max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold">Suivi {suiviEdit.jalon}</h3>
                <p className="text-sm text-stone-500 mt-0.5">{suiviEdit.titreF}</p>
              </div>
              <button onClick={() => setSuiviEdit(null)} className="text-stone-400 hover:text-stone-700" title="Fermer"><Icone n="fermer" t={18} /></button>
            </div>
            <label className="block text-sm font-semibold text-stone-800 mt-5">Date d'échéance
              <input type="date" value={suiviEdit.echeance}
                onChange={(e) => setSuiviEdit({ ...suiviEdit, echeance: e.target.value })}
                className="mt-1.5 w-full border border-stone-300 rounded-xl px-3.5 py-2.5 font-normal outline-none focus:border-sky-600" />
            </label>
            <label className="block text-sm font-semibold text-stone-800 mt-4">Observations terrain
              <textarea rows={4} value={suiviEdit.note} placeholder="Transferts observés, freins, plan d'action…"
                onChange={(e) => setSuiviEdit({ ...suiviEdit, note: e.target.value })}
                className="mt-1.5 w-full border border-stone-300 rounded-xl px-3.5 py-2.5 font-normal outline-none focus:border-sky-600 resize-y" />
            </label>
            <div className="mt-4">
              <div className="text-sm font-semibold text-stone-800">Documents de suivi <span className="font-normal text-stone-400">(rattachés à la fiche PDF — 2 Mo max par fichier)</span></div>
              <label className="mt-2 flex items-center justify-center gap-2 border-2 border-dashed border-stone-300 rounded-xl py-4 text-sm text-stone-500 cursor-pointer hover:bg-stone-50">
                <Icone n="trombone" t={16} /> Choisir des fichiers (photos, rapports…)
                <input type="file" multiple className="hidden" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                  onChange={(e) => {
                    Array.from(e.target.files || []).forEach((fich) => {
                      if (fich.size > 2 * 1024 * 1024) { notif(`« ${fich.name} » dépasse 2 Mo — ignoré`); return; }
                      const lecteur = new FileReader();
                      lecteur.onload = () => setSuiviEdit((se) => se && ({ ...se, docs: [...se.docs, { nom: fich.name, type: fich.type, taille: fich.size, date: new Date().toISOString().slice(0, 10), data: lecteur.result }] }));
                      lecteur.readAsDataURL(fich);
                    });
                    e.target.value = "";
                  }} />
              </label>
              {suiviEdit.docs.length > 0 && (
                <div className="mt-2 divide-y divide-stone-100 border border-stone-200 rounded-xl">
                  {suiviEdit.docs.map((d, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm">
                      <button onClick={() => setDocVu(d)} className="flex items-center gap-2 min-w-0 text-left hover:opacity-80" title="Ouvrir le document en grand">
                        {d.type.startsWith("image/")
                          ? <img src={d.data} alt="" className="w-9 h-9 object-cover rounded-lg border border-stone-200 shrink-0" />
                          : <span className="w-9 h-9 rounded-lg bg-stone-100 flex items-center justify-center shrink-0"><Icone n="fichier" t={17} className="text-stone-500" /></span>}
                        <div className="min-w-0">
                          <div className="break-words font-medium underline decoration-dotted underline-offset-2">{d.nom}</div>
                          <div className="text-xs text-stone-400">{(d.taille / 1024).toFixed(0)} Ko · ajouté le {d.date}</div>
                        </div>
                      </button>
                      <button onClick={() => setSuiviEdit((se) => ({ ...se, docs: se.docs.filter((_, j) => j !== i) }))} className="text-red-400 hover:text-red-600 shrink-0" ><Icone n="poubelle" t={16} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setSuiviEdit(null)} className="border border-stone-300 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-stone-50">Annuler</button>
              <button onClick={() => {
                setSuivis((ss) => ss.map((x) => x.id === suiviEdit.id ? { ...x, echeance: suiviEdit.echeance, note: suiviEdit.note, docs: suiviEdit.docs } : x));
                setSuiviEdit(null); notif("Suivi enregistré");
              }} className="text-white px-6 py-2.5 rounded-xl text-sm font-semibold" style={{ background: C.vertFonce }}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}
      <Toast msg={toast} />
    </div>
  );
}
