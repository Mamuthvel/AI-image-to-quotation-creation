/* Limras Quotation Desk — counter-side logic. */
'use strict';

const $ = (id) => document.getElementById(id);
const money = (n) => Number(n || 0).toFixed(2);

const STATE_LABEL = {
  confirmed: 'Confirmed',
  assumed: 'Assumed',
  ambiguous: 'Check this',
  low: 'Check this',
  unmatched: 'No match',
};

let lines = [];
let pickerRow = null;

/* ───────────────────────────────────────────── data in */

async function post(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('Could not read that file'));
    r.readAsDataURL(file);
  });
}

async function loadImage(file) {
  const dataUrl = await readFile(file);
  $('previewImg').src = dataUrl;
  $('preview').hidden = false;
  setStatus('Reading the sheet…', 'idle');

  const base64 = dataUrl.split(',')[1];
  const mediaType = (dataUrl.match(/^data:(.*?);/) || [])[1] || 'image/jpeg';
  try {
    const out = await post('/api/extract', { image: base64, mediaType });
    lines = out.lines;
    render();
    setStatus(out.note ? 'Sample sheet' : `Read by ${out.provider}`, out.note ? 'idle' : 'live');
  } catch (err) {
    setStatus(err.message, 'idle');
  }
}

async function loadTyped() {
  const text = $('typedText').value;
  if (!text.trim()) return;
  try {
    const out = await post('/api/parse-text', { text });
    lines = out.lines;
    $('preview').hidden = true;
    render();
    setStatus('Read from typed list', 'live');
  } catch (err) {
    setStatus(err.message, 'idle');
  }
}

async function loadSample() {
  setStatus('Loading sample…', 'idle');
  try {
    const out = await post('/api/extract', { image: 'SAMPLE', mediaType: 'image/jpeg' });
    lines = out.lines;
    render();
    setStatus('Sample sheet', 'idle');
  } catch (err) {
    setStatus(err.message, 'idle');
  }
}

/* ───────────────────────────────────────────── render */

function setStatus(text, kind) {
  const el = $('statusPill');
  el.textContent = text;
  el.className = `pill pill-${kind === 'live' ? 'live' : 'idle'}`;
}

function render() {
  const has = lines.length > 0;
  $('emptyState').hidden = has;
  $('workspace').hidden = !has;
  if (!has) return;

  const tbody = $('rows');
  tbody.innerHTML = '';
  lines.forEach((l, i) => tbody.appendChild(rowEl(l, i)));
  renderTotals();
  renderAttention();
}

function rowEl(l, i) {
  const tr = document.createElement('tr');
  tr.dataset.state = l.state;

  const inherited = l.inheritedFrom
    ? ` <em>(read as “${l.inheritedFrom}” from the line above)</em>` : '';
  const reason = l.reasons && l.reasons.length
    ? `<span class="reason">${l.reasons[0]}</span>` : '';
  const conf = l.item ? `<span class="conf">${l.confidence}%</span>` : '';
  const name = l.item ? l.item.name : 'Pick an item';

  const qtyExpr = l.qtyExpression
    ? `<span class="qty-expr${l.qtyConflict ? ' qty-clash' : ''}">${l.qtyExpression}</span>` : '';

  tr.innerHTML = `
    <td class="cell-no">${i + 1}</td>
    <td>
      <button class="item-name${l.item ? '' : ' none'}" data-act="pick">${name}</button>${conf}
      <span class="raw">${l.rawText}${inherited}</span>
      ${reason}
    </td>
    <td><input type="number" step="any" min="0" value="${l.qty}" data-act="qty" aria-label="Quantity" />${qtyExpr}</td>
    <td class="cell-uom">${l.uom || ''}</td>
    <td class="cell-rate"><input type="number" step="0.01" min="0" value="${l.rate}" data-act="rate" aria-label="Rate" /></td>
    <td class="cell-amt">${money(l.amount)}</td>
    <td><button class="row-del" data-act="del" aria-label="Remove line ${i + 1}">&times;</button></td>
  `;

  tr.querySelector('[data-act="pick"]').addEventListener('click', () => openPicker(i));
  tr.querySelector('[data-act="del"]').addEventListener('click', () => {
    lines.splice(i, 1);
    render();
  });
  tr.querySelector('[data-act="qty"]').addEventListener('input', (e) => {
    lines[i].qty = Number(e.target.value) || 0;
    recalc(i);
  });
  tr.querySelector('[data-act="rate"]').addEventListener('input', (e) => {
    lines[i].rate = Number(e.target.value) || 0;
    recalc(i);
  });
  return tr;
}

function recalc(i) {
  const l = lines[i];
  l.amount = Math.round(l.rate * l.qty * 100) / 100;
  const tr = $('rows').children[i];
  if (tr) tr.querySelector('.cell-amt').textContent = money(l.amount);
  renderTotals();
}

function renderTotals() {
  const total = lines.reduce((s, l) => s + Number(l.amount || 0), 0);
  const grand = Math.round(total);
  $('tTotal').textContent = money(total);
  $('tRound').textContent = money(grand - total);
  $('tGrand').textContent = money(grand);
}

function renderAttention() {
  const el = $('attention');
  const needs = lines.filter((l) => ['ambiguous', 'low', 'unmatched'].includes(l.state)).length;
  const assumed = lines.filter((l) => l.state === 'assumed').length;
  el.hidden = false;
  if (needs === 0) {
    el.className = 'attention clear';
    el.textContent = assumed
      ? `Nothing blocking. ${assumed} line${assumed > 1 ? 's' : ''} used shop defaults.`
      : 'Every line matched cleanly.';
  } else {
    el.className = 'attention';
    el.textContent = `${needs} line${needs > 1 ? 's need' : ' needs'} your eye before printing.`;
  }
}

/* ───────────────────────────────────────────── picker */

function openPicker(i) {
  pickerRow = i;
  const l = lines[i];
  $('pickerRaw').textContent = `Customer wrote: ${l.rawText}`;
  $('pickerSearch').value = '';
  drawPickerList(l.candidates || []);
  $('picker').hidden = false;
  $('pickerSearch').focus();
}

function closePicker() {
  $('picker').hidden = true;
  pickerRow = null;
}

function drawPickerList(items) {
  const ul = $('pickerList');
  ul.innerHTML = '';
  if (!items.length) {
    ul.innerHTML = '<li><button type="button" disabled>Nothing matches that search.</button></li>';
    return;
  }
  for (const it of items) {
    const li = document.createElement('li');
    const conf = it.confidence != null ? `<span class="p-conf">${it.confidence}%</span>` : '';
    li.innerHTML = `
      <button type="button">
        <span>${it.name}<span class="p-sku">${it.sku} · ${it.brand}</span></span>
        <span class="p-rate">${money(it.rate)} / ${it.uom} ${conf}</span>
      </button>`;
    li.querySelector('button').addEventListener('click', () => choose(it));
    ul.appendChild(li);
  }
}

async function choose(item) {
  const l = lines[pickerRow];
  l.item = { sku: item.sku, name: item.name, brand: item.brand };
  l.rate = item.rate;
  l.uom = item.uom;
  l.state = 'confirmed';
  l.reasons = [];
  l.confidence = 100;
  l.source = 'manual';
  l.amount = Math.round(item.rate * l.qty * 100) / 100;
  closePicker();
  render();
  try { await post('/api/learn', { text: l.description, sku: item.sku }); } catch { /* non-blocking */ }
}

let searchTimer;
$('pickerSearch').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  const q = e.target.value;
  searchTimer = setTimeout(async () => {
    if (!q.trim() && pickerRow != null) return drawPickerList(lines[pickerRow].candidates || []);
    const res = await fetch(`/api/items?q=${encodeURIComponent(q)}`);
    drawPickerList(await res.json());
  }, 160);
});

/* ───────────────────────────────────────────── save + print */

function numberToWords(n) {
  const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
    'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  const under100 = (x) => x < 20 ? ones[x] : `${tens[Math.floor(x / 10)]}${x % 10 ? ' ' + ones[x % 10] : ''}`;
  const under1000 = (x) => x < 100 ? under100(x)
    : `${ones[Math.floor(x / 100)]} hundred${x % 100 ? ' and ' + under100(x % 100) : ''}`;
  let num = Math.round(n), out = '';
  const units = [[10000000, 'crore'], [100000, 'lakh'], [1000, 'thousand']];
  for (const [v, label] of units) {
    if (num >= v) { out += `${under1000(Math.floor(num / v))} ${label} `; num %= v; }
  }
  if (num) out += under1000(num);
  return (out.trim() || 'zero').replace(/\b\w/, (c) => c.toUpperCase());
}

function buildPrintDoc() {
  const total = lines.reduce((s, l) => s + Number(l.amount || 0), 0);
  const grand = Math.round(total);
  const neg = Number($('negotiated').value) || null;
  const now = new Date();
  const rows = lines.map((l, i) => `
    <tr>
      <td class="ctr">${i + 1}</td>
      <td>${l.item ? l.item.name : l.rawText}</td>
      <td class="ctr">${l.qty} ${l.uom || ''}</td>
      <td class="num">${money(l.rate)}</td>
      <td class="num">${money(l.amount)}</td>
    </tr>`).join('');

  $('printDoc').innerHTML = `
    <h1>QUOTATION</h1>
    <p class="p-shop">Limras Electricals Agency</p>
    <div class="p-meta">
      <span>TO : ${$('custName').value || 'QUOTATION'}</span>
      <span>DATE : ${now.toLocaleDateString('en-GB')} &nbsp; TIME : ${now.toLocaleTimeString('en-GB')}</span>
      <span>SALESMAN : ${$('salesman').value || 'DIRECT SMAN'}</span>
    </div>
    <table>
      <thead><tr><th>S.No</th><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr><td colspan="4" class="num">Total</td><td class="num">${money(total)}</td></tr>
        <tr><td colspan="4" class="num">Rounded off</td><td class="num">${money(grand - total)}</td></tr>
        <tr><td colspan="4" class="num">Total</td><td class="num">${money(grand)}</td></tr>
        ${neg ? `<tr><td colspan="4" class="num">Agreed price</td><td class="num">${money(neg)}</td></tr>` : ''}
      </tfoot>
    </table>
    <p class="p-words">Rupees ${numberToWords(neg || grand)} only</p>
    <p class="p-valid">Quotation Valid for One Week Only</p>`;
}

async function saveQuote() {
  const total = lines.reduce((s, l) => s + Number(l.amount || 0), 0);
  const grand = Math.round(total);
  try {
    const q = await post('/api/quotations', {
      customer: $('custName').value || 'QUOTATION',
      salesman: $('salesman').value,
      lines: lines.map((l) => ({
        rawText: l.rawText, description: l.description,
        sku: l.item ? l.item.sku : null, name: l.item ? l.item.name : null,
        qtyExpression: l.qtyExpression, qty: l.qty, uom: l.uom,
        rate: l.rate, amount: l.amount, state: l.state, source: l.source,
      })),
      total, roundOff: grand - total, grandTotal: grand,
      negotiatedTotal: Number($('negotiated').value) || null,
    });
    $('saveMsg').textContent = `Saved as quotation ${q.number}.`;
  } catch (err) {
    $('saveMsg').textContent = err.message;
  }
}

/* ───────────────────────────────────────────── wiring */

const dz = $('dropzone');
dz.addEventListener('click', () => $('fileInput').click());
dz.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('fileInput').click(); }
});
['dragenter', 'dragover'].forEach((ev) =>
  dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('over'); }));
['dragleave', 'drop'].forEach((ev) =>
  dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('over'); }));
dz.addEventListener('drop', (e) => {
  const f = e.dataTransfer.files[0];
  if (f) loadImage(f);
});
$('fileInput').addEventListener('change', (e) => {
  if (e.target.files[0]) loadImage(e.target.files[0]);
});

$('btnParseText').addEventListener('click', loadTyped);
$('btnSample').addEventListener('click', loadSample);
$('btnSave').addEventListener('click', saveQuote);
$('btnPrint').addEventListener('click', () => { buildPrintDoc(); window.print(); });
$('btnNew').addEventListener('click', () => {
  lines = [];
  $('preview').hidden = true;
  $('saveMsg').textContent = '';
  $('negotiated').value = '';
  render();
});
$('btnAddRow').addEventListener('click', () => {
  lines.push({
    rawText: '(added at the counter)', description: '', qty: 1, rate: 0, amount: 0,
    uom: 'Nos', state: 'unmatched', reasons: ['Pick an item'], confidence: 0,
    item: null, candidates: [], qtyExpression: null,
  });
  render();
});
$('pickerClose').addEventListener('click', closePicker);
$('picker').addEventListener('click', (e) => { if (e.target === $('picker')) closePicker(); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('picker').hidden) closePicker();
});

fetch('/api/health').then((r) => r.json()).then((h) => {
  setStatus(h.visionReady ? `${h.items} items · vision live` : `${h.items} items · sample mode`,
    h.visionReady ? 'live' : 'idle');
});

render();
