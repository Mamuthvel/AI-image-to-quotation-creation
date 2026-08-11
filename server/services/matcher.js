'use strict';
const items = require('../data/items.json');
const defaults = require('../data/defaults.json');
const { extractSpec } = require('./attributes');
const { normalizeLines, expandDittos, applySpelling, foldFractions } = require('./normalize');
const learning = require('./learning');

const S = defaults.scoring;
const T = defaults.thresholds;

const HARD_ATTRS = ['amps', 'coreSqmm', 'sizeInch', 'sizeLabel', 'modules', 'watts', 'sizeMm', 'sweepMm', 'strand'];

function scoreItem(item, parsed) {
  const { spec, brand } = parsed;
  let score = S.categoryBase;
  const matched = [];
  const assumed = [];

  for (const [key, want] of Object.entries(spec)) {
    const have = item.attrs[key];
    if (have === undefined) {
      // Item does not carry this attribute at all. A hard attribute the
      // customer named but the SKU lacks is disqualifying; soft ones are not.
      if (HARD_ATTRS.includes(key)) return null;
      continue;
    }
    if (String(have).toLowerCase() === String(want).toLowerCase()) {
      score += S.attrMatch;
      matched.push(key);
    } else if (HARD_ATTRS.includes(key)) {
      return null;
    } else {
      score += S.attrMismatch;
    }
  }

  const catDefaults = defaults.attrDefaults[item.category] || {};
  for (const [key, want] of Object.entries(catDefaults)) {
    if (spec[key] !== undefined) continue;
    if (item.attrs[key] === undefined) continue;
    if (String(item.attrs[key]).toLowerCase() === String(want).toLowerCase()) {
      score += S.attrDefaultApplied;
      assumed.push(key);
    } else {
      score += S.attrMismatch / 4;
    }
  }

  const preferred = defaults.brandByCategory[item.category];
  if (brand) {
    if (item.brand === brand) score += S.brandExplicit;
    else score += S.attrMismatch;
  } else if (item.brand === preferred) {
    score += S.brandDefault;
    assumed.push('brand');
  } else if (item.brand === 'GENERIC') {
    score += S.brandDefault / 2;
  } else {
    score += S.brandOther;
  }

  score += item.popularity * S.popularityWeight;
  return { item, score, matched, assumed };
}

function idealScore(parsed) {
  const attrCount = Object.keys(parsed.spec).length;
  return S.categoryBase
    + attrCount * S.attrMatch
    + (parsed.brand ? S.brandExplicit : S.brandDefault)
    + 100 * S.popularityWeight;
}

function classify(ranked, parsed, ideal) {
  if (!ranked.length) return { state: 'unmatched', reasons: ['No item in the master fits this description'] };

  const top = ranked[0];
  const reasons = [];
  if (top.confidence < T.warn) {
    return { state: 'low', reasons: [`Best guess only - ${top.confidence}% confidence`] };
  }
  // Compare raw scores: two candidates can both clamp to 100% yet be far apart.
  const gapPct = ranked.length > 1 ? ((top.score - ranked[1].score) / ideal) * 100 : 999;
  if (gapPct < T.ambiguousGap) {
    return { state: 'ambiguous', reasons: [`${ranked[1].item.name} scores almost the same`] };
  }
  if (top.assumed.length) {
    for (const a of top.assumed) {
      if (a === 'brand') reasons.push(`Brand not specified - using ${top.item.brand}`);
      else reasons.push(`${a} not specified - using ${top.item.attrs[a]}`);
    }
    return { state: 'assumed', reasons };
  }
  if (top.confidence < T.confirmed) {
    return { state: 'assumed', reasons: ['Partial description - verify size and brand'] };
  }
  return { state: 'confirmed', reasons: [] };
}

function matchLine(line) {
  const learned = learning.lookup(line.description);
  const parsed = extractSpec(line.description);

  let pool = items;
  if (parsed.category) pool = items.filter((i) => i.category === parsed.category);
  else pool = [];

  const ideal = idealScore(parsed);
  let ranked = pool
    .map((i) => scoreItem(i, parsed))
    .filter(Boolean)
    .map((c) => ({ ...c, confidence: Math.max(0, Math.min(100, Math.round((c.score / ideal) * 100))) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  // A confirmed override from a previous quotation always wins.
  if (learned) {
    const hit = items.find((i) => i.sku === learned.sku);
    if (hit) {
      ranked = [
        { item: hit, score: 999, confidence: 100, matched: ['learned'], assumed: [] },
        ...ranked.filter((c) => c.item.sku !== hit.sku),
      ].slice(0, 6);
    }
  }

  const { state, reasons } = learned && ranked[0] && ranked[0].score === 999
    ? { state: 'confirmed', reasons: [] }
    : classify(ranked, parsed, ideal);

  const top = ranked[0] || null;
  return {
    ...line,
    parsedCategory: parsed.category,
    parsedBrand: parsed.brand,
    parsedSpec: parsed.spec,
    state,
    reasons,
    confidence: top ? top.confidence : 0,
    item: top ? top.item : null,
    rate: top ? top.item.rate : 0,
    uom: top ? top.item.uom : 'Nos',
    amount: top ? Math.round(top.item.rate * line.qty * 100) / 100 : 0,
    candidates: ranked.map((c) => ({
      sku: c.item.sku, name: c.item.name, brand: c.item.brand,
      rate: c.item.rate, uom: c.item.uom, confidence: c.confidence,
    })),
    source: learned ? 'learned' : 'rule',
  };
}

function matchRawLines(rawLines) {
  return normalizeLines(rawLines).map(matchLine);
}

function sumExpression(expr) {
  if (!expr || !/^[\d+\s]+$/.test(expr)) return null;
  return expr.split('+').reduce((a, b) => a + Number(b.trim() || 0), 0);
}

/**
 * Takes lines already transcribed by the vision model. Quantity comes from the
 * model; description still goes through ditto expansion and spelling repair.
 */
function matchExtractedLines(lines) {
  const expanded = expandDittos(lines.map((l) => foldFractions(String(l.raw || ''))));

  return expanded.map((entry, i) => {
    const src = lines[i];
    const computed = sumExpression(src.qty_expression);
    const stated = src.stated_qty == null ? null : Number(src.stated_qty);
    const qty = Number(src.qty != null ? src.qty : (computed != null ? computed : 1));

    const line = {
      index: i,
      rawText: String(src.raw || ''),
      descriptionRaw: entry.text,
      description: applySpelling(entry.text),
      qtyExpression: src.qty_expression || null,
      qty,
      qtyStated: stated,
      inheritedFrom: entry.inherited,
      readConfidence: src.confidence == null ? null : Math.round(src.confidence * 100),
    };

    const matched = matchLine(line);
    if (computed != null && stated != null && computed !== stated) {
      matched.qtyConflict = { computed, stated };
      matched.reasons = [`Sheet totals ${stated} but the sum reads ${computed}`, ...matched.reasons];
      if (matched.state === 'confirmed') matched.state = 'assumed';
    }
    return matched;
  });
}

/** Free-text search for the manual picker in the grid. */
function searchItems(q, limit = 25) {
  const terms = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return items.slice(0, limit);
  return items
    .map((i) => {
      const hay = `${i.name} ${i.brand} ${i.category} ${i.sku}`.toLowerCase();
      const hits = terms.filter((t) => hay.includes(t)).length;
      return { i, hits };
    })
    .filter((x) => x.hits === terms.length)
    .sort((a, b) => b.i.popularity - a.i.popularity)
    .slice(0, limit)
    .map((x) => x.i);
}

module.exports = { matchLine, matchRawLines, matchExtractedLines, searchItems, items };
