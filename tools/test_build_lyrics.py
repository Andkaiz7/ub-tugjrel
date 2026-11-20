import hashlib
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import build_lyrics


def make_song(artist, title, line_texts, views=100, published=True):
    return {
        "artist": artist,
        "title": title,
        "views": views,
        "published": published,
        "lyricLines": [{"segs": [{"c": "", "t": t}]} for t in line_texts],
    }


class TestBuildLyrics(unittest.TestCase):
    def test_clean_lines(self):
        song = {
            "lyricLines": [
                {"segs": [{"c": "", "t": "Бадаг:"}]},
                {"segs": [{"c": "", "t": "Бадаг 2"}]},
                {"segs": [{"c": "G#m", "t": "  "}, {"c": "E", "t": "  "}, {"c": "F#", "t": "  "}]},
                {"segs": [{"c": "", "t": ""}]},
                {"segs": [{"c": "", "t": "Am Bm Em Cmaj7/ G"}]},
                {"segs": [{"c": "", "t": "Эхлэл: Dm Am C Dm"}]},
                {"segs": [{"c": "G#m", "t": "Чамд итгэж "}, {"c": "E", "t": "хэлэх дээ"}, {"c": "F#", "t": "ж нь юм"}]},
                {"segs": [{"c": "", "t": "Дахилт :"}]},
                {"segs": [{"c": "", "t": "Дахилт: Энэ миний бодол"}]},
                {"segs": [{"c": "", "t": "(Hey oh x2) Маргааш хамт явъя"}]},
                {"segs": [{"c": "C", "t": "Давтагддаг мөр энд байна"}]},
                {"segs": [{"c": "G", "t": "Өөр нэг мөр байна"}]},
                {"segs": [{"c": "C", "t": "Давтагддаг мөр энд байна"}]},
            ]
        }
        cleaned = build_lyrics.clean_lines(song)
        self.assertEqual(
            cleaned,
            [
                "Чамд итгэж хэлэх дээж нь юм",
                "Энэ миний бодол",
                "Hey oh Маргааш хамт явъя",
                "Давтагддаг мөр энд байна",
                "Өөр нэг мөр байна",
            ],
        )

    def test_primary_artist(self):
        self.assertEqual(build_lyrics.primary_artist("Gangaa ft. Lkhagvasuren"), "Gangaa")
        self.assertEqual(build_lyrics.primary_artist("A feat. B"), "A")
        self.assertEqual(build_lyrics.primary_artist("A & B"), "A")
        self.assertEqual(build_lyrics.primary_artist("A x B"), "A")
        self.assertEqual(build_lyrics.primary_artist("Хурд"), "Хурд")
        self.assertEqual(build_lyrics.primary_artist("Монгол кино, жүжгийн дуу"), "Монгол кино, жүжгийн дуу")

    def test_excerpts(self):
        tags = [
            "эхний", "хоёр", "гурав", "дөрөв", "тав",
            "зургаа", "долоо", "найм", "ес", "арав",
            "арваннэг", "арванхоёр", "арвангурав", "арвандөрөв", "арвантав",
            "арванзургаа", "арвандолоо", "арваннайм", "арванес", "хорь",
        ]
        lines = [f"Нэг хоёр гурав дөрөв тав {t}" for t in tags]
        res = build_lyrics.excerpts(lines, k=5)
        self.assertEqual(len(res), 5)
        target_indices = []
        for prev, target in res:
            words = target.split()
            self.assertGreaterEqual(len(words), 4)
            self.assertLessEqual(len(words), 12)
            idx = lines.index(target)
            self.assertEqual(prev, lines[idx - 1])
            target_indices.append(idx)
        diffs = [target_indices[i + 1] - target_indices[i] for i in range(len(target_indices) - 1)]
        self.assertTrue(any(d > 1 for d in diffs))

        dirty_lines = [
            "Өмнөх цэвэр мөр энд байна",
            "зорилтот жижиг үсэгтэй мөр байна",
            "Бас (хаалттай) өмнөх мөр",
            "Хоёр дахь цэвэр зорилтот мөр",
            "Тоотой 2 өмнөх мөр",
            "Гурав дахь цэвэр зорилтот мөр",
            "Цэвэр өмнөх мөр",
            "Дөрөв дэх цэвэр зорилтот мөр",
        ]
        self.assertEqual(
            build_lyrics.excerpts(dirty_lines, k=5),
            [("Цэвэр өмнөх мөр", "Дөрөв дэх цэвэр зорилтот мөр")],
        )

    def test_blocked(self):
        self.assertTrue(build_lyrics.blocked("fuck this"))
        self.assertTrue(build_lyrics.blocked("Shit happens"))
        self.assertTrue(build_lyrics.blocked("бля гэж"))
        self.assertTrue(build_lyrics.blocked("smoke weed"))
        self.assertTrue(build_lyrics.blocked("big dick"))
        self.assertFalse(build_lyrics.blocked("новш минь"))
        self.assertFalse(build_lyrics.blocked("Хайртай шүү"))
        self.assertTrue(build_lyrics.blocked("shake your ass"))
        self.assertTrue(build_lyrics.blocked("Hoes and tits"))
        self.assertTrue(build_lyrics.blocked("my nigga"))
        self.assertFalse(build_lyrics.blocked("assume the position"))
        self.assertFalse(build_lyrics.blocked("a classic hoedown"))
        self.assertFalse(build_lyrics.blocked("seaweed soup"))
        self.assertFalse(build_lyrics.blocked("хуй салхи"))
        self.assertFalse(build_lyrics.blocked("уурганы хуйв"))

    def test_build_groups(self):
        labels = ["нэг", "хоёр", "гурав", "дөрөв", "тав"]
        songs = []
        for lbl in labels[:4]:
            songs.append(
                make_song(
                    "ДөрөвХөн",
                    f"Дуу {lbl}",
                    [
                        f"Өмнөх эхний мөр {lbl}",
                        f"Зорилтот эхний {lbl} дөрвөн үгтэй",
                        f"Өмнөх хоёр дахь {lbl}",
                        f"Зорилтот хоёр {lbl} дөрвөн үгтэй",
                        f"Өмнөх гурав дахь {lbl}",
                        f"Зорилтот гурав {lbl} дөрвөн үгтэй",
                    ],
                    views=500,
                )
            )
        for lbl in labels:
            songs.append(
                make_song(
                    "ТаванДуу",
                    f"Дуу {lbl}",
                    [
                        f"Өмнөх А мөр {lbl}",
                        f"Зорилтот А {lbl} дөрвөн үгтэй",
                        f"Өмнөх Б мөр {lbl}",
                        f"Зорилтот Б {lbl} дөрвөн үгтэй",
                    ],
                    views=100,
                )
            )
        for lbl in labels:
            songs.append(
                make_song(
                    "Хүүхдийн Дуу",
                    f"Хүүхэд {lbl}",
                    [
                        f"Хүүхдийн эхний өмнөх {lbl}",
                        f"Хүүхдийн эхний {lbl} зорилтот мөр",
                        f"Хүүхдийн хоёр өмнөх {lbl}",
                        f"Хүүхдийн хоёр {lbl} зорилтот мөр",
                    ],
                    views=200,
                )
            )
        for idx, lbl in enumerate(labels):
            lines = [
                f"Эхний өмнөх {lbl}",
                f"Есөн эхний {lbl} зорилтот мөр",
            ]
            if idx < 4:
                lines.extend([
                    f"Хоёр өмнөх {lbl}",
                    f"Есөн хоёр {lbl} зорилтот мөр",
                ])
            songs.append(make_song("ЕсөнЭшлэл", f"Дуу {lbl}", lines, views=300))
        for lbl in labels[:2]:
            songs.append(
                make_song(
                    "ХоёрХөн",
                    f"Дуу {lbl}",
                    [
                        f"Өмнөх эхний мөр {lbl}",
                        f"Зорилтот эхний {lbl} дөрвөн үгтэй",
                        f"Өмнөх хоёр дахь {lbl}",
                        f"Зорилтот хоёр {lbl} дөрвөн үгтэй",
                        f"Өмнөх гурав дахь {lbl}",
                        f"Зорилтот гурав {lbl} дөрвөн үгтэй",
                    ],
                    views=9000,
                )
            )
        songs.append(
            make_song(
                "ТаванДуу",
                "Нийтлээгүй",
                ["Өмнөх нууц мөр", "Нийтлээгүй зорилтот мөр энд байна"],
                views=99999,
                published=False,
            )
        )
        songs.append(
            make_song(
                "ТаванДуу",
                "Давхардсан ба блок",
                [
                    "Өөр эхний мөр энд",
                    "Зорилтот А нэг дөрвөн үгтэй",
                    "Энэ fuck мөр",
                    "Дараагийн цэвэр мөр энд байна",
                ],
                views=50,
            )
        )

        dropped = []
        data = build_lyrics.build(songs, "abc123", dropped=dropped)
        self.assertEqual(data["v"], "abc123")
        self.assertEqual(len(dropped), 1)
        names = [g["name"] for g in data["groups"]]
        self.assertNotIn("ХоёрХөн", names)
        self.assertNotIn("ЕсөнЭшлэл", names)
        self.assertEqual(names, ["ДөрөвХөн", "Хүүхдийн Дуу", "ТаванДуу"])

        pack_group = data["groups"][1]
        self.assertTrue(pack_group["pack"])
        self.assertEqual(pack_group["views"], 1000)
        self.assertEqual(pack_group["id"], hashlib.sha1("Хүүхдийн Дуу".encode("utf-8")).hexdigest()[:8])

        artist_group = data["groups"][2]
        self.assertFalse(artist_group["pack"])
        self.assertEqual(artist_group["id"], hashlib.sha1("ТаванДуу".encode("utf-8")).hexdigest()[:8])
        first_excerpt = artist_group["songs"][0]["x"][0]
        expected_eid = hashlib.sha1(("ТаванДуу|" + first_excerpt[2]).encode("utf-8")).hexdigest()[:10]
        self.assertEqual(first_excerpt[0], expected_eid)
        self.assertNotIn("Нийтлээгүй", [s["t"] for s in artist_group["songs"]])

        all_targets = [x[2] for s in artist_group["songs"] for x in s["x"]]
        self.assertEqual(len(all_targets), len(set(all_targets)))

        js_text = "window.LYRICS=" + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";"
        self.assertTrue(js_text.startswith("window.LYRICS="))
        self.assertTrue(js_text.endswith(";"))
        parsed = json.loads(js_text[len("window.LYRICS="):-1])
        self.assertEqual(parsed, data)


if __name__ == "__main__":
    unittest.main()
