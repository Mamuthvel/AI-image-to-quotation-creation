'use strict';

/**
 * CSV export service for quotations and bulk exports.
 * Generates RFC 4180 compliant CSV suitable for import into ERPs.
 */

function escapeCSV(value) {
  if (value == null) return '';
  const str = String(value);
  // Always quote if contains special characters, or if it's already quoted
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function joinCSV(values) {
  return values.map(escapeCSV).join(',');
}

/**
 * Export a single quotation as CSV.
 * Format: one header row, then one row per line item.
 * Suitable for importing into ERP as a single transaction/document.
 */
function exportQuotation(quotation, items) {
  const rows = [];

  // Header row with metadata
  rows.push(joinCSV(['QUOTATION_METADATA', 'Type', 'Value']));

  rows.push(joinCSV(['', 'Quote Number', quotation.docNumber || 'DRAFT']));
  rows.push(joinCSV(['', 'Customer', quotation.customer]));
  rows.push(joinCSV(['', 'Salesman', quotation.salesman]));
  rows.push(joinCSV(['', 'Price Category', quotation.priceCategory]));
  rows.push(joinCSV(['', 'Created Date', quotation.createdAt]));
  rows.push(joinCSV(['', 'Issued Date', quotation.issuedAt || 'NOT ISSUED']));
  rows.push(joinCSV(['', 'Status', quotation.status]));

  // Totals
  rows.push(joinCSV(['', 'Total (before roundoff)', quotation.total]));
  rows.push(joinCSV(['', 'Round Off', quotation.roundOff]));
  rows.push(joinCSV(['', 'Grand Total', quotation.grandTotal]));

  if (quotation.negotiatedTotal != null) {
    rows.push(joinCSV(['', 'Negotiated Total', quotation.negotiatedTotal]));
  }

  // Blank line
  rows.push('');

  // Line items header
  rows.push(joinCSV(['SKU', 'Item Name', 'Brand', 'Category', 'UOM', 'Quantity', 'Rate', 'Line Total']));

  // Line items
  if (quotation.lines && quotation.lines.length > 0) {
    for (const line of quotation.lines) {
      rows.push(joinCSV([
        line.sku || '',
        line.name || '',
        line.brand || '',
        line.category || '',
        line.uom || 'Nos',
        line.qty || 0,
        line.rate || 0,
        line.amount || 0,
      ]));
    }
  }

  return rows.join('\n');
}

/**
 * Export multiple quotations as a single CSV with all items in a flat list.
 * Each row is tagged with its source quotation number for traceability.
 * Useful for bulk imports where each quotation becomes a separate document.
 */
function exportBulk(quotations) {
  const rows = [];

  // Header
  rows.push(joinCSV([
    'Source Quote Number',
    'Source Customer',
    'Source Salesman',
    'Source Date',
    'SKU',
    'Item Name',
    'Brand',
    'Category',
    'UOM',
    'Quantity',
    'Rate',
    'Line Total',
    'Price Category',
    'Quote Status',
  ]));

  // Line items from all quotations
  for (const q of quotations) {
    if (!q.lines || q.lines.length === 0) continue;

    for (const line of q.lines) {
      rows.push(joinCSV([
        q.docNumber || 'DRAFT',
        q.customer,
        q.salesman,
        q.createdAt,
        line.sku || '',
        line.name || '',
        line.brand || '',
        line.category || '',
        line.uom || 'Nos',
        line.qty || 0,
        line.rate || 0,
        line.amount || 0,
        q.priceCategory,
        q.status,
      ]));
    }
  }

  return rows.join('\n');
}

/**
 * Export the product catalog as CSV.
 * Useful for comparing with ERP's product master or bulk importing new products.
 */
function exportCatalog(items) {
  const rows = [];

  // Header
  rows.push(joinCSV([
    'SKU',
    'Name',
    'Brand',
    'Category',
    'UOM',
    'List Price',
    'Popularity',
    'Attributes (JSON)',
  ]));

  // Items
  for (const item of items) {
    rows.push(joinCSV([
      item.sku,
      item.name,
      item.brand,
      item.category,
      item.uom || 'Nos',
      item.listPrice || 0,
      item.popularity || 50,
      JSON.stringify(item.attrs || {}),
    ]));
  }

  return rows.join('\n');
}

module.exports = { exportQuotation, exportBulk, exportCatalog };
