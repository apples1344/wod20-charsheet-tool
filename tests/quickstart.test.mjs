// Quick Start must give a legal, fully placed starting sheet on every game line.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildQuickStart, QUICK_ROLES, QUICK_STYLES } from '../assets/js/quickstart.js';
import { computeCreation } from '../assets/js/creation.js';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const SPLATS = ['mortal', 'vampire', 'werewolf', 'mage', 'changeling', 'wraith'];
const sheetAbilities = (sp) => {
  const out = { 0: [], 1: [], 2: [] };
  for (const m of html.matchAll(new RegExp(`data-id="(${sp}_abi_([012])_([^"]+))"`, 'g'))) out[m[2]].push({ id: m[1], name: m[3] });
  return out;
};
const virtueIds = (sp) => [...html.matchAll(new RegExp(`data-id="(${sp}_adv_2_[a-z][^"]*)"`, 'g'))].map(m => m[1]).filter(id => !/_\d+_dots$/.test(id));

for (const sp of SPLATS) {
  for (const role of QUICK_ROLES) {
    for (const style of QUICK_STYLES) {
      test(`${sp} · ${role.key} · ${style.key}: every starting dot placed, nothing over`, () => {
        const q = buildQuickStart({ splat: sp, roleKey: role.key, style: style.key, abilities: sheetAbilities(sp), virtueIds: virtueIds(sp) });
        const c = computeCreation({ splat: sp, dots: q.dots, inputs: {} });
        assert.equal(c.attributes.left, 0, 'attribute dots left');
        assert.equal(c.attributes.over, 0, 'attribute dots over');
        assert.equal(c.abilities.left, 0, 'ability dots left');
        assert.equal(c.abilities.over, 0, 'ability dots over');
        assert.equal(c.abilities.aboveThree, 0, 'ability above 3');
        assert.equal(c.freebies.used, 0, 'freebies used');
        assert.equal(c.xp.beyond, false);
        const virtues = c.traits.find(t => t.label === 'Virtues');
        if (virtues) assert.equal(virtues.left, 0, 'virtue dots left');
      });
    }
  }
}

test('the role decides which category gets the top priority', () => {
  const q = buildQuickStart({ splat: 'vampire', roleKey: 'scholar', style: 'rounded', abilities: sheetAbilities('vampire'), virtueIds: virtueIds('vampire') });
  const mental = q.dots.vampire_attr_per + q.dots.vampire_attr_int + q.dots.vampire_attr_wit - 3;
  assert.equal(mental, 7);
  const knowledges = Object.entries(q.dots).filter(([k]) => k.startsWith('vampire_abi_2_')).reduce((s, [, v]) => s + v, 0);
  assert.equal(knowledges, 13);
  assert.ok(q.dots.vampire_abi_2_academics >= 2);
});

test('Specialist pushes the signature Attribute to 5', () => {
  const q = buildQuickStart({ splat: 'mage', roleKey: 'bruiser', style: 'specialist', abilities: sheetAbilities('mage') });
  assert.equal(q.dots.mage_attr_str, 5);
});

test('what is left to choose is listed (powers, Backgrounds, Freebies)', () => {
  const q = buildQuickStart({ splat: 'vampire', roleKey: 'face', abilities: sheetAbilities('vampire'), virtueIds: virtueIds('vampire') });
  assert.deepEqual(q.next, ['Disciplines (3)', 'Backgrounds (5)', '15 Freebie Points']);
});
