/**
 * rules.js: single source of truth for every game-rule number used by the sheet.
 *
 * Scope: World of Darkness 20th Anniversary Edition lines (V20, W20, M20, C20, Wr20)
 * plus the V20 supplement Hunters Hunted II for the Mortal / Hunter sheet.
 *
 * Each splat carries a `book` field. Page references are intentionally not invented:
 * add them to the entries you confirm against your own copies. Anything not yet
 * confirmed against a book is listed in UNVERIFIED at the bottom of this file.
 *
 * Text values are HTML-escaped strings because they are rendered into the guide drawer.
 */

export const SPLAT_RULES = {
  "mortal": {
    "book": "Vampire: The Masquerade 20th Anniversary Edition (V20) supplement: Hunters Hunted II",
    "creationTitle": "Creation Process (Hunters Hunted II)",
    "creation": [
      [
        "Attributes",
        "+6 / +4 / +3 priority dots",
        "Starts with 1 dot each (9 / 7 / 6 category totals; 22 total)"
      ],
      [
        "Abilities",
        "13 / 9 / 5 (max 3 before Freebies)"
      ],
      [
        "Backgrounds",
        "5"
      ],
      [
        "Virtues",
        "+7 dots",
        "Starts with 1 dot each (10 total across 3 Virtues)"
      ],
      [
        "Freebie Points",
        "21"
      ]
    ],
    "keyTraits": [
      [
        "Humanity",
        "Conscience + Self-Control"
      ],
      [
        "Willpower",
        "Equal to Courage rating"
      ],
      [
        "Numina / True Faith",
        "Purchased with Freebie Points (with ST approval)."
      ]
    ],
    "freebieTitle": "Freebie Point Costs (21 pts)",
    "freebie": [
      [
        "Attribute",
        "5 / dot"
      ],
      [
        "Ability",
        "2 / dot"
      ],
      [
        "Numina / True Faith",
        "7 / dot"
      ],
      [
        "Background",
        "1 / dot"
      ],
      [
        "Virtue",
        "2 / dot"
      ],
      [
        "Humanity / Willpower",
        "1 / dot"
      ],
      [
        "Merits / Flaws",
        "Rating (Flaws max +7)"
      ]
    ],
    "xp": [
      [
        "New Ability",
        "3"
      ],
      [
        "Attribute",
        "current &times; 4"
      ],
      [
        "Ability",
        "current &times; 2"
      ],
      [
        "Numina Path",
        "current &times; 7 (New: 7)"
      ],
      [
        "Virtue / Humanity",
        "current &times; 2"
      ],
      [
        "Willpower",
        "current"
      ]
    ],
    "xpNote": "Note: True Faith cannot be bought with XP.",
    "specialties": "Attributes and Abilities rated 4+ gain a Specialty."
  },
  "vampire": {
    "book": "Vampire: The Masquerade 20th Anniversary Edition (V20)",
    "creationTitle": "Creation Process (V20)",
    "creation": [
      [
        "Attributes",
        "+7 / +5 / +3 priority dots",
        "Starts with 1 dot each (10 / 8 / 6 category totals; 24 total)"
      ],
      [
        "Abilities",
        "13 / 9 / 5 (max 3 before Freebies)"
      ],
      [
        "Disciplines",
        "3"
      ],
      [
        "Backgrounds",
        "5"
      ],
      [
        "Virtues",
        "+7 dots",
        "Starts with 1 dot each (10 total across 3 Virtues)"
      ],
      [
        "Freebie Points",
        "15"
      ]
    ],
    "keyTraits": [
      [
        "Humanity / Path",
        "Conscience + Self-Control"
      ],
      [
        "Willpower",
        "Equal to Courage rating"
      ],
      [
        "Blood Pool",
        "13th Gen starts with Max 10, Spend 1/turn (adjusted by Generation Background)."
      ]
    ],
    "freebieTitle": "Freebie Point Costs (15 pts)",
    "freebie": [
      [
        "Attribute",
        "5 / dot"
      ],
      [
        "Ability",
        "2 / dot"
      ],
      [
        "Discipline",
        "7 / dot"
      ],
      [
        "Background",
        "1 / dot"
      ],
      [
        "Virtue",
        "2 / dot"
      ],
      [
        "Humanity / Path",
        "1 / dot"
      ],
      [
        "Willpower",
        "1 / dot"
      ],
      [
        "Merits / Flaws",
        "Rating (Flaws max +7)"
      ]
    ],
    "xp": [
      [
        "New Ability",
        "3"
      ],
      [
        "New Discipline / Path",
        "10 / 7"
      ],
      [
        "Attribute",
        "current &times; 4"
      ],
      [
        "Ability",
        "current &times; 2"
      ],
      [
        "Clan Discipline",
        "current &times; 5"
      ],
      [
        "Other Discipline",
        "current &times; 7"
      ],
      [
        "Secondary Path",
        "current &times; 4"
      ],
      [
        "Virtue / Humanity / Path",
        "current &times; 2"
      ],
      [
        "Willpower",
        "current"
      ]
    ],
    "specialties": "Attributes and Abilities rated 4+ gain a Specialty."
  },
  "werewolf": {
    "book": "Werewolf: The Apocalypse 20th Anniversary Edition (W20)",
    "creationTitle": "Creation Process (W20)",
    "creation": [
      [
        "Attributes",
        "+7 / +5 / +3 priority dots",
        "Starts with 1 dot each (10 / 8 / 6 category totals; 24 total)"
      ],
      [
        "Abilities",
        "13 / 9 / 5 (max 3 before Freebies)"
      ],
      [
        "Gifts",
        "3 (1 Breed, 1 Auspice, 1 Tribe)"
      ],
      [
        "Backgrounds",
        "5"
      ],
      [
        "Freebie Points",
        "15"
      ]
    ],
    "keyTraits": [
      [
        "Rage",
        "By Auspice (Ragabash 1 to Ahroun 5)"
      ],
      [
        "Gnosis",
        "By Breed (Homid 1, Metis 3, Lupus 5)"
      ],
      [
        "Willpower &amp; Renown",
        "Determined by Tribe &amp; Auspice."
      ]
    ],
    "freebieTitle": "Freebie Point Costs (15 pts)",
    "freebie": [
      [
        "Attribute",
        "5 / dot"
      ],
      [
        "Ability",
        "2 / dot"
      ],
      [
        "Gift (Level 1)",
        "7 / Gift"
      ],
      [
        "Background",
        "1 / dot"
      ],
      [
        "Rage",
        "1 / dot"
      ],
      [
        "Gnosis",
        "2 / dot"
      ],
      [
        "Willpower",
        "1 / dot"
      ],
      [
        "Merits / Flaws",
        "Rating (Flaws max +7)"
      ]
    ],
    "xp": [
      [
        "New Ability",
        "3"
      ],
      [
        "Attribute",
        "current &times; 4"
      ],
      [
        "Ability",
        "current &times; 2"
      ],
      [
        "In-Breed/Auspice/Tribe Gift",
        "level &times; 3"
      ],
      [
        "Outside Gift",
        "level &times; 5"
      ],
      [
        "Rage",
        "current"
      ],
      [
        "Gnosis",
        "current &times; 2"
      ],
      [
        "Willpower",
        "current"
      ]
    ],
    "specialties": "Attributes and Abilities rated 4+ gain a Specialty."
  },
  "mage": {
    "book": "Mage: The Ascension 20th Anniversary Edition (M20)",
    "creationTitle": "Creation Process (M20)",
    "creation": [
      [
        "Attributes",
        "+7 / +5 / +3 priority dots",
        "Starts with 1 dot each (10 / 8 / 6 category totals; 24 total)"
      ],
      [
        "Abilities",
        "13 / 9 / 5 (max 3 before Freebies)"
      ],
      [
        "Spheres",
        "6 (min 1 in Affinity Sphere)"
      ],
      [
        "Backgrounds",
        "7"
      ],
      [
        "Freebie Points",
        "15"
      ]
    ],
    "keyTraits": [
      [
        "Arete",
        "Starts at 1 (max 3 at creation; caps Spheres)"
      ],
      [
        "Willpower",
        "Starts at 5"
      ],
      [
        "Quintessence",
        "Starts equal to Avatar rating."
      ]
    ],
    "freebieTitle": "Freebie Point Costs (15 pts)",
    "freebie": [
      [
        "Attribute",
        "5 / dot"
      ],
      [
        "Ability",
        "2 / dot"
      ],
      [
        "Sphere",
        "7 / dot"
      ],
      [
        "Arete",
        "4 / dot (max 3)"
      ],
      [
        "Background",
        "1 / dot"
      ],
      [
        "Willpower",
        "1 / dot"
      ],
      [
        "Quintessence",
        "1 / 4 pts"
      ],
      [
        "Merits / Flaws",
        "Rating (Flaws max +7)"
      ]
    ],
    "xp": [
      [
        "New Ability",
        "3"
      ],
      [
        "New Sphere",
        "10"
      ],
      [
        "Attribute",
        "current &times; 4"
      ],
      [
        "Ability",
        "current &times; 2"
      ],
      [
        "Affinity Sphere",
        "current &times; 7"
      ],
      [
        "Other Sphere",
        "current &times; 8"
      ],
      [
        "Arete",
        "current &times; 8"
      ],
      [
        "Background (ST approval)",
        "current &times; 3"
      ],
      [
        "Willpower",
        "current"
      ]
    ],
    "specialties": "Attributes, Abilities, and Spheres rated 4+ gain a Specialty."
  },
  "changeling": {
    "book": "Changeling: The Dreaming 20th Anniversary Edition (C20)",
    "creationTitle": "Creation Process (C20)",
    "creation": [
      [
        "Attributes",
        "+7 / +5 / +3 priority dots",
        "Starts with 1 dot each (10 / 8 / 6 category totals; 24 total)"
      ],
      [
        "Abilities",
        "13 / 9 / 5 (max 3 before Freebies)"
      ],
      [
        "Arts",
        "3"
      ],
      [
        "Realms",
        "5"
      ],
      [
        "Backgrounds",
        "5"
      ],
      [
        "Freebie Points",
        "15"
      ]
    ],
    "keyTraits": [
      [
        "Base Pools",
        "Childling: G 5 / WP 3 / B 1. Wilder: G 4 / WP 4 / B 3. Grump: G 3 / WP 5 / B 5."
      ],
      [
        "Health",
        "Chimerical damage knocks unconscious; Real damage can kill."
      ]
    ],
    "freebieTitle": "Freebie Point Costs (15 pts)",
    "freebie": [
      [
        "Attribute",
        "5 / dot"
      ],
      [
        "Ability",
        "2 / dot"
      ],
      [
        "Art",
        "5 / dot"
      ],
      [
        "Realm",
        "2 / dot"
      ],
      [
        "Background",
        "1 / dot"
      ],
      [
        "Glamour",
        "3 / dot"
      ],
      [
        "Willpower",
        "2 / dot"
      ],
      [
        "Merits / Flaws",
        "Rating (Flaws max +7)"
      ]
    ],
    "xp": [
      [
        "New Ability",
        "3"
      ],
      [
        "New Art / New Realm",
        "7 / 5"
      ],
      [
        "Attribute",
        "current &times; 4"
      ],
      [
        "Ability",
        "current &times; 2"
      ],
      [
        "Art",
        "current &times; 4"
      ],
      [
        "Realm",
        "current &times; 3"
      ],
      [
        "Glamour",
        "current &times; 2"
      ],
      [
        "Willpower",
        "current &times; 2"
      ]
    ],
    "specialties": "Attributes and Abilities rated 4+ gain a Specialty."
  },
  "wraith": {
    "book": "Wraith: The Oblivion 20th Anniversary Edition (Wr20)",
    "creationTitle": "Creation Process (Wr20)",
    "creation": [
      [
        "Attributes",
        "+7 / +5 / +3 priority dots",
        "Starts with 1 dot each (10 / 8 / 6 category totals; 24 total)"
      ],
      [
        "Abilities",
        "13 / 9 / 5 (max 3 before Freebies)"
      ],
      [
        "Arcanoi",
        "5 (min 1 in Guild Arcanos)"
      ],
      [
        "Backgrounds",
        "7"
      ],
      [
        "Passions / Fetters",
        "10 / 10 (max 5 each)"
      ],
      [
        "Freebie Points",
        "15"
      ]
    ],
    "keyTraits": [
      [
        "Corpus",
        "10 (Permanent)"
      ],
      [
        "Willpower",
        "Starts at 5"
      ],
      [
        "Pathos",
        "Starts at 5 + Memoriam rating (max 10)."
      ]
    ],
    "freebieTitle": "Freebie Point Costs (15 pts)",
    "freebie": [
      [
        "Attribute",
        "5 / dot"
      ],
      [
        "Ability",
        "2 / dot"
      ],
      [
        "Arcanos",
        "5 / dot"
      ],
      [
        "Background",
        "1 / dot"
      ],
      [
        "Passion",
        "2 / dot"
      ],
      [
        "Fetter / Pathos / Willpower",
        "1 / dot"
      ],
      [
        "Merits / Flaws",
        "Rating (Flaws max +7)"
      ]
    ],
    "xp": [
      [
        "New Ability",
        "3"
      ],
      [
        "New Arcanos (Guild)",
        "7 (5)"
      ],
      [
        "New Passion / Fetter / Background",
        "Special (Storyteller approval)"
      ],
      [
        "Attribute",
        "current &times; 4"
      ],
      [
        "Ability",
        "current &times; 2"
      ],
      [
        "Arcanos",
        "current &times; 3"
      ],
      [
        "Passion / Fetter / Background",
        "Special (Storyteller approval)"
      ],
      [
        "Pathos",
        "current &times; 2"
      ],
      [
        "Willpower",
        "current"
      ]
    ],
    "specialties": "Attributes and Abilities rated 4+ gain a Specialty."
  }
};

/** Werewolf form attribute modifiers (quoted from the W20 form tables by the maintainer). */
export const WEREWOLF_FORMS = {
  homid: {
    label: 'Homid',
    str: 0, dex: 0, sta: 0, man: 0, app: 0,
    summary: 'Base Form · No attribute modifiers'
  },
  glabro: {
    label: 'Glabro',
    str: 2, dex: 0, sta: 2, man: -2, app: -1,
    summary: 'Str +2 · Sta +2 · Man -2 · App -1'
  },
  crinos: {
    label: 'Crinos',
    str: 4, dex: 1, sta: 3, man: 'zero', app: 'zero',
    summary: 'Str +4 · Dex +1 · Sta +3 · Man 0 · App 0 · Claws Str+2 Agg / Bite Str+1 Agg'
  },
  hispo: {
    label: 'Hispo',
    str: 3, dex: 2, sta: 3, man: 'zero', app: 0,
    summary: 'Str +3 · Dex +2 · Sta +3 · Man 0 · Bite Str+2 Agg / Claws Str+1 Agg'
  },
  lupus: {
    label: 'Lupus',
    str: 1, dex: 2, sta: 2, man: 'zero', app: 0,
    summary: 'Str +1 · Dex +2 · Sta +2 · Man 0 · Bite Str+1 Agg'
  }
};

/** Health track wound levels (Bruised → Incapacitated). Used by the sheet badge and the dice roller. */
export const WOUND_LEVELS = [
  { penalty: 0,   label: 'Healthy (0)',    short: '0',     incapacitated: false },
  { penalty: -1,  label: 'Hurt (-1)',      short: '-1',    incapacitated: false },
  { penalty: -1,  label: 'Injured (-1)',   short: '-1',    incapacitated: false },
  { penalty: -2,  label: 'Wounded (-2)',   short: '-2',    incapacitated: false },
  { penalty: -2,  label: 'Mauled (-2)',    short: '-2',    incapacitated: false },
  { penalty: -5,  label: 'Crippled (-5)',  short: '-5',    incapacitated: false },
  { penalty: -99, label: 'Incapacitated',  short: 'Incap', incapacitated: true }
];

/** Sheet badge text and CSS class per wound level index. */
export const HEALTH_PENALTIES = [
  { label: 'Healthy (0)', cls: '' },
  { label: '-1 Penalty', cls: 'penalty-low' },
  { label: '-1 Penalty', cls: 'penalty-low' },
  { label: '-2 Penalty', cls: 'penalty-low' },
  { label: '-2 Penalty', cls: 'penalty-low' },
  { label: '-5 Penalty', cls: 'penalty-high' },
  { label: 'Incapacitated', cls: 'penalty-high' }
];

/** V20 Blood Pool by Generation: maximum pool and blood spendable per turn. */
export const VAMPIRE_GENERATION = {
  15: { max: 10, perTurn: '1/turn' },
  14: { max: 10, perTurn: '1/turn' },
  13: { max: 10, perTurn: '1/turn' },
  12: { max: 11, perTurn: '1/turn' },
  11: { max: 12, perTurn: '1/turn' },
  10: { max: 13, perTurn: '1/turn' },
  9:  { max: 14, perTurn: '2/turn' },
  8:  { max: 15, perTurn: '3/turn' },
  7:  { max: 20, perTurn: '4/turn' },
  6:  { max: 30, perTurn: '6/turn' },
  5:  { max: 40, perTurn: '8/turn' },
  4:  { max: 50, perTurn: '10/turn' }
};

/** Storyteller system constants. */
export const DICE_RULES = {
  maxPool: 50,
  minDifficulty: 2,
  maxDifficulty: 10,
  defaultDifficulty: 6,
  specialtyTenCountsAs: 2,
  willpowerAutoSuccesses: 1,
  tiers: ['', 'Marginal', 'Moderate', 'Complete', 'Exceptional', 'Phenomenal'],
  /** Initiative = 1d10 + Dexterity + Wits (wound penalty optional, default on). */
  initiative: { die: 10 }
};

/**
 * Wraith Catharsis: the Shadow may attempt a Catharsis roll when temporary Angst
 * EXCEEDS permanent Willpower (strictly greater than).
 */
export const WRAITH_CATHARSIS = { comparison: 'exceeds' };

/**
 * Values checked only against secondary sources. Confirm in the books, then delete the entry.
 */
export const UNVERIFIED = [
  'wraith.xp Pathos x2: not yet confirmed against Wr20'
];

/**
 * Starting dots at character creation, used by the passive creation counter in the guide
 * drawer. Nothing is blocked: dots above these numbers are shown as "over" (paid with
 * Freebie Points or XP). Attribute numbers are the priority dots added on top of the free
 * first dot; the player chooses which category gets which priority. Virtues include the
 * free first dot in each (3 + 7 = 10). `cost` is the Freebie cost per dot above the limit
 * (from SPLAT_RULES[...].freebie). `rowName` splits one table by row name (Wraith Passions
 * and Fetters share a table: rows named "Fetter…" count as Fetters, the rest as Passions).
 */
export const CREATION_LIMITS = {
  mortal: { attributes: [6, 4, 3], abilities: [13, 9, 5], attrCost: 5, abilCost: 2, freebies: 21, traits: [
    { label: 'Numina / Faith', prefixes: ['mortal_adv_0_'], limit: 0, cost: 7 },
    { label: 'Backgrounds', prefixes: ['mortal_adv_1_'], limit: 5, cost: 1 },
    { label: 'Virtues', prefixes: ['mortal_adv_2_'], limit: 10, cost: 2 }
  ] },
  vampire: { attributes: [7, 5, 3], abilities: [13, 9, 5], attrCost: 5, abilCost: 2, freebies: 15, traits: [
    { label: 'Disciplines', prefixes: ['vampire_adv_0_'], limit: 3, cost: 7 },
    { label: 'Backgrounds', prefixes: ['vampire_adv_1_'], limit: 5, cost: 1 },
    { label: 'Virtues', prefixes: ['vampire_adv_2_'], limit: 10, cost: 2 }
  ] },
  werewolf: { attributes: [7, 5, 3], abilities: [13, 9, 5], attrCost: 5, abilCost: 2, freebies: 15, traits: [
    { label: 'Backgrounds', prefixes: ['werewolf_adv_0_'], limit: 5, cost: 1 },
    { label: 'Gifts', prefixes: ['werewolf_adv_1_', 'werewolf_adv_2_'], limit: 3, cost: 7 }
  ] },
  mage: { attributes: [7, 5, 3], abilities: [13, 9, 5], attrCost: 5, abilCost: 2, freebies: 15, traits: [
    { label: 'Spheres', prefixes: ['mage_adv_0_'], limit: 6, cost: 7 },
    { label: 'Backgrounds', prefixes: ['mage_adv_1_'], limit: 7, cost: 1 },
    { label: 'Arete', ids: ['mage_arete_dots'], limit: 1, cost: 4 }
  ] },
  changeling: { attributes: [7, 5, 3], abilities: [13, 9, 5], attrCost: 5, abilCost: 2, freebies: 15, traits: [
    { label: 'Backgrounds', prefixes: ['changeling_adv_0_'], limit: 5, cost: 1 },
    { label: 'Arts', prefixes: ['changeling_adv_1_'], limit: 3, cost: 5 },
    { label: 'Realms', prefixes: ['changeling_adv_2_'], limit: 5, cost: 2 }
  ] },
  wraith: { attributes: [7, 5, 3], abilities: [13, 9, 5], attrCost: 5, abilCost: 2, freebies: 15, traits: [
    { label: 'Backgrounds', prefixes: ['wraith_adv_0_'], limit: 7, cost: 1 },
    { label: 'Arcanoi', prefixes: ['wraith_adv_1_'], limit: 5, cost: 5 },
    { label: 'Passions', prefixes: ['wraith_adv_2_'], limit: 10, cost: 2, rowName: name => !/^\s*fetter/i.test(name) },
    { label: 'Fetters', prefixes: ['wraith_adv_2_'], limit: 10, cost: 1, rowName: name => /^\s*fetter/i.test(name) }
  ] }
};

/**
 * Starting value of each pool, for the Freebie estimate. A function of the sheet's dots,
 * or null when it depends on a choice the sheet can't read (Breed, Auspice, Tribe, Seeming).
 */
export const POOL_BASES = {
  mortal: [
    { label: 'Humanity', id: 'mortal_humanity_dots', cost: 1, base: d => d('mortal_adv_2_conscience') + d('mortal_adv_2_self-control') },
    { label: 'Willpower', id: 'mortal_wp_dots', cost: 1, base: d => d('mortal_adv_2_courage') }
  ],
  vampire: [
    { label: 'Humanity / Path', id: 'vampire_path_dots', cost: 1, base: d => d('vampire_adv_2_conscience_/_conviction') + d('vampire_adv_2_self-control_/_instinct') },
    { label: 'Willpower', id: 'vampire_wp_dots', cost: 1, base: d => d('vampire_adv_2_courage') }
  ],
  werewolf: [
    { label: 'Rage', id: 'werewolf_rage_dots', cost: 1, base: null },
    { label: 'Gnosis', id: 'werewolf_gnosis_dots', cost: 2, base: null },
    { label: 'Willpower', id: 'werewolf_wp_dots', cost: 1, base: null }
  ],
  mage: [
    { label: 'Willpower', id: 'mage_wp_dots', cost: 1, base: () => 5 }
  ],
  changeling: [
    { label: 'Glamour', id: 'changeling_glamour_dots', cost: 3, base: null },
    { label: 'Willpower', id: 'changeling_wp_dots', cost: 2, base: null }
  ],
  wraith: [
    { label: 'Willpower', id: 'wraith_wp_dots', cost: 1, base: () => 5 }
  ]
};

/**
 * XP cost of raising a trait past creation, for the "XP beyond creation" estimate in the
 * guide drawer. Same numbers as SPLAT_RULES[...].xp. `mult` is the multiplier on the current
 * rating; `new` is the price of the first dot; `perItem` prices a whole Gift by its level.
 * `xp: null` means the line sets no XP price (Storyteller's call). Where the sheet can't
 * tell which rate applies, the cheaper one is used and named in `assumed`.
 * `baseEach` is a free dot every trait in the group starts with (Virtues).
 */
export const XP_ESTIMATE = {
  mortal: {
    attr: { mult: 4 }, abil: { new: 3, mult: 2 },
    traits: {
      'Numina / Faith': { new: 7, mult: 7 },
      'Backgrounds': { xp: null },
      'Virtues': { mult: 2, baseEach: 1 }
    },
    pools: { 'Humanity': { mult: 2 }, 'Willpower': { mult: 1 } },
    assumed: []
  },
  vampire: {
    attr: { mult: 4 }, abil: { new: 3, mult: 2 },
    traits: {
      'Disciplines': { new: 10, mult: 5 },
      'Backgrounds': { xp: null },
      'Virtues': { mult: 2, baseEach: 1 }
    },
    pools: { 'Humanity / Path': { mult: 2 }, 'Willpower': { mult: 1 } },
    assumed: ['every Discipline priced as a Clan Discipline (×5)']
  },
  werewolf: {
    attr: { mult: 4 }, abil: { new: 3, mult: 2 },
    traits: {
      'Backgrounds': { xp: null },
      'Gifts': { perItem: 3, startLevel: 1 }
    },
    pools: {},
    assumed: ['every Gift priced as in-Breed/Auspice/Tribe (level ×3)']
  },
  mage: {
    attr: { mult: 4 }, abil: { new: 3, mult: 2 },
    traits: {
      'Spheres': { new: 10, mult: 7 },
      'Backgrounds': { mult: 3, approval: true },
      'Arete': { mult: 8 }
    },
    pools: { 'Willpower': { mult: 1 } },
    assumed: ['every Sphere priced as the Affinity Sphere (×7)']
  },
  changeling: {
    attr: { mult: 4 }, abil: { new: 3, mult: 2 },
    traits: {
      'Backgrounds': { xp: null },
      'Arts': { new: 7, mult: 4 },
      'Realms': { new: 5, mult: 3 }
    },
    pools: {},
    assumed: []
  },
  wraith: {
    attr: { mult: 4 }, abil: { new: 3, mult: 2 },
    traits: {
      'Backgrounds': { xp: null },
      'Arcanoi': { new: 7, mult: 3 },
      'Passions': { xp: null },
      'Fetters': { xp: null }
    },
    pools: { 'Willpower': { mult: 1 } },
    assumed: []
  }
};
