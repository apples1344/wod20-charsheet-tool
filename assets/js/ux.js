// Interface helpers that sit on top of the sheet: sticky mini-header (health, Willpower,
// quick rolls), "/" search, right-click / long-press roll menu, sliding section tabs,
// "saved x ago" badge and the backup reminder. app.js passes in what these need.

import { hintsOn, traitHintFor } from './hints.js';

const LAST_BACKUP_KEY = 'wod_sheet_last_backup_v1';
const EDITS_SINCE_BACKUP_KEY = 'wod_sheet_edits_since_backup_v1';
const BACKUP_NUDGE_EDITS = 150;
const BACKUP_NUDGE_DAYS = 14;

const $ = (id) => document.getElementById(id);
const isEditable = (el) => !!(el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)));
const storeGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const storeSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } };

export function initUx(api) {
  initQuickNavIndicator();
  initMiniHeader(api);
  initSearch(api);
  initRollMenu(api);
  initSavedClock();
}

/* ---------- sliding pill behind the active section tab ---------- */
function initQuickNavIndicator() {
  const nav = document.querySelector('.quick-nav');
  const pill = nav && nav.querySelector('.quick-nav-indicator');
  if (!nav || !pill) return;
  const place = () => {
    const btn = nav.querySelector('.quick-nav-btn.active') || nav.querySelector('.quick-nav-btn');
    if (!btn) return;
    pill.style.setProperty('--x', btn.offsetLeft + 'px');
    pill.style.setProperty('--w', btn.offsetWidth + 'px');
    if (!nav.classList.contains('has-indicator')) nav.classList.add('has-indicator'); // add() always writes the attribute, which would re-trigger the observer
  };
  // watch only the buttons: the nav's own class changes when the pill first appears
  nav.querySelectorAll('.quick-nav-btn').forEach(b => new MutationObserver(place).observe(b, { attributes: true, attributeFilter: ['class'] }));
  window.addEventListener('resize', place);
  requestAnimationFrame(place);
}

/* ---------- sticky mini-header ---------- */
function initMiniHeader(api) {
  const bar = $('miniHeader');
  const sheet = $('sheetForm');
  if (!bar || !sheet) return;
  let raf = 0;
  const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); }); };

  const activeRoot = () => document.getElementById('splat-' + api.getSplat());
  const healthBoxes = (root) => {
    const sp = api.getSplat();
    return Array.from(root.querySelectorAll(`.health-box[data-id^="${sp}_hlth"]`)).slice(0, 7);
  };

  function render() {
    const root = activeRoot();
    if (!root) return;
    const sp = api.getSplat();
    // visibility: once the character's identity block has scrolled under the app bar
    const idBlock = root.querySelector('.row');
    const barH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--app-bar-height'), 10) || 0;
    const show = idBlock ? idBlock.getBoundingClientRect().bottom < barH : false;
    if (bar.hidden === show) {
      bar.hidden = !show;
      document.body.classList.toggle('has-mini-header', show);
    }
    if (!show) return;

    const name = ($(`${sp}_char_name`) || {}).value || '';
    $('miniName').textContent = name.trim() || 'Unnamed character';
    const wound = api.getWound();
    const wEl = $('miniWound');
    wEl.textContent = wound.incapacitated ? 'Incapacitated' : (wound.penalty < 0 ? wound.label : 'Healthy');
    wEl.className = 'mini-wound' + (wound.incapacitated ? ' is-incap' : (wound.penalty < 0 ? ' is-hurt' : ''));

    const src = healthBoxes(root);
    const mh = $('miniHealth');
    if (mh.children.length !== src.length) {
      mh.replaceChildren(...src.map((_, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'mini-hbox';
        b.dataset.idx = String(i);
        return b;
      }));
    }
    src.forEach((box, i) => {
      const b = mh.children[i];
      const state = box.dataset.state || 'empty';
      b.dataset.state = state;
      b.textContent = box.textContent;
      const label = box.closest('tr')?.querySelector('.ht-label')?.textContent.trim() || `Level ${i + 1}`;
      b.setAttribute('aria-label', `${label}: ${state}. Click to add damage, right-click to remove.`);
      b.title = `${label}: ${state}`;
    });

    const wpSq = root.querySelector(`[data-id="${sp}_wp_sq"]`);
    const wpDots = root.querySelector(`[data-id="${sp}_wp_dots"]`);
    const cur = wpSq ? parseInt(wpSq.dataset.val || '0', 10) : 0;
    const max = wpDots ? parseInt(wpDots.dataset.val || '0', 10) : 0;
    $('miniWpVal').textContent = `${cur}/${max}`;
    $('miniWpMinus').disabled = !wpSq || cur <= 0;
    $('miniWpPlus').disabled = !wpSq || cur >= 10;
  }

  $('miniHealth').addEventListener('click', (e) => {
    const b = e.target.closest('.mini-hbox');
    if (!b) return;
    const src = healthBoxes(activeRoot())[parseInt(b.dataset.idx, 10)];
    if (src) src.click();
  });
  $('miniHealth').addEventListener('contextmenu', (e) => {
    const b = e.target.closest('.mini-hbox');
    if (!b) return;
    e.preventDefault();
    const src = healthBoxes(activeRoot())[parseInt(b.dataset.idx, 10)];
    if (src) src.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
  });
  const stepWp = (delta) => {
    const sp = api.getSplat();
    const wpSq = activeRoot()?.querySelector(`[data-id="${sp}_wp_sq"]`);
    if (!wpSq) return;
    const cur = parseInt(wpSq.dataset.val || '0', 10);
    api.setTrack(wpSq, Math.max(0, Math.min(10, cur + delta)));
  };
  $('miniWpMinus').addEventListener('click', () => stepWp(-1));
  $('miniWpPlus').addEventListener('click', () => stepWp(1));
  $('miniInitBtn').addEventListener('click', () => api.rollInitiative());
  $('miniWpRollBtn').addEventListener('click', () => api.rollWillpower());

  new MutationObserver(schedule).observe(sheet, { subtree: true, attributes: true, attributeFilter: ['data-state', 'data-val'] });
  sheet.addEventListener('input', schedule);
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  document.addEventListener('wod:splatchange', schedule);
  schedule();
}

/* ---------- "/" search ---------- */
function initSearch(api) {
  const dlg = $('searchDialog');
  const input = $('searchInput');
  const list = $('searchResults');
  const btn = $('searchBtn');
  if (!dlg || !input || !list) return;
  let items = [];
  let shown = [];
  let sel = 0;

  function buildIndex() {
    const root = document.getElementById('splat-' + api.getSplat());
    if (!root) return [];
    const out = [];
    let section = '';
    let group = '';
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    for (let el = walker.currentNode; el; el = walker.nextNode()) {
      if (el.matches('.wod-header h2')) { section = el.textContent.trim(); group = ''; out.push({ label: section, ctx: 'Section', el: el.closest('.wod-header'), kind: 'section' }); continue; }
      if (el.matches('.section-title')) { group = ''; out.push({ label: el.textContent.trim(), ctx: section, el, kind: 'section' }); section = el.textContent.trim(); continue; }
      if (el.matches('.sub-col-title, .section-title-sm')) { group = el.textContent.trim(); out.push({ label: group, ctx: section, el, kind: 'group' }); continue; }
      if (el.matches('.trait-row > .trait-label')) {
        out.push({ label: el.textContent.trim(), ctx: [section, group].filter(Boolean).join(' · '), el: el.closest('.trait-row'), kind: 'trait', rollEl: el });
        continue;
      }
      if (el.matches('.pool-box .pool-title')) {
        const t = (el.querySelector('.pool-title-text') || el).textContent.trim();
        const custom = el.closest('.pool-box').querySelector('input[type="text"]');
        out.push({ label: (custom && custom.value.trim()) || t, ctx: [section, 'Pool'].filter(Boolean).join(' · '), el: el.closest('.pool-box'), kind: 'trait', rollEl: el });
        continue;
      }
      if (el.matches('.trait-flex-row input.trait-name-input') && el.value.trim()) {
        out.push({ label: el.value.trim(), ctx: [section, group].filter(Boolean).join(' · '), el: el.closest('.trait-flex-row'), kind: 'trait', rollEl: el.closest('.trait-flex-row').querySelector('.roll-trait-mini-btn') });
        continue;
      }
      if (el.matches('.text-row > .text-label')) {
        out.push({ label: el.textContent.replace(/:\s*$/, '').trim(), ctx: [section, 'Field'].filter(Boolean).join(' · '), el: el.closest('.text-row'), kind: 'field' });
      }
    }
    return out.filter(i => i.label);
  }

  const norm = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  function score(item, q) {
    const l = norm(item.label);
    if (l === q) return 0;
    if (l.startsWith(q)) return 1;
    if (l.split(/[\s/(-]+/).some(w => w.startsWith(q))) return 2;
    if (l.includes(q)) return 3;
    if (norm(item.ctx).includes(q)) return 4;
    return -1;
  }

  function renderList() {
    const q = norm(input.value.trim());
    shown = q
      ? items.map(i => [i, score(i, q)]).filter(([, s]) => s >= 0).sort((a, b) => a[1] - b[1]).slice(0, 40).map(([i]) => i)
      : items.filter(i => i.kind === 'section').slice(0, 40);
    sel = Math.min(sel, Math.max(0, shown.length - 1));
    list.replaceChildren(...shown.map((it, idx) => {
      const li = document.createElement('li');
      li.id = 'sr-' + idx;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', String(idx === sel));
      li.className = 'search-item' + (idx === sel ? ' is-sel' : '');
      const a = document.createElement('span'); a.className = 'search-label'; a.textContent = it.label;
      const b = document.createElement('span'); b.className = 'search-ctx'; b.textContent = it.ctx;
      li.append(a, b);
      if (it.kind === 'trait') { const r = document.createElement('span'); r.className = 'search-roll'; r.textContent = 'd10'; r.title = 'Shift+Enter rolls it'; li.append(r); }
      li.addEventListener('mousemove', () => { if (sel !== idx) { sel = idx; renderList(); } });
      li.addEventListener('click', (ev) => go(it, ev.shiftKey));
      return li;
    }));
    if (!shown.length) {
      const li = document.createElement('li');
      li.className = 'search-empty';
      li.textContent = 'Nothing on this sheet matches.';
      list.append(li);
    }
    input.setAttribute('aria-activedescendant', shown.length ? 'sr-' + sel : '');
    list.querySelector('.is-sel')?.scrollIntoView({ block: 'nearest' });
  }

  function go(item, roll) {
    dlg.close();
    if (!item) return;
    const target = item.el;
    target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    target.classList.remove('search-flash');
    void target.offsetWidth;
    target.classList.add('search-flash');
    setTimeout(() => target.classList.remove('search-flash'), 1600);
    const focusable = target.querySelector('input, textarea, .dot, .square-box, button');
    if (focusable && !roll) setTimeout(() => focusable.focus({ preventScroll: true }), 350);
    if (roll && item.rollEl) api.rollNow(item.rollEl, {});
  }

  function open() {
    if (dlg.open) return;
    items = buildIndex();
    input.value = '';
    sel = 0;
    renderList();
    dlg.showModal();
    input.focus();
  }

  input.addEventListener('input', () => { sel = 0; renderList(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(shown.length - 1, sel + 1); renderList(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); renderList(); }
    else if (e.key === 'Enter') { e.preventDefault(); go(shown[sel], e.shiftKey); }
  });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  if (btn) btn.addEventListener('click', open);
  document.addEventListener('keydown', (e) => {
    if (document.querySelector('dialog[open]')) return;
    if ((e.key === '/' && !isEditable(e.target)) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
      e.preventDefault();
      open();
    }
  });
}

/* ---------- right-click / long-press roll menu on traits ---------- */
function initRollMenu(api) {
  const menu = $('rollMenu');
  const sheet = $('sheetForm');
  if (!menu || !sheet) return;
  const TARGET = '.trait-row > .trait-label, .pool-box.rollable-pool .pool-title, .roll-trait-mini-btn';
  let current = null;
  let returnFocus = null;

  function openAt(el, x, y) {
    current = el;
    returnFocus = document.activeElement;
    const row = el.closest('.trait-row, .pool-box, .trait-flex-row');
    const name = row?.querySelector('.trait-label, .pool-title-text, input.trait-name-input');
    const label = name ? (name.value || name.textContent || '').trim() : 'Trait';
    const spec = row?.querySelector('.trait-spec-input')?.value.trim();
    $('rollMenuTitle').textContent = label || 'Trait';
    const hintEl = $('rollMenuHint');
    if (hintEl) {
      const hint = hintsOn() && row?.matches('.trait-row') ? traitHintFor(label, api.getSplat()) : '';
      hintEl.textContent = hint;
      hintEl.hidden = !hint;
    }
    menu.querySelector('[data-act="spec"]').hidden = !spec;
    if (spec) menu.querySelector('[data-act="spec"]').textContent = `Roll with Specialty (${spec})`;
    menu.hidden = false;
    const r = menu.getBoundingClientRect();
    menu.style.left = Math.min(x, window.innerWidth - r.width - 8) + 'px';
    menu.style.top = Math.min(y, window.innerHeight - r.height - 8) + 'px';
    menu.querySelector('button:not([hidden])').focus();
  }
  function close(restore = true) {
    if (menu.hidden) return;
    menu.hidden = true;
    if (restore && returnFocus && returnFocus.focus) returnFocus.focus({ preventScroll: true });
    current = null;
  }

  sheet.addEventListener('contextmenu', (e) => {
    const el = e.target.closest(TARGET);
    if (!el) return;
    e.preventDefault();
    openAt(el, e.clientX, e.clientY);
  });
  // long-press on touch screens
  let timer = 0;
  let start = null;
  sheet.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    const el = e.target.closest(TARGET);
    if (!el) return;
    start = { x: e.clientX, y: e.clientY };
    timer = setTimeout(() => {
      timer = 0;
      if (navigator.vibrate) navigator.vibrate(10);
      openAt(el, e.clientX, e.clientY);
      el.dataset.suppressClick = '1';
    }, 520);
  });
  const cancel = (e) => {
    if (timer && (!start || !e || Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10 || e.type !== 'pointermove')) {
      clearTimeout(timer);
      timer = 0;
    }
  };
  sheet.addEventListener('pointermove', cancel);
  sheet.addEventListener('pointerup', cancel);
  sheet.addEventListener('pointercancel', cancel);
  sheet.addEventListener('click', (e) => {
    const el = e.target.closest(TARGET);
    if (el && el.dataset.suppressClick) { delete el.dataset.suppressClick; e.stopImmediatePropagation(); e.preventDefault(); }
  }, true);

  // keyboard: Shift+F10 / ContextMenu key on a focused trait
  sheet.addEventListener('keydown', (e) => {
    if (!(e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10'))) return;
    const row = e.target.closest('.trait-row, .pool-box.rollable-pool, .trait-flex-row');
    const el = row && row.querySelector('.trait-label, .pool-title, .roll-trait-mini-btn');
    if (!el) return;
    e.preventDefault();
    const r = el.getBoundingClientRect();
    openAt(el, r.left, r.bottom + 4);
  });

  menu.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b || !current) return;
    const el = current;
    close(false);
    const act = b.dataset.act;
    if (act === 'add') api.addToPool(el);
    else api.rollNow(el, { specialty: act === 'spec', willpower: act === 'wp' });
  });
  menu.addEventListener('keydown', (e) => {
    const btns = Array.from(menu.querySelectorAll('button:not([hidden])'));
    const i = btns.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); btns[(i + 1) % btns.length].focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); btns[(i - 1 + btns.length) % btns.length].focus(); }
    else if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); close(); }
  });
  document.addEventListener('pointerdown', (e) => { if (!menu.hidden && !menu.contains(e.target)) close(false); });
  window.addEventListener('scroll', () => close(false), { passive: true });
}

/* ---------- "Saved 2 min ago" + backup reminder ---------- */
let lastSavedAt = 0;
let nudged = false;

export function noteSaved(ok) {
  if (!ok) return;
  lastSavedAt = Date.now();
  const n = (parseInt(storeGet(EDITS_SINCE_BACKUP_KEY) || '0', 10) || 0) + 1;
  storeSet(EDITS_SINCE_BACKUP_KEY, String(n));
  tickSavedLabel();
  maybeNudgeBackup(n);
}

export function noteBackedUp() {
  storeSet(LAST_BACKUP_KEY, String(Date.now()));
  storeSet(EDITS_SINCE_BACKUP_KEY, '0');
  document.getElementById('backupNudge')?.remove();
}

function tickSavedLabel() {
  const badge = $('autosaveIndicator');
  if (!badge || !lastSavedAt || badge.classList.contains('failed') || !badge.classList.contains('saved')) return;
  // "Saved 11 min ago" read as stale when nothing had changed since; the time is in the tooltip.
  badge.textContent = (Date.now() - lastSavedAt) < 45000 ? 'Saved just now' : 'All changes saved';
  badge.title = `Saved in this browser at ${new Date(lastSavedAt).toLocaleTimeString()}`;
}

function initSavedClock() {
  setInterval(tickSavedLabel, 30000);
}

function maybeNudgeBackup(edits) {
  if (nudged) return;
  const last = parseInt(storeGet(LAST_BACKUP_KEY) || '0', 10) || 0;
  const days = last ? (Date.now() - last) / 86400000 : Infinity;
  const due = edits >= BACKUP_NUDGE_EDITS || (days >= BACKUP_NUDGE_DAYS && edits >= 20);
  if (!due) return;
  nudged = true;
  const bar = document.createElement('div');
  bar.id = 'backupNudge';
  bar.className = 'update-banner backup-nudge no-print';
  bar.setAttribute('role', 'status');
  bar.innerHTML = '<span>Your characters live only in this browser. Download a backup?</span><button type="button" class="btn btn-sm btn-accent">Download backup</button><button type="button" class="btn btn-sm">Later</button>';
  const [dl, later] = bar.querySelectorAll('button');
  dl.addEventListener('click', () => { document.getElementById('exportRosterBtn')?.click(); bar.remove(); });
  later.addEventListener('click', () => bar.remove());
  document.body.appendChild(bar);
}
