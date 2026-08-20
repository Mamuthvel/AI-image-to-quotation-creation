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

const PROMPT_VOICE = `You are listening to a recording of a customer or shop assistant reading out a materials list at an electrical goods counter in Tamil Nadu, India. The accent is Tamil-English and trade jargon is common.

Transcribe every item mentioned, in the order spoken. Rules:

1. Write your best interpretation of the intended English item description - electrical trade terms and brand names (Anchor, Legrand, GM, Havells, Finolex, Polycab...) are often accented or run together. Do not guess a brand that was not said.
2. Write every number as a digit, not a word - "twenty amp switch" becomes "20 amp switch". This applies inside the item description itself, not just the quantity - downstream matching only recognizes digits.
3. Quantities are sometimes spoken as a sum, like "two plus one plus two". Return that as a "2+1+2" style expression in qty_expression and its total in qty. A single spoken number just goes in qty.
4. Skip greetings, side conversation, and anything that is not a material item.
5. Do not add sizes or specs that were not spoken. Missing detail is expected and is handled later.
6. If the recording is silent or has no identifiable items, return an empty lines array.

Return ONLY a JSON object, no prose and no markdown fences:
{"lines":[{"raw":"<transcribed item, quantity removed>","qty_expression":"2+1+2"|null,"qty":5,"stated_qty":5|null,"confidence":0.0-1.0}]}`;

/**
 * Anthropic's API cannot listen to audio, so when it's the configured provider,
 * the browser's own speech recognition does the listening and hands us plain
 * text - this prompt structures THAT (not raw audio) into line items.
 */
const PROMPT_VOICE_TEXT = `The following is a live speech-to-text transcript of someone reading out a materials list aloud at an electrical goods counter in Tamil Nadu, India. The transcription engine is generic, not tuned for trade jargon, so wording may be mangled and numbers may appear as words ("two") instead of digits.

Structure it into line items. Rules:

1. Normalize each item's wording into a clear description. Keep unclear trade terms or brand names as transcribed rather than guessing what they mean.
2. Write every number as a digit, not a word - "twenty amp switch" becomes "20 amp switch". This applies inside the item description itself, not just the quantity - downstream matching only recognizes digits.
3. Quantities may appear as words ("two plus one plus two") or digits ("2+1+2") - either way, capture the full sum as a "2+1+2" style expression in qty_expression and its total in qty. A single quantity just goes in qty.
4. Skip filler words, greetings, and anything that is not a material item.
5. Do not add sizes, specs or brands that were not said.
6. If the transcript has no identifiable items, return an empty lines array.

Transcript:
"""
{TRANSCRIPT}
"""

Return ONLY a JSON object, no prose and no markdown fences:
{"lines":[{"raw":"<item, quantity removed>","qty_expression":"2+1+2"|null,"qty":5,"stated_qty":5|null,"confidence":0.0-1.0}]}`;

async function callAnthropic(promptText, imagePart) {
  const content = imagePart ? [imagePart, { type: 'text', text: promptText }] : [{ type: 'text', text: promptText }];
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
      messages: [{ role: 'user', content }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
}

async function callGemini(promptText, imagePart) {
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const parts = imagePart ? [imagePart, { text: promptText }] : [{ text: promptText }];
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      // thinkingBudget: 0 - this is deterministic transcription/structuring, not a
      // reasoning task, and newer flash models otherwise spend the maxOutputTokens
      // budget on an internal "thinking" pass before ever emitting the answer, which
      // can starve a dense sheet of room to finish and come back with no JSON at all.
      generationConfig: { temperature: 0, maxOutputTokens: 4000, thinkingConfig: { thinkingBudget: 0 } },
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
  if (start === -1 || end === -1) {
    const hint = cleaned ? `got instead: "${cleaned.slice(0, 200)}"` : 'response was empty';
    throw new Error(`Model did not return JSON - ${hint}`);
  }
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
  const raw = provider === 'gemini'
    ? await callGemini(PROMPT, { inline_data: { mime_type: mediaType, data: base64 } })
    : await callAnthropic(PROMPT, { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } });
  const parsed = parseJsonLoose(raw);
  return { lines: parsed.lines || [], provider };
}

/**
 * Gemini can listen to the recording directly - best accuracy for accented,
 * jargon-heavy speech, since it hears the actual audio. Only used when
 * VISION_PROVIDER=gemini; falls back to the bundled sample sheet with no key.
 */
async function extractFromAudio(base64, mediaType) {
  if (!process.env.GEMINI_API_KEY) {
    return { lines: fixture().lines, provider: 'sample', note: 'No Gemini key set - loaded the bundled sample sheet' };
  }
  const raw = await callGemini(PROMPT_VOICE, { inline_data: { mime_type: mediaType, data: base64 } });
  const parsed = parseJsonLoose(raw);
  return { lines: parsed.lines || [], provider: 'gemini-voice' };
}

/**
 * Anthropic path for voice: the browser's own speech recognition has already
 * turned the recording into text (see public/app.js) - this just structures
 * that transcript, same provider switch as the image path.
 */
async function extractFromVoiceText(transcript) {
  const provider = process.env.VISION_PROVIDER || 'anthropic';
  const hasKey = provider === 'gemini' ? !!process.env.GEMINI_API_KEY : !!process.env.ANTHROPIC_API_KEY;

  if (!hasKey) {
    return { lines: fixture().lines, provider: 'sample', note: 'No API key set - loaded the bundled sample sheet' };
  }
  const promptText = PROMPT_VOICE_TEXT.replace('{TRANSCRIPT}', transcript);
  const raw = provider === 'gemini' ? await callGemini(promptText, null) : await callAnthropic(promptText, null);
  const parsed = parseJsonLoose(raw);
  return { lines: parsed.lines || [], provider: `${provider}-voice-text` };
}

module.exports = { extractFromImage, extractFromAudio, extractFromVoiceText, PROMPT };
