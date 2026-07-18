// One-off backfill: adds notificationHighlight to every existing content/YYYY-MM-DD.json
// that doesn't already have it, using the same deterministic cascade logic (no Gemini calls)
// as step 4 of generate-content.js. Safe to re-run — files that already have the field
// (for every language present) are skipped.
//
// Usage: node scripts/backfill-notification-highlight.js [--dry-run]

const fs = require('fs');
const path = require('path');
const { computeNotificationHighlight } = require('./generate-content.js');

const CONTENT_DIR = path.join(__dirname, '..', 'content');
const DRY_RUN = process.argv.includes('--dry-run');
const LANGS = ['es', 'en', 'pt', 'ca'];

function main() {
  const files = fs.readdirSync(CONTENT_DIR).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f));
  console.log(`Found ${files.length} content file(s) in ${CONTENT_DIR}${DRY_RUN ? ' (dry run)' : ''}.`);

  let updated = 0;
  let skipped = 0;
  let missingLangData = 0;

  for (const file of files) {
    const filePath = path.join(CONTENT_DIR, file);
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);

    const presentLangs = LANGS.filter((l) => data[l]);
    const alreadyDone = presentLangs.length > 0 && presentLangs.every((l) => data[l].notificationHighlight);
    if (alreadyDone) {
      skipped++;
      continue;
    }

    let changed = false;
    for (const lang of presentLangs) {
      if (data[lang].notificationHighlight) continue;
      const highlight = computeNotificationHighlight(data[lang], lang);
      if (highlight) {
        data[lang].notificationHighlight = highlight;
        changed = true;
      } else {
        missingLangData++;
        console.warn(`  WARNING: ${file} [${lang}] has no observances/births/events/saints to derive a highlight from.`);
      }
    }

    if (changed) {
      updated++;
      if (!DRY_RUN) {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
      }
    }
  }

  console.log(`\nDone. Updated: ${updated}, already had it: ${skipped}, entries with no source data: ${missingLangData}.`);
  if (DRY_RUN) console.log('Dry run — no files were written.');
}

main();
