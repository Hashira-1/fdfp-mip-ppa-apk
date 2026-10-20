// ============================================================================
//  Tests du modèle MIP-PPA : « npm test »
//  ---------------------------------------------------------------------------
//  Ces tests portent sur les quatre fonctions qui produisent les notes du
//  modèle. Ils répondent à une question que la soutenance posera : comment
//  sait-on que le calcul est juste ?
// ============================================================================
import { describe, it, expect } from "vitest";
import {
  scoreDimension, scoreGlobal, couvertureModele, niveau, margeSeuil,
  indicateursNonNotes, instantane, ajouterInstantane, trajectoire,
  estDateISO, jourUTC, fmtDateFr, ajouterMois, dureeJours, dureeLisible,
  echeancesSuivi, anomaliesCalendrier, jalonsDeLaPhase, indicateursDuJalon, indicateursHorsSuivi,
} from "./calculs.js";
import { REFERENTIEL_DEFAUT, PHASES_DEFAUT, nbIndicateurs, controleSmart } from "./referentiel.js";

/* Référentiel réduit : cinq dimensions et 23 indicateurs, comme le modèle réel.
   Les poids 20/25/20/25/10 sont ceux d'un double de test, FIGÉS À DESSEIN. Ils
   étaient ceux du modèle jusqu'au 12 septembre 2026 ; le référentiel applique
   désormais 25/20/20/25/10. On ne les suit pas ici : ce que ces tests
   éprouvent, c'est l'arithmétique de l'agrégation, pas la valeur des poids.
   Les faire varier obligerait à recalculer chaque attendu sans rien prouver de
   plus. Le total reste 100, seule propriété dont le calcul dépende. */
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

  it("renormalise sur les seules dimensions évaluées, d'où la couverture", () => {
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
     Score global 59,375 : à 0,625 point du palier « Satisfaisant ». */
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

  it("traduit cette distance en nombre de crans : un seul suffit pour AGROCI", () => {
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
    // (poids total évalué = 20, pas 100), donc 2 crans pour atteindre 60.
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

/* ===========================================================================
   CALENDRIER DU PROJET
   ---------------------------------------------------------------------------
   Ces fonctions décident de la date des trois jalons du modèle. Une erreur
   d'un mois sur « M+3 » se voit à peine à l'écran et fausse tout le suivi
   post-formation : c'est exactement le genre de calcul qui doit être tenu par
   des tests plutôt que par la relecture.
   =========================================================================== */

describe("estDateISO", () => {
  it("accepte une date bien formée", () => {
    expect(estDateISO("2026-03-15")).toBe(true);
    expect(estDateISO("2026-03-15T00:00:00Z")).toBe(true);   // horodatage tronqué
  });

  it("refuse ce qui a la bonne forme mais n'est pas un jour", () => {
    // Date.UTC reporterait silencieusement au 2 mars : l'application
    // afficherait une date que personne n'a saisie.
    expect(estDateISO("2026-02-30")).toBe(false);
    expect(estDateISO("2026-13-01")).toBe(false);
    expect(estDateISO("2026-00-10")).toBe(false);
  });

  it("connaît les années bissextiles", () => {
    expect(estDateISO("2024-02-29")).toBe(true);
    expect(estDateISO("2026-02-29")).toBe(false);
    expect(estDateISO("1900-02-29")).toBe(false);   // divisible par 100, non bissextile
    expect(estDateISO("2000-02-29")).toBe(true);    // divisible par 400, bissextile
  });

  it("refuse le vide et l'absence", () => {
    expect(estDateISO("")).toBe(false);
    expect(estDateISO(null)).toBe(false);
    expect(estDateISO(undefined)).toBe(false);
    expect(estDateISO("15/03/2026")).toBe(false);
  });
});

describe("jourUTC et fmtDateFr", () => {
  it("lit la date à minuit UTC, sans dérive de fuseau", () => {
    expect(jourUTC("2026-03-15")).toBe(Date.UTC(2026, 2, 15));
  });

  it("rend null plutôt qu'une date inventée", () => {
    expect(jourUTC("2026-02-30")).toBe(null);
    expect(jourUTC("")).toBe(null);
  });

  it("écrit la date à la française, et dit ce qu'il remplace quand elle manque", () => {
    expect(fmtDateFr("2026-03-05")).toBe("05/03/2026");
    expect(fmtDateFr("")).toBe("Non renseignée");
    expect(fmtDateFr("", "Fin inconnue")).toBe("Fin inconnue");
  });
});

describe("ajouterMois", () => {
  it("ajoute un mois sans déborder sur le suivant", () => {
    // « setUTCMonth » donnerait le 3 mars : le 31 février n'existe pas.
    expect(ajouterMois("2026-01-31", 1)).toBe("2026-02-28");
    expect(ajouterMois("2024-01-31", 1)).toBe("2024-02-29");   // bissextile
    expect(ajouterMois("2026-03-31", 1)).toBe("2026-04-30");
  });

  it("franchit correctement les fins d'année", () => {
    expect(ajouterMois("2026-11-15", 3)).toBe("2027-02-15");
    expect(ajouterMois("2026-01-15", 12)).toBe("2027-01-15");
    expect(ajouterMois("2026-12-31", 12)).toBe("2027-12-31");
  });

  it("rend une chaîne vide sur une date absente ou fausse", () => {
    expect(ajouterMois("", 3)).toBe("");
    expect(ajouterMois("2026-02-30", 3)).toBe("");
  });
});

describe("dureeJours et dureeLisible", () => {
  it("compte les deux bornes : un projet d'un jour dure un jour", () => {
    expect(dureeJours("2026-03-15", "2026-03-15")).toBe(1);
    expect(dureeJours("2026-03-01", "2026-03-31")).toBe(31);
  });

  it("refuse de rendre une durée quand la fin précède le début", () => {
    // Ce n'est pas une durée négative, c'est une erreur de saisie : la
    // signaler comme telle vaut mieux que d'afficher « -12 jours ».
    expect(dureeJours("2026-03-15", "2026-03-01")).toBe(null);
  });

  it("rend null tant qu'une des deux dates manque", () => {
    expect(dureeJours("2026-03-15", "")).toBe(null);
    expect(dureeJours("", "2026-03-15")).toBe(null);
  });

  it("dit la durée en jours en dessous d'un mois plein", () => {
    expect(dureeLisible("2026-01-01", "2026-01-31")).toBe("31 jours");
    expect(dureeLisible("2026-03-15", "2026-03-15")).toBe("1 jour");
  });

  it("compte les mois de quantième à quantième, pas par tranches de 30", () => {
    expect(dureeLisible("2026-01-01", "2026-03-31")).toBe("2 mois et 30 jours");
    expect(dureeLisible("2026-01-01", "2026-04-01")).toBe("3 mois");
    expect(dureeLisible("2025-11-03", "2026-02-20")).toBe("3 mois et 17 jours");
  });
});

describe("echeancesSuivi", () => {
  it("cale les trois jalons sur la date de FIN du projet", () => {
    // Le point du modèle : M+3 veut dire trois mois après la fin de la
    // formation, pas trois mois après la saisie de la fiche.
    const e = echeancesSuivi("2026-02-20", "2026-08-09");
    expect(e["M+3"]).toBe("2026-05-20");
    expect(e["M+6"]).toBe("2026-08-20");
    expect(e["M+12"]).toBe("2027-02-20");
  });

  it("retombe sur le jour courant quand la date de fin manque", () => {
    const e = echeancesSuivi("", "2026-08-09");
    expect(e["M+3"]).toBe("2026-11-09");
    expect(e["M+12"]).toBe("2027-08-09");
  });

  it("ne rend rien si aucune origine n'est exploitable", () => {
    expect(echeancesSuivi("", "")).toEqual({});
  });

  it("ne déborde pas sur le mois suivant en fin de mois", () => {
    expect(echeancesSuivi("2026-08-31", "")["M+6"]).toBe("2027-02-28");
  });
});

describe("anomaliesCalendrier", () => {
  const AUJ = "2026-08-09";
  const codes = (p) => anomaliesCalendrier(p, AUJ).map((a) => a.code);

  it("ne dit rien d'un projet cohérent", () => {
    expect(codes({ dateDebut: "2026-01-05", dateFin: "2026-05-30", statut: "Terminé" })).toEqual([]);
    expect(codes({ dateDebut: "2026-09-01", dateFin: "2026-12-01", statut: "Planifié" })).toEqual([]);
  });

  it("ne dit rien d'un projet sans dates", () => {
    expect(codes({ statut: "En cours" })).toEqual([]);
  });

  it("signale une fin antérieure au lancement", () => {
    expect(codes({ dateDebut: "2026-05-30", dateFin: "2026-01-05", statut: "En cours" }))
      .toContain("finAvantDebut");
  });

  it("ne cumule pas « fin dépassée » avec « fin avant début »", () => {
    // Les deux dates sont inversées : une seule anomalie, celle qui explique
    // l'autre. Deux lignes pour une seule erreur de saisie noieraient la page.
    expect(codes({ dateDebut: "2026-05-30", dateFin: "2026-01-05", statut: "En cours" }))
      .toEqual(["finAvantDebut"]);
  });

  it("signale une fiche restée « En cours » après sa date de fin", () => {
    expect(codes({ dateDebut: "2026-01-05", dateFin: "2026-05-30", statut: "En cours" }))
      .toContain("finDepasseeNonTermine");
  });

  it("signale un projet encore « Planifié » alors que le lancement est passé", () => {
    expect(codes({ dateDebut: "2026-06-01", dateFin: "2026-12-01", statut: "Planifié" }))
      .toContain("lanceMaisPlanifie");
  });

  it("signale un projet « Terminé » dont la fin est encore à venir", () => {
    expect(codes({ dateDebut: "2026-06-01", dateFin: "2026-12-01", statut: "Terminé" }))
      .toEqual(["termineAvantLaFin"]);
  });

  it("ne juge rien sans savoir quel jour on est", () => {
    // Sauf l'ordre des deux dates, qui ne dépend pas de la date du jour.
    expect(anomaliesCalendrier({ dateDebut: "2026-01-05", dateFin: "2026-05-30", statut: "En cours" }, "")).toEqual([]);
    expect(anomaliesCalendrier({ dateDebut: "2026-05-30", dateFin: "2026-01-05", statut: "En cours" }, "").map((a) => a.code))
      .toEqual(["finAvantDebut"]);
  });
});

describe("jalonsDeLaPhase : à quel suivi un indicateur se note", () => {
  it("lit le mois d'une phase à un seul jalon", () => {
    expect(jalonsDeLaPhase("Suivi post-formation (3 mois)")).toEqual(["M+3"]);
    expect(jalonsDeLaPhase("Suivi post-formation (6 mois)")).toEqual(["M+6"]);
    expect(jalonsDeLaPhase("Suivi post-formation (12 mois)")).toEqual(["M+12"]);
    expect(jalonsDeLaPhase("Suivi M+6")).toEqual(["M+6"]);
  });

  it("n'attache aucun jalon aux phases d'avant la clôture", () => {
    expect(jalonsDeLaPhase("À la conception")).toEqual([]);
    expect(jalonsDeLaPhase("En fin de formation")).toEqual([]);
    expect(jalonsDeLaPhase("")).toEqual([]);
    expect(jalonsDeLaPhase(undefined)).toEqual([]);
  });

  it("départage l'ancienne phase commune par l'intitulé", () => {
    const commune = "Suivi post-formation (3 / 6 / 12 mois)";
    expect(jalonsDeLaPhase(commune, "Taux d'insertion mesuré au suivi M+6 (cible : ≥ 70 %)")).toEqual(["M+6"]);
    expect(jalonsDeLaPhase(commune, "Réduction entre M+0 et M+12")).toEqual(["M+12"]);
    expect(jalonsDeLaPhase(commune, "Constatée à M+6 puis M+12")).toEqual(["M+6", "M+12"]);
  });

  it("note à chaque jalon cité quand l'intitulé ne dit rien", () => {
    expect(jalonsDeLaPhase("Suivi post-formation (3 / 6 / 12 mois)", "Sans précision")).toEqual(["M+3", "M+6", "M+12"]);
  });

  it("ne confond pas une durée de contrat avec un jalon", () => {
    expect(jalonsDeLaPhase("Suivi post-formation (6 mois)", "Emploi stable (contrat ≥ 12 mois)")).toEqual(["M+6"]);
  });
});

describe("indicateursDuJalon", () => {
  it("répartit les indicateurs de suivi du référentiel sur les trois jalons", () => {
    const ids = (j) => indicateursDuJalon(REFERENTIEL_DEFAUT, j).liste.map((i) => i.id);
    expect(ids("M+3")).toEqual(["IE1", "IE2", "IO4"]);
    expect(ids("M+6")).toEqual(["IE3", "IO1", "IO2", "IO3", "DC1", "DC4"]);
    expect(ids("M+12")).toEqual(["IO5", "DC2", "DC3"]);
  });

  it("compte les indicateurs déjà notés, la note 0 comprise", () => {
    const r = indicateursDuJalon(REFERENTIEL_DEFAUT, "M+3", { IE1: 0, IO4: 3 });
    expect(r.total).toBe(3);
    expect(r.notees).toBe(2);
    expect(r.liste.find((i) => i.id === "IE2").note).toBeNull();
    expect(r.liste.find((i) => i.id === "IE1").note).toBe(0);
    expect(r.liste[0].dimension).toBe("Insertion et employabilité");
  });

  it("renvoie une liste vide pour un jalon inconnu ou un référentiel absent", () => {
    expect(indicateursDuJalon(REFERENTIEL_DEFAUT, "M+24").total).toBe(0);
    expect(indicateursDuJalon(null, "M+3").total).toBe(0);
  });
});

describe("référentiel par défaut (celui de l'application en ligne)", () => {
  const tous = REFERENTIEL_DEFAUT.flatMap((d) => d.indicateurs);

  it("compte 22 indicateurs et des pondérations qui totalisent 100", () => {
    expect(nbIndicateurs(REFERENTIEL_DEFAUT)).toBe(22);
    expect(REFERENTIEL_DEFAUT.reduce((s, d) => s + d.poids, 0)).toBe(100);
    expect(REFERENTIEL_DEFAUT.map((d) => d.indicateurs.length)).toEqual([4, 6, 3, 5, 4]);
  });

  it("garde des codes uniques, ceux du référentiel d'origine, sans IE4", () => {
    const codes = tous.map((i) => i.id);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).not.toContain("IE4");
  });

  it("rattache chaque indicateur à une phase connue", () => {
    tous.forEach((i) => expect(PHASES_DEFAUT, i.id).toContain(i.phase));
  });
});

describe("controleSmart", () => {
  it("reconnaît un indicateur dont les cinq critères sont renseignés", () => {
    const c = controleSmart({ id: "IE1", label: "Taux d'insertion", mesure: "insérés ÷ formés × 100", cible: "≥ 70 %", phase: "Suivi post-formation (3 mois)" }, PHASES_DEFAUT);
    expect(c.complet).toBe(true);
  });

  it("signale ce qui manque à un indicateur du référentiel en ligne", () => {
    const c = controleSmart(REFERENTIEL_DEFAUT[0].indicateurs[0], PHASES_DEFAUT);
    expect(c).toMatchObject({ S: true, M: false, A: false, R: true, T: true, complet: false });
  });

  it("signale un indicateur nouvellement créé", () => {
    const c = controleSmart({ id: "X1", label: "Nouvel indicateur à définir", phase: "À définir" }, PHASES_DEFAUT);
    expect(c).toMatchObject({ S: false, M: false, A: false, T: false, complet: false });
  });
});

describe("indicateursHorsSuivi : conception et fin de formation", () => {
  it("regroupe par phase, dans l'ordre du référentiel, les indicateurs d'avant les jalons", () => {
    const g = indicateursHorsSuivi(REFERENTIEL_DEFAUT, {});
    expect(g.map((x) => x.phase)).toEqual(["À la conception", "En fin de formation"]);
    expect(g[0].liste.map((i) => i.id)).toEqual(["P1", "P2", "P3", "P4"]);
    expect(g[1].liste.map((i) => i.id)).toEqual(["EP1", "EP2", "EP3", "EP4", "EP5", "EP6"]);
  });

  it("compte les notes déjà posées", () => {
    const g = indicateursHorsSuivi(REFERENTIEL_DEFAUT, { P1: 4, P2: 0, EP6: 3 });
    expect([g[0].notees, g[0].total, g[1].notees, g[1].total]).toEqual([2, 4, 1, 6]);
  });

  it("couvre, avec les jalons, tout le référentiel sans doublon", () => {
    const avant = indicateursHorsSuivi(REFERENTIEL_DEFAUT).flatMap((g) => g.liste.map((i) => i.id));
    const apres = ["M+3", "M+6", "M+12"].flatMap((j) => indicateursDuJalon(REFERENTIEL_DEFAUT, j).liste.map((i) => i.id));
    const tous = [...avant, ...apres];
    expect(new Set(tous).size).toBe(tous.length);
    expect(tous.length).toBe(nbIndicateurs(REFERENTIEL_DEFAUT));
  });

  it("range sous une phase par défaut un indicateur sans phase", () => {
    const g = indicateursHorsSuivi([{ id: "X", nom: "X", poids: 100, indicateurs: [{ id: "X1", label: "x" }] }]);
    expect(g[0].phase).toBe("Phase non précisée");
  });
});
