// Paper can't scroll. Before printing, every text field in the active sheet gets a
// plain-text copy beside it, so long names and histories wrap instead of being cut off.
// The copies are print-only (see print.css) and are removed again after printing.

const MIRROR_CLASS = 'print-mirror';
const SOURCE_CLASS = 'pm-src';

function mirrorKind(input) {
  if (input.classList.contains('trait-spec-input')) return 'pm-spec';
  if (input.classList.contains('trait-name-input')) return 'pm-name';
  if (input.closest('td')) return 'pm-cell';
  return 'pm-field';
}

export function clearPrintMirrors(doc = document) {
  doc.querySelectorAll('.' + MIRROR_CLASS).forEach(el => el.remove());
  doc.querySelectorAll('.' + SOURCE_CLASS).forEach(el => el.classList.remove(SOURCE_CLASS));
  doc.querySelectorAll('.pm-portrait-empty').forEach(el => el.classList.remove('pm-portrait-empty'));
}

export function preparePrintMirrors(root) {
  if (!root) return;
  const doc = root.ownerDocument || document;
  clearPrintMirrors(doc);

  root.querySelectorAll('textarea.sheet-area').forEach(ta => {
    if (ta.closest('.no-print')) return;
    const box = doc.createElement('div');
    const text = ta.value.replace(/\s+$/, '');
    box.className = `${MIRROR_CLASS} pm-area${text ? '' : ' pm-empty'}`;
    box.dataset.field = ta.id.replace(/^[a-z]+_/, ''); // e.g. "history", "desc", "p2_custom"
    box.textContent = text;
    ta.classList.add(SOURCE_CLASS);
    ta.after(box);
  });

  root.querySelectorAll('input[type="text"]').forEach(input => {
    const text = input.value.trim();
    if (!text || input.closest('.no-print')) return;
    const span = doc.createElement('span');
    span.className = `${MIRROR_CLASS} ${mirrorKind(input)}`;
    span.textContent = text;
    input.classList.add(SOURCE_CLASS);
    input.after(span);
  });

  root.querySelectorAll('.portrait-box').forEach(box => {
    const img = box.querySelector('img');
    const shown = img && img.getAttribute('src') && img.style.display !== 'none';
    if (!shown) box.classList.add('pm-portrait-empty');
  });
}
