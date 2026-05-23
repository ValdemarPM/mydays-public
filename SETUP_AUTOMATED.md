# 📅 Calendar Days — Automated Local Workflow

A fully automated local workflow that replaces the manual copy-paste step from `SETUP_LOCAL.md`.
Instead of pasting data into Claude Code by hand, a single Python script calls the Anthropic API
directly from your machine and generates both HTML files automatically.

---

## How it works

```
[python3 scripts/generate_local.py]
        ↓
[day_data.py logic runs internally]
        ↓
[Anthropic API called locally → HTML generated]
        ↓
[docs/YYYY-MM-DD.html saved]        ← today's full card
[docs/YYYY-MM-DD+1.html saved]      ← tomorrow's header-only stub
        ↓
[publish.py commits & pushes both files]
        ↓
[GitHub Pages → public URL → share manually]
```

**One command replaces steps 2 and 3 from SETUP_LOCAL.md entirely.**

---

## What changed vs SETUP_LOCAL.md

| Step | SETUP_LOCAL.md | This workflow |
|------|----------------|---------------|
| Get day data | `python3 scripts/day_data.py` | Done internally |
| Generate HTML | Manual copy-paste into Claude Code | Automatic (Anthropic API) |
| Save HTML files | Manual | Automatic |
| Publish | `python3 scripts/publish.py` | Done internally |
| **Total commands** | **4 manual steps** | **1 command** |

---

## Prerequisites

- Python 3.11+
- - `ANTHROPIC_API_KEY` available in your environment (or `.env` file)
  - - Git configured and pushed to `https://github.com/ValdemarPM/calendar-days-template`
    - - GitHub Pages enabled (Settings → Pages → main / /docs)
     
      - ---

      ## One-time local setup

      ```bash
      cd /Users/valdemarpereiradematos/WorkProjects/Dev/calendar-days-template

      # Create virtual environment (if not already done)
      python3 -m venv .venv
      source .venv/bin/activate

      # Install dependencies (adds anthropic to the existing ones)
      pip install ephem requests anthropic

      # Set your Anthropic API key (add to ~/.zshrc or ~/.bashrc to persist)
      export ANTHROPIC_API_KEY="sk-ant-..."
      ```

      ---

      ## Daily routine

      ```bash
      source .venv/bin/activate
      python3 scripts/generate_local.py
      ```

      That's it. The script will:

      1. Calculate today's astronomical and calendar data
      2. 2. Call the Anthropic API to generate the full HTML card
         3. 3. Generate tomorrow's header-only stub
            4. 4. Save both files to `docs/`
               5. 5. Commit and push to GitHub
                  6. 6. Print the public URL to share
                    
                     7. ---
                    
                     8. ## scripts/generate_local.py
                    
                     9. Create this file in your `scripts/` folder:
                    
                     10. ```python
                         #!/usr/bin/env python3
                         """
                         generate_local.py — One-command local card generator.
                         Replaces the manual Claude Code copy-paste from SETUP_LOCAL.md.
                         """

                         import anthropic
                         import ephem
                         import os
                         import subprocess
                         from datetime import date, timedelta

                         # ── Config ────────────────────────────────────────────────────
                         ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]
                         GITHUB_USER = "ValdemarPM"
                         REPO_NAME = "calendar-days-template"

                         # ── Helpers ───────────────────────────────────────────────────
                         def ordinal_es(n):
                             ordinals = {
                                 1:"Primero",2:"Segundo",3:"Tercero",4:"Cuarto",5:"Quinto",
                                 6:"Sexto",7:"Séptimo",8:"Octavo",9:"Noveno",10:"Décimo",
                                 11:"Undécimo",12:"Duodécimo",13:"Decimotercero",14:"Decimocuarto",
                                 15:"Decimoquinto",16:"Decimosexto",17:"Decimoséptimo",18:"Decimoctavo",
                                 19:"Decimonoveno",20:"Vigésimo",21:"Vigésimo primero",
                                 22:"Vigésimo segundo",23:"Vigésimo tercero",24:"Vigésimo cuarto",
                                 25:"Vigésimo quinto",26:"Vigésimo sexto",27:"Vigésimo séptimo",
                                 28:"Vigésimo octavo",29:"Vigésimo noveno",30:"Trigésimo",
                                 31:"Trigésimo primero",
                             }
                             return ordinals.get(n, str(n))

                         def get_day_data(target_date: date) -> dict:
                             day_of_year = target_date.timetuple().tm_yday
                             is_leap = (target_date.year % 4 == 0 and target_date.year % 100 != 0) or target_date.year % 400 == 0
                             days_remaining = (366 if is_leap else 365) - day_of_year
                             week_number = target_date.isocalendar()[1]
                             dias = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"]
                             meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
                                      "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]
                             day_name = dias[target_date.weekday()]
                             month_name = meses[target_date.month - 1]
                             day_ordinal = ordinal_es(day_of_year)

                             barcelona = ephem.Observer()
                             barcelona.lat = "41.3851"
                             barcelona.lon = "2.1734"
                             barcelona.elevation = 12
                             barcelona.date = f"{target_date.year}/{target_date.month}/{target_date.day} 00:00:00"
                             barcelona.horizon = "-0:34"

                             sun = ephem.Sun()
                             sun.compute(barcelona)
                             sunrise_utc = ephem.localtime(barcelona.next_rising(sun))
                             sunset_utc = ephem.localtime(barcelona.next_setting(sun))
                             sunrise_str = sunrise_utc.strftime("%H:%M")
                             sunset_str = sunset_utc.strftime("%H:%M")

                             duration_sec = int((sunset_utc - sunrise_utc).total_seconds())
                             dur_h, rem = divmod(duration_sec, 3600)
                             dur_m, dur_s = divmod(rem, 60)
                             duration_str = f"{dur_h}h {dur_m:02d}m {dur_s:02d}s"

                             moon = ephem.Moon()
                             moon.compute(target_date.strftime("%Y/%m/%d"))
                             moon_phase_pct = round(moon.phase)

                             try:
                                 moonrise_str = ephem.localtime(barcelona.next_rising(moon)).strftime("%H:%M")
                             except Exception:
                                 moonrise_str = "—:—"
                             try:
                                 moonset_str = ephem.localtime(barcelona.next_setting(moon)).strftime("%H:%M")
                             except Exception:
                                 moonset_str = "—:—"

                             return {
                                 "date": target_date,
                                 "day_number": target_date.day,
                                 "month_name": month_name,
                                 "day_name": day_name,
                                 "week_number": week_number,
                                 "day_of_year": day_of_year,
                                 "day_ordinal": day_ordinal,
                                 "days_remaining": days_remaining,
                                 "sunrise": sunrise_str,
                                 "sunset": sunset_str,
                                 "duration": duration_str,
                                 "moonrise": moonrise_str,
                                 "moonset": moonset_str,
                                 "moon_phase": moon_phase_pct,
                             }

                         # ── HTML generation ───────────────────────────────────────────
                         def generate_full_card(data: dict, prev_date: date, next_date: date) -> str:
                             prev_link = f"../{prev_date.isoformat()}.html"
                             next_link = f"../{next_date.isoformat()}.html"

                             client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
                             prompt = f"""Genera un documento HTML completo para una tarjeta de calendario diaria estilo periódico clásico español.

                         DATOS DEL DÍA:
                         - Mes: {data['month_name'].upper()}
                         - Número del día: {data['day_number']}
                         - Día de la semana: {data['day_name']}
                         - Semana: {data['week_number']}
                         - Día del año: {data['day_of_year']} ({data['day_ordinal']} día)
                         - Días restantes: {data['days_remaining']}
                         - Amanecer: {data['sunrise']} · Atardecer: {data['sunset']}
                         - Duración del día: {data['duration']}
                         - Salida de la luna: {data['moonrise']} · Puesta: {data['moonset']}
                         - Fase lunar: {data['moon_phase']}%
                         - Fecha ISO: {data['date'].isoformat()}
                         - Enlace día anterior: {prev_link}
                         - Enlace día siguiente: {next_link}

                         INSTRUCCIONES DE DISEÑO:
                         - Paleta: fondo pergamino #faf6ed, negro #111, dorado #c9a227
                         - Tipografías Google Fonts: Playfair Display (número del día — peso 900), Oswald (mes y día), Cormorant Garamond (textos)
                         - Número del día en Playfair Display 900, tamaño ~190px
                         - Bordes decorativos negros con línea dorada
                         - Flechas de navegación ← y → flanqueando el mes/año en el header
                         - Sección de santos reales del día
                         - Cita motivadora real de personaje histórico relevante
                         - Sección negra inferior con "¡Buenos Días! 🌅" en dorado
                         - Días internacionales reales del día en la franja negra
                         - Ancho 420px, centrado con fondo #0d0d0d
                         - NO incluir firma ni watermark

                         Devuelve ÚNICAMENTE el HTML completo, sin explicaciones ni bloques markdown."""

                             message = client.messages.create(
                                 model="claude-opus-4-5",
                                 max_tokens=4096,
                                 messages=[{"role": "user", "content": prompt}]
                             )
                             return message.content[0].text

                         def generate_stub(data: dict, prev_date: date) -> str:
                             """Header-only stub for tomorrow — only ← arrow, no → yet."""
                             prev_link = f"../{prev_date.isoformat()}.html"
                             return f"""<!DOCTYPE html>
                         <html lang="es">
                         <head>
                         <meta charset="UTF-8">
                         <meta name="viewport" content="width=device-width, initial-scale=1.0">
                         <title>{data['day_name']} {data['day_number']} de {data['month_name']}</title>
                         <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@900&family=Oswald:wght@400;600&display=swap" rel="stylesheet">
                         <style>
                           body {{ margin:0; background:#0d0d0d; display:flex; justify-content:center; align-items:flex-start; min-height:100vh; padding:40px 0; }}
                           .card {{ width:420px; background:#faf6ed; font-family:'Oswald',sans-serif; }}
                           .header {{ border-top:6px solid #111; border-bottom:3px solid #111; padding:18px 24px 14px; position:relative; text-align:center; }}
                           .gold-line {{ height:2px; background:#c9a227; margin:3px 0; }}
                           .nav {{ display:flex; justify-content:space-between; align-items:center; padding:0 8px; }}
                           .nav a {{ color:#111; text-decoration:none; font-size:1.4rem; font-weight:700; }}
                           .month {{ font-size:1rem; letter-spacing:3px; color:#111; text-transform:uppercase; }}
                           .day-num {{ font-family:'Playfair Display',serif; font-size:190px; font-weight:900; line-height:0.85; color:#111; text-align:center; padding:10px 0; }}
                           .weekday {{ font-size:1.1rem; letter-spacing:4px; color:#111; text-transform:uppercase; text-align:center; padding-bottom:12px; }}
                           .coming {{ text-align:center; padding:60px 24px; color:#888; font-family:'Oswald',sans-serif; font-size:0.95rem; letter-spacing:2px; }}
                         </style>
                         </head>
                         <body>
                         <div class="card">
                           <div class="header">
                             <div class="gold-line"></div>
                             <div class="nav">
                               <a href="{prev_link}">←</a>
                               <span class="month">{data['month_name'].upper()}</span>
                               <span style="width:1.4rem;display:inline-block;"></span>
                             </div>
                             <div class="gold-line"></div>
                           </div>
                           <div class="day-num">{data['day_number']}</div>
                           <div class="weekday">{data['day_name']}</div>
                           <div class="coming">— Tarjeta completa disponible mañana —</div>
                         </div>
                         </body>
                         </html>"""

                         # ── Save & publish ────────────────────────────────────────────
                         def save_html(html: str, filename: str):
                             os.makedirs("docs", exist_ok=True)
                             path = os.path.join("docs", filename)
                             with open(path, "w", encoding="utf-8") as f:
                                 f.write(html)
                             print(f"✅ Saved {path}")
                             return path

                         def publish(files: list[str]):
                             subprocess.run(["git", "add"] + files, check=True)
                             result = subprocess.run(["git", "diff", "--cached", "--quiet"])
                             if result.returncode == 0:
                                 print("ℹ️  Nothing to commit.")
                                 return
                             today_str = date.today().isoformat()
                             subprocess.run(["git", "commit", "-m", f"📅 Card {today_str}"], check=True)
                             subprocess.run(["git", "push"], check=True)
                             print(f"🚀 Pushed to GitHub")

                         # ── Main ──────────────────────────────────────────────────────
                         if __name__ == "__main__":
                             today = date.today()
                             tomorrow = today + timedelta(days=1)
                             yesterday = today - timedelta(days=1)

                             print(f"🗓  Generating card for {today.isoformat()}…")

                             today_data = get_day_data(today)
                             tomorrow_data = get_day_data(tomorrow)

                             print("🤖 Calling Anthropic API…")
                             today_html = generate_full_card(today_data, yesterday, tomorrow)
                             tomorrow_stub = generate_stub(tomorrow_data, today)

                             today_file = f"{today.isoformat()}.html"
                             tomorrow_file = f"{tomorrow.isoformat()}.html"

                             save_html(today_html, today_file)
                             save_html(tomorrow_stub, tomorrow_file)

                             publish([f"docs/{today_file}", f"docs/{tomorrow_file}"])

                             url = f"https://{GITHUB_USER}.github.io/{REPO_NAME}/{today_file}"
                             print(f"\n🔗 Share this: {url}\n")
                         ```

                         ---

                         ## Navigation arrows — same rules as SETUP_LOCAL.md

                         Each card has `←` / `→` arrows flanking the month/year in the header.

                         - `←` links to yesterday's full card
                         - - `→` links to tomorrow's stub (which already exists after this script runs)
                          
                           - When you generate tomorrow's full card the next day, the stub is replaced with the
                           - complete card — and the navigation chain stays intact automatically.
                          
                           - ---

                           ## Optional: Claude Chrome as the daily trigger

                           Instead of opening a terminal every morning, you can ask **Claude Chrome** to run
                           the workflow for you. Claude Chrome can:

                           1. Open a terminal and run `python3 scripts/generate_local.py`
                           2. 2. Wait for completion and capture the public URL
                              3. 3. Open the published GitHub Pages URL to visually verify the card rendered correctly
                                 4. 4. Optionally send you a message or copy the share link to your clipboard
                                   
                                    5. This means your daily routine becomes: **open Claude Chrome → say "generate today's card" → done**.
                                   
                                    6. ---
                                   
                                    7. ## Troubleshooting
                                   
                                    8. | Problem | Solution |
                                    9. |---------|----------|
                                    10. | `ANTHROPIC_API_KEY` not set | `export ANTHROPIC_API_KEY="sk-ant-..."` or add to `~/.zshrc` |
                                    11. | `anthropic` not found | `pip install anthropic` inside `.venv` |
                                    12. | `ephem` not found | `pip install ephem` inside `.venv` |
                                    13. | Git push fails | Check you are on `main` branch and have internet access |
                                    14. | Page not updating | Wait ~1-2 min after push for GitHub Pages to redeploy |
                                    15. | HTML looks wrong | Run the script again — Claude's output varies slightly each day |
                                   
                                    16. ---
                                   
                                    17. ## Cost
                                   
                                    18. | Service | Cost |
                                    19. |---------|------|
                                    20. | Anthropic API (claude-opus-4-5, ~4K tokens/day) | ~$0.05–0.10/day |
                                    21. | GitHub Pages | Free |
                                   
                                    22. ---
                                   
                                    23. *Document generated for the `calendar-days-template` project · May 2026*
