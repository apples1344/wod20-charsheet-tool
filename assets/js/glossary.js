// Plain-language help for new players. Everything here is this project's own wording:
// short, general explanations written for this tool, not text from the books.
// Pure data + lookups (no DOM), so it can be unit-tested.

/**
 * Glossary terms.
 *  group: where the term is listed in the Guide's Glossary tab
 *  lines: game lines the term belongs to (omit = every line)
 *  match: section headings / labels on the sheet that get a "?" for this term
 */
export const TERMS = [
  // ---- building a character ----
  { id: 'gameline', group: 'build', term: 'Game line', text: 'What kind of character you play: a mortal, vampire, werewolf, mage, changeling or wraith. Each line has its own powers and pools; the dice work the same in all of them.' },
  { id: 'concept', group: 'build', term: 'Concept', match: ['Concept'], text: 'A few words that sum the character up, like "burned-out paramedic" or "bookish occultist". Everything else builds on it.' },
  { id: 'nature', group: 'build', term: 'Nature', match: ['Nature'], text: 'Who the character really is underneath. Many tables let you regain Willpower when you act on it; ask your Storyteller.' },
  { id: 'demeanor', group: 'build', term: 'Demeanor', match: ['Demeanor'], text: 'The face the character shows other people. It can match the Nature or hide it.' },
  { id: 'attributes', group: 'build', term: 'Attributes', match: ['Attributes'], text: 'Natural capability, in three groups: Physical, Social and Mental. Everyone starts with 1 dot in each. 2 is average for a person, 5 is the human peak.' },
  { id: 'abilities', group: 'build', term: 'Abilities', match: ['Abilities'], text: 'What the character has learned. Talents come from instinct and experience, Skills from practice, Knowledges from study. 0 dots means untrained.' },
  { id: 'priorities', group: 'build', term: 'Priorities', text: 'At creation you rank the three Attribute groups (and the three Ability groups) yourself. Your first choice gets the most dots. The order is up to you, not fixed.' },
  { id: 'advantages', group: 'build', term: 'Advantages', match: ['Advantages'], text: 'What sets the character apart: their powers, Backgrounds and Virtues. How many dots you get for each is fixed by the game line; the Guide shows them.' },
  { id: 'backgrounds', group: 'build', term: 'Backgrounds', match: ['Backgrounds'], text: 'What the character has rather than what they are: contacts, money, allies, a mentor, a safe place to stay. The Storyteller decides what each dot means in the story.' },
  { id: 'virtues', group: 'build', term: 'Virtues', match: ['Virtues'], text: 'The character’s moral core. They are rolled when fear, temptation or a terrible act tests the character, and they set some starting traits; the Guide shows which.' },
  { id: 'merits', group: 'build', term: 'Merits', match: ['Merits'], text: 'Optional perks bought with Freebie Points, like a sharp memory or good luck. Ask your Storyteller which ones the game allows.' },
  { id: 'flaws', group: 'build', term: 'Flaws', match: ['Flaws'], text: 'Optional drawbacks that give you extra Freebie Points (7 at most). Pick ones you would enjoy playing, because the Storyteller will use them.' },
  { id: 'freebies', group: 'build', term: 'Freebie Points', text: 'A final pool of points (usually 15) spent after the starting dots, on anything you like. Traits cost different amounts; the Guide counts it for you.' },
  { id: 'specialty', group: 'build', term: 'Specialty', text: 'A narrow focus within a trait, like Firearms (Pistols). Usually taken once a trait reaches 4 dots. When it applies, each 10 you roll counts as two successes.' },
  { id: 'experience', group: 'build', term: 'Experience (XP)', match: ['Experience'], text: 'Points the Storyteller hands out after sessions. You spend them between stories to raise traits; higher ratings cost more.' },
  { id: 'approval', group: 'build', term: 'Storyteller approval', text: 'Some traits can only be raised with the Storyteller’s okay, usually because the story has to explain the change.' },

  // ---- playing ----
  { id: 'storyteller', group: 'play', term: 'Storyteller', text: 'The person running the game. The numbers on this sheet are a guide; the Storyteller has the final say.' },
  { id: 'pool', group: 'play', term: 'Dice pool', text: 'How many ten-sided dice you roll: usually an Attribute plus an Ability, such as Dexterity + Firearms. Click traits on the sheet to build one.' },
  { id: 'difficulty', group: 'play', term: 'Difficulty', text: 'The number each die has to reach to count, from 2 to 10. 6 is normal; the Storyteller raises it for hard tasks.' },
  { id: 'successes', group: 'play', term: 'Successes', text: 'Every die at or above the difficulty is a success, and each 1 rolled takes one away. One success is enough to manage; more means a better result.' },
  { id: 'botch', group: 'play', term: 'Botch', text: 'No successes and at least one 1 showing. Instead of simply failing, something goes wrong.' },
  { id: 'willpower', group: 'play', term: 'Willpower', match: ['Willpower', 'Psyche Willpower'], text: 'The character’s grit. Spend a point before a roll for one automatic success, or to hold out against fear or temptation. Points come back over time; the dots rarely change.' },
  { id: 'health', group: 'play', term: 'Health', match: ['Health'], text: 'Seven levels from Bruised to Incapacitated. Each box you mark lowers your dice pools by the number shown beside it.' },
  { id: 'wound', group: 'play', term: 'Wound penalty', text: 'Dice taken off every pool while the character is hurt. The dice roller here takes them off for you.' },
  { id: 'initiative', group: 'play', term: 'Initiative', text: 'Who acts first in a fight: one die plus Dexterity plus Wits. Highest goes first.' },
  { id: 'humanity', group: 'play', term: 'Humanity / Path', match: ['Humanity / Path', 'Humanity'], text: 'How close the character stays to their conscience. Doing terrible things can lower it, and a low rating changes how they act.' },
  { id: 'faith', group: 'play', lines: ['mortal'], term: 'Faith', match: ['Faith'], text: 'Belief strong enough to matter against the supernatural. Most mortals have none; the Storyteller decides who does.' },

  // ---- game-line terms ----
  { id: 'disciplines', group: 'line', lines: ['vampire'], term: 'Disciplines', match: ['Disciplines'], text: 'A vampire’s powers, from great strength to bending minds. Your clan decides which three come most easily.' },
  { id: 'bloodpool', group: 'line', lines: ['vampire'], term: 'Blood Pool', match: ['Blood Pool'], text: 'The blood a vampire carries. Spent to heal, to wake each night and to fuel some powers. Generation limits how much can be spent each turn.' },
  { id: 'generation', group: 'line', lines: ['vampire'], term: 'Generation', match: ['Generation'], text: 'How many steps a vampire is from the first of their kind. Lower generations are stronger and hold more blood.' },
  { id: 'gifts', group: 'line', lines: ['werewolf'], term: 'Gifts', match: ['Gifts'], text: 'A werewolf’s powers, taught by spirits. Starting Gifts come from your breed, auspice and tribe.' },
  { id: 'rage', group: 'line', lines: ['werewolf'], term: 'Rage', match: ['Rage'], text: 'A werewolf’s fury. Spending it buys extra actions, but too much of it risks losing control.' },
  { id: 'gnosis', group: 'line', lines: ['werewolf'], term: 'Gnosis', match: ['Gnosis'], text: 'A werewolf’s bond with the spirit world. Used to cross into it and to power many Gifts.' },
  { id: 'renown', group: 'line', lines: ['werewolf'], term: 'Renown', match: ['Renown'], text: 'How other werewolves see the character: Glory, Honor and Wisdom. Earning enough raises their Rank.' },
  { id: 'spheres', group: 'line', lines: ['mage'], term: 'Spheres', match: ['Spheres'], text: 'The nine parts of reality a mage can work with, from Forces to Time. No Sphere can be higher than Arete.' },
  { id: 'arete', group: 'line', lines: ['mage'], term: 'Arete', match: ['Arete'], text: 'A mage’s enlightenment: the dice rolled for magic, and the highest any Sphere can go.' },
  { id: 'arts', group: 'line', lines: ['changeling'], term: 'Arts', match: ['Arts'], text: 'A changeling’s fae magic. Each Art is paired with a Realm that says what it can affect.' },
  { id: 'realms', group: 'line', lines: ['changeling'], term: 'Realms', match: ['Realms'], text: 'What fae magic can touch: people (Actor), the fae, nature, objects (Prop), a whole place (Scene) and time.' },
  { id: 'glamour', group: 'line', lines: ['changeling'], term: 'Glamour', match: ['Glamour'], text: 'Dream energy that fuels a changeling’s Arts and keeps their fae self alive.' },
  { id: 'banality', group: 'line', lines: ['changeling'], term: 'Banality', match: ['Banality'], text: 'Disbelief and dull routine. It blunts fae magic and slowly wears away a changeling’s fae self.' },
  { id: 'arcanoi', group: 'line', lines: ['wraith'], term: 'Arcanoi', match: ['Arcanoi'], text: 'A wraith’s ghostly powers, such as moving objects or speaking to the living.' },
  { id: 'passions', group: 'line', lines: ['wraith'], term: 'Passions & Fetters', match: ['Passions & Fetters'], text: 'What ties a wraith to the living world: the feelings they still hold, and the people, places or things they cannot let go of.' },
  { id: 'corpus', group: 'line', lines: ['wraith'], term: 'Corpus', match: ['Corpus'], text: 'A wraith’s ghostly body. Damage comes off Corpus instead of Health.' },
  { id: 'pathos', group: 'line', lines: ['wraith'], term: 'Pathos', match: ['Pathos'], text: 'Emotional energy a wraith gathers from the living. It fuels Arcanoi.' },
  { id: 'angst', group: 'line', lines: ['wraith'], term: 'Angst', match: ['Angst'], text: 'The strength of the Shadow, the dark side of a wraith’s own mind that wants them destroyed.' }
];

export const TERM_GROUPS = [
  ['build', 'Building a character'],
  ['play', 'Playing'],
  ['line', 'This game line']
];

const norm = (s) => String(s || '').toLowerCase().replace(/[\s_\-]+/g, ' ').replace(/[: ]/g, '').trim();

/** The term whose heading or label `text` starts with (longest match wins), for `splat`. */
export function termForHeading(text, splat) {
  const t = norm(text);
  if (!t) return null;
  let best = null;
  let bestLen = 0;
  for (const term of TERMS) {
    if (!term.match) continue;
    if (term.lines && splat && !term.lines.includes(splat)) continue;
    for (const m of term.match) {
      const n = norm(m);
      if (n.length > bestLen && (t === n || t.startsWith(n + ' ') || t.startsWith(n))) {
        // a heading must start with the whole word: "Arts" may not match "Artsy"
        const next = t.charAt(n.length);
        if (next && /[a-z]/.test(next)) continue;
        best = term;
        bestLen = n.length;
      }
    }
  }
  return best;
}

export function termById(id) {
  return TERMS.find(t => t.id === id) || null;
}

/** Terms for the Glossary tab: every general term plus the ones for this game line. */
export function termsForLine(splat) {
  return TERMS.filter(t => !t.lines || t.lines.includes(splat));
}

/**
 * One-line hints for traits, keyed by the label as shown (normalised).
 * "line:key" entries win over plain ones where a word means something else in that line.
 */
export const TRAIT_HINTS = {
  // Attributes
  'strength': 'Raw muscle: lifting, shoving, hitting hard. Adds to damage you deal with bare hands or weapons.',
  'dexterity': 'Speed and coordination: dodging, shooting, sleight of hand, keeping your balance.',
  'stamina': 'Toughness and endurance: shrugging off injury, poison, cold and long nights.',
  'charisma': 'Natural charm that makes people like and follow you.',
  'manipulation': 'Getting people to do what you want, honestly or otherwise.',
  'appearance': 'How striking you look, and how much that shapes first impressions.',
  'perception': 'Noticing details: a clue, a lie in someone’s face, a sound in the dark.',
  'intelligence': 'Reasoning and memory: working things out and knowing facts.',
  'wits': 'Thinking on your feet: quick reactions, comebacks, and spotting an ambush in time.',

  // Abilities shared across lines
  'alertness': 'Staying aware of your surroundings without trying, like noticing you’re being followed.',
  'athletics': 'Running, climbing, jumping, swimming and throwing.',
  'awareness': 'Sensing the supernatural: a presence in the room, magic at work.',
  'brawl': 'Fighting with fists, feet, claws and grapples.',
  'empathy': 'Reading people’s feelings and understanding what they need.',
  'expression': 'Getting ideas across: writing, speeches, poetry, art.',
  'intimidation': 'Making people back down, by threat or by sheer presence.',
  'leadership': 'Getting people to follow you, especially under pressure.',
  'streetwise': 'Knowing how the street works: rumours, the black market, who to ask.',
  'subterfuge': 'Lying well and spotting other people’s lies.',
  'animal ken': 'Calming, training and reading animals.',
  'crafts': 'Making and repairing things by hand: carpentry, mechanics, sewing.',
  'drive': 'Handling a vehicle at speed or in a chase.',
  'etiquette': 'Fitting in: manners and customs, from a gala to a gang.',
  'firearms': 'Shooting guns, and looking after them.',
  'larceny': 'Locks, pockets, alarms, forgery: taking what isn’t yours.',
  'melee': 'Fighting with hand weapons: knives, clubs, swords.',
  'performance': 'Acting, singing or playing for an audience.',
  'stealth': 'Moving unseen and unheard; hiding.',
  'survival': 'Living off the land: tracking, shelter, finding water.',
  'technology': 'Electronics and machines: building, fixing, bypassing.',
  'academics': 'Book learning: history, literature, languages, philosophy.',
  'computer': 'Using, programming and breaking into computers.',
  'finance': 'Money: markets, accounts, and following where cash goes.',
  'investigation': 'Searching scenes, finding clues and piecing them together.',
  'law': 'Legal systems, police procedure and how to work them.',
  'medicine': 'First aid, diagnosis and treatment.',
  'occult': 'Folklore and hidden lore: rituals, curses, the supernatural.',
  'politics': 'Who holds power and how to deal with them.',
  'science': 'Chemistry, physics, biology and the other hard sciences.',
  'enigmas': 'Solving puzzles and riddles, and making sense of strange things.',
  'meditation': 'Calming and focusing the mind, even in danger.',
  'bureaucracy': 'Paperwork, rules and red tape, and getting things through them.',
  'persuasion': 'Changing someone’s mind with argument and appeal.',

  // Line-specific Abilities
  'primal urge': 'A werewolf’s connection to its wolf instincts; it helps with changing shape.',
  'rituals': 'Knowing and leading werewolf rites and ceremonies.',
  'art': 'Creating art (painting, music, sculpture) with real skill.',
  'martial arts': 'Trained unarmed fighting styles.',
  'cosmology': 'Knowledge of the spirit worlds and what lies beyond.',
  'esoterica': 'Obscure specialist lore, chosen when you take it.',
  'research': 'Finding information in books, archives and databases.',
  'kenning': 'Sensing Glamour and the fae nature of things and people.',
  'gremayre': 'Fae lore: the history, customs and creatures of the Dreaming.',

  // Virtues
  'conscience': 'Knowing right from wrong, and feeling it when you cross the line.',
  'conscience / conviction': 'Knowing right from wrong (Conscience), or holding to a code of your own (Conviction).',
  'self control': 'Keeping your temper and resisting temptation.',
  'self control / instinct': 'Keeping your temper (Self-Control), or riding the Beast instead of fighting it (Instinct).',
  'courage': 'Facing danger and fear without running.',

  // Werewolf Renown
  'glory': 'Renown for bravery and great deeds.',
  'honor': 'Renown for keeping your word and treating others fairly.',
  'wisdom': 'Renown for good judgment and spiritual insight.',

  // Mage Spheres
  'mage:correspondence': 'Space and distance: seeing far away, stepping across a room or a city.',
  'mage:entropy': 'Chance, decay and fate: luck, rot and things falling apart.',
  'mage:forces': 'Energy: fire, light, electricity, motion.',
  'mage:life': 'Living bodies: healing, harming, changing flesh.',
  'mage:matter': 'Non-living things: shaping and changing objects and materials.',
  'mage:mind': 'Thoughts: reading, guarding and influencing minds.',
  'mage:prime': 'The raw stuff of magic itself, and Quintessence.',
  'mage:spirit': 'The spirit world and the beings in it.',
  'mage:time': 'Seeing into the past or future, and bending how time flows.',

  // Changeling Realms
  'changeling:actor': 'Realm for affecting people.',
  'changeling:fae': 'Realm for affecting changelings and other fae beings.',
  'changeling:nature': 'Realm for affecting animals, plants and natural things.',
  'changeling:prop': 'Realm for affecting crafted objects.',
  'changeling:scene': 'Realm for affecting a whole place at once.',
  'changeling:time': 'Realm for timing an effect: delaying it or making it last.'
};

/** Hint for a trait label on the given game line, or '' when there isn't one. */
export function traitHintFor(label, splat) {
  const key = norm(label);
  if (!key) return '';
  return TRAIT_HINTS[`${splat}:${key}`] || TRAIT_HINTS[key] || '';
}

export const __test = { norm };
