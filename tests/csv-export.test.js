const test = require('node:test');
const assert = require('node:assert');
const csvExport = require('../server/services/csv-export');

test('CSV Export - Single Quotation', () => {
  const quotation = {
    id: 1,
    uuid: 'test-uuid-1',
    docNumber: 101,
    status: 'issued',
    customer: 'ABC Corp',
    salesman: 'John Doe',
    priceCategory: 'list',
    lines: [
      {
        sku: 'SW-20A-1W',
        name: 'E-CLASS WH 20A 1WAY SWITCH',
        brand: 'ANCHOR',
        category: 'SWITCH_20A',
        uom: 'Nos',
        qty: 5,
        rate: 45.50,
        amount: 227.50,
      },
      {
        sku: 'SWB-6A-2W',
        name: 'SMART 6A 2WAY SWITCH',
        brand: 'HAVELLS',
        category: 'SWITCH_6A',
        uom: 'Nos',
        qty: 10,
        rate: 32.00,
        amount: 320.00,
      },
    ],
    total: 547.50,
    roundOff: 2.50,
    grandTotal: 550.00,
    negotiatedTotal: null,
    createdAt: '2024-09-12T10:30:00Z',
    issuedAt: '2024-09-12T10:35:00Z',
    updatedAt: '2024-09-12T10:35:00Z',
  };

  const items = [
    {
      sku: 'SW-20A-1W',
      name: 'E-CLASS WH 20A 1WAY SWITCH',
      brand: 'ANCHOR',
      category: 'SWITCH_20A',
      uom: 'Nos',
      listPrice: 45.50,
      popularity: 85,
      attrs: { amps: 20, type: '1way', colour: 'white' },
    },
  ];

  const csv = csvExport.exportQuotation(quotation, items);

  assert(csv.includes('QUOTATION_METADATA'), 'Should include metadata header');
  assert(csv.includes('ABC Corp'), 'Should include customer name');
  assert(csv.includes('John Doe'), 'Should include salesman name');
  assert(csv.includes('101'), 'Should include quotation number');
  assert(csv.includes('SW-20A-1W'), 'Should include SKU');
  assert(csv.includes('ANCHOR'), 'Should include brand');
  assert(csv.includes('5'), 'Should include quantity');
  assert(csv.includes('45.5'), 'Should include rate');
  assert(csv.includes('550'), 'Should include grand total');
  assert(csv.includes('issued'), 'Should include status');
  assert(csv.includes('550'), 'Should include grand total');

  // Verify CSV structure
  const lines = csv.split('\n');
  assert(lines.length > 10, 'CSV should have multiple lines');
});

test('CSV Export - Bulk Export', () => {
  const quotations = [
    {
      id: 1,
      uuid: 'uuid-1',
      docNumber: 101,
      status: 'issued',
      customer: 'ABC Corp',
      salesman: 'John',
      priceCategory: 'list',
      createdAt: '2024-09-12T10:00:00Z',
      lines: [
        {
          sku: 'SW-20A-1W',
          name: 'SWITCH',
          brand: 'ANCHOR',
          category: 'SWITCH_20A',
          uom: 'Nos',
          qty: 5,
          rate: 45.50,
          amount: 227.50,
        },
      ],
    },
    {
      id: 2,
      uuid: 'uuid-2',
      docNumber: 102,
      status: 'issued',
      customer: 'XYZ Ltd',
      salesman: 'Jane',
      priceCategory: 'cost',
      createdAt: '2024-09-12T11:00:00Z',
      lines: [
        {
          sku: 'SWB-6A-2W',
          name: 'SMART SWITCH',
          brand: 'HAVELLS',
          category: 'SWITCH_6A',
          uom: 'Nos',
          qty: 10,
          rate: 32.00,
          amount: 320.00,
        },
      ],
    },
  ];

  const csv = csvExport.exportBulk(quotations);

  assert(csv.includes('Source Quote Number'), 'Should include bulk header');
  assert(csv.includes('101'), 'Should include first quote number');
  assert(csv.includes('102'), 'Should include second quote number');
  assert(csv.includes('ABC Corp'), 'Should include first customer');
  assert(csv.includes('XYZ Ltd'), 'Should include second customer');
  assert(csv.includes('SW-20A-1W'), 'Should include first SKU');
  assert(csv.includes('SWB-6A-2W'), 'Should include second SKU');

  // Verify both items are present
  const lines = csv.split('\n');
  const dataLines = lines.filter((l) => l && !l.includes('Source Quote'));
  assert(dataLines.length >= 2, 'Should have at least 2 data rows');
});

test('CSV Export - Catalog Export', () => {
  const items = [
    {
      sku: 'SW-20A-1W',
      name: 'E-CLASS WH 20A 1WAY SWITCH',
      brand: 'ANCHOR',
      category: 'SWITCH_20A',
      uom: 'Nos',
      listPrice: 45.50,
      popularity: 85,
      attrs: { amps: 20, type: '1way', colour: 'white' },
    },
    {
      sku: 'SWB-6A-2W',
      name: 'SMART 6A 2WAY SWITCH',
      brand: 'HAVELLS',
      category: 'SWITCH_6A',
      uom: 'Nos',
      listPrice: 32.00,
      popularity: 75,
      attrs: { amps: 6, type: '2way', colour: 'black' },
    },
  ];

  const csv = csvExport.exportCatalog(items);

  assert(csv.includes('SKU'), 'Should include SKU header');
  assert(csv.includes('Name'), 'Should include Name header');
  assert(csv.includes('Brand'), 'Should include Brand header');
  assert(csv.includes('Category'), 'Should include Category header');
  assert(csv.includes('SW-20A-1W'), 'Should include first SKU');
  assert(csv.includes('SWB-6A-2W'), 'Should include second SKU');
  assert(csv.includes('ANCHOR'), 'Should include first brand');
  assert(csv.includes('HAVELLS'), 'Should include second brand');
  assert(csv.includes('45.5'), 'Should include first price');
  assert(csv.includes('32'), 'Should include second price');

  // Verify attributes are JSON
  assert(csv.includes('"amps"'), 'Should include JSON attributes');
});

test('CSV Export - Escaping', () => {
  const quotation = {
    docNumber: 101,
    status: 'issued',
    customer: 'Corp, Inc "The Best"',
    salesman: 'John "The King" Doe',
    priceCategory: 'list',
    lines: [
      {
        sku: 'TEST-001',
        name: 'Item with, comma and "quotes"',
        brand: 'BRAND',
        category: 'TEST',
        uom: 'Nos',
        qty: 1,
        rate: 100,
        amount: 100,
      },
    ],
    total: 100,
    roundOff: 0,
    grandTotal: 100,
    createdAt: '2024-09-12T10:00:00Z',
    issuedAt: '2024-09-12T10:00:00Z',
  };

  const csv = csvExport.exportQuotation(quotation, []);

  // Escaped strings should be quoted
  assert(csv.includes('"Corp, Inc ""The Best"""'), 'Should properly escape commas and quotes');
  assert(csv.includes('"John ""The King"" Doe"'), 'Should escape name with quotes');
});
