/**
 * Builds the project presentation.
 *
 *   npm i pptxgenjs
 *   node presentation/build_deck.js
 *
 * Run it from the repository root: every path below is relative to it. The figures
 * come from analysis/outputs/figures, so run the Python pipeline first.
 */
const path = require('path');
const pptxgen = require('pptxgenjs');

const FIG = (n) => path.join('analysis', 'outputs', 'figures', `${n}.png`);
const BG = (n) => path.join('presentation', 'assets', `bg_${n}.png`);
const OUT = path.join('presentation', 'GROUPE_NOM_PRENOM_VF.pptx');

/* ------------------------------------------------------------------ theme */
// The palette is the application's own (client/src/theme.css), so the deck and the
// product read as one thing.
const THEME = {
  name: 'Prospect Hub',
  headFontFace: 'Roboto',
  bodyFontFace: 'Roboto',
  colors: {
    dk1: '0B0B0B', lt1: 'FFFFFF', dk2: '52514E', lt2: 'F4F7FB',
    accent1: '2A78D6', accent2: '86B6EF', accent3: '104281',
    accent4: '0CA30C', accent5: 'B8860B', accent6: 'B02A2A',
    hlink: '2A78D6', folHlink: '104281'
  }
};
const INK = '0B0B0B', MUTED = '52514E', ACCENT = '2A78D6', DEEP = '104281';
const SOFT = 'E3EFFC', SURFACE = 'FFFFFF', GOOD = '0CA30C', WARN = 'B8860B', BAD = 'B02A2A';

const W = 13.333, H = 7.5;           // LAYOUT_WIDE
const M = 0.72;                       // page margin
const COL = W - M * 2;                // usable width
const GAP = 0.4;                      // gutter between two columns
const C2 = (COL - GAP) / 2;           // width of one of two columns
const RIGHT = M + C2 + GAP;           // x of the right column

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.author = 'Prospect Hub';
pres.title = 'Prospect Hub — plateforme de prospection et de candidature';

/* ---------------------------------------------------------------- layouts */
pres.defineSlideMaster({
  title: 'TITLE',
  background: { path: BG('title') },
  objects: [
    { placeholder: { options: { name: 'title', type: 'title', x: M, y: 2.25, w: 9.4, h: 1.5,
        fontSize: 54, bold: true, color: INK, align: 'left', valign: 'bottom' }, text: '' } },
    { placeholder: { options: { name: 'body', type: 'body', x: M, y: 3.85, w: 8.6, h: 1.1,
        fontSize: 19, color: MUTED, align: 'left', valign: 'top' }, text: '' } }
  ]
});

pres.defineSlideMaster({
  title: 'SECTION',
  background: { path: BG('closing') },
  objects: [
    { placeholder: { options: { name: 'title', type: 'title', x: M, y: 2.9, w: 10.5, h: 1.1,
        fontSize: 40, bold: true, color: INK, align: 'left', valign: 'middle' }, text: '' } },
    { placeholder: { options: { name: 'body', type: 'body', x: M, y: 4.05, w: 9.4, h: 0.8,
        fontSize: 17, color: MUTED, align: 'left', valign: 'top' }, text: '' } }
  ]
});

pres.defineSlideMaster({
  title: 'CONTENT',
  background: { path: BG('content') },
  objects: [
    { placeholder: { options: { name: 'title', type: 'title', x: M, y: 0.46, w: COL, h: 0.72,
        fontSize: 32, bold: true, color: INK, align: 'left', valign: 'middle' }, text: '' } },
    { placeholder: { options: { name: 'body', type: 'body', x: M, y: 1.2, w: COL, h: 0.42,
        fontSize: 15, color: MUTED, align: 'left', valign: 'top' }, text: '' } }
  ],
  slideNumber: { x: 12.1, y: 6.78, w: 0.5, h: 0.3, fontSize: 11, color: MUTED, align: 'right' }
});

pres.defineSlideMaster({
  title: 'CLOSING',
  background: { path: BG('closing') },
  objects: [
    { placeholder: { options: { name: 'title', type: 'title', x: M, y: 2.6, w: 10.5, h: 1.2,
        fontSize: 44, bold: true, color: INK, align: 'left', valign: 'middle' }, text: '' } }
  ]
});

/* ------------------------------------------------------------- components */
/** The motif: a soft rounded card, exactly like the surfaces in the app. */
function card(slide, x, y, w, h, opts = {}) {
  slide.addShape(pres.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.14,
    fill: { color: opts.fill || SURFACE },
    line: { color: opts.line || 'E8EDF5', width: 1 },
    shadow: { type: 'outer', color: '1E3A5F', opacity: 0.1, blur: 10, offset: 2, angle: 90 },
    objectName: opts.name || 'card'
  });
}

/** A pill chip, the app's label. */
function chip(slide, x, y, text, tone = 'info', w = 1.25) {
  const tones = {
    info: [SOFT, ACCENT], good: ['DFF3DF', GOOD], warn: ['FBF0D8', WARN],
    bad: ['F7E2E2', BAD], grey: ['EFEFEA', MUTED]
  };
  const [bg, fg] = tones[tone];
  slide.addShape(pres.ShapeType.roundRect, {
    x, y, w, h: 0.3, rectRadius: 0.15, fill: { color: bg }, line: { color: bg },
    objectName: `chip-${text}`
  });
  slide.addText(text, { x, y, w, h: 0.3, fontSize: 11.5, bold: true, color: fg,
    align: 'center', valign: 'middle', margin: 0, isTextBox: true });
}

/** A headline figure with its caption, on its own card. */
function stat(slide, x, y, w, value, label, tone = ACCENT, h = 1.28) {
  card(slide, x, y, w, h, { name: `stat-${label}` });
  slide.addText(value, { x: x + 0.22, y: y + 0.14, w: w - 0.44, h: 0.62, fontSize: 34,
    bold: true, color: tone, align: 'left', valign: 'middle', margin: 0, isTextBox: true });
  slide.addText(label, { x: x + 0.22, y: y + 0.74, w: w - 0.44, h: 0.42, fontSize: 12,
    color: MUTED, align: 'left', valign: 'top', margin: 0, isTextBox: true });
}

/** Numbered step, used for the pipeline and the architecture. */
function step(slide, x, y, w, n, title, body, h = 1.75) {
  card(slide, x, y, w, h, { name: `step-${n}` });
  slide.addShape(pres.ShapeType.ellipse, { x: x + 0.22, y: y + 0.22, w: 0.4, h: 0.4,
    fill: { color: ACCENT }, line: { color: ACCENT }, objectName: `dot-${n}` });
  slide.addText(String(n), { x: x + 0.22, y: y + 0.22, w: 0.4, h: 0.4, fontSize: 13,
    bold: true, color: 'FFFFFF', align: 'center', valign: 'middle', margin: 0, isTextBox: true });
  slide.addText(title, { x: x + 0.72, y: y + 0.22, w: w - 0.94, h: 0.42, fontSize: 14,
    bold: true, color: INK, align: 'left', valign: 'middle', margin: 0, isTextBox: true });
  slide.addText(body, { x: x + 0.22, y: y + 0.72, w: w - 0.44, h: h - 0.92, fontSize: 12.5,
    color: MUTED, align: 'left', valign: 'top', margin: 0, isTextBox: true, lineSpacingMultiple: 1.15 });
}

/** Bulleted list inside a card. */
function bullets(slide, x, y, w, h, items, size = 13.5) {
  slide.addText(
    items.map((t, i) => ({
      text: t,
      options: { bullet: { indent: 14 }, breakLine: i < items.length - 1, paraSpaceAfter: 7 }
    })),
    { x, y, w, h, fontSize: size, color: MUTED, align: 'left', valign: 'top',
      margin: 0, isTextBox: true, lineSpacingMultiple: 1.12 }
  );
}

function content(section, title, subtitle) {
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: section });
  s.addText(title, { placeholder: 'title' });
  if (subtitle) s.addText(subtitle, { placeholder: 'body' });
  return s;
}

/* ===================================================================== 1 */
pres.addSection({ title: 'Ouverture' });
{
  const s = pres.addSlide({ masterName: 'TITLE', sectionTitle: 'Ouverture' });
  s.addText('Prospect Hub', { placeholder: 'title' });
  s.addText(
    'Rechercher, analyser et contacter les entreprises de Marrakech\npour décrocher un stage ou une opportunité professionnelle',
    { placeholder: 'body' });
  chip(s, M, 1.78, 'PROJET DATA · VERSION FINALE', 'info', 3.3);
  s.addText('283 entreprises collectées  ·  Python · React · Express · Gemini',
    { x: M, y: 5.25, w: 9, h: 0.4, fontSize: 14, color: MUTED, isTextBox: true, margin: 0 });
  s.addText('GROUPE — NOM Prénom', { x: M, y: 5.78, w: 9, h: 0.4, fontSize: 15,
    bold: true, color: INK, isTextBox: true, margin: 0 });
  s.addNotes("Bonjour. Je vous présente Prospect Hub, une plateforme qui part d'une liste brute de 283 entreprises de Marrakech collectées sur Google Places, et qui va jusqu'à l'envoi d'une candidature spontanée et au suivi de la réponse. Je vais dérouler la chaîne complète : collecte, exploration, nettoyage en Python, analyse, puis la plateforme elle-même.");
}

/* ===================================================================== 2 */
{
  const s = content('Ouverture', 'Au programme', 'Quatre temps, de la donnée brute à la plateforme en ligne');
  const w = (COL - 0.36 * 3) / 4;
  const blocks = [
    ['1', 'Le problème', 'Pourquoi chercher un stage à Marrakech est inefficace, et ce que la plateforme vise'],
    ['2', 'La donnée', 'Collecte Google Places, exploration, nettoyage Python, analyse'],
    ['3', 'La solution', 'Architecture, backend, frontend, intelligence artificielle'],
    ['4', 'Les résultats', 'Ce qui fonctionne aujourd\'hui et ce qui reste à faire']
  ];
  blocks.forEach(([n, t, b], i) => step(s, M + i * (w + 0.36), 2.05, w, n, t, b, 2.5));
  s.addText('Chaque chiffre présenté vient du fichier réellement collecté et traité — aucune donnée d\'exemple.',
    { x: M, y: 5.0, w: COL, h: 0.4, fontSize: 13.5, italic: true, color: ACCENT, isTextBox: true, margin: 0 });
  s.addNotes("Je commence par le problème, puis la démarche data qui est le cœur du projet, ensuite la solution technique, et je termine par les résultats mesurés et les limites.");
}

/* ===================================================================== 3 */
pres.addSection({ title: 'Problématique' });
{
  const s = content('Problématique', 'Problématique et objectifs',
    'Chercher un stage à Marrakech se fait encore à la main, entreprise par entreprise');
  card(s, M, 1.9, 6.1, 3.5, { name: 'probleme' });
  chip(s, M + 0.28, 2.12, 'LE PROBLÈME', 'bad', 1.6);
  s.addText('Aucune liste exploitable', { x: M + 0.28, y: 2.55, w: 5.5, h: 0.4, fontSize: 19,
    bold: true, color: INK, isTextBox: true, margin: 0 });
  bullets(s, M + 0.28, 3.02, 5.5, 2.2, [
    "Les offres de stage publiées ne couvrent qu'une fraction du marché local",
    "Les entreprises sont dispersées sur Google Maps, sans contact direct",
    "Une candidature spontanée se prépare à la main : trouver, rédiger, envoyer, noter",
    "Rien ne dit par où commencer ni qui relancer"
  ]);

  card(s, M + 6.4, 1.9, COL - 6.4, 3.5, { fill: SOFT, line: 'CFE2F7', name: 'objectifs' });
  chip(s, M + 6.68, 2.12, 'LES OBJECTIFS', 'info', 1.7);
  s.addText('Une chaîne complète, automatisée', { x: M + 6.68, y: 2.55, w: 5.0, h: 0.4,
    fontSize: 19, bold: true, color: INK, isTextBox: true, margin: 0 });
  bullets(s, M + 6.68, 3.02, 5.0, 2.2, [
    "Collecter et fiabiliser une base d'entreprises réelles",
    "Classer les entreprises par potentiel plutôt que par ordre alphabétique",
    "Rédiger la candidature avec l'IA et l'envoyer depuis la plateforme",
    "Suivre chaque échange jusqu'à la réponse"
  ]);
  s.addNotes("Le point de départ est concret : à Marrakech, les offres de stage publiées ne représentent qu'une petite partie du marché. L'essentiel passe par la candidature spontanée. Le problème n'est donc pas de lire des annonces, mais de construire soi-même une liste d'entreprises, de la prioriser, et de ne rien perdre en route. C'est exactement ce que la plateforme industrialise.");
}

/* ===================================================================== 4 */
pres.addSection({ title: 'Architecture' });
{
  const s = content('Architecture', 'Architecture globale',
    'Quatre couches, une seule source de vérité pour les données');
  const w = (COL - 0.34 * 3) / 4;
  const layers = [
    ['Collecte', 'Google Places API\n14 requêtes ciblées\n→ companies.csv', 'grey'],
    ['Traitement', 'Python · pandas\nexplorer → nettoyer → analyser\n→ companies_clean.csv', 'warn'],
    ['Service', 'Node.js · Express 5\n26 endpoints REST\ndb.json + logique métier', 'info'],
    ['Interface', 'React 19 · Vite · Tailwind\n6 pages, Chart.js\n+ assistant Gemini', 'good']
  ];
  layers.forEach(([t, b, tone], i) => {
    const x = M + i * (w + 0.34);
    card(s, x, 2.0, w, 2.35, { name: `layer-${t}` });
    chip(s, x + 0.24, 2.22, t.toUpperCase(), tone, w - 0.48);
    s.addText(b, { x: x + 0.24, y: 2.68, w: w - 0.48, h: 1.5, fontSize: 12.5, color: MUTED,
      isTextBox: true, margin: 0, lineSpacingMultiple: 1.2, valign: 'top' });
    if (i < 3) {
      s.addText('→', { x: x + w + 0.02, y: 2.9, w: 0.3, h: 0.4, fontSize: 18, bold: true,
        color: ACCENT, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
    }
  });
  card(s, M, 4.62, COL, 1.35, { fill: SOFT, line: 'CFE2F7', name: 'flux' });
  s.addText('Le même fichier CSV alimente les deux branches', { x: M + 0.3, y: 4.78, w: 6, h: 0.35,
    fontSize: 15, bold: true, color: INK, isTextBox: true, margin: 0 });
  s.addText("L'analyse Python et l'application lisent la même source. Le score d'opportunité est implémenté deux fois avec la même formule — une fois en Python pour le rapport, une fois en JavaScript pour l'application — ce qui garantit que les chiffres des slides et ceux de l'écran ne divergent jamais.",
    { x: M + 0.3, y: 5.15, w: COL - 0.6, h: 0.7, fontSize: 12.5, color: MUTED, isTextBox: true,
      margin: 0, lineSpacingMultiple: 1.15 });
  s.addNotes("L'architecture se lit de gauche à droite. La collecte produit un CSV. Python le nettoie et l'analyse. Express le sert et porte la logique métier. React l'affiche. Point important pour la cohérence : le score d'opportunité existe dans les deux langages avec la même formule et les mêmes poids, donc ce que je montre dans les graphiques est exactement ce que l'utilisateur voit dans l'application.");
}

/* ===================================================================== 5 */
{
  const s = content('Architecture', 'Stack technique et outils',
    'Choisis pour la rapidité de développement et la simplicité de déploiement');
  const groups = [
    ['Données', ['Python 3.14', 'pandas — nettoyage et agrégation', 'matplotlib — 10 figures', 'NumPy — statistiques']],
    ['Backend', ['Node.js 18+ · Express 5', 'db.json — base fichier JSON', 'bcrypt · cookies signés HMAC', 'Nodemailer — envoi SMTP']],
    ['Frontend', ['React 19 — 37 modules', 'Vite 7 — build en 1,8 s', 'Tailwind CSS 4 — thème unique', 'Chart.js 4 — graphiques']],
    ['IA & API', ['Google Gemini 2.5 Flash', 'Google Places API', 'clé par utilisateur, chiffrée', 'assistant intégré']]
  ];
  const w = (COL - 0.34 * 3) / 4;
  groups.forEach(([title, items], i) => {
    const x = M + i * (w + 0.34);
    card(s, x, 2.0, w, 3.1, { name: `stack-${title}` });
    s.addText(title, { x: x + 0.26, y: 2.2, w: w - 0.52, h: 0.38, fontSize: 17, bold: true,
      color: ACCENT, isTextBox: true, margin: 0 });
    bullets(s, x + 0.26, 2.68, w - 0.52, 2.2, items, 12.5);
  });
  s.addText('Un seul langage côté application (JavaScript) et un seul côté données (Python) : moins de contextes à maîtriser, et un déploiement en deux commandes.',
    { x: M, y: 5.35, w: COL, h: 0.5, fontSize: 13.5, italic: true, color: MUTED, isTextBox: true, margin: 0 });
  s.addNotes("Je justifie deux choix. D'abord Python pour la partie data : pandas est l'outil standard pour ce volume et ces opérations. Ensuite JavaScript partout ailleurs, parce que le même langage sert l'API et l'interface. La base est un simple fichier JSON : pour 283 entreprises et un utilisateur, une base relationnelle serait une complexité inutile — mais je sais que c'est la première chose à changer pour passer à l'échelle.");
}

/* ===================================================================== 6 */
{
  const s = content('Architecture', 'Backend : API, logique métier et données',
    '26 endpoints REST, 8 modules, 988 lignes');
  card(s, M, 1.95, 7.3, 3.6, { name: 'modules' });
  s.addText('Organisation en modules', { x: M + 0.3, y: 2.12, w: 4, h: 0.38, fontSize: 17,
    bold: true, color: INK, isTextBox: true, margin: 0 });
  const mods = [
    ['store.js', 'lecture/écriture du CSV et de db.json, export'],
    ['api.js', 'les 26 routes REST et la validation des entrées'],
    ['auth.js', 'comptes, sessions signées, chiffrement de la clé IA'],
    ['ai.js', 'appels Gemini : rédaction des emails'],
    ['assistant.js', "base de connaissances + mémoire de l'assistant"],
    ['mailer.js', 'envoi SMTP, en-tête de désinscription'],
    ['jobs.js', "tâches de fond avec suivi d'avancement"]
  ];
  mods.forEach(([name, desc], i) => {
    const y = 2.62 + i * 0.4;
    s.addText(name, { x: M + 0.3, y, w: 1.5, h: 0.34, fontSize: 12.5, bold: true, color: ACCENT,
      isTextBox: true, margin: 0, valign: 'middle' });
    s.addText(desc, { x: M + 1.85, y, w: 5.2, h: 0.34, fontSize: 12.5, color: MUTED,
      isTextBox: true, margin: 0, valign: 'middle' });
  });

  card(s, M + 7.6, 1.95, COL - 7.6, 3.6, { fill: SOFT, line: 'CFE2F7', name: 'regles' });
  s.addText('La logique métier, côté serveur', { x: M + 7.88, y: 2.12, w: 4.0, h: 0.42,
    fontSize: 16, bold: true, color: INK, isTextBox: true, margin: 0 });
  bullets(s, M + 7.88, 2.62, 3.9, 2.8, [
    'Plafond quotidien d’envois (20 par défaut)',
    'Interdiction de réécrire au même contact sous 14 jours',
    'Statut « ne pas contacter » bloquant',
    'Ligne de désinscription ajoutée à chaque message',
    'Idempotence : un double clic n’envoie qu’un email',
    'Le passage d’un contact enregistré fait avancer le statut'
  ], 12.5);
  s.addText('Ces règles vivent dans l’API, pas dans l’interface : elles s’appliquent même si quelqu’un appelle l’API directement.',
    { x: M, y: 5.72, w: COL, h: 0.45, fontSize: 13, italic: true, color: ACCENT, isTextBox: true, margin: 0 });
  s.addNotes("Le backend est découpé par responsabilité, un module par sujet. Le point que je veux souligner, c'est que toutes les règles métier sont côté serveur : le plafond d'envoi, le délai de 14 jours entre deux messages, le statut « ne pas contacter ». Si on contournait l'interface et qu'on appelait l'API directement, ces règles s'appliqueraient quand même. C'est volontaire : la conformité ne doit pas dépendre du bouton.");
}

/* ===================================================================== 7 */
pres.addSection({ title: 'Données' });
{
  const s = pres.addSlide({ masterName: 'SECTION', sectionTitle: 'Données' });
  s.addText('La démarche data', { placeholder: 'title' });
  s.addText('Collecte → exploration → nettoyage → analyse', { placeholder: 'body' });
  chip(s, M, 2.42, 'PARTIE 2', 'info', 1.5);
  s.addNotes("J'en viens au cœur du projet : la chaîne de traitement des données.");
}

/* ===================================================================== 8 */
{
  const s = content('Données', 'Sources de données et méthodologie de collecte',
    'Google Places API (New) — les données publiques des fiches entreprise');
  const w = (COL - 0.34 * 2) / 3;
  step(s, M, 1.95, w, '1', '14 requêtes ciblées',
    'Des recherches croisant métier et ville : « agence digitale Marrakech », « société informatique Marrakech », « hôtel Marrakech »… pour couvrir plusieurs secteurs plutôt qu’un seul.', 2.45);
  step(s, M + w + 0.34, 1.95, w, '2', 'Déduplication à la source',
    'Le place_id de Google sert de clé unique : une entreprise trouvée par trois requêtes différentes n’est enregistrée qu’une fois.', 2.45);
  step(s, M + (w + 0.34) * 2, 1.95, w, '3', '13 champs par entreprise',
    'Nom, adresse, téléphone, site web, catégorie, note, nombre d’avis, latitude, longitude, lien Maps, et la requête d’origine.', 2.45);

  stat(s, M, 4.68, 2.4, '283', 'entreprises collectées');
  stat(s, M + 2.6, 4.68, 2.4, '14', 'requêtes de recherche');
  stat(s, M + 5.2, 4.68, 2.4, '13', 'champs par entreprise');
  card(s, M + 7.8, 4.68, COL - 7.8, 1.28, { fill: SOFT, line: 'CFE2F7', name: 'limite-collecte' });
  s.addText('Limite assumée', { x: M + 8.05, y: 4.82, w: 3.6, h: 0.32, fontSize: 13.5, bold: true,
    color: INK, isTextBox: true, margin: 0 });
  s.addText("Google Places ne fournit jamais d'adresse email. C'est la contrainte qui structure toute la suite.",
    { x: M + 8.05, y: 5.16, w: 3.8, h: 0.7, fontSize: 12, color: MUTED, isTextBox: true, margin: 0, lineSpacingMultiple: 1.12 });
  s.addNotes("La source est l'API Google Places. J'ai utilisé 14 requêtes croisant un métier et la ville pour ne pas me limiter à un seul secteur. Le place_id sert de clé de déduplication dès la collecte. Point important pour la suite : Google ne donne jamais l'email. C'est pour ça que la moitié du fichier arrive sans adresse, et c'est la contrainte principale du projet.");
}

/* ===================================================================== 9 */
{
  const s = content('Données', 'Exploration : comprendre avant de corriger',
    'Le script 01_explore.py mesure l’état du fichier brut sans rien modifier');
  s.addImage({ path: FIG('01_missing'), x: M, y: 1.82, w: 6.2, h: 2.75,
    sizing: { type: 'contain', w: 6.2, h: 2.75 } });
  s.addImage({ path: FIG('02_categories_raw'), x: M, y: 4.6, w: 6.2, h: 2.4,
    sizing: { type: 'contain', w: 6.2, h: 2.4 } });

  card(s, M + 6.6, 1.82, COL - 6.6, 5.18, { name: 'constats' });
  s.addText('Ce que l’exploration révèle', { x: M + 6.9, y: 2.0, w: 5.2, h: 0.4, fontSize: 18,
    bold: true, color: INK, isTextBox: true, margin: 0 });
  const findings = [
    ['50 %', 'des entreprises n’ont pas d’email — la contrainte Google Places', BAD],
    ['51 %', 'du fichier porte le même libellé « Services », inutilisable pour segmenter', BAD],
    ['34', 'entreprises affichent 5,0/5 sur 3 avis ou moins', WARN],
    ['59', 'sites web encore en http:// et non https://', WARN],
    ['18', 'fiches sans catégorie, sans note et sans avis', WARN],
    ['1', 'entreprise en double, et 1 géolocalisée hors de Marrakech', MUTED]
  ];
  findings.forEach(([n, t, c], i) => {
    const y = 2.55 + i * 0.72;
    s.addText(n, { x: M + 6.9, y, w: 0.95, h: 0.4, fontSize: 20, bold: true, color: c,
      isTextBox: true, margin: 0, valign: 'middle' });
    s.addText(t, { x: M + 7.9, y: y - 0.04, w: 4.2, h: 0.52, fontSize: 12, color: MUTED,
      isTextBox: true, margin: 0, valign: 'middle', lineSpacingMultiple: 1.1 });
  });
  s.addNotes("Première étape : mesurer, sans rien corriger. Le script sort un profil complet. Trois constats comptent. Un : la moitié du fichier n'a pas d'email. Deux : la catégorie de Google est inutilisable, « Services » couvre la moitié des lignes. Trois : la note moyenne de 4,67 est trompeuse, parce que 34 entreprises ont un 5 sur 5 obtenu sur trois avis ou moins. Ces trois constats dictent le nettoyage.");
}

/* ==================================================================== 10 */
{
  const s = content('Données', 'Nettoyage : problèmes détectés et solutions',
    '02_clean.py — chaque correction est comptée et journalisée dans cleaning_report.json');
  const rows = [
    ['Fichier UTF-8 avec BOM', 'Lecture en utf-8-sig, sinon la 1re colonne devient illisible', '—'],
    ['Téléphones en +212, 00212, espacements variables', 'Normalisation en 0X XX XX XX XX', '1'],
    ['Impossible de savoir qui est sur WhatsApp', 'Indicateur mobile déduit des préfixes 06/07', '196'],
    ['URLs incohérentes (http, majuscules, slash final)', 'Normalisation https, hôte en minuscules', '213'],
    ['nombre_avis vide', '0 avis — une absence, pas une inconnue', '18'],
    ['Note vide', 'Laissée vide volontairement : rien à imputer', '18'],
    ['5,0/5 sur 2 avis pèse autant qu’un 4,6 sur 900', 'Note bayésienne (n·note + 12·moyenne)/(n+12)', '34'],
    ['« Services » = 51 % du fichier', 'Secteur re-dérivé du nom quand le libellé est générique', '88'],
    ['Doublon et coordonnées hors zone', 'Déduplication sur nom normalisé, coordonnées à null', '2']
  ];
  card(s, M, 1.85, COL, 4.55, { name: 'tableau' });
  s.addText('Problème détecté', { x: M + 0.3, y: 2.0, w: 4.4, h: 0.3, fontSize: 12, bold: true,
    color: ACCENT, isTextBox: true, margin: 0 });
  s.addText('Solution appliquée en Python', { x: M + 4.85, y: 2.0, w: 5.6, h: 0.3, fontSize: 12,
    bold: true, color: ACCENT, isTextBox: true, margin: 0 });
  s.addText('Lignes', { x: M + 10.6, y: 2.0, w: 1.0, h: 0.3, fontSize: 12, bold: true,
    color: ACCENT, align: 'right', isTextBox: true, margin: 0 });
  rows.forEach(([p, sol, n], i) => {
    const y = 2.4 + i * 0.44;
    s.addText(p, { x: M + 0.3, y, w: 4.5, h: 0.4, fontSize: 12, color: INK, isTextBox: true,
      margin: 0, valign: 'middle' });
    s.addText(sol, { x: M + 4.85, y, w: 5.65, h: 0.4, fontSize: 12, color: MUTED, isTextBox: true,
      margin: 0, valign: 'middle' });
    s.addText(n, { x: M + 10.6, y, w: 1.0, h: 0.4, fontSize: 12, bold: true, color: ACCENT,
      align: 'right', isTextBox: true, margin: 0, valign: 'middle' });
  });
  s.addText('283 lignes en entrée → 282 lignes et 21 colonnes en sortie',
    { x: M, y: 6.55, w: COL - 1.1, h: 0.4, fontSize: 13.5, bold: true, color: INK, isTextBox: true, margin: 0 });
  s.addNotes("Voici le cœur de la partie Python. Chaque ligne est un problème que j'ai mesuré à l'étape 1, et la correction en face. Deux décisions que je veux défendre. D'abord, je ne remplace jamais une note manquante par la moyenne : une note inventée se propagerait dans le score et fausserait le classement des prospects. Un champ vide reste vide. Ensuite, la note bayésienne : je tire chaque note vers la moyenne en proportion du peu d'avis qui la soutiennent.");
}

/* ==================================================================== 11 */
{
  const s = content('Données', 'Le résultat du nettoyage',
    'Des champs exploitables, et une note qui reflète la quantité de preuve');
  s.addImage({ path: FIG('04_completeness'), x: M, y: 1.9, w: C2, h: 2.45,
    sizing: { type: 'contain', w: C2, h: 2.45 } });
  s.addImage({ path: FIG('05_rating_adjustment'), x: RIGHT, y: 1.9, w: C2, h: 2.45,
    sizing: { type: 'contain', w: C2, h: 2.45 } });
  card(s, M, 4.6, C2, 1.95, { name: 'c1' });
  s.addText('Le secteur passe de 94 % à 100 %', { x: M + 0.28, y: 4.78, w: C2 - 0.56, h: 0.35,
    fontSize: 15, bold: true, color: INK, isTextBox: true, margin: 0 });
  s.addText('88 entreprises étiquetées « Services » ont retrouvé un métier lisible, déduit de leur nom. La segmentation par secteur devient possible.',
    { x: M + 0.28, y: 5.16, w: C2 - 0.56, h: 1.1, fontSize: 12.5, color: MUTED, isTextBox: true,
      margin: 0, lineSpacingMultiple: 1.15 });
  card(s, RIGHT, 4.6, C2, 1.95, { fill: SOFT, line: 'CFE2F7', name: 'c2' });
  s.addText('Corrélation note / avis : −0,32', { x: RIGHT + 0.28, y: 4.78, w: C2 - 0.56, h: 0.35,
    fontSize: 15, bold: true, color: INK, isTextBox: true, margin: 0 });
  s.addText('Plus une entreprise a d’avis, plus sa note baisse. C’est la preuve empirique que les 5,0 parfaits viennent d’échantillons minuscules — et la justification de la pondération.',
    { x: RIGHT + 0.28, y: 5.16, w: C2 - 0.56, h: 1.1, fontSize: 12.5, color: MUTED, isTextBox: true,
      margin: 0, lineSpacingMultiple: 1.15 });
  s.addNotes("À gauche, l'effet du nettoyage sur la complétude. À droite, l'effet de la pondération : les points gris sont les notes brutes, les bleus les notes ajustées, et on voit les 5,0 sur très peu d'avis redescendre. Le chiffre que je retiens, c'est la corrélation de −0,32 entre le nombre d'avis et la note : plus une entreprise est évaluée, plus sa note baisse. Ce n'est pas une intuition, c'est mesuré, et ça valide la correction.");
}

/* ==================================================================== 12 */
{
  const s = content('Données', 'Analyse : qui est réellement joignable',
    'Le premier résultat exploitable — et il contredit l’intuition');
  s.addImage({ path: FIG('06_funnel'), x: M, y: 1.95, w: 7.3, h: 3.5,
    sizing: { type: 'contain', w: 7.3, h: 3.5 } });
  card(s, M + 7.7, 1.95, COL - 7.7, 3.5, { name: 'lecture' });
  s.addText('Ce que ça change', { x: M + 8.0, y: 2.15, w: 3.85, h: 0.38, fontSize: 18,
    bold: true, color: INK, isTextBox: true, margin: 0 });
  bullets(s, M + 8.0, 2.65, 3.85, 2.6, [
    'Le téléphone couvre 97 % du fichier, l’email seulement 50 %',
    '70 % ont un numéro mobile : WhatsApp touche plus de monde que l’email',
    'Une plateforme centrée sur l’email seul rate la moitié du marché',
    'D’où les boutons Appel, WhatsApp et Email côte à côte dans l’interface'
  ], 12.5);
  stat(s, M, 5.65, 2.95, '97 %', 'joignables par téléphone', GOOD, 1.2);
  stat(s, M + 3.15, 5.65, 2.95, '70 %', 'joignables sur WhatsApp', ACCENT, 1.2);
  stat(s, M + 6.3, 5.65, 2.95, '50 %', 'joignables par email', BAD, 1.2);
  stat(s, M + 9.45, 5.65, 2.44, '274', 'contactables au total', GOOD, 1.2);
  s.addNotes("Premier résultat d'analyse. L'entonnoir montre que si on ne compte que l'email, on perd la moitié du fichier. Mais 97 % ont un téléphone et 70 % un mobile, donc joignables sur WhatsApp. C'est une conclusion qui a directement changé le produit : l'interface met Appel, WhatsApp et Email au même niveau, au lieu de tout miser sur l'email.");
}

/* ==================================================================== 13 */
{
  const s = content('Données', 'Analyse : où se trouve l’opportunité',
    'Déficit de présence en ligne par secteur, et popularité très inégale');
  s.addImage({ path: FIG('07_digital_gap'), x: M, y: 1.9, w: C2, h: 3.4,
    sizing: { type: 'contain', w: C2, h: 3.4 } });
  s.addImage({ path: FIG('08_reviews_distribution'), x: RIGHT, y: 1.9, w: C2, h: 3.4,
    sizing: { type: 'contain', w: C2, h: 3.4 } });
  card(s, M, 5.5, C2, 1.45, { name: 'i1' });
  s.addText('22 % n’ont aucun site web', { x: M + 0.28, y: 5.63, w: C2 - 0.56, h: 0.32, fontSize: 14.5,
    bold: true, color: INK, isTextBox: true, margin: 0 });
  s.addText('La proportion monte à 50 % chez les consultants : un besoin réel, et un angle d’approche concret.',
    { x: M + 0.28, y: 5.97, w: C2 - 0.56, h: 0.82, fontSize: 12.5, color: MUTED, isTextBox: true, margin: 0, lineSpacingMultiple: 1.12 });
  card(s, RIGHT, 5.5, C2, 1.45, { name: 'i2' });
  s.addText('Médiane 18 avis, moyenne 281', { x: RIGHT + 0.28, y: 5.63, w: C2 - 0.56, h: 0.32, fontSize: 14.5,
    bold: true, color: INK, isTextBox: true, margin: 0 });
  s.addText('Distribution log-normale : quelques géants (jusqu’à 6 857 avis) et une longue traîne. La moyenne ne veut rien dire ici.',
    { x: RIGHT + 0.28, y: 5.97, w: C2 - 0.56, h: 0.82, fontSize: 12.5, color: MUTED, isTextBox: true, margin: 0, lineSpacingMultiple: 1.12 });
  s.addNotes("Deux analyses. À gauche, le déficit digital par secteur : 22 % des entreprises n'ont aucun site, et ça monte à la moitié chez les consultants. À droite, la distribution des avis en échelle logarithmique : médiane 18, moyenne 281, maximum 6 857. C'est une distribution log-normale, donc la moyenne n'a aucun sens — et c'est pourquoi le score utilise un logarithme du nombre d'avis plutôt que le nombre brut.");
}

/* ==================================================================== 14 */
{
  const s = content('Données', 'Du dataset au score d’opportunité',
    'Quatre facteurs pondérés, la même formule en Python et dans l’application');
  s.addImage({ path: FIG('09_score_distribution'), x: M, y: 1.9, w: 5.9, h: 3.2,
    sizing: { type: 'contain', w: 5.9, h: 3.2 } });
  s.addImage({ path: FIG('10_map'), x: M + 6.3, y: 1.9, w: 3.5, h: 3.2,
    sizing: { type: 'contain', w: 3.5, h: 3.2 } });

  card(s, M + 10.0, 1.9, COL - 10.0, 3.2, { fill: SOFT, line: 'CFE2F7', name: 'formule' });
  s.addText('Les 4 facteurs', { x: M + 10.22, y: 2.05, w: 1.62, h: 0.4, fontSize: 13.5, bold: true,
    color: INK, isTextBox: true, margin: 0 });
  [['Secteur', '30'], ['Absence\nde site', '30'], ['Volume\nd’avis', '25'], ['Joignabilité', '15']]
    .forEach(([k, v], i) => {
      const y = 2.46 + i * 0.62;
      s.addText(k, { x: M + 10.22, y, w: 1.02, h: 0.56, fontSize: 11.5, color: MUTED,
        isTextBox: true, margin: 0, valign: 'middle', lineSpacingMultiple: 1.05 });
      s.addText(v, { x: M + 11.24, y, w: 0.45, h: 0.56, fontSize: 14.5, bold: true, color: ACCENT,
        align: 'right', isTextBox: true, margin: 0, valign: 'middle' });
    });
  stat(s, M, 5.35, 3.0, '68', 'prospects prioritaires (score ≥ 65)', GOOD, 1.3);
  stat(s, M + 3.2, 5.35, 3.0, '55,6', 'score moyen sur 282 entreprises', ACCENT, 1.3);
  card(s, M + 6.4, 5.35, COL - 6.4, 1.3, { name: 'usage' });
  s.addText('Le score n’est pas décoratif : il ordonne la page « Aujourd’hui », le tableau des entreprises et le tableau de bord. L’utilisateur ne choisit pas par où commencer — la donnée le fait.',
    { x: M + 6.7, y: 5.52, w: 5.15, h: 1.0, fontSize: 12.5, color: MUTED, isTextBox: true,
      margin: 0, valign: 'middle', lineSpacingMultiple: 1.15 });
  s.addNotes("Toute l'analyse converge vers un seul chiffre : le score d'opportunité, de 0 à 100, construit sur quatre facteurs pondérés. 68 entreprises dépassent 65, ce sont les prospects prioritaires. La carte montre leur répartition dans Marrakech, la couleur étant le score. Et surtout, ce score pilote réellement l'interface : il décide quelles entreprises apparaissent en premier.");
}

/* ==================================================================== 15 */
pres.addSection({ title: 'Plateforme' });
{
  const s = pres.addSlide({ masterName: 'SECTION', sectionTitle: 'Plateforme' });
  s.addText('La plateforme', { placeholder: 'title' });
  s.addText('Frontend, fonctionnalités et intelligence artificielle', { placeholder: 'body' });
  chip(s, M, 2.42, 'PARTIE 3', 'info', 1.5);
  s.addNotes("Je passe maintenant à la plateforme elle-même.");
}

/* ==================================================================== 16 */
{
  const s = content('Plateforme', 'Frontend et intégration avec le backend',
    'React 19 + Vite + Tailwind — 37 modules, 3 040 lignes, un seul fichier CSS');
  card(s, M, 1.9, 6.2, 4.3, { name: 'struct' });
  s.addText('Une structure par responsabilité', { x: M + 0.3, y: 2.08, w: 5.5, h: 0.38,
    fontSize: 17, bold: true, color: INK, isTextBox: true, margin: 0 });
  const tree = [
    ['lib/', 'client API, scoring, formatage — sans React'],
    ['store/', 'AppContext : entreprises, réglages, tâches'],
    ['components/ui/', 'Button, Card, Pill, DataTable, Drawer'],
    ['components/charts/', 'Chart.js encapsulé, vue graphique/tableau'],
    ['features/lead/', 'le panneau entreprise, un fichier par bloc'],
    ['pages/', 'un fichier par route']
  ];
  tree.forEach(([k, v], i) => {
    const y = 2.58 + i * 0.56;
    s.addText(k, { x: M + 0.3, y, w: 1.9, h: 0.45, fontSize: 12.5, bold: true, color: ACCENT,
      isTextBox: true, margin: 0, valign: 'middle' });
    s.addText(v, { x: M + 2.25, y, w: 3.8, h: 0.45, fontSize: 12, color: MUTED, isTextBox: true,
      margin: 0, valign: 'middle', lineSpacingMultiple: 1.1 });
  });

  card(s, M + 6.6, 1.9, COL - 6.6, 4.3, { name: 'integ' });
  s.addText('Comment il parle au backend', { x: M + 6.9, y: 2.08, w: 5.2, h: 0.38, fontSize: 17,
    bold: true, color: INK, isTextBox: true, margin: 0 });
  bullets(s, M + 6.9, 2.58, 5.2, 2.0, [
    'Un seul client HTTP (lib/api.js) : toutes les routes y sont déclarées',
    'Un seul état global (AppContext) : aucune page ne refait un appel déjà fait',
    'Le score est calculé côté client à partir des données brutes, donc instantané quand on bouge un curseur',
    'Vite construit en 1,8 s ; Express sert le dossier dist et renvoie index.html sur toutes les routes'
  ], 12.5);
  card(s, M + 6.9, 4.85, 5.2, 1.1, { fill: SOFT, line: 'CFE2F7', name: 'theme' });
  s.addText('Thème : un seul fichier', { x: M + 7.15, y: 4.97, w: 4.7, h: 0.3, fontSize: 13,
    bold: true, color: INK, isTextBox: true, margin: 0 });
  s.addText('Les couleurs sont des variables CSS redéfinies en mode sombre : aucun composant ne teste le thème.',
    { x: M + 7.15, y: 5.28, w: 4.7, h: 0.6, fontSize: 11.5, color: MUTED, isTextBox: true, margin: 0, lineSpacingMultiple: 1.1 });
  s.addNotes("Le frontend est découpé par responsabilité. Deux choix à défendre. Un : un seul client HTTP et un seul état global, donc pas d'appels dupliqués entre les pages. Deux : le score est recalculé côté navigateur à partir des données brutes. Ça veut dire que quand l'utilisateur déplace un curseur de pondération dans les réglages, tous les classements se recalculent instantanément, sans aller-retour serveur.");
}

/* ==================================================================== 17 */
{
  const s = content('Plateforme', 'Les fonctionnalités principales',
    'Six pages, de la vue d’ensemble à l’envoi et au suivi');
  const w = (COL - 0.32 * 2) / 3;
  const feats = [
    ['Tableau de bord', 'KPI et 4 graphiques Chart.js, filtrables par secteur et statut. Chaque graphique a une vue tableau.'],
    ['Aujourd’hui', 'Les relances dues en premier, puis les meilleurs prospects du jour classés par score.'],
    ['Entreprises', 'Les 282 fiches : recherche, filtres, tri, import et export CSV.'],
    ['Pipeline', 'Un tableau par statut, glisser-déposer entre les colonnes.'],
    ['Panneau entreprise', 'Contact, score détaillé, rédaction IA, envoi, journal des contacts, audit du site.'],
    ['Réglages', 'Identité, plafond d’envoi, clé IA, et les pondérations du score.']
  ];
  feats.forEach(([t, b], i) => {
    const x = M + (i % 3) * (w + 0.32);
    const y = 1.95 + Math.floor(i / 3) * 2.3;
    card(s, x, y, w, 2.05, { name: `feat-${i}` });
    s.addText(t, { x: x + 0.26, y: y + 0.2, w: w - 0.52, h: 0.4, fontSize: 16, bold: true,
      color: ACCENT, isTextBox: true, margin: 0 });
    s.addText(b, { x: x + 0.26, y: y + 0.68, w: w - 0.52, h: 1.2, fontSize: 12.5, color: MUTED,
      isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.15 });
  });
  s.addText('Et une règle transversale : enregistrer un contact fait avancer le statut tout seul, pour qu’aucune relance ne se perde.',
    { x: M, y: 6.5, w: COL - 1.1, h: 0.4, fontSize: 13.5, italic: true, color: ACCENT, isTextBox: true, margin: 0 });
  s.addNotes("Six pages. Celle que j'utilise le plus est « Aujourd'hui » : elle répond à la seule question qui compte le matin, par où je commence. Les relances dues d'abord, puis les meilleurs prospects par score. Et le détail qui fait la différence à l'usage : quand j'enregistre un appel avec le résultat « intéressé », le statut passe à « répondu » et une date de relance est proposée automatiquement.");
}

/* ==================================================================== 18 */
{
  const s = content('Plateforme', 'L’intégration de l’intelligence artificielle',
    'Google Gemini 2.5 Flash, avec une clé propre à chaque utilisateur');
  card(s, M, 1.9, 6.0, 2.4, { name: 'ia1' });
  chip(s, M + 0.28, 2.1, 'USAGE 1', 'info', 1.2);
  s.addText('Rédaction de la candidature', { x: M + 0.28, y: 2.52, w: 5.4, h: 0.38, fontSize: 17,
    bold: true, color: INK, isTextBox: true, margin: 0 });
  s.addText('Le modèle reçoit uniquement des faits : le profil de l’utilisateur et la fiche de l’entreprise. Il lui est interdit d’inventer un client, un résultat ou un contact commun. Il ne rédige ni signature ni mention de désinscription — l’application les ajoute elle-même.',
    { x: M + 0.28, y: 2.95, w: 5.4, h: 1.25, fontSize: 12.5, color: MUTED, isTextBox: true,
      margin: 0, lineSpacingMultiple: 1.15 });

  card(s, M + 6.4, 1.9, COL - 6.4, 2.4, { name: 'ia2' });
  chip(s, M + 6.68, 2.1, 'USAGE 2', 'good', 1.2);
  s.addText('Assistant intégré « Ask »', { x: M + 6.68, y: 2.52, w: 5.4, h: 0.38, fontSize: 17,
    bold: true, color: INK, isTextBox: true, margin: 0 });
  s.addText('Il répond aux questions sur l’application. Sa mémoire tient en trois couches : un guide écrit de la plateforme, un instantané des chiffres de l’utilisateur, et l’historique de la conversation conservé côté serveur.',
    { x: M + 6.68, y: 2.95, w: 5.4, h: 1.25, fontSize: 12.5, color: MUTED, isTextBox: true,
      margin: 0, lineSpacingMultiple: 1.15 });

  card(s, M, 4.55, COL, 2.0, { fill: SOFT, line: 'CFE2F7', name: 'ia3' });
  s.addText('Les garde-fous', { x: M + 0.3, y: 4.72, w: 4, h: 0.35, fontSize: 16, bold: true,
    color: INK, isTextBox: true, margin: 0 });
  const guards = [
    ['Clé par utilisateur', 'Chacun saisit sa propre clé Gemini. Elle est vérifiée auprès de Google avant d’être acceptée.'],
    ['Chiffrée au repos', 'AES-256-GCM. Elle n’est jamais renvoyée au navigateur, même à son propriétaire.'],
    ['Dégradation propre', 'Sans clé, l’application fonctionne : la rédaction retombe sur un modèle de texte.'],
    ['Jamais d’envoi auto', 'L’IA propose un brouillon. L’envoi reste un geste humain, explicite.']
  ];
  const gw = (COL - 0.6 - 0.3 * 3) / 4;
  guards.forEach(([t, b], i) => {
    const x = M + 0.3 + i * (gw + 0.3);
    s.addText(t, { x, y: 5.12, w: gw, h: 0.3, fontSize: 13, bold: true, color: ACCENT,
      isTextBox: true, margin: 0 });
    s.addText(b, { x, y: 5.44, w: gw, h: 0.95, fontSize: 11.5, color: MUTED, isTextBox: true,
      margin: 0, valign: 'top', lineSpacingMultiple: 1.12 });
  });
  s.addNotes("L'IA sert à deux choses. Rédiger la candidature, et répondre aux questions sur l'application. Le point que je veux défendre, c'est le choix du « bring your own key » : chaque utilisateur saisit sa propre clé Gemini, elle est validée auprès de Google, chiffrée en AES-256 avant stockage, et jamais renvoyée au navigateur. Et sans clé, l'application continue de marcher. L'IA est une amélioration, pas une dépendance.");
}

/* ==================================================================== 19 */
pres.addSection({ title: 'Conclusion' });
{
  const s = content('Conclusion', 'Les résultats obtenus',
    'Une chaîne complète, de la donnée brute à la candidature envoyée');
  const w = (COL - 0.3 * 4) / 5;
  const nums = [['283', 'entreprises\ncollectées'], ['282', 'lignes propres\n21 colonnes'],
                ['68', 'prospects\nprioritaires'], ['26', 'endpoints\nREST'], ['12', 'tests\nautomatisés']];
  nums.forEach(([v, l], i) => {
    const x = M + i * (w + 0.3);
    card(s, x, 1.95, w, 1.55);
    s.addText(v, { x: x + 0.2, y: 2.1, w: w - 0.4, h: 0.6, fontSize: 32, bold: true, color: ACCENT,
      align: 'center', valign: 'middle', margin: 0, isTextBox: true });
    s.addText(l, { x: x + 0.2, y: 2.72, w: w - 0.4, h: 0.65, fontSize: 11.5, color: MUTED,
      align: 'center', valign: 'top', margin: 0, isTextBox: true, lineSpacingMultiple: 1.1 });
  });
  card(s, M, 3.78, 6.1, 2.6, { name: 'acquis' });
  s.addText('Ce qui fonctionne', { x: M + 0.3, y: 3.96, w: 5.4, h: 0.35, fontSize: 17, bold: true,
    color: GOOD, isTextBox: true, margin: 0 });
  bullets(s, M + 0.3, 4.42, 5.4, 1.85, [
    'La chaîne Python est reproductible : trois scripts, trois rapports JSON',
    'Les graphiques des slides et ceux de l’application viennent du même calcul',
    'Les règles d’envoi sont testées : plafond, doublons, désinscription',
    'L’application est utilisable sans clé IA et sans serveur mail'
  ], 12.5);
  card(s, M + 6.5, 3.78, COL - 6.5, 2.6, { name: 'limites' });
  s.addText('Les limites, assumées', { x: M + 6.8, y: 3.96, w: 5.4, h: 0.35, fontSize: 17,
    bold: true, color: BAD, isTextBox: true, margin: 0 });
  bullets(s, M + 6.8, 4.42, 5.4, 1.85, [
    'La moitié des entreprises reste sans email : le téléphone prend le relais',
    'Le secteur est déduit du nom par règles — rapide, mais faillible',
    'db.json ne tient pas la montée en charge au-delà de quelques milliers de fiches',
    'Les données sont une photo de Marrakech à une date, non rafraîchie'
  ], 12.5);
  s.addNotes("Les chiffres clés du projet. Ce qui fonctionne : la chaîne Python est reproductible, et les graphiques que je viens de montrer viennent du même calcul que l'application. Je tiens aussi à annoncer les limites moi-même : la moitié du fichier n'a pas d'email, le secteur est déduit par règles donc faillible, et la base fichier ne tiendra pas la montée en charge. Ce sont des choix adaptés à la taille du projet, pas des oublis.");
}

/* ==================================================================== 20 */
{
  const s = content('Conclusion', 'Perspectives d’amélioration',
    'Par ordre de valeur apportée');
  const items = [
    ['1', 'Intégrer de vraies offres de stage', 'Brancher les sites d’annonces marocains pour croiser les offres publiées avec la base d’entreprises, et distinguer candidature spontanée et réponse à une offre.'],
    ['2', 'Passer à PostgreSQL', 'db.json atteint sa limite. Une base relationnelle apporterait le multi-utilisateur réel, les transactions et la recherche plein texte.'],
    ['3', 'Classer le secteur par apprentissage', 'Remplacer les règles sur le nom par un modèle entraîné, et mesurer sa précision au lieu de la supposer.'],
    ['4', 'Rafraîchir les données', 'Une tâche planifiée qui relance la collecte Google Places et détecte les fermetures et les changements de contact.'],
    ['5', 'Mesurer ce qui marche', 'Suivre le taux de réponse par secteur et par modèle de message, puis réinjecter ce signal dans le score.']
  ];
  items.forEach(([n, t, b], i) => {
    const y = 1.92 + i * 0.95;
    card(s, M, y, COL, 0.82, { name: `persp-${n}` });
    s.addShape(pres.ShapeType.ellipse, { x: M + 0.24, y: y + 0.21, w: 0.4, h: 0.4,
      fill: { color: ACCENT }, line: { color: ACCENT }, objectName: `pdot-${n}` });
    s.addText(n, { x: M + 0.24, y: y + 0.21, w: 0.4, h: 0.4, fontSize: 13, bold: true,
      color: 'FFFFFF', align: 'center', valign: 'middle', margin: 0, isTextBox: true });
    s.addText(t, { x: M + 0.78, y: y + 0.08, w: 3.5, h: 0.66, fontSize: 14, bold: true, color: INK,
      isTextBox: true, margin: 0, valign: 'middle' });
    s.addText(b, { x: M + 4.4, y: y + 0.08, w: COL - 4.65, h: 0.66, fontSize: 12, color: MUTED,
      isTextBox: true, margin: 0, valign: 'middle', lineSpacingMultiple: 1.1 });
  });
  s.addNotes("Cinq pistes, classées par valeur. La première est la plus importante : brancher de vraies offres de stage pour croiser les annonces publiées avec ma base d'entreprises. La deuxième est technique et inévitable si le projet grandit. Et la cinquième est la plus intéressante sur le plan data : mesurer le taux de réponse réel et réinjecter ce signal dans le score, pour qu'il s'améliore avec l'usage au lieu de rester figé sur mes hypothèses de départ.");
}

/* ==================================================================== 21 */
{
  const s = pres.addSlide({ masterName: 'CLOSING', sectionTitle: 'Conclusion' });
  s.addText('Merci', { placeholder: 'title' });
  s.addText('Des questions ?', { x: M, y: 3.85, w: 6, h: 0.5, fontSize: 20, color: MUTED,
    isTextBox: true, margin: 0 });
  card(s, M, 4.75, 8.6, 1.35, { name: 'liens' });
  s.addText('Code source', { x: M + 0.3, y: 4.92, w: 2.4, h: 0.3, fontSize: 12.5, bold: true,
    color: ACCENT, isTextBox: true, margin: 0 });
  s.addText('github.com/slaym-13/Prospect-Suite', { x: M + 0.3, y: 5.24, w: 2.7, h: 0.3, fontSize: 10.5, color: MUTED,
    isTextBox: true, margin: 0 });
  s.addText('Plateforme en ligne', { x: M + 3.1, y: 4.92, w: 2.6, h: 0.3, fontSize: 12.5, bold: true,
    color: ACCENT, isTextBox: true, margin: 0 });
  s.addText('…', { x: M + 3.1, y: 5.24, w: 2.6, h: 0.3, fontSize: 12.5, color: MUTED,
    isTextBox: true, margin: 0 });
  s.addText('Démonstration', { x: M + 5.9, y: 4.92, w: 2.4, h: 0.3, fontSize: 12.5, bold: true,
    color: ACCENT, isTextBox: true, margin: 0 });
  s.addText('vidéo courte', { x: M + 5.9, y: 5.24, w: 2.4, h: 0.3, fontSize: 12.5, color: MUTED,
    isTextBox: true, margin: 0 });
  s.addNotes("Merci. Je suis prêt à détailler n'importe quelle partie : le nettoyage Python, la logique métier du backend, l'organisation du frontend ou l'intégration de Gemini.");
}

/* ------------------------------------------------------------------ write */
pres.writeFile({ fileName: OUT }).then(async () => {
  const { applyTheme } = require(path.join(__dirname, 'apply_theme.js'));
  await applyTheme(OUT, THEME);
  console.log('wrote', OUT);
});
