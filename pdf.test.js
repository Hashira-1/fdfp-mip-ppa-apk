/* Tests de « pdf.js » — préparation du texte des fiches PDF.
 *
 * Ce code a une histoire : il translittérait autrefois TOUS les accents
 * (« Efficacite pedagogique ») au motif que les polices standard du PDF
 * géraient mal l'UTF-8. C'était faux. Ces tests fixent le comportement juste,
 * pour qu'il ne soit pas « rétabli » par prudence mal placée.
 *
 * L'enjeu n'est pas cosmétique : un seul caractère non représentable dérègle
 * l'espacement de toute la ligne dans jsPDF.
 */
import { describe, it, expect } from "vitest";
import { nettoyerPdf, HORS_CP1252, estRenduPdf } from "./pdf.js";

describe("nettoyerPdf — ce qui doit passer intact", () => {
  it("garde les accents français", () => {
    expect(nettoyerPdf("Efficacité pédagogique")).toBe("Efficacité pédagogique");
    expect(nettoyerPdf("Bénéficiaire · Opérateur")).toBe("Bénéficiaire · Opérateur");
  });

  it("garde les ligatures et la ponctuation française", () => {
    expect(nettoyerPdf("cœur, æquo « guillemets » — tiret…")).toBe("cœur, æquo « guillemets » — tiret…");
  });

  it("garde les symboles de Windows-1252", () => {
    expect(nettoyerPdf("€ © ° ± × ÷ § ‰")).toBe("€ © ° ± × ÷ § %o");
  });

  it("garde les majuscules accentuées, y compris en tête de phrase", () => {
    expect(nettoyerPdf("Édité le 08/08/2026")).toBe("Édité le 08/08/2026");
    expect(nettoyerPdf("À 0,6 point du seuil")).toBe("À 0,6 point du seuil");
  });
});

describe("nettoyerPdf — ce qui doit être converti", () => {
  it("remplace les comparateurs des cibles d'indicateurs", () => {
    // Présents dans le référentiel : « cible : ≥ 80 % »
    expect(nettoyerPdf("cible : ≥ 80 %")).toBe("cible : >= 80 %");
    expect(nettoyerPdf("cible : ≤ 20 %")).toBe("cible : <= 20 %");
  });

  it("ramène les espaces spéciales à l'espace ordinaire", () => {
    // Le séparateur de milliers : sans cela le budget s'affichait collé.
    expect(nettoyerPdf("12 500 000 FCFA")).toBe("12 500 000 FCFA");
    expect(nettoyerPdf("15 200 000")).toBe("15 200 000");
  });

  it("réduit une lettre inconnue à sa lettre de base plutôt qu'à un trou", () => {
    expect(nettoyerPdf("Ā")).toBe("A");
    expect(nettoyerPdf("ř")).toBe("r");
    expect(nettoyerPdf("Ștefan")).toBe("Stefan");
  });

  it("traduit les lettres latines que la décomposition ne réduit pas", () => {
    /* Seules les lettres hors Windows-1252 sont touchées : « Ł » et « ź » ont
       leur équivalent explicite, « ó » est du Latin-1 et reste tel quel. Il
       serait faux d'attendre « Lodz » — ce serait retomber dans la
       translittération générale que ce fichier a précisément abandonnée. */
    expect(nettoyerPdf("Łódź")).toBe("Lódz");
    expect(nettoyerPdf("Đà Nẵng")).toBe("Dà Nang");
  });
});

describe("nettoyerPdf — ce qui doit disparaître", () => {
  it("ne laisse jamais de point d'interrogation de substitution", () => {
    // Un document officiel ne doit pas afficher « ? » à la place d'un signe.
    for (const t of ["中文", "日本語", "😀", "→ ✓ ✗"]) {
      expect(nettoyerPdf(t)).not.toContain("?");
    }
  });

  it("supprime ce qui n'a aucun équivalent, sans rien laisser d'illisible", () => {
    expect(nettoyerPdf("abc中文def")).toBe("abcdef");
    expect(nettoyerPdf("😀")).toBe("");
  });

  it("ne laisse aucun caractère hors du répertoire rendu", () => {
    const source = "Décorticage ≥ 80 % · Łódź — « cœur » 中 😀  ";
    for (const c of nettoyerPdf(source)) {
      expect(estRenduPdf(c)).toBe(true);
    }
  });
});

describe("nettoyerPdf — robustesse", () => {
  it("accepte null, undefined et les nombres", () => {
    expect(nettoyerPdf(null)).toBe("");
    expect(nettoyerPdf(undefined)).toBe("");
    expect(nettoyerPdf(42)).toBe("42");
  });

  it("est idempotent : deux passes donnent le même texte", () => {
    const t = "Décorticage ≥ 80 % · Łódź — 12 500 FCFA 中";
    expect(nettoyerPdf(nettoyerPdf(t))).toBe(nettoyerPdf(t));
  });

  it("ne produit que des équivalents eux-mêmes représentables", () => {
    for (const v of Object.values(HORS_CP1252)) {
      for (const c of v) expect(estRenduPdf(c)).toBe(true);
    }
  });
});
