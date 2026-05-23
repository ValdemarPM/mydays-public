# 📅 Calendar Days — Claude Chrome Automated Workflow

A fully automated daily workflow powered by **Claude Chrome** — no Anthropic API key required locally.
Claude Chrome acts as the intelligence that generates the HTML card, while lightweight Python scripts
handle data collection, publishing, and Telegram notification.

---

## How it works

```
[Step 1] python3 scripts/day_data.py
              ↓
         Astronomical & calendar data printed to terminal

[Step 2] Claude Chrome reads the output
              ↓
         Formats data into the full HTML card design prompt

[Step 3] Claude Chrome generates & saves:
         docs/YYYY-MM-DD.html        ← today's full card
         docs/YYYY-MM-DD+1.html      ← tomorrow's header-only stub

[Step 4] python3 scripts/publish.py docs/YYYY-MM-DD.html docs/YYYY-MM-DD+1.html
              ↓
         Commits & pushes to GitHub → GitHub Pages deploys automatically

[Step 5] python3 scripts/notify_telegram.py YYYY-MM-DD
              ↓
         Sends share link to Telegram via Bot API
```

**Your daily routine: ask Claude Chrome "generate today's card" — it handles everything.**

---

## The 5 steps explained

### Step 1 — Gather day data
`scripts/day_data.py` calculates all the information needed for the card:
- Day name, month, week number, day of year, days remaining
- - Sunrise, sunset, day duration (Barcelona, astronomical precision via `ephem`)
  - - Moonrise, moonset, lunar phase percentage
    - - Ordinal day name in Spanish
     
      - Claude Chrome runs this script and captures its output.
     
      - ### Step 2 — Prepare the HTML prompt
      - Claude Chrome takes the data output and formats it into the full card design prompt:
      - - Pergamino palette: background `#faf6ed`, black `#111`, gold `#c9a227`
        - - Google Fonts: Playfair Display 900 (day number ~190px), Oswald (month/weekday), Cormorant Garamond (body)
          - - Navigation arrows `←` / `→` flanking the month/year in the header
            - - Real saints of the day, a verified historical quote, real international days
              - - Black footer strip with "¡Buenos Días! 🌅" in gold
                - - 420px card centered on `#0d0d0d` background
                 
                  - ### Step 3 — Generate & save the HTML
                  - Claude Chrome generates two files:
                 
                  - **Today's full card** (`docs/YYYY-MM-DD.html`):
                  - - Complete card with all sections
                    - - `←` arrow linking to yesterday's card
                      - - `→` arrow linking to tomorrow's stub
                       
                        - **Tomorrow's header-only stub** (`docs/YYYY-MM-DD+1.html`):
                        - - Only the card header: month, day number, weekday
                          - - `←` arrow linking back to today
                            - - No `→` arrow (the day after tomorrow hasn't been created yet)
                              - - Footer message: "— Tarjeta completa disponible mañana —"
                               
                                - Claude Chrome saves both files directly to the `docs/` directory.
                               
                                - ### Step 4 — Publish to GitHub Pages
                                - ```bash
                                  python3 scripts/publish.py docs/YYYY-MM-DD.html docs/YYYY-MM-DD+1.html
                                  ```
                                  This script:
                                  - `git add` both files
                                  - - `git commit -m "📅 Card YYYY-MM-DD"`
                                    - - `git push` to main
                                      - - GitHub Pages automatically deploys within ~1-2 minutes
                                       
                                        - The cards are then live at:
                                        - ```
                                          https://valdemarpm.github.io/calendar-days-template/YYYY-MM-DD.html
                                          ```

                                          ### Step 5 — Send Telegram notification
                                          ```bash
                                          python3 scripts/notify_telegram.py YYYY-MM-DD
                                          ```
                                          This script sends a message to your Telegram via the Bot API:
                                          ```
                                          📅 Buenos días

                                          Tu tarjeta del Sábado 23 de mayo está lista:

                                          🔗 https://valdemarpm.github.io/calendar-days-template/2026-05-23.html

                                          Ábrela en el navegador y compártela desde ahí.
                                          ```

                                          Requires `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` in your environment
                                          (already added to GitHub → Settings → Secrets and variables → Actions).

                                          ---

                                          ## Prerequisites

                                          - Python 3.11+
                                          - - `ephem` and `requests` installed in `.venv`
                                            - - `TELEGRAM_BOT_TOKEN` set in environment or GitHub secrets
                                              - - `TELEGRAM_CHAT_ID` set in environment or GitHub secrets
                                                - - Git configured on main branch
                                                  - - GitHub Pages enabled (Settings → Pages → main / /docs)
                                                    - - Claude Chrome extension active
                                                     
                                                      - ---

                                                      ## One-time local setup

                                                      ```bash
                                                      cd /Users/valdemarpereiradematos/WorkProjects/Dev/calendar-days-template

                                                      python3 -m venv .venv
                                                      source .venv/bin/activate
                                                      pip install ephem requests

                                                      # Add to ~/.zshrc for persistence
                                                      export TELEGRAM_BOT_TOKEN="your_bot_token_here"
                                                      export TELEGRAM_CHAT_ID="1574220861"
                                                      ```

                                                      ---

                                                      ## scripts/notify_telegram.py

                                                      Create this file in your `scripts/` folder:

                                                      ```python
                                                      #!/usr/bin/env python3
                                                      """
                                                      notify_telegram.py — Send the daily card link to Telegram.
                                                      Usage: python3 scripts/notify_telegram.py YYYY-MM-DD
                                                      """

                                                      import os
                                                      import sys
                                                      import requests
                                                      from datetime import date

                                                      TELEGRAM_BOT_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
                                                      TELEGRAM_CHAT_ID = os.environ["TELEGRAM_CHAT_ID"]
                                                      GITHUB_USER = "ValdemarPM"
                                                      REPO_NAME = "calendar-days-template"

                                                      def send(target_date: date):
                                                          dias = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"]
                                                          meses = ["enero","febrero","marzo","abril","mayo","junio",
                                                                   "julio","agosto","septiembre","octubre","noviembre","diciembre"]

                                                          day_name = dias[target_date.weekday()]
                                                          url_page = f"https://{GITHUB_USER}.github.io/{REPO_NAME}/{target_date.isoformat()}.html"

                                                          text = (
                                                              f"📅 *Buenos días*\n\n"
                                                              f"Tu tarjeta del *{day_name} {target_date.day} de "
                                                              f"{meses[target_date.month - 1]}* está lista:\n\n"
                                                              f"🔗 {url_page}\n\n"
                                                              f"_Ábrela en el navegador y compártela desde ahí._"
                                                          )

                                                          resp = requests.post(
                                                              f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
                                                              json={"chat_id": TELEGRAM_CHAT_ID, "text": text, "parse_mode": "Markdown"},
                                                              timeout=10,
                                                          )
                                                          if resp.ok:
                                                              print(f"✅ Telegram notificado: {url_page}")
                                                          else:
                                                              print(f"❌ Error Telegram: {resp.text}")

                                                      if __name__ == "__main__":
                                                          if len(sys.argv) > 1:
                                                              from datetime import datetime
                                                              d = datetime.strptime(sys.argv[1], "%Y-%m-%d").date()
                                                          else:
                                                              d = date.today()
                                                          send(d)
                                                      ```

                                                      ---

                                                      ## Navigation arrows — same rules as SETUP_LOCAL.md

                                                      - `←` links to yesterday's full card
                                                      - - `→` links to tomorrow's stub (created in the same run)
                                                       
                                                        - When you generate tomorrow's full card the next day, the stub is replaced with the
                                                        - complete card and gains its own `→` arrow. The navigation chain stays intact automatically.
                                                       
                                                        - ---

                                                        ## Daily Claude Chrome task prompt

                                                        When converting this to a recurring Claude Chrome task, use this prompt:

                                                        > Activate the virtual environment at `/Users/valdemarpereiradematos/WorkProjects/Dev/calendar-days-template/.venv`,
                                                        > > then run `python3 scripts/day_data.py` to get today's astronomical data.
                                                        > > > Use that data to generate today's full HTML calendar card and tomorrow's header-only stub,
                                                        > > > > following the design in SETUP_AUTOMATED.md Step 2.
                                                        > > > > > Save today's card as `docs/YYYY-MM-DD.html` and tomorrow's stub as `docs/YYYY-MM-DD+1.html`.
                                                        > > > > > > Then run `python3 scripts/publish.py` with both files to push to GitHub Pages.
                                                        > > > > > > > Finally run `python3 scripts/notify_telegram.py` to send the Telegram notification.
                                                        > > > > > > > > Confirm the share link when done.
                                                        > > > > > > > >
                                                        > > > > > > > > ---
                                                        > > > > > > > >
                                                        > > > > > > > > ## Project structure
                                                        > > > > > > > >
                                                        > > > > > > > > ```
                                                        > > > > > > > > calendar-days-template/
                                                        > > > > > > > > ├── .github/workflows/daily-card.yml   ← not used in this workflow
                                                        > > > > > > > > ├── docs/
                                                        > > > > > > > > │   ├── index.html                     ← redirects to today's card
                                                        > > > > > > > > │   └── YYYY-MM-DD.html               ← generated daily cards
                                                        > > > > > > > > ├── scripts/
                                                        > > > > > > > > │   ├── day_data.py                    ← Step 1: calculates today's data
                                                        > > > > > > > > │   ├── publish.py                     ← Step 4: commits & pushes to GitHub
                                                        > > > > > > > > │   └── notify_telegram.py             ← Step 5: sends Telegram message
                                                        > > > > > > > > ├── requirements.txt
                                                        > > > > > > > > ├── SETUP.md                           ← original GitHub Actions + Telegram workflow
                                                        > > > > > > > > ├── SETUP_LOCAL.md                     ← manual Claude Code workflow
                                                        > > > > > > > > └── SETUP_AUTOMATED.md                 ← this file: Claude Chrome workflow
                                                        > > > > > > > > ```
                                                        > > > > > > > >
                                                        > > > > > > > > ---
                                                        > > > > > > > >
                                                        > > > > > > > > ## Troubleshooting
                                                        > > > > > > > >
                                                        > > > > > > > > | Problem | Solution |
                                                        > > > > > > > > |---------|----------|
                                                        > > > > > > > > | `ephem` not found | `pip install ephem` inside `.venv` |
                                                        > > > > > > > > | `requests` not found | `pip install requests` inside `.venv` |
                                                        > > > > > > > > | `TELEGRAM_BOT_TOKEN` not set | Add to `~/.zshrc` and run `source ~/.zshrc` |
                                                        > > > > > > > > | Telegram message not received | Verify bot is started — send `/start` to `@calendar_days_valdemar_bot` |
                                                        > > > > > > > > | Git push fails | Check you are on `main` branch and have internet access |
                                                        > > > > > > > > | Page not updating | Wait ~1-2 min after push for GitHub Pages to redeploy |
                                                        > > > > > > > >
                                                        > > > > > > > > ---
                                                        > > > > > > > >
                                                        > > > > > > > > ## Cost
                                                        > > > > > > > >
                                                        > > > > > > > > | Service | Cost |
                                                        > > > > > > > > |---------|------|
                                                        > > > > > > > > | Claude Chrome | Included in your Claude plan |
                                                        > > > > > > > > | Telegram Bot API | Free |
                                                        > > > > > > > > | GitHub Pages | Free |
                                                        > > > > > > > > | Anthropic API | **Not required** |
                                                        > > > > > > > >
                                                        > > > > > > > > ---
                                                        > > > > > > > >
                                                        > > > > > > > > *Document updated for the `calendar-days-template` project · May 2026*
