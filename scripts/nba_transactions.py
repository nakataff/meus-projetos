"""Atualização leve de movimentações NBA 2026/27 para o DE LA QUADRA.

O Draft e as negociações verificadas no NBA.com são um histórico base.
Somente novidades identificadas pela ESPN são adicionadas, sem apagar o histórico.
Não são realizadas consultas pelo navegador do visitante.
"""
import re
import unicodedata
from datetime import datetime, timezone

TEAM_IDS = {
  1:"ATL",2:"BOS",3:"NOP",4:"CHI",5:"CLE",6:"DAL",7:"DEN",8:"DET",9:"GSW",10:"HOU",
  11:"IND",12:"LAC",13:"LAL",14:"MIA",15:"MIL",16:"MIN",17:"BKN",18:"NYK",19:"ORL",
  20:"PHI",21:"PHX",22:"POR",23:"SAC",24:"SAS",25:"OKC",26:"UTA",27:"WAS",
  28:"TOR",29:"MEM",30:"CHA",
}
ALIASES = {"GS":"GSW","NY":"NYK","SA":"SAS","NO":"NOP","UTAH":"UTA","WSH":"WAS","PHO":"PHX"}
CODES = set(TEAM_IDS.values())
START = "2026-07-01"


def text(value):
    if isinstance(value, dict):
        for key in ("displayName", "name", "description", "abbreviation", "label"):
            if value.get(key):
                return text(value[key])
        return ""
    return str(value or "").strip()


def player_key(value):
    raw = unicodedata.normalize("NFKD", text(value))
    return re.sub(r"[^a-z0-9]", "", "".join(c for c in raw if not unicodedata.combining(c)).lower())


def team_code(item):
    if item is None:
        return ""
    if isinstance(item, (int, float)) or str(item).isdigit():
        return TEAM_IDS.get(int(item), "")
    if not isinstance(item, dict):
        return ALIASES.get(str(item).upper(), str(item).upper()) if str(item).upper() in CODES or str(item).upper() in ALIASES else ""
    abbreviation = str(item.get("abbreviation") or "").upper().strip()
    if abbreviation:
        value = ALIASES.get(abbreviation, abbreviation)
        if value in CODES:
            return value
    raw_id = item.get("id")
    if raw_id is None and isinstance(item.get("$ref"), str):
        match = re.search(r"/teams/(\d+)", item["$ref"])
        raw_id = match.group(1) if match else None
    try:
        return TEAM_IDS.get(int(raw_id), "")
    except (ValueError, TypeError):
        return ""


def date_only(value):
    value = text(value)
    if len(value) < 10:
        return ""
    try:
        datetime.strptime(value[:10], "%Y-%m-%d")
        return value[:10]
    except ValueError:
        return ""


def transaction_type(item):
    info = (text(item.get("type")) + " " + text(item.get("description"))).lower()
    if "waiv" in info or "releas" in info or "dispens" in info:
        return "Dispensa"
    if "sign-and-trade" in info or "sign and trade" in info:
        return "Sign-and-trade"
    if "trade" in info or "traded" in info:
        return "Troca"
    if "two-way" in info or "two way" in info:
        return "Contrato two-way"
    return "Agente livre"


def append_unique(entries, item):
    key = player_key(item.get("name"))
    if not key:
        return False
    for current in entries:
        if player_key(current.get("name")) != key:
            continue
        if current.get("from", "") != item.get("from", "") or current.get("to", "") != item.get("to", ""):
            continue
        if item.get("id") and not current.get("id"):
            current["id"] = item["id"]
        if item.get("date") and not current.get("date"):
            current["date"] = item["date"]
        return False
    entries.append(item)
    return True


def normalize_transactions(payload, today):
    rows = payload.get("transactions", payload.get("items", [])) if isinstance(payload, dict) else []
    if not isinstance(rows, list):
        return None
    output = []
    for item in rows:
        if not isinstance(item, dict):
            continue
        date = date_only(item.get("date") or item.get("transactionDate"))
        if not date or not START <= date <= today:
            continue
        athlete = item.get("athlete") or item.get("player") or {}
        if not isinstance(athlete, dict):
            continue
        name = text(athlete.get("displayName") or athlete.get("fullName") or athlete.get("name"))
        if not name:
            continue
        kind = transaction_type(item)
        desc = text(item.get("description")).lower()
        if any(w in desc for w in ("extension", "re-signed", "re-sings")):
            continue
        previous = team_code(item.get("fromTeam"))
        next_team = team_code(item.get("toTeam"))
        owner = team_code(item.get("team"))
        if not previous and kind == "Dispensa":
            previous = owner
        if not next_team and kind != "Dispensa":
            next_team = owner
        if previous == next_team and previous:
            continue
        if not previous and not next_team:
            continue
        output.append({
            "id": str(athlete.get("id") or ""),
            "name": name, "kind": kind, "from": previous, "to": next_team,
            "date": date, "source": "ESPN"
        })
    return output


def sync_transactions(get_json, read, save, root, now, logs):
    target = root / "transactions" / "2026-27.json"
    before = read(target, {})
    all_teams = before.get("teams")
    if not isinstance(all_teams, dict) or not all_teams:
        logs.append("Mercado NBA: cache base ausente; preservando arquivo")
        return
    raw = get_json("transactions", {"season": 2027, "limit": 1000})
    records = normalize_transactions(raw, now.date().isoformat())
    if records is None or not records:
        logs.append("Mercado NBA: feed indisponível ou vazio; histórico base preservado")
        return
    teams = {code: {
        "arrivals": list((all_teams.get(code) or {}).get("arrivals") or []),
        "departures": list((all_teams.get(code) or {}).get("departures") or []),
        "draft": list((all_teams.get(code) or {}).get("draft") or [])
    } for code in CODES}
    added = 0
    for record in records:
        dest, origin = record["to"], record["from"]
        # A escolha do Draft já consta na própria seção Draft.
        if dest in teams and not (not origin and any(player_key(d.get("name")) == player_key(record["name"]) for d in teams[dest]["draft"])):
            added += append_unique(teams[dest]["arrivals"], record.copy())
        if origin in teams:
            added += append_unique(teams[origin]["departures"], record.copy())
    if not added:
        logs.append(f"Mercado NBA: {len(records)} transações consultadas; nenhuma nova")
        return
    result = dict(before)
    result["teams"] = teams
    result["updatedAt"] = now.date().isoformat()
    save(target, result)
    logs.append(f"Mercado NBA: {len(records)} registros da ESPN; {added} novidades")
