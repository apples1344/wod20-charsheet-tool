import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SPLAT_RULES, WEREWOLF_FORMS, WOUND_LEVELS, HEALTH_PENALTIES, VAMPIRE_GENERATION } from '../assets/js/rules.js';
import { SPLAT_GUIDES } from '../assets/js/guide.js';
import { fillMarkup } from '../assets/js/hydrate.js';

const SPLATS = ['mortal', 'vampire', 'werewolf', 'mage', 'changeling', 'wraith'];

test('every game line has rules and renders a guide', () => {
  for (const k of SPLATS) {
    assert.ok(SPLAT_RULES[k], k);
    assert.ok(SPLAT_RULES[k].book, k + ' book');
    const html = SPLAT_GUIDES[k];
    assert.match(html, /Creation Process/);
    assert.match(html, /Freebie Point Costs/);
    assert.match(html, /Experience Costs/);
    assert.ok(!html.includes('undefined'), k);
  }
});

test('known corrections are in place', () => {
  const realm = SPLAT_RULES.changeling.freebie.find(r => r[0] === 'Realm');
  assert.equal(realm[1], '2 / dot');
  const quint = SPLAT_RULES.mage.freebie.find(r => r[0] === 'Quintessence');
  assert.equal(quint[1], '1 / 4 pts');
});

test('wound track matches the 20th Anniversary health levels', () => {
  assert.deepEqual(WOUND_LEVELS.map(w => w.penalty).slice(0, 6), [0, -1, -1, -2, -2, -5]);
  assert.equal(WOUND_LEVELS[6].incapacitated, true);
  assert.equal(WOUND_LEVELS.length, HEALTH_PENALTIES.length);
});

test('V20 generation table', () => {
  assert.deepEqual(VAMPIRE_GENERATION[13], { max: 10, perTurn: '1/turn' });
  assert.deepEqual(VAMPIRE_GENERATION[10], { max: 13, perTurn: '1/turn' });
  assert.deepEqual(VAMPIRE_GENERATION[4], { max: 50, perTurn: '10/turn' });
});

test('werewolf forms', () => {
  assert.deepEqual(Object.keys(WEREWOLF_FORMS), ['homid', 'glabro', 'crinos', 'hispo', 'lupus']);
  assert.equal(WEREWOLF_FORMS.crinos.str, 4);
});

test('dot markup expands as expected', () => {
  assert.equal((fillMarkup('d5s', 0).match(/<span/g) || []).length, 10);
  assert.equal((fillMarkup('d5s', 0).match(/dot-scalable-10/g) || []).length, 5);
  assert.equal((fillMarkup('d5s', 1).match(/dot filled/g) || []).length, 1);
  assert.equal((fillMarkup('d10').match(/<span/g) || []).length, 10);
  assert.equal((fillMarkup('d5').match(/<span/g) || []).length, 5);
  assert.equal((fillMarkup('b10').match(/square-box/g) || []).length, 10);
});

test('index.html: every compact container has a known fill code and none are left unhydratable', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const codes = [...html.matchAll(/data-fill="(\w+)"/g)].map(m => m[1]);
  assert.equal(codes.length, 392);
  for (const c of codes) assert.ok(['d5s', 'd10', 'd5', 'b10'].includes(c), c);
  // no container is left with hand-written spans
  assert.equal(/<div class="(?:dots|boxes)-container"[^>]*><span/.test(html), false);
});

test('service worker lists every module', () => {
  const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  for (const f of fs.readdirSync(new URL('../assets/js/', import.meta.url)).filter(f => f.endsWith('.js'))) {
    assert.ok(sw.includes(`./assets/js/${f}`), f);
  }
});
