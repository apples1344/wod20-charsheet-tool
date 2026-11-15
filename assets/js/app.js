import { SAMPLE_CHARACTERS } from './sampleCharacters.js';

const STORAGE_KEY = 'wod_1to1_sheet_v3';
const THEME_STORAGE_KEY = 'wod_sheet_theme_v1';
const COMPACT_STORAGE_KEY = 'wod_sheet_compact_v1';
const SHARE_DOMAIN_PLACEHOLDER = 'https://wod20-charsheet-tool.vercel.app/';
const DEFAULT_MF_ROWS = 5;
const DEFAULT_COMBAT_ROWS = 6;
const SPLAT_DISPLAY_NAMES = {
  mortal: 'Mortal / Hunter',
  vampire: 'Vampire (V20)',
  werewolf: 'Werewolf (W20)',
  mage: 'Mage (M20)',
  changeling: 'Changeling (C20)',
  wraith: 'Wraith (Wr20)'
};
let lastSharedSnapshot = '';
let isTenDotMode = false;
let isCompactMode = false;
let currentTheme = 'dark';
let isRestoring = false;
let isSheetDirty = false;
let pendingSampleKey = '';
let autoSaveTimer = null;
let resizeTimer = null;
let currentSplat = 'mortal';
let currentWerewolfForm = 'homid';
let activeSlotId = null;
let rosterDeleteConfirmId = null;

const WEREWOLF_FORMS = {
  homid: {
    label: 'Homid',
    str: 0, dex: 0, sta: 0, man: 0, app: 0,
    summary: 'Base Form · No attribute modifiers'
  },
  glabro: {
    label: 'Glabro',
    str: 2, dex: 0, sta: 2, man: -2, app: -1,
    summary: 'Str +2 · Sta +2 · Man -2 · App -1'
  },
  crinos: {
    label: 'Crinos',
    str: 4, dex: 1, sta: 3, man: 'zero', app: 'zero',
    summary: 'Str +4 · Dex +1 · Sta +3 · Man 0 · App 0 · Claws Str+2 Agg / Bite Str+1 Agg'
  },
  hispo: {
    label: 'Hispo',
    str: 3, dex: 2, sta: 3, man: 'zero', app: 0,
    summary: 'Str +3 · Dex +2 · Sta +3 · Man 0 · Bite Str+2 Agg / Claws Str+1 Agg'
  },
  lupus: {
    label: 'Lupus',
    str: 1, dex: 2, sta: 2, man: 'zero', app: 0,
    summary: 'Str +1 · Dex +2 · Sta +2 · Man 0 · Bite Str+1 Agg'
  }
};

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
  restoreSavedTheme();
  restoreSavedCompactMode();
  syncAppBarOffset();
  initDotsAndBoxes();
  initHealthBoxes();
  bindControls();
  bindRosterControls();
  bindDragAndDrop();
  bindGuide();
  bindDiceRoller();
  updateGuidePanel();
  registerServiceWorker();

  const loaded = await checkUrlForCharacter();
  if (!loaded) {
    restoreFromLocalStorage();
  } else {
    const importedState = captureCurrentState();
    const store = loadGlobalStore();
    const stateJson = JSON.stringify(importedState);
    const existingSlot = store.roster.find(s => JSON.stringify(s.state) === stateJson);
    if (existingSlot) {
      activeSlotId = existingSlot.id;
      store.activeSplat = currentSplat;
      store.activeSlotId = existingSlot.id;
    } else {
      const slot = createSlotRecord(importedState);
      store.roster.push(slot);
      store.activeSplat = currentSplat;
      store.activeSlotId = slot.id;
      activeSlotId = slot.id;
    }
    saveGlobalStore(store);
    isRestoring = true;
    switchSplat(currentSplat);
    isRestoring = false;
    renderRosterUI();
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
      const resetRosterModal = document.getElementById('resetRosterModal');
      if (resetRosterModal && resetRosterModal.style.display !== 'none') {
        resetRosterModal.style.display = 'none';
        return;
      }
      const rosterModal = document.getElementById('rosterModal');
      if (rosterModal && rosterModal.style.display !== 'none') {
        closeRosterModal();
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
        if (toggleBtn) {
          toggleBtn.classList.remove('active');
          toggleBtn.setAttribute('aria-expanded', 'false');
          toggleBtn.focus();
        }
        return;
      }
      const dicePanel = document.getElementById('dicePanel');
      if (dicePanel && dicePanel.classList.contains('open')) {
        dicePanel.classList.remove('open');
        const toggleDiceBtn = document.getElementById('toggleDiceBtn');
        if (toggleDiceBtn) {
          toggleDiceBtn.classList.remove('active');
          toggleDiceBtn.setAttribute('aria-expanded', 'false');
          toggleDiceBtn.focus();
        }
      }
    }
  });


  // Dropdown Menu Logic
  const moreBtn = document.getElementById('moreOptionsBtn');
  const moreMenu = document.getElementById('moreOptionsMenu');
  if (moreBtn && moreMenu) {
    moreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isExpanded = moreBtn.getAttribute('aria-expanded') === 'true';
      moreBtn.setAttribute('aria-expanded', !isExpanded);
      moreMenu.classList.toggle('show', !isExpanded);
    });
    
    document.addEventListener('click', (e) => {
      if (!moreBtn.contains(e.target) && !moreMenu.contains(e.target)) {
        moreBtn.setAttribute('aria-expanded', 'false');
        moreMenu.classList.remove('show');
      }
    });

    moreMenu.addEventListener('click', (e) => {
      if (e.target.closest('.dropdown-item')) {
        moreBtn.setAttribute('aria-expanded', 'false');
        moreMenu.classList.remove('show');
      }
    });
  }

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
    handleSplatDropdownChange(e.target.value);
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
  const sampleConfirmModalEl = document.getElementById('sampleConfirmModal');
  if (sampleConfirmModalEl) {
    sampleConfirmModalEl.addEventListener('click', (e) => {
      if (e.target === sampleConfirmModalEl) {
        sampleConfirmModalEl.style.display = 'none';
        document.getElementById('sampleCharSelect').value = '';
        pendingSampleKey = '';
      }
    });
  }

  document.getElementById('confirmSampleBtn').addEventListener('click', () => {
    document.getElementById('sampleConfirmModal').style.display = 'none';
    const key = pendingSampleKey;
    pendingSampleKey = '';
    if (key) loadSampleCharacter(key);
  });

  document.getElementById('dotToggleBtn').addEventListener('click', () => {
    isTenDotMode = !isTenDotMode;
    document.body.classList.toggle('mode-10-dot', isTenDotMode);
    const dtl = document.getElementById('dotToggleLabel'); if(dtl) dtl.textContent = isTenDotMode ? 'Revert to 5-Dot Mode' : 'Enable 10-Dot Mode';
    if (typeof syncGuideTenDotMode === 'function') syncGuideTenDotMode();
    isSheetDirty = true;
    scheduleAutoSave();
  });

  const themeBtn = document.getElementById('themeToggleBtn');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      applyTheme(currentTheme === 'parchment' ? 'dark' : 'parchment', true);
    });
  }

  const compactBtn = document.getElementById('compactToggleBtn');
  if (compactBtn) {
    compactBtn.addEventListener('click', () => {
      applyCompactMode(!isCompactMode, true);
      showToast(isCompactMode ? 'Compact / Dense Mode Enabled' : 'Standard Layout Restored');
    });
  }

  document.getElementById('resetSheetBtn').addEventListener('click', () => {
    document.getElementById('clearModal').style.display = 'flex';
  });
  document.getElementById('cancelClearBtn').addEventListener('click', () => {
    document.getElementById('clearModal').style.display = 'none';
  });
  const clearModalEl = document.getElementById('clearModal');
  if (clearModalEl) {
    clearModalEl.addEventListener('click', (e) => {
      if (e.target === clearModalEl) clearModalEl.style.display = 'none';
    });
  }
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
  const hardResetModalEl = document.getElementById('hardResetModal');
  if (hardResetModalEl) {
    hardResetModalEl.addEventListener('click', (e) => {
      if (e.target === hardResetModalEl) hardResetModalEl.style.display = 'none';
    });
  }
  document.getElementById('confirmHardResetBtn').addEventListener('click', () => {
    document.getElementById('hardResetModal').style.display = 'none';
    hardResetWebsite();
  });

  window.addEventListener('beforeprint', () => {
    const active = document.getElementById('splat-' + currentSplat);
    if (active) autoResizeTextareas(active);
    prepareCompactPrintRows();
    ensureSyncShareLinkForPrint();
  });
  window.addEventListener('afterprint', () => {
    cleanupCompactPrintRows();
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

    const tempStepBtn = e.target.closest('.temp-step-btn');
    if (tempStepBtn) {
      const targetId = tempStepBtn.dataset.target;
      const delta = parseInt(tempStepBtn.dataset.delta || '0', 10);
      const container = targetId ? document.querySelector(`.boxes-container[data-id="${targetId}"]`) : null;
      if (container && delta !== 0) {
        stepTemporaryBoxes(container, delta);
      }
      return;
    }

    const shiftBtn = e.target.closest('.shift-form-btn');
    if (shiftBtn) {
      const form = shiftBtn.dataset.form;
      if (form && WEREWOLF_FORMS[form] && currentWerewolfForm !== form) {
        currentWerewolfForm = form;
        updateWerewolfFormUI();
        if (typeof refreshSelectedDiceTraits === 'function') refreshSelectedDiceTraits();
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
      if (e.target.classList.contains('trait-spec-input')) {
        syncSpecialtyTitle(e.target);
      }
      isSheetDirty = true;
      scheduleAutoSave();
      if (e.target.id === currentSplat + '_char_name') {
        updateDocumentTitle();
      }
      if (e.target.id === 'vampire_char_gen') {
        updateSplatHelpers();
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
  const isSticky = appBar && window.getComputedStyle(appBar).position === 'sticky';
  const height = isSticky ? appBar.offsetHeight : 0;
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
  return stateHasAnyData(captureCurrentState());
}

function getTraitContextLabel(container) {
  const row = container.closest('.trait-row, .trait-flex-row, .pool-box');
  if (!row) return container.dataset.id || 'Trait';
  const lbl = row.querySelector('.trait-label, .pool-title-text, .pool-title');
  if (lbl && lbl.textContent.trim()) return lbl.textContent.trim();
  const inp = row.querySelector('input.trait-name-input');
  if (inp && inp.value.trim()) return inp.value.trim();
  return container.dataset.id || 'Trait';
}

function getPairedBoxContainers(container) {
  const id = container.dataset.id || '';
  const match = id.match(/^(.+_sq)([1234])$/);
  if (!match) return null;
  const scope = container.closest('.pool-box') || document;
  const row1 = scope.querySelector(`[data-id="${match[1]}1"]`);
  const row2 = scope.querySelector(`[data-id="${match[1]}2"]`);
  const row3 = scope.querySelector(`[data-id="${match[1]}3"]`);
  const row4 = scope.querySelector(`[data-id="${match[1]}4"]`);
  if (!row1 || !row2) return null;
  return { row1, row2, row3, row4, rowNum: parseInt(match[2], 10), baseId: match[1] };
}

function stepTemporaryBoxes(container, delta) {
  const paired = getPairedBoxContainers(container);
  if (paired) {
    const maxVal = paired.row4 ? 40 : 20;
    let currentTotal = getPairedBoxTotal(paired.baseId);
    const nextTotal = Math.max(0, Math.min(maxVal, currentTotal + delta));
    if (nextTotal === currentTotal) return;
    setPairedBoxTotal(paired.baseId, nextTotal);
  } else {
    const current = parseInt(container.dataset.val || '0', 10);
    const next = Math.max(0, Math.min(10, current + delta));
    if (next === current) return;
    container.dataset.val = next;
    updateVisual(container, next, 'square-box');
  }
  updatePoolCounters(container.closest('.pool-box') || document);
  isSheetDirty = true;
  scheduleAutoSave();
}

function bindDotContainer(container) {
  const isSquare = container.classList.contains('boxes-container');
  const childClass = isSquare ? 'square-box' : 'dot';
  const contextLabel = getTraitContextLabel(container);
  const paired = isSquare ? getPairedBoxContainers(container) : null;
  const idxOffset = paired ? (paired.rowNum - 1) * 10 : 0;

  container.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (paired) {
      if (getPairedBoxTotal(paired.baseId) === 0) return;
      setPairedBoxTotal(paired.baseId, 0);
    } else {
      const current = parseInt(container.dataset.val || '0', 10);
      if (current === 0) return;
      container.dataset.val = 0;
      updateVisual(container, 0, childClass);
      if (!isSquare) {
        updateGuideTally();
        if (container.dataset.id && container.dataset.id.startsWith('werewolf_attr_')) updateWerewolfFormUI();
      }
      if (typeof refreshSelectedDiceTraits === 'function') refreshSelectedDiceTraits();
    }
    updatePoolCounters(container.closest('.pool-box') || document);
    isSheetDirty = true;
    scheduleAutoSave();
  });

  const setHoverTrail = (hoverTotal) => {
    if (paired) {
      const rows = [paired.row1, paired.row2, paired.row3, paired.row4].filter(Boolean);
      rows.forEach((r, rIdx) => {
        r.querySelectorAll('.' + childClass).forEach(b => {
          const idx = parseInt(b.dataset.idx, 10) + (rIdx * 10);
          b.classList.toggle('hover-preview', hoverTotal > 0 && idx <= hoverTotal);
        });
      });
    } else {
      container.querySelectorAll('.' + childClass).forEach(b => {
        const idx = parseInt(b.dataset.idx, 10);
        b.classList.toggle('hover-preview', hoverTotal > 0 && idx <= hoverTotal);
      });
    }
  };
  container.addEventListener('mouseleave', () => setHoverTrail(0));

  container.querySelectorAll('.' + childClass).forEach(el => {
    const rawIdx = parseInt(el.dataset.idx, 10);
    const displayIdx = rawIdx + idxOffset;
    el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', `${contextLabel} ${isSquare ? 'box' : 'dot'} ${displayIdx}`);
    el.addEventListener('mouseenter', () => setHoverTrail(displayIdx));
    const clickHandler = () => {
      if (paired) {
        const currentTotal = getPairedBoxTotal(paired.baseId);
        const clickedTotal = displayIdx;
        const nextTotal = currentTotal === clickedTotal ? Math.max(0, clickedTotal - 1) : clickedTotal;
        setPairedBoxTotal(paired.baseId, nextTotal);
      } else {
        const current = parseInt(container.dataset.val || '0', 10);
        const next = current === rawIdx ? Math.max(0, rawIdx - 1) : rawIdx;
        container.dataset.val = next;
        updateVisual(container, next, childClass);
        if (!isSquare) {
          updateGuideTally();
          if (container.dataset.id && container.dataset.id.startsWith('werewolf_attr_')) updateWerewolfFormUI();
        }
        if (typeof refreshSelectedDiceTraits === 'function') refreshSelectedDiceTraits();
      }
      updatePoolCounters(container.closest('.pool-box') || document);
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
  html += `<input type="text" class="trait-spec-input" id="${splat}_custom_abi_${catIdx}_${idx}_spec" placeholder="Spec" aria-label="Specialty">`;
  html += `<div class="dots-container" data-id="${splat}_custom_abi_${catIdx}_${idx}_dots" data-val="0">`;
  for (let i = 1; i <= 10; i++) {
    html += `<span class="dot${i > 5 ? ' dot-scalable-10' : ''}" data-idx="${i}"></span>`;
  }
  html += `</div>`;
  html += `<button type="button" class="roll-trait-mini-btn no-print" title="Roll Trait" aria-label="Roll Trait">d10</button>`;
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

  flushAutoSave();
  const reuseBlankSlot = !hasActiveSheetData();
  if (!reuseBlankSlot) {
    activeSlotId = generateSlotId();
  }

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
  const dtl = document.getElementById('dotToggleLabel');
  if (dtl) dtl.textContent = 'Enable 10-Dot Mode';
  if (typeof syncGuideTenDotMode === 'function') syncGuideTenDotMode();
}

function getEffectiveAttrVal(splat, attrKey, container = document.getElementById('splat-' + splat)) {
  if (!container) return 0;
  const baseVal = getDotVal(container, `${splat}_attr_${attrKey}`);
  if (splat !== 'werewolf') return baseVal;
  const formCfg = WEREWOLF_FORMS[currentWerewolfForm] || WEREWOLF_FORMS.homid;
  const mod = formCfg[attrKey];
  if (mod === undefined || mod === 0) return baseVal;
  if (mod === 'zero') return 0;
  return Math.max(0, baseVal + mod);
}

function updateWerewolfFormUI() {
  const wwContainer = document.getElementById('splat-werewolf');
  if (!wwContainer) return;
  const formCfg = WEREWOLF_FORMS[currentWerewolfForm] || WEREWOLF_FORMS.homid;

  wwContainer.querySelectorAll('.shift-form-btn').forEach(btn => {
    const isActive = btn.dataset.form === currentWerewolfForm;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });

  const summaryEl = document.getElementById('werewolfFormSummary');
  if (summaryEl) {
    summaryEl.textContent = formCfg.summary;
  }

  const shiftedAttrs = ['str', 'dex', 'sta', 'man', 'app'];
  shiftedAttrs.forEach(attrKey => {
    const dotsEl = wwContainer.querySelector(`[data-id="werewolf_attr_${attrKey}"]`);
    const row = dotsEl ? dotsEl.closest('.trait-row') : null;
    if (!row) return;

    let badge = row.querySelector('.shift-attr-badge');
    const mod = formCfg[attrKey];
    if (currentWerewolfForm === 'homid' || mod === undefined || mod === 0) {
      if (badge) badge.remove();
      return;
    }

    const baseVal = getDotVal(wwContainer, `werewolf_attr_${attrKey}`);
    const effVal = getEffectiveAttrVal('werewolf', attrKey, wwContainer);

    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'shift-attr-badge no-print';
      const leader = row.querySelector('.trait-leader');
      if (leader) row.insertBefore(badge, leader);
      else row.insertBefore(badge, dotsEl);
    }

    badge.classList.remove('shift-up', 'shift-down', 'shift-zero');
    if (mod === 'zero') {
      badge.classList.add('shift-zero');
      badge.textContent = `→ 0`;
      badge.title = `${formCfg.label} form sets this attribute to 0`;
    } else if (mod > 0) {
      badge.classList.add('shift-up');
      badge.textContent = `→ ${effVal} (+${mod})`;
      badge.title = `${formCfg.label} form: ${baseVal} + ${mod} = ${effVal}`;
    } else {
      badge.classList.add('shift-down');
      badge.textContent = `→ ${effVal} (${mod})`;
      badge.title = `${formCfg.label} form: max(0, ${baseVal} ${mod}) = ${effVal}`;
    }
  });
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
    if (typeof clearDiceSelection === 'function') clearDiceSelection();
    updateActiveQuickNav();
    updateGuidePanel();
    requestAnimationFrame(() => autoResizeTextareas(active));
  }
}

function getPairedBoxTotal(baseSqId) {
  const row1 = document.querySelector(`.boxes-container[data-id="${baseSqId}1"]`);
  const row2 = document.querySelector(`.boxes-container[data-id="${baseSqId}2"]`);
  const row3 = document.querySelector(`.boxes-container[data-id="${baseSqId}3"]`);
  const row4 = document.querySelector(`.boxes-container[data-id="${baseSqId}4"]`);
  if (!row1 || !row2) return 0;
  let t = parseInt(row1.dataset.val || '0', 10) + parseInt(row2.dataset.val || '0', 10);
  if (row3) t += parseInt(row3.dataset.val || '0', 10);
  if (row4) t += parseInt(row4.dataset.val || '0', 10);
  return t;
}

function getVampireGenStats(rawGenStr) {
  const match = String(rawGenStr || '').match(/(\d+)/);
  const gen = match ? parseInt(match[1], 10) : 13;
  const table = {
    15: { max: 10, perTurn: '1/turn' },
    14: { max: 10, perTurn: '1/turn' },
    13: { max: 10, perTurn: '1/turn' },
    12: { max: 11, perTurn: '1/turn' },
    11: { max: 12, perTurn: '1/turn' },
    10: { max: 13, perTurn: '1/turn' },
    9:  { max: 14, perTurn: '2/turn' },
    8:  { max: 15, perTurn: '3/turn' },
    7:  { max: 20, perTurn: '4/turn' },
    6:  { max: 30, perTurn: '6/turn' },
    5:  { max: 40, perTurn: '8/turn' },
    4:  { max: 50, perTurn: '10/turn' }
  };
  let stats;
  if (gen >= 14) stats = { max: 10, perTurn: '1/turn' };
  else if (gen <= 3) stats = { max: '100+', perTurn: '10+/turn' };
  else stats = table[gen] || { max: 10, perTurn: '1/turn' };
  const suffix = (gen % 100 >= 11 && gen % 100 <= 13)
    ? 'th'
    : ({ 1: 'st', 2: 'nd', 3: 'rd' }[gen % 10] || 'th');
  return { gen, label: `${gen}${suffix} Gen`, max: stats.max, perTurn: stats.perTurn };
}

function updateSplatHelpers() {
  // 1. Vampire Generation Blood Pool Helper (V20)
  const vampBadge = document.getElementById('vampire_gen_badge');
  if (vampBadge) {
    const genVal = document.getElementById('vampire_char_gen')?.value || '';
    const info = getVampireGenStats(genVal);
    vampBadge.textContent = `${info.label} · Max ${info.max} · ${info.perTurn}`;
    vampBadge.classList.remove('helper-warn', 'helper-danger');
    if (typeof info.max === 'number') {
      const curBlood = getPairedBoxTotal('vampire_blood_sq');
      if (curBlood > info.max) {
        vampBadge.classList.add('helper-warn');
        vampBadge.title = `Current Blood (${curBlood}) exceeds ${info.label} maximum (${info.max})`;
      } else {
        vampBadge.title = `V20 ${info.label}: Max Blood Pool ${info.max}, Spend ${info.perTurn}`;
      }
    }
  }

  // 2. Mage Quintessence / Paradox 20-Point Wheel Visual & Warning (M20)
  updateMageWheelUI();
  const wheelBadge = document.getElementById('mage_wheel_badge');
  if (wheelBadge) {
    const quint = getPairedBoxTotal('mage_quint_sq');
    const para = getPairedBoxTotal('mage_para_sq');
    const total = quint + para;
    wheelBadge.classList.remove('helper-warn', 'helper-danger');
    if (total > 20) {
      const overflow = total - 20;
      wheelBadge.textContent = `Wheel: ${total}/20 (-${overflow} Quint)`;
      wheelBadge.classList.add('helper-danger');
      wheelBadge.title = `Paradox overflow! ${overflow} point(s) exceed the 20-point wheel and burn away Quintessence.`;
    } else if (total >= 17 || para >= 5) {
      wheelBadge.textContent = `Wheel: ${total} / 20`;
      wheelBadge.classList.add('helper-warn');
      wheelBadge.title = `Approaching 20-point Quintessence + Paradox wheel limit (${20 - total} open).`;
    } else {
      wheelBadge.textContent = `Wheel: ${total} / 20`;
      wheelBadge.title = `M20 Quintessence (${quint}) + Paradox (${para}) = ${total} / 20 wheel slots.`;
    }
  }

  // 3. Wraith Catharsis / Shadow Alert (Wr20)
  const cathBadge = document.getElementById('wraith_catharsis_badge');
  if (cathBadge) {
    const angstSq = document.querySelector('.boxes-container[data-id="wraith_angst_sq"]');
    const wpDots = document.querySelector('.dots-container[data-id="wraith_wp_dots"]');
    const psycheWpDots = document.querySelector('.dots-container[data-id="wraith_psyche_wp"]');
    const tempAngst = angstSq ? parseInt(angstSq.dataset.val || '0', 10) : 0;
    const permWp = wpDots ? parseInt(wpDots.dataset.val || '0', 10) : 0;
    const psycheWp = psycheWpDots ? parseInt(psycheWpDots.dataset.val || '0', 10) : 0;
    const threshold = permWp > 0 ? permWp : psycheWp;

    cathBadge.classList.remove('helper-warn', 'helper-danger');
    if (threshold > 0 && tempAngst >= threshold) {
      cathBadge.textContent = `Catharsis! (${tempAngst} ≥ WP ${threshold})`;
      cathBadge.classList.add('helper-danger');
      cathBadge.title = `Temporary Angst (${tempAngst}) equals or exceeds Permanent Willpower (${threshold}) — Catharsis triggered!`;
    } else if (threshold > 0 && tempAngst === threshold - 1 && tempAngst > 0) {
      cathBadge.textContent = `Near Catharsis (${tempAngst}/${threshold})`;
      cathBadge.classList.add('helper-warn');
      cathBadge.title = `1 Temporary Angst away from Catharsis (Willpower ${threshold}).`;
    } else {
      cathBadge.textContent = `WP ${threshold} Threshold`;
      cathBadge.title = `Wr20 Catharsis triggers when Temporary Angst (${tempAngst}) reaches Permanent Willpower (${threshold}).`;
    }
  }
}

function updatePoolCounters(scope = document) {
  scope.querySelectorAll('.pool-counter-badge, .renown-counter-badge').forEach(badge => {
    const sqId = badge.dataset.sq;
    const dotsId = badge.dataset.dots;
    if (!sqId && dotsId) {
      const dotsEl = document.querySelector(`.dots-container[data-id="${dotsId}"]`);
      const val = dotsEl ? parseInt(dotsEl.dataset.val || '0', 10) : 0;
      badge.textContent = `${val} / 10`;
      return;
    }
    if (!sqId) return;
    const sqEl = document.querySelector(`.boxes-container[data-id="${sqId}"]`);
    if (!sqEl) return;

    const paired = getPairedBoxContainers(sqEl);
    let currentTemp = 0;
    let defaultMax = 10;
    if (paired) {
      currentTemp = getPairedBoxTotal(paired.baseId);
      defaultMax = paired.row4 ? 40 : 20;
    } else {
      currentTemp = parseInt(sqEl.dataset.val || '0', 10);
    }

    let maxVal = defaultMax;
    if (dotsId) {
      const dotsEl = document.querySelector(`.dots-container[data-id="${dotsId}"]`);
      if (dotsEl) {
        maxVal = parseInt(dotsEl.dataset.val || '0', 10);
      }
    }

    badge.textContent = badge.classList.contains('renown-counter-badge')
      ? `${currentTemp}/${maxVal}`
      : `${currentTemp} / ${maxVal}`;
  });
  updateSplatHelpers();
}

function setPairedBoxTotal(baseSqId, total) {
  const row1 = document.querySelector(`.boxes-container[data-id="${baseSqId}1"]`);
  const row2 = document.querySelector(`.boxes-container[data-id="${baseSqId}2"]`);
  const row3 = document.querySelector(`.boxes-container[data-id="${baseSqId}3"]`);
  const row4 = document.querySelector(`.boxes-container[data-id="${baseSqId}4"]`);
  if (!row1 || !row2) return;
  
  const maxVal = row4 ? 40 : 20;
  const clamped = Math.max(0, Math.min(maxVal, total));
  
  row1.dataset.val = Math.min(10, clamped);
  row2.dataset.val = Math.max(0, Math.min(10, clamped - 10));
  updateVisual(row1, row1.dataset.val, 'square-box');
  updateVisual(row2, row2.dataset.val, 'square-box');
  
  if (row3) {
    row3.dataset.val = Math.max(0, Math.min(10, clamped - 20));
    updateVisual(row3, row3.dataset.val, 'square-box');
  }
  if (row4) {
    row4.dataset.val = Math.max(0, clamped - 30);
    updateVisual(row4, row4.dataset.val, 'square-box');
  }
}

function initMageQuintParaWheel() {
  const wheelEl = document.getElementById('mageQuintParaWheel');
  if (!wheelEl) return;

  // Build 20 radially rotated boxes: slot 1 at +9 deg (clockwise from 12 o'clock) through slot 20 at +351 deg
  const radiusPct = 41.3; // 76px / 184px
  for (let slot = 1; slot <= 20; slot++) {
    const angleDeg = (slot - 0.5) * 18;
    const rad = (angleDeg * Math.PI) / 180;
    const xPct = (50 + radiusPct * Math.sin(rad)).toFixed(2);
    const yPct = (50 - radiusPct * Math.cos(rad)).toFixed(2);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mage-wheel-box';
    btn.dataset.slot = String(slot);
    btn.style.left = `${xPct}%`;
    btn.style.top = `${yPct}%`;
    btn.style.transform = `rotate(${angleDeg}deg)`;
    btn.style.setProperty('--counter-rot', `${-angleDeg}deg`);
    if (slot <= 10) {
      btn.setAttribute('aria-label', `Quintessence ${slot} (Wheel Slot ${slot})`);
      btn.title = `Quintessence ${slot}`;
    } else {
      const pIdx = slot - 10;
      btn.setAttribute('aria-label', `Paradox ${pIdx} (Wheel Slot ${slot})`);
      btn.title = `Paradox ${pIdx}`;
    }
    wheelEl.appendChild(btn);
  }

  const clearHover = () => {
    wheelEl.querySelectorAll('.wheel-hover-preview').forEach(el => el.classList.remove('wheel-hover-preview'));
  };
  wheelEl.addEventListener('mouseleave', clearHover);

  wheelEl.addEventListener('mouseover', (e) => {
    const btn = e.target.closest('.mage-wheel-box');
    clearHover();
    if (!btn) return;
    const slot = parseInt(btn.dataset.slot || '0', 10);
    const curQ = getPairedBoxTotal('mage_quint_sq');
    if (slot <= 10 || (curQ > 10 && slot <= curQ)) {
      for (let i = 1; i <= slot; i++) {
        wheelEl.querySelector(`.mage-wheel-box[data-slot="${i}"]`)?.classList.add('wheel-hover-preview');
      }
    } else {
      for (let i = 11; i <= slot; i++) {
        wheelEl.querySelector(`.mage-wheel-box[data-slot="${i}"]`)?.classList.add('wheel-hover-preview');
      }
    }
  });

  wheelEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.mage-wheel-box');
    if (!btn) return;
    const slot = parseInt(btn.dataset.slot || '0', 10);
    const curQ = getPairedBoxTotal('mage_quint_sq');
    const curP = getPairedBoxTotal('mage_para_sq');

    if (slot <= 10 || (curQ > 10 && slot <= curQ)) {
      const nextQ = curQ === slot ? Math.max(0, slot - 1) : slot;
      setPairedBoxTotal('mage_quint_sq', nextQ);
    } else {
      const targetP = slot - 10;
      const nextP = curP === targetP ? Math.max(0, targetP - 1) : targetP;
      setPairedBoxTotal('mage_para_sq', nextP);
    }
    updatePoolCounters(wheelEl.closest('.pool-box') || document);
    isSheetDirty = true;
    scheduleAutoSave();
  });

  wheelEl.addEventListener('contextmenu', (e) => {
    const btn = e.target.closest('.mage-wheel-box');
    if (!btn) return;
    e.preventDefault();
    const slot = parseInt(btn.dataset.slot || '0', 10);
    if (slot <= 10) {
      setPairedBoxTotal('mage_quint_sq', 0);
    } else {
      setPairedBoxTotal('mage_para_sq', 0);
    }
    updatePoolCounters(wheelEl.closest('.pool-box') || document);
    isSheetDirty = true;
    scheduleAutoSave();
  });
}

function updateMageWheelUI() {
  const wheelEl = document.getElementById('mageQuintParaWheel');
  if (!wheelEl) return;
  const quint = getPairedBoxTotal('mage_quint_sq');
  const para = getPairedBoxTotal('mage_para_sq');

  // Quintessence fills clockwise from top: slots 1 .. quint
  // Paradox fills clockwise from bottom: slots 11 .. 20, then wrapping 1 .. 10
  const paraSlots = new Set();
  for (let i = 0; i < para; i++) {
    const s = ((10 + i) % 20) + 1;
    paraSlots.add(s);
  }

  wheelEl.querySelectorAll('.mage-wheel-box').forEach(btn => {
    const slot = parseInt(btn.dataset.slot || '0', 10);
    const hasQ = slot <= quint;
    const hasP = paraSlots.has(slot);
    btn.classList.toggle('filled-quint', hasQ && !hasP);
    btn.classList.toggle('filled-para', hasP && !hasQ);
    btn.classList.toggle('filled-collision', hasQ && hasP);
  });
}

function initDotsAndBoxes() {
  document.querySelectorAll('.dots-container, .boxes-container').forEach(container => {
    bindDotContainer(container);
  });
  initMageQuintParaWheel();
  updatePoolCounters();
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
  if (typeof syncDiceWoundPenalty === 'function') syncDiceWoundPenalty();
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
    const reverseHandler = (e) => {
      e.preventDefault();
      const curState = box.dataset.state || 'empty';
      const prevIdx = (HEALTH_STATES.indexOf(curState) - 1 + HEALTH_STATES.length) % HEALTH_STATES.length;
      box.dataset.state = HEALTH_STATES[prevIdx];
      box.textContent = HEALTH_SYMBOLS[HEALTH_STATES[prevIdx]];
      updateHealthAriaLabel(box);
      const splat = (box.dataset.id || '').split('_')[0] || currentSplat;
      updateWoundPenalty(splat);
      isSheetDirty = true;
      scheduleAutoSave();
    };
    box.addEventListener('click', clickHandler);
    box.addEventListener('contextmenu', reverseHandler);
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
    ...(currentSplat === 'werewolf' ? { werewolfForm: currentWerewolfForm } : {}),
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
  currentWerewolfForm = (state.splat === 'werewolf' && state.werewolfForm && WEREWOLF_FORMS[state.werewolfForm])
    ? state.werewolfForm
    : 'homid';
  isTenDotMode = !!state.isTenDotMode;
  document.body.classList.toggle('mode-10-dot', isTenDotMode);
  const dtl = document.getElementById('dotToggleLabel'); if(dtl) dtl.textContent = isTenDotMode ? 'Revert to 5-Dot Mode' : 'Enable 10-Dot Mode';

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
      const defRows = (state.splat === 'wraith' && i === 1) ? 10 : 6;
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
  syncAllSpecialtyTitles(active);
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
  if (state.splat === 'werewolf') updateWerewolfFormUI();
  updatePoolCounters(active);
  updateDocumentTitle();
  updateGuideTally();
  if (typeof syncGuideTenDotMode === 'function') syncGuideTenDotMode();
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
  if (targetSplat === 'werewolf') {
    currentWerewolfForm = 'homid';
  }
  if (targetSplat === currentSplat) {
    resetTenDotModeUI();
  }
  setMeritFlawRowCount(targetSplat, 'merit', DEFAULT_MF_ROWS);
  setMeritFlawRowCount(targetSplat, 'flaw', DEFAULT_MF_ROWS);
  setCombatRowCount(targetSplat, DEFAULT_COMBAT_ROWS);
  for (let i = 0; i <= 2; i++) {
    const defRows = (targetSplat === 'wraith' && i === 1) ? 10 : 6;
    setDynRowCount(targetSplat, `adv_${i}`, defRows);
    setCustomAbiRowCount(targetSplat, i, 0);
  }
  active.querySelectorAll('input[type=text], textarea').forEach(el => {
    el.value = '';
    if (el.classList.contains('trait-spec-input')) {
      el.removeAttribute('title');
    }
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
  if (targetSplat === 'werewolf') updateWerewolfFormUI();
  updatePoolCounters(active);
  updatePortrait(targetSplat, '');
  updateDocumentTitle();
  if (targetSplat === currentSplat) updateGuideTally();
  if (!silent) saveNow();
}

function applyCompactMode(enabled, persist = false) {
  isCompactMode = Boolean(enabled);
  document.body.classList.toggle('mode-compact', isCompactMode);
  const lbl = document.getElementById('compactToggleLabel');
  if (lbl) {
    lbl.textContent = isCompactMode ? 'Disable Compact Mode' : 'Compact / Dense Mode';
  }
  const active = document.getElementById('splat-' + currentSplat);
  if (active) {
    requestAnimationFrame(() => autoResizeTextareas(active));
  }
  if (persist) {
    try {
      localStorage.setItem(COMPACT_STORAGE_KEY, isCompactMode ? '1' : '0');
    } catch (e) {}
  }
}

function restoreSavedCompactMode() {
  try {
    const saved = localStorage.getItem(COMPACT_STORAGE_KEY);
    applyCompactMode(saved === '1', false);
  } catch (e) {
    applyCompactMode(false, false);
  }
}

function prepareCompactPrintRows() {
  cleanupCompactPrintRows();
  if (!isCompactMode) return;
  const active = document.getElementById('splat-' + currentSplat);
  if (!active) return;

  const collapseEmptyChildren = (containerEl, rowSelector, minKeepIfAllEmpty = 2) => {
    if (!containerEl) return;
    const rows = Array.from(containerEl.querySelectorAll(rowSelector));
    if (!rows.length) return;
    const populatedFlags = rows.map(row => {
      const hasText = Array.from(row.querySelectorAll('input[type="text"], textarea'))
        .some(inp => inp.value && inp.value.trim().length > 0);
      const hasDots = Array.from(row.querySelectorAll('.dots-container, .boxes-container'))
        .some(dc => parseInt(dc.dataset.val || '0', 10) > 0);
      return hasText || hasDots;
    });
    const anyPopulated = populatedFlags.some(Boolean);
    rows.forEach((row, idx) => {
      if (anyPopulated) {
        if (!populatedFlags[idx]) row.classList.add('compact-print-empty');
      } else if (idx >= minKeepIfAllEmpty) {
        row.classList.add('compact-print-empty');
      }
    });
  };

  collapseEmptyChildren(document.getElementById(`${currentSplat}_merit_tbody`), 'tr', 2);
  collapseEmptyChildren(document.getElementById(`${currentSplat}_flaw_tbody`), 'tr', 2);
  collapseEmptyChildren(document.getElementById(`${currentSplat}_combat_tbody`), 'tr', 2);
  for (let i = 0; i <= 2; i++) {
    collapseEmptyChildren(document.getElementById(`${currentSplat}_adv_${i}_tbody`), '.trait-flex-row', 2);
  }
}

function cleanupCompactPrintRows() {
  document.querySelectorAll('.compact-print-empty').forEach(el => {
    el.classList.remove('compact-print-empty');
  });
}

function applyTheme(theme, persist = false) {
  currentTheme = theme === 'parchment' ? 'parchment' : 'dark';
  if (currentTheme === 'parchment') {
    document.body.dataset.theme = 'parchment';
  } else {
    delete document.body.dataset.theme;
  }
  const btn = document.getElementById('themeToggleBtn');
  if (btn) {
    const ttl = document.getElementById('themeToggleLabel'); if(ttl) ttl.textContent = currentTheme === 'parchment' ? 'Dark Theme' : 'Parchment Theme';
  }
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', currentTheme === 'parchment' ? '#ece3d0' : '#8b0000');
  }
  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, currentTheme);
    } catch (e) {}
  }
}

function restoreSavedTheme() {
  try {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    applyTheme(savedTheme === 'parchment' ? 'parchment' : 'dark', false);
  } catch (e) {
    applyTheme('dark', false);
  }
}

function generateSlotId() {
  return 'slot_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
}

function extractSlotMeta(state) {
  const sp = (state && state.splat) || 'mortal';
  const inp = (state && state.inputs) || {};
  const rawName = (inp[`${sp}_char_name`] || '').trim();
  const name = rawName || 'Unnamed Character';

  let subtitle = '';
  if (sp === 'mortal') {
    subtitle = (inp.mortal_char_concept || inp.mortal_char_occupation || '').trim();
  } else if (sp === 'vampire') {
    const clan = (inp.vampire_char_clan || '').trim();
    const gen = (inp.vampire_char_gen || '').trim();
    subtitle = [clan, gen].filter(Boolean).join(' · ');
  } else if (sp === 'werewolf') {
    const tribe = (inp.werewolf_char_tribe || '').trim();
    const auspice = (inp.werewolf_char_auspice || '').trim();
    subtitle = [tribe, auspice].filter(Boolean).join(' · ');
  } else if (sp === 'mage') {
    subtitle = (inp.mage_char_affiliation || inp.mage_char_sect || '').trim();
  } else if (sp === 'changeling') {
    const kith = (inp.changeling_char_kith || '').trim();
    const court = (inp.changeling_char_court || '').trim();
    subtitle = [kith, court].filter(Boolean).join(' · ');
  } else if (sp === 'wraith') {
    subtitle = (inp.wraith_char_shadow || inp.wraith_char_life || '').trim();
  }
  return { splat: sp, name, subtitle };
}

function createSlotRecord(state, overrideId = null) {
  const meta = extractSlotMeta(state);
  return {
    id: overrideId || generateSlotId(),
    splat: meta.splat,
    name: meta.name,
    subtitle: meta.subtitle,
    updatedAt: Date.now(),
    state: JSON.parse(JSON.stringify(state))
  };
}

function stateHasAnyData(st) {
  if (!st) return false;
  if (st.inputs && Object.values(st.inputs).some(v => typeof v === 'string' && v.trim().length > 0)) return true;
  if (st.health && Object.values(st.health).some(v => v && v !== 'empty')) return true;
  if (st.dots) {
    const sp = st.splat || 'mortal';
    for (const [k, v] of Object.entries(st.dots)) {
      const isBaseAttr = k.startsWith(`${sp}_attr_`);
      if (v > (isBaseAttr ? 1 : 0)) return true;
    }
  }
  return false;
}

function loadGlobalStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { activeSplat: 'mortal', activeSlotId: null, roster: [] };
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed.roster)) {
      return {
        activeSplat: parsed.activeSplat || 'mortal',
        activeSlotId: parsed.activeSlotId || (parsed.roster[0] ? parsed.roster[0].id : null),
        roster: parsed.roster
      };
    }

    // Migrate legacy single-sheet-per-splat format into Multi-Character Roster
    if (parsed.sheets && typeof parsed.sheets === 'object') {
      const migratedRoster = [];
      let migratedActiveId = null;
      const preferredSplat = parsed.activeSplat || 'mortal';

      for (const sp of V3_SPLATS) {
        const legacySheet = parsed.sheets[sp];
        if (legacySheet && (stateHasAnyData(legacySheet) || sp === preferredSplat)) {
          const slot = createSlotRecord(legacySheet);
          migratedRoster.push(slot);
          if (sp === preferredSplat) migratedActiveId = slot.id;
        }
      }
      if (!migratedActiveId && migratedRoster.length > 0) {
        migratedActiveId = migratedRoster[0].id;
      }
      const migratedStore = {
        activeSplat: preferredSplat,
        activeSlotId: migratedActiveId,
        roster: migratedRoster
      };
      saveGlobalStore(migratedStore);
      return migratedStore;
    }
  } catch (e) {}
  return { activeSplat: 'mortal', activeSlotId: null, roster: [] };
}

function saveGlobalStore(store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (e) {
    showToast('Storage limit reached — export JSON backup');
  }
}

function formatSlotTimestamp(ts) {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' +
      d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return '';
  }
}

function renderRosterUI() {
  const store = loadGlobalStore();
  const select = document.getElementById('rosterSelect');
  if (select) {
    select.innerHTML = '';
    V3_SPLATS.forEach(sp => {
      const slots = store.roster.filter(s => s.splat === sp);
      if (!slots.length) return;
      const og = document.createElement('optgroup');
      og.label = SPLAT_DISPLAY_NAMES[sp] || sp;
      slots.forEach(slot => {
        const opt = document.createElement('option');
        opt.value = slot.id;
        opt.textContent = slot.subtitle ? `${slot.name} (${slot.subtitle})` : slot.name;
        if (slot.id === activeSlotId) opt.selected = true;
        og.appendChild(opt);
      });
      select.appendChild(og);
    });
    if (activeSlotId) select.value = activeSlotId;
  }

  const listEl = document.getElementById('rosterSlotList');
  if (!listEl) return;

  if (!store.roster.length) {
    listEl.innerHTML = '<p style="color:#9e9e9e; font-size:12px; text-align:center; padding:16px 0;">No saved character slots yet.</p>';
    return;
  }

  const sorted = [...store.roster].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  listEl.innerHTML = sorted.map(slot => {
    const isActive = slot.id === activeSlotId;
    const isConfirmDel = slot.id === rosterDeleteConfirmId;
    const splatName = SPLAT_DISPLAY_NAMES[slot.splat] || slot.splat;
    const metaParts = [slot.subtitle, formatSlotTimestamp(slot.updatedAt)].filter(Boolean).join(' · ');
    return `
      <div class="roster-slot-card${isActive ? ' active' : ''}" data-slot-id="${escapeHtmlForDice(slot.id)}">
        <div class="roster-slot-info">
          <div class="roster-slot-title-row">
            <span class="roster-slot-name">${escapeHtmlForDice(slot.name || 'Unnamed Character')}</span>
            <span class="roster-splat-pill">${escapeHtmlForDice(splatName)}</span>
            ${isActive ? '<span class="roster-active-pill">Active</span>' : ''}
          </div>
          <div class="roster-slot-meta">${escapeHtmlForDice(metaParts || 'Blank sheet')}</div>
        </div>
        <div class="roster-slot-actions">
          ${!isActive ? `<button type="button" class="btn btn-sm btn-accent roster-open-btn" data-id="${escapeHtmlForDice(slot.id)}">Open</button>` : ''}
          <button type="button" class="btn btn-sm roster-rename-btn" data-id="${escapeHtmlForDice(slot.id)}" title="Rename slot">Rename</button>
          <button type="button" class="btn btn-sm roster-dup-btn" data-id="${escapeHtmlForDice(slot.id)}" title="Duplicate slot">Copy</button>
          <button type="button" class="btn btn-sm btn-danger roster-del-btn" data-id="${escapeHtmlForDice(slot.id)}" title="Delete slot">${isConfirmDel ? 'Confirm?' : '&times;'}</button>
        </div>
      </div>
    `;
  }).join('');
}

function switchToRosterSlot(slotId) {
  if (!slotId) return;
  flushAutoSave();
  const store = loadGlobalStore();
  const slot = store.roster.find(s => s.id === slotId);
  if (!slot) return;

  activeSlotId = slot.id;
  store.activeSlotId = slot.id;
  store.activeSplat = slot.splat;
  saveGlobalStore(store);

  document.getElementById('sampleCharSelect').value = '';
  isRestoring = true;
  clearSheet(true, slot.splat);
  restoreState(slot.state);
  switchSplat(slot.splat);
  isRestoring = false;
  isSheetDirty = false;
  rosterDeleteConfirmId = null;

  renderRosterUI();
  showToast(`Loaded: ${slot.name}`);
}

function createNewRosterSlot(targetSplat = currentSplat, initialState = null, toastMsg = 'Created New Character Slot') {
  flushAutoSave();
  const newId = generateSlotId();
  activeSlotId = newId;
  document.getElementById('sampleCharSelect').value = '';

  isRestoring = true;
  clearSheet(true, targetSplat);
  if (initialState) {
    restoreState(initialState);
  }
  switchSplat(targetSplat);
  isRestoring = false;
  isSheetDirty = false;
  rosterDeleteConfirmId = null;

  saveNow();
  if (toastMsg) showToast(toastMsg);
}

function handleSplatDropdownChange(targetSplat) {
  if (!hasActiveSheetData()) {
    isRestoring = true;
    clearSheet(true, targetSplat);
    switchSplat(targetSplat);
    isRestoring = false;
    isSheetDirty = false;
    saveNow();
    return;
  }
  const store = loadGlobalStore();
  const existingForSplat = store.roster
    .filter(s => s.splat === targetSplat)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];

  if (existingForSplat) {
    switchToRosterSlot(existingForSplat.id);
  } else {
    createNewRosterSlot(targetSplat, null, `New ${SPLAT_DISPLAY_NAMES[targetSplat] || targetSplat} Slot`);
  }
}

function openRosterModal() {
  flushAutoSave();
  rosterDeleteConfirmId = null;
  const newSplatSel = document.getElementById('rosterNewSplatSelect');
  if (newSplatSel) newSplatSel.value = currentSplat;
  renderRosterUI();
  const modal = document.getElementById('rosterModal');
  if (modal) modal.style.display = 'flex';
}

function closeRosterModal() {
  rosterDeleteConfirmId = null;
  const confirmModal = document.getElementById('resetRosterModal');
  if (confirmModal) confirmModal.style.display = 'none';
  const modal = document.getElementById('rosterModal');
  if (modal) modal.style.display = 'none';
}

function bindRosterControls() {
  const rosterSelect = document.getElementById('rosterSelect');
  if (rosterSelect) {
    rosterSelect.addEventListener('change', (e) => {
      if (e.target.value) switchToRosterSlot(e.target.value);
    });
  }

  const newSlotBtn = document.getElementById('newRosterSlotBtn');
  if (newSlotBtn) {
    newSlotBtn.addEventListener('click', () => {
      createNewRosterSlot(currentSplat, null, `New ${SPLAT_DISPLAY_NAMES[currentSplat] || currentSplat} Slot`);
    });
  }

  const manageBtn = document.getElementById('manageRosterBtn');
  if (manageBtn) manageBtn.addEventListener('click', openRosterModal);

  const closeBtn = document.getElementById('closeRosterModalBtn');
  if (closeBtn) closeBtn.addEventListener('click', closeRosterModal);

  const doneBtn = document.getElementById('doneRosterModalBtn');
  if (doneBtn) doneBtn.addEventListener('click', closeRosterModal);

  const rosterModalEl = document.getElementById('rosterModal');
  if (rosterModalEl) {
    rosterModalEl.addEventListener('click', (e) => {
      if (e.target === rosterModalEl) closeRosterModal();
    });
  }

  const modalNewBtn = document.getElementById('rosterModalNewBtn');
  if (modalNewBtn) {
    modalNewBtn.addEventListener('click', () => {
      const sel = document.getElementById('rosterNewSplatSelect');
      const sp = sel ? sel.value : currentSplat;
      createNewRosterSlot(sp, null, `New ${SPLAT_DISPLAY_NAMES[sp] || sp} Slot`);
      closeRosterModal();
    });
  }

  const slotList = document.getElementById('rosterSlotList');
  if (slotList) {
    slotList.addEventListener('click', (e) => {
      const openBtn = e.target.closest('.roster-open-btn');
      if (openBtn) {
        switchToRosterSlot(openBtn.dataset.id);
        closeRosterModal();
        return;
      }

      const dupBtn = e.target.closest('.roster-dup-btn');
      if (dupBtn) {
        const store = loadGlobalStore();
        const orig = store.roster.find(s => s.id === dupBtn.dataset.id);
        if (!orig) return;
        const clonedState = JSON.parse(JSON.stringify(orig.state));
        const nameField = `${orig.splat}_char_name`;
        if (clonedState.inputs) {
          const baseName = (clonedState.inputs[nameField] || orig.name || 'Unnamed Character').trim();
          clonedState.inputs[nameField] = `${baseName} (Copy)`;
        }
        createNewRosterSlot(orig.splat, clonedState, `Duplicated: ${orig.name}`);
        renderRosterUI();
        return;
      }

      const renameBtn = e.target.closest('.roster-rename-btn');
      if (renameBtn) {
        const card = renameBtn.closest('.roster-slot-card');
        const titleRow = card ? card.querySelector('.roster-slot-title-row') : null;
        const store = loadGlobalStore();
        const target = store.roster.find(s => s.id === renameBtn.dataset.id);
        if (!titleRow || !target) return;

        titleRow.innerHTML = `
          <input type="text" class="roster-rename-input" value="${escapeHtmlForDice(target.name)}" aria-label="Character Name">
          <button type="button" class="btn btn-sm btn-accent roster-save-name-btn" data-id="${escapeHtmlForDice(target.id)}">Save</button>
        `;
        const inp = titleRow.querySelector('.roster-rename-input');
        if (inp) {
          inp.focus();
          inp.select();
          inp.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter') {
              ev.preventDefault();
              titleRow.querySelector('.roster-save-name-btn')?.click();
            }
          });
        }
        return;
      }

      const saveNameBtn = e.target.closest('.roster-save-name-btn');
      if (saveNameBtn) {
        const card = saveNameBtn.closest('.roster-slot-card');
        const inp = card ? card.querySelector('.roster-rename-input') : null;
        const newName = inp ? inp.value.trim() : '';
        const store = loadGlobalStore();
        const target = store.roster.find(s => s.id === saveNameBtn.dataset.id);
        if (target && newName) {
          target.name = newName;
          target.updatedAt = Date.now();
          if (target.state && target.state.inputs) {
            target.state.inputs[`${target.splat}_char_name`] = newName;
          }
          saveGlobalStore(store);
          if (target.id === activeSlotId) {
            const sheetNameInp = document.getElementById(`${target.splat}_char_name`);
            if (sheetNameInp) sheetNameInp.value = newName;
            updateDocumentTitle();
          }
          showToast(`Renamed to: ${newName}`);
        }
        renderRosterUI();
        return;
      }

      const delBtn = e.target.closest('.roster-del-btn');
      if (delBtn) {
        const id = delBtn.dataset.id;
        if (rosterDeleteConfirmId !== id) {
          rosterDeleteConfirmId = id;
          renderRosterUI();
          return;
        }
        rosterDeleteConfirmId = null;
        const store = loadGlobalStore();
        const idx = store.roster.findIndex(s => s.id === id);
        if (idx === -1) return;
        const deletedName = store.roster[idx].name;
        store.roster.splice(idx, 1);

        if (store.roster.length === 0) {
          saveGlobalStore(store);
          activeSlotId = null;
          createNewRosterSlot('mortal', null, `Deleted ${deletedName}`);
          renderRosterUI();
          return;
        }

        if (id === activeSlotId) {
          const nextSlot = [...store.roster].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
          saveGlobalStore(store);
          switchToRosterSlot(nextSlot.id);
        } else {
          saveGlobalStore(store);
          renderRosterUI();
        }
        showToast(`Deleted: ${deletedName}`);
      }
    });
  }

  const exportRosterBtn = document.getElementById('exportRosterBtn');
  if (exportRosterBtn) {
    exportRosterBtn.addEventListener('click', () => {
      flushAutoSave();
      const store = loadGlobalStore();
      const payload = {
        _darkPack: DARK_PACK_JSON_NOTICE,
        type: 'wod20_roster_backup',
        exportedAt: new Date().toISOString(),
        roster: store.roster
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'wod20_roster_backup.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast(`Exported ${store.roster.length} Character(s)`);
    });
  }

  const importRosterBtn = document.getElementById('importRosterBtn');
  const rosterImportInput = document.getElementById('rosterImportInput');
  if (importRosterBtn && rosterImportInput) {
    importRosterBtn.addEventListener('click', () => rosterImportInput.click());
    rosterImportInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) importJsonFile(file, true);
      e.target.value = '';
    });
  }

  const resetRosterBtn = document.getElementById('resetRosterBtn');
  const resetRosterModal = document.getElementById('resetRosterModal');
  const cancelResetRosterBtn = document.getElementById('cancelResetRosterBtn');
  const confirmResetRosterBtn = document.getElementById('confirmResetRosterBtn');
  if (resetRosterBtn && resetRosterModal) {
    resetRosterBtn.addEventListener('click', () => {
      rosterDeleteConfirmId = null;
      resetRosterModal.style.display = 'flex';
    });
  }
  if (cancelResetRosterBtn && resetRosterModal) {
    cancelResetRosterBtn.addEventListener('click', () => {
      resetRosterModal.style.display = 'none';
    });
  }
  if (resetRosterModal) {
    resetRosterModal.addEventListener('click', (e) => {
      if (e.target === resetRosterModal) resetRosterModal.style.display = 'none';
    });
  }
  if (confirmResetRosterBtn) {
    confirmResetRosterBtn.addEventListener('click', () => {
      resetEntireRoster();
    });
  }
}

function resetEntireRoster() {
  clearTimeout(autoSaveTimer);
  autoSaveTimer = null;
  rosterDeleteConfirmId = null;
  activeSlotId = null;
  lastSharedSnapshot = '';
  if (window.location.hash) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }
  document.getElementById('sampleCharSelect').value = '';
  pendingSampleKey = '';

  saveGlobalStore({ activeSplat: 'mortal', activeSlotId: null, roster: [] });

  isRestoring = true;
  V3_SPLATS.forEach(sp => clearSheet(true, sp));
  isRestoring = false;

  createNewRosterSlot('mortal', null, null);
  closeRosterModal();
  showToast('Roster Reset');
}

function hardResetWebsite() {
  clearTimeout(autoSaveTimer);
  autoSaveTimer = null;

  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(THEME_STORAGE_KEY);
    localStorage.removeItem(COMPACT_STORAGE_KEY);
  } catch (e) {}

  applyTheme('dark', false);
  applyCompactMode(false, false);
  lastSharedSnapshot = '';
  activeSlotId = null;
  rosterDeleteConfirmId = null;
  const pdfLink = document.getElementById('pdfShareLink');
  if (pdfLink) pdfLink.href = getPdfShareBaseUrl();
  if (window.location.hash) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  document.getElementById('sampleCharSelect').value = '';
  pendingSampleKey = '';
  resetTenDotModeUI();
  closeRosterModal();

  const guidePanel = document.getElementById('guidePanel');
  if (guidePanel) guidePanel.classList.remove('open');
  const dicePanel = document.getElementById('dicePanel');
  if (dicePanel) dicePanel.classList.remove('open');
  syncDockButtonStates();

  isRestoring = true;
  ['mortal', 'vampire', 'werewolf', 'mage', 'changeling', 'wraith'].forEach(sp => {
    clearSheet(true, sp);
  });
  switchSplat('mortal');
  isRestoring = false;
  isSheetDirty = false;
  saveNow();

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
  const store = loadGlobalStore();
  const currentState = captureCurrentState();
  const meta = extractSlotMeta(currentState);

  let slot = activeSlotId ? store.roster.find(s => s.id === activeSlotId) : null;
  if (!slot) {
    slot = createSlotRecord(currentState, activeSlotId);
    store.roster.push(slot);
    activeSlotId = slot.id;
  } else {
    slot.splat = meta.splat;
    slot.name = meta.name;
    slot.subtitle = meta.subtitle;
    slot.updatedAt = Date.now();
    slot.state = currentState;
  }

  store.activeSplat = currentSplat;
  store.activeSlotId = activeSlotId;
  saveGlobalStore(store);

  renderRosterUI();
  if (badge) {
    badge.textContent = 'Saved Locally';
    badge.classList.add('saved');
  }
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
  if (badge) {
    badge.textContent = 'Saving...';
    badge.classList.remove('saved');
  }
  autoSaveTimer = setTimeout(() => {
    saveNow();
  }, 500);
}

function restoreFromLocalStorage() {
  const store = loadGlobalStore();
  if (store.roster.length > 0) {
    const targetSlot = store.roster.find(s => s.id === store.activeSlotId) || store.roster[0];
    activeSlotId = targetSlot.id;
    isRestoring = true;
    clearSheet(true, targetSlot.splat);
    restoreState(targetSlot.state);
    switchSplat(targetSlot.splat);
    isRestoring = false;
    renderRosterUI();
    const badge = document.getElementById('autosaveIndicator');
    if (badge) {
      badge.textContent = 'Restored Session';
      badge.classList.add('saved');
    }
  } else {
    activeSlotId = generateSlotId();
    isRestoring = true;
    switchSplat('mortal');
    isRestoring = false;
    saveNow();
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
const V3_WEREWOLF_FORMS = ['homid', 'glabro', 'crinos', 'hispo', 'lupus'];
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
  return (splat === 'wraith' && advIdx === 1) ? 10 : 6;
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

  const wwFormIdx = sp === 'werewolf'
    ? Math.max(0, V3_WEREWOLF_FORMS.indexOf(state.werewolfForm || 'homid'))
    : 0;

  const buf = [];
  const flags = (spIdx & 0x07)
    | ((state.isTenDotMode ? 1 : 0) << 3)
    | ((hasCustomCounts ? 1 : 0) << 4)
    | ((wwFormIdx & 0x07) << 5);
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
  const wwFormIdx = (flags >> 5) & 0x07;
  const werewolfForm = sp === 'werewolf' ? (V3_WEREWOLF_FORMS[wwFormIdx] || 'homid') : undefined;

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
    ...(sp === 'werewolf' ? { werewolfForm } : {}),
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

const DARK_PACK_JSON_NOTICE = {
  license: 'World of Darkness Dark Pack Agreement',
  agreementUrl: 'https://www.paradoxinteractive.com/games/world-of-darkness/community/dark-pack-agreement',
  copyright: 'Portions of the materials are the copyrights and trademarks of Paradox Interactive AB, and are used with permission. All rights reserved. For more information please visit worldofdarkness.com.',
  disclaimer: 'This is an unofficial fan creation and is not affiliated with or endorsed by Paradox Interactive or World of Darkness.'
};

function saveAsJson() {
  const state = captureCurrentState();
  const name = state.inputs[state.splat + '_char_name'] || 'character';
  const payload = {
    _darkPack: DARK_PACK_JSON_NOTICE,
    ...state
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function importJsonFile(file, fromRosterModal = false) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const parsed = JSON.parse(evt.target.result);
      flushAutoSave();

      // Multi-character roster backup import
      if (parsed && parsed.type === 'wod20_roster_backup' && Array.isArray(parsed.roster)) {
        const validSlots = parsed.roster.filter(s => s && s.state && s.state.splat);
        if (!validSlots.length) {
          showToast('No valid character slots in backup');
          return;
        }
        const store = loadGlobalStore();
        const imported = validSlots.map(s => createSlotRecord(s.state));
        store.roster.push(...imported);
        saveGlobalStore(store);
        switchToRosterSlot(imported[0].id);
        if (fromRosterModal) renderRosterUI();
        showToast(`Imported ${imported.length} Character(s)`);
        return;
      }

      // Single character JSON import
      if (!parsed || !parsed.splat) {
        showToast('Invalid JSON');
        return;
      }
      if (hasActiveSheetData()) {
        activeSlotId = generateSlotId();
      }
      document.getElementById('sampleCharSelect').value = '';
      isRestoring = true;
      clearSheet(true, parsed.splat || currentSplat);
      restoreState(parsed);
      switchSplat(parsed.splat || currentSplat);
      isRestoring = false;
      isSheetDirty = false;
      saveNow();
      if (fromRosterModal) renderRosterUI();
      showToast('Loaded JSON into Roster');
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
  html += `<button type="button" class="roll-trait-mini-btn no-print" title="Roll Trait" aria-label="Roll Trait">d10</button>`;
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
    const inp = row.querySelector('.trait-name-input');
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

function syncSpecialtyTitle(el) {
  if (!el || !el.classList.contains('trait-spec-input')) return;
  const text = el.value.trim();
  if (text) {
    el.title = text;
  } else {
    el.removeAttribute('title');
  }
}

function syncAllSpecialtyTitles(container = document) {
  container.querySelectorAll('.trait-spec-input').forEach(syncSpecialtyTitle);
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
      <li><strong>Abilities:</strong> 13 / 9 / 5 (max 3 before Freebies)</li>
      <li><strong>Backgrounds:</strong> 5</li>
      <li><strong>Virtues:</strong> +7 dots<span class="guide-note">Starts with 1 dot each (10 total across 3 Virtues)</span></li>
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
    <span class="guide-note">Note: True Faith cannot be bought with XP.</span>
    <h4>Specialties</h4>
    <p>Attributes and Abilities rated 4+ gain a Specialty.</p>
  `,
  vampire: `
    <h4>Creation Process (V20)</h4>
    <ul>
      <li><strong>Attributes:</strong> +7 / +5 / +3 priority dots<span class="guide-note">Starts with 1 dot each (10 / 8 / 6 category totals; 24 total)</span></li>
      <li><strong>Abilities:</strong> 13 / 9 / 5 (max 3 before Freebies)</li>
      <li><strong>Disciplines:</strong> 3</li>
      <li><strong>Backgrounds:</strong> 5</li>
      <li><strong>Virtues:</strong> +7 dots<span class="guide-note">Starts with 1 dot each (10 total across 3 Virtues)</span></li>
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
        <tr><td>Humanity / Path</td><td>1 / dot</td></tr>
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
      <li><strong>Base Pools:</strong> Childling: G 5 / WP 3 / B 1. Wilder: G 4 / WP 4 / B 3. Grump: G 3 / WP 5 / B 5.</li>
      <li><strong>Health:</strong> Chimerical damage knocks unconscious; Real damage can kill.</li>
    </ul>
    <h4>Freebie Point Costs (15 pts)</h4>
    <table class="guide-cost-grid">
      <thead><tr><th>Trait</th><th>Cost</th></tr></thead>
      <tbody>
        <tr><td>Attribute</td><td>5 / dot</td></tr>
        <tr><td>Ability</td><td>2 / dot</td></tr>
        <tr><td>Art</td><td>5 / dot</td></tr>
        <tr><td>Realm</td><td>3 / dot</td></tr>
        <tr><td>Background</td><td>1 / dot</td></tr>
        <tr><td>Glamour</td><td>3 / dot</td></tr>
        <tr><td>Willpower</td><td>2 / dot</td></tr>
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
        <tr><td>Glamour</td><td>current &times; 2</td></tr>
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

const DOT_SCALE_GUIDE_HTML = `
  <h4>Global Dot Rating Scale (0–5: Standard Scale)</h4>
  <table class="guide-scale-table">
    <thead><tr><th>Dots</th><th>Rating &amp; Meaning</th></tr></thead>
    <tbody>
      <tr>
        <td class="guide-scale-dots">0</td>
        <td><span class="guide-scale-rating">Untrained</span>Zero experience or conditioning; must rely on blind luck and cannot attempt specialized tasks.<span class="guide-scale-example">e.g., Someone who has never sat behind the wheel of a car.</span></td>
      </tr>
      <tr>
        <td class="guide-scale-dots">1</td>
        <td><span class="guide-scale-rating">Rookie</span>Basic familiarity; handles routine, low-stakes tasks fine but falters under real pressure.<span class="guide-scale-example">e.g., A weekend jogger, home cook, or first-month boxing student.</span></td>
      </tr>
      <tr>
        <td class="guide-scale-dots">2</td>
        <td><span class="guide-scale-rating">Seasoned</span>Solid, everyday proficiency; the healthy adult or working-professional standard.<span class="guide-scale-example">e.g., A patrol officer, auto mechanic, or regular gym-goer.</span></td>
      </tr>
      <tr>
        <td class="guide-scale-dots">3</td>
        <td><span class="guide-scale-rating">Veteran</span>Accomplished specialist tested under fire; respected in their field and able to train others.<span class="guide-scale-example">e.g., A SWAT operator, ER trauma surgeon, or regional amateur champ.</span></td>
      </tr>
      <tr>
        <td class="guide-scale-dots">4</td>
        <td><span class="guide-scale-rating">Elite</span>Standout, top-1% practitioner in a major city; reputation precedes them and shifts the odds of a scene.<span class="guide-scale-example">e.g., An Olympic qualifier, chief neurosurgeon, or top syndicate enforcer.</span></td>
      </tr>
      <tr>
        <td class="guide-scale-dots">5</td>
        <td><span class="guide-scale-rating">Apex</span>The ceiling of unaugmented mortal potential and the standard cap for starting supernatural characters; a once-in-a-generation prodigy.<span class="guide-scale-example">e.g., An Olympic gold medalist, Nikola Tesla, or Miyamoto Musashi.</span></td>
      </tr>
    </tbody>
  </table>

  <details id="guideElderScaleDetails" class="guide-elder-details">
    <summary class="guide-elder-summary">
      <span>6–10: Elder &amp; Mythic</span>
      <span id="guideElderBadge" class="guide-elder-badge">10-Dot Mode Off</span>
    </summary>
    <div class="guide-elder-body">
      <p class="guide-scale-intro">Both mortals and standard supernatural characters hard-cap at <strong>5 dots</strong>; ratings from <strong>6–10</strong> only unlock in <strong>10-Dot Mode</strong> for ancient Elders (7th Gen or lower), high-rank shifters, archmages, and mythic beings.</p>
      <table class="guide-scale-table">
        <thead><tr><th>Dots</th><th>Rating &amp; Meaning</th></tr></thead>
        <tbody>
          <tr>
            <td class="guide-scale-dots">6</td>
            <td><span class="guide-scale-rating">Preternatural</span>Visibly surpasses human limits; impossible without ancient blood, deep spiritual might, or Awakened mastery.<span class="guide-scale-example">e.g., A mythic hero bending iron bars barehanded.</span></td>
          </tr>
          <tr>
            <td class="guide-scale-dots">7</td>
            <td><span class="guide-scale-rating">Mythic</span>A force of nature whose feats defy mundane physics or historical records.<span class="guide-scale-example">e.g., Hercules wrestling monstrous beasts.</span></td>
          </tr>
          <tr>
            <td class="guide-scale-dots">8</td>
            <td><span class="guide-scale-rating">Legendary</span>Near-unstoppable within their domain; whispered of across entire factions or centuries.<span class="guide-scale-example">e.g., Achilles turning the tide of an entire war single-handedly.</span></td>
          </tr>
          <tr>
            <td class="guide-scale-dots">9</td>
            <td><span class="guide-scale-rating">Incarnate</span>A walking embodiment of the trait itself; ordinary characters cannot meaningfully contest this rating.<span class="guide-scale-example">e.g., Sun Wukong or mythic Thor shattering mountains.</span></td>
          </tr>
          <tr>
            <td class="guide-scale-dots">10</td>
            <td><span class="guide-scale-rating">Primordial</span>Plot-device tier; reality bends around the sheer weight of this trait.<span class="guide-scale-example">e.g., Odin or Zeus—narrative forces where rolling dice is a formality.</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  </details>
`;

let activeGuideTab = 'creation';

function syncGuideTenDotMode() {
  const details = document.getElementById('guideElderScaleDetails');
  const badge = document.getElementById('guideElderBadge');
  if (details) {
    details.open = Boolean(isTenDotMode);
  }
  if (badge) {
    badge.textContent = isTenDotMode ? '10-Dot Mode Active' : '10-Dot Mode Off';
    badge.classList.toggle('active', Boolean(isTenDotMode));
  }
}

function setGuideTab(tabName) {
  activeGuideTab = tabName === 'scale' ? 'scale' : 'creation';
  document.querySelectorAll('.guide-tab-btn').forEach(btn => {
    const isActive = btn.dataset.tab === activeGuideTab;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
  updateGuidePanel();
  const content = document.getElementById('guideContent');
  if (content) content.scrollTop = 0;
}

function updateGuidePanel() {
  const content = document.getElementById('guideContent');
  const title = document.getElementById('guideTitle');
  const tally = document.getElementById('guideTally');
  const splatNames = { mortal: 'Mortal', vampire: 'Vampire', werewolf: 'Werewolf', mage: 'Mage', changeling: 'Changeling', wraith: 'Wraith' };

  if (activeGuideTab === 'scale') {
    if (title) title.textContent = 'Dot Rating Scale';
    if (tally) tally.style.display = 'none';
    if (content) {
      content.innerHTML = DOT_SCALE_GUIDE_HTML;
      syncGuideTenDotMode();
    }
  } else {
    if (title) title.textContent = `${splatNames[currentSplat]} Creation Guide`;
    if (tally) tally.style.display = 'block';
    if (content && SPLAT_GUIDES[currentSplat]) {
      content.innerHTML = SPLAT_GUIDES[currentSplat];
    }
    updateGuideTally();
  }
}

function syncDockButtonStates() {
  const guideOpen = Boolean(document.getElementById('guidePanel')?.classList.contains('open'));
  const diceOpen = Boolean(document.getElementById('dicePanel')?.classList.contains('open'));
  const guideBtn = document.getElementById('toggleGuideBtn');
  const diceBtn = document.getElementById('toggleDiceBtn');
  if (guideBtn) {
    guideBtn.classList.toggle('active', guideOpen);
    guideBtn.setAttribute('aria-expanded', guideOpen ? 'true' : 'false');
  }
  if (diceBtn) {
    diceBtn.classList.toggle('active', diceOpen);
    diceBtn.setAttribute('aria-expanded', diceOpen ? 'true' : 'false');
  }
}

function toggleGuide() {
  const panel = document.getElementById('guidePanel');
  const dicePanel = document.getElementById('dicePanel');
  if (panel) {
    const opening = !panel.classList.contains('open');
    if (opening && dicePanel) dicePanel.classList.remove('open');
    panel.classList.toggle('open', opening);
    syncDockButtonStates();
    if (opening) updateGuidePanel();
  }
}

let selectedDiceTraits = [];
let diceRollHistory = [];
let lastRollClipboardText = '';

function toggleDicePanel(forceOpen) {
  const panel = document.getElementById('dicePanel');
  const guidePanel = document.getElementById('guidePanel');
  if (!panel) return;
  const opening = typeof forceOpen === 'boolean' ? forceOpen : !panel.classList.contains('open');
  if (opening && guidePanel) guidePanel.classList.remove('open');
  panel.classList.toggle('open', opening);
  syncDockButtonStates();
  if (opening) syncDiceWoundPenalty();
}

function getActiveWoundPenalty(splat = currentSplat) {
  const map = [
    { penalty: 0, label: 'Healthy (0)', incapacitated: false },
    { penalty: -1, label: 'Hurt (-1)', incapacitated: false },
    { penalty: -1, label: 'Injured (-1)', incapacitated: false },
    { penalty: -2, label: 'Wounded (-2)', incapacitated: false },
    { penalty: -2, label: 'Mauled (-2)', incapacitated: false },
    { penalty: -5, label: 'Crippled (-5)', incapacitated: false },
    { penalty: -99, label: 'Incapacitated', incapacitated: true }
  ];
  if (splat === 'changeling') {
    const r = getTrackPenaltyIndex('changeling', 'changeling_hlth_real');
    const c = getTrackPenaltyIndex('changeling', 'changeling_hlth_chim');
    return map[Math.max(r, c)] || map[0];
  }
  return map[getTrackPenaltyIndex(splat, `${splat}_hlth`)] || map[0];
}

function updateEffectivePoolNote() {
  const poolInput = document.getElementById('dicePoolInput');
  const noteEl = document.getElementById('diceEffectiveNote');
  const dockBadge = document.getElementById('dockPoolBadge');
  const woundToggle = document.getElementById('diceWoundToggle');
  if (!poolInput || !noteEl) return;

  const base = Math.max(0, parseInt(poolInput.value, 10) || 0);
  const wound = getActiveWoundPenalty(currentSplat);
  const applyWound = woundToggle && woundToggle.checked && wound.penalty < 0;

  if (applyWound && wound.incapacitated) {
    noteEl.textContent = 'Incapacitated (0 dice)';
    noteEl.style.color = '#ff7b7b';
    if (dockBadge) {
      dockBadge.textContent = 'Incap';
      dockBadge.classList.add('incap');
    }
    return;
  }
  const effective = Math.max(0, base + (applyWound ? wound.penalty : 0));
  if (dockBadge) {
    dockBadge.textContent = `${effective}d10`;
    dockBadge.classList.remove('incap');
  }
  if (applyWound && wound.penalty < 0) {
    noteEl.textContent = `Rolling ${effective}d10 (${base} ${wound.penalty} wound)`;
    noteEl.style.color = '#f5c96b';
  } else {
    noteEl.textContent = `Rolling ${effective}d10`;
    noteEl.style.color = '#9e9e9e';
  }
}

function syncDiceWoundPenalty() {
  const woundRow = document.getElementById('diceWoundRow');
  const woundLabel = document.getElementById('diceWoundLabel');
  if (!woundRow || !woundLabel) return;

  const wound = getActiveWoundPenalty(currentSplat);
  if (wound.penalty < 0) {
    woundRow.style.display = 'flex';
    woundLabel.innerHTML = wound.incapacitated
      ? `Apply Wound Status <strong style="color:#ff7b7b;">(Incapacitated)</strong>`
      : `Apply Wound Penalty <strong>(${wound.penalty})</strong>`;
  } else {
    woundRow.style.display = 'none';
  }
  updateEffectivePoolNote();
}

function clearDiceSelection() {
  selectedDiceTraits = [];
  document.querySelectorAll('.trait-selected-roll').forEach(el => el.classList.remove('trait-selected-roll'));
  const lbl = document.getElementById('diceSelectedLabel');
  const clr = document.getElementById('clearDiceTraitsBtn');
  if (lbl) lbl.innerHTML = '<span class="dice-trait-hint">Click any trait on sheet to build pool</span>';
  if (clr) clr.style.display = 'none';
}

function refreshSelectedDiceTraits() {
  if (!selectedDiceTraits.length) {
    updateEffectivePoolNote();
    return;
  }
  const active = document.getElementById('splat-' + currentSplat);
  if (!active) return;

  let total = 0;
  let hasSpec = false;
  selectedDiceTraits = selectedDiceTraits.map(t => {
    const dotsEl = active.querySelector(`[data-id="${t.id}"]`);
    let val = dotsEl ? parseInt(dotsEl.dataset.val || '0', 10) : t.val;
    let formTag = '';
    const wwAttrMatch = t.id && t.id.match(/^werewolf_attr_(str|dex|sta|man|app)$/);
    if (wwAttrMatch && currentSplat === 'werewolf') {
      val = getEffectiveAttrVal('werewolf', wwAttrMatch[1], active);
      if (currentWerewolfForm !== 'homid') {
        const fLabel = (WEREWOLF_FORMS[currentWerewolfForm] || {}).label;
        if (fLabel) formTag = ` [${fLabel}]`;
      }
    }
    let name = t.name;
    if (t.nameInputId) {
      const nameInp = document.getElementById(t.nameInputId);
      if (nameInp && nameInp.value.trim()) name = nameInp.value.trim();
    }
    let spec = '';
    if (t.specInputId) {
      const specInp = document.getElementById(t.specInputId);
      if (specInp && specInp.value.trim()) spec = specInp.value.trim();
    }
    total += val;
    if (spec) hasSpec = true;
    return { ...t, name, formTag, val, spec };
  });

  const poolInput = document.getElementById('dicePoolInput');
  if (poolInput) poolInput.value = total;

  const specToggle = document.getElementById('diceSpecialtyToggle');
  if (specToggle) specToggle.checked = hasSpec;

  const lbl = document.getElementById('diceSelectedLabel');
  const clr = document.getElementById('clearDiceTraitsBtn');
  if (lbl) {
    lbl.innerHTML = selectedDiceTraits
      .map(t => `<strong>${escapeHtmlForDice(t.name)}${escapeHtmlForDice(t.formTag || '')}</strong> (${t.val}${t.spec ? `, <em>${escapeHtmlForDice(t.spec)}</em>` : ''})`)
      .join(' + ');
  }
  if (clr) clr.style.display = 'inline-block';
  updateEffectivePoolNote();
}

function selectTraitForDice(traitObj) {
  document.querySelectorAll('.trait-selected-roll').forEach(el => el.classList.remove('trait-selected-roll'));

  const existingIdx = selectedDiceTraits.findIndex(t => t.id === traitObj.id);
  if (existingIdx !== -1) {
    selectedDiceTraits.splice(existingIdx, 1);
    if (selectedDiceTraits.length === 0) {
      clearDiceSelection();
      updateEffectivePoolNote();
      return;
    }
  } else if (traitObj.isSinglePool || selectedDiceTraits.some(t => t.isSinglePool) || selectedDiceTraits.length >= 2) {
    selectedDiceTraits = [traitObj];
  } else {
    selectedDiceTraits.push(traitObj);
  }

  selectedDiceTraits.forEach(t => {
    if (t.rowEl) t.rowEl.classList.add('trait-selected-roll');
  });

  const woundToggle = document.getElementById('diceWoundToggle');
  if (woundToggle) {
    const anyReflexive = selectedDiceTraits.some(t => t.isReflexive);
    woundToggle.checked = !anyReflexive;
  }

  toggleDicePanel(true);
  refreshSelectedDiceTraits();
}

function escapeHtmlForDice(str) {
  return String(str).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function rollSingleD10() {
  if (window.crypto && window.crypto.getRandomValues) {
    const arr = new Uint32Array(1);
    window.crypto.getRandomValues(arr);
    return (arr[0] % 10) + 1;
  }
  return Math.floor(Math.random() * 10) + 1;
}

function executeWodRoll() {
  const basePool = Math.max(0, Math.min(50, parseInt(document.getElementById('dicePoolInput').value, 10) || 0));
  const difficulty = Math.max(2, Math.min(10, parseInt(document.getElementById('diceDiffInput').value, 10) || 6));
  const specialty = document.getElementById('diceSpecialtyToggle').checked;
  const spendWp = document.getElementById('diceWillpowerToggle').checked;
  const woundToggle = document.getElementById('diceWoundToggle');
  const wound = getActiveWoundPenalty(currentSplat);
  const applyWound = woundToggle && woundToggle.checked && wound.penalty < 0;

  const effectivePool = (applyWound && wound.incapacitated)
    ? 0
    : Math.max(0, basePool + (applyWound ? wound.penalty : 0));

  const dice = [];
  let rawSuccesses = 0;
  let ones = 0;

  for (let i = 0; i < effectivePool; i++) {
    const val = rollSingleD10();
    dice.push({ val });
    
    if (val === 1) {
      ones++;
    } else if (val >= difficulty) {
      if (specialty && val === 10) {
        rawSuccesses += 2;
      } else {
        rawSuccesses += 1;
      }
    }
  }

  const isBotch = effectivePool > 0 && rawSuccesses === 0 && ones > 0 && !spendWp;
  const rolledNet = rawSuccesses - ones;
  const netSuccesses = spendWp ? Math.max(0, rolledNet) + 1 : rolledNet;

  let outcomeLabel = '';
  let outcomeClass = 'outcome-fail';
  if (isBotch) {
    outcomeLabel = `BOTCH! (${ones} ${ones === 1 ? 'One' : 'Ones'})`;
    outcomeClass = 'outcome-botch';
  } else if (netSuccesses <= 0) {
    outcomeLabel = `Failure (${Math.max(0, netSuccesses)} Net Successes)`;
    outcomeClass = 'outcome-fail';
  } else {
    const tiers = ['', 'Marginal', 'Moderate', 'Complete', 'Exceptional', 'Phenomenal'];
    const tier = netSuccesses >= 5 ? 'Phenomenal' : tiers[netSuccesses];
    outcomeLabel = `${netSuccesses} ${netSuccesses === 1 ? 'Success' : 'Successes'} — ${tier}`;
    outcomeClass = netSuccesses >= 4 ? 'outcome-phenomenal' : 'outcome-success';
  }

  const resultBox = document.getElementById('diceResultBox');
  const outcomeEl = document.getElementById('diceOutcomeText');
  const trayEl = document.getElementById('diceTray');
  resultBox.style.display = 'block';
  outcomeEl.textContent = outcomeLabel;
  outcomeEl.className = 'dice-outcome ' + outcomeClass;

  trayEl.innerHTML = dice.length
    ? dice.map(d => {
        let cls = 'die-miss';
        let bonusTag = '';
        if (d.val === 10) {
          cls = 'die-ten';
          if (specialty) bonusTag = '<span class="die-bonus-tag" title="Specialty Double Success">++</span>';
        }
        else if (d.val >= difficulty) cls = 'die-success';
        else if (d.val === 1) cls = 'die-one';
        return `<span class="die-badge ${cls}">${d.val}${bonusTag}</span>`;
      }).join('')
    : '<span style="font-size:11px; color:#888;">No dice rolled (0 effective pool)</span>';

  const charName = (document.getElementById(currentSplat + '_char_name')?.value || '').trim();
  const traitDesc = selectedDiceTraits.length
    ? selectedDiceTraits.map(t => `${t.name}${t.formTag || ''}`).join(' + ')
    : 'Custom Pool';
  const mods = [];
  if (specialty) mods.push('Specialty');
  if (spendWp) mods.push('Willpower +1');
  if (applyWound && wound.penalty < 0) mods.push(wound.incapacitated ? 'Incapacitated' : `Wound ${wound.penalty}`);

  const diceStr = dice.map(d => d.val).join(', ');
  const prefix = charName ? `${charName} — ` : '';
  const modStr = mods.length ? `, ${mods.join(', ')}` : '';
  const summary = `${prefix}${traitDesc} (${effectivePool}d10, Diff ${difficulty}${modStr}): [${diceStr}] → ${outcomeLabel}`;

  lastRollClipboardText = summary;
  diceRollHistory.unshift({ traitDesc, outcomeLabel, outcomeClass, summary });
  if (diceRollHistory.length > 8) diceRollHistory.pop();
  renderRollHistory();
}


function executeInitiativeRoll() {
  const active = document.getElementById('splat-' + currentSplat);
  const dex = active ? getEffectiveAttrVal(currentSplat, 'dex', active) : 0;
  const wit = active ? getDotVal(active, `${currentSplat}_attr_wit`) : 0;
  const woundToggle = document.getElementById('diceWoundToggle');
  const wound = getActiveWoundPenalty(currentSplat);
  const applyWound = woundToggle && woundToggle.checked && wound.penalty < 0;

  const resultBox = document.getElementById('diceResultBox');
  const outcomeEl = document.getElementById('diceOutcomeText');
  const trayEl = document.getElementById('diceTray');
  const charName = (document.getElementById(currentSplat + '_char_name')?.value || '').trim();
  const prefix = charName ? `${charName} — ` : '';

  resultBox.style.display = 'block';

  if (applyWound && wound.incapacitated) {
    const outcomeLabel = 'Incapacitated (Cannot Act)';
    outcomeEl.textContent = outcomeLabel;
    outcomeEl.className = 'dice-outcome outcome-botch';
    trayEl.innerHTML = '<span style="font-size:11px; color:#888;">Incapacitated — cannot roll Initiative</span>';
    const summary = `${prefix}Initiative: ${outcomeLabel}`;
    lastRollClipboardText = summary;
    diceRollHistory.unshift({ traitDesc: 'Initiative', outcomeLabel, outcomeClass: 'outcome-botch', summary });
    if (diceRollHistory.length > 8) diceRollHistory.pop();
    renderRollHistory();
    return;
  }

  const die = rollSingleD10();
  const woundMod = applyWound ? wound.penalty : 0;
  const total = die + dex + wit + woundMod;

  const parts = [`d10: ${die}`, `Dex ${dex}`, `Wits ${wit}`];
  if (woundMod < 0) parts.push(`Wound ${woundMod}`);
  const breakdown = parts.join(' + ').replace('+ Wound -', '- Wound ');

  const outcomeLabel = `Initiative: ${total}`;
  const outcomeClass = die === 10 ? 'outcome-phenomenal' : (die === 1 ? 'outcome-fail' : 'outcome-success');
  outcomeEl.textContent = outcomeLabel;
  outcomeEl.className = 'dice-outcome ' + outcomeClass;

  const dieCls = die === 10 ? 'die-ten' : (die === 1 ? 'die-one' : 'die-success');
  trayEl.innerHTML = `<span class="die-badge ${dieCls}">${die}</span><span style="font-size:11.5px; color:#bbb; align-self:center; margin-left:4px;">(${breakdown})</span>`;

  const modStr = woundMod < 0 ? `, Wound ${woundMod}` : '';
  const summary = `${prefix}Initiative (1d10 + Dex ${dex} + Wits ${wit}${modStr}): [${die}] → ${total}`;
  lastRollClipboardText = summary;
  diceRollHistory.unshift({
    traitDesc: 'Initiative',
    outcomeLabel: `${total} (${breakdown})`,
    outcomeClass,
    summary
  });
  if (diceRollHistory.length > 8) diceRollHistory.pop();
  renderRollHistory();
}

function renderRollHistory() {
  const wrap = document.getElementById('diceHistoryWrap');
  const list = document.getElementById('diceHistoryList');
  if (!wrap || !list) return;
  if (!diceRollHistory.length) {
    wrap.style.display = 'none';
    return;
  }
  wrap.style.display = 'block';
  list.innerHTML = diceRollHistory.map((item, idx) => `
    <div class="dice-history-item">
      <span class="dice-history-text" title="${escapeHtmlForDice(item.summary)}">
        <strong>${escapeHtmlForDice(item.traitDesc)}:</strong> <span class="${item.outcomeClass}">${escapeHtmlForDice(item.outcomeLabel)}</span>
      </span>
      <button type="button" class="btn btn-sm copy-hist-btn" data-idx="${idx}" style="padding:1px 6px; font-size:10px;">Copy</button>
    </div>
  `).join('');
}

function spendOneWillpowerBox() {
  const active = document.getElementById('splat-' + currentSplat);
  if (!active) return;
  const wpSq = active.querySelector(`[data-id="${currentSplat}_wp_sq"]`);
  const wpDots = active.querySelector(`[data-id="${currentSplat}_wp_dots"]`);
  if (!wpSq) return;

  const cur = parseInt(wpSq.dataset.val || '0', 10);
  const max = wpDots ? parseInt(wpDots.dataset.val || '0', 10) : 10;
  if (cur <= 0) {
    showToast('No temporary Willpower boxes left!');
    return;
  }
  const next = cur - 1;
  wpSq.dataset.val = next;
  updateVisual(wpSq, next, 'square-box');
  updatePoolCounters(wpSq.closest('.pool-box') || active);
  isSheetDirty = true;
  scheduleAutoSave();
  showToast(`Spent 1 Willpower (${next}${max ? '/' + max : ''} remaining)`);
}

function bindDiceRoller() {
  const toggleBtn = document.getElementById('toggleDiceBtn');
  const closeBtn = document.getElementById('closeDiceBtn');
  if (toggleBtn) toggleBtn.addEventListener('click', () => toggleDicePanel());
  if (closeBtn) closeBtn.addEventListener('click', () => toggleDicePanel(false));

  const poolInput = document.getElementById('dicePoolInput');
  const diffInput = document.getElementById('diceDiffInput');
  const syncDiffPresets = () => {
    const val = parseInt(diffInput.value, 10);
    document.querySelectorAll('.diff-preset-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.diff, 10) === val);
    });
  };

  document.getElementById('dicePoolMinus').addEventListener('click', () => {
    poolInput.value = Math.max(0, (parseInt(poolInput.value, 10) || 0) - 1);
    updateEffectivePoolNote();
  });
  document.getElementById('dicePoolPlus').addEventListener('click', () => {
    poolInput.value = Math.min(50, (parseInt(poolInput.value, 10) || 0) + 1);
    updateEffectivePoolNote();
  });
  poolInput.addEventListener('input', updateEffectivePoolNote);

  document.getElementById('diceDiffMinus').addEventListener('click', () => {
    diffInput.value = Math.max(2, (parseInt(diffInput.value, 10) || 6) - 1);
    syncDiffPresets();
  });
  document.getElementById('diceDiffPlus').addEventListener('click', () => {
    diffInput.value = Math.min(10, (parseInt(diffInput.value, 10) || 6) + 1);
    syncDiffPresets();
  });
  diffInput.addEventListener('input', syncDiffPresets);

  document.querySelectorAll('.diff-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      diffInput.value = btn.dataset.diff;
      syncDiffPresets();
    });
  });

  document.getElementById('diceWoundToggle').addEventListener('change', updateEffectivePoolNote);
  document.getElementById('clearDiceTraitsBtn').addEventListener('click', () => {
    clearDiceSelection();
    updateEffectivePoolNote();
  });
  document.getElementById('spendWpBoxBtn').addEventListener('click', spendOneWillpowerBox);
  document.getElementById('rollDiceBtn').addEventListener('click', executeWodRoll);
  const initBtn = document.getElementById('rollInitiativeBtn');
  if (initBtn) initBtn.addEventListener('click', executeInitiativeRoll);

  document.getElementById('copyLastRollBtn').addEventListener('click', () => {
    if (lastRollClipboardText && navigator.clipboard) {
      navigator.clipboard.writeText(lastRollClipboardText).then(() => showToast('Copied roll to clipboard!'));
    }
  });
  document.getElementById('diceHistoryList').addEventListener('click', (e) => {
    const btn = e.target.closest('.copy-hist-btn');
    if (!btn) return;
    const item = diceRollHistory[parseInt(btn.dataset.idx, 10)];
    if (item && navigator.clipboard) {
      navigator.clipboard.writeText(item.summary).then(() => showToast('Copied roll to clipboard!'));
    }
  });
  document.getElementById('clearRollLogBtn').addEventListener('click', () => {
    diceRollHistory = [];
    renderRollHistory();
  });

  const reflexiveIds = ['_wp_dots', '_faith_dots', '_humanity_dots', '_path_dots', '_rage_dots', '_gnosis_dots', '_arete_dots', '_glamour_dots', '_banality_dots', '_corpus_dots', '_psyche_wp', '_angst'];
  document.querySelectorAll('.pool-box').forEach(box => {
    const dots = box.querySelector('.dots-container');
    const title = box.querySelector('.pool-title');
    if (dots && title) {
      box.classList.add('rollable-pool');
      title.title = 'Click to load pool into Dice Roller';
    }
  });

  document.querySelectorAll('.trait-flex-row').forEach(row => {
    const removeBtn = row.querySelector('.removeDynRowBtn, .removeCustomAbiBtn');
    if (removeBtn && !row.querySelector('.roll-trait-mini-btn')) {
      const rBtn = document.createElement('button');
      rBtn.type = 'button';
      rBtn.className = 'roll-trait-mini-btn no-print';
      rBtn.title = 'Roll Trait';
      rBtn.setAttribute('aria-label', 'Roll Trait');
      rBtn.textContent = 'd10';
      row.insertBefore(rBtn, removeBtn);
    }
  });

  document.getElementById('sheetForm').addEventListener('click', (e) => {
    const traitLbl = e.target.closest('.trait-row .trait-label');
    if (traitLbl) {
      const row = traitLbl.closest('.trait-row');
      const dots = row ? row.querySelector('.dots-container') : null;
      if (!dots) return;
      const specInp = row.querySelector('.trait-spec-input');
      const id = dots.dataset.id;
      const isReflexive = id.includes('_adv_2_') && (id.includes('conscience') || id.includes('self-control') || id.includes('courage'));
      const isSinglePool = id.includes('_glory_dots') || id.includes('_honor_dots') || id.includes('_wisdom_dots');
      selectTraitForDice({
        id,
        name: traitLbl.textContent.trim(),
        val: parseInt(dots.dataset.val || '0', 10),
        spec: specInp ? specInp.value.trim() : '',
        specInputId: specInp ? specInp.id : null,
        isSinglePool,
        isReflexive,
        rowEl: row
      });
      return;
    }

    const poolTitle = e.target.closest('.pool-box.rollable-pool .pool-title');
    if (poolTitle) {
      const box = poolTitle.closest('.pool-box');
      const dots = box.querySelector('.dots-container');
      if (!dots) return;
      const id = dots.dataset.id;
      const pathInp = box.querySelector('input[type="text"]');
      const titleTextEl = poolTitle.querySelector('.pool-title-text') || poolTitle;
      const labelName = (pathInp && pathInp.value.trim()) ? pathInp.value.trim() : titleTextEl.textContent.trim();
      selectTraitForDice({
        id,
        name: labelName,
        nameInputId: pathInp ? pathInp.id : null,
        val: parseInt(dots.dataset.val || '0', 10),
        spec: '',
        isSinglePool: true,
        isReflexive: reflexiveIds.some(suffix => id.endsWith(suffix)),
        rowEl: box
      });
      return;
    }

    const miniRollBtn = e.target.closest('.roll-trait-mini-btn');
    if (miniRollBtn) {
      const row = miniRollBtn.closest('.trait-flex-row');
      const dots = row ? row.querySelector('.dots-container') : null;
      if (!dots) return;
      const nameInp = row.querySelector('input.trait-name-input');
      const specInp = row.querySelector('input.trait-spec-input');
      const fallbackName = dots.dataset.id.includes('_custom_abi_') ? 'Custom Ability' : 'Advantage';
      selectTraitForDice({
        id: dots.dataset.id,
        name: (nameInp && nameInp.value.trim()) ? nameInp.value.trim() : fallbackName,
        nameInputId: nameInp ? nameInp.id : null,
        val: parseInt(dots.dataset.val || '0', 10),
        spec: specInp ? specInp.value.trim() : '',
        specInputId: specInp ? specInp.id : null,
        isSinglePool: false,
        isReflexive: false,
        rowEl: row
      });
    }
  });
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
  document.querySelectorAll('.guide-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => setGuideTab(btn.dataset.tab));
  });
}
