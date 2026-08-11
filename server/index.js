'use strict';
require('dotenv').config();

const express = require('express');
const fs = require('fs');
const path = require('path');

const { extractFromImage } = require('./services/extract');
const { matchExtractedLines, matchRawLines, searchItems, items } = require('./services/matcher');
const learning = require('./services/learning');

const app = express();
const PORT = process.env.PORT || 3000;
const QUOTES = path.join(__dirname, 'data', 'quotations.json');

app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

const readQuotes = () => {
  try { return JSON.parse(fs.readFileSync(QUOTES, 'utf8')); } catch { return []; }
};
const writeQuotes = (q) => fs.writeFileSync(QUOTES, JSON.stringify(q, null, 2));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    items: items.length,
    visionProvider: process.env.VISION_PROVIDER || 'anthropic',
    visionReady: !!(process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY),
    learnedAliases: Object.keys(learning.all()).length,
  });
});

app.get('/api/items', (req, res) => {
  res.json(searchItems(req.query.q, Number(req.query.limit) || 25));
});

/** Body: { image: "<base64>", mediaType: "image/jpeg" } */
app.post('/api/extract', async (req, res) => {
  try {
    const { image, mediaType } = req.body || {};
    if (!image) return res.status(400).json({ error: 'Attach an image to read.' });

    // "SAMPLE" loads the bundled sheet without calling the vision model.
    const result = image === 'SAMPLE'
      ? { provider: 'sample', note: 'Bundled sample sheet', lines: require('./data/sample-sheet.json').lines }
      : await extractFromImage(image, mediaType || 'image/jpeg');
    res.json({
      provider: result.provider,
      note: result.note || null,
      lines: matchExtractedLines(result.lines),
    });
  } catch (err) {
    res.status(502).json({ error: `Could not read the sheet: ${err.message}` });
  }
});

/** Body: { text: "one item per line" } - the typed fallback. */
app.post('/api/parse-text', (req, res) => {
  const lines = String(req.body.text || '').split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return res.status(400).json({ error: 'Type at least one line.' });
  res.json({ provider: 'text', lines: matchRawLines(lines) });
});

/** Body: { text, qty } - re-run one edited line through the matcher. */
app.post('/api/rematch', (req, res) => {
  const text = String(req.body.text || '').trim();
  if (!text) return res.status(400).json({ error: 'Line is empty.' });
  const [line] = matchRawLines([text]);
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

app.get('/api/quotations', (_req, res) => res.json(readQuotes()));

app.post('/api/quotations', (req, res) => {
  const all = readQuotes();
  const number = 6885 + all.length;
  const quote = {
    number,
    createdAt: new Date().toISOString(),
    customer: req.body.customer || 'QUOTATION',
    salesman: req.body.salesman || 'DIRECT SMAN',
    lines: req.body.lines || [],
    total: req.body.total || 0,
    roundOff: req.body.roundOff || 0,
    grandTotal: req.body.grandTotal || 0,
    negotiatedTotal: req.body.negotiatedTotal ?? null,
  };
  all.push(quote);
  writeQuotes(all);
  res.json(quote);
});

app.listen(PORT, () => {
  console.log(`Limras quotation desk -> http://localhost:${PORT}`);
  console.log(`Item master: ${items.length} SKUs`);
  const ready = !!(process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY);
  console.log(ready ? 'Vision: live' : 'Vision: no key set, uploads load the bundled sample sheet');
});
