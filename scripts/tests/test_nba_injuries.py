"""Testes do boletim de lesões — respostas exemplificativas da ESPN."""
import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from tempfile import TemporaryDirectory

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from nba_injuries import normalize_injuries, sync_injuries


class InjuryTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026, 11, 6, 12, 0, tzinfo=timezone.utc)
        self.payload = {"injuries": [
            {"team": {"abbreviation": "MIN"}, "injuries": [
                {"athlete": {"id": "4594268", "displayName": "Anthony Edwards"},
                 "status": "Out", "type": {"name": "Knee"},
                 "date": "2026-10-29T18:00:00Z",
                 "details": {"side": "Right", "returnDate": "2026-12-21"}},
                {"athlete": {"id": "42", "displayName": "Healthy Player"},
                 "status": "Active"}]}
        ]}

    def test_normalization(self):
        data = normalize_injuries(self.payload, now=self.now)
        self.assertIn("4594268", data)
        self.assertNotIn("42", data)
        ant = data["4594268"]
        self.assertEqual(ant["team"], "MIN")
        self.assertEqual(ant["returnDate"], "2026-12-21")
        self.assertEqual(ant["reason"], "Knee")
        self.assertEqual(ant["firstSeen"], "2026-11-06")

    def test_flat_feed(self):
        sample = {"injuries": [{"team": {"id": "16"},
            "athlete": {"id": "4594268", "displayName": "Anthony Edwards"},
            "injury": {"type": "Knee", "location": "Right"},
            "status": "Out", "returnDate": "2026-12-21"}]}
        result = normalize_injuries(sample, now=self.now)
        self.assertEqual(result["4594268"]["team"], "MIN")
        self.assertEqual(result["4594268"]["reason"], "Knee")
        self.assertEqual(result["4594268"]["returnDate"], "2026-12-21")

    def test_grouped_espn_feed_resolves_team_and_player_from_links(self):
        sample = {"injuries": [{"id": "16", "injuries": [{
            "id": "536718", "status": "Out",
            "athlete": {"displayName": "Anthony Edwards", "links": [
                {"href": "https://www.espn.com/nba/player/_/id/4594268/anthony-edwards"}]},
            "type": {"name": "INJURY_STATUS_OUT"},
            "details": {"type": "Knee", "side": "Right", "returnDate": "2026-12-21"}
        }]}]}
        player = normalize_injuries(sample, now=self.now)["4594268"]
        self.assertEqual((player["team"], player["reason"], player["returnDate"]),
                         ("MIN", "Knee", "2026-12-21"))

    def test_previous_injury_keeps_first_seen(self):
        old = {"players": {"4594268": {
            "team": "MIN", "reason": "Knee", "firstSeen": "2026-10-29"}}}
        data = normalize_injuries(self.payload, old, self.now)
        self.assertEqual(data["4594268"]["firstSeen"], "2026-10-29")

    def test_bad_or_unknown_payload_is_rejected(self):
        self.assertIsNone(normalize_injuries({"x": []}, now=self.now))
        self.assertIsNone(normalize_injuries(None, now=self.now))
        changed = self.payload.copy()
        changed["injuries"] = []
        self.assertEqual(normalize_injuries(changed, now=self.now), {})

    def test_skip_fresh_cache_without_network_call(self):
        with TemporaryDirectory() as root:
            base = Path(root)
            previous = {"schemaVersion": 3, "checkedAt": (self.now - timedelta(hours=1)).isoformat(), "players": {}}
            calls = []
            def read(path, default):
                return previous
            def get_json(_):
                calls.append("called")
                return self.payload
            def save(path, data):
                calls.append("saved")
            sync_injuries(get_json, read, save, base, self.now, [])
            self.assertEqual(calls, [])

    def test_fetch_error_preserves_cache(self):
        with TemporaryDirectory() as root:
            called = []
            sync_injuries(lambda _:None, lambda p,d:{}, lambda p,d:called.append(d),
                          Path(root), self.now, [])
            self.assertEqual(called, [])


if __name__ == "__main__":
    unittest.main()
