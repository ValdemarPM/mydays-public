# 📅 Calendar Days — Claude Chrome Automated Workflow

A fully automated daily workflow powered by Claude Chrome — no Anthropic API key required, no terminal, no local Python scripts. Claude Chrome acts as the intelligence that calculates the day data, generates the HTML card, and publishes it to GitHub Pages entirely through the browser.

---

## How it works

```
[Step 1] Claude Chrome calculates today's data
         ↓
         Day name, week, sunrise/sunset, moon phase, saints, quote, international days

[Step 2] Claude Chrome generates the HTML card
         ↓
         Full card for today + header-only stub for tomorrow

[Step 3] Claude Chrome saves both files via the GitHub web editor
         docs/YYYY-MM-DD.html     ← today's full card
         docs/YYYY-MM-DD+1.html   ← tomorrow's header-only stub

[Step 4] GitHub Pages deploys automatically (~1–2 min after push)
         ↓
         Deployment email sent automatically to valdemar.matos@gmail.com
```

**Your daily routine:** run the task (or ask Claude Chrome "make automated today") — you receive a GitHub deployment email when the page is live.

---

## The steps explained

### Step 1 — Calculate day data

Claude Chrome calculates all the information needed for the card directly, without running any Python script:

- Day name, month, week number, day of year, days remaining
- Year progress percentage
- Sunrise, sunset, day duration (Barcelona, ~41.38°N 2.17°E, estimated from seasonal progression)
- Moonrise, moonset, lunar phase percentage
- Real saints of the day (verified)
- A verified historical quote
- Real international observances for the date

### Step 2 — Generate the HTML card

Claude Chrome formats the data into two HTML files following the established design:

- **Pergamino palette:** background `#faf6ed`, black `#111`, gold `#c9a227`
- **Google Fonts:** Playfair Display 900 (day number), Oswald (month/weekday), Crimson Pro (body)
- **Navigation arrows** ← / → flanking the month·year in the header
- **Sections:** week/day-of-year, year progress bar, solar data, lunar data, saints, quote, footer
- **Footer:** black strip with "¡Buenos Días, Guapa! 🌅" + international days
- 420px card centred on `#0d0d0d` background
- External stylesheet: `style.css` (shared, already in `docs/`)

### Step 3 — Save files via GitHub web editor

Claude Chrome uses the GitHub web editor to create or update the files:

**Today's full card** (`docs/YYYY-MM-DD.html`):
- Complete card with all sections
- `←` arrow linking to yesterday's card
- `→` arrow linking to tomorrow's stub

**Tomorrow's header-only stub** (`docs/YYYY-MM-DD+1.html`):
- Only the card header: month·year, day number, weekday
- `←` arrow linking back to today
- No `→` arrow (the day after tomorrow hasn't been created yet)
- Footer message: `— Tarjeta completa disponible mañana —`

> ⚠️ **CodeMirror artifact fix required** — see section below.

### Step 4 — GitHub Pages deploys automatically

After each push to `main`, GitHub Pages rebuilds within ~1–2 minutes.  
A deployment notification email is sent automatically to **valdemar.matos@gmail.com**.

The cards are live at:
```
https://valdemarpm.github.io/calendar-days-template/YYYY-MM-DD.html
```

---

## Daily Claude Chrome task prompt

Use this prompt verbatim when setting up the recurring task, or when asking Claude Chrome to run the workflow manually:

---

> Today is a new day. Do the following steps **entirely through the GitHub web editor** at `github.com/ValdemarPM/calendar-days-template` — no terminal, no Python scripts.
>
> **Step 1 — Calculate today's data** (Barcelona timezone):
> - Day name in Spanish, day number, month name
> - ISO week number, day of year (1–365), days remaining, year progress %
> - Sunrise & sunset for Barcelona (41.38°N, 2.17°E) — estimate from seasonal progression (~1 min/day change vs the previous card)
> - Moon phase % and moonrise/moonset times
> - Real saints of the day, a verified historical quote, real international observances for today's date
>
> **Step 2 — Replace today's stub with the full card**
> Navigate to: `https://github.com/ValdemarPM/calendar-days-template/edit/main/docs/YYYY-MM-DD.html`
> (today's date — this file already exists as a stub created yesterday)
> Use the `javascript_tool` to replace the entire CodeMirror editor content with the full HTML card, matching the structure of the most recent full card in `docs/` exactly (same CSS classes, same sections). Navigation: `←` links to yesterday's card, `→` links to tomorrow's stub.
> Commit with message: `📅 Card YYYY-MM-DD`
>
> **Step 3 — Apply the CodeMirror artifact fix to today's card**
> Open the committed file again for editing and run this via `javascript_tool`:
> ```js
> const cmContent = document.querySelector('.cm-content');
> const tile = cmContent?.cmTile;
> if (tile?.view) {
>   const view = tile.view;
>   const doc = view.state.doc.toString();
>   const fixed = doc
>     .replace(/<\/div>div>/g, '<\/div>')
>     .replace(/<\/a>a>/g, '<\/a>')
>     .replace(/<\/html>html>/g, '<\/html>')
>     .trimEnd();
>   const end = fixed.lastIndexOf('<\/html>');
>   view.dispatch({ changes: { from: 0, to: view.state.doc.length,
>     insert: end !== -1 ? fixed.slice(0, end + 7) : fixed } });
> }
> ```
> Commit with message: `📅 Fix YYYY-MM-DD.html — clean trailing artifact`
>
> **Step 4 — Create tomorrow's stub**
> Navigate to: `https://github.com/ValdemarPM/calendar-days-template/new/main/docs`
> Filename: `YYYY-MM-DD+1.html` (tomorrow's date)
> Content: header-only stub — same structure as today's original stub. `←` links back to today, no `→` arrow, footer: `— Tarjeta completa disponible mañana —`.
> Set content via `javascript_tool` (same `cmTile.view` approach).
> Commit with message: `📅 Card YYYY-MM-DD+1 stub`
>
> **Step 5 — Apply the artifact fix to the stub**
> Same fix as Step 3, applied to the stub file.
> Commit with message: `📅 Fix YYYY-MM-DD+1.html stub — clean trailing artifact`
>
> **Step 6 — Confirm deployment**
> Visit `https://github.com/ValdemarPM/calendar-days-template/deployments` and verify the latest deployment is Active.
> Confirm the live URL: `https://valdemarpm.github.io/calendar-days-template/YYYY-MM-DD.html`

---

## ⚠️ GitHub Web Editor — HTML Artifact Fix (Required)

### The problem

When Claude Chrome sets indented HTML into the GitHub web editor via the `javascript_tool`, the CodeMirror 6 editor sometimes appends the tag name as plain text after every closing tag. For example, `</div>` becomes `</div>div>`, and `</a>` becomes `</a>a>`. This causes visible `div>` text to appear on the published page.

This must be fixed on **both files** after every creation.

### The fix — CodeMirror 6 API

After committing each file, open it for editing and run this via `javascript_tool`:

```js
const cmContent = document.querySelector('.cm-content');
const tile = cmContent ? cmContent.cmTile : null;

if (tile && tile.view) {
  const view = tile.view;
  const doc = view.state.doc.toString();

  const fixed = doc
    .replace(/<\/div>div>/g, '<\/div>')
    .replace(/<\/a>a>/g, '<\/a>')
    .replace(/<\/html>html>/g, '<\/html>')
    .replace(/<\/body><\/title>/g, '')
    .trimEnd();

  const htmlEnd = fixed.lastIndexOf('<\/html>');
  const clean = htmlEnd !== -1 ? fixed.substring(0, htmlEnd + 7) : fixed;

  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: clean }
  });

  console.log('Fixed. Removed ' + (doc.length - clean.length) + ' chars.');
} else {
  console.error('CodeMirror 6 view not found.');
}
```

### When to run it

1. Create `docs/YYYY-MM-DD.html` → commit → open for edit → run fix → commit again
2. Create `docs/YYYY-MM-DD+1.html` → commit → open for edit → run fix → commit again

---

## Navigation arrow rules

- `←` always links to yesterday's full card
- `→` always links to tomorrow's stub (created in the same run)
- When tomorrow's full card is generated the next day, the stub is replaced and gains its own `→` arrow — the navigation chain stays intact automatically

---

## Project structure

```
calendar-days-template/
├── .github/workflows/daily-card.yml  ← not used in this workflow
├── docs/
│   ├── index.html                    ← redirects to today's card
│   ├── style.css                     ← shared stylesheet (do not modify daily)
│   └── YYYY-MM-DD.html               ← generated daily cards
├── scripts/
│   ├── day_data.py                   ← reference only (not run by Claude Chrome)
│   ├── generate.py                   ← reference only (not run by Claude Chrome)
│   └── publish.py                    ← reference only (not run by Claude Chrome)
├── requirements.txt
├── SETUP.md                          ← original GitHub Actions + API workflow
├── SETUP_LOCAL.md                    ← manual Claude Code workflow
└── SETUP_AUTOMATED.md                ← this file: Claude Chrome browser workflow
```

---

## Notifications

GitHub Pages sends a deployment email automatically to **valdemar.matos@gmail.com** every time a push to `main` triggers a new deployment. No additional configuration needed — this is the signal that the card is live.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Stub file doesn't exist yet | Create it manually via `https://github.com/ValdemarPM/calendar-days-template/new/main/docs` |
| `cmTile.view` not found | Wait for the editor to fully load before running the JS fix |
| Page not updating | Wait ~1–2 min after push for GitHub Pages to redeploy |
| Artifact text visible on page | Run the CodeMirror fix and recommit |
| Deployment email not received | Check GitHub Settings → Notifications → Email |

---

## Cost

| Service | Cost |
|---------|------|
| Claude Chrome | Included in your Claude plan |
| GitHub deployment email | Free |
| GitHub Pages | Free |
| Anthropic API | **Not required** |

---

*Document updated for the `calendar-days-template` project · May 2026*
