'use strict';
const db = require('../db');
const aliases = require('../data/aliases.json');
const defaults = require('../data/defaults.json');
const { normalizeAttrs } = require('./catalog-normalize');

function parseRow(row) {
  return { ...row, attrs: JSON.parse(row.attrs || '{}') };
}

/**
 * The matcher holds a reference to this exact array, so every mutation below
 * uses in-place methods (push/splice/index-assign) rather than reassigning
 * `items` - a reassignment here would leave the matcher pointed at a stale copy.
 */
const items = db.prepare(
  'SELECT sku, name, brand, category, uom, list_price as listPrice, popularity, attrs FROM items ORDER BY name'
).all().map(parseRow);

const resort = () => items.sort((a, b) => a.name.localeCompare(b.name, 'en'));

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
    listPrice: o.listPrice != null ? Number(o.listPrice) : (o.rate != null ? Number(o.rate) : fallback.listPrice),
    attrs: normalizeAttrs(o.attrs && typeof o.attrs === 'object' && !Array.isArray(o.attrs) ? o.attrs : (fallback.attrs || {})),
    popularity: o.popularity != null ? Number(o.popularity) : (fallback.popularity == null ? 50 : fallback.popularity),
  };
}

function validate(item) {
  if (!item.sku) throw new Error('SKU is required.');
  if (!item.name || !item.brand || !item.category) throw new Error('Name, brand and category are required.');
  if (!Number.isFinite(item.listPrice) || item.listPrice < 0) throw new Error('List price must be a positive number.');
}

function addItem(o) {
  const item = normalize(o);
  validate(item);
  if (findIndex(item.sku) !== -1) throw new Error(`SKU "${item.sku}" already exists.`);
  db.prepare(
    'INSERT INTO items (sku, name, brand, category, uom, list_price, popularity, attrs) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(item.sku, item.name, item.brand, item.category, item.uom, item.listPrice, item.popularity, JSON.stringify(item.attrs));
  items.push(item);
  resort();
  return item;
}

function updateItem(sku, patch) {
  const idx = findIndex(sku);
  if (idx === -1) throw new Error(`SKU "${sku}" not found.`);
  const next = normalize(patch, items[idx]);
  validate(next);
  if (next.sku !== sku && findIndex(next.sku) !== -1) throw new Error(`SKU "${next.sku}" already exists.`);
  db.prepare(
    'UPDATE items SET sku = ?, name = ?, brand = ?, category = ?, uom = ?, list_price = ?, popularity = ?, attrs = ? WHERE sku = ?'
  ).run(next.sku, next.name, next.brand, next.category, next.uom, next.listPrice, next.popularity, JSON.stringify(next.attrs), sku);
  items[idx] = next;
  resort();
  return next;
}

function removeItem(sku) {
  const idx = findIndex(sku);
  if (idx === -1) throw new Error(`SKU "${sku}" not found.`);
  db.prepare('DELETE FROM items WHERE sku = ?').run(sku);
  const [removed] = items.splice(idx, 1);
  return removed;
}

/**
 * Startup catalogue lint. The matcher can only reach an item if a customer
 * phrase resolves to that item's category (aliases.categoryTerms) and the
 * category actually holds stock. When a new price list is imported, this is the
 * one thing that silently breaks. Rather than let it surface as a mystery
 * "no match", surface it loudly at boot as two lists:
 *   - unreachable categories: have stock, but no customer phrase routes to them
 *   - dead routes: a phrase routes here, but there's no stock and no fallback
 * Returns the report (also used by tests); logs a summary as a side effect.
 */
function validateCatalog(log = console) {
  const withStock = new Set(items.map((i) => i.category));
  const routed = new Set(Object.keys(aliases.categoryTerms || {}));
  const fallback = defaults.categoryFallback || {};

  const unreachable = [...withStock].filter((c) => !routed.has(c)).sort();
  const dead = [...routed]
    .filter((c) => !withStock.has(c) && !(fallback[c] && withStock.has(fallback[c])))
    .sort();
  const badFallback = Object.entries(fallback)
    .filter(([, target]) => !withStock.has(target))
    .map(([from, target]) => `${from} -> ${target}`);

  if (unreachable.length) {
    log.warn(`[catalog] ${unreachable.length} categor${unreachable.length === 1 ? 'y has' : 'ies have'} stock but no customer phrase routes to them (add aliases.categoryTerms): ${unreachable.join(', ')}`);
  }
  if (dead.length) {
    log.warn(`[catalog] ${dead.length} alias categor${dead.length === 1 ? 'y routes' : 'ies route'} to empty stock with no fallback (customers can ask, nothing matches): ${dead.join(', ')}`);
  }
  if (badFallback.length) {
    log.warn(`[catalog] categoryFallback points at empty categories: ${badFallback.join(', ')}`);
  }
  return { unreachable, dead, badFallback };
}

if (require.main !== module && process.env.NODE_ENV !== 'test') validateCatalog();

module.exports = { items, addItem, updateItem, removeItem, validateCatalog };
