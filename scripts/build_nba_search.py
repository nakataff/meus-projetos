"""Build a compact public search index from existing NBA JSON, without API calls."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / 'nba' / 'data'

def build_search_index(root=ROOT):
    players, games = {}, {}
    for file in sorted((root / 'teams').glob('*.json')):
        for p in json.loads(file.read_text()).get('players', []):
            if p.get('id') and p.get('name'):
                players[(str(p['id']), file.stem)] = [str(p['id']), p['name'], file.stem]
    for file in sorted((root / 'months').glob('*.json')):
        for g in json.loads(file.read_text()).get('events', []):
            if all(g.get(k) for k in ('id', 'away', 'home', 'date')):
                games[str(g['id'])] = [str(g['id']), g['away'], g['home'], g['date'], g.get('time', '')]
    data = {'players': list(players.values()), 'games': list(games.values())}
    (root / 'search.json').write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':'))+'\n')
    return data

if __name__ == '__main__':
    build_search_index()
