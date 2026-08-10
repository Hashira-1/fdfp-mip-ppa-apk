import React, { useState, useMemo, useEffect, useRef } from "react";
/* jsPDF n'est plus importé au chargement : il ne sert qu'au moment où l'on
   génère une fiche. Le laisser en import statique le faisait télécharger par
   tout le monde, y compris sur l'écran de connexion. Chargé à la demande dans
   « fichePDF », comme le sont déjà ExcelJS, mammoth et pdf-lib. */
import { createClient } from "@supabase/supabase-js";
import {
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
/* Le modèle de calcul vit dans son propre fichier — à plat, sans sous-dossier —
   pour être testable sans démarrer React (voir « calculs.test.js », npm test).
   L'application et les tests partagent ainsi exactement le même code. */
import {
  COULEURS_NIVEAU, scoreDimension, scoreGlobal, couvertureModele, margeSeuil,
  indicateursNonNotes, niveau, JALONS, instantane, ajouterInstantane, trajectoire,
  estDateISO, fmtDateFr, dureeLisible, echeancesSuivi, anomaliesCalendrier,
  JALONS_SUIVI,
} from "./calculs.js";
/* Géographie des zones de couverture, dans un fichier à part pour la même
   raison que « calculs.js » : ce sont des données engendrées (108 contours
   départementaux), pas du code d'interface. Voir l'en-tête du fichier pour
   les sources et la méthode de simplification. */
import { CARTE_LARGEUR, CARTE_HAUTEUR, DEPARTEMENTS } from "./geo-civ.js";
/* Le vocabulaire métier — référentiel, nomenclature sectorielle, zones et
   localités, rôles et permissions — vit dans son propre fichier. Ce sont des
   données et des fonctions pures ; les garder ici obligeait à traverser
   l'interface pour relire ce que la plateforme évalue. */
import {
  REFERENTIEL_DEFAUT, ROLES, SECTEURS_DEFAUT, normaliserSecteurs, grandSecteurDe,
  libelleSecteur, listeSecteursPlate, nomLibre, ANTENNES_FDFP, IMPLANTATIONS,
  normaliserRegion, LOCALITES_PAR_ZONE, DEP_PAR_LOCALITE, localitesDe,
  localiteParDefaut, normaliserLocalite, PROJET_VIERGE, PERMS, STATUTS_PROJET,
  normaliserStatut, memeNom,
} from "./referentiel.js";
/* « nettoyerPdf » est la seule partie purement calculatoire de la génération
   de fiches — et la plus délicate. Isolée pour être testée (pdf.test.js). */
import { nettoyerPdf } from "./pdf.js";
/* Les tracés — 95 Ko de contours et de routes — ne sont PAS importés ici :
   ils ne servent qu'à dessiner, sur deux écrans. Voir « useTraces ». */

/* ================================================================
   FDFP · MIP-PPA — Suivi des projets de formation de type apprentissage dans l'industrie agroalimentaire
   Reconstruction fidèle de l'application (modèle : 5 dimensions,
   23 indicateurs, notes 0–4, suivi post-formation à 3/6/12 mois)
   ================================================================ */

// ----------------- RÉFÉRENTIEL PAR DÉFAUT -----------------------

// ----------------- DONNÉES DÉMO ---------------------------------
const FORMATIONS_DEMO = [
  {
    id: "f1", titre: "Maîtrise HACCP en ligne de conditionnement cacao",
    entreprise: "SACO", operateur: "A.C.A", beneficiaire: "SCINPA", secteurGrand: "Secteur secondaire", filiere: "Transformation du cacao et du café", domaine: "Fèves et masse de cacao", region: "Siège Abidjan", localite: "Abidjan",
    apprenants: 18, budget: 12500000, statut: "Terminé",
    /* Dates cohérentes avec SUIVIS_DEMO : la date de fin est l'origine des
       trois jalons, M+3 tombe donc bien trois mois après elle. */
    dateDebut: "2025-11-03", dateFin: "2026-02-20",
    notes: { P1: 4, P2: 3, P3: 4, P4: 4, EP1: 3, EP2: 3, EP3: 4, EP4: 4, EP5: 3, EP6: 4, IE1: 3, IE2: 3, IE3: 4, IE4: 3, IO1: 3, IO2: 3, IO3: 4, IO4: 3, IO5: 3, DC1: 3, DC2: 2, DC3: 3, DC4: 3 },
  },
  {
    id: "f2", titre: "Conduite de séchoir industriel (fruits tropicaux)",
    entreprise: "AGROCI", operateur: "Emergence", beneficiaire: "AGROCI", secteurGrand: "Secteur secondaire", filiere: "Transformation des fruits et légumes", domaine: "Jus et concentrés", region: "Antenne Yamoussoukro", localite: "Toumodi",
    apprenants: 9, budget: 6800000, statut: "Terminé",
    dateDebut: "2026-01-12", dateFin: "2026-04-17",
    notes: { P1: 3, P2: 2, P3: 3, P4: 2, EP1: 2, EP2: 2, EP3: 3, EP4: 4, EP5: 2, EP6: 2, IE1: 2, IE2: 3, IE3: 2, IE4: 2, IO1: 2, IO2: 2, IO3: 3, IO4: 2, IO5: 2, DC1: 3, DC2: 2, DC3: 2, DC4: 2 },
  },
  {
    id: "f3", titre: "Sécurité alimentaire & traçabilité ISO 22000",
    entreprise: "FrieslandCampina", operateur: "Domny", beneficiaire: "FrieslandCampina", secteurGrand: "Secteur secondaire", filiere: "Industrie laitière", domaine: "Lait et yaourts", region: "Antenne San-Pédro", localite: "San-Pédro",
    apprenants: 24, budget: 15200000, statut: "Terminé",
    dateDebut: "2026-02-09", dateFin: "2026-06-02",
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
/* Client unique pour tout l'onglet. Sans cette mise en cache, le rechargement
   à chaud du serveur de développement ré-exécute ce module à chaque
   modification et crée un client de plus à chaque fois. Les clients partagent
   la même clé de stockage et se disputent le rafraîchissement du jeton :
   l'un peut invalider celui de l'autre, ce qui déconnecte l'utilisateur en
   pleine session. C'est ce que signalait l'avertissement « Multiple
   GoTrueClient instances detected in the same browser context ».
   Sans effet en production, où le module n'est évalué qu'une fois. */
const sb = globalThis.__mipPpaSupabase || (globalThis.__mipPpaSupabase = creerClientSupabase());

// ----------------- COMPTES & AUTHENTIFICATION ------

/* Traduction des erreurs de Supabase Auth. Une seule table, pour tous les
   écrans — c'est la leçon de la panne qu'elle corrige.
   ---------------------------------------------------------------------------
   Chaque écran traduisait de son côté, ou pas du tout, et l'un d'eux cherchait
   le mot « same » là où Supabase écrit « New password should be different from
   the old password ». Le test ne matchait donc jamais, et l'anglais brut
   s'affichait dans un formulaire qui demande deux fois le même mot de passe.

   Ce n'était pas qu'un défaut de langue : le message était activement
   TROMPEUR. Lu au-dessus de deux champs identiques, « should be different »
   se comprend comme « les deux saisies doivent différer ». L'utilisateur en
   saisissait donc deux différentes et tombait sur « Les deux saisies
   diffèrent » — deux erreurs qui se contredisent, sans issue apparente.

   D'où la formulation retenue plus bas : elle dit explicitement lequel des
   deux mots de passe pose problème, et rappelle que les deux champs doivent
   bien rester identiques. */
function messageAuth(error, defaut) {
  const m = String((error && error.message) || "");
  if (!m) return defaut || "Opération impossible.";
  const est = (re) => re.test(m);

  // Mot de passe identique à l'ancien : le cas qui a piégé les utilisateurs.
  if (est(/different from the old password|should be different|same[_ ]password/i))
    return "Ce mot de passe est déjà le vôtre. Choisissez-en un NOUVEAU, "
      + "puis répétez-le à l'identique dans les deux champs.";

  if (est(/Password should be at least|too short|weak[_ ]password/i))
    return "Mot de passe trop court ou trop simple : 6 caractères au minimum.";
  if (est(/leaked|pwned|compromis/i))
    return "Ce mot de passe figure dans des fuites de données connues. Choisissez-en un autre.";

  if (est(/Invalid login/i)) return "Email ou mot de passe incorrect.";
  if (est(/Email not confirmed/i))
    return "Email non confirmé : cliquez d'abord sur le lien reçu dans votre boîte mail (vérifiez les indésirables).";
  if (est(/already registered|already been registered/i))
    return "Un compte existe déjà pour cet email.";
  if (est(/not authorized|not allowed for this email/i))
    return "Cette adresse n'est pas autorisée par le serveur d'envoi. "
      + "Un SMTP doit être configuré dans Supabase pour écrire à des adresses hors équipe.";

  if (est(/expired|invalid.*token|token.*invalid|otp_expired/i))
    return "Le lien a expiré ou a déjà servi. Redemandez-en un depuis l'écran de connexion.";
  if (est(/rate|limit|seconds|too many/i))
    return "Trop de demandes en peu de temps. Patientez une minute avant de réessayer.";
  if (est(/invalid.*email|Unable to validate email/i))
    return "Adresse email invalide.";
  if (est(/Failed to fetch|NetworkError|network/i))
    return "Serveur injoignable. Vérifiez votre connexion, puis réessayez.";

  return defaut ? `${defaut} (${m})` : m;
}

/* Contrôle des champs d'identité, partagé par la création de compte et l'écran
   de complétion. Rend une phrase à afficher, ou null si tout est bon.
   ---------------------------------------------------------------------------
   Les deux écrans se contentaient d'un « champ non vide » : une espace
   passait, « a » aussi. Or « org » n'est pas un champ d'état civil, c'est ce
   qui fixe le PÉRIMÈTRE DE DONNÉES du compte — « mon_org() » commande
   « peut_voir_projet() ». Une organisation mal saisie rattache quelqu'un au
   mauvais portefeuille ; une organisation vide ne le rattache à rien.
   D'où un contrôle réel, et le même des deux côtés. */
const EMAIL_VALIDE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

function champsProfilIncomplets({ org, email }) {
  const o = String(org || "").trim();
  if (email !== undefined) {
    const e = String(email || "").trim();
    if (!e) return "Renseignez votre email professionnel.";
    if (!EMAIL_VALIDE.test(e)) return "Cette adresse email n'est pas valide.";
  }
  if (!o) return "Renseignez votre organisation : elle détermine les projets auxquels vous aurez accès.";
  if (o.length < 2) return "L'organisation doit comporter au moins 2 caractères.";
  return null;
}

/* Nom d'affichage, déduit de l'adresse email.
   ---------------------------------------------------------------------------
   Le formulaire ne demande plus de nom : l'email suffit à identifier un compte,
   et un champ de moins est un champ de moins à remplir. Mais l'application
   affiche un nom à plusieurs endroits — initiales de l'avatar, liste des
   utilisateurs, accueil de l'écran d'attente — et « (?) » partout serait pire
   que le champ supprimé. On dérive donc un libellé lisible de la partie locale
   de l'adresse : « adjoua.kouame@fdfp.ci » devient « Adjoua Kouame ».
   Ce n'est qu'un affichage. L'administrateur lead peut le corriger, comme il
   corrige déjà l'organisation. */
function nomDepuisEmail(email) {
  const local = String(email || "").split("@")[0];
  if (!local) return "Utilisateur";
  const mots = local.replace(/[._-]+/g, " ").trim().split(/\s+/)
    .map((m) => (m ? m[0].toUpperCase() + m.slice(1) : ""))
    .filter(Boolean);
  return mots.join(" ") || "Utilisateur";
}

function lireStock(cle, defaut) {
  try { const v = window.localStorage.getItem(cle); return v ? JSON.parse(v) : defaut; } catch (e) { return defaut; }
}
function ecrireStock(cle, val) {
  try { window.localStorage.setItem(cle, JSON.stringify(val)); } catch (e) {}
}

/* ----------------- FILET DE SÉCURITÉ : COPIE DE SECOURS -----------------
   Une copie du portefeuille est gardée dans le navigateur à chaque
   chargement réussi, et juste avant toute opération qui supprime en masse.
   Ce n'est pas une sauvegarde au sens propre — elle est locale à un poste et
   à un navigateur, elle ne remplace pas les sauvegardes de Supabase — mais
   elle transforme une perte définitive en simple mauvaise minute.
   Elle est volontairement écrite AVANT l'opération risquée, jamais après :
   une copie prise après coup ne vaut rien. */
const CLE_SECOURS = "mip-ppa-secours";
function sauvegardeSecours(projets, suivis) {
  if (!projets || !projets.length) return;   // ne jamais écraser par du vide
  ecrireStock(CLE_SECOURS, {
    le: new Date().toISOString(),
    projets, suivis: suivis || [],
  });
}
function lireSauvegardeSecours() {
  const s = lireStock(CLE_SECOURS, null);
  return s && Array.isArray(s.projets) && s.projets.length ? s : null;
}



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
    <svg viewBox="0 0 24 24" width={t} height={t} fill="none" stroke="currentColor" aria-hidden="true" focusable="false"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={"inline-block shrink-0 " + className}>
      {IC[n]}
    </svg>
  );
}

// Descriptions affichées au survol des rubriques (info-bulles)
const DESCR_NAV = {
  dashboard: "Vision consolidée du portefeuille : scores, radar, secteurs.",
  projets: "Portefeuille des projets de formation financés par le FDFP.",
  evaluation: "Noter un projet sur les 5 dimensions et 23 indicateurs.",
  suivi: "Suivi du niveau de performance : jalons M+3 / M+6 / M+12.",
  indicateurs: "Référentiel MIP-PPA : dimensions, pondérations, indicateurs.",
  alertes: "Projets de formation de type apprentissage sous-performantes et suivis en retard.",
  exports: "Fiches PDF officielles et tableau Excel consolidé.",
  guide: "Documentation complète de la plateforme.",
  users: "Activer les comptes et attribuer les rôles.",
};

// ----------------- COULEURS -------------------------------------
const C = {
  sidebar: "#0d2233", sidebarActive: "#1d3d57", gold: "#f2a33c",
  vert: "#1d6fa8", vertFonce: "#0e3c60", vertClair: "#2280bf",
  // Les quatre couleurs de palier viennent du modèle : une seule source.
  ...COULEURS_NIVEAU,
};

// ----------------- CALCULS --------------------------------------
const noteLabel = (n) => (n === 4 ? "Excellent" : n === 3 ? "Bon" : n === 2 ? "Partiel" : n === 1 ? "Faible" : n === 0 ? "Insuffisant" : "Non noté");

/* scoreDimension, scoreGlobal, couvertureModele et niveau sont importés depuis
   « calculs.js » : le modèle est isolé pour être testé (npm test). */
const fmtPct = (v) => (v === null ? "Non noté" : `${Math.round(v)} %`);
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

/* Téléchargement d'un contenu binaire (classeur XLSX). Distinct de
   telecharger(), qui préfixe le texte d'un BOM UTF-8 — indispensable au CSV,
   mais qui corromprait un fichier binaire. */
function telechargerBinaire(nomFichier, donnees, type) {
  const url = URL.createObjectURL(new Blob([donnees], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = nomFichier; a.click();
  URL.revokeObjectURL(url);
}

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

/* Logo institutionnel, sur sa plaque blanche.
   Deux protections contre l'écrasement, qui déformait le logo dès que la place
   manquait — il est passé du ratio natif 2,22 (420 × 189) à 0,83 sur l'écran
   de connexion, où le long sous-titre voisin comprimait le cadre :
   — « shrink-0 » : dans un conteneur flex, le cadre ne cède plus sa largeur au
     texte qui l'accompagne ;
   — « maxWidth: none » : Tailwind impose « img { max-width: 100% } » via
     Preflight. Combiné à une hauteur fixe, ce plafond écrase l'image en
     largeur au lieu de la réduire proportionnellement. */
function LogoFDFP({ h = 32 }) {
  return (
    <div className="cadre-logo bg-white rounded-lg px-2 py-1 flex items-center justify-center shadow-sm shrink-0"
      style={{ height: h + 10 }}>
      <img src={LOGO_FDFP} alt="FDFP, Fonds de Développement de la Formation Professionnelle"
        style={{ height: h, width: "auto", maxWidth: "none", objectFit: "contain" }} />
    </div>
  );
}

// ----------------- PETITS COMPOSANTS ----------------------------
function Badge({ score }) {
  const n = niveau(score);
  return (
    <span className="text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap shrink-0" style={{ background: n.bg, color: n.fg }}>
      {n.txt}{score !== null ? ` · ${Math.round(score)}%` : ""}
    </span>
  );
}
// Statut du projet : même format de pastille que le niveau de performance,
// mais teintes claires et vives (jaune, rose, lilas) là où le niveau de
// performance utilise des aplats saturés (vert, bleu, orange, rouge). Deux
// informations différentes, deux registres chromatiques distincts.
// Texte noir ou violet foncé : contraste largement supérieur au seuil AA.
const teinteStatut = (statut) => {
  if (statut === "Terminé") return { bg: "#FFE94A", fg: "#000000" };  // jaune lumineux
  if (statut === "En cours") return { bg: "#FBCFE8", fg: "#000000" };  // rose doux
  if (statut === "Planifié") return { bg: "#ede9fe", fg: "#5b21b6" }; // violet très pâle
  return { bg: "#eceaf2", fg: "#5c5470" };
};
function PuceStatut({ statut }) {
  const t = teinteStatut(statut);
  return (
    <span className="text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap shrink-0" style={{ background: t.bg, color: t.fg }}>
      {statut || "Statut non défini"}
    </span>
  );
}
/* Calendrier du projet, en une ligne — « Du 12/01/2026 au 30/06/2026 · 5 mois
   et 19 jours ». Rien n'est affiché si aucune des deux dates n'est renseignée :
   une ligne « Non renseignée · Non renseignée » n'apprendrait rien et alourdirait
   toutes les listes. Quand une seule des deux est connue, on le dit en clair
   plutôt que de laisser un tiret — un tiret ne dit pas ce qu'il remplace. */
function PeriodeProjet({ projet, className = "" }) {
  const { dateDebut: d, dateFin: f } = projet || {};
  if (!estDateISO(d) && !estDateISO(f)) return null;
  const duree = dureeLisible(d, f);
  const txt = estDateISO(d) && estDateISO(f)
    ? `Du ${fmtDateFr(d)} au ${fmtDateFr(f)}${duree ? ` · ${duree}` : ""}`
    : estDateISO(d) ? `Lancement le ${fmtDateFr(d)} · fin non renseignée`
      : `Fin le ${fmtDateFr(f)} · lancement non renseigné`;
  return <div className={className}>{txt}</div>;
}
/* Avertissement de couverture partielle. Un score calculé sur 20 % du modèle
   s'affiche « Excellent » exactement comme un score complet : sans cette
   mention, rien ne distingue à l'écran une évaluation de conception d'une
   évaluation menée jusqu'à M+12. Teintes d'alerte douce, volontairement
   distinctes du niveau de performance et du statut. */
function PuceCouverture({ referentiel, notes }) {
  const c = couvertureModele(referentiel, notes);
  if (!c.notees || c.pct >= 100) return null;
  return (
    <span className="text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap shrink-0"
      style={{ background: "#fdf0da", color: "#8a5a10" }}
      title={`Évaluation partielle : le score ne porte que sur ${Math.round(c.pct)} % du modèle MIP-PPA (${c.notees} indicateurs notés sur ${c.indicateurs}). Il n'est pas comparable au score d'un projet évalué en entier.`}>
      Partiel · {Math.round(c.pct)} %
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
        alt="FDFP, Fonds de Développement de la Formation Professionnelle. Certifié ISO 9001 version 2015 par Bureau Norme Audit, référence BNA/SMQ-FDCS03112513, sur tous nos processus et tous nos sites." />
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
  /* Date abrégée pour les écrans étroits : « mer. 6 août 2026 » ne tient pas
     dans le bandeau d'un téléphone, « 06/08 » oui. Les deux formes sont
     rendues, c'est le CSS qui choisit — pas d'écouteur de redimensionnement. */
  const jourCourt = maintenant.toLocaleDateString("fr-FR", {
    timeZone: "UTC", day: "2-digit", month: "2-digit",
  });
  /* Heure construite à partir des accesseurs UTC : les secondes doivent être
     isolées dans leur propre élément pour pouvoir s'effacer sous 400 px. */
  const p2 = (n) => String(n).padStart(2, "0");
  const heureMinute = p2(maintenant.getUTCHours()) + ":" + p2(maintenant.getUTCMinutes());
  const secondes = p2(maintenant.getUTCSeconds());
  const legende = "Date et heure de référence de la plateforme, en temps universel (GMT+0). C'est sur cette base que sont calculés les retards et les échéances.";
  return (
    <div className="horloge-utc" title={legende} aria-label={legende + " Il est " + heureMinute + " GMT+0, le " + jour + "."}>
      <div className="horloge-date">
        <span className="horloge-date-longue">{jour}</span>
        <span className="horloge-date-courte">{jourCourt}</span>
      </div>
      <div className="horloge-heure">
        {heureMinute}<span className="horloge-secondes">:{secondes}</span>
        <span className="horloge-fuseau">GMT+0</span>
      </div>
    </div>
  );
}

/* Découpe un libellé en lignes d'au plus « largeurMax » caractères, sans
   jamais couper un mot : un mot plus long que la limite occupe sa ligne
   entière. Sert aux libellés des graphiques, où le texte doit tenir dans une
   place mesurée d'avance plutôt que déborder du cadre SVG. */
function decouperLibelle(texte, largeurMax) {
  const lignes = [];
  let courante = "";
  String(texte).split(" ").forEach((mot) => {
    if ((courante + " " + mot).trim().length > largeurMax) {
      if (courante) lignes.push(courante);
      courante = mot;
    } else courante = (courante + " " + mot).trim();
  });
  if (courante) lignes.push(courante);
  return lignes.length ? lignes : [""];
}

/* Largeur réelle d'un texte, mesurée par le navigateur au lieu d'être estimée
   au nombre de caractères. L'estimation se trompe de 25 % selon les lettres
   (« Transformation » et « semi-finie » n'occupent pas la même place à nombre
   de caractères égal) : trop large, elle laisse du vide ; trop étroite, elle
   coupe le texte. Le contexte de mesure est créé une fois pour toutes. */
let contexteMesure = null;
function largeurTexte(texte, police) {
  if (typeof document === "undefined") return String(texte).length * police * 0.55;
  if (!contexteMesure) contexteMesure = document.createElement("canvas").getContext("2d");
  contexteMesure.font = police + "px " + (getComputedStyle(document.body).fontFamily || "sans-serif");
  return contexteMesure.measureText(String(texte)).width;
}

/* Libellé d'un axe du radar. Recharts pose le texte sur une seule ligne et ne
   réserve aucune marge autour du cercle : sur un écran de 375 px, quatre des
   cinq dimensions débordaient du cadre et se retrouvaient coupées net —
   « Durabilité des compétences » commençait 101 px avant le bord gauche.
   On découpe donc le libellé en lignes et on l'ancre selon sa position autour
   du cercle : le texte de droite part vers la droite, celui de gauche vers la
   gauche, celui du sommet remonte et celui du bas descend. */
function TickRadar({ x, y, cx, cy, payload, mobile }) {
  const taille = mobile ? 9 : 11;
  const hauteurLigne = taille * 1.18;
  const ecart = x - cx;
  const ancre = Math.abs(ecart) < 12 ? "middle" : ecart > 0 ? "start" : "end";
  /* Place réellement disponible entre le point d'ancrage et le bord du cadre.
     Le radar étant centré, « cx » vaut la moitié de la largeur : on en déduit
     le bord droit sans avoir à connaître les dimensions du conteneur. Le
     découpage suit cette mesure plutôt qu'un seuil mobile / bureau, sinon un
     grand écran coupe des libellés alors qu'il lui reste 300 px de libres. */
  const dispo = 0.9 * (ancre === "start" ? 2 * cx - x : ancre === "end" ? x : 2 * Math.min(x, 2 * cx - x));
  const largeurMax = Math.max(8, Math.min(30, Math.floor(dispo / (taille * 0.58))));
  const lignes = decouperLibelle(payload.value, largeurMax);
  /* Rayon du point d'ancrage : sert à distinguer un libellé de sommet (bloc
     remonté) d'un libellé de flanc (bloc centré), sans dépendre d'une
     propriété interne de Recharts. */
  const rayon = Math.hypot(ecart, y - cy) || 1;
  const depart =
    y < cy - rayon * 0.5 ? -(lignes.length - 1) * hauteurLigne
    : y > cy + rayon * 0.5 ? taille * 0.9
    : -((lignes.length - 1) * hauteurLigne) / 2 + taille * 0.35;
  return (
    <text x={x} y={y} textAnchor={ancre} fill="#57534e" fontSize={taille}>
      {lignes.map((l, i) => (
        <tspan key={i} x={x} dy={i === 0 ? depart : hauteurLigne}>{l}</tspan>
      ))}
    </text>
  );
}

// ----------------- CARTE DES ZONES DE COUVERTURE -----------------
/* Les contours de « geo-civ.js » sont déjà projetés en coordonnées d'écran :
   il ne reste qu'à poser un <path> par département dans un <svg>. Pas de
   bibliothèque de cartographie, pas de tuile réseau — la carte fonctionne
   hors ligne, comme le reste de l'application.
   Le <svg> porte le viewBox voulu et « width: 100% » : le navigateur met à
   l'échelle, donc rien à recalculer au redimensionnement. */

/* Une teinte par implantation. La même antenne garde la même couleur du
   tableau de bord à la fiche d'évaluation : c'est ce qui rend les deux cartes
   lisibles ensemble.

   Les teintes sont attribuées de façon que deux zones VOISINES soient
   franchement différentes — c'est le seul cas où la confusion trompe, deux
   zones éloignées ne se comparent jamais du regard. Contrainte forte, car la
   carte les montre en aplat à 18 % d'opacité : des couleurs très distinctes
   en pastille pleine peuvent devenir indiscernables une fois délavées.
   Mesure CIEDE2000 sur les aplats, sur les quinze couples de zones qui se
   touchent : la première palette descendait à ΔE 3,3 (Siège / Abengourou) et
   4,3 (Bouaké / Yamoussoukro), soit le seuil sous lequel deux surfaces se
   confondent. Celle-ci ne descend pas sous 8,7. */
const COULEURS_ZONE = {
  "Siège Abidjan": "#14487a",       // bleu marine
  "Antenne Abengourou": "#b8256f",  // fuchsia
  "Antenne Bouaké": "#3f8f3a",      // vert
  "Antenne Yamoussoukro": "#e08214",// orange
  "Antenne Daloa": "#6b3fa0",       // violet
  "Antenne Korhogo": "#c9990c",     // or
  "Antenne Man": "#0f8f8f",         // turquoise
  "Antenne San-Pédro": "#a3312a",   // rouge brique
};
const couleurZone = (z) => COULEURS_ZONE[normaliserRegion(z)] || "#78716c";

/* Cadre englobant d'un ensemble de départements, dilaté d'une marge.
   Le format n'est pas imposé mais seulement borné : le <svg> conserve le
   rapport de son viewBox, donc un cadre au plus près de la zone suffit.
   Forcer un format unique laissait de larges bandes vides — la zone de
   Korhogo s'étire d'ouest en est, deux fois plus large que haute, et un
   cadre en 1,25 lui ajoutait 40 % de hauteur inutile. Les bornes servent
   seulement aux cas extrêmes, qu'elles ramènent à des proportions
   affichables. */
/* Chargement à la demande des tracés. Ils pèsent l'essentiel des données
   géographiques et ne servent qu'ici ; les laisser dans le paquet initial les
   faisait télécharger par tout le monde, écran de connexion compris, pour un
   dessin que la plupart des visites ne demandent jamais. Même traitement que
   jsPDF, ExcelJS, mammoth et pdf-lib.
   Le module reste en cache après le premier appel : passer d'un projet à
   l'autre ne recharge rien. */
let tracesEnCours = null;
let tracesPretes = null;
function useTraces() {
  const [traces, setTraces] = useState(tracesPretes);
  const [echec, setEchec] = useState(false);
  useEffect(() => {
    if (tracesPretes) { setTraces(tracesPretes); return; }
    let vivant = true;
    tracesEnCours = tracesEnCours || import("./geo-civ-traces.js");
    tracesEnCours.then((m) => {
      tracesPretes = m;
      if (vivant) setTraces(m);
    }).catch(() => { if (vivant) setEchec(true); });
    return () => { vivant = false; };
  }, []);
  return { traces, echec };
}

/* Cadre d'attente, à la place de la carte. Il occupe la même hauteur que
   celle-ci : sans cela, la page sautait à l'arrivée des tracés. */
function CarteEnAttente({ hauteur, echec }) {
  return (
    <div className="flex items-center justify-center rounded-xl bg-stone-50 border border-stone-100 text-sm text-stone-500"
      style={{ height: hauteur }} role="status">
      {echec ? "Fond de carte indisponible." : "Chargement du fond de carte…"}
    </div>
  );
}

/* Le réseau routier, en fond de carte. Il répond à une question que les
   contours ne traitent pas : deux localités voisines sur la carte peuvent
   n'être reliées par aucune route directe, et c'est le temps de trajet qui
   décide de la charge réelle d'une antenne — c'est d'ailleurs le premier des
   critères de zonage énoncés par la note de la DACD.
   Deux tracés seulement, donc deux nœuds dans le DOM : le dessin ne change
   jamais, il n'a pas à être découpé en éléments. « k » remet les épaisseurs
   à l'échelle quand la carte est recadrée sur une zone. */
function Routes({ ROUTES, k = 1, sombre, opacite = 1 }) {
  if (!ROUTES) return null;
  const commun = { fill: "none", strokeLinecap: "round", strokeLinejoin: "round" };
  return (
    <g opacity={opacite} style={{ pointerEvents: "none" }}>
      <path d={ROUTES.principales} {...commun}
        stroke={sombre ? "#5b6b7d" : "#9c8866"} strokeWidth={1.1 * k} />
      <path d={ROUTES.axes} {...commun}
        stroke={sombre ? "#8298ad" : "#6f5836"} strokeWidth={1.9 * k} />
    </g>
  );
}

/* Attribution des fonds de carte. Les limites administratives viennent des
   données humanitaires d'OCHA, le réseau routier d'OpenStreetMap : la licence
   ODbL de ce dernier impose de citer la source partout où la carte est
   montrée. Ce n'est pas une politesse, c'est une condition d'usage. */
/* Légende du fond de carte : les deux épaisseurs de route ne veulent rien
   dire tant qu'on ne sait pas ce qu'elles distinguent. */
function LegendeFond({ sombre }) {
  const trait = (couleur, epaisseur) => (
    <svg width="26" height="8" aria-hidden="true" className="shrink-0">
      <line x1="1" y1="4" x2="25" y2="4" stroke={couleur} strokeWidth={epaisseur} strokeLinecap="round" />
    </svg>
  );
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2 text-xs text-stone-500">
      <span className="inline-flex items-center gap-1.5">
        {trait(sombre ? "#8298ad" : "#6f5836", 2.6)} Autoroutes et voies express
      </span>
      <span className="inline-flex items-center gap-1.5">
        {trait(sombre ? "#5b6b7d" : "#9c8866", 1.5)} Routes nationales
      </span>
    </div>
  );
}

function MentionCarte() {
  return (
    <p className="text-[11px] text-stone-400 mt-2 leading-snug">
      Fonds de carte : limites administratives OCHA / HDX (COD-AB Côte d'Ivoire) ·
      réseau routier © les contributeurs d'OpenStreetMap, licence ODbL ·
      zonage FDFP d'après « Zones de couverture de la DACD », juin 2026.
    </p>
  );
}

function cadreDe(deps, marge, ratioMin, ratioMax) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  deps.forEach((d) => {
    x0 = Math.min(x0, d.b[0]); y0 = Math.min(y0, d.b[1]);
    x1 = Math.max(x1, d.b[2]); y1 = Math.max(y1, d.b[3]);
  });
  x0 -= marge; y0 -= marge; x1 += marge; y1 += marge;
  let w = x1 - x0, h = y1 - y0;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  if (w / h < ratioMin) w = h * ratioMin;
  else if (w / h > ratioMax) h = w / ratioMax;
  return { x: cx - w / 2, y: cy - h / 2, w, h, cx, cy };
}

/* Quels noms de localité afficher sans qu'ils se recouvrent.
   Les candidats sont examinés dans l'ordre reçu — le plus digne d'être lu en
   premier — et chacun n'est retenu que si sa boîte ne heurte aucune de celles
   déjà retenues. Sans ce filtre, les dix-sept localités de la zone de Korhogo
   s'écrivaient les unes sur les autres et plus rien ne se lisait, pas même
   celle du projet.
   Largeur mesurée par le navigateur, non estimée au nombre de caractères :
   « M'Bengué » et « Kong » n'occupent pas la même place à longueur voisine.
   Renvoie l'ensemble des clés retenues ; les autres gardent leur point, et
   leur nom reste accessible au survol. */
function etiquettesLisibles(candidats, marge = 0) {
  const posees = [];
  const retenues = new Set();
  candidats.forEach((c) => {
    const w = largeurTexte(c.texte, c.taille) + marge;
    const h = c.taille * 1.25;
    const b = { x0: c.x - w / 2, x1: c.x + w / 2, y0: c.y - h * 0.85, y1: c.y + h * 0.4 };
    const heurte = posees.some((p) => b.x0 < p.x1 && b.x1 > p.x0 && b.y0 < p.y1 && b.y1 > p.y0);
    if (c.impose || !heurte) { posees.push(b); retenues.add(c.cle); }
  });
  return retenues;
}

/* Carte nationale : une pastille par localité où se déroulent des projets,
   d'aire proportionnelle à leur nombre. L'aire, et non le rayon : c'est la
   surface que l'œil compare, et doubler le rayon quadruplerait la tache.

   Deux lectures de la même carte, au choix :
   « implantation » — chaque zone à sa couleur, on lit la répartition ;
   « score » — chaque zone au niveau moyen de ses projets, on lit où le
   portefeuille va mal. Compter les projets ne dit pas comment ils se
   portent : une antenne peut en avoir dix et tous les rater. */
function CarteNationale({ comptes, scores, lecture, surClic, sombre }) {
  const [survol, setSurvol] = useState(null);
  const { traces, echec } = useTraces();
  const total = Object.values(comptes).reduce((a, b) => a + b, 0);
  const maxi = Math.max(1, ...Object.values(comptes));
  const points = DEPARTEMENTS
    .filter((d) => comptes[d.n])
    .sort((a, b) => comptes[b.n] - comptes[a.n]);
  const rayon = (n) => 9 + 17 * Math.sqrt(n / maxi);

  /* Teinte d'un département. En lecture « score », une zone sans projet noté
     reste grise : lui donner la couleur du palier le plus bas la ferait
     passer pour mauvaise alors qu'elle est seulement non évaluée. */
  const teinteDe = (d) => {
    if (lecture !== "score") return couleurZone(d.z);
    const s = scores ? scores[d.z] : null;
    return s === null || s === undefined ? "#a8a29e" : niveau(s).bg;
  };

  // Les localités les plus chargées sont examinées d'abord : à encombrement
  // égal, c'est le nom du gros contingent qu'il faut pouvoir lire.
  const nommees = useMemo(() => etiquettesLisibles(points.map((d) => ({
    cle: d.c, texte: d.n, taille: 15, x: d.x, y: d.y + rayon(comptes[d.n]) + 15,
  })), 6), [comptes]);

  /* Garde placée APRÈS tous les hooks : un retour anticipé au-dessus
     changerait leur nombre d'un rendu à l'autre, ce que React interdit. */
  if (!traces) return <CarteEnAttente hauteur={420} echec={echec} />;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${CARTE_LARGEUR} ${CARTE_HAUTEUR}`} width="100%"
        style={{ display: "block", maxHeight: "min(70vh, 620px)" }}
        role="img"
        aria-label={`Carte de Côte d'Ivoire : ${total} projet${total > 1 ? "s" : ""} répartis sur ${points.length} localité${points.length > 1 ? "s" : ""}.`}>
        {/* Les huit zones, en aplat très clair : elles donnent le contexte
            « quelle antenne » sans concurrencer les pastilles. */}
        {DEPARTEMENTS.map((d) => (
          <path key={d.c} d={traces.CONTOURS[d.c]} fill={teinteDe(d)}
            fillOpacity={survol && survol.z === d.z ? 0.42 : 0.22}
            stroke={sombre ? "#0d1721" : "#ffffff"} strokeWidth="0.8" />
        ))}
        <Routes ROUTES={traces.ROUTES} sombre={sombre} opacite={0.75} />
        {/* Liseré autour de chaque zone : le trait blanc inter-départemental
            ne suffit pas à faire voir les huit ensembles. */}
        {Object.keys(LOCALITES_PAR_ZONE).map((z) => (
          <g key={z}>
            {DEPARTEMENTS.filter((d) => d.z === z).map((d) => (
              <path key={d.c} d={traces.CONTOURS[d.c]} fill="none" stroke={teinteDe(d)}
                strokeWidth="1.6" strokeOpacity="0.55" />
            ))}
          </g>
        ))}
        {points.map((d) => {
          const n = comptes[d.n];
          const r = rayon(n);
          const actif = survol && survol.c === d.c;
          return (
            <g key={d.c} style={{ cursor: surClic ? "pointer" : "default" }}
              onMouseEnter={() => setSurvol(d)} onMouseLeave={() => setSurvol(null)}
              onClick={surClic ? () => surClic(d) : undefined}>
              <circle cx={d.x} cy={d.y} r={r} fill={couleurZone(d.z)}
                fillOpacity={actif ? 0.95 : 0.82}
                stroke={sombre ? "#0d1721" : "#ffffff"} strokeWidth="2.5" />
              <text x={d.x} y={d.y} textAnchor="middle" dominantBaseline="central"
                fontSize={Math.min(r * 1.15, 21)} fontWeight="700" fill="#ffffff">{n}</text>
              {(nommees.has(d.c) || actif) && (
                <text x={d.x} y={d.y + r + 15} textAnchor="middle" fontSize="15"
                  fontWeight="600" className="carte-etiquette"
                  stroke={sombre ? "#0d1721" : "#ffffff"} strokeWidth="3.5"
                  paintOrder="stroke" strokeLinejoin="round">{d.n}</text>
              )}
            </g>
          );
        })}
      </svg>
      {survol && (
        <div className="absolute left-0 bottom-0 pointer-events-none bg-white border border-stone-200 rounded-xl px-3 py-2 shadow-lg text-xs"
          style={{ maxWidth: "min(260px, 70vw)" }}>
          <div className="font-bold">{survol.n}</div>
          <div className="text-stone-500">{survol.r}</div>
          <div style={{ color: couleurZone(survol.z) }} className="font-semibold mt-0.5">{survol.z}</div>
          <div className="mt-0.5">{comptes[survol.n]} projet{comptes[survol.n] > 1 ? "s" : ""}</div>
          {scores && scores[survol.z] !== null && scores[survol.z] !== undefined && (
            <div className="mt-0.5 text-stone-500">
              Moyenne de la zone : <strong style={{ color: niveau(scores[survol.z]).bg }}>
                {fmtPct(scores[survol.z])}</strong> · {niveau(scores[survol.z]).txt}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* Carte d'une seule implantation : sa zone d'occupation, recadrée, avec la
   localité du projet mise en exergue parmi toutes celles qu'elle couvre.
   Le reste du pays reste dessiné en fond neutre — sans lui, on ne saurait
   pas où la zone se situe dans le pays. */
function CarteZone({ zone, localite, sombre }) {
  const { traces, echec } = useTraces();
  const z = normaliserRegion(zone);
  const dedans = DEPARTEMENTS.filter((d) => d.z === z);
  const cible = DEP_PAR_LOCALITE[localite];
  const teinte = couleurZone(z);
  if (!dedans.length) return null;

  const cadre = cadreDe(dedans, 26, 0.95, 2.4);
  // L'échelle du recadrage commande la taille du texte et des traits : sans
  // cette correction, une petite zone très zoomée afficherait des libellés
  // démesurés et une grande zone des libellés illisibles.
  const k = cadre.w / CARTE_LARGEUR;

  /* Quelles localités voisines peuvent porter leur nom. La cible passe en
     tête et s'impose : son nom ne cède jamais la place. Les autres suivent du
     plus grand département au plus petit — à encombrement égal, le nom du
     plus visible est le plus utile. */
  /* Seules les villes cibles portent un point et un nom : les autres
     départements de la zone en font partie — ils sont coloriés — mais le
     document de la DACD n'y désigne aucune ville d'intervention. */
  const autres = dedans.filter((d) => d.t && (!cible || d.c !== cible.c));
  const nommees = useMemo(() => {
    const aire = (d) => (d.b[2] - d.b[0]) * (d.b[3] - d.b[1]);
    const candidats = [];
    if (cible) candidats.push({ cle: cible.c, texte: cible.n, taille: 16 * k, x: cible.x, y: cible.y - 17 * k, impose: true });
    [...autres].sort((a, b) => aire(b) - aire(a)).forEach((d) => {
      candidats.push({ cle: d.c, texte: d.n, taille: 11 * k, x: d.x, y: d.y - 6 * k });
    });
    return etiquettesLisibles(candidats, 3 * k);
  }, [z, localite, k]);

  if (!traces) return <CarteEnAttente hauteur={320} echec={echec} />;

  return (
    <svg viewBox={`${cadre.x} ${cadre.y} ${cadre.w} ${cadre.h}`} width="100%"
      style={{ display: "block", maxHeight: "min(56vh, 460px)" }}
      role="img"
      aria-label={`Zone de couverture ${z} : ${dedans.length} localités, dont ${localite || "aucune"} pour ce projet.`}>
      {/* Le pays entier, en fond neutre */}
      {DEPARTEMENTS.map((d) => (
        <path key={d.c} d={traces.CONTOURS[d.c]} className="carte-hors-zone"
          stroke={sombre ? "#22303f" : "#e7e5e4"} strokeWidth={0.9 * k} />
      ))}
      {/* La zone de l'implantation */}
      {dedans.map((d) => {
        const estCible = cible && d.c === cible.c;
        return (
          <path key={d.c} d={traces.CONTOURS[d.c]} fill={teinte}
            fillOpacity={estCible ? 0.85 : 0.2}
            stroke={estCible ? teinte : (sombre ? "#0d1721" : "#ffffff")}
            strokeWidth={(estCible ? 2.6 : 1) * k} />
        );
      })}
      <Routes ROUTES={traces.ROUTES} k={k} sombre={sombre} opacite={0.85} />
      {/* Les autres localités de la zone : présentes, mais en retrait. Le
          point est toujours dessiné ; le nom omis faute de place reste
          lisible au survol. */}
      {autres.map((d) => (
        <g key={d.c}>
          <circle cx={d.x} cy={d.y} r={2.6 * k} fill={teinte} fillOpacity="0.75">
            <title>{d.n}</title>
          </circle>
          {nommees.has(d.c) && (
            <text x={d.x} y={d.y - 6 * k} textAnchor="middle" fontSize={11 * k}
              className="carte-etiquette-discrete"
              stroke={sombre ? "#0d1721" : "#ffffff"} strokeWidth={2.4 * k}
              paintOrder="stroke" strokeLinejoin="round">{d.n}</text>
          )}
        </g>
      ))}
      {/* La localité du projet */}
      {cible && (
        <g>
          <circle cx={cible.x} cy={cible.y} r={11 * k} fill="none"
            stroke={C.gold} strokeWidth={3 * k} opacity="0.9" />
          <circle cx={cible.x} cy={cible.y} r={4.6 * k} fill={C.gold}
            stroke={sombre ? "#0d1721" : "#ffffff"} strokeWidth={1.6 * k} />
          <text x={cible.x} y={cible.y - 17 * k} textAnchor="middle"
            fontSize={16 * k} fontWeight="800" className="carte-etiquette"
            stroke={sombre ? "#0d1721" : "#ffffff"} strokeWidth={4 * k}
            paintOrder="stroke" strokeLinejoin="round">{cible.n}</text>
        </g>
      )}
    </svg>
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
      {/* En-tête cadré sur la même largeur que la carte et que le bandeau de
          certification (max-w-md). Sans cette limite, le sous-titre s'étirait
          sur une seule ligne en grand écran : l'en-tête traversait tout
          l'écran tandis que la carte restait étroite au centre, et les deux ne
          semblaient plus appartenir au même bloc. Le rendu du téléphone —
          compact et centré — devient ainsi celui de tous les écrans. */}
      <div className="w-full max-w-md flex items-center gap-3 mb-6">
        <LogoFDFP h={34} />
        <div className="min-w-0">
          <div className="text-white font-bold text-lg leading-tight">FDFP · MIP-PPA</div>
          <div className="text-sky-200 text-sm">Suivi des projets de formation de type apprentissage (emploi-qualification) dans les industries agroalimentaires.</div>
        </div>
      </div>
      {enfants}
      {/* Bandeau de certification, comme au pied de l'application une fois
          connecté : il est ainsi présent dès l'écran de chargement et sur
          l'écran de connexion, c'est-à-dire dès le premier regard porté sur
          la plateforme. Plaque blanche obligatoire — l'image est fournie sur
          fond blanc et découperait un rectangle disgracieux sur le dégradé.
          Largeur alignée sur celle des cartes (max-w-md). */}
      <footer className="w-full max-w-md mt-7 bg-white rounded-2xl p-3 flex justify-center"
        style={{ border: "1px solid rgba(255,255,255,.20)", boxShadow: "0 2px 10px rgba(0,0,0,.18)" }}>
        <img src={CERTIFICATION_FDFP} className="w-full h-auto block"
          alt="FDFP, Fonds de Développement de la Formation Professionnelle. Certifié ISO 9001 version 2015 par Bureau Norme Audit, référence BNA/SMQ-FDCS03112513, sur tous nos processus et tous nos sites." />
      </footer>
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
        <p className="text-sm text-stone-500 mt-2">Bonjour {session.nom.split(" ")[0]}, votre compte ({session.email}) est bien créé et votre email est vérifié. L'administrateur lead doit maintenant vous attribuer un rôle pour activer votre accès.</p>
        <div className="flex justify-center gap-3 mt-6">
          <button onClick={surActualiser} className="border border-stone-300 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-stone-50 flex items-center gap-1.5"><Icone n="rotation" t={14} /> Vérifier à nouveau</button>
          <button onClick={surDeconnexion} className="text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-1.5" style={{ background: C.vertFonce }}><Icone n="deconnexion" t={14} /> Se déconnecter</button>
        </div>
      </div>
    } />
  );
}

function EcranFinalisation({ session, surTermine }) {
  /* Deux situations aboutissent ici, et l'écran doit servir les deux :
       - une INVITATION : le compte n'a pas encore de mot de passe choisi ;
       - un PROFIL INCOMPLET : le compte existe, s'est déjà connecté, mais il
         lui manque son organisation. C'est le cas qui passait à travers.
     Dans le second cas, redemander un mot de passe n'a pas de sens : on
     préremplit ce qui est connu et on laisse le champ facultatif.
     Le nom n'est plus demandé : il est déduit de l'adresse email. */
  const completion = Boolean(String(session.org || "").trim()) || Boolean(String(session.nom || "").trim());
  const nom = String(session.nom || "").trim() || nomDepuisEmail(session.email);
  const [org, setOrg] = useState(session.org || "");
  const [mdp, setMdp] = useState("");
  const [voir, setVoir] = useState(false);
  const [msg, setMsg] = useState(null);
  const [envoi, setEnvoi] = useState(false);

  const erreurChamps = champsProfilIncomplets({ org });
  const mdpRequis = !completion;
  const complet = !erreurChamps && (!mdpRequis ? (!mdp || mdp.length >= 6) : mdp.length >= 6);

  const valider = async () => {
    if (erreurChamps) return setMsg(erreurChamps);
    if (mdpRequis && mdp.length < 6) return setMsg("Mot de passe : 6 caractères minimum.");
    if (!mdpRequis && mdp && mdp.length < 6) return setMsg("Mot de passe : 6 caractères minimum, ou laissez le champ vide.");
    setEnvoi(true); setMsg(null);
    const profil = { nom, org: org.trim() };
    /* La table « profiles » est écrite EN PREMIER, et c'est délibéré : c'est
       elle que l'application relit pour décider si le profil est complet.
       Écrite après « updateUser », toute relecture déclenchée entre-temps
       voyait encore l'ancienne ligne et renvoyait l'utilisateur sur ce même
       écran. L'ordre à lui seul ne suffit pas — l'événement USER_UPDATED est
       aussi ignoré, voir onAuthStateChange — mais il supprime la fenêtre. */
    /* UPSERT, et non UPDATE — c'est ce qui bloquait les invitations.
       Un compte créé par lien d'invitation n'a pas forcément de ligne dans
       « profiles » : le déclencheur qui la crée est attaché à l'inscription
       ordinaire. Un UPDATE ne touchait donc AUCUNE ligne, et le contrôle
       « .select() » posé plus haut le signalait — à juste titre — comme un
       refus de la base. Le message était exact, le geste était le mauvais :
       il n'y avait rien à mettre à jour, il fallait créer.
       « upsert » couvre les deux cas d'un seul appel. Le déclencheur
       « profils_geler_org » est un BEFORE UPDATE : une création ne le
       déclenche pas, l'invité peut donc bien renseigner son organisation. */
    const { data: ecrit, error: e2 } = await sb.from("profiles")
      .upsert({ id: session.id, email: session.email, ...profil }, { onConflict: "id" })
      .select("id");
    // Le mot de passe n'est envoyé que s'il a été saisi.
    let { error: e1 } = await sb.auth.updateUser(mdp ? { password: mdp, data: profil } : { data: profil });
    /* Cas fréquent, et jusqu'ici bloquant : l'invité saisit le mot de passe
       qu'il utilise DÉJÀ. Supabase refuse alors la mise à jour entière —
       profil compris — et l'écran restait fermé sur un message anglais.
       Or il n'y a rien à corriger : garder son mot de passe est un choix
       valable, seul le profil manquait. On rejoue donc sans le mot de passe
       et on laisse entrer, au lieu d'exiger un changement dont personne
       n'a besoin ici. */
    if (e1 && /different from the old password|should be different|same[_ ]password/i.test(e1.message || "")) {
      const r = await sb.auth.updateUser({ data: profil });
      e1 = r.error;
    }
    setEnvoi(false);
    if (e1 || e2) return setMsg(messageAuth(e1 || e2, "Enregistrement impossible."));
    if (!ecrit || !ecrit.length) {
      return setMsg("Le profil n'a pas pu être enregistré : la base a refusé l'écriture. "
        + "L'administrateur doit exécuter « supabase-phase8.sql » dans Supabase, "
        + "qui pose les politiques d'accès manquantes sur la table des profils.");
    }
    surTermine(profil);
  };
  return (
    <CadreAccueil enfants={
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-7 page-anim">
        <div className="flex items-center gap-2 font-bold text-stone-900"><Icone n="bouclier" t={18} /> {completion ? "Profil à compléter" : "Bienvenue !"}</div>
        <p className="text-sm text-stone-500 mt-1">
          {completion
            ? `Il manque une information à votre profil (${session.email}). L'organisation détermine les projets auxquels vous avez accès : elle ne peut pas rester vide.`
            : `Votre invitation est validée (${session.email}). Complétez votre profil et choisissez votre mot de passe pour terminer.`}
        </p>
        {msg && <div className="mt-3 text-sm rounded-xl px-3.5 py-2.5 bg-red-50 text-red-700 border border-red-200">{msg}</div>}
        {/* Libellés d'origine, volontairement courts. L'astérisque rouge porte
            à lui seul l'information « obligatoire » : la contrainte est dans la
            validation et dans le bouton éteint, pas dans une notice sous
            chaque champ. */}
        <label className="block text-sm font-semibold text-stone-800 mt-4">Organisation <span className="text-red-500">*</span> <span className="font-normal text-stone-400">(entreprise / cabinet)</span>
          <input value={org} onChange={(e) => setOrg(e.target.value)}
            className="mt-1.5 w-full border border-stone-300 rounded-xl px-3.5 py-2.5 font-normal outline-none focus:border-sky-600" />
        </label>
        <label className="block text-sm font-semibold text-stone-800 mt-4">Mot de passe {mdpRequis
          ? <><span className="text-red-500">*</span> <span className="font-normal text-stone-400">(6 caractères min.)</span></>
          : <span className="font-normal text-stone-400">(laissez vide pour conserver le vôtre)</span>}
          <div className="relative mt-1.5">
            <input type={voir ? "text" : "password"} value={mdp} onChange={(e) => setMdp(e.target.value)}
              className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 pr-12 font-normal outline-none focus:border-sky-600" />
            <button type="button" onClick={() => setVoir(!voir)} tabIndex={-1}
              title={voir ? "Masquer le mot de passe" : "Afficher le mot de passe"} aria-label={voir ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700">
              {voir ? <Icone n="oeilBarre" t={19} /> : <Icone n="oeil" t={19} />}
            </button>
          </div>
        </label>
        {erreurChamps && <p className="text-xs text-amber-700 mt-3">{erreurChamps}</p>}
        <button onClick={valider} disabled={envoi || !complet}
          className="w-full mt-6 text-white font-semibold py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed" style={{ background: C.vertFonce }}>
          {envoi ? "Un instant…" : completion ? "Enregistrer et accéder à la plateforme" : "Terminer et accéder à la plateforme"}
        </button>
      </div>
    } />
  );
}

/* ---------------------------------------------------------------------------
   MOT DE PASSE OUBLIÉ — le parcours en deux temps
   ---------------------------------------------------------------------------
   Il n'y en avait aucun : un compte dont le mot de passe était perdu était un
   compte perdu, sans autre recours que de demander à l'administrateur lead —
   qui ne peut pas le réinitialiser non plus, la clé « anon » n'ouvrant pas
   l'API d'administration. Créer un second compte n'aurait rien réglé, l'email
   étant unique et le rôle attaché au compte d'origine.

   1. « Demander un lien » envoie un courriel de récupération (Supabase Auth).
   2. Le lien reçu ramène sur l'application avec un jeton de récupération ;
      Supabase émet alors l'événement PASSWORD_RECOVERY, et l'application
      affiche « EcranNouveauMdp » AVANT tout accès aux données.

   ⚠ Côté Supabase : l'URL de l'application doit figurer dans
   Authentication → URL Configuration → Redirect URLs, sinon le lien renvoie
   sur localhost. C'est rappelé dans « supabase-phase7.sql ».
   --------------------------------------------------------------------------- */

function EcranConnexion() {
  const [onglet, setOnglet] = useState("connexion");
  const [email, setEmail] = useState("");
  const [mdp, setMdp] = useState("");
  const [org, setOrg] = useState("");
  const [msg, setMsg] = useState(null);
  const [voirMdp, setVoirMdp] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  /* Envoi du lien de réinitialisation.
     La réponse est VOLONTAIREMENT la même que le compte existe ou non : dire
     « aucun compte pour cette adresse » transformerait l'écran de connexion en
     annuaire, où l'on teste des adresses jusqu'à trouver celles qui sont
     inscrites. C'est aussi ce que fait Supabase, qui ne distingue pas les deux
     cas dans sa réponse. */
  const reinitialiser = async () => {
    const adresse = email.trim();
    if (!adresse) return setMsg({ type: "erreur", txt: "Saisissez d'abord votre email professionnel." });
    setEnvoi(true); setMsg(null);
    /* Le lien doit revenir sur CETTE application, à sa racine : « origin +
       pathname » et non « href », qui embarquerait la requête et le fragment
       de l'URL courante — dont, justement, le jeton d'une récupération
       précédente. */
    const retour = window.location.origin + window.location.pathname;
    const { error } = await sb.auth.resetPasswordForEmail(adresse, { redirectTo: retour });
    setEnvoi(false);
    /* Seules les erreurs qui n'apprennent rien sur l'existence du compte sont
       remontées : le plafond d'envoi et l'absence de SMTP sont des pannes de
       configuration, pas des renseignements sur l'adresse saisie. */
    if (error && /rate|limit|seconds|too many|not authorized|not allowed/i.test(error.message || "")) {
      return setMsg({ type: "erreur", txt: messageAuth(error) });
    }
    setMsg({ type: "ok", txt: `Si un compte existe pour ${adresse}, un lien de réinitialisation vient d'y être envoyé. Il est valable une heure : ouvrez-le depuis ce même appareil, et pensez à regarder dans les indésirables.` });
  };

  const connecter = async () => {
    setEnvoi(true); setMsg(null);
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: mdp });
    setEnvoi(false);
    if (error) setMsg({ type: "erreur", txt: messageAuth(error) });
  };
  const creer = async () => {
    const manque = champsProfilIncomplets({ org, email });
    if (manque) return setMsg({ type: "erreur", txt: manque });
    if (mdp.length < 6) return setMsg({ type: "erreur", txt: "Mot de passe : 6 caractères minimum." });
    setEnvoi(true); setMsg(null);
    const { error } = await sb.auth.signUp({ email: email.trim(), password: mdp, options: { data: { nom: nomDepuisEmail(email), org: org.trim() } } });
    setEnvoi(false);
    if (error) return setMsg({ type: "erreur", txt: messageAuth(error) });
    setMsg({ type: "ok", txt: "Compte créé ! Un email de confirmation vient de vous être envoyé : cliquez sur le lien pour vérifier votre adresse, puis revenez vous connecter. L'administrateur lead activera ensuite votre accès." });
    setOnglet("connexion"); setMdp("");
  };
  // La touche Entrée valide l'action de l'onglet courant, quel qu'il soit.
  const valider = () => (onglet === "connexion" ? connecter() : onglet === "creation" ? creer() : reinitialiser());
  const champ = (label, type, val, set, aide, requis) => (
    <label key={label} className="block text-sm font-semibold text-stone-800 mt-4">
      {label}{requis && <span className="text-red-500"> *</span>}{aide && <span className="font-normal text-stone-400"> {aide}</span>}
      <input type={type} value={val} onChange={(e) => set(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && valider()}
        className="mt-1.5 w-full border border-stone-300 rounded-xl px-3.5 py-2.5 font-normal outline-none focus:border-sky-600" />
    </label>
  );
  const oubli = onglet === "oubli";
  /* Tous les champs sont obligatoires à la création : le bouton reste éteint
     tant qu'il en manque un. Un bouton actif qui refuse au clic oblige à
     deviner ce qui cloche ; un bouton éteint accompagné de la phrase qui
     manque le dit d'avance. Le contrôle est refait dans « creer » — un bouton
     désactivé n'est pas une validation, la touche Entrée y échappe. */
  const manqueCreation = onglet === "creation" ? champsProfilIncomplets({ org, email }) : null;
  const creationPrete = !manqueCreation && mdp.length >= 6;
  return (
    <CadreAccueil enfants={
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-7 page-anim">
        <div className="flex items-center gap-2 font-bold text-stone-900"><Icone n="bouclier" t={18} /> Espace sécurisé</div>
        <p className="text-sm text-stone-500 mt-1">
          {oubli
            ? "Indiquez l'adresse de votre compte : un lien vous sera envoyé pour choisir un nouveau mot de passe."
            : "Connectez-vous ou créez un compte. Un administrateur lead activera votre accès."}
        </p>
        {/* La récupération n'est pas un troisième onglet : c'est un détour
            depuis la connexion, on y entre par un lien et on en sort par un
            lien. Trois onglets de même rang laisseraient croire à trois
            manières d'entrer dans la plateforme. */}
        {!oubli && (
          <div className="grid grid-cols-2 bg-stone-100 rounded-full p-1 mt-5 text-sm font-semibold">
            {[["connexion", "Connexion"], ["creation", "Créer un compte"]].map(([id, lbl]) => (
              <button key={id} onClick={() => { setOnglet(id); setMsg(null); }}
                className={`py-2 rounded-full ${onglet === id ? "bg-white shadow text-stone-900" : "text-stone-500"}`}>{lbl}</button>
            ))}
          </div>
        )}
        {msg && <div className={`mt-4 text-sm rounded-xl px-3.5 py-2.5 ${msg.type === "erreur" ? "bg-red-50 text-red-700 border border-red-200" : "bg-emerald-50 text-emerald-800 border border-emerald-200"}`}>{msg.txt}</div>}
        {onglet === "creation" && champ("Organisation", "text", org, setOrg, "(entreprise / cabinet)", true)}
        {champ("Email professionnel", "email", email, setEmail, null, onglet === "creation")}
        {!oubli && (
          <label className="block text-sm font-semibold text-stone-800 mt-4">Mot de passe{onglet === "creation" && <><span className="text-red-500"> *</span><span className="font-normal text-stone-400"> (6 caractères min.)</span></>}
            <div className="relative mt-1.5">
              <input type={voirMdp ? "text" : "password"} value={mdp} onChange={(e) => setMdp(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && valider()}
                className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 pr-12 font-normal outline-none focus:border-sky-600" />
              <button type="button" onClick={() => setVoirMdp(!voirMdp)} tabIndex={-1}
                title={voirMdp ? "Masquer le mot de passe" : "Afficher le mot de passe"} aria-label={voirMdp ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700">
                {voirMdp ? <Icone n="oeilBarre" t={19} /> : <Icone n="oeil" t={19} />}
              </button>
            </div>
          </label>
        )}
        {onglet === "connexion" && (
          <div className="mt-2 text-right">
            <button type="button" onClick={() => { setOnglet("oubli"); setMsg(null); setMdp(""); }}
              className="text-xs font-medium hover:underline" style={{ color: C.vert }}>Mot de passe oublié ?</button>
          </div>
        )}
        {onglet === "creation" && (manqueCreation
          ? <p className="text-xs text-amber-700 mt-3">{manqueCreation}</p>
          : mdp.length < 6 && <p className="text-xs text-amber-700 mt-3">Mot de passe : 6 caractères minimum.</p>)}
        <button onClick={valider} disabled={envoi || (onglet === "creation" && !creationPrete)}
          className="w-full mt-6 text-white font-semibold py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed" style={{ background: C.vertFonce }}>
          {envoi ? "Un instant…" : oubli ? "Envoyer le lien de réinitialisation" : onglet === "connexion" ? "Se connecter" : "Créer le compte"}
        </button>
        {oubli && (
          <button type="button" onClick={() => { setOnglet("connexion"); setMsg(null); }}
            className="w-full mt-3 text-sm text-stone-500 hover:text-stone-800">Revenir à la connexion</button>
        )}
        <p className="text-xs text-stone-400 mt-4 text-center">
          {oubli
            ? "Le lien est valable une heure et ne peut servir qu'une fois. Ouvrez-le depuis cet appareil : c'est lui qui portera la session de récupération."
            : onglet === "creation"
              ? "Un email de confirmation vous sera envoyé pour vérifier votre adresse."
              : "Votre accès dépend du rôle attribué par l'administrateur lead."}
        </p>
      </div>
    } />
  );
}

/* Témoin de concordance des deux champs de mot de passe.
   Rien tant que la confirmation est vide : un « ne correspondent pas » affiché
   dès le premier caractère tapé est un reproche adressé à quelqu'un qui n'a
   pas fini d'écrire. */
function ConcordanceMdp({ mdp, confirmation }) {
  if (!confirmation) return null;
  const ok = mdp === confirmation;
  return (
    <div className={"mt-2 text-xs font-medium flex items-center gap-1.5 " + (ok ? "text-emerald-700" : "text-amber-700")}>
      <Icone n={ok ? "cocheCercle" : "alerte"} t={14} />
      {ok ? "Les deux saisies sont identiques." : "Les deux saisies ne correspondent pas encore."}
    </div>
  );
}

/* Choix d'un nouveau mot de passe, après un lien de récupération.
   S'affiche AVANT toute autre garde d'accès : à ce stade la session existe
   déjà — c'est le lien qui l'a ouverte — mais elle n'a qu'un seul usage
   légitime, changer le mot de passe. Laisser passer l'utilisateur vers
   l'application reviendrait à faire d'un lien reçu par courriel une porte
   d'entrée ordinaire, alors qu'il traîne dans une boîte mail. */
function EcranNouveauMdp({ email, surTermine, surAnnuler }) {
  const [mdp, setMdp] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [voir, setVoir] = useState(false);
  const [msg, setMsg] = useState(null);
  const [envoi, setEnvoi] = useState(false);

  const valider = async () => {
    if (mdp.length < 6) return setMsg("Mot de passe : 6 caractères minimum.");
    /* La confirmation n'est pas une formalité : une faute de frappe dans un
       champ masqué enfermerait le compte dehors une deuxième fois, et le lien
       de récupération, lui, ne sert qu'une fois. */
    if (mdp !== confirmation) return setMsg("Les deux saisies diffèrent. Vérifiez avant de valider.");
    setEnvoi(true); setMsg(null);
    const { error } = await sb.auth.updateUser({ password: mdp });
    setEnvoi(false);
    if (error) return setMsg(messageAuth(error));
    surTermine();
  };

  const champMdp = (label, val, set) => (
    <label className="block text-sm font-semibold text-stone-800 mt-4">{label}
      <div className="relative mt-1.5">
        <input type={voir ? "text" : "password"} value={val} onChange={(e) => set(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && valider()}
          className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 pr-12 font-normal outline-none focus:border-sky-600" />
        <button type="button" onClick={() => setVoir(!voir)} tabIndex={-1}
          title={voir ? "Masquer le mot de passe" : "Afficher le mot de passe"} aria-label={voir ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700">
          {voir ? <Icone n="oeilBarre" t={19} /> : <Icone n="oeil" t={19} />}
        </button>
      </div>
    </label>
  );

  return (
    <CadreAccueil enfants={
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-7 page-anim">
        <div className="flex items-center gap-2 font-bold text-stone-900"><Icone n="bouclier" t={18} /> Nouveau mot de passe</div>
        <p className="text-sm text-stone-500 mt-1">Choisissez le mot de passe du compte {email}. Il remplacera l'ancien immédiatement.</p>
        {/* Dit d'emblée ce que le formulaire attend. Les deux champs identiques
            sont une évidence pour qui l'a écrit, pas pour qui le remplit — et
            c'est précisément cette évidence qui a rendu le message d'erreur de
            Supabase si trompeur. */}
        <p className="text-xs text-stone-400 mt-1.5">Saisissez le même mot de passe dans les deux champs. Il doit être différent de celui que vous utilisiez jusqu'ici.</p>
        {msg && <div className="mt-3 text-sm rounded-xl px-3.5 py-2.5 bg-red-50 text-red-700 border border-red-200">{msg}</div>}
        {champMdp("Nouveau mot de passe (6 caractères min.)", mdp, setMdp)}
        {champMdp("Confirmez le mot de passe", confirmation, setConfirmation)}
        {/* Concordance annoncée EN DIRECT, et non au moment de valider. C'est ce
            qui sépare définitivement les deux erreurs : celle qui porte sur les
            deux champs se voit et se corrige avant l'envoi, si bien qu'un
            message venu du serveur ne peut plus être pris pour elle. */}
        <ConcordanceMdp mdp={mdp} confirmation={confirmation} />
        <button onClick={valider} disabled={envoi}
          className="w-full mt-6 text-white font-semibold py-3 rounded-xl disabled:opacity-60" style={{ background: C.vertFonce }}>
          {envoi ? "Un instant…" : "Enregistrer et accéder à la plateforme"}
        </button>
        <button type="button" onClick={surAnnuler} className="w-full mt-3 text-sm text-stone-500 hover:text-stone-800">
          Annuler et revenir à la connexion
        </button>
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
  /* « historique » : instantanés datés de l'évaluation (phase 3). La colonne
     peut ne pas exister si le script « supabase-phase3-trajectoire.sql » n'a
     pas encore été exécuté — d'où le repli sur un tableau vide des deux côtés,
     qui laisse l'application fonctionner sans la trajectoire. */
  /* Les colonnes de calendrier (phase 7) existent-elles ? Détecté à la lecture,
     sur la première ligne reçue, comme la corbeille de la phase 5. Tant
     qu'elles manquent, on ne les envoie PAS : une base non migrée continue
     d'accepter les enregistrements, et l'application reste utilisable sans son
     calendrier plutôt que de refuser toute écriture. Dès que l'utilisateur
     saisit vraiment une date, l'écriture part quand même — et l'échec porte
     alors un message qui dit quel script exécuter. */
  const datesDispoRef = useRef(false);
  const [datesDispo, setDatesDispo] = useState(true);

  const projetVersRow = (f) => {
    const row = { id: f.id, titre: f.titre || "", promoteur: f.entreprise || f.promoteur || "", operateur: f.operateur || "", beneficiaire: f.beneficiaire || "", secteur: f.filiere || f.secteur || "", secteur_grand: f.secteurGrand || "", domaine: f.domaine || "", region: f.region || "", apprenants: Number(f.apprenants) || 0, budget: Number(f.budget) || 0, statut: normaliserStatut(f.statut), notes: f.notes || {}, maj_le: new Date().toISOString() };
    /* « historique » n'est envoyé que s'il contient quelque chose : tant qu'aucun
       jalon n'est figé, l'application écrit exactement les mêmes colonnes
       qu'avant et continue de fonctionner sur une base où la migration de la
       phase 3 n'a pas encore été passée. */
    if (Array.isArray(f.historique) && f.historique.length) row.historique = f.historique;
    /* « localite » (phase 4) suit la même règle que « historique » : la colonne
       n'est écrite que si le projet en porte une, pour qu'une base où
       « supabase-phase4.sql » n'a pas encore été passé continue d'accepter les
       enregistrements. */
    if (f.localite) row.localite = f.localite;
    /* « date_debut » / « date_fin » (phase 7). Contrairement à « localite »,
       les deux colonnes partent ENSEMBLE et acceptent null : effacer une date
       doit s'enregistrer, sans quoi elle réapparaîtrait au rechargement. */
    if (datesDispoRef.current || estDateISO(f.dateDebut) || estDateISO(f.dateFin)) {
      row.date_debut = estDateISO(f.dateDebut) ? f.dateDebut : null;
      row.date_fin = estDateISO(f.dateFin) ? f.dateFin : null;
    }
    return row;
  };
  /* La localité est ramenée au périmètre de sa zone à la lecture : une base
     antérieure à la phase 4 ne renvoie rien, et le chef-lieu de l'implantation
     prend alors le relais. La carte a donc toujours un point à montrer. */
  /* Les dates sont ramenées à « AAAA-MM-JJ » : PostgreSQL peut rendre un
     « date » tel quel, mais un « timestamptz » ajouterait une heure et un
     fuseau que l'application ne saurait pas quoi faire. La coupe est donc
     faite ici, une fois pour toutes. */
  const dateDeRow = (v) => (estDateISO(v) ? String(v).slice(0, 10) : "");
  const rowVersProjet = (r) => ({ id: r.id, titre: r.titre, entreprise: r.promoteur, operateur: r.operateur, beneficiaire: r.beneficiaire, filiere: r.secteur, secteurGrand: r.secteur_grand || "", domaine: r.domaine || "", region: normaliserRegion(r.region), localite: normaliserLocalite(r.localite, r.region), apprenants: r.apprenants, budget: r.budget, statut: normaliserStatut(r.statut), dateDebut: dateDeRow(r.date_debut), dateFin: dateDeRow(r.date_fin), notes: r.notes || {}, historique: Array.isArray(r.historique) ? r.historique : [] });
  const suiviVersRow = (s) => ({ id: s.id, projet_id: s.formationId, jalon: s.jalon, echeance: s.echeance || null, statut: s.statut || "programmé", note: s.note || "", docs: s.docs || [], maj_le: new Date().toISOString() });
  /* Le statut d'un SUIVI est « programmé » / « effectué » : rien à voir avec
     celui d'un projet, il ne passe donc pas par « normaliserStatut ». */
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

  /* État courant tenu dans une ref. Une fonction de mise à jour d'état React
     doit être pure : ces setters déclenchent des écritures Supabase, que
     StrictMode exécutait donc deux fois en développement — chaque
     enregistrement partait en double. En lisant l'état par la ref, l'écriture
     sort de l'updater et n'est plus jouée qu'une fois. La ref est réassignée
     immédiatement, pour que deux appels successifs dans le même gestionnaire
     s'enchaînent correctement. */
  const formationsRef = useRef(formations);
  const suivisRef = useRef(suivis);
  useEffect(() => { formationsRef.current = formations; }, [formations]);
  useEffect(() => { suivisRef.current = suivis; }, [suivis]);

  /* Un échec d'enregistrement doit se voir. Jusqu'ici l'erreur partait dans la
     console : l'utilisateur repartait convaincu d'avoir sauvegardé. */
  const signalerEchec = (error, quoi) => {
    if (!error) return false;
    console.warn(quoi, error.message);
    /* Cas particulier fréquent : la colonne « historique » (phase 3) n'existe
       pas encore. Le message brut de PostgREST est incompréhensible pour un
       agent ; on lui dit quoi faire. */
    if (/historique/i.test(error.message || "")) {
      notif("Trajectoire indisponible : exécutez « supabase-phase3-trajectoire.sql » dans Supabase.");
      return true;
    }
    if (/localite/i.test(error.message || "")) {
      notif("Localité indisponible : exécutez « supabase-phase4.sql » dans Supabase.");
      return true;
    }
    if (/date_debut|date_fin/i.test(error.message || "")) {
      notif("Dates de projet indisponibles : exécutez « supabase-phase7.sql » dans Supabase.");
      return true;
    }
    notif(`Enregistrement impossible (${quoi}) : ${error.message}`);
    return true;
  };

  /* Les setters gardent la meme signature qu'avant, mais propagent vers Supabase.

     ⚠ CE SETTER SUPPRIME EN BASE tout projet absent du nouveau tableau. C'est
     voulu pour la corbeille d'un projet — un clic, une ligne — mais c'est
     exactement par là que le portefeuille a été perdu : « setFormations »
     appelé avec les trois projets de démonstration efface, sans rien demander,
     tous les projets réels. Deux garde-fous désormais :
       - une copie de secours est prise AVANT toute suppression multiple ;
       - au-delà d'une ligne, l'appelant doit avoir demandé l'autorisation
         explicitement (« autoriserSuppressionMultiple »), sinon la suppression
         est refusée et l'écran signale l'incident. Aucun geste normal de
         l'application ne supprime deux projets d'un coup. */
  const setFormations = (fn, options) => {
    const v = formationsRef.current;
    const n = typeof fn === "function" ? fn(v) : fn;
    const apresIds = new Set(n.map((x) => x.id));
    const aSupprimer = v.filter((f) => !apresIds.has(f.id));

    if (aSupprimer.length > 1 && !(options && options.autoriserSuppressionMultiple)) {
      console.warn("Suppression multiple refusée :", aSupprimer.length, "projets");
      notif(`Opération refusée : elle aurait supprimé ${aSupprimer.length} projets d'un coup.`);
      return;
    }
    if (aSupprimer.length) sauvegardeSecours(v, suivisRef.current);

    formationsRef.current = n;
    setFormationsBrut(n);
    if (sb) {
      marquerEcritureLocale();
      n.forEach((f) => { const a = v.find((x) => x.id === f.id); if (!a || JSON.stringify(a) !== JSON.stringify(f)) sb.from("projets").upsert(projetVersRow(f)).then(({ error }) => signalerEchec(error, "projet")); });
      aSupprimer.forEach((f) => sb.from("projets").delete().eq("id", f.id).then(({ error }) => signalerEchec(error, "suppression du projet")));
    }
  };
  /* Les suivis suivent la même règle, à une nuance près : supprimer un projet
     emporte légitimement ses trois jalons. Le seuil est donc plus haut, et
     l'autorisation explicite passe par la même option. */
  const setSuivis = (fn, options) => {
    const v = suivisRef.current;
    const n = typeof fn === "function" ? fn(v) : fn;
    const apresIds = new Set(n.map((x) => x.id));
    const aSupprimer = v.filter((s) => !apresIds.has(s.id));

    // Un projet porte au plus quatre jalons (Initiale, M+3, M+6, M+12) ; le
    // seuil garde deux crans de marge pour ne jamais refuser une suppression
    // légitime, tout en restant loin d'un remplacement de portefeuille.
    if (aSupprimer.length > 6 && !(options && options.autoriserSuppressionMultiple)) {
      console.warn("Suppression multiple de suivis refusée :", aSupprimer.length);
      notif(`Opération refusée : elle aurait supprimé ${aSupprimer.length} suivis d'un coup.`);
      return;
    }
    if (aSupprimer.length) sauvegardeSecours(formationsRef.current, v);

    suivisRef.current = n;
    setSuivisBrut(n);
    if (sb) {
      marquerEcritureLocale();
      n.forEach((s) => { const a = v.find((x) => x.id === s.id); if (!a || JSON.stringify(a) !== JSON.stringify(s)) sb.from("suivis").upsert(suiviVersRow(s)).then(({ error }) => signalerEchec(error, "suivi")); });
      aSupprimer.forEach((s) => sb.from("suivis").delete().eq("id", s.id).then(({ error }) => signalerEchec(error, "suppression du suivi")));
    }
  };
  /* Mise à la corbeille d'un projet. Tant que « supprime_le » existe, rien
     n'est effacé : la ligne est marquée, l'application cesse de l'afficher, et
     elle reste restaurable. Si la migration de la phase 5 n'a pas été passée,
     on revient à l'ancienne suppression définitive — mais en le disant. */
  const mettreALaCorbeille = async (f) => {
    sauvegardeSecours(formationsRef.current, suivisRef.current);
    if (!sb || !corbeilleDispo) {
      setFormations((fs) => fs.filter((x) => x.id !== f.id));
      setSuivis((ss) => ss.filter((x) => x.formationId !== f.id));
      if (sb) notif("Projet supprimé définitivement. Exécutez « supabase-phase5.sql » pour activer la corbeille.");
      return;
    }
    marquerEcritureLocale();
    const le = new Date().toISOString();
    const { error } = await sb.from("projets")
      .update({ supprime_le: le, supprime_par: session?.email || "" }).eq("id", f.id);
    if (signalerEchec(error, "mise à la corbeille")) return;
    await sb.from("suivis").update({ supprime_le: le }).eq("projet_id", f.id);
    // L'état local suit sans repasser par les setters, qui déclencheraient
    // un DELETE : la ligne doit rester en base.
    formationsRef.current = formationsRef.current.filter((x) => x.id !== f.id);
    setFormationsBrut(formationsRef.current);
    suivisRef.current = suivisRef.current.filter((x) => x.formationId !== f.id);
    setSuivisBrut(suivisRef.current);
    setCorbeille((c) => [{ ...f, supprimeLe: le, supprimePar: session?.email || "" }, ...c]);
    notif(`« ${f.titre} » mis à la corbeille. Restaurable depuis la page Projets.`);
  };

  const restaurerDeLaCorbeille = async (f) => {
    if (!sb) return;
    marquerEcritureLocale();
    const { error } = await sb.from("projets")
      .update({ supprime_le: null, supprime_par: null }).eq("id", f.id);
    if (signalerEchec(error, "restauration")) return;
    await sb.from("suivis").update({ supprime_le: null }).eq("projet_id", f.id);
    setCorbeille((c) => c.filter((x) => x.id !== f.id));
    await chargerDonnees();          // relit projet et suivis d'un coup
    notif(`« ${f.titre} » restauré.`);
  };

  const sauverConfig = (champ, valeur) => { if (sb) { marquerEcritureLocale(); sb.from("configuration").update({ [champ]: valeur, maj_le: new Date().toISOString() }).eq("id", 1).then(({ error }) => signalerEchec(error, champ)); } };
  /* Même raison que ci-dessus : « sauverConfig » écrivait depuis l'updater. */
  const referentielRef = useRef(referentiel);
  const secteursRef = useRef(secteurs);
  const phasesRef = useRef(phases);
  useEffect(() => { referentielRef.current = referentiel; }, [referentiel]);
  useEffect(() => { secteursRef.current = secteurs; }, [secteurs]);
  useEffect(() => { phasesRef.current = phases; }, [phases]);
  const majConfig = (ref, setBrut, champ) => (fn) => {
    const n = typeof fn === "function" ? fn(ref.current) : fn;
    ref.current = n;
    setBrut(n);
    sauverConfig(champ, n);
  };
  const setReferentiel = majConfig(referentielRef, setReferentielBrut, "referentiel");
  const setSecteurs = majConfig(secteursRef, setSecteursBrut, "secteurs");
  const setPhases = majConfig(phasesRef, setPhasesBrut, "phases");
  const [comptes, setComptes] = useState([]);          // liste chargée depuis Supabase (page Utilisateurs)
  const [session, setSession] = useState(null);         // { id, email, nom, org, role }
  const [chargementAuth, setChargementAuth] = useState(true);
  /* Session ouverte par un lien « mot de passe oublié ». Tant que ce drapeau
     est levé, l'application n'affiche que l'écran de changement — voir la
     garde d'accès plus bas et le commentaire d'« EcranNouveauMdp ». */
  const [recuperationMdp, setRecuperationMdp] = useState(false);
  const roleActif = session?.role ?? "";

  /* Charger le profil et le rôle de l'utilisateur connecté.

     DEUX PRÉCAUTIONS, chacune corrigeant un défaut observé en service.

     1. Un échec de lecture ne dégrade PLUS le rôle. La ligne écrivait
        « role: r?.role || "En attente d'activation" » : si la requête
        n'aboutissait pas — réseau lent, coupure, jeton en cours de
        renouvellement — le rôle retombait sur « En attente d'activation » et
        l'utilisateur se retrouvait éjecté sur l'écran d'attente, sans avoir
        rien fait. C'est la « déconnexion forcée ». En cas d'échec, on garde
        désormais ce qu'on avait ; seule une réponse REÇUE fait autorité.

     2. L'objet de session n'est remplacé que s'il a réellement changé. Il
        était recréé à chaque appel, donc à chaque rafraîchissement de jeton :
        toute la page se reconstruisait, et les listes avec elle. */
  const chargerProfil = async (utilisateur) => {
    const { data: p, error: eP } = await sb.from("profiles").select("*").eq("id", utilisateur.id).maybeSingle();
    const { data: r, error: eR } = await sb.from("user_roles").select("role").eq("user_id", utilisateur.id).maybeSingle();
    setSession((avant) => {
      const memeCompte = avant && avant.id === utilisateur.id;
      const role = eR
        ? (memeCompte ? avant.role : "En attente d'activation")   // lecture ratée : on ne rétrograde pas
        : (r?.role || "En attente d'activation");
      const nom = eP ? (memeCompte ? avant.nom : "") : (p?.nom || "");
      const org = eP ? (memeCompte ? avant.org : "") : (p?.org || "");
      const neuf = {
        id: utilisateur.id, email: utilisateur.email, nom, org, role,
        /* Un profil est incomplet tant que l'ORGANISATION manque.
           La condition portait sur le nom : un compte nommé mais sans
           organisation entrait donc directement dans l'application, et rien ne
           le rattachait à une structure. Or « org » commande la visibilité des
           projets (« mon_org() » → « peut_voir_projet() ») : un compte sans
           organisation est un compte dont le périmètre n'est pas défini.
           Le nom, lui, ne conditionne plus rien — il n'est plus demandé et se
           déduit de l'adresse email.
           Corrigé ici plutôt qu'en base : la vérification s'applique aux
           comptes DÉJÀ créés, sans migration, dès leur prochaine connexion. */
        aFinaliser: eP ? (memeCompte ? avant.aFinaliser : false)
          : !(p && String(p.org || "").trim()),
      };
      // Référence conservée si rien n'a bougé : pas de rendu inutile.
      if (avant && ["id", "email", "nom", "org", "role", "aFinaliser"].every((k) => avant[k] === neuf[k])) return avant;
      return neuf;
    });
    setChargementAuth(false);
  };
  useEffect(() => {
    if (!sb) { setChargementAuth(false); return; }
    sb.auth.getSession().then(({ data }) => { if (data.session?.user) chargerProfil(data.session.user); else setChargementAuth(false); });
    /* Seuls les événements qui changent VRAIMENT l'utilisateur sont traités.
       « TOKEN_REFRESHED » survient tout seul, périodiquement et au retour sur
       l'onglet : il ne signifie rien d'autre que « le jeton a été renouvelé ».
       Le traiter comme une reconnexion relançait le chargement complet des
       données et recréait l'abonnement temps réel, plusieurs fois par heure. */
    const { data: abo } = sb.auth.onAuthStateChange((ev, s) => {
      /* « USER_UPDATED » est ignoré au même titre que « TOKEN_REFRESHED », et
         pour une raison précise : il survient dès que l'application appelle
         « updateUser », donc au beau milieu d'une opération qu'elle est en
         train de faire. Elle sait déjà ce qu'elle vient de changer.

         C'est ce qui bloquait l'écran de finalisation. La séquence était :
           1. updateUser(...) réussit et émet USER_UPDATED ;
           2. l'événement relance chargerProfil, qui relit « profiles » ;
           3. cette lecture part AVANT que la ligne « profiles » n'ait été
              écrite, et rend donc l'ancien profil, sans nom ni organisation ;
           4. surTermine pose aFinaliser: false ;
           5. la lecture de l'étape 3 arrive après et repose aFinaliser: true.
         L'utilisateur remplissait le formulaire et le voyait revenir vide,
         sans message d'erreur : l'enregistrement avait pourtant réussi. */
      if (ev === "TOKEN_REFRESHED" || ev === "INITIAL_SESSION" || ev === "USER_UPDATED") return;
      if (ev === "SIGNED_OUT") { setSession(null); setRecuperationMdp(false); setChargementAuth(false); return; }
      /* Retour d'un lien « mot de passe oublié ». Supabase a déjà ouvert une
         session à partir du jeton contenu dans le fragment de l'URL : c'est
         voulu, il faut être authentifié pour changer son mot de passe. On
         retient donc l'événement pour verrouiller l'application sur le seul
         écran de changement, et on nettoie l'URL — le jeton n'a plus à y
         figurer, ni dans l'historique du navigateur, ni dans un lien
         recopié. */
      if (ev === "PASSWORD_RECOVERY") {
        setRecuperationMdp(true);
        try { window.history.replaceState(null, "", window.location.pathname + window.location.search); } catch { /* navigateur restrictif */ }
      }
      if (s?.user) chargerProfil(s.user);
    });
    return () => abo.subscription.unsubscribe();
  }, []);

  // Liste des comptes (réservée au lead — la sécurité est aussi appliquée côté serveur)
  const chargerComptes = async () => {
    const { data: profils } = await sb.from("profiles").select("*").order("cree_le");
    const { data: roles } = await sb.from("user_roles").select("*");
    setComptes((profils || []).map((p) => ({ id: p.id, email: p.email, nom: p.nom || p.email, org: p.org || "Non renseignée", role: (roles || []).find((r) => r.user_id === p.id)?.role || "En attente d'activation" })));
  };
  /* Corriger l'organisation d'un compte. Réservé à l'administrateur lead — et
     pas seulement par l'interface : le déclencheur « profils_geler_org » de la
     phase 3 fige « org » dès qu'il est renseigné, en ménageant une exception
     pour « est_admin_lead() ». C'est ce qui permet cette correction sans
     rouvrir la porte à l'escalade de périmètre qu'il ferme.
     Corriger vaut mieux que supprimer : le compte garde son identifiant, son
     rôle, son historique, et la personne n'a rien à refaire. */
  const corrigerOrganisation = async (compte) => {
    const saisie = window.prompt(
      `Organisation de ${compte.nom} (${compte.email}).\n\n`
      + `Elle fixe le périmètre des projets visibles par ce compte : `
      + `une valeur erronée lui montrerait le portefeuille d'un tiers.`,
      compte.org === "Non renseignée" ? "" : compte.org);
    if (saisie === null) return;                       // annulé
    const org = saisie.trim();
    if (org.length < 2) { notif("Organisation : 2 caractères au minimum."); return; }
    if (org === compte.org) return;
    /* « .select() » est indispensable ici, et son absence est ce qui faisait
       échouer la fonction EN SILENCE. La politique RLS de la phase 1 porte
       « using (id = auth.uid()) » : elle laisse chacun modifier SA ligne, et
       personne d'autre. La ligne d'un tiers n'est donc même pas atteinte —
       PostgREST répond « 0 ligne modifiée », sans erreur, et l'application
       annonçait « Organisation mise à jour » alors que rien n'avait bougé.
       Le déclencheur « profils_geler_org » ménage bien une exception pour
       l'administrateur lead, mais il ne s'exécute jamais : la politique filtre
       la ligne avant lui. C'est « supabase-phase8.sql » qui ouvre ce droit. */
    const { data: ecrit, error } = await sb.from("profiles")
      .update({ org }).eq("id", compte.id).select("id");
    if (error) {
      notif(/42501|ne peut plus/i.test(error.message || "")
        ? "Refusé par la base : seul l'administrateur lead peut modifier une organisation déjà renseignée."
        : "Échec : " + error.message);
      return;
    }
    if (!ecrit || !ecrit.length) {
      notif("Aucune ligne modifiée : la base n'autorise pas encore la correction "
        + "du profil d'un tiers. Exécutez « supabase-phase8.sql » dans Supabase.");
      return;
    }
    notif(`Organisation de ${compte.nom} : « ${org} »`);
    chargerComptes();
  };

  /* Attribution d'un rôle. Troisième occurrence du même défaut, et la plus
     grave : un compte ACTIVÉ restait bloqué sur l'écran d'attente.
     ---------------------------------------------------------------------------
     Un compte invité n'a pas de ligne dans « user_roles » — elle n'est créée
     qu'à l'inscription ordinaire. Un UPDATE ne touchait donc aucune ligne,
     PostgREST répondait 204 comme pour une réussite, et l'application annonçait
     « Rôle mis à jour » sans que rien n'ait été écrit. L'administrateur croyait
     avoir activé l'accès ; l'utilisateur restait devant « Compte en attente
     d'activation », et aucun des deux ne pouvait comprendre pourquoi.
     UPSERT crée la ligne si elle manque, et « .select() » vérifie qu'une ligne
     a bien été écrite. L'écriture reste réservée à l'administrateur lead, en
     base : voir « supabase-phase8.sql », qui ajoute la politique INSERT
     manquante avec « with check (est_admin_lead()) ». Personne ne peut donc
     s'attribuer un rôle — la propriété vérifiée le 7 août est préservée. */
  const attribuerRole = async (userId, role) => {
    const { data: ecrit, error } = await sb.from("user_roles")
      .upsert({ user_id: userId, role }, { onConflict: "user_id" })
      .select("user_id");
    if (error) { notif("Échec : " + error.message); return; }
    if (!ecrit || !ecrit.length) {
      notif("Aucune ligne écrite : la base refuse la création d'un rôle. "
        + "Exécutez « supabase-phase8.sql » dans Supabase.");
      return;
    }
    notif(`Rôle attribué : ${role}`); chargerComptes();
  };
  const [evalId, setEvalId] = useState(null);
  const [jalonAFiger, setJalonAFiger] = useState(JALONS[0]);   // trajectoire
  const [recherche, setRecherche] = useState("");
  const [filtreZone, setFiltreZone] = useState("");       // "" = toutes
  const [filtreLocalite, setFiltreLocalite] = useState(""); // "" = toutes
  const [formOuvert, setFormOuvert] = useState(false);
  const [menuCompte, setMenuCompte] = useState(false);
  const [changeMdp, setChangeMdp] = useState(null);   // fenêtre « Changer mon mot de passe »
  const [menuMobile, setMenuMobile] = useState(false);
  const [sombre, setSombre] = useState(() => { try { return localStorage.getItem("mip-ppa-theme") === "sombre"; } catch { return false; } });
  const basculerTheme = () => setSombre((v) => { const n = !v; try { localStorage.setItem("mip-ppa-theme", n ? "sombre" : "clair"); } catch {} return n; });
  const [estMobile, setEstMobile] = useState(typeof window !== "undefined" && window.innerWidth < 768);
  /* La largeur exacte, et pas seulement le drapeau « mobile » : les graphiques
     répartissent leur place au prorata. Un seuil binaire réservait la même
     colonne de libellés à 320 px qu'à 767 px, écrasant les barres. */
  const [largeurFenetre, setLargeurFenetre] = useState(typeof window !== "undefined" ? window.innerWidth : 1280);
  useEffect(() => {
    const maj = () => { setEstMobile(window.innerWidth < 768); setLargeurFenetre(window.innerWidth); };
    window.addEventListener("resize", maj);
    return () => window.removeEventListener("resize", maj);
  }, []);
  const [editionId, setEditionId] = useState(null);
  const [suiviEdit, setSuiviEdit] = useState(null); // fenêtre Notes & date & documents
  const [dimEdit, setDimEdit] = useState(null);     // fenêtre Modifier la dimension
  const [indEdit, setIndEdit] = useState(null);     // fenêtre Modifier l'indicateur
  const [docVu, setDocVu] = useState(null);          // visionneuse de document
  const [detailStat, setDetailStat] = useState(null); // "projets" | "apprenants" | "scores"
  const [detailLocalite, setDetailLocalite] = useState(null); // nom d'une localité de la carte
  const [lectureCarte, setLectureCarte] = useState("implantation"); // ou "score"
  /* Copie de secours disponible. Relue à chaque rendu de la page Projets :
     elle est écrite hors de React (localStorage), un état figé au montage
     manquerait celle que l'opération en cours vient de prendre. */
  const secours = lireSauvegardeSecours();
  const [corbeille, setCorbeille] = useState([]);        // projets mis à la corbeille
  const [corbeilleDispo, setCorbeilleDispo] = useState(false); // migration phase 5 passée ?
  const [corbeilleOuverte, setCorbeilleOuverte] = useState(false);
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
      /* Projets + suivis.
         L'ERREUR EST RÉCUPÉRÉE, et c'est capital. Elle était ignorée : sur
         une lecture en échec — coupure réseau, jeton expiré, politique RLS
         qui refuse — PostgREST renvoie « data: null ». La liste devenait
         vide, et une base illisible se lisait exactement comme une base
         vide. L'amorçage juste en dessous s'enclenchait alors et réinjectait
         les projets de démonstration par-dessus un portefeuille bien vivant.
         Une base qu'on n'a pas su lire n'est PAS une base vide. */
      const { data: projs, error: errProjets } = await sb.from("projets").select("*").order("cree_le").order("id");
      const { data: suivs, error: errSuivis } = await sb.from("suivis").select("*").order("projet_id").order("jalon").order("id");
      if (errProjets || errSuivis) {
        const msg = (errProjets || errSuivis).message;
        console.warn("Lecture des projets:", msg);
        notif("Lecture des projets impossible. Rien n'a été modifié. " + msg);
        setChargementData(false);
        return;                       // surtout : ne rien écrire, ne rien amorcer
      }
      /* Corbeille (phase 5). La colonne peut ne pas exister : on la détecte
         sur la première ligne reçue plutôt qu'en filtrant dans la requête —
         un « .is('supprime_le', null) » sur une colonne absente ferait échouer
         toute la lecture, et l'on retomberait sur le défaut qu'on vient de
         corriger. Le tri se fait donc côté client ; à l'échelle d'un
         portefeuille d'antenne, la différence ne se mesure pas. */
      const lignes = projs || [];
      const avecCorbeille = lignes.length === 0 || "supprime_le" in lignes[0];
      setCorbeilleDispo(avecCorbeille);
      // Même détection pour le calendrier (phase 7).
      const avecDates = lignes.length === 0 || "date_debut" in lignes[0];
      datesDispoRef.current = avecDates;
      setDatesDispo(avecDates);
      const actives = lignes.filter((r) => !r.supprime_le);
      const jetees = lignes.filter((r) => r.supprime_le);
      setCorbeille(jetees.map((r) => ({ ...rowVersProjet(r), supprimeLe: r.supprime_le, supprimePar: r.supprime_par })));

      let listeProjets = actives.map(rowVersProjet);
      const idsActifs = new Set(actives.map((r) => r.id));
      let listeSuivis = (suivs || [])
        .filter((r) => !r.supprime_le && idsActifs.has(r.projet_id))
        .map(rowVersSuivi);
      /* Amorçage : la base répond, elle est réellement vide, et l'utilisateur
         est administrateur. Les trois conditions sont nécessaires. */
      if (!listeProjets.length && est_admin_amorcage()) {
        for (const f of FORMATIONS_DEMO) { await sb.from("projets").upsert(projetVersRow(f)); }
        for (const s of SUIVIS_DEMO) { await sb.from("suivis").upsert(suiviVersRow(s)); }
        listeProjets = FORMATIONS_DEMO.map((f) => ({ ...f }));
        listeSuivis = SUIVIS_DEMO.map((s) => ({ ...s }));
      }
      setFormationsBrut(listeProjets);
      setSuivisBrut(listeSuivis);
      // Copie de secours locale, à chaque chargement réussi et non vide.
      if (listeProjets.length) sauvegardeSecours(listeProjets, listeSuivis);
    } catch (e) {
      console.warn("Chargement donnees:", e.message);
      notif("Chargement impossible. Rien n'a été modifié. " + e.message);
    }
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
    /* Dépendances réduites à des valeurs SIMPLES. Avec l'objet « session »,
       l'effet se rejouait dès que cet objet était recréé — même à contenu
       identique : rechargement complet des données et abonnement temps réel
       détruit puis reconstruit, plusieurs fois par heure. C'est ce qui faisait
       sauter les listes sans raison apparente. */
  }, [session?.id, roleActif]);

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
        /* Les deux lectures sont TRIÉES, et par une clé unique. Les suivis
           étaient lus sans « order » : PostgreSQL ne promet alors aucun ordre,
           et il varie d'une lecture à l'autre. À chaque rechargement, les
           lignes se réarrangeaient donc sous le curseur, sans que rien n'ait
           changé. Le tri sur l'identifiant lève l'ambiguïté quand deux dates
           sont égales. */
        const { data: projs, error: eP } = await sb.from("projets").select("*").order("cree_le").order("id");
        const { data: suivs, error: eS } = await sb.from("suivis").select("*").order("projet_id").order("jalon").order("id");
        // Lecture en échec : on garde ce qui est à l'écran plutôt que de le vider.
        if (eP || eS) return;
        // Une ecriture locale a pu partir pendant les requetes : on abandonne ce lot.
        if (Date.now() - derniereEcritureLocale.current < DELAI_ECHO) { rechargerLeger(); return; }
        if (cfg) { if (Array.isArray(cfg.referentiel) && cfg.referentiel.length) setReferentielBrut(cfg.referentiel); if (cfg.secteurs) setSecteursBrut(normaliserSecteurs(cfg.secteurs)); if (Array.isArray(cfg.phases)) setPhasesBrut(cfg.phases); }
        /* La corbeille est respectée ici aussi. Sans ce filtre, un projet mis
           à la corbeille réapparaissait au premier rechargement temps réel :
           sa ligne existe toujours en base, elle est seulement marquée. */
        const actifs = (projs || []).filter((r) => !r.supprime_le);
        const idsActifs = new Set(actifs.map((r) => r.id));
        setFormationsBrut(actifs.map(rowVersProjet));
        setSuivisBrut((suivs || [])
          .filter((r) => !r.supprime_le && idsActifs.has(r.projet_id))
          .map(rowVersSuivi));
        setCorbeille((projs || []).filter((r) => r.supprime_le)
          .map((r) => ({ ...rowVersProjet(r), supprimeLe: r.supprime_le, supprimePar: r.supprime_par })));
      } catch (e) {}
    };
    rechargeTimer.current = setTimeout(executer, 600);
  };
  useEffect(() => () => { if (rechargeTimer.current) clearTimeout(rechargeTimer.current); }, []);
  const [nouvelle, setNouvelle] = useState(PROJET_VIERGE());
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
    if (!REGEX_EMAIL.test(email)) { notif("Adresse email invalide. Vérifiez le format, par exemple nom@organisation.ci"); return; }
    const suggestion = suggestionDomaine(email);
    if (suggestion) {
      const corrige = email.split("@")[0] + "@" + suggestion;
      const veutCorriger = window.confirm(`Vouliez-vous dire « ${corrige} » au lieu de « ${email} » ?\n\nOK pour corriger automatiquement, Annuler pour envoyer tel quel.`);
      if (veutCorriger) { setEmailInvite(corrige); notif("Adresse corrigée. Cliquez à nouveau sur Envoyer pour confirmer"); return; }
    }
    setEnvoiInvite(true);
    try {
      const { data, error } = await sb.functions.invoke("inviter", { body: { email } });
      if (error || (data && data.erreur)) throw new Error((data && data.erreur) || error.message);
      notif("Invitation envoyée à " + email);
      setEmailInvite("");
    } catch (e) {
      // Repli : la fonction serveur n'est pas (encore) déployée -> messagerie pré-remplie
      notif("Envoi direct indisponible (" + (e.message || e) + ") : ouverture de votre messagerie");
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
    /* Trous d'évaluation : un jalon dont l'échéance est dépassée alors que des
       indicateurs restent à noter. Distinct du suivi en retard — celui-ci
       signale une démarche non faite, celui-là un score qui ne veut encore
       rien dire. Un projet peut avoir tous ses suivis à jour et rester
       inévaluable, ou l'inverse. */
    const trousEval = formationsVisibles.map((f) => {
      const jalonsDepasses = suivis.filter((s) => s.formationId === f.id
        && s.statut === "programmé" && joursRestants(s.echeance) < 0);
      if (!jalonsDepasses.length) return null;
      const manquants = indicateursNonNotes(referentiel, f.notes);
      if (!manquants.length) return null;
      return {
        formation: f,
        manquants,
        jalons: jalonsDepasses.map((s) => s.jalon).join(", "),
        couverture: couvertureModele(referentiel, f.notes),
      };
    }).filter(Boolean);
    /* Incohérences de calendrier. Ce sont des défauts de SAISIE, pas des
       jugements sur le projet : une date de fin dépassée alors que le statut
       reste « En cours » signifie seulement que personne n'est revenu clore la
       fiche. C'est précisément ce que les deux dates permettent de voir, et
       que rien ne signalait tant que le calendrier n'était pas connu. */
    const aujourdhui = new Date(aujourdhuiUTC()).toISOString().slice(0, 10);
    const calendrier = formationsVisibles
      .map((f) => ({ formation: f, anomalies: anomaliesCalendrier(f, aujourdhui) }))
      .filter((x) => x.anomalies.length);
    return {
      nb: formationsVisibles.length,
      apprenants: formationsVisibles.reduce((a, f) => a + Number(f.apprenants || 0), 0),
      budget: formationsVisibles.reduce((a, f) => a + Number(f.budget || 0), 0),
      moy, alertes: alertesScore.length + enRetard.length + trousEval.length + calendrier.length,
      alertesScore, enRetard, trousEval, calendrier,
    };
  }, [formationsVisibles, suivis, referentiel]);

  const radarData = useMemo(() =>
    referentiel.map((d) => {
      const vals = formationsVisibles.map((f) => scoreDimension(referentiel, d.id, f.notes)).filter((v) => v !== null);
      return { dim: d.nom, score: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0 };
    }), [formationsVisibles, referentiel]);

  /* Nombre de projets par localité, pour la carte du tableau de bord. On
     repasse par « normaliserLocalite » plutôt que de lire le champ brut : un
     projet créé avant la phase 4, ou dont la zone a changé depuis, n'en a pas
     de valable, et il compte alors pour le chef-lieu de sa zone. Aucun projet
     n'est ainsi absent de la carte. */
  const projetsParLocalite = useMemo(() => {
    const map = {};
    formationsVisibles.forEach((f) => {
      const l = normaliserLocalite(f.localite, f.region);
      if (l) map[l] = (map[l] || 0) + 1;
    });
    return map;
  }, [formationsVisibles]);

  /* Portefeuille tel que la liste l'affiche : recherche plein texte, puis
     zone, puis localité. Le calcul était écrit deux fois — une fois pour la
     vue tableau, une fois pour la vue cartes du mobile — et les deux copies
     devaient être modifiées ensemble.
     Note : les exports restent sur le portefeuille entier, comme ils le
     faisaient déjà pour la recherche. Un export est un livrable, il ne doit
     pas dépendre de l'état d'un filtre d'écran. */
  const projetsFiltres = useMemo(() => formationsVisibles.filter((f) => {
    const texte = (f.titre + f.entreprise + f.filiere + (f.secteurGrand || "") + (f.domaine || ""))
      .toLowerCase().includes(recherche.toLowerCase());
    if (!texte) return false;
    if (filtreZone && normaliserRegion(f.region) !== filtreZone) return false;
    if (filtreLocalite && normaliserLocalite(f.localite, f.region) !== filtreLocalite) return false;
    return true;
  }), [formationsVisibles, recherche, filtreZone, filtreLocalite]);

  /* Score moyen par implantation, pour la seconde lecture de la carte.
     Moyenne des scores globaux des projets de la zone ; « null » si aucun
     n'est noté — une zone non évaluée n'est pas une zone en échec. */
  const scoreParZone = useMemo(() => {
    const acc = {};
    formationsVisibles.forEach((f) => {
      const s = scoreGlobal(referentiel, f.notes);
      if (s === null) return;
      const z = normaliserRegion(f.region);
      (acc[z] = acc[z] || []).push(s);
    });
    const out = {};
    IMPLANTATIONS.forEach((z) => {
      out[z] = acc[z] && acc[z].length ? acc[z].reduce((a, b) => a + b, 0) / acc[z].length : null;
    });
    return out;
  }, [formationsVisibles, referentiel]);

  const filiereData = useMemo(() => {
    const map = {};
    formationsVisibles.forEach((f) => {
      const s = scoreGlobal(referentiel, f.notes);
      if (s === null) return;
      const cle = libelleSecteur(f, secteurs); if (!map[cle]) map[cle] = []; map[cle].push(s);
    });
    return Object.entries(map).map(([fil, arr]) => ({ filiere: fil, score: arr.reduce((a, b) => a + b, 0) / arr.length }));
  }, [formationsVisibles, referentiel]);

  /* Colonne des libellés du graphique « Score moyen par secteur ».
     On part d'un plafond — 36 % de l'écran sur mobile, entre 88 et 150 px —
     dont on déduit le nombre de caractères par ligne (≈ 0,58 × la taille de
     police). Puis on redescend à la largeur que les libellés occupent
     vraiment une fois découpés : le texte étant aligné à droite dans sa
     colonne, toute largeur réservée en trop reste en vide à gauche et fait
     pencher le graphique vers la droite. */
  const axeSecteur = useMemo(() => {
    const police = estMobile ? 10 : 11;
    const plafond = estMobile ? Math.round(Math.min(150, Math.max(88, largeurFenetre * 0.36))) : 240;
    const caracteres = Math.max(10, Math.floor(plafond / (police * 0.58)));
    const plusLarge = filiereData.reduce(
      (m, d) => Math.max(m, ...decouperLibelle(d.filiere, caracteres).map((l) => largeurTexte(l, police))), 0);
    return { caracteres, police, largeur: Math.min(plafond, Math.ceil(plusLarge) + 10) };
  }, [estMobile, largeurFenetre, filiereData]);

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
    n ? `, ${n} ${mot}${n > 1 ? "s" : ""} mis à jour` : "";

  const noter = (fid, indId, note) => {
    setFormations((fs) => fs.map((f) => {
      if (f.id !== fid) return f;
      const notes = { ...f.notes };
      if (notes[indId] === note) delete notes[indId]; else notes[indId] = note;
      return { ...f, notes };
    }));
  };
  // Jour courant au format « AAAA-MM-JJ », en UTC comme tout le reste.
  const jourISO = () => new Date(aujourdhuiUTC()).toISOString().slice(0, 10);

  /* Recale les trois échéances de suivi d'un projet sur son calendrier.
     Un jalon déjà EFFECTUÉ n'est pas touché : sa date est un fait constaté,
     pas une prévision, et la déplacer réécrirait l'historique du projet. */
  const recalerEcheances = (projetId, dateFin) => {
    const ech = echeancesSuivi(dateFin, jourISO());
    if (!Object.keys(ech).length) return 0;
    let touches = 0;
    setSuivis((ss) => ss.map((s) => {
      if (s.formationId !== projetId || s.statut === "effectué") return s;
      const neuve = ech[s.jalon];
      if (!neuve || neuve === s.echeance) return s;
      touches++;
      return { ...s, echeance: neuve };
    }));
    return touches;
  };

  const ajouterFormation = () => {
    if (!nouvelle.titre.trim() || !nouvelle.entreprise.trim()) { notif("Renseignez au minimum l'intitulé et le promoteur"); return; }
    /* Une fin antérieure au lancement est refusée à la saisie, et pas
       seulement signalée après coup : toute la suite en dépend — la durée
       affichée, les trois échéances, la lecture de la fiche. */
    if (estDateISO(nouvelle.dateDebut) && estDateISO(nouvelle.dateFin)
      && nouvelle.dateFin < nouvelle.dateDebut) {
      notif("La date de fin ne peut pas précéder la date de lancement."); return;
    }
    if (editionId) {
      setFormations((fs) => fs.map((f) => f.id === editionId ? { ...f, ...nouvelle } : f));
      const n = recalerEcheances(editionId, nouvelle.dateFin);
      setEditionId(null); setFormOuvert(false);
      setNouvelle(PROJET_VIERGE());
      notif("Projet mis à jour" + (n ? `, ${n} échéance${n > 1 ? "s" : ""} de suivi recalée${n > 1 ? "s" : ""}` : "")); return;
    }
    const id = "f" + Date.now();
    setFormations((fs) => [...fs, { id, ...nouvelle, notes: {} }]);
    /* Point d'origine du suivi post-formation : la date de FIN du projet.
       « M+3 » veut dire trois mois après la fin de la formation, pas trois
       mois après la saisie de la fiche — c'est ce que dit le modèle MIP-PPA,
       et ce que l'application faisait faute de connaître le calendrier. À
       défaut de date de fin, on retombe sur le jour courant, comme avant. */
    const ech = echeancesSuivi(nouvelle.dateFin, jourISO());
    JALONS_SUIVI.forEach(([j], i) => {
      setSuivis((ss) => [...ss, { id: "s" + Date.now() + i, formationId: id, jalon: j, echeance: ech[j] || "", statut: "programmé", note: "", docs: [] }]);
    });
    setFormOuvert(false);
    setNouvelle(PROJET_VIERGE());
    notif("Projet créé, avec 3 suivis planifiés (M+3, M+6, M+12"
      + (estDateISO(nouvelle.dateFin) ? " après la fin du projet)" : " à compter d'aujourd'hui, faute de date de fin)"));
  };
  const editerFormation = (f) => {
    setNouvelle({ titre: f.titre, entreprise: f.entreprise, operateur: f.operateur || "", beneficiaire: f.beneficiaire || "", secteurGrand: f.secteurGrand || grandSecteurDe(secteurs, f.filiere), filiere: f.filiere, domaine: f.domaine || "", region: normaliserRegion(f.region), localite: normaliserLocalite(f.localite, f.region), apprenants: f.apprenants, budget: f.budget, statut: f.statut, dateDebut: f.dateDebut || "", dateFin: f.dateFin || "" });
    setEditionId(f.id); setFormOuvert(true); setPage("formations");
  };

  /* ---------- DONNEES COMMUNES AUX DEUX EXPORTS ---------- */
  /* ---------- SAUVEGARDE ET RESTAURATION ----------
     Le classeur Excel est un livrable de communication : il porte des scores
     déjà calculés, pas les notes qui les produisent, ni les identifiants, ni
     les suivis. On ne peut donc pas le réinjecter — un import du classeur
     rendrait des projets sans notes, ce qui est pire que rien.
     La sauvegarde ci-dessous est l'exact opposé : illisible pour un humain,
     mais complète et fidèle. C'est elle qui ferme la boucle ouverte le 8 août,
     quand le portefeuille a été perdu sans aucun moyen de le remonter. */
  const VERSION_SAUVEGARDE = 1;

  const exporterSauvegarde = () => {
    const contenu = {
      format: "mip-ppa/sauvegarde",
      version: VERSION_SAUVEGARDE,
      le: new Date().toISOString(),
      parcompte: session?.email || "",
      projets: formations,
      suivis: suivis,
      referentiel, secteurs, phases,
    };
    const nom = `Sauvegarde_MIP-PPA_${new Date().toISOString().slice(0, 10)}.json`;
    telecharger(nom, JSON.stringify(contenu, null, 1), "application/json");
    notif(`Sauvegarde de ${formations.length} projets téléchargée`);
  };

  /* La restauration n'efface RIEN : elle ajoute ce qui manque et remplace ce
     qui porte le même identifiant. Un projet créé depuis la sauvegarde reste
     donc en place. C'est volontaire — une restauration doit réparer une
     perte, pas en provoquer une seconde. */
  const importerSauvegarde = async (fichier) => {
    if (!fichier) return;
    let data;
    try {
      data = JSON.parse(await fichier.text());
    } catch (e) {
      notif("Fichier illisible : ce n'est pas une sauvegarde MIP-PPA.");
      return;
    }
    if (!data || data.format !== "mip-ppa/sauvegarde" || !Array.isArray(data.projets)) {
      notif("Ce fichier n'est pas une sauvegarde MIP-PPA.");
      return;
    }
    if (Number(data.version) > VERSION_SAUVEGARDE) {
      notif("Sauvegarde produite par une version plus récente de l'application.");
      return;
    }
    const connus = new Set(formations.map((f) => f.id));
    const nouveaux = data.projets.filter((p) => p && p.id && !connus.has(p.id));
    const remplaces = data.projets.filter((p) => p && p.id && connus.has(p.id));
    const quand = data.le ? new Date(data.le).toLocaleString("fr-FR") : "date inconnue";
    if (!window.confirm(
      `Sauvegarde du ${quand}, ${data.projets.length} projets.\n\n` +
      `${nouveaux.length} seront ajoutés.\n` +
      `${remplaces.length} déjà présents seront remplacés par la version sauvegardée.\n` +
      `Aucun projet ne sera supprimé.\n\n` +
      `Restaurer ?`)) return;

    sauvegardeSecours(formations, suivis);
    // Les notes et l'historique sont repris tels quels ; la zone et la
    // localité repassent par les normalisateurs, au cas où la sauvegarde
    // daterait d'avant la nomenclature actuelle.
    const propres = data.projets.filter((p) => p && p.id).map((p) => ({
      ...p,
      region: normaliserRegion(p.region),
      localite: normaliserLocalite(p.localite, p.region),
      statut: normaliserStatut(p.statut),
      notes: p.notes || {},
      historique: Array.isArray(p.historique) ? p.historique : [],
    }));
    const ids = new Set(propres.map((p) => p.id));
    setFormations((fs) => [...fs.filter((f) => !ids.has(f.id)), ...propres]);
    if (Array.isArray(data.suivis)) {
      const idsS = new Set(data.suivis.filter((s) => s && s.id).map((s) => s.id));
      setSuivis((ss) => [...ss.filter((s) => !idsS.has(s.id)), ...data.suivis.filter((s) => s && s.id)]);
    }
    notif(`${propres.length} projets restaurés (${nouveaux.length} ajoutés, ${remplaces.length} remplacés)`);
  };

  /* ---------- REPRISE D'UN CLASSEUR EXPORTÉ ----------
     Le classeur n'a jamais été prévu pour être relu : c'est un livrable de
     communication. Ce qu'il contient et ce qu'il ne contient PAS décide de ce
     que cette reprise peut rendre.

     IL CONTIENT   intitulé, promoteur, secteur, matière première, domaine,
                   zone, localité (depuis le 8 août), apprenants, budget,
                   statut, et les scores PAR DIMENSION.
     IL NE CONTIENT PAS  l'identifiant, l'opérateur, le bénéficiaire, les
                   NOTES par indicateur, les suivis et leurs pièces jointes.

     Les notes ne sont donc pas reconstituables, et elles ne sont PAS
     inventées : un score de dimension est une moyenne de notes 0–4, et une
     infinité de jeux de notes donnent la même moyenne. Fabriquer des notes
     plausibles produirait une évaluation fausse mais d'apparence complète,
     ce qui est pire que pas d'évaluation du tout.
     Les scores lus sont en revanche conservés tels quels, en instantané
     marqué « repris d'un export » : l'évaluateur voit où le projet en était
     avant de le noter à nouveau. */

  // Rapprochement des en-têtes : insensible aux accents, à la casse et aux
  // espaces, pour accepter les classeurs des versions antérieures.
  const clefColonne = (s) => String(s == null ? "" : s)
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\(.*?\)/g, "").replace(/[^a-zA-Z]/g, "").toLowerCase();

  const analyserTableau = (matrice) => {
    // La ligne d'en-têtes est la première qui porte « Projet » ET « Promoteur ».
    let iEnt = -1;
    for (let i = 0; i < Math.min(matrice.length, 12); i++) {
      const c = (matrice[i] || []).map(clefColonne);
      if (c.includes("projet") && c.includes("promoteur")) { iEnt = i; break; }
    }
    if (iEnt < 0) return { erreur: "En-têtes introuvables : ce fichier ne vient pas de l'export MIP-PPA." };
    const entetes = (matrice[iEnt] || []).map(clefColonne);
    const col = (nom) => entetes.indexOf(clefColonne(nom));
    const iDim = referentiel.map((d) => ({ id: d.id, i: entetes.indexOf(clefColonne(d.nom)) }));

    const lignes = [];
    for (let i = iEnt + 1; i < matrice.length; i++) {
      const r = matrice[i] || [];
      const titre = String(r[col("Projet")] ?? "").trim();
      if (!titre) continue;                       // ligne vide ou pied de tableau
      const nombre = (v) => {
        const n = Number(String(v ?? "").replace(/[^\d.,-]/g, "").replace(",", "."));
        return Number.isFinite(n) ? n : 0;
      };
      const dims = {};
      iDim.forEach(({ id, i: j }) => {
        if (j < 0) return;
        const v = String(r[j] ?? "").trim();
        if (v !== "") dims[id] = nombre(v);
      });
      /* Une cellule de date revient sous trois formes selon le chemin
         emprunté : un objet Date (classeur XLSX relu par ExcelJS), la chaîne
         ISO écrite par le CSV, ou une date déjà mise en forme à la française
         si quelqu'un a retouché le fichier. Les trois sont acceptées, et tout
         ce qui n'est aucune des trois est simplement ignoré — mieux vaut une
         date absente qu'une date fausse. */
      const dateCellule = (v) => {
        if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
        const s = String(v ?? "").trim();
        if (!s) return "";
        if (estDateISO(s)) return s.slice(0, 10);
        const fr = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
        if (fr) {
          const iso = `${fr[3]}-${fr[2].padStart(2, "0")}-${fr[1].padStart(2, "0")}`;
          return estDateISO(iso) ? iso : "";
        }
        return "";
      };
      const region = normaliserRegion(String(r[col("Zone")] ?? "").trim());
      lignes.push({
        titre,
        entreprise: String(r[col("Promoteur")] ?? "").trim(),
        secteurGrand: String(r[col("Secteur")] ?? "").trim(),
        filiere: String(r[col("Matière première")] ?? "").trim(),
        domaine: String(r[col("Domaine")] ?? "").trim(),
        region,
        localite: normaliserLocalite(String(r[col("Localité")] ?? "").trim(), region),
        apprenants: nombre(r[col("Apprenants")]),
        budget: nombre(r[col("Budget")]),
        statut: normaliserStatut(String(r[col("Statut")] ?? "").trim()),
        dateDebut: col(COL_DATE_DEBUT) >= 0 ? dateCellule(r[col(COL_DATE_DEBUT)]) : "",
        dateFin: col(COL_DATE_FIN) >= 0 ? dateCellule(r[col(COL_DATE_FIN)]) : "",
        scoreLu: col("Score global") >= 0 && String(r[col("Score global")] ?? "").trim() !== ""
          ? nombre(r[col("Score global")]) : null,
        dimensions: dims,
      });
    }
    const manquantes = ["Localité", "Domaine", "Secteur", COL_DATE_DEBUT, COL_DATE_FIN].filter((c) => col(c) < 0);
    return { lignes, manquantes, dimensionsLues: iDim.filter((d) => d.i >= 0).length };
  };

  const lireCsv = (texte) => {
    /* Analyseur minimal mais correct : le point-virgule sépare, les
       guillemets protègent, et « "" » est un guillemet littéral. La mention
       institutionnelle de la première ligne contient des virgules et des
       points — elle est simplement ignorée, faute d'en-têtes. */
    const out = [];
    let ligne = [], champ = "", dansGuillemets = false;
    const t = texte.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      if (dansGuillemets) {
        if (c === '"') { if (t[i + 1] === '"') { champ += '"'; i++; } else dansGuillemets = false; }
        else champ += c;
      } else if (c === '"') dansGuillemets = true;
      else if (c === ";") { ligne.push(champ); champ = ""; }
      else if (c === "\n") { ligne.push(champ); out.push(ligne); ligne = []; champ = ""; }
      else champ += c;
    }
    if (champ !== "" || ligne.length) { ligne.push(champ); out.push(ligne); }
    return out;
  };

  const lireXlsx = async (fichier) => {
    const ExcelJS = (await import("exceljs")).default || (await import("exceljs"));
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await fichier.arrayBuffer());
    const ws = wb.worksheets[0];
    const out = [];
    ws.eachRow({ includeEmpty: true }, (row) => {
      const vals = [];
      row.eachCell({ includeEmpty: true }, (cell, i) => {
        const v = cell.value;
        vals[i - 1] = v && typeof v === "object"
          ? (v.result ?? v.text ?? v.richText?.map((x) => x.text).join("") ?? "")
          : v;
      });
      out.push(vals);
    });
    return out;
  };

  const reprendreClasseur = async (fichier) => {
    if (!fichier) return;
    let matrice;
    try {
      matrice = /\.xlsx$/i.test(fichier.name)
        ? await lireXlsx(fichier)
        : lireCsv(await fichier.text());
    } catch (e) {
      notif("Fichier illisible : " + (e && e.message));
      return;
    }
    const a = analyserTableau(matrice);
    if (a.erreur) { notif(a.erreur); return; }
    if (!a.lignes.length) { notif("Aucun projet trouvé dans ce fichier."); return; }

    /* Rapprochement sur le couple intitulé + promoteur : l'export ne porte pas
       d'identifiant. Un projet déjà présent est laissé intact — la reprise
       sert à combler un trou, pas à écraser ce qui a survécu. */
    const memeProjet = (a1, b1) => memeNom(a1.titre, b1.titre) && memeNom(a1.entreprise, b1.entreprise);
    const nouveaux = a.lignes.filter((l) => !formations.some((f) => memeProjet(f, l)));
    const deja = a.lignes.length - nouveaux.length;

    if (!window.confirm(
      `Reprise d'un classeur exporté : ${a.lignes.length} projets lus.\n\n` +
      `${nouveaux.length} seront ajoutés.\n` +
      `${deja} sont déjà présents et seront laissés intacts.\n\n` +
      `SERONT REPRIS : intitulé, promoteur, secteur, matière première, domaine, ` +
      `zone, localité, apprenants, budget, statut, dates de lancement et de fin.\n\n` +
      `NE PEUVENT PAS L'ÊTRE, car absents du classeur :\n` +
      `• les notes des ${referentiel.reduce((n, d) => n + d.indicateurs.length, 0)} indicateurs ` +
      `(le classeur ne porte que les moyennes par dimension) ;\n` +
      `• l'opérateur et le bénéficiaire ;\n` +
      `• les suivis et leurs pièces jointes.\n\n` +
      `Les scores lus seront conservés en repère sur la fiche d'évaluation, ` +
      `mais chaque projet devra être noté à nouveau.\n` +
      `Dimensions reconnues dans le fichier : ${a.dimensionsLues} sur ${referentiel.length}.` +
      (a.dimensionsLues < referentiel.length
        ? ` Les autres ont dû être renommées depuis l'export : leurs scores ne seront pas repris.`
        : "") + `\n\n` +
      `Continuer ?`)) return;

    sauvegardeSecours(formations, suivis);
    const base = Date.now();
    const projets = nouveaux.map((l, k) => ({
      id: "imp" + base + k,
      titre: l.titre, entreprise: l.entreprise, operateur: "", beneficiaire: "",
      secteurGrand: l.secteurGrand, filiere: l.filiere, domaine: l.domaine,
      region: l.region, localite: l.localite,
      apprenants: l.apprenants, budget: l.budget, statut: l.statut,
      dateDebut: l.dateDebut || "", dateFin: l.dateFin || "",
      notes: {},                                  // aucune note inventée
      historique: Object.keys(l.dimensions).length || l.scoreLu !== null ? [{
        jalon: "Initiale",
        date: new Date().toISOString().slice(0, 10),
        score: l.scoreLu,
        couverture: null, notees: null,
        dimensions: l.dimensions,
        repris: true,                             // marque : lu, non recalculé
      }] : [],
    }));
    setFormations((fs) => [...fs, ...projets]);
    // Les trois jalons de suivi sont recréés, comme à la création d'un projet.
    const suivisNeufs = [];
    projets.forEach((p, k) => {
      // Même origine qu'à la création : la date de fin du projet si le
      // classeur la portait, le jour courant sinon.
      const ech = echeancesSuivi(p.dateFin, jourISO());
      JALONS_SUIVI.forEach(([j], i) => {
        suivisNeufs.push({
          id: "imps" + base + k + "_" + i, formationId: p.id, jalon: j,
          echeance: ech[j] || "", statut: "programmé", note: "",
        });
      });
    });
    setSuivis((ss) => [...ss, ...suivisNeufs]);
    notif(`${projets.length} projets repris. Notes à ressaisir.`
      + (a.manquantes.length ? ` Colonnes absentes du fichier : ${a.manquantes.join(", ")}.` : ""));
  };

  /* Les deux colonnes de calendrier sont posées APRÈS « Statut » et AVANT les
     scores : « iPremierScore » se déduit de la position de la dernière colonne
     descriptive, et non d'un index écrit en dur. C'est la leçon de la colonne
     « Localité », qui avait décalé les formats de nombre d'un cran. */
  const COL_DATE_DEBUT = "Date de lancement", COL_DATE_FIN = "Date de fin";
  const colonnesExport = () => ["Projet", "Promoteur", "Secteur", "Matière première", "Domaine", "Zone", "Localité",
    "Apprenants", "Budget (FCFA)", "Statut", COL_DATE_DEBUT, COL_DATE_FIN,
    ...referentiel.map((d) => `${d.nom} (%)`), "Score global (%)", "Niveau"];

  // Valeurs typées : les nombres restent des nombres, pour que le tableur
  // puisse trier, filtrer et sommer sans réinterprétation.
  const lignesExport = () => formationsVisibles.map((f) => {
    const g = scoreGlobal(referentiel, f.notes);
    return [
      f.titre, f.entreprise,
      f.secteurGrand || grandSecteurDe(secteurs, f.filiere), f.filiere, f.domaine || "", f.region,
      normaliserLocalite(f.localite, f.region),
      Number(f.apprenants) || 0, Number(f.budget) || 0, f.statut,
      /* Dates au format ISO « AAAA-MM-JJ » dans la donnée partagée : c'est la
         seule écriture qui se trie correctement en texte et que la reprise
         relit sans ambiguïté. Le classeur les convertit ensuite en vraies
         dates Excel, affichées en JJ/MM/AAAA (voir « exportXlsx »). */
      estDateISO(f.dateDebut) ? f.dateDebut : "",
      estDateISO(f.dateFin) ? f.dateFin : "",
      ...referentiel.map((d) => { const sc = scoreDimension(referentiel, d.id, f.notes); return sc === null ? null : Math.round(sc); }),
      g === null ? null : Math.round(g), niveau(g).txt,
    ];
  });

  const horodatageExport = () => new Date().toLocaleString("fr-FR", {
    timeZone: "UTC", dateStyle: "long", timeStyle: "short",
  });

  /* Mentions institutionnelles condensées sur une seule ligne : organisme,
     certification et horodatage de l'export. Une ligne au lieu de quatre —
     les en-têtes de colonnes remontent d'autant, et le tableau commence
     presque en haut du fichier. */
  const mentionsFDFP = () => [
    "FDFP - Fonds de Développement de la Formation Professionnelle",
    "Certifié ISO 9001 v2015 par Bureau Norme Audit - BNA/SMQ-FDCS03112513",
    "Sur tous nos processus et tous nos sites",
    `Export du ${horodatageExport()} (GMT+0)`,
  ].join("  ·  ");

  /* ---------- EXPORT XLSX (classeur mis en forme, avec le bandeau) ----------
     ExcelJS est chargé à la demande : Vite en fait un fragment séparé, il
     n'alourdit donc pas le premier affichage de l'application.
     En cas d'échec (bibliothèque absente, navigateur ancien), on retombe
     sur le CSV plutôt que de laisser l'utilisateur sans export.          */
  const exportXlsx = async () => {
    try {
      const mod = await import("exceljs");
      const ExcelJS = mod.default || mod;

      const wb = new ExcelJS.Workbook();
      wb.creator = "Plateforme FDFP MIP-PPA";
      wb.created = new Date();

      const entetes = colonnesExport();
      const donnees = lignesExport();
      const LIGNE_ENTETES = 4;                       // 1 image + 1 mentions + 1 vide

      const ws = wb.addWorksheet("Portefeuille MIP-PPA", {
        views: [{ state: "frozen", ySplit: LIGNE_ENTETES }],
        pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
      });

      // -- Bandeau de certification, en tête de feuille --
      const idImage = wb.addImage({ base64: CERTIFICATION_FDFP.split(",")[1], extension: "png" });
      ws.addImage(idImage, { tl: { col: 0, row: 0 }, ext: { width: 384, height: 90 } });
      ws.getRow(1).height = 72;

      // -- Mentions institutionnelles, sur une seule ligne (ligne 2) --
      const cMentions = ws.getCell(2, 1);
      cMentions.value = `${mentionsFDFP()}  ·  ${donnees.length} projet${donnees.length > 1 ? "s" : ""}`;
      cMentions.font = { size: 9, color: { argb: "FF0E3C60" } };
      cMentions.alignment = { vertical: "middle" };

      // -- Ligne d'en-têtes --
      const ligneE = ws.getRow(LIGNE_ENTETES);
      ligneE.values = entetes;
      ligneE.height = 28;
      ligneE.eachCell((c) => {
        c.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0E3C60" } };
        c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        c.border = { bottom: { style: "thin", color: { argb: "FFF2A33C" } } };
      });

      // -- Données --
      /* Index déduits des en-têtes, et non écrits en dur : ils étaient figés
         à 6 / 7 / 9, si bien qu'insérer une colonne — « Localité » — décalait
         silencieusement les formats de nombre d'une colonne vers la gauche.
         Un budget se serait affiché en pourcentage. */
      const iApprenants = entetes.indexOf("Apprenants");
      const iBudget = entetes.indexOf("Budget (FCFA)");
      const iDateDebut = entetes.indexOf(COL_DATE_DEBUT);
      const iDateFin = entetes.indexOf(COL_DATE_FIN);
      const iPremierScore = entetes.indexOf(COL_DATE_FIN) + 1;   // index 0
      donnees.forEach((ligne) => {
        const r = ws.addRow(ligne);
        r.eachCell({ includeEmpty: true }, (c, numCol) => {
          const i = numCol - 1;
          c.alignment = { vertical: "middle", wrapText: i === 0 };
          if (i === iApprenants) c.numFmt = "#,##0";
          else if (i === iBudget) c.numFmt = '#,##0 "FCFA"';
          else if (i === iDateDebut || i === iDateFin) {
            /* Vraie date Excel, pas du texte : le classeur doit pouvoir trier
               le portefeuille par date de fin et calculer des écarts. Midi UTC
               plutôt que minuit — Excel raisonne en heure locale, et minuit
               bascule d'un jour dans les fuseaux à l'ouest. */
            if (estDateISO(c.value)) {
              c.value = new Date(String(c.value) + "T12:00:00Z");
              c.numFmt = "dd/mm/yyyy";
              c.alignment = { vertical: "middle", horizontal: "center" };
            }
          } else if (i >= iPremierScore && i < entetes.length - 1) c.numFmt = '0" %"';
        });
        // Pastille de niveau, aux couleurs de l'application
        const cellNiveau = r.getCell(entetes.length);
        const nv = niveau(ligne[entetes.length - 2]);
        cellNiveau.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + nv.bg.slice(1).toUpperCase() } };
        cellNiveau.font = { bold: true, color: { argb: nv.fg === "#fff" ? "FFFFFFFF" : "FF57534E" } };
        cellNiveau.alignment = { vertical: "middle", horizontal: "center" };
      });

      // -- Largeurs de colonnes --
      const largeurs = [42, 20, 18, 24, 22, 20, 16, 12, 18, 13, 16, 14];
      entetes.forEach((_, i) => { ws.getColumn(i + 1).width = largeurs[i] || 14; });

      if (donnees.length) {
        ws.autoFilter = {
          from: { row: LIGNE_ENTETES, column: 1 },
          to: { row: LIGNE_ENTETES + donnees.length, column: entetes.length },
        };
      }

      const buffer = await wb.xlsx.writeBuffer();
      telechargerBinaire("MIP-PPA_portefeuille.xlsx", buffer,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      notif("Classeur Excel téléchargé");
    } catch (e) {
      console.warn("Export XLSX indisponible :", e && e.message);
      notif("Classeur Excel indisponible : export CSV à la place");
      exportCsv();
    }
  };

  /* ---------- EXPORT CSV (données brutes, pour l'analyse) ----------
     Conservé à côté du XLSX : c'est le format le plus simple à relire dans
     un outil statistique. Le CSV ne pouvant pas porter d'image, la
     certification y figure en toutes lettres. Les libellés sont entre
     guillemets, sinon un point-virgule les découperait en colonnes.     */
  const exportCsv = () => {
    const lignes = lignesExport().map((l) => l.map((v) => (v === null ? "" : v)).join(";"));
    telecharger("MIP-PPA_portefeuille.csv",
      [`"${mentionsFDFP()}"`, "", colonnesExport().join(";"), ...lignes].join("\n"));
    notif("Données CSV téléchargées");
  };


  const fichePDF = async (f) => {
    const g = scoreGlobal(referentiel, f.notes);
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const W = 210, M = 16;
    let y = 0;
    const bleu = [29, 111, 168], orange = [242, 163, 60], gris = [90, 90, 90];
    const nv = niveau(g);
    const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

    /* Logo institutionnel, aux angles arrondis. Le fichier est un JPEG à fond
       blanc : posé tel quel sur le bandeau bleu nuit, il y découpait un
       rectangle à angles droits. On restreint donc le tracé à un rectangle
       arrondi avant de poser l'image, de sorte que son fond blanc suive la
       même courbe. Repli sur un dessin simple si la version de jsPDF ne gère
       pas le détourage — mieux vaut des angles droits que pas de logo. */
    const poserLogo = (x, y, w, h, r) => {
      try {
        doc.saveGraphicsState();
        doc.roundedRect(x, y, w, h, r, r, null);   // null : tracé, sans peinture
        doc.clip();
        doc.discardPath();
        doc.addImage(LOGO_FDFP, "JPEG", x, y, w, h);
        doc.restoreGraphicsState();
      } catch (e) {
        try { doc.restoreGraphicsState(); } catch (e2) { /* état déjà propre */ }
        try { doc.addImage(LOGO_FDFP, "JPEG", x, y, w, h); } catch (e2) { /* sans logo */ }
      }
    };

    // ------ En-tête institutionnel ------
    doc.setFillColor(13, 34, 51); doc.rect(0, 0, W, 30, "F");
    poserLogo(M, 5.5, 42, 19, 2.6);
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(14);
    doc.text(nettoyerPdf("FICHE D'EVALUATION MIP-PPA"), W - M, 13, { align: "right" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.text(nettoyerPdf("Projet Apprentissage - Industrie agroalimentaire"), W - M, 19, { align: "right" });
    doc.setDrawColor(...orange); doc.setLineWidth(1.6); doc.line(0, 30, W, 30);
    y = 40;

    // ------ Identification de la formation ------
    doc.setTextColor(20, 20, 20); doc.setFont("helvetica", "bold"); doc.setFontSize(13);
    doc.text(doc.splitTextToSize(nettoyerPdf(f.titre), W - 2 * M), M, y); y += 7 * doc.splitTextToSize(nettoyerPdf(f.titre), W - 2 * M).length;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...gris);
    /* La zone seule ne situe pas le projet — l'antenne de Korhogo couvre
       dix-sept departements. La localite l'accompagne donc ici aussi : la
       fiche circule hors de l'application, sans la carte sous les yeux.
       Ces deux lignes d'identification sont desormais decoupees comme le
       titre au-dessus : posees d'un bloc, elles sortaient dans la marge au
       lieu de passer a la ligne. Mesure jsPDF sur un cas reel du
       portefeuille — « Promoteur : FrieslandCampina - Transformation des
       fruits et legumes - Antenne Yamoussoukro » : 151 mm pour 178 mm
       utiles, mais 185,2 mm des que la localite s'y ajoute. C'est bien la
       mention ajoutee ici qui fait deborder, d'ou le decoupage. */
    const ligne = (txt) => {
      const lignes = doc.splitTextToSize(nettoyerPdf(txt), W - 2 * M);
      doc.text(lignes, M, y);
      y += 5.5 * lignes.length;
    };
    const locPdf = normaliserLocalite(f.localite, f.region);
    ligne(`Promoteur : ${f.entreprise}  -  ${f.filiere}  -  ${f.region}${locPdf ? ` (${locPdf})` : ""}`);
    if (f.operateur || f.beneficiaire) ligne(`${f.operateur ? "Opérateur : " + f.operateur : ""}${f.operateur && f.beneficiaire ? "  -  " : ""}${f.beneficiaire ? "Bénéficiaire : " + f.beneficiaire : ""}`);
    ligne(`${f.apprenants} apprenants  -  Budget : ${fmtFCFA(f.budget)}  -  Statut : ${f.statut}`);
    /* Calendrier du projet. La fiche circule seule, souvent imprimée : sans
       cette ligne, un lecteur ne sait pas si le « M+12 » qu'il a sous les yeux
       est attendu le mois prochain ou l'an dernier. Posée par « ligne() »
       comme les deux précédentes, donc découpée si elle déborde.
       Accentuée comme ses voisines : « nettoyerPdf » ne translittère plus les
       accents, et les polices standard de jsPDF les rendent parfaitement. */
    if (estDateISO(f.dateDebut) || estDateISO(f.dateFin)) {
      const duree = dureeLisible(f.dateDebut, f.dateFin);
      ligne(estDateISO(f.dateDebut) && estDateISO(f.dateFin)
        ? `Période : du ${fmtDateFr(f.dateDebut)} au ${fmtDateFr(f.dateFin)}${duree ? `  -  durée : ${duree}` : ""}`
        : estDateISO(f.dateDebut)
          ? `Lancement le ${fmtDateFr(f.dateDebut)}  -  fin non renseignée`
          : `Fin le ${fmtDateFr(f.dateFin)}  -  lancement non renseigné`);
    }
    y += 3.5;

    // ------ Score global ------
    doc.setFillColor(...hexRgb(nv.bg === "#e7e5e4" ? "#a8a29e" : nv.bg)); doc.roundedRect(M, y, W - 2 * M, 16, 2.5, 2.5, "F");
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(12);
    doc.text(nettoyerPdf(`SCORE GLOBAL MIP-PPA : ${fmtPct(g)} - ${nv.txt}`), W / 2, y + 10, { align: "center" });
    y += 20;
    /* Couverture : la fiche PDF circule hors de l'application, souvent seule et
       parfois imprimée. Sans cette ligne, rien n'indique au lecteur qu'un
       « 100 % - Excellent » peut ne reposer que sur les 4 indicateurs de
       conception, sur les 23 que compte le modèle. */
    {
      const c = couvertureModele(referentiel, f.notes);
      doc.setFont("helvetica", c.pct < 100 ? "bold" : "normal"); doc.setFontSize(8.5);
      doc.setTextColor(...(c.pct < 100 ? [150, 90, 10] : gris));
      doc.text(nettoyerPdf(
        c.notees
          ? `Couverture du modele : ${Math.round(c.pct)} % - ${c.notees} indicateur(s) note(s) sur ${c.indicateurs}`
            + (c.pct < 100 ? " - evaluation partielle, score non comparable a une evaluation complete." : "")
          : "Aucun indicateur note a ce jour."),
        W / 2, y, { align: "center" });
      y += 5;
    }
    /* Marge au palier. Le lecteur du PDF n'a pas l'application sous les yeux :
       il voit « 59 % - Moyen » sans savoir que 0,6 point le separe du niveau
       superieur. La mention est donc reprise ici, avec le maillon faible, pour
       que la fiche imprimee porte l'information d'action et pas seulement le
       verdict. Silence au-dela de 5 points : le palier n'est plus en jeu. */
    {
      const m = margeSeuil(referentiel, f.notes);
      const faible = referentiel
        .map((d) => ({ nom: d.nom, s: scoreDimension(referentiel, d.id, f.notes) }))
        .filter((x) => x.s !== null)
        .sort((a, b) => a.s - b.s)[0];
      const pts = (v) => `${v.toFixed(1).replace(".", ",")} point${v >= 2 ? "s" : ""}`;
      let phrase = null;
      if (m && m.versLeHaut !== null && m.versLeHaut <= 5) {
        phrase = `A ${pts(m.versLeHaut)} du niveau ${niveau(m.seuilHaut).txt}`
          + (m.crans ? ` - ${m.crans} cran${m.crans > 1 ? "s" : ""} sur un indicateur ${m.crans > 1 ? "suffisent" : "suffit"}.` : ".");
      } else if (m && m.depuisLeBas !== null && m.depuisLeBas <= 5 && m.depuisLeBas > 0) {
        phrase = `Seulement ${pts(m.depuisLeBas)} au-dessus du seuil : niveau fragile.`;
      }
      if (phrase) {
        if (faible) phrase += ` Maillon faible : ${faible.nom} (${fmtPct(faible.s)}).`;
        doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(150, 90, 10);
        // Repli sur plusieurs lignes : un nom de dimension renomme par le FDFP
        // peut allonger la phrase au-dela de la largeur utile.
        const lignes = doc.splitTextToSize(nettoyerPdf(phrase), W - 2 * M);
        lignes.forEach((l) => { doc.text(l, W / 2, y, { align: "center" }); y += 4.2; });
        y += 0.8;
      }
      y += 3;
    }

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
    /* Pied de page. Le bandeau de certification y est intégré, centré juste
       au-dessus du filet orange : il accompagne les mentions institutionnelles
       au lieu de s'imposer en pleine largeur au fil du document. Il occupait
       auparavant un bloc de 120 mm inséré dans le corps — et se retrouvait en
       double, la fonction étant appelée une fois avant l'annexe et une fois
       après. 45 mm est un compromis : discret, mais assez large pour que le QR
       code reste lisible à l'impression. */
    const BAS_CONTENU = 270;   // le pied occupe désormais les 15 derniers mm
    /* « total » permet d'annoncer le bon nombre de pages quand des annexes PDF
       seront fusionnées ensuite : jsPDF ne les connaît pas encore, et la fiche
       affichait « Page 1 / 2 » sur un document qui en comptait cinq. */
    let piedPose = false;   // interdit tout second passage : il se superposerait
    const pied = (total) => {
      if (piedPose) return;
      piedPose = true;
      const pages = doc.getNumberOfPages();
      const nbTotal = total || pages;
      const L = 45, H = (L * 181) / 768;   // ratio natif du bandeau (768x181)
      for (let p = 1; p <= pages; p++) {
        doc.setPage(p);
        try { doc.addImage(CERTIFICATION_FDFP, "PNG", (W - L) / 2, 283.5 - H, L, H); } catch (e) {}
        doc.setDrawColor(...orange); doc.setLineWidth(0.6); doc.line(M, 285, W - M, 285);
        doc.setFontSize(7.5); doc.setTextColor(...gris); doc.setFont("helvetica", "normal");
        doc.text(nettoyerPdf("FDFP - Fonds de Développement de la Formation Professionnelle - Modèle MIP-PPA - PFE ESA/INP-HB"), M, 290);
        doc.text(nettoyerPdf(`Page ${p} / ${nbTotal} - Édité le ${new Date().toLocaleDateString("fr-FR")}`), W - M, 290, { align: "right" });
      }
    };
    const sautSiBesoin = (h) => { if (y + h > BAS_CONTENU) { doc.addPage(); y = 20; } };

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
        // Chargé à la demande depuis le bundle local (plus depuis jsdelivr) :
        // l'annexe Word fonctionne désormais sans accès réseau.
        const mod = await import("mammoth");
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

    // ------ Annexe : fusion des PDF joints, page a page ------
    const pdfsJoints = [];
    suivisF.forEach((s) => (s.docs || []).forEach((d) => {
      if (((d.type || "").includes("pdf") || /\.pdf$/i.test(d.nom)) && d.data) pdfsJoints.push({ jalon: s.jalon, d });
    }));
    const nomFichier = `Fiche_MIP-PPA_${f.entreprise.replace(/\s+/g, "_")}.pdf`;
    const MENTION = "FDFP - Fonds de Développement de la Formation Professionnelle - Modèle MIP-PPA - PFE ESA/INP-HB";
    const LE_JOUR = new Date().toLocaleDateString("fr-FR");

    if (pdfsJoints.length) {
      try {
        // pdf-lib vient du bundle local : l'annexe ne dépend pas du réseau.
        const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");

        /* Les annexes sont ouvertes AVANT que le pied ne soit posé : leur
           nombre de pages entre dans le total. Sans cela, jsPDF numérotait sur
           les seules pages qu'il connaissait et une fiche de cinq pages
           annonçait « Page 1 / 2 ». */
        const annexes = [];
        for (const { jalon, d } of pdfsJoints) {
          try {
            const octets = Uint8Array.from(atob(d.data.split(",")[1]), (c) => c.charCodeAt(0));
            annexes.push({ jalon, d, ext: await PDFDocument.load(octets) });
          } catch (e) { /* PDF joint illisible : ignoré, l'encart descriptif reste */ }
        }
        const pagesFiche = doc.getNumberOfPages();
        // chaque annexe ajoute sa page de garde, puis ses propres pages
        const pagesAnnexes = annexes.reduce((n, a) => n + 1 + a.ext.getPageCount(), 0);
        pied(pagesFiche + pagesAnnexes);

        const base = await PDFDocument.load(doc.output("arraybuffer"));
        const police = await base.embedFont(StandardFonts.Helvetica);

        /* Géométrie des pages d'annexe. Les positions sont comptées depuis le
           BAS : pdf-lib a son origine en bas à gauche.
           « HAUT_PIED » est la bande réservée au pied — bandeau de
           certification (10,6 mm posés à 13,5 mm du bord), filet orange et
           mentions —, arrondie au millimètre supérieur. */
        const MM_PT = 2.8346;                          // 1 mm en points PDF
        const LARGEUR_A4 = 595.28, HAUTEUR_A4 = 841.89;
        const LARG_BANDEAU = 45 * MM_PT;
        const HAUT_BANDEAU = (LARG_BANDEAU * 181) / 768;
        const HAUT_PIED = 13.5 * MM_PT + HAUT_BANDEAU + 2 * MM_PT;

        for (const { jalon, d, ext } of annexes) {
          const garde = base.addPage();
          const { height } = garde.getSize();
          garde.drawText(nettoyerPdf(`Annexe - ${jalon} - ${d.nom}`), { x: 40, y: height - 60, size: 13, font: police });
          garde.drawText(nettoyerPdf("Document joint dans la plateforme MIP-PPA"), { x: 40, y: height - 80, size: 9, font: police });
          /* Les pages jointes ne sont pas recopiées telles quelles : elles
             sont EMBARQUÉES puis redessinées, légèrement réduites, dans une
             page A4 neuve dont les derniers millimètres sont laissés libres
             pour le pied.
             Recopier la page à l'identique obligeait à choisir entre deux
             mauvaises solutions : laisser le pied se mélanger au contenu de
             l'annexe, ou poser un fond opaque qui masquait ce que l'annexe
             avait écrit dans sa marge basse. Réduire ne cache rien : tout le
             document joint reste lisible, et le pied a sa propre bande.
             C'est ce que fait « ajuster à la page » d'une imprimante.
             Le facteur est plafonné à 1 : une page plus petite qu'une A4 —
             un ticket, une photo — n'est jamais agrandie. */
          const embarquees = await base.embedPages(ext.getPages());
          for (const emb of embarquees) {
            const pg = base.addPage([LARGEUR_A4, HAUTEUR_A4]);
            const dispoL = LARGEUR_A4 - 2 * M * MM_PT;
            const dispoH = HAUTEUR_A4 - HAUT_PIED - 6 * MM_PT;
            const k = Math.min(dispoL / emb.width, dispoH / emb.height, 1);
            pg.drawPage(emb, {
              x: (LARGEUR_A4 - emb.width * k) / 2,
              y: HAUT_PIED + (dispoH - emb.height * k) / 2,
              xScale: k, yScale: k,
            });
          }
        }

        /* Pied des pages d'annexe. Elles proviennent de documents externes :
           jsPDF ne les a jamais vues, elles n'ont donc ni filet, ni mentions,
           ni numéro. Les positions sont comptées depuis le BAS de page — pdf-lib
           a son origine en bas à gauche, et une annexe peut ne pas être en A4. */
        /* Le pied se pose maintenant dans une bande LIBRE : les pages
           d'annexe ont été redessinées plus haut, réduites juste ce qu'il
           faut. Plus rien à masquer, plus rien qui se chevauche. */
        const total = base.getPageCount();
        let bandeau = null;
        try { bandeau = await base.embedPng(CERTIFICATION_FDFP); } catch (e) { /* sans bandeau */ }
        base.getPages().forEach((pg, i) => {
          if (i < pagesFiche) return;         // déjà traitées par jsPDF
          const { width } = pg.getSize();
          if (bandeau) {
            pg.drawImage(bandeau, {
              x: (width - LARG_BANDEAU) / 2, y: 13.5 * MM_PT,
              width: LARG_BANDEAU, height: HAUT_BANDEAU,
            });
          }
          pg.drawLine({
            start: { x: M * MM_PT, y: 12 * MM_PT }, end: { x: width - M * MM_PT, y: 12 * MM_PT },
            thickness: 0.6 * MM_PT, color: rgb(242 / 255, 163 / 255, 60 / 255),
          });
          const droite = nettoyerPdf(`Page ${i + 1} / ${total} - Édité le ${LE_JOUR}`);
          const gris01 = rgb(0.35, 0.35, 0.35);
          pg.drawText(nettoyerPdf(MENTION), { x: M * MM_PT, y: 7 * MM_PT, size: 7.5, font: police, color: gris01 });
          pg.drawText(droite, {
            x: width - M * MM_PT - police.widthOfTextAtSize(droite, 7.5),
            y: 7 * MM_PT, size: 7.5, font: police, color: gris01,
          });
        });

        const octetsFinal = await base.save();
        const blob = new Blob([octetsFinal], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url;
        a.download = nomFichier; a.click();
        URL.revokeObjectURL(url);
        notif(`Fiche PDF (${total} pages, annexes incluses) téléchargée`);
        return;
      } catch (e) {
        // pdf-lib indisponible : on retombe sur la fiche seule, sans annexes
        console.warn("Fusion des annexes impossible :", e && e.message);
      }
    }
    pied();                       // fiche seule : le total est le nombre de pages jsPDF
    doc.save(nomFichier);
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
    dashboard: ["Tableau de bord MIP-PPA", "Vision consolidée des projets de formation de type Apprentissage (emploi-qualification) dans les industries agroalimentaires."],
    formations: ["Projets de formation de type apprentissage", "Portefeuille des projets de formation financés par le FDFP."],
    evaluation: ["Évaluation", fEval ? fEval.titre : "Sélectionnez un projet à évaluer."],
    suivi: ["Suivi du niveau de performance", "Évaluations à 3, 6 et 12 mois."],
    indicateurs: ["Référentiel des indicateurs", "Modèle MIP-PPA (dimensions, pondérations, indicateurs)."],
    alertes: ["Alertes & risques", "Projets sous-performants et suivis en retard."],
    exports: ["Exports", "Fiches PDF et tableaux Excel pour les rapports FDFP."],
    guide: ["Guide d'utilisation", "Tout ce qu'il faut savoir pour utiliser la plateforme MIP-PPA."],
    users: ["Utilisateurs & rôles", "Attribution des accès à la plateforme."],
  };

  // =================== GARDE D'ACCÈS =============================
  if (!sb) return <EcranConfiguration />;
  if (chargementAuth) {
    return <CadreAccueil enfants={<div className="text-sky-100 text-sm page-anim">Connexion au serveur…</div>} />;
  }
  if (!session) return (<><EcranConnexion /><Toast msg={toast} /></>);
  /* Avant toute autre garde : une session ouverte par un lien de récupération
     ne sert qu'à changer le mot de passe. Placé ici, l'écran s'impose même à
     un compte déjà activé et même si le profil est complet. */
  if (recuperationMdp) {
    return (<>
      <EcranNouveauMdp email={session.email}
        surTermine={() => { setRecuperationMdp(false); notif("Mot de passe modifié."); }}
        surAnnuler={() => { setRecuperationMdp(false); sb.auth.signOut(); setSession(null); }} />
      <Toast msg={toast} />
    </>);
  }
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
        .horloge-fuseau{ font-size:.6rem; font-weight:600; color:#57534e; margin-left:.3rem; }
        .sombre .horloge-date, .sombre .horloge-fuseau{ color:#a9b4bf; }
        /* L'horloge fait foi pour les échéances et sert aussi de témoin de
           déploiement : elle doit rester visible sur téléphone. Plutôt que de
           l'effacer faute de place, on la comprime par paliers — d'abord la
           date en JJ/MM, puis les secondes, puis le trait de séparation. */
        .horloge-date-courte{ display:none; }
        @media (max-width:820px){
          .horloge-date-longue{ display:none; }
          .horloge-date-courte{ display:inline; }
          .horloge-utc{ padding-right:.55rem; }
          .horloge-heure{ font-size:.85rem; }
        }
        @media (max-width:400px){
          .horloge-utc{ padding-right:.4rem; border-right:none; }
          .horloge-date{ font-size:.62rem; }
          .horloge-heure{ font-size:.8rem; }
          .horloge-fuseau{ font-size:.55rem; margin-left:.2rem; }
        }
        /* Les secondes défilent : c'est la preuve visible que l'horloge tourne,
           on les garde donc sur les téléphones courants (360 px et plus). Sous
           340 px seulement, elles coûtent une ligne de titre : on les retire. */
        @media (max-width:340px){ .horloge-secondes{ display:none; } }
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
        /* ---------- CARTE DES ZONES DE COUVERTURE ----------
           Les textes des cartes ne sont pas des éléments Tailwind : ils sont
           posés dans le SVG, où « fill » remplace « color ». Ils ont donc
           leurs propres règles, ici et dans le bloc du mode sombre.       */
        .carte-etiquette{ fill:#1c1917; }
        .carte-etiquette-discrete{ fill:#57534e; }
        .carte-hors-zone{ fill:#f5f5f4; }
        /* ---------- MODE SOMBRE ---------- */
        .sombre .carte-etiquette{ fill:#e7e5e4; }
        .sombre .carte-etiquette-discrete{ fill:#94a3b8; }
        .sombre .carte-hors-zone{ fill:#16222f; }
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
        /* Infobulle : Recharts la dimensionne sur une seule ligne
           (« white-space:nowrap » en style en ligne). Un libellé de secteur
           complet — « Secteur secondaire · Cacao · Transformation semi-finie »
           — produisait une bulle de 402 px dans un écran de 320 px, dont les
           trois quarts hors de l'écran. On borne la largeur et on autorise le
           retour à la ligne ; le « !important » est indispensable, le style en
           ligne l'emporterait autrement.                                    */
        .recharts-default-tooltip{
          max-width:min(260px,70vw)!important;
          white-space:normal!important;
        }
        .recharts-tooltip-label{ white-space:normal!important; overflow-wrap:anywhere; }
        .recharts-tooltip-item{ white-space:normal!important; }
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
        /* Rendu à l'intérieur de la zone de contenu : largeur identique à
           celle des cartes, sans calcul de gouttière à refaire. */
        .pied-certification{
          width:100%;
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
        /* Plafond à 48 rem = 768 px, la largeur native de l'image : elle
           occupe le bandeau sans jamais être agrandie, ce qui garderait
           le QR code net mais flou à l'agrandissement. */
        .pied-certification img{
          width:100%; max-width:48rem; height:auto; display:block;
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
          {/* « LogoFDFP » porte déjà sa plaque blanche : l'envelopper dans un
              second « cadre-logo » superposait deux plaques et deux marges. */}
          <LogoFDFP h={30} />
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
            <button onClick={() => setPage("guide")} className="hidden sm:flex text-sm text-stone-600 hover:text-stone-900 items-center gap-1.5" title="Ouvrir le guide d'utilisation."><Icone n="livre" t={16} /> Guide</button>
            <button onClick={basculerTheme} className="hidden sm:block text-stone-500 hover:text-stone-800 shrink-0" title={sombre ? "Passer en mode éclairé" : "Passer en mode sombre"} aria-label={sombre ? "Passer en mode éclairé" : "Passer en mode sombre"}>
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
                  {/* Changer son mot de passe sans passer par l'oubli. Sinon
                      le seul chemin pour en changer serait de prétendre
                      l'avoir perdu, et de dépendre de sa boîte mail. */}
                  <button onClick={() => { setChangeMdp({ actuel: "", nouveau: "", confirmation: "", msg: null, envoi: false }); setMenuCompte(false); }}
                    className="w-full text-left text-sm px-3 py-2 rounded-lg hover:bg-stone-50 flex items-center gap-2"><Icone n="bouclier" t={15} /> Changer mon mot de passe</button>
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
                surClic={() => setDetailStat("apprenants")} indice="Voir le nombre d'apprenants par projet" />
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
                {/* Le rayon est volontairement en retrait du cadre : c'est la
                    couronne ainsi libérée qui accueille les libellés sur
                    plusieurs lignes, d'autant plus étroite que l'écran l'est. */}
                <RadarChart data={radarData} outerRadius={estMobile ? "54%" : "72%"}>
                  <PolarGrid stroke="#e7e5e4" />
                  <PolarAngleAxis dataKey="dim" tick={<TickRadar mobile={estMobile} />} />
                  {/* Graduations masquées. Recharts les empile le long d'un
                      rayon, par-dessus le polygone : « 0 25 50 75 100 » se
                      chevauchaient sur la surface colorée sans être lisibles.
                      L'échelle reste donnée par la grille, et la valeur exacte
                      par l'infobulle — rien n'est perdu. */}
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar dataKey="score" stroke={C.vert} fill={C.vert} fillOpacity={0.35} />
                  <Tooltip formatter={(v) => `${Math.round(v)} %`} />
                </RadarChart>
              </ResponsiveContainer>
              {/* Équivalent textuel. Recharts produit un SVG que rien
                  n'annonce : sans cette liste, la page n'expose aucun des
                  chiffres du graphique à qui ne le voit pas. « sr-only » la
                  réserve aux lecteurs d'écran — le graphique reste seul à
                  l'affichage. */}
              <ul className="sr-only">
                {radarData.map((d) => (
                  <li key={d.dim}>{d.dim} : {Math.round(d.score)} %</li>
                ))}
              </ul>
            </section>

            {/* ---------- CARTE DU PORTEFEUILLE ----------
                Le radar dit sur quoi les projets sont bons, la carte dit où
                ils sont. Le champ « Zone » ne le disait pas : huit
                implantations pour 108 départements, un projet « Antenne
                Korhogo » pouvait aussi bien être à Korhogo qu'à Odienné, à
                200 km de là. */}
            <section className="bg-white rounded-2xl border border-stone-200 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-bold">Implantation des projets</h3>
                  <p className="text-sm text-stone-500 mb-2">
                    {lectureCarte === "score"
                      ? "Chaque zone prend la couleur du niveau moyen de ses projets. La taille des pastilles suit toujours le nombre de projets."
                      : "Nombre de projets par localité. La taille de chaque pastille suit le nombre de projets, et sa couleur l'implantation de rattachement."}
                  </p>
                </div>
                {/* Compter les projets ne dit pas comment ils se portent :
                    une antenne peut en porter dix et tous les rater. La même
                    carte se relit donc au niveau moyen. */}
                <div className="flex rounded-lg border border-stone-200 overflow-hidden shrink-0" role="group"
                  aria-label="Choisir ce que la couleur des zones représente">
                  {[["implantation", "Implantation"], ["score", "Niveau moyen"]].map(([cle, txt]) => (
                    <button key={cle} onClick={() => setLectureCarte(cle)}
                      aria-pressed={lectureCarte === cle}
                      className={"text-xs px-3 py-1.5 font-medium " + (lectureCarte === cle ? "text-white" : "bg-white text-stone-600 hover:bg-stone-50")}
                      style={lectureCarte === cle ? { background: C.vertFonce } : undefined}>
                      {txt}
                    </button>
                  ))}
                </div>
              </div>
              {Object.keys(projetsParLocalite).length ? (
                <>
                  <CarteNationale comptes={projetsParLocalite} scores={scoreParZone}
                    lecture={lectureCarte} sombre={sombre}
                    surClic={(d) => setDetailLocalite(d.n)} />
                  {/* Légende. En lecture « implantation » : les huit zones et
                      leur part du portefeuille — une couleur sans total ne se
                      lit pas. En lecture « score » : les quatre paliers du
                      modèle, plus le gris des zones non évaluées. */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
                    {lectureCarte === "score" ? (<>
                      {[["Insuffisant", C.insuffisant], ["Moyen", C.dev], ["Satisfaisant", C.satisfaisant], ["Excellent", C.excellent], ["Non évaluée", "#a8a29e"]].map(([t, c]) => (
                        <span key={t} className="inline-flex items-center gap-1.5 text-xs">
                          <span className="inline-block w-3 h-3 rounded-sm shrink-0" style={{ background: c }} />
                          <span className="font-medium">{t}</span>
                        </span>
                      ))}
                    </>) : IMPLANTATIONS.map((z) => {
                      const n = formationsVisibles.filter((f) => normaliserRegion(f.region) === z).length;
                      return (
                        <span key={z} className={"inline-flex items-center gap-1.5 text-xs " + (n ? "" : "opacity-40")}>
                          <span className="inline-block w-3 h-3 rounded-sm shrink-0" style={{ background: couleurZone(z) }} />
                          <span className="font-medium">{z}</span>
                          <span className="text-stone-500">{n}</span>
                        </span>
                      );
                    })}
                  </div>
                  <LegendeFond sombre={sombre} />
                  {/* Les pastilles de la carte portent les chiffres ; cette
                      liste les redonne à qui ne voit pas le dessin. */}
                  <ul className="sr-only">
                    {Object.entries(projetsParLocalite)
                      .sort((a, b) => b[1] - a[1])
                      .map(([loc, n]) => (
                        <li key={loc}>{loc} : {n} projet{n > 1 ? "s" : ""}</li>
                      ))}
                    {IMPLANTATIONS.filter((z) => scoreParZone[z] !== null).map((z) => (
                      <li key={z}>{z} : niveau moyen {fmtPct(scoreParZone[z])}, {niveau(scoreParZone[z]).txt}</li>
                    ))}
                  </ul>
                  <MentionCarte />
                </>
              ) : (
                <p className="text-sm text-stone-500 py-8 text-center">Aucun projet à localiser.</p>
              )}
            </section>

            <section className="bg-white rounded-2xl border border-stone-200 p-5">
              <h3 className="font-bold">Score moyen par secteur</h3>
              <p className="text-sm text-stone-500 mb-2">Comparaison sectorielle.</p>
              <ResponsiveContainer width="100%" height={Math.max(72, 66 * filiereData.length) + 40}>
                <BarChart data={filiereData} layout="vertical" margin={{ left: 6, right: 18 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                  {/* La colonne des libellés se règle au prorata de l'écran. À
                      150 px fixes, elle mangeait 150 des 247 px disponibles sur
                      un téléphone de 320 px : il ne restait presque rien pour
                      les barres, seule information utile du graphique. */}
                  <YAxis type="category" dataKey="filiere" width={axeSecteur.largeur} interval={0}
                    tick={({ x, y, payload }) => {
                      // Découpe le libellé en lignes complètes (aucune condensation)
                      const lignes = decouperLibelle(payload.value, axeSecteur.caracteres);
                      return (
                        <text x={x} y={y} textAnchor="end" fill="#57534e" fontSize={axeSecteur.police}>
                          {lignes.map((l, i) => <tspan key={i} x={x - 4} dy={i === 0 ? -((lignes.length - 1) * 5.5) + 4 : 12}>{l}</tspan>)}
                        </text>
                      );
                    }} />
                  <Tooltip formatter={(v) => `${Math.round(v)} %`} />
                  <Bar dataKey="score" fill={C.vert} radius={[0, 6, 6, 0]} barSize={26} />
                </BarChart>
              </ResponsiveContainer>
              <ul className="sr-only">
                {filiereData.map((d) => (
                  <li key={d.filiere}>{d.filiere} : {Math.round(d.score)} %</li>
                ))}
              </ul>
            </section>

            <section className="bg-white rounded-2xl border border-stone-200 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><h3 className="font-bold">Projets de formation de type apprentissage (emploi-qualification) récents</h3><p className="text-sm text-stone-500">Cliquez pour évaluer ou consulter.</p></div>
                <button onClick={() => setPage("formations")} className="text-sm font-semibold hover:underline" style={{ color: C.vert }}>Tout voir →</button>
              </div>
              <div className="divide-y divide-stone-100 mt-2">
                {formationsVisibles.slice(-4).map((f) => (
                  <button key={f.id} onClick={() => { setEvalId(f.id); setPage("evaluation"); }}
                    className="w-full flex items-center justify-between gap-4 py-3.5 text-left hover:bg-stone-50 px-2 rounded-lg">
                    {/* « min-w-0 » : sans lui, le bloc de texte refuse de
                        descendre sous la largeur de son plus long mot et
                        chasse la pastille hors du bouton sur petit écran. */}
                    <div className="min-w-0">
                      <div className="font-semibold break-words">{f.titre}</div>
                      <div className="text-sm text-stone-500 break-words">{f.entreprise} · {libelleSecteur(f, secteurs)} · {f.apprenants} apprenants</div>
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
                aria-label="Rechercher un projet par entreprise, intitulé ou secteur"
                className="flex-1 min-w-[240px] bg-white border border-stone-200 rounded-full px-5 py-2.5 text-sm outline-none focus:border-stone-400" />
              {/* Filtres géographiques. La carte du tableau de bord montre où
                  sont les projets, mais la liste ne s'y rangeait pas : un
                  responsable d'antenne n'avait aucun moyen de n'afficher que
                  les siens. Changer de zone remet la localité à zéro — elle
                  n'appartient plus forcément à la nouvelle zone. */}
              <select value={filtreZone} onChange={(e) => { setFiltreZone(e.target.value); setFiltreLocalite(""); }}
                aria-label="Filtrer les projets par zone de couverture"
                title="N'afficher que les projets d'une implantation."
                className="bg-white border border-stone-200 rounded-full px-4 py-2.5 text-sm">
                <option value="">Toutes les zones</option>
                {IMPLANTATIONS.map((z) => <option key={z} value={z}>{z}</option>)}
              </select>
              <select value={filtreLocalite} onChange={(e) => setFiltreLocalite(e.target.value)}
                aria-label="Filtrer les projets par localité"
                title="N'afficher que les projets d'une localité."
                className="bg-white border border-stone-200 rounded-full px-4 py-2.5 text-sm">
                <option value="">Toutes les localités</option>
                {/* Sans zone choisie, seules les localités qui portent des
                    projets sont proposées : dérouler les 108 pour en trouver
                    trois n'aiderait personne. */}
                {(filtreZone ? localitesDe(filtreZone)
                             : Object.keys(projetsParLocalite).sort((a, b) => a.localeCompare(b, "fr"))
                 ).map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
              {(filtreZone || filtreLocalite) && (
                <button onClick={() => { setFiltreZone(""); setFiltreLocalite(""); }}
                  className="text-sm text-stone-600 hover:text-stone-900 underline">
                  Retirer les filtres
                </button>
              )}
              {(P.exportXlsx || P.exportCsv) && (
                <div className="flex items-center gap-2">
                  {P.exportXlsx && <button onClick={exportXlsx} className="bg-white border border-stone-200 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-stone-50" title="Classeur Excel mis en forme, avec le bandeau de certification."><Icone n="telecharger" t={15} /> Excel</button>}
                  {P.exportCsv && <button onClick={exportCsv} className="bg-white border border-stone-200 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-stone-50" title="Données brutes séparées par des points-virgules, pour un outil d'analyse."><Icone n="fichier" t={15} /> CSV</button>}
                </div>
              )}
              {/* ⚠ Ce bouton REMPLACE le portefeuille : il supprime en base
                  tous les projets qui ne sont pas dans le jeu de démonstration.
                  Il s'intitulait « Données démo » et son infobulle disait
                  « Restaurer les 3 projets de démonstration » — rien n'annonçait
                  une destruction, aucune confirmation n'était demandée, et il
                  était offert à tous les rôles, y compris à ceux qui n'ont pas
                  le droit de supprimer un seul projet. C'est ainsi que le
                  portefeuille a été perdu.
                  Désormais : réservé à qui peut supprimer, intitulé explicite,
                  confirmation chiffrée, et copie de secours préalable. */}
              {P.supprimerFormation && (
                <button
                  onClick={() => {
                    const n = formations.length;
                    const perdus = formations.filter((f) => !FORMATIONS_DEMO.some((d) => d.id === f.id)).length;
                    if (perdus > 0 && !window.confirm(
                      `Cette action REMPLACE le portefeuille par les 3 projets de démonstration.\n\n` +
                      `${perdus} projet${perdus > 1 ? "s" : ""} sur ${n} ${perdus > 1 ? "seront supprimés" : "sera supprimé"} de la base, ainsi que leurs suivis et leurs notes.\n\n` +
                      `Une copie de secours sera gardée dans ce navigateur, mais elle ne vaut pas une sauvegarde.\n\n` +
                      `Confirmer le remplacement ?`)) return;
                    sauvegardeSecours(formations, suivis);
                    setFormations(FORMATIONS_DEMO, { autoriserSuppressionMultiple: true });
                    setSuivis(SUIVIS_DEMO, { autoriserSuppressionMultiple: true });
                    notif("Portefeuille remplacé par les données de démonstration");
                  }}
                  className="text-sm text-stone-600 hover:text-red-700"
                  title="Remplace le portefeuille par les 3 projets de démonstration. Les autres projets sont supprimés.">
                  <Icone n="rotation" t={14} /> Remplacer par la démo
                </button>
              )}
              {/* La corbeille ne s'affiche que si elle contient quelque chose :
                  un bouton vide n'apprend rien et encombre la barre. */}
              {corbeille.length > 0 && (
                <button onClick={() => setCorbeilleOuverte(true)}
                  className="text-sm text-stone-600 hover:text-stone-900"
                  title="Projets mis à la corbeille, restaurables.">
                  <Icone n="poubelle" t={14} /> Corbeille ({corbeille.length})
                </button>
              )}
              {/* Retour en arrière, tant que la copie de secours est là. */}
              {P.sauvegarde && secours && (
                <button
                  onClick={() => {
                    if (!window.confirm(
                      `Restaurer les ${secours.projets.length} projets de la copie du ` +
                      `${new Date(secours.le).toLocaleString("fr-FR")} ?\n\n` +
                      `Les projets actuellement en base ne sont pas supprimés : ceux de la copie sont réécrits par-dessus.`)) return;
                    setFormations((fs) => {
                      const ids = new Set(secours.projets.map((p) => p.id));
                      return [...fs.filter((f) => !ids.has(f.id)), ...secours.projets];
                    });
                    setSuivis((ss) => {
                      const ids = new Set((secours.suivis || []).map((s) => s.id));
                      return [...ss.filter((s) => !ids.has(s.id)), ...(secours.suivis || [])];
                    });
                    notif(`${secours.projets.length} projets restaurés depuis la copie de secours`);
                  }}
                  className="text-sm font-medium hover:underline" style={{ color: C.vert }}
                  title={`Copie prise le ${new Date(secours.le).toLocaleString("fr-FR")}, ${secours.projets.length} projets.`}>
                  <Icone n="rotation" t={14} /> Restaurer la copie de secours
                </button>
              )}
            </div>
            {P.creerFormation && <button onClick={() => { setEditionId(null); setNouvelle(PROJET_VIERGE()); setFormOuvert(!formOuvert); }}
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
                  {/* Changer de zone change le jeu de localités : celle qui
                      était choisie n'appartient plus forcément à la nouvelle
                      zone. On la ramène donc au chef-lieu, plutôt que de
                      laisser un couple zone/localité incohérent. */}
                  <select value={normaliserRegion(nouvelle.region)}
                    onChange={(e) => setNouvelle({ ...nouvelle, region: e.target.value, localite: localiteParDefaut(e.target.value) })}
                    className="mt-1 w-full border border-stone-300 rounded-lg px-3 py-2 bg-white">
                    {IMPLANTATIONS.map((r) => <option key={r}>{r}</option>)}
                    {/* Valeur historique hors nomenclature : conservée tant qu'elle n'est pas remplacée */}
                    {nouvelle.region && !IMPLANTATIONS.includes(normaliserRegion(nouvelle.region)) && <option>{normaliserRegion(nouvelle.region)}</option>}
                  </select>
                </label>
                <label className="text-sm">Localité <span className="text-stone-400">(lieu du projet)</span>
                  <select value={normaliserLocalite(nouvelle.localite, nouvelle.region)}
                    onChange={(e) => setNouvelle({ ...nouvelle, localite: e.target.value })}
                    className="mt-1 w-full border border-stone-300 rounded-lg px-3 py-2 bg-white"
                    disabled={!localitesDe(nouvelle.region).length}>
                    {localitesDe(nouvelle.region).map((l) => <option key={l}>{l}</option>)}
                  </select>
                  <div className="text-xs text-stone-500 mt-1">
                    {localitesDe(nouvelle.region).length
                      ? `${localitesDe(nouvelle.region).length} localités couvertes par ${normaliserRegion(nouvelle.region)}.`
                      : "Zone hors nomenclature : aucune localité rattachée."}
                  </div>
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
                    {String(nouvelle.budget).trim() === "" ? "Non renseigné" : fmtFCFA(nouvelle.budget)}
                  </div>
                </label>
                <label className="text-sm">Statut
                  <select value={nouvelle.statut} onChange={(e) => setNouvelle({ ...nouvelle, statut: e.target.value })} className="mt-1 w-full border border-stone-300 rounded-lg px-3 py-2 bg-white">
                    {STATUTS_PROJET.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </label>

                {/* ---------- CALENDRIER DU PROJET ----------
                    Les deux dates sont FACULTATIVES : un projet s'enregistre
                    souvent avant que son calendrier ne soit arrêté. Ce qui ne
                    l'est pas, c'est leur ordre — une fin antérieure au
                    lancement fausserait la durée et les trois échéances. Le
                    « min » de l'input barre les jours impossibles dans le
                    calendrier du navigateur, et le contrôle est refait à
                    l'enregistrement : un champ date reste saisissable au
                    clavier. */}
                <label className="text-sm">Date de lancement <span className="text-stone-400">(facultative)</span>
                  <input type="date" value={nouvelle.dateDebut || ""} max={nouvelle.dateFin || undefined}
                    onChange={(e) => setNouvelle({ ...nouvelle, dateDebut: e.target.value })}
                    className="mt-1 w-full border border-stone-300 rounded-lg px-3 py-2 bg-white" />
                </label>
                <label className="text-sm">Date de fin de projet <span className="text-stone-400">(facultative)</span>
                  <input type="date" value={nouvelle.dateFin || ""} min={nouvelle.dateDebut || undefined}
                    onChange={(e) => setNouvelle({ ...nouvelle, dateFin: e.target.value })}
                    className="mt-1 w-full border border-stone-300 rounded-lg px-3 py-2 bg-white" />
                </label>
                {/* Ce que les deux dates produisent, dit tout de suite : la
                    durée, et surtout le déplacement des trois échéances de
                    suivi. Un agent qui change la date de fin doit savoir
                    avant de valider que M+3, M+6 et M+12 vont bouger. */}
                <div className="md:col-span-2 -mt-1 text-xs">
                  {estDateISO(nouvelle.dateDebut) && estDateISO(nouvelle.dateFin) && nouvelle.dateFin < nouvelle.dateDebut ? (
                    <span className="text-red-600 font-semibold">La date de fin précède la date de lancement : corrigez l'une des deux avant d'enregistrer.</span>
                  ) : estDateISO(nouvelle.dateFin) ? (
                    <span className="text-stone-500">
                      {dureeLisible(nouvelle.dateDebut, nouvelle.dateFin)
                        ? `Durée : ${dureeLisible(nouvelle.dateDebut, nouvelle.dateFin)}. ` : ""}
                      Suivis post-formation calés sur la fin du projet :{" "}
                      {JALONS_SUIVI.map(([j]) => `${j} le ${fmtDateFr(echeancesSuivi(nouvelle.dateFin, "")[j])}`).join(" · ")}.
                    </span>
                  ) : (
                    <span className="text-stone-400">Sans date de fin, les suivis M+3 / M+6 / M+12 sont calés sur le jour de la saisie. Renseigner la date de fin les recale sur la fin réelle de la formation.</span>
                  )}
                  {!datesDispo && <span className="block mt-1 text-amber-700 font-medium">Les dates ne pourront pas être enregistrées tant que « supabase-phase7.sql » n'a pas été exécuté dans Supabase.</span>}
                </div>

                <div className="md:col-span-2 flex gap-3">
                  <button onClick={ajouterFormation} className="text-white font-semibold px-5 py-2 rounded-xl text-sm" style={{ background: C.vertFonce }}>{editionId ? "Enregistrer les modifications" : "Créer le projet"}</button>
                  <button onClick={() => setFormOuvert(false)} className="text-sm text-stone-500">Annuler</button>
                </div>
              </div>
            )}

            {/* Combien de projets répondent aux critères. Sans ce compte, une
                liste vide se lit comme un portefeuille vide alors qu'il ne
                s'agit que d'un filtre trop étroit. « aria-live » le fait
                annoncer à mesure que la sélection change. */}
            <div className="text-sm text-stone-500 -mb-1" aria-live="polite">
              {projetsFiltres.length} projet{projetsFiltres.length > 1 ? "s" : ""}
              {projetsFiltres.length !== formationsVisibles.length && ` sur ${formationsVisibles.length}`}
              {filtreZone && ` · ${filtreZone}`}
              {filtreLocalite && ` · ${filtreLocalite}`}
            </div>

            <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
              {/* Vue tableau — ordinateur / tablette large */}
              <div className="hidden md:grid grid-cols-12 px-5 py-3 text-sm font-semibold text-stone-600 border-b border-stone-100">
                <div className="col-span-6">Projet de formation de type apprentissage</div><div className="col-span-2">Secteur</div><div className="col-span-2">Score MIP &amp; statut</div><div className="col-span-2 text-right">Actions</div>
              </div>
              {projetsFiltres.map((f) => (
                <div key={f.id} className="hidden md:grid grid-cols-12 items-center px-5 py-4 border-b border-stone-50 hover:bg-stone-50">
                  <div className="col-span-6 pr-3 min-w-0">
                    <div className="font-semibold break-words">{f.titre}</div>
                    <div className="text-sm text-stone-500 break-words">Promoteur : {f.entreprise}{f.operateur ? ` · Opérateur : ${f.operateur}` : ""} · {f.region}{normaliserLocalite(f.localite, f.region) ? ` (${normaliserLocalite(f.localite, f.region)})` : ""}</div>
                    {f.beneficiaire && <div className="text-xs text-stone-400 break-words">Bénéficiaire : {f.beneficiaire}</div>}
                    <PeriodeProjet projet={f} className="text-xs text-stone-400 break-words" />
                  </div>
                  <div className="col-span-2 text-sm min-w-0"><div className="font-medium break-words">{f.secteurGrand || grandSecteurDe(secteurs, f.filiere)}</div><div className="text-stone-500 text-xs break-words">{f.filiere}{f.domaine ? " · " + f.domaine : ""}</div></div>
                  <div className="col-span-2 flex flex-wrap items-center gap-1.5"><Badge score={scoreGlobal(referentiel, f.notes)} /><PuceStatut statut={f.statut} /><PuceCouverture referentiel={referentiel} notes={f.notes} /></div>
                  <div className="col-span-2 flex justify-end items-center gap-3">
                    <button onClick={() => { setEvalId(f.id); setPage("evaluation"); }} className="text-sm font-medium hover:underline" style={{ color: C.vert }}>Évaluer</button>
                    {P.editerFormation && <button title="Modifier la formation" onClick={() => editerFormation(f)} className="text-stone-500 hover:text-stone-800" aria-label="Modifier la formation"><Icone n="crayon" t={16} /></button>}
                    {P.supprimerFormation && <button onClick={() => { if (window.confirm(corbeilleDispo ? `Mettre « ${f.titre} » à la corbeille ?

Le projet et ses suivis seront masqués, et resteront restaurables depuis la page Projets.` : `Supprimer définitivement « ${f.titre} » et ses suivis ?

La corbeille n'est pas active : cette suppression est irréversible.`)) mettreALaCorbeille(f); }} className="text-red-500 hover:text-red-700" ><Icone n="poubelle" t={16} /></button>}
                  </div>
                </div>
              ))}
              {/* Vue cartes — mobile : chaque projet entièrement visible, sans défilement horizontal */}
              <div className="md:hidden divide-y divide-stone-100">
                {projetsFiltres.map((f) => (
                  <div key={f.id} className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold break-words min-w-0">{f.titre}</div>
                      <div className="shrink-0 flex flex-col items-end gap-1"><Badge score={scoreGlobal(referentiel, f.notes)} /><PuceStatut statut={f.statut} /><PuceCouverture referentiel={referentiel} notes={f.notes} /></div>
                    </div>
                    <div className="text-sm text-stone-500 break-words mt-1">Promoteur : {f.entreprise}{f.operateur ? ` · Opérateur : ${f.operateur}` : ""} · {f.region}{normaliserLocalite(f.localite, f.region) ? ` (${normaliserLocalite(f.localite, f.region)})` : ""}</div>
                    {f.beneficiaire && <div className="text-xs text-stone-400 break-words mt-0.5">Bénéficiaire : {f.beneficiaire}</div>}
                    <PeriodeProjet projet={f} className="text-xs text-stone-400 break-words mt-0.5" />
                    <div className="text-xs text-stone-500 break-words mt-1.5">
                      <span className="font-medium">{f.secteurGrand || grandSecteurDe(secteurs, f.filiere)}</span>{f.filiere ? " · " + f.filiere : ""}{f.domaine ? " · " + f.domaine : ""}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3">
                      <button onClick={() => { setEvalId(f.id); setPage("evaluation"); }} className="text-sm font-medium hover:underline" style={{ color: C.vert }}>Évaluer</button>
                      {P.editerFormation && <button title="Modifier la formation" onClick={() => editerFormation(f)} className="text-stone-500 hover:text-stone-800" aria-label="Modifier la formation"><Icone n="crayon" t={16} /></button>}
                      {P.supprimerFormation && <button onClick={() => { if (window.confirm(corbeilleDispo ? `Mettre « ${f.titre} » à la corbeille ?

Le projet et ses suivis seront masqués, et resteront restaurables depuis la page Projets.` : `Supprimer définitivement « ${f.titre} » et ses suivis ?

La corbeille n'est pas active : cette suppression est irréversible.`)) mettreALaCorbeille(f); }} className="text-red-500 hover:text-red-700" ><Icone n="poubelle" t={16} /></button>}
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
                {P.fichePdf && <button onClick={() => fichePDF(fEval)} className="bg-white border border-stone-200 px-4 py-2 rounded-xl text-sm font-medium hover:bg-stone-50" title="Générer la fiche d'évaluation officielle en PDF."><Icone n="telecharger" t={15} /> Fiche PDF</button>}
                {!P.lectureSeule && <button onClick={() => notif("Évaluation enregistrée")} className="text-white px-4 py-2 rounded-xl text-sm font-semibold" style={{ background: C.vertFonce }} title="Enregistrer l'évaluation"><Icone n="disquette" t={15} /> Enregistrer</button>}
              </div>
            </div>

            {/* Bandeau centré. Il était en deux colonnes — identification à
                gauche, score à droite — mais les deux lignes qui se sont
                ajoutées sous le score, couverture et marge au seuil, sont
                trop longues pour une demi-largeur : elles débordaient sous le
                bloc de gauche et rompaient l'alignement à droite. Tout est
                désormais empilé et centré, ce qui vaut aussi bien sur un
                téléphone que sur un grand écran. */}
            <section className="rounded-2xl p-6 text-white flex flex-col items-center text-center gap-4" style={{ background: "linear-gradient(120deg,#0e3c60,#2280bf)" }}>
              <div className="max-w-3xl">
                <div className="text-xs uppercase tracking-wider text-sky-200">Promoteur : {fEval.entreprise}</div>
                <h2 className="text-2xl font-bold mt-1 break-words">{fEval.titre}</h2>
                <div className="text-sm text-sky-100 mt-1 break-words">{libelleSecteur(fEval, secteurs)} · {fEval.region}{normaliserLocalite(fEval.localite, fEval.region) ? ` (${normaliserLocalite(fEval.localite, fEval.region)})` : ""} · {fEval.apprenants} apprenants · {fmtFCFA(fEval.budget)}</div>
                {(fEval.operateur || fEval.beneficiaire) && <div className="text-xs text-sky-200 mt-1 break-words">{[fEval.operateur ? `Opérateur : ${fEval.operateur}` : "", fEval.beneficiaire ? `Bénéficiaire : ${fEval.beneficiaire}` : ""].filter(Boolean).join(" · ")}</div>}
                <PeriodeProjet projet={fEval} className="text-xs text-sky-200 mt-1 break-words" />
              </div>
              <div className="max-w-3xl">
                <div className="text-xs uppercase tracking-wider text-sky-200">Score global MIP-PPA</div>
                <div className="text-5xl font-bold">{fmtPct(scoreGlobal(referentiel, fEval.notes))}</div>
                <div className="mt-1.5 flex flex-wrap justify-center items-center gap-2">
                  <Badge score={scoreGlobal(referentiel, fEval.notes)} />
                  <PuceStatut statut={fEval.statut} />
                </div>
                {/* Sur quelle part du modèle ce score porte-t-il ? La question
                    se pose à chaque lecture : elle est répondue ici même. */}
                {(() => {
                  const c = couvertureModele(referentiel, fEval.notes);
                  if (!c.notees) return null;
                  return (
                    <div className="text-xs text-sky-100 mt-2">
                      Couverture : <strong>{Math.round(c.pct)} % du modèle</strong>
                      {" · "}{c.notees} indicateur{c.notees > 1 ? "s" : ""} noté{c.notees > 1 ? "s" : ""} sur {c.indicateurs}
                      {c.pct < 100 && <div className="text-amber-200 mt-0.5">Score non comparable à celui d'un projet évalué en entier.</div>}
                    </div>
                  );
                })()}
                {/* Distance au palier voisin, quand elle est faible. Un score
                    de 59,6 affiché « Moyen » et un score de 60,1 affiché
                    « Satisfaisant » décrivent des projets presque identiques :
                    la frontière est conventionnelle. On l'affiche donc en crans
                    — l'unité dans laquelle l'évaluateur agit réellement — et
                    accompagnée du maillon faible, pour que l'attention porte
                    sur la dimension à redresser et non sur le seuil à franchir.
                    Au-delà de 5 points, le palier n'est plus en jeu : rien. */}
                {(() => {
                  const m = margeSeuil(referentiel, fEval.notes);
                  if (!m) return null;
                  const faible = referentiel
                    .map((d) => ({ nom: d.nom, s: scoreDimension(referentiel, d.id, fEval.notes) }))
                    .filter((x) => x.s !== null)
                    .sort((a, b) => a.s - b.s)[0];
                  const rappel = faible
                    ? <span className="text-sky-200"> · maillon faible : {faible.nom} ({fmtPct(faible.s)})</span>
                    : null;
                  // Pluriel à partir de 2 : « 0,6 point » mais « 3,1 points ».
                  const pts = (v) => `${v.toFixed(1).replace(".", ",")} point${v >= 2 ? "s" : ""}`;
                  if (m.versLeHaut !== null && m.versLeHaut <= 5) {
                    return (
                      <div className="text-xs mt-1.5 text-amber-200">
                        À <strong>{pts(m.versLeHaut)}</strong> du niveau {niveau(m.seuilHaut).txt}
                        {m.crans ? `, ${m.crans} cran${m.crans > 1 ? "s" : ""} sur un indicateur ${m.crans > 1 ? "suffisent" : "suffit"}.` : "."}
                        {rappel}
                      </div>
                    );
                  }
                  if (m.depuisLeBas !== null && m.depuisLeBas <= 5 && m.depuisLeBas > 0) {
                    return (
                      <div className="text-xs mt-1.5 text-amber-200">
                        Seulement <strong>{pts(m.depuisLeBas)}</strong> au-dessus du seuil : niveau fragile.
                        {rappel}
                      </div>
                    );
                  }
                  return null;
                })()}
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

            {/* ---------- SITUATION DU PROJET DANS SA ZONE ----------
                La fiche annonçait « Antenne Korhogo » sans dire où, dans une
                zone de 17 départements. La carte répond à la question que
                l'en-tête laisse ouverte : quelle localité, parmi toutes
                celles que l'implantation couvre. */}
            {(() => {
              const zone = normaliserRegion(fEval.region);
              const loc = normaliserLocalite(fEval.localite, fEval.region);
              const dep = DEP_PAR_LOCALITE[loc];
              const voisines = localitesDe(zone);
              if (!voisines.length) return null;
              return (
                <section className="bg-white rounded-2xl border border-stone-200 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-bold">Situation du projet</h3>
                      <p className="text-sm text-stone-500 break-words">
                        Zone d'occupation de {zone}, {voisines.length} localités couvertes.
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs uppercase tracking-wide text-stone-500 font-semibold">Localité</div>
                      <div className="text-lg font-bold" style={{ color: couleurZone(zone) }}>{loc || "Non renseignée"}</div>
                      {dep && <div className="text-xs text-stone-500">{dep.r}</div>}
                    </div>
                  </div>
                  <div className="mt-3">
                    <CarteZone zone={zone} localite={loc} sombre={sombre} />
                    <LegendeFond sombre={sombre} />
                    <MentionCarte />
                  </div>
                </section>
              );
            })()}

            {/* ---------- TRAJECTOIRE ENTRE JALONS ----------
                Le modèle annonce un suivi à M+3 / M+6 / M+12, mais l'application
                n'a longtemps gardé qu'un seul jeu de notes : chaque notation
                écrasait la précédente et aucune progression n'était lisible.
                Figer un jalon en conserve une photographie datée. */}
            <section className="bg-white rounded-2xl border border-stone-200 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold">Trajectoire du score</h3>
                  <p className="text-sm text-stone-500">Évolution de l'évaluation d'un jalon à l'autre.</p>
                </div>
                {!P.lectureSeule && (
                  <div className="flex items-center gap-2 shrink-0">
                    <select value={jalonAFiger} onChange={(e) => setJalonAFiger(e.target.value)}
                      className="text-sm border border-stone-200 rounded-lg px-2.5 py-1.5 bg-white"
                      title="Jalon auquel rattacher cette photographie de l'évaluation.">
                      {JALONS.map((j) => <option key={j} value={j}>{j}</option>)}
                    </select>
                    <button
                      onClick={() => {
                        const snap = instantane(referentiel, fEval.notes, jalonAFiger);
                        if (snap.score === null) { notif("Aucun indicateur noté : rien à figer."); return; }
                        const deja = (fEval.historique || []).some((h) => h.jalon === jalonAFiger);
                        if (deja && !window.confirm(`Le jalon ${jalonAFiger} est déjà figé. Le remplacer par l'évaluation actuelle ?`)) return;
                        setFormations((fs) => fs.map((x) => x.id === fEval.id
                          ? { ...x, historique: ajouterInstantane(x.historique, snap) } : x));
                        notif(`Évaluation figée au jalon ${jalonAFiger}`);
                      }}
                      className="text-sm font-semibold text-white px-3.5 py-1.5 rounded-lg"
                      style={{ background: C.vert }}
                      title="Enregistrer une photographie datée du score actuel, rattachée à ce jalon.">
                      Figer l'évaluation
                    </button>
                  </div>
                )}
              </div>
              {(() => {
                const t = trajectoire(fEval.historique);
                if (!t.length) {
                  return (
                    <p className="text-sm text-stone-400 mt-4">
                      Aucun jalon figé pour ce projet. Le score affiché est celui de la saisie en cours :
                      rien n'indique encore à quelle étape du suivi il correspond.
                    </p>
                  );
                }
                return (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-sm min-w-[30rem]">
                      <thead>
                        <tr className="text-xs uppercase tracking-wide text-stone-500 border-b border-stone-200">
                          <th className="text-left font-semibold py-2">Jalon</th>
                          <th className="text-left font-semibold py-2">Date</th>
                          <th className="text-right font-semibold py-2">Score</th>
                          <th className="text-right font-semibold py-2">Évolution</th>
                          <th className="text-right font-semibold py-2">Couverture</th>
                          <th className="text-left font-semibold py-2 pl-4">Niveau</th>
                        </tr>
                      </thead>
                      <tbody>
                        {t.map((p) => (
                          <tr key={p.jalon} className="border-b border-stone-50">
                            <td className="py-2.5 font-semibold">
                              {p.jalon}
                              {/* Un instantané « repris » vient d'un ancien
                                  classeur : les scores ont été LUS, pas
                                  recalculés à partir de notes. Sans cette
                                  mention, il se lirait comme une évaluation
                                  faite dans l'application. */}
                              {p.repris && (
                                <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full align-middle"
                                  style={{ background: "#fdf0da", color: "#b07515" }}
                                  title="Scores repris d'un classeur exporté : les notes des indicateurs n'ont pas été retrouvées.">
                                  repris
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 text-stone-500">{p.date}</td>
                            <td className="py-2.5 text-right font-semibold">{fmtPct(p.score)}</td>
                            <td className="py-2.5 text-right font-medium"
                              style={{ color: p.sens === "hausse" ? C.excellent : p.sens === "baisse" ? C.insuffisant : "#78716c" }}>
                              {p.delta === null ? "Premier jalon"
                                : `${p.delta > 0 ? "+" : p.delta < 0 ? "−" : "="} ${Math.abs(p.delta).toFixed(1).replace(".", ",")} pt`}
                            </td>
                            <td className="py-2.5 text-right text-stone-500">
                              {p.couverture === null || p.couverture === undefined ? "Non connue" : `${Math.round(p.couverture)} %`}
                            </td>
                            <td className="py-2.5 pl-4"><Badge score={p.score} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {t.length === 1 && (
                      <p className="text-xs text-stone-400 mt-3">
                        Un seul jalon figé : l'évolution apparaîtra dès le suivant.
                      </p>
                    )}
                  </div>
                );
              })()}
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
                  <div key={s.id} className="border-t border-stone-100 py-3.5 flex flex-col items-start gap-2.5 first:border-t-0 mt-1">
                    <div className="min-w-0 w-full">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full mr-2" style={{ background: teinte, color: "#1c1917" }}>{s.jalon}</span>
                      <span className="font-semibold">{s.f.titre}</span>
                      <div className="text-sm text-stone-500 mt-0.5">{s.f.entreprise} · {libelleSecteur(s.f, secteurs)} · échéance {s.echeance}{s.statut === "programmé" ? ` · ${joursRestants(s.echeance) < 0 ? Math.abs(joursRestants(s.echeance)) + " j de retard" : "dans " + joursRestants(s.echeance) + " j"}` : ""}</div>
                      {s.note && <div className="text-xs text-stone-500 italic mt-1"><Icone n="note" t={13} /> {s.note}</div>}
                      {(s.docs || []).length > 0 && <div className="text-xs text-sky-700 mt-1"><Icone n="trombone" t={13} /> {s.docs.length} document{s.docs.length > 1 ? "s" : ""} de suivi rattaché{s.docs.length > 1 ? "s" : ""}</div>}
                    </div>
                    <div className="flex gap-2">
                      {!P.lectureSeule && <button onClick={() => setSuiviEdit({ id: s.id, jalon: s.jalon, titreF: s.f.titre + " · " + s.f.entreprise, echeance: s.echeance, note: s.note, docs: s.docs || [] })}
                        className="text-sm border border-stone-200 px-3 py-1.5 rounded-lg hover:bg-stone-50" title="Modifier la date, les observations et les documents."><Icone n="crayon" t={14} /> Notes & date</button>}
                      {P.suiviValider && (s.statut === "programmé"
                        ? <button onClick={() => { setSuivis((ss) => ss.map((x) => x.id === s.id ? { ...x, statut: "effectué" } : x)); notif("Suivi marqué effectué"); }} className="text-sm border border-stone-200 px-3 py-1.5 rounded-lg hover:bg-stone-50" title="Valider la réalisation de ce suivi."><Icone n="coche" t={14} /> Marquer effectué</button>
                        : <button onClick={() => setSuivis((ss) => ss.map((x) => x.id === s.id ? { ...x, statut: "programmé" } : x))} className="text-sm text-stone-500 hover:text-stone-800" title="Repasser ce suivi en programmé."><Icone n="rotation" t={14} /> Ré-ouvrir</button>)}
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
              <p className="text-sm text-stone-500">Quatre niveaux d'interprétation. Pondération totale actuelle : <b style={{ color: poidsTotal === 100 ? C.excellent : C.insuffisant }}>{poidsTotal} %</b>{poidsTotal !== 100 && ". Ajustez les poids pour revenir à 100 %"}</p>
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
                    className="bg-white border border-stone-200 text-sm px-4 py-2 rounded-xl hover:bg-stone-50" title="Revenir aux 5 dimensions et 23 indicateurs d'origine."><Icone n="rotation" t={14} /> Restaurer le référentiel par défaut</button>
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
                <p className="text-sm text-stone-500 mb-3">Trois niveaux : le grand secteur, ses matières premières, et les domaines de chacune. Tout est modifiable, et cette hiérarchie alimente le formulaire de projet.</p>
                {/* La hiérarchie est stockée en base : sans ce bouton, une mise
                    à jour de la nomenclature livrée avec l'application resterait
                    invisible sur une installation déjà en service. */}
                <button onClick={() => {
                  if (!window.confirm("Remplacer toute la hiérarchie actuelle par la nomenclature d'origine ?\n\nLes secteurs, matières premières et domaines que vous avez ajoutés ou renommés seront perdus. Les projets déjà saisis conservent leurs libellés actuels.")) return;
                  setSecteurs(SECTEURS_DEFAUT); notif("Nomenclature par défaut restaurée");
                }}
                  className="bg-white border border-stone-200 text-sm px-4 py-2 rounded-xl hover:bg-stone-50 mb-4" title="Revenir aux secteurs, matières premières et domaines d'origine."><Icone n="rotation" t={14} /> Restaurer la nomenclature par défaut</button>
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
                                className="text-red-400 hover:text-red-600" title="Supprimer cette matière première."><Icone n="fermer" t={13} /></button>
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
                        className="text-stone-400 hover:text-red-600 w-5 h-5 rounded-full flex items-center justify-center" title="Supprimer cette phase" aria-label="Supprimer cette phase"><Icone n="fermer" t={12} /></button>
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
                    {admin && <button title="Modifier cette dimension (code, nom, pondération, description)."
                      onClick={() => setDimEdit({ ancienId: d.id, id: d.id, nom: d.nom, poids: d.poids, desc: d.desc })}
                      className="text-stone-500 hover:text-stone-800"><Icone n="crayon" t={16} /></button>}
                    {admin && <button title="Supprimer cette dimension et ses indicateurs." onClick={() => { if (window.confirm(`Supprimer la dimension « ${d.nom} » et ses indicateurs ?`)) setReferentiel((r) => r.filter((x) => x.id !== d.id)); }} className="text-red-500 hover:text-red-700"><Icone n="poubelle" t={16} /></button>}
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
                        {admin && <button title="Modifier cet indicateur (code, intitulé, phase)."
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
                      return r.map((x) => x.id === d.id ? { ...x, indicateurs: [...x.indicateurs, { id: d.id + k, phase: "À définir", label: "Nouvel indicateur à définir" }] } : x);
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
                      <div className="font-bold">Score critique : {f.titre}</div>
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
                    <div className="font-bold">Suivi {s.jalon} en retard : {f?.titre}</div>
                    <div className="text-sm text-stone-500">{f?.entreprise} · échéance dépassée : {s.echeance}</div>
                  </section>
                );
              })}
              {/* Trou d'évaluation : l'échéance est passée et le score ne
                  repose pas encore sur tout le modèle. C'est l'alerte la plus
                  utile au FDFP — un score partiel se lit comme un score
                  complet tant que personne ne le signale. */}
              {stats.trousEval.map((t) => (
                <section key={"trou-" + t.formation.id} className="bg-white rounded-2xl border-l-4 border border-stone-200 p-5" style={{ borderLeftColor: C.gold }}>
                  <div className="flex justify-between items-start gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="font-bold break-words">Évaluation incomplète : {t.formation.titre}</div>
                      <div className="text-sm text-stone-500 break-words">
                        {t.formation.entreprise} · échéance {t.jalons} dépassée ·{" "}
                        <strong>{t.manquants.length} indicateur{t.manquants.length > 1 ? "s" : ""}</strong> restant à noter sur {t.couverture.indicateurs}
                      </div>
                      <div className="text-xs text-stone-400 mt-1">
                        Couverture actuelle : {Math.round(t.couverture.pct)} % du modèle. Le score n'est pas comparable à celui d'un projet évalué en entier.
                      </div>
                    </div>
                    <button onClick={() => { setEvalId(t.formation.id); setPage("evaluation"); }} className="text-sm font-medium hover:underline shrink-0" style={{ color: C.vert }}>Compléter l'évaluation →</button>
                  </div>
                </section>
              ))}
              {/* Incohérences de calendrier. Elles ne remettent en cause ni le
                  score ni le suivi : elles disent qu'une fiche n'a pas été
                  tenue à jour. Le bouton mène donc à la modification du
                  projet, pas à son évaluation. */}
              {stats.calendrier.map((c) => (
                <section key={"cal-" + c.formation.id} className="bg-white rounded-2xl border-l-4 border border-stone-200 p-5" style={{ borderLeftColor: C.satisfaisant }}>
                  <div className="flex justify-between items-start gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="font-bold break-words">Calendrier à revoir : {c.formation.titre}</div>
                      {c.anomalies.map((a) => (
                        <div key={a.code} className={"text-sm break-words " + (a.gravite === "erreur" ? "text-red-600 font-medium" : "text-stone-500")}>{a.txt}</div>
                      ))}
                      <div className="text-xs text-stone-400 mt-1">{c.formation.entreprise}</div>
                    </div>
                    {P.editerFormation && <button onClick={() => editerFormation(c.formation)} className="text-sm font-medium hover:underline shrink-0" style={{ color: C.vert }}>Corriger la fiche →</button>}
                  </div>
                </section>
              ))}
            </>)
          )}

          {/* =========== EXPORTS =========== */}
          {page === "exports" && (<>
            {(P.exportXlsx || P.exportCsv) && (
            <section className="bg-white rounded-2xl border border-stone-200 p-6">
              <h3 className="font-bold">Export consolidé</h3>
              <p className="text-sm text-stone-500 mb-4">Tous les projets de formation de type apprentissage et leurs indicateurs, en une feuille.</p>
              <div className="flex flex-wrap items-center gap-3">
                {P.exportXlsx && (
                  <button onClick={exportXlsx} className="text-white font-semibold px-5 py-2.5 rounded-xl text-sm" style={{ background: C.vertFonce }} title="Classeur mis en forme : bandeau de certification, colonnes figées, filtres et niveaux en couleur.">
                    <Icone n="telecharger" t={15} /> Classeur Excel ({formationsVisibles.length} projet{formationsVisibles.length > 1 ? "s" : ""})
                  </button>
                )}
                <button onClick={exportCsv}
                  className={P.exportXlsx
                    ? "bg-white border border-stone-200 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-stone-50"
                    : "text-white font-semibold px-5 py-2.5 rounded-xl text-sm"}
                  style={P.exportXlsx ? undefined : { background: C.vertFonce }}
                  title="Données brutes, séparées par des points-virgules, pour une relecture dans un outil statistique.">
                  <Icone n="fichier" t={15} /> Données brutes (CSV) ({formationsVisibles.length} projet{formationsVisibles.length > 1 ? "s" : ""})
                </button>
              </div>
              {/* Le texte ne décrit que ce qui est réellement proposé : parler
                  du classeur Excel à qui n'y a pas droit revient à annoncer un
                  bouton absent. */}
              <p className="text-xs text-stone-400 mt-3">
                {P.exportXlsx && <>Le classeur <b>.xlsx</b> porte le bandeau de certification et conserve les nombres comme nombres (tri, filtres et sommes immédiats). </>}
                Le <b>.csv</b> ne contient que les données, au format le plus simple à relire dans un logiciel d'analyse.
              </p>
            </section>
            )}

            {/* ---------- SAUVEGARDE ET RESTAURATION ----------
                Distinguée de l'export : le classeur sert à communiquer, la
                sauvegarde sert à remonter. Le 8 août, un portefeuille a été
                perdu sans aucun moyen de le reconstituer ; c'est ce trou que
                cette section ferme. Réservée aux administrateurs : sauvegarder
                et restaurer sont des actes d'administration de la base, pas de
                consultation. */}
            {P.sauvegarde && (
            <section className="bg-white rounded-2xl border border-stone-200 p-6">
              <h3 className="font-bold">Sauvegarde et restauration</h3>
              <p className="text-sm text-stone-500 mb-4">
                Copie <b>complète et fidèle</b> : projets, notes de chaque indicateur, suivis,
                jalons figés et référentiel. C'est ce fichier, et non le classeur Excel, qui permet de tout
                remonter après une fausse manœuvre.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <button onClick={exporterSauvegarde}
                  className="text-white font-semibold px-5 py-2.5 rounded-xl text-sm" style={{ background: C.vertFonce }}
                  title="Télécharge une copie complète du portefeuille, restaurable par le bouton voisin.">
                  <Icone n="disquette" t={15} /> Télécharger la sauvegarde ({formations.length} projet{formations.length > 1 ? "s" : ""})
                </button>
                {P.sauvegarde && (
                  <label className="bg-white border border-stone-200 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-stone-50 cursor-pointer"
                    title="Réinjecte une sauvegarde. Rien n'est supprimé : les projets absents sont ajoutés, ceux de même identifiant sont remplacés.">
                    <Icone n="rotation" t={15} /> Restaurer une sauvegarde
                    <input type="file" accept="application/json,.json" className="sr-only"
                      onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; importerSauvegarde(f); }} />
                  </label>
                )}
              </div>
              <p className="text-xs text-stone-400 mt-3">
                La restauration <b>ne supprime jamais</b> : elle ajoute les projets absents et remplace ceux
                qui portent le même identifiant. Le décompte exact vous est présenté avant toute écriture.
                Gardez ce fichier hors du navigateur : une copie sur le poste ne survit pas à un effacement des données du site.
              </p>

              {/* Reprise d'un ancien classeur. Séparée de la restauration :
                  elle rend beaucoup moins, et il faut que cela se voie. */}
              {P.sauvegarde && (
                <div className="mt-5 pt-4 border-t border-stone-200">
                  <h4 className="font-semibold text-sm">Reprendre un ancien classeur Excel ou CSV</h4>
                  <p className="text-sm text-stone-500 mt-1 mb-3">
                    À utiliser si vous n'avez qu'un export, et pas de sauvegarde. La fiche d'identité des
                    projets est rétablie ; <b>les notes des indicateurs ne le sont pas</b> : le classeur ne
                    porte que les moyennes par dimension, dont on ne peut pas déduire les notes.
                    Ces moyennes sont conservées en repère, et chaque projet est à noter à nouveau.
                  </p>
                  <label className="bg-white border border-stone-200 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-stone-50 cursor-pointer inline-block"
                    title="Lit un fichier produit par « Classeur Excel » ou « Données brutes (CSV) ».">
                    <Icone n="fichier" t={15} /> Choisir un fichier .xlsx ou .csv
                    <input type="file" accept=".xlsx,.csv,text/csv" className="sr-only"
                      onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; reprendreClasseur(f); }} />
                  </label>
                  <p className="text-xs text-stone-400 mt-3">
                    Les projets déjà présents (même intitulé et même promoteur) sont laissés intacts :
                    la reprise comble un trou, elle n'écrase pas ce qui a survécu.
                    Ne sont pas dans le classeur, donc perdus : l'opérateur, le bénéficiaire,
                    les suivis et leurs pièces jointes.
                  </p>
                </div>
              )}
            </section>
            )}

            {/* La fiche d'un projet reste accessible au promoteur : c'est son
                dossier. Seul le classeur de TOUT le portefeuille, lui, est un
                document de pilotage réservé au FDFP. */}
            {P.fichePdf && (
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
                    <button onClick={() => fichePDF(f)} className="bg-white border border-stone-200 px-4 py-2 rounded-xl text-sm font-medium hover:bg-stone-50 shrink-0" title="Générer la fiche PDF de cette formation."><Icone n="fichier" t={15} /> Fiche PDF</button>
                  </div>
                ))}
              </div>
            </section>
            )}
          </>)}

          {/* =========== GUIDE =========== */}
          {page === "guide" && (<>
            <section className="rounded-2xl p-7 text-white" style={{ background: "linear-gradient(120deg,#0e3c60,#1d6fa8)" }}>
              <span className="text-xs font-semibold px-3 py-1 rounded-full text-stone-900" style={{ background: C.gold }}>Documentation officielle</span>
              <h2 className="text-3xl font-bold mt-3">Bienvenue sur MIP-PPA</h2>
              <p className="mt-2 text-sky-100">Ce guide est conçu pour <b>tout public</b> : agents du FDFP, référents en entreprise, formateurs. Aucune connaissance technique n'est requise (prise en main ≈ 10 minutes).</p>
            </section>
            {/* ---------- GUIDE CONSTRUIT À PARTIR DES DROITS ----------
                Il existait deux textes figés — « lecture seule » et « le
                reste » — et les deux mentaient. Le premier annonçait un export
                Excel que ni le promoteur ni l'opérateur ne possèdent, et un
                palier « En développement » qui n'existe plus depuis que
                l'échelle dit « Moyen ». Le second, servi indistinctement à
                trois rôles, disait « Créez un projet » à l'agent FDFP, qui ne
                le peut pas.

                Un guide qui décrit des boutons absents est pire qu'un guide
                absent : le lecteur croit avoir mal cherché. Chaque rubrique
                est donc conditionnée par le droit qu'elle décrit, et la
                numérotation se calcule à l'affichage plutôt que d'être écrite
                dans les titres — sans quoi masquer une rubrique laisserait un
                trou dans la suite des numéros. */}
            {(() => {
              const g = [];
              const listeDroits = (paires) => paires.filter(([ok]) => ok).map(([, txt]) => txt);

              g.push(["Votre accès", `Votre profil est « ${roleActif} ». `
                + (P.portee === "entreprise"
                  ? "Vous voyez les projets dont votre organisation est promoteur ou opérateur, et eux seuls. "
                  : "Vous voyez l'ensemble du portefeuille. ")
                + (P.lectureSeule
                  ? "Votre accès est en consultation : la saisie et l'évaluation sont assurées par les équipes du FDFP. Cette règle est appliquée par la base de données elle-même, pas seulement par les boutons de l'écran."
                  : "Vous pouvez saisir et faire évoluer les données selon les droits attachés à votre rôle.")
                + " Pour changer de mot de passe, ouvrez le menu de votre compte, en haut à droite : c'est immédiat et sans email."]);

              if ((P.pages || []).includes("dashboard")) {
                g.push(["Tableau de bord", "Vue d'ensemble : nombre de projets et d'apprenants, budget engagé, score moyen MIP, radar des 5 dimensions, comparaison par secteur et carte d'implantation. Chaque carte est cliquable et ouvre le détail projet par projet."]);
              }

              if ((P.pages || []).includes("evaluation")) {
                g.push([P.evalDims === "toutes" ? "Évaluer un projet" : "Lire une évaluation",
                "Le modèle MIP-PPA mesure la valeur d'un projet par 5 dimensions et 23 indicateurs notés de 0 à 4. "
                + (P.evalDims === "toutes"
                  ? "Notez chaque indicateur depuis la fiche du projet ; le score se recalcule et s'enregistre aussitôt. Les indicateurs non encore mesurables peuvent rester vides. "
                  : "Ouvrez un projet depuis la page Projets pour consulter sa fiche. ")
                + "Le score global va de 0 à 100 % et se lit sur quatre paliers : Insuffisant (0–40 %), Moyen (40–60 %), Satisfaisant (60–80 %), Excellent (80–100 %). "
                + "La fiche affiche aussi la COUVERTURE du modèle : un score de 100 % obtenu sur 4 indicateurs sur 23 n'a pas la même portée qu'un score complet, et la mention le dit."]);
              }

              if (P.creerFormation || P.editerFormation) {
                g.push(["Gérer les projets", "Créez ou modifiez un projet depuis la page Projets : intitulé, promoteur, opérateur, bénéficiaire, secteur, zone, localité, apprenants, budget en FCFA, statut, et les dates de lancement et de fin. Les deux dates sont facultatives, mais la date de fin commande les échéances de suivi : renseignez-la dès qu'elle est connue."
                  + (P.supprimerFormation ? " Un projet supprimé part à la corbeille et reste restaurable depuis la page Projets." : "")]);
              }

              if ((P.pages || []).includes("suivi")) {
                g.push(["Suivi à 3, 6 et 12 mois", "Chaque projet porte 3 jalons, comptés à partir de sa DATE DE FIN : M+3 (transfert des acquis au poste), M+6 (effets organisationnels), M+12 (pérennité et retour sur investissement). Sans date de fin, ils sont calés sur le jour de la saisie ; la renseigner ensuite recale les échéances, sauf celles des jalons déjà effectués. Les jalons sont regroupés en 4 piles : En retard, À faire sous 14 jours, Programmés, Effectués."
                  + (P.suiviValider ? " Vous pouvez marquer un jalon effectué, y consigner vos observations et y joindre des documents." : " Vous pouvez lire les observations de terrain et ouvrir les documents joints.")]);
              }

              if (P.referentiel) {
                g.push(["Référentiel", "La page Indicateurs expose les 5 dimensions, leurs pondérations et les 23 indicateurs. Vous pouvez les ajouter, les modifier ou les supprimer ; la somme des pondérations doit rester à 100 %. Renommer une dimension, un secteur ou une phase met à jour tous les projets concernés. Un bouton restaure le référentiel MIP-PPA d'origine."
                  + (P.secteurs ? " Vous gérez également la nomenclature sectorielle." : "")]);
              }

              if ((P.pages || []).includes("alertes")) {
                g.push(["Alertes", "Quatre événements remontent automatiquement : projets dont le score global est inférieur à 40 % ; suivis en retard sur leur échéance ; évaluations incomplètes, dont l'échéance est passée alors que des indicateurs restent à noter ; et calendriers incohérents, par exemple une fiche restée « En cours » après sa date de fin."]);
              }

              const sorties = listeDroits([
                [P.fichePdf, "la fiche d'évaluation d'un projet en PDF, avec ses pièces jointes en annexe"],
                [P.exportCsv, "les données brutes en CSV, pour une relecture dans un tableur ou un outil statistique"],
                [P.exportXlsx, "le classeur Excel mis en forme, avec bandeau de certification, colonnes figées et filtres"],
                [P.sauvegarde, "la sauvegarde complète de la base et sa restauration, ainsi que la reprise d'un ancien classeur"],
              ]);
              if (sorties.length) {
                g.push(["Exports", "Depuis la page Exports, vous pouvez produire : " + sorties.join(" ; ") + ". "
                  + "Les exports portent toujours sur l'ensemble des projets qui vous sont visibles, jamais sur le résultat d'un filtre d'écran : un export est un livrable, il ne doit pas dépendre de l'état de votre recherche."]);
              }

              if (P.users) {
                g.push(["Utilisateurs & rôles", "La page Utilisateurs liste les comptes et permet d'attribuer un rôle. Un compte sans rôle n'a aucun accès. Vous pouvez aussi corriger l'organisation d'un compte : c'est elle qui fixe le périmètre des projets qu'il verra. Les rôles sont protégés côté serveur : aucun utilisateur ne peut s'auto-attribuer un accès."]);
              }

              if (P.lectureSeule) {
                g.push(["Une information vous semble inexacte ?", "Score, échéance, document : contactez votre interlocuteur FDFP ou l'administrateur de la plateforme. Seules les équipes du FDFP peuvent modifier les données d'évaluation."]);
              }

              return g.map(([t, txt], i) => (
                <section key={t} className="bg-white rounded-2xl border border-stone-200 p-6">
                  <h3 className="font-bold mb-2">{i + 1}. {t}</h3>
                  <p className="text-sm text-stone-600 leading-relaxed">{txt}</p>
                </section>
              ));
            })()}
          </>)}

          {/* =========== UTILISATEURS & RÔLES =========== */}
          {page === "users" && (P.users ? (<>
            <section className="bg-white rounded-2xl border border-stone-200 p-6">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <h3 className="font-bold">Comptes ({comptes.length})</h3>
                <div className="flex items-center gap-2">
                  <button onClick={chargerComptes} title="Recharger la liste depuis la base."
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
                      <div className="min-w-0">
                        <div className="font-semibold break-words">{u.nom} {session?.id === u.id && <span className="text-xs font-normal text-stone-400">(vous)</span>}</div>
                        <div className="text-sm text-stone-500 break-words">
                          {u.email} ·{" "}
                          {/* Une organisation absente est signalée, pas noyée
                              dans la ligne : c'est elle qui décide de ce que
                              le compte voit. */}
                          <span className={u.org === "Non renseignée" ? "text-amber-700 font-semibold" : ""}>{u.org}</span>
                          {roleActif === "Administrateur lead" && (
                            <button onClick={() => corrigerOrganisation(u)}
                              title="Corriger l'organisation de ce compte."
                              className="ml-1.5 text-xs font-medium hover:underline" style={{ color: C.vert }}>modifier</button>
                          )}
                        </div>
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
                        <button title="Retirer l'accès (repasse le compte en attente)." onClick={() => attribuerRole(u.id, "En attente d'activation")}
                          className="text-red-500 hover:text-red-700" aria-label="Retirer l'accès (repasse le compte en attente)."><Icone n="poubelle" t={16} /></button>
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

          {/* Placé à l'intérieur de la zone de contenu : le bandeau reçoit
              ainsi la même largeur utile et les mêmes gouttières que les
              cartes qui le précèdent. */}
          <PiedCertification />
        </main>
        <footer className="text-center text-[11px] text-stone-400 pb-5">
          Prototype MIP-PPA · PFE ESA / INP-HB × FDFP · EHOUNI Luc-Emmanuel Behira Levy · Données de démonstration
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
          projets:    ["Projets suivis", "Intitulé de chaque projet du portefeuille."],
          apprenants: ["Apprenants concernés", "Nombre d'apprenants par projet."],
          scores:     ["Score moyen MIP-PPA", "Score global de chaque projet."],
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
                <button onClick={() => setDetailStat(null)} className="text-stone-400 hover:text-stone-700 shrink-0" title="Fermer" aria-label="Fermer"><Icone n="fermer" t={18} /></button>
              </div>

              {!liste.length ? (
                <p className="text-sm text-stone-500 mt-6">Aucun projet dans votre portefeuille pour le moment.</p>
              ) : (<>
                <div className="mt-5 border-t border-stone-100">
                  {liste.map((f, i) => (
                    <button key={f.id} onClick={() => { setDetailStat(null); setEvalId(f.id); setPage("evaluation"); }}
                      title="Ouvrir la fiche d'évaluation de ce projet."
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

      {/* ---------- FENÊTRE : PROJETS D'UNE LOCALITÉ ----------
          Une pastille de la carte porte un nombre ; cliquer dessus doit dire
          lesquels, sinon la carte ne fait que compter. */}
      {/* ---------- CORBEILLE ---------- */}
      {corbeilleOuverte && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,23,32,.55)" }}
          onClick={(e) => e.target === e.currentTarget && setCorbeilleOuverte(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto p-5">
            <div className="flex items-start justify-between gap-3 mb-1">
              <div className="min-w-0">
                <h3 className="font-bold">Corbeille</h3>
                <p className="text-sm text-stone-500">
                  {corbeille.length} projet{corbeille.length > 1 ? "s" : ""} retiré{corbeille.length > 1 ? "s" : ""} du portefeuille.
                  Rien n'est effacé : la restauration remet le projet et ses suivis en place.
                </p>
              </div>
              <button onClick={() => setCorbeilleOuverte(false)} aria-label="Fermer"
                className="text-stone-400 hover:text-stone-700 shrink-0" title="Fermer"><Icone n="fermer" t={18} /></button>
            </div>
            <div className="divide-y divide-stone-100 mt-3">
              {corbeille.map((f) => (
                <div key={f.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold break-words">{f.titre}</div>
                    <div className="text-xs text-stone-500 break-words">
                      {f.entreprise}{f.region ? ` · ${f.region}` : ""}
                      {f.supprimeLe ? ` · retiré le ${new Date(f.supprimeLe).toLocaleString("fr-FR")}` : ""}
                      {f.supprimePar ? ` par ${f.supprimePar}` : ""}
                    </div>
                  </div>
                  <button onClick={() => restaurerDeLaCorbeille(f)}
                    className="text-sm font-semibold hover:underline shrink-0" style={{ color: C.vert }}>
                    Restaurer
                  </button>
                </div>
              ))}
            </div>
            <p className="text-xs text-stone-400 mt-4 pt-3 border-t border-stone-100">
              La corbeille ne se vide pas toute seule. La purge se fait à la main
              dans Supabase : la marche à suivre est en commentaire dans
              « supabase-phase5.sql ».
            </p>
          </div>
        </div>
      )}

      {detailLocalite && (() => {
        const dep = DEP_PAR_LOCALITE[detailLocalite];
        const liste = formationsVisibles
          .filter((f) => normaliserLocalite(f.localite, f.region) === detailLocalite)
          .sort((a, b) => (scoreGlobal(referentiel, b.notes) ?? -1) - (scoreGlobal(referentiel, a.notes) ?? -1));
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(10,25,38,.55)" }}
            onClick={(e) => e.target === e.currentTarget && setDetailLocalite(null)}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-5 md:p-7 page-anim max-h-[92vh] overflow-y-auto">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-xl font-bold break-words">{detailLocalite}</h3>
                  <p className="text-sm text-stone-500 break-words">
                    {dep ? `${dep.r} · rattachée à ${dep.z}.` : "Localité hors nomenclature."}
                  </p>
                </div>
                <button onClick={() => setDetailLocalite(null)} className="text-stone-400 hover:text-stone-700 shrink-0" title="Fermer" aria-label="Fermer"><Icone n="fermer" t={18} /></button>
              </div>
              <div className="mt-5 border-t border-stone-100">
                {liste.map((f) => (
                  <button key={f.id} onClick={() => { setDetailLocalite(null); setEvalId(f.id); setPage("evaluation"); }}
                    title="Ouvrir la fiche d'évaluation de ce projet."
                    className="w-full text-left flex items-center justify-between gap-3 py-3 px-2 rounded-lg border-b border-stone-50 hover:bg-stone-50">
                    <div className="min-w-0">
                      <div className="font-medium break-words">{f.titre}</div>
                      <div className="text-xs text-stone-500 break-words">
                        {f.entreprise}{f.statut ? ` · ${f.statut}` : ""}
                      </div>
                    </div>
                    <span className="shrink-0"><Badge score={scoreGlobal(referentiel, f.notes)} /></span>
                  </button>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-stone-200 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-stone-500">
                  {liste.length} projet{liste.length > 1 ? "s" : ""} dans cette localité.
                </span>
                {/* Passer de la carte à la liste filtrée : sans ce raccourci,
                    il fallait retrouver la localité à la main dans le filtre. */}
                <button
                  onClick={() => {
                    setFiltreZone(dep ? dep.z : "");
                    setFiltreLocalite(detailLocalite);
                    setDetailLocalite(null);
                    setPage("formations");
                  }}
                  className="font-semibold hover:underline" style={{ color: C.vert }}>
                  Filtrer le portefeuille sur cette localité →
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ---------- FENÊTRE : CHANGER MON MOT DE PASSE ---------- */}
      {changeMdp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(10,25,38,.55)" }}
          onClick={(e) => e.target === e.currentTarget && setChangeMdp(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-5 md:p-7 page-anim">
            <div className="flex items-start justify-between">
              <h3 className="text-xl font-bold">Changer mon mot de passe</h3>
              <button onClick={() => setChangeMdp(null)} className="text-stone-400 hover:text-stone-700" title="Fermer" aria-label="Fermer"><Icone n="fermer" t={18} /></button>
            </div>
            <p className="text-sm text-stone-500 mt-1">Compte {session?.email}. Saisissez votre mot de passe actuel, puis deux fois le nouveau.</p>
            {changeMdp.msg && <div className="mt-3 text-sm rounded-xl px-3.5 py-2.5 bg-red-50 text-red-700 border border-red-200">{changeMdp.msg}</div>}
            {/* Le mot de passe ACTUEL est exigé. Sans lui, un poste laissé
                déverrouillé quelques secondes suffisait à s'approprier le
                compte : « updateUser » ne vérifie rien, il fait confiance à la
                session ouverte. On revalide donc l'identité avec
                « signInWithPassword » avant d'écrire — c'est le seul moyen,
                côté client, de prouver que la personne devant l'écran est bien
                celle qui a ouvert la session. */}
            <label className="block text-sm font-semibold text-stone-800 mt-4">Mot de passe actuel <span className="text-red-500">*</span>
              <input type="password" value={changeMdp.actuel} onChange={(e) => setChangeMdp({ ...changeMdp, actuel: e.target.value })}
                className="mt-1.5 w-full border border-stone-300 rounded-xl px-3.5 py-2.5 font-normal outline-none focus:border-sky-600" />
            </label>
            <label className="block text-sm font-semibold text-stone-800 mt-4">Nouveau mot de passe <span className="font-normal text-stone-400">(6 caractères min.)</span>
              <input type="password" value={changeMdp.nouveau} onChange={(e) => setChangeMdp({ ...changeMdp, nouveau: e.target.value })}
                className="mt-1.5 w-full border border-stone-300 rounded-xl px-3.5 py-2.5 font-normal outline-none focus:border-sky-600" />
            </label>
            <label className="block text-sm font-semibold text-stone-800 mt-4">Confirmez le mot de passe
              <input type="password" value={changeMdp.confirmation} onChange={(e) => setChangeMdp({ ...changeMdp, confirmation: e.target.value })}
                className="mt-1.5 w-full border border-stone-300 rounded-xl px-3.5 py-2.5 font-normal outline-none focus:border-sky-600" />
            </label>
            <ConcordanceMdp mdp={changeMdp.nouveau} confirmation={changeMdp.confirmation} />
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setChangeMdp(null)} className="border border-stone-300 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-stone-50">Annuler</button>
              <button disabled={changeMdp.envoi} onClick={async () => {
                if (!changeMdp.actuel) return setChangeMdp({ ...changeMdp, msg: "Saisissez d'abord votre mot de passe actuel." });
                if (changeMdp.nouveau.length < 6) return setChangeMdp({ ...changeMdp, msg: "Nouveau mot de passe : 6 caractères minimum." });
                if (changeMdp.nouveau !== changeMdp.confirmation) return setChangeMdp({ ...changeMdp, msg: "Les deux saisies du nouveau mot de passe diffèrent." });
                if (changeMdp.nouveau === changeMdp.actuel) return setChangeMdp({ ...changeMdp, msg: "Le nouveau mot de passe est identique à l'actuel." });
                setChangeMdp({ ...changeMdp, envoi: true, msg: null });
                /* Revalidation de l'identité. Cet appel ne consomme aucun
                   courriel : c'est une connexion, pas un envoi. */
                const { error: eVerif } = await sb.auth.signInWithPassword({
                  email: session.email, password: changeMdp.actuel });
                if (eVerif) {
                  return setChangeMdp({ ...changeMdp, envoi: false,
                    msg: /Invalid login/i.test(eVerif.message || "")
                      ? "Mot de passe actuel incorrect."
                      : messageAuth(eVerif) });
                }
                const { error } = await sb.auth.updateUser({ password: changeMdp.nouveau });
                if (error) return setChangeMdp({ ...changeMdp, envoi: false, msg: messageAuth(error) });
                setChangeMdp(null); notif("Mot de passe modifié.");
              }} className="text-white px-6 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60" style={{ background: C.vertFonce }}>
                {changeMdp.envoi ? "Un instant…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- FENÊTRE : MODIFIER LA DIMENSION ---------- */}
      {dimEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(10,25,38,.55)" }}
          onClick={(e) => e.target === e.currentTarget && setDimEdit(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl p-5 md:p-7 page-anim max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <h3 className="text-xl font-bold">Modifier la dimension</h3>
              <button onClick={() => setDimEdit(null)} className="text-stone-400 hover:text-stone-700" title="Fermer" aria-label="Fermer"><Icone n="fermer" t={18} /></button>
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
              <button onClick={() => setIndEdit(null)} className="text-stone-400 hover:text-stone-700" title="Fermer" aria-label="Fermer"><Icone n="fermer" t={18} /></button>
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
              <button onClick={() => setSuiviEdit(null)} className="text-stone-400 hover:text-stone-700" title="Fermer" aria-label="Fermer"><Icone n="fermer" t={18} /></button>
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
              <div className="text-sm font-semibold text-stone-800">Documents de suivi <span className="font-normal text-stone-400">(rattachés à la fiche PDF, 2 Mo max par fichier)</span></div>
              <label className="mt-2 flex items-center justify-center gap-2 border-2 border-dashed border-stone-300 rounded-xl py-4 text-sm text-stone-500 cursor-pointer hover:bg-stone-50">
                <Icone n="trombone" t={16} /> Choisir des fichiers (photos, rapports…)
                <input type="file" multiple className="hidden" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                  onChange={(e) => {
                    Array.from(e.target.files || []).forEach((fich) => {
                      if (fich.size > 2 * 1024 * 1024) { notif(`« ${fich.name} » dépasse 2 Mo, fichier ignoré`); return; }
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
                      <button onClick={() => setDocVu(d)} className="flex items-center gap-2 min-w-0 text-left hover:opacity-80" title="Ouvrir le document en grand.">
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
