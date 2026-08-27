'use strict';
const db = require('../db');

const round2 = (n) => Math.round(n * 100) / 100;

function listCategories() {
  return db.prepare(
    'SELECT code, label, discount_pct as discountPct FROM price_categories ORDER BY sort_order'
  ).all();
}

function setCategoryDiscount(code, discountPct) {
  if (code === 'list') throw new Error('List price has no discount to set.');
  const pct = Number(discountPct);
  if (!Number.isFinite(pct) || pct < 0 || pct >= 100) throw new Error('Discount must be a percentage between 0 and 100.');
  const info = db.prepare('UPDATE price_categories SET discount_pct = ? WHERE code = ?').run(pct, code);
  if (info.changes === 0) throw new Error(`Unknown price category "${code}".`);
}

function overridesBySku(sku) {
  const rows = db.prepare(
    'SELECT category_code as categoryCode, discount_pct as discountPct, fixed_price as fixedPrice FROM item_price_overrides WHERE sku = ?'
  ).all(sku);
  const map = {};
  for (const r of rows) map[r.categoryCode] = { discountPct: r.discountPct, fixedPrice: r.fixedPrice };
  return map;
}

function setOverride(sku, categoryCode, { discountPct, fixedPrice }) {
  if (categoryCode === 'list') throw new Error('List price cannot be overridden — edit the item\'s list price instead.');
  const cat = db.prepare('SELECT code FROM price_categories WHERE code = ?').get(categoryCode);
  if (!cat) throw new Error(`Unknown price category "${categoryCode}".`);
  const item = db.prepare('SELECT sku FROM items WHERE sku = ?').get(sku);
  if (!item) throw new Error(`SKU "${sku}" not found.`);
  db.prepare(`
    INSERT INTO item_price_overrides (sku, category_code, discount_pct, fixed_price)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(sku, category_code) DO UPDATE SET discount_pct = excluded.discount_pct, fixed_price = excluded.fixed_price
  `).run(sku, categoryCode, discountPct == null ? null : Number(discountPct), fixedPrice == null ? null : Number(fixedPrice));
}

function clearOverride(sku, categoryCode) {
  db.prepare('DELETE FROM item_price_overrides WHERE sku = ? AND category_code = ?').run(sku, categoryCode);
}

/** discountPct/fixedPrice for one category, item-level override winning over the global default. */
function rateFor(listPrice, categoryCode, categories, overrides) {
  if (categoryCode === 'list') return round2(listPrice);
  const ov = overrides[categoryCode];
  if (ov && ov.fixedPrice != null) return round2(ov.fixedPrice);
  const pct = ov && ov.discountPct != null ? ov.discountPct : categories[categoryCode];
  if (pct == null) throw new Error(`Unknown price category "${categoryCode}".`);
  return round2(listPrice * (1 - pct / 100));
}

/** Attaches { listPrice, rates: {list, cost, sp, ssp, sr, ...} } to an item for API responses. */
function decorate(item) {
  const categories = listCategories();
  const pctByCode = {};
  for (const c of categories) pctByCode[c.code] = c.discountPct;
  const overrides = overridesBySku(item.sku);
  const rates = {};
  for (const c of categories) rates[c.code] = rateFor(item.listPrice, c.code, pctByCode, overrides);
  return { ...item, rates, overrides };
}

function rateForCategory(item, categoryCode) {
  const categories = listCategories();
  const pctByCode = {};
  for (const c of categories) pctByCode[c.code] = c.discountPct;
  const overrides = overridesBySku(item.sku);
  return rateFor(item.listPrice, categoryCode, pctByCode, overrides);
}

module.exports = {
  listCategories, setCategoryDiscount, overridesBySku, setOverride, clearOverride, decorate, rateForCategory,
};
