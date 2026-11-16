/**
 * Dot / box containers are stored compactly in index.html as an empty element with a
 * data-fill code. hydrateContainers() expands them into the full span markup before the
 * sheet is initialised.
 *
 *   d5s  five dots + five 10-dot-mode (scalable) dots      (Attributes, Abilities, …)
 *   d10  ten plain dots                                     (pool ratings)
 *   d5   five plain dots                                    (Faith)
 *   b10  ten temporary-point boxes
 */
export function fillMarkup(code, val = 0) {
  const v = parseInt(val, 10) || 0;
  let html = '';
  if (code === 'b10') {
    for (let i = 1; i <= 10; i++) html += `<span class="square-box" data-idx="${i}"></span>`;
    return html;
  }
  const count = code === 'd5' ? 5 : 10;
  for (let i = 1; i <= count; i++) {
    const cls = ['dot'];
    if (code === 'd5s' && i > 5) cls.push('dot-scalable-10');
    if (code === 'd5s' && i <= v) cls.push('filled');
    html += `<span class="${cls.join(' ')}" data-idx="${i}"></span>`;
  }
  return html;
}

export function hydrateContainers(root = document) {
  root.querySelectorAll('[data-fill]').forEach(el => {
    el.innerHTML = fillMarkup(el.dataset.fill, el.dataset.val);
    el.removeAttribute('data-fill');
  });
}
