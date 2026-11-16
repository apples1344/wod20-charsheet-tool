// Beginner hints: "?" buttons on key headings, a short delayed tooltip on trait names,
// and the Guide's Glossary tab. One setting (⋮ → Beginner Hints) turns the on-sheet
// hints off for players who know the game; the Glossary tab stays available either way.

import { TERMS, TERM_GROUPS, termForHeading, termById, termsForLine, traitHintFor } from './glossary.js';

const HINTS_KEY = 'wod_sheet_hints_v1';
const TIP_DELAY_MS = 650;

let api = { getSplat: () => 'mortal', openGlossary: () => {} };
let pop = null;
let popFor = null;
let tip = null;
let tipTimer = 0;

export function hintsOn() {
  try { return localStorage.getItem(HINTS_KEY) !== '0'; } catch (e) { return true; }
}

function applyHintsSetting(on) {
  document.body.classList.toggle('hints-off', !on);
  const label = document.getElementById('hintsToggleLabel');
  if (label) label.textContent = on ? 'Beginner Hints: On' : 'Beginner Hints: Off';
  const btn = document.getElementById('hintsToggleBtn');
  if (btn) btn.setAttribute('aria-pressed', String(on));
  if (!on) { closeTermPop(); hideTip(); }
}

export function setHints(on) {
  try { localStorage.setItem(HINTS_KEY, on ? '1' : '0'); } catch (e) { /* storage unavailable: this visit only */ }
  applyHintsSetting(on);
}

export { traitHintFor };

/* ---------- "?" buttons on headings ---------- */

// The heading's own words (its first text), without counters or badges that sit inside it.
function headingTextNode(el) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    if (n.parentElement && n.parentElement.closest('.term-help')) continue;
    if (n.textContent.trim()) return n;
  }
  return null;
}
function headingText(el) {
  const n = headingTextNode(el);
  return n ? n.textContent.replace(/\s+/g, ' ').trim() : '';
}

function makeHelpButton(term) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'term-help no-print';
  b.dataset.term = term.id;
  b.setAttribute('aria-label', `What is ${term.term}?`);
  b.setAttribute('aria-haspopup', 'dialog');
  b.textContent = '?';
  return b;
}

/** Add "?" buttons to headings and labels the glossary explains. Safe to call again. */
export function decorateSheet(root) {
  if (!root) return;
  const splat = (root.id || '').replace(/^splat-/, '');
  const used = new Set();
  const headings = root.querySelectorAll('.wod-header ~ * .section-title, .section-title, .section-title-sm, .sub-col-title, .pool-title, .text-label');
  headings.forEach(el => {
    if (el.querySelector(':scope > .term-help, :scope .term-help')) return;
    const term = termForHeading(headingText(el), splat);
    if (!term) return;
    // one "?" per term per sheet is enough (e.g. Willpower appears in two places on some lines)
    if (used.has(term.id)) return;
    used.add(term.id);
    // right after the words, before any counter or button that shares the heading
    headingTextNode(el).after(makeHelpButton(term));
  });
}

function closeTermPop() {
  if (!pop || pop.hidden) return;
  pop.hidden = true;
  if (popFor && popFor.isConnected) popFor.setAttribute('aria-expanded', 'false');
  popFor = null;
}

function openTermPop(btn) {
  const term = termById(btn.dataset.term);
  if (!term) return;
  if (popFor === btn && !pop.hidden) { closeTermPop(); return; }
  closeTermPop();
  pop.querySelector('.term-pop-title').textContent = term.term;
  pop.querySelector('.term-pop-text').textContent = term.text;
  pop.hidden = false;
  popFor = btn;
  btn.setAttribute('aria-expanded', 'true');
  const r = btn.getBoundingClientRect();
  const w = pop.offsetWidth;
  const h = pop.offsetHeight;
  let left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), window.innerWidth - w - 8);
  let top = r.bottom + 8;
  if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 8);
  pop.style.left = `${Math.round(left)}px`;
  pop.style.top = `${Math.round(top)}px`;
  pop.querySelector('.term-pop-more').focus({ preventScroll: true });
}

/* ---------- delayed tooltip on trait names (mouse only) ---------- */

function hideTip() {
  clearTimeout(tipTimer);
  tipTimer = 0;
  if (tip) tip.hidden = true;
}

function showTip(label) {
  if (!hintsOn()) return;
  const text = traitHintFor(label.textContent, api.getSplat());
  if (!text) return;
  tip.textContent = text;
  tip.hidden = false;
  const r = label.getBoundingClientRect();
  const w = tip.offsetWidth;
  const h = tip.offsetHeight;
  const left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
  let top = r.bottom + 6;
  if (top + h > window.innerHeight - 8) top = r.top - h - 6;
  tip.style.left = `${Math.round(left)}px`;
  tip.style.top = `${Math.round(top)}px`;
}

/* ---------- Guide: Glossary tab ---------- */

const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function renderGlossaryHtml(splat) {
  const terms = termsForLine(splat);
  const groups = TERM_GROUPS.map(([key, title]) => {
    const list = terms.filter(t => t.group === key).sort((a, b) => a.term.localeCompare(b.term));
    if (!list.length) return '';
    return `<h4 class="glossary-group">${esc(title)}</h4><dl class="glossary-list">${list.map(t => `<div class="glossary-item" id="gloss-${t.id}"><dt>${esc(t.term)}</dt><dd>${esc(t.text)}</dd></div>`).join('')}</dl>`;
  }).join('');
  return `<div class="glossary">
    <p class="glossary-intro">Plain-language notes for new players. The rulebook and your Storyteller have the final word.</p>
    ${groups}
    <p class="glossary-foot">Hover over a trait name for a one-line hint, or press <b>?</b> beside a heading. Already know the game? Turn the on-sheet hints off in <b>⋮ → Beginner Hints</b>.</p>
  </div>`;
}

/* ---------- setup ---------- */

export function initHints(options = {}) {
  api = { ...api, ...options };

  pop = document.createElement('div');
  pop.className = 'term-pop no-print';
  pop.setAttribute('role', 'dialog');
  pop.setAttribute('aria-label', 'Term explained');
  pop.hidden = true;
  pop.innerHTML = '<p class="term-pop-title"></p><p class="term-pop-text"></p><button type="button" class="term-pop-more">All terms in the Guide</button>';
  document.body.appendChild(pop);

  tip = document.createElement('div');
  tip.className = 'trait-tip no-print';
  tip.setAttribute('role', 'tooltip');
  tip.hidden = true;
  document.body.appendChild(tip);

  applyHintsSetting(hintsOn());
  document.querySelectorAll('.splat-container').forEach(decorateSheet);

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.term-help');
    if (btn) {
      // the "?" can sit inside a rollable pool title: don't add the pool to the dice
      e.preventDefault();
      e.stopPropagation();
      openTermPop(btn);
      return;
    }
    if (e.target.closest('.term-pop-more')) {
      const id = popFor && popFor.dataset.term;
      closeTermPop();
      api.openGlossary(id);
      return;
    }
    if (!e.target.closest('.term-pop')) closeTermPop();
  }, true);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && pop && !pop.hidden) {
      const back = popFor;
      closeTermPop();
      if (back && back.isConnected) back.focus({ preventScroll: true });
    }
    hideTip();
  });
  window.addEventListener('scroll', () => { closeTermPop(); hideTip(); }, { passive: true });
  window.addEventListener('resize', () => { closeTermPop(); hideTip(); });

  const sheet = document.getElementById('sheetForm');
  if (sheet) {
    sheet.addEventListener('pointerover', (e) => {
      if (e.pointerType !== 'mouse') return;
      const label = e.target.closest('.trait-row > .trait-label');
      if (!label) return;
      hideTip();
      tipTimer = setTimeout(() => showTip(label), TIP_DELAY_MS);
    });
    sheet.addEventListener('pointerout', (e) => {
      if (e.target.closest('.trait-row > .trait-label')) hideTip();
    });
    sheet.addEventListener('pointerdown', hideTip);
  }

  document.getElementById('hintsToggleBtn')?.addEventListener('click', () => setHints(!hintsOn()));
}

export const __test = { headingText };
export { TERMS };
