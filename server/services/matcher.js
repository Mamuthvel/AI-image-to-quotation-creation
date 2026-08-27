'use strict';
const { items } = require('./itemsStore');
const defaults = require('../data/defaults.json');
const { extractSpec } = require('./attributes');
const { normalizeLines, expandDittos, applySpelling, foldFractions } = require('./normalize');
const learning = require('./learning');
const pricing = require('./pricing');

const S = defaults.scoring;
const T = defaults.thresholds;

const HARD_ATTRS = ['amps', 'coreSqmm', 'sizeInch', 'sizeLabel', 'modules', 'watts', 'sizeMm', 'sweepMm', 'strand', 'cores'];
const DEFAULT_PRICE_CATEGORY = 'list';

/**
 * Compare a catalogue attribute against a parsed one. When both read as numbers
 * they are compared numerically, so a catalogue that stored "2.5" (string) or
 * 2.5 (number) both satisfy a customer's 2.5. Non-numeric values fall back to a
 * case-insensitive string match.
 */
function attrEquals(have, want) {
  const nh = Number(have);
  const nw = Number(want);
  if (Number.isFinite(nh) && Number.isFinite(nw) && String(have).trim() !== '' && String(want).trim() !== '') {
    return nh === nw;
  }
  return String(have).toLowerCase() === String(want).toLowerCase();
}

/**
 * In `loose` mode a hard-attribute mismatch is penalised instead of being
 * disqualifying, and the substitution is recorded. Used only as a fallback when
 * the category matched but every item was ruled out on a stocked-size mismatch,
 * so the counter still sees the category's real items (nearest size first)
 * rather than a dead "no match". Numeric penalties scale with relative distance
 * so the closest available size ranks top.
 */
function scoreItem(item, parsed, { loose = false } = {}) {
  const { spec, brand } = parsed;
  let score = S.categoryBase;
  const matched = [];
  const assumed = [];
  const substituted = [];

  for (const [key, want] of Object.entries(spec)) {
    const have = item.attrs[key];
    if (have === undefined) {
      // Item does not carry this attribute at all. A hard attribute the
      // customer named but the SKU lacks is disqualifying; soft ones are not.
      if (HARD_ATTRS.includes(key)) {
        if (!loose) return null;
        score += S.attrMismatch;
        substituted.push({ key, want, have: null });
      }
      continue;
    }
    if (attrEquals(have, want)) {
      score += S.attrMatch;
      matched.push(key);
    } else if (HARD_ATTRS.includes(key)) {
      if (!loose) return null;
      const nh = Number(have);
      const nw = Number(want);
      if (Number.isFinite(nh) && Number.isFinite(nw)) {
        const rel = Math.abs(nh - nw) / Math.max(Math.abs(nh), Math.abs(nw), 1);
        score += S.attrMismatch * rel; // nearer size loses fewer points
      } else {
        score += S.attrMismatch;
      }
      substituted.push({ key, want, have });
    } else if (key === 'lengthMtr') {
      // Coil length is a packaging choice, not a spec error - a customer
      // asking for a length this SKU doesn't come in shouldn't tank
      // confidence the way a wrong brand or wrong core count would.
      score += S.lengthMismatch;
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
  return { item, score, matched, assumed, substituted };
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

const ATTR_UNIT = { coreSqmm: 'sq.mm', amps: 'A', watts: 'W', sizeMm: 'mm', cores: 'core' };
const fmtAttr = (key, v) => (v == null ? '—' : `${v}${ATTR_UNIT[key] ? ` ${ATTR_UNIT[key]}` : ''}`);

/**
 * Human reason for a nearest-value substitution: what the customer asked for
 * isn't stocked, and which values exist to pick from instead. The "stocked"
 * list is constrained to items that satisfy the customer's OTHER stated hard
 * attributes - otherwise "6mm 10 core" would report "10 core not stocked" while
 * listing 10 core (which exists, but only at thinner sizes).
 */
function substituteReasons(top, pool, spec) {
  return (top.substituted || []).map(({ key, want }) => {
    const others = Object.keys(spec).filter((k) => k !== key && HARD_ATTRS.includes(k));
    let siblings = pool.filter((i) => others.every((k) => attrEquals(i.attrs[k], spec[k])));
    if (!siblings.length) siblings = pool; // other attrs themselves unstocked - fall back to the whole category
    const stocked = [...new Set(siblings.map((i) => i.attrs[key]).filter((v) => v != null))]
      .sort((a, b) => Number(a) - Number(b));
    const chosen = top.item.attrs[key];
    const ctx = others
      .filter((k) => top.item.attrs[k] != null)
      .map((k) => fmtAttr(k, top.item.attrs[k]))
      .join(', ');
    const where = ctx ? ` at ${ctx}` : '';
    const list = stocked.length ? ` Stocked${where}: ${stocked.map((v) => fmtAttr(key, v)).join(', ')}.` : '';
    return `${fmtAttr(key, want)} not stocked${where} - showing nearest (${fmtAttr(key, chosen)}).${list}`;
  });
}

function matchLine(line, priceCategory = DEFAULT_PRICE_CATEGORY) {
  const cat = pricing.listCategories().some((c) => c.code === priceCategory) ? priceCategory : DEFAULT_PRICE_CATEGORY;
  const learned = learning.lookup(line.description);
  const parsed = extractSpec(line.description);

  // A "family" phrase like a bare "1.5 sqmm wire" resolves to a family category
  // (WIRE) that the current catalogue may split into sub-types (FR, VIR...) and
  // therefore carry no stock under. defaults.categoryFallback maps the family to
  // the shop's house default so generic phrasing still lands on real stock.
  let effectiveCategory = parsed.category;
  let pool = [];
  if (parsed.category) {
    pool = items.filter((i) => i.category === parsed.category);
    if (!pool.length) {
      const fb = (defaults.categoryFallback || {})[parsed.category];
      if (fb) {
        effectiveCategory = fb;
        pool = items.filter((i) => i.category === fb);
      }
    }
  }

  const ideal = idealScore(parsed);
  const rank = (loose) => pool
    .map((i) => scoreItem(i, parsed, { loose }))
    .filter(Boolean)
    .map((c) => ({ ...c, confidence: Math.max(0, Math.min(100, Math.round((c.score / ideal) * 100))) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  let ranked = rank(false);

  // Category matched but every item was ruled out on a stocked-size mismatch
  // (e.g. "cts alumini 1 sqmm" when CTS aluminium starts at 4). Rather than a
  // dead "no match", show the category's real items - nearest size first - so
  // the counter can pick one from the dropdown.
  let sizeSubstitute = false;
  if (pool.length && !ranked.length) {
    ranked = rank(true);
    sizeSubstitute = ranked.length > 0;
  }

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

  let { state, reasons } = learned && ranked[0] && ranked[0].score === 999
    ? { state: 'confirmed', reasons: [] }
    : classify(ranked, parsed, ideal);

  // Nearest-size fallback: flag it amber ("Check this") and say what wasn't
  // stocked, so the substitution is a deliberate choice, never a silent one.
  if (sizeSubstitute && !(learned && ranked[0] && ranked[0].score === 999)) {
    state = 'ambiguous';
    reasons = substituteReasons(ranked[0], pool, parsed.spec);
  }

  const top = ranked[0] || null;
  const topDecorated = top ? pricing.decorate(top.item) : null;
  const topRate = topDecorated ? topDecorated.rates[cat] : 0;
  return {
    ...line,
    parsedCategory: effectiveCategory,
    parsedBrand: parsed.brand,
    parsedSpec: parsed.spec,
    state,
    reasons,
    confidence: top ? top.confidence : 0,
    item: topDecorated,
    rate: topRate,
    uom: top ? top.item.uom : 'Nos',
    amount: top ? Math.round(topRate * line.qty * 100) / 100 : 0,
    candidates: ranked.map((c) => {
      const d = pricing.decorate(c.item);
      return { sku: d.sku, name: d.name, brand: d.brand, rate: d.rates[cat], rates: d.rates, uom: d.uom, confidence: c.confidence };
    }),
    source: learned ? 'learned' : 'rule',
  };
}

function matchRawLines(rawLines, priceCategory = DEFAULT_PRICE_CATEGORY) {
  return normalizeLines(rawLines).map((line) => matchLine(line, priceCategory));
}

function sumExpression(expr) {
  if (!expr || !/^[\d+\s]+$/.test(expr)) return null;
  return expr.split('+').reduce((a, b) => a + Number(b.trim() || 0), 0);
}

/**
 * Takes lines already transcribed by the vision model. Quantity comes from the
 * model; description still goes through ditto expansion and spelling repair.
 */
function matchExtractedLines(lines, priceCategory = DEFAULT_PRICE_CATEGORY) {
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

    const matched = matchLine(line, priceCategory);
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
  const pool = !terms.length ? items.slice(0, limit) : items
    .map((i) => {
      const hay = `${i.name} ${i.brand} ${i.category} ${i.sku}`.toLowerCase();
      const hits = terms.filter((t) => hay.includes(t)).length;
      return { i, hits };
    })
    .filter((x) => x.hits === terms.length)
    .sort((a, b) => b.i.popularity - a.i.popularity)
    .slice(0, limit)
    .map((x) => x.i);
  return pool.map((i) => pricing.decorate(i));
}

module.exports = { matchLine, matchRawLines, matchExtractedLines, searchItems, items };
