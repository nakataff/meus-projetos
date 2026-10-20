#!/usr/bin/env python3
"""Atualiza caches públicos do QUADRA usando endpoints JSON não oficiais da ESPN.

Não usa chaves nem Firebase. Falhas de rede preservam os últimos dados válidos.
Fonte não oficial, sem garantia de disponibilidade; confira as regras de uso da fonte.
"""
from __future__ import annotations

import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1] / "nba" / "data"
API = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba"
BR = ZoneInfo("America/Sao_Paulo")
NOW = datetime.now(timezone.utc)
MONTHS = ["2026-10", "2026-11", "2026-12", "2027-01", "2027-02", "2027-03", "2027-04"]
CODES = "ATL BOS BKN CHA CHI CLE DAL DEN DET GSW HOU IND LAC LAL MEM MIA MIL MIN NOP NYK OKC ORL PHI PHX POR SAC SAS TOR UTA WAS".split()
ALIASES = {"GS": "GSW", "NY": "NYK", "SA": "SAS", "NO": "NOP", "UTAH": "UTA", "WSH": "WAS", "PHO": "PHX"}
LOGS = []

def code(value):
    s = str(value or "").upper().strip()
    return ALIASES.get(s, s)

def get_json(path, params=None):
    url = API + "/" + path + ("?" + urlencode(params) if params else "")
    for n in range(2):
        try:
            req = Request(url, headers={"User-Agent": "QuadraNBA/1.0 (personal noncommercial tracker)", "Accept": "application/json"})
            with urlopen(req, timeout=22) as response:
                return json.load(response)
        except (OSError, ValueError, HTTPError, URLError) as exc:
            if n == 1:
                LOGS.append(f"FALHA {path}: {exc}")
            else:
                time.sleep(1.5)
    return None

def read(path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return default

def save(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    body = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True) + "\n"
    if path.exists() and path.read_text(encoding="utf-8") == body:
        return
    path.write_text(body, encoding="utf-8")
    LOGS.append(f"Atualizado {path.relative_to(ROOT.parent.parent)} ({len(body)} bytes)")

def local_date(iso):
    if not iso:
        return None
    try:
        return datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(BR)
    except ValueError:
        return None

def normalize_event(ev):
    try:
        comp = (ev.get("competitions") or [])[0]
        sides = {x.get("homeAway"): x for x in comp.get("competitors", [])}
        away, home = sides["away"], sides["home"]
        a, h = code(away.get("team", {}).get("abbreviation")), code(home.get("team", {}).get("abbreviation"))
        dt = local_date(ev.get("date"))
        if not dt or a not in CODES or h not in CODES:
            return None
        status = ev.get("status", {}).get("type", {})
        state = status.get("state", "pre")
        result = {
            "id": str(ev.get("id", "")),
            "date": dt.strftime("%Y-%m-%d"),
            "time": dt.strftime("%H:%M"),
            "away": a,
            "home": h,
            "status": "final" if status.get("completed") else ("live" if state == "in" else "scheduled"),
            "stage": (ev.get("season") or {}).get("type", 2),
        }
        if result["status"] != "scheduled":
            result["scoreAway"] = int(float(away.get("score", 0)))
            result["scoreHome"] = int(float(home.get("score", 0)))
        # Nunca inferir uma emissora brasileira apenas de um sinal dos EUA.
        return result
    except (TypeError, ValueError, KeyError, IndexError) as exc:
        LOGS.append(f"Evento ignorado: {exc}")
        return None

def sync_calendar():
    total = 0
    for month in MONTHS:
        target = ROOT / "months" / f"{month}.json"
        result = get_json("scoreboard", {"dates": month.replace("-", ""), "limit": 500})
        events = [normalize_event(ev) for ev in (result or {}).get("events", [])]
        events = [e for e in events if e]
        # Eventos de madrugada podem cair no mês civil seguinte: sem truncar para não perder jogos.
        if result is None or not events:
            LOGS.append(f"Calendário {month}: sem novos dados, mantendo arquivo existente")
            continue
        events = sorted({e["id"]: e for e in events}.values(), key=lambda e:(e["date"],e["time"]))
        save(target, {"month": month, "source":"ESPN (não oficial)", "events": events})
        total += len(events)
        time.sleep(0.22)
    LOGS.append(f"Eventos processados: {total}")

def normalize_roster(code_, obj):
    # Roster ESPN: athletes pode vir como grupos ou lista simples.
    raw = obj.get("athletes", []) if isinstance(obj, dict) else []
    players = []
    for group in raw:
        if isinstance(group, dict) and "items" in group:
            people = group.get("items", [])
        else:
            people = [group]
        for p in people:
            if not isinstance(p, dict):
                continue
            who = p.get("athlete", p)
            if not isinstance(who, dict):
                continue
            ident = str(who.get("id") or "")
            name = who.get("displayName") or who.get("fullName")
            if not ident or not name:
                continue
            position = who.get("position") or {}
            if isinstance(position, dict):
                position = position.get("abbreviation") or position.get("displayName")
            headshot = (who.get("headshot") or {}).get("href", "")
            players.append({
                "id": ident, "name": name,
                "number": str(who.get("jersey") or ""),
                "position": position or "",
                "headshot": headshot if isinstance(headshot, str) and headshot.startswith("https://") else ""
            })
    return list({p["id"]:p for p in players}.values())

def sync_rosters():
    for abbreviation in CODES:
        path = ROOT / "teams" / (abbreviation + ".json")
        old = read(path, {})
        if old.get("checkedOn") == NOW.astimezone(BR).strftime("%Y-%m-%d") and os.getenv("FORCE_ROSTERS")!="1":
            continue
        slugs = {"NOP": ["no", "nop", "new-orleans"], "UTA": ["utah", "uta", "ut"]}.get(abbreviation, [abbreviation.lower()])
        players = []
        for slug in slugs:
            info = get_json("teams/" + slug + "/roster")
            players = normalize_roster(abbreviation, info or {})
            if players:
                break
        if players:
            save(path, {"team": abbreviation, "checkedOn": NOW.astimezone(BR).strftime("%Y-%m-%d"), "source":"ESPN (não oficial)", "players":players})
        else:
            LOGS.append(f"Elenco indisponível: {abbreviation}, mantendo cache")
        time.sleep(0.18)

def stat_player(entry, keys):
    who = entry.get("athlete") or {}
    if not isinstance(who, dict):
        return None
    stats = entry.get("stats") or []
    pairs = {str(k).lower():v for k,v in zip(keys, stats)}
    def field(*names):
        for name in names:
            if name.lower() in pairs:
                return pairs[name.lower()]
        return "—"
    def num(*names):
        val = field(*names)
        try:
            return int(float(val))
        except (ValueError, TypeError):
            return 0
    name = who.get("displayName") or who.get("fullName")
    if not name:
        return None
    return {
        "id": str(who.get("id") or ""), "name": name,
        "number": str(who.get("jersey") or ""),
        "starter": bool(entry.get("starter")),
        "pts": num("points","pts"), "reb":num("rebounds","reb"), "ast":num("assists","ast"),
        "stl":num("steals","stl"),"blk":num("blocks","blk"),"to":num("turnovers","to"),
        "min":field("minutes","min"),"fg":field("fieldGoalsMade-fieldGoalsAttempted","fg"),
        "three":field("threePointFieldGoalsMade-threePointFieldGoalsAttempted","3pt","3p"),
        "plusMinus":field("plusMinus","plusMinusPoints","+/-")
    }

def normalize_boxscore(payload):
    box = (payload or {}).get("boxscore") or {}
    rows = {}
    for item in box.get("players", []):
        team = item.get("team") or {}
        short = code(team.get("abbreviation"))
        if short not in CODES:
            continue
        players=[]
        for group in item.get("statistics") or []:
            for athlete in group.get("athletes") or []:
                p = stat_player(athlete, group.get("keys") or group.get("labels") or [])
                if p and p["id"]:
                    players.append(p)
        if players:
            rows[short] = list({p["id"]:p for p in players}.values())
    return rows

def sync_final_stats():
    today = NOW.astimezone(BR).date()
    # Recupera até 20 dias de histórico e preserva o cache já importado.
    interesting = {}
    for n in range(21):
        dt = today - timedelta(days=n)
        month = dt.strftime("%Y-%m")
        file = ROOT / "months" / f"{month}.json"
        for ev in read(file, {}).get("events", []):
            if ev.get("date") == dt.isoformat() and ev.get("status") == "final":
                interesting[ev["id"]] = (ev, month)
    changed_months = {}
    for event_id, (ev, month) in interesting.items():
        path = ROOT / "stats" / f"{month}.json"
        if month not in changed_months:
            changed_months[month] = read(path, {"month": month, "games": {}})
        cache = changed_months[month]
        if event_id in cache.get("games", {}):
            continue
        raw = get_json("summary", {"event":event_id})
        rows = normalize_boxscore(raw)
        if not rows:
            LOGS.append(f"Sem box score para {event_id}; tentar na próxima execução")
            continue
        cache.setdefault("games", {})[event_id] = {"id":event_id,"date":ev["date"],"away":ev["away"],"home":ev["home"],"players":rows}
        time.sleep(0.2)
    for month, data in changed_months.items():
        if data.get("games"):
            save(ROOT / "stats" / f"{month}.json", data)

def sync_standings():
    """Tabela compacta derivada dos jogos da fase regular já FINALIZADOS.
    Empates de campanha usam saldo apenas para exibição; não implementa todos
    os critérios oficiais de desempate NBA.
    """
    games = {}
    for month in MONTHS:
        for event in read(ROOT / "months" / (month + ".json"), {}).get("events", []):
            ident = str(event.get("id") or "")
            if not ident:
                continue
            if event.get("status") != "final" or str(event.get("stage")) != "2":
                continue
            away, home = code(event.get("away")), code(event.get("home"))
            if away not in CODES or home not in CODES or away == home:
                continue
            try:
                score_a, score_h = int(event["scoreAway"]), int(event["scoreHome"])
            except (KeyError, ValueError, TypeError):
                continue
            if score_a == score_h:
                continue
            games[ident] = (event.get("date", ""), away, home, score_a, score_h)

    standings = {code_: {"team": code_, "w": 0, "l": 0, "pf": 0, "pa": 0, "lastFive": []}
                 for code_ in CODES}
    for game_date, away, home, score_a, score_h in sorted(games.values(), key=lambda x: x[0]):
        a, h = standings[away], standings[home]
        a["w"] += int(score_a > score_h)
        a["l"] += int(score_a < score_h)
        h["w"] += int(score_h > score_a)
        h["l"] += int(score_h < score_a)
        a["pf"] += score_a
        a["pa"] += score_h
        h["pf"] += score_h
        h["pa"] += score_a
        a["lastFive"].append("W" if score_a > score_h else "L")
        h["lastFive"].append("W" if score_h > score_a else "L")
    for entry in standings.values():
        entry["lastFive"] = entry["lastFive"][-5:]
    ordered = sorted(standings.values(),
        key=lambda r: (-(r["w"] / (r["w"] + r["l"]) if r["w"] + r["l"] else -1),
                       -(r["pf"] - r["pa"]), r["team"]))
    save(ROOT / "standings" / "2026-27.json", {
        "season": "2026-27",
        "source": "Resultados finais ESPN (não oficial)",
        "format": "temporada regular; pré-temporada e playoffs excluídos",
        "tieBreaker": "Apenas ordenação simplificada por aproveitamento e saldo, não classificação oficial da NBA",
        "lastGameDate": max((row[0] for row in games.values()), default=None),
        "gamesCount": len(games),
        "teams": ordered,
    })
    LOGS.append(f"Classificação derivada: {len(games)} jogos da temporada regular")

def main():
    ROOT.mkdir(parents=True, exist_ok=True)
    sync_calendar()
    sync_standings()
    sync_rosters()
    sync_final_stats()
    print("\n".join(LOGS))
    # Sem matar o site quando uma fonte externa ficar temporariamente indisponível.
    return 0

if __name__ == "__main__":
    sys.exit(main())
