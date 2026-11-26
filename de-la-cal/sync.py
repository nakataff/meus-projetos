"""Atualiza a edição de 2026 após validar as três seções."""
from datetime import datetime
from pathlib import Path
from urllib.request import urlopen
from zoneinfo import ZoneInfo
import json
import re

from bs4 import BeautifulSoup

ROOT = "https://brasileiraoemrodadas.com.br/"
TARGET = Path(__file__).with_name("brasileirao.json")


def page(path):
    with urlopen(ROOT + path, timeout=25) as response:
        return BeautifulSoup(response.read(), "html.parser")


def rows(page, width):
    for table in page.select("table"):
        result = []
        for tr in table.select("tr"):
            cells = [td.get_text(" ", strip=True) for td in tr.select("td")]
            if len(cells) == width and cells[0].isdigit():
                result.append(cells)
        if result:
            return result
    return []


def main():
    home = page("")
    if not re.search(r"Brasileirão Série A\s*·\s*2026", home.get_text(" ", strip=True)):
        raise ValueError("Temporada inesperada")
    table = rows(home, 8)
    goals = rows(page("brasileirao/artilharia-rodada-a-rodada.html"), 4)[:10]
    games = []
    pattern = r"(?:Seg|Ter|Qua|Qui|Sex|Sáb|Dom),\s*\d{1,2}\s+\w+\s+\d{1,2}h\d{2}\s*.+?\s*×\s*.+?\s*Rodada\s+\d+"
    for match in re.finditer(pattern, home.get_text(" ", strip=True)):
        game = " ".join(match.group().split())
        if len(game) < 140 and game not in games:
            games.append(game)
    if [r[0] for r in table] != list(map(str, range(1, 21))) or len(goals) != 10 or not games:
        raise ValueError("Edição incompleta")
    for rank, team, pts, played, wins, draws, losses, balance in table:
        if int(played) != int(wins) + int(draws) + int(losses):
            raise ValueError("Tabela inconsistente")
    for rank, name, team, total in goals:
        if not name or not team or not total.isdigit():
            raise ValueError("Artilharia inconsistente")
    updated = dict(table=table, goals=goals, games=games)
    previous = json.loads(TARGET.read_text())
    if any(previous[key] != value for key, value in updated.items()):
        updated["checked"] = datetime.now(ZoneInfo("America/Sao_Paulo")).strftime("%d/%m/%Y")
        TARGET.write_text(json.dumps(updated, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
