/* Tests de « referentiel.js » — nomenclature et normalisation.
 *
 * Ces fonctions décident de ce que l'application fait des valeurs déjà
 * enregistrées. Une conversion ratée ne provoque pas d'erreur : elle affiche
 * simplement une valeur fausse, ou fait disparaître un projet d'un filtre.
 * D'où ces tests.
 */
import { describe, it, expect } from "vitest";
import {
  STATUTS_PROJET, normaliserStatut, normaliserRegion, normaliserLocalite,
  localitesDe, localiteParDefaut, IMPLANTATIONS, LOCALITES_PAR_ZONE,
  masqueOrganisations, nomMasque, memeNom, clePivot,
} from "./referentiel.js";
import { DEPARTEMENTS } from "./geo-civ.js";

describe("normaliserStatut", () => {
  it("le statut qualifie le projet : masculin", () => {
    expect(STATUTS_PROJET).toEqual(["Planifié", "En cours", "Terminé"]);
  });

  it("convertit les valeurs féminines déjà en base", () => {
    // Écrites ainsi tant que l'application parlait de « formations ».
    expect(normaliserStatut("Terminée")).toBe("Terminé");
    expect(normaliserStatut("Planifiée")).toBe("Planifié");
  });

  it("accepte les variantes sans accent et la casse", () => {
    expect(normaliserStatut("terminee")).toBe("Terminé");
    expect(normaliserStatut("PLANIFIEE")).toBe("Planifié");
    expect(normaliserStatut("en cours")).toBe("En cours");
  });

  it("laisse passer les valeurs déjà correctes", () => {
    STATUTS_PROJET.forEach((s) => expect(normaliserStatut(s)).toBe(s));
  });

  it("retombe sur « Planifié » quand rien n'est renseigné", () => {
    expect(normaliserStatut("")).toBe("Planifié");
    expect(normaliserStatut(null)).toBe("Planifié");
    expect(normaliserStatut(undefined)).toBe("Planifié");
  });

  it("conserve une valeur inconnue plutôt que de la perdre", () => {
    // Mieux vaut un statut étrange affiché tel quel qu'un statut inventé.
    expect(normaliserStatut("Suspendu")).toBe("Suspendu");
  });
});

describe("normaliserRegion", () => {
  it("ramène les écritures historiques à la nomenclature", () => {
    expect(normaliserRegion("Abidjan")).toBe("Siège Abidjan");
    expect(normaliserRegion("antenne de Bouaké")).toBe("Antenne Bouaké");
    expect(normaliserRegion("SAN PEDRO")).toBe("Antenne San-Pédro");
  });

  it("laisse intacte une valeur hors nomenclature", () => {
    expect(normaliserRegion("Ouagadougou")).toBe("Ouagadougou");
  });
});

describe("memeNom — accents et séparateurs", () => {
  it("reconnaît les formes du document de la DACD", () => {
    // Le Word écrit en capitales, sans accents ni traits d'union.
    expect(normaliserRegion("SAN PEDRO")).toBe("Antenne San-Pédro");
    expect(normaliserRegion("San Pedro")).toBe("Antenne San-Pédro");
    expect(normaliserRegion("SIEGE")).toBe("Siège Abidjan");
  });

  it("reconnaît les localités écrites sans accent ni séparateur", () => {
    expect(normaliserLocalite("M'BENGUE", "Antenne Korhogo")).toBe("M'Bengué");
    expect(normaliserLocalite("AGNIBILEKROU", "Antenne Abengourou")).toBe("Agnibilékrou");
    expect(normaliserLocalite("san pedro", "Antenne San-Pédro")).toBe("San-Pédro");
  });
});

describe("localités et zones", () => {
  it("ne propose à la saisie que les villes cibles du document", () => {
    // 76 départements cités + Bonoua, citée elle aussi.
    const toutes = IMPLANTATIONS.flatMap((z) => localitesDe(z));
    expect(toutes).toHaveLength(77);
    expect(new Set(toutes).size).toBe(77);
  });

  it("le zonage, lui, couvre le territoire entier", () => {
    /* La distinction est celle du FDFP : la zone d'occupation d'une antenne
       couvre tous ses départements ; le document ne nomme que les villes où
       elle intervient. Un département sans ville cible appartient donc bien à
       une antenne — il est colorié comme elle — mais rien ne s'y localise. */
    // Aucun département orphelin, et aucune zone hors nomenclature.
    expect(DEPARTEMENTS.every((d) => d.z)).toBe(true);
    expect(DEPARTEMENTS.every((d) => IMPLANTATIONS.includes(d.z))).toBe(true);
    // Les villes cibles sont un sous-ensemble strict des départements zonés.
    expect(DEPARTEMENTS.filter((d) => d.t)).toHaveLength(77);
    expect(DEPARTEMENTS.length).toBeGreaterThan(77);
  });

  it("les départements sans ville cible restent rattachés à leur antenne", () => {
    const parNom = (n) => DEPARTEMENTS.find((d) => d.n === n);
    expect(parNom("Taabo").z).toBe("Siège Abidjan");
    expect(parNom("Prikro").z).toBe("Antenne Abengourou");
    expect(parNom("Sipilou").z).toBe("Antenne Man");
    // …mais aucun n'est proposé à la saisie.
    const toutes = IMPLANTATIONS.flatMap((z) => localitesDe(z));
    ["Taabo", "Tiapoum", "Téhini", "Koun-Fao", "Prikro", "Kouto",
     "Madinani", "Sipilou", "Buyo", "Méagui", "Gbeleban", "Bloléquin"]
      .forEach((n) => expect(toutes).not.toContain(n));
  });

  it("M'Bengué est bien une ville cible de Korhogo", () => {
    expect(localitesDe("Antenne Korhogo")).toContain("M'Bengué");
  });

  it("inclut Bonoua, citée par la DACD sans être un département", () => {
    // Sous-préfecture de Grand-Bassam : absente du niveau départemental,
    // mais nommée par le document pour le Siège.
    expect(localitesDe("Siège Abidjan")).toContain("Bonoua");
    expect(localitesDe("Siège Abidjan")).toContain("Grand-Bassam");
  });

  it("les huit implantations ont toutes des localités", () => {
    expect(Object.keys(LOCALITES_PAR_ZONE).sort()).toEqual([...IMPLANTATIONS].sort());
    IMPLANTATIONS.forEach((z) => expect(localitesDe(z).length).toBeGreaterThan(0));
  });

  it("le chef-lieu par défaut est celui qui porte le nom de l'implantation", () => {
    expect(localiteParDefaut("Antenne Korhogo")).toBe("Korhogo");
    expect(localiteParDefaut("Siège Abidjan")).toBe("Abidjan");
    expect(localiteParDefaut("Antenne San-Pédro")).toBe("San-Pédro");
  });

  it("ramène une localité étrangère à la zone vers son chef-lieu", () => {
    // Odienné relève de Korhogo : demandée sous Bouaké, elle est refusée.
    expect(normaliserLocalite("Odienné", "Antenne Bouaké")).toBe("Bouaké");
    expect(normaliserLocalite("Odienné", "Antenne Korhogo")).toBe("Odienné");
  });

  it("comble une localité absente, pour qu'une carte ait toujours un point", () => {
    expect(normaliserLocalite("", "Antenne Man")).toBe("Man");
    expect(normaliserLocalite(null, "Antenne Daloa")).toBe("Daloa");
  });

  it("les régions partagées entre deux antennes sont bien réparties", () => {
    // C'est le point qui imposait de découper au département, pas à la région.
    expect(localitesDe("Antenne Abengourou")).toContain("Daoukro");   // Iffou
    expect(localitesDe("Antenne Bouaké")).toContain("M'Bahiakro");    // Iffou
    expect(localitesDe("Antenne Yamoussoukro")).toContain("Oumé");    // Gôh
    expect(localitesDe("Antenne San-Pédro")).toContain("Gagnoa");     // Gôh
  });
});

/* Masque de présentation des organisations.
 *
 * Ce masque sert à projeter un écran devant une assemblée. Une étiquette
 * instable — la même entreprise numérotée différemment selon la page — rendrait
 * la lecture croisée impossible et ferait croire à deux organisations là où il
 * n'y en a qu'une. D'où ces tests. */
describe("masqueOrganisations", () => {
  const DEMO = [
    { entreprise: "SACO", operateur: "A.C.A", beneficiaire: "SCINPA" },
    { entreprise: "DIAOUNE AGRO-ALIMENTAIRE", operateur: "Emergence", beneficiaire: "DIAOUNE AGRO-ALIMENTAIRE" },
    { entreprise: "FrieslandCampina", operateur: "Domny", beneficiaire: "FrieslandCampina" },
  ];

  it("numérote par rôle de première apparition", () => {
    const m = masqueOrganisations(DEMO);
    expect(nomMasque(m, "SACO")).toBe("Promoteur 1");
    expect(nomMasque(m, "A.C.A")).toBe("Opérateur 1");
    expect(nomMasque(m, "SCINPA")).toBe("Bénéficiaire 1");
    expect(nomMasque(m, "DIAOUNE AGRO-ALIMENTAIRE")).toBe("Promoteur 2");
    expect(nomMasque(m, "FrieslandCampina")).toBe("Promoteur 3");
  });

  it("garde une seule étiquette pour une organisation qui est son propre bénéficiaire", () => {
    const m = masqueOrganisations(DEMO);
    // « Promoteur 2 » et non « Bénéficiaire 2 » : c'est la même personne morale,
    // et l'écran doit continuer à le montrer.
    expect(nomMasque(m, DEMO[1].beneficiaire)).toBe(nomMasque(m, DEMO[1].entreprise));
  });

  it("reconnaît une même organisation écrite autrement", () => {
    const m = masqueOrganisations(DEMO);
    expect(nomMasque(m, "saco")).toBe("Promoteur 1");
    expect(nomMasque(m, "A C A")).toBe("Opérateur 1");
    expect(nomMasque(m, "ACA")).toBe("Opérateur 1");
  });

  it("laisse intact un nom qu'il ne connaît pas, et n'agit pas sans masque", () => {
    const m = masqueOrganisations(DEMO);
    expect(nomMasque(m, "NOUVELLE SARL")).toBe("NOUVELLE SARL");
    expect(nomMasque(null, "SACO")).toBe("SACO");
  });

  it("ignore les champs vides sans consommer de numéro", () => {
    const m = masqueOrganisations([
      { entreprise: "A", operateur: "", beneficiaire: null },
      { entreprise: "B", operateur: "X" },
    ]);
    expect(nomMasque(m, "A")).toBe("Promoteur 1");
    expect(nomMasque(m, "B")).toBe("Promoteur 2");
    expect(nomMasque(m, "X")).toBe("Opérateur 1");
  });

  it("est stable : deux constructions donnent le même résultat", () => {
    const a = masqueOrganisations(DEMO);
    const b = masqueOrganisations(DEMO);
    for (const p of DEMO) expect(nomMasque(a, p.entreprise)).toBe(nomMasque(b, p.entreprise));
  });

  it("supporte une entrée absente ou non tabulaire", () => {
    expect(masqueOrganisations(undefined).size).toBe(0);
    expect(masqueOrganisations(null).size).toBe(0);
    expect(masqueOrganisations([null, undefined]).size).toBe(0);
  });
});

describe("clePivot / memeNom", () => {
  it("ignore accents, espaces, traits d'union, apostrophes et points", () => {
    expect(memeNom("San-Pédro", "SAN PEDRO")).toBe(true);
    expect(memeNom("M'Bengué", "MBENGUE")).toBe(true);
    expect(memeNom("A.C.A", "aca")).toBe(true);
    expect(clePivot("  Côte d'Ivoire ")).toBe("cotedivoire");
  });
  it("ne confond pas deux noms distincts", () => {
    expect(memeNom("Bouaké", "Abidjan")).toBe(false);
  });
});
