/**
 * Seeds the real Kundan Cab price list (LP-1037, 19th August 2026) into catalog.db.
 * Source: Balar Marketing Pvt. Ltd. price list PDF, pages P-01 through P-05.
 * Safe to re-run — items are upserted by SKU (product code); price-category
 * percentages and per-item overrides already in the DB are left untouched.
 * Run: node scripts/seed-catalog.js
 */
'use strict';
const db = require('../server/db');
const { normalizeAttrs } = require('../server/services/catalog-normalize');

const BRAND = 'KUNDAN CAB';
const rows = [];

// Every name below is built as "<CATEGORY_CODE> <rest>" for brevity while writing this
// file — swapped here for the trade-friendly label so what's displayed (and what a
// customer types back) is natural language, not the internal snake_case category code.
const LABEL = {
  FR: 'FR', FR_LSH: 'FR-LSH', PFFR: 'PFFR',
  VIR_CU: 'VIR Copper', VIR_AL: 'VIR Aluminium',
  CTS_CU: 'CTS Copper', CTS_AL: 'CTS Aluminium',
  TWIN_AL: 'Twin Aluminium', WP_AL: 'WP Aluminium',
  SUBMERSIBLE: 'Submersible', TF_TP: 'TF/TP', SPEAKER: 'Speaker',
  SINGLE_CORE: 'Single Core', MULTICORE: 'Multicore',
};

function add(o) {
  const label = LABEL[o.category];
  const name = label && o.name.startsWith(`${o.category} `) ? label + o.name.slice(o.category.length) : o.name;
  rows.push({
    sku: o.sku,
    name,
    brand: BRAND,
    category: o.category,
    uom: o.uom || 'Coil',
    listPrice: o.listPrice,
    popularity: o.popularity == null ? 50 : o.popularity,
    attrs: normalizeAttrs(o.attrs || {}),
  });
}

/** One size row with two coil-length variants (a common shape in this catalog). */
function pair(category, sqmm, strand, a, b, extraAttrs) {
  const label = `${sqmm} Sq.mm (${strand})`;
  if (a && a.sku) {
    add({
      sku: a.sku, category, listPrice: a.price,
      name: `${category} ${label} - ${a.mtr} Mtr Coil`,
      uom: 'Coil',
      attrs: { coreSqmm: sqmm, strand, lengthMtr: a.mtr, ...extraAttrs },
    });
  }
  if (b && b.sku) {
    add({
      sku: b.sku, category, listPrice: b.price,
      name: `${category} ${label} - ${b.mtr} Mtr Coil`,
      uom: 'Coil',
      attrs: { coreSqmm: sqmm, strand, lengthMtr: b.mtr, ...extraAttrs },
    });
  }
}

/* ============================================================ P-01 : FR ==== */
/* SAFETY PRO - FR multi strand single core, 90m/45m coils */
pair('FR', 1.0, '14/0.3', { sku: 'KWC1002', price: 2961.00, mtr: 90 }, { sku: 'KWC1008', price: 1481.00, mtr: 45 });
pair('FR', 1.5, '22/0.3', { sku: 'KWC1003', price: 4537.00, mtr: 90 }, { sku: 'KWC1009', price: 2267.00, mtr: 45 });
pair('FR', 2.5, '36/0.3', { sku: 'KWC1004', price: 7305.00, mtr: 90 }, { sku: 'KWC1010', price: 3651.00, mtr: 45 });
pair('FR', 4.0, '56/0.3', { sku: 'KWC1005', price: 10748.00, mtr: 90 }, { sku: 'KWC1011', price: 5377.00, mtr: 45 });
pair('FR', 6.0, '84/0.3', { sku: 'KWC1006', price: 15794.00, mtr: 90 }, { sku: 'KWC1012', price: 7898.00, mtr: 45 });
add({ sku: 'KWC1051', category: 'FR', listPrice: 27240.00, name: 'FR 10.0 Sq.mm (140/0.3) - 90 Mtr Coil', attrs: { coreSqmm: 10.0, strand: '140/0.3', lengthMtr: 90 } });
add({ sku: 'KWC1052', category: 'FR', listPrice: 42468.00, name: 'FR 16.0 Sq.mm (226/0.3) - 90 Mtr Coil', attrs: { coreSqmm: 16.0, strand: '226/0.3', lengthMtr: 90 } });
/* FR - 450m coils */
add({ sku: 'KWC1074', category: 'FR', listPrice: 14803.00, name: 'FR 1.0 Sq.mm (14/0.3) - 450 Mtr Coil', attrs: { coreSqmm: 1.0, strand: '14/0.3', lengthMtr: 450 } });
add({ sku: 'KWC1075', category: 'FR', listPrice: 22679.00, name: 'FR 1.5 Sq.mm (22/0.3) - 450 Mtr Coil', attrs: { coreSqmm: 1.5, strand: '22/0.3', lengthMtr: 450 } });
add({ sku: 'KWC1076', category: 'FR', listPrice: 36523.00, name: 'FR 2.5 Sq.mm (36/0.3) - 450 Mtr Coil', attrs: { coreSqmm: 2.5, strand: '36/0.3', lengthMtr: 450 } });
add({ sku: 'KWC1077', category: 'FR', listPrice: 53755.00, name: 'FR 4.0 Sq.mm (56/0.3) - 450 Mtr Coil', attrs: { coreSqmm: 4.0, strand: '56/0.3', lengthMtr: 450 } });
add({ sku: 'KWC1078', category: 'FR', listPrice: 78966.00, name: 'FR 6.0 Sq.mm (84/0.3) - 450 Mtr Coil', attrs: { coreSqmm: 6.0, strand: '84/0.3', lengthMtr: 450 } });

/* ======================================================== P-01 : FR-LSH ==== */
/* FLEXY PLUS - FR-LSH, 90m/45m coils */
pair('FR_LSH', 1.0, '32/0.20', { sku: 'KWC1190', price: 2844.00, mtr: 90 }, { sku: 'KWC1174', price: 1422.00, mtr: 45 });
pair('FR_LSH', 1.5, '30/0.25', { sku: 'KWC1191', price: 4350.00, mtr: 90 }, { sku: 'KWC1175', price: 2176.00, mtr: 45 });
pair('FR_LSH', 2.5, '50/0.25', { sku: 'KWC1192', price: 7013.00, mtr: 90 }, { sku: 'KWC1176', price: 3506.00, mtr: 45 });
pair('FR_LSH', 4.0, '56/0.30', { sku: 'KWC1193', price: 10470.00, mtr: 90 }, { sku: 'KWC1177', price: 5235.00, mtr: 45 });
pair('FR_LSH', 6.0, '84/0.30', { sku: 'KWC1194', price: 15397.00, mtr: 90 }, { sku: 'KWC1178', price: 7699.00, mtr: 45 });
add({ sku: 'KWC1104', category: 'FR_LSH', listPrice: 27276.00, name: 'FR_LSH 10.0 Sq.mm (140/0.3) - 90 Mtr Coil', attrs: { coreSqmm: 10.0, strand: '140/0.3', lengthMtr: 90 } });
add({ sku: 'KWC1105', category: 'FR_LSH', listPrice: 43379.00, name: 'FR_LSH 16.0 Sq.mm (226/0.3) - 90 Mtr Coil', attrs: { coreSqmm: 16.0, strand: '226/0.3', lengthMtr: 90 } });
/* FR-LSH - 180m/450m coils */
pair('FR_LSH', 1.0, '32/0.20', { sku: 'KWC1195', price: 5751.00, mtr: 180 }, { sku: 'KWC1241', price: 14219.00, mtr: 450 });
pair('FR_LSH', 1.5, '30/0.25', { sku: 'KWC1196', price: 8788.00, mtr: 180 }, { sku: 'KWC1242', price: 21751.00, mtr: 450 });
pair('FR_LSH', 2.5, '50/0.25', { sku: 'KWC1197', price: 14168.00, mtr: 180 }, { sku: 'KWC1243', price: 35066.00, mtr: 450 });
pair('FR_LSH', 4.0, '56/0.30', { sku: 'KWC1198', price: 21163.00, mtr: 180 }, { sku: 'KWC1244', price: 52350.00, mtr: 450 });
pair('FR_LSH', 6.0, '84/0.30', { sku: 'KWC1199', price: 31116.00, mtr: 180 }, { sku: 'KWC1245', price: 76987.00, mtr: 450 });
/* FR-LSH - per-metre / 500m drum, large sizes */
function frLshDrum(sqmm, strand, mSku, mPrice, dSku, dPrice) {
  add({ sku: mSku, category: 'FR_LSH', listPrice: mPrice, name: `FR_LSH ${sqmm} Sq.mm (${strand}) - Per Mtr`, uom: 'Mtr', attrs: { coreSqmm: sqmm, strand, lengthMtr: 1 } });
  add({ sku: dSku, category: 'FR_LSH', listPrice: dPrice, name: `FR_LSH ${sqmm} Sq.mm (${strand}) - 500 Mtr Drum`, uom: 'Drum', attrs: { coreSqmm: sqmm, strand, lengthMtr: 500 } });
}
frLshDrum(10.0, '140/0.3', 'KWC1218M', 303.07, 'KWC1218', 151535.00);
frLshDrum(16.0, '226/0.3', 'KWC1219M', 481.99, 'KWC1219', 240991.00);
frLshDrum(25.0, '196/0.40', 'KWC1228M', 726.07, 'KWC1228', 363038.00);
frLshDrum(35.0, '276/0.40', 'KWC1229M', 1037.15, 'KWC1229', 518576.00);
frLshDrum(50.0, '298/0.46', 'KWC1230M', 1488.67, 'KWC1230', 744334.00);
frLshDrum(70.0, '418/0.46', 'KWC1231M', 2031.57, 'KWC1231', 1015784.00);
frLshDrum(95.0, '568/0.46', 'KWC1232M', 2819.16, 'KWC1232', 1409578.00);

/* ============================================================ P-02 : PFFR == */
/* POWER PLUS - PFFR, 90m/180m coils */
pair('PFFR', 1.0, '32/0.20', { sku: 'KWC1200', price: 2834.00, mtr: 90 }, { sku: 'KWC1210', price: 5719.00, mtr: 180 });
pair('PFFR', 1.5, '30/0.25', { sku: 'KWC1201', price: 4339.00, mtr: 90 }, { sku: 'KWC1211', price: 8769.00, mtr: 180 });
pair('PFFR', 2.5, '50/0.25', { sku: 'KWC1202', price: 6986.00, mtr: 90 }, { sku: 'KWC1212', price: 14122.00, mtr: 180 });
pair('PFFR', 4.0, '56/0.30', { sku: 'KWC1203', price: 10450.00, mtr: 90 }, { sku: 'KWC1213', price: 21111.00, mtr: 180 });
pair('PFFR', 6.0, '84/0.30', { sku: 'KWC1204', price: 15345.00, mtr: 90 }, { sku: 'KWC1214', price: 31067.00, mtr: 180 });

/* ============================================================ P-02 : VIR === */
/* P.V.C. insulated VIR copper wire - 90m/45m coils */
pair('VIR_CU', '4.0 (LIGHT)', '7/0.034', { sku: 'KWC1015', price: 13749.00, mtr: 90 }, { sku: 'KWC1096', price: 6875.00, mtr: 45 });
pair('VIR_CU', '4.0 (HEAVY)', '7/0.034', { sku: 'KWC1016', price: 14475.00, mtr: 90 }, { sku: 'KWC1097', price: 7239.00, mtr: 45 });
add({ sku: 'KWC1084', category: 'VIR_CU', listPrice: 20088.00, name: 'VIR_CU 6.0 Sq.mm (7/0.041) - 90 Mtr Coil', attrs: { coreSqmm: 6.0, strand: '7/0.041', lengthMtr: 90 } });
add({ sku: 'KWC1357', category: 'VIR_CU', listPrice: 32840.00, name: 'VIR_CU 10.0 Sq.mm (7/0.053) - 90 Mtr Coil', attrs: { coreSqmm: 10.0, strand: '7/0.053', lengthMtr: 90 } });
add({ sku: 'KWC1184', category: 'VIR_CU', listPrice: 75394.00, name: 'VIR_CU 25.0 Sq.mm (19/0.051) - 90 Mtr Coil', attrs: { coreSqmm: 25.0, strand: '19/0.051', lengthMtr: 90 } });
add({ sku: 'KWC1185', category: 'VIR_CU', listPrice: 110260.00, name: 'VIR_CU 35.0 Sq.mm (19/0.060) - 90 Mtr Coil', attrs: { coreSqmm: 35.0, strand: '19/0.060', lengthMtr: 90 } });
add({ sku: 'KWC1186', category: 'VIR_CU', listPrice: 152969.00, name: 'VIR_CU 50.0 Sq.mm (37/0.052) - 90 Mtr Coil', attrs: { coreSqmm: 50.0, strand: '37/0.052', lengthMtr: 90 } });
add({ sku: 'KWC1187', category: 'VIR_CU', listPrice: 211124.00, name: 'VIR_CU 70.0 Sq.mm (37/0.061) - 90 Mtr Coil', attrs: { coreSqmm: 70.0, strand: '37/0.061', lengthMtr: 90 } });
/* VIR copper - 450m coils */
add({ sku: 'KWC1063', category: 'VIR_CU', listPrice: 68747.00, name: 'VIR_CU 4.0 (LIGHT) Sq.mm (7/0.034) - 450 Mtr Coil', attrs: { coreSqmm: '4.0 (LIGHT)', strand: '7/0.034', lengthMtr: 450 } });
add({ sku: 'KWC1064', category: 'VIR_CU', listPrice: 72377.00, name: 'VIR_CU 4.0 (HEAVY) Sq.mm (7/0.034) - 450 Mtr Coil', attrs: { coreSqmm: '4.0 (HEAVY)', strand: '7/0.034', lengthMtr: 450 } });
add({ sku: 'KWC1086', category: 'VIR_CU', listPrice: 100433.00, name: 'VIR_CU 6.0 Sq.mm (7/0.041) - 450 Mtr Coil', attrs: { coreSqmm: 6.0, strand: '7/0.041', lengthMtr: 450 } });
add({ sku: 'KWC1358', category: 'VIR_CU', listPrice: 164201.00, name: 'VIR_CU 10.0 Sq.mm (7/0.053) - 450 Mtr Coil', attrs: { coreSqmm: 10.0, strand: '7/0.053', lengthMtr: 450 } });
/* VIR copper - per-metre / 500m drum, large sizes */
add({ sku: 'KWC1184M', category: 'VIR_CU', listPrice: 837.73, name: 'VIR_CU 25.0 Sq.mm (19/0.051) - Per Mtr', uom: 'Mtr', attrs: { coreSqmm: 25.0, strand: '19/0.051', lengthMtr: 1 } });
add({ sku: 'KWC1238', category: 'VIR_CU', listPrice: 418857.00, name: 'VIR_CU 25.0 Sq.mm (19/0.051) - 500 Mtr Drum', uom: 'Drum', attrs: { coreSqmm: 25.0, strand: '19/0.051', lengthMtr: 500 } });
add({ sku: 'KWC1185M', category: 'VIR_CU', listPrice: 1225.13, name: 'VIR_CU 35.0 Sq.mm (19/0.060) - Per Mtr', uom: 'Mtr', attrs: { coreSqmm: 35.0, strand: '19/0.060', lengthMtr: 1 } });
add({ sku: 'KWC1239', category: 'VIR_CU', listPrice: 612553.00, name: 'VIR_CU 35.0 Sq.mm (19/0.060) - 500 Mtr Drum', uom: 'Drum', attrs: { coreSqmm: 35.0, strand: '19/0.060', lengthMtr: 500 } });
add({ sku: 'KWC1186M', category: 'VIR_CU', listPrice: 1699.66, name: 'VIR_CU 50.0 Sq.mm (37/0.052) - Per Mtr', uom: 'Mtr', attrs: { coreSqmm: 50.0, strand: '37/0.052', lengthMtr: 1 } });
add({ sku: 'KWC1240', category: 'VIR_CU', listPrice: 849831.00, name: 'VIR_CU 50.0 Sq.mm (37/0.052) - 500 Mtr Drum', uom: 'Drum', attrs: { coreSqmm: 50.0, strand: '37/0.052', lengthMtr: 500 } });

/* ============================================================ P-02 : CTS === */
/* P.V.C. insulated CTS copper wire - 90m / 450m */
add({ sku: 'KWC1018', category: 'CTS_CU', listPrice: 13426.00, name: 'CTS_CU 4.0 Sq.mm (7/0.034) - 90 Mtr Coil', attrs: { coreSqmm: 4.0, strand: '7/0.034', lengthMtr: 90 } });
add({ sku: 'KWC1072', category: 'CTS_CU', listPrice: 67126.00, name: 'CTS_CU 4.0 Sq.mm (7/0.034) - 450 Mtr Coil', attrs: { coreSqmm: 4.0, strand: '7/0.034', lengthMtr: 450 } });

/* ===================================================== P-03 : SUBMERSIBLE == */
add({ sku: 'KWC1019M05', category: 'SUBMERSIBLE', listPrice: 84866.00, name: 'SUBMERSIBLE 3 Core 1.5 Sq.mm (22/0.30) - 500 Mtr Drum', uom: 'Drum', attrs: { coreSqmm: 1.5, strand: '22/0.30', cores: 3, lengthMtr: 500 } });
add({ sku: 'KWC1020M05', category: 'SUBMERSIBLE', listPrice: 127794.00, name: 'SUBMERSIBLE 3 Core 2.5 Sq.mm (36/0.30) - 500 Mtr Drum', uom: 'Drum', attrs: { coreSqmm: 2.5, strand: '36/0.30', cores: 3, lengthMtr: 500 } });
add({ sku: 'KWC1020M10', category: 'SUBMERSIBLE', listPrice: 255586.00, name: 'SUBMERSIBLE 3 Core 2.5 Sq.mm (36/0.30) - 1000 Mtr Drum', uom: 'Drum', attrs: { coreSqmm: 2.5, strand: '36/0.30', cores: 3, lengthMtr: 1000 } });
add({ sku: 'KWC1021M05', category: 'SUBMERSIBLE', listPrice: 187262.00, name: 'SUBMERSIBLE 3 Core 4.0 Sq.mm (56/0.30) - 500 Mtr Drum', uom: 'Drum', attrs: { coreSqmm: 4.0, strand: '56/0.30', cores: 3, lengthMtr: 500 } });
add({ sku: 'KWC1021M10', category: 'SUBMERSIBLE', listPrice: 374523.00, name: 'SUBMERSIBLE 3 Core 4.0 Sq.mm (56/0.30) - 1000 Mtr Drum', uom: 'Drum', attrs: { coreSqmm: 4.0, strand: '56/0.30', cores: 3, lengthMtr: 1000 } });
add({ sku: 'KWC1022M03', category: 'SUBMERSIBLE', listPrice: 164444.00, name: 'SUBMERSIBLE 3 Core 6.0 Sq.mm (84/0.30) - 300 Mtr Drum', uom: 'Drum', attrs: { coreSqmm: 6.0, strand: '84/0.30', cores: 3, lengthMtr: 300 } });
add({ sku: 'KWC1022M05', category: 'SUBMERSIBLE', listPrice: 274075.00, name: 'SUBMERSIBLE 3 Core 6.0 Sq.mm (84/0.30) - 500 Mtr Drum', uom: 'Drum', attrs: { coreSqmm: 6.0, strand: '84/0.30', cores: 3, lengthMtr: 500 } });

/* ==================================================== P-03 : VIR ALUMINIUM = */
function virAl(sqmm, strand, mSku, mPrice, c90Sku, c90Price, c450Sku, c450Price) {
  if (mSku) add({ sku: mSku, category: 'VIR_AL', listPrice: mPrice, name: `VIR_AL ${sqmm} Sq.mm (${strand}) - Per Mtr`, uom: 'Mtr', attrs: { coreSqmm: sqmm, strand, lengthMtr: 1 } });
  if (c90Sku) add({ sku: c90Sku, category: 'VIR_AL', listPrice: c90Price, name: `VIR_AL ${sqmm} Sq.mm (${strand}) - 90 Mtr Coil`, attrs: { coreSqmm: sqmm, strand, lengthMtr: 90 } });
  if (c450Sku) add({ sku: c450Sku, category: 'VIR_AL', listPrice: c450Price, name: `VIR_AL ${sqmm} Sq.mm (${strand}) - 450 Mtr Coil`, attrs: { coreSqmm: sqmm, strand, lengthMtr: 450 } });
}
virAl(4.0, '7/0.034', null, null, 'KWC1023', 1786.00, 'KWC1027', 8939.00);
virAl(6.0, '7/0.041', null, null, 'KWC1024', 2509.00, 'KWC1028', 12544.00);
virAl(10.0, '7/0.053', 'KWC1025M', 39.63, 'KWC1025', 3568.00, 'KWC1029', 17826.00);
virAl(16.0, '7/0.067', 'KWC1026M', 54.63, 'KWC1026', 4917.00, 'KWC1030', 24580.00);
virAl(25.0, '7/0.080', 'KWC1179M', 93.24, null, null, 'KWC1220', 41955.00);
virAl(35.0, '7/0.092', 'KWC1180M', 119.91, null, null, 'KWC1227', 53967.00);
virAl(50.0, '7/0.110', 'KWC1181M', 169.74, null, null, 'KWC1221', 76384.00);

/* ==================================================== P-03 : CTS ALUMINIUM = */
pair('CTS_AL', 4.0, '7/0.034', { sku: 'KWC1031WH', price: 2056.00, mtr: 90 }, { sku: 'KWC1035WH', price: 10284.00, mtr: 450 });
pair('CTS_AL', 6.0, '7/0.041', { sku: 'KWC1032WH', price: 2553.00, mtr: 90 }, { sku: 'KWC1036WH', price: 12756.00, mtr: 450 });
pair('CTS_AL', 10.0, '7/0.053', { sku: 'KWC1033WH', price: 3781.00, mtr: 90 }, { sku: 'KWC1037WH', price: 18902.00, mtr: 450 });
pair('CTS_AL', 16.0, '7/0.067', { sku: 'KWC1034WH', price: 5681.00, mtr: 90 }, { sku: 'KWC1038WH', price: 28396.00, mtr: 450 });

/* ==================================================== P-03 : TWIN ALUMINIUM */
add({ sku: 'KWC1123', category: 'TWIN_AL', listPrice: 30808.00, name: 'TWIN_AL 6.0 Sq.mm Twin - 450 Mtr Coil', attrs: { coreSqmm: 6.0, cores: 2, lengthMtr: 450 } });

/* ==================================================== P-03 : W.P. ALUMINIUM */
pair('WP_AL', 4.0, 'CTS', { sku: 'KWC1359', price: 1968.00, mtr: 90 }, { sku: 'KWC1362', price: 9838.00, mtr: 450 });
pair('WP_AL', 6.0, 'CTS', { sku: 'KWC1360', price: 2628.00, mtr: 90 }, { sku: 'KWC1363', price: 13141.00, mtr: 450 });
pair('WP_AL', 10.0, 'CTS', { sku: 'KWC1361', price: 3296.00, mtr: 90 }, { sku: 'KWC1364', price: 16481.00, mtr: 450 });

/* ============================================================ P-04 : CTS === */
/* P.V.C. insulated CTS copper wire (plain), 2.5 CTS - 90m/630m */
add({ sku: 'KWC1017', category: 'CTS_CU', listPrice: 6963.00, name: 'CTS_CU 2.5 Sq.mm (3/0.036) - 90 Mtr Coil', attrs: { coreSqmm: 2.5, strand: '3/0.036', lengthMtr: 90 } });
add({ sku: 'KWC1126', category: 'CTS_CU', listPrice: 48737.00, name: 'CTS_CU 2.5 Sq.mm (3/0.036) - 630 Mtr Coil', attrs: { coreSqmm: 2.5, strand: '3/0.036', lengthMtr: 630 } });

/* ============================================================ P-04 : VIR ==== */
/* P.V.C. insulated VIR copper wire (plain) */
add({ sku: 'KWC1013', category: 'VIR_CU', listPrice: 7074.00, name: 'VIR_CU 2.5 (LIGHT) Sq.mm (3/0.036) - 90 Mtr Coil', attrs: { coreSqmm: '2.5 (LIGHT)', strand: '3/0.036', lengthMtr: 90 } });
add({ sku: 'KWC1014', category: 'VIR_CU', listPrice: 7553.00, name: 'VIR_CU 2.5 (HEAVY) Sq.mm (3/0.036) - 90 Mtr Coil', attrs: { coreSqmm: '2.5 (HEAVY)', strand: '3/0.036', lengthMtr: 90 } });
add({ sku: 'KWC1125', category: 'VIR_CU', listPrice: 52866.00, name: 'VIR_CU 2.5 (HEAVY) Sq.mm (3/0.036) - 630 Mtr Coil', attrs: { coreSqmm: '2.5 (HEAVY)', strand: '3/0.036', lengthMtr: 630 } });
add({ sku: 'KWC1085', category: 'VIR_CU', listPrice: 47772.00, name: 'VIR_CU 16.00 Sq.mm (7/0.064) - 90 Mtr Coil', attrs: { coreSqmm: 16.00, strand: '7/0.064', lengthMtr: 90 } });
add({ sku: 'KWC1087', category: 'VIR_CU', listPrice: 238856.00, name: 'VIR_CU 16.00 Sq.mm (7/0.064) - 450 Mtr Coil', attrs: { coreSqmm: 16.00, strand: '7/0.064', lengthMtr: 450 } });

/* ========================================================== P-04 : TF/TP === */
add({ sku: 'KWC1131', category: 'TF_TP', listPrice: 3289.00, name: 'TF_TP 23/0060 Twin Flat - 90 Mtr Coil', attrs: { strand: '23/0.060', type: 'TF', lengthMtr: 90 } });
add({ sku: 'KWC1132', category: 'TF_TP', listPrice: 3022.00, name: 'TF_TP 23/0060 Twin Parallel - 90 Mtr Coil', attrs: { strand: '23/0.060', type: 'PF', lengthMtr: 90 } });

/* ========================================================= P-04 : SPEAKER == */
add({ sku: 'KWC1226', category: 'SPEAKER', listPrice: 2943.00, name: 'SPEAKER 2 Core x 0.50 Sq.mm - 90 Mtr Coil', attrs: { coreSqmm: 0.50, cores: 2, lengthMtr: 90 } });
add({ sku: 'KWC1108', category: 'SPEAKER', listPrice: 4002.00, name: 'SPEAKER 2 Core x 0.75 Sq.mm - 90 Mtr Coil', attrs: { coreSqmm: 0.75, cores: 2, lengthMtr: 90 } });

/* ===================================================== P-04 : SINGLE CORE == */
const singleCore = [
  [0.50, '16/0.25', 'KWC1327C1', 1784.00], [1.00, '32/0.25', 'KWC1312C1', 3333.00],
  [1.50, '30/0.25', 'KWC1313C1', 4627.00], [2.50, '50/0.25', 'KWC1314C1', 7564.00],
  [10.00, '140/0.30', 'KWC1315C1', 31333.00], [16.00, '101/0.45', 'KWC1316C1', 48887.00],
  [25.00, '150/0.45', 'KWC1317C1', 74586.00], [35.00, '210/0.45', 'KWC1318C1', 104613.00],
  [50.00, '305/0.45', 'KWC1319C1', 149773.00], [70.00, '354/0.50', 'KWC1342C1', 213016.00],
  [95.00, '484/0.50', 'KWC1320C1', 288712.00], [120.00, '614/0.50', 'KWC1321C1', 373218.00],
  [150.00, '750/0.50', 'KWC1322C1', 433225.00], [185.00, '925/0.50', 'KWC1323C1', 538403.00],
  [240.00, '1221/0.50', 'KWC1324C1', 692769.00], [300.00, '1521/0.50', 'KWC1325C1', 904373.00],
  [400.00, '2036/0.50', 'KWC1326C1', 1199586.00],
];
for (const [sqmm, strand, sku, price] of singleCore) {
  add({ sku, category: 'SINGLE_CORE', listPrice: price, name: `SINGLE_CORE ${sqmm} Sq.mm (${strand}) - 100 Mtr Coil`, attrs: { coreSqmm: sqmm, strand, cores: 1, lengthMtr: 100 } });
}

/* ========================================================= P-05 : MULTICORE */
/* Table 1 - per 100 mtrs, 2/3/4/5 core */
const multi100 = [
  [0.50, '16/0.25', { 2: ['KWC1115C2', 4731.00], 3: ['KWC1115C3', 6393.00], 4: ['KWC1115C4', 8101.00], 5: ['KWC1327C5', 11711.00] }],
  [0.75, '24/0.25', { 2: ['KWC1116C2', 6565.00], 3: ['KWC1116C3', 8900.00], 4: ['KWC1116C4', 11336.00] }],
  [1.00, '32/0.25', { 2: ['KWC1117C2', 8129.00], 3: ['KWC1117C3', 11302.00], 4: ['KWC1117C4', 14615.00], 5: ['KWC1328C5', 19601.00] }],
  [1.50, '30/0.25', { 2: ['KWC1118C2', 11030.00], 3: ['KWC1118C3', 15748.00], 4: ['KWC1118C4', 20636.00], 5: ['KWC1329C5', 27419.00] }],
  [2.50, '50/0.25', { 2: ['KWC1119C2', 18017.00], 3: ['KWC1119C3', 25334.00], 4: ['KWC1119C4', 33539.00], 5: ['KWC1330C5', 41910.00] }],
  [4.00, '56/0.30', { 2: ['KWC1120C2', 28147.00], 3: ['KWC1120C3', 40372.00], 4: ['KWC1120C4', 52955.00], 5: ['KWC1331C5', 63245.00] }],
  [6.00, '84/0.30', { 2: ['KWC1121C2', 44204.00], 3: ['KWC1121C3', 60809.00], 4: ['KWC1121C4', 80879.00] }],
  [10.00, '140/0.30', { 2: ['KWC1332C2', 69566.00], 5: ['KWC1333C5', 165776.00] }],
  [16.00, '101/0.45', { 2: ['KWC1334C2', 108135.00], 3: ['KWC1335C3', 153648.00], 4: ['KWC1336C4', 207364.00], 5: ['KWC1337C5', 256118.00] }],
  [25.00, '150/0.45', { 3: ['KWC1338C3', 238899.00], 4: ['KWC1338C4', 302035.00], 5: ['KWC1339C5', 380549.00] }],
  [35.00, '210/0.45', { 3: ['KWC1340C3', 333165.00], 4: ['KWC1340C4', 430630.00] }],
  [50.00, '305/0.45', { 3: ['KWC1341C3', 483105.00], 4: ['KWC1341C4', 640242.00] }],
  [70.00, '354/0.50', { 4: ['KWC1342C4', 878491.00] }],
];
for (const [sqmm, strand, cores] of multi100) {
  for (const [core, [sku, price]] of Object.entries(cores)) {
    add({ sku, category: 'MULTICORE', listPrice: price, name: `MULTICORE ${sqmm} Sq.mm (${strand}) ${core} Core - 100 Mtr Coil`, attrs: { coreSqmm: sqmm, strand, cores: Number(core), lengthMtr: 100 } });
  }
}

/* Table 2 - per mtr, 6/8/10/12 core */
const multiPerMtrA = [
  [0.50, '16/0.25', { 6: ['KWC1344C6M', 146.20], 8: ['KWC1344C8M', 200.35], 10: ['KWC1344C10M', 225.26], 12: ['KWC1352C12M', 251.25] }],
  [0.75, '24/0.25', { 6: ['KWC1345C6M', 197.10], 8: ['KWC1345C8M', 253.41], 10: ['KWC1345C10M', 308.64], 12: ['KWC1353C12M', 355.21] }],
  [1.00, '32/0.25', { 6: ['KWC1346C6M', 232.83], 8: ['KWC1346C8M', 293.48], 10: ['KWC1346C10M', 375.79], 12: ['KWC1354C12M', 453.76] }],
  [1.50, '30/0.25', { 8: ['KWC1347C8M', 441.85], 10: ['KWC1347C10M', 538.23], 12: ['KWC1355C12M', 655.18] }],
  [2.50, '50/0.25', { 8: ['KWC1348C8M', 689.84], 10: ['KWC1348C10M', 846.87], 12: ['KWC1356C12M', 1023.39] }],
  [4.00, '56/0.30', { 6: ['KWC1349C6M', 804.63] }],
  [6.00, '84/0.30', { 6: ['KWC1350C6M', 1190.17] }],
  [10.00, '140/0.30', { 6: ['KWC1351C6M', 2004.54] }],
];
for (const [sqmm, strand, cores] of multiPerMtrA) {
  for (const [core, [sku, price]] of Object.entries(cores)) {
    add({ sku, category: 'MULTICORE', listPrice: price, name: `MULTICORE ${sqmm} Sq.mm (${strand}) ${core} Core - Per Mtr`, uom: 'Mtr', attrs: { coreSqmm: sqmm, strand, cores: Number(core), lengthMtr: 1 } });
  }
}

/* Table 3 - per mtr, 16/19/24 core */
const multiPerMtrB = [
  [0.50, '16/0.25', { 16: ['KWC1352C16M', 353.04], 19: ['KWC1352C19M', 420.19], 24: ['KWC1352C24M', 550.14] }],
  [0.75, '24/0.25', { 16: ['KWC1353C16M', 480.84], 19: ['KWC1353C19M', 554.87], 24: ['KWC1353C24M', 672.52] }],
  [1.00, '32/0.25', { 16: ['KWC1354C16M', 576.14], 24: ['KWC1354C24M', 865.28] }],
  [1.50, '30/0.25', { 16: ['KWC1355C16M', 864.20], 19: ['KWC1355C19M', 1021.22], 24: ['KWC1355C24M', 1219.40] }],
  [2.50, '50/0.25', { 16: ['KWC1356C16M', 1399.17], 19: ['KWC1356C19M', 1611.43], 24: ['KWC1356C24M', 1965.56] }],
];
for (const [sqmm, strand, cores] of multiPerMtrB) {
  for (const [core, [sku, price]] of Object.entries(cores)) {
    add({ sku, category: 'MULTICORE', listPrice: price, name: `MULTICORE ${sqmm} Sq.mm (${strand}) ${core} Core - Per Mtr`, uom: 'Mtr', attrs: { coreSqmm: sqmm, strand, cores: Number(core), lengthMtr: 1 } });
  }
}

/* ---------------------------------------------------------------- upsert --- */
const upsert = db.prepare(`
  INSERT INTO items (sku, name, brand, category, uom, list_price, popularity, attrs)
  VALUES (@sku, @name, @brand, @category, @uom, @listPrice, @popularity, @attrs)
  ON CONFLICT(sku) DO UPDATE SET
    name = excluded.name, brand = excluded.brand, category = excluded.category,
    uom = excluded.uom, list_price = excluded.list_price, attrs = excluded.attrs
`);
const clearMock = db.prepare(`DELETE FROM items WHERE sku NOT IN (${rows.map(() => '?').join(',')})`);

const run = db.transaction(() => {
  for (const r of rows) upsert.run({ ...r, attrs: JSON.stringify(r.attrs) });
  clearMock.run(...rows.map((r) => r.sku));
});
run();

console.log(`Seeded ${rows.length} Kundan Cab SKUs. Mock/legacy items removed.`);
