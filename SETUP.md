# 📅 Calendar Days Template — Automatización
## GitHub Actions + GitHub Pages + Telegram Bot

---

## Visión general

Cada día a las **8:25** un workflow de GitHub Actions:
1. Ejecuta un script Python que calcula todos los datos del día
2. Llama a la **API de Anthropic** para generar el HTML
3. Publica el HTML en **GitHub Pages** con una URL permanente
4. Te envía un mensaje a **Telegram** con el link para compartir

```
[GitHub Actions cron 8:25]
        ↓
[generate.py → Anthropic API]
        ↓
[HTML guardado en /docs/YYYY-MM-DD.html]
        ↓
[GitHub Pages → URL pública]
        ↓
[Telegram Bot → mensaje con link]
```

---

## Prerequisitos

- Cuenta de GitHub con el repo `calendar-days-template`
- Clave API de Anthropic (`ANTHROPIC_API_KEY`)
- Bot de Telegram creado (instrucciones abajo)
- Python 3.11+ (solo para pruebas locales)

---

## Paso 1 — Crear el Bot de Telegram

1. Abre Telegram y busca **@BotFather**
2. Escribe `/newbot`
3. Dale un nombre, p.ej. `Calendar Days`
4. Dale un username, p.ej. `calendar_days_bot`
5. BotFather te devuelve un **token** con este formato:
   ```
   123456789:ABCdefGHIjklMNOpqrSTUvwxYZ
   ```
   Guárdalo — es tu `TELEGRAM_BOT_TOKEN`

6. Busca tu propio bot en Telegram y pulsa **Start**
7. Abre esta URL en el navegador para obtener tu `chat_id`:
   ```
   https://api.telegram.org/bot<TU_TOKEN>/getUpdates
   ```
   Busca en la respuesta JSON el campo `"id"` dentro de `"chat"`. Ese número es tu `TELEGRAM_CHAT_ID`.

---

## Paso 2 — Activar GitHub Pages

1. En tu repo en GitHub: **Settings → Pages**
2. En *Source* selecciona: **Deploy from a branch**
3. Branch: `main` / Folder: `/docs`
4. Pulsa **Save**
5. GitHub te mostrará la URL base, que tendrá esta forma:
   ```
   https://<tu-usuario>.github.io/calendar-days-template/
   ```
   Cada HTML diario quedará en:
   ```
   https://<tu-usuario>.github.io/calendar-days-template/2026-05-20.html
   ```

---

## Paso 3 — Añadir Secrets al repo

En GitHub: **Settings → Secrets and variables → Actions → New repository secret**

Añade estos tres:

| Nombre | Valor |
|--------|-------|
| `ANTHROPIC_API_KEY` | Tu clave de Anthropic |
| `TELEGRAM_BOT_TOKEN` | El token de BotFather |
| `TELEGRAM_CHAT_ID` | Tu chat_id numérico |

---

## Paso 4 — Estructura del proyecto

Crea esta estructura en tu repo:

```
calendar-days-template/
├── .github/
│   └── workflows/
│       └── daily-card.yml       ← workflow de GitHub Actions
├── docs/                        ← GitHub Pages sirve desde aquí
│   └── index.html               ← página índice opcional
├── scripts/
│   └── generate.py              ← script generador
├── requirements.txt
└── SETUP.md                     ← este fichero
```

---

## Paso 5 — `requirements.txt`

```txt
anthropic>=0.25.0
requests>=2.31.0
ephem>=4.1.5
```

> `ephem` es una librería de astronomía para calcular datos solares y lunares precisos.

---

## Paso 6 — Script generador `scripts/generate.py`

```python
import anthropic
import requests
import ephem
import os
import math
from datetime import date, datetime, timezone

# ── Configuración ──────────────────────────────────────────────
ANTHROPIC_API_KEY  = os.environ["ANTHROPIC_API_KEY"]
TELEGRAM_BOT_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
TELEGRAM_CHAT_ID   = os.environ["TELEGRAM_CHAT_ID"]
GITHUB_USER        = os.environ.get("GITHUB_USER", "tu-usuario")
REPO_NAME          = os.environ.get("REPO_NAME", "calendar-days-template")

# ── Datos del día ──────────────────────────────────────────────
def ordinal_es(n):
    """Convierte número a ordinal en español extendido."""
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
    """Calcula todos los datos astronómicos y de calendario del día."""
    
    # Día del año y días restantes
    day_of_year = target_date.timetuple().tm_yday
    days_remaining = 365 - day_of_year
    if (target_date.year % 4 == 0 and target_date.year % 100 != 0) or target_date.year % 400 == 0:
        days_remaining = 366 - day_of_year

    # Número de semana ISO
    week_number = target_date.isocalendar()[1]

    # Nombre del día en español
    dias = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"]
    day_name = dias[target_date.weekday()]

    # Nombre del mes en español
    meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
             "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]
    month_name = meses[target_date.month - 1]

    # Ordinal del día del año
    day_ordinal = ordinal_es(day_of_year)

    # Datos solares y lunares con ephem (Barcelona: 41.38°N, 2.17°E)
    barcelona = ephem.Observer()
    barcelona.lat  = "41.3851"
    barcelona.lon  = "2.1734"
    barcelona.elevation = 12
    barcelona.date = f"{target_date.year}/{target_date.month}/{target_date.day} 00:00:00"
    barcelona.horizon = "-0:34"  # corrección por refracción atmosférica

    sun = ephem.Sun()
    sun.compute(barcelona)

    sunrise_utc = ephem.localtime(barcelona.next_rising(sun))
    sunset_utc  = ephem.localtime(barcelona.next_setting(sun))
    sunrise_str = sunrise_utc.strftime("%H:%M")
    sunset_str  = sunset_utc.strftime("%H:%M")

    # Duración del día
    duration_sec = int((sunset_utc - sunrise_utc).total_seconds())
    dur_h = duration_sec // 3600
    dur_m = (duration_sec % 3600) // 60
    dur_s = duration_sec % 60
    duration_str = f"{dur_h}h {dur_m:02d}m {dur_s:02d}s"

    # Luna
    moon = ephem.Moon()
    moon.compute(target_date.strftime("%Y/%m/%d"))
    moon_phase_pct = round(moon.phase)

    try:
        moonrise_utc = ephem.localtime(barcelona.next_rising(moon))
        moonrise_str = moonrise_utc.strftime("%H:%M")
    except ephem.NeverUpError:
        moonrise_str = "—:—"
    except ephem.AlwaysUpError:
        moonrise_str = "—:—"

    try:
        moonset_utc = ephem.localtime(barcelona.next_setting(moon))
        moonset_str = moonset_utc.strftime("%H:%M")
    except Exception:
        moonset_str = "—:—"

    return {
        "date":          target_date,
        "day_number":    target_date.day,
        "month_name":    month_name,
        "day_name":      day_name,
        "week_number":   week_number,
        "day_of_year":   day_of_year,
        "day_ordinal":   day_ordinal,
        "days_remaining": days_remaining,
        "sunrise":       sunrise_str,
        "sunset":        sunset_str,
        "duration":      duration_str,
        "moonrise":      moonrise_str,
        "moonset":       moonset_str,
        "moon_phase":    moon_phase_pct,
    }


# ── Generación del HTML vía Anthropic ─────────────────────────
def generate_html(data: dict) -> str:
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
- Fase lunar: {data['moon_phase']}% (indica si es creciente, llena, menguante o nueva)
- Fecha ISO: {data['date'].isoformat()}

INSTRUCCIONES DE DISEÑO:
- Paleta: fondo pergamino #faf6ed, negro #111, dorado #c9a227
- Tipografías Google Fonts: Playfair Display (número del día y "Buenos Días" — serif clásico, peso 900), Oswald (mes y día de la semana), Cormorant Garamond (textos corridos)
- El número del día en Playfair Display 900, tamaño enorme (~190px), con text-shadow sutil
- Bordes superior e inferior decorativos negros con línea dorada
- Líneas doradas separadoras entre secciones
- Sección de santos reales del día con header decorativo "✝ Santos de hoy ✝"
- Cita motivadora real y verificable de un personaje histórico o cultural relevante (diferente cada día, acorde a la fecha o al santo principal del día)
- Emojis contextuales: ☀️ para sol, 🌙 para luna, 🌒/🌓/🌕/🌗 según fase, ⏱ para duración, 📅 para semana, 🌅 en "Buenos Días"
- Sección negra inferior con "¡Buenos Días! 🌅" en dorado (Playfair Display)
- Días internacionales reales del día en la franja negra inferior
- Ancho 420px, centrado en página con fondo oscuro #0d0d0d
- NO incluir firma ni watermark

Devuelve ÚNICAMENTE el HTML completo, sin explicaciones, sin bloques de código markdown.
El HTML debe ser autónomo y funcionar sin ficheros externos salvo Google Fonts."""

    message = client.messages.create(
        model="claude-opus-4-5",
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}]
    )

    return message.content[0].text


# ── Guardar HTML ───────────────────────────────────────────────
def save_html(html: str, target_date: date) -> str:
    filename = f"{target_date.isoformat()}.html"
    output_path = os.path.join("docs", filename)
    os.makedirs("docs", exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"✅ HTML guardado en {output_path}")
    return filename


# ── Enviar notificación a Telegram ────────────────────────────
def send_telegram(filename: str, target_date: date):
    url_page = (
        f"https://{GITHUB_USER}.github.io/{REPO_NAME}/{filename}"
    )
    dias = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"]
    day_name = dias[target_date.weekday()]
    meses = ["enero","febrero","marzo","abril","mayo","junio",
             "julio","agosto","septiembre","octubre","noviembre","diciembre"]
    
    text = (
        f"📅 *Buenos días*\n\n"
        f"Tu tarjeta del *{day_name} {target_date.day} de {meses[target_date.month-1]}* está lista:\n\n"
        f"🔗 {url_page}\n\n"
        f"_Ábrela en el navegador y compártela desde ahí._"
    )

    resp = requests.post(
        f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
        json={
            "chat_id": TELEGRAM_CHAT_ID,
            "text": text,
            "parse_mode": "Markdown",
        },
        timeout=10,
    )
    if resp.ok:
        print(f"✅ Telegram notificado: {url_page}")
    else:
        print(f"❌ Error Telegram: {resp.text}")


# ── Main ───────────────────────────────────────────────────────
if __name__ == "__main__":
    today = date.today()
    print(f"🗓  Generando tarjeta para {today.isoformat()}…")

    data     = get_day_data(today)
    html     = generate_html(data)
    filename = save_html(html, today)
    send_telegram(filename, today)
```

---

## Paso 7 — Workflow `.github/workflows/daily-card.yml`

```yaml
name: Daily Calendar Card

on:
  schedule:
    # 8:25 hora de Madrid (UTC+2 en verano = 06:25 UTC)
    - cron: "25 6 * * *"
  workflow_dispatch:  # permite lanzarlo manualmente desde GitHub

permissions:
  contents: write  # necesario para hacer push del HTML generado

jobs:
  generate:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repo
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.11"

      - name: Install dependencies
        run: pip install -r requirements.txt

      - name: Generate card
        env:
          ANTHROPIC_API_KEY:  ${{ secrets.ANTHROPIC_API_KEY }}
          TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
          TELEGRAM_CHAT_ID:   ${{ secrets.TELEGRAM_CHAT_ID }}
          GITHUB_USER:        ${{ github.repository_owner }}
          REPO_NAME:          ${{ github.event.repository.name }}
        run: python scripts/generate.py

      - name: Commit and push HTML
        run: |
          git config user.name  "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add docs/
          git diff --cached --quiet || git commit -m "📅 Card $(date +%Y-%m-%d)"
          git push
```

> **Nota sobre la hora:** El cron de GitHub Actions usa siempre **UTC**. España en verano (CEST) = UTC+2, así que `06:25 UTC` → `08:25 Madrid`. En invierno (CET, UTC+1) cámbialo a `07:25` para mantener las 8:25 locales.

---

## Paso 8 — `docs/index.html` (página índice opcional)

Crea un `docs/index.html` mínimo para que GitHub Pages tenga algo en la raíz:

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Calendar Days</title>
  <script>
    // Redirige automáticamente al HTML del día de hoy
    const today = new Date().toISOString().split('T')[0];
    window.location.href = today + '.html';
  </script>
</head>
<body>
  <p>Cargando…</p>
</body>
</html>
```

Así la URL raíz `https://<usuario>.github.io/calendar-days-template/` redirige siempre al día actual.

---

## Prueba local antes de hacer push

```bash
# 1. Clona o abre el repo en VS Code
cd calendar-days-template

# 2. Crea un entorno virtual
python -m venv .venv
source .venv/bin/activate      # en Mac/Linux
# .venv\Scripts\activate       # en Windows

# 3. Instala dependencias
pip install -r requirements.txt

# 4. Exporta las variables de entorno
export ANTHROPIC_API_KEY="sk-ant-..."
export TELEGRAM_BOT_TOKEN="123456:ABC..."
export TELEGRAM_CHAT_ID="987654321"
export GITHUB_USER="tu-usuario"
export REPO_NAME="calendar-days-template"

# 5. Ejecuta el script
python scripts/generate.py

# Debería crear docs/YYYY-MM-DD.html y enviarte el mensaje de Telegram
```

---

## Flujo completo una vez configurado

```
08:25 (hora Madrid)
  └─ GitHub Actions despierta
       └─ generate.py calcula datos astronómicos del día
            └─ Llama a Anthropic API → genera HTML
                 └─ Guarda docs/2026-05-20.html
                      └─ git push → GitHub Pages despliega
                           └─ Telegram: "Tu tarjeta está lista 🔗"
                                └─ Abres el link, lo compartes
```

---

## Troubleshooting frecuente

| Problema | Causa probable | Solución |
|----------|---------------|----------|
| Workflow no arranca | Repo inactivo (>60 días sin push) | GitHub desactiva crons en repos inactivos — hacer un push o re-activar manualmente |
| HTML no aparece en Pages | `/docs` aún vacío o Pages no configurado | Verificar Step 2, esperar ~2 min tras el primer push |
| Telegram no recibe mensaje | `chat_id` incorrecto | Verificar con `/getUpdates` que el bot recibió un mensaje tuyo primero |
| Hora incorrecta | Cambio horario verano/invierno | Ajustar el cron UTC según la estación |
| API Anthropic falla | Token caducado o sin crédito | Verificar en console.anthropic.com |

---

## Costes aproximados

| Servicio | Coste |
|----------|-------|
| GitHub Actions | Gratis (2.000 min/mes en repos privados, ilimitado en públicos) |
| GitHub Pages | Gratis |
| Telegram Bot API | Gratis |
| Anthropic API (claude-opus-4-5, ~4K tokens/día) | ~$0.05–0.10/día |

---

*Documento generado para el proyecto `calendar-days-template` · Mayo 2026*
