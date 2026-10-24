// Replaces every motivationalQuote ("Reflexion of the Day") that repeats one used in the
// previous 6 months with an archive quote not used within 6 months either side, copying
// that quote's existing text in all four languages (no Gemini call). Dates are processed
// oldest first, so the first use of a quote stays and later repeats are replaced.
//
//   node scripts/fix-repeated-quotes.js                    # dry run from 2026-08-30
//   node scripts/fix-repeated-quotes.js --write            # apply
//   node scripts/fix-repeated-quotes.js --from 2026-01-01  # earlier start
//
// 2026-08-30 is when the generator's guard was introduced. Earlier files predate it.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { collectRecentQuotes, normalizeQuote, QUOTE_WINDOW_MONTHS } = require('./generate-content.js');

const LANGS = ['en', 'es', 'pt', 'ca'];
const REPO_CONTENT = path.join(__dirname, '..', 'content');

const args = process.argv.slice(2);
const write = args.includes('--write');
const fromIdx = args.indexOf('--from');
const from = fromIdx >= 0 ? args[fromIdx + 1] : '2026-08-30';

// A dry run works on a copy, so later dates see the earlier replacements exactly as --write would.
const dir = write ? REPO_CONTENT : fs.mkdtempSync(path.join(os.tmpdir(), 'mydays-quotes-'));
if (!write) fs.cpSync(REPO_CONTENT, dir, { recursive: true });

const read = (date) => JSON.parse(fs.readFileSync(path.join(dir, `${date}.json`), 'utf8'));
const dates = fs.readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).map((f) => f.slice(0, 10)).sort();

function usedBefore(date, key) {
  const start = new Date(`${date}T00:00:00Z`);
  start.setUTCMonth(start.getUTCMonth() - QUOTE_WINDOW_MONTHS);
  const startIso = start.toISOString().slice(0, 10);
  return dates.find((d) => d >= startIso && d < date && normalizeQuote(read(d).en?.motivationalQuote?.text) === key);
}

let fixed = 0;
for (const date of dates.filter((d) => d >= from)) {
  const json = read(date);
  const key = normalizeQuote(json.en?.motivationalQuote?.text);
  const earlier = key && usedBefore(date, key);
  if (!earlier) continue;

  const source = collectRecentQuotes(dir, date).archive
    .map((q) => read(q.lastUsed))
    .find((src) => LANGS.every((l) => src[l]?.motivationalQuote?.text));
  if (!source) {
    console.error(`${date}: repeats ${earlier}, but no archive quote is available — fix by hand`);
    process.exitCode = 1;
    continue;
  }
  console.log(`${date}: "${json.en.motivationalQuote.text.slice(0, 50)}" (also ${earlier})`);
  console.log(`          → "${source.en.motivationalQuote.text.slice(0, 50)}" — ${source.en.motivationalQuote.author} (from ${source.date})`);
  for (const lang of LANGS) json[lang].motivationalQuote = { ...source[lang].motivationalQuote };
  fs.writeFileSync(path.join(dir, `${date}.json`), JSON.stringify(json, null, 2), 'utf-8');
  fixed++;
}

console.log(`\n${fixed} date(s) ${write ? 'fixed' : 'would be fixed (dry run, pass --write to apply)'}.`);
