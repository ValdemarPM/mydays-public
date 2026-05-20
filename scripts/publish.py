import requests
import subprocess
import os
import sys
from datetime import date

TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID   = os.environ.get("TELEGRAM_CHAT_ID", "")
GITHUB_USER        = "ValdemarPM"
REPO_NAME          = "calendar-days-template"

def save_html(html: str, target_date: date) -> str:
    filename = f"{target_date.isoformat()}.html"
    output_path = os.path.join("docs", filename)
    os.makedirs("docs", exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"✅ HTML guardado en {output_path}")
    return filename

def git_push(target_date: date):
    filename = f"{target_date.isoformat()}.html"
    subprocess.run(["git", "add", f"docs/{filename}"], check=True)
    result = subprocess.run(
        ["git", "diff", "--cached", "--quiet"],
        capture_output=True
    )
    if result.returncode != 0:
        subprocess.run(["git", "commit", "-m", f"📅 Card {target_date.isoformat()}"], check=True)
        subprocess.run(["git", "push"], check=True)
        print("✅ Pushed to GitHub")
    else:
        print("ℹ️  No changes to commit")

def send_telegram(filename: str, target_date: date):
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        print("⚠️  Telegram not configured, skipping notification")
        return

    url_page = f"https://{GITHUB_USER}.github.io/{REPO_NAME}/{filename}"
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
        json={"chat_id": TELEGRAM_CHAT_ID, "text": text, "parse_mode": "Markdown"},
        timeout=10,
    )
    if resp.ok:
        print(f"✅ Telegram notificado: {url_page}")
    else:
        print(f"❌ Error Telegram: {resp.text}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scripts/publish.py <path-to-html-file>")
        sys.exit(1)

    html_file = sys.argv[1]
    with open(html_file, "r", encoding="utf-8") as f:
        html = f.read()

    today = date.today()
    filename = save_html(html, today)
    git_push(today)
    send_telegram(filename, today)
