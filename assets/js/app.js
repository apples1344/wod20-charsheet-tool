import { SAMPLE_CHARACTERS, SAMPLE_TIERS } from './sampleCharacters.js';
import { preparePrintMirrors, clearPrintMirrors } from './print-prep.js';
import { buildQuickStart, QUICK_ROLES, QUICK_STYLES } from './quickstart.js';
import { WEREWOLF_FORMS, WOUND_LEVELS, HEALTH_PENALTIES, VAMPIRE_GENERATION } from './rules.js';
import { computeCreation } from './creation.js';
import { SPLAT_GUIDES, DOT_SCALE_GUIDE_HTML } from './guide.js';
import { resolveRoll, resolveInitiative } from './dice.js';
import { createDiceStage, toneFor, bindDiceMotionToggle } from './dice3d.js';
import { initUx, noteSaved, noteBackedUp } from './ux.js';
import { hydrateContainers } from './hydrate.js';
import { sanitizeImport, sanitizeState, MAX_IMPORT_BYTES, MAX_ROWS, MAX_LINK_BYTES, inflateCapped, holdRemotePortrait } from './import-guard.js';
import {
  V3_SPLATS, V3_WEREWOLF_FORMS,
  bytesToBase79, base79ToBytes, writeVarint, readVarint, dictEncodeUtf8, dictDecodeUtf8
} from './share-codec.js';

const STORAGE_KEY = 'wod_1to1_sheet_v3';
const THEME_STORAGE_KEY = 'wod_sheet_theme_v1';
const COMPACT_STORAGE_KEY = 'wod_sheet_compact_v1';
const INIT_WOUND_STORAGE_KEY = 'wod_sheet_init_wound_v1';
const ROLL_HISTORY_STORAGE_KEY = 'wod_sheet_roll_history_v1';
const DICE3D_STORAGE_KEY = 'wod_sheet_dice3d_v1';
const TALLY_OPEN_STORAGE_KEY = 'wod_sheet_creation_points_open_v1';
const TALLY_FREEBIE_OPEN_KEY = 'wod_sheet_creation_freebies_open_v1';
const ROLL_HISTORY_MAX = 25;
const UNDO_MAX = 50;
const undoStack = [];
let storageFailed = false;
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

const HEALTH_STATES = ['empty', 'bashing', 'lethal', 'aggravated'];
const HEALTH_SYMBOLS = { empty: '', bashing: '/', lethal: 'X', aggravated: '*' };
document.addEventListener('DOMContentLoaded', async () => {
  hydrateContainers();
  document.addEventListener('input', (e) => {
    const ta = e.target;
    if (ta instanceof HTMLTextAreaElement && ta.classList.contains('sheet-area')) {
      ta.style.height = '';
      ta.style.height = ta.scrollHeight + 'px';
    }
  });
  const dpLogo = document.querySelector('.dark-pack-logo');
  if (dpLogo) dpLogo.addEventListener('error', () => { dpLogo.style.display = 'none'; });
  bindUndo();
  bindStorageBadge();
  loadRollHistory();
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
  bindDice3d();
  bindPrintDialog();
  bindQuickStart();
  initUx({
    getSplat: () => currentSplat,
    getWound: () => getActiveWoundPenalty(currentSplat),
    setTrack: (container, next) => {
      const prev = parseInt(container.dataset.val || '0', 10);
      if (prev === next) return;
      pushUndo({ container, childClass: 'square-box', isSquare: true, paired: null, prev, label: getTraitContextLabel(container) });
      writeDotValue(container, 'square-box', true, null, next);
    },
    rollInitiative: () => { toggleDicePanel(true); executeInitiativeRoll(); },
    rollWillpower: () => {
      const title = Array.from(document.querySelectorAll(`#splat-${currentSplat} .pool-box.rollable-pool`))
        .find(b => b.querySelector(`[data-id="${currentSplat}_wp_dots"]`))?.querySelector('.pool-title');
      if (!title) { showToast('No Willpower pool on this sheet'); return; }
      rollFromSheetElement(title, {});
    },
    rollNow: (el, opts) => rollFromSheetElement(el, opts),
    addToPool: (el) => el.click()
  });
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
  handleLaunchShortcut();
});

// PWA shortcuts: ./index.html?open=dice | ?open=roster
function handleLaunchShortcut() {
  const params = new URLSearchParams(window.location.search);
  const target = params.get('open');
  if (!target) return;
  if (target === 'dice') toggleDicePanel(true);
  else if (target === 'roster') openRosterModal();
  params.delete('open');
  const qs = params.toString();
  history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : '') + window.location.hash);
}

function bindControls() {
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && !isEditableTarget(e.target)) {
      e.preventDefault();
      undoLastDotChange();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      saveAsJson();
      showToast('Saved JSON to Disk');
      return;
    }
    if (e.key === 'Escape') {
      const hardResetModal = document.getElementById('hardResetModal');
      if (hardResetModal && hardResetModal.open) {
        closeModal(hardResetModal);
        return;
      }
      const clearModal = document.getElementById('clearModal');
      if (clearModal && clearModal.open) {
        closeModal(clearModal);
        return;
      }
      const resetRosterModal = document.getElementById('resetRosterModal');
      if (resetRosterModal && resetRosterModal.open) {
        closeModal(resetRosterModal);
        return;
      }
      const rosterModal = document.getElementById('rosterModal');
      if (rosterModal && rosterModal.open) {
        closeRosterModal();
        return;
      }
      const sampleModal = document.getElementById('sampleConfirmModal');
      if (sampleModal && sampleModal.open) {
        closeModal(sampleModal);
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
      openModal(document.getElementById('sampleConfirmModal'));
    } else {
      loadSampleCharacter(key);
    }
  });

  document.getElementById('cancelSampleBtn').addEventListener('click', () => {
    closeModal(document.getElementById('sampleConfirmModal'));
    document.getElementById('sampleCharSelect').value = '';
    pendingSampleKey = '';
  });
  const sampleConfirmModalEl = document.getElementById('sampleConfirmModal');
  if (sampleConfirmModalEl) {
    sampleConfirmModalEl.addEventListener('click', (e) => {
      if (e.target === sampleConfirmModalEl) {
        closeModal(sampleConfirmModalEl);
        document.getElementById('sampleCharSelect').value = '';
        pendingSampleKey = '';
      }
    });
  }

  document.getElementById('confirmSampleBtn').addEventListener('click', () => {
    closeModal(document.getElementById('sampleConfirmModal'));
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
    openModal(document.getElementById('clearModal'));
  });
  document.getElementById('cancelClearBtn').addEventListener('click', () => {
    closeModal(document.getElementById('clearModal'));
  });
  const clearModalEl = document.getElementById('clearModal');
  if (clearModalEl) {
    clearModalEl.addEventListener('click', (e) => {
      if (e.target === clearModalEl) closeModal(clearModalEl);
    });
  }
  document.getElementById('confirmClearBtn').addEventListener('click', () => {
    closeModal(document.getElementById('clearModal'));
    document.getElementById('sampleCharSelect').value = '';
    clearSheet(false);
    isSheetDirty = false;
    showToast('Sheet Cleared');
  });

  document.getElementById('hardResetBtn').addEventListener('click', () => {
    openModal(document.getElementById('hardResetModal'));
  });
  document.getElementById('cancelHardResetBtn').addEventListener('click', () => {
    closeModal(document.getElementById('hardResetModal'));
  });
  const hardResetModalEl = document.getElementById('hardResetModal');
  if (hardResetModalEl) {
    hardResetModalEl.addEventListener('click', (e) => {
      if (e.target === hardResetModalEl) closeModal(hardResetModalEl);
    });
  }
  document.getElementById('confirmHardResetBtn').addEventListener('click', () => {
    closeModal(document.getElementById('hardResetModal'));
    hardResetWebsite();
  });

  window.addEventListener('beforeprint', () => {
    const active = document.getElementById('splat-' + currentSplat);
    if (active) autoResizeTextareas(active);
    prepareCompactPrintRows();
    ensureSyncShareLinkForPrint();
    preparePrintMirrors(active);
  });
  window.addEventListener('afterprint', () => {
    cleanupCompactPrintRows();
    clearPrintMirrors();
  });
  document.getElementById('printSheetBtn').addEventListener('click', () => {
    document.getElementById('moreOptionsMenu')?.classList.remove('show');
    openModal(document.getElementById('printDialog'));
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
        const maxDim = 400;
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
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
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

// The mini-header (name, health, Willpower) is fixed under the app bar once the identity
// block scrolls away, so every section below Traits lands beneath it. It may still be
// hidden when a jump starts; measure it anyway (no paint happens between the two lines).
function miniHeaderHeight() {
  const mini = document.getElementById('miniHeader');
  if (!mini) return 0;
  if (!mini.hidden) return mini.offsetHeight;
  mini.hidden = false;
  const h = mini.offsetHeight;
  mini.hidden = true;
  return h;
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
  const mini = document.getElementById('miniHeader');
  const threshold = barHeight + (mini && !mini.hidden ? mini.offsetHeight : 0) + 48;
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
  const top = target.getBoundingClientRect().top + window.scrollY - barHeight - miniHeaderHeight() - 16;
  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });

  // The mini-header fills in (and can wrap to two lines on phones) only once it shows,
  // so check again when the scroll settles and nudge the title clear of it.
  const settle = () => {
    const mini = document.getElementById('miniHeader');
    const cover = Math.max(barHeight, mini && !mini.hidden ? mini.getBoundingClientRect().bottom : 0);
    const gap = target.getBoundingClientRect().top - cover;
    if (gap < 8) window.scrollBy({ top: gap - 12, behavior: 'smooth' });
  };
  if ('onscrollend' in window) window.addEventListener('scrollend', settle, { once: true });
  else setTimeout(settle, 700);
}

function hasActiveSheetData() {
  return stateHasAnyData(captureCurrentState());
}

function getTraitContextLabel(container) {
  const row = container.closest('.trait-row, .trait-flex-row, .pool-box');
  if (!row) return container.dataset.id || 'Trait';
  const lbl = row.querySelector('.trait-label, .pool-title-text, .pool-title');
  // pool titles can carry a live "7 / 7" counter; keep just the name
  const text = lbl ? lbl.textContent.replace(/\s*\d+\s*\/\s*\d+\s*$/, '').trim() : '';
  if (text) return text;
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

  const maxVal = container.querySelectorAll('.' + childClass).length;
  const currentValue = () => (paired ? getPairedBoxTotal(paired.baseId) : parseInt(container.dataset.val || '0', 10));
  const applyValue = (next) => {
    const prev = currentValue();
    if (next === prev) return;
    pushUndo({ container, childClass, isSquare, paired: paired ? paired.baseId : null, prev, label: contextLabel });
    writeDotValue(container, childClass, isSquare, paired ? paired.baseId : null, next);
  };

  container.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    applyValue(0);
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
  if (!container.hasAttribute('role')) {
    container.setAttribute('role', 'group');
    container.setAttribute('aria-label', contextLabel);
  }

  container.querySelectorAll('.' + childClass).forEach(el => {
    const rawIdx = parseInt(el.dataset.idx, 10);
    const displayIdx = rawIdx + idxOffset;
    el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'button');
    el.setAttribute('aria-pressed', el.classList.contains('filled') ? 'true' : 'false');
    el.setAttribute('aria-label', `${contextLabel} ${isSquare ? 'box' : 'dot'} ${displayIdx}`);
    el.addEventListener('mouseenter', () => setHoverTrail(displayIdx));
    const clickHandler = () => {
      const current = currentValue();
      applyValue(current === displayIdx ? Math.max(0, displayIdx - 1) : displayIdx);
    };
    el.addEventListener('click', clickHandler);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        clickHandler();
        return;
      }
      const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
      const jump = e.key === 'Home' ? 0 : (e.key === 'End' ? maxVal + idxOffset : null);
      if (step === undefined && jump === null) return;
      e.preventDefault();
      const limit = paired ? (paired.row4 ? 40 : 20) : maxVal;
      const target = jump !== null ? Math.min(limit, jump) : Math.max(0, Math.min(limit, currentValue() + step));
      applyValue(target);
      // keep focus on the dot that now marks the value (within this row)
      const local = Math.max(1, Math.min(maxVal, target - idxOffset));
      const focusEl = container.querySelector(`.${childClass}[data-idx="${local}"]`);
      if (focusEl) focusEl.focus();
    });
  });
}

function writeDotValue(container, childClass, isSquare, pairedBaseId, next) {
  if (pairedBaseId) {
    setPairedBoxTotal(pairedBaseId, next);
  } else {
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
}

function pushUndo(entry) {
  if (isRestoring) return;
  undoStack.push(entry);
  if (undoStack.length > UNDO_MAX) undoStack.shift();
  syncUndoButton();
}

function undoLastDotChange() {
  let entry = undoStack.pop();
  while (entry && !entry.container.isConnected) entry = undoStack.pop();
  syncUndoButton();
  if (!entry) {
    showToast('Nothing to undo');
    return;
  }
  writeDotValue(entry.container, entry.childClass, entry.isSquare, entry.paired, entry.prev);
  showToast(`Undid: ${entry.label} back to ${entry.prev}`);
}

function syncUndoButton() {
  const btn = document.getElementById('undoDotBtn');
  if (btn) btn.disabled = undoStack.length === 0;
}

function isEditableTarget(el) {
  return !!(el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)));
}

function bindUndo() {
  const btn = document.getElementById('undoDotBtn');
  if (btn) btn.addEventListener('click', undoLastDotChange);
  syncUndoButton();
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
  tagSampleSlot(key);
  const charName = (sample.inputs && sample.inputs[sample.splat + '_char_name']) || key;
  showToast('Loaded Sample: ' + charName);
}

// The sample's tier lives on its roster card, so the printed sheet stays clean.
function tagSampleSlot(key) {
  const tier = SAMPLE_TIERS[key];
  if (!tier || !activeSlotId) return;
  const store = loadGlobalStore();
  const slot = store.roster.find(s => s.id === activeSlotId);
  if (!slot) return;
  slot.tags = Array.from(new Set([...(slot.tags || []), 'Sample', tier]));
  saveGlobalStore(store);
  renderRosterUI();
}

// Someone else's link or file named a portrait on another website. Ask before loading it:
// the request would show that website this visitor's IP address.
function offerHeldPortrait(splat, url) {
  const box = document.getElementById(splat + '_portraitContainer');
  if (!box) return;
  box.querySelector('.portrait-consent')?.remove();
  let host = '';
  try { host = new URL(url).hostname; } catch (e) { return; }
  const wrap = document.createElement('div');
  wrap.className = 'portrait-consent no-print';
  const msg = document.createElement('p');
  msg.textContent = `This character's portrait is on ${host}. Loading it lets that site see your IP address.`;
  const load = document.createElement('button');
  load.type = 'button';
  load.className = 'btn btn-sm btn-accent';
  load.textContent = 'Load portrait';
  const skip = document.createElement('button');
  skip.type = 'button';
  skip.className = 'btn btn-sm';
  skip.textContent = 'Skip';
  const actions = document.createElement('div');
  actions.className = 'portrait-consent-actions';
  actions.append(load, skip);
  wrap.append(msg, actions);
  box.appendChild(wrap);
  load.addEventListener('click', () => {
    const input = document.getElementById(splat + '_portrait_url');
    if (input) input.value = url;
    updatePortrait(splat, url);
    wrap.remove();
    isSheetDirty = true;
    saveNow();
  });
  skip.addEventListener('click', () => wrap.remove());
}

function updatePortrait(splat, url) {
  const img = document.getElementById(splat + '_portraitImg');
  const ph = document.querySelector(`#${splat}_portraitContainer .portraitPlaceholder`);
  if (!img) return;
  img.onerror = () => {
    img.style.display = 'none';
    if (ph) ph.style.display = 'block';
  };
  const clean = (url || '').trim();
  if (clean && !/^(https:\/\/|data:image\/|blob:)/i.test(clean)) {
    img.removeAttribute('src');
    img.style.display = 'none';
    if (ph) ph.style.display = 'block';
    return;
  }
  if (clean.length > 0) {
    img.src = clean;
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
  document.dispatchEvent(new CustomEvent('wod:splatchange', { detail: { splat } }));
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
  const table = VAMPIRE_GENERATION;
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
    if (threshold > 0 && tempAngst > threshold) {
      cathBadge.textContent = `Catharsis risk! (${tempAngst} > WP ${threshold})`;
      cathBadge.classList.add('helper-danger');
      cathBadge.title = `Temporary Angst (${tempAngst}) exceeds Permanent Willpower (${threshold}): the Shadow may attempt a Catharsis roll.`;
    } else if (threshold > 0 && tempAngst === threshold && tempAngst > 0) {
      cathBadge.textContent = `At threshold (${tempAngst}/${threshold})`;
      cathBadge.classList.add('helper-warn');
      cathBadge.title = `Temporary Angst equals Willpower (${threshold}). One more point lets the Shadow attempt Catharsis.`;
    } else {
      cathBadge.textContent = `WP ${threshold} Threshold`;
      cathBadge.title = `Wr20: the Shadow may attempt Catharsis when Temporary Angst (${tempAngst}) exceeds Permanent Willpower (${threshold}).`;
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
    const on = parseInt(el.dataset.idx, 10) <= val;
    el.classList.toggle('filled', on);
    el.setAttribute('aria-pressed', on ? 'true' : 'false');
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
    const chimIdx = getTrackPenaltyIndex('changeling', 'changeling_hlth_chim');
    const shortLabels = WOUND_LEVELS.map(w => w.short);
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
  undoStack.length = 0;
  syncUndoButton();
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
    state: structuredClone(state)
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
    if (storageFailed) {
      storageFailed = false;
      document.body.classList.remove('storage-failed');
    }
    return true;
  } catch (e) {
    console.warn('Local save failed:', e);
    if (!storageFailed) showToast('Not saved: browser storage is full or blocked. Back up your roster now.');
    storageFailed = true;
    document.body.classList.add('storage-failed');
    setBadgeState(document.getElementById('autosaveIndicator'));
    return false;
  }
}

function setBadgeState(badge) {
  if (!badge || !storageFailed) return false;
  badge.textContent = 'Not Saved — Back Up';
  badge.classList.remove('saved');
  badge.classList.add('failed');
  badge.setAttribute('role', 'button');
  badge.setAttribute('tabindex', '0');
  badge.title = 'Browser storage failed. Click to download a roster backup (.json).';
  return true;
}

function bindStorageBadge() {
  const badge = document.getElementById('autosaveIndicator');
  if (!badge) return;
  const backup = () => {
    if (!storageFailed) return;
    const btn = document.getElementById('exportRosterBtn');
    if (btn) btn.click(); else saveAsJson();
  };
  badge.addEventListener('click', backup);
  badge.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); backup(); }
  });
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

const ROSTER_SORT_KEY = 'wod_sheet_roster_sort_v1';

function getRosterSortMode() {
  const sel = document.getElementById('rosterSort');
  if (sel && sel.value) return sel.value;
  try { return localStorage.getItem(ROSTER_SORT_KEY) || 'recent'; } catch (e) { return 'recent'; }
}

// Gives every slot an explicit position (in the order shown), then moves one.
function setRosterOrder(ids) {
  const store = loadGlobalStore();
  ids.forEach((id, i) => { const s = store.roster.find(x => x.id === id); if (s) s.order = i; });
  saveGlobalStore(store);
  renderRosterUI();
}

function currentCustomOrderIds() {
  return Array.from(document.querySelectorAll('#rosterSlotList .roster-slot-card')).map(c => c.dataset.slotId);
}

function moveRosterSlot(id, dir) {
  const ids = currentCustomOrderIds();
  const i = ids.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  setRosterOrder(ids);
}

function bindRosterTools() {
  const search = document.getElementById('rosterSearch');
  const sort = document.getElementById('rosterSort');
  const list = document.getElementById('rosterSlotList');
  if (sort) {
    try { sort.value = localStorage.getItem(ROSTER_SORT_KEY) || 'recent'; } catch (e) { /* default */ }
    sort.addEventListener('change', () => {
      try { localStorage.setItem(ROSTER_SORT_KEY, sort.value); } catch (e) { /* ignore */ }
      renderRosterUI();
    });
  }
  if (search) search.addEventListener('input', () => renderRosterUI());
  if (!list) return;
  let dragId = null;
  list.addEventListener('dragstart', (e) => {
    const card = e.target.closest('.roster-slot-card[draggable="true"]');
    if (!card) return;
    dragId = card.dataset.slotId;
    card.classList.add('is-dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragId);
  });
  list.addEventListener('dragover', (e) => {
    if (!dragId) return;
    const over = e.target.closest('.roster-slot-card');
    if (!over || over.dataset.slotId === dragId) return;
    e.preventDefault();
    const dragging = list.querySelector('.is-dragging');
    const r = over.getBoundingClientRect();
    const before = e.clientY < r.top + r.height / 2;
    if (dragging) list.insertBefore(dragging, before ? over : over.nextSibling);
  });
  list.addEventListener('drop', (e) => { if (dragId) e.preventDefault(); });
  list.addEventListener('dragend', () => {
    if (!dragId) return;
    dragId = null;
    setRosterOrder(currentCustomOrderIds());
  });
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

  const mode = getRosterSortMode();
  const q = (document.getElementById('rosterSearch')?.value || '').trim().toLowerCase();
  const sorters = {
    recent: (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0),
    name: (a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }),
    splat: (a, b) => V3_SPLATS.indexOf(a.splat) - V3_SPLATS.indexOf(b.splat) || (a.name || '').localeCompare(b.name || ''),
    custom: (a, b) => (a.order ?? 1e9) - (b.order ?? 1e9) || (b.updatedAt || 0) - (a.updatedAt || 0)
  };
  const sorted = [...store.roster].sort(sorters[mode] || sorters.recent).filter(slot => {
    if (!q) return true;
    const hay = [slot.name, slot.subtitle, SPLAT_DISPLAY_NAMES[slot.splat], ...(slot.tags || [])].join(' ').toLowerCase();
    return q.split(/\s+/).every(w => hay.includes(w));
  });
  const isCustom = mode === 'custom' && !q;
  listEl.classList.toggle('is-custom-order', isCustom);
  if (!sorted.length) {
    listEl.innerHTML = '<p class="roster-empty">No characters match that search.</p>';
    return;
  }
  listEl.innerHTML = sorted.map((slot, pos) => {
    const isActive = slot.id === activeSlotId;
    const isConfirmDel = slot.id === rosterDeleteConfirmId;
    const splatName = SPLAT_DISPLAY_NAMES[slot.splat] || slot.splat;
    const metaParts = [slot.subtitle, formatSlotTimestamp(slot.updatedAt)].filter(Boolean).join(' · ');
    return `
      <div class="roster-slot-card${isActive ? ' active' : ''}" data-slot-id="${escapeHtmlForDice(slot.id)}"${isCustom ? ' draggable="true"' : ''}>
        ${isCustom ? `<div class="roster-drag" aria-hidden="true" title="Drag to reorder">⠇</div>` : ''}
        <div class="roster-slot-info">
          <div class="roster-slot-title-row">
            <span class="roster-slot-name">${escapeHtmlForDice(slot.name || 'Unnamed Character')}</span>
            <span class="roster-splat-pill">${escapeHtmlForDice(splatName)}</span>
            ${isActive ? '<span class="roster-active-pill">Active</span>' : ''}
          </div>
          <div class="roster-slot-meta">${escapeHtmlForDice(metaParts || 'Blank sheet')}</div>
          ${(slot.tags || []).length ? `<div class="roster-tags">${slot.tags.map(t => `<span class="roster-tag">${escapeHtmlForDice(t)}</span>`).join('')}</div>` : ''}
        </div>
        <div class="roster-slot-actions">
          ${!isActive ? `<button type="button" class="btn btn-sm btn-accent roster-open-btn" data-id="${escapeHtmlForDice(slot.id)}">Open</button>` : ''}
          <button type="button" class="btn btn-sm roster-rename-btn" data-id="${escapeHtmlForDice(slot.id)}" title="Rename slot">Rename</button>
          <button type="button" class="btn btn-sm roster-dup-btn" data-id="${escapeHtmlForDice(slot.id)}" title="Duplicate slot">Copy</button>
          <button type="button" class="btn btn-sm roster-npc-btn" data-id="${escapeHtmlForDice(slot.id)}" title="Duplicate as an NPC (tagged NPC)">As NPC</button>
          <button type="button" class="btn btn-sm roster-tags-btn" data-id="${escapeHtmlForDice(slot.id)}" title="Edit tags">Tags</button>
          ${isCustom ? `<button type="button" class="btn btn-sm roster-move-btn" data-id="${escapeHtmlForDice(slot.id)}" data-dir="-1" aria-label="Move up"${pos === 0 ? ' disabled' : ''}>▲</button><button type="button" class="btn btn-sm roster-move-btn" data-id="${escapeHtmlForDice(slot.id)}" data-dir="1" aria-label="Move down"${pos === sorted.length - 1 ? ' disabled' : ''}>▼</button>` : ''}
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

function openModal(el) {
  if (el && !el.open) el.showModal();
}

function closeModal(el) {
  if (el && el.open) el.close();
}

function openRosterModal() {
  flushAutoSave();
  rosterDeleteConfirmId = null;
  const newSplatSel = document.getElementById('rosterNewSplatSelect');
  if (newSplatSel) newSplatSel.value = currentSplat;
  renderRosterUI();
  const modal = document.getElementById('rosterModal');
  if (modal) openModal(modal);
}

function closeRosterModal() {
  rosterDeleteConfirmId = null;
  const confirmModal = document.getElementById('resetRosterModal');
  if (confirmModal) closeModal(confirmModal);
  const modal = document.getElementById('rosterModal');
  if (modal) closeModal(modal);
}

function bindRosterControls() {
  bindRosterTools();
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

      const npcBtn = e.target.closest('.roster-npc-btn');
      if (npcBtn) {
        const store = loadGlobalStore();
        const orig = store.roster.find(s => s.id === npcBtn.dataset.id);
        if (!orig) return;
        const clonedState = structuredClone(orig.state);
        const nameField = `${orig.splat}_char_name`;
        if (clonedState.inputs) {
          const baseName = (clonedState.inputs[nameField] || orig.name || 'Unnamed Character').trim();
          clonedState.inputs[nameField] = `${baseName} (NPC)`;
        }
        createNewRosterSlot(orig.splat, clonedState, `NPC copy of ${orig.name}`);
        const after = loadGlobalStore();
        const created = after.roster.find(s => s.id === activeSlotId);
        if (created) {
          created.tags = Array.from(new Set([...(orig.tags || []).filter(t => t.toLowerCase() !== 'pc'), 'NPC']));
          saveGlobalStore(after);
        }
        renderRosterUI();
        return;
      }

      const tagsBtn = e.target.closest('.roster-tags-btn');
      if (tagsBtn) {
        const card = tagsBtn.closest('.roster-slot-card');
        const info = card ? card.querySelector('.roster-slot-info') : null;
        const store = loadGlobalStore();
        const target = store.roster.find(s => s.id === tagsBtn.dataset.id);
        if (!info || !target) return;
        info.querySelector('.roster-tags')?.remove();
        const wrap = document.createElement('div');
        wrap.className = 'roster-tag-edit';
        wrap.innerHTML = `<input type="text" class="roster-rename-input" aria-label="Tags, separated by commas" placeholder="e.g. NPC, Chicago, Session 3"><button type="button" class="btn btn-sm btn-accent">Save</button>`;
        const inp = wrap.querySelector('input');
        inp.value = (target.tags || []).join(', ');
        const save = () => {
          const st = loadGlobalStore();
          const t = st.roster.find(x => x.id === target.id);
          if (t) {
            t.tags = Array.from(new Set(inp.value.split(',').map(x => x.trim().slice(0, 30)).filter(Boolean))).slice(0, 12);
            saveGlobalStore(st);
          }
          renderRosterUI();
        };
        wrap.querySelector('button').addEventListener('click', save);
        inp.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter') { ev.preventDefault(); save(); }
          if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); renderRosterUI(); }
        });
        info.appendChild(wrap);
        inp.focus();
        return;
      }

      const moveBtn = e.target.closest('.roster-move-btn');
      if (moveBtn) {
        moveRosterSlot(moveBtn.dataset.id, parseInt(moveBtn.dataset.dir, 10));
        requestAnimationFrame(() => {
          document.querySelector(`.roster-move-btn[data-id="${CSS.escape(moveBtn.dataset.id)}"][data-dir="${moveBtn.dataset.dir}"]:not(:disabled)`)?.focus();
        });
        return;
      }

      const dupBtn = e.target.closest('.roster-dup-btn');
      if (dupBtn) {
        const store = loadGlobalStore();
        const orig = store.roster.find(s => s.id === dupBtn.dataset.id);
        if (!orig) return;
        const clonedState = structuredClone(orig.state);
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
      noteBackedUp();
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
      openModal(resetRosterModal);
    });
  }
  if (cancelResetRosterBtn && resetRosterModal) {
    cancelResetRosterBtn.addEventListener('click', () => {
      closeModal(resetRosterModal);
    });
  }
  if (resetRosterModal) {
    resetRosterModal.addEventListener('click', (e) => {
      if (e.target === resetRosterModal) closeModal(resetRosterModal);
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
  const ok = saveGlobalStore(store);
  noteSaved(ok && isSheetDirty);

  renderRosterUI();
  if (badge && ok) {
    badge.textContent = 'Saved Locally';
    badge.classList.remove('failed');
    badge.removeAttribute('role');
    badge.removeAttribute('tabindex');
    badge.title = '';
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
  if (badge && !setBadgeState(badge)) {
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
  if (c.showPopover) {
    try {
      if (c.matches(':popover-open')) c.hidePopover();
      c.showPopover();
    } catch (e) { /* popover unsupported: falls back to z-index */ }
  }
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

  // Row counts come from the link: clamp them before any row is built.
  const counts = hasCustomCounts
    ? Array.from({ length: 9 }, () => Math.min(MAX_ROWS, readVarint(bytes, cursor)))
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
    if (hash.length > 4 * MAX_LINK_BYTES) throw new Error('Link too long');
    if (hash.startsWith('#v3~')) {
      state = unpackStateBinary(await inflateCapped(base79ToBytes(hash.substring(4))));
    } else if (hash.startsWith('#v3u~')) {
      state = unpackStateBinary(base79ToBytes(hash.substring(5)));
    } else if (hash.startsWith('#v2~')) {
      let b64 = hash.substring(4).replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      state = JSON.parse(new TextDecoder().decode(await inflateCapped(bytes)));
    } else if (hash.startsWith('#v1~')) {
      let b64 = hash.substring(4);
      while (b64.length % 4) b64 += '=';
      state = JSON.parse(decodeURIComponent(atob(b64)));
    }
    // Every link format gets the same checks as an imported file (dots, text, rows).
    if (state) state = sanitizeState(state);
    if (state) {
      const heldPortrait = holdRemotePortrait(state);
      isRestoring = true;
      restoreState(state);
      isRestoring = false;
      showToast('Loaded from URL!');
      if (heldPortrait) offerHeldPortrait(state.splat, heldPortrait);
      return true;
    }
  } catch (e) { console.error(e); showToast('Corrupted URL.'); }
  return false;
}

const DARK_PACK_JSON_NOTICE = {
  license: 'World of Darkness Dark Pack Agreement',
  agreementUrl: 'https://www.paradoxinteractive.com/games/world-of-darkness/community/dark-pack-agreement',
  copyright: 'Portions of the materials are the copyrights and trademarks of Paradox Interactive AB, and are used with permission. All rights reserved. For more information please visit worldofdarkness.com.',
  disclaimer: 'This is an unofficial fan creation and not official World of Darkness material. It is not affiliated with or endorsed by Paradox Interactive.'
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
  if (file.size > MAX_IMPORT_BYTES) {
    showToast(`File too large (max ${Math.round(MAX_IMPORT_BYTES / 1048576)} MB)`);
    return;
  }
  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const result = sanitizeImport(JSON.parse(evt.target.result));
      if (result.kind === 'invalid') {
        showToast('Import failed: ' + result.reason);
        return;
      }
      flushAutoSave();

      // Multi-character roster backup import
      if (result.kind === 'roster') {
        const store = loadGlobalStore();
        const imported = result.states.map(st => createSlotRecord(st));
        store.roster.push(...imported);
        saveGlobalStore(store);
        switchToRosterSlot(imported[0].id);
        if (fromRosterModal) renderRosterUI();
        showToast(`Imported ${imported.length} Character(s)` + (result.skipped ? `, skipped ${result.skipped} invalid` : ''));
        return;
      }

      // Single character JSON import
      const parsed = result.state;
      const heldPortrait = holdRemotePortrait(parsed);
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
      if (heldPortrait) offerHeldPortrait(parsed.splat, heldPortrait);
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
  const c = computeCreation(captureCurrentState());
  if (!c) return;
  tallyEl.innerHTML = renderCreationPoints(c);
  bindTallyToggles(tallyEl);
}

const STEP_ICON = { done: '✓', doing: '◐', over: '!', xp: '+', todo: '' };

function renderCreationPoints(c) {
  const esc = escapeHtmlForDice;
  const open = (key, dflt) => {
    try { const v = localStorage.getItem(key); return v === null ? dflt : v === '1'; } catch (e) { return dflt; }
  };
  const x = c.xp || { beyond: false, total: 0, byGroup: {}, storyteller: [], approval: [], assumed: [] };
  const beyond = x.beyond;
  const xpOf = (label) => x.byGroup[label] || 0;
  const xpTag = (n) => `<span class="tally-xp">+${n} XP</span>`;
  const stOf = (label) => (x.storyteller.find(s => s.label === label) || {}).dots || 0;

  const priorityBlock = (title, block, groupNames, extraHtml = '') => {
    const pr = block.priorities;
    const rows = block.groups.map(g => {
      let tag = '<span class="tally-slot is-empty">not started</span>';
      if (g.spent > 0) tag = `<span class="tally-slot" title="Counted as the group that gets ${g.slot}">your ${g.slot} group</span>`;
      let status;
      if (g.spent === 0) status = '';
      else if (beyond) status = xpOf(g.name) ? xpTag(xpOf(g.name)) : (g.left ? `<span class="tally-left">${g.left} to go</span>` : '<span class="tally-ok">full</span>');
      else status = g.over ? `<span class="tally-over">+${g.over} over</span>` : (g.left ? `<span class="tally-left">${g.left} to go</span>` : '<span class="tally-ok">full</span>');
      const flag = beyond ? '' : (g.over ? ' is-over' : '');
      return `<div class="guide-tally-row${flag}"><span class="guide-tally-label">${g.name}</span><span class="guide-tally-val"><b>${g.spent}</b> ${tag} ${status}</span></div>`;
    }).join('');
    const blockXp = block.groups.reduce((s, g) => s + xpOf(g.name), 0);
    let summary;
    if (!block.started) summary = `${block.budget} dots to place`;
    else if (beyond && blockXp) summary = `<span class="tally-xp">≈ ${blockXp} XP</span>`;
    else if (!beyond && block.over) summary = `<span class="tally-over">${block.over} over (Freebies)</span>`;
    else summary = block.left ? `${block.left} left to place` : '<span class="tally-ok">all placed</span>';
    return `
      <div class="tally-block">
        <div class="guide-tally-group"><span>${title}</span><span class="tally-block-sum">${block.spent} / ${block.budget} · ${summary}</span></div>
        <p class="tally-how"><b>Any order you like:</b> ${pr[0]} · ${pr[1]} · ${pr[2]} across ${groupNames}. Your biggest group counts as the ${pr[0]}.</p>
        ${rows}
        ${extraHtml}
      </div>`;
  };

  const attrHtml = priorityBlock('Attributes', c.attributes, 'Physical, Social and Mental')
    .replace('</p>', ' The free first dot in each Attribute isn\'t counted.</p>');
  const aboveThreeRow = (!beyond && c.abilities.aboveThree)
    ? `<div class="guide-tally-row is-over"><span class="guide-tally-label">Above 3 dots</span><span class="guide-tally-val"><b>${c.abilities.aboveThree}</b> ${c.abilities.aboveThree === 1 ? 'Ability' : 'Abilities'} <span class="tally-over" title="No Ability can go above 3 with starting dots; the extra dots come from Freebie Points">needs Freebies</span></span></div>`
    : '';
  const abilHtml = priorityBlock('Abilities', c.abilities, 'Talents, Skills and Knowledges', aboveThreeRow);

  const traitRows = c.traits.map(t => {
    let status;
    if (beyond && t.over) {
      const bits = [];
      if (xpOf(t.label)) bits.push(xpTag(xpOf(t.label)));
      if (stOf(t.label)) bits.push(`<span class="tally-left" title="This game line sets no XP price for these; the Storyteller decides">+${stOf(t.label)} · Storyteller</span>`);
      status = bits.length ? bits.join(' ') : '<span class="tally-ok">Freebies</span>';
    } else {
      status = t.over ? `<span class="tally-over">+${t.over} over</span>` : (t.spent === 0 ? `<span class="tally-left">${t.limit ? t.limit + ' to place' : 'Freebies only'}</span>` : (t.left ? `<span class="tally-left">${t.left} to go</span>` : '<span class="tally-ok">full</span>'));
    }
    const flag = (!beyond && t.over) ? ' is-over' : '';
    return `<div class="guide-tally-row${flag}"><span class="guide-tally-label">${esc(t.label)}</span><span class="guide-tally-val"><b>${t.spent}</b> of ${t.limit} ${status}</span></div>`;
  }).join('');

  const f = c.freebies;
  const fpPhrase = x.freebieBudget === f.budget
    ? `all ${f.budget} Freebie Points`
    : `all ${f.budget} Freebie Points (${x.freebieBudget} after Merits and Flaws)`;
  const notCounted = f.notCounted.length ? `Not counted: ${esc(f.notCounted.join(', '))} (the starting value depends on choices the sheet can't read).` : '';

  let lastBlock;
  if (!beyond) {
    const fClass = f.used > f.budget ? 'tally-over' : (f.used === f.budget ? 'tally-ok' : 'tally-left');
    const fParts = f.parts.length
      ? f.parts.map(p => `<div class="guide-tally-row"><span class="guide-tally-label">${esc(p.label)}</span><span class="guide-tally-val">${p.pts > 0 ? '' : '−'}${Math.abs(p.pts)}</span></div>`).join('')
      : '<p class="tally-how">Nothing above the starting dots yet.</p>';
    const fNote = [notCounted, f.flawsCapped ? 'Flaws above 7 points give no extra Freebies.' : ''].filter(Boolean).join(' ');
    lastBlock = `
      <div class="tally-block">
        <details class="tally-freebies" data-store="${TALLY_FREEBIE_OPEN_KEY}"${open(TALLY_FREEBIE_OPEN_KEY, false) ? ' open' : ''}>
          <summary class="guide-tally-group"><span>Freebie Points (estimate)</span><span class="tally-block-sum ${fClass}">${f.used} / ${f.budget}</span></summary>
          ${fParts}
          ${fNote ? `<p class="tally-how">${fNote}</p>` : ''}
        </details>
      </div>`;
  } else {
    const order = [...c.attributes.groups.map(g => g.name), ...c.abilities.groups.map(g => g.name), ...c.traits.map(t => t.label), ...c.pools.map(p => p.label)];
    const xpRows = order.filter(l => xpOf(l)).map(l =>
      `<div class="guide-tally-row"><span class="guide-tally-label">${esc(l)}${x.approval.includes(l) ? ' <span class="tally-slot" title="Needs the Storyteller\'s approval">ST approval</span>' : ''}</span><span class="guide-tally-val">${xpOf(l)}</span></div>`).join('');
    const stRows = x.storyteller.map(s =>
      `<div class="guide-tally-row"><span class="guide-tally-label">${esc(s.label)}</span><span class="guide-tally-val">+${s.dots} ${s.dots === 1 ? 'dot' : 'dots'} · Storyteller</span></div>`).join('');
    const xNote = [
      `${fpPhrase.charAt(0).toUpperCase() + fpPhrase.slice(1)} are counted as spent, then XP covers the rest. The sheet can't see the order dots were bought in, so this takes the cheapest order: starting dots and Freebies go where they save the most XP.`,
      x.assumed.length ? `Assumed: ${esc(x.assumed.join('; '))}.` : '',
      x.storyteller.length ? 'Storyteller rows have no XP price in this game line.' : '',
      notCounted
    ].filter(Boolean).join(' ');
    lastBlock = `
      <div class="tally-block">
        <details class="tally-freebies" data-store="${TALLY_FREEBIE_OPEN_KEY}"${open(TALLY_FREEBIE_OPEN_KEY, false) ? ' open' : ''}>
          <summary class="guide-tally-group"><span>XP beyond creation (estimate)</span><span class="tally-block-sum tally-xp">≈ ${x.total} XP</span></summary>
          ${xpRows}
          ${stRows}
          <p class="tally-how">${xNote}</p>
        </details>
      </div>`;
  }

  const steps = c.steps.map((st, i) => `<li class="tally-step is-${st.state}" title="${esc(st.hint)}"><span class="tally-step-dot">${STEP_ICON[st.state] || i + 1}</span><span>${st.label}</span></li>`).join('');
  const overCount = c.attributes.over + c.abilities.over + c.traits.reduce((s, t) => s + t.over, 0);
  let headline;
  let headClass = '';
  if (beyond) {
    headline = x.total ? `≈ ${x.total} XP beyond creation` : 'Beyond creation';
    headClass = ' has-xp';
  } else if (f.used > f.budget) {
    headline = `${f.used - f.budget} Freebies over`;
    headClass = ' has-over';
  } else {
    headline = overCount || f.used ? `${f.used} / ${f.budget} Freebies` : 'within starting dots';
  }
  const note = beyond
    ? `Past the starting dots and ${fpPhrase}, so the extra is shown as XP. A guide only; you can always add more dots.`
    : 'A guide only; you can always add more dots. Anything above the starting dots shows as <span class="tally-over">over</span> and is paid with Freebie Points. Once those run out, the counter switches to XP.';

  return `
    <details class="guide-tally-details" data-store="${TALLY_OPEN_STORAGE_KEY}"${open(TALLY_OPEN_STORAGE_KEY, true) ? ' open' : ''}>
      <summary class="guide-tally-title"><span>Creation Points</span><span class="guide-tally-summary${headClass}">${headline}</span></summary>
      <ol class="tally-steps" aria-label="Creation steps">${steps}</ol>
      ${!c.attributes.started && !c.abilities.started ? '<button type="button" class="btn btn-sm btn-accent tally-quickstart" data-action="quickstart">Quick Start: place the dots for me</button>' : ''}
      <p class="guide-tally-note">${note}</p>
      ${attrHtml}
      ${abilHtml}
      <div class="tally-block">
        <div class="guide-tally-group"><span>Advantages</span><span class="tally-block-sum">fixed amounts</span></div>
        ${traitRows}
      </div>
      ${lastBlock}
    </details>`;
}

function bindTallyToggles(tallyEl) {
  if (tallyEl.dataset.bound) return;
  tallyEl.dataset.bound = '1';
  tallyEl.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="quickstart"]')) openQuickStart();
  });
  // "toggle" does not bubble, so listen in the capture phase; the markup is rebuilt on every change
  tallyEl.addEventListener('toggle', (e) => {
    const key = e.target && e.target.dataset ? e.target.dataset.store : null;
    if (!key) return;
    try { localStorage.setItem(key, e.target.open ? '1' : '0'); } catch (err) { /* ignore */ }
  }, true);
}

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
  const map = WOUND_LEVELS;
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
  const initRow = document.getElementById('diceInitWoundRow');
  const initLabel = document.getElementById('diceInitWoundLabel');
  if (initRow && initLabel) {
    initRow.style.display = wound.penalty < 0 ? 'flex' : 'none';
    initLabel.innerHTML = wound.incapacitated
      ? 'Apply Wound Status to Initiative <strong style="color:#ff7b7b;">(Incapacitated)</strong>'
      : `Apply Wound Penalty to Initiative <strong>(${wound.penalty})</strong>`;
  }
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

function executeWodRoll() {
  const specialty = document.getElementById('diceSpecialtyToggle').checked;
  const spendWp = document.getElementById('diceWillpowerToggle').checked;
  const woundToggle = document.getElementById('diceWoundToggle');
  const wound = getActiveWoundPenalty(currentSplat);
  const result = resolveRoll({
    pool: document.getElementById('dicePoolInput').value,
    difficulty: document.getElementById('diceDiffInput').value,
    specialty,
    willpower: spendWp,
    wound,
    applyWound: Boolean(woundToggle && woundToggle.checked)
  });
  const { difficulty, effectivePool, dice, outcomeLabel, outcomeClass } = result;
  const applyWound = result.wounded;

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
  pushRollHistory({ traitDesc, outcomeLabel, outcomeClass, summary });
  play3dRoll(dice.map(d => ({ value: d.val, tone: toneFor(d.val, difficulty) })));
}


function executeInitiativeRoll() {
  const active = document.getElementById('splat-' + currentSplat);
  const dex = active ? getEffectiveAttrVal(currentSplat, 'dex', active) : 0;
  const wit = active ? getDotVal(active, `${currentSplat}_attr_wit`) : 0;
  const initWoundToggle = document.getElementById('diceInitWoundToggle');
  const wound = getActiveWoundPenalty(currentSplat);
  const init = resolveInitiative({
    dex, wits: wit, wound,
    applyWound: Boolean(initWoundToggle && initWoundToggle.checked)
  });

  const resultBox = document.getElementById('diceResultBox');
  const outcomeEl = document.getElementById('diceOutcomeText');
  const trayEl = document.getElementById('diceTray');
  const charName = (document.getElementById(currentSplat + '_char_name')?.value || '').trim();
  const prefix = charName ? `${charName} — ` : '';

  resultBox.style.display = 'block';

  if (init.incapacitated) {
    const outcomeLabel = 'Incapacitated (Cannot Act)';
    outcomeEl.textContent = outcomeLabel;
    outcomeEl.className = 'dice-outcome outcome-botch';
    trayEl.innerHTML = '<span style="font-size:11px; color:#888;">Incapacitated — cannot roll Initiative</span>';
    play3dRoll([]);
    const summary = `${prefix}Initiative: ${outcomeLabel}`;
    lastRollClipboardText = summary;
    pushRollHistory({ traitDesc: 'Initiative', outcomeLabel, outcomeClass: 'outcome-botch', summary });
    return;
  }

  const { die, woundMod, total } = init;
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
  pushRollHistory({
    traitDesc: 'Initiative',
    outcomeLabel: `${total} (${breakdown})`,
    outcomeClass,
    summary
  });
  play3dRoll([{ value: die, tone: die === 10 ? 'ten' : (die === 1 ? 'one' : 'success') }]);
}

function pushRollHistory(item) {
  diceRollHistory.unshift({ ...item, at: Date.now() });
  if (diceRollHistory.length > ROLL_HISTORY_MAX) diceRollHistory.length = ROLL_HISTORY_MAX;
  saveRollHistory();
  renderRollHistory();
}

function saveRollHistory() {
  try {
    if (diceRollHistory.length) localStorage.setItem(ROLL_HISTORY_STORAGE_KEY, JSON.stringify(diceRollHistory));
    else localStorage.removeItem(ROLL_HISTORY_STORAGE_KEY);
  } catch (e) { console.warn('Roll history not saved:', e); }
}

function loadRollHistory() {
  try {
    const raw = JSON.parse(localStorage.getItem(ROLL_HISTORY_STORAGE_KEY) || '[]');
    if (Array.isArray(raw)) {
      diceRollHistory = raw
        .filter(r => r && typeof r.summary === 'string' && typeof r.traitDesc === 'string' && typeof r.outcomeLabel === 'string')
        .slice(0, ROLL_HISTORY_MAX)
        .map(r => ({
          traitDesc: r.traitDesc.slice(0, 300),
          outcomeLabel: r.outcomeLabel.slice(0, 300),
          outcomeClass: /^outcome-[a-z]+$/.test(r.outcomeClass) ? r.outcomeClass : '',
          summary: r.summary.slice(0, 2000),
          at: Number(r.at) || 0
        }));
    }
  } catch (e) { diceRollHistory = []; }
  renderRollHistory();
}

let dice3dStage = null;
let dice3dToken = 0;

function dice3dEnabled() {
  const t = document.getElementById('dice3dToggle');
  return Boolean(t && t.checked);
}

// Animates the already-decided dice; the outcome text and badges appear when they land.
// Used by the roll menu, search and quick buttons: select one trait and roll it at once.
const PRINT_PREFS_KEY = 'wod_sheet_print_prefs_v1';

// ---------- Quick Start: fill a new sheet's dots from a role ----------
const QUICKSTART_PREFS_KEY = 'wod_sheet_quickstart_v1';

function openQuickStart() {
  document.getElementById('moreOptionsMenu')?.classList.remove('show');
  const dlg = document.getElementById('quickStartDialog');
  const note = document.getElementById('quickStartNote');
  const lineName = SPLAT_DISPLAY_NAMES[currentSplat] || currentSplat;
  if (note) {
    note.textContent = hasActiveSheetData()
      ? `Makes a new ${lineName} character; your current one stays in the roster. Change the game line first if you want a different one.`
      : `Fills this blank ${lineName} sheet. Change the game line first if you want a different one.`;
  }
  openModal(dlg);
}

function bindQuickStart() {
  const dlg = document.getElementById('quickStartDialog');
  const rolesEl = document.getElementById('quickStartRoles');
  const stylesEl = document.getElementById('quickStartStyles');
  if (!dlg || !rolesEl || !stylesEl) return;

  let prefs = {};
  try { prefs = JSON.parse(localStorage.getItem(QUICKSTART_PREFS_KEY) || '{}') || {}; } catch (e) { prefs = {}; }
  const roleKey = QUICK_ROLES.some(r => r.key === prefs.role) ? prefs.role : QUICK_ROLES[0].key;
  const styleKey = QUICK_STYLES.some(s => s.key === prefs.style) ? prefs.style : 'rounded';

  // Built with DOM calls (no HTML strings): the labels are this app's own text either way.
  QUICK_ROLES.forEach(r => {
    const label = document.createElement('label');
    label.className = 'quickstart-role';
    const input = document.createElement('input');
    input.type = 'radio'; input.name = 'quickRole'; input.value = r.key; input.checked = r.key === roleKey;
    const name = document.createElement('b'); name.textContent = r.label;
    const blurb = document.createElement('small'); blurb.textContent = r.blurb;
    const text = document.createElement('span'); text.append(name, blurb);
    label.append(input, text);
    rolesEl.appendChild(label);
  });
  QUICK_STYLES.forEach(st => {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'radio'; input.name = 'quickStyle'; input.value = st.key; input.checked = st.key === styleKey;
    const name = document.createElement('b'); name.textContent = st.label;
    const blurb = document.createElement('small'); blurb.textContent = st.blurb;
    const text = document.createElement('span'); text.append(name, blurb);
    label.append(input, ' ', text);
    stylesEl.appendChild(label);
  });

  document.getElementById('quickStartBtn')?.addEventListener('click', openQuickStart);
  document.getElementById('quickStartMenuBtn')?.addEventListener('click', openQuickStart);
  document.getElementById('quickStartCancelBtn')?.addEventListener('click', () => closeModal(dlg));
  dlg.addEventListener('click', (e) => { if (e.target === dlg) closeModal(dlg); });
  document.getElementById('quickStartGoBtn')?.addEventListener('click', () => {
    const role = dlg.querySelector('input[name="quickRole"]:checked')?.value || QUICK_ROLES[0].key;
    const style = dlg.querySelector('input[name="quickStyle"]:checked')?.value || 'rounded';
    try { localStorage.setItem(QUICKSTART_PREFS_KEY, JSON.stringify({ role, style })); } catch (e) { /* ignore */ }
    closeModal(dlg);
    applyQuickStart(role, style);
  });
}

function applyQuickStart(roleKey, style) {
  const sp = currentSplat;
  if (hasActiveSheetData()) createNewRosterSlot(sp, null, '');
  const container = document.getElementById('splat-' + sp);
  if (!container) return;

  const abilities = { 0: [], 1: [], 2: [] };
  const abiRe = new RegExp(`^${sp}_abi_([012])_(.+)$`);
  container.querySelectorAll('.dots-container[data-id]').forEach(el => {
    const m = el.dataset.id.match(abiRe);
    if (m) abilities[m[1]].push({ id: el.dataset.id, name: m[2] });
  });
  const virtueIds = (sp === 'mortal' || sp === 'vampire')
    ? Array.from(container.querySelectorAll(`.dots-container[data-id^="${sp}_adv_2_"]`)).map(el => el.dataset.id)
    : [];

  const q = buildQuickStart({ splat: sp, roleKey, style, abilities, virtueIds });
  const state = captureCurrentState();
  Object.assign(state.dots, q.dots);
  const conceptKey = `${sp}_char_concept`;
  if (conceptKey in state.inputs && !state.inputs[conceptKey].trim()) state.inputs[conceptKey] = q.role.label;

  isRestoring = true;
  restoreState(state);
  switchSplat(sp);
  isRestoring = false;
  isSheetDirty = true;
  saveNow();
  updateGuideTally();

  const guide = document.getElementById('guidePanel');
  if (guide && !guide.classList.contains('open')) toggleGuide();
  showToast(`${q.role.label} placed. Still to choose: ${q.next.join(', ')}.` + (q.notes.length ? ' ' + q.notes.join(' ') : ''));
}

function bindPrintDialog() {
  const dlg = document.getElementById('printDialog');
  if (!dlg) return;
  try {
    const prefs = JSON.parse(localStorage.getItem(PRINT_PREFS_KEY) || '{}');
    if (prefs.layout === 'compact') dlg.querySelector('input[value="compact"]').checked = true;
    if (prefs.bio === false) document.getElementById('printIncludeBio').checked = false;
    if (prefs.portrait === false) document.getElementById('printIncludePortrait').checked = false;
  } catch (e) { /* defaults */ }
  document.getElementById('printCancelBtn').addEventListener('click', () => closeModal(dlg));
  dlg.addEventListener('click', (e) => { if (e.target === dlg) closeModal(dlg); });
  document.getElementById('printGoBtn').addEventListener('click', async () => {
    const layout = dlg.querySelector('input[name="printLayout"]:checked')?.value || 'full';
    const bio = document.getElementById('printIncludeBio').checked;
    const portrait = document.getElementById('printIncludePortrait').checked;
    try { localStorage.setItem(PRINT_PREFS_KEY, JSON.stringify({ layout, bio, portrait })); } catch (e) { /* ignore */ }
    closeModal(dlg);

    const active = document.getElementById('splat-' + currentSplat);
    if (active) autoResizeTextareas(active);
    document.body.classList.toggle('print-compact', layout === 'compact');
    document.body.classList.toggle('print-no-portrait', !portrait);
    const omitted = [];
    if (!bio && active) {
      const bioHeader = Array.from(active.querySelectorAll('.wod-header')).find(h => /description/i.test(h.textContent));
      for (let el = bioHeader; el; el = el.nextElementSibling) { el.classList.add('print-omit'); omitted.push(el); }
    }
    const cleanup = () => {
      document.body.classList.remove('print-compact', 'print-no-portrait');
      omitted.forEach(el => el.classList.remove('print-omit'));
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    await generateShareUrl({ copyToClipboard: true, showNotification: true });
    window.print();
  });
}

function rollFromSheetElement(el, { specialty = false, willpower = false } = {}) {
  clearDiceSelection();
  el.click();
  const spec = document.getElementById('diceSpecialtyToggle');
  const wp = document.getElementById('diceWillpowerToggle');
  if (spec) spec.checked = Boolean(specialty);
  if (wp) wp.checked = Boolean(willpower);
  toggleDicePanel(true);
  executeWodRoll();
}

function play3dRoll(values) {
  const canvas = document.getElementById('dice3dCanvas');
  const box = document.getElementById('diceResultBox');
  if (!canvas || !box) return;
  const token = ++dice3dToken;
  if (!dice3dEnabled() || !values.length) {
    canvas.hidden = true;
    box.classList.remove('is-rolling');
    return;
  }
  canvas.hidden = false;
  if (!dice3dStage) dice3dStage = createDiceStage(canvas);
  box.classList.add('is-rolling');
  dice3dStage.roll(values).then(() => {
    if (token === dice3dToken) box.classList.remove('is-rolling');
  });
}

function bindDice3d() {
  const toggle = document.getElementById('dice3dToggle');
  if (toggle) {
    try {
      const saved = localStorage.getItem(DICE3D_STORAGE_KEY);
      if (saved !== null) toggle.checked = saved === '1';
    } catch (e) { /* storage unavailable: keep default (on) */ }
    toggle.addEventListener('change', () => {
      try { localStorage.setItem(DICE3D_STORAGE_KEY, toggle.checked ? '1' : '0'); } catch (e) { /* ignore */ }
      if (!toggle.checked) play3dRoll([]);
    });
  }
  bindDiceMotionToggle(document.getElementById('dice3dMotionToggle'));
  const link = document.getElementById('dice3dPageLink');
  if (link) {
    link.addEventListener('click', () => {
      const params = new URLSearchParams({
        pool: String(Math.max(1, parseInt(document.getElementById('dicePoolInput').value, 10) || 1)),
        diff: document.getElementById('diceDiffInput').value || '6'
      });
      if (document.getElementById('diceSpecialtyToggle').checked) params.set('spec', '1');
      if (document.getElementById('diceWillpowerToggle').checked) params.set('wp', '1');
      link.href = './dice3d.html?' + params.toString();
    });
  }
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
        ${item.at ? `<time class="dice-history-time" datetime="${new Date(item.at).toISOString()}">${new Date(item.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>` : ''}<strong>${escapeHtmlForDice(item.traitDesc)}:</strong> <span class="${item.outcomeClass}">${escapeHtmlForDice(item.outcomeLabel)}</span>
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
  const initWoundToggle = document.getElementById('diceInitWoundToggle');
  if (initWoundToggle) {
    try {
      const saved = localStorage.getItem(INIT_WOUND_STORAGE_KEY);
      if (saved !== null) initWoundToggle.checked = saved === '1';
    } catch (e) { /* storage unavailable: keep default (on) */ }
    initWoundToggle.addEventListener('change', () => {
      try { localStorage.setItem(INIT_WOUND_STORAGE_KEY, initWoundToggle.checked ? '1' : '0'); } catch (e) { /* ignore */ }
    });
  }

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
    saveRollHistory();
    renderRollHistory();
    showToast('Roll history cleared');
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
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(window.location.protocol)) return;
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js');
      const hadController = Boolean(navigator.serviceWorker.controller);
      const offerUpdate = (worker) => {
        if (!worker || !hadController) return;
        showUpdateBanner(() => worker.postMessage({ type: 'SKIP_WAITING' }));
      };
      if (reg.waiting) offerUpdate(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed') offerUpdate(nw);
        });
      });
      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloading || !hadController) return;
        reloading = true;
        flushAutoSave();
        window.location.reload();
      });
      // check for a new version when the tab comes back into view
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    } catch (e) {
      console.warn('Service worker registration failed:', e);
    }
  });
}

function showUpdateBanner(onReload) {
  if (document.getElementById('updateBanner')) return;
  const bar = document.createElement('div');
  bar.id = 'updateBanner';
  bar.className = 'update-banner no-print';
  bar.setAttribute('role', 'status');
  bar.innerHTML = '<span>A new version is ready.</span><button type="button" class="btn btn-sm btn-accent">Reload</button><button type="button" class="btn btn-sm" aria-label="Dismiss">Later</button>';
  const [reloadBtn, laterBtn] = bar.querySelectorAll('button');
  reloadBtn.addEventListener('click', () => { reloadBtn.disabled = true; onReload(); });
  laterBtn.addEventListener('click', () => bar.remove());
  document.body.appendChild(bar);
}

function bindGuide() {
  document.getElementById('toggleGuideBtn').addEventListener('click', toggleGuide);
  document.getElementById('closeGuideBtn').addEventListener('click', toggleGuide);
  document.querySelectorAll('.guide-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => setGuideTab(btn.dataset.tab));
  });
}
