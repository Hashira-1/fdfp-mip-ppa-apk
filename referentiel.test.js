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
} from "./referentiel.js";

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
    expect(normaliserLocalite("KOUN FAO", "Antenne Abengourou")).toBe("Koun-Fao");
    expect(normaliserLocalite("san pedro", "Antenne San-Pédro")).toBe("San-Pédro");
  });
});

describe("localités et zones", () => {
  it("couvre les 108 départements, sans doublon entre zones", () => {
    const toutes = IMPLANTATIONS.flatMap((z) => localitesDe(z));
    expect(toutes).toHaveLength(108);
    expect(new Set(toutes).size).toBe(108);
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
