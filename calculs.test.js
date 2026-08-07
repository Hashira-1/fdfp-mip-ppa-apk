// ============================================================================
//  Tests du modèle MIP-PPA — « npm test »
//  ---------------------------------------------------------------------------
//  Ces tests portent sur les quatre fonctions qui produisent les notes du
//  modèle. Ils répondent à une question que la soutenance posera : comment
//  sait-on que le calcul est juste ?
// ============================================================================
import { describe, it, expect } from "vitest";
import { scoreDimension, scoreGlobal, couvertureModele, niveau } from "./calculs.js";

/* Référentiel réduit, aux poids et volumes du modèle réel : cinq dimensions
   pesant 20/25/20/25/10, 23 indicateurs au total. */
const ind = (prefixe, n) => Array.from({ length: n }, (_, i) => ({ id: prefixe + (i + 1) }));
const REF = [
  { id: "P",  poids: 20, indicateurs: ind("P", 4) },
  { id: "EP", poids: 25, indicateurs: ind("EP", 6) },
  { id: "IE", poids: 20, indicateurs: ind("IE", 4) },
  { id: "IO", poids: 25, indicateurs: ind("IO", 5) },
  { id: "DC", poids: 10, indicateurs: ind("DC", 4) },
];
const toutesLesNotes = (v) =>
  Object.fromEntries(REF.flatMap((d) => d.indicateurs.map((i) => [i.id, v])));

describe("scoreDimension", () => {
  it("ramène les notes 0–4 sur une échelle de 0 à 100", () => {
    expect(scoreDimension(REF, "P", { P1: 4, P2: 4, P3: 4, P4: 4 })).toBe(100);
    expect(scoreDimension(REF, "P", { P1: 2, P2: 2, P3: 2, P4: 2 })).toBe(50);
    expect(scoreDimension(REF, "P", { P1: 0, P2: 0, P3: 0, P4: 0 })).toBe(0);
  });

  it("fait la moyenne des indicateurs, qui sont équipondérés", () => {
    // (4 + 2) / 2 = 3  →  3/4 = 75 %
    expect(scoreDimension(REF, "P", { P1: 4, P2: 2 })).toBe(75);
  });

  it("ignore les indicateurs non notés au lieu de les compter comme des zéros", () => {
    // Un seul indicateur noté 4/4 donne 100 %, pas 25 %.
    expect(scoreDimension(REF, "P", { P1: 4 })).toBe(100);
    expect(scoreDimension(REF, "P", { P1: 4, P2: undefined, P3: null })).toBe(100);
  });

  it("distingue la note zéro de l'absence de note", () => {
    expect(scoreDimension(REF, "P", { P1: 0 })).toBe(0);      // noté, et mauvais
    expect(scoreDimension(REF, "P", {})).toBeNull();           // pas encore évalué
  });

  it("renvoie null pour une dimension inconnue", () => {
    expect(scoreDimension(REF, "XX", { P1: 4 })).toBeNull();
  });
});

describe("scoreGlobal", () => {
  it("pondère les dimensions par leur poids", () => {
    // P = 100 % (poids 20), DC = 0 % (poids 10) → (100×20 + 0×10) / 30 = 66,67
    const notes = { P1: 4, DC1: 0 };
    expect(scoreGlobal(REF, notes)).toBeCloseTo(200 / 3, 6);
  });

  it("renvoie 100 quand tout est au maximum, 0 quand tout est au minimum", () => {
    expect(scoreGlobal(REF, toutesLesNotes(4))).toBe(100);
    expect(scoreGlobal(REF, toutesLesNotes(0))).toBe(0);
  });

  it("renvoie null tant qu'aucun indicateur n'est noté", () => {
    expect(scoreGlobal(REF, {})).toBeNull();
  });

  it("renormalise sur les seules dimensions évaluées — d'où la couverture", () => {
    // La Pertinence seule (20 % du modèle) suffit à afficher 100 %.
    // Ce test verrouille le comportement : il est voulu, mais il impose
    // d'afficher la couverture partout où ce score est montré.
    expect(scoreGlobal(REF, { P1: 4, P2: 4, P3: 4, P4: 4 })).toBe(100);
    expect(couvertureModele(REF, { P1: 4, P2: 4, P3: 4, P4: 4 }).pct).toBe(20);
  });
});

describe("couvertureModele", () => {
  it("compte 100 % quand toutes les dimensions sont touchées", () => {
    const c = couvertureModele(REF, toutesLesNotes(3));
    expect(c.pct).toBe(100);
    expect(c.notees).toBe(23);
    expect(c.indicateurs).toBe(23);
  });

  it("compte une dimension pour tout son poids dès un seul indicateur noté", () => {
    // Même logique que scoreGlobal : 1 indicateur sur 6 « ouvre » les 25 % d'EP.
    const c = couvertureModele(REF, { EP1: 4 });
    expect(c.pct).toBe(25);
    expect(c.notees).toBe(1);
  });

  it("additionne les poids des dimensions évaluées", () => {
    expect(couvertureModele(REF, { P1: 4, EP1: 4 }).pct).toBe(45);
  });

  it("vaut zéro sans aucune note", () => {
    const c = couvertureModele(REF, {});
    expect(c.pct).toBe(0);
    expect(c.notees).toBe(0);
    expect(c.indicateurs).toBe(23);
  });
});

describe("niveau", () => {
  it("place les bornes 80 / 60 / 40 du bon côté (inclusives)", () => {
    expect(niveau(80).txt).toBe("Excellent");
    expect(niveau(79.9).txt).toBe("Satisfaisant");
    expect(niveau(60).txt).toBe("Satisfaisant");
    expect(niveau(59.9).txt).toBe("Moyen");
    expect(niveau(40).txt).toBe("Moyen");
    expect(niveau(39.9).txt).toBe("Insuffisant");
  });

  it("couvre les extrêmes", () => {
    expect(niveau(100).txt).toBe("Excellent");
    expect(niveau(0).txt).toBe("Insuffisant");
  });

  it("distingue « non évalué » de « insuffisant »", () => {
    expect(niveau(null).txt).toBe("Non évalué");
    expect(niveau(0).txt).toBe("Insuffisant");
  });

  it("déclenche l'alerte du tableau de bord au bon seuil", () => {
    // Le tableau de bord alerte sous 40 : le seuil doit coïncider avec
    // la frontière « Insuffisant ».
    expect(niveau(39.99).txt).toBe("Insuffisant");
    expect(niveau(40).txt).not.toBe("Insuffisant");
  });
});
