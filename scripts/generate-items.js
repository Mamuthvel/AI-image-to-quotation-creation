/**
 * Generates the Limras item master.
 * Every row carries parsed attributes so the matcher never does string similarity.
 * Run: node scripts/generate-items.js
 */
const fs = require('fs');
const path = require('path');

const items = [];
let seq = 0;

function add(o) {
  seq += 1;
  items.push({
    sku: o.sku,
    name: o.name,
    brand: o.brand,
    category: o.category,
    uom: o.uom || 'Nos',
    rate: o.rate,
    attrs: o.attrs || {},
    popularity: o.popularity == null ? 50 : o.popularity,
  });
}

const r = (n) => Math.round(n * 100) / 100;

/* ---------------------------------------------------------------- GANG BOX */
const gangSizes = [
  { m: 1, rate: 34 }, { m: 2, rate: 42 }, { m: 3, rate: 76 },
  { m: 4, rate: 92 }, { m: 6, rate: 109 }, { m: 8, rate: 128 },
  { m: 12, rate: 139 }, { m: 16, rate: 198 }, { m: 18, rate: 226 },
];
for (const g of gangSizes) {
  add({
    sku: `GB-MUSK-${g.m}M`, name: `MUSK PVC GANG BOX ${g.m}M`, brand: 'MUSK',
    category: 'GANG_BOX', rate: g.rate, attrs: { modules: g.m, material: 'PVC' },
    popularity: 90,
  });
}
for (const g of [gangSizes[2], gangSizes[4], gangSizes[6], gangSizes[8]]) {
  add({
    sku: `GB-ANCH-${g.m}M`, name: `ANCHOR PVC GANG BOX ${g.m}M`, brand: 'ANCHOR',
    category: 'GANG_BOX', rate: r(g.rate * 1.18), attrs: { modules: g.m, material: 'PVC' },
    popularity: 40,
  });
}
add({ sku: 'GB-MS-8M', name: 'MS METAL GANG BOX 8M', brand: 'GENERIC', category: 'GANG_BOX', rate: 165, attrs: { modules: 8, material: 'METAL' }, popularity: 20 });
add({ sku: 'GB-MS-12M', name: 'MS METAL GANG BOX 12M', brand: 'GENERIC', category: 'GANG_BOX', rate: 210, attrs: { modules: 12, material: 'METAL' }, popularity: 20 });

/* ------------------------------------------------------------ COVER PLATES */
const plateSizes = [
  { l: '2x4', rate: 78 }, { l: '3x4', rate: 96 }, { l: '4x4', rate: 118 },
  { l: '6x4', rate: 176 }, { l: '8x4', rate: 232 }, { l: '12x4', rate: 318 },
  { l: '16x4', rate: 402 }, { l: '18x4', rate: 465 },
];
for (const p of plateSizes) {
  add({
    sku: `CP-GM-${p.l}`, name: `GM ${p.l} WHITE COVER PLATE`, brand: 'GM',
    category: 'COVER_PLATE', rate: p.rate, attrs: { sizeLabel: p.l, colour: 'WHITE' },
    popularity: 85,
  });
  add({
    sku: `CP-ECL-${p.l}`, name: `E-CLASS ${p.l} WHITE COVER PLATE`, brand: 'E-CLASS',
    category: 'COVER_PLATE', rate: r(p.rate * 0.72), attrs: { sizeLabel: p.l, colour: 'WHITE' },
    popularity: 55,
  });
}
add({ sku: 'CP-GM-4x4-IV', name: 'GM 4x4 IVORY COVER PLATE', brand: 'GM', category: 'COVER_PLATE', rate: 118, attrs: { sizeLabel: '4x4', colour: 'IVORY' }, popularity: 15 });
add({ sku: 'CP-BLANK-1M', name: 'GM 1M WHITE BLANK PLATE', brand: 'GM', category: 'COVER_PLATE', rate: 22, attrs: { modules: 1, colour: 'WHITE', blank: true }, popularity: 30 });

/* ------------------------------------------------------------ ROUND SHEETS */
const roundSizes = [
  { in: 3, rate: 26 }, { in: 3.5, rate: 32 }, { in: 4, rate: 38 },
  { in: 4.5, rate: 46 }, { in: 5, rate: 54 }, { in: 5.5, rate: 62 }, { in: 6, rate: 74 },
];
for (const s of roundSizes) {
  add({
    sku: `RS-GM-${String(s.in).replace('.', '')}`, name: `GM ${s.in}" ROUND SHEET WHITE`, brand: 'GM',
    category: 'ROUND_SHEET', rate: s.rate, attrs: { sizeInch: s.in, colour: 'WHITE' },
    popularity: 80,
  });
  add({
    sku: `RS-GEN-${String(s.in).replace('.', '')}`, name: `${s.in}" PVC ROUND SHEET WHITE`, brand: 'GENERIC',
    category: 'ROUND_SHEET', rate: r(s.rate * 0.6), attrs: { sizeInch: s.in, colour: 'WHITE' },
    popularity: 45,
  });
}

/* ------------------------------------------------------------- WIRE (COIL) */
const wireSizes = [
  { sq: 0.75, hills: 1290, poly: 1520 }, { sq: 1, hills: 1767, poly: 2040 },
  { sq: 1.5, hills: 2610, poly: 2980 }, { sq: 2.5, hills: 4862, poly: 5390 },
  { sq: 4, hills: 7420, poly: 8150 }, { sq: 6, hills: 10980, poly: 11900 },
];
for (const w of wireSizes) {
  add({ sku: `WR-HILLS-${w.sq}`, name: `HILLS ${w.sq} SQ MM WIRE (RP)`, brand: 'HILLS', category: 'WIRE', uom: 'COIL', rate: w.hills, attrs: { coreSqmm: w.sq, lengthMtr: 90 }, popularity: 95 });
  add({ sku: `WR-POLY-${w.sq}`, name: `POLYCAB ${w.sq} SQ MM WIRE (RP)`, brand: 'POLYCAB', category: 'WIRE', uom: 'COIL', rate: w.poly, attrs: { coreSqmm: w.sq, lengthMtr: 90 }, popularity: 60 });
  add({ sku: `WR-FIN-${w.sq}`, name: `FINOLEX ${w.sq} SQ MM WIRE (RP)`, brand: 'FINOLEX', category: 'WIRE', uom: 'COIL', rate: r(w.poly * 1.04), attrs: { coreSqmm: w.sq, lengthMtr: 90 }, popularity: 35 });
}

/* -------------------------------------------------------- FLEXIBLE / METER */
add({ sku: 'WR-VIR-720', name: 'VIR 7/20 LUSE WIRE -(7/.034)', brand: 'VIR', category: 'FLEX_WIRE', uom: 'METER', rate: 104, attrs: { strand: '7/20' }, popularity: 70 });
add({ sku: 'WR-VIR-320', name: 'VIR 3/20 LUSE WIRE', brand: 'VIR', category: 'FLEX_WIRE', uom: 'METER', rate: 62, attrs: { strand: '3/20' }, popularity: 40 });
add({ sku: 'WR-VIR-2376', name: 'VIR 23/76 LUSE WIRE', brand: 'VIR', category: 'FLEX_WIRE', uom: 'METER', rate: 148, attrs: { strand: '23/76' }, popularity: 30 });
add({ sku: 'WR-2C-14', name: '2 CORE 14/36 FLEXIBLE WIRE', brand: 'GENERIC', category: 'FLEX_WIRE', uom: 'METER', rate: 34, attrs: { cores: 2, strand: '14/36' }, popularity: 45 });
add({ sku: 'WR-3C-14', name: '3 CORE 14/36 FLEXIBLE WIRE', brand: 'GENERIC', category: 'FLEX_WIRE', uom: 'METER', rate: 48, attrs: { cores: 3, strand: '14/36' }, popularity: 45 });

/* -------------------------------------------------------------------- MCBs */
const mcbAmps = [6, 10, 16, 20, 25, 32, 40, 63];
const poleDef = { SP: { label: 'SP', mult: 1 }, DP: { label: 'DP', mult: 2.6 }, TP: { label: 'TP', mult: 4.1 }, FP: { label: 'FP', mult: 5.2 } };
const mcbBase = { 6: 148, 10: 150, 16: 152, 20: 155, 25: 178, 32: 195, 40: 308, 63: 406 };
for (const a of mcbAmps) {
  for (const p of ['SP', 'DP', 'FP']) {
    if (p !== 'SP' && a < 16) continue;
    add({
      sku: `MCB-LEG-${p}-${a}`, name: `${a}AMP LEGRAND RX ${p} MCP`, brand: 'LEGRAND',
      category: 'MCB', rate: r(mcbBase[a] * poleDef[p].mult),
      attrs: { amps: a, poles: p }, popularity: p === 'SP' ? 88 : 55,
    });
  }
}
for (const a of [6, 16, 20, 32]) {
  add({ sku: `MCB-HAV-SP-${a}`, name: `${a}AMP HAVELLS SP MCB`, brand: 'HAVELLS', category: 'MCB', rate: r(mcbBase[a] * 0.86), attrs: { amps: a, poles: 'SP' }, popularity: 40 });
}
add({ sku: 'RCCB-LEG-40', name: '40A LEGRAND DP RCCB 30mA', brand: 'LEGRAND', category: 'RCCB', rate: 2480, attrs: { amps: 40, poles: 'DP', sensitivity: 30 }, popularity: 35 });
add({ sku: 'RCCB-LEG-63', name: '63A LEGRAND FP RCCB 100mA', brand: 'LEGRAND', category: 'RCCB', rate: 4650, attrs: { amps: 63, poles: 'FP', sensitivity: 100 }, popularity: 25 });

/* -------------------------------------------------------- DISTRIBUTION BOX */
for (const w of [4, 6, 8, 12, 16]) {
  add({ sku: `DB-SPN-${w}`, name: `${w} WAY SPN DISTRIBUTION BOX`, brand: 'LEGRAND', category: 'DISTRIBUTION_BOX', rate: 620 + w * 128, attrs: { ways: w, type: 'SPN' }, popularity: 40 });
}

/* -------------------------------------------------- CONDUIT / BEND / CLAMP */
for (const s of [{ in: 0.5, rate: 6 }, { in: 0.75, rate: 8 }, { in: 1, rate: 12 }, { in: 1.25, rate: 18 }]) {
  const lbl = s.in === 0.5 ? '1/2"' : s.in === 0.75 ? '3/4"' : s.in === 1 ? '1"' : '1 1/4"';
  add({ sku: `BND-${String(s.in).replace('.', '')}`, name: `${lbl} PVC 1.5 BEND`, brand: 'GENERIC', category: 'BEND', rate: s.rate, attrs: { sizeInch: s.in, grade: 1.5 }, popularity: 75 });
  add({ sku: `CLP-${String(s.in).replace('.', '')}`, name: `${lbl} WIRING CLAMP`, brand: 'GENERIC', category: 'CLAMP', rate: r(s.rate * 0.18), attrs: { sizeInch: s.in }, popularity: 75 });
  add({ sku: `PIPE-${String(s.in).replace('.', '')}`, name: `${lbl} PVC CONDUIT PIPE 1.5MM`, brand: 'GENERIC', category: 'CONDUIT_PIPE', rate: r(s.rate * 6.2), attrs: { sizeInch: s.in, grade: 1.5 }, popularity: 70 });
}
for (const s of [{ in: 0.75, rate: 16 }, { in: 1, rate: 22 }]) {
  const lbl = s.in === 0.75 ? '3/4"' : '1"';
  add({ sku: `JB-3W-${String(s.in).replace('.', '')}`, name: `${lbl}OPEN JUNCTION(3 WAY)`, brand: 'GENERIC', category: 'JUNCTION_BOX', rate: s.rate, attrs: { sizeInch: s.in, ways: 3 }, popularity: 78 });
  add({ sku: `JB-4W-${String(s.in).replace('.', '')}`, name: `${lbl}OPEN JUNCTION(4 WAY)`, brand: 'GENERIC', category: 'JUNCTION_BOX', rate: r(s.rate * 1.25), attrs: { sizeInch: s.in, ways: 4 }, popularity: 60 });
}
add({ sku: 'JB-DEEP-34', name: '3/4"DEEP JUNCTION BOX', brand: 'GENERIC', category: 'JUNCTION_BOX', rate: 28, attrs: { sizeInch: 0.75, deep: true }, popularity: 30 });

/* ------------------------------------------------------------------ SCREWS */
const screwSizes = ['19x6', '25x6', '35x6', '50x6', '63x6'];
const screwRate = { '19x6': 0.32, '25x6': 0.37, '35x6': 0.52, '50x6': 0.78, '63x6': 1.05 };
for (const s of screwSizes) {
  add({ sku: `SCR-DW-${s}`, name: `${s.replace('x', '*')} DRYWALL (BLACK) SCREW(1)`, brand: 'GENERIC', category: 'SCREW', rate: screwRate[s], attrs: { sizeLabel: s, head: 'DRYWALL' }, popularity: 82 });
  add({ sku: `SCR-ST-${s}`, name: `${s.replace('x', '*')} STAR SCREW (SS)`, brand: 'GENERIC', category: 'SCREW', rate: r(screwRate[s] * 1.4), attrs: { sizeLabel: s, head: 'STAR' }, popularity: 70 });
}
add({ sku: 'WP-6MM', name: '6MM PVC WALL PLUG (GITTI)', brand: 'GENERIC', category: 'WALL_PLUG', rate: 0.28, attrs: { sizeMm: 6 }, popularity: 60 });
add({ sku: 'WP-8MM', name: '8MM PVC WALL PLUG (GITTI)', brand: 'GENERIC', category: 'WALL_PLUG', rate: 0.42, attrs: { sizeMm: 8 }, popularity: 55 });

/* -------------------------------------------------------------------- TAPE */
add({ sku: 'TP-3M-6', name: '3M TAP ROLL (6MTR)', brand: '3M', category: 'TAPE', rate: 12, attrs: { lengthMtr: 6 }, popularity: 90 });
add({ sku: 'TP-3M-10', name: '3M TAP ROLL (10MTR)', brand: '3M', category: 'TAPE', rate: 19, attrs: { lengthMtr: 10 }, popularity: 50 });
add({ sku: 'TP-SG-6', name: 'STEELGRIP TAP ROLL (6MTR)', brand: 'STEELGRIP', category: 'TAPE', rate: 9, attrs: { lengthMtr: 6 }, popularity: 45 });

/* ------------------------------------------------- SWITCHES / SOCKETS ETC. */
const wiringBrands = [
  { b: 'E-CLASS', k: 'ECL', mult: 1, pop: 90 },
  { b: 'GM', k: 'GM', mult: 2.35, pop: 60 },
  { b: 'ANCHOR', k: 'ANCH', mult: 1.85, pop: 45 },
];
const switchDefs = [
  { key: 'SW-6-1W', nm: '6AMP 1WAY SWITCH', cat: 'SWITCH', rate: 18, attrs: { amps: 6, ways: 1 }, pop: 95 },
  { key: 'SW-6-2W', nm: '6AMP 2WAY SWITCH', cat: 'SWITCH', rate: 34, attrs: { amps: 6, ways: 2 }, pop: 65 },
  { key: 'SW-6-1WI', nm: '6AMP 1WAY SWITCH WITH INDICATER', cat: 'SWITCH', rate: 42, attrs: { amps: 6, ways: 1, indicator: true }, pop: 55 },
  { key: 'SW-20-1W', nm: '20A 1WAY SWITCH', cat: 'SWITCH', rate: 64, attrs: { amps: 20, ways: 1 }, pop: 70 },
  { key: 'SW-20-1WI', nm: '20A 1WAY SWITCH WITH INDICATER', cat: 'SWITCH', rate: 91, attrs: { amps: 20, ways: 1, indicator: true }, pop: 68 },
  { key: 'SW-32-DP', nm: '32A DP AC SWITCH WITH INDICATER', cat: 'SWITCH', rate: 186, attrs: { amps: 32, poles: 'DP', indicator: true }, pop: 50 },
  { key: 'SW-BELL', nm: '6AMP BELL PUSH SWITCH', cat: 'SWITCH', rate: 38, attrs: { amps: 6, type: 'BELL_PUSH' }, pop: 35 },
  { key: 'SO-5A', nm: '5AMP SOCKET', cat: 'SOCKET', rate: 50, attrs: { amps: 5 }, pop: 88 },
  { key: 'SO-6A', nm: '6AMP 3PIN SOCKET', cat: 'SOCKET', rate: 58, attrs: { amps: 6, pins: 3 }, pop: 72 },
  { key: 'SO-15A', nm: '15A SOCKET', cat: 'SOCKET', rate: 134, attrs: { amps: 15 }, pop: 80 },
  { key: 'SO-20A', nm: '20A SOCKET', cat: 'SOCKET', rate: 162, attrs: { amps: 20 }, pop: 62 },
  { key: 'SO-616', nm: '6/16A COMBINED SOCKET', cat: 'SOCKET', rate: 148, attrs: { amps: 16, combined: true }, pop: 58 },
  { key: 'PT-6-2P', nm: '6AMP 2PIN PLUG TOP', cat: 'PLUG_TOP', rate: 26, attrs: { amps: 6, pins: 2 }, pop: 66 },
  { key: 'PT-6-3P', nm: '6AMP 3PIN PLUG TOP', cat: 'PLUG_TOP', rate: 38, attrs: { amps: 6, pins: 3 }, pop: 74 },
  { key: 'PT-16-3P', nm: '16A 3PIN PLUG TOP', cat: 'PLUG_TOP', rate: 82, attrs: { amps: 16, pins: 3 }, pop: 60 },
  { key: 'PT-20-3P', nm: '20A 3PIN PLUG TOP', cat: 'PLUG_TOP', rate: 96, attrs: { amps: 20, pins: 3 }, pop: 58 },
  { key: 'RG-STEP', nm: 'FAN REGULATOR STEP TYPE', cat: 'REGULATOR', rate: 168, attrs: { type: 'STEP' }, pop: 76 },
  { key: 'RG-DIM', nm: 'FAN REGULATOR DIMMER TYPE', cat: 'REGULATOR', rate: 224, attrs: { type: 'DIMMER' }, pop: 48 },
];
for (const w of wiringBrands) {
  for (const s of switchDefs) {
    add({
      sku: `${s.key}-${w.k}`,
      name: `${w.b} WHITE ${s.nm}`.replace('E-CLASS WHITE 20A', 'E-CLASS WH 20A'),
      brand: w.b, category: s.cat, rate: r(s.rate * w.mult),
      attrs: { ...s.attrs, colour: 'WHITE' }, popularity: Math.round(s.pop * w.pop / 100),
    });
  }
}

/* ------------------------------------------------- HOLDERS / ROSES / DOMES */
add({ sku: 'HLD-BATTEN', name: 'BATTEN HOLDER (SAI HOLDER) WHITE', brand: 'GENERIC', category: 'HOLDER', rate: 26, attrs: { type: 'BATTEN' }, popularity: 85 });
add({ sku: 'HLD-ANGLE', name: 'ANGLE HOLDER WHITE', brand: 'GENERIC', category: 'HOLDER', rate: 32, attrs: { type: 'ANGLE' }, popularity: 55 });
add({ sku: 'HLD-PEND', name: 'PENDANT HOLDER WHITE', brand: 'GENERIC', category: 'HOLDER', rate: 38, attrs: { type: 'PENDANT' }, popularity: 40 });
add({ sku: 'HLD-BRASS', name: 'BRASS BATTEN HOLDER', brand: 'GENERIC', category: 'HOLDER', rate: 68, attrs: { type: 'BATTEN', material: 'BRASS' }, popularity: 25 });
add({ sku: 'CR-2PLATE', name: 'CEILING ROSE 2 PLATE WHITE', brand: 'GENERIC', category: 'CEILING_ROSE', rate: 22, attrs: { plates: 2 }, popularity: 82 });
add({ sku: 'CR-3PLATE', name: 'CEILING ROSE 3 PLATE WHITE', brand: 'GENERIC', category: 'CEILING_ROSE', rate: 29, attrs: { plates: 3 }, popularity: 60 });
add({ sku: 'SD-WHITE', name: 'SWITCH DOME WHITE', brand: 'GENERIC', category: 'SWITCH_DOME', rate: 4.5, attrs: { colour: 'WHITE' }, popularity: 78 });
add({ sku: 'SD-BLACK', name: 'SWITCH DOME BLACK', brand: 'GENERIC', category: 'SWITCH_DOME', rate: 4.5, attrs: { colour: 'BLACK' }, popularity: 35 });
add({ sku: 'FB-ROUND', name: 'FAN BOX ROUND METAL', brand: 'GENERIC', category: 'FAN_BOX', rate: 58, attrs: { shape: 'ROUND' }, popularity: 45 });

/* ----------------------------------------------------------------- LIGHTING */
for (const w of [5, 9, 12, 15, 20]) {
  add({ sku: `LED-BULB-${w}`, name: `${w}W LED BULB COOL WHITE`, brand: 'HAVELLS', category: 'LED_BULB', rate: 60 + w * 4.5, attrs: { watts: w, colourTemp: 'COOL' }, popularity: 70 });
}
for (const w of [6, 12, 18, 22]) {
  add({ sku: `LED-PNL-R-${w}`, name: `${w}W LED PANEL ROUND RECESSED`, brand: 'HAVELLS', category: 'LED_PANEL', rate: 130 + w * 12, attrs: { watts: w, shape: 'ROUND' }, popularity: 65 });
  add({ sku: `LED-PNL-S-${w}`, name: `${w}W LED PANEL SQUARE RECESSED`, brand: 'HAVELLS', category: 'LED_PANEL', rate: 140 + w * 12, attrs: { watts: w, shape: 'SQUARE' }, popularity: 50 });
}
add({ sku: 'LT-WF-6x4', name: '6x4 WOOD FRAME LIGHT FITTING', brand: 'GENERIC', category: 'LIGHT_FITTING', rate: 285, attrs: { sizeLabel: '6x4', material: 'WOOD' }, popularity: 40 });
add({ sku: 'LT-WF-8x4', name: '8x4 WOOD FRAME LIGHT FITTING', brand: 'GENERIC', category: 'LIGHT_FITTING', rate: 340, attrs: { sizeLabel: '8x4', material: 'WOOD' }, popularity: 30 });
add({ sku: 'LT-TUBE-20', name: '20W LED TUBE LIGHT 4FT', brand: 'HAVELLS', category: 'LIGHT_FITTING', rate: 245, attrs: { watts: 20 }, popularity: 60 });
add({ sku: 'LT-FLOOD-50', name: '50W LED FLOOD LIGHT', brand: 'HAVELLS', category: 'LIGHT_FITTING', rate: 690, attrs: { watts: 50 }, popularity: 30 });

/* --------------------------------------------------------------------- FAN */
add({ sku: 'FAN-CEIL-1200', name: 'CROMPTON CEILING FAN 1200MM', brand: 'CROMPTON', category: 'FAN', rate: 1780, attrs: { sweepMm: 1200 }, popularity: 55 });
add({ sku: 'FAN-CEIL-900', name: 'CROMPTON CEILING FAN 900MM', brand: 'CROMPTON', category: 'FAN', rate: 1490, attrs: { sweepMm: 900 }, popularity: 30 });
add({ sku: 'FAN-EXH-6', name: '6" EXHAUST FAN', brand: 'CROMPTON', category: 'FAN', rate: 1120, attrs: { sizeInch: 6, type: 'EXHAUST' }, popularity: 40 });
add({ sku: 'FAN-WALL-400', name: 'WALL MOUNT FAN 400MM', brand: 'CROMPTON', category: 'FAN', rate: 2150, attrs: { sweepMm: 400, type: 'WALL' }, popularity: 20 });

/* ------------------------------------------------------------------- MISC. */
add({ sku: 'DB-BELL', name: 'DOOR BELL DING DONG', brand: 'ANCHOR', category: 'DOOR_BELL', rate: 168, attrs: {}, popularity: 40 });
add({ sku: 'CC-25MM', name: '25MM PVC CASING CAPPING', brand: 'GENERIC', category: 'CASING_CAPPING', uom: 'METER', rate: 24, attrs: { sizeMm: 25 }, popularity: 45 });
add({ sku: 'CC-40MM', name: '40MM PVC CASING CAPPING', brand: 'GENERIC', category: 'CASING_CAPPING', uom: 'METER', rate: 38, attrs: { sizeMm: 40 }, popularity: 35 });
add({ sku: 'LUG-25', name: '2.5 SQ MM COPPER LUG', brand: 'GENERIC', category: 'LUG', rate: 1.8, attrs: { coreSqmm: 2.5 }, popularity: 40 });
add({ sku: 'LUG-6', name: '6 SQ MM COPPER LUG', brand: 'GENERIC', category: 'LUG', rate: 3.6, attrs: { coreSqmm: 6 }, popularity: 30 });
add({ sku: 'SAD-20', name: '20MM PVC SADDLE CLAMP', brand: 'GENERIC', category: 'SADDLE', rate: 1.6, attrs: { sizeMm: 20 }, popularity: 50 });
add({ sku: 'SAD-25', name: '25MM PVC SADDLE CLAMP', brand: 'GENERIC', category: 'SADDLE', rate: 2.1, attrs: { sizeMm: 25 }, popularity: 45 });
add({ sku: 'EXT-BOARD-4', name: '4 SOCKET EXTENSION BOARD 2MTR', brand: 'ANCHOR', category: 'EXTENSION_BOARD', rate: 420, attrs: { sockets: 4 }, popularity: 35 });
add({ sku: 'TESTER-LED', name: 'LINE TESTER SCREWDRIVER', brand: 'GENERIC', category: 'TOOL', rate: 45, attrs: {}, popularity: 30 });
add({ sku: 'CUTTER-6', name: '6" WIRE CUTTING PLIER', brand: 'TAPARIA', category: 'TOOL', rate: 380, attrs: { sizeInch: 6 }, popularity: 25 });

/* ------------------------------------------------------------------- WRITE */
items.sort((a, b) => a.name.localeCompare(b.name, 'en'));

const out = path.join(__dirname, '..', 'server', 'data', 'items.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(items, null, 2));

const byCat = items.reduce((m, i) => ({ ...m, [i.category]: (m[i.category] || 0) + 1 }), {});
console.log(`Wrote ${items.length} items to ${out}`);
console.log(`Categories: ${Object.keys(byCat).length}`);
console.table(byCat);
