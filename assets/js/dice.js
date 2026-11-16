import { DICE_RULES, WOUND_LEVELS } from './rules.js';

/** One d10 (1–10), cryptographically random where available. */
export function rollD10() {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return (arr[0] % 10) + 1;
  }
  return Math.floor(Math.random() * 10) + 1;
}

/** Wound level object for a health-track index (0 = healthy … 6 = incapacitated). */
export function woundForIndex(idx) {
  return WOUND_LEVELS[idx] || WOUND_LEVELS[0];
}

/**
 * Resolves a Storyteller dice pool.
 *   pool, difficulty        base pool and target number
 *   specialty               10s count as two successes
 *   willpower               spend Willpower: one automatic success, cannot botch
 *   wound                   { penalty, incapacitated } or null
 *   applyWound              whether the wound penalty is applied to this roll
 *   rng                     injectable d10 source (for tests)
 */
export function resolveRoll({ pool, difficulty, specialty = false, willpower = false, wound = null, applyWound = false, rng = rollD10 }) {
  const basePool = Math.max(0, Math.min(DICE_RULES.maxPool, parseInt(pool, 10) || 0));
  const diff = Math.max(DICE_RULES.minDifficulty, Math.min(DICE_RULES.maxDifficulty, parseInt(difficulty, 10) || DICE_RULES.defaultDifficulty));
  const wounded = Boolean(applyWound && wound && wound.penalty < 0);
  const effectivePool = (wounded && wound.incapacitated)
    ? 0
    : Math.max(0, basePool + (wounded ? wound.penalty : 0));

  const dice = [];
  let rawSuccesses = 0;
  let ones = 0;
  for (let i = 0; i < effectivePool; i++) {
    const val = rng();
    dice.push({ val });
    if (val === 1) ones++;
    else if (val >= diff) rawSuccesses += (specialty && val === 10) ? DICE_RULES.specialtyTenCountsAs : 1;
  }

  const isBotch = effectivePool > 0 && rawSuccesses === 0 && ones > 0 && !willpower;
  const rolledNet = rawSuccesses - ones;
  const netSuccesses = willpower ? Math.max(0, rolledNet) + DICE_RULES.willpowerAutoSuccesses : rolledNet;

  let outcomeLabel;
  let outcomeClass = 'outcome-fail';
  if (isBotch) {
    outcomeLabel = `BOTCH! (${ones} ${ones === 1 ? 'One' : 'Ones'})`;
    outcomeClass = 'outcome-botch';
  } else if (netSuccesses <= 0) {
    outcomeLabel = `Failure (${Math.max(0, netSuccesses)} Net Successes)`;
  } else {
    const tiers = DICE_RULES.tiers;
    const tier = netSuccesses >= 5 ? tiers[5] : tiers[netSuccesses];
    outcomeLabel = `${netSuccesses} ${netSuccesses === 1 ? 'Success' : 'Successes'} — ${tier}`;
    outcomeClass = netSuccesses >= 4 ? 'outcome-phenomenal' : 'outcome-success';
  }

  return { basePool, difficulty: diff, effectivePool, wounded, dice, rawSuccesses, ones, isBotch, netSuccesses, outcomeLabel, outcomeClass };
}

/**
 * Initiative: 1d10 + Dexterity + Wits, minus the wound penalty when applyWound is true.
 * Returns { incapacitated: true } when an incapacitated character would be rolling with the penalty.
 */
export function resolveInitiative({ dex, wits, wound = null, applyWound = false, rng = rollD10 }) {
  const wounded = Boolean(applyWound && wound && wound.penalty < 0);
  if (wounded && wound.incapacitated) return { incapacitated: true };
  const woundMod = wounded ? wound.penalty : 0;
  const die = rng();
  return { incapacitated: false, die, dex, wits, woundMod, total: die + dex + wits + woundMod };
}
