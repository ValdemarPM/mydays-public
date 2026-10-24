// Regression tests for the content pipeline. Run with: node --test scripts/*.test.js
// The "Generate daily content" workflow runs them before generating, so a change that
// breaks one of these guards stops the pipeline instead of shipping bad content.
// Each test pins a bug that already reached users once; never delete or weaken one.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  collectRecentQuotes,
  pickFreshMotivationalQuote,
  normalizeQuote,
} = require('./generate-content.js');

function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Writes a content dir with one EN motivationalQuote per date: { 'YYYY-MM-DD': 'text' }.
function makeContentDir(quotesByDate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mydays-content-'));
  for (const [date, text] of Object.entries(quotesByDate)) {
    const json = { date, en: { motivationalQuote: { text, author: `Author of ${text}` } } };
    fs.writeFileSync(path.join(dir, `${date}.json`), JSON.stringify(json));
  }
  return dir;
}

const quiet = { warn: console.warn, log: console.log };
test.beforeEach(() => { console.warn = () => {}; console.log = () => {}; });
test.afterEach(() => { console.warn = quiet.warn; console.log = quiet.log; });

// 2026-10-22/23: the prompt listed only the 60 newest of ~130 quotes, Gemini re-picked an
// older one, the check rejected it and the repeat shipped.
test('re-pick prompt list contains every quote in the window, not a capped subset', () => {
  const quotes = {};
  for (let i = 0; i < 150; i++) quotes[addDays('2026-10-01', -i)] = `Distinct quote number ${i}`;
  const recent = collectRecentQuotes(makeContentDir(quotes), '2026-10-02');
  assert.equal(recent.rawList.length, recent.motivational.size);
  assert.ok(recent.rawList.length >= 150);
});

test('window covers 6 months before and after the date, and excludes the date itself', () => {
  const dir = makeContentDir({
    '2026-03-15': 'Seven months before',
    '2026-05-15': 'Five months before',
    '2026-10-22': 'The date being generated',
    '2027-03-01': 'Four months after',
    '2027-06-01': 'Seven months after',
  });
  const recent = collectRecentQuotes(dir, '2026-10-22');
  const has = (t) => recent.motivational.has(normalizeQuote(t));
  assert.ok(has('Five months before'));
  assert.ok(has('Four months after'));
  assert.ok(!has('Seven months before'));
  assert.ok(!has('Seven months after'));
  assert.ok(!has('The date being generated'));
  assert.deepEqual(recent.archive.map((q) => q.text), ['Seven months before']);
});

test('archive offers the quote whose last use is oldest, and never one used in the window', () => {
  const dir = makeContentDir({
    '2025-12-01': 'Old A',
    '2025-12-02': 'Old B',
    '2026-01-01': 'Old A', // A's last use is newer than B's
    '2026-02-01': 'Recent C',
    '2026-09-01': 'Recent C',
  });
  const recent = collectRecentQuotes(dir, '2026-09-10');
  assert.deepEqual(recent.archive.map((q) => q.text), ['Old B', 'Old A']);
});

test('a fresh first pick is kept as is', async () => {
  const recent = { motivational: new Set([normalizeQuote('Used')]), rawList: ['Used'], archive: [] };
  const first = { text: 'Brand new', author: 'X' };
  const picked = await pickFreshMotivationalQuote(first, recent, async () => assert.fail('no re-pick expected'));
  assert.equal(picked.quote, first);
});

test('a repeated first pick is replaced by a fresh re-pick, rejected candidates join the exclusion list', async () => {
  const recent = { motivational: new Set(['used', 'older'].map(normalizeQuote)), rawList: ['Used'], archive: [] };
  const prompts = [];
  const answers = [{ text: 'Older', author: 'Y' }, { text: 'Fresh', author: 'Z' }];
  const picked = await pickFreshMotivationalQuote({ text: 'Used.' }, recent, async (p) => {
    prompts.push(p);
    return answers.shift();
  });
  assert.equal(picked.quote.text, 'Fresh');
  assert.match(prompts[1], /Older/);
});

// The old code kept the repeated quote when its single re-pick failed. It must never do that.
test('never returns a repeated quote when every re-pick repeats or fails: falls back to the archive', async () => {
  const recent = {
    motivational: new Set(['used', 'also used'].map(normalizeQuote)),
    rawList: ['Used', 'Also used'],
    archive: [{ text: 'Archive quote', author: 'A', lastUsed: '2025-07-01' }],
  };
  let calls = 0;
  const picked = await pickFreshMotivationalQuote({ text: 'Used' }, recent, async () => {
    calls++;
    if (calls % 2) throw new Error('network');
    return { text: 'Also used', author: 'B' };
  });
  assert.equal(picked.quote.text, 'Archive quote');
  assert.ok(calls >= 2);
});

test('throws rather than return a repeat when re-picks and archive are exhausted', async () => {
  const recent = { motivational: new Set([normalizeQuote('Used')]), rawList: ['Used'], archive: [] };
  await assert.rejects(pickFreshMotivationalQuote({ text: 'Used' }, recent, async () => ({ text: 'Used' })));
});

test('a missing first pick is filled, not left empty', async () => {
  const recent = { motivational: new Set(), rawList: [], archive: [] };
  const picked = await pickFreshMotivationalQuote(undefined, recent, async () => ({ text: 'Fresh', author: 'Z' }));
  assert.equal(picked.quote.text, 'Fresh');
});
