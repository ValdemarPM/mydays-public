// Runs in GitHub Actions. Calls Gemini twice (ES + EN) and writes content/daily.json.
// Requires: GEMINI_API_KEY environment variable.

const fs = require('fs');
const path = require('path');

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = 'gemini-2.5-flash';

if (!API_KEY) {
  console.error('ERROR: GEMINI_API_KEY environment variable is not set.');
  process.exit(1);
}

function buildPrompt(dateString, language) {
  const languageLabel = language === 'es' ? 'Spanish (Español)' : 'English (Inglés)';
  return `Provide the verified cultural and historical details for the Gregorian date: ${dateString} (relative to any historical year).

IMPORTANT: You are requested to generate all output texts in ${languageLabel}. This applies to:
- The description of the saints (saints[].description) and saint titles (saints[].type). Translate names into ${languageLabel} if they have a standard equivalent (e.g. "San Beda" instead of "St. Bede" if Spanish).
- The description of the observances (observances[].description) and their names (observances[].name).
- The quote text (historicalQuote.text) and its historical connection context (historicalQuote.context). Translate the quote faithfully to ${languageLabel}.
- The names of famous personalities born on this day (births[].name) and details (births[].description).
- The titles of historical events (events[].title) and details (events[].description).

Search Google grounding matches to source:
1. Real Christian/Catholic/Orthodox Saints of the Day commemorated on ${dateString}. Verify their names, types, and historical lives.
2. Real-world international observances or playful cultural days commemorated on ${dateString} (e.g. Africa Day / Día de África, Towel Day / Día de la toalla, World Environment Day).
3. A verified inspiring historical quote from a famous author, scientist, or historic figure who was born, died, or performed a major documented act on ${dateString}. Mention how they connect to this date in the 'context' property.
4. Real births of famous, notable, or widely recognized personalities (authors, artists, scientists, leaders, or pioneers) born on ${dateString}. Include 2 or 3 such personalities.
5. Real and notable positive or inspiring historical events (scientific milestones, exploration successes, monumental inaugurations, treaties, or peace progress achievements) that occurred on ${dateString} in history. Include 2 or 3 positive events.

Structure the JSON output exactly matching this schema:
{
  "saints": [
    { "name": "St. Name or San Nombre", "type": "Title e.g. Priest / Sacerdote", "description": "1-2 sentence description..." }
  ],
  "observances": [
    { "name": "Observance Title / Título de la Observación", "description": "1 sentence explanation..." }
  ],
  "historicalQuote": {
    "text": "The full quote translated to ${languageLabel}",
    "author": "Author Name",
    "context": "Brief historical verification summary on how this person/quote links to ${dateString} written in ${languageLabel}"
  },
  "births": [
    { "name": "Famous Person Name", "description": "1-2 sentence description of their achievements and legacy in ${languageLabel}", "year": "Year of birth as a string, e.g., '1803'" }
  ],
  "events": [
    { "title": "Milestone Event Title", "description": "1-2 sentence encouraging description of the positive event in ${languageLabel}", "year": "Year of occurrence as a string, e.g., '1961'" }
  ]
}`;
}

async function callGemini(dateString, language) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: buildPrompt(dateString, language) }] }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error for language "${language}": ${response.status} — ${error}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error(`Unexpected Gemini response structure for language "${language}": ${JSON.stringify(data)}`);
  }

  const cleaned = text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  return JSON.parse(cleaned);
}

async function main() {
  const today = new Date();
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const dateString = `${monthNames[today.getUTCMonth()]} ${today.getUTCDate()}`;
  const isoDate = today.toISOString().split('T')[0];

  console.log(`Generating content for ${dateString} (${isoDate}) in ES and EN...`);

  const [es, en] = await Promise.all([
    callGemini(dateString, 'es'),
    callGemini(dateString, 'en'),
  ]);

  const output = { date: isoDate, es, en };

  const outputPath = path.join(__dirname, '..', 'content', 'daily.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');

  console.log(`Successfully wrote content/daily.json for ${isoDate}`);
  console.log(`ES saints count: ${es.saints?.length ?? 0}`);
  console.log(`EN saints count: ${en.saints?.length ?? 0}`);
}

main().catch((err) => {
  console.error('Content generation failed:', err.message);
  process.exit(1);
});
