'use strict';
require('dotenv').config();

const express = require('express');
const fs = require('fs');
const path = require('path');

const { extractFromImage, extractFromAudio, extractFromVoiceText } = require('./services/extract');
const { matchExtractedLines, matchRawLines, searchItems, items } = require('./services/matcher');
const itemsStore = require('./services/itemsStore');
const learning = require('./services/learning');
const pricing = require('./services/pricing');
const quotations = require('./services/quotations-store');
const quotationPdf = require('./services/quotation-pdf');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/health', (_req, res) => {
  const provider = process.env.VISION_PROVIDER || 'anthropic';
  // Same key requirement now covers both paths: Gemini listens to voice
  // directly, Anthropic structures a browser-transcribed script - either
  // way it's the configured provider's own key that has to be set.
  const providerReady = provider === 'gemini' ? !!process.env.GEMINI_API_KEY : !!process.env.ANTHROPIC_API_KEY;
  res.json({
    ok: true,
    items: items.length,
    visionProvider: provider,
    visionReady: providerReady,
    voiceReady: providerReady,
    learnedAliases: Object.keys(learning.all()).length,
  });
});

app.get('/api/items', (req, res) => {
  res.json(searchItems(req.query.q, Number(req.query.limit) || 25));
});

app.get('/api/price-categories', (_req, res) => {
  res.json(pricing.listCategories());
});

/** Body: { discountPct } - changes the global % for this category, applied to every item that has no override. */
app.put('/api/price-categories/:code', (req, res) => {
  try {
    pricing.setCategoryDiscount(req.params.code, req.body.discountPct);
    res.json(pricing.listCategories());
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/** Body: { discountPct } or { fixedPrice } - overrides one item's price in one category. */
app.put('/api/items/:sku/overrides/:code', (req, res) => {
  try {
    pricing.setOverride(req.params.sku, req.params.code, req.body || {});
    const item = items.find((i) => i.sku === req.params.sku);
    res.json(pricing.decorate(item));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/items/:sku/overrides/:code', (req, res) => {
  try {
    pricing.clearOverride(req.params.sku, req.params.code);
    const item = items.find((i) => i.sku === req.params.sku);
    res.json(pricing.decorate(item));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/** Body: { sku, name, brand, category, uom, listPrice, attrs, popularity } */
app.post('/api/items', (req, res) => {
  try {
    res.status(201).json(pricing.decorate(itemsStore.addItem(req.body || {})));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/** Body: any subset of the same fields. */
app.put('/api/items/:sku', (req, res) => {
  try {
    res.json(pricing.decorate(itemsStore.updateItem(req.params.sku, req.body || {})));
  } catch (err) {
    res.status(err.message.includes('not found') ? 404 : 400).json({ error: err.message });
  }
});

app.delete('/api/items/:sku', (req, res) => {
  try {
    res.json(itemsStore.removeItem(req.params.sku));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

/** Body: { image: "<base64>", mediaType: "image/jpeg" } */
app.post('/api/extract', async (req, res) => {
  try {
    const { image, mediaType, priceCategory } = req.body || {};
    if (!image) return res.status(400).json({ error: 'Attach an image to read.' });

    // "SAMPLE" loads the bundled sheet without calling the vision model.
    const result = image === 'SAMPLE'
      ? { provider: 'sample', note: 'Bundled sample sheet', lines: require('./data/sample-sheet.json').lines }
      : await extractFromImage(image, mediaType || 'image/jpeg');
    res.json({
      provider: result.provider,
      note: result.note || null,
      lines: matchExtractedLines(result.lines, priceCategory),
    });
  } catch (err) {
    res.status(502).json({ error: `Could not read the sheet: ${err.message}` });
  }
});

/** Body: { audio: "<base64>", mediaType: "audio/webm" } - always reads via Gemini. */
app.post('/api/extract-voice', async (req, res) => {
  try {
    const { audio, mediaType, priceCategory } = req.body || {};
    if (!audio) return res.status(400).json({ error: 'Record something to read.' });

    // "SAMPLE" loads the bundled sheet without calling the vision model.
    const result = audio === 'SAMPLE'
      ? { provider: 'sample', note: 'Bundled sample sheet', lines: require('./data/sample-sheet.json').lines }
      : await extractFromAudio(audio, mediaType || 'audio/webm');
    res.json({
      provider: result.provider,
      note: result.note || null,
      lines: matchExtractedLines(result.lines, priceCategory),
    });
  } catch (err) {
    res.status(502).json({ error: `Could not read the recording: ${err.message}` });
  }
});

/**
 * Body: { text: "raw speech-to-text transcript" } - the Anthropic voice path.
 * Anthropic's API can't listen to audio, so the browser's own speech
 * recognition (see public/app.js) does the listening; this just structures
 * the resulting transcript, same provider switch as /api/extract.
 */
app.post('/api/extract-voice-text', async (req, res) => {
  try {
    const text = String((req.body || {}).text || '').trim();
    const priceCategory = (req.body || {}).priceCategory;
    if (!text) return res.status(400).json({ error: 'Nothing was heard.' });

    // "SAMPLE" loads the bundled sheet without calling the language model.
    const result = text === 'SAMPLE'
      ? { provider: 'sample', note: 'Bundled sample sheet', lines: require('./data/sample-sheet.json').lines }
      : await extractFromVoiceText(text);
    res.json({
      provider: result.provider,
      note: result.note || null,
      lines: matchExtractedLines(result.lines, priceCategory),
    });
  } catch (err) {
    res.status(502).json({ error: `Could not structure the recording: ${err.message}` });
  }
});

/** Body: { text: "one item per line", priceCategory } - the typed fallback. */
app.post('/api/parse-text', (req, res) => {
  const lines = String(req.body.text || '').split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return res.status(400).json({ error: 'Type at least one line.' });
  res.json({ provider: 'text', lines: matchRawLines(lines, req.body.priceCategory) });
});

/** Body: { text, qty, priceCategory } - re-run one edited line through the matcher. */
app.post('/api/rematch', (req, res) => {
  const text = String(req.body.text || '').trim();
  if (!text) return res.status(400).json({ error: 'Line is empty.' });
  const [line] = matchRawLines([text], req.body.priceCategory);
  if (req.body.qty != null) {
    line.qty = Number(req.body.qty);
    line.amount = Math.round(line.rate * line.qty * 100) / 100;
  }
  res.json(line);
});

/** Body: { text, sku } - remember this correction for next time. */
app.post('/api/learn', (req, res) => {
  const { text, sku } = req.body || {};
  if (!text || !sku) return res.status(400).json({ error: 'Both text and sku are required.' });
  learning.record(text, sku);
  res.json({ ok: true, learned: Object.keys(learning.all()).length });
});

app.get('/api/quotations', (_req, res) => res.json(quotations.list()));

app.get('/api/quotations/:id', (req, res) => {
  const q = quotations.get(Number(req.params.id));
  if (!q) return res.status(404).json({ error: 'Quotation not found.' });
  res.json(q);
});

// Save. Creates a draft, or updates an existing draft when an id is supplied.
// A draft has a stable internal id but no customer-facing number yet.
app.post('/api/quotations', (req, res) => {
  try {
    const id = req.body.id != null ? Number(req.body.id) : null;
    const q = id ? quotations.updateDraft(id, req.body) : quotations.createDraft(req.body);
    res.json(q);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Issue (finalise/print). Mints the linear number once, atomically. Idempotent:
// issuing an already-issued quote returns the same number (a reprint).
app.post('/api/quotations/:id/issue', (req, res) => {
  try {
    const q = quotations.issue(Number(req.params.id));
    res.json(q);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// The archived, numbered PDF - reprintable identically from any device.
app.get('/api/quotations/:id/pdf', async (req, res) => {
  try {
    const q = quotations.get(Number(req.params.id));
    if (!q) return res.status(404).json({ error: 'Quotation not found.' });
    if (q.docNumber == null) return res.status(409).json({ error: 'Quotation is not issued yet.' });
    const file = await quotationPdf.ensurePdf(q);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="quotation-${q.docNumber}.pdf"`);
    fs.createReadStream(file).pipe(res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Limras quotation desk -> http://localhost:${PORT}`);
  console.log(`Item master: ${items.length} SKUs`);
  const ready = !!(process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY);
  console.log(ready ? 'Vision: live' : 'Vision: no key set, uploads load the bundled sample sheet');
});
