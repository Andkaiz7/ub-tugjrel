import hashlib
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import build_intl


def plain(lines):
    return "\n".join(lines)


class TestCleanLyrics(unittest.TestCase):
    def test_cleaning(self):
        lines = build_intl.clean_lyrics(
            plain(
                [
                    "[Verse 1]",
                    "",
                    "Walking down the empty road tonight",
                    "I’m   dreaming ‘bout the “lights” (ooh yeah)",
                    "(Oh oh oh)",
                    "Walking down the empty road tonight",
                    "너를 사랑해 so much tonight",
                    "Привет my friend tonight again",
                    "Waiting for the morning sun - -",
                    "[Chorus]",
                ]
            )
        )
        self.assertEqual(
            lines,
            [
                "Walking down the empty road tonight",
                "I'm dreaming 'bout the \"lights\"",
                "Waiting for the morning sun",
            ],
        )

    def test_latin_accents_allowed_other_scripts_rejected(self):
        self.assertTrue(build_intl.is_latin_text("Café señorita, we're gone"))
        self.assertFalse(build_intl.is_latin_text("hello 世界"))
        self.assertFalse(build_intl.is_latin_text("hello ♪ world"))

    def test_target_and_prev_rules(self):
        self.assertTrue(build_intl.target_ok("Walking down the empty road tonight"))
        self.assertFalse(build_intl.target_ok("oh oh oh oh oh oh"))
        self.assertFalse(build_intl.target_ok("Counting 1 by 1 each night"))
        self.assertFalse(build_intl.target_ok("Time: it never waits for you"))
        self.assertFalse(build_intl.target_ok("Running through [the] rain tonight"))
        self.assertTrue(build_intl.prev_ok("Just a short line"))
        self.assertFalse(build_intl.prev_ok("Line with 2 digits"))
        self.assertFalse(build_intl.prev_ok(" ".join(["word"] * 15)))

    def test_looks_english(self):
        self.assertTrue(build_intl.looks_english(["I love you and the night", "Take me to the sky"]))
        self.assertFalse(build_intl.looks_english(["Quiero bailar contigo esta noche", "Ven conmigo mi amor"]))
        self.assertFalse(build_intl.looks_english([]))


class TestSongExcerpts(unittest.TestCase):
    def test_excerpt_shape_and_ids(self):
        lyrics = plain(
            [
                f"I walk the {w} road with you tonight"
                for w in ["quiet", "silver", "golden", "broken", "endless", "narrow", "wild", "frozen"]
            ]
        )
        seen = set()
        xs = build_intl.song_excerpts("Test Singer", lyrics, seen)
        self.assertEqual(len(xs), 5)
        lines = build_intl.clean_lyrics(lyrics)
        for eid, prev, target in xs:
            self.assertEqual(eid, hashlib.sha1(f"Test Singer|{target}".encode("utf-8")).hexdigest()[:10])
            self.assertEqual(prev, lines[lines.index(target) - 1])
            self.assertTrue(4 <= len(target.split()) <= 10)
        self.assertEqual(len({x[2] for x in xs}), 5)
        self.assertEqual(build_intl.song_excerpts("Test Singer", lyrics, seen), [])

    def test_blocked_dropped(self):
        lyrics = plain(
            [
                "I walk the quiet road with you tonight",
                "You shake your ass all night with me",
                "I walk the silver road with you tonight",
                "We chase the golden light over the hill",
            ]
        )
        dropped = []
        xs = build_intl.song_excerpts("Test Singer", lyrics, set(), dropped)
        targets = [x[2] for x in xs]
        self.assertNotIn("You shake your ass all night with me", targets)
        self.assertNotIn("I walk the silver road with you tonight", targets)
        self.assertEqual(len(dropped), 2)

    def test_non_english_song_skipped(self):
        lyrics = plain(
            [
                "Quiero bailar contigo esta noche",
                "Ven conmigo mi amor querido",
                "Siento tu calor en mi piel",
                "Baila baila baila conmigo ahora",
            ]
        )
        self.assertEqual(build_intl.song_excerpts("Test Singer", lyrics, set()), [])


class TestTracksAndArtists(unittest.TestCase):
    def test_usable_tracks(self):
        tracks = [
            {"title": "Night Drive", "title_short": "Night Drive", "duration": 200},
            {"title": "Night Drive (Remix)", "title_short": "Night Drive", "title_version": "(Remix)", "duration": 210},
            {"title": "Night Drive - Live at Arena", "title_short": "Night Drive", "duration": 215},
            {"title": "Live Forever", "title_short": "Live Forever", "duration": 180},
            {"title": "Night Drive (Taylor's Version)", "title_short": "Night Drive", "title_version": "(Taylor's Version)", "duration": 201},
            {"title": "Slow Burn (Sped Up)", "title_short": "Slow Burn", "duration": 150},
            {"title": "Quiet Storm (feat. Someone Else)", "title_short": "Quiet Storm", "duration": 190},
            {"title": "Soft Rain (Acoustic)", "title_short": "Soft Rain", "title_version": "(Acoustic)", "duration": 190},
            {"title": "Soft Rain - Radio Edit", "title_short": "Soft Rain", "duration": 190},
            {"title": "Soft Rain (Clean Ver.)", "title_short": "Soft Rain", "duration": 190},
            {"title": "Dreamers [Music from the Official Soundtrack]", "duration": 200},
        ]
        got = build_intl.usable_tracks(tracks)
        self.assertEqual([t["title"] for t in got], ["Night Drive", "Live Forever", "Quiet Storm", "Dreamers"])
        self.assertEqual(got[0]["duration"], 200)

    def test_pick_artist(self):
        results = [
            {"id": 1, "name": "Rose Band", "nb_fan": 900},
            {"id": 2, "name": "Rose", "nb_fan": 50},
            {"id": 3, "name": "ROSÉ", "nb_fan": 10},
            {"id": 4, "name": "rosé", "nb_fan": 70},
        ]
        self.assertEqual(build_intl.pick_artist(results, "ROSÉ")["id"], 4)
        self.assertEqual(build_intl.pick_artist(results, "Rose")["id"], 2)
        self.assertIsNone(build_intl.pick_artist(results, "Nobody"))

    def test_itunes_tracks(self):
        results = [
            {"artistName": "Test Singer", "trackName": "Night Drive (feat. Guest)", "trackTimeMillis": 200400},
            {"artistName": "Test Singer & Friend", "trackName": "Duet Song", "trackTimeMillis": 180000},
            {"artistName": "Other Band", "trackName": "Cover (feat. Test Singer)", "trackTimeMillis": 190000},
            {"artistName": "Test Singer", "trackTimeMillis": 190000},
        ]
        got = build_intl.itunes_tracks(results, "Test Singer")
        self.assertEqual([t["title"] for t in got], ["Night Drive (feat. Guest)", "Duet Song"])
        self.assertEqual(got[0]["duration"], 200)
        self.assertEqual([t["title"] for t in build_intl.usable_tracks(got)], ["Night Drive", "Duet Song"])

    def test_pick_lyrics(self):
        items = [
            {"artistName": "Other Singer", "trackName": "Night Drive", "plainLyrics": "wrong"},
            {"artistName": "Test Singer", "trackName": "Night Drive", "plainLyrics": "inst", "instrumental": True},
            {"artistName": "Test Singer", "trackName": "Different Song", "plainLyrics": "wrong too"},
            {"artistName": "Test Singer", "trackName": "Night Drive", "plainLyrics": None},
            {"artistName": "test singer & friend", "trackName": "Night Drive", "plainLyrics": "right"},
        ]
        self.assertEqual(build_intl.pick_lyrics(items, "Test Singer", "Night Drive"), "right")
        self.assertIsNone(build_intl.pick_lyrics(items[:4], "Test Singer", "Night Drive"))

    def test_make_group(self):
        songs = [{"t": f"S{i}", "x": [[f"e{i}a", "p", "t"], [f"e{i}b", "p", "t"]]} for i in range(5)]
        group = build_intl.make_group("Test Singer", 25000000, songs)
        self.assertEqual(group["id"], hashlib.sha1(b"Test Singer").hexdigest()[:8])
        self.assertEqual(group["views"], 2500)
        self.assertTrue(group["intl"])
        self.assertFalse(group["pack"])
        self.assertIsNone(build_intl.make_group("Test Singer", 1, songs[:4]))
        self.assertIsNone(build_intl.make_group("Test Singer", 1, [{"t": f"S{i}", "x": [["e", "p", "t"]]} for i in range(5)]))


if __name__ == "__main__":
    unittest.main()
