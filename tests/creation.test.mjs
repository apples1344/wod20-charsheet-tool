import test from 'node:test';
import assert from 'node:assert/strict';
import { computeCreation, assignPriorities } from '../assets/js/creation.js';
import { SAMPLE_CHARACTERS as S } from '../assets/js/sampleCharacters.js';

test('priorities follow the player: biggest category gets the top slot', () => {
  assert.deepEqual(assignPriorities([1, 7, 3], [7, 5, 3]), [3, 7, 5]);
  assert.deepEqual(assignPriorities([0, 0, 0], [7, 5, 3]), [7, 5, 3]);
});

test('Mental-primary vampire is not shown as over or short', () => {
  const dots = {};
  for (const a of ['str', 'dex', 'sta', 'cha', 'man', 'app', 'per', 'int', 'wit']) dots['vampire_attr_' + a] = 1;
  Object.assign(dots, { vampire_attr_per: 4, vampire_attr_int: 3, vampire_attr_wit: 3, vampire_attr_cha: 3, vampire_attr_man: 3, vampire_attr_app: 2, vampire_attr_str: 2, vampire_attr_dex: 2, vampire_attr_sta: 2 });
  const c = computeCreation({ splat: 'vampire', dots, inputs: {} });
  assert.equal(c.attributes.spent, 15);
  assert.equal(c.attributes.over, 0);
  assert.equal(c.attributes.left, 0);
  assert.deepEqual(c.attributes.groups.map(g => g.slot), [3, 5, 7]);
});

test('freebie estimate matches the hand audit for the starters', () => {
  // Nadia: 6 ability dots over (12), Humanity +1, Willpower +2, Merit 1, Flaw 2 -> 14
  assert.equal(computeCreation(S.vampire_brujah).freebies.used, 14);
  // Leo: abilities 12, Numina 7, Willpower 2, merits 2, flaws 2 -> 21
  assert.equal(computeCreation(S.mortal_detective).freebies.used, 21);
  // Clara: abilities 6, Arete 8, Willpower 1 -> 15
  assert.equal(computeCreation(S.mage_verbena).freebies.used, 15);
});

test('every sample has five creation steps, plus an XP step once past Freebies', () => {
  for (const [k, v] of Object.entries(S)) {
    const c = computeCreation(v);
    assert.ok(c, k);
    assert.equal(c.steps.length, c.xp.beyond ? 6 : 5, k);
  }
});

test('wraith passions and fetters are told apart by row name', () => {
  const c = computeCreation(S.wraith_spook);
  const pas = c.traits.find(t => t.label === 'Passions');
  const fet = c.traits.find(t => t.label === 'Fetters');
  assert.equal(pas.spent, 5);
  assert.equal(fet.spent, 5);
});

// ---------- XP beyond creation ----------
import { SAMPLE_CHARACTERS, SAMPLE_TIERS } from '../assets/js/sampleCharacters.js';

const attrsAt = (sp, vals) => {
  const keys = ['str', 'dex', 'sta', 'cha', 'man', 'app', 'per', 'int', 'wit'];
  return Object.fromEntries(keys.map((k, i) => [`${sp}_attr_${k}`, vals[i] ?? 1]));
};

test('starter samples stay within Freebies (no XP)', () => {
  for (const [key, s] of Object.entries(SAMPLE_CHARACTERS)) {
    if (SAMPLE_TIERS[key] !== 'Starter') continue;
    const c = computeCreation(s);
    assert.equal(c.xp.beyond, false, key);
    assert.equal(c.xp.total, 0, key);
  }
});

test('developed and legendary samples show XP beyond creation', () => {
  for (const [key, s] of Object.entries(SAMPLE_CHARACTERS)) {
    if (SAMPLE_TIERS[key] === 'Starter') continue;
    const c = computeCreation(s);
    assert.equal(c.xp.beyond, true, key);
    assert.ok(c.xp.total > 0, key);
    assert.equal(c.steps.at(-1).key, 'xp', key);
  }
});

test('XP takes the cheapest order: starting dots and Freebies cover the dearest rungs', () => {
  // Physical 5/5/5 = 12 dots against a priority of 7: three ladders of 4+8+12+16 XP.
  // 7 starting dots + 15 Freebies (3 Attribute dots) leave two rungs; the cheapest pair is 12 + 16.
  const c = computeCreation({ splat: 'vampire', dots: attrsAt('vampire', [5, 5, 5]), inputs: {} });
  assert.equal(c.xp.beyond, true);
  assert.equal(c.xp.freebiesUsed, 15);
  assert.equal(c.xp.total, 28);
  assert.deepEqual(c.xp.byGroup, { Physical: 28 });
});

test('a sheet inside Freebies has no XP and the counts agree', () => {
  const c = computeCreation({ splat: 'vampire', dots: attrsAt('vampire', [5, 4, 2]), inputs: {} });
  assert.equal(c.xp.beyond, false);
  assert.equal(c.xp.total, 0);
  assert.equal(c.freebies.used, 5); // 4 + 3 + 1 = 8 dots against 7: one Attribute dot
});

test('Abilities above 3 cost Freebies even inside the group allowance', () => {
  const dots = { ...attrsAt('mage', []), mage_abi_0_alertness: 4 };
  const c = computeCreation({ splat: 'mage', dots, inputs: {} });
  assert.equal(c.freebies.parts.find(p => p.label === 'Abilities').pts, 2);
});

test('a high-level Gift can only be XP; starting Gifts are level 1', () => {
  const dots = {
    ...attrsAt('werewolf', []),
    werewolf_adv_1_0_dots: 1, werewolf_adv_1_1_dots: 1, werewolf_adv_1_2_dots: 1, werewolf_adv_1_3_dots: 3
  };
  const c = computeCreation({ splat: 'werewolf', dots, inputs: {} });
  assert.equal(c.xp.beyond, true);
  assert.equal(c.xp.byGroup.Gifts, 9); // level 3 × 3
});

test('Backgrounds past Freebies have no XP price outside Mage', () => {
  const dots = { ...attrsAt('vampire', [5, 5, 5, 5, 5, 5]), vampire_adv_1_0_dots: 5, vampire_adv_1_1_dots: 5 };
  const c = computeCreation({ splat: 'vampire', dots, inputs: {} });
  assert.equal(c.xp.beyond, true);
  // Backgrounds are paid with Freebies first (1 each), so they don't end up on the Storyteller.
  assert.equal(c.xp.storyteller.length, 0);
  assert.equal(c.xp.byGroup.Backgrounds, undefined);
});
