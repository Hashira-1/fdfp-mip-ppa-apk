/* geo-civ.js — Géographie des zones de couverture du FDFP.
 *
 * Contours des 108 départements de Côte d'Ivoire, déjà projetés en
 * coordonnées SVG : la carte se dessine avec un <path> par département,
 * sans bibliothèque de cartographie ni tuile réseau, conformément au
 * principe « zéro dépendance à l'exécution » du reste de l'application.
 *
 * SOURCES
 *   Géométries et chefs-lieux : limites administratives officielles
 *     (OCHA / HDX, COD-AB Côte d'Ivoire, version V_01, valides au 06/07/2018),
 *     shapefiles « civ_admin2 » et « civ_admincapitals », EPSG:4326 (WGS 84).
 *   Rattachement des départements aux implantations du FDFP :
 *     « ZONES DE COUVERTURE DE LA DACD », document interne FDFP, juin 2026.
 *
 * PROJECTION
 *   Équirectangulaire, exacte à la latitude médiane du pays (7.6 °N).
 *   Aux dimensions de la Côte d'Ivoire, la déformation reste inférieure au
 *   pixel : inutile d'embarquer une projection conique.
 *   Repère SVG : x vers l'est, y vers le sud, viewBox « 0 0 1000 1057.3 ».
 *
 * SIMPLIFICATION
 *   Douglas-Peucker à 0.8 unité SVG, appliqué en topologie partagée : une
 *   frontière commune à deux départements n'est simplifiée qu'une fois et
 *   reste donc rigoureusement identique des deux côtés. Simplifier chaque
 *   polygone pour son compte ouvrirait des fentes le long des limites.
 *   Tracés : 63 Ko au total.
 *
 * DEUX PRÉCISIONS APPORTÉES AUX DONNÉES SOURCES
 *   - dans « civ_admincapitals », l'enregistrement « Sikensi » porte le code
 *     d'Oumé (CI1302) ; la jointure se fait donc par nom, pas par code ;
 *   - le point d'Abidjan y tombe au milieu de la lagune, à une dizaine de
 *     kilomètres à l'est du Plateau ; il a été rectifié.
 *
 * CHAMPS  c : code officiel · n : localité (chef-lieu de département)
 *         r : région ou district · z : implantation FDFP de rattachement
 *         x, y : position du chef-lieu · d : contour du département
 *         b : boîte englobante [x0, y0, x1, y1], pour recadrer sur une zone
 *             sans avoir à réinterpréter le tracé
 *
 * Les TRACÉS ne sont pas ici : ils vivent dans « geo-civ-traces.js », chargé
 * à la demande par les deux écrans qui dessinent la carte. Ce fichier-ci est
 * chargé avec l'application, car la nomenclature sert partout — listes,
 * formulaire, exports, fiche PDF.
 *
 * Fichier engendré — ne pas modifier à la main.
 */

export const CARTE_LARGEUR = 1000;
export const CARTE_HAUTEUR = 1057.3;

export const DEPARTEMENTS = [
  {c:'CI2001',n:'Abengourou',r:'Indénié-Djuablin',z:'Antenne Abengourou',x:835.4,y:664.8,b:[785,605,886,745.5]},
  {c:'CI2401',n:'Adzopé',r:'La Mé',z:'Antenne Abengourou',x:775.2,y:768.1,b:[738.5,711,832.5,828.5]},
  {c:'CI2002',n:'Agnibilékrou',r:'Indénié-Djuablin',z:'Antenne Abengourou',x:883.3,y:598.4,b:[809.5,561,903.5,657.5]},
  {c:'CI2402',n:'Akoupé',r:'La Mé',z:'Antenne Abengourou',x:771.5,y:722.7,b:[726,679.5,811,756.5]},
  {c:'CI2501',n:'Arrah',r:'Moronou',z:'Antenne Abengourou',x:757.3,y:674.2,b:[730,620,796,697.5]},
  {c:'CI2003',n:'Bettié',r:'Indénié-Djuablin',z:'Antenne Abengourou',x:849.5,y:773.3,b:[836.5,728.5,888,804]},
  {c:'CI1401',n:'Bondoukou',r:'Gontougo',z:'Antenne Abengourou',x:950.0,y:447.3,b:[825,324.5,1000,493]},
  {c:'CI2502',n:'Bongouanou',r:'Moronou',z:'Antenne Abengourou',x:719.7,y:678.3,b:[674,620.5,755,708.5]},
  {c:'CI0801',n:'Bouna',r:'Bounkani',z:'Antenne Abengourou',x:917.3,y:244.1,b:[703.5,187,983,370.5]},
  {c:'CI1901',n:'Daoukro',r:'Iffou',z:'Antenne Abengourou',x:758.1,y:610.6,b:[658,536.5,835,628.5]},
  {c:'CI0802',n:'Doropo',r:'Bounkani',z:'Antenne Abengourou',x:861.6,y:154.6,b:[831.5,134,928.5,230.5]},
  {c:'CI1402',n:'Koun-Fao',r:'Gontougo',z:'Antenne Abengourou',x:875.0,y:539.5,b:[772.5,461,924,611]},
  {c:'CI2503',n:'M\'Batto',r:'Moronou',z:'Antenne Abengourou',x:693.7,y:707.6,b:[622.5,663,733.5,755]},
  {c:'CI0803',n:'Nassian',r:'Bounkani',z:'Antenne Abengourou',x:839.0,y:379.8,b:[755,332.5,913.5,421.5]},
  {c:'CI1903',n:'Prikro',r:'Iffou',z:'Antenne Abengourou',x:753.2,y:512.8,b:[713,446.5,822.5,557]},
  {c:'CI1403',n:'Sandégué',r:'Gontougo',z:'Antenne Abengourou',x:821.3,y:462.3,b:[742,381,867,489.5]},
  {c:'CI1404',n:'Tanda',r:'Gontougo',z:'Antenne Abengourou',x:889.4,y:487.4,b:[841.5,445.5,933.5,513]},
  {c:'CI1405',n:'Transua',r:'Gontougo',z:'Antenne Abengourou',x:914.4,y:529.4,b:[885,481,941,569]},
  {c:'CI0804',n:'Téhini',r:'Bounkani',z:'Antenne Abengourou',x:808.5,y:189.0,b:[702,130.5,847.5,198.5]},
  {c:'CI2404',n:'Yakassé-Attobrou',r:'La Mé',z:'Antenne Abengourou',x:810.1,y:755.0,b:[792,725.5,851.5,812]},
  {c:'CI1102',n:'Botro',r:'Gbêkê',z:'Antenne Bouaké',x:537.9,y:480.4,b:[518.5,428.5,575.5,519.5]},
  {c:'CI1103',n:'Bouaké',r:'Gbêkê',z:'Antenne Bouaké',x:583.6,y:504.9,b:[554.5,447,671.5,567.5]},
  {c:'CI1101',n:'Béoumi',r:'Gbêkê',z:'Antenne Bouaké',x:492.9,y:508.8,b:[461.5,434,533,550]},
  {c:'CI1701',n:'Dabakala',r:'Hambol',z:'Antenne Bouaké',x:682.0,y:394.3,b:[588.5,301,769,485]},
  {c:'CI1702',n:'Katiola',r:'Hambol',z:'Antenne Bouaké',x:572.2,y:432.0,b:[484,378,631.5,463]},
  {c:'CI1902',n:'M\'Bahiakro',r:'Iffou',z:'Antenne Bouaké',x:696.4,y:544.6,b:[644,467,760.5,564.5]},
  {c:'CI1703',n:'Niakaramadougou',r:'Hambol',z:'Antenne Bouaké',x:540.5,y:345.7,b:[469,218.5,609,399.5]},
  {c:'CI1104',n:'Sakassou',r:'Gbêkê',z:'Antenne Bouaké',x:540.7,y:546.0,b:[468,511.5,573,582.5]},
  {c:'CI1801',n:'Daloa',r:'Haut-Sassandra',z:'Antenne Daloa',x:351.8,y:634.2,b:[296,571.5,435,694.5]},
  {c:'CI0701',n:'Dianra',r:'Béré',z:'Antenne Daloa',x:382.4,y:297.1,b:[307.5,254.5,426,385.5]},
  {c:'CI1802',n:'Issia',r:'Haut-Sassandra',z:'Antenne Daloa',x:328.0,y:705.7,b:[256.5,671,418,742.5]},
  {c:'CI3301',n:'Kani',r:'Worodougou',z:'Antenne Daloa',x:324.8,y:375.6,b:[222.5,269.5,368.5,402.5]},
  {c:'CI0702',n:'Kounahiri',r:'Béré',z:'Antenne Daloa',x:451.2,y:489.3,b:[388.5,451,475.5,530]},
  {c:'CI0703',n:'Mankono',r:'Béré',z:'Antenne Daloa',x:393.1,y:445.3,b:[362,344,533,498.5]},
  {c:'CI3302',n:'Séguéla',r:'Worodougou',z:'Antenne Daloa',x:313.2,y:460.9,b:[227,359.5,384.5,498.5]},
  {c:'CI1803',n:'Vavoua',r:'Haut-Sassandra',z:'Antenne Daloa',x:345.4,y:557.0,b:[246,487,406,613]},
  {c:'CI1804',n:'Zoukougbeu',r:'Haut-Sassandra',z:'Antenne Daloa',x:282.3,y:659.6,b:[249.5,609,318,682]},
  {c:'CI2303',n:'Zuénoula',r:'Marahoué',z:'Antenne Daloa',x:416.0,y:549.3,b:[351.5,495.5,472,592]},
  {c:'CI0501',n:'Boundiali',r:'Bagoué',z:'Antenne Korhogo',x:345.2,y:202.5,b:[293,114,420.5,279]},
  {c:'CI2801',n:'Dikodougou',r:'Poro',z:'Antenne Korhogo',x:461.5,y:277.6,b:[414,229.5,488,365.5]},
  {c:'CI3101',n:'Ferkessédougou',r:'Tchologo',z:'Antenne Korhogo',x:555.7,y:191.6,b:[511,132.5,637.5,254]},
  {c:'CI2101',n:'Gbeleban',r:'Kabadougou',z:'Antenne Korhogo',x:74.2,y:192.5,b:[72.5,140,146,224.5]},
  {c:'CI1001',n:'Kaniasso',r:'Folon',z:'Antenne Korhogo',x:176.0,y:154.1,b:[163,58.5,328,171.5]},
  {c:'CI3102',n:'Kong',r:'Tchologo',z:'Antenne Korhogo',x:652.6,y:263.7,b:[589.5,165,786,350]},
  {c:'CI2802',n:'Korhogo',r:'Poro',z:'Antenne Korhogo',x:498.5,y:238.2,b:[371.5,153.5,534,323]},
  {c:'CI0502',n:'Kouto',r:'Bagoué',z:'Antenne Korhogo',x:357.1,y:141.4,b:[265.5,83.5,390,195]},
  {c:'CI2803',n:'M\'Bengué',r:'Poro',z:'Antenne Korhogo',x:440.5,y:122.5,b:[373,55.5,485.5,172.5]},
  {c:'CI2102',n:'Madinani',r:'Kabadougou',z:'Antenne Korhogo',x:270.0,y:187.4,b:[200.5,127,302.5,229.5]},
  {c:'CI1002',n:'Minignan',r:'Folon',z:'Antenne Korhogo',x:122.2,y:124.3,b:[69.5,47.5,213,146]},
  {c:'CI2103',n:'Odienné',r:'Kabadougou',z:'Antenne Korhogo',x:167.4,y:205.7,b:[110,169,249,370]},
  {c:'CI3103',n:'Ouangolodougou',r:'Tchologo',z:'Antenne Korhogo',x:563.7,y:128.4,b:[452.5,46.5,599,170]},
  {c:'CI2104',n:'Samatiguila',r:'Kabadougou',z:'Antenne Korhogo',x:167.5,y:152.9,b:[121,123.5,178,185]},
  {c:'CI2804',n:'Sinématiali',r:'Poro',z:'Antenne Korhogo',x:524.6,y:192.2,b:[503.5,172,540.5,227.5]},
  {c:'CI2105',n:'Séguélon',r:'Kabadougou',z:'Antenne Korhogo',x:240.0,y:230.1,b:[198.5,198,303,299]},
  {c:'CI0503',n:'Tengrela',r:'Bagoué',z:'Antenne Korhogo',x:357.1,y:44.5,b:[312.5,0,396.5,89]},
  {c:'CI1601',n:'Bangolo',r:'Guémon',z:'Antenne Man',x:180.2,y:618.6,b:[97,577.5,253,644.5]},
  {c:'CI3201',n:'Biankouma',r:'Tonkpi',z:'Antenne Man',x:158.9,y:497.6,b:[96,429,249,559]},
  {c:'CI0901',n:'Bloléquin',r:'Cavally',z:'Antenne Man',x:95.2,y:691.5,b:[49,623.5,134,740.5]},
  {c:'CI3202',n:'Danané',r:'Tonkpi',z:'Antenne Man',x:71.1,y:577.1,b:[18.5,495,122,622.5]},
  {c:'CI1602',n:'Duékoué',r:'Guémon',z:'Antenne Man',x:202.7,y:663.1,b:[157.5,627,264.5,731]},
  {c:'CI1603',n:'Facobly',r:'Guémon',z:'Antenne Man',x:198.1,y:555.9,b:[179.5,500,262.5,567.5]},
  {c:'CI0902',n:'Guiglo',r:'Cavally',z:'Antenne Man',x:178.0,y:695.8,b:[112,642,227,757]},
  {c:'CI0401',n:'Koro',r:'Bafing',z:'Antenne Man',x:184.1,y:362.9,b:[103,277.5,234,396]},
  {c:'CI1604',n:'Kouibly',r:'Guémon',z:'Antenne Man',x:221.3,y:577.8,b:[174,539,253,593]},
  {c:'CI3203',n:'Man',r:'Tonkpi',z:'Antenne Man',x:169.2,y:552.7,b:[102.5,510.5,194.5,619]},
  {c:'CI0402',n:'Ouaninou',r:'Bafing',z:'Antenne Man',x:117.8,y:415.0,b:[56,371,145,465.5]},
  {c:'CI3204',n:'Sipilou',r:'Tonkpi',z:'Antenne Man',x:79.0,y:476.9,b:[74,448,136,505]},
  {c:'CI0903',n:'Taï',r:'Cavally',z:'Antenne Man',x:185.5,y:806.3,b:[119.5,719.5,246,849]},
  {c:'CI0403',n:'Touba',r:'Bafing',z:'Antenne Man',x:148.2,y:407.3,b:[128.5,374,249,481]},
  {c:'CI0904',n:'Toulepleu',r:'Cavally',z:'Antenne Man',x:28.2,y:689.8,b:[0,676,66.5,730]},
  {c:'CI3205',n:'Zouan-Hounien',r:'Tonkpi',z:'Antenne Man',x:61.9,y:633.6,b:[24,599,97.5,689.5]},
  {c:'CI2601',n:'Buyo',r:'La Nawa',z:'Antenne San-Pédro',x:259.9,y:742.9,b:[225.5,693.5,313.5,815.5]},
  {c:'CI2201',n:'Divo',r:'Lôh-Djiboua',z:'Antenne San-Pédro',x:529.5,y:813.5,b:[500.5,741.5,599,850.5]},
  {c:'CI1201',n:'Fresco',r:'Gbôklé',z:'Antenne San-Pédro',x:492.3,y:933.9,b:[444.5,848.5,528,945.5]},
  {c:'CI1301',n:'Gagnoa',r:'Gôh',z:'Antenne San-Pédro',x:432.8,y:764.2,b:[356.5,698.5,467.5,843]},
  {c:'CI2202',n:'Guitry',r:'Lôh-Djiboua',z:'Antenne San-Pédro',x:548.9,y:865.2,b:[494.5,835,587,925]},
  {c:'CI2602',n:'Guéyo',r:'La Nawa',z:'Antenne San-Pédro',x:412.4,y:837.6,b:[386.5,823.5,431.5,893]},
  {c:'CI2203',n:'Lakota',r:'Lôh-Djiboua',z:'Antenne San-Pédro',x:476.3,y:810.4,b:[418.5,752,509.5,865]},
  {c:'CI2603',n:'Méagui',r:'La Nawa',z:'Antenne San-Pédro',x:332.7,y:884.5,b:[249,828.5,352,907.5]},
  {c:'CI2901',n:'San-Pédro',r:'San-Pédro',z:'Antenne San-Pédro',x:316.7,y:991.7,b:[213,874,375.5,1033]},
  {c:'CI1202',n:'Sassandra',r:'Gbôklé',z:'Antenne San-Pédro',x:409.5,y:959.3,b:[341.5,846.5,473,976.5]},
  {c:'CI2604',n:'Soubré',r:'La Nawa',z:'Antenne San-Pédro',x:326.9,y:821.4,b:[245,733,389.5,863]},
  {c:'CI2902',n:'Tabou',r:'San-Pédro',z:'Antenne San-Pédro',x:201.3,y:1047.3,b:[160.5,840,257.5,1057.5]},
  {c:'CI0201',n:'Attiégouakro',r:'District autonome de Yamoussoukro',z:'Antenne Yamoussoukro',x:569.5,y:657.6,b:[525.5,607,596,669.5]},
  {c:'CI2701',n:'Bocanda',r:'N\'Zi',z:'Antenne Yamoussoukro',x:670.7,y:609.6,b:[624,577.5,746.5,672.5]},
  {c:'CI2301',n:'Bouaflé',r:'Marahoué',z:'Antenne Yamoussoukro',x:466.3,y:622.2,b:[389,541.5,516,675]},
  {c:'CI0601',n:'Didiévi',r:'Bélier',z:'Antenne Yamoussoukro',x:605.1,y:598.8,b:[576.5,519,646.5,642.5]},
  {c:'CI2702',n:'Dimbokro',r:'N\'Zi',z:'Antenne Yamoussoukro',x:635.0,y:677.8,b:[591.5,611.5,666,693]},
  {c:'CI0602',n:'Djékanou',r:'Bélier',z:'Antenne Yamoussoukro',x:569.6,y:707.9,b:[548,696.5,588,738.5]},
  {c:'CI2703',n:'Kouassi-Kouassikro',r:'N\'Zi',z:'Antenne Yamoussoukro',x:648.8,y:572.0,b:[628,540.5,669.5,602.5]},
  {c:'CI1302',n:'Oumé',r:'Gôh',z:'Antenne Yamoussoukro',x:520.2,y:722.5,b:[458,678.5,555,760.5]},
  {c:'CI2302',n:'Sinfra',r:'Marahoué',z:'Antenne Yamoussoukro',x:438.5,y:683.4,b:[403,653.5,522.5,703]},
  {c:'CI0603',n:'Tiébissou',r:'Bélier',z:'Antenne Yamoussoukro',x:551.5,y:594.6,b:[477.5,552.5,616,647.5]},
  {c:'CI0604',n:'Toumodi',r:'Bélier',z:'Antenne Yamoussoukro',x:585.5,y:693.2,b:[534.5,656,640,747]},
  {c:'CI0202',n:'Yamoussoukro',r:'District autonome de Yamoussoukro',z:'Antenne Yamoussoukro',x:544.2,y:649.1,b:[501,609.5,562,694.5]},
  {c:'CI0101',n:'Abidjan',r:'District autonome d\'Abidjan',z:'Siège Abidjan',x:751.1,y:895.7,b:[677,851,799,915]},
  {c:'CI3001',n:'Aboisso',r:'Sud-Comoé',z:'Siège Abidjan',x:883.0,y:873.6,b:[842.5,745,959.5,922]},
  {c:'CI3002',n:'Adiaké',r:'Sud-Comoé',z:'Siège Abidjan',x:866.9,y:904.1,b:[834.5,888,905,937.5]},
  {c:'CI0301',n:'Agboville',r:'Agnéby-Tiassa',z:'Siège Abidjan',x:717.5,y:796.9,b:[644.5,741.5,763.5,856.5]},
  {c:'CI2403',n:'Alépé',r:'La Mé',z:'Siège Abidjan',x:807.5,y:868.3,b:[759.5,801,867.5,913]},
  {c:'CI1501',n:'Dabou',r:'Grands-Ponts',z:'Siège Abidjan',x:690.4,y:898.1,b:[622,859,705.5,911]},
  {c:'CI3003',n:'Grand-Bassam',r:'Sud-Comoé',z:'Siège Abidjan',x:795.0,y:916.2,b:[777,852,850,925.5]},
  {c:'CI1502',n:'Grand-Lahou',r:'Grands-Ponts',z:'Siège Abidjan',x:588.2,y:909.3,b:[505,816,637.5,936.5]},
  {c:'CI1503',n:'Jacqueville',r:'Grands-Ponts',z:'Siège Abidjan',x:684.4,y:917.3,b:[619.5,894.5,717.5,926.5]},
  {c:'CI0302',n:'Sikensi',r:'Agnéby-Tiassa',z:'Siège Abidjan',x:658.3,y:840.9,b:[635,817.5,692.5,863]},
  {c:'CI0303',n:'Taabo',r:'Agnéby-Tiassa',z:'Siège Abidjan',x:576.7,y:740.1,b:[549,724,630,784]},
  {c:'CI3004',n:'Tiapoum',r:'Sud-Comoé',z:'Siège Abidjan',x:913.0,y:928.5,b:[900,883,962,939]},
  {c:'CI0304',n:'Tiassalé',r:'Agnéby-Tiassa',z:'Siège Abidjan',x:617.2,y:802.6,b:[584.5,739.5,670.5,858.5]},
];
