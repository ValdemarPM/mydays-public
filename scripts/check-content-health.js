// Runs in GitHub Actions (.github/workflows/content-health.yml). Verifies that the content
// files users need right now exist, are complete, and are actually served by jsDelivr.
// By default checks today and tomorrow (UTC; tomorrow is already "today" in UTC+14), where a
// problem means users are affected now, and two days ahead, the generation horizon, where a
// problem is an early warning with about a day left to fix it. Override with
// CHECK_DATES=YYYY-MM-DD,... (all treated as urgent). Exits 1 if any problem is found,
// writes a Markdown report to REPORT_FILE (default: content-health-report.md) and the
// severity ("urgent" / "warning" / "ok") to SEVERITY_FILE (default: content-health-severity).

const fs = require('fs');
const path = require('path');

const LANGS = ['en', 'es', 'pt', 'ca'];
const CDN_BASE = 'https://cdn.jsdelivr.net/gh/ValdemarPM/mydays-public@main/content';
const PURGE_BASE = 'https://purge.jsdelivr.net/gh/ValdemarPM/mydays-public@main/content';
const CONTENT_DIR = path.join(__dirname, '..', 'content');
const REPORT_FILE = process.env.REPORT_FILE || 'content-health-report.md';
const SEVERITY_FILE = process.env.SEVERITY_FILE || 'content-health-severity';

function isoDate(offsetDays) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

// Returns a list of problems (empty = valid). Mirrors what the app and the native
// notification workers read from each language block.
function validate(json, date) {
  const problems = [];
  if (json.date !== date) problems.push(`"date" is ${JSON.stringify(json.date)}, expected "${date}"`);
  for (const lang of LANGS) {
    const block = json[lang];
    if (!block || typeof block !== 'object') {
      problems.push(`missing language "${lang}"`);
      continue;
    }
    for (const key of ['saints', 'observances', 'births', 'events']) {
      if (!Array.isArray(block[key])) problems.push(`${lang}.${key} is not a list`);
    }
    for (const key of ['births', 'events']) {
      if (Array.isArray(block[key]) && block[key].length === 0) problems.push(`${lang}.${key} is empty`);
    }
    for (const key of ['historicalQuote', 'motivationalQuote']) {
      if (!block[key] || !block[key].text) problems.push(`${lang}.${key}.text is missing`);
    }
    if (!block.notificationHighlight) problems.push(`${lang}.notificationHighlight is missing`);
  }
  return problems;
}

async function fetchCdn(date) {
  const res = await fetch(`${CDN_BASE}/${date}.json`, { cache: 'no-store' });
  if (!res.ok) return { status: res.status };
  return { status: res.status, json: await res.json() };
}

async function checkCdn(date) {
  let result;
  try {
    result = await fetchCdn(date);
  } catch (err) {
    result = { status: `network error (${err.message})` };
  }
  if (result.json) return result;

  // A file committed a few hours ago can still be missing from jsDelivr's cache of @main.
  // Purge once and retry before calling it a failure.
  console.log(`  CDN returned ${result.status}, purging jsDelivr cache and retrying in 30s...`);
  try {
    await fetch(`${PURGE_BASE}/${date}.json`);
  } catch {
    // ignore, the retry below decides
  }
  await new Promise((r) => setTimeout(r, 30000));
  try {
    return await fetchCdn(date);
  } catch (err) {
    return { status: `network error (${err.message})` };
  }
}

async function checkDate(date) {
  const problems = [];

  const localPath = path.join(CONTENT_DIR, `${date}.json`);
  if (!fs.existsSync(localPath)) {
    problems.push(`content/${date}.json is not in the repository (generation failed or did not run)`);
  } else {
    try {
      const local = JSON.parse(fs.readFileSync(localPath, 'utf-8'));
      problems.push(...validate(local, date).map((p) => `repo file: ${p}`));
    } catch (err) {
      problems.push(`repo file is not valid JSON: ${err.message}`);
    }
  }

  const cdn = await checkCdn(date);
  if (!cdn.json) {
    problems.push(`jsDelivr does not serve ${date}.json (status: ${cdn.status})`);
  } else {
    problems.push(...validate(cdn.json, date).map((p) => `CDN file: ${p}`));
  }

  return problems;
}

async function main() {
  const checks = process.env.CHECK_DATES
    ? process.env.CHECK_DATES.split(',').map((s) => s.trim()).filter(Boolean).map((date) => ({ date, urgent: true }))
    : [
        { date: isoDate(0), urgent: true },
        { date: isoDate(1), urgent: true },
        { date: isoDate(2), urgent: false },
      ];

  const report = [];
  let urgentFailed = false;
  let warningFailed = false;
  for (const { date, urgent } of checks) {
    const label = urgent ? date : `${date} (two days ahead)`;
    console.log(`Checking ${label}...`);
    const problems = await checkDate(date);
    if (problems.length === 0) {
      console.log(`  OK`);
      report.push(`- ✅ **${label}**: OK`);
    } else {
      if (urgent) urgentFailed = true;
      else warningFailed = true;
      for (const p of problems) console.log(`  PROBLEM: ${p}`);
      report.push(`- ${urgent ? '❌' : '⚠️'} **${label}**:`, ...problems.map((p) => `  - ${p}`));
    }
  }

  const severity = urgentFailed ? 'urgent' : warningFailed ? 'warning' : 'ok';
  const heading = {
    urgent: '## Daily content health check FAILED: users are affected now',
    warning: '## Daily content health check: early warning',
    ok: '## Daily content health check passed',
  }[severity];
  const advice = {
    urgent:
      'Users fall through to live Gemini (EN/ES only) or get errors for these dates. ' +
      'Check the latest "Generate daily content" run, then run it manually (leave `target_date` empty to fill every missing date).',
    warning:
      'No user is affected yet: the file two days ahead is missing or broken. The next scheduled ' +
      '"Generate daily content" run fills missing files automatically; if it keeps failing, check its logs.',
    ok: '',
  }[severity];

  fs.writeFileSync(REPORT_FILE, [heading, '', ...report, '', advice].join('\n') + '\n');
  fs.writeFileSync(SEVERITY_FILE, severity + '\n');
  process.exit(severity === 'ok' ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
