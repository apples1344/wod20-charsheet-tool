import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TERMS, TRAIT_HINTS, termForHeading, termsForLine, traitHintFor } from '../assets/js/glossary.js';
import { computeCreation, nextStepText } from '../assets/js/creation.js';
import { buildQuickStart } from '../assets/js/quickstart.js';
import { SAMPLE_CHARACTERS as S } from '../assets/js/sampleCharacters.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// Every fixed trait name printed on each game line's sheet, e.g. ['vampire', 'Alertness'].
function sheetTraitLabels() {
  const out = [];
  const re = /id="splat-([a-z]+)"|class="trait-label"[^>]*>([^<]+)</g;
  let splat = null;
  let m;
  while ((m = re.exec(html))) {
    if (m[1]) splat = m[1];
    else if (splat) out.push([splat, m[2].trim()]);
  }
  return out;
}

test('every fixed trait on every sheet has a one-line hint', () => {
  const labels = sheetTraitLabels();
  assert.ok(labels.length > 250, `expected the full sheet, found ${labels.length} trait labels`);
  const missing = labels.filter(([sp, l]) => !traitHintFor(l, sp));
  assert.deepEqual([...new Set(missing.map(x => x.join(': ')))], []);
});

test('the same word can mean different things in different lines', () => {
  assert.match(traitHintFor('Time', 'mage'), /past or future/);
  assert.match(traitHintFor('Time', 'changeling'), /Realm/);
  assert.match(traitHintFor('Nature', 'changeling'), /animals/);
  assert.equal(traitHintFor('Animal-Ken', 'werewolf'), traitHintFor('Animal Ken', 'vampire'));
  assert.equal(traitHintFor('', 'mortal'), '');
  assert.equal(traitHintFor('Some Custom Ability', 'mortal'), '');
});

test('hints and terms stay short (a sentence or two, not rulebook text)', () => {
  for (const [k, v] of Object.entries(TRAIT_HINTS)) assert.ok(v.length <= 120, `${k} hint is ${v.length} chars`);
  for (const t of TERMS) assert.ok(t.text.length <= 220, `${t.id} is ${t.text.length} chars`);
  const ids = TERMS.map(t => t.id);
  assert.equal(new Set(ids).size, ids.length, 'term ids are unique');
});

test('headings find their term, by whole word and by game line', () => {
  assert.equal(termForHeading('Humanity / Path', 'vampire').id, 'humanity');
  assert.equal(termForHeading('Humanity', 'mortal').id, 'humanity');
  assert.equal(termForHeading('Willpower', 'mage').id, 'willpower');
  assert.equal(termForHeading('Psyche Willpower', 'wraith').id, 'willpower');
  assert.equal(termForHeading('Nature:', 'vampire').id, 'nature');
  assert.equal(termForHeading('Generation:', 'vampire').id, 'generation');
  assert.equal(termForHeading('Generation:', 'mortal'), null, 'Generation belongs to Vampire only');
  assert.equal(termForHeading('Arts', 'changeling').id, 'arts');
  assert.equal(termForHeading('Arts', 'mage'), null);
  assert.equal(termForHeading('Artsy stuff', 'changeling'), null, 'whole word only');
  assert.equal(termForHeading('Expanded Backgrounds', 'vampire'), null, 'must start with the term');
  assert.equal(termForHeading('Possessions / Gear', 'vampire'), null);
});

test('the glossary tab lists shared terms plus only this line’s terms', () => {
  const v = termsForLine('vampire').map(t => t.id);
  assert.ok(v.includes('disciplines') && v.includes('botch') && v.includes('freebies'));
  assert.ok(!v.includes('gnosis') && !v.includes('arete'));
});

test('every heading term matches something on its sheet', () => {
  // the heading texts as written in index.html (titles and labels)
  const texts = [];
  const re = /id="splat-([a-z]+)"|class="(?:section-title|section-title-sm|sub-col-title|pool-title|text-label)[^"]*"[^>]*>(?:<[^>]+>)*([^<]+)</g;
  let splat = null;
  let m;
  while ((m = re.exec(html))) {
    if (m[1]) splat = m[1];
    else if (splat) texts.push([splat, m[2].trim()]);
  }
  const found = new Set(texts.map(([sp, t]) => termForHeading(t, sp)?.id).filter(Boolean));
  const unused = TERMS.filter(t => t.match && !found.has(t.id)).map(t => t.id);
  assert.deepEqual(unused, []);
});

test('next step follows the usual order and goes quiet when done', () => {
  const blank = computeCreation({ splat: 'mortal', dots: {}, inputs: {} });
  assert.match(nextStepText(blank), /^Next: Attributes\. Split 6 \/ 4 \/ 3 dots/);

  const abilities = { 0: [], 1: [], 2: [] };
  for (const m of html.matchAll(/data-id="(vampire_abi_([012])_([^"]+))"/g)) abilities[m[2]].push({ id: m[1], name: m[3] });
  const virtueIds = [...html.matchAll(/data-id="(vampire_adv_2_[a-z][^"]*)"/g)].map(m => m[1]).filter(id => !/_\d+_dots$/.test(id));
  const qs = buildQuickStart({ splat: 'vampire', roleKey: 'face', style: 'rounded', abilities, virtueIds });
  const afterQuick = computeCreation({ splat: 'vampire', dots: qs.dots, inputs: {} });
  // Attributes and Abilities are placed by Quick Start, so Advantages come next
  assert.match(nextStepText(afterQuick), /^Next: Advantages\. .*Disciplines 3.*Backgrounds 5/);

  // every starter that is past creation, or exactly finished, shows no prompt
  for (const key of ['mortal_vanhelsing', 'vampire_voivode', 'mage_archmage']) {
    assert.equal(nextStepText(computeCreation(S[key])), '', key);
  }
  assert.equal(nextStepText(null), '');
});

test('the Freebie prompt counts what is left', () => {
  const c = computeCreation(S.vampire_brujah); // 14 of 15 used
  const t = nextStepText(c);
  if (c.attributes.left === 0 && c.abilities.left === 0 && c.traits.every(x => x.left === 0)) {
    assert.equal(t, 'Next: spend the last 1 Freebie Point on anything you like.');
  } else {
    assert.match(t, /^Next: /);
  }
});
