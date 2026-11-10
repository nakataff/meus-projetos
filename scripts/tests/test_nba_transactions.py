"""Testes da seção de mercado 2026/27: fontes, origem e integridade do cache."""
import copy
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from nba_transactions import normalize_transactions, sync_transactions, team_code, append_unique


class TransactionsTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026, 11, 10, 12, 0, tzinfo=timezone.utc)

    def test_team_id_and_aliases(self):
        self.assertEqual(team_code({"id": "14"}), "MIA")
        self.assertEqual(team_code({"abbreviation": "GS"}), "GSW")
        self.assertEqual(team_code({"$ref": "https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/teams/13"}), "LAL")
        self.assertEqual(team_code({"abbreviation": "???", "id": "0"}), "")

    def test_only_current_season_and_real_team(self):
        feed = {"transactions": [
            {"date": "2026-11-09T00:00:00Z", "type": "trade",
             "athlete": {"id": "123", "displayName": "Jogador A"},
             "fromTeam": {"id": "13"}, "toTeam": {"id": "14"}},
            {"date": "2026-06-20", "type": "trade",
             "athlete": {"id": "124", "displayName": "Jogador Antigo"},
             "fromTeam": {"id": "13"}, "toTeam": {"id": "14"}},
            {"date": "2026-11-09", "type": "signed", "athlete": {},
             "toTeam": {"id": "14"}},
        ]}
        rows = normalize_transactions(feed, "2026-11-10")
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["from"], "LAL")
        self.assertEqual(rows[0]["to"], "MIA")
        self.assertEqual(rows[0]["kind"], "Troca")

    def test_re_signing_not_new_arrival(self):
        rows = normalize_transactions({"transactions": [
            {"date":"2026-11-09", "description":"Re-signed Player to a two-year extension",
             "athlete":{"id":"1","displayName":"Player"}, "team":{"id":"14"}}
        ]}, "2026-11-10")
        self.assertEqual(rows, [])

    def test_waiver_is_departure(self):
        rows = normalize_transactions({"transactions": [
            {"date":"2026-11-09", "description":"Waived F Player",
             "athlete":{"id":"1","displayName":"Player"}, "team":{"id":"14"}}
        ]}, "2026-11-10")
        self.assertEqual((rows[0]["from"],rows[0]["to"],rows[0]["kind"]),
                         ("MIA","","Dispensa"))

    def test_duplicate_updates_enrich_id_without_duplication(self):
        items = [{"name":"Giannis Antetokounmpo","kind":"Troca","from":"MIL","to":"MIA"}]
        new = {"id":"111","name":"Giannis Antetokounmpo","kind":"Troca",
               "from":"MIL","to":"MIA","date":"2026-07-12"}
        self.assertFalse(append_unique(items,new))
        self.assertEqual(len(items),1)
        self.assertEqual(items[0]["id"],"111")

    def test_persist_new_moves_but_keep_draft_and_base(self):
        initial = {"season":"2026-27","teams":{
            "MIA":{"arrivals":[{"name":"Giannis Antetokounmpo","from":"MIL","to":"MIA","kind":"Troca"}],
                   "departures":[],"draft":[{"name":"Ryan Conwell","pick":37}]},
            "LAL":{"arrivals":[],"departures":[],"draft":[]}
        }}
        store = copy.deepcopy(initial)
        saved = []
        def read(_path, _default):
            return store
        def save(_path, payload):
            saved.append(copy.deepcopy(payload))
        def get_json(_path, _params):
            return {"transactions":[{"date":"2026-11-09","athlete":{"id":"77","displayName":"Jogador Novo"},
                   "type":"Trade","fromTeam":{"id":"13"},"toTeam":{"id":"14"}}]}
        with TemporaryDirectory() as folder:
            sync_transactions(get_json, read, save, Path(folder), self.now, [])
        self.assertEqual(len(saved),1)
        self.assertEqual(saved[0]["teams"]["MIA"]["draft"][0]["pick"],37)
        self.assertEqual(saved[0]["teams"]["MIA"]["arrivals"][-1]["from"],"LAL")
        self.assertEqual(saved[0]["teams"]["LAL"]["departures"][0]["to"],"MIA")

    def test_unavailable_feed_keeps_existing_cache(self):
        store = {"teams":{"MIA":{"arrivals":[],"departures":[],"draft":[{"pick":1}]}}}
        saved = []
        with TemporaryDirectory() as folder:
            sync_transactions(lambda *_: None,lambda *_: store,
                              lambda *_: saved.append(1),Path(folder),self.now,[])
        self.assertFalse(saved)


if __name__ == "__main__":
    unittest.main()
