'use strict';
const aliases = require('../data/aliases.json');
const { detectCategoryPhrase } = require('./normalize');

const MODULE_CATEGORIES = new Set(['GANG_BOX', 'COVER_PLATE']);

// Every size in this catalog's cable/wire categories is a cross-section in
// sq.mm - there's no bare-mm diameter spec to confuse it with, unlike conduit
// pipe or similar. So a customer who drops "sq" and just says "10 mm" still
// means 10 sq.mm here.
const CABLE_CATEGORIES = new Set([
  'FR', 'FR_LSH', 'PFFR', 'VIR_CU', 'VIR_AL', 'CTS_CU', 'CTS_AL',
  'TWIN_AL', 'WP_AL', 'SUBMERSIBLE', 'TF_TP', 'SPEAKER', 'SINGLE_CORE', 'MULTICORE',
]);

function detectBrand(text) {
  const low = ` ${text.toLowerCase()} `;
  for (const [brand, terms] of Object.entries(aliases.brandTerms)) {
    for (const t of terms) {
      if (low.includes(` ${t} `) || low.includes(` ${t}-`) || low.startsWith(`${t} `)) return brand;
    }
  }
  return null;
}

function detectInch(text) {
  const frac = text.match(/(\d+)\s*\/\s*(\d+)\s*(?:"|inch)/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  const dec = text.match(/(\d+(?:\.\d+)?)\s*(?:"|inch|inches)/);
  if (dec) return Number(dec[1]);
  return null;
}

/**
 * Reads a line of customer text into the attributes we can match on.
 * Everything it cannot find stays null - that absence is what later drives
 * "brand not specified" rather than a silent guess.
 */
function extractSpec(description) {
  const text = ` ${description.toLowerCase()} `;
  const spec = {};
  const cat = detectCategoryPhrase(description);
  const category = cat ? cat.category : null;

  const amps = text.match(/(\d+(?:\.\d+)?)\s*(?:amp|a)\b/);
  if (amps) spec.amps = Number(amps[1]);

  // Accepts "sqmm", "sq mm", "sq.mm", "sqm" and a bare "sq" (customers often drop the trailing "mm").
  const sq = text.match(/(\d+(?:\.\d+)?)\s*sq\.?\s*m{0,2}\b/);
  if (sq) spec.coreSqmm = Number(sq[1]);

  const watts = text.match(/(\d+)\s*(?:w|watt|watts)\b/);
  if (watts) spec.watts = Number(watts[1]);

  const inch = detectInch(text);
  if (inch != null) spec.sizeInch = inch;

  const size = text.match(/\b(\d{1,2})\s*[x*]\s*(\d{1,2})\b/);
  if (size) spec.sizeLabel = `${size[1]}x${size[2]}`;

  const ways = text.match(/\b([1-6])\s*way\b/);
  if (ways) spec.ways = Number(ways[1]);

  const poles = text.match(/\b(sp|dp|tp|fp)\b/);
  if (poles) spec.poles = poles[1].toUpperCase();

  const pins = text.match(/\b(\d)\s*pin\b/);
  if (pins) spec.pins = Number(pins[1]);

  const plates = text.match(/\b(\d)\s*plate\b/);
  if (plates) spec.plates = Number(plates[1]);

  const mm = text.match(/\b(\d{1,3})\s*mm\b/);
  if (mm) {
    if (CABLE_CATEGORIES.has(category) && spec.coreSqmm === undefined) spec.coreSqmm = Number(mm[1]);
    else spec.sizeMm = Number(mm[1]);
  }

  const sweep = text.match(/\b(900|1200|1400)\s*mm\b/);
  if (sweep) { spec.sweepMm = Number(sweep[1]); delete spec.sizeMm; }

  const lengthM = text.match(/\b(\d{1,3})\s*(?:meter|mtr)\b/);
  if (lengthM) spec.lengthMtr = Number(lengthM[1]);

  if (MODULE_CATEGORIES.has(category)) {
    const mod = text.match(/\b(\d{1,2})\s*m\b/);
    if (mod && !spec.sizeLabel) spec.modules = Number(mod[1]);
  }

  for (const c of ['white', 'black', 'ivory', 'grey', 'gray']) {
    if (text.includes(` ${c} `)) spec.colour = c === 'gray' ? 'GREY' : c.toUpperCase();
  }

  if (/indicat/.test(text)) spec.indicator = true;
  if (/\bstar\b/.test(text)) spec.head = 'STAR';
  else if (/drywall/.test(text)) spec.head = 'DRYWALL';
  if (/\bbatten\b/.test(text)) spec.type = 'BATTEN';
  else if (/\bangle\b/.test(text)) spec.type = 'ANGLE';
  else if (/\bpendant\b/.test(text)) spec.type = 'PENDANT';
  else if (/\bstep\b/.test(text)) spec.type = 'STEP';
  else if (/\bdimmer\b/.test(text)) spec.type = 'DIMMER';
  else if (/exhaust/.test(text)) spec.type = 'EXHAUST';
  if (/\bround\b/.test(text) && category === 'LED_PANEL') spec.shape = 'ROUND';
  if (/\bsquare\b/.test(text) && category === 'LED_PANEL') spec.shape = 'SQUARE';
  if (/\bwood\b/.test(text)) spec.material = 'WOOD';
  else if (/\bbrass\b/.test(text)) spec.material = 'BRASS';
  else if (/\bmetal\b|\bms\b/.test(text)) spec.material = 'METAL';

  // Cable construction, e.g. "14/0.3" (14 strands of 0.3mm) or "196/0.40".
  const strand = text.match(/\b(\d{1,4})\s*\/\s*(\d+(?:\.\d+)?)\b/);
  if (strand && !spec.sizeInch) spec.strand = `${strand[1]}/${strand[2]}`;

  const cores = text.match(/\b(\d{1,2})\s*core\b/);
  if (cores) spec.cores = Number(cores[1]);

  return { category, categoryTerm: cat ? cat.term : null, brand: detectBrand(description), spec };
}

module.exports = { extractSpec, detectBrand, detectInch };
