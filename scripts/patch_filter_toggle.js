const fs = require('fs');

let js = fs.readFileSync('public/script.js', 'utf8');
const isCrlf = js.includes('\r\n');
const lines = js.replace(/\r/g, '').split('\n');

const startIdx = lines.findIndex(l => l.includes('let isDesktopFilterExpanded = false;'));
const endIdx = lines.findIndex((l, idx) => idx > startIdx && l.startsWith('function restoreFiltersFromUrl()'));

if (startIdx === -1 || endIdx === -1) {
  console.error('ERROR: Could not find block indices in script.js', { startIdx, endIdx });
  process.exit(1);
}

const newToggleLines = [
  'let isCatalogFiltersOpen = false;',
  '',
  'function toggleCatalogFilters(forceState) {',
  '  isCatalogFiltersOpen = forceState !== undefined ? Boolean(forceState) : !isCatalogFiltersOpen;',
  '  const isOpen = isCatalogFiltersOpen;',
  '  ',
  '  const toggleBtn = $(\'openCatalogFilters\');',
  '  const btnArrow = $(\'openCatalogFiltersArrow\');',
  '  const headerArrow = $(\'catalogFilterArrow\');',
  '  const header = $(\'catalogFiltersHeader\');',
  '  const layout = document.querySelector(\'.catalog-layout\');',
  '  const form = $(\'catalogFilters\');',
  '  const body = $(\'catalogFiltersBody\');',
  '  const scrim = $(\'catalogFilterScrim\');',
  '',
  '  if (toggleBtn) {',
  '    toggleBtn.setAttribute(\'aria-expanded\', String(isOpen));',
  '    toggleBtn.classList.toggle(\'is-active\', isOpen);',
  '  }',
  '  if (btnArrow) {',
  '    btnArrow.className = `fa-solid ${isOpen ? \'fa-chevron-up\' : \'fa-chevron-down\'} filter-btn-arrow`;',
  '  }',
  '  if (headerArrow) {',
  '    headerArrow.className = `fa-solid ${isOpen ? \'fa-chevron-up\' : \'fa-chevron-down\'} filter-toggle-arrow`;',
  '  }',
  '  if (header) {',
  '    header.setAttribute(\'aria-expanded\', String(isOpen));',
  '  }',
  '  if (body) {',
  '    body.hidden = !isOpen;',
  '  }',
  '',
  '  if (window.innerWidth <= 760) {',
  '    document.body.classList.toggle(\'catalog-filters-open\', isOpen);',
  '    if (scrim) scrim.hidden = !isOpen;',
  '    if (isOpen) {',
  '      setScrollLock(true);',
  '    } else {',
  '      setScrollLock(false);',
  '      document.body.classList.remove(\'overlay-open\');',
  '      document.body.style.top = \'\';',
  '      document.body.style.position = \'\';',
  '      document.body.style.overflow = \'\';',
  '    }',
  '  } else {',
  '    if (layout) layout.classList.toggle(\'filters-expanded\', isOpen);',
  '    if (form) form.classList.toggle(\'is-expanded\', isOpen);',
  '    document.body.classList.remove(\'catalog-filters-open\');',
  '    document.body.classList.remove(\'overlay-open\');',
  '    if (scrim) scrim.hidden = true;',
  '  }',
  '}',
  '',
  'function setCatalogFiltersOpen(open) {',
  '  toggleCatalogFilters(Boolean(open));',
  '}',
  '',
  'function toggleDesktopCatalogFilter(forceState) {',
  '  toggleCatalogFilters(forceState);',
  '}',
  ''
];

lines.splice(startIdx, endIdx - startIdx, ...newToggleLines);

let updatedJs = lines.join(isCrlf ? '\r\n' : '\n');

// Replace openCatalogFilters event listener
const oldEventListener = "$('openCatalogFilters')?.addEventListener('click', () => setCatalogFiltersOpen(true));";
const newEventListener = "$('openCatalogFilters')?.addEventListener('click', (e) => { e.preventDefault(); toggleCatalogFilters(); });";

if (!updatedJs.includes(oldEventListener)) {
  console.error('ERROR: oldEventListener not found in script.js');
  process.exit(1);
}
updatedJs = updatedJs.replace(oldEventListener, newEventListener);

fs.writeFileSync('public/script.js', updatedJs, 'utf8');
console.log('4. Updated public/script.js successfully!');
