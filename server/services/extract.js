'use strict';
const fs = require('fs');
const path = require('path');

const PROMPT = `You are reading a handwritten materials list from a customer at an electrical goods counter in Tamil Nadu, India.

Transcribe every line item. Rules:

1. A double-quote or ditto mark under a word means "same as the line above". Expand it. If line 8 reads "19x6 star screw - 150" and line 9 reads "25x6 " - 100", line 9 is "25x6 star screw".
2. Spelling is phonetic and often wrong. Transcribe what is WRITTEN, not what you think it should be. Write "switan" if that is what is on the page. Downstream code handles the correction.
3. Quantities are often written as a sum across rooms, like "2+1+2+5+2". Return that expression verbatim in qty_expression, and its total in qty.
4. If a total is already written to the right (after "="), use it as qty and note it in stated_qty.
5. Ignore struck-through numbers. Use the correction written beside them.
6. Ignore headers, dates, page numbers, and the customer's name.
7. Do not add brands or sizes that are not on the page. Missing detail is expected and is handled later.

Return ONLY a JSON object, no prose and no markdown fences:
{"lines":[{"raw":"<transcribed text with quantity removed>","qty_expression":"2+1+2+5+2"|null,"qty":12,"stated_qty":12|null,"confidence":0.0-1.0}]}`;

async function callAnthropic(base64, mediaType) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: PROMPT },
        ],
      }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
}

async function callGemini(base64, mediaType) {
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ inline_data: { mime_type: mediaType, data: base64 } }, { text: PROMPT }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 4000 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.candidates[0].content.parts.map((p) => p.text || '').join('\n');
}

function parseJsonLoose(text) {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Model did not return JSON');
  return JSON.parse(cleaned.slice(start, end + 1));
}

function fixture() {
  const p = path.join(__dirname, '..', 'data', 'sample-sheet.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

/**
 * Returns { lines, provider }. Falls back to the bundled sample sheet when no
 * key is configured so the demo runs with no external dependency.
 */
async function extractFromImage(base64, mediaType) {
  const provider = process.env.VISION_PROVIDER || 'anthropic';
  const hasKey = provider === 'gemini' ? !!process.env.GEMINI_API_KEY : !!process.env.ANTHROPIC_API_KEY;

  if (!hasKey) {
    return { lines: fixture().lines, provider: 'sample', note: 'No API key set - loaded the bundled sample sheet' };
  }
  const raw = provider === 'gemini' ? await callGemini(base64, mediaType) : await callAnthropic(base64, mediaType);
  const parsed = parseJsonLoose(raw);
  return { lines: parsed.lines || [], provider };
}

module.exports = { extractFromImage, PROMPT };
