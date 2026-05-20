# 📅 Calendar Days — Local Workflow

A simple manual workflow to generate and publish a daily calendar card using Claude Code, without requiring an Anthropic API key or Telegram automation.

---

## How it works

```
[python scripts/day_data.py]
        ↓
[Paste output into Claude Code → HTML generated]
        ↓
[Save HTML to docs/YYYY-MM-DD.html  ←  full card for today]
[Save HTML to docs/YYYY-MM-DD+1.html  ←  header-only stub for tomorrow]
        ↓
[python scripts/publish.py docs/YYYY-MM-DD.html docs/YYYY-MM-DD+1.html]
        ↓
[GitHub Pages → public URL → share manually]
```

### Navigation arrows

Each card has ← / → arrows flanking the month/year in the header.

- **← (left arrow)** — links to the previous day's full card.
- **→ (right arrow)** — links to the next day's card.

**Rule:** the → arrow only appears when the next day's file already exists.  
The stub created for tomorrow has **only a ← arrow** (pointing back to today), never a →, because the day after tomorrow has not been created yet.

When you publish today's card you always push **two files**:
1. `docs/YYYY-MM-DD.html` — today's complete card (with both ← and → when applicable)
2. `docs/YYYY-MM-DD+1.html` — tomorrow's header-only stub (with ← only)

---

## Prerequisites

- Python 3.11+
- Git configured and pushed to `https://github.com/ValdemarPM/calendar-days-template`
- GitHub Pages enabled (`Settings → Pages → main / /docs`)

---

## One-time local setup

```bash
cd /Users/valdemarpereiradematos/WorkProjects/Dev/calendar-days-template

# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies (only ephem and requests needed)
pip install ephem requests
```

---

## Daily routine

### Step 1 — Calculate today's data

```bash
source .venv/bin/activate
python3 scripts/day_data.py
```

This prints the astronomical and calendar data for today.

### Step 2 — Generate the HTML

Paste the output into Claude Code and say **"generate today's card"**.
Claude will produce:
- The **full card** for today (`docs/YYYY-MM-DD.html`)
- A **header-only stub** for tomorrow (`docs/YYYY-MM-DD+1.html`)

The stub contains only the card header (month, day number, weekday) with a ← arrow back to today. It has no → arrow, because the day after tomorrow is not created yet.

### Step 3 — Save the HTML

Claude saves both files automatically:
```
docs/YYYY-MM-DD.html       ← today's full card
docs/YYYY-MM-DD+1.html     ← tomorrow's stub (header only)
```

### Step 4 — Publish

```bash
python3 scripts/publish.py docs/YYYY-MM-DD.html docs/YYYY-MM-DD+1.html
```

This will:
- Commit and push both files to GitHub
- GitHub Pages will serve them at:

```
https://valdemarpm.github.io/calendar-days-template/YYYY-MM-DD.html
```

> **Note:** when you generate tomorrow's full card, you will update its stub file (adding all the content and the → arrow to the day after). Today's card already has a → that links to tomorrow's stub, so navigation works immediately.

### Step 5 — Share

Send the URL to your girlfriend manually. The `docs/index.html` always redirects to today's date automatically, so she can also bookmark:

```
https://valdemarpm.github.io/calendar-days-template/
```

---

## Project structure

```
calendar-days-template/
├── .github/
│   └── workflows/
│       └── daily-card.yml   ← not used in this workflow (kept for future use)
├── docs/
│   ├── index.html           ← redirects to today's card
│   └── YYYY-MM-DD.html      ← generated daily cards
├── scripts/
│   ├── day_data.py          ← calculates today's astronomical data
│   └── publish.py           ← saves, commits, pushes to GitHub
├── requirements.txt
├── SETUP.md                 ← original automated workflow (GitHub Actions + Telegram)
└── SETUP_LOCAL.md           ← this file
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `ephem` not found | Run `pip install ephem` inside `.venv` |
| Git push fails | Check you are on `main` branch and have internet access |
| Page not updating | Wait ~1-2 min after push for GitHub Pages to redeploy |
| Wrong date in filename | Check your Mac's system date with `date` in terminal |
