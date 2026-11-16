// Standalone 3D roller page (dice3d.html). Same dice rules as the sheet (dice.js).
import { resolveRoll } from './dice.js';
import { createDiceStage, toneFor } from './dice3d.js';

const HISTORY_KEY = 'wod_sheet_3d_history_v1';
const $ = (id) => document.getElementById(id);
const poolEl = $('d3Pool');
const diffEl = $('d3Diff');
const stage = createDiceStage($('d3Canvas'), { emptyText: 'Roll to throw the dice' });
let history = [];
let rolling = false;

const clampInput = (el, lo, hi, dflt) => {
  const n = parseInt(el.value, 10);
  el.value = Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
  return parseInt(el.value, 10);
};

function syncUi() {
  const pool = clampInput(poolEl, 1, 50, 5);
  const diff = clampInput(diffEl, 2, 10, 6);
  $('d3RollCount').textContent = pool;
  document.querySelectorAll('[data-diff]').forEach(b => b.setAttribute('aria-pressed', String(parseInt(b.dataset.diff, 10) === diff)));
}

function renderHistory() {
  const list = $('d3History');
  list.replaceChildren(...history.map(h => {
    const li = document.createElement('li');
    li.className = h.cls;
    const t = document.createElement('time');
    t.dateTime = new Date(h.at).toISOString();
    t.textContent = new Date(h.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const s = document.createElement('span');
    s.textContent = h.text;
    li.append(t, s);
    return li;
  }));
  $('d3ClearBtn').hidden = history.length === 0;
}

function saveHistory() {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch (e) { console.warn('History not saved:', e); }
}

async function roll() {
  if (rolling) return;
  syncUi();
  rolling = true;
  const btn = $('d3RollBtn');
  btn.disabled = true;
  const specialty = $('d3Spec').checked;
  const willpower = $('d3Wp').checked;
  const r = resolveRoll({ pool: poolEl.value, difficulty: diffEl.value, specialty, willpower });
  $('d3Outcome').textContent = 'Rolling…';
  $('d3Outcome').className = 'd3-outcome';
  $('d3Detail').textContent = '';

  await stage.roll(r.dice.map(d => ({ value: d.val, tone: toneFor(d.val, r.difficulty) })));

  $('d3Outcome').textContent = r.outcomeLabel;
  $('d3Outcome').className = 'd3-outcome ' + r.outcomeClass;
  const mods = [specialty && 'Specialty', willpower && 'Willpower'].filter(Boolean).join(', ');
  $('d3Detail').textContent = `${r.effectivePool}d10 at difficulty ${r.difficulty}${mods ? ' · ' + mods : ''} · [${r.dice.map(d => d.val).join(', ')}]`;
  history.unshift({ at: Date.now(), cls: r.outcomeClass, text: `${r.effectivePool}d10 diff ${r.difficulty}: ${r.outcomeLabel}` });
  history = history.slice(0, 20);
  saveHistory();
  renderHistory();
  btn.disabled = false;
  rolling = false;
}

// controls
document.querySelectorAll('[data-step]').forEach(b => b.addEventListener('click', () => {
  const [which, delta] = b.dataset.step.split(':');
  const el = which === 'pool' ? poolEl : diffEl;
  el.value = (parseInt(el.value, 10) || 0) + parseInt(delta, 10);
  syncUi();
}));
document.querySelectorAll('[data-diff]').forEach(b => b.addEventListener('click', () => { diffEl.value = b.dataset.diff; syncUi(); }));
poolEl.addEventListener('change', syncUi);
diffEl.addEventListener('change', syncUi);
$('d3RollBtn').addEventListener('click', roll);
$('d3ClearBtn').addEventListener('click', () => { history = []; saveHistory(); renderHistory(); });
document.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement && e.target.type === 'number') return;
  if (e.key === 'r' || e.key === 'R' || (e.key === ' ' && !(e.target instanceof HTMLButtonElement))) {
    e.preventDefault();
    roll();
  }
});

// ?pool=6&diff=7&spec=1&wp=1 (the sheet's roller links here with its current pool)
const params = new URLSearchParams(location.search);
if (params.has('pool')) poolEl.value = params.get('pool');
if (params.has('diff')) diffEl.value = params.get('diff');
$('d3Spec').checked = params.get('spec') === '1';
$('d3Wp').checked = params.get('wp') === '1';

try {
  const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  if (Array.isArray(saved)) {
    history = saved.filter(h => h && typeof h.text === 'string').slice(0, 20)
      .map(h => ({ at: Number(h.at) || Date.now(), text: h.text.slice(0, 200), cls: /^outcome-[a-z]+$/.test(h.cls) ? h.cls : '' }));
  }
} catch (e) { history = []; }
syncUi();
renderHistory();
