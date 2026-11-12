import { SAMPLE_CHARACTERS } from './sampleCharacters.js';

const STORAGE_KEY = 'wod_1to1_sheet_v3';
const SHARE_DOMAIN_PLACEHOLDER = 'https://wod20-charsheet-tool.vercel.app/';
const DEFAULT_MF_ROWS = 5;
const DEFAULT_COMBAT_ROWS = 6;
let lastSharedSnapshot = '';
let isTenDotMode = false;
let isRestoring = false;
let isSheetDirty = false;
let pendingSampleKey = '';
let autoSaveTimer = null;
let resizeTimer = null;
let currentSplat = 'mortal';

const HEALTH_STATES = ['empty', 'bashing', 'lethal', 'aggravated'];
const HEALTH_SYMBOLS = { empty: '', bashing: '/', lethal: 'X', aggravated: '*' };
const HEALTH_PENALTIES = [
  { label: 'Healthy (0)', cls: '' },
  { label: '-1 Penalty', cls: 'penalty-low' },
  { label: '-1 Penalty', cls: 'penalty-low' },
  { label: '-2 Penalty', cls: 'penalty-low' },
  { label: '-2 Penalty', cls: 'penalty-low' },
  { label: '-5 Penalty', cls: 'penalty-high' },
  { label: 'Incapacitated', cls: 'penalty-high' }
];

document.addEventListener('DOMContentLoaded', async () => {
  document.querySelectorAll('textarea.sheet-area').forEach(ta => {
    ta.dataset.defaultHeight = ta.style.height || '';
  });
  syncAppBarOffset();
  initDotsAndBoxes();
  initHealthBoxes();
  bindControls();
  bindDragAndDrop();
  bindGuide();
  updateGuidePanel();
  registerServiceWorker();

  const loaded = await checkUrlForCharacter();
  if (!loaded) {
    restoreFromLocalStorage();
  } else {
    isRestoring = true;
    switchSplat(currentSplat);
    isRestoring = false;
    scheduleAutoSave();
  }
  isSheetDirty = false;
});

function bindControls() {
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      saveAsJson();
      showToast('Saved JSON to Disk');
      return;
    }
    if (e.key === 'Escape') {
      const hardResetModal = document.getElementById('hardResetModal');
      if (hardResetModal && hardResetModal.style.display !== 'none') {
        hardResetModal.style.display = 'none';
        return;
      }
      const clearModal = document.getElementById('clearModal');
      if (clearModal && clearModal.style.display !== 'none') {
        clearModal.style.display = 'none';
        return;
      }
      const sampleModal = document.getElementById('sampleConfirmModal');
      if (sampleModal && sampleModal.style.display !== 'none') {
        sampleModal.style.display = 'none';
        document.getElementById('sampleCharSelect').value = '';
        pendingSampleKey = '';
        return;
      }
      const guidePanel = document.getElementById('guidePanel');
      if (guidePanel && guidePanel.classList.contains('open')) {
        guidePanel.classList.remove('open');
        const toggleBtn = document.getElementById('toggleGuideBtn');
        if (toggleBtn) toggleBtn.focus();
      }
    }
  });

  window.addEventListener('resize', () => {
    syncAppBarOffset();
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const active = document.getElementById('splat-' + currentSplat);
      if (active) autoResizeTextareas(active);
    }, 150);
  });

  window.addEventListener('scroll', updateActiveQuickNav, { passive: true });

  // Quick-Jump Section Bar
  document.querySelectorAll('.quick-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      jumpToSection(btn.dataset.jump);
    });
  });

  document.getElementById('splatSelect').addEventListener('change', (e) => {
    flushAutoSave();
    document.getElementById('sampleCharSelect').value = '';
    switchSplat(e.target.value);
    isSheetDirty = false;
  });

  // Sample Character Selection with Overwrite Guard
  document.getElementById('sampleCharSelect').addEventListener('change', (e) => {
    const key = e.target.value;
    if (!key) return;
    if (isSheetDirty && hasActiveSheetData()) {
      pendingSampleKey = key;
      document.getElementById('sampleConfirmModal').style.display = 'flex';
    } else {
      loadSampleCharacter(key);
    }
  });

  document.getElementById('cancelSampleBtn').addEventListener('click', () => {
    document.getElementById('sampleConfirmModal').style.display = 'none';
    document.getElementById('sampleCharSelect').value = '';
    pendingSampleKey = '';
  });

  document.getElementById('confirmSampleBtn').addEventListener('click', () => {
    document.getElementById('sampleConfirmModal').style.display = 'none';
    const key = pendingSampleKey;
    pendingSampleKey = '';
    if (key) loadSampleCharacter(key);
  });

  document.getElementById('dotToggleBtn').addEventListener('click', () => {
    isTenDotMode = !isTenDotMode;
    document.body.classList.toggle('mode-10-dot', isTenDotMode);
    document.getElementById('dotToggleBtn').textContent = isTenDotMode ? '5-Dot Mode' : '10-Dot Mode';
    isSheetDirty = true;
    scheduleAutoSave();
  });

  document.getElementById('resetSheetBtn').addEventListener('click', () => {
    document.getElementById('clearModal').style.display = 'flex';
  });
  document.getElementById('cancelClearBtn').addEventListener('click', () => {
    document.getElementById('clearModal').style.display = 'none';
  });
  document.getElementById('confirmClearBtn').addEventListener('click', () => {
    document.getElementById('clearModal').style.display = 'none';
    document.getElementById('sampleCharSelect').value = '';
    clearSheet(false);
    isSheetDirty = false;
    showToast('Sheet Cleared');
  });

  document.getElementById('hardResetBtn').addEventListener('click', () => {
    document.getElementById('hardResetModal').style.display = 'flex';
  });
  document.getElementById('cancelHardResetBtn').addEventListener('click', () => {
    document.getElementById('hardResetModal').style.display = 'none';
  });
  document.getElementById('confirmHardResetBtn').addEventListener('click', () => {
    document.getElementById('hardResetModal').style.display = 'none';
    hardResetWebsite();
  });

  window.addEventListener('beforeprint', () => {
    const active = document.getElementById('splat-' + currentSplat);
    if (active) autoResizeTextareas(active);
    ensureSyncShareLinkForPrint();
  });
  document.getElementById('printSheetBtn').addEventListener('click', async () => {
    const active = document.getElementById('splat-' + currentSplat);
    if (active) autoResizeTextareas(active);

    await generateShareUrl({ copyToClipboard: true, showNotification: true });
    window.print();
  });

  document.getElementById('shareUrlBtn').addEventListener('click', () => {
    generateShareUrl({ copyToClipboard: true, showNotification: true });
  });
  document.getElementById('saveJsonBtn').addEventListener('click', saveAsJson);
  document.getElementById('loadJsonBtn').addEventListener('click', () => document.getElementById('jsonFileInput').click());
  document.getElementById('jsonFileInput').addEventListener('change', loadFromJson);

  // Add / Remove Merit, Flaw, Advantage, Custom Ability, Combat, and Heal slots (event delegation)
  document.getElementById('sheetForm').addEventListener('click', (e) => {
    const addMfBtn = e.target.closest('.addTraitRowBtn');
    if (addMfBtn) {
      const splat = addMfBtn.dataset.splat;
      const kind = addMfBtn.dataset.kind;
      const row = addMeritFlawRow(splat, kind);
      if (row) {
        const firstInput = row.querySelector('input');
        if (firstInput) firstInput.focus();
      }
      isSheetDirty = true;
      scheduleAutoSave();
      return;
    }

    const removeMfBtn = e.target.closest('.removeTraitRowBtn');
    if (removeMfBtn) {
      const tr = removeMfBtn.closest('tr');
      const tbody = tr ? tr.parentElement : null;
      if (tr && tbody) {
        tr.remove();
        reindexMeritFlawRows(tbody);
        isSheetDirty = true;
        scheduleAutoSave();
      }
      return;
    }

    const addDynBtn = e.target.closest('.addDynRowBtn');
    if (addDynBtn) {
      const splat = addDynBtn.dataset.splat;
      const kind = addDynBtn.dataset.kind;
      const row = addDynRow(splat, kind);
      if (row) {
        const firstInput = row.querySelector('input');
        if (firstInput) firstInput.focus();
      }
      isSheetDirty = true;
      scheduleAutoSave();
      return;
    }

    const removeDynBtn = e.target.closest('.removeDynRowBtn');
    if (removeDynBtn) {
      const tr = removeDynBtn.closest('.trait-flex-row');
      const tbody = tr ? tr.parentElement : null;
      if (tr && tbody) {
        tr.remove();
        reindexDynRows(tbody);
        updateGuideTally();
        isSheetDirty = true;
        scheduleAutoSave();
      }
      return;
    }

    const addAbiBtn = e.target.closest('.addCustomAbiBtn');
    if (addAbiBtn) {
      const splat = addAbiBtn.dataset.splat;
      const cat = parseInt(addAbiBtn.dataset.cat, 10);
      const row = addCustomAbiRow(splat, cat);
      if (row) {
        const firstInput = row.querySelector('input');
        if (firstInput) firstInput.focus();
      }
      isSheetDirty = true;
      scheduleAutoSave();
      return;
    }

    const removeAbiBtn = e.target.closest('.removeCustomAbiBtn');
    if (removeAbiBtn) {
      const tr = removeAbiBtn.closest('.trait-flex-row');
      const tbody = tr ? tr.parentElement : null;
      if (tr && tbody) {
        tr.remove();
        reindexCustomAbiRows(tbody);
        updateGuideTally();
        isSheetDirty = true;
        scheduleAutoSave();
      }
      return;
    }

    const addCombatBtn = e.target.closest('.addCombatRowBtn');
    if (addCombatBtn) {
      const splat = addCombatBtn.dataset.splat;
      const hasPathos = addCombatBtn.dataset.pathos === '1';
      const row = addCombatRow(splat, hasPathos);
      if (row) {
        const firstInput = row.querySelector('input');
        if (firstInput) firstInput.focus();
      }
      isSheetDirty = true;
      scheduleAutoSave();
      return;
    }

    const removeCombatBtn = e.target.closest('.removeCombatRowBtn');
    if (removeCombatBtn) {
      const tr = removeCombatBtn.closest('tr');
      const tbody = tr ? tr.parentElement : null;
      if (tr && tbody) {
        tr.remove();
        reindexCombatRows(tbody);
        isSheetDirty = true;
        scheduleAutoSave();
      }
      return;
    }

    const healBtn = e.target.closest('.clearHealthBtn');
    if (healBtn) {
      const splat = healBtn.dataset.splat;
      const container = document.getElementById('splat-' + splat);
      if (container) {
        container.querySelectorAll('.health-box').forEach(box => {
          box.dataset.state = 'empty';
          box.textContent = '';
          updateHealthAriaLabel(box);
        });
        updateWoundPenalty(splat);
        isSheetDirty = true;
        scheduleAutoSave();
        showToast('Health Cleared');
      }
    }
  });

  let activeTarget = null;
  document.querySelectorAll('.uploadPortraitBtn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      activeTarget = e.target.dataset.target;
      document.getElementById('globalPortraitInput').click();
    });
  });
  document.getElementById('globalPortraitInput').addEventListener('change', (e) => {
    if (!activeTarget || !e.target.files[0]) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 500;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) { height = Math.round((height * maxDim) / width); width = maxDim; }
          else { width = Math.round((width * maxDim) / height); height = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        document.getElementById(activeTarget + '_portrait_url').value = dataUrl;
        updatePortrait(activeTarget, dataUrl);
        isSheetDirty = true;
        scheduleAutoSave();
      };
      img.src = evt.target.result;
    };
    reader.readAsDataURL(e.target.files[0]);
    e.target.value = '';
  });
  document.querySelectorAll('.clearPortraitBtn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const t = e.target.dataset.target;
      document.getElementById(t + '_portrait_url').value = '';
      updatePortrait(t, '');
      isSheetDirty = true;
      scheduleAutoSave();
    });
  });
  document.querySelectorAll('input[id$="_portrait_url"]').forEach(inp => {
    inp.addEventListener('input', (e) => {
      const t = e.target.id.split('_portrait_url')[0];
      updatePortrait(t, e.target.value);
      isSheetDirty = true;
      scheduleAutoSave();
    });
  });

  document.getElementById('sheetForm').addEventListener('input', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      isSheetDirty = true;
      scheduleAutoSave();
      if (e.target.id === currentSplat + '_char_name') {
        updateDocumentTitle();
      }
    }
  });
}

function bindDragAndDrop() {
  let dragDepth = 0;
  const overlay = document.getElementById('dropOverlay');
  if (!overlay) return;

  document.addEventListener('dragenter', (e) => {
    if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) {
      e.preventDefault();
      dragDepth++;
      overlay.style.display = 'flex';
    }
  });

  document.addEventListener('dragover', (e) => {
    if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) {
      e.preventDefault();
    }
  });

  document.addEventListener('dragleave', (e) => {
    if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) {
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) {
        overlay.style.display = 'none';
      }
    }
  });

  document.addEventListener('drop', (e) => {
    dragDepth = 0;
    overlay.style.display = 'none';
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (!file.name.toLowerCase().endsWith('.json') && file.type !== 'application/json') {
        showToast('Please drop a .json character file');
        return;
      }
      importJsonFile(file);
    }
  });
}

function syncAppBarOffset() {
  const appBar = document.querySelector('.app-bar');
  const height = appBar ? appBar.offsetHeight : 56;
  document.documentElement.style.setProperty('--app-bar-height', `${height}px`);
  return height;
}

function getSectionHeaderMap(activeContainer) {
  const headers = Array.from(activeContainer.querySelectorAll('.wod-header'));
  return {
    traits: headers[0] || null,
    mechanics: headers.find(h => h.textContent.trim().toLowerCase() === 'mechanics') || headers[1] || null,
    gear: headers.find(h => h.textContent.trim().toLowerCase() === 'backgrounds & gear') || headers[2] || null,
    bio: headers.find(h => h.textContent.trim().toLowerCase() === 'description & history') || headers[3] || null
  };
}

function setActiveQuickNavButton(section) {
  document.querySelectorAll('.quick-nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.jump === section);
  });
}

function updateActiveQuickNav() {
  const active = document.getElementById('splat-' + currentSplat);
  if (!active) return;
  const barHeight = syncAppBarOffset();
  const threshold = barHeight + 48;
  const map = getSectionHeaderMap(active);
  const order = ['traits', 'mechanics', 'gear', 'bio'];
  let currentSection = 'traits';

  for (const key of order) {
    const el = map[key];
    if (el && el.getBoundingClientRect().top <= threshold) {
      currentSection = key;
    }
  }
  setActiveQuickNavButton(currentSection);
}

function jumpToSection(section) {
  const active = document.getElementById('splat-' + currentSplat);
  if (!active) return;
  const barHeight = syncAppBarOffset();
  const map = getSectionHeaderMap(active);
  const target = map[section];
  if (!target) return;

  setActiveQuickNavButton(section);
  if (section === 'traits') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  const top = target.getBoundingClientRect().top + window.scrollY - barHeight - 20;
  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
}

function hasActiveSheetData() {
  const active = document.getElementById('splat-' + currentSplat);
  if (!active) return false;
  for (const el of active.querySelectorAll('input[type=text], textarea')) {
    if (el.value && el.value.trim().length > 0) return true;
  }
  for (const el of active.querySelectorAll('.dots-container, .boxes-container')) {
    if (parseInt(el.dataset.val || '0', 10) > 0) return true;
  }
  for (const el of active.querySelectorAll('.health-box')) {
    if (el.dataset.state && el.dataset.state !== 'empty') return true;
  }
  return false;
}

function getTraitContextLabel(container) {
  const row = container.closest('.trait-row, .trait-flex-row, .pool-box');
  if (!row) return container.dataset.id || 'Trait';
  const lbl = row.querySelector('.trait-label, .pool-title');
  if (lbl && lbl.textContent.trim()) return lbl.textContent.trim();
  const inp = row.querySelector('input.trait-name-input');
  if (inp && inp.value.trim()) return inp.value.trim();
  return container.dataset.id || 'Trait';
}

function bindDotContainer(container) {
  const isSquare = container.classList.contains('boxes-container');
  const childClass = isSquare ? 'square-box' : 'dot';
  const contextLabel = getTraitContextLabel(container);
  container.querySelectorAll('.' + childClass).forEach(el => {
    el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', `${contextLabel} ${isSquare ? 'box' : 'dot'} ${el.dataset.idx}`);
    const clickHandler = () => {
      const current = parseInt(container.dataset.val || '0', 10);
      const idx = parseInt(el.dataset.idx, 10);
      const next = current === idx ? Math.max(0, idx - 1) : idx;
      container.dataset.val = next;
      updateVisual(container, next, childClass);
      if (!isSquare) updateGuideTally();
      isSheetDirty = true;
      scheduleAutoSave();
    };
    el.addEventListener('click', clickHandler);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        clickHandler();
      }
    });
  });
}

function addMeritFlawRow(splat, kind) {
  const tbody = document.getElementById(`${splat}_${kind}_tbody`);
  if (!tbody) return null;
  const idx = tbody.children.length;
  const label = kind === 'merit' ? 'Remove Merit' : 'Remove Flaw';
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" id="${splat}_${kind}_${idx}_name"></td>
    <td><input type="text" id="${splat}_${kind}_${idx}_type"></td>
    <td><input type="text" id="${splat}_${kind}_${idx}_cost"></td>
    <td class="no-print td-action"><button type="button" class="btn-icon-remove removeTraitRowBtn" title="${label}" aria-label="${label}">&times;</button></td>
  `;
  tbody.appendChild(tr);
  return tr;
}

function reindexMeritFlawRows(tbody) {
  const match = tbody.id.match(/^([a-z]+)_(merit|flaw)_tbody$/);
  if (!match) return;
  const [, splat, kind] = match;
  const fields = ['name', 'type', 'cost'];
  Array.from(tbody.querySelectorAll('tr')).forEach((tr, rowIdx) => {
    const inputs = tr.querySelectorAll('input[type=text]');
    fields.forEach((field, colIdx) => {
      if (inputs[colIdx]) {
        inputs[colIdx].id = `${splat}_${kind}_${rowIdx}_${field}`;
      }
    });
  });
}

function setMeritFlawRowCount(splat, kind, count) {
  const tbody = document.getElementById(`${splat}_${kind}_tbody`);
  if (!tbody) return;
  while (tbody.children.length < count) {
    addMeritFlawRow(splat, kind);
  }
  while (tbody.children.length > count) {
    tbody.lastElementChild.remove();
  }
  reindexMeritFlawRows(tbody);
}

function addCustomAbiRow(splat, catIdx) {
  const tbody = document.getElementById(`${splat}_custom_abi_${catIdx}_tbody`);
  if (!tbody) return null;
  const idx = tbody.children.length;

  const tr = document.createElement('div');
  tr.className = 'trait-flex-row';

  let html = `<input type="text" class="trait-name-input" id="${splat}_custom_abi_${catIdx}_${idx}_name" placeholder="Secondary Ability">`;
  html += `<input type="text" class="trait-spec-input" id="${splat}_custom_abi_${catIdx}_${idx}_spec" placeholder="Spec" title="Trait Specialty (e.g. Revolvers, Fast-Talk)" aria-label="Specialty">`;
  html += `<div class="dots-container" data-id="${splat}_custom_abi_${catIdx}_${idx}_dots" data-val="0">`;
  for (let i = 1; i <= 10; i++) {
    html += `<span class="dot${i > 5 ? ' dot-scalable-10' : ''}" data-idx="${i}"></span>`;
  }
  html += `</div>`;
  html += `<button type="button" class="btn-icon-remove removeCustomAbiBtn no-print" style="margin-left:4px;" title="Remove Ability" aria-label="Remove Ability">&times;</button>`;

  tr.innerHTML = html;
  tbody.appendChild(tr);

  const container = tr.querySelector('.dots-container');
  bindDotContainer(container);
  return tr;
}

function reindexCustomAbiRows(tbody) {
  const match = tbody.id.match(/^([a-z]+)_custom_abi_(\d)_tbody$/);
  if (!match) return;
  const [, splat, catIdx] = match;
  Array.from(tbody.children).forEach((row, rowIdx) => {
    const nameInp = row.querySelector('input.trait-name-input');
    if (nameInp) nameInp.id = `${splat}_custom_abi_${catIdx}_${rowIdx}_name`;
    const specInp = row.querySelector('input.trait-spec-input');
    if (specInp) specInp.id = `${splat}_custom_abi_${catIdx}_${rowIdx}_spec`;
    const dots = row.querySelector('.dots-container');
    if (dots) dots.dataset.id = `${splat}_custom_abi_${catIdx}_${rowIdx}_dots`;
  });
}

function setCustomAbiRowCount(splat, catIdx, count) {
  const tbody = document.getElementById(`${splat}_custom_abi_${catIdx}_tbody`);
  if (!tbody) return;
  while (tbody.children.length < count) {
    addCustomAbiRow(splat, catIdx);
  }
  while (tbody.children.length > count) {
    tbody.lastElementChild.remove();
  }
  reindexCustomAbiRows(tbody);
}

function addCombatRow(splat, hasPathos = (splat === 'wraith')) {
  const tbody = document.getElementById(`${splat}_combat_tbody`);
  if (!tbody) return null;
  const idx = tbody.children.length;
  const cols = hasPathos ? 8 : 7;
  let cells = '';
  for (let c = 0; c < cols; c++) {
    cells += `<td><input type="text" id="${splat}_combat_${idx}_${c}"></td>`;
  }
  const tr = document.createElement('tr');
  tr.innerHTML = `${cells}<td class="no-print td-action"><button type="button" class="btn-icon-remove removeCombatRowBtn" title="Remove Attack" aria-label="Remove Attack">&times;</button></td>`;
  tbody.appendChild(tr);
  return tr;
}

function reindexCombatRows(tbody) {
  const match = tbody.id.match(/^([a-z]+)_combat_tbody$/);
  if (!match) return;
  const splat = match[1];
  Array.from(tbody.querySelectorAll('tr')).forEach((tr, rowIdx) => {
    const inputs = tr.querySelectorAll('input[type=text]');
    inputs.forEach((inp, colIdx) => {
      inp.id = `${splat}_combat_${rowIdx}_${colIdx}`;
    });
  });
}

function setCombatRowCount(splat, count) {
  const tbody = document.getElementById(`${splat}_combat_tbody`);
  if (!tbody) return;
  const hasPathos = (splat === 'wraith');
  while (tbody.children.length < count) {
    addCombatRow(splat, hasPathos);
  }
  while (tbody.children.length > count) {
    tbody.lastElementChild.remove();
  }
  reindexCombatRows(tbody);
}

function loadSampleCharacter(key) {
  if (!key) return;
  const sample = SAMPLE_CHARACTERS[key];
  if (!sample) return;

  clearTimeout(autoSaveTimer);
  autoSaveTimer = null;

  isRestoring = true;
  clearSheet(true, sample.splat);
  restoreState(sample);
  switchSplat(sample.splat);
  isRestoring = false;
  isSheetDirty = false;

  saveNow();
  const charName = (sample.inputs && sample.inputs[sample.splat + '_char_name']) || key;
  showToast('Loaded Sample: ' + charName);
}

function updatePortrait(splat, url) {
  const img = document.getElementById(splat + '_portraitImg');
  const ph = document.querySelector(`#${splat}_portraitContainer .portraitPlaceholder`);
  if (!img) return;
  img.onerror = () => {
    img.style.display = 'none';
    if (ph) ph.style.display = 'block';
  };
  if (url && url.trim().length > 0) {
    img.src = url.trim();
    img.style.display = 'block';
    if (ph) ph.style.display = 'none';
  } else {
    img.removeAttribute('src');
    img.style.display = 'none';
    if (ph) ph.style.display = 'block';
  }
}

function resetTenDotModeUI() {
  isTenDotMode = false;
  document.body.classList.remove('mode-10-dot');
  document.getElementById('dotToggleBtn').textContent = '10-Dot Mode';
}

function switchSplat(splat) {
  currentSplat = splat;
  document.body.dataset.splat = splat;
  document.getElementById('splatSelect').value = splat;
  document.querySelectorAll('.splat-container').forEach(c => c.style.display = 'none');
  const active = document.getElementById('splat-' + splat);
  if (active) {
    active.style.display = 'block';
    updateWoundPenalty(splat);
    updateActiveQuickNav();
    updateGuidePanel();
    requestAnimationFrame(() => autoResizeTextareas(active));
  }

  if (!isRestoring) {
    isRestoring = true;
    let restored = false;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const globalState = JSON.parse(saved);
        if (globalState.sheets && globalState.sheets[splat]) {
          restoreState(globalState.sheets[splat]);
          restored = true;
        }
      }
    } catch (e) {}
    if (!restored) {
      resetTenDotModeUI();
      clearSheet(true, splat);
    }
    isRestoring = false;
    saveNow();
  }
}

function initDotsAndBoxes() {
  document.querySelectorAll('.dots-container, .boxes-container').forEach(container => {
    bindDotContainer(container);
  });
}

function updateVisual(container, val, childClass) {
  container.querySelectorAll('.' + childClass).forEach(el => {
    el.classList.toggle('filled', parseInt(el.dataset.idx, 10) <= val);
  });
}

function updateHealthAriaLabel(box) {
  const row = box.closest('tr');
  const labelCell = row ? row.querySelector('.ht-label') : null;
  const levelName = labelCell ? labelCell.textContent.trim() : (box.dataset.id || 'Health');
  const state = box.dataset.state || 'empty';
  box.setAttribute('aria-label', `${levelName}: ${state}`);
}

function getTrackPenaltyIndex(splat, prefix) {
  const container = document.getElementById('splat-' + splat);
  if (!container) return 0;
  let worstIdx = 0;
  for (let i = 0; i < 7; i++) {
    const box = container.querySelector(`[data-id="${prefix}_${i}"]`);
    if (box && box.dataset.state && box.dataset.state !== 'empty') {
      worstIdx = i;
    }
  }
  return worstIdx;
}

function updateWoundPenalty(splat = currentSplat) {
  const badge = document.getElementById(`${splat}_wound_badge`);
  if (!badge) return;

  badge.classList.remove('penalty-low', 'penalty-high');

  if (splat === 'changeling') {
    const realIdx = getTrackPenaltyIndex('changeling', 'changeling_hlth_real');
    const chimIdx = getTrackPenaltyIndex('changeling_hlth_chim');
    const shortLabels = ['0', '-1', '-1', '-2', '-2', '-5', 'Incap'];
    badge.textContent = `R: ${shortLabels[realIdx]} | C: ${shortLabels[chimIdx]}`;
    const worst = Math.max(realIdx, chimIdx);
    if (HEALTH_PENALTIES[worst].cls) badge.classList.add(HEALTH_PENALTIES[worst].cls);
  } else {
    const idx = getTrackPenaltyIndex(splat, `${splat}_hlth`);
    const info = HEALTH_PENALTIES[idx];
    badge.textContent = info.label;
    if (info.cls) badge.classList.add(info.cls);
  }
}

function initHealthBoxes() {
  document.querySelectorAll('.health-box').forEach(box => {
    box.dataset.state = 'empty';
    box.setAttribute('tabindex', '0');
    box.setAttribute('role', 'button');
    updateHealthAriaLabel(box);
    const clickHandler = () => {
      const curState = box.dataset.state || 'empty';
      const nextIdx = (HEALTH_STATES.indexOf(curState) + 1) % HEALTH_STATES.length;
      box.dataset.state = HEALTH_STATES[nextIdx];
      box.textContent = HEALTH_SYMBOLS[HEALTH_STATES[nextIdx]];
      updateHealthAriaLabel(box);
      const splat = (box.dataset.id || '').split('_')[0] || currentSplat;
      updateWoundPenalty(splat);
      isSheetDirty = true;
      scheduleAutoSave();
    };
    box.addEventListener('click', clickHandler);
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        clickHandler();
      }
    });
  });
}

function captureCurrentState() {
  const activeContainer = document.getElementById('splat-' + currentSplat);
  if (!activeContainer) return {};

  const meritTbody = document.getElementById(`${currentSplat}_merit_tbody`);
  const flawTbody = document.getElementById(`${currentSplat}_flaw_tbody`);
  const combatTbody = document.getElementById(`${currentSplat}_combat_tbody`);
  const dynCounts = {};
  for (let i = 0; i <= 2; i++) {
    const dTb = document.getElementById(`${currentSplat}_adv_${i}_tbody`);
    if (dTb) dynCounts[`adv_${i}`] = dTb.children.length;
  }
  const customAbiCounts = {};
  for (let c = 0; c <= 2; c++) {
    const aTb = document.getElementById(`${currentSplat}_custom_abi_${c}_tbody`);
    if (aTb) customAbiCounts[`cat_${c}`] = aTb.children.length;
  }

  const state = {
    splat: currentSplat,
    isTenDotMode: isTenDotMode,
    meritCount: meritTbody ? meritTbody.children.length : DEFAULT_MF_ROWS,
    flawCount: flawTbody ? flawTbody.children.length : DEFAULT_MF_ROWS,
    combatCount: combatTbody ? combatTbody.children.length : DEFAULT_COMBAT_ROWS,
    dynCounts: dynCounts,
    customAbiCounts: customAbiCounts,
    inputs: {},
    dots: {},
    health: {}
  };

  activeContainer.querySelectorAll('input[type=text], textarea').forEach(el => {
    if (el.id) state.inputs[el.id] = el.value;
  });
  activeContainer.querySelectorAll('.dots-container, .boxes-container').forEach(el => {
    if (el.dataset.id) state.dots[el.dataset.id] = parseInt(el.dataset.val || '0', 10);
  });
  activeContainer.querySelectorAll('.health-box').forEach(el => {
    if (el.dataset.id) state.health[el.dataset.id] = el.dataset.state || 'empty';
  });
  return state;
}

function restoreState(state) {
  if (!state || !state.splat) return;
  isTenDotMode = !!state.isTenDotMode;
  document.body.classList.toggle('mode-10-dot', isTenDotMode);
  document.getElementById('dotToggleBtn').textContent = isTenDotMode ? '5-Dot Mode' : '10-Dot Mode';

  currentSplat = state.splat;
  document.body.dataset.splat = state.splat;
  document.getElementById('splatSelect').value = state.splat;
  const active = document.getElementById('splat-' + state.splat);
  if (!active) return;

  let maxMeritIdx = -1;
  let maxFlawIdx = -1;
  let maxCombatIdx = -1;
  const dynMax = { adv_0: -1, adv_1: -1, adv_2: -1 };
  const abiMax = { cat_0: -1, cat_1: -1, cat_2: -1 };

  if (state.inputs) {
    const mRe = new RegExp(`^${state.splat}_merit_(\\d+)_`);
    const fRe = new RegExp(`^${state.splat}_flaw_(\\d+)_`);
    const cRe = new RegExp(`^${state.splat}_combat_(\\d+)_`);
    for (const id of Object.keys(state.inputs)) {
      const mm = id.match(mRe);
      if (mm) maxMeritIdx = Math.max(maxMeritIdx, parseInt(mm[1], 10));
      const fm = id.match(fRe);
      if (fm) maxFlawIdx = Math.max(maxFlawIdx, parseInt(fm[1], 10));
      const cm = id.match(cRe);
      if (cm) maxCombatIdx = Math.max(maxCombatIdx, parseInt(cm[1], 10));
      for (let i = 0; i <= 2; i++) {
        const dm = id.match(new RegExp(`^${state.splat}_adv_${i}_(\\d+)_`));
        if (dm) dynMax[`adv_${i}`] = Math.max(dynMax[`adv_${i}`], parseInt(dm[1], 10));
        const am = id.match(new RegExp(`^${state.splat}_custom_abi_${i}_(\\d+)_`));
        if (am) abiMax[`cat_${i}`] = Math.max(abiMax[`cat_${i}`], parseInt(am[1], 10));
      }
    }
  }
  const targetMeritCount = typeof state.meritCount === 'number'
    ? Math.max(state.meritCount, maxMeritIdx + 1)
    : Math.max(DEFAULT_MF_ROWS, maxMeritIdx + 1);
  const targetFlawCount = typeof state.flawCount === 'number'
    ? Math.max(state.flawCount, maxFlawIdx + 1)
    : Math.max(DEFAULT_MF_ROWS, maxFlawIdx + 1);
  const targetCombatCount = typeof state.combatCount === 'number'
    ? Math.max(state.combatCount, maxCombatIdx + 1)
    : Math.max(DEFAULT_COMBAT_ROWS, maxCombatIdx + 1);

  setMeritFlawRowCount(state.splat, 'merit', targetMeritCount);
  setMeritFlawRowCount(state.splat, 'flaw', targetFlawCount);
  setCombatRowCount(state.splat, targetCombatCount);

  if (state.dynCounts) {
    for (const [k, c] of Object.entries(state.dynCounts)) {
      setDynRowCount(state.splat, k, Math.max(c, dynMax[k] + 1));
    }
  } else {
    for (let i = 0; i <= 2; i++) {
      const defRows = (state.splat === 'wraith' && i === 1) || (state.splat === 'mortal' && i === 0) ? 10 : 6;
      setDynRowCount(state.splat, `adv_${i}`, Math.max(defRows, dynMax[`adv_${i}`] + 1));
    }
  }

  for (let c = 0; c <= 2; c++) {
    const savedCount = (state.customAbiCounts && typeof state.customAbiCounts[`cat_${c}`] === 'number')
      ? state.customAbiCounts[`cat_${c}`]
      : 0;
    setCustomAbiRowCount(state.splat, c, Math.max(savedCount, abiMax[`cat_${c}`] + 1));
  }

  if (state.inputs) {
    for (const [id, val] of Object.entries(state.inputs)) {
      const el = document.getElementById(id);
      if (el) el.value = val;
      if (id.endsWith('_portrait_url')) updatePortrait(state.splat, val);
    }
  }
  if (state.dots) {
    for (const [id, val] of Object.entries(state.dots)) {
      const el = active.querySelector(`[data-id="${id}"]`);
      if (el) {
        el.dataset.val = val;
        updateVisual(el, val, el.classList.contains('boxes-container') ? 'square-box' : 'dot');
      }
    }
  }
  if (state.health) {
    for (const [id, val] of Object.entries(state.health)) {
      const el = active.querySelector(`[data-id="${id}"]`);
      if (el) {
        el.dataset.state = val;
        el.textContent = HEALTH_SYMBOLS[val] || '';
        updateHealthAriaLabel(el);
      }
    }
  }
  updateWoundPenalty(state.splat);
  updateDocumentTitle();
  updateGuideTally();
  requestAnimationFrame(() => autoResizeTextareas(active));
}


function resetAttributesToDefault(targetSplat) {
  const active = document.getElementById('splat-' + targetSplat);
  if (!active) return;
  
  const attrs = ['str', 'dex', 'sta', 'cha', 'man', 'app', 'per', 'int', 'wit'];
  attrs.forEach(attr => {
    const el = active.querySelector(`[data-id="${targetSplat}_attr_${attr}"]`);
    if (el) {
      el.dataset.val = '1';
      updateVisual(el, 1, 'dot');
    }
  });
}

function clearSheet(silent = false, targetSplat = currentSplat) {
  const active = document.getElementById('splat-' + targetSplat);
  if (!active) return;
  if (targetSplat === currentSplat) {
    resetTenDotModeUI();
  }
  setMeritFlawRowCount(targetSplat, 'merit', DEFAULT_MF_ROWS);
  setMeritFlawRowCount(targetSplat, 'flaw', DEFAULT_MF_ROWS);
  setCombatRowCount(targetSplat, DEFAULT_COMBAT_ROWS);
  for (let i = 0; i <= 2; i++) {
    const defRows = (targetSplat === 'wraith' && i === 1) || (targetSplat === 'mortal' && i === 0) ? 10 : 6;
    setDynRowCount(targetSplat, `adv_${i}`, defRows);
    setCustomAbiRowCount(targetSplat, i, 0);
  }
  active.querySelectorAll('input[type=text], textarea').forEach(el => {
    el.value = '';
    if (el.tagName === 'TEXTAREA' && el.dataset.defaultHeight) {
      el.style.height = el.dataset.defaultHeight;
    }
  });
  active.querySelectorAll('.dots-container, .boxes-container').forEach(el => {
    el.dataset.val = '0';
    updateVisual(el, 0, el.classList.contains('boxes-container') ? 'square-box' : 'dot');
  });
  resetAttributesToDefault(targetSplat);
  active.querySelectorAll('.health-box').forEach(el => {
    el.dataset.state = 'empty';
    el.textContent = '';
    updateHealthAriaLabel(el);
  });
  updateWoundPenalty(targetSplat);
  updatePortrait(targetSplat, '');
  updateDocumentTitle();
  if (targetSplat === currentSplat) updateGuideTally();
  if (!silent) saveNow();
}

function hardResetWebsite() {
  clearTimeout(autoSaveTimer);
  autoSaveTimer = null;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {}

  lastSharedSnapshot = '';
  const pdfLink = document.getElementById('pdfShareLink');
  if (pdfLink) pdfLink.href = getPdfShareBaseUrl();
  if (window.location.hash) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  document.getElementById('sampleCharSelect').value = '';
  pendingSampleKey = '';
  resetTenDotModeUI();

  const guidePanel = document.getElementById('guidePanel');
  if (guidePanel) guidePanel.classList.remove('open');

  isRestoring = true;
  ['mortal', 'vampire', 'werewolf', 'mage', 'changeling', 'wraith'].forEach(sp => {
    clearSheet(true, sp);
  });
  switchSplat('mortal');
  isRestoring = false;
  isSheetDirty = false;

  const badge = document.getElementById('autosaveIndicator');
  if (badge) {
    badge.textContent = 'Auto-Save Ready';
    badge.classList.remove('saved');
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
  showToast('Website Reset to Defaults');
}


function saveNow() {
  if (isRestoring) return;
  clearTimeout(autoSaveTimer);
  autoSaveTimer = null;
  const badge = document.getElementById('autosaveIndicator');
  let globalState = {};
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) globalState = JSON.parse(saved);
  } catch (e) {}
  globalState.activeSplat = currentSplat;
  if (!globalState.sheets) globalState.sheets = {};
  globalState.sheets[currentSplat] = captureCurrentState();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(globalState));
  badge.textContent = 'Saved Locally';
  badge.classList.add('saved');
}

function flushAutoSave() {
  if (autoSaveTimer !== null) {
    saveNow();
  }
}

function scheduleAutoSave() {
  if (isRestoring) return;
  clearTimeout(autoSaveTimer);
  const badge = document.getElementById('autosaveIndicator');
  badge.textContent = 'Saving...';
  badge.classList.remove('saved');
  autoSaveTimer = setTimeout(() => {
    saveNow();
  }, 500);
}

function restoreFromLocalStorage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const globalState = JSON.parse(saved);
      if (globalState.activeSplat) currentSplat = globalState.activeSplat;
      switchSplat(currentSplat);
      document.getElementById('autosaveIndicator').textContent = 'Restored Session';
      document.getElementById('autosaveIndicator').classList.add('saved');
    } else {
      switchSplat('mortal');
    }
  } catch (e) {
    switchSplat('mortal');
  }
}

function showToast(msg) {
  const c = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = 'toast show';
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2500);
}

function getShareBaseUrl() {
  const { protocol, hostname, origin, pathname } = window.location;
  const isLocal =
    protocol === 'file:' ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    hostname.endsWith('.local');
  if (isLocal) {
    return SHARE_DOMAIN_PLACEHOLDER.replace(/\/+$/, '') + '/';
  }
  const cleanPath = pathname.replace(/\/index\.html$/i, '/');
  return origin + cleanPath;
}

function getPdfShareBaseUrl() {
  const base = getShareBaseUrl();
  const tag = Date.now().toString(36);
  const currentSearch = window.location.search || '';
  const param = currentSearch === `?s=${tag}` ? `s=${tag}x` : `s=${tag}`;
  return `${base}?${param}`;
}

const V3_SPLATS = ['mortal', 'vampire', 'werewolf', 'mage', 'changeling', 'wraith'];
const V3_B79_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._~!$()*+,;=:@/?";
const V3_B79_BASE = BigInt(V3_B79_ALPHABET.length); // 79
const V3_B79_REV = Object.fromEntries([...V3_B79_ALPHABET].map((c, i) => [c, BigInt(i)]));

const V3_TOKEN_BYTES = Array.from({ length: 31 }, (_, i) => i + 1).filter(b => b !== 9 && b !== 10 && b !== 13);
const V3_DICT_STRINGS = [
  "aggravated", "Willpower", "Strength", "Dexterity", "Stamina",
  "Charisma", "Manipulation", "Appearance", "Perception", "Intelligence",
  "Generation", "Discipline", "Background", "Resources", "Allies",
  "Contacts", "Retainers", "Influence", "Mentor", "Status",
  " the ", " and ", " of ", " to ", " in ", " with ", " for ", "ing "
];

function bytesToBase79(bytes) {
  if (!bytes || bytes.length === 0) return '';
  let n = 1n; // 0x01 sentinel preserves leading 0x00 bytes
  for (let i = 0; i < bytes.length; i++) {
    n = (n << 8n) | BigInt(bytes[i]);
  }
  const chars = [];
  while (n > 0n) {
    const rem = Number(n % V3_B79_BASE);
    n = n / V3_B79_BASE;
    chars.push(V3_B79_ALPHABET[rem]);
  }
  return chars.reverse().join('');
}

function base79ToBytes(str) {
  if (!str) return new Uint8Array(0);
  let n = 0n;
  for (let i = 0; i < str.length; i++) {
    const v = V3_B79_REV[str[i]];
    if (v === undefined) throw new Error('Invalid Base79 character');
    n = n * V3_B79_BASE + v;
  }
  const hex = n.toString(16).padStart(2, '0');
  const paddedHex = hex.length % 2 ? '0' + hex : hex;
  const out = new Uint8Array(paddedHex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(paddedHex.slice(i * 2, i * 2 + 2), 16);
  }
  if (out[0] !== 1) throw new Error('Invalid sentinel byte');
  return out.slice(1);
}

function writeVarint(arr, val) {
  let v = val >>> 0;
  while (v >= 0x80) {
    arr.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  arr.push(v);
}

function readVarint(bytes, state) {
  let val = 0;
  let shift = 0;
  while (state.pos < bytes.length) {
    const b = bytes[state.pos++];
    val |= (b & 0x7f) << shift;
    if ((b & 0x80) === 0) return val >>> 0;
    shift += 7;
  }
  throw new Error('Truncated varint');
}

function dictEncodeUtf8(str) {
  const raw = new TextEncoder().encode(str);
  const tokenSet = new Set(V3_TOKEN_BYTES);
  const escaped = [];
  for (let i = 0; i < raw.length; i++) {
    const b = raw[i];
    if (b === 0 || tokenSet.has(b)) escaped.push(0);
    escaped.push(b);
  }
  let latin = '';
  for (let i = 0; i < escaped.length; i++) latin += String.fromCharCode(escaped[i]);
  const pairs = V3_DICT_STRINGS
    .map((word, idx) => ({ word, tok: String.fromCharCode(V3_TOKEN_BYTES[idx]) }))
    .sort((a, b) => b.word.length - a.word.length);
  for (const { word, tok } of pairs) {
    latin = latin.split(word).join(tok);
  }
  const out = new Uint8Array(latin.length);
  for (let i = 0; i < latin.length; i++) out[i] = latin.charCodeAt(i);
  return out;
}

function dictDecodeUtf8(bytes) {
  const tokMap = new Map();
  V3_TOKEN_BYTES.forEach((b, idx) => tokMap.set(b, new TextEncoder().encode(V3_DICT_STRINGS[idx])));
  const out = [];
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b === 0) {
      out.push(bytes[++i]);
    } else if (tokMap.has(b)) {
      const seq = tokMap.get(b);
      for (let j = 0; j < seq.length; j++) out.push(seq[j]);
    } else {
      out.push(b);
    }
  }
  return new TextDecoder().decode(new Uint8Array(out));
}

function getDefaultAdvRowCount(splat, advIdx) {
  return (splat === 'wraith' && advIdx === 1) || (splat === 'mortal' && advIdx === 0) ? 10 : 6;
}

function packStateBinary(state) {
  const sp = state.splat;
  const spIdx = Math.max(0, V3_SPLATS.indexOf(sp));
  const container = document.getElementById('splat-' + sp);

  const counts = [
    state.meritCount ?? DEFAULT_MF_ROWS,
    state.flawCount ?? DEFAULT_MF_ROWS,
    state.combatCount ?? DEFAULT_COMBAT_ROWS,
    state.dynCounts?.adv_0 ?? getDefaultAdvRowCount(sp, 0),
    state.dynCounts?.adv_1 ?? getDefaultAdvRowCount(sp, 1),
    state.dynCounts?.adv_2 ?? getDefaultAdvRowCount(sp, 2),
    state.customAbiCounts?.cat_0 ?? 0,
    state.customAbiCounts?.cat_1 ?? 0,
    state.customAbiCounts?.cat_2 ?? 0
  ];
  const defaults = [
    DEFAULT_MF_ROWS, DEFAULT_MF_ROWS, DEFAULT_COMBAT_ROWS,
    getDefaultAdvRowCount(sp, 0), getDefaultAdvRowCount(sp, 1), getDefaultAdvRowCount(sp, 2),
    0, 0, 0
  ];
  const hasCustomCounts = counts.some((c, i) => c !== defaults[i]);

  const buf = [];
  const flags = (spIdx & 0x07) | ((state.isTenDotMode ? 1 : 0) << 3) | ((hasCustomCounts ? 1 : 0) << 4);
  buf.push(flags);
  if (hasCustomCounts) {
    counts.forEach(c => writeVarint(buf, c));
  }

  const dotEls = container ? Array.from(container.querySelectorAll('.dots-container, .boxes-container')) : [];
  const dotBytes = [];
  for (let i = 0; i < dotEls.length; i += 2) {
    const hi = Math.max(0, Math.min(15, state.dots?.[dotEls[i].dataset.id] ?? 0));
    const lo = i + 1 < dotEls.length ? Math.max(0, Math.min(15, state.dots?.[dotEls[i + 1].dataset.id] ?? 0)) : 0;
    dotBytes.push((hi << 4) | lo);
  }
  while (dotBytes.length > 0 && dotBytes[dotBytes.length - 1] === 0) dotBytes.pop();
  writeVarint(buf, dotBytes.length);
  buf.push(...dotBytes);

  const healthEls = container ? Array.from(container.querySelectorAll('.health-box')) : [];
  const healthBytes = [];
  for (let i = 0; i < healthEls.length; i += 4) {
    let b = 0;
    for (let j = 0; j < 4; j++) {
      const idx = i + j;
      const stName = idx < healthEls.length ? (state.health?.[healthEls[idx].dataset.id] || 'empty') : 'empty';
      const code = Math.max(0, HEALTH_STATES.indexOf(stName));
      b |= (code & 0x03) << (6 - j * 2);
    }
    healthBytes.push(b);
  }
  while (healthBytes.length > 0 && healthBytes[healthBytes.length - 1] === 0) healthBytes.pop();
  writeVarint(buf, healthBytes.length);
  buf.push(...healthBytes);

  const inputEls = container ? Array.from(container.querySelectorAll('input[type=text], textarea')) : [];
  const entries = [];
  inputEls.forEach((el, idx) => {
    if (!el.id) return;
    const val = state.inputs?.[el.id] ?? '';
    if (val !== '') {
      entries.push({ idx, bytes: dictEncodeUtf8(val) });
    }
  });

  writeVarint(buf, entries.length);
  let prevIdx = 0;
  for (const e of entries) {
    writeVarint(buf, e.idx - prevIdx);
    prevIdx = e.idx;
  }
  for (const e of entries) {
    writeVarint(buf, e.bytes.length);
  }
  for (const e of entries) {
    for (let i = 0; i < e.bytes.length; i++) buf.push(e.bytes[i]);
  }

  return new Uint8Array(buf);
}

function unpackStateBinary(bytes) {
  const cursor = { pos: 0 };
  const flags = bytes[cursor.pos++];
  const sp = V3_SPLATS[flags & 0x07] || 'mortal';
  const isTenDotMode = Boolean((flags >> 3) & 1);
  const hasCustomCounts = Boolean((flags >> 4) & 1);

  const counts = hasCustomCounts
    ? Array.from({ length: 9 }, () => readVarint(bytes, cursor))
    : [
        DEFAULT_MF_ROWS, DEFAULT_MF_ROWS, DEFAULT_COMBAT_ROWS,
        getDefaultAdvRowCount(sp, 0), getDefaultAdvRowCount(sp, 1), getDefaultAdvRowCount(sp, 2),
        0, 0, 0
      ];

  setMeritFlawRowCount(sp, 'merit', counts[0]);
  setMeritFlawRowCount(sp, 'flaw', counts[1]);
  setCombatRowCount(sp, counts[2]);
  setDynRowCount(sp, 'adv_0', counts[3]);
  setDynRowCount(sp, 'adv_1', counts[4]);
  setDynRowCount(sp, 'adv_2', counts[5]);
  setCustomAbiRowCount(sp, 0, counts[6]);
  setCustomAbiRowCount(sp, 1, counts[7]);
  setCustomAbiRowCount(sp, 2, counts[8]);

  const container = document.getElementById('splat-' + sp);
  const dotEls = container ? Array.from(container.querySelectorAll('.dots-container, .boxes-container')) : [];
  const dotByteLen = readVarint(bytes, cursor);
  const dotSlice = bytes.slice(cursor.pos, cursor.pos + dotByteLen);
  cursor.pos += dotByteLen;

  const dots = {};
  dotEls.forEach((el, i) => {
    const b = dotSlice[Math.floor(i / 2)] || 0;
    dots[el.dataset.id] = i % 2 === 0 ? (b >> 4) : (b & 0x0f);
  });

  const healthEls = container ? Array.from(container.querySelectorAll('.health-box')) : [];
  const healthByteLen = readVarint(bytes, cursor);
  const healthSlice = bytes.slice(cursor.pos, cursor.pos + healthByteLen);
  cursor.pos += healthByteLen;

  const health = {};
  healthEls.forEach((el, i) => {
    const b = healthSlice[Math.floor(i / 4)] || 0;
    const shift = 6 - (i % 4) * 2;
    health[el.dataset.id] = HEALTH_STATES[(b >> shift) & 0x03] || 'empty';
  });

  const inputEls = container ? Array.from(container.querySelectorAll('input[type=text], textarea')) : [];
  const count = readVarint(bytes, cursor);
  const indices = [];
  let prevIdx = 0;
  for (let i = 0; i < count; i++) {
    prevIdx += readVarint(bytes, cursor);
    indices.push(prevIdx);
  }
  const lengths = Array.from({ length: count }, () => readVarint(bytes, cursor));

  const inputs = {};
  inputEls.forEach(el => { if (el.id) inputs[el.id] = ''; });
  for (let i = 0; i < count; i++) {
    const strBytes = bytes.slice(cursor.pos, cursor.pos + lengths[i]);
    cursor.pos += lengths[i];
    const targetEl = inputEls[indices[i]];
    if (targetEl && targetEl.id) {
      inputs[targetEl.id] = dictDecodeUtf8(strBytes);
    }
  }

  return {
    splat: sp,
    isTenDotMode,
    meritCount: counts[0],
    flawCount: counts[1],
    combatCount: counts[2],
    dynCounts: { adv_0: counts[3], adv_1: counts[4], adv_2: counts[5] },
    customAbiCounts: { cat_0: counts[6], cat_1: counts[7], cat_2: counts[8] },
    inputs,
    dots,
    health
  };
}

function getShareableStatePayload() {
  const state = captureCurrentState();
  let warning = '';
  if (state.inputs && state.inputs[currentSplat + '_portrait_url'] && state.inputs[currentSplat + '_portrait_url'].startsWith('data:image')) {
    delete state.inputs[currentSplat + '_portrait_url'];
    warning = ' (Local portrait excluded to keep link small)';
  }
  return { state, jsonStr: JSON.stringify(state), warning };
}

function applyShareHashToPage(finalHash, jsonStr) {
  const shareUrl = getShareBaseUrl() + finalHash;
  try {
    window.history.replaceState(null, '', finalHash);
  } catch (e) {}
  const pdfLink = document.getElementById('pdfShareLink');
  if (pdfLink) {
    pdfLink.href = getPdfShareBaseUrl() + finalHash;
  }
  lastSharedSnapshot = jsonStr;
  return shareUrl;
}

function ensureSyncShareLinkForPrint() {
  try {
    const { state, jsonStr } = getShareableStatePayload();
    if (lastSharedSnapshot === jsonStr && document.getElementById('pdfShareLink')?.getAttribute('href')?.includes('#')) {
      return;
    }
    const fallbackHash = '#v3u~' + bytesToBase79(packStateBinary(state));
    applyShareHashToPage(fallbackHash, jsonStr);
  } catch (e) {
    console.error(e);
  }
}

async function generateShareUrl({ copyToClipboard = true, showNotification = true } = {}) {
  const { state, jsonStr, warning } = getShareableStatePayload();
  try {
    let finalHash = '';
    const packedBytes = packStateBinary(state);
    if (typeof CompressionStream !== 'undefined') {
      const stream = new Blob([packedBytes]).stream();
      const compStream = stream.pipeThrough(new CompressionStream('deflate-raw'));
      const buffer = await new Response(compStream).arrayBuffer();
      const compBytes = new Uint8Array(buffer);
      finalHash = compBytes.length < packedBytes.length
        ? '#v3~' + bytesToBase79(compBytes)
        : '#v3u~' + bytesToBase79(packedBytes);
    } else {
      finalHash = '#v3u~' + bytesToBase79(packedBytes);
    }
    const shareUrl = applyShareHashToPage(finalHash, jsonStr);
    if (copyToClipboard && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareUrl)
        .then(() => { if (showNotification) showToast('Link Copied!' + warning); })
        .catch(() => { if (showNotification) showToast('Link generated in address bar.' + warning); });
    } else if (showNotification) {
      showToast('Link generated in address bar.' + warning);
    }
    return { shareUrl, hash: finalHash };
  } catch (e) {
    console.error(e);
    if (showNotification) showToast('Error generating link.');
    return null;
  }
}

async function checkUrlForCharacter() {
  const hash = window.location.hash;
  if (!hash) return false;
  try {
    let state = null;
    if (hash.startsWith('#v3~')) {
      const compBytes = base79ToBytes(hash.substring(4));
      const stream = new Blob([compBytes]).stream();
      const decomp = stream.pipeThrough(new DecompressionStream('deflate-raw'));
      const rawBytes = new Uint8Array(await new Response(decomp).arrayBuffer());
      state = unpackStateBinary(rawBytes);
    } else if (hash.startsWith('#v3u~')) {
      state = unpackStateBinary(base79ToBytes(hash.substring(5)));
    } else if (hash.startsWith('#v2~')) {
      let b64 = hash.substring(4).replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const stream = new Blob([bytes]).stream();
      const decomp = stream.pipeThrough(new DecompressionStream('deflate-raw'));
      state = JSON.parse(await new Response(decomp).text());
    } else if (hash.startsWith('#v1~')) {
      let b64 = hash.substring(4);
      while (b64.length % 4) b64 += '=';
      state = JSON.parse(decodeURIComponent(atob(b64)));
    }
    if (state) {
      isRestoring = true;
      restoreState(state);
      isRestoring = false;
      showToast('Loaded from URL!');
      return true;
    }
  } catch (e) { console.error(e); showToast('Corrupted URL.'); }
  return false;
}

function saveAsJson() {
  const state = captureCurrentState();
  const name = state.inputs[state.splat + '_char_name'] || 'character';
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function importJsonFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const state = JSON.parse(evt.target.result);
      clearTimeout(autoSaveTimer);
      autoSaveTimer = null;
      document.getElementById('sampleCharSelect').value = '';
      isRestoring = true;
      clearSheet(true, state.splat || currentSplat);
      restoreState(state);
      switchSplat(state.splat || currentSplat);
      isRestoring = false;
      isSheetDirty = false;
      saveNow();
      showToast('Loaded JSON successfully');
    } catch (err) {
      showToast('Invalid JSON');
    }
  };
  reader.readAsText(file);
}

function loadFromJson(e) {
  const file = e.target.files[0];
  importJsonFile(file);
  e.target.value = '';
}

function addDynRow(splat, kind) {
  const tbody = document.getElementById(`${splat}_${kind}_tbody`);
  if (!tbody) return null;
  const idx = tbody.children.length;

  const tr = document.createElement('div');
  tr.className = 'trait-flex-row';

  let html = `<input type="text" class="trait-name-input" id="${splat}_${kind}_${idx}_name">`;
  html += `<div class="dots-container" data-id="${splat}_${kind}_${idx}_dots" data-val="0">`;
  for (let i = 1; i <= 10; i++) {
    html += `<span class="dot${i > 5 ? ' dot-scalable-10' : ''}" data-idx="${i}"></span>`;
  }
  html += `</div>`;
  html += `<button type="button" class="btn-icon-remove removeDynRowBtn no-print" style="margin-left:4px;" title="Remove Row" aria-label="Remove Row">&times;</button>`;

  tr.innerHTML = html;
  tbody.appendChild(tr);

  const container = tr.querySelector('.dots-container');
  bindDotContainer(container);
  return tr;
}

function reindexDynRows(tbody) {
  const match = tbody.id.match(/^([a-z]+)_(adv_\d)_tbody$/);
  if (!match) return;
  const [, splat, kind] = match;
  Array.from(tbody.children).forEach((row, rowIdx) => {
    const inp = row.querySelector('input');
    if (inp) inp.id = `${splat}_${kind}_${rowIdx}_name`;
    const dots = row.querySelector('.dots-container');
    if (dots) dots.dataset.id = `${splat}_${kind}_${rowIdx}_dots`;
  });
}

function setDynRowCount(splat, kind, count) {
  const tbody = document.getElementById(`${splat}_${kind}_tbody`);
  if (!tbody) return;
  while (tbody.children.length < count) { addDynRow(splat, kind); }
  while (tbody.children.length > count) { tbody.lastElementChild.remove(); }
  reindexDynRows(tbody);
}

function autoResizeTextareas(container = document) {
  container.querySelectorAll('textarea.sheet-area').forEach(ta => {
    ta.style.height = '';
    if (ta.value && ta.value.trim().length > 0 && ta.scrollHeight > 0) {
      ta.style.height = Math.max(44, ta.scrollHeight) + 'px';
    }
  });
}

function updateDocumentTitle() {
  const nameInput = document.getElementById(currentSplat + '_char_name');
  if (nameInput && nameInput.value.trim().length > 0) {
    document.title = nameInput.value.trim();
  } else {
    document.title = "WoD 20th Character Sheet";
  }
}


const SPLAT_GUIDES = {
  mortal: `
    <h4>Creation Process (Hunters Hunted II)</h4>
    <ul>
      <li><strong>Attributes:</strong> +6 / +4 / +3 priority dots<span class="guide-note">Starts with 1 dot each (9 / 7 / 6 category totals; 22 total)</span></li>
      <li><strong>Abilities:</strong> 11 / 7 / 4 (max 3 before Freebies)</li>
      <li><strong>Backgrounds:</strong> 5</li>
      <li><strong>Virtues:</strong> 7 (start at 1 each)</li>
      <li><strong>Freebie Points:</strong> 21</li>
    </ul>
    <h4>Key Traits</h4>
    <ul>
      <li><strong>Humanity:</strong> Conscience + Self-Control</li>
      <li><strong>Willpower:</strong> Equal to Courage rating</li>
      <li><strong>Numina / True Faith:</strong> Purchased with Freebie Points (with ST approval).</li>
    </ul>
    <h4>Freebie Point Costs (21 pts)</h4>
    <table class="guide-cost-grid">
      <thead><tr><th>Trait</th><th>Cost</th></tr></thead>
      <tbody>
        <tr><td>Attribute</td><td>5 / dot</td></tr>
        <tr><td>Ability</td><td>2 / dot</td></tr>
        <tr><td>Numina / True Faith</td><td>7 / dot</td></tr>
        <tr><td>Background</td><td>1 / dot</td></tr>
        <tr><td>Virtue</td><td>2 / dot</td></tr>
        <tr><td>Humanity / Willpower</td><td>1 / dot</td></tr>
        <tr><td>Merits / Flaws</td><td>Rating (Flaws max +7)</td></tr>
      </tbody>
    </table>
    <h4>Experience Costs (XP)</h4>
    <table class="guide-cost-grid">
      <thead><tr><th>Trait</th><th>XP Cost</th></tr></thead>
      <tbody>
        <tr><td>New Ability</td><td>3</td></tr>
        <tr><td>Attribute</td><td>current &times; 4</td></tr>
        <tr><td>Ability</td><td>current &times; 2</td></tr>
        <tr><td>Numina Path</td><td>current &times; 7 (New: 7)</td></tr>
        <tr><td>Virtue / Humanity</td><td>current &times; 2</td></tr>
        <tr><td>Willpower</td><td>current</td></tr>
      </tbody>
    </table>
    <h4>Specialties</h4>
    <p>Attributes and Abilities rated 4+ gain a Specialty (re-roll 10s on related checks).</p>
  `,
  vampire: `
    <h4>Creation Process (V20)</h4>
    <ul>
      <li><strong>Attributes:</strong> +7 / +5 / +3 priority dots<span class="guide-note">Starts with 1 dot each (10 / 8 / 6 category totals; 24 total)</span></li>
      <li><strong>Abilities:</strong> 13 / 9 / 5 (max 3 before Freebies)</li>
      <li><strong>Disciplines:</strong> 3</li>
      <li><strong>Backgrounds:</strong> 5</li>
      <li><strong>Virtues:</strong> 7 (start at 1 each)</li>
      <li><strong>Freebie Points:</strong> 15</li>
    </ul>
    <h4>Key Traits</h4>
    <ul>
      <li><strong>Humanity / Path:</strong> Conscience + Self-Control</li>
      <li><strong>Willpower:</strong> Equal to Courage rating</li>
      <li><strong>Blood Pool:</strong> 13th Gen starts with Max 10, Spend 1/turn (adjusted by Generation Background).</li>
    </ul>
    <h4>Freebie Point Costs (15 pts)</h4>
    <table class="guide-cost-grid">
      <thead><tr><th>Trait</th><th>Cost</th></tr></thead>
      <tbody>
        <tr><td>Attribute</td><td>5 / dot</td></tr>
        <tr><td>Ability</td><td>2 / dot</td></tr>
        <tr><td>Discipline</td><td>7 / dot</td></tr>
        <tr><td>Background</td><td>1 / dot</td></tr>
        <tr><td>Virtue</td><td>2 / dot</td></tr>
        <tr><td>Humanity / Path</td><td>2 / dot</td></tr>
        <tr><td>Willpower</td><td>1 / dot</td></tr>
        <tr><td>Merits / Flaws</td><td>Rating (Flaws max +7)</td></tr>
      </tbody>
    </table>
    <h4>Experience Costs (XP)</h4>
    <table class="guide-cost-grid">
      <thead><tr><th>Trait</th><th>XP Cost</th></tr></thead>
      <tbody>
        <tr><td>New Ability</td><td>3</td></tr>
        <tr><td>New Discipline / Path</td><td>10 / 7</td></tr>
        <tr><td>Attribute</td><td>current &times; 4</td></tr>
        <tr><td>Ability</td><td>current &times; 2</td></tr>
        <tr><td>Clan Discipline</td><td>current &times; 5</td></tr>
        <tr><td>Other Discipline</td><td>current &times; 7</td></tr>
        <tr><td>Secondary Path</td><td>current &times; 4</td></tr>
        <tr><td>Virtue / Humanity / Path</td><td>current &times; 2</td></tr>
        <tr><td>Willpower</td><td>current</td></tr>
      </tbody>
    </table>
    <h4>Specialties</h4>
    <p>Attributes and Abilities rated 4+ gain a Specialty.</p>
  `,
  werewolf: `
    <h4>Creation Process (W20)</h4>
    <ul>
      <li><strong>Attributes:</strong> +7 / +5 / +3 priority dots<span class="guide-note">Starts with 1 dot each (10 / 8 / 6 category totals; 24 total)</span></li>
      <li><strong>Abilities:</strong> 13 / 9 / 5 (max 3 before Freebies)</li>
      <li><strong>Gifts:</strong> 3 (1 Breed, 1 Auspice, 1 Tribe)</li>
      <li><strong>Backgrounds:</strong> 5</li>
      <li><strong>Freebie Points:</strong> 15</li>
    </ul>
    <h4>Key Traits</h4>
    <ul>
      <li><strong>Rage:</strong> By Auspice (Ragabash 1 to Ahroun 5)</li>
      <li><strong>Gnosis:</strong> By Breed (Homid 1, Metis 3, Lupus 5)</li>
      <li><strong>Willpower &amp; Renown:</strong> Determined by Tribe &amp; Auspice.</li>
    </ul>
    <h4>Freebie Point Costs (15 pts)</h4>
    <table class="guide-cost-grid">
      <thead><tr><th>Trait</th><th>Cost</th></tr></thead>
      <tbody>
        <tr><td>Attribute</td><td>5 / dot</td></tr>
        <tr><td>Ability</td><td>2 / dot</td></tr>
        <tr><td>Gift (Level 1)</td><td>7 / Gift</td></tr>
        <tr><td>Background</td><td>1 / dot</td></tr>
        <tr><td>Rage</td><td>1 / dot</td></tr>
        <tr><td>Gnosis</td><td>2 / dot</td></tr>
        <tr><td>Willpower</td><td>1 / dot</td></tr>
        <tr><td>Merits / Flaws</td><td>Rating (Flaws max +7)</td></tr>
      </tbody>
    </table>
    <h4>Experience Costs (XP)</h4>
    <table class="guide-cost-grid">
      <thead><tr><th>Trait</th><th>XP Cost</th></tr></thead>
      <tbody>
        <tr><td>New Ability</td><td>3</td></tr>
        <tr><td>Attribute</td><td>current &times; 4</td></tr>
        <tr><td>Ability</td><td>current &times; 2</td></tr>
        <tr><td>In-Breed/Auspice/Tribe Gift</td><td>level &times; 3</td></tr>
        <tr><td>Outside Gift</td><td>level &times; 5</td></tr>
        <tr><td>Rage</td><td>current</td></tr>
        <tr><td>Gnosis</td><td>current &times; 2</td></tr>
        <tr><td>Willpower</td><td>current</td></tr>
      </tbody>
    </table>
    <h4>Specialties</h4>
    <p>Attributes and Abilities rated 4+ gain a Specialty.</p>
  `,
  mage: `
    <h4>Creation Process (M20)</h4>
    <ul>
      <li><strong>Attributes:</strong> +7 / +5 / +3 priority dots<span class="guide-note">Starts with 1 dot each (10 / 8 / 6 category totals; 24 total)</span></li>
      <li><strong>Abilities:</strong> 13 / 9 / 5 (max 3 before Freebies)</li>
      <li><strong>Spheres:</strong> 6 (min 1 in Affinity Sphere)</li>
      <li><strong>Backgrounds:</strong> 7</li>
      <li><strong>Freebie Points:</strong> 15</li>
    </ul>
    <h4>Key Traits</h4>
    <ul>
      <li><strong>Arete:</strong> Starts at 1 (max 3 at creation; caps Spheres)</li>
      <li><strong>Willpower:</strong> Starts at 5</li>
      <li><strong>Quintessence:</strong> Starts equal to Avatar rating.</li>
    </ul>
    <h4>Freebie Point Costs (15 pts)</h4>
    <table class="guide-cost-grid">
      <thead><tr><th>Trait</th><th>Cost</th></tr></thead>
      <tbody>
        <tr><td>Attribute</td><td>5 / dot</td></tr>
        <tr><td>Ability</td><td>2 / dot</td></tr>
        <tr><td>Sphere</td><td>7 / dot</td></tr>
        <tr><td>Arete</td><td>4 / dot (max 3)</td></tr>
        <tr><td>Background</td><td>1 / dot</td></tr>
        <tr><td>Willpower</td><td>1 / dot</td></tr>
        <tr><td>Quintessence</td><td>1 / 4 pts</td></tr>
        <tr><td>Merits / Flaws</td><td>Rating (Flaws max +7)</td></tr>
      </tbody>
    </table>
    <h4>Experience Costs (XP)</h4>
    <table class="guide-cost-grid">
      <thead><tr><th>Trait</th><th>XP Cost</th></tr></thead>
      <tbody>
        <tr><td>New Ability</td><td>3</td></tr>
        <tr><td>New Sphere</td><td>10</td></tr>
        <tr><td>Attribute</td><td>current &times; 4</td></tr>
        <tr><td>Ability</td><td>current &times; 2</td></tr>
        <tr><td>Affinity Sphere</td><td>current &times; 7</td></tr>
        <tr><td>Other Sphere</td><td>current &times; 8</td></tr>
        <tr><td>Arete</td><td>current &times; 8</td></tr>
        <tr><td>Background (ST approval)</td><td>current &times; 3</td></tr>
        <tr><td>Willpower</td><td>current</td></tr>
      </tbody>
    </table>
    <h4>Specialties</h4>
    <p>Attributes, Abilities, and Spheres rated 4+ gain a Specialty.</p>
  `,
  changeling: `
    <h4>Creation Process (C20)</h4>
    <ul>
      <li><strong>Attributes:</strong> +7 / +5 / +3 priority dots<span class="guide-note">Starts with 1 dot each (10 / 8 / 6 category totals; 24 total)</span></li>
      <li><strong>Abilities:</strong> 13 / 9 / 5 (max 3 before Freebies)</li>
      <li><strong>Arts:</strong> 3</li>
      <li><strong>Realms:</strong> 5</li>
      <li><strong>Backgrounds:</strong> 5</li>
      <li><strong>Freebie Points:</strong> 15</li>
    </ul>
    <h4>Key Traits</h4>
    <ul>
      <li><strong>Base Pools:</strong> Glamour 4, Willpower 4, Banality 3 (modified by Seeming)</li>
      <li><strong>Health:</strong> Chimerical damage knocks unconscious; Real damage can kill.</li>
    </ul>
    <h4>Freebie Point Costs (15 pts)</h4>
    <table class="guide-cost-grid">
      <thead><tr><th>Trait</th><th>Cost</th></tr></thead>
      <tbody>
        <tr><td>Attribute</td><td>5 / dot</td></tr>
        <tr><td>Ability</td><td>2 / dot</td></tr>
        <tr><td>Art</td><td>5 / dot</td></tr>
        <tr><td>Realm</td><td>2 / dot</td></tr>
        <tr><td>Background</td><td>1 / dot</td></tr>
        <tr><td>Glamour</td><td>3 / dot</td></tr>
        <tr><td>Willpower</td><td>1 / dot</td></tr>
        <tr><td>Merits / Flaws</td><td>Rating (Flaws max +7)</td></tr>
      </tbody>
    </table>
    <h4>Experience Costs (XP)</h4>
    <table class="guide-cost-grid">
      <thead><tr><th>Trait</th><th>XP Cost</th></tr></thead>
      <tbody>
        <tr><td>New Ability</td><td>3</td></tr>
        <tr><td>New Art / New Realm</td><td>7 / 5</td></tr>
        <tr><td>Attribute</td><td>current &times; 4</td></tr>
        <tr><td>Ability</td><td>current &times; 2</td></tr>
        <tr><td>Art</td><td>current &times; 4</td></tr>
        <tr><td>Realm</td><td>current &times; 3</td></tr>
        <tr><td>Glamour</td><td>current &times; 3</td></tr>
        <tr><td>Willpower</td><td>current &times; 2</td></tr>
      </tbody>
    </table>
    <h4>Specialties</h4>
    <p>Attributes and Abilities rated 4+ gain a Specialty.</p>
  `,
  wraith: `
    <h4>Creation Process (Wr20)</h4>
    <ul>
      <li><strong>Attributes:</strong> +7 / +5 / +3 priority dots<span class="guide-note">Starts with 1 dot each (10 / 8 / 6 category totals; 24 total)</span></li>
      <li><strong>Abilities:</strong> 13 / 9 / 5 (max 3 before Freebies)</li>
      <li><strong>Arcanoi:</strong> 5 (min 1 in Guild Arcanos)</li>
      <li><strong>Backgrounds:</strong> 7</li>
      <li><strong>Passions / Fetters:</strong> 10 / 10 (max 5 each)</li>
      <li><strong>Freebie Points:</strong> 15</li>
    </ul>
    <h4>Key Traits</h4>
    <ul>
      <li><strong>Corpus:</strong> 10 (Permanent)</li>
      <li><strong>Willpower:</strong> Starts at 5</li>
      <li><strong>Pathos:</strong> Starts at 5 + Memoriam rating.</li>
    </ul>
    <h4>Freebie Point Costs (15 pts)</h4>
    <table class="guide-cost-grid">
      <thead><tr><th>Trait</th><th>Cost</th></tr></thead>
      <tbody>
        <tr><td>Attribute</td><td>5 / dot</td></tr>
        <tr><td>Ability</td><td>2 / dot</td></tr>
        <tr><td>Arcanos</td><td>5 / dot</td></tr>
        <tr><td>Background</td><td>1 / dot</td></tr>
        <tr><td>Passion</td><td>2 / dot</td></tr>
        <tr><td>Fetter / Pathos / Willpower</td><td>1 / dot</td></tr>
        <tr><td>Merits / Flaws</td><td>Rating (Flaws max +7)</td></tr>
      </tbody>
    </table>
    <h4>Experience Costs (XP)</h4>
    <table class="guide-cost-grid">
      <thead><tr><th>Trait</th><th>XP Cost</th></tr></thead>
      <tbody>
        <tr><td>New Ability</td><td>3</td></tr>
        <tr><td>New Arcanos (Guild)</td><td>7 (5)</td></tr>
        <tr><td>New Passion / Fetter</td><td>3</td></tr>
        <tr><td>Attribute</td><td>current &times; 4</td></tr>
        <tr><td>Ability</td><td>current &times; 2</td></tr>
        <tr><td>Arcanos (Guild)</td><td>current &times; 3 (&times; 2)</td></tr>
        <tr><td>Passion / Fetter</td><td>current &times; 3</td></tr>
        <tr><td>Pathos</td><td>current &times; 2</td></tr>
        <tr><td>Willpower</td><td>current</td></tr>
      </tbody>
    </table>
    <h4>Specialties</h4>
    <p>Attributes and Abilities rated 4+ gain a Specialty.</p>
  `
};

function getDotVal(container, id) {
  const el = container.querySelector(`[data-id="${id}"]`);
  return el ? parseInt(el.dataset.val || '0', 10) : 0;
}

function sumDotsByPrefix(container, prefixes) {
  let total = 0;
  container.querySelectorAll('.dots-container').forEach(el => {
    const id = el.dataset.id || '';
    if (prefixes.some(p => id.startsWith(p))) {
      total += parseInt(el.dataset.val || '0', 10);
    }
  });
  return total;
}

function updateGuideTally() {
  const tallyEl = document.getElementById('guideTally');
  const active = document.getElementById('splat-' + currentSplat);
  if (!tallyEl || !active) return;

  const phys = ['str', 'dex', 'sta'].reduce((s, k) => s + getDotVal(active, `${currentSplat}_attr_${k}`), 0);
  const soc = ['cha', 'man', 'app'].reduce((s, k) => s + getDotVal(active, `${currentSplat}_attr_${k}`), 0);
  const ment = ['per', 'int', 'wit'].reduce((s, k) => s + getDotVal(active, `${currentSplat}_attr_${k}`), 0);
  const attrTotal = phys + soc + ment;
  const pSpent = phys - 3;
  const sSpent = soc - 3;
  const mSpent = ment - 3;
  const fmtSpent = (n) => (n >= 0 ? `+${n}` : `${n}`);
  const expectedAttrTotal = currentSplat === 'mortal' ? 22 : 24;

  const tal = sumDotsByPrefix(active, [`${currentSplat}_abi_0_`, `${currentSplat}_custom_abi_0_`]);
  const ski = sumDotsByPrefix(active, [`${currentSplat}_abi_1_`, `${currentSplat}_custom_abi_1_`]);
  const kno = sumDotsByPrefix(active, [`${currentSplat}_abi_2_`, `${currentSplat}_custom_abi_2_`]);
  const abiTotal = tal + ski + kno;

  let advSummary = '';
  if (currentSplat === 'mortal') {
    const numina = sumDotsByPrefix(active, ['mortal_adv_0_']);
    const bgs = sumDotsByPrefix(active, ['mortal_adv_1_']);
    const virt = sumDotsByPrefix(active, ['mortal_adv_2_']);
    advSummary = `Numina ${numina} · BGs ${bgs} · Virtues ${virt}`;
  } else if (currentSplat === 'vampire') {
    const disc = sumDotsByPrefix(active, ['vampire_adv_0_']);
    const bgs = sumDotsByPrefix(active, ['vampire_adv_1_']);
    const virt = sumDotsByPrefix(active, ['vampire_adv_2_']);
    advSummary = `Disc ${disc} · BGs ${bgs} · Virtues ${virt}`;
  } else if (currentSplat === 'werewolf') {
    const bgs = sumDotsByPrefix(active, ['werewolf_adv_0_']);
    const gifts = sumDotsByPrefix(active, ['werewolf_adv_1_', 'werewolf_adv_2_']);
    const renown = ['glory', 'honor', 'wisdom'].reduce((s, k) => s + getDotVal(active, `werewolf_${k}_dots`), 0);
    advSummary = `BGs ${bgs} · Gifts ${gifts} · Renown ${renown}`;
  } else if (currentSplat === 'mage') {
    const spheres = sumDotsByPrefix(active, ['mage_adv_0_']);
    const bgs = sumDotsByPrefix(active, ['mage_adv_1_']);
    const other = sumDotsByPrefix(active, ['mage_adv_2_']);
    advSummary = `Spheres ${spheres} · BGs ${bgs} · Other ${other}`;
  } else if (currentSplat === 'changeling') {
    const bgs = sumDotsByPrefix(active, ['changeling_adv_0_']);
    const arts = sumDotsByPrefix(active, ['changeling_adv_1_']);
    const realms = sumDotsByPrefix(active, ['changeling_adv_2_']);
    advSummary = `BGs ${bgs} · Arts ${arts} · Realms ${realms}`;
  } else if (currentSplat === 'wraith') {
    const bgs = sumDotsByPrefix(active, ['wraith_adv_0_']);
    const arcanoi = sumDotsByPrefix(active, ['wraith_adv_1_']);
    const pf = sumDotsByPrefix(active, ['wraith_adv_2_']);
    advSummary = `BGs ${bgs} · Arcanoi ${arcanoi} · P&F ${pf}`;
  }

  tallyEl.innerHTML = `
    <div class="guide-tally-title">Current Sheet Dot Tally</div>
    <div class="guide-tally-row">
      <span class="guide-tally-label">Attributes:</span>
      <span class="guide-tally-val">${fmtSpent(pSpent)} / ${fmtSpent(sSpent)} / ${fmtSpent(mSpent)} <span class="guide-tally-total">(${attrTotal}/${expectedAttrTotal})</span></span>
    </div>
    <div class="guide-tally-row">
      <span class="guide-tally-label">Abilities:</span>
      <span class="guide-tally-val">T ${tal} / S ${ski} / K ${kno} <span class="guide-tally-total">(${abiTotal})</span></span>
    </div>
    <div class="guide-tally-row">
      <span class="guide-tally-label">Advantages:</span>
      <span class="guide-tally-val">${advSummary}</span>
    </div>
  `;
}

function updateGuidePanel() {
  const content = document.getElementById('guideContent');
  const title = document.getElementById('guideTitle');
  if (content && SPLAT_GUIDES[currentSplat]) {
    content.innerHTML = SPLAT_GUIDES[currentSplat];
    const splatNames = { mortal: 'Mortal', vampire: 'Vampire', werewolf: 'Werewolf', mage: 'Mage', changeling: 'Changeling', wraith: 'Wraith' };
    title.textContent = `${splatNames[currentSplat]} Creation Guide`;
  }
  updateGuideTally();
}

function toggleGuide() {
  const panel = document.getElementById('guidePanel');
  if (panel) {
    const opening = !panel.classList.contains('open');
    panel.classList.toggle('open', opening);
    if (opening) updateGuideTally();
  }
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.protocol === 'http:')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }
}

function bindGuide() {
  document.getElementById('toggleGuideBtn').addEventListener('click', toggleGuide);
  document.getElementById('closeGuideBtn').addEventListener('click', toggleGuide);
}
