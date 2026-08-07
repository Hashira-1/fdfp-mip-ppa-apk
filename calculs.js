// ============================================================================
//  FDFP · MIP-PPA — Le modèle de calcul
//  ---------------------------------------------------------------------------
//  Ces quatre fonctions *sont* le modèle MIP-PPA : tout le reste de
//  l'application les habille. Elles vivent dans un fichier séparé — à plat, sans
//  sous-dossier, conformément à la contrainte du dépôt — pour une seule raison :
//  pouvoir les tester sans démarrer React, Recharts ni Supabase.
//  Les tests correspondants sont dans « calculs.test.js ».
// ============================================================================

// Couleurs des quatre paliers de performance, reprises de la charte de l'app.
export const COULEURS_NIVEAU = {
  excellent: "#16a34a",
  satisfaisant: "#1d6fa8",
  dev: "#ef8f1c",
  insuffisant: "#dc2626",
};

/* Score d'une dimension : moyenne SIMPLE des indicateurs notés, ramenée sur
   100. Les indicateurs d'une même dimension sont donc équipondérés — seules
   les dimensions portent un poids. Les indicateurs non notés sont ignorés,
   ils ne comptent pas comme des zéros.
   Renvoie null si aucun indicateur de la dimension n'est noté. */
export function scoreDimension(referentiel, dimId, notes) {
  const dim = referentiel.find((d) => d.id === dimId);
  if (!dim) return null;
  const vals = dim.indicateurs.map((i) => notes[i.id]).filter((v) => v !== undefined && v !== null);
  if (!vals.length) return null;
  return (vals.reduce((a, b) => a + b, 0) / vals.length / 4) * 100;
}

/* Score global : moyenne des scores de dimension, pondérée par le poids des
   dimensions — mais renormalisée sur les seules dimensions évaluées. Un projet
   noté sur une seule dimension obtient donc un score « sur 100 ».
   C'est voulu (on ne pénalise pas une évaluation en cours de route), mais cela
   rend le score incomparable d'un projet à l'autre tant qu'on ne publie pas la
   couverture : voir « couvertureModele », affichée partout à côté du score. */
export function scoreGlobal(referentiel, notes) {
  let tot = 0, poidsTot = 0;
  referentiel.forEach((d) => {
    const s = scoreDimension(referentiel, d.id, notes);
    if (s !== null) { tot += s * d.poids; poidsTot += d.poids; }
  });
  return poidsTot ? tot / poidsTot : null;
}

/* Couverture : part du modèle sur laquelle le score global porte réellement.
   « pct » suit exactement la logique de scoreGlobal — une dimension compte
   pour tout son poids dès qu'un seul de ses indicateurs est noté — tandis que
   « notees / indicateurs » donne le décompte fin, plus parlant à la lecture. */
export function couvertureModele(referentiel, notes) {
  let poidsEvalue = 0, poidsTotal = 0, notees = 0, indicateurs = 0;
  referentiel.forEach((d) => {
    poidsTotal += d.poids;
    indicateurs += d.indicateurs.length;
    const n = d.indicateurs.filter((i) => notes[i.id] !== undefined && notes[i.id] !== null).length;
    notees += n;
    if (n) poidsEvalue += d.poids;
  });
  return { pct: poidsTotal ? (poidsEvalue / poidsTotal) * 100 : 0, notees, indicateurs };
}

/* Palier de performance. Les bornes 80 / 60 / 40 sont INCLUSIVES : un score de
   80,0 est « Excellent », pas « Satisfaisant ». */
export function niveau(score) {
  if (score === null) return { txt: "Non évalué", bg: "#e7e5e4", fg: "#57534e" };
  if (score >= 80) return { txt: "Excellent", bg: COULEURS_NIVEAU.excellent, fg: "#fff" };
  if (score >= 60) return { txt: "Satisfaisant", bg: COULEURS_NIVEAU.satisfaisant, fg: "#fff" };
  if (score >= 40) return { txt: "Moyen", bg: COULEURS_NIVEAU.dev, fg: "#fff" };
  return { txt: "Insuffisant", bg: COULEURS_NIVEAU.insuffisant, fg: "#fff" };
}

/* Indicateurs qui ne sont pas encore notés, éventuellement restreints à une
   phase. Sert à distinguer deux situations que l'application confondait :
   un suivi « en retard » (le jalon M+3 / M+6 / M+12 n'a pas été fait) et un
   projet dont l'échéance est passée alors que des indicateurs ne sont
   toujours pas renseignés — un trou d'évaluation, qui bloque le calcul du
   score bien plus sûrement qu'un suivi administratif non coché. */
export function indicateursNonNotes(referentiel, notes, phase = null) {
  const liste = [];
  referentiel.forEach((d) => {
    d.indicateurs.forEach((i) => {
      if (phase && i.phase !== phase) return;
      if (notes[i.id] === undefined || notes[i.id] === null) {
        liste.push({ id: i.id, label: i.label, phase: i.phase, dimension: d.nom });
      }
    });
  });
  return liste;
}

/* ===========================================================================
   TRAJECTOIRE — l'évolution du score d'un projet d'un jalon à l'autre
   ---------------------------------------------------------------------------
   Le modèle MIP-PPA annonce un suivi à M+3 / M+6 / M+12, mais l'application ne
   conservait qu'un seul jeu de notes par projet : chaque nouvelle notation
   écrasait la précédente. Un score de 83 % ne disait donc pas s'il datait de la
   conception ou de M+12, et aucune progression n'était lisible.

   Un « instantané » fige les notes à une date et à un jalon. L'historique est
   un tableau d'instantanés stocké avec le projet — pas de nouvelle table, donc
   pas de nouvelle politique RLS à écrire (la colonne hérite de celles de
   « projets »).
   =========================================================================== */

export const JALONS = ["Initiale", "M+3", "M+6", "M+12"];

/* Photographie de l'évaluation à un instant donné. Les scores sont figés en
   même temps que les notes : si le référentiel est modifié plus tard, les
   instantanés passés gardent la valeur qu'ils avaient au moment de la mesure. */
export function instantane(referentiel, notes, jalon, date) {
  const c = couvertureModele(referentiel, notes);
  return {
    jalon,
    date: date || new Date().toISOString().slice(0, 10),
    score: scoreGlobal(referentiel, notes),
    couverture: c.pct,
    notees: c.notees,
    dimensions: Object.fromEntries(
      referentiel.map((d) => [d.id, scoreDimension(referentiel, d.id, notes)])),
  };
}

/* Ajoute un instantané. Un jalon déjà présent est REMPLACÉ : refiger M+6
   corrige la mesure au lieu d'en empiler deux. Le tri suit l'ordre des jalons
   du modèle, et non la date de saisie — un évaluateur peut très bien renseigner
   M+12 avant d'avoir rattrapé M+6. */
export function ajouterInstantane(historique, snap) {
  const sans = (historique || []).filter((h) => h.jalon !== snap.jalon);
  return [...sans, snap].sort(
    (a, b) => JALONS.indexOf(a.jalon) - JALONS.indexOf(b.jalon));
}

/* Trajectoire : chaque instantané enrichi de son écart au précédent.
   « delta » vaut null pour le premier point — il n'y a rien avant lui. */
export function trajectoire(historique) {
  const h = [...(historique || [])].sort(
    (a, b) => JALONS.indexOf(a.jalon) - JALONS.indexOf(b.jalon));
  return h.map((p, i) => {
    const prec = i > 0 ? h[i - 1] : null;
    const delta = prec && p.score !== null && prec.score !== null
      ? p.score - prec.score : null;
    return { ...p, delta, sens: delta === null ? null : delta > 0 ? "hausse" : delta < 0 ? "baisse" : "stable" };
  });
}

export const SEUILS_NIVEAU = [40, 60, 80];

/* Distance du score aux paliers voisins, convertie en nombre de crans.
   ---------------------------------------------------------------------------
   Un score de 59,65 s'affiche « Moyen » et un score de 60,1 « Satisfaisant »
   alors que les deux projets sont pratiquement identiques : la frontière est
   conventionnelle, pas naturelle. Publier la distance au palier évite cette
   lecture binaire, et surtout la rend actionnable — « il manque 0,35 point »
   ne dit rien à un agent, « un cran sur un seul indicateur suffit » si.

   Un « cran » est une note qui progresse d'une unité sur l'échelle 0–4. Son
   effet sur le score global vaut (25 / nombre d'indicateurs notés de la
   dimension) × poids de la dimension ÷ poids total évalué — ce dernier étant
   le dénominateur renormalisé de scoreGlobal, pas 100.

   Seules les dimensions gardant une marge de progression sont retenues : un
   indicateur déjà noté 4 ne peut plus rien apporter. On ne compte pas non plus
   les indicateurs pas encore notés, car les noter change le diviseur de la
   moyenne et peut faire baisser le score.

   Renvoie null si le projet n'est pas évalué. */
export function margeSeuil(referentiel, notes) {
  const score = scoreGlobal(referentiel, notes);
  if (score === null) return null;

  const seuilHaut = SEUILS_NIVEAU.find((s) => s > score) ?? null;
  const seuilBas = [...SEUILS_NIVEAU].reverse().find((s) => s <= score) ?? null;

  let poidsTot = 0;
  referentiel.forEach((d) => {
    if (scoreDimension(referentiel, d.id, notes) !== null) poidsTot += d.poids;
  });

  let meilleurCran = 0;
  referentiel.forEach((d) => {
    const notees = d.indicateurs.filter((i) => notes[i.id] !== undefined && notes[i.id] !== null);
    if (!notees.length || !notees.some((i) => notes[i.id] < 4)) return;
    const gain = (25 / notees.length) * d.poids / poidsTot;
    if (gain > meilleurCran) meilleurCran = gain;
  });

  return {
    score,
    seuilHaut,
    versLeHaut: seuilHaut === null ? null : seuilHaut - score,
    depuisLeBas: seuilBas === null ? null : score - seuilBas,
    crans: seuilHaut !== null && meilleurCran > 0
      ? Math.ceil((seuilHaut - score) / meilleurCran)
      : null,
  };
}
