'use strict';
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'learned-aliases.json');

function load() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return {};
  }
}

let cache = load();

const key = (text) => String(text).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function lookup(text) {
  return cache[key(text)] || null;
}

/** Called whenever a user overrides a matched line. Three hits makes it durable. */
function record(text, sku) {
  const k = key(text);
  if (!k || !sku) return;
  const existing = cache[k];
  cache[k] = {
    sku,
    hits: existing && existing.sku === sku ? existing.hits + 1 : 1,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(FILE, JSON.stringify(cache, null, 2));
}

function all() {
  return cache;
}

function reset() {
  cache = {};
  fs.writeFileSync(FILE, '{}');
}

module.exports = { lookup, record, all, reset };
