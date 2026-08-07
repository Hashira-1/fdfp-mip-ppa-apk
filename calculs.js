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
