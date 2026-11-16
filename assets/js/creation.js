// Passive character-creation counter: works out how many starting dots are used, where a
// sheet is above the starting numbers, and an estimate of Freebie Points spent.
// Pure: takes a captured sheet state, returns numbers. Never blocks anything.
import { CREATION_LIMITS, POOL_BASES, XP_ESTIMATE } from './rules.js';

const ATTR_GROUPS = [['Physical', ['str', 'dex', 'sta']], ['Social', ['cha', 'man', 'app']], ['Mental', ['per', 'int', 'wit']]];
const ABIL_GROUPS = [['Talents', 0], ['Skills', 1], ['Knowledges', 2]];

/**
 * Matches categories to priorities the player may pick in any order: the category with the
 * most dots is treated as the top priority, and so on (this also gives the lowest overspend).
 */
export function assignPriorities(spents, priorities) {
  const order = spents.map((_, i) => i).sort((a, b) => spents[b] - spents[a] || a - b);
  const slots = new Array(spents.length);
  order.forEach((catIdx, rank) => { slots[catIdx] = priorities[rank]; });
  return slots;
}

function priorityBlock(names, spents, priorities) {
  const slots = assignPriorities(spents, priorities);
  const groups = names.map((name, i) => ({
    name,
    spent: spents[i],
    slot: slots[i],
    over: Math.max(0, spents[i] - slots[i]),
    left: Math.max(0, slots[i] - spents[i])
  }));
  const budget = priorities.reduce((a, b) => a + b, 0);
  const spent = spents.reduce((a, b) => a + b, 0);
  return {
    priorities,
    budget,
    spent,
    groups,
    over: groups.reduce((a, g) => a + g.over, 0),
    left: groups.reduce((a, g) => a + g.left, 0),
    started: spent > 0
  };
}

// ---------- XP beyond creation ----------
// Each trait is a ladder of dots. Creation pays for the bottom rungs (up to each group's
// allowance), Freebie Points pay for some more, and whatever is left was bought with XP.
// The sheet can't see the order things were bought in, so this picks the cheapest story:
// starting dots and Freebies go where they save the most XP. The result is an estimate.

const rungXp = (rate, k) => {
  if (!rate || rate.xp === null) return null;
  if (k <= 1) return rate.new ?? 0;
  return (k - 1) * rate.mult;
};

/** Gives `allowance` starting dots to the rungs that would cost the most XP otherwise. */
function placeStartingDots(items, allowance, rate) {
  let left = allowance;
  while (left > 0) {
    let best = null;
    let bestCost = -1;
    for (const it of items) {
      const top = Math.min(it.value, it.cap ?? Infinity);
      if (it.start >= top) continue;
      const cost = rungXp(rate, it.start + 1) ?? 0;
      if (cost > bestCost) { best = it; bestCost = cost; }
    }
    if (!best) break;
    best.start += 1;
    left -= 1;
  }
}

/** Remaining rungs of a ladder group, bottom-up per trait. */
function ladderUnits(group, items, rate, freebieCost) {
  return items.filter(it => it.value > it.start).map(it => {
    const units = [];
    for (let k = it.start + 1; k <= it.value; k++) units.push({ group, xp: rungXp(rate, k), fp: freebieCost });
    return units;
  });
}

function estimateXp(state, limits, attrSlots, abilSlots, pools, merits, flaws) {
  const sp = state.splat;
  const model = XP_ESTIMATE[sp];
  if (!model) return null;
  const dots = state.dots || {};
  const inputs = state.inputs || {};
  const d = (id) => Number(dots[id]) || 0;
  const chains = []; // each chain is one trait's remaining rungs, bought bottom-up

  ATTR_GROUPS.forEach(([name, keys], i) => {
    const items = keys.map(k => ({ value: d(`${sp}_attr_${k}`), start: 1 }));
    placeStartingDots(items, attrSlots[i], model.attr);
    chains.push(...ladderUnits(name, items, model.attr, limits.attrCost));
  });

  ABIL_GROUPS.forEach(([name, c], i) => {
    const items = Object.keys(dots)
      .filter(k => k.startsWith(`${sp}_abi_${c}_`) || k.startsWith(`${sp}_custom_abi_${c}_`))
      .map(k => ({ value: d(k), start: 0, cap: 3 }));
    placeStartingDots(items, abilSlots[i], model.abil);
    chains.push(...ladderUnits(name, items, model.abil, limits.abilCost));
  });

  limits.traits.forEach(t => {
    const rate = model.traits[t.label] || { xp: null };
    const keys = t.prefixes
      ? Object.keys(dots).filter(k => t.prefixes.some(p => k.startsWith(p)) && (!t.rowName || t.rowName(inputs[k.replace(/_dots$/, '_name')] || '')))
      : [];
    keys.push(...(t.ids || []));
    if (rate.perItem) {
      // Gifts: each row is one Gift of that level. Starting and Freebie Gifts are level 1.
      const rows = keys.map(k => d(k)).filter(v => v > 0).sort((a, b) => a - b);
      let starting = t.limit;
      rows.forEach(level => {
        if (level <= rate.startLevel && starting > 0) { starting -= 1; return; }
        chains.push([{ group: t.label, xp: level * rate.perItem, fp: level <= rate.startLevel ? t.cost : Infinity }]);
      });
      return;
    }
    const baseEach = rate.baseEach || 0;
    const items = keys.map(k => ({ value: d(k), start: Math.min(baseEach, d(k)) }));
    placeStartingDots(items, Math.max(0, t.limit - baseEach * items.length), rate);
    chains.push(...ladderUnits(t.label, items, rate, t.cost));
  });

  pools.forEach(p => {
    if (p.base === null) return;
    const rate = model.pools[p.label] || { xp: null };
    const items = [{ value: p.value, start: Math.min(p.base, p.value) }];
    chains.push(...ladderUnits(p.label, items, rate, p.cost));
  });

  const budget = Math.max(0, limits.freebies + flaws - merits);
  const totalFp = chains.flat().reduce((s, u) => s + u.fp, 0);
  const beyond = totalFp > budget;
  let fpLeft = budget;
  const paid = chains.map(() => 0); // rungs of each chain paid with Freebies, from the bottom

  if (!beyond) {
    chains.forEach((ch, i) => { paid[i] = ch.length; });
    fpLeft = budget - totalFp;
  } else {
    // Rungs with no XP price could only have come from Freebies: pay those first.
    chains.forEach((ch, i) => {
      while (paid[i] < ch.length && ch[paid[i]].xp === null && ch[paid[i]].fp <= fpLeft) { fpLeft -= ch[paid[i]].fp; paid[i] += 1; }
    });
    // Then spend what is left where each Freebie Point saves the most XP.
    for (;;) {
      let bestI = -1;
      let bestRatio = 0;
      chains.forEach((ch, i) => {
        const u = ch[paid[i]];
        if (!u || u.xp === null || u.fp > fpLeft) return;
        const ratio = u.xp / u.fp;
        if (ratio > bestRatio) { bestRatio = ratio; bestI = i; }
      });
      if (bestI < 0) break;
      fpLeft -= chains[bestI][paid[bestI]].fp;
      paid[bestI] += 1;
    }
  }

  const byGroup = {};
  const storyteller = {};
  let total = 0;
  chains.forEach((ch, i) => {
    ch.slice(paid[i]).forEach(u => {
      if (u.xp === null) { storyteller[u.group] = (storyteller[u.group] || 0) + 1; return; }
      byGroup[u.group] = (byGroup[u.group] || 0) + u.xp;
      total += u.xp;
    });
  });
  const approval = Object.entries(model.traits).filter(([label, r]) => r.approval && byGroup[label]).map(([label]) => label);

  return {
    beyond,
    total,
    freebieBudget: budget,
    freebiesUsed: budget - fpLeft,
    byGroup,
    storyteller: Object.entries(storyteller).map(([label, n]) => ({ label, dots: n })),
    approval,
    assumed: total > 0 ? model.assumed : []
  };
}

export function computeCreation(state) {
  const sp = state && state.splat;
  const limits = CREATION_LIMITS[sp];
  if (!limits) return null;
  const dots = state.dots || {};
  const inputs = state.inputs || {};
  const d = (id) => Number(dots[id]) || 0;
  const sumWhere = (fn) => Object.keys(dots).filter(fn).reduce((s, k) => s + d(k), 0);

  const attrSpents = ATTR_GROUPS.map(([, keys]) => keys.reduce((s, k) => s + Math.max(0, d(`${sp}_attr_${k}`) - 1), 0));
  const attributes = priorityBlock(ATTR_GROUPS.map(g => g[0]), attrSpents, limits.attributes);

  const abilSpents = ABIL_GROUPS.map(([, c]) => sumWhere(k => k.startsWith(`${sp}_abi_${c}_`) || k.startsWith(`${sp}_custom_abi_${c}_`)));
  const abilities = priorityBlock(ABIL_GROUPS.map(g => g[0]), abilSpents, limits.abilities);
  const abilIds = Object.keys(dots).filter(k => k.startsWith(`${sp}_abi_`) || k.startsWith(`${sp}_custom_abi_`));
  abilities.aboveThree = abilIds.filter(k => d(k) > 3).length;
  abilities.aboveThreeDots = abilIds.reduce((s, k) => s + Math.max(0, d(k) - 3), 0);
  // No Ability goes above 3 with starting dots: those dots are always Freebies (or XP), and
  // only the dots up to 3 draw on the group's priority allowance.
  abilities.freebieDots = ABIL_GROUPS.reduce((sum, [, c], i) => {
    const ids = abilIds.filter(k => k.startsWith(`${sp}_abi_${c}_`) || k.startsWith(`${sp}_custom_abi_${c}_`));
    const above = ids.reduce((s, k) => s + Math.max(0, d(k) - 3), 0);
    return sum + above + Math.max(0, abilities.groups[i].spent - above - abilities.groups[i].slot);
  }, 0);

  const traits = limits.traits.map(t => {
    let spent = 0;
    if (t.prefixes) {
      spent += sumWhere(k => t.prefixes.some(p => k.startsWith(p)) && (!t.rowName || t.rowName(inputs[k.replace(/_dots$/, '_name')] || '')));
    }
    spent += (t.ids || []).reduce((s, id) => s + d(id), 0);
    return { label: t.label, spent, limit: t.limit, cost: t.cost, over: Math.max(0, spent - t.limit), left: Math.max(0, t.limit - spent) };
  });

  const pools = (POOL_BASES[sp] || []).map(p => {
    const value = d(p.id);
    const base = p.base ? p.base(d) : null;
    return { label: p.label, value, base, cost: p.cost, over: base === null ? null : Math.max(0, value - base) };
  });

  const costOf = (kind) => Object.keys(inputs)
    .filter(k => new RegExp(`^${sp}_${kind}_\\d+_cost$`).test(k))
    .reduce((s, k) => s + (parseInt(inputs[k], 10) || 0), 0);
  const merits = costOf('merit');
  const flawsRaw = costOf('flaw');
  const flaws = Math.min(7, flawsRaw);

  const parts = [
    { label: 'Attributes', pts: attributes.over * limits.attrCost },
    { label: 'Abilities', pts: abilities.freebieDots * limits.abilCost },
    ...traits.map(t => ({ label: t.label, pts: t.over * t.cost })),
    ...pools.filter(p => p.over !== null).map(p => ({ label: p.label, pts: p.over * p.cost })),
    { label: 'Merits', pts: merits },
    { label: 'Flaws (bonus, max 7)', pts: -flaws }
  ].filter(p => p.pts !== 0);
  const used = parts.reduce((s, p) => s + p.pts, 0);
  const freebies = {
    budget: limits.freebies,
    used,
    left: limits.freebies - used,
    parts,
    notCounted: pools.filter(p => p.over === null).map(p => p.label),
    flawsCapped: flawsRaw > 7
  };

  const xp = estimateXp(state, limits,
    assignPriorities(attrSpents, limits.attributes),
    assignPriorities(abilSpents, limits.abilities),
    pools, merits, flaws);

  const name = (inputs[`${sp}_char_name`] || '').trim();
  const stage = (block) => (!block.started ? 'todo' : (block.left > 0 ? 'doing' : 'done'));
  const advStarted = traits.some(t => t.spent > 0);
  const advLeft = traits.some(t => t.left > 0);
  const steps = [
    { key: 'concept', label: 'Concept', state: name ? 'done' : 'todo', hint: 'Name, Nature, Demeanor and concept' },
    { key: 'attributes', label: 'Attributes', state: stage(attributes), hint: `Split ${limits.attributes.join(' / ')} in any order` },
    { key: 'abilities', label: 'Abilities', state: stage(abilities), hint: `Split ${limits.abilities.join(' / ')} in any order` },
    { key: 'advantages', label: 'Advantages', state: !advStarted ? 'todo' : (advLeft ? 'doing' : 'done'), hint: traits.map(t => `${t.label} ${t.limit}`).join(', ') },
    { key: 'freebies', label: 'Freebies', state: xp && xp.beyond ? 'done' : (used === 0 ? 'todo' : (used < limits.freebies ? 'doing' : (used === limits.freebies ? 'done' : 'over'))), hint: `${limits.freebies} points` }
  ];
  if (xp && xp.beyond) steps.push({ key: 'xp', label: 'XP', state: 'xp', hint: `About ${xp.total} XP beyond creation` });

  return { splat: sp, attributes, abilities, traits, pools, freebies, xp, steps };
}

/**
 * One plain sentence naming the next thing to do, for the Creation guide.
 * Follows the usual order (Attributes, Abilities, Advantages, Freebies) and leaves the
 * name for last. Empty once creation is finished or the sheet has gone past it into XP.
 */
export function nextStepText(c) {
  if (!c) return '';
  if (c.xp && c.xp.beyond) return '';
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const block = (b, what, groups) => {
    if (!b.started) return `Next: ${what}. Split ${b.priorities.join(' / ')} dots across ${groups}, in any order.`;
    if (b.left > 0) return `Next: ${what}. ${plural(b.left, 'dot', 'dots')} left to place.`;
    return '';
  };
  const attr = block(c.attributes, 'Attributes', 'Physical, Social and Mental');
  if (attr) return attr;
  const abil = block(c.abilities, 'Abilities', 'Talents, Skills and Knowledges');
  if (abil) return abil;
  const open = c.traits.filter(t => t.left > 0);
  if (open.length) {
    return `Next: Advantages. ${open.map(t => `${t.label} ${t.left}`).join(', ')} left.`;
  }
  const f = c.freebies;
  if (f.used < f.budget) {
    return `Next: spend ${f.used ? 'the last ' : ''}${plural(f.left, 'Freebie Point', 'Freebie Points')} on anything you like.`;
  }
  return '';
}
