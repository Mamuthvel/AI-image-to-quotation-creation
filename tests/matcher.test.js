'use strict';
const test = require('node:test');
const assert = require('node:assert');

const { matchRawLines, matchExtractedLines, searchItems, items } = require('../server/services/matcher');
const { foldFractions, expandDittos, applySpelling } = require('../server/services/normalize');
const { extractSpec } = require('../server/services/attributes');
const pricing = require('../server/services/pricing');
const sample = require('../server/data/sample-sheet.json');

const one = (text) => matchRawLines([text])[0];

test('item master is alphabetical and large enough', () => {
  assert.ok(items.length >= 200, `expected 200+ items, got ${items.length}`);
  const names = items.map((i) => i.name);
  assert.deepStrictEqual(names, [...names].sort((a, b) => a.localeCompare(b, 'en')));
});

test('every SKU in the Kundan Cab catalogue is unique', () => {
  const skus = items.map((i) => i.sku);
  assert.strictEqual(new Set(skus).size, skus.length);
});

test('price categories discount off list price using the live global percentages', () => {
  const item = items.find((i) => i.sku === 'KWC1002');
  assert.ok(item, 'seed item KWC1002 is missing');
  const cats = pricing.listCategories();
  const decorated = pricing.decorate(item);
  assert.strictEqual(decorated.rates.list, item.listPrice);
  for (const c of cats) {
    if (c.code === 'list') continue;
    const expected = Math.round(item.listPrice * (1 - c.discountPct / 100) * 100) / 100;
    assert.strictEqual(decorated.rates[c.code], expected, `${c.code} rate mismatch`);
  }
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

test('short bare category words match without false-positiving on containing words', () => {
  assert.strictEqual(extractSpec('fr 1 sq wire').category, 'FR');
  assert.strictEqual(extractSpec('cts alumini 10 mm coil').category, 'CTS_AL');
  // "from" contains "fr" as a substring but is not the word "fr".
  assert.strictEqual(extractSpec('from 6 sqmm wire coil').category, 'WIRE');
});

test('every Kundan Cab category resolves from a bare/shorthand customer phrase', () => {
  const cases = [
    ['fr 1.5 sqmm', 'FR'],
    ['lsh 1.5 sqmm', 'FR_LSH'],
    ['pffr 4 sqmm', 'PFFR'],
    ['vir 6 sqmm', 'VIR_CU'],
    ['vir alu 6 sqmm', 'VIR_AL'],
    ['cts 4 sqmm', 'CTS_CU'],
    ['cts alu 10 sqmm', 'CTS_AL'],
    ['twin alu 6 sqmm', 'TWIN_AL'],
    ['wp 4 sqmm', 'WP_AL'],
    ['submersible 1.5 sqmm', 'SUBMERSIBLE'],
    ['tf wire 90 mtr', 'TF_TP'],
    ['speaker 0.75 sqmm', 'SPEAKER'],
    ['bare wire 1.5 sqmm', 'SINGLE_CORE'],
    ['multicore 2.5 sqmm', 'MULTICORE'],
  ];
  for (const [text, expected] of cases) {
    assert.strictEqual(extractSpec(text).category, expected, `"${text}" should resolve to ${expected}`);
  }
});

test('a nonexistent coil length still confidently identifies the cable spec, offering the real lengths instead of degrading to a low-confidence guess', () => {
  const l = one('10 sqmm fr wire 40 meter 2');
  assert.strictEqual(l.item.attrs.coreSqmm, 10);
  assert.strictEqual(l.item.category, 'FR');
  assert.notStrictEqual(l.state, 'low');
  assert.notStrictEqual(l.state, 'unmatched');
});

test('a cable category treats bare "N mm" as sq.mm, since these categories have no other mm spec', () => {
  const a = extractSpec('cts alumini 10 mm 450 meter coil');
  assert.strictEqual(a.category, 'CTS_AL');
  assert.strictEqual(a.spec.coreSqmm, 10);
  assert.strictEqual(a.spec.sizeMm, undefined);

  const l = one('cts alumini 10 mm 450 meter coil 1');
  assert.strictEqual(l.item.sku, 'KWC1037WH');
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

  const d = extractSpec('2.5 sqmm 4 core multicore cable');
  assert.strictEqual(d.category, 'MULTICORE');
  assert.strictEqual(d.spec.coreSqmm, 2.5);
  assert.strictEqual(d.spec.cores, 4);
});

test('an omitted brand resolves to the shop default and says so', () => {
  // 10.0 sqmm FR has a single coil-length SKU, so there's no length tie to worry about here.
  const l = one('10 sqmm fr wire 12');
  assert.strictEqual(l.item.brand, 'KUNDAN CAB');
  assert.strictEqual(l.qty, 12);
  assert.strictEqual(l.state, 'assumed');
  assert.ok(l.reasons.some((r) => r.includes('Brand not specified')));
});

test('an explicit brand carries no "brand not specified" caveat', () => {
  const l = one('kundan cab 1.5 sqmm fr wire 3');
  assert.strictEqual(l.item.brand, 'KUNDAN CAB');
  assert.strictEqual(l.item.attrs.coreSqmm, 1.5);
  assert.ok(!l.reasons.some((r) => r.includes('Brand not specified')));
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
  assert.strictEqual(out.length, sample.lines.length);
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

test('a bare "N sqmm wire" (no sub-type) resolves to real stock via the family fallback', () => {
  // Regression: WIRE / FLEX_WIRE carry no stock in a catalogue that splits wire
  // into FR/VIR/CTS. Generic phrasing must still land on the house default.
  for (const text of ['1.5 sqmm wire 2', '6 sqmm wire coil 1', 'coil 4 sqmm 1']) {
    const l = one(text);
    assert.ok(l.item, `"${text}" should match, got none`);
    assert.ok(l.item.brand === 'KUNDAN CAB', `"${text}" resolved off-catalogue`);
  }
});

test('a size stored with a light/heavy qualifier still matches a customer bare size', () => {
  // Regression: coreSqmm was seeded as "2.5 (LIGHT)" (string) while the parser
  // emits 2.5 (number); coreSqmm is a hard attr, so the mismatch disqualified
  // every 2.5 VIR row outright. Import normalization splits the qualifier out.
  const l = one('vir 2.5 sqmm copper wire 1');
  assert.strictEqual(l.parsedCategory, 'VIR_CU');
  assert.ok(l.item, 'vir 2.5 should match a VIR copper item');
  assert.strictEqual(l.item.attrs.coreSqmm, 2.5);
  assert.ok(['LIGHT', 'HEAVY'].includes(l.item.attrs.grade), 'grade qualifier is preserved');
});

test('an unstocked size in a real category shows the nearest item, not a dead no-match', () => {
  // "cts alumini 1 sqmm" - CTS aluminium is stocked from 4 sq.mm up. Rather than
  // "no match", the counter should see the CTS items with the nearest size on top.
  const l = one('cts alumini 1 sqmm 1');
  assert.strictEqual(l.parsedCategory, 'CTS_AL');
  assert.ok(l.item, 'should offer the nearest CTS item');
  assert.strictEqual(l.item.attrs.coreSqmm, 4, 'nearest stocked size to 1 is 4');
  assert.strictEqual(l.state, 'ambiguous', 'flagged amber for the counter to confirm');
  assert.ok(l.reasons.some((r) => /not stocked/i.test(r)), 'reason explains the substitution');
  assert.ok(l.candidates.length > 1, 'the whole category is offered in the dropdown');
  assert.ok(l.candidates.every((c) => c.name.startsWith('CTS Aluminium')), 'dropdown shows only CTS items');
});

test('the "stocked" list in a substitution reason respects the customer\'s other stated specs', () => {
  // "6mm 10 core": 10-core multicore exists, but not at 6mm. The reason must not
  // list 10 core as available while claiming it is not stocked.
  const l = one('multicore 6mm 10 core 1');
  assert.strictEqual(l.item.attrs.coreSqmm, 6);
  assert.strictEqual(l.item.attrs.cores, 6, 'nearest core count at 6mm is 6');
  const reason = l.reasons.join(' ');
  assert.match(reason, /10 core not stocked/i);
  assert.doesNotMatch(reason, /Stocked[^.]*\b10 core\b/i, 'must not list 10 core as stocked at 6mm');
  assert.match(reason, /at 6 sq\.mm/i, 'names the constraint it is filtering by');
});

test('the catalogue lint reports no dead routes for family phrasing that has a fallback', () => {
  const { validateCatalog } = require('../server/services/itemsStore');
  const report = validateCatalog({ warn() {} });
  assert.ok(!report.dead.includes('WIRE'), 'WIRE should be covered by categoryFallback');
  assert.ok(!report.dead.includes('FLEX_WIRE'), 'FLEX_WIRE should be covered by categoryFallback');
  assert.strictEqual(report.badFallback.length, 0, `fallbacks point at empty categories: ${report.badFallback}`);
});

test('search finds items by partial words in any order', () => {
  const r = searchItems('kundan fr 90');
  assert.ok(r.length > 0);
  assert.ok(r.every((i) => i.brand === 'KUNDAN CAB'));
});
