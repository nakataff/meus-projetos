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

def choose_event(old, incoming):
    """Um resumo mensal atrasado nunca pode desfazer um resultado FINAL já confirmado."""
    if old and old.get("status") == "final" and incoming.get("status") != "final":
        return old
    return incoming


def sync_calendar():
    total = 0
    for month in MONTHS:
        target = ROOT / "months" / f"{month}.json"
        previous = {str(e["id"]): e for e in read(target, {}).get("events", []) if e.get("id")}
        result = get_json("scoreboard", {"dates": month.replace("-", ""), "limit": 500})
        fresh = [normalize_event(ev) for ev in (result or {}).get("events", [])]
        fresh = [e for e in fresh if e]
        if result is None or not fresh:
            LOGS.append(f"Calendário {month}: sem novos dados, mantendo arquivo existente")
            continue
        # Preserva partidas que desapareceram de respostas incompletas da fonte.
        for event in fresh:
            previous[event["id"]] = choose_event(previous.get(event["id"]), event)
        events = sorted(previous.values(), key=lambda e:(e["date"],e["time"]))
        save(target, {"month": month, "source":"ESPN (não oficial)", "events": events})
        total += len(events)
        time.sleep(0.22)

    # O endpoint mensal pode permanecer atrasado após o apito final. Uma
    # consulta pequena dos dias mais recentes reconcilia FINAL sem esperar
    # outra atualização mensal. Só grava meses efetivamente alterados.
    local_today = NOW.astimezone(BR).date()
    daily = {}
    for offset in (-1, 0, 1):
        day = local_today + timedelta(days=offset)
        response = get_json("scoreboard", {"dates": day.strftime("%Y%m%d"), "limit": 50})
        for raw in (response or {}).get("events", []):
            event = normalize_event(raw)
            if not event:
                continue
            month = event["date"][:7]
            if month not in MONTHS:
                continue
            if month not in daily:
                target = ROOT / "months" / f"{month}.json"
                daily[month] = {str(e["id"]): e for e in read(target, {}).get("events", []) if e.get("id")}
            daily[month][event["id"]] = choose_event(daily[month].get(event["id"]), event)
        time.sleep(0.18)
    for month, events_by_id in daily.items():
        target = ROOT / "months" / f"{month}.json"
        events = sorted(events_by_id.values(), key=lambda e:(e["date"],e["time"]))
        save(target, {"month": month, "source":"ESPN (não oficial)", "events":events})
    LOGS.append(f"Eventos processados: {total}; calendário recente reconciliado por dia")

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
        "countedGameIds": sorted(games),
        "teams": ordered,
    })
    LOGS.append(f"Classificação derivada: {len(games)} jogos da temporada regular")

def _shot_totals(raw):
    try:
        made, attempted = [int(part) for part in str(raw).split("-", 1)]
        if 0 <= made <= attempted:
            return made, attempted
    except (ValueError, TypeError):
        pass
    return 0, 0

def _minutes(raw):
    try:
        value = str(raw).replace("'", "").strip()
        if ":" in value:
            mins, secs = value.split(":", 1)
            return round(float(mins) + float(secs) / 60, 2)
        return float(value)
    except (ValueError, TypeError):
        return 0.0

def sync_team_summaries():
    """Arquivo leve por franquia; stats apenas de partidas com box score válido.

    'regular' e 'preseason' são mantidos separados. Campanha é baseada nos
    placares oficiais finalizados dos meses, enquanto reb/ast etc usam só os
    jogos com box score importado (boxGames), com denominador explícito.
    """
    calendar = {}
    for month in MONTHS:
        for ev in read(ROOT / "months" / (month + ".json"), {}).get("events", []):
            if ev.get("id"):
                calendar[str(ev["id"])] = ev
    games = {}
    for month in MONTHS:
        for game_id, box in read(ROOT / "stats" / (month + ".json"), {}).get("games", {}).items():
            games[str(game_id)] = box

    def blank_section():
        return {
            "games": 0, "wins": 0, "losses": 0, "pointsFor": 0,
            "pointsAgainst": 0, "boxGames": 0,
            "reb": 0, "ast": 0, "stl": 0, "blk": 0,
            "fgm": 0, "fga": 0, "threeM": 0, "threeA": 0,
            "players": [], "lastLineup": None
        }

    output = {team: {
        "team": team, "season": "2026-27",
        "source": "Jogos e box scores ESPN (não oficial)",
        "description": "Médias individuais por jogo disputado. Médias coletivas de rebotes/assistências consideram apenas box scores disponíveis.",
        "updatedThrough": None,
        "regular": blank_section(), "preseason": blank_section()
    } for team in CODES}
    for team in CODES:
        output[team]["_playerMaps"] = {"regular": {}, "preseason": {}}

    # Resultados para vitórias/derrotas e médias de pontos, apenas finais.
    for event in calendar.values():
        phase = "regular" if str(event.get("stage")) == "2" else (
            "preseason" if str(event.get("stage")) == "1" else None)
        if not phase or event.get("status") != "final":
            continue
        away, home = event.get("away"), event.get("home")
        if away not in output or home not in output:
            continue
        try:
            a, h = int(event["scoreAway"]), int(event["scoreHome"])
        except (ValueError, TypeError, KeyError):
            continue
        if a == h:
            continue
        for team, own, opp in ((away, a, h), (home, h, a)):
            row = output[team][phase]
            row["games"] += 1
            row["wins"] += int(own > opp)
            row["losses"] += int(own < opp)
            row["pointsFor"] += own
            row["pointsAgainst"] += opp
            date = event.get("date")
            if date and (output[team]["updatedThrough"] is None or date > output[team]["updatedThrough"]):
                output[team]["updatedThrough"] = date

    # Box scores consolidados; cada jogo entra somente na sua fase.
    for game_id, game in games.items():
        event = calendar.get(game_id)
        if not event or event.get("status") != "final":
            continue
        phase = "regular" if str(event.get("stage")) == "2" else (
            "preseason" if str(event.get("stage")) == "1" else None)
        if not phase:
            continue
        for team, athletes in (game.get("players") or {}).items():
            if team not in output or not isinstance(athletes, list) or not athletes:
                continue
            record = output[team][phase]
            record["boxGames"] += 1
            starters = [p for p in athletes if p.get("starter") and p.get("id")]
            played_date = str(event.get("date") or "")
            previous = record.get("lastLineup")
            if len(starters) >= 5 and (not previous or played_date >= previous["date"]):
                record["lastLineup"] = {
                    "date": played_date,
                    "players": [
                        {"id": str(p["id"]), "name": str(p.get("name") or ""),
                         "number": str(p.get("number") or ""),
                         "pts": p.get("pts"), "reb": p.get("reb"), "ast": p.get("ast")}
                        for p in starters[:5]
                    ]
                }
            player_maps = output[team]["_playerMaps"][phase]
            for p in athletes:
                ident = str(p.get("id") or "")
                if not ident or not p.get("name"):
                    continue
                if ident not in player_maps:
                    player_maps[ident] = {
                        "id": ident, "name": p["name"], "number": str(p.get("number") or ""),
                        "gp": 0, "starts": 0, "pts": 0, "reb": 0, "ast": 0,
                        "stl": 0, "blk": 0, "to": 0, "minutes": 0,
                        "fgm": 0, "fga": 0, "threeM": 0, "threeA": 0
                    }
                r = player_maps[ident]
                r["name"] = p["name"]
                r["gp"] += 1
                r["starts"] += int(bool(p.get("starter")))
                r["minutes"] += _minutes(p.get("min"))
                for stat in ("pts", "reb", "ast", "stl", "blk", "to"):
                    try:
                        amount = int(float(p.get(stat) or 0))
                    except (ValueError, TypeError):
                        amount = 0
                    r[stat] += amount
                    if stat in ("reb", "ast", "stl", "blk"):
                        record[stat] += amount
                fgm, fga = _shot_totals(p.get("fg"))
                tm, ta = _shot_totals(p.get("three"))
                r["fgm"] += fgm
                r["fga"] += fga
                r["threeM"] += tm
                r["threeA"] += ta
                for key, amount in (("fgm", fgm), ("fga", fga), ("threeM", tm), ("threeA", ta)):
                    record[key] += amount

    for team, data in output.items():
        player_maps = data.pop("_playerMaps")
        for phase in ("regular", "preseason"):
            rows = list(player_maps[phase].values())
            for row in rows:
                row["minutes"] = round(row["minutes"], 1)
            rows.sort(key=lambda p: (-(p["pts"] / max(p["gp"], 1)), -p["gp"], p["name"]))
            data[phase]["players"] = rows
        save(ROOT / "team-stats" / (team + ".json"), data)

def _dlq_rating(player):
    """Mesma avaliação por partida definida em nba/js/performance-rating.js."""
    try:
        pts = float(player["pts"])
        reb = float(player["reb"])
        ast = float(player["ast"])
    except (KeyError, TypeError, ValueError):
        return None
    mins = _minutes(player.get("min"))
    if mins <= 0:
        return None
    def stat(key):
        try:
            return float(player.get(key) or 0)
        except (TypeError, ValueError):
            return 0.0
    fgm, fga = _shot_totals(player.get("fg"))
    plus = stat("plusMinus")
    value = (5.8 + pts * .105 + reb * .13 + ast * .19 +
             stat("stl") * .32 + stat("blk") * .28 -
             stat("to") * .23 - (fga - fgm) * .13 +
             max(-.25, min(.25, plus * .015)))
    if mins < 8:
        value -= .35
    return int(max(1, min(10, value)) * 10 + .5) / 10


def sync_player_leaders():
    """Um único JSON de ranking: não carregar 30 elencos nem 7 arquivos de jogos no cliente.

    Apenas box scores de partidas FINALIZADAS; DNP/minutos zero não contam.
    Jogador transferido é deduplicado por ID para não duplicar produção.
    """
    calendar = {}
    for month in MONTHS:
        for event in read(ROOT / "months" / (month + ".json"), {}).get("events", []):
            if event.get("id"):
                calendar[str(event["id"])] = event
    phases = {"regular": {}, "preseason": {}}
    seen = set()
    for month in MONTHS:
        boxes = read(ROOT / "stats" / (month + ".json"), {}).get("games", {})
        for game_id, game in boxes.items():
            event = calendar.get(str(game_id))
            if not event or event.get("status") != "final":
                continue
            phase = {"2": "regular", "1": "preseason"}.get(str(event.get("stage")))
            if not phase:
                continue
            for team, athletes in (game.get("players") or {}).items():
                if team not in CODES:
                    continue
                for player in athletes:
                    ident = str(player.get("id") or "")
                    if not ident or not player.get("name"):
                        continue
                    key = (phase, str(game_id), ident)
                    if key in seen:
                        continue
                    seen.add(key)
                    minutes = _minutes(player.get("min"))
                    if minutes <= 0:
                        continue
                    rank = phases[phase]
                    row = rank.setdefault(ident, {
                        "id": ident, "name": player["name"], "team": team,
                        "lastDate": "", "gp": 0, "pts": 0, "reb": 0, "ast": 0,
                        "stl": 0, "blk": 0, "to": 0, "min": 0,
                        "fgm": 0, "fga": 0, "threeM": 0, "threeA": 0,
                        "ratingSum": 0, "ratingGames": 0,
                    })
                    date = str(event.get("date") or "")
                    if date >= row["lastDate"]:
                        row["team"] = team
                        row["name"] = player["name"]
                        row["lastDate"] = date
                    row["gp"] += 1
                    row["min"] += minutes
                    for field in ("pts", "reb", "ast", "stl", "blk", "to"):
                        try:
                            row[field] += float(player.get(field) or 0)
                        except (ValueError, TypeError):
                            pass
                    fgm, fga = _shot_totals(player.get("fg"))
                    three_m, three_a = _shot_totals(player.get("three"))
                    row["fgm"] += fgm
                    row["fga"] += fga
                    row["threeM"] += three_m
                    row["threeA"] += three_a
                    rating = _dlq_rating(player)
                    if rating is not None:
                        row["ratingSum"] += rating
                        row["ratingGames"] += 1
    for rank in phases.values():
        for row in rank.values():
            row["min"] = round(row["min"], 2)
            row["ratingSum"] = round(row["ratingSum"], 2)
            for key in ("pts", "reb", "ast", "stl", "blk", "to"):
                row[key] = int(row[key])
        # Lista estável, ordenada pelo ID; a ordenação estatística é feita no cliente.
    save(ROOT / "player-leaders" / "2026-27.json", {
        "season": "2026-27",
        "source": "Box scores finais ESPN (não oficial)",
        "description": "Médias por partida disputada; NOTA DLQ é a média da fórmula própria aplicada jogo a jogo. Rankings parciais, sujeitos a atualizações.",
        "lastGameDate": max((event.get("date", "") for event in calendar.values()
                             if event.get("status") == "final"), default=None),
        "regular": list(phases["regular"].values()),
        "preseason": list(phases["preseason"].values()),
    })
    LOGS.append("Rankings NBA: %d atletas na fase regular e %d na pré-temporada" %
                (len(phases["regular"]), len(phases["preseason"])))


def main():
    ROOT.mkdir(parents=True, exist_ok=True)
    sync_calendar()
    sync_standings()
    sync_rosters()
    sync_final_stats()
    sync_team_summaries()
    sync_player_leaders()
    print("\n".join(LOGS))
    # Sem matar o site quando uma fonte externa ficar temporariamente indisponível.
    return 0

if __name__ == "__main__":
    sys.exit(main())
