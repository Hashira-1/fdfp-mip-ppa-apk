import React, { useState, useMemo, useEffect } from "react";
import { jsPDF } from "jspdf";
import { createClient } from "@supabase/supabase-js";
import {
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";

/* ================================================================
   FDFP · MIP-PPA — Suivi des Projets Apprentissage dans l'agro-industrie
   Reconstruction fidèle de l'application (modèle : 5 dimensions,
   23 indicateurs, notes 0–4, suivi post-formation à 3/6/12 mois)
   ================================================================ */

// ----------------- RÉFÉRENTIEL PAR DÉFAUT -----------------------
const REFERENTIEL_DEFAUT = [
  {
    id: "P", nom: "Pertinence", poids: 20,
    desc: "Alignement de la formation aux besoins métiers et aux normes de l'agro-industrie.",
    indicateurs: [
      { id: "P1", phase: "À la conception", label: "Alignement des objectifs pédagogiques avec les besoins en compétences" },
      { id: "P2", phase: "À la conception", label: "Adéquation du contenu avec les référentiels métiers du secteur agro-industriel" },
      { id: "P3", phase: "À la conception", label: "Pertinence du profil des formateurs par rapport aux contenus dispensés" },
      { id: "P4", phase: "À la conception", label: "Conformité avec les normes HACCP et réglementations alimentaires applicables" },
    ],
  },
  {
    id: "EP", nom: "Efficacité pédagogique", poids: 25,
    desc: "Acquisition réelle des connaissances et gestes techniques.",
    indicateurs: [
      { id: "EP1", phase: "En fin de formation", label: "Taux d'acquisition des connaissances théoriques (test avant/après)" },
      { id: "EP2", phase: "En fin de formation", label: "Taux de maîtrise des gestes techniques évalués en situation de travail" },
      { id: "EP3", phase: "En fin de formation", label: "Taux d'assiduité et de participation active des apprenants" },
      { id: "EP4", phase: "En fin de formation", label: "Satisfaction globale des apprenants envers la formation" },
      { id: "EP5", phase: "En fin de formation", label: "Satisfaction des tuteurs en entreprise envers la qualité pédagogique" },
      { id: "EP6", phase: "En fin de formation", label: "Taux d'obtention de la certification ou attestation visée" },
    ],
  },
  {
    id: "EE", nom: "Efficience économique", poids: 20,
    desc: "Optimisation des coûts et utilisation du financement PPA.",
    indicateurs: [
      { id: "EE1", phase: "À la conception", label: "Coût de la formation par apprenant formé" },
      { id: "EE2", phase: "En fin de formation", label: "Coût de formation par compétence certifiée acquise" },
      { id: "EE3", phase: "En fin de formation", label: "Taux d'utilisation du financement PPA alloué" },
      { id: "EE4", phase: "En fin de formation", label: "Ratio coût-bénéfice estimé de la formation (méthode simplifiée)" },
    ],
  },
  {
    id: "IO", nom: "Impact organisationnel", poids: 25,
    desc: "Effets mesurables sur la qualité, la productivité et la sécurité.",
    indicateurs: [
      { id: "IO1", phase: "Suivi post-formation (3 / 6 / 12 mois)", label: "Évolution du taux de non-conformité qualité avant/après formation" },
      { id: "IO2", phase: "Suivi post-formation (3 / 6 / 12 mois)", label: "Variation du taux de productivité de la ligne ou du poste concerné" },
      { id: "IO3", phase: "Suivi post-formation (3 / 6 / 12 mois)", label: "Réduction du taux d'accidents ou d'incidents de sécurité alimentaire" },
      { id: "IO4", phase: "Suivi post-formation (3 / 6 / 12 mois)", label: "Transfert observable des compétences à 3 mois (évaluation managériale)" },
      { id: "IO5", phase: "Suivi post-formation (3 / 6 / 12 mois)", label: "Satisfaction du management sur l'amélioration des performances des formés" },
    ],
  },
  {
    id: "DC", nom: "Durabilité des compétences", poids: 10,
    desc: "Ancrage durable des compétences acquises (6 et 12 mois).",
    indicateurs: [
      { id: "DC1", phase: "Suivi post-formation (3 / 6 / 12 mois)", label: "Taux de rétention des apprenants dans l'entreprise à 6 mois" },
      { id: "DC2", phase: "Suivi post-formation (3 / 6 / 12 mois)", label: "Proportion des formés promus ou évolués dans les 12 mois" },
      { id: "DC3", phase: "Suivi post-formation (3 / 6 / 12 mois)", label: "Intégration des compétences dans les fiches de poste et procédures" },
      { id: "DC4", phase: "Suivi post-formation (3 / 6 / 12 mois)", label: "Continuité des pratiques apprises mesurée par observation à 6 mois" },
    ],
  },
];

// ----------------- DONNÉES DÉMO ---------------------------------
const FORMATIONS_DEMO = [
  {
    id: "f1", titre: "Maîtrise HACCP en ligne de conditionnement cacao",
    entreprise: "CocoaPro Côte d'Ivoire", operateur: "Cabinet AgroForm CI", beneficiaire: "Coopérative CAYAT", filiere: "Cacao-Café", region: "Abidjan",
    apprenants: 18, budget: 12500000, statut: "Terminée",
    notes: { P1: 4, P2: 3, P3: 4, P4: 4, EP1: 3, EP2: 3, EP3: 4, EP4: 4, EP5: 3, EP6: 4, EE1: 3, EE2: 3, EE3: 4, EE4: 3, IO1: 3, IO2: 3, IO3: 4, IO4: 3, IO5: 3, DC1: 3, DC2: 2, DC3: 3, DC4: 3 },
  },
  {
    id: "f2", titre: "Conduite de séchoir industriel — fruits tropicaux",
    entreprise: "Tropic'Or SARL", operateur: "Institut IFCA", beneficiaire: "Tropic'Or SARL", filiere: "Fruits & Légumes", region: "Yamoussoukro",
    apprenants: 9, budget: 6800000, statut: "Terminée",
    notes: { P1: 3, P2: 2, P3: 3, P4: 2, EP1: 2, EP2: 2, EP3: 3, EP4: 4, EP5: 2, EP6: 2, EE1: 2, EE2: 3, EE3: 2, EE4: 2, IO1: 2, IO2: 2, IO3: 3, IO4: 2, IO5: 2, DC1: 3, DC2: 2, DC3: 2, DC4: 2 },
  },
  {
    id: "f3", titre: "Sécurité alimentaire & traçabilité ISO 22000",
    entreprise: "LaitiAfrique", operateur: "Cabinet AgroForm CI", beneficiaire: "LaitiAfrique", filiere: "Lait & Dérivés", region: "San-Pédro",
    apprenants: 24, budget: 15200000, statut: "Terminée",
    notes: { P1: 4, P2: 4, P3: 4, P4: 4, EP1: 4, EP2: 3, EP3: 4, EP4: 4, EP5: 4, EP6: 4, EE1: 3, EE2: 3, EE3: 4, EE4: 3, IO1: 4, IO2: 3, IO3: 4, IO4: 4, IO5: 3, DC1: 3, DC2: 3, DC3: 4, DC4: 3 },
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
const SECTEURS_DEFAUT = ["Cacao-Café", "Fruits & Légumes", "Lait & Dérivés", "Anacarde", "Céréales", "Autre agro-industrie"];

// ----------------- MATRICE DES PERMISSIONS PAR RÔLE -------------
const PERMS = {
  "Administrateur lead":     { pages: ["dashboard", "formations", "evaluation", "suivi", "indicateurs", "alertes", "exports", "guide", "users"], evalDims: "toutes", creerFormation: true,  editerFormation: true,  supprimerFormation: true,  referentiel: true,  secteurs: true,  users: true,  exports: true,  suivisJalons: "tous", suiviValider: true,  portee: "tous" },
  "Administrateur FDFP":     { pages: ["dashboard", "formations", "evaluation", "suivi", "indicateurs", "alertes", "exports", "guide"],          evalDims: "toutes", creerFormation: true,  editerFormation: true,  supprimerFormation: false, referentiel: true,  secteurs: false, users: false, exports: true,  suivisJalons: "tous", suiviValider: true,  portee: "tous" },
  "Agent FDFP":              { pages: ["dashboard", "formations", "evaluation", "suivi", "indicateurs", "alertes", "exports", "guide"],          evalDims: "toutes", creerFormation: false, editerFormation: false, supprimerFormation: false, referentiel: false, secteurs: false, users: false, exports: true,  suivisJalons: "tous", suiviValider: true,  portee: "tous" },
  "Promoteur":               { pages: ["dashboard", "formations", "evaluation", "suivi", "exports", "guide"],                          evalDims: "aucune", creerFormation: false, editerFormation: false, supprimerFormation: false, referentiel: false, secteurs: false, users: false, exports: true,  suivisJalons: "tous", suiviValider: false, portee: "entreprise", lectureSeule: true },
  "Opérateur":               { pages: ["dashboard", "formations", "evaluation", "suivi", "guide"],                                     evalDims: "aucune", creerFormation: false, editerFormation: false, supprimerFormation: false, referentiel: false, secteurs: false, users: false, exports: false, suivisJalons: "tous", suiviValider: false, portee: "entreprise", lectureSeule: true },
  "En attente d'activation": { pages: ["guide"], evalDims: null, creerFormation: false, editerFormation: false, supprimerFormation: false, referentiel: false, secteurs: false, users: false, exports: false, suivisJalons: "aucun", suiviValider: false, portee: "aucune" },
};
const AUJOURDHUI = new Date("2026-07-13");


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
  formations: "Portefeuille des projets de formation financés par le FDFP",
  evaluation: "Noter un projet sur les 5 dimensions et 23 indicateurs",
  suivi: "Jalons M+3 / M+6 / M+12 : notes, documents, échéances",
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
  if (score >= 40) return { txt: "En développement", bg: C.dev, fg: "#fff" };
  return { txt: "Insuffisant", bg: C.insuffisant, fg: "#fff" };
}
const fmtPct = (v) => (v === null ? "—" : `${Math.round(v)} %`);
const fmtFCFA = (v) => `${Number(v).toLocaleString("fr-FR")} FCFA`;
const joursRestants = (dateStr) => Math.ceil((new Date(dateStr) - AUJOURDHUI) / 86400000);

function telecharger(nomFichier, contenu, type = "text/csv;charset=utf-8") {
  const blob = new Blob(["\ufeff" + contenu], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nomFichier; a.click();
  URL.revokeObjectURL(url);
}

// ----------------- LOGO FDFP (reproduction vectorielle) ---------
// Logo officiel du FDFP (image incorporée au code — aucun fichier externe requis)
const LOGO_FDFP = "data:image/jpeg;base64,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";

function LogoFDFP({ h = 32 }) {
  return (
    <div className="bg-white rounded-lg px-2 py-1 flex items-center justify-center shadow-sm" style={{ height: h + 10 }}>
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
function StatCard({ icone, titre, valeur, sous, teinte = "#e3eef7", fg = C.vert }) {
  return (
    <div className="carte-hover bg-white rounded-2xl border border-stone-200 p-5 flex items-start gap-4">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: teinte, color: fg }}>{icone}</div>
      <div>
        <div className="text-[11px] uppercase tracking-wide text-stone-500 font-medium">{titre}</div>
        <div className="text-3xl font-bold text-stone-900">{valeur}</div>
        {sous && <div className="text-xs text-stone-400 mt-0.5">{sous}</div>}
      </div>
    </div>
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
          <div className="text-sky-200 text-sm">Suivi des formations agro-industrielles</div>
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
  const projetVersRow = (f) => ({ id: f.id, titre: f.titre || "", promoteur: f.entreprise || f.promoteur || "", operateur: f.operateur || "", beneficiaire: f.beneficiaire || "", secteur: f.filiere || f.secteur || "", region: f.region || "", apprenants: Number(f.apprenants) || 0, budget: Number(f.budget) || 0, statut: f.statut || "Planifiée", notes: f.notes || {}, maj_le: new Date().toISOString() });
  const rowVersProjet = (r) => ({ id: r.id, titre: r.titre, entreprise: r.promoteur, operateur: r.operateur, beneficiaire: r.beneficiaire, filiere: r.secteur, region: r.region, apprenants: r.apprenants, budget: r.budget, statut: r.statut, notes: r.notes || {} });
  const suiviVersRow = (s) => ({ id: s.id, projet_id: s.formationId, jalon: s.jalon, echeance: s.echeance || null, statut: s.statut || "programmé", note: s.note || "", docs: s.docs || [], maj_le: new Date().toISOString() });
  const rowVersSuivi = (r) => ({ id: r.id, formationId: r.projet_id, jalon: r.jalon, echeance: r.echeance, statut: r.statut, note: r.note || "", docs: r.docs || [] });

  // Les setters gardent la meme signature qu'avant, mais propagent vers Supabase
  const setFormations = (fn) => setFormationsBrut((v) => {
    const n = typeof fn === "function" ? fn(v) : fn;
    if (sb) {
      const avantIds = new Set(v.map((x) => x.id)), apresIds = new Set(n.map((x) => x.id));
      n.forEach((f) => { const a = v.find((x) => x.id === f.id); if (!a || JSON.stringify(a) !== JSON.stringify(f)) sb.from("projets").upsert(projetVersRow(f)).then(({ error }) => error && console.warn(error.message)); });
      v.forEach((f) => { if (!apresIds.has(f.id)) sb.from("projets").delete().eq("id", f.id).then(() => {}); });
    }
    return n;
  });
  const setSuivis = (fn) => setSuivisBrut((v) => {
    const n = typeof fn === "function" ? fn(v) : fn;
    if (sb) {
      const apresIds = new Set(n.map((x) => x.id));
      n.forEach((s) => { const a = v.find((x) => x.id === s.id); if (!a || JSON.stringify(a) !== JSON.stringify(s)) sb.from("suivis").upsert(suiviVersRow(s)).then(({ error }) => error && console.warn(error.message)); });
      v.forEach((s) => { if (!apresIds.has(s.id)) sb.from("suivis").delete().eq("id", s.id).then(() => {}); });
    }
    return n;
  });
  const sauverConfig = (champ, valeur) => { if (sb) sb.from("configuration").update({ [champ]: valeur, maj_le: new Date().toISOString() }).eq("id", 1).then(({ error }) => error && console.warn(error.message)); };
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
    setSession({ id: utilisateur.id, email: utilisateur.email, nom: p?.nom || utilisateur.email, org: p?.org || "", role: r?.role || "En attente d'activation" });
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
  const [editionId, setEditionId] = useState(null);
  const [suiviEdit, setSuiviEdit] = useState(null); // fenêtre Notes & date & documents
  const [dimEdit, setDimEdit] = useState(null);     // fenêtre Modifier la dimension
  const [indEdit, setIndEdit] = useState(null);     // fenêtre Modifier l'indicateur
  const [docVu, setDocVu] = useState(null);          // visionneuse de document
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
        if (Array.isArray(cfg.secteurs) && cfg.secteurs.length) setSecteursBrut(cfg.secteurs);
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

  // Rechargement silencieux (declenche par le temps reel des autres utilisateurs)
  let rechargeEnCours = false;
  const rechargerLeger = async () => {
    if (!sb || rechargeEnCours) return; rechargeEnCours = true;
    setTimeout(async () => {
      try {
        const { data: cfg } = await sb.from("configuration").select("*").eq("id", 1).maybeSingle();
        if (cfg) { if (Array.isArray(cfg.referentiel) && cfg.referentiel.length) setReferentielBrut(cfg.referentiel); if (Array.isArray(cfg.secteurs)) setSecteursBrut(cfg.secteurs); if (Array.isArray(cfg.phases)) setPhasesBrut(cfg.phases); }
        const { data: projs } = await sb.from("projets").select("*").order("cree_le");
        const { data: suivs } = await sb.from("suivis").select("*");
        setFormationsBrut((projs || []).map(rowVersProjet));
        setSuivisBrut((suivs || []).map(rowVersSuivi));
      } catch (e) {}
      rechargeEnCours = false;
    }, 400);
  };
  const [nouvelle, setNouvelle] = useState({ titre: "", entreprise: "", operateur: "", beneficiaire: "", filiere: secteurs[0] || "Autre agro-industrie", region: "", apprenants: 10, budget: 5000000, statut: "Planifiée" });
  const [toast, setToast] = useState("");
  const notif = (m) => { setToast(m); setTimeout(() => setToast(""), 2500); };
  const [emailInvite, setEmailInvite] = useState("");
  const [roleInvite, setRoleInvite] = useState("Agent FDFP");
  const urlApp = (typeof window !== "undefined" && window.location && window.location.origin) ? window.location.origin : "https://fdfp-mip-ppa-apk.vercel.app";
  const envoyerInvitation = () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailInvite.trim())) { notif("Saisissez un email valide"); return; }
    const sujet = "Invitation - Plateforme FDFP MIP-PPA";
    const corps = [
      "Bonjour,",
      "",
      "Vous etes invite(e) a rejoindre la plateforme FDFP MIP-PPA (suivi des Projets Apprentissage dans l'agro-industrie).",
      "",
      "1. Rendez-vous sur : " + urlApp,
      "2. Cliquez sur \"Creer un compte\" et renseignez vos informations (nom, organisation, email, mot de passe).",
      "3. Confirmez votre email via le lien qui vous sera envoye.",
      "4. Un administrateur activera votre acces (role prevu : " + roleInvite + ").",
      "",
      "A bientot sur la plateforme.",
      "L'equipe FDFP",
    ].join("\n");
    const lien = "mailto:" + encodeURIComponent(emailInvite.trim())
      + "?subject=" + encodeURIComponent(sujet)
      + "&body=" + encodeURIComponent(corps);
    window.location.href = lien;
    notif("Ouverture de votre messagerie…");
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
      if (!map[f.filiere]) map[f.filiere] = []; map[f.filiere].push(s);
    });
    return Object.entries(map).map(([fil, arr]) => ({ filiere: fil, score: arr.reduce((a, b) => a + b, 0) / arr.length }));
  }, [formationsVisibles, referentiel]);

  // ---------- Actions ----------
  const noter = (fid, indId, note) => {
    setFormations((fs) => fs.map((f) => f.id === fid ? { ...f, notes: { ...f.notes, [indId]: f.notes[indId] === note ? undefined : note } } : f));
  };
  const ajouterFormation = () => {
    if (!nouvelle.titre.trim() || !nouvelle.entreprise.trim()) { notif("Renseignez au minimum l'intitulé et le promoteur"); return; }
    if (editionId) {
      setFormations((fs) => fs.map((f) => f.id === editionId ? { ...f, ...nouvelle } : f));
      setEditionId(null); setFormOuvert(false);
      setNouvelle({ titre: "", entreprise: "", operateur: "", beneficiaire: "", filiere: secteurs[0] || "Autre agro-industrie", region: "", apprenants: 10, budget: 5000000, statut: "Planifiée" });
      notif("Formation mise à jour"); return;
    }
    const id = "f" + Date.now();
    setFormations((fs) => [...fs, { id, ...nouvelle, notes: {} }]);
    ["M+3", "M+6", "M+12"].forEach((j, i) => {
      const d = new Date(AUJOURDHUI); d.setMonth(d.getMonth() + [3, 6, 12][i]);
      setSuivis((ss) => [...ss, { id: "s" + Date.now() + i, formationId: id, jalon: j, echeance: d.toISOString().slice(0, 10), statut: "programmé", note: "", docs: [] }]);
    });
    setFormOuvert(false);
    setNouvelle({ titre: "", entreprise: "", operateur: "", beneficiaire: "", filiere: secteurs[0] || "Autre agro-industrie", region: "", apprenants: 10, budget: 5000000, statut: "Planifiée" });
    notif("Formation créée — 3 suivis (M+3/M+6/M+12) planifiés");
  };
  const editerFormation = (f) => {
    setNouvelle({ titre: f.titre, entreprise: f.entreprise, operateur: f.operateur || "", beneficiaire: f.beneficiaire || "", filiere: f.filiere, region: f.region, apprenants: f.apprenants, budget: f.budget, statut: f.statut });
    setEditionId(f.id); setFormOuvert(true); setPage("formations");
  };

  const exportExcel = () => {
    const entetes = ["Formation", "Entreprise", "Secteur", "Région", "Apprenants", "Budget FCFA", "Statut",
      ...referentiel.map((d) => `${d.nom} (%)`), "Score global (%)", "Niveau"];
    const lignes = formationsVisibles.map((f) => {
      const g = scoreGlobal(referentiel, f.notes);
      return [f.titre, f.entreprise, f.filiere, f.region, f.apprenants, f.budget, f.statut,
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
      "œ":"oe","Œ":"OE","æ":"ae","Æ":"AE"
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
    doc.text(nettoyerPdf(`${f.apprenants} apprenants  -  Budget : ${Number(f.budget).toLocaleString("fr-FR")} FCFA  -  Statut : ${f.statut}`), M, y); y += 9;

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
      ["evaluation", "clipboard", "Évaluation"], ["suivi", "calendrier", "Suivi post-formation"],
      ["indicateurs", "graphique", "Indicateurs"], ["alertes", "cloche", "Alertes"], ["exports", "telecharger", "Exports"],
    ].filter(([id]) => P.pages.includes(id)) },
    { section: "Aide", items: [["guide", "livre", "Guide d'utilisation"]] },
    ...(P.users ? [{ section: "Administration", items: [["users", "utilisateurs", "Utilisateurs & rôles"]] }] : []),
  ];
  const titres = {
    dashboard: ["Tableau de bord MIP-PPA", "Vision consolidée des Projets de formation de type Apprentissage (Enploi-qualification) dans l'agro-industrie"],
    formations: ["Projets", "Portefeuille des projets de formation financés par le FDFP"],
    evaluation: ["Évaluation", fEval ? fEval.titre : "Sélectionnez une formation à évaluer"],
    suivi: ["Suivi post-formation", "Évaluations à 3, 6 et 12 mois — impact et durabilité"],
    indicateurs: ["Référentiel des indicateurs", "Modèle MIP-PPA — dimensions, pondérations, indicateurs"],
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
    <div className="min-h-screen flex bg-stone-100 text-stone-900" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <style>{`
        @keyframes pageIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        @keyframes toastIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        .page-anim { animation: pageIn .32s ease-out both; }
        .toast-anim { animation: toastIn .25s ease-out both; }
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
      <aside className="w-64 shrink-0 flex flex-col text-stone-300 h-screen sticky top-0 overflow-hidden" style={{ background: C.sidebar }}>
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="bg-white rounded-xl px-2 py-1.5 flex items-center justify-center shrink-0">
            <LogoFDFP h={30} />
          </div>
          <div>
            <div className="text-white font-bold leading-tight">MIP-PPA</div>
            <div className="text-xs text-stone-400">Suivi des formations agro-industrielles</div>
          </div>
        </div>
        <nav className="flex-1 px-3 space-y-5 pb-4">
          {NAV.map((g) => (
            <div key={g.section}>
              <div className="text-[11px] uppercase tracking-wider text-stone-500 px-3 mb-1.5">{g.section}</div>
              {g.items.map(([id, ic, lbl]) => (
                <button key={id} onClick={() => setPage(id)} title={DESCR_NAV[id] || lbl}
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
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="bg-white border-b border-stone-200 px-6 py-3.5 flex items-center justify-between gap-4 sticky top-0 z-10">
          <div className="min-w-0">
            <h1 className="text-lg font-bold truncate">{titres[page][0]}</h1>
            <div className="text-xs text-stone-500 truncate">{titres[page][1]}</div>
          </div>
          <div className="flex items-center gap-5 shrink-0">
            <button onClick={() => setPage("guide")} className="text-sm text-stone-600 hover:text-stone-900 flex items-center gap-1.5" title="Ouvrir le guide d'utilisation"><Icone n="livre" t={16} /> Guide</button>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full text-white flex items-center justify-center text-sm font-semibold" style={{ background: C.vert }}>{(session?.nom || "?").split(" ").map((m) => m[0]).slice(0, 2).join("").toUpperCase()}</div>
              <div className="hidden md:block">
                <div className="text-sm font-semibold leading-tight">{session?.nom}</div>
                <div className="text-xs text-stone-500">{roleActif}</div>
              </div>
            </div>
          </div>
        </header>

        <main key={page + (evalId || "")} className="page-anim flex-1 p-6 space-y-5 max-w-5xl w-full mx-auto">
          {P.lectureSeule && <div className="rounded-xl px-4 py-2.5 text-sm flex items-center gap-2" style={{ background: "#e0f0fb", color: "#0d3b57" }}><Icone n="oeil" t={16} /> Mode consultation — votre profil ({roleActif}) donne un accès en lecture seule.</div>}

          {/* =========== TABLEAU DE BORD =========== */}
          {page === "dashboard" && (<>
            <section className="rounded-3xl p-8 text-white" style={{ background: "linear-gradient(120deg,#0e3c60 0%,#1d6fa8 100%)" }}>
              <span className="text-xs font-semibold px-3 py-1 rounded-full text-stone-900" style={{ background: C.gold }}>FDFP · Côte d'Ivoire</span>
              <h2 className="text-4xl font-bold mt-4 leading-tight">Mesurer la vraie valeur<br />des Projets Apprentissage</h2>
              <p className="mt-3 text-sky-100 max-w-2xl">
                Le modèle MIP-PPA évalue chaque projet de formation de type apprentissage sur {referentiel.length} dimensions et {referentiel.reduce((a, d) => a + d.indicateurs.length, 0)} indicateurs,
                de la conception jusqu'à 12 mois après — pour des décisions éclairées au service de l'agro-industrie ivoirienne.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button onClick={() => setPage("formations")} className="bg-white text-stone-900 font-semibold px-5 py-2.5 rounded-xl hover:bg-stone-100">Évaluer une formation →</button>
                <button onClick={() => setPage("formations")} className="border border-sky-300/50 text-white px-5 py-2.5 rounded-xl hover:bg-white/10">Voir le portefeuille</button>
              </div>
            </section>

            <section className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icone={<Icone n="cap" t={20} />} titre="Formations suivies" valeur={stats.nb} />
              <StatCard icone={<Icone n="usine" t={20} />} titre="Apprenants concernés" valeur={stats.apprenants} teinte="#fdf0da" fg="#b07515" />
              <StatCard icone={<Icone n="cible" t={20} />} titre="Score moyen MIP" valeur={fmtPct(stats.moy)} sous="Moyenne pondérée du portefeuille" teinte="#dcebf7" fg={C.vert} />
              <StatCard icone={<Icone n="alerte" t={20} />} titre="Alertes actives" valeur={stats.alertes} sous={stats.alertes ? "À traiter en priorité" : "Rien à signaler"} teinte="#fde8e8" fg={C.insuffisant} />
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
              <ResponsiveContainer width="100%" height={60 * filiereData.length + 40}>
                <BarChart data={filiereData} layout="vertical" margin={{ left: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="filiere" width={100} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => `${Math.round(v)} %`} />
                  <Bar dataKey="score" fill={C.vert} radius={[0, 6, 6, 0]} barSize={34} />
                </BarChart>
              </ResponsiveContainer>
            </section>

            <section className="bg-white rounded-2xl border border-stone-200 p-5">
              <div className="flex items-center justify-between">
                <div><h3 className="font-bold">Projets de formation de type apprentissage (emploi-qualifcation) récents</h3><p className="text-sm text-stone-500">Cliquez pour évaluer ou consulter.</p></div>
                <button onClick={() => setPage("Projet de formation de type apprentissage")} className="text-sm font-semibold hover:underline" style={{ color: C.vert }}>Tout voir →</button>
              </div>
              <div className="divide-y divide-stone-100 mt-2">
                {formationsVisibles.slice(-4).map((f) => (
                  <button key={f.id} onClick={() => { setEvalId(f.id); setPage("evaluation"); }}
                    className="w-full flex items-center justify-between gap-4 py-3.5 text-left hover:bg-stone-50 px-2 rounded-lg">
                    <div>
                      <div className="font-semibold">{f.titre}</div>
                      <div className="text-sm text-stone-500">{f.entreprise} · {f.filiere} · {f.apprenants} apprenants</div>
                    </div>
                    <Badge score={scoreGlobal(referentiel, f.notes)} />
                  </button>
                ))}
              </div>
            </section>

            <section className="bg-white rounded-2xl border border-stone-200 p-5">
              <h3 className="font-bold flex items-center gap-2"><Icone n="tendance" t={18} /> Niveaux de performance</h3>
              <p className="text-sm text-stone-500 mb-3">Lecture du score global MIP-PPA.</p>
              <div className="flex flex-wrap gap-2">
                {[["Insuffisant (0–40 %)", C.insuffisant], ["En développement (40–60 %)", C.dev], ["Satisfaisant (60–80 %)", C.satisfaisant], ["Excellent (80–100 %)", C.excellent]].map(([t, c]) => (
                  <span key={t} className="text-xs font-semibold text-white px-3 py-1.5 rounded-full" style={{ background: c }}>{t}</span>
                ))}
              </div>
              <p className="text-xs text-stone-500 mt-3">
                Pondérations : {referentiel.map((d) => `${d.nom} ${d.poids} %`).join(" · ")}.
              </p>
            </section>
          </>)}

          {/* =========== FORMATIONS =========== */}
          {page === "Projets de formation de type apprentissage" && (<>
            <div className="flex flex-wrap items-center gap-3">
              <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher entreprise, formation, secteur…"
                className="flex-1 min-w-[240px] bg-white border border-stone-200 rounded-full px-5 py-2.5 text-sm outline-none focus:border-stone-400" />
              {P.exports && <button onClick={exportExcel} className="bg-white border border-stone-200 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-stone-50" title="Télécharger le tableau Excel consolidé"><Icone n="telecharger" t={15} /> Exporter Excel</button>}
              <button onClick={() => { setFormations(FORMATIONS_DEMO); setSuivis(SUIVIS_DEMO); notif("Données démo restaurées"); }}
                className="text-sm text-stone-600 hover:text-stone-900" title="Restaurer les 3 formations de démonstration"><Icone n="rotation" t={14} /> Données démo</button>
            </div>
            {P.creerFormation && <button onClick={() => { setEditionId(null); setNouvelle({ titre: "", entreprise: "", operateur: "", beneficiaire: "", filiere: secteurs[0] || "Autre agro-industrie", region: "", apprenants: 10, budget: 5000000, statut: "Planifiée" }); setFormOuvert(!formOuvert); }}
              className="text-white font-semibold px-5 py-2.5 rounded-xl text-sm" style={{ background: C.vertFonce }}>
              + Nouveau projet
            </button>}

            {formOuvert && (
              <div className="bg-white rounded-2xl border border-stone-200 p-5 grid md:grid-cols-2 gap-4">
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
                  <select value={nouvelle.filiere} onChange={(e) => setNouvelle({ ...nouvelle, filiere: e.target.value })} className="mt-1 w-full border border-stone-300 rounded-lg px-3 py-2 bg-white">
                    {secteurs.map((f) => <option key={f}>{f}</option>)}
                  </select>
                </label>
                <label className="text-sm">Région
                  <input value={nouvelle.region} onChange={(e) => setNouvelle({ ...nouvelle, region: e.target.value })} className="mt-1 w-full border border-stone-300 rounded-lg px-3 py-2" placeholder="Ex. Bouaké" />
                </label>
                <label className="text-sm">Nombre d'apprenants
                  <input type="number" value={nouvelle.apprenants} onChange={(e) => setNouvelle({ ...nouvelle, apprenants: e.target.value })} className="mt-1 w-full border border-stone-300 rounded-lg px-3 py-2" />
                </label>
                <label className="text-sm">Budget (FCFA)
                  <input type="number" value={nouvelle.budget} onChange={(e) => setNouvelle({ ...nouvelle, budget: e.target.value })} className="mt-1 w-full border border-stone-300 rounded-lg px-3 py-2" />
                </label>
                <label className="text-sm">Statut
                  <select value={nouvelle.statut} onChange={(e) => setNouvelle({ ...nouvelle, statut: e.target.value })} className="mt-1 w-full border border-stone-300 rounded-lg px-3 py-2 bg-white">
                    {["Planifiée", "En cours", "Terminée"].map((s) => <option key={s}>{s}</option>)}
                  </select>
                </label>
                <div className="md:col-span-2 flex gap-3">
                  <button onClick={ajouterFormation} className="text-white font-semibold px-5 py-2 rounded-xl text-sm" style={{ background: C.vertFonce }}>{editionId ? "Enregistrer les modifications" : "Créer la formation"}</button>
                  <button onClick={() => setFormOuvert(false)} className="text-sm text-stone-500">Annuler</button>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
              <div className="grid grid-cols-12 px-5 py-3 text-sm font-semibold text-stone-600 border-b border-stone-100">
                <div className="col-span-6">Projet de formation de type apprentissage</div><div className="col-span-2">Secteur</div><div className="col-span-2">Score MIP</div><div className="col-span-2 text-right">Actions</div>
              </div>
              {formationsVisibles.filter((f) => (f.titre + f.entreprise + f.filiere).toLowerCase().includes(recherche.toLowerCase())).map((f) => (
                <div key={f.id} className="grid grid-cols-12 items-center px-5 py-4 border-b border-stone-50 hover:bg-stone-50">
                  <div className="col-span-6 pr-3">
                    <div className="font-semibold">{f.titre}</div>
                    <div className="text-sm text-stone-500">Promoteur : {f.entreprise}{f.operateur ? ` · Opérateur : ${f.operateur}` : ""} · {f.region}</div>
                    {f.beneficiaire && <div className="text-xs text-stone-400">Bénéficiaire : {f.beneficiaire}</div>}
                  </div>
                  <div className="col-span-2 text-sm">{f.filiere}</div>
                  <div className="col-span-2"><Badge score={scoreGlobal(referentiel, f.notes)} /></div>
                  <div className="col-span-2 flex justify-end items-center gap-3">
                    <button onClick={() => { setEvalId(f.id); setPage("evaluation"); }} className="text-sm font-medium hover:underline" style={{ color: C.vert }}>Évaluer</button>
                    {P.editerFormation && <button title="Modifier la formation" onClick={() => editerFormation(f)} className="text-stone-500 hover:text-stone-800"><Icone n="crayon" t={16} /></button>}
                    {P.supprimerFormation && <button onClick={() => { if (window.confirm(`Supprimer « ${f.titre} » et ses suivis ?`)) { setFormations((fs) => fs.filter((x) => x.id !== f.id)); setSuivis((ss) => ss.filter((x) => x.formationId !== f.id)); } }} className="text-red-500 hover:text-red-700" ><Icone n="poubelle" t={16} /></button>}
                  </div>
                </div>
              ))}
            </div>
          </>)}

          {/* =========== ÉVALUATION MIP =========== */}
          {page === "evaluation" && (!fEval ? (
            <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center">
              <p className="text-stone-600 mb-4">Sélectionnez le Projet de formation de type apprentissage à évaluer :</p>
              <div className="flex flex-col gap-2 max-w-xl mx-auto">
                {formationsVisibles.map((f) => (
                  <button key={f.id} onClick={() => setEvalId(f.id)} className="flex items-center justify-between gap-3 border border-stone-200 rounded-xl px-4 py-3 hover:bg-stone-50 text-left">
                    <span className="font-medium">{f.titre}</span><Badge score={scoreGlobal(referentiel, f.notes)} />
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
                <div className="text-sm text-sky-100 mt-1">{fEval.filiere} · {fEval.region} · {fEval.apprenants} apprenants</div>
                {(fEval.operateur || fEval.beneficiaire) && <div className="text-xs text-sky-200 mt-1">{[fEval.operateur ? `Opérateur : ${fEval.operateur}` : "", fEval.beneficiaire ? `Bénéficiaire : ${fEval.beneficiaire}` : ""].filter(Boolean).join(" · ")}</div>}
              </div>
              <div className="text-right">
                <div className="text-xs uppercase tracking-wider text-sky-200">Score global MIP-PPA</div>
                <div className="text-5xl font-bold">{fmtPct(scoreGlobal(referentiel, fEval.notes))}</div>
                <div className="mt-1"><Badge score={scoreGlobal(referentiel, fEval.notes)} /></div>
              </div>
            </section>

            <section className="grid md:grid-cols-2 gap-4">
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
                      <div className="text-sm text-stone-500 mt-0.5">{s.f.entreprise} · {s.f.filiere} · échéance {s.echeance}{s.statut === "programmé" ? ` · ${joursRestants(s.echeance) < 0 ? Math.abs(joursRestants(s.echeance)) + " j de retard" : "dans " + joursRestants(s.echeance) + " j"}` : ""}</div>
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
              <section className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                  <button onClick={() => setReferentiel((r) => [...r, { id: "D" + (r.length + 1), nom: "Nouvelle dimension", poids: 0, desc: "Description à compléter.", indicateurs: [] }])}
                    className="text-white text-sm font-semibold px-4 py-2 rounded-xl" style={{ background: C.vertFonce }}>+ Nouvelle dimension</button>
                  <button onClick={() => { setReferentiel(REFERENTIEL_DEFAUT); notif("Référentiel par défaut restauré"); }}
                    className="bg-white border border-stone-200 text-sm px-4 py-2 rounded-xl hover:bg-stone-50" title="Revenir aux 5 dimensions et 23 indicateurs d'origine"><Icone n="rotation" t={14} /> Restaurer le référentiel par défaut</button>
                </div>
              )}
              <div className="flex flex-wrap gap-2 mt-4">
                {[["Insuffisant (0–40 %)", C.insuffisant], ["En développement (40–60 %)", C.dev], ["Satisfaisant (60–80 %)", C.satisfaisant], ["Excellent (80–100 %)", C.excellent]].map(([t, c]) => (
                  <span key={t} className="text-xs font-semibold text-white px-3 py-1.5 rounded-full" style={{ background: c }}>{t}</span>
                ))}
              </div>
            </section>

            {P.secteurs && (
              <section className="bg-white rounded-2xl border border-stone-200 p-5">
                <h3 className="font-bold">Secteurs</h3>
                <p className="text-sm text-stone-500 mb-3">Liste des secteurs proposés à la création d'une formation — gérée par l'administrateur lead.</p>
                <div className="flex flex-wrap gap-2">
                  {secteurs.map((s, i) => (
                    <span key={i} className="flex items-center gap-1.5 bg-stone-100 rounded-full pl-3 pr-1.5 py-1 text-sm">
                      <input value={s} onChange={(e) => setSecteurs((ss) => ss.map((x, j) => j === i ? e.target.value : x))}
                        className="bg-transparent outline-none" style={{ width: Math.max(6, s.length) + "ch" }} />
                      <button onClick={() => { if (window.confirm(`Supprimer le secteur « ${s} » ? (les formations existantes gardent leur libellé)`)) setSecteurs((ss) => ss.filter((_, j) => j !== i)); }}
                        className="text-stone-400 hover:text-red-600 w-5 h-5 rounded-full flex items-center justify-center" title="Supprimer ce secteur"><Icone n="fermer" t={12} /></button>
                    </span>
                  ))}
                  <button onClick={() => setSecteurs((ss) => [...ss, "Nouveau secteur"])}
                    className="text-sm border border-dashed border-stone-300 rounded-full px-3 py-1 text-stone-500 hover:bg-stone-50">+ Ajouter</button>
                </div>
                <h3 className="font-bold mt-6">Phases de mesure</h3>
                <p className="text-sm text-stone-500 mb-3">Moments où chaque indicateur est renseigné (proposés dans la fenêtre d'un indicateur).</p>
                <div className="flex flex-wrap gap-2">
                  {phases.map((s, i) => (
                    <span key={i} className="flex items-center gap-1.5 bg-stone-100 rounded-full pl-3 pr-1.5 py-1 text-sm">
                      <input value={s} onChange={(e) => setPhases((ss) => ss.map((x, j) => j === i ? e.target.value : x))}
                        className="bg-transparent outline-none" style={{ width: Math.max(10, s.length) + "ch" }} />
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
                    <button onClick={() => setReferentiel((r) => r.map((x) => x.id === d.id ? { ...x, indicateurs: [...x.indicateurs, { id: d.id + (x.indicateurs.length + 1), phase: "À définir", label: "Nouvel indicateur — à définir" }] } : x))}
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
                      <div className="text-sm text-stone-500">{f.entreprise} · {f.filiere}</div>
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
              ["3. Gérer les projets", "Créez une formation (intitulé, entreprise bénéficiaire, secteur, région, apprenants, budget FCFA), suivez son statut (Planifiée / En cours / Terminée), puis cliquez dessus pour ouvrir sa fiche d'évaluation."],
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
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-bold">Comptes ({comptes.length})</h3>
                <button onClick={chargerComptes} title="Recharger la liste depuis la base"
                  className="text-sm border border-stone-200 px-3 py-1.5 rounded-lg hover:bg-stone-50 flex items-center gap-1.5"><Icone n="rotation" t={14} /> Actualiser</button>
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
                        <div className="font-semibold">{u.nom} {session?.id === u.id && <span className="text-xs font-normal text-stone-400">(vous)</span>}</div>
                        <div className="text-sm text-stone-500">{u.email} · {u.org}</div>
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
              <p className="text-sm text-stone-600 mb-4">Saisissez l'email d'un partenaire : un message d'invitation pré-rempli (avec le lien de la plateforme et les instructions) s'ouvrira dans votre messagerie. Après inscription, il apparaîtra ci-dessus en statut « En attente », prêt à recevoir son rôle.</p>
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
                  <Icone n="telecharger" t={15} /> Envoyer l'invitation
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
              <div className="font-semibold truncate">{docVu.nom}</div>
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

      {/* ---------- FENÊTRE : MODIFIER LA DIMENSION ---------- */}
      {dimEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(10,25,38,.55)" }}
          onClick={(e) => e.target === e.currentTarget && setDimEdit(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl p-7 page-anim">
            <div className="flex items-start justify-between">
              <h3 className="text-xl font-bold">Modifier la dimension</h3>
              <button onClick={() => setDimEdit(null)} className="text-stone-400 hover:text-stone-700" title="Fermer"><Icone n="fermer" t={18} /></button>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-5">
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
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl p-7 page-anim">
            <div className="flex items-start justify-between">
              <h3 className="text-xl font-bold">Modifier l'indicateur</h3>
              <button onClick={() => setIndEdit(null)} className="text-stone-400 hover:text-stone-700" title="Fermer"><Icone n="fermer" t={18} /></button>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-5">
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
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl p-7 page-anim max-h-[90vh] overflow-y-auto">
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
                          <div className="truncate font-medium underline decoration-dotted underline-offset-2">{d.nom}</div>
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
