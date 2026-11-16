import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveRoll, resolveInitiative } from '../assets/js/dice.js';

const seq = (...v) => { let i = 0; return () => v[i++]; };
const HURT = { penalty: -1, incapacitated: false };
const INCAP = { penalty: -99, incapacitated: true };

test('successes at or above difficulty, ones cancel successes', () => {
  const r = resolveRoll({ pool: 4, difficulty: 6, rng: seq(8, 6, 1, 3) });
  assert.equal(r.rawSuccesses, 2);
  assert.equal(r.ones, 1);
  assert.equal(r.netSuccesses, 1);
  assert.match(r.outcomeLabel, /Marginal/);
});

test('botch: no successes and at least one 1', () => {
  const r = resolveRoll({ pool: 3, difficulty: 6, rng: seq(1, 3, 4) });
  assert.equal(r.isBotch, true);
  assert.match(r.outcomeLabel, /BOTCH/);
});

test('failure, not botch, when ones cancel real successes', () => {
  const r = resolveRoll({ pool: 2, difficulty: 6, rng: seq(7, 1) });
  assert.equal(r.isBotch, false);
  assert.equal(r.netSuccesses, 0);
  assert.match(r.outcomeLabel, /Failure/);
});

test('specialty: a 10 counts as two successes', () => {
  const r = resolveRoll({ pool: 2, difficulty: 6, specialty: true, rng: seq(10, 2) });
  assert.equal(r.rawSuccesses, 2);
  const plain = resolveRoll({ pool: 2, difficulty: 6, specialty: false, rng: seq(10, 2) });
  assert.equal(plain.rawSuccesses, 1);
});

test('willpower: one automatic success that prevents a botch', () => {
  const r = resolveRoll({ pool: 2, difficulty: 6, willpower: true, rng: seq(1, 1) });
  assert.equal(r.isBotch, false);
  assert.equal(r.netSuccesses, 1);
});

test('wound penalty shrinks the pool; incapacitated rolls nothing', () => {
  assert.equal(resolveRoll({ pool: 5, difficulty: 6, wound: HURT, applyWound: true, rng: () => 5 }).effectivePool, 4);
  assert.equal(resolveRoll({ pool: 5, difficulty: 6, wound: HURT, applyWound: false, rng: () => 5 }).effectivePool, 5);
  assert.equal(resolveRoll({ pool: 5, difficulty: 6, wound: INCAP, applyWound: true, rng: () => 5 }).effectivePool, 0);
});

test('pool and difficulty are clamped', () => {
  const r = resolveRoll({ pool: 999, difficulty: 99, rng: () => 5 });
  assert.equal(r.basePool, 50);
  assert.equal(r.difficulty, 10);
  assert.equal(resolveRoll({ pool: 1, difficulty: 0, rng: () => 5 }).difficulty, 6); // 0 -> falls back to default 6
});

test('success tiers cap at Phenomenal', () => {
  const r = resolveRoll({ pool: 7, difficulty: 6, rng: () => 9 });
  assert.equal(r.netSuccesses, 7);
  assert.match(r.outcomeLabel, /Phenomenal/);
});

test('initiative = 1d10 + Dex + Wits, wound penalty only when applied', () => {
  assert.equal(resolveInitiative({ dex: 3, wits: 2, rng: () => 4 }).total, 9);
  assert.equal(resolveInitiative({ dex: 3, wits: 2, wound: HURT, applyWound: true, rng: () => 4 }).total, 8);
  assert.equal(resolveInitiative({ dex: 3, wits: 2, wound: HURT, applyWound: false, rng: () => 4 }).total, 9);
  assert.equal(resolveInitiative({ dex: 3, wits: 2, wound: INCAP, applyWound: true, rng: () => 4 }).incapacitated, true);
});
