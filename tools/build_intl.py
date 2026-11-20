import hashlib
import json
import os
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request

import build_lyrics

USER_AGENT = "UBMLyricsBuilder/1.0"
SLEEP = 0.2
MAX_SONGS = 15
MIN_SONGS = 5
MIN_EXCERPTS = 10

ARTISTS = [
    "The Weeknd",
    "Billie Eilish",
    "Taylor Swift",
    "Olivia Rodrigo",
    "Sabrina Carpenter",
    "Ariana Grande",
    "Dua Lipa",
    "Doja Cat",
    "SZA",
    "Harry Styles",
    "Ed Sheeran",
    "Bruno Mars",
    "Lady Gaga",
    "Justin Bieber",
    "Post Malone",
    "Imagine Dragons",
    "Coldplay",
    "Lana Del Rey",
    "Chappell Roan",
    "Tate McRae",
    "Benson Boone",
    "Conan Gray",
    "Shawn Mendes",
    "Charlie Puth",
    "Selena Gomez",
    "Miley Cyrus",
    "Rihanna",
    "Arctic Monkeys",
    "Gracie Abrams",
    "Teddy Swims",
    "Hozier",
    "Lewis Capaldi",
    "One Direction",
    "Katy Perry",
    "Adele",
    "Sia",
    "ROSÉ",
    "BTS",
    "Jungkook",
    "BLACKPINK",
]

QUOTES = str.maketrans({"’": "'", "‘": "'", "´": "'", "“": '"', "”": '"'})
BRACKET_LINE_RE = re.compile(r"^\s*\[[^\]]*\]\s*$")
PAREN_RE = re.compile(r"\([^()]*\)")
FILLER_TOKEN_RE = re.compile(r"^[-–—_.…~*]+$")
BAD_LINE_RE = re.compile(r"[\d:/()\[\]×]")
ALLOWED_NON_ASCII = set("…–—")
SEGMENT_RE = re.compile(r"\([^()]*\)|\[[^\[\]]*\]|\s-\s.*$")
VARIANT_RE = re.compile(
    r"\b(?:remix|live|acoustic|sped up|speed up|slowed|instrumental|karaoke|reverb|demo|edit|mix|stripped|session|unplugged|orchestral|piano|a cappella|commentary|spanish|korean|japanese|chinese|latin|español|clean|explicit)\b",
    flags=re.IGNORECASE,
)
ANYWHERE_RE = re.compile(r"\b(?:remix|sped up|speed up|slowed|instrumental|karaoke)\b", flags=re.IGNORECASE)
TRAILING_BRACKET_RE = re.compile(r"\s*\[[^\[\]]*\]\s*$")
FEAT_RE = re.compile(r"\s*[\(\[]\s*(?:feat|ft|with)\b[^\)\]]*[\)\]]", flags=re.IGNORECASE)
CREDIT_SPLIT_RE = re.compile(r"\s*(?:&|,|\sx\s|\sfeat\.?\s|\sft\.?\s)\s*", flags=re.IGNORECASE)
FALLBACK_BELOW = 30
ENGLISH_WORDS = {
    "the", "you", "and", "i", "i'm", "to", "my", "it", "that", "your", "we", "is",
    "this", "for", "with", "don't", "just", "like", "in", "on", "of", "be", "all",
}


def strip_accents(text: str) -> str:
    nfkd = unicodedata.normalize("NFKD", text)
    return "".join(ch for ch in nfkd if not unicodedata.combining(ch))


def loose(text: str) -> str:
    return re.sub(r"[^a-z0-9]", "", strip_accents(text).lower())


def is_latin_text(text: str) -> bool:
    for ch in text:
        if ord(ch) < 128 or ch in ALLOWED_NON_ASCII:
            continue
        if ch.isalpha() and unicodedata.name(ch, "").startswith("LATIN"):
            continue
        return False
    return True


def clean_lyrics(plain: str) -> list[str]:
    result = []
    seen = set()
    for raw in (plain or "").split("\n"):
        text = raw.translate(QUOTES)
        if BRACKET_LINE_RE.match(text):
            continue
        while True:
            stripped = PAREN_RE.sub(" ", text)
            if stripped == text:
                break
            text = stripped
        tokens = [t for t in text.split() if not FILLER_TOKEN_RE.match(t)]
        text = " ".join(tokens)
        if not text or not is_latin_text(text):
            continue
        if text not in seen:
            seen.add(text)
            result.append(text)
    return result


def target_ok(line: str) -> bool:
    if BAD_LINE_RE.search(line):
        return False
    words = {re.sub(r"[^\w']", "", w.lower()) for w in line.split()}
    words.discard("")
    return len(words) >= 3


def prev_ok(line: str) -> bool:
    return not BAD_LINE_RE.search(line) and len(line.split()) <= 14


def looks_english(lines: list[str]) -> bool:
    if not lines:
        return False
    hits = sum(1 for line in lines if ENGLISH_WORDS & set(re.findall(r"[a-z']+", line.lower())))
    return hits * 10 >= len(lines) * 4


def song_excerpts(name: str, plain: str, seen_ids: set, dropped: list | None = None) -> list[list[str]]:
    lines = clean_lyrics(plain)
    if not looks_english(lines):
        return []
    out = []
    for prev, target in build_lyrics.excerpts(lines, k=5, max_words=10, target_ok=target_ok, prev_ok=prev_ok):
        if build_lyrics.blocked(prev) or build_lyrics.blocked(target):
            if dropped is not None:
                dropped.append(name)
            continue
        eid = hashlib.sha1(f"{name}|{target}".encode("utf-8")).hexdigest()[:10]
        if eid in seen_ids:
            continue
        seen_ids.add(eid)
        out.append([eid, prev, target])
    return out


def base_title(title: str) -> str:
    return " ".join(TRAILING_BRACKET_RE.sub("", FEAT_RE.sub("", title or "")).split())


def is_variant(track: dict) -> bool:
    title = track.get("title") or ""
    if ANYWHERE_RE.search(title):
        return True
    segments = SEGMENT_RE.findall(title) + [track.get("title_version") or ""]
    return any(VARIANT_RE.search(seg) for seg in segments)


def usable_tracks(tracks: list[dict]) -> list[dict]:
    out = []
    seen = set()
    for tr in tracks:
        if not isinstance(tr, dict) or not tr.get("title") or is_variant(tr):
            continue
        shown = base_title(tr.get("title_short") or tr["title"])
        k = loose(SEGMENT_RE.sub("", shown))
        if not k or k in seen:
            continue
        seen.add(k)
        out.append({"title": shown, "duration": int(tr.get("duration") or 0)})
    return out


def pick_artist(results: list[dict], name: str) -> dict | None:
    cands = [r for r in results if isinstance(r, dict) and r.get("id") and r.get("name")]
    for same in (
        lambda a, b: a.casefold() == b.casefold(),
        lambda a, b: loose(a) == loose(b),
    ):
        hits = [r for r in cands if same(r["name"], name)]
        if hits:
            return max(hits, key=lambda r: int(r.get("nb_fan") or 0))
    return None


def itunes_tracks(results: list[dict], name: str) -> list[dict]:
    ak = loose(name)
    out = []
    for r in results:
        if not isinstance(r, dict) or not r.get("trackName"):
            continue
        parts = CREDIT_SPLIT_RE.split(r.get("artistName") or "")
        if ak in {loose(p) for p in parts}:
            out.append({"title": r["trackName"], "duration": round(int(r.get("trackTimeMillis") or 0) / 1000)})
    return out


def pick_lyrics(items: list[dict], artist: str, title: str) -> str | None:
    ak = loose(artist)
    tk = loose(title)
    for item in items:
        if not isinstance(item, dict) or item.get("instrumental") or not item.get("plainLyrics"):
            continue
        if ak not in loose(item.get("artistName") or ""):
            continue
        rk = loose(item.get("trackName") or "")
        if rk and tk and (rk == tk or tk in rk or rk in tk):
            return item["plainLyrics"]
    return None


def make_group(name: str, fans: int, songs: list[dict]) -> dict | None:
    if len(songs) < MIN_SONGS or sum(len(s["x"]) for s in songs) < MIN_EXCERPTS:
        return None
    return {
        "id": hashlib.sha1(name.encode("utf-8")).hexdigest()[:8],
        "name": name,
        "pack": False,
        "intl": True,
        "views": fans // 10000,
        "songs": songs,
    }


class Fetcher:
    def __init__(self, cache_dir: str):
        self.cache_dir = cache_dir
        self.failed = 0
        os.makedirs(cache_dir, exist_ok=True)

    def text(self, url: str) -> str | None:
        path = os.path.join(self.cache_dir, hashlib.sha1(url.encode("utf-8")).hexdigest() + ".json")
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                return f.read()
        for attempt in range(6):
            wait = min(2 ** (attempt + 1), 60)
            try:
                req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
                with urllib.request.urlopen(req, timeout=30) as resp:
                    body = resp.read().decode("utf-8", "replace")
                time.sleep(SLEEP)
                if "api.deezer.com" in url and body.startswith('{"error"'):
                    time.sleep(wait)
                    continue
            except urllib.error.HTTPError as e:
                time.sleep(SLEEP)
                if e.code == 404:
                    body = ""
                elif e.code in (403, 429) or e.code >= 500:
                    retry_after = e.headers.get("Retry-After") if e.headers else None
                    time.sleep(int(retry_after) if retry_after and retry_after.isdigit() else wait)
                    continue
                else:
                    break
            except Exception:
                time.sleep(wait)
                continue
            tmp = path + ".tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                f.write(body)
            os.replace(tmp, path)
            return body
        self.failed += 1
        return None

    def json(self, url: str):
        raw = self.text(url)
        if not raw:
            return None
        try:
            return json.loads(raw)
        except ValueError:
            return None


def find_lyrics(fetcher: Fetcher, artist: str, title: str, duration: int) -> str | None:
    q = urllib.parse.urlencode({"artist_name": artist, "track_name": title, "duration": duration})
    data = fetcher.json(f"https://lrclib.net/api/get?{q}")
    if isinstance(data, dict) and not data.get("instrumental") and data.get("plainLyrics"):
        return data["plainLyrics"]
    q = urllib.parse.urlencode({"artist_name": artist, "track_name": title})
    data = fetcher.json(f"https://lrclib.net/api/search?{q}")
    return pick_lyrics(data if isinstance(data, list) else [], artist, title)


def build_artist(fetcher: Fetcher, query: str) -> dict | None:
    q = urllib.parse.urlencode({"q": query})
    found = fetcher.json(f"https://api.deezer.com/search/artist?{q}")
    artist = pick_artist((found or {}).get("data") or [], query)
    if artist is None:
        print(f"{query}: no exact Deezer match")
        return None
    name = artist["name"]
    top = fetcher.json(f"https://api.deezer.com/artist/{artist['id']}/top?limit=50")
    tracks = (top or {}).get("data") or []
    if len(usable_tracks(tracks)) < FALLBACK_BELOW:
        q = urllib.parse.urlencode(
            {"term": name, "entity": "song", "attribute": "artistTerm", "limit": 200, "country": "us"}
        )
        found = fetcher.json(f"https://itunes.apple.com/search?{q}")
        tracks = tracks + itunes_tracks((found or {}).get("results") or [], name)
    songs = []
    seen_ids = set()
    for tr in usable_tracks(tracks):
        if len(songs) >= MAX_SONGS:
            break
        plain = find_lyrics(fetcher, name, tr["title"], tr["duration"])
        if not plain:
            continue
        xs = song_excerpts(name, plain, seen_ids)
        if xs:
            songs.append({"t": tr["title"], "x": xs})
    group = make_group(name, int(artist.get("nb_fan") or 0), songs)
    excerpt_total = sum(len(s["x"]) for s in songs)
    print(f"{name}: songs={len(songs)} excerpts={excerpt_total} kept={group is not None}")
    return group


def main():
    tools_dir = os.path.dirname(os.path.abspath(__file__))
    fetcher = Fetcher(os.path.join(tools_dir, "lyrics-cache", "intl"))
    groups = []
    ids = set()
    for query in ARTISTS:
        group = build_artist(fetcher, query)
        if group and group["id"] not in ids:
            ids.add(group["id"])
            groups.append(group)
    groups.sort(key=lambda g: (-g["views"], g["name"]))
    out_path = os.path.join(tools_dir, "intl-groups.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(groups, f, ensure_ascii=False, separators=(",", ":"))
    excerpt_count = sum(len(s["x"]) for g in groups for s in g["songs"])
    print(f"groups={len(groups)} songs={sum(len(g['songs']) for g in groups)} excerpts={excerpt_count} failed={fetcher.failed}")
    if fetcher.failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
