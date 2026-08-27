'use strict';
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const DIR = path.join(__dirname, '..', 'data', 'quotations');
fs.mkdirSync(DIR, { recursive: true });

// The shop's printout uses plain two-decimal figures (no thousands grouping).
const money = (n) => Number(n || 0).toFixed(2);
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/* Indian-format rupees in words: 1,23,456 -> "one lakh twenty three thousand..." */
const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
function under1000(n) {
  let s = '';
  if (n >= 100) { s += `${ONES[Math.floor(n / 100)]} hundred`; n %= 100; if (n) s += ' and '; }
  if (n >= 20) { s += TENS[Math.floor(n / 10)]; if (n % 10) s += ` ${ONES[n % 10]}`; }
  else if (n) s += ONES[n];
  return s;
}
function rupeesInWords(amount) {
  let n = Math.round(Number(amount) || 0);
  if (n === 0) return 'zero';
  const parts = [];
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  if (crore) parts.push(`${under1000(crore)} crore`);
  if (lakh) parts.push(`${under1000(lakh)} lakh`);
  if (thousand) parts.push(`${under1000(thousand)} thousand`);
  if (n) parts.push(under1000(n));
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function pdfPath(docNumber) { return path.join(DIR, `${docNumber}.pdf`); }

/**
 * Reproduces the shop's existing printed quotation: one outer frame, a centred
 * QUOTATION title, TO on the left with a bordered QUOT NO / DATE / TIME /
 * SALESMAN block on the right, a full column grid whose vertical rules run the
 * whole body height, then Total / Rounded off and a boxed grand-total band, with
 * the amount in words bottom-left and the validity note bottom-right.
 */
function render(quote, filePath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 30 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);
    stream.on('finish', () => resolve(filePath));
    stream.on('error', reject);

    const left = 34;
    const right = doc.page.width - 34;         // ~561
    const W = right - left;

    // right-anchored columns: S.No | Description | Qty | Rate | Amount
    const xAmt = right - 92;
    const xRate = xAmt - 76;
    const xQty = xRate - 74;
    const xDesc = left + 42;
    const xVerticals = [xDesc, xQty, xRate, xAmt];

    const hline = (x1, x2, yy, w = 0.8) => doc.moveTo(x1, yy).lineTo(x2, yy).lineWidth(w).strokeColor('#000').stroke();
    const vline = (x, y1, y2, w = 0.8) => doc.moveTo(x, y1).lineTo(x, y2).lineWidth(w).strokeColor('#000').stroke();
    const txt = (s, x, w, yy, align, font = 'Helvetica', size = 9) =>
      doc.font(font).fontSize(size).fillColor('#000').text(String(s), x + 3, yy, { width: w - 6, align, lineBreak: false });

    // ---- geometry ----
    const yTop = 34;
    const yTitle = yTop + 10;
    const yMetaTop = yTop + 40;          // top of TO row / meta box
    const yHead = yMetaTop + 62;         // table header row top
    const yBody = yHead + 16;            // first item row
    const yColsBottom = 700;             // ledger columns run down to here
    const yGrandBottom = yColsBottom + 24;

    // ---- title ----
    txt('QUOTATION', left, W, yTitle, 'center', 'Helvetica-Bold', 15);

    // ---- meta: TO (left) + boxed QUOT NO block (right) ----
    const d = new Date(quote.issuedAt || quote.createdAt || Date.now());
    txt(`TO : ${quote.customer || 'QUOTATION'}`, left, xQty - left, yMetaTop + 2, 'left', 'Helvetica', 10);
    // meta box outline
    doc.rect(xQty, yMetaTop - 6, right - xQty, yHead - (yMetaTop - 6)).lineWidth(0.8).strokeColor('#000').stroke();
    const meta = [
      ['QUOT NO', String(quote.docNumber)],
      ['DATE', d.toLocaleDateString('en-GB')],
      ['TIME', d.toLocaleTimeString('en-US')],
      ['SALESMAN', quote.salesman || 'DIRECT SMAN'],
    ];
    let my = yMetaTop;
    for (const [k, v] of meta) {
      txt(k, xQty + 6, 70, my, 'left', 'Helvetica', 9);
      txt(`: ${v}`, xQty + 74, right - (xQty + 74) - 4, my, 'left', 'Helvetica', 9);
      my += 13;
    }

    // ---- table header ----
    hline(left, right, yHead);
    txt('S.No', left, xDesc - left, yHead + 4, 'center', 'Helvetica-Bold');
    txt('Description', xDesc, xQty - xDesc, yHead + 4, 'left', 'Helvetica-Bold');
    txt('Qty', xQty, xRate - xQty, yHead + 4, 'center', 'Helvetica-Bold');
    txt('Rate', xRate, xAmt - xRate, yHead + 4, 'right', 'Helvetica-Bold');
    txt('Amount', xAmt, right - xAmt, yHead + 4, 'right', 'Helvetica-Bold');
    hline(left, right, yBody);

    // ---- item rows ----
    let y = yBody + 3;
    (quote.lines || []).forEach((l, i) => {
      const name = l.name || l.rawText || '';
      const h = Math.max(14, doc.heightOfString(name, { width: xQty - xDesc - 6, align: 'left' }) + 3);
      if (y + h > yColsBottom - 4) { /* overflow guard: keep on page, shop sheets are single-page */ }
      txt(i + 1, left, xDesc - left, y, 'center');
      txt(name, xDesc, xQty - xDesc, y, 'left');
      txt(`${l.qty ?? ''} ${l.uom || ''}`.trim(), xQty, xRate - xQty, y, 'center');
      txt(money(l.rate), xRate, xAmt - xRate, y, 'right');
      txt(money(l.amount), xAmt, right - xAmt, y, 'right');
      y += h;
    });

    // ---- totals inside the ledger (above the grand band) ----
    const totalLabelX = xQty;                 // labels sit around Qty/Rate area
    const labelW = xAmt - totalLabelX - 4;
    txt('Total', totalLabelX, labelW, yColsBottom - 34, 'right', 'Helvetica', 10);
    txt(money(quote.total), xAmt, right - xAmt, yColsBottom - 34, 'right', 'Helvetica', 10);
    txt('Rounded off', totalLabelX, labelW, yColsBottom - 18, 'right', 'Helvetica', 10);
    txt(money(quote.roundOff), xAmt, right - xAmt, yColsBottom - 18, 'right', 'Helvetica', 10);

    // ---- grid lines (drawn last so text never sits under them) ----
    hline(left, right, yColsBottom);
    xVerticals.forEach((x) => vline(x, yHead, yColsBottom));
    vline(xQty, yMetaTop - 6, yHead);         // meta divider continues the Qty column upward

    // ---- grand total band ----
    txt('Total', xRate - 40, xAmt - (xRate - 40) - 4, yColsBottom + 6, 'right', 'Helvetica-Bold', 11);
    txt(money(quote.negotiatedTotal != null ? quote.negotiatedTotal : quote.grandTotal),
      xAmt, right - xAmt, yColsBottom + 6, 'right', 'Helvetica-Bold', 11);
    vline(xAmt, yColsBottom, yGrandBottom);
    hline(left, right, yGrandBottom);

    // ---- outer frame ----
    doc.rect(left, yTop, W, yGrandBottom - yTop).lineWidth(1).strokeColor('#000').stroke();

    // ---- footer: words (left) + validity (right), below the frame ----
    const words = rupeesInWords(quote.negotiatedTotal != null ? quote.negotiatedTotal : quote.grandTotal);
    txt(`Rupees ${cap(words)} only`, left, W * 0.6, yGrandBottom + 8, 'left', 'Helvetica', 9.5);
    txt('Quotation Valid for One Week Only', left + W * 0.5, W * 0.5, yGrandBottom + 8, 'right', 'Helvetica', 9.5);

    doc.end();
  });
}

/** Returns the archived PDF path, regenerating from stored data if the file is gone. */
async function ensurePdf(quote) {
  if (quote.docNumber == null) throw new Error('Quotation has no number yet - issue it first.');
  const file = pdfPath(quote.docNumber);
  if (!fs.existsSync(file)) await render(quote, file);
  return file;
}

module.exports = { ensurePdf, pdfPath, rupeesInWords };
