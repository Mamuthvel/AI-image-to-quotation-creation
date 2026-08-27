'use strict';
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, 'data', 'catalog.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    sku TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    brand TEXT NOT NULL,
    category TEXT NOT NULL,
    uom TEXT NOT NULL DEFAULT 'Coil',
    list_price REAL NOT NULL,
    popularity INTEGER NOT NULL DEFAULT 50,
    attrs TEXT NOT NULL DEFAULT '{}'
  );
  CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);

  CREATE TABLE IF NOT EXISTS price_categories (
    code TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    discount_pct REAL NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS item_price_overrides (
    sku TEXT NOT NULL REFERENCES items(sku) ON DELETE CASCADE,
    category_code TEXT NOT NULL REFERENCES price_categories(code) ON DELETE CASCADE,
    discount_pct REAL,
    fixed_price REAL,
    PRIMARY KEY (sku, category_code)
  );

  -- A quotation has two identities on purpose:
  --   id         internal, stable, assigned on first save (draft or not)
  --   doc_number the customer-facing linear number (101, 102...), NULL until
  --              the quote is *issued* (printed/finalised). Minted exactly once
  --              from doc_counters inside a transaction, so it is unique and
  --              monotonic even when many people issue at the same instant, and
  --              never reused after a delete. UNIQUE enforces that at the DB level.
  CREATE TABLE IF NOT EXISTS quotations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL UNIQUE,
    doc_number INTEGER UNIQUE,
    status TEXT NOT NULL DEFAULT 'draft',
    customer TEXT NOT NULL DEFAULT 'QUOTATION',
    salesman TEXT NOT NULL DEFAULT 'DIRECT SMAN',
    price_category TEXT NOT NULL DEFAULT 'list',
    lines TEXT NOT NULL DEFAULT '[]',
    total REAL NOT NULL DEFAULT 0,
    round_off REAL NOT NULL DEFAULT 0,
    grand_total REAL NOT NULL DEFAULT 0,
    negotiated_total REAL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    issued_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_quotations_number ON quotations(doc_number);

  -- Named monotonic counters. next_value is the number the *next* issue takes.
  CREATE TABLE IF NOT EXISTS doc_counters (
    name TEXT PRIMARY KEY,
    next_value INTEGER NOT NULL
  );
`);

const categoryCount = db.prepare('SELECT COUNT(*) c FROM price_categories').get().c;
if (categoryCount === 0) {
  const insert = db.prepare(
    'INSERT INTO price_categories (code, label, discount_pct, sort_order) VALUES (?, ?, ?, ?)'
  );
  const defaults = [
    ['list', 'List Price', 0, 0],
    ['cost', 'Cost', 47, 1],
    ['sp', 'SP', 45, 2],
    ['ssp', 'SSP', 46, 3],
    ['sr', 'SR', 42, 4],
  ];
  const insertAll = db.transaction((rows) => rows.forEach((r) => insert.run(...r)));
  insertAll(defaults);
}

// One-time migration off the legacy quotations.json: import each old quote as an
// already-issued row (it had a number), then seed the counter past the highest
// number so continuity is preserved. Runs only when the table is still empty.
const quoteCount = db.prepare('SELECT COUNT(*) c FROM quotations').get().c;
if (quoteCount === 0) {
  const path = require('path');
  const fs = require('fs');
  const crypto = require('crypto');
  let legacy = [];
  try { legacy = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'quotations.json'), 'utf8')); } catch { /* none */ }

  const START = Number(process.env.QUOTE_NUMBER_START) || 6887; // used only if there is no history
  const insertQ = db.prepare(`
    INSERT INTO quotations (uuid, doc_number, status, customer, salesman, price_category,
      lines, total, round_off, grand_total, negotiated_total, created_at, updated_at, issued_at)
    VALUES (@uuid, @doc_number, 'issued', @customer, @salesman, @price_category,
      @lines, @total, @round_off, @grand_total, @negotiated_total, @created_at, @created_at, @created_at)
  `);
  const seed = db.transaction(() => {
    let max = START - 1;
    for (const q of legacy) {
      if (!Number.isFinite(q.number)) continue;
      max = Math.max(max, q.number);
      insertQ.run({
        uuid: crypto.randomUUID(),
        doc_number: q.number,
        customer: q.customer || 'QUOTATION',
        salesman: q.salesman || 'DIRECT SMAN',
        price_category: q.priceCategory || 'list',
        lines: JSON.stringify(q.lines || []),
        total: q.total || 0,
        round_off: q.roundOff || 0,
        grand_total: q.grandTotal || 0,
        negotiated_total: q.negotiatedTotal ?? null,
        created_at: q.createdAt || new Date().toISOString(),
      });
    }
    db.prepare('INSERT INTO doc_counters (name, next_value) VALUES (?, ?)').run('quotation', max + 1);
  });
  seed();
}

module.exports = db;
