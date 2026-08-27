'use strict';
const crypto = require('crypto');
const db = require('../db');

/**
 * Quotation persistence with two-stage identity:
 *   save  -> a draft row with a stable internal id (and uuid), no doc_number
 *   issue -> mints the customer-facing linear number exactly once, atomically
 *
 * The number is minted inside a single SQLite transaction that reads and bumps
 * doc_counters. SQLite takes a write lock for the transaction, so concurrent
 * issues - even from separate processes - are serialised: every one gets a
 * distinct, increasing number, and the UNIQUE constraint on doc_number is a
 * hard backstop against duplicates. Numbers are never reused after a delete.
 */

function parse(row) {
  if (!row) return null;
  return {
    id: row.id,
    uuid: row.uuid,
    docNumber: row.doc_number,
    status: row.status,
    customer: row.customer,
    salesman: row.salesman,
    priceCategory: row.price_category,
    lines: JSON.parse(row.lines || '[]'),
    total: row.total,
    roundOff: row.round_off,
    grandTotal: row.grand_total,
    negotiatedTotal: row.negotiated_total,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    issuedAt: row.issued_at,
  };
}

const byId = db.prepare('SELECT * FROM quotations WHERE id = ?');
const byUuid = db.prepare('SELECT * FROM quotations WHERE uuid = ?');

function get(id) { return parse(byId.get(id)); }
function getByUuid(uuid) { return parse(byUuid.get(uuid)); }

function list(limit = 200) {
  return db.prepare('SELECT * FROM quotations ORDER BY id DESC LIMIT ?').all(limit).map(parse);
}

function fields(body) {
  return {
    customer: body.customer || 'QUOTATION',
    salesman: body.salesman || 'DIRECT SMAN',
    price_category: body.priceCategory || 'list',
    lines: JSON.stringify(body.lines || []),
    total: Number(body.total) || 0,
    round_off: Number(body.roundOff) || 0,
    grand_total: Number(body.grandTotal) || 0,
    negotiated_total: body.negotiatedTotal == null ? null : Number(body.negotiatedTotal),
  };
}

/** Save: create a fresh draft. Returns the stored quotation (no number yet). */
function createDraft(body) {
  const now = new Date().toISOString();
  const f = fields(body);
  const info = db.prepare(`
    INSERT INTO quotations (uuid, status, customer, salesman, price_category,
      lines, total, round_off, grand_total, negotiated_total, created_at, updated_at)
    VALUES (@uuid, 'draft', @customer, @salesman, @price_category,
      @lines, @total, @round_off, @grand_total, @negotiated_total, @now, @now)
  `).run({ uuid: crypto.randomUUID(), ...f, now });
  return get(info.lastInsertRowid);
}

/**
 * Save on an existing quote. A draft is updated in place. An already-issued
 * quote keeps its number and issued content immutable - edits after issue must
 * be a new quotation, so this refuses rather than silently rewriting a document
 * a customer may already hold.
 */
function updateDraft(id, body) {
  const existing = get(id);
  if (!existing) throw new Error(`Quotation ${id} not found.`);
  if (existing.status === 'issued') throw new Error(`Quotation ${existing.docNumber} is already issued and cannot be edited.`);
  const f = fields(body);
  db.prepare(`
    UPDATE quotations SET customer=@customer, salesman=@salesman, price_category=@price_category,
      lines=@lines, total=@total, round_off=@round_off, grand_total=@grand_total,
      negotiated_total=@negotiated_total, updated_at=@now
    WHERE id=@id
  `).run({ id, ...f, now: new Date().toISOString() });
  return get(id);
}

/**
 * Issue (finalise/print). Mints the linear number once and is idempotent: a
 * second call on an already-issued quote returns it unchanged (a reprint is the
 * same number, never a new one).
 */
const issueTxn = db.transaction((id) => {
  const row = byId.get(id);
  if (!row) throw new Error(`Quotation ${id} not found.`);
  if (row.doc_number != null) return row; // already issued -> reprint

  const counter = db.prepare("SELECT next_value FROM doc_counters WHERE name = 'quotation'").get();
  const number = counter ? counter.next_value : (Number(process.env.QUOTE_NUMBER_START) || 6887);
  db.prepare("UPDATE doc_counters SET next_value = next_value + 1 WHERE name = 'quotation'").run();
  if (!counter) db.prepare('INSERT INTO doc_counters (name, next_value) VALUES (?, ?)').run('quotation', number + 1);

  const now = new Date().toISOString();
  db.prepare("UPDATE quotations SET doc_number = ?, status = 'issued', issued_at = ?, updated_at = ? WHERE id = ?")
    .run(number, now, now, id);
  return byId.get(id);
});

function issue(id) { return parse(issueTxn(id)); }

module.exports = { get, getByUuid, list, createDraft, updateDraft, issue };
