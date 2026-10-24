import importlib.util
import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('sync_nba', Path(__file__).parents[1] / 'sync_nba.py')
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)


def player(pid, pts=10):
    return {'id': pid, 'name': 'Atleta ' + pid, 'min': '24', 'pts': pts,
            'reb': 5, 'ast': 4, 'stl': 1, 'blk': 1, 'to': 2,
            'fg': '4-10', 'three': '2-5', 'plusMinus': '+4'}


def players(pts=10):
    return {team: [player(team + str(i), pts) for i in range(5)] for team in ('BOS', 'LAL')}


def event(gid, date, **extra):
    return {'id': gid, 'date': date, 'time': '21:00', 'away': 'BOS', 'home': 'LAL',
            'status': 'final', 'stage': 2, 'scoreAway': 50, 'scoreHome': 50, **extra}


def raw_summary(final=True):
    return {'header': {'competitions': [{'status': {'type': {'completed': final, 'state': 'post' if final else 'in'}}}]},
            'boxscore': {'players': [{'team': {'abbreviation': team}, 'statistics': [
                {'keys': ['minutes', 'points', 'rebounds', 'assists'], 'athletes': [
                    {'athlete': {'id': team + str(i), 'displayName': 'Atleta ' + team + str(i)},
                     'stats': ['24', '10', '5', '4']} for i in range(5)]}]} for team in ('BOS', 'LAL')]}}


class RankingSync(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.root_patch = patch.object(sync, 'ROOT', self.root)
        self.root_patch.start()
        self.now_patch = patch.object(sync, 'NOW', datetime(2026, 10, 24, 15, tzinfo=timezone.utc))
        self.now_patch.start()
        self.sleep_patch = patch.object(sync.time, 'sleep')
        self.sleep_patch.start()
        sync.LOGS.clear()

    def tearDown(self):
        self.sleep_patch.stop()
        self.now_patch.stop()
        self.root_patch.stop()
        self.tmp.cleanup()

    def write(self, name, data):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data))

    def test_totals_rounds_and_date_only_include_complete_final_boxscores(self):
        self.write('months/2026-10.json', {'events': [event('old', '2026-10-21'), event('new', '2026-10-23')]})
        self.write('stats/2026-10.json', {'games': {
            'old': {'players': players()}, 'new': {'players': {'BOS': players()['BOS']}}}})
        sync.sync_player_leaders()
        leaders = json.loads((self.root / 'player-leaders/2026-27.json').read_text())
        rounds = json.loads((self.root / 'player-rounds/2026-27.json').read_text())
        self.assertEqual(leaders['countedGameIds']['regular'], ['old'])
        self.assertEqual(leaders['lastGameDate'], '2026-10-21')
        self.assertTrue(all(p['gp'] == 1 for p in leaders['regular']))
        self.assertEqual(len(rounds['regular']), 10)
        self.assertTrue(all(r[2] == 'old' for r in rounds['regular']))

    def test_retries_older_partial_box_and_accepts_only_final_summary(self):
        ev = event('old', '2026-10-20')
        partial = {'BOS': players()['BOS']}
        self.write('months/2026-10.json', {'events': [ev]})
        self.write('stats/2026-10.json', {'games': {'old': {'players': partial}}})
        with patch.object(sync, 'get_json', return_value=raw_summary(False)) as fetch:
            sync.sync_final_stats()
            self.assertEqual(fetch.call_count, 1)
        data = json.loads((self.root / 'stats/2026-10.json').read_text())
        self.assertNotIn('LAL', data['games']['old']['players'])
        with patch.object(sync, 'get_json', return_value=raw_summary()) as fetch:
            sync.sync_final_stats()
            self.assertEqual(fetch.call_count, 1)
        data = json.loads((self.root / 'stats/2026-10.json').read_text())
        self.assertTrue(sync.complete_boxscore(data['games']['old']['players'], ev))
        with patch.object(sync, 'get_json') as fetch:
            sync.sync_final_stats()
            fetch.assert_not_called()

    def test_partial_minutes_and_scores_never_count_as_complete(self):
        ev = event('old', '2026-10-20')
        self.assertTrue(sync.complete_boxscore(players(), ev))
        self.assertFalse(sync.complete_boxscore(players(3), ev))
        rows = players()
        rows['BOS'][0]['min'] = '0'
        self.assertFalse(sync.complete_boxscore(rows, ev))

    def test_unavailable_source_preserves_saved_history(self):
        self.write('months/2026-10.json', {'events': [event('old', '2026-10-20')]})
        saved = {'games': {'old': {'players': {'BOS': players()['BOS']}}}}
        self.write('stats/2026-10.json', saved)
        with patch.object(sync, 'get_json', return_value=None):
            sync.sync_final_stats()
        self.assertEqual(json.loads((self.root / 'stats/2026-10.json').read_text()), saved)


if __name__ == '__main__':
    unittest.main()
