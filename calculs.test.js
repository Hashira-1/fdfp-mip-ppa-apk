// ============================================================================
//  Tests du modèle MIP-PPA — « npm test »
//  ---------------------------------------------------------------------------
//  Ces tests portent sur les quatre fonctions qui produisent les notes du
//  modèle. Ils répondent à une question que la soutenance posera : comment
//  sait-on que le calcul est juste ?
// ============================================================================
import { describe, it, expect } from "vitest";
import {
  scoreDimension, scoreGlobal, couvertureModele, niveau, margeSeuil,
  indicateursNonNotes, instantane, ajouterInstantane, trajectoire,
} from "./calculs.js";

/* Référentiel réduit, aux poids et volumes du modèle réel : cinq dimensions
   pesant 20/25/20/25/10, 23 indicateurs au total. */
const ind = (prefixe, n) => Array.from({ length: n }, (_, i) => ({ id: prefixe + (i + 1) }));
const REF = [
  { id: "P",  nom: "Pertinence",                 poids: 20, indicateurs: ind("P", 4) },
  { id: "EP", nom: "Efficacité pédagogique",     poids: 25, indicateurs: ind("EP", 6) },
  { id: "IE", nom: "Insertion et employabilité", poids: 20, indicateurs: ind("IE", 4) },
  { id: "IO", nom: "Impact organisationnel",     poids: 25, indicateurs: ind("IO", 5) },
  { id: "DC", nom: "Durabilité des compétences", poids: 10, indicateurs: ind("DC", 4) },
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

describe("margeSeuil", () => {
  /* Cas réel : projet AGROCI du portefeuille FDFP (export du 6 août 2026).
     Notes reconstituées à partir des scores de dimension 44 / 63 / 63 / 65 / 63.
     Score global 59,375 — à 0,625 point du palier « Satisfaisant ». */
  const AGROCI = {
    P1: 2, P2: 2, P3: 2, P4: 1,                       // 7/16  -> 43,75 %
    EP1: 3, EP2: 3, EP3: 3, EP4: 2, EP5: 2, EP6: 2,   // 15/24 -> 62,5 %
    IE1: 3, IE2: 3, IE3: 2, IE4: 2,                   // 10/16 -> 62,5 %
    IO1: 3, IO2: 3, IO3: 3, IO4: 2, IO5: 2,           // 13/20 -> 65 %
    DC1: 3, DC2: 3, DC3: 2, DC4: 2,                   // 10/16 -> 62,5 %
  };

  it("mesure la distance au palier supérieur", () => {
    const m = margeSeuil(REF, AGROCI);
    expect(m.score).toBeCloseTo(59.375, 6);
    expect(m.seuilHaut).toBe(60);
    expect(m.versLeHaut).toBeCloseTo(0.625, 6);
  });

  it("traduit cette distance en nombre de crans — un seul suffit pour AGROCI", () => {
    // Le meilleur cran vaut 1,25 pt (Pertinence, Insertion ou Impact) :
    // une note qui passe de 2 à 3 sur un seul des 23 indicateurs.
    expect(margeSeuil(REF, AGROCI).crans).toBe(1);
  });

  it("mesure aussi la marge de sécurité au-dessus du palier franchi", () => {
    const m = margeSeuil(REF, AGROCI);
    expect(m.seuilHaut).toBe(60);
    expect(m.depuisLeBas).toBeCloseTo(19.375, 6);   // 59,375 - 40
  });

  it("n'annonce aucun palier supérieur quand le score est au maximum", () => {
    const m = margeSeuil(REF, toutesLesNotes(4));
    expect(m.score).toBe(100);
    expect(m.seuilHaut).toBeNull();
    expect(m.versLeHaut).toBeNull();
    expect(m.crans).toBeNull();   // plus aucun cran disponible : tout est à 4
  });

  it("place le palier du bon côté quand le score tombe pile dessus", () => {
    const m = margeSeuil(REF, toutesLesNotes(2));   // 50 %
    expect(m.score).toBe(50);
    expect(m.seuilHaut).toBe(60);
    expect(m.depuisLeBas).toBe(10);                 // 50 - 40
  });

  it("renvoie null tant que rien n'est noté", () => {
    expect(margeSeuil(REF, {})).toBeNull();
  });

  it("renormalise sur les seules dimensions évaluées", () => {
    // Pertinence seule notée 2/4 : score 50 %, et un cran y vaut 6,25 pt
    // (poids total évalué = 20, pas 100) — donc 2 crans pour atteindre 60.
    const m = margeSeuil(REF, { P1: 2, P2: 2, P3: 2, P4: 2 });
    expect(m.score).toBe(50);
    expect(m.crans).toBe(2);
  });
});

describe("indicateursNonNotes", () => {
  it("liste les indicateurs restant à noter", () => {
    const restants = indicateursNonNotes(REF, { P1: 4, P2: 3 });
    expect(restants).toHaveLength(21);              // 23 - 2
    expect(restants.map((i) => i.id)).toContain("P3");
    expect(restants.map((i) => i.id)).not.toContain("P1");
  });

  it("rattache chaque indicateur à sa dimension", () => {
    const r = indicateursNonNotes(REF, {}).find((i) => i.id === "EP1");
    expect(r.dimension).toBe("Efficacité pédagogique");
  });

  it("ne compte pas la note zéro comme une absence de note", () => {
    expect(indicateursNonNotes(REF, { P1: 0 }).map((i) => i.id)).not.toContain("P1");
  });

  it("renvoie une liste vide quand tout est noté", () => {
    expect(indicateursNonNotes(REF, toutesLesNotes(2))).toHaveLength(0);
  });

  it("filtre sur une phase quand elle est demandée", () => {
    const refPhase = [
      { id: "X", poids: 100, indicateurs: [
        { id: "X1", phase: "À la conception" },
        { id: "X2", phase: "Suivi post-formation" },
        { id: "X3", phase: "Suivi post-formation" },
      ] },
    ];
    expect(indicateursNonNotes(refPhase, {}, "Suivi post-formation").map((i) => i.id))
      .toEqual(["X2", "X3"]);
  });
});

describe("instantané et trajectoire", () => {
  it("fige le score, la couverture et le détail par dimension", () => {
    const s = instantane(REF, { P1: 4, P2: 4, P3: 4, P4: 4 }, "Initiale", "2026-01-15");
    expect(s.jalon).toBe("Initiale");
    expect(s.date).toBe("2026-01-15");
    expect(s.score).toBe(100);
    expect(s.couverture).toBe(20);          // seule la Pertinence est notée
    expect(s.notees).toBe(4);
    expect(s.dimensions.P).toBe(100);
    expect(s.dimensions.EP).toBeNull();     // dimension non évaluée
  });

  it("date au jour même quand aucune date n'est fournie", () => {
    const s = instantane(REF, { P1: 2 }, "M+3");
    expect(s.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("classe les instantanés dans l'ordre des jalons, pas de saisie", () => {
    let h = [];
    h = ajouterInstantane(h, instantane(REF, toutesLesNotes(3), "M+12", "2026-12-01"));
    h = ajouterInstantane(h, instantane(REF, toutesLesNotes(2), "Initiale", "2026-01-01"));
    h = ajouterInstantane(h, instantane(REF, toutesLesNotes(2), "M+6", "2026-06-01"));
    expect(h.map((x) => x.jalon)).toEqual(["Initiale", "M+6", "M+12"]);
  });

  it("remplace un jalon refigé au lieu d'en empiler deux", () => {
    let h = ajouterInstantane([], instantane(REF, toutesLesNotes(2), "M+6", "2026-06-01"));
    h = ajouterInstantane(h, instantane(REF, toutesLesNotes(4), "M+6", "2026-06-15"));
    expect(h).toHaveLength(1);
    expect(h[0].score).toBe(100);
    expect(h[0].date).toBe("2026-06-15");
  });

  it("calcule l'écart d'un jalon au précédent", () => {
    let h = [];
    h = ajouterInstantane(h, instantane(REF, toutesLesNotes(2), "Initiale"));  // 50 %
    h = ajouterInstantane(h, instantane(REF, toutesLesNotes(3), "M+6"));       // 75 %
    h = ajouterInstantane(h, instantane(REF, toutesLesNotes(1), "M+12"));      // 25 %
    const t = trajectoire(h);
    expect(t[0].delta).toBeNull();          // rien avant le premier point
    expect(t[1].delta).toBe(25);
    expect(t[1].sens).toBe("hausse");
    expect(t[2].delta).toBe(-50);
    expect(t[2].sens).toBe("baisse");
  });

  it("signale une progression nulle comme stable", () => {
    let h = ajouterInstantane([], instantane(REF, toutesLesNotes(2), "M+3"));
    h = ajouterInstantane(h, instantane(REF, toutesLesNotes(2), "M+6"));
    expect(trajectoire(h)[1].sens).toBe("stable");
  });

  it("accepte un historique vide ou absent", () => {
    expect(trajectoire([])).toEqual([]);
    expect(trajectoire(undefined)).toEqual([]);
    expect(ajouterInstantane(undefined, instantane(REF, { P1: 2 }, "M+3"))).toHaveLength(1);
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
