"""Resumo compacto de lesões da ESPN para o DE LA QUADRA.

A API da ESPN é pública, mas não oficial e não tem SLA. Salvar no cache do
GitHub evita consultas por visitante e mantém a atualização independente do browser.
"""
from datetime import datetime, timedelta, timezone


def _text(value):
    if isinstance(value, dict):
        for key in ("displayName", "name", "description", "abbreviation", "type"):
            if value.get(key) is not None:
                return _text(value[key])
        return ""
    return str(value or "").strip()


def _date(value):
    value = _text(value)
    if len(value) >= 10 and value[:4].isdigit() and value[4] == "-" and value[7] == "-":
        try:
            return datetime.strptime(value[:10], "%Y-%m-%d").strftime("%Y-%m-%d")
        except ValueError:
            pass
    return ""


def normalize_injuries(payload, previous=None, now=None):
    """Retorna registros por ID ESPN, ou None para um formato desconhecido."""
    groups = payload.get("injuries") if isinstance(payload, dict) else None
    if not isinstance(groups, list):
        return None
    before = (previous or {}).get("players") or {}
    checked = (now or datetime.now(timezone.utc)).date().isoformat()
    result = {}
    aliases = {"GS":"GSW", "NY":"NYK", "SA":"SAS", "NO":"NOP",
               "UTAH":"UTA", "WSH":"WAS", "PHO":"PHX"}
    id_to_team = {1:"ATL",2:"BOS",3:"NOP",4:"CHI",5:"CLE",6:"DAL",7:"DEN",
                  8:"DET",9:"GSW",10:"HOU",11:"IND",12:"LAC",13:"LAL",14:"MIA",
                  15:"MIL",16:"MIN",17:"BKN",18:"NYK",19:"ORL",20:"PHI",
                  21:"PHX",22:"POR",23:"SAC",24:"SAS",25:"OKC",26:"UTA",
                  27:"WAS",28:"TOR",29:"MEM",30:"CHA"}
    for group in groups:
        if not isinstance(group, dict):
            continue
        team = group.get("team") or {}
        if isinstance(team, dict):
            code = str(team.get("abbreviation") or "").upper()
        else:
            code = ""
        code = aliases.get(code, code)
        if not code and isinstance(team, dict):
            try:
                code = id_to_team.get(int(team.get("id") or 0), "")
            except (ValueError, TypeError):
                pass
        records = group.get("injuries")
        if not isinstance(records, list):
            records = [group] if isinstance(group.get("athlete"), dict) else []
        for injury in records:
            if not isinstance(injury, dict):
                continue
            athlete = injury.get("athlete") or {}
            if not isinstance(athlete, dict):
                continue
            pid = str(athlete.get("id") or "")
            if not pid.isdigit():
                continue
            status = _text(injury.get("status"))
            if not status or status.lower() in {"active","healthy","available"}:
                continue
            details = injury.get("details") or {}
            if not isinstance(details, dict):
                details = {}
            injury_info = injury.get("injury") or {}
            if not isinstance(injury_info, dict):
                injury_info = {"type": injury_info}
            typ = injury_info.get("type") or injury.get("type") or {}
            if isinstance(typ, dict):
                reason = _text(typ.get("name") or typ.get("displayName"))
            else:
                reason = _text(typ)
            reason = reason or _text(details.get("type")) or _text(details.get("injury"))
            side = _text(injury_info.get("location") or details.get("side") or injury.get("side"))
            detail = _text(injury_info.get("detail") or details.get("detail") or details.get("description"))
            expected = _date(injury.get("returnDate") or injury.get("expectedReturnDate") or
                             details.get("returnDate") or details.get("expectedReturnDate"))
            old = before.get(pid) or {}
            same = (old.get("team") == code and old.get("reason", "").lower() == reason.lower())
            result[pid] = {
                "id": pid, "name": _text(athlete.get("displayName") or athlete.get("fullName")),
                "team": code, "status": status, "reason": reason, "detail": detail,
                "side": side, "reportDate": _date(injury.get("date")),
                "returnDate": expected, "firstSeen": old.get("firstSeen", checked) if same else checked
            }
    return result


def sync_injuries(get_json, read, save, root, now, logs, force=False):
    target = root / "injuries" / "current.json"
    prev = read(target, {})
    last = prev.get("checkedAt")
    if not force and prev.get("schemaVersion") == 2 and isinstance(last, str):
        try:
            if now - datetime.fromisoformat(last.replace("Z","+00:00")) < timedelta(hours=4):
                return
        except (TypeError, ValueError):
            pass
    raw = get_json("injuries")
    players = normalize_injuries(raw, prev, now)
    if players is None:
        logs.append("Lesões NBA: resposta indisponível ou formato desconhecido; cache preservado")
        return
    if not players:
        logs.append("Lesões NBA: nenhum jogador reconhecido no boletim; cache preservado")
        return
    save(target, {
        "schemaVersion": 2,
        "source": "ESPN (API pública não oficial)",
        "checkedAt": now.isoformat(timespec="seconds").replace("+00:00", "Z"),
        "players": players
    })
    logs.append(f"Lesões NBA: {len(players)} jogadores no boletim")
