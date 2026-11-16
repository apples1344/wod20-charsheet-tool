// Quick Start: a fast, rough way to fill a new sheet. Pick a role and a style; the sheet
// places every Attribute and Ability priority dot, sets Virtues and the starting pools where
// they are fixed, and leaves the choices that make a character yours (powers, Backgrounds,
// Freebie Points, name and story) to the player.
// The roles are this project's own generic types, not archetypes or text from the books.
// Pure: no DOM access, so it can be unit-tested.
import { CREATION_LIMITS } from './rules.js';

const norm = (s) => String(s).toLowerCase().replace(/[^a-z]/g, '');

/** Each role: Attribute categories by priority, Attributes within each, Ability columns by
 *  priority (0 Talents, 1 Skills, 2 Knowledges), Abilities in order of preference (names are
 *  matched on every game line; ones a line doesn't have are skipped), and Virtue order. */
export const QUICK_ROLES = [
  { key: 'bruiser', label: 'Bruiser', blurb: 'Hits hard and takes a hit.',
    attr: ['physical', 'social', 'mental'], attrOrder: { physical: ['str', 'sta', 'dex'], social: ['cha', 'man', 'app'], mental: ['wit', 'per', 'int'] },
    abil: [0, 1, 2], picks: ['brawl', 'athletics', 'intimidation', 'alertness', 'primalurge', 'streetwise', 'melee', 'martialarts', 'drive', 'firearms', 'medicine', 'investigation', 'law'],
    virtues: ['courage', 'selfcontrol', 'conscience'] },
  { key: 'face', label: 'Face', blurb: 'Talks, charms and lies for a living.',
    attr: ['social', 'mental', 'physical'], attrOrder: { social: ['man', 'cha', 'app'], mental: ['wit', 'per', 'int'], physical: ['dex', 'sta', 'str'] },
    abil: [0, 1, 2], picks: ['subterfuge', 'empathy', 'persuasion', 'expression', 'leadership', 'kenning', 'etiquette', 'performance', 'drive', 'politics', 'finance', 'law', 'bureaucracy'],
    virtues: ['selfcontrol', 'conscience', 'courage'] },
  { key: 'sneak', label: 'Sneak', blurb: 'Gets in and out unseen.',
    attr: ['physical', 'mental', 'social'], attrOrder: { physical: ['dex', 'sta', 'str'], mental: ['wit', 'per', 'int'], social: ['man', 'app', 'cha'] },
    abil: [1, 0, 2], picks: ['stealth', 'larceny', 'alertness', 'athletics', 'subterfuge', 'streetwise', 'drive', 'firearms', 'technology', 'computer', 'investigation', 'law'],
    virtues: ['selfcontrol', 'courage', 'conscience'] },
  { key: 'scholar', label: 'Scholar', blurb: 'Knows things; reads everything.',
    attr: ['mental', 'social', 'physical'], attrOrder: { mental: ['int', 'wit', 'per'], social: ['cha', 'man', 'app'], physical: ['sta', 'dex', 'str'] },
    abil: [2, 0, 1], picks: ['academics', 'occult', 'investigation', 'science', 'enigmas', 'cosmology', 'esoterica', 'gremayre', 'rituals', 'bureaucracy', 'law', 'awareness', 'empathy', 'expression', 'research', 'meditation', 'etiquette', 'crafts'],
    virtues: ['conscience', 'selfcontrol', 'courage'] },
  { key: 'investigator', label: 'Investigator', blurb: 'Notices, asks, follows the trail.',
    attr: ['mental', 'physical', 'social'], attrOrder: { mental: ['per', 'wit', 'int'], physical: ['dex', 'sta', 'str'], social: ['man', 'cha', 'app'] },
    abil: [2, 0, 1], picks: ['investigation', 'computer', 'law', 'medicine', 'alertness', 'streetwise', 'empathy', 'research', 'firearms', 'drive', 'stealth'],
    virtues: ['conscience', 'courage', 'selfcontrol'] },
  { key: 'survivor', label: 'Survivor', blurb: 'Tough, wary, lives off the land.',
    attr: ['physical', 'mental', 'social'], attrOrder: { physical: ['sta', 'dex', 'str'], mental: ['per', 'wit', 'int'], social: ['cha', 'man', 'app'] },
    abil: [1, 0, 2], picks: ['survival', 'animalken', 'stealth', 'melee', 'alertness', 'athletics', 'awareness', 'primalurge', 'brawl', 'medicine', 'occult', 'enigmas'],
    virtues: ['courage', 'selfcontrol', 'conscience'] },
  { key: 'soldier', label: 'Soldier', blurb: 'Trained, armed and disciplined.',
    attr: ['physical', 'mental', 'social'], attrOrder: { physical: ['dex', 'sta', 'str'], mental: ['wit', 'per', 'int'], social: ['man', 'cha', 'app'] },
    abil: [1, 0, 2], picks: ['firearms', 'melee', 'martialarts', 'drive', 'stealth', 'leadership', 'athletics', 'alertness', 'brawl', 'intimidation', 'medicine', 'technology', 'computer'],
    virtues: ['courage', 'selfcontrol', 'conscience'] },
  { key: 'mystic', label: 'Mystic', blurb: 'Senses what others miss.',
    attr: ['mental', 'social', 'physical'], attrOrder: { mental: ['per', 'wit', 'int'], social: ['cha', 'app', 'man'], physical: ['sta', 'dex', 'str'] },
    abil: [0, 2, 1], picks: ['awareness', 'empathy', 'kenning', 'primalurge', 'art', 'expression', 'alertness', 'occult', 'enigmas', 'cosmology', 'esoterica', 'gremayre', 'rituals', 'meditation', 'crafts', 'research'],
    virtues: ['conscience', 'selfcontrol', 'courage'] },
  { key: 'artist', label: 'Artist', blurb: 'Makes things people feel.',
    attr: ['social', 'mental', 'physical'], attrOrder: { social: ['app', 'cha', 'man'], mental: ['per', 'wit', 'int'], physical: ['dex', 'sta', 'str'] },
    abil: [0, 1, 2], picks: ['expression', 'art', 'empathy', 'kenning', 'subterfuge', 'streetwise', 'performance', 'crafts', 'etiquette', 'academics', 'gremayre', 'politics'],
    virtues: ['conscience', 'courage', 'selfcontrol'] },
  { key: 'leader', label: 'Leader', blurb: 'Gives orders others follow.',
    attr: ['social', 'mental', 'physical'], attrOrder: { social: ['cha', 'man', 'app'], mental: ['wit', 'per', 'int'], physical: ['sta', 'dex', 'str'] },
    abil: [0, 2, 1], picks: ['leadership', 'expression', 'intimidation', 'empathy', 'persuasion', 'alertness', 'politics', 'law', 'bureaucracy', 'finance', 'investigation', 'etiquette', 'firearms', 'drive'],
    virtues: ['courage', 'conscience', 'selfcontrol'] },
  { key: 'healer', label: 'Healer', blurb: 'Patches up bodies and minds.',
    attr: ['mental', 'social', 'physical'], attrOrder: { mental: ['int', 'per', 'wit'], social: ['cha', 'man', 'app'], physical: ['dex', 'sta', 'str'] },
    abil: [2, 0, 1], picks: ['medicine', 'science', 'academics', 'occult', 'investigation', 'empathy', 'awareness', 'alertness', 'kenning', 'crafts', 'drive', 'survival', 'meditation', 'animalken'],
    virtues: ['conscience', 'selfcontrol', 'courage'] },
  { key: 'tech', label: 'Tech', blurb: 'Machines, code and gadgets.',
    attr: ['mental', 'physical', 'social'], attrOrder: { mental: ['int', 'wit', 'per'], physical: ['dex', 'sta', 'str'], social: ['man', 'cha', 'app'] },
    abil: [2, 1, 0], picks: ['computer', 'science', 'technology', 'investigation', 'academics', 'crafts', 'drive', 'research', 'firearms', 'larceny', 'alertness', 'athletics'],
    virtues: ['selfcontrol', 'conscience', 'courage'] }
];

export const QUICK_STYLES = [
  { key: 'generalist', label: 'Jack of all trades', blurb: 'A little of everything, mostly 1 dot.' },
  { key: 'rounded', label: 'Well-rounded', blurb: 'A mix of strong and light traits.' },
  { key: 'specialist', label: 'Specialist', blurb: 'Fewer traits, pushed higher.' }
];

// How a priority's dots are split, best trait first. Attributes start at 1 (max +4 here);
// Abilities stop at 3 with starting dots.
const ATTR_SHAPES = {
  generalist: { 7: [3, 2, 2], 6: [2, 2, 2], 5: [2, 2, 1], 4: [2, 1, 1], 3: [1, 1, 1] },
  rounded: { 7: [3, 2, 2], 6: [2, 2, 2], 5: [2, 2, 1], 4: [2, 1, 1], 3: [1, 1, 1] },
  specialist: { 7: [4, 2, 1], 6: [3, 2, 1], 5: [3, 1, 1], 4: [2, 1, 1], 3: [2, 1, 0] }
};
const ABIL_SHAPES = {
  generalist: { 13: [2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1], 9: [2, 1, 1, 1, 1, 1, 1, 1], 5: [1, 1, 1, 1, 1] },
  rounded: { 13: [3, 2, 2, 2, 1, 1, 1, 1], 9: [2, 2, 2, 1, 1, 1], 5: [2, 1, 1, 1] },
  specialist: { 13: [3, 3, 3, 2, 2], 9: [3, 3, 2, 1], 5: [3, 2] }
};
// Generally useful picks to fill out a column once the role's own list runs out.
const FALLBACK = ['alertness', 'athletics', 'awareness', 'empathy', 'streetwise', 'drive', 'stealth', 'etiquette', 'crafts',
  'academics', 'investigation', 'computer', 'medicine', 'occult', 'brawl', 'firearms', 'melee', 'subterfuge', 'expression'];

/** Splits `budget` over `n` slots without ever exceeding `cap` in one slot. */
function shapeFor(table, budget, n, cap) {
  const shape = (table[budget] || []).slice(0, n).map(v => Math.min(v, cap));
  let left = budget - shape.reduce((a, b) => a + b, 0);
  while (shape.length < n) shape.push(0);
  for (let i = 0; left > 0 && i < n * cap; i++) {
    const j = i % n;
    if (shape[j] < cap) { shape[j] += 1; left -= 1; }
  }
  return shape;
}

/**
 * @param {object} opts
 * @param {string} opts.splat
 * @param {string} opts.roleKey
 * @param {'generalist'|'rounded'|'specialist'} opts.style
 * @param {{0:{id:string,name:string}[],1:{id:string,name:string}[],2:{id:string,name:string}[]}} opts.abilities  the sheet's Ability rows per column, in sheet order
 * @param {string[]} [opts.virtueIds]  Virtue rows (Mortal and Vampire)
 * @returns {{dots:Object<string,number>, role:object, next:string[], notes:string[]}}
 */
export function buildQuickStart({ splat, roleKey, style = 'rounded', abilities, virtueIds = [] }) {
  const limits = CREATION_LIMITS[splat];
  const role = QUICK_ROLES.find(r => r.key === roleKey) || QUICK_ROLES[0];
  const st = ABIL_SHAPES[style] ? style : 'rounded';
  if (!limits) throw new Error('Unknown game line: ' + splat);
  const dots = {};

  // Attributes: every Attribute starts at 1; the role's best category gets the top priority.
  const cats = { physical: ['str', 'dex', 'sta'], social: ['cha', 'man', 'app'], mental: ['per', 'int', 'wit'] };
  Object.values(cats).flat().forEach(a => { dots[`${splat}_attr_${a}`] = 1; });
  role.attr.forEach((cat, rank) => {
    const shape = shapeFor(ATTR_SHAPES[st], limits.attributes[rank], 3, 4);
    role.attrOrder[cat].forEach((a, i) => { dots[`${splat}_attr_${a}`] = 1 + shape[i]; });
  });

  // Abilities: the role's best column gets 13, then 9, then 5; no Ability above 3.
  [0, 1, 2].forEach(c => (abilities[c] || []).forEach(row => { dots[row.id] = 0; }));
  role.abil.forEach((col, rank) => {
    const rows = abilities[col] || [];
    const byName = new Map(rows.map(r => [norm(r.name), r]));
    const ordered = [];
    const take = (name) => { const r = byName.get(name); if (r && !ordered.includes(r)) ordered.push(r); };
    role.picks.forEach(take);
    FALLBACK.forEach(take);
    rows.forEach(r => { if (!ordered.includes(r)) ordered.push(r); });
    const shape = shapeFor(ABIL_SHAPES[st], limits.abilities[rank], ordered.length, 3);
    ordered.forEach((r, i) => { dots[r.id] = shape[i] || 0; });
  });

  // Virtues (Mortal, Vampire): 1 each plus 7, split by the role's order; pools follow them.
  const notes = [];
  if (splat === 'mortal' || splat === 'vampire') {
    const vShape = shapeFor({ 7: [3, 2, 2] }, 7, 3, 4);
    const findV = (v) => virtueIds.find(id => norm(id.slice(id.indexOf('_adv_2_') + 7)).startsWith(v));
    role.virtues.forEach((v, i) => { const id = findV(v); if (id) dots[id] = 1 + vShape[i]; });
    const val = (v) => dots[findV(v)] || 1;
    const humanity = val('conscience') + val('selfcontrol');
    const willpower = val('courage');
    if (splat === 'mortal') { dots.mortal_humanity_dots = humanity; dots.mortal_humanity_sq = humanity; }
    else dots.vampire_path_dots = humanity;
    dots[`${splat}_wp_dots`] = willpower;
    dots[`${splat}_wp_sq`] = willpower;
    if (splat === 'vampire') notes.push('Blood Pool depends on Generation: set it on the sheet.');
  } else if (splat === 'mage') {
    Object.assign(dots, { mage_arete_dots: 1, mage_wp_dots: 5, mage_wp_sq: 5 });
  } else if (splat === 'wraith') {
    Object.assign(dots, { wraith_wp_dots: 5, wraith_wp_sq: 5, wraith_corpus_dots: 10, wraith_corpus_sq: 10, wraith_pathos_sq: 5 });
    notes.push('Pathos is 5 plus your Memoriam Background.');
  } else if (splat === 'werewolf') {
    notes.push('Rage, Gnosis and Willpower come from Breed, Auspice and Tribe: set them on the sheet.');
  } else if (splat === 'changeling') {
    notes.push('Glamour and Willpower depend on your Seeming and Kith: set them on the sheet.');
  }

  const filled = ['Virtues', 'Arete'];
  const next = limits.traits.filter(t => t.limit > 0 && !filled.includes(t.label)).map(t => `${t.label} (${t.limit})`);
  next.push(`${limits.freebies} Freebie Points`);
  return { dots, role, next, notes };
}
