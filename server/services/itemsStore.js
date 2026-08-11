'use strict';
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'items.json');

/**
 * The matcher holds a reference to this exact array, so every mutation below
 * uses in-place methods (push/splice/index-assign) rather than reassigning
 * `items` - a reassignment here would leave the matcher pointed at a stale copy.
 */
const items = JSON.parse(fs.readFileSync(FILE, 'utf8'));

function save() {
  items.sort((a, b) => a.name.localeCompare(b.name, 'en'));
  fs.writeFileSync(FILE, JSON.stringify(items, null, 2));
}

function findIndex(sku) {
  return items.findIndex((i) => i.sku === sku);
}

function normalize(o, fallback = {}) {
  return {
    sku: (o.sku != null ? String(o.sku) : fallback.sku || '').trim(),
    name: (o.name != null ? String(o.name) : fallback.name || '').trim(),
    brand: (o.brand != null ? String(o.brand) : fallback.brand || '').trim().toUpperCase(),
    category: (o.category != null ? String(o.category) : fallback.category || '').trim().toUpperCase().replace(/\s+/g, '_'),
    uom: (o.uom != null ? String(o.uom) : fallback.uom || 'Nos').trim() || 'Nos',
    rate: o.rate != null ? Number(o.rate) : fallback.rate,
    attrs: o.attrs && typeof o.attrs === 'object' && !Array.isArray(o.attrs) ? o.attrs : (fallback.attrs || {}),
    popularity: o.popularity != null ? Number(o.popularity) : (fallback.popularity == null ? 50 : fallback.popularity),
  };
}

function addItem(o) {
  const item = normalize(o);
  if (!item.sku) throw new Error('SKU is required.');
  if (!item.name || !item.brand || !item.category) throw new Error('Name, brand and category are required.');
  if (!Number.isFinite(item.rate) || item.rate < 0) throw new Error('Rate must be a positive number.');
  if (findIndex(item.sku) !== -1) throw new Error(`SKU "${item.sku}" already exists.`);
  items.push(item);
  save();
  return item;
}

function updateItem(sku, patch) {
  const idx = findIndex(sku);
  if (idx === -1) throw new Error(`SKU "${sku}" not found.`);
  const next = normalize(patch, items[idx]);
  if (!next.sku) throw new Error('SKU is required.');
  if (!next.name || !next.brand || !next.category) throw new Error('Name, brand and category are required.');
  if (!Number.isFinite(next.rate) || next.rate < 0) throw new Error('Rate must be a positive number.');
  if (next.sku !== sku && findIndex(next.sku) !== -1) throw new Error(`SKU "${next.sku}" already exists.`);
  items[idx] = next;
  save();
  return next;
}

function removeItem(sku) {
  const idx = findIndex(sku);
  if (idx === -1) throw new Error(`SKU "${sku}" not found.`);
  const [removed] = items.splice(idx, 1);
  save();
  return removed;
}

module.exports = { items, addItem, updateItem, removeItem };
