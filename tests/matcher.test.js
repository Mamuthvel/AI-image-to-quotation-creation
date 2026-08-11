'use strict';
const test = require('node:test');
const assert = require('node:assert');

const { matchRawLines, matchExtractedLines, searchItems, items } = require('../server/services/matcher');
const { foldFractions, expandDittos, applySpelling } = require('../server/services/normalize');
const { extractSpec } = require('../server/services/attributes');
const sample = require('../server/data/sample-sheet.json');

const one = (text) => matchRawLines([text])[0];

test('item master is alphabetical and large enough', () => {
  assert.ok(items.length >= 200, `expected 200+ items, got ${items.length}`);
  const names = items.map((i) => i.name);
  assert.deepStrictEqual(names, [...names].sort((a, b) => a.localeCompare(b, 'en')));
});

test('gang box sizes are all distinct SKUs', () => {
  const boxes = items.filter((i) => i.category === 'GANG_BOX' && i.brand === 'MUSK');
  assert.ok(boxes.length >= 4);
  const mods = new Set(boxes.map((b) => b.attrs.modules));
  assert.strictEqual(mods.size, boxes.length);
});

test('unicode fractions fold to decimals', () => {
  assert.strictEqual(foldFractions('3½" round sheet'), '3.5" round sheet');
  assert.strictEqual(foldFractions('5 1/2 inch'), '5.5 inch');
});

test('a quote after a digit is an inch mark, a lone quote is a ditto', () => {
  const out = expandDittos(['19x6 star screw', '25x6 "', '35x6 "']);
  assert.match(out[1].text, /star screw/);
  assert.match(out[2].text, /star screw/);
  const inch = expandDittos(['3/4" pvc bend']);
  assert.match(inch[0].text, /3\/4"/);
});

test('phonetic spellings are repaired before phrase matching', () => {
  assert.match(applySpelling('4x4 Gm whit shet'), /cover plate/);
  assert.match(applySpelling('Switan domy'), /switch dome/);
  assert.match(applySpelling('Sai older'), /batten holder/);
});

test('attributes come out of free text', () => {
  const a = extractSpec('20 amp 1way switch with indicater');
  assert.strictEqual(a.category, 'SWITCH');
  assert.strictEqual(a.spec.amps, 20);
  assert.strictEqual(a.spec.indicator, true);

  const b = extractSpec('3/4" pvc 1.5 bend');
  assert.strictEqual(b.spec.sizeInch, 0.75);

  const c = extractSpec('hills 2.5 sqmm wire coil');
  assert.strictEqual(c.brand, 'HILLS');
  assert.strictEqual(c.spec.coreSqmm, 2.5);
});

test('an omitted brand resolves to the shop default and says so', () => {
  const l = one('6 amps switch 78');
  assert.strictEqual(l.item.brand, 'E-CLASS');
  assert.strictEqual(l.qty, 78);
  assert.ok(['assumed', 'confirmed'].includes(l.state));
});

test('an explicit brand overrides the default', () => {
  const l = one('polycab 2.5 sqmm wire 2');
  assert.strictEqual(l.item.brand, 'POLYCAB');
  assert.strictEqual(l.item.attrs.coreSqmm, 2.5);
});

test('a size the master does not stock returns no match rather than a wrong one', () => {
  const l = one('99 amp switch 2');
  assert.strictEqual(l.state, 'unmatched');
  assert.strictEqual(l.item, null);
});

test('summed quantities are totalled and the expression is kept', () => {
  const l = one('ceiling rose 1+1+4+2');
  assert.strictEqual(l.qty, 8);
  assert.strictEqual(l.qtyExpression, '1+1+4+2');
});

test('a stated total that disagrees with the sum is flagged', () => {
  const [l] = matchExtractedLines([
    { raw: '3.5" round sheet', qty_expression: '3+2+1+3+1+2', qty: 12, stated_qty: 13 },
  ]);
  assert.ok(l.qtyConflict);
  assert.strictEqual(l.qtyConflict.computed, 12);
  assert.strictEqual(l.qtyConflict.stated, 13);
  assert.notStrictEqual(l.state, 'confirmed');
});

test('every line of the real customer sheet resolves to an item', () => {
  const out = matchExtractedLines(sample.lines);
  assert.strictEqual(out.length, 20);
  const unmatched = out.filter((l) => !l.item);
  assert.strictEqual(unmatched.length, 0,
    `unmatched: ${unmatched.map((l) => l.rawText).join(', ')}`);
});

test('the sheet prices out to a positive total', () => {
  const total = matchExtractedLines(sample.lines).reduce((s, l) => s + l.amount, 0);
  assert.ok(total > 1000, `total was ${total}`);
});

test('every matched line offers alternates to switch to', () => {
  for (const l of matchExtractedLines(sample.lines)) {
    assert.ok(l.candidates.length >= 1, `no candidates for ${l.rawText}`);
  }
});

test('search finds items by partial words in any order', () => {
  const r = searchItems('legrand 63');
  assert.ok(r.length > 0);
  assert.ok(r.every((i) => i.brand === 'LEGRAND'));
});
