/* Limras Item Master — add / edit / delete the catalogue, plus pricing. */
'use strict';

const $ = (id) => document.getElementById(id);
const money = (n) => Number(n || 0).toFixed(2);

let items = [];
let priceCategories = [];
let editingSku = null;

async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

/* ───────────────────────────────────────────── global price categories */

async function loadPriceCategories() {
  priceCategories = await api('GET', '/api/price-categories');
  renderPriceCatPanel();
}

function renderPriceCatPanel() {
  const el = $('priceCatRows');
  el.innerHTML = priceCategories.map((c) => `
    <div class="price-cat-row${c.code === 'list' ? ' locked' : ''}">
      <label>${c.label}</label>
      <div class="pct-input">
        <input type="number" step="0.1" min="0" max="99.9" value="${c.discountPct}"
          data-code="${c.code}" ${c.code === 'list' ? 'disabled' : ''} />
        <span>% off</span>
      </div>
    </div>`).join('');

  el.querySelectorAll('input[data-code]').forEach((input) => {
    input.addEventListener('change', async (e) => {
      const code = e.target.dataset.code;
      try {
        priceCategories = await api('PUT', `/api/price-categories/${encodeURIComponent(code)}`, { discountPct: Number(e.target.value) });
        await loadItems();
      } catch (err) {
        alert(err.message);
        renderPriceCatPanel();
      }
    });
  });
}

/* ───────────────────────────────────────────── item grid */

async function loadItems() {
  items = await api('GET', '/api/items?limit=100000');
  $('countPill').textContent = `${items.length} items`;
  $('countPill').className = 'pill pill-live';
  fillDatalists();
  render();
}

function fillDatalists() {
  const brands = [...new Set(items.map((i) => i.brand))].sort();
  const cats = [...new Set(items.map((i) => i.category))].sort();
  $('brandList').innerHTML = brands.map((b) => `<option value="${b}">`).join('');
  $('categoryList').innerHTML = cats.map((c) => `<option value="${c}">`).join('');
}

function matches(item, q) {
  if (!q) return true;
  const hay = `${item.sku} ${item.name} ${item.brand} ${item.category}`.toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((t) => hay.includes(t));
}

function render() {
  const q = $('search').value;
  const rows = items.filter((i) => matches(i, q));
  const tbody = $('itemRows');
  tbody.innerHTML = '';
  $('emptyMsg').hidden = rows.length > 0;
  for (const item of rows) tbody.appendChild(rowEl(item));
}

function rowEl(item) {
  const r = item.rates || {};
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td class="sku">${item.sku}</td>
    <td>${item.name}</td>
    <td>${item.brand}</td>
    <td>${item.category}</td>
    <td>${item.uom}</td>
    <td class="num rate">${money(item.listPrice)}</td>
    <td class="num rate">${money(r.cost)}</td>
    <td class="num rate">${money(r.sp)}</td>
    <td class="num rate">${money(r.ssp)}</td>
    <td class="num rate">${money(r.sr)}</td>
    <td class="num pop">${item.popularity}</td>
    <td>
      <div class="admin-row-actions">
        <button type="button" class="edit">Edit</button>
        <button type="button" class="del">Delete</button>
      </div>
    </td>
  `;
  tr.querySelector('.edit').addEventListener('click', () => openForm(item));
  tr.querySelector('.del').addEventListener('click', () => removeItem(item));
  return tr;
}

/* ───────────────────────────────────────────── form */

function overrideCategories() {
  return priceCategories.filter((c) => c.code !== 'list');
}

function renderOverrideRows(item) {
  const overrides = (item && item.overrides) || {};
  $('overrideRows').innerHTML = overrideCategories().map((c) => {
    const ov = overrides[c.code];
    const value = ov && ov.discountPct != null ? ov.discountPct : '';
    return `
      <div class="price-cat-row">
        <label>${c.label} <span class="hint">(global ${c.discountPct}%)</span></label>
        <div class="pct-input">
          <input type="number" step="0.1" min="0" max="99.9" placeholder="${c.discountPct}"
            data-override-code="${c.code}" value="${value}" />
          <span>% off</span>
        </div>
      </div>`;
  }).join('');
}

function openForm(item) {
  editingSku = item ? item.sku : null;
  $('formTitle').textContent = item ? `Edit ${item.sku}` : 'Add item';
  $('formError').hidden = true;
  $('f-sku').value = item ? item.sku : '';
  $('f-sku').disabled = !!item;
  $('f-name').value = item ? item.name : '';
  $('f-brand').value = item ? item.brand : '';
  $('f-category').value = item ? item.category : '';
  $('f-uom').value = item ? item.uom : 'Nos';
  $('f-rate').value = item ? item.listPrice : '';
  $('f-popularity').value = item ? item.popularity : 50;
  $('f-attrs').value = item ? JSON.stringify(item.attrs || {}, null, 2) : '{}';
  $('overridePanel').hidden = !item;
  if (item) renderOverrideRows(item);
  $('itemModal').hidden = false;
  $('f-sku').disabled ? $('f-name').focus() : $('f-sku').focus();
}

function closeForm() {
  $('itemModal').hidden = true;
  editingSku = null;
}

async function submitForm(e) {
  e.preventDefault();
  $('formError').hidden = true;

  let attrs;
  try {
    attrs = JSON.parse($('f-attrs').value || '{}');
  } catch {
    $('formError').textContent = 'Attributes must be valid JSON, e.g. {"sizeInch": 0.75}';
    $('formError').hidden = false;
    return;
  }

  const payload = {
    sku: $('f-sku').value.trim(),
    name: $('f-name').value.trim(),
    brand: $('f-brand').value.trim(),
    category: $('f-category').value.trim(),
    uom: $('f-uom').value.trim() || 'Nos',
    listPrice: Number($('f-rate').value),
    popularity: Number($('f-popularity').value) || 0,
    attrs,
  };

  try {
    const sku = editingSku || payload.sku;
    if (editingSku) await api('PUT', `/api/items/${encodeURIComponent(editingSku)}`, payload);
    else await api('POST', '/api/items', payload);

    if (editingSku) {
      const overrideInputs = document.querySelectorAll('#overrideRows input[data-override-code]');
      for (const input of overrideInputs) {
        const code = input.dataset.overrideCode;
        const raw = input.value.trim();
        if (raw === '') await api('DELETE', `/api/items/${encodeURIComponent(sku)}/overrides/${encodeURIComponent(code)}`);
        else await api('PUT', `/api/items/${encodeURIComponent(sku)}/overrides/${encodeURIComponent(code)}`, { discountPct: Number(raw) });
      }
    }

    closeForm();
    await loadItems();
  } catch (err) {
    $('formError').textContent = err.message;
    $('formError').hidden = false;
  }
}

async function removeItem(item) {
  if (!confirm(`Delete "${item.name}" (${item.sku})? This can't be undone.`)) return;
  try {
    await api('DELETE', `/api/items/${encodeURIComponent(item.sku)}`);
    await loadItems();
  } catch (err) {
    alert(err.message);
  }
}

/* ───────────────────────────────────────────── user info & logout */

const user = auth.getUser();
$('userBadge').textContent = `👤 ${user.username}`;
$('btnLogout').addEventListener('click', () => {
  auth.logout();
  window.location.href = '/login.html';
});

/* ───────────────────────────────────────────── export / import */

async function exportCatalog() {
  try {
    const resp = await fetch('/api/catalog/export/csv');
    if (!resp.ok) throw new Error(`Export failed: ${resp.statusText}`);
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `catalog-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    alert(`Failed to export: ${err.message}`);
  }
}

async function importCatalog() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.csv';
  input.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const lines = text.trim().split('\n').map((l) => l.split(','));
      if (lines.length < 2) throw new Error('CSV must have header + at least 1 item');
      const header = lines[0];
      const skuIdx = header.indexOf('SKU');
      const nameIdx = header.indexOf('Name');
      const brandIdx = header.indexOf('Brand');
      const catIdx = header.indexOf('Category');
      const uomIdx = header.indexOf('UOM');
      const priceIdx = header.indexOf('List Price');
      const attrsIdx = header.indexOf('Attributes (JSON)');

      if (skuIdx === -1 || nameIdx === -1 || brandIdx === -1 || catIdx === -1 || priceIdx === -1) {
        throw new Error('CSV missing required columns: SKU, Name, Brand, Category, List Price');
      }

      let imported = 0;
      let failed = 0;
      const errors = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (line.length < 2 || !line[skuIdx]?.trim()) continue;

        try {
          const attrs = attrsIdx !== -1 && line[attrsIdx]?.trim() ? JSON.parse(line[attrsIdx]) : {};
          const item = {
            sku: line[skuIdx]?.trim(),
            name: line[nameIdx]?.trim(),
            brand: line[brandIdx]?.trim(),
            category: line[catIdx]?.trim(),
            uom: line[uomIdx]?.trim() || 'Nos',
            listPrice: parseFloat(line[priceIdx]) || 0,
            attrs,
          };
          await api('POST', '/api/items', item);
          imported++;
        } catch (err) {
          failed++;
          errors.push(`Row ${i + 1}: ${err.message}`);
        }
      }

      alert(`Imported ${imported} items${failed ? `, ${failed} failed` : ''}${errors.length ? '\n\nErrors:\n' + errors.slice(0, 5).join('\n') : ''}`);
      if (imported > 0) await loadItems();
    } catch (err) {
      alert(`Failed to import: ${err.message}`);
    }
  });
  input.click();
}

/* ───────────────────────────────────────────── wiring */

$('search').addEventListener('input', render);
$('btnAdd').addEventListener('click', () => openForm(null));
$('btnExportCatalog').addEventListener('click', exportCatalog);
$('btnImportCatalog').addEventListener('click', importCatalog);
$('formClose').addEventListener('click', closeForm);
$('formCancel').addEventListener('click', closeForm);
$('itemModal').addEventListener('click', (e) => { if (e.target === $('itemModal')) closeForm(); });
$('itemForm').addEventListener('submit', submitForm);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('itemModal').hidden) closeForm();
});

Promise.all([loadPriceCategories(), loadItems()]).catch((err) => {
  $('countPill').textContent = err.message;
});
