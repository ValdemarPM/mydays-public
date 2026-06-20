// Runs in GitHub Actions. Writes content/YYYY-MM-DD.json for tomorrow's date.
// Pipeline: (1) search+verify in EN with grounding → (2) translate to ES/EN/PT/CA → (3) verify proper names with grounding
// Requires: GEMINI_API_KEY environment variable.

const fs = require('fs');
const path = require('path');

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = 'gemini-2.5-flash';

if (!API_KEY) {
  console.error('ERROR: GEMINI_API_KEY environment variable is not set.');
  process.exit(1);
}

function buildSearchPrompt(dateString) {
  return `Provide the verified cultural and historical details for the Gregorian date: ${dateString} (relative to any historical year).

Search Google to source and verify:
1. Real Christian/Catholic/Orthodox Saints of the Day commemorated on ${dateString}. Verify their names, types, and historical lives.
2. Real-world international observances or playful cultural days commemorated on ${dateString} (e.g. Africa Day, Towel Day, World Environment Day).
3. A verified inspiring historical quote from a famous author, scientist, or historic figure who was born, died, or performed a major documented act on ${dateString}. Mention how they connect to this date in the 'context' property.
4. Real births of famous, notable, or widely recognized personalities (authors, artists, scientists, leaders, or pioneers) born on ${dateString}. Include 2 or 3 such personalities.
5. Real and notable positive or inspiring historical events (scientific milestones, exploration successes, monumental inaugurations, treaties, or peace progress achievements) that occurred on ${dateString} in history. Include 2 or 3 positive events.
6. An inspiring or thought-provoking motivational quote from any well-known author, philosopher, or public figure (need not be connected to ${dateString}). It must be a DIFFERENT person from the historicalQuote author.

Output ONLY a JSON object matching this schema exactly (no markdown fences):
{
  "saints": [
    { "name": "St. Name", "type": "Title e.g. Priest", "description": "1-2 sentence description in English." }
  ],
  "observances": [
    { "name": "Observance Title", "description": "1 sentence explanation in English." }
  ],
  "historicalQuote": {
    "text": "The full quote in English",
    "author": "Author Name",
    "context": "1-2 sentences on how this person or quote connects to ${dateString} in history."
  },
  "motivationalQuote": {
    "text": "The full motivational quote in English",
    "author": "Author Name"
  },
  "births": [
    { "name": "Famous Person Name", "description": "1-2 sentence description in English.", "year": "Year of birth as a string, e.g., '1803'" }
  ],
  "events": [
    { "title": "Milestone Event Title", "description": "1-2 sentence encouraging description in English.", "year": "Year of occurrence as a string, e.g., '1961'" }
  ]
}`;
}

function buildTranslationPrompt(baseJson, langs) {
  const langLabels = { es: 'Spanish (es)', en: 'English (en)', pt: 'Portuguese (pt)', ca: 'Catalan (ca)' };
  const langList = langs.map(l => langLabels[l]).join(', ');
  const schemaKeys = langs.map(l => `  "${l}": { ...same schema as source, all text in ${langLabels[l]}... }`).join(',\n');

  return `You are a professional translator. Translate the following JSON content into: ${langList}.

Rules:
- Translate ALL text fields: name, type, description, title, text, context.
- Proper nouns for people (saints, authors, historical figures, famous personalities) must use the conventional name in each language if one exists (e.g. "Joan d'Arc" in Catalan, "Juana de Arco" in Spanish). If no conventional translation exists, keep the original name unchanged.
- Observance names: use the official translated name if one exists; otherwise keep the original.
- Do NOT add or remove array items — the structure must be identical across all languages.
- Translate ALL fields including historicalQuote.context and motivationalQuote.text.

Source JSON:
${JSON.stringify(baseJson, null, 2)}

Output ONLY a JSON object with this structure (no markdown fences):
{
${schemaKeys}
}`;
}

function buildVerificationPrompt(dateString, translatedJson, baseJson) {
  // Extract all proper names from each language for verification
  const namesToVerify = {
    saints: translatedJson.en.saints.map(s => s.name),
    quoteAuthor: translatedJson.en.historicalQuote.author,
    motivationalQuoteAuthor: translatedJson.en.motivationalQuote.author,
    births: translatedJson.en.births.map(b => b.name),
  };

  return `You are verifying proper names in a multilingual JSON about ${dateString}.

The reference English names (verified via Google Search) are:
- Saints: ${namesToVerify.saints.join(', ')}
- Historical quote author: ${namesToVerify.quoteAuthor}
- Motivational quote author: ${namesToVerify.motivationalQuoteAuthor}
- Birth personalities: ${namesToVerify.births.join(', ')}

Check using Google Search whether the translated names below are correct conventional names in each language. Only correct a name if it is clearly wrong or non-standard — leave it unchanged otherwise.

Translated names to verify:
${JSON.stringify({
    es: {
      saints: translatedJson.es.saints.map(s => s.name),
      quoteAuthor: translatedJson.es.historicalQuote.author,
      motivationalQuoteAuthor: translatedJson.es.motivationalQuote.author,
      births: translatedJson.es.births.map(b => b.name),
    },
    en: {
      saints: translatedJson.en.saints.map(s => s.name),
      quoteAuthor: translatedJson.en.historicalQuote.author,
      motivationalQuoteAuthor: translatedJson.en.motivationalQuote.author,
      births: translatedJson.en.births.map(b => b.name),
    },
    pt: {
      saints: translatedJson.pt.saints.map(s => s.name),
      quoteAuthor: translatedJson.pt.historicalQuote.author,
      motivationalQuoteAuthor: translatedJson.pt.motivationalQuote.author,
      births: translatedJson.pt.births.map(b => b.name),
    },
    ca: {
      saints: translatedJson.ca.saints.map(s => s.name),
      quoteAuthor: translatedJson.ca.historicalQuote.author,
      motivationalQuoteAuthor: translatedJson.ca.motivationalQuote.author,
      births: translatedJson.ca.births.map(b => b.name),
    },
  }, null, 2)}

Output ONLY a JSON object with corrections (no markdown fences). For each language, list only the names that need to be changed. Use null if nothing needs correction in that language:
{
  "es": { "saints": ["corrected name or null to keep", ...], "quoteAuthor": "corrected or null", "motivationalQuoteAuthor": "corrected or null", "births": ["corrected name or null to keep", ...] },
  "en": { "saints": [...], "quoteAuthor": null, "motivationalQuoteAuthor": null, "births": [...] },
  "pt": { "saints": [...], "quoteAuthor": null, "motivationalQuoteAuthor": null, "births": [...] },
  "ca": { "saints": [...], "quoteAuthor": null, "motivationalQuoteAuthor": null, "births": [...] }
}`;
}

async function callGemini(prompt, { grounding = false, label = '', retries = 2 } = {}) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 16384 },
  };
  if (grounding) {
    body.tools = [{ google_search: {} }];
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      console.log(`      Retry ${attempt}/${retries} for ${label}...`);
      await new Promise(r => setTimeout(r, 2000 * attempt));
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      if (attempt < retries) continue;
      throw new Error(`Gemini API error${label ? ` (${label})` : ''}: ${response.status} — ${error}`);
    }

    const data = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts ?? [];
    const text = parts.filter(p => p.text).map(p => p.text).join('');

    if (!text) {
      if (attempt < retries) continue;
      throw new Error(`Unexpected Gemini response structure${label ? ` (${label})` : ''}: ${JSON.stringify(data)}`);
    }

    const fenceStripped = text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    const jsonMatch = fenceStripped.match(/\{[\s\S]*\}/);
    const cleaned = jsonMatch ? jsonMatch[0] : fenceStripped;
    try {
      return JSON.parse(cleaned);
    } catch (parseErr) {
      if (attempt < retries) continue;
      throw new Error(`JSON parse failed${label ? ` (${label})` : ''}: ${parseErr.message}\nRaw text (first 500): ${text.slice(0, 500)}`);
    }
  }
}

function applyNameCorrections(translated, corrections) {
  const langs = ['es', 'en', 'pt', 'ca'];
  const result = JSON.parse(JSON.stringify(translated)); // deep clone

  for (const lang of langs) {
    const corr = corrections[lang];
    if (!corr) continue;

    if (corr.saints) {
      result[lang].saints = result[lang].saints.map((s, i) =>
        corr.saints[i] && corr.saints[i] !== null ? { ...s, name: corr.saints[i] } : s
      );
    }
    if (corr.quoteAuthor && corr.quoteAuthor !== null) {
      result[lang].historicalQuote = { ...result[lang].historicalQuote, author: corr.quoteAuthor };
    }
    if (corr.motivationalQuoteAuthor && corr.motivationalQuoteAuthor !== null) {
      result[lang].motivationalQuote = { ...result[lang].motivationalQuote, author: corr.motivationalQuoteAuthor };
    }
    if (corr.births) {
      result[lang].births = result[lang].births.map((b, i) =>
        corr.births[i] && corr.births[i] !== null ? { ...b, name: corr.births[i] } : b
      );
    }
  }

  return result;
}

async function main() {
  // TARGET_DATE (YYYY-MM-DD) overrides the default tomorrow — use for backfilling specific dates
  let target;
  if (process.env.TARGET_DATE) {
    target = new Date(`${process.env.TARGET_DATE}T00:00:00Z`);
  } else {
    target = new Date();
    target.setUTCDate(target.getUTCDate() + 1);
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const dateString = `${monthNames[target.getUTCMonth()]} ${target.getUTCDate()}`;
  const isoDate = target.toISOString().split('T')[0];

  // Step 1: search and verify content in English with grounding
  console.log(`[1/3] Searching and verifying content for ${dateString} (${isoDate})...`);
  const baseContent = await callGemini(buildSearchPrompt(dateString), { grounding: true, label: 'search' });
  console.log(`      Saints: ${baseContent.saints?.length ?? 0}, Births: ${baseContent.births?.length ?? 0}, Events: ${baseContent.events?.length ?? 0}`);

  // Step 2: translate in two batches to avoid output token limits
  console.log(`[2/3] Translating to ES, EN, PT, CA (two batches)...`);
  const [batch1, batch2] = await Promise.all([
    callGemini(buildTranslationPrompt(baseContent, ['es', 'pt']), { grounding: false, label: 'translation-es-pt' }),
    callGemini(buildTranslationPrompt(baseContent, ['en', 'ca']), { grounding: false, label: 'translation-en-ca' }),
  ]);
  const translated = { es: batch1.es, en: batch2.en, pt: batch1.pt, ca: batch2.ca };

  // Step 3: verify and correct proper names with grounding
  console.log(`[3/3] Verifying proper names across languages...`);
  const corrections = await callGemini(buildVerificationPrompt(dateString, translated, baseContent), { grounding: true, label: 'verification' });
  const verified = applyNameCorrections(translated, corrections);

  const output = { date: isoDate, ...verified };

  const outputPath = path.join(__dirname, '..', 'content', `${isoDate}.json`);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');

  console.log(`Successfully wrote content/${isoDate}.json`);
}

main().catch((err) => {
  console.error('Content generation failed:', err.message);
  process.exit(1);
});
