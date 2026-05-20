import ephem
import os
from datetime import date

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
    days_remaining = 365 - day_of_year
    if (target_date.year % 4 == 0 and target_date.year % 100 != 0) or target_date.year % 400 == 0:
        days_remaining = 366 - day_of_year

    week_number = target_date.isocalendar()[1]

    dias = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"]
    day_name = dias[target_date.weekday()]

    meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
             "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]
    month_name = meses[target_date.month - 1]

    day_ordinal = ordinal_es(day_of_year)

    barcelona = ephem.Observer()
    barcelona.lat  = "41.3851"
    barcelona.lon  = "2.1734"
    barcelona.elevation = 12
    barcelona.date = f"{target_date.year}/{target_date.month}/{target_date.day} 00:00:00"
    barcelona.horizon = "-0:34"

    sun = ephem.Sun()
    sun.compute(barcelona)

    sunrise_utc = ephem.localtime(barcelona.next_rising(sun))
    sunset_utc  = ephem.localtime(barcelona.next_setting(sun))
    sunrise_str = sunrise_utc.strftime("%H:%M")
    sunset_str  = sunset_utc.strftime("%H:%M")

    duration_sec = int((sunset_utc - sunrise_utc).total_seconds())
    dur_h = duration_sec // 3600
    dur_m = (duration_sec % 3600) // 60
    dur_s = duration_sec % 60
    duration_str = f"{dur_h}h {dur_m:02d}m {dur_s:02d}s"

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
        "date":           target_date,
        "day_number":     target_date.day,
        "month_name":     month_name,
        "day_name":       day_name,
        "week_number":    week_number,
        "day_of_year":    day_of_year,
        "day_ordinal":    day_ordinal,
        "days_remaining": days_remaining,
        "sunrise":        sunrise_str,
        "sunset":         sunset_str,
        "duration":       duration_str,
        "moonrise":       moonrise_str,
        "moonset":        moonset_str,
        "moon_phase":     moon_phase_pct,
    }

if __name__ == "__main__":
    today = date.today()
    d = get_day_data(today)

    print(f"""
=== DATOS DEL DÍA {d['date'].isoformat()} ===
- Mes: {d['month_name'].upper()}
- Número del día: {d['day_number']}
- Día de la semana: {d['day_name']}
- Semana: {d['week_number']}
- Día del año: {d['day_of_year']} ({d['day_ordinal']} día)
- Días restantes: {d['days_remaining']}
- Amanecer: {d['sunrise']} · Atardecer: {d['sunset']}
- Duración del día: {d['duration']}
- Salida de la luna: {d['moonrise']} · Puesta: {d['moonset']}
- Fase lunar: {d['moon_phase']}%
""")
