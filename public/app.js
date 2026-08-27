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
let priceCategory = 'list';
let priceCategories = [];
let currentQuoteId = null;    // internal id, set on first save
let currentDocNumber = null;  // linear number, set once the quote is issued

/* ───────────────────────────────────────────── data in */

async function post(url, body, timeoutMs = 60000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`Timed out after ${Math.round(timeoutMs / 1000)}s — try a shorter recording, or check your connection.`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('Could not read that file'));
    r.readAsDataURL(file);
  });
}

let pendingImage = null;

async function showImagePreview(file) {
  const dataUrl = await readFile(file);
  $('previewImg').src = dataUrl;
  $('preview').hidden = false;
  pendingImage = {
    image: dataUrl.split(',')[1],
    mediaType: (dataUrl.match(/^data:(.*?);/) || [])[1] || 'image/jpeg',
  };
  $('btnSubmitImage').disabled = false;
  $('btnSubmitImage').textContent = 'Submit for reading';
  setStatus('Photo ready — press Submit to read it', 'idle');
}

async function submitImage() {
  if (!pendingImage) return;
  $('btnSubmitImage').disabled = true;
  $('btnSubmitImage').textContent = 'Reading…';
  setStatus('Reading the sheet…', 'idle');
  try {
    const out = await post('/api/extract', { ...pendingImage, priceCategory });
    lines = out.lines;
    resetQuoteIdentity();
    render();
    setStatus(out.note ? 'Sample sheet' : `Read by AI`, out.note ? 'idle' : 'live');
  } catch (err) {
    setStatus(err.message, 'idle');
  } finally {
    $('btnSubmitImage').disabled = false;
    $('btnSubmitImage').textContent = 'Submit for reading';
  }
}

async function loadTyped() {
  const text = $('typedText').value;
  if (!text.trim()) return;
  try {
    const out = await post('/api/parse-text', { text, priceCategory });
    lines = out.lines;
    resetQuoteIdentity();
    $('preview').hidden = true;
    render();
    setStatus('Read from typed list', 'live');
  } catch (err) {
    setStatus(err.message, 'idle');
  }
}

/* ───────────────────────────────────────────── voice */

// Gemini can listen to the actual recording (best accuracy for accented trade
// speech). Anthropic's API can't accept audio at all, so when that's the
// configured provider, the browser's own speech recognition does the
// listening and we send it the resulting text instead. Set from /api/health.
let visionProvider = 'anthropic';

let pendingVoicePayload = null; // { type: 'audio', blob } | { type: 'text', text } - awaiting a merge/new-list choice

/** Ticks the status line with elapsed seconds so a slow response doesn't read as a frozen page. */
function startElapsedTicker(label) {
  const start = Date.now();
  $('recStatus').textContent = `${label}… 0s`;
  const id = setInterval(() => {
    $('recStatus').textContent = `${label}… ${Math.round((Date.now() - start) / 1000)}s`;
  }, 1000);
  return () => clearInterval(id);
}

async function fetchVoiceResult(payload) {
  if (payload.type === 'audio') {
    const base64 = await blobToBase64(payload.blob);
    return post('/api/extract-voice', { audio: base64, mediaType: payload.blob.type || 'audio/webm', priceCategory });
  }
  return post('/api/extract-voice-text', { text: payload.text, priceCategory });
}

async function runVoiceExtraction(payload, mode) {
  $('voiceDestRow').hidden = true;
  const stopTicker = startElapsedTicker(payload.type === 'audio' ? 'Reading the recording' : 'Structuring the list');
  try {
    const out = await fetchVoiceResult(payload);
    lines = mode === 'merge' ? lines.concat(out.lines) : out.lines;
    if (mode !== 'merge') resetQuoteIdentity();
    $('preview').hidden = true;
    render();
    setStatus(out.note ? 'Sample sheet (voice)' : `Read by AI Voice`, out.note ? 'idle' : 'live');
    $('recStatus').textContent = out.note
      || (mode === 'merge' ? `Merged ${out.lines.length} line${out.lines.length === 1 ? '' : 's'} in.` : 'Done — check the rows below.');
  } catch (err) {
    $('recStatus').textContent = err.message;
  } finally {
    stopTicker();
    pendingVoicePayload = null;
  }
}

/**
 * Nothing loaded yet means there's nothing to merge into, so the very first
 * recording in a session processes immediately, same as before. Once a list
 * exists, a second recording asks first: merge in, or replace it.
 */
function finishRecording(payload) {
  setRecordingUi(false);
  if (lines.length === 0) {
    runVoiceExtraction(payload, 'new');
    return;
  }
  pendingVoicePayload = payload;
  $('recStatus').textContent = 'Merge with the current list, or start a new one?';
  $('voiceDestRow').hidden = false;
}

function setRecordingUi(isRecording) {
  $('btnRecord').textContent = isRecording ? 'Stop recording' : 'Start recording';
  $('btnRecord').classList.toggle('recording', isRecording);
}

/* -- Gemini: record audio, upload the clip -- */

let mediaRecorder = null;
let audioChunks = [];

function pickAudioMimeType() {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg'];
  return candidates.find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result.split(',')[1]);
    r.onerror = () => reject(new Error('Could not read the recording'));
    r.readAsDataURL(blob);
  });
}

async function toggleGeminiRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    return;
  }
  if (!navigator.mediaDevices || !window.MediaRecorder) {
    $('recStatus').textContent = 'This browser cannot record audio.';
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = pickAudioMimeType();
    mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    audioChunks = [];
    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
    mediaRecorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(audioChunks, { type: mediaRecorder.mimeType || mimeType || 'audio/webm' });
      finishRecording({ type: 'audio', blob });
    };
    mediaRecorder.start();
    setRecordingUi(true);
    $('recStatus').textContent = 'Listening…';
  } catch (err) {
    $('recStatus').textContent = `Microphone error: ${err.message}`;
  }
}

/* -- Anthropic: browser transcribes speech, server structures the text -- */

let recognition = null;

function pickSpeechRecognition() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function toggleAnthropicRecording() {
  if (recognition) {
    recognition.stop();
    return;
  }
  const SpeechRecognition = pickSpeechRecognition();
  if (!SpeechRecognition) {
    $('recStatus').textContent = 'This browser cannot recognize speech - try Chrome or Edge.';
    return;
  }
  recognition = new SpeechRecognition();
  recognition.lang = 'en-IN';
  recognition.continuous = true;
  recognition.interimResults = false;

  let transcript = '';
  recognition.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) transcript += `${e.results[i][0].transcript} `;
    }
  };
  recognition.onerror = (e) => { $('recStatus').textContent = `Speech recognition error: ${e.error}`; };
  recognition.onend = () => {
    recognition = null;
    if (transcript.trim()) finishRecording({ type: 'text', text: transcript.trim() });
    else { setRecordingUi(false); $('recStatus').textContent = 'Nothing heard — try again.'; }
  };

  recognition.start();
  setRecordingUi(true);
  $('recStatus').textContent = 'Listening…';
}

function toggleRecording() {
  if (visionProvider === 'gemini') toggleGeminiRecording();
  else toggleAnthropicRecording();
}

async function loadSample() {
  setStatus('Loading sample…', 'idle');
  try {
    const out = await post('/api/extract', { image: 'SAMPLE', mediaType: 'image/jpeg', priceCategory });
    lines = out.lines;
    resetQuoteIdentity();
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

  const cats = priceCategories.length ? priceCategories : [{ code: 'list', label: 'List' }];
  l.priceCategory = l.priceCategory || priceCategory || cats[0].code;
  const pcatOpts = cats
    .map((c) => `<option value="${c.code}"${c.code === l.priceCategory ? ' selected' : ''}>${c.label}</option>`)
    .join('');

  tr.innerHTML = `
    <td class="cell-no">${i + 1}</td>
    <td class="cell-item">
      <button class="item-name${l.item ? '' : ' none'}" data-act="pick">${name}</button>${conf}
      <span class="raw">${l.rawText}${inherited}</span>
      ${reason}
    </td>
    <td class="cell-qty" data-label="Qty"><input type="number" step="any" min="0" value="${l.qty}" data-act="qty" aria-label="Quantity" />${qtyExpr}</td>
    <td class="cell-uom" data-label="UOM">${l.uom || ''}</td>
    <td class="cell-pcat" data-label="Price cat"><select data-act="pcat" aria-label="Price category for line ${i + 1}">${pcatOpts}</select></td>
    <td class="cell-rate" data-label="Rate"><input type="number" step="0.01" min="0" value="${l.rate}" data-act="rate" aria-label="Rate" /></td>
    <td class="cell-amt" data-label="Amount">${money(l.amount)}</td>
    <td class="cell-act"><button class="row-cancel" data-act="del" aria-label="Cancel line ${i + 1}">Cancel</button></td>
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
  tr.querySelector('[data-act="pcat"]').addEventListener('change', (e) => {
    const l2 = lines[i];
    l2.priceCategory = e.target.value;
    if (l2.item && l2.item.rates && l2.item.rates[l2.priceCategory] != null) {
      l2.rate = l2.item.rates[l2.priceCategory];
      const rateInput = tr.querySelector('[data-act="rate"]');
      if (rateInput) rateInput.value = l2.rate;
    }
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

/** The global selector sets every row to one category and re-rates from cached rates, no re-fetch needed. Individual rows can still be changed afterwards. */
function applyPriceCategory() {
  lines.forEach((l) => {
    l.priceCategory = priceCategory;
    if (l.item && l.item.rates && l.item.rates[priceCategory] != null) {
      l.rate = l.item.rates[priceCategory];
      l.amount = Math.round(l.rate * l.qty * 100) / 100;
    }
  });
  render();
}

async function loadPriceCategories() {
  try {
    const cats = await (await fetch('/api/price-categories')).json();
    priceCategories = cats;
    $('priceCategory').innerHTML = cats.map((c) => `<option value="${c.code}">${c.label}</option>`).join('');
    priceCategory = cats[0] ? cats[0].code : 'list';
  } catch { /* select stays empty; rates fall back to server default */ }
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
  const pc = (pickerRow != null && lines[pickerRow] && lines[pickerRow].priceCategory) || priceCategory;
  for (const it of items) {
    const li = document.createElement('li');
    const conf = it.confidence != null ? `<span class="p-conf">${it.confidence}%</span>` : '';
    const rate = it.rates && it.rates[pc] != null ? it.rates[pc] : it.rate;
    li.innerHTML = `
      <button type="button">
        <span>${it.name}<span class="p-sku">${it.sku} · ${it.brand}</span></span>
        <span class="p-rate">${money(rate)} / ${it.uom} ${conf}</span>
      </button>`;
    li.querySelector('button').addEventListener('click', () => choose(it));
    ul.appendChild(li);
  }
}

async function choose(item) {
  const l = lines[pickerRow];
  const pc = l.priceCategory || priceCategory;
  l.item = item;
  l.rate = item.rates && item.rates[pc] != null ? item.rates[pc] : item.rate;
  l.uom = item.uom;
  l.state = 'confirmed';
  l.reasons = [];
  l.confidence = 100;
  l.source = 'manual';
  l.amount = Math.round(l.rate * l.qty * 100) / 100;
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

/** A freshly-read sheet is a new quotation - forget any prior draft/number. */
function resetQuoteIdentity() {
  currentQuoteId = null;
  currentDocNumber = null;
  $('btnPrint').textContent = 'Print';
  $('saveMsg').textContent = '';
}

function quotePayload() {
  const total = lines.reduce((s, l) => s + Number(l.amount || 0), 0);
  const grand = Math.round(total);
  return {
    id: currentQuoteId,
    customer: $('custName').value || 'QUOTATION',
    salesman: $('salesman').value,
    lines: lines.map((l) => ({
      rawText: l.rawText, description: l.description,
      sku: l.item ? l.item.sku : null, name: l.item ? l.item.name : null,
      qtyExpression: l.qtyExpression, qty: l.qty, uom: l.uom,
      rate: l.rate, amount: l.amount, state: l.state, source: l.source,
      priceCategory: l.priceCategory || priceCategory,
    })),
    total, roundOff: grand - total, grandTotal: grand,
    negotiatedTotal: Number($('negotiated').value) || null,
    priceCategory,
  };
}

/** Save persists a draft (or updates the current one). No number is issued yet. */
async function saveQuote() {
  if (currentDocNumber != null) {
    $('saveMsg').textContent = `Quotation ${currentDocNumber} is already issued. Start over for a new one.`;
    return;
  }
  try {
    const q = await post('/api/quotations', quotePayload());
    currentQuoteId = q.id;
    $('saveMsg').textContent = `Saved as draft (not yet numbered). Print to issue a number.`;
  } catch (err) {
    $('saveMsg').textContent = err.message;
  }
}

/**
 * Print = issue. Persists the latest edits, mints the linear number once (the
 * server does this atomically), then opens the archived numbered PDF - which is
 * what prints, on desktop or mobile. Re-printing reuses the same number.
 */
async function issueAndPrint() {
  try {
    if (currentDocNumber == null) {
      const saved = await post('/api/quotations', quotePayload());
      currentQuoteId = saved.id;
      const issued = await post(`/api/quotations/${currentQuoteId}/issue`, {});
      currentDocNumber = issued.docNumber;
      $('saveMsg').textContent = `Issued as quotation ${currentDocNumber}.`;
      $('btnPrint').textContent = `Reprint ${currentDocNumber}`;
    }
    window.open(`/api/quotations/${currentQuoteId}/pdf`, '_blank');
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
  if (f) showImagePreview(f);
});
$('fileInput').addEventListener('change', (e) => {
  if (e.target.files[0]) showImagePreview(e.target.files[0]);
});

$('btnSubmitImage').addEventListener('click', submitImage);
$('btnParseText').addEventListener('click', loadTyped);
$('btnRecord').addEventListener('click', toggleRecording);
$('btnVoiceMerge').addEventListener('click', () => {
  if (pendingVoicePayload) runVoiceExtraction(pendingVoicePayload, 'merge');
});
$('btnVoiceNewList').addEventListener('click', () => {
  if (pendingVoicePayload) runVoiceExtraction(pendingVoicePayload, 'new');
});
$('btnSample').addEventListener('click', loadSample);
$('btnSave').addEventListener('click', saveQuote);
$('btnPrint').addEventListener('click', issueAndPrint);
$('btnNew').addEventListener('click', () => {
  lines = [];
  pendingImage = null;
  pendingVoicePayload = null;
  currentQuoteId = null;
  currentDocNumber = null;
  $('btnPrint').textContent = 'Print';
  $('preview').hidden = true;
  $('voiceDestRow').hidden = true;
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

$('priceCategory').addEventListener('change', (e) => {
  priceCategory = e.target.value;
  applyPriceCategory();
});

fetch('/api/health').then((r) => r.json()).then((h) => {
  visionProvider = h.visionProvider || 'anthropic';
  setStatus(h.visionReady ? `${h.items} items · vision live` : `${h.items} items · sample mode`,
    h.visionReady ? 'live' : 'idle');
});

loadPriceCategories();
render();
