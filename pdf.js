/* pdf.js : Préparation du texte pour les documents PDF.
 *
 * Sorti d'« App.jsx » parce que c'est le morceau le plus subtil de la
 * génération de fiches, et le seul qui soit une fonction pure : il se teste
 * (voir « pdf.test.js », npm test) au lieu de se vérifier à l'œil sur un
 * document engendré.
 *
 * Ce qu'il faut savoir avant d'y toucher : un seul caractère non représentable
 * ne se contente pas de mal s'afficher, il dérègle l'espacement de la LIGNE
 * ENTIÈRE. D'où le parti pris : aucun caractère inconnu ne doit sortir d'ici.
 */

/* Preparation du texte pour le PDF.
   ---------------------------------------------------------------------------
   Cette fonction supprimait TOUS les accents : « Efficacite pedagogique ».
   C'etait inutile. Verification faite sur jsPDF 2.5, les polices standard
   rendent parfaitement les accents, les ligatures (oe, ae), la ponctuation
   francaise et les symboles courants : tout Windows-1252 passe.

   Deux choses cassent en revanche, et il faut les traiter, car un seul
   caractere fautif deregle l'espacement de la LIGNE ENTIERE :
     - l'espace fine insecable U+202F, qui s'imprime en « / » ;
     - tout caractere hors Windows-1252, a commencer par « >= » et « <= »,
       qui figurent dans les cibles des indicateurs (« cible : >= 80 % »). */
export const CP1252_SPECIAUX = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
export const HORS_CP1252 = {
  "≥": ">=", "≤": "<=", "≠": "!=", "≈": "~",
  "→": "->", "←": "<-", "⇒": "=>", "✓": "v",
  "✔": "v", "✗": "x", "−": "-", "‰": "%o",
  /* Lettres latines que la decomposition Unicode ne sait pas reduire : ce ne
     sont pas des lettres accentuees mais des caracteres a part entiere, qui
     disparaitraient sans equivalent explicite. */
  "Ł": "L", "ł": "l", "Đ": "D", "đ": "d",
  "Ħ": "H", "ħ": "h", "Ŧ": "T", "ŧ": "t",
  "Ŋ": "N", "ŋ": "n",
};
export const estRenduPdf = (c) => {
  const p = c.codePointAt(0);
  return (p >= 0x20 && p <= 0x7E)          // ASCII imprimable
    || (p >= 0xA1 && p <= 0xFF)            // Latin-1 : accents, symboles
    || CP1252_SPECIAUX.includes(c);        // complement Windows-1252
};
export const nettoyerPdf = (t) => {
  let s = String(t == null ? "" : t);
  /* Espaces speciales ramenees a l'espace ordinaire. Sans cela, le separateur
     de milliers des montants cassait l'affichage du budget. */
  s = s.replace(/[      ]/g, " ");
  return [...s].map((c) => {
    if (HORS_CP1252[c]) return HORS_CP1252[c];
    if (estRenduPdf(c)) return c;
    /* Avant d'abandonner un caractere : lui retirer ses signes diacritiques
       (a-macron -> a, r-caron -> r). Si la lettre de base est imprimable, on
       la garde : mieux vaut une lettre approchee qu'un trou. */
    const base = c.normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (base && [...base].every(estRenduPdf)) return base;
    /* Sinon on le retire purement et simplement : AUCUN caractere inconnu
       ne doit apparaitre dans un document officiel. */
    return "";
  }).join("");
};
