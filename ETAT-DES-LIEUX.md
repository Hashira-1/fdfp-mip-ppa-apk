# État des lieux — PFE MIP-PPA (FDFP × ESA/INP-HB)

> Document de reprise. À joindre à une nouvelle conversation pour repartir
> sans réexpliquer le contexte. Dernière mise à jour : 8 août 2026.

---

## 0. Reprise — à lire en premier

**Documents compagnons** (dans le même dossier, à joindre selon le sujet) :

| Fichier | Pour quoi |
|---|---|
| `BIBLIOGRAPHIE-ET-WEBOGRAPHIE.md` | corrections Zotero, dans l'ordre d'exécution |
| `BIBLIO-OEUVRES-FONDATRICES.md` | références manquantes, au format du guide ESA |
| `MEMOIRE-SECTIONS-A-INSERER.md` | 3 sections rédigées : sensibilité, Durabilité, prudence |
| `supabase-phase3.sql` | migration base **déjà exécutée** le 7 août |
| `supabase-phase4.sql` | migration base **à exécuter** — colonne `localite` (§7 bis) |
| `supabase-phase5.sql` | migration base **à exécuter** : corbeille (§4 ter) |
| `supabase-phase6.sql` | migration base **à exécuter** : cloisonnement RLS |

> ### ⚠ À FAIRE EN PREMIER — perte de données
> Des projets ont disparu. **Le déploiement n'y est pour rien** : publier du
> code n'écrit jamais dans Supabase. La cause et les trois correctifs sont au
> **§4 ter**, avec une requête de diagnostic. **Avant de resaisir quoi que ce
> soit**, regardez si une restauration Supabase (Database → Backups) est encore
> possible. Et **ne rejouez jamais `supabase-phase2_4.sql`**.

### Les sept choses en attente

0. **Tenter la restauration Supabase** et exécuter la requête de diagnostic du
   §4 ter, pour savoir ce qui s'est passé et ce qui est récupérable.
1. **Déployer.** Les fichiers indispensables (§3) **ne sont pas encore sur
   GitHub**. Rien de ce qui a été fait les 7 et 8 août n'est visible en ligne :
   trajectoire, marge au seuil, alerte d'évaluation incomplète, accents et logo
   arrondi dans le PDF, corrections du pied de page, **et la carte des zones**.
   Attention : `geo-civ.js` est **nouveau et indispensable au build**.
2. **Enregistrer le mémoire** après *Refresh* Zotero — le .docx sur disque est
   encore en APA (§7).
3. **Tester le déclencheur `profils_geler_org`** avec un compte Promoteur : la
   commande console est au §5. Non vérifiable sans session.
4. **Saisir les 13 auteurs** dans Zotero (`BIBLIOGRAPHIE-ET-WEBOGRAPHIE.md`).
5. **Exécuter `supabase-phase4.sql`** dans Supabase, pour que la localité des
   projets soit enregistrée (§7 bis). Sans cela, l'application marche mais la
   localité n'est pas conservée d'une session à l'autre.
6. **Faire confirmer le rattachement des 33 départements** que le document de
   la DACD ne cite pas (§7 bis) — ils ont été rattachés par continuité
   régionale, ce qui est un choix de l'assistant, pas une donnée du FDFP.

### Ce qui n'a jamais pu être vérifié à l'écran

Toutes les vérifications de cette session se sont faites **sans session
connectée** : l'assistant ne saisit pas d'identifiants. Sont donc testés par le
code et le calcul, mais **jamais vus dans l'application** :

- la fiche d'évaluation (couverture, marge au seuil, trajectoire) ;
- les pages Référentiel, Alertes, Exports, Utilisateurs ;
- l'export Excel réel et **le rendu de la fiche PDF** ;
- le déclencheur de sécurité en conditions réelles.

Le PDF a été vérifié hors navigateur (rendu en image, pagination page à page,
largeurs mesurées avec jsPDF), mais un export réel depuis l'application reste à
faire. **C'est le premier contrôle à demander après le déploiement.**

---

## 1. Le projet

Application d'évaluation des projets de formation de type apprentissage du FDFP,
selon le modèle **MIP-PPA** : 5 dimensions, 23 indicateurs, notes 0–4, suivi à
M+3 / M+6 / M+12.

**Pile technique** — React 18 + Vite, Tailwind **compilé au build**, Recharts,
jsPDF, ExcelJS, mammoth, pdf-lib, Vitest,
Supabase (PostgreSQL + auth + RLS + temps réel). Déploiement Vercel depuis GitHub.

**Structure volontairement à plat** (aucun sous-dossier, sauf `public/`), pour un
dépôt GitHub par glisser-déposer — *à plat* n'a jamais voulu dire *un seul
fichier*. `App.jsx` fait 3 857 lignes ; en sont sortis `calculs.js` (le modèle,
testé), `referentiel.js` (le vocabulaire métier), `pdf.js` (préparation du
texte des fiches, testé), `geo-civ.js` et `geo-civ-traces.js` (la
géographie).

**Auteur** — EHOUNI Luc-Emmanuel Behira Levy. Stage à l'antenne FDFP de Bouaké,
filière anacarde. Encadreur pédagogique : Dr KACOU Ernest (ESA/INP-HB).

---

## 2. Environnement de travail (important)

| | État |
|---|---|
| **Node / npm** | **v24.19.0 / 11.17.0** — présent, `npm install` fait, build vérifié |
| LibreOffice | installé (rendu .docx → PDF → images possible) |
| Python | disponible, avec `defusedxml`, `lxml`, `pypdf`, `pymupdf` |
| pandoc | disponible |

Node était en réalité **déjà installé** : c'est le PATH du shell qui n'était pas
rechargé, d'où le `node -v` en échec. Si le cas se reproduit :

```
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
```

**Le projet compile et se teste.**

```
npm install     # dépendances
npm test        # 66 tests : modèle (36) + PDF (14) + référentiel (16)
npm run build   # build de production (~15 s)
npm run dev     # serveur local, port 5173
```

Le serveur de développement permet enfin de vérifier les corrections dans un vrai
navigateur, aux largeurs d'un téléphone. `package-lock.json` existe désormais —
**à envoyer sur GitHub**.

> Le seul avertissement est la taille du chunk principal (1,04 Mo — 331 Ko
> compressés), attendue pour un `App.jsx` encore volumineux. Rien à corriger
> pour la soutenance.

---

## 3. Fichiers et ce qu'il faut envoyer sur GitHub

**Deux catégories à ne pas confondre.** Vercel exécute `npm run build`, donc du
JavaScript uniquement : **il n'exécute jamais de SQL**. Les scripts `.sql` se
collent dans l'éditeur SQL de Supabase et n'ont aucun effet depuis GitHub — ils
n'y figurent que comme **livrable**, pour que le schéma de la base soit
reproductible.

**Indispensables au build** — s'il en manque un, le déploiement échoue :
`App.jsx`, `calculs.js`, **`geo-civ.js`**, **`geo-civ-traces.js`**,
**`referentiel.js`**, **`pdf.js`**, `index.css`, `main.jsx`, `index.html`,
`package.json`.

**Utiles mais non bloquants** : `package-lock.json` (fige les versions),
`calculs.test.js` (permet `npm test`), les scripts `.sql` (livrable).

Après ce dépôt, l'habitude « `App.jsx` seul » redevient valable : les autres
fichiers ne changeront plus.

| Fichier | À envoyer |
|---|---|
| `App.jsx` | **oui — modifié** |
| `calculs.js` | **oui — NOUVEAU.** Le modèle MIP-PPA. Sans lui, `App.jsx` ne compile pas |
| `geo-civ.js` | **oui — NOUVEAU.** Nomenclature des 108 localités et leur rattachement aux zones. Sans lui, `App.jsx` ne compile pas |
| `geo-civ-traces.js` | **oui — NOUVEAU.** Les tracés de la carte, chargés à la demande. Absent, la carte reste sur « fond de carte indisponible » |
| `referentiel.js` | **oui — NOUVEAU.** Dimensions, indicateurs, secteurs, rôles, permissions. Sans lui, `App.jsx` ne compile pas |
| `pdf.js` | **oui — NOUVEAU.** Préparation du texte des fiches. Sans lui, `App.jsx` ne compile pas |
| `calculs.test.js` | **oui — NOUVEAU.** 36 tests (`npm test`). Facultatif au build, essentiel en soutenance |
| `pdf.test.js` | **oui — NOUVEAU.** 14 tests du nettoyage de texte PDF. Facultatif au build |
| `index.css` | **oui — NOUVEAU.** Les trois directives Tailwind |
| `package.json` | **oui — modifié.** Dépendances + config PostCSS/Tailwind en ligne |
| `package-lock.json` | **oui — nouveau.** Fige les versions pour le build Vercel |
| `main.jsx` | **oui — modifié** (importe `index.css`) |
| `index.html` | **oui — modifié** (script CDN Tailwind retiré) |
| `.gitignore`, `vite.config.js`, `README.md` | inchangés |
| `supabase-phase2_4.sql` | inchangé (livrable) |
| `supabase-phase3.sql` | **oui — NOUVEAU.** Partie A : colonne `historique`. Partie B : **correctif de sécurité** sur `profiles.org` |
| `supabase-phase4.sql` | **oui — NOUVEAU.** Colonne `localite`. **À exécuter dans Supabase**, pas seulement à déposer |
| `supabase-phase5.sql` | **oui — NOUVEAU.** Corbeille (`supprime_le`). **À exécuter dans Supabase** |
| `referentiel.test.js` | **oui — NOUVEAU.** 16 tests : statuts, zones, localités |
| `public/LISEZ-MOI.md` | inchangé |
| `LOGO-FDFP-…-768x181.png` | **non** — l'image est encodée dans `App.jsx` ; garder comme source |
| `node_modules/`, `dist/`, `.claude/` | **non** — mais le glisser-déposer GitHub **ignore `.gitignore`** : ne déposer que les fichiers ci-dessus, un par un |
| `MEMOIRE_*.docx`, `*.SAUVEGARDE.docx`, guide PDF | non (documents personnels) |

> `tailwind.config.js` et `postcss.config.js` ont été **supprimés** : leur contenu
> tient dans la clé `postcss` de `package.json`. Deux fichiers de moins à la
> racine, pour un résultat identique (CSS généré : 19,7 Ko).

> **C'est tout ou rien.** `App.jsx` importe `calculs.js`, `geo-civ.js`,
> `referentiel.js` et `pdf.js`, et `main.jsx` importe `index.css` : s'il en
> manque un, le build Vercel échoue et le site ne se met pas à jour.
> `geo-civ-traces.js` est le seul qui ne casse pas le build s'il manque —
> il est chargé à l'exécution — mais la carte ne s'affichera pas. Un `package.json` absent casse aussi le build (mammoth, pdf-lib,
> tailwindcss). Sans `index.css`, l'application s'affiche sans mise en forme.

**Piège récurrent** : `public/` est le seul dossier servi par Vite. Une image
posée à la racine renvoie 404. Les deux logos sont désormais **encodés en base64
dans `App.jsx`** (`LOGO_FDFP` barre latérale, `CERTIFICATION_FDFP` pied de page),
donc plus aucun fichier image n'est requis. Seul `public/fond-page.jpg` reste
optionnel — **il n'existe pas**, d'où le fond uni `#e8edf2`.

**Vérifier un déploiement** : chercher `HorlogeUTC` dans `App.jsx` sur GitHub ;
à l'écran, l'horloge GMT+0 dans le bandeau prouve que le code est en ligne.

---

## 4. Ce qui a été fait sur l'application

- **Bandeau de la fiche d'évaluation centré.** Il était en deux colonnes —
  identification à gauche, score à droite. Les deux lignes ajoutées sous le
  score (couverture, marge au seuil) sont trop longues pour une demi-largeur :
  elles débordaient sous le bloc de gauche et rompaient l'alignement. Tout est
  désormais empilé et centré.
- **Accents rétablis dans le PDF, deuxième passe.** Les chaînes écrites en
  dur restaient sans accent : « Operateur », « Beneficiaire », « Fonds de
  Developpement », « Modele », « Edite le ». Vérifié que jsPDF **et** pdf-lib
  (qui pose le pied des annexes) acceptent les caractères accentués, et que
  les largeurs tiennent : la mention du pied fait 122,3 mm pour 178 mm utiles.
- **Pied de page lisible sur les pages d'annexe.** Les annexes viennent de
  documents que l'application n'a pas composés : leur contenu descend dans la
  marge basse. Le pied s'y mélangeait — la numérotation d'origine du document
  joint se superposait au bandeau de certification et le filet orange
  traversait le texte. Un fond opaque couvre désormais les 26 derniers
  millimètres avant la pose du pied. Ce qu'une annexe y aurait écrit est
  masqué, **y compris sa propre numérotation** : c'est voulu, la fiche
  renumérote en continu. Vérifié par rendu d'image sur une annexe fabriquée
  dont le texte descend jusqu'en bas.
- **Localisation des projets et cartes de couverture** — champ « Localité »,
  carte du portefeuille au tableau de bord, carte de la zone sur la fiche
  d'évaluation, **réseau routier** en fond. Le détail, les sources et les
  décisions de rattachement sont au **§7 bis**. Trois défauts trouvés au
  passage et corrigés :
  1. les **index de colonnes de l'export XLSX étaient écrits en dur** (6, 7,
     9). Insérer la colonne « Localité » décalait les formats de nombre d'un
     cran : un budget se serait affiché en pourcentage. Ils sont désormais
     déduits des en-têtes ;
  2. la **ligne d'identification de la fiche PDF était posée d'un bloc**, sans
     découpage. Avec la localité, un cas réel du portefeuille atteint 185,2 mm
     pour 178 mm utiles (mesure jsPDF) et sortait dans la marge ;
  3. le **formulaire de projet vierge était recopié en quatre endroits** —
     de quoi oublier un champ dans l'un d'eux. Extrait en `PROJET_VIERGE()`.
- Statut du projet affiché à côté du score MIP (liste + fiche d'évaluation)
- Champ « Région » → **« Zone (couverture FDFP) »**, liste fermée : Siège Abidjan
  + 7 antennes (Abengourou, Bouaké, Daloa, Korhogo, Man, San-Pédro, Yamoussoukro)
- **Bug de saisie des secteurs corrigé** : `ChampEditable` (validation au blur au
  lieu de réécrire à chaque frappe) + garde anti-écho sur le temps réel Supabase
- **Bug de notation corrigé** : les codes d'indicateurs générés pouvaient être en
  double, deux indicateurs partageant alors la même note
- Bandeau supérieur **fixe, translucide, flouté** (`backdrop-filter`) ; le
  `overflow-x: hidden` d'un ancêtre neutralisait le `position: sticky`
- Date **dégelée** (elle était figée au 13/07/2026) + horloge GMT+0 dans le bandeau ;
  calculs d'échéance en minuit UTC
- **Horloge rendue visible sur téléphone** : elle était masquée (`display:none`)
  sous 820 px. Remplacé par une compression par paliers — date en JJ/MM sous
  820 px, corps réduit et trait de séparation retiré sous 400 px, secondes
  masquées sous 340 px seulement. Mesuré sans débordement jusqu'à 320 px avec
  le titre de page le plus long
- **Libellés du radar réparés** : Recharts les posait sur une seule ligne sans
  réserver de marge ; à 375 px, quatre des cinq dimensions sortaient du cadre
  SVG (« Durabilité des compétences » commençait 101 px avant le bord). Tick
  `TickRadar` : découpage en lignes, ancrage selon la position autour du cercle,
  largeur de découpe **déduite de la place réellement disponible** (`cx` donne
  le bord) plutôt que d'un seuil mobile / bureau — sinon un grand écran coupe
  des libellés alors qu'il lui reste 300 px de libres. Rayon réduit à 54 % sur
  mobile pour dégager la couronne. Vérifié à 320, 375 et 1280 px : aucun libellé
  coupé, une seule ligne par libellé sur grand écran comme avant.
  L'algorithme de découpe est mutualisé (`decouperLibelle`) avec l'axe du
  graphique « Score moyen par secteur », qui en dupliquait le code
- **Revue systématique des débordements** (audit DOM sur toutes les pages
  accessibles, à 320 / 375 / 1280 px). Trois défauts trouvés et corrigés :
  1. **Infobulles Recharts** — `white-space:nowrap` en style en ligne : un
     libellé de secteur complet donnait une bulle de **402 px dans un écran de
     320 px**. Bornée à `min(260px, 70vw)` avec retour à la ligne
  2. **Colonne de libellés du graphique secteur** — largeur fixe (150 px sur
     mobile, 240 px ailleurs) quelle que soit la longueur réelle des noms. Le
     texte y étant aligné à droite, tout excédent restait en vide **à gauche**
     et faisait pencher le graphique vers la droite. Désormais : plafond au
     prorata de l'écran, puis repli sur la largeur que les libellés occupent
     vraiment. Nouvel état `largeurFenetre` à côté de `estMobile`.
     Cette largeur est **mesurée** (`largeurTexte`, via un contexte canvas) et
     non estimée au nombre de caractères — l'estimation se trompait de 25 %
     (128 px prévus pour 101 px réels), ce qui laissait le vide en place.
     Marges après correction : 5 px à gauche, 9 px à droite, à 320 comme à
     1 280 px ; la barre gagne 17 % de largeur sur mobile et 19 % sur bureau
  3. **Pastille de niveau chassée hors des cartes de projet** — le bloc de
     texte voisin n'avait pas `min-w-0` et refusait de se réduire. Ajout de
     `min-w-0`, `shrink-0` sur les pastilles et `break-words` sur les titres

> Les pages Référentiel, Alertes, Exports et Utilisateurs **n'ont pas été
> auditées** : le compte de test est en mode consultation et n'y a pas accès.
> À refaire avec un compte administrateur.
- **Propagation des renommages** : renommer un secteur / une matière première /
  un domaine / une phase met à jour tous les projets et indicateurs concernés
- « Branche d'activité » → **« Matière première »** partout dans l'interface
- Secteur tertiaire réorganisé par matière première + bouton *Restaurer la
  nomenclature par défaut*
- Cartes du tableau de bord **cliquables** (détail par projet ; Alertes renvoie
  à la feuille)
- Séparateur de milliers des montants, **y compris dans le PDF** (`nettoyerPdf`
  supprimait l'espace insécable)
- Export **XLSX** (ExcelJS, chargé à la demande) avec bandeau de certification,
  en-têtes figés, filtres, nombres natifs — **CSV conservé** à côté
- Mode sombre : survols de tableaux et graphiques corrigés — les règles
  `.hover\:bg-*` étaient **invalides** (`\:` non échappé dans un littéral de
  gabarit JS, la règle entière était rejetée)
- **Couverture du modèle publiée à côté du score** (le point qui comptait).
  `scoreGlobal` renormalise sur les seules dimensions notées : un projet évalué
  sur la seule Pertinence — 20 % du modèle — affichait **« 100 % · Excellent »**,
  indiscernable d'un projet suivi jusqu'à M+12. Le calcul est juste, la lecture
  ne l'était pas. La couverture s'affiche maintenant sur la fiche d'évaluation
  (« Couverture : 20 % du modèle · 4 indicateurs notés sur 23 »), en pastille
  *Partiel · N %* dans les listes, et en clair dans la **fiche PDF**, qui circule
  seule hors de l'application. Comportement du score **inchangé** : c'est sa
  lecture qui est corrigée, pas sa valeur
- **Marge au seuil** (`margeSeuil`, affichée sur la fiche d'évaluation). Un score
  de 59,4 étiqueté « Moyen » et un score de 60,1 étiqueté « Satisfaisant »
  décrivent des projets presque identiques : la frontière est conventionnelle.
  La distance au palier voisin est donc publiée, **convertie en crans** — un
  cran = une note qui progresse d'une unité sur l'échelle 0–4, l'unité dans
  laquelle l'évaluateur agit réellement. Vérifié sur le portefeuille réel :
  AGROCI (59,38) affiche « À 0,6 point du niveau Satisfaisant — 1 cran sur un
  indicateur suffit » ; SACO (83,13) affiche « Seulement 3,1 points au-dessus du
  seuil : niveau fragile » ; FrieslandCampina (90,83) n'affiche rien, le palier
  n'étant pas en jeu au-delà de 5 points.
  Le **maillon faible** (dimension la plus basse) accompagne systématiquement le
  message : sans lui, la marge inciterait à viser le seuil plutôt que le fond.
  Mention **reprise dans la fiche PDF**, sous la couverture — le lecteur du PDF
  n'a pas l'application sous les yeux. Largeur mesurée avec jsPDF : les cas réels
  occupent 141 à 167 mm pour 178 mm utiles, avec repli sur deux lignes si une
  dimension est renommée avec un libellé très long
- **Trajectoire entre jalons** (`instantane`, `ajouterInstantane`, `trajectoire`).
  L'application ne gardait qu'un seul jeu de notes par projet : chaque notation
  écrasait la précédente, un score de 83 % ne disait pas s'il datait de la
  conception ou de M+12, et le suivi M+3 / M+6 / M+12 annoncé par le modèle
  n'était pas observable. Un bouton **« Figer l'évaluation »** enregistre une
  photographie datée (score, couverture, détail par dimension) rattachée à un
  jalon ; la fiche affiche le tableau des jalons avec l'écart au précédent.
  Refiger un jalon **remplace** au lieu d'empiler ; le tri suit l'ordre des
  jalons, pas la date de saisie.
  **Stocké en colonne `historique` de `projets`, pas en table séparée** : la
  colonne hérite des politiques RLS existantes, donc aucune règle de sécurité
  à écrire. Migration : `supabase-phase3.sql`, **non destructive et
  idempotente**, contrairement au script de la phase 2.
  L'application reste fonctionnelle si la migration n'a pas été passée —
  `historique` n'est envoyé que s'il est non vide, et un message explicite
  remplace l'erreur PostgREST si la colonne manque
- **Accents rétablis dans le PDF.** `nettoyerPdf` translittérait *tous* les
  accents — « Efficacite pedagogique » — au motif que « la police standard des
  PDF gère mal l'UTF-8 ». **C'était faux** : test fait sur jsPDF 2.5, les polices
  standard rendent parfaitement les accents, les ligatures (œ, æ), la ponctuation
  française (« » — – · …) et les symboles Windows-1252 (€ © ° ± × ÷ §).
  Deux choses cassent réellement, et un seul caractère fautif dérègle
  l'espacement de **toute la ligne** :
  l'espace fine insécable U+202F, qui s'imprime en « / », et tout caractère hors
  Windows-1252 — au premier rang desquels **« ≥ » et « ≤ », présents dans les
  cibles des indicateurs** (« cible : ≥ 80 % »). La fonction ne translittère donc
  plus que ceux-là (`≥` → `>=`).
  **Aucun caractère inconnu ne subsiste** : ce qui n'est pas représentable perd
  d'abord ses signes diacritiques (`Ā` → `A`, `ř` → `r`) ; les lettres latines
  que la décomposition Unicode ne réduit pas ont leur équivalent explicite
  (`Ł` → `L`, `Đ` → `D`) ; le reste est supprimé plutôt qu'affiché en « ? » —
  pas de point d'interrogation dans un document officiel. Vérifié par rendu
  d'image sur les libellés réels du référentiel : zéro caractère non rendu
- **Logo aux angles arrondis dans le PDF.** `LOGO_FDFP` est un JPEG **à fond
  blanc** (420 × 189, coins blancs vérifiés) : posé sur le bandeau bleu nuit de
  l'en-tête, il y découpait un rectangle à angles droits. Le tracé est désormais
  restreint à un rectangle arrondi (rayon 2,6 mm) avant la pose de l'image —
  `saveGraphicsState` → `roundedRect(..., null)` → `clip` → `discardPath` →
  `addImage` → `restoreGraphicsState` — de sorte que le fond blanc suive la
  courbe. Repli sur un dessin simple si la version de jsPDF ne gère pas le
  détourage. Vérifié par rendu du PDF en image : angles arrondis nets, **et
  contenu suivant intact** — c'était le risque, un état graphique mal restauré
  aurait découpé tout le reste de la page au gabarit du logo
- **Pagination du PDF corrigée.** `pied()` s'exécutait avant que pdf-lib
  n'ajoute les annexes : une fiche de 9 pages annonçait « Page 1 / 2 », et les
  pages d'annexe n'avaient ni filet, ni mentions, ni numéro. Les annexes sont
  désormais ouvertes **avant** la pose du pied, pour que leur nombre de pages
  entre dans le total ; les pages fusionnées reçoivent ensuite leur pied via
  pdf-lib (origine en bas à gauche, positions comptées depuis le bas — une
  annexe peut ne pas être en A4). Vérifié de bout en bout sur un document
  fabriqué (2 pages de fiche + 2 gardes + 5 pages d'annexes) : les 9 pages
  portent « Page n / 9 ». Une garde `piedPose` interdit tout second passage
- **jsPDF chargé à la demande.** Il était importé statiquement et téléchargé par
  tout le monde, écran de connexion compris. Bundle initial : **439 → 322 Ko
  compressés, soit 27 % de moins**
- **Alerte « évaluation incomplète »** (`indicateursNonNotes`, page Alertes).
  L'application signalait les suivis en retard et les scores critiques, mais pas
  les **trous d'évaluation** : un jalon dont l'échéance est dépassée alors que
  des indicateurs restent à noter. Distinction utile — un projet peut avoir tous
  ses suivis à jour et rester inévaluable, ou l'inverse
- **Le modèle est sorti dans `calculs.js`** et couvert par **36 tests**
  (`npm test`) : bornes 80/60/40 des paliers, note zéro contre absence de note,
  renormalisation, couverture. L'application importe ce fichier — code testé et
  code exécuté sont le même
- **Enregistrements : les échecs se voient.** Les erreurs Supabase partaient en
  `console.warn` ; elles passent par `notif()`. Et les écritures ont été sorties
  des fonctions de mise à jour d'état (lecture via `useRef`) : un updater React
  doit être pur, StrictMode les jouait deux fois en développement
- **Plus aucune dépendance réseau à l'exécution.** Tailwind est compilé au build
  (`index.css`, `tailwind.config.js`, `postcss.config.js`) au lieu d'être
  téléchargé depuis `cdn.tailwindcss.com` ; `mammoth` et `pdf-lib` sont installés
  en dépendances, toujours chargés à la demande. Vérifié dans le navigateur :
  zéro script et zéro feuille de style externes
- **ExcelJS exécuté pour de bon** : `import("exceljs")` puis `writeBuffer()`
  produit un fichier de 6 629 octets commençant par `PK`, nombres conservés en
  numérique. Aucun polyfill `buffer`/`stream` nécessaire, `vite.config.js` reste
  inchangé
- Faute « emploi-qualif**c**ation » corrigée sur le tableau de bord
- **Bandeau de certification dans le PDF : plus de doublon, et déplacé en pied
  de page.** `blocCertification()` *et* `pied()` étaient appelés deux fois — une
  fois avant la fusion des annexes, une fois après — donc tout était dessiné en
  double, y compris la ligne « FDFP - Fonds de Developpement… ». Le bloc de
  120 mm inséré dans le corps a disparu : le bandeau fait désormais 45 mm,
  centré juste au-dessus du filet orange, sur chaque page. La zone de contenu
  descend de 278 à 270 mm (`BAS_CONTENU`) pour ne pas empiéter dessus
- **Bandeau de certification aussi à l'accueil** : ajouté dans `CadreAccueil`,
  donc visible dès l'écran de chargement et sur l'écran de connexion, comme au
  pied de l'application une fois connecté
- **Logo FDFP déformé au chargement et à la connexion — corrigé.** Mesuré :
  natif 420 × 189 (ratio 2,22), affiché 28 × 34 (ratio 0,83), soit un
  écrasement horizontal d'un facteur 2,7. Deux causes cumulées — le cadre cédait
  sa largeur au long sous-titre voisin dans le conteneur flex, et le
  `img { max-width:100% }` de Preflight comprimait alors l'image alors que sa
  hauteur restait imposée. Correction dans `LogoFDFP` : `shrink-0` sur le cadre
  et `maxWidth:"none"` sur l'image. Ratio vérifié à 320, 359 et 1 280 px : 2,222
  partout, identique au natif.
  Au passage, la barre latérale enveloppait `LogoFDFP` dans un second
  `cadre-logo` : deux plaques blanches superposées, ramenées à une
- **Ponctuation homogène** : 43 phrases de l'interface reçoivent un point final
  — sous-titres de pages, infobulles de navigation, infobulles de boutons,
  sous-titres des vues de détail. Volontairement **non** ponctués : titres,
  libellés de boutons, en-têtes de colonnes, étiquettes de champs et options de
  listes, où le point serait fautif
- **Client Supabase mis en cache sur `globalThis`.** Le rechargement à chaud du
  serveur de développement ré-exécutait le module à chaque modification et
  créait un client de plus à chaque fois ; les clients se disputaient le
  rafraîchissement du jeton, ce qui pouvait déconnecter en pleine session.
  C'est ce que signalait « Multiple GoTrueClient instances detected ». **Sans
  effet en production**, où le module n'est évalué qu'une fois — mais confort
  de développement rétabli
- **En-tête de l'accueil cadré sur la carte** (`w-full max-w-md` dans
  `CadreAccueil`). Sur grand écran, le sous-titre s'étirait sur une seule ligne :
  l'en-tête traversait tout l'écran alors que la carte de connexion restait
  étroite au centre, les deux ne semblant plus former un même bloc. Les trois
  éléments — en-tête, carte, bandeau de certification — mesurent désormais la
  même largeur (448 px sur 1 280 px, 343 px sur 375 px) et sont centrés à
  l'identique. Vaut aussi pour l'écran de chargement, qui partage `CadreAccueil`

---

## 4 ter. ⚠ Perte du portefeuille — cause et correctifs (8 août 2026)

Des projets saisis ont disparu. **Le déploiement n'y est pour rien** : le code
part sur Vercel, les données vivent dans Supabase, et publier du JavaScript
n'écrit jamais dans la base. Trois chemins seulement peuvent effacer des
projets. Les voici, du plus probable au moins probable.

### 1. Le bouton « Données démo » — cause la plus probable

Il appelait `setFormations(FORMATIONS_DEMO)`. Or ce *setter* **supprime en
base tout projet absent du tableau qu'on lui passe** : lui donner les trois
projets de démonstration revenait à effacer tout le reste du portefeuille,
avec ses suivis et ses notes.

Ce qui rendait l'accident facile :

- l'intitulé, « Données démo », et l'infobulle, « Restaurer les 3 projets de
  démonstration », n'annonçaient **aucune destruction** ;
- **aucune confirmation** n'était demandée ;
- le bouton était offert à **tous les rôles**, y compris à ceux qui n'ont pas
  le droit de supprimer un seul projet ;
- il était placé juste à côté des boutons d'export, en haut de la page Projets.

**Corrigé** : réservé aux rôles qui peuvent supprimer, intitulé « Remplacer par
la démo », confirmation qui **chiffre les projets détruits**, copie de secours
prise avant l'opération.

### 2. La lecture en échec confondue avec une base vide

`chargerDonnees` ignorait l'erreur renvoyée par Supabase. Sur une lecture qui
échoue — coupure réseau, jeton expiré, politique RLS qui refuse — PostgREST
renvoie `data: null` ; la liste devenait vide, et **une base illisible se
lisait exactement comme une base vide**. L'amorçage s'enclenchait alors et
réinjectait les projets de démonstration par-dessus un portefeuille bien
vivant.

**Corrigé** : l'erreur est récupérée et testée. En cas d'échec, l'application
**n'écrit rien**, n'amorce rien, et le dit à l'écran. Une base qu'on n'a pas su
lire n'est pas une base vide.

### 3. `supabase-phase2_4.sql` rejoué dans Supabase

Ce script commence par deux `drop table … cascade` : il **détruit** `projets`
et `suivis` avant de les recréer. Si vous l'avez recollé dans l'éditeur SQL en
croyant « appliquer la mise à jour », tout a été perdu à cet instant.

**Il ne faut jamais le rejouer sur une base en service.** Un avertissement
encadré est désormais en tête du fichier. Les migrations `phase3` et `phase4`,
elles, n'ajoutent que des colonnes et peuvent être rejouées sans risque.

### Comment savoir laquelle s'est produite

Je n'ai pas accès à votre base : je ne peux pas trancher à votre place. Cette
requête le dira — à coller dans **Supabase → SQL Editor** :

```sql
-- Que reste-t-il, et depuis quand ?
select count(*) as projets,
       min(cree_le) as plus_ancien,
       max(maj_le)  as derniere_ecriture
  from public.projets;

-- Les trois projets de démonstration sont-ils là ?
-- S'ils y sont ET que vos projets ont disparu : chemin 1 ou 2.
select id, titre, maj_le from public.projets where id in ('f1','f2','f3');

-- Si la table est vide ET que « plus_ancien » est récent : chemin 3.
```

Supabase garde des sauvegardes automatiques (**Database → Backups**) : selon
votre formule, une restauration à un instant antérieur est peut-être encore
possible. **C'est la première chose à tenter, avant de resaisir quoi que ce
soit.**

### Trois réponses de fond (9 août)

- **Corbeille.** Supprimer un projet ne l'efface plus : la ligne est
  **marquée** (`supprime_le`), masquée dans l'application, et **restaurable**
  depuis un bouton « Corbeille » sur la page Projets. Migration
  **`supabase-phase5.sql`**, non destructive. L'application fonctionne sans :
  elle revient alors à la suppression définitive **et le dit à l'écran**.
  La corbeille **ne se vide pas toute seule** — une purge automatique
  réintroduirait le problème qu'on vient de corriger, avec un délai en plus.
  La marche à suivre pour purger à la main est en commentaire dans le script.
- **Sauvegarde et restauration** (page Exports). Le classeur Excel porte des
  scores **déjà calculés**, pas les notes qui les produisent, ni les
  identifiants, ni les suivis : on ne peut pas le réinjecter. La sauvegarde
  est son exact opposé — illisible pour un humain, mais **complète et fidèle**
  (projets, notes de chaque indicateur, suivis, jalons figés, référentiel).
  La restauration **ne supprime jamais** : elle ajoute ce qui manque, remplace
  ce qui porte le même identifiant, et annonce le décompte avant d'écrire.
- **`normaliserRegion` réparé.** Un test l'a pris en défaut : « SAN PEDRO »,
  la forme du document de la DACD, **n'était pas reconnue** — `localeCompare`
  ignore les accents mais pas le trait d'union. Un projet saisi ou repris sous
  cette forme restait hors nomenclature : invisible aux filtres, absent de la
  carte. La comparaison de noms propres est désormais indifférente aux accents
  **et** aux séparateurs (`memeNom`), et sert aussi aux localités
  (« M'BENGUE » → « M'Bengué », « KOUN FAO » → « Koun-Fao »).

### Reprendre un ancien classeur — ce qu'on peut et ne peut pas rendre

Si le seul vestige est un export Excel ou CSV, la page Exports sait le relire
(« Reprendre un ancien classeur »). **Vérifié sur les exports réels du 7 août** :
CSV et XLSX lus à l'identique, 4 projets, 5 dimensions sur 5, zones et
localités reconnues, statuts convertis au masculin.

| Repris | Perdu, car absent du classeur |
|---|---|
| intitulé, promoteur | **les notes des 23 indicateurs** |
| secteur, matière première, domaine | l'opérateur, le bénéficiaire |
| zone, localité | les suivis et leurs pièces jointes |
| apprenants, budget, statut | l'identifiant d'origine |

**Les notes ne sont pas reconstituables et ne sont pas inventées.** Un score de
dimension est une moyenne de notes 0–4 : une infinité de jeux de notes donnent
la même moyenne. Fabriquer des notes plausibles produirait une évaluation
fausse mais d'apparence complète — pire que pas d'évaluation.

Les scores lus sont en revanche conservés en **instantané marqué « repris »**
dans la trajectoire, avec une couverture affichée « — » : l'évaluateur voit où
le projet en était, sans que cela passe pour une évaluation faite dans
l'application. Un projet dont les cellules de score étaient vides ne reçoit
aucun instantané : non évalué il était, non évalué il reste.

Le rapprochement se fait sur **intitulé + promoteur**, l'export ne portant pas
d'identifiant. Un projet déjà présent est **laissé intact** : la reprise comble
un trou, elle n'écrase pas ce qui a survécu.

### Trois garde-fous ajoutés

1. **Refus des suppressions en masse.** `setFormations` refuse désormais toute
   opération qui supprimerait **plus d'un projet** à la fois, sauf
   autorisation explicite de l'appelant. Aucun geste normal de l'application
   n'en supprime deux d'un coup. Même règle sur les suivis, seuil à six —
   un projet en porte au plus quatre, et supprimer un projet emporte
   légitimement les siens.
2. **Copie de secours automatique**, dans le navigateur : à chaque chargement
   réussi, et **avant** toute suppression multiple. Un bouton « Restaurer la
   copie de secours » apparaît sur la page Projets dès qu'une copie existe.
   Elle réécrit les projets sauvegardés **sans supprimer** ceux présents.
   ⚠ Ce n'est **pas** une sauvegarde : elle est locale à un poste et à un
   navigateur, et disparaît si l'on vide les données du site.
3. **Les échecs d'écriture se voient** déjà (`notif`) ; les échecs de
   **lecture** aussi désormais.

### Mettre à jour sans rien perdre — la procédure

1. **Exporter le portefeuille en Excel** depuis la page Projets. C'est la
   seule sauvegarde qui ne dépende ni du navigateur ni de Supabase.
2. **Déployer le code** (GitHub → Vercel). Cette étape ne touche **jamais**
   aux données.
3. **N'exécuter que les migrations `phaseN` numérotées, dans l'ordre**, une
   seule fois chacune. Elles ajoutent des colonnes, ne détruisent rien et sont
   rejouables. **Ne jamais rejouer `supabase-phase2_4.sql`.**
4. Recharger l'application et **vérifier que le nombre de projets est le bon**
   avant de reprendre la saisie.

> **Ce qui manque encore** : il n'existe **aucun import**. L'export Excel sert
> d'archive, mais rien ne permet de le réinjecter. C'est la première chose à
> ajouter si la base doit porter des données réelles (voir §5).

---

### ⚠ Déconnexion forcée et listes qui sautent : une seule cause (9 août)

Les deux symptômes venaient du même endroit : **`onAuthStateChange` rechargeait
le profil à chaque événement**, y compris `TOKEN_REFRESHED`, qui survient tout
seul, périodiquement et au retour sur l'onglet.

- **Les listes qui bougent.** Chaque rechargement recréait l'objet `session`.
  L'effet de données en dépendait (`[session, roleActif]`) : il se rejouait,
  relançait `chargerDonnees()` et **détruisait puis reconstruisait l'abonnement
  temps réel**, plusieurs fois par heure. Les dépendances sont maintenant des
  valeurs simples (`session?.id`), et l'objet n'est remplacé que si son contenu
  a changé.
- **La déconnexion forcée.** Le rôle était lu ainsi :
  `role: r?.role || "En attente d'activation"`. Si la requête n'aboutissait pas
  — réseau lent, coupure, jeton en cours de renouvellement — le rôle retombait
  sur « En attente d'activation » et l'utilisateur se retrouvait sur l'écran
  d'attente sans avoir rien fait. **Un échec de lecture ne dégrade plus le
  rôle** : seule une réponse reçue fait autorité.

Mesuré sur une session type (connexion, 3 renouvellements de jeton, une mise à
jour, déconnexion) : **6 rechargements complets avant, 2 après** — ceux qui
correspondent à un vrai changement d'utilisateur.

**Deux autres défauts trouvés dans le rechargement temps réel :**

1. les suivis étaient lus **sans `order`**. PostgreSQL ne promet alors aucun
   ordre, et il varie d'une lecture à l'autre : les lignes se réarrangeaient
   sous le curseur sans que rien n'ait changé. Les deux lectures sont
   désormais triées sur des clés qui lèvent toute ambiguïté ;
2. le rechargement **ignorait la corbeille** : un projet mis à la corbeille
   réapparaissait au premier événement temps réel.

### Cloisonnement appliqué côté base (`supabase-phase6.sql`)

Jusqu'ici, ce qu'un promoteur ne devait pas faire était empêché par
**l'interface**. Ce n'est pas une sécurité : la clé « anon » est publique par
construction, et la console du navigateur suffit à écrire directement dans
PostgREST. La phase 6 pose les politiques RLS pour que la règle soit la même
des deux côtés : **lecture** limitée au périmètre de l'organisation,
**écriture réservée au FDFP** — un promoteur ne modifie rien, même ses propres
projets. Le script contient la procédure de vérification depuis la console.

### Droits d'export scindés en trois (9 août)

Un seul drapeau, `exports`, recouvrait trois actes de nature très différente,
et c'est ce qui avait ouvert la porte : **le bouton « Télécharger la
sauvegarde » n'était gardé par rien** et s'offrait à tout rôle atteignant la
page Exports, Promoteur compris.

| Droit | Ce qu'il ouvre | Qui l'a |
|---|---|---|
| `fichePdf` | la fiche d'évaluation d'**un** projet | jusqu'au Promoteur : c'est son dossier |
| `exportXlsx` | le classeur Excel mis en forme, avec bandeau de certification | FDFP seulement : document institutionnel |
| `exportCsv` | les mêmes données, brutes | jusqu'au Promoteur et à l'Opérateur : chacun relit ses chiffres |
| `sauvegarde` | sauvegarder, restaurer, reprendre un classeur, copie de secours | administrateurs seulement |

« Remplacer par la démo » reste sous `supprimerFormation`, donc réservé à
l'administrateur lead : c'est bien une suppression de masse.

### Tirets cadratins retirés du texte affiché

Toutes les incises en « — » ont été reformulées : virgule, deux-points, point,
ou parenthèses selon le cas. Les tirets qui tenaient lieu de valeur absente
sont remplacés par ce qu'ils voulaient dire (« Non noté », « Non renseignée »,
« Non connue », « Premier jalon ») : un tiret ne dit pas ce qu'il remplace.
Contrôlé à l'écran (aucun « — » dans le texte ni dans les attributs) et
statiquement sur les sources, commentaires exclus. Restent les tirets des
intervalles numériques (« 0–40 % »), qui sont des demi-cadratins et
typographiquement corrects, et la table Windows-1252 de `pdf.js`, où le
caractère est une **donnée**, pas du texte.

### Autres corrections du 9 août

- **Statut du projet au masculin** : « Planifié », « Terminé ». Le féminin
  était un reste de l'époque où l'application parlait de « formations » ; le
  statut qualifie le **projet**. Les valeurs déjà en base sont converties **à
  la lecture** (`normaliserStatut`) — rien à migrer, et une valeur inconnue
  est conservée plutôt que perdue.
- **Vocabulaire homogène** : « Sélectionnez un projet à évaluer », « Projets
  sous-performants », « Créer le projet », « apprenants » et non « apprentis ».
  Titre de l'onglet corrigé : « projets de formation », au singulier.
- **Pied de page des annexes — refait.** Le fond opaque masquait ce que
  l'annexe avait écrit dans sa marge basse : mauvaise réponse. Les pages
  jointes sont désormais **embarquées puis redessinées, réduites**, dans une
  page A4 neuve dont les 27 derniers millimètres sont réservés au pied. C'est
  ce que fait « ajuster à la page » d'une imprimante. **Rien n'est masqué,
  rien ne se chevauche** ; le facteur est plafonné à 1, une page plus petite
  qu'une A4 n'est jamais agrandie. Vérifié par rendu d'image sur une annexe
  dont le texte descend jusqu'en bas : réduction à 84,8 %, contenu intégral
  lisible, pied net en dessous.

---

## 4 bis. Les six chantiers du 8 août — **faits**

1. **Tracés de carte chargés à la demande.** `geo-civ.js` a été coupé en deux :
   la **nomenclature** (13 Ko — noms, zones, positions) reste chargée avec
   l'application, car elle sert partout ; les **tracés** (95 Ko de contours et
   de routes) partent dans `geo-civ-traces.js`, importé par `import()` sur les
   deux seuls écrans qui dessinent. Même traitement que jsPDF et ExcelJS.
   Paquet initial : **362 → 331 Ko compressés**. Un cadre d'attente de même
   hauteur évite que la page ne saute à l'arrivée des tracés, et le module
   reste en cache : passer d'un projet à l'autre ne recharge rien.
2. **Filtres par zone et par localité** sur la liste des projets, avec compte
   des résultats (`aria-live`) et bouton de remise à zéro. Changer de zone
   remet la localité à zéro — elle n'appartient plus forcément à la nouvelle.
   La fenêtre d'une localité, sur la carte, propose « filtrer le portefeuille
   sur cette localité ».
   **Les exports restent sur le portefeuille entier**, comme ils le faisaient
   déjà pour la recherche : un export est un livrable, il ne doit pas dépendre
   de l'état d'un filtre d'écran.
   Au passage, le filtre de la liste était **écrit deux fois** — vue tableau et
   vue cartes du mobile — et les deux copies devaient être modifiées ensemble.
3. **Seconde lecture de la carte : le niveau moyen.** Bascule
   « Implantation / Niveau moyen ». Compter les projets ne dit pas comment ils
   se portent — une antenne peut en porter dix et tous les rater. Une zone
   **sans projet noté reste grise** : lui donner la couleur du palier le plus
   bas la ferait passer pour mauvaise alors qu'elle est seulement non évaluée.
4. **Accessibilité.** 12 `aria-label` posés sur les boutons en icône seule (le
   libellé était déjà dans leur `title`), icônes passées en `aria-hidden`
   — décoratives, le sens est porté par le bouton —, et **équivalents
   textuels** pour le radar, le graphique sectoriel et la carte : Recharts
   produit un SVG que rien n'annonce, la page n'exposait aucun de ces chiffres
   à qui ne les voit pas.
5. **Graduations du radar masquées.** Recharts les empilait le long d'un rayon,
   par-dessus le polygone. L'échelle reste donnée par la grille et la valeur
   par l'infobulle.
6. **`App.jsx` dégraissé.** Deux fichiers de plus, toujours **à plat** :
   - **`referentiel.js`** — le vocabulaire métier : les 5 dimensions et leurs
     23 indicateurs, la nomenclature sectorielle, les huit implantations et
     leurs localités, les rôles et la matrice de permissions. Un référentiel se
     défend en soutenance : il ne devait pas être enfoui dans trois mille
     lignes d'interface.
   - **`pdf.js`** — `nettoyerPdf` et ses tables, **le morceau le plus subtil**
     de la génération de fiches et le seul qui soit une fonction pure.
     Désormais couvert par **`pdf.test.js` : 14 tests** qui fixent le
     comportement juste — les accents passent, `≥` devient `>=`, aucun
     caractère inconnu ne sort, et jamais de « ? » de substitution dans un
     document officiel. **50 tests au total** (36 + 14).

> `fichePDF` elle-même **n'a pas été sortie**. Elle ne capture que cinq
> éléments d'état, mais elle s'appuie sur les formats de nombre, les couleurs
> et les deux logos encodés dans `App.jsx` : l'extraction est faisable, elle
> n'a pas été faite faute de pouvoir vérifier un export réel de bout en bout
> sans session connectée.

---

## 5. Ce qui reste à faire sur l'application

Par ordre d'importance :

0. ~~**Aucun import n'existe.**~~ — **fait** : sauvegarde et restauration
   complètes en page Exports, corbeille sur les projets (§4 ter). Reste à
   **vérifier le cycle complet dans l'application connectée** : sauvegarder,
   supprimer, restaurer. Tout a été contrôlé par le code, rien à l'écran.

> ### ⚠ Escalade de périmètre via `profiles.org` — corrigée par `supabase-phase3.sql`
>
> Les politiques RLS ont été lues le 7 août 2026. Celles de `user_roles` sont
> **correctes** : `UPDATE` exige `est_admin_lead()` en `USING` comme en
> `WITH CHECK`, et aucune politique `INSERT` n'existe. **Aucun utilisateur ne
> peut s'attribuer un rôle** — l'affirmation du guide d'utilisation est exacte.
>
> En revanche, `profiles` porte `UPDATE ... USING (id = auth.uid())
> WITH CHECK (id = auth.uid())`, sans restriction de colonne — PostgreSQL ne
> sait pas limiter une politique RLS à certaines colonnes. Or `org` commande la
> visibilité des projets : `mon_org()` → `peut_voir_projet()` → `projets_select`.
> Un compte Promoteur ou Opérateur pouvait donc écrire, depuis la console :
> `sb.from('profiles').update({ org: 'AUTRE ENTREPRISE' }).eq('id', …)`
> et lire les projets d'un tiers. Ce n'est pas une escalade de rôle mais de
> **périmètre de données**.
> Correctif : déclencheur `profils_geler_org` (partie B du script), qui fige
> `org` dès qu'il est renseigné, tout en laissant l'inscription se faire et
> l'administrateur lead corriger.

> **Test d'escalade de privilège (7 août 2026).** Un INSERT **anonyme** dans
> `user_roles` avec le rôle « Administrateur lead » est **rejeté** :
> `HTTP 401 — code 42501 — new row violates row-level security policy for table
> "user_roles"`. Même rejet sur `profiles`. Aucune ligne créée. RLS protège donc
> bien contre un visiteur non authentifié.
> **Ce qui reste non testé** : un utilisateur **authentifié** peut-il modifier sa
> propre ligne de `user_roles` ? Cela exigerait une session, donc des
> identifiants. La réponse est dans les politiques du script phase 1 — voir la
> requête de diagnostic au point 1 ci-dessous.

1. **Le script SQL de la phase 1 n'est toujours pas versionné** (`profiles`,
   `user_roles` et leurs politiques RLS). Il **a bien été exécuté** — les cinq
   tables répondent — mais son contenu reste hors du dépôt, donc le livrable est
   incomplet et non reproductible. Sondage anonyme effectué sur l'API REST :
   **RLS filtre correctement en lecture** (`projets` renvoie zéro ligne sans
   session, alors que les projets existent). L'écriture n'a **pas** pu être
   tranchée : PostgREST renvoie 204 pour « 0 ligne modifiée », que la politique
   ait bloqué ou non. Seule la relecture du script phase 1 dira si un utilisateur
   peut modifier sa propre ligne de `user_roles` — c'est ce que fait
   `attribuerRole()` côté client. **À exporter depuis Supabase et à joindre.**

   **Requête de diagnostic** — à coller dans Supabase → SQL Editor. Lecture
   seule, elle affiche les politiques réellement en place :

   ```sql
   select tablename, policyname, cmd, roles, qual, with_check
     from pg_policies
    where schemaname = 'public'
      and tablename in ('user_roles', 'profiles')
    order by tablename, cmd, policyname;
   ```

   **Ce qu'il faut y lire.** Pour `user_roles`, toute politique `UPDATE`, `ALL`
   ou `INSERT` ouverte `to authenticated` dont le `with_check` se réduirait à
   `user_id = auth.uid()` signifierait que **chacun peut réécrire son propre
   rôle** — l'escalade que `attribuerRole()` rendrait triviale depuis la console
   du navigateur. Le `with_check` doit au contraire être restreint aux
   administrateurs, par exemple :
   `public.mon_role() in ('Administrateur lead','Administrateur FDFP')`.
   S'il n'existe **aucune** politique d'écriture sur `user_roles`, c'est le cas
   le plus sûr : seule la clé de service peut écrire, et `attribuerRole()` échoue
   côté client — ce qui se corrige par une fonction `security definer` plutôt
   qu'en ouvrant la table.
2. ~~**`supabase-phase2_4.sql` détruit les données**~~ — **fait** : un
   avertissement encadré en tête de fichier explique quelles lignes détruisent
   quoi, quoi sauvegarder avant, et comment le rejouer sans perte (commenter
   les deux `drop table`). Le script lui-même est **inchangé** : c'est un
   script d'installation initiale, il doit le rester.
3. **Équipondération des indicateurs assumée ?** `scoreDimension` fait une
   moyenne simple : seules les dimensions portent un poids. C'est un choix
   défendable mais **implicite** dans la structure du référentiel. À énoncer
   explicitement dans le mémoire, ou à rendre paramétrable.
4. Accessibilité : **une première passe est faite** (§4 bis, point 4). Restent
   les parcours au clavier dans les fenêtres modales — le focus n'y est pas
   piégé et `Échap` ne les ferme pas — et le contraste des textes secondaires,
   non mesuré.
5. ~~Graduations de l'axe radial du radar~~ — **fait** (§4 bis, point 5).
6. `App.jsx` fait 3 857 lignes. `calculs.js`, `geo-civ.js`, `referentiel.js`
   et `pdf.js` sont **sortis** (§4 bis, point 6). La suite naturelle serait
   `fichePDF` — environ 360 lignes — mais elle demande de déplacer aussi les
   formats de nombre, les couleurs et les logos encodés en base64.

---

## 6. Le mémoire

`MEMOIRE_EHOUNI_MIP-PPA_STRUCTURE_ESA_V1.docx` — 68 pages, 921 paragraphes,
15 546 mots. Sauvegarde de l'original : `*.SAUVEGARDE.docx`.

**Corrections appliquées** (validées, mise en forme intacte — 35 des 36 pièces du
.docx identiques à l'octet près) :

- six → **sept antennes**, Yamoussoukro ajouté (2 endroits)
- nomenclature « filière » → **« matière première »** ; « région » → **« zone »**
  (§2.3.3, §2.3.4, §2.3.8, III.3.1, III.3.2)
- **renumérotation** du 2.3 de la Partie II : « Nomenclature sectorielle » était
  numérotée 2.3.6 tout en étant placée entre 2.3.2 et 2.3.3 → devient 2.3.3, les
  suivantes décalées ; le renvoi « paragraphe 2.3.5 de la Partie II » ajusté

> ⚠ **À vérifier** : le mémoire disait « six antennes » à deux endroits, et
> Yamoussoukro n'y apparaissait que comme siège de l'INP-HB. Le nombre d'antennes
> du FDFP est un fait institutionnel — confirmer avant la soutenance.

**Imprécisions signalées, non corrigées** : le §III.3.2 n'énumère pas le
statut parmi les colonnes de la liste des projets.

> Le §2.3.8 annonçait des graphiques « par zone » que l'application ne
> produisait pas. **Ce n'est plus une imprécision** : la carte du tableau de
> bord et celle de la fiche d'évaluation les fournissent (§7 bis). Le
> paragraphe mérite d'être relu et enrichi plutôt que corrigé — il décrit
> désormais moins que ce que l'application fait.

---

## 7. Bibliographie et webographie — état au 7 août 2026

> Le détail actionnable est dans **`BIBLIOGRAPHIE-ET-WEBOGRAPHIE.md`**
> (13 auteurs à saisir, 6 types à corriger, 5 paginations, doublons, ordre
> d'exécution) et **`BIBLIO-OEUVRES-FONDATRICES.md`** (Kirkpatrick, Phillips,
> Doran, Kaplan & Norton 1992, Schultz, Becker, Le Boterf, ISO 22400-2, Saaty,
> plus les critiques Alliger & Janak / Holton).

**Le guide de l'ESA impose ISO 690 / AFNOR Z 44-005**, pas APA. Il exige aussi
une section **Webographie distincte** (plan type, p. 25) et la **date de
consultation** entre crochets (note 4). Citations dans le texte : `(auteur, année)`
(§4.1). Pagination obligatoire pour les documents papier (note 5).

**Acquis :**

- style `ISO-690 (author-date, no abstract, Français)` **installé et actif**
  (téléchargé dans `%USERPROFILE%\Zotero\styles\`) ;
- le fichier de style a été **retouché** pour produire « (auteur, **,** année) »
  conformément au §4.1 — l'original est sauvegardé à côté en `.csl.original`.
  ⚠ Une mise à jour des styles par Zotero écraserait cette retouche ;
- **toutes les ressources en ligne citées ont leur date de consultation** ;
- les 5 paginations manquantes sont **toutes retrouvées** (comptage des PDF
  déjà joints dans Zotero + vérification en ligne pour Kaplan & Norton :
  *California Management Review*, 1996, vol. 39, n° 1, p. 53-79).

**Restant :** 13 des 20 références citées **n'ont pas d'auteur** ; 3 encore
typées « Billet de blog », 3 mal typées ; « Présentation du FDFP » en
**3 exemplaires** ; section Webographie **vide** dans le mémoire.

> ⚠ **Le mémoire sur le disque est encore en APA.** Le style a été changé dans
> Zotero mais le document n'a pas été rafraîchi **ni enregistré**. Première
> chose à faire : ouvrir le .docx, onglet Zotero → *Refresh*, puis **Enregistrer**.

---

## 7 bis. Carte des zones de couverture — **faite** (8 août 2026)

Le chantier était bloqué faute de géométries. Le dossier **`Carte radar/`** les
contenait : `civ_admin_boundaries.shp/` porte les limites administratives
officielles (OCHA / HDX, COD-AB Côte d'Ivoire), **déjà en EPSG:4326 (WGS 84)** —
aucune reprojection nécessaire, contrairement à ce qui était craint. Le
`.qgz` reste sans données, mais il n'a plus d'utilité.

**Ce qui a été livré :**

- **`geo-civ.js`** (107 Ko, **NOUVEAU**) — les **108 départements**, contours
  déjà projetés en coordonnées SVG, chacun avec son chef-lieu, sa région et
  **son implantation FDFP de rattachement**, plus le **réseau routier
  interurbain** (28 Ko : autoroutes et voies express d'un côté, routes
  nationales de l'autre). Rendu en SVG écrit à la main : aucune bibliothèque
  de cartographie, aucune tuile réseau.
- **Réseau routier** en fond des deux cartes. Il répond à ce que les contours
  ne disent pas : deux localités voisines à vol d'oiseau peuvent n'être
  reliées par aucune route directe, et c'est le temps de trajet qui fait la
  charge réelle d'une antenne — **le premier des critères de zonage énoncés
  par la note de la DACD**. Source OpenStreetMap via Geofabrik, sous licence
  **ODbL : l'attribution est affichée sous chaque carte**, c'est une condition
  d'usage, pas une politesse. Filtré sur les classes `motorway`, `trunk` et
  `primary` — 1 157 tronçons retenus sur 238 591 —, concentré dans **deux
  tracés** et non un par tronçon : le dessin ne change jamais, il n'a pas à
  peupler le DOM de mille nœuds.
- **Couleurs des zones refaites.** Les huit teintes se confondaient deux à
  deux, comme signalé. Mesure CIEDE2000 sur les aplats à 18 % d'opacité — la
  façon dont la carte les montre réellement —, pour les quinze couples de
  zones **qui se touchent** : la première palette descendait à ΔE 3,3 (Siège /
  Abengourou) et 4,3 (Bouaké / Yamoussoukro), sous le seuil de distinction.
  La nouvelle ne descend pas sous 8,7. Seules les zones voisines comptent :
  deux zones éloignées ne se comparent jamais du regard.
- **Champ « Localité »** sur le projet, en regard de « Zone ». La liste
  proposée est **toujours celle de la zone choisie** — on ne peut pas se
  tromper d'antenne. Changer de zone ramène la localité au chef-lieu.
- **Tableau de bord** — carte « Implantation des projets » : une pastille par
  localité, **d'aire** proportionnelle au nombre de projets, coloriée par
  implantation ; légende des 8 zones avec leur part ; clic → liste des projets.
- **Fiche d'évaluation** — carte « Situation du projet » : la zone
  d'occupation de l'implantation, recadrée, la **localité cible en exergue**
  parmi toutes celles que l'antenne couvre.
- Localité reprise dans les **exports CSV / XLSX** et dans la **fiche PDF**.
- **`supabase-phase4.sql`** (**NOUVEAU**) — colonne `localite`, non
  destructif et idempotent. L'application fonctionne **sans** cette migration :
  la colonne n'est écrite que si le projet en porte une, et un message
  explicite remplace l'erreur PostgREST.

### Zone d'occupation et ville cible — deux notions distinctes

C'est la distinction du FDFP lui-même, et elle commande tout le reste :

- la **zone d'occupation** couvre **tout le territoire**. Chaque département
  relève d'une antenne ou du Siège — c'est ce que montrent les couches
  « Reste … » du projet QGIS de l'auteur. C'est elle que la carte colorie ;
- les **villes cibles** sont celles que le document de la DACD nomme, là où le
  FDFP intervient effectivement, pour des raisons qui lui appartiennent. Ce
  sont elles, et elles seules, qui sont proposées à la saisie et portent un
  point sur la carte.

Un département sans ville cible **appartient donc bien à une antenne** : il est
colorié comme elle, simplement aucun projet ne s'y localise. Le champ `t` de
`geo-civ.js` marque les villes cibles ; `z` porte l'appartenance.

> **Correction d'une erreur d'interprétation.** Ces départements avaient
> d'abord été rattachés « par continuité régionale » — bonne conclusion, mauvais
> raisonnement. Puis, à tort, sortis du zonage et affichés en gris : cela
> revenait à nier une couverture qui existe. Le zonage est complet ; seule la
> liste des villes proposées est restreinte.

**Chiffres** : 109 entités zonées (108 départements, Grand-Bassam étant découpé
en deux), dont **77 villes cibles** — 76 nommées par le document plus Bonoua.
Par implantation, départements dont villes cibles : Abengourou 20/9,
Korhogo 17/11, Man 16/10, Siège 14/12, San-Pédro 12/9, Yamoussoukro 12/12,
Daloa 10/6, Bouaké 8/8.

**Bonoua était citée et manquait.** C'est une sous-préfecture de Grand-Bassam :
elle n'existe pas au niveau départemental des données OCHA. Plutôt que
d'introduire un niveau « sous-préfecture » — refusé, à raison —, **le
département a été découpé** : Grand-Bassam est réduit à ce qui reste une fois
Bonoua retirée, et Bonoua devient une localité de plein droit. La carte reste
une **partition**. Le découpage se fait avant la simplification, donc leur
frontière commune passe par la topologie partagée comme n'importe quelle autre.

**Le découpage se fait au département, pas à la région** — c'est le point qui
commandait tout le reste. Quatre régions sont **partagées entre deux
antennes** : Iffou (Daoukro → Abengourou, M'Bahiakro → Bouaké), Marahoué
(Bouaflé et Sinfra → Yamoussoukro, Zuénoula → Daloa), Gôh (Oumé →
Yamoussoukro, Gagnoa → San-Pédro), La Mé (Adzopé → Abengourou, Alépé →
Siège). Un rattachement par région aurait été faux dans les quatre cas.

Le Word ne cite que 75 des 108 départements. Les **33 autres** sont rattachés
par continuité régionale — à l'antenne qui couvre le reste de leur région,
exactement ce que faisaient les couches « Reste … » du projet QGIS. Le détail
est dans l'en-tête de `geo-civ.js`. Cette répartition a été **révisée le 9 août** : voir ci-dessus.

**Écarts de nommage** : tous résorbés (« SAN PEDRO » → « San-Pédro », « SIEGE »
→ « Siège Abidjan », « I FFOU » → « Iffou », Bangolo dédoublé ramené à une
occurrence — il relève de Man dans les deux cas).

**Deux erreurs des données sources, corrigées** (elles auraient été invisibles
et fausses) :

1. dans `civ_admincapitals`, l'enregistrement **« Sikensi » porte le code
   d'Oumé** (CI1302). Une jointure par code plaçait donc Oumé **à 98 km** de
   son département ; la jointure se fait par nom ;
2. le point d'**Abidjan** y tombe au milieu de la lagune, à une dizaine de
   kilomètres à l'est du Plateau. Rectifié.

Contrôlé : les 108 chefs-lieux tombent **dans** leur département.

**Sur la simplification** — une simplification polygone par polygone ouvre des
fentes le long des frontières communes, chaque côté étant simplifié
différemment. Les contours sont donc découpés en **arcs partagés**, simplifiés
**une seule fois** (principe de TopoJSON) : une limite commune à deux
départements est rigoureusement identique des deux côtés. Effet secondaire
appréciable : **258 Ko → 63 Ko** de tracés à qualité égale.

**Vérifié à l'écran** (serveur de développement, page de prévisualisation
temporaire montant les composants réels, depuis supprimée) : les 8 zones
rendent sans erreur de console, en mode clair **et sombre**. Les noms de
localité qui se recouvraient — 17 pour Korhogo, illisibles — sont filtrés par
un placement glouton sur largeurs **mesurées** ; le nom omis reste accessible
au survol du point. C'est la seule vérification de cette session faite dans un
vrai navigateur.

**Reste à faire** : le rendu **dans l'application connectée** n'a pas pu être
vu (pas d'identifiants). À contrôler après déploiement, en même temps que le
reste du §0.

---

## 8. Pièges rencontrés — à ne pas redécouvrir

- `\:` dans un littéral de gabarit JS devient `:` → sélecteur CSS invalide, règle
  entière ignorée. Écrire `\\:`.
- `nettoyerPdf` supprime tout caractère non-ASCII : les espaces insécables des
  séparateurs de milliers doivent être convertis explicitement.
- `overflow-x: hidden` sur un ancêtre neutralise `position: sticky`. Utiliser
  `overflow-x: clip`.
- Les fonctions de mise à jour d'état React doivent être pures : `setFormations`
  déclenche des écritures Supabase *dans* l'updater, doublées par StrictMode.
- Un `.docx` doit être rempaqueté avec `[Content_Types].xml` en **première entrée
  et non compressée**. `merge_runs.py` est nécessaire avant toute recherche de
  texte (Word fragmente les mots en runs).
- La sortie texte de pandoc **aplatit les champs Zotero** : compter les citations
  dessus donne un résultat faux. Lire `word/document.xml` et extraire le résultat
  de champ entre `separate` et `end`.
