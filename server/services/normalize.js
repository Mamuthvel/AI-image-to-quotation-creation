'use strict';
const aliases = require('../data/aliases.json');

const FRACTIONS = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 0.333, '⅔': 0.667 };

/** Turn unicode fractions into decimals so "3½" becomes "3.5". */
function foldFractions(text) {
  let out = text;
  for (const [glyph, val] of Object.entries(FRACTIONS)) {
    out = out.replace(new RegExp(`(\\d)\\s*${glyph}`, 'g'), (_, d) => String(Number(d) + val));
    out = out.replace(new RegExp(glyph, 'g'), String(val));
  }
  // "3 1/2" -> 3.5, but leave "3/4" (a bare fraction) alone for the inch parser.
  out = out.replace(/(\d+)\s+(\d)\/(\d)/g, (_, w, n, d) => String(Number(w) + Number(n) / Number(d)));
  return out;
}

/**
 * A double-quote directly after a digit is an inch mark. A standalone one is a
 * ditto mark meaning "same as the line above". Same for -do- and ,, .
 */
function stripDittoMarks(line) {
  let out = line;
  out = out.replace(/(\d)"/g, '$1<<INCH>>');
  const hadDitto = /(^|\s)(["'”“]{1,2}|,,|-do-|\bdo\b|\bsame\b)(\s|$)/i.test(out);
  out = out.replace(/(^|\s)(["'”“]{1,2}|,,|-do-|\bdo\b|\bsame\b)(\s|$)/gi, ' ');
  out = out.replace(/<<INCH>>/g, '"');
  return { text: out.replace(/\s{2,}/g, ' ').trim(), hadDitto };
}

function detectCategoryPhrase(text) {
  const low = text.toLowerCase();
  let best = null;
  for (const [cat, terms] of Object.entries(aliases.categoryTerms)) {
    for (const t of terms) {
      if (low.includes(t) && (!best || t.length > best.term.length)) best = { category: cat, term: t };
    }
  }
  return best;
}

/**
 * Lines 9-11 of a typical sheet read `25x6 "  - 100`, inheriting "star screw"
 * from line 8. Anything with a ditto mark and no category of its own borrows
 * the previous line's category phrase.
 */
function expandDittos(lines) {
  let carried = null;
  return lines.map((raw) => {
    const { text, hadDitto } = stripDittoMarks(raw);
    const own = detectCategoryPhrase(text);
    if (own) {
      carried = own.term;
      return { text, inherited: null };
    }
    if (hadDitto && carried) return { text: `${text} ${carried}`.trim(), inherited: carried };
    return { text, inherited: null };
  });
}

function wordPass(text) {
  return text
    .split(/\s+/)
    .map((w) => {
      const bare = w.replace(/[^a-z0-9./"'x*+-]/g, '');
      const fix = aliases.spelling[bare];
      return fix === undefined ? w : fix;
    })
    .join(' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Word-level repair first, then multi-word phrases, then a second word pass.
 * Order matters: "gm whit shet" only becomes the phrase "white sheet" after
 * the individual words are corrected.
 */
function applySpelling(text) {
  let out = wordPass(text.toLowerCase());
  for (const [from, to] of Object.entries(aliases.phrases)) {
    out = out.split(from).join(to);
  }
  return wordPass(out);
}

/**
 * "-2+1+2+5+2 = 12" -> { expression: "2+1+2+5+2", qty: 12, stated: 12 }
 * Only digits, +, spaces and parentheses are ever evaluated.
 */
function parseQuantity(text) {
  let stated = null;
  const eq = text.match(/=\s*(\d+(?:\.\d+)?)\s*$/);
  if (eq) stated = Number(eq[1]);
  const body = eq ? text.slice(0, eq.index) : text;

  const sum = body.match(/(?:^|[\s\-–:])((?:\d+\s*\+\s*)+\d+)\s*$/);
  if (sum) {
    const expression = sum[1].replace(/\s+/g, '');
    const qty = expression.split('+').reduce((a, b) => a + Number(b), 0);
    return { expression, qty, stated, text: body.slice(0, sum.index).trim() };
  }

  const single = body.match(/(?:^|[\s\-–:])(\d+(?:\.\d+)?)\s*(?:nos|no|pcs|pieces|meter|mtr|coil|coils)?\s*$/i);
  if (single) {
    return { expression: null, qty: Number(single[1]), stated, text: body.slice(0, single.index).trim() };
  }
  return { expression: null, qty: stated, stated, text: body.trim() };
}

/** Strip the leading "1)" / "12." list marker. */
function stripListMarker(line) {
  return line.replace(/^\s*\(?\d{1,2}\s*[).\-:]\s*/, '').trim();
}

function normalizeLines(rawLines) {
  const cleaned = rawLines
    .map((l) => stripListMarker(foldFractions(String(l))))
    .filter((l) => l.length > 0);

  return expandDittos(cleaned).map((entry, i) => {
    const q = parseQuantity(entry.text);
    return {
      index: i,
      rawText: rawLines[i],
      descriptionRaw: q.text,
      description: applySpelling(q.text),
      qtyExpression: q.expression,
      qty: q.qty == null ? 1 : q.qty,
      qtyStated: q.stated,
      inheritedFrom: entry.inherited,
    };
  });
}

module.exports = {
  normalizeLines,
  applySpelling,
  parseQuantity,
  expandDittos,
  foldFractions,
  detectCategoryPhrase,
};
