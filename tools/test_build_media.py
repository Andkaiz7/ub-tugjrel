import io
import json
import os
import sys
import tempfile
import unittest
import urllib.error
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import build_media


class TestBuildMedia(unittest.TestCase):
    def test_lat(self):
        self.assertEqual(build_media.lat("Хурд"), "hurd")
        self.assertEqual(build_media.lat("Гэгээн гуниг"), "gegeen gunig")
        self.assertEqual(build_media.lat("Өнөр Үүр"), "onor uur")

    def test_key(self):
        self.assertEqual(build_media.key("Хурд"), "hurd")
        self.assertEqual(build_media.key("Hurd"), "hurd")
        self.assertEqual(build_media.key("Khurd"), "hurd")
        self.assertEqual(build_media.key("Hürd"), "hurd")
        self.assertEqual(build_media.key("Гэгээн Гуниг!"), "gegengunig")
        self.assertEqual(build_media.key("Гунииг"), "gunig")
        self.assertEqual(build_media.key("Guniig"), "gunig")
        self.assertEqual(build_media.key("Gunig"), "gunig")

    def test_name_variants(self):
        v = build_media.variants("С.Жавхлан")
        self.assertIn(build_media.key("S.Javkhlan"), v)
        self.assertIn(build_media.key("Javkhlan"), v)

    def test_title_match(self):
        self.assertFalse(build_media.title_match("Миний Монгол", "Монгол"))
        self.assertFalse(build_media.title_match("Бүсгүй", "Зураг шиг бүсгүй"))
        self.assertTrue(build_media.title_match("Гэгээн гуниг", "Gegeen Guniig (Live)"))
        self.assertTrue(build_media.title_match("Хайртай", "Hairtai - Remastered"))
        self.assertFalse(build_media.title_match("Чи", "Чи намайг"))
        self.assertTrue(build_media.title_match("Гэгээн гуниг", "Гэгээн Гуниг"))
        self.assertTrue(
            build_media.title_match(
                "Үс цайтал хамт ft (Nene)", "Us Tsaital Hamt [Remix] (Live)"
            )
        )
        self.assertTrue(build_media.title_match("Хайртай", "Hairtai feat. Artist"))

    def test_pick_artist(self):
        results = [
            {"artistId": 1, "artistName": "Ryan Hurd", "trackName": "Chasin' You"},
            {"artistId": 2, "artistName": "Hurd", "trackName": "Гэгээн Гуниг"},
            {"artistId": 2, "artistName": "Hurd", "trackName": "Эх орон"},
            {"artistId": 3, "artistName": "Hurd", "trackName": "Байхгүй"},
        ]
        titles = ["Гэгээн гуниг", "Эх орон", "Ирээдүй"]
        self.assertEqual(build_media.pick_artist(results, "Хурд", titles), 2)
        self.assertIsNone(
            build_media.pick_artist([results[0], results[3]], "Хурд", titles)
        )

        short_only = [{"artistId": 10, "artistName": "Haranga", "trackName": "Монгол"}]
        self.assertIsNone(
            build_media.pick_artist(short_only, "Харанга", ["Монгол", "Өөр дуу"])
        )

        long_single = [
            {"artistId": 11, "artistName": "Haranga", "trackName": "Гэгээн гуниг"}
        ]
        self.assertEqual(
            build_media.pick_artist(long_single, "Харанга", ["Гэгээн гуниг"]), 11
        )

        two_short = [
            {"artistId": 12, "artistName": "Haranga", "trackName": "Монгол"},
            {"artistId": 12, "artistName": "Haranga", "trackName": "Хайр"},
        ]
        self.assertEqual(
            build_media.pick_artist(two_short, "Харанга", ["Монгол", "Хайр"]), 12
        )

    def test_photo_url(self):
        self.assertEqual(
            build_media.photo_url(
                "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/abc/pr_source.png/1200x630cw.png"
            ),
            "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/abc/pr_source.png/200x200cc.jpg",
        )
        self.assertIsNone(
            build_media.photo_url(
                "https://cdn-images.dzcdn.net/images/artist//250x250-000000-80-0-0.jpg"
            )
        )
        valid_dz = "https://cdn-images.dzcdn.net/images/artist/9f3c7d1a2b4e5f60718293a4b5c6d7e8/250x250-000000-80-0-0.jpg"
        self.assertEqual(build_media.photo_url(valid_dz), valid_dz)
        self.assertIsNone(
            build_media.photo_url("https://music.apple.com/assets/meta/og-image.png")
        )

    def test_exact_match_wins_over_containment(self):
        tracks = [
            {"trackName": "Зураг шиг бүсгүй", "previewUrl": "https://a.example/zurag.m4a"},
            {"trackName": "Бүсгүй", "previewUrl": "https://a.example/busgui.m4a"},
            {
                "trackName": "Uulen Domog (feat. Rokitbay)",
                "previewUrl": "https://a.example/feat.m4a",
            },
            {"trackName": "Uulen Domog", "previewUrl": "https://a.example/solo.m4a"},
        ]
        selected = build_media._select_previews(["Бүсгүй", "Үүлэн домог"], tracks)
        self.assertEqual(
            selected,
            {
                "Бүсгүй": "https://a.example/busgui.m4a",
                "Үүлэн домог": "https://a.example/solo.m4a",
            },
        )

    def test_lookup_failure_only_uses_picked_artist(self):
        groups = [
            {
                "id": "g1",
                "name": "Хурд",
                "pack": False,
                "songs": [{"t": "Гэгээн гуниг"}, {"t": "Эх орон"}, {"t": "Хайр минь"}],
            }
        ]

        def fake_get_json(url):
            if "itunes.apple.com/search" in url and "entity=song" in url:
                return {
                    "results": [
                        {
                            "artistId": 447469926,
                            "artistName": "Hurd",
                            "trackName": "Гэгээн Гуниг",
                            "previewUrl": "https://audio.example/hurd.m4a",
                        },
                        {
                            "artistId": 999999,
                            "artistName": "Other Artist",
                            "trackName": "Хайр минь",
                            "previewUrl": "https://audio.example/other.m4a",
                        },
                    ]
                }
            if "itunes.apple.com/lookup" in url:
                return {}
            return {}

        data = build_media.build(groups, fake_get_json, lambda _: "")
        self.assertEqual(
            data["pre"]["g1"], {"Гэгээн гуниг": "https://audio.example/hurd.m4a"}
        )

    def test_music_artist_fallback(self):
        groups = [
            {
                "id": "bold1",
                "name": "Болд",
                "pack": False,
                "songs": [{"t": "Гэгээн домог"}, {"t": "Үүлэн домог"}],
            }
        ]

        def fake_get_json(url):
            if "entity=song" in url and "search?" in url:
                return {
                    "results": [
                        {
                            "artistId": 1,
                            "artistName": "Bold Foreigner",
                            "trackName": "Noise",
                        }
                    ]
                }
            if "entity=musicArtist" in url and "term=bold" in url:
                return {
                    "results": [
                        {"wrapperType": "artist", "artistId": 100, "artistName": "Bold"},
                        {"wrapperType": "artist", "artistId": 200, "artistName": "Bold"},
                        {
                            "wrapperType": "artist",
                            "artistId": 300,
                            "artistName": "Boldy James",
                        },
                    ]
                }
            if "lookup?id=100" in url:
                return {
                    "results": [
                        {
                            "trackName": "Гэгээн домог",
                            "previewUrl": "https://audio.example/100.m4a",
                        }
                    ]
                }
            if "lookup?id=200" in url:
                return {
                    "results": [
                        {
                            "trackName": "Гэгээн домог",
                            "previewUrl": "https://audio.example/200a.m4a",
                        },
                        {
                            "trackName": "Үүлэн домог",
                            "previewUrl": "https://audio.example/200b.m4a",
                        },
                    ]
                }
            return {}

        def fake_get_text(url):
            if "artist/200" in url:
                return '<meta property="og:image" content="https://is1-ssl.mzstatic.com/image/thumb/Features126/v4/x/artist.jpg/1200x630cw.png">'
            return ""

        data = build_media.build(groups, fake_get_json, fake_get_text)
        self.assertEqual(
            data["pre"]["bold1"],
            {
                "Гэгээн домог": "https://audio.example/200a.m4a",
                "Үүлэн домог": "https://audio.example/200b.m4a",
            },
        )
        self.assertEqual(
            data["img"]["bold1"],
            "https://is1-ssl.mzstatic.com/image/thumb/Features126/v4/x/artist.jpg/200x200cc.jpg",
        )

    def test_photo_priority_deezer_rejection_and_skip_img(self):
        dz_img_1 = "https://cdn-images.dzcdn.net/images/artist/1111/250x250-000000-80-0-0.jpg"
        dz_img_2 = "https://cdn-images.dzcdn.net/images/artist/2222/250x250-000000-80-0-0.jpg"
        groups = [
            {
                "id": "art_apple",
                "name": "Ука",
                "pack": False,
                "songs": [{"t": "Маргаашийн нар"}],
            },
            {
                "id": "rel_apple_dz",
                "name": "Болд",
                "pack": False,
                "songs": [{"t": "Гэгээн домог"}],
            },
            {
                "id": "no_og_dz",
                "name": "Наран",
                "pack": False,
                "songs": [{"t": "Ижий сэтгэл"}],
            },
            {
                "id": "rel_only",
                "name": "Отгоо",
                "pack": False,
                "songs": [{"t": "Нэгэн залуу"}],
            },
            {
                "id": "4ed5a354",
                "name": "NeNe",
                "pack": False,
                "songs": [{"t": "Гоолингоо дуу"}],
            },
        ]

        def fake_get_json(url):
            if "itunes.apple.com/search" in url and "entity=song" in url:
                if "term=uka" in url:
                    return {
                        "results": [
                            {
                                "artistId": 1,
                                "artistName": "Uka",
                                "trackName": "Маргаашийн нар",
                                "previewUrl": "https://a/1.m4a",
                            }
                        ]
                    }
                if "term=bold" in url:
                    return {
                        "results": [
                            {
                                "artistId": 2,
                                "artistName": "Bold",
                                "trackName": "Гэгээн домог",
                                "previewUrl": "https://a/2.m4a",
                            }
                        ]
                    }
                if "term=naran" in url:
                    return {
                        "results": [
                            {
                                "artistId": 3,
                                "artistName": "Naran",
                                "trackName": "Ижий сэтгэл",
                                "previewUrl": "https://a/3.m4a",
                            }
                        ]
                    }
                if "term=otgoo" in url:
                    return {
                        "results": [
                            {
                                "artistId": 4,
                                "artistName": "Otgoo",
                                "trackName": "Нэгэн залуу",
                                "previewUrl": "https://a/4.m4a",
                            }
                        ]
                    }
                if "term=NeNe" in url:
                    return {
                        "results": [
                            {
                                "artistId": 5,
                                "artistName": "NeNe",
                                "trackName": "Гоолингоо дуу",
                                "previewUrl": "https://a/5.m4a",
                            }
                        ]
                    }
            if "itunes.apple.com/lookup" in url:
                return {}
            if "api.deezer.com/search/artist" in url:
                if "q=bold" in url:
                    return {
                        "data": [{"id": 20, "name": "Bold", "picture_medium": dz_img_1}]
                    }
                if "q=naran" in url:
                    return {
                        "data": [{"id": 30, "name": "Naran", "picture_medium": dz_img_2}]
                    }
                if "q=otgoo" in url:
                    return {
                        "data": [{"id": 40, "name": "Otgoo", "picture_medium": dz_img_2}]
                    }
                if "q=NeNe" in url:
                    return {
                        "data": [{"id": 50, "name": "NeNe", "picture_medium": dz_img_2}]
                    }
            if "api.deezer.com/artist/20/top" in url:
                return {"data": [{"title": "Гэгээн домог"}]}
            if "api.deezer.com/artist/30/top" in url:
                return {"data": [{"title": "Ижий сэтгэл"}]}
            if "api.deezer.com/artist/40/top" in url:
                return {"data": [{"title": "Шал өөр дуу"}]}
            if "api.deezer.com/artist/50/top" in url:
                return {"data": [{"title": "Гоолингоо дуу"}]}
            return {}

        def fake_get_text(url):
            if "artist/1" in url:
                return '<meta property="og:image" content="https://is1-ssl.mzstatic.com/image/thumb/AMCArtistImages116/v4/u/pic.png/1200x630cw.png">'
            if "artist/2" in url:
                return '<meta property="og:image" content="https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/b/cover.jpg/1200x630cw.png">'
            if "artist/3" in url:
                return ""
            if "artist/4" in url:
                return '<meta property="og:image" content="https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/o/cover.jpg/1200x630cw.png">'
            if "artist/5" in url:
                return '<meta property="og:image" content="https://is1-ssl.mzstatic.com/image/thumb/AMCArtistImages116/v4/n/pic.png/1200x630cw.png">'
            return ""

        data = build_media.build(groups, fake_get_json, fake_get_text)
        self.assertEqual(
            data["img"]["art_apple"],
            "https://is1-ssl.mzstatic.com/image/thumb/AMCArtistImages116/v4/u/pic.png/200x200cc.jpg",
        )
        self.assertEqual(data["img"]["rel_apple_dz"], dz_img_1)
        self.assertEqual(data["img"]["no_og_dz"], dz_img_2)
        self.assertEqual(
            data["img"]["rel_only"],
            "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/o/cover.jpg/200x200cc.jpg",
        )
        self.assertNotIn("4ed5a354", data["img"])
        self.assertEqual(data["pre"]["4ed5a354"], {"Гоолингоо дуу": "https://a/5.m4a"})

    def test_fetchers_atomic_cache_and_failures(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            stats = {"failed": 0}
            _, get_text = build_media._make_fetchers(tmpdir, stats=stats)

            class FakeResp:
                def __init__(self, body):
                    self._body = body

                def read(self):
                    return self._body

                def __enter__(self):
                    return self

                def __exit__(self, *args):
                    return False

            with mock.patch("urllib.request.urlopen", return_value=FakeResp(b'{"ok":1}')):
                self.assertEqual(get_text("https://api.deezer.com/test"), '{"ok":1}')
            self.assertEqual(stats["failed"], 0)
            files = os.listdir(tmpdir)
            self.assertEqual(len(files), 1)
            self.assertFalse(files[0].startswith(".tmp_"))

            err_403 = urllib.error.HTTPError(
                "https://api.deezer.com/fail", 403, "Forbidden", {}, io.BytesIO(b"")
            )
            with mock.patch("urllib.request.urlopen", side_effect=err_403), mock.patch(
                "time.sleep"
            ):
                self.assertEqual(get_text("https://api.deezer.com/fail"), "")
            self.assertEqual(stats["failed"], 1)
            self.assertEqual(len(os.listdir(tmpdir)), 1)

    def test_build(self):
        groups = [
            {
                "id": "pack1",
                "name": "Pack",
                "pack": True,
                "songs": [{"t": "Гэгээн гуниг"}],
            },
            {
                "id": "g1",
                "name": "Хурд",
                "pack": False,
                "songs": [{"t": "Гэгээн гуниг"}, {"t": "Байхгүй дуу"}],
            },
            {
                "id": "g2",
                "name": "Ариунаа",
                "pack": False,
                "songs": [{"t": "Хайрын дуу"}],
            },
            {
                "id": "g3",
                "name": "Олдохгүй",
                "pack": False,
                "songs": [{"t": "Нэг дуу"}],
            },
        ]

        def fake_get_json(url):
            if "itunes.apple.com/search" in url and "entity=song" in url and "term=hurd" in url:
                return {
                    "results": [
                        {
                            "artistId": 447469926,
                            "artistName": "Hurd",
                            "trackName": "Гэгээн Гуниг",
                            "previewUrl": "https://audio.example/1.m4a",
                        }
                    ]
                }
            if "itunes.apple.com/lookup" in url and "id=447469926" in url:
                return {
                    "results": [
                        {"wrapperType": "artist", "artistId": 447469926},
                        {
                            "wrapperType": "track",
                            "artistId": 447469926,
                            "artistName": "Hurd",
                            "trackName": "Гэгээн Гуниг",
                            "previewUrl": "https://audio.example/1.m4a",
                        },
                    ]
                }
            if "api.deezer.com/search/artist" in url and "q=ariunaa" in url:
                return {
                    "data": [
                        {
                            "id": 99,
                            "name": "Ariunaa",
                            "picture_medium": "https://cdn-images.dzcdn.net/images/artist/abcd1234/250x250-000000-80-0-0.jpg",
                        }
                    ]
                }
            if "api.deezer.com/artist/99/top" in url:
                return {"data": [{"title": "Хайрын дуу"}]}
            return {}

        def fake_get_text(url):
            if "music.apple.com/us/artist/447469926" in url:
                return '<meta property="og:image" content="https://is1-ssl.mzstatic.com/image/thumb/a/pr_source.png/1200x630cw.png">'
            return ""

        data = build_media.build(groups, fake_get_json, fake_get_text)
        self.assertNotIn("pack1", data["img"])
        self.assertNotIn("pack1", data["pre"])
        self.assertEqual(
            data["img"]["g1"],
            "https://is1-ssl.mzstatic.com/image/thumb/a/pr_source.png/200x200cc.jpg",
        )
        self.assertEqual(data["pre"]["g1"], {"Гэгээн гуниг": "https://audio.example/1.m4a"})
        self.assertEqual(
            data["img"]["g2"],
            "https://cdn-images.dzcdn.net/images/artist/abcd1234/250x250-000000-80-0-0.jpg",
        )
        self.assertNotIn("g2", data["pre"])
        self.assertNotIn("g3", data["img"])
        self.assertNotIn("g3", data["pre"])

        rendered = build_media.render(data)
        self.assertTrue(rendered.startswith("window.MEDIA="))
        self.assertTrue(rendered.endswith(";"))
        parsed = json.loads(rendered[len("window.MEDIA=") : -1])
        self.assertEqual(parsed, data)


if __name__ == "__main__":
    unittest.main()
