import { buildCells, ingredients, references } from './grid.js';

const view = document.getElementById('view');
const countEl = document.getElementById('count');
const searchRow = document.getElementById('searchRow');
const searchInput = document.getElementById('q');

let archive = [];
let current = null;

const esc = (s) =>
  String(s ?? '').replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const byId = (id) => archive.find((r) => r.id === id);

/* ---------------- rendering ---------------- */

function ingredientHtml(leaf, rowOf) {
  const amounts = [leaf.us, leaf.metric].filter(Boolean);
  const quantity = amounts.length === 2 ? `${amounts[0]} (${amounts[1]})` : amounts[0] || '';
  const linked = leaf.ref && byId(leaf.ref);
  const name = linked
    ? `<a class="reflink" data-ref="${esc(leaf.ref)}" href="#${esc(leaf.ref)}">${esc(leaf.item)}</a>`
    : esc(leaf.item);

  let derived = '';
  if (leaf.derivedFrom && rowOf[leaf.derivedFrom] !== undefined) {
    const label = leaf.derivedLabel || `from ${leaf.derivedFrom}`;
    derived = `<span class="derived" data-src="${rowOf[leaf.derivedFrom]}">↳ ${esc(label)}</span>`;
  }

  return (quantity ? `<span class="qty">${esc(quantity)}</span> ` : '') + name + derived;
}

function renderGrid(recipe) {
  const { cells, rows, totalCols } = buildCells(recipe.tree);

  const rowOf = {};
  cells.forEach((c) => { if (c.kind === 'ingredient') rowOf[c.node.item] = c.row; });

  const notes = [];
  const marker = (node) => {
    if (!node.note) return '';
    notes.push(node.note);
    return `<sup class="fn">${notes.length}</sup>`;
  };

  const byRow = Array.from({ length: rows }, () => []);
  cells.forEach((c) => byRow[c.row].push(c));
  byRow.forEach((r) => r.sort((a, b) => a.col - b.col));

  let html = '<div class="gridwrap"><table class="grid"><tbody>';

  (recipe.prep || []).forEach((step) => {
    html += `<tr><td class="prep" colspan="${totalCols}">${esc(step)}</td></tr>`;
  });

  byRow.forEach((row, i) => {
    html += `<tr data-leaf="${i}">`;
    row.forEach((c) => {
      const span =
        (c.rowspan > 1 ? ` rowspan="${c.rowspan}"` : '') +
        (c.colspan > 1 ? ` colspan="${c.colspan}"` : '');
      if (c.kind === 'ingredient') {
        html += `<td class="ing"${span}>${ingredientHtml(c.node, rowOf)}${marker(c.node)}</td>`;
      } else if (c.kind === 'blank') {
        html += `<td class="blank"${span}></td>`;
      } else {
        const detail = c.node.detail ? `<span class="detail">${esc(c.node.detail)}</span>` : '';
        html +=
          `<td class="op"${span} data-from="${c.from}" data-to="${c.to}">` +
          `<span class="verb">${esc(c.node.op)}${marker(c.node)}</span>${detail}</td>`;
      }
    });
    html += '</tr>';
  });

  html += '</tbody></table></div>';
  html += '<p class="hint">Tap a step to trace what goes into it.</p>';

  if (notes.length) {
    html += '<ul class="notes">' +
      notes.map((n, i) => `<li><span class="n">${i + 1}</span><span>${esc(n)}</span></li>`).join('') +
      '</ul>';
  }
  return html;
}

function renderDetail(recipe) {
  const meta = [];
  if (recipe.yield) meta.push(`<span><b>Makes</b> ${esc(recipe.yield)}</span>`);
  if (recipe.timeActive) meta.push(`<span><b>Active</b> ${esc(recipe.timeActive)}</span>`);
  if (recipe.timeTotal) meta.push(`<span><b>Total</b> ${esc(recipe.timeTotal)}</span>`);
  if (recipe.source) {
    meta.push(recipe.url
      ? `<span><b>Source</b> <a href="${esc(recipe.url)}" target="_blank" rel="noopener">${esc(recipe.source)}</a></span>`
      : `<span><b>Source</b> ${esc(recipe.source)}</span>`);
  }

  const usedIn = archive.filter((r) => references(r).includes(recipe.id));
  const backlinks = usedIn.length
    ? `<div class="usedin"><b>Used in</b>${usedIn
        .map((r) => `<a class="reflink" data-ref="${esc(r.id)}" href="#${esc(r.id)}">${esc(r.title)}</a>`)
        .join(', ')}</div>`
    : '';

  return `<button class="back" id="back">← All recipes</button>
    <h2 class="rtitle">${esc(recipe.title)}</h2>
    <div class="rmeta">${meta.join('')}</div>
    ${renderGrid(recipe)}
    ${backlinks}
    ${(recipe.tags || []).length
      ? `<div class="chips detail-foot">${recipe.tags.map((t) => `<span class="chip">${esc(t)}</span>`).join('')}</div>`
      : ''}`;
}

function card(recipe) {
  const bits = [recipe.yield, recipe.timeTotal].filter(Boolean).join(' · ');
  return `<a class="card" href="#${esc(recipe.id)}" data-id="${esc(recipe.id)}">
    <h2>${esc(recipe.title)}</h2>
    ${(recipe.tags || []).length
      ? `<div class="chips">${recipe.tags.slice(0, 3).map((t) => `<span class="chip">${esc(t)}</span>`).join('')}</div>`
      : ''}
    <div class="meta">${esc(bits)}${bits && recipe.source ? ' · ' : ''}${esc(recipe.source || '')}</div>
  </a>`;
}

function searchText(recipe) {
  return [
    recipe.title,
    recipe.source,
    (recipe.tags || []).join(' '),
    ingredients(recipe).map((i) => i.item).join(' '),
  ].join(' ').toLowerCase();
}

function renderIndex(query) {
  const q = (query || '').trim().toLowerCase();
  const hits = archive.filter((r) => !q || searchText(r).includes(q));

  if (!hits.length) {
    return `<div class="empty"><strong>Nothing matches “${esc(query)}”</strong>
      Search by title, ingredient, tag, source or class.</div>`;
  }

  const dishes = hits.filter((r) => !r.component);
  const parts = hits.filter((r) => r.component);
  let html = '';
  if (dishes.length) {
    if (parts.length) html += '<div class="section-label">Recipes</div>';
    html += `<div class="cards">${dishes.map(card).join('')}</div>`;
  }
  if (parts.length) {
    html += '<div class="section-label">Components</div>';
    html += `<div class="cards">${parts.map(card).join('')}</div>`;
  }
  return html;
}

/* ---------------- interaction ---------------- */

function wireGrid() {
  const canHover = window.matchMedia('(hover: hover)').matches;
  const clear = () => view.querySelectorAll('.lit').forEach((el) => el.classList.remove('lit'));
  const light = (td, on) => {
    td.classList.toggle('lit', on);
    for (let i = +td.dataset.from; i <= +td.dataset.to; i += 1) {
      view.querySelector(`tr[data-leaf="${i}"]`)?.classList.toggle('lit', on);
    }
  };

  let pinned = null;
  view.querySelectorAll('td.op').forEach((td) => {
    td.onclick = (e) => {
      e.stopPropagation();
      const same = pinned === td;
      clear();
      pinned = null;
      if (!same) { light(td, true); pinned = td; }
    };
    if (canHover) {
      td.onmouseenter = () => { if (!pinned) light(td, true); };
      td.onmouseleave = () => { if (!pinned) light(td, false); };
    }
  });

  view.querySelector('.gridwrap')?.addEventListener('click', () => { clear(); pinned = null; });

  view.querySelectorAll('.derived').forEach((el) => {
    el.onclick = (e) => {
      e.stopPropagation();
      view.querySelectorAll('tr.src').forEach((tr) => tr.classList.remove('src'));
      const tr = view.querySelector(`tr[data-leaf="${el.dataset.src}"]`);
      if (tr) {
        tr.classList.add('src');
        tr.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    };
  });
}

function paint() {
  countEl.textContent = archive.length ? `${archive.length} recipes` : '';

  if (current) {
    searchRow.hidden = true;
    view.innerHTML = renderDetail(current);
    document.getElementById('back').onclick = () => { window.location.hash = ''; };
    wireGrid();
  } else {
    searchRow.hidden = false;
    view.innerHTML = renderIndex(searchInput.value);
  }
}

function route() {
  const id = decodeURIComponent(window.location.hash.replace(/^#/, ''));
  current = id ? byId(id) || null : null;
  paint();
  window.scrollTo({ top: 0 });
}

searchInput.addEventListener('input', () => { if (!current) paint(); });
window.addEventListener('hashchange', route);

/* ---------------- boot ---------------- */

(async function init() {
  try {
    const res = await fetch('recipes.json');
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    archive = data.recipes || [];
  } catch (err) {
    view.innerHTML = `<div class="empty"><strong>Couldn't load recipes.json</strong>
      Browsers block file reads from <code>file://</code>. Serve the folder instead —
      <code>python3 -m http.server</code> — and open the address it prints.</div>`;
    return;
  }
  route();
})();
