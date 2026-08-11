/* Limras Item Master — add / edit / delete the catalogue. */
'use strict';

const $ = (id) => document.getElementById(id);
const money = (n) => Number(n || 0).toFixed(2);

let items = [];
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
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td class="sku">${item.sku}</td>
    <td>${item.name}</td>
    <td>${item.brand}</td>
    <td>${item.category}</td>
    <td>${item.uom}</td>
    <td class="num rate">${money(item.rate)}</td>
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
  $('f-rate').value = item ? item.rate : '';
  $('f-popularity').value = item ? item.popularity : 50;
  $('f-attrs').value = item ? JSON.stringify(item.attrs || {}, null, 2) : '{}';
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
    rate: Number($('f-rate').value),
    popularity: Number($('f-popularity').value) || 0,
    attrs,
  };

  try {
    if (editingSku) await api('PUT', `/api/items/${encodeURIComponent(editingSku)}`, payload);
    else await api('POST', '/api/items', payload);
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

/* ───────────────────────────────────────────── wiring */

$('search').addEventListener('input', render);
$('btnAdd').addEventListener('click', () => openForm(null));
$('formClose').addEventListener('click', closeForm);
$('formCancel').addEventListener('click', closeForm);
$('itemModal').addEventListener('click', (e) => { if (e.target === $('itemModal')) closeForm(); });
$('itemForm').addEventListener('submit', submitForm);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('itemModal').hidden) closeForm();
});

loadItems().catch((err) => {
  $('countPill').textContent = err.message;
});
