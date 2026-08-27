'use strict';

/**
 * Import-time cleanup so the matcher's hard-attribute contract holds no matter
 * how a supplier's price list happens to spell its sizes. Runs once per item on
 * the way into the DB (seed script and the admin add/edit path), never in the
 * hot matching loop.
 *
 * Two catalogs, same attribute, different shapes seen in the wild:
 *   coreSqmm: 2.5            (clean)
 *   coreSqmm: "2.5"          (numeric string - Excel export)
 *   coreSqmm: "2.5 (LIGHT)"  (size + grade fused into one cell)
 * All three must end up as { coreSqmm: 2.5 } so a customer's bare "2.5" matches,
 * with the light/heavy distinction preserved as a soft `grade` attr rather than
 * silently disqualifying the row.
 */

// Attributes the matcher scores as hard numeric facts (see HARD_ATTRS in
// matcher.js). Any of these arriving as a string is coerced to a number here.
const NUMERIC_ATTRS = [
  'coreSqmm', 'amps', 'watts', 'sizeMm', 'sizeInch', 'sweepMm',
  'cores', 'modules', 'lengthMtr', 'plates', 'pins', 'ways',
];

// "2.5 (LIGHT)" -> { value: 2.5, grade: "LIGHT" };  "2.5" -> { value: 2.5 };
// anything without a leading number -> { value: null } (left untouched).
function splitQualifier(raw) {
  const m = String(raw).trim().match(/^(-?\d+(?:\.\d+)?)\s*(?:\(([^)]+)\)|([A-Za-z][\w ]*))?$/);
  if (!m) return { value: null, grade: null };
  return { value: Number(m[1]), grade: (m[2] || m[3] || '').trim().toUpperCase() || null };
}

function normalizeAttrs(attrs) {
  if (!attrs || typeof attrs !== 'object') return {};
  const out = { ...attrs };
  for (const key of NUMERIC_ATTRS) {
    const v = out[key];
    if (v === undefined || v === null || typeof v === 'number') continue;
    const { value, grade } = splitQualifier(v);
    if (value === null || Number.isNaN(value)) continue; // genuinely non-numeric - leave as-is
    out[key] = value;
    if (grade && out.grade === undefined) out.grade = grade;
  }
  return out;
}

module.exports = { normalizeAttrs, NUMERIC_ATTRS };
