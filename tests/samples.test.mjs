// Starter samples must fit their game line's creation dots plus Freebie Points.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SAMPLE_CHARACTERS as S, SAMPLE_TIERS } from '../assets/js/sampleCharacters.js';

const sum = (d, re) => Object.entries(d).filter(([k]) => re.test(k)).reduce((s, [, v]) => s + v, 0);
const cats = (d, sp, kind, groups) => groups.map(g => g.reduce((s, k) => s + (d[`${sp}_${kind}_${k}`] ?? 0), 0));
const overspend = (vals, prios) => { // dots above priorities, best assignment
  const v = [...vals].sort((a, b) => b - a);
  return v.reduce((s, x, i) => s + Math.max(0, x - prios[i]), 0);
};

const starters = Object.entries(S).filter(([k, v]) => SAMPLE_TIERS[k] === 'Starter' && ['mortal', 'vampire', 'werewolf', 'mage'].includes(v.splat));

test('every sample has a tier and fields carry no tier tags', () => {
  assert.deepEqual(Object.keys(SAMPLE_TIERS).sort(), Object.keys(S).sort());
  for (const [k, v] of Object.entries(S)) {
    for (const val of Object.values(v.inputs)) {
      assert.ok(!/[\[(](Starter|Developed|Legendary)[\])]/.test(String(val)), `${k} has a tier tag in a field`);
    }
  }
});

for (const [key, v] of starters) {
  test(`starter ${key} fits creation + freebies`, () => {
    const sp = v.splat, d = v.dots;
    const attrs = cats(d, sp, 'attr', [['str', 'dex', 'sta'], ['cha', 'man', 'app'], ['per', 'int', 'wit']]).map(x => x - 3);
    const abil = [0, 1, 2].map(c => sum(d, new RegExp(`^${sp}_abi_${c}_`)));
    const attrPrio = sp === 'mortal' ? [6, 4, 3] : [7, 5, 3];
    let freebies = overspend(attrs, attrPrio) * 5 + overspend(abil, [13, 9, 5]) * 2;
    assert.equal(attrs.reduce((a, b) => a + b, 0) >= attrPrio.reduce((a, b) => a + b, 0), true, 'attribute dots spent');
    const budget = sp === 'mortal' ? 21 : 15;
    if (sp === 'mortal') {
      freebies += sum(d, /^mortal_adv_0_/) * 7 + Math.max(0, sum(d, /^mortal_adv_1_/) - 5);
      freebies += Math.max(0, d.mortal_humanity_dots - d['mortal_adv_2_conscience'] - d['mortal_adv_2_self-control']);
      freebies += Math.max(0, d.mortal_wp_dots - d.mortal_adv_2_courage);
    }
    if (sp === 'vampire') {
      freebies += Math.max(0, sum(d, /^vampire_adv_0_/) - 3) * 7 + Math.max(0, sum(d, /^vampire_adv_1_/) - 5);
      freebies += Math.max(0, d.vampire_path_dots - d['vampire_adv_2_conscience_/_conviction'] - d['vampire_adv_2_self-control_/_instinct']);
      freebies += Math.max(0, d.vampire_wp_dots - d.vampire_adv_2_courage);
    }
    if (sp === 'mage') {
      freebies += Math.max(0, sum(d, /^mage_adv_0_/) - 6) * 7 + Math.max(0, sum(d, /^mage_adv_1_/) - 7);
      freebies += (d.mage_arete_dots - 1) * 4 + Math.max(0, d.mage_wp_dots - 5);
    }
    const mf = (kind) => Object.entries(v.inputs).filter(([k]) => new RegExp(`^${sp}_${kind}_\\d+_cost$`).test(k)).reduce((s, [, c]) => s + (parseInt(c, 10) || 0), 0);
    freebies += mf('merit') - Math.min(7, mf('flaw'));
    assert.ok(freebies <= budget, `${key}: ${freebies} freebies used of ${budget}`);
  });
}
