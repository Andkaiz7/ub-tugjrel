import hashlib
import json
import os
import re
import urllib.request

MANIFEST_URL = "https://cdn.daavkatunes.com/content/web/manifest.json"
USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

PACKS = {
    "Монгол кино, жүжгийн дуу",
    "Сурагч, оюутан насны дурсамж",
    "The Voice Of Mongolia",
    "Монголын Cover дуунууд",
    "Хүүхдийн Дуу",
    "Орцны Дуунууд",
}

EN_PREFIXES = (
    "fuck",
    "shit",
    "bitch",
    "nigg",
    "pussy",
    "motherf",
    "whore",
    "slut",
    "cocaine",
    "xanax",
)
EN_EXACT = {"dick", "weed"}
MN_PREFIXES = ("пизд", "бля", "сука", "ёба", "гичий", "янхан")

ARTIST_SPLIT_RE = re.compile(
    r"\s+(?:ft\.?|feat\.?|[x×])\s+|\s*&\s*",
    flags=re.IGNORECASE,
)
TOKEN_RE = re.compile(r"[^\W_]+")
SECTION_RE = re.compile(
    r"^(?:бадаг|дахилт|эхлэл|оршил|холбоо|холбоос|гүүр|гоцлол|соло|төгсгөл|төгөсгөл|завсар|интро|intro|outro|solo|bridge|brıdge|verse|chorus|pre-chorus|hook|interlude)\b\s*[:\-.;/]?\s*\d*\s*(?:удаа)?\s*[:\-.;/]?\s*",
    flags=re.IGNORECASE,
)
SLASH_REPEAT_RE = re.compile(
    r"/\s*(?:[xх×*]\s*\d+|\d+\s*[xх×*])\s*/?",
    flags=re.IGNORECASE,
)
BRACKET_REPEAT_RE = re.compile(
    r"\[\s*(?:[xх×*]\s*\d+|\d+\s*[xх×*]|\d+\s*(?:удаа|дахин))\s*(?:удаа|дахин)?\s*\]",
    flags=re.IGNORECASE,
)
PAREN_REPEAT_RE = re.compile(
    r"\(\s*([^()]*?)\s*(?:udaa\s*)?(?:[xх×*]\s*\d+|\d+\s*[xх×*]|\d+\s*(?:удаа|дахин))\s*(?:удаа|дахин)?\s*([^()]*?)\s*\)",
    flags=re.IGNORECASE,
)
BARE_REPEAT_RE = re.compile(
    r"(?:^|\s)(?:[xх×*]\s*\d+\s*(?:удаа|дахин)?|\d+\s*[xх×*]\s*(?:удаа|дахин)?|\d+\s*(?:удаа|дахин)|×)(?=\s|$|[,.;:!?/\)\]])",
    flags=re.IGNORECASE,
)
EMPTY_PARENS_RE = re.compile(r"\(\s*\)|\[\s*\]")
CYRILLIC_RE = re.compile(r"[А-Яа-яӨөҮүЁё]")
CHORD_PART_RE = re.compile(
    r"^[A-G][#b]?(?:m|maj|min|dim|aug|sus|add)?\d*(?:(?:sus|add)\d+)?(?:/[A-G][#b]?(?:m|maj|min|dim|aug|sus|add)?\d*)?$"
)
UNSAFE_LINE_RE = re.compile(r"[:\d/()×]")
LOWER_CYR_START_RE = re.compile(r"^[а-яөүё]")


def is_chord_or_sep(token: str) -> bool:
    core = token.strip(",|/\\")
    if not core:
        return True
    if all(ch in "-|•," for ch in core):
        return True
    if "-" in core:
        parts = [p for p in core.split("-") if p]
        return bool(parts) and all(CHORD_PART_RE.match(p) for p in parts)
    return bool(CHORD_PART_RE.match(core))


def clean_lines(song: dict) -> list[str]:
    result = []
    seen = set()
    for line in song.get("lyricLines") or []:
        raw = "".join(seg.get("t", "") for seg in (line.get("segs") or []))
        text = " ".join(raw.split())
        if not text:
            continue
        text = SECTION_RE.sub("", text).strip()
        text = SLASH_REPEAT_RE.sub(" ", text)
        text = BRACKET_REPEAT_RE.sub(" ", text)
        text = PAREN_REPEAT_RE.sub(r" \1 \2 ", text)
        text = BARE_REPEAT_RE.sub(" ", text)
        text = EMPTY_PARENS_RE.sub("", text)
        text = " ".join(text.split()).strip("\\ ")
        if not text or not CYRILLIC_RE.search(text):
            continue
        tokens = text.split()
        chord_flags = [is_chord_or_sep(t) for t in tokens]
        if sum(chord_flags) * 2 >= len(tokens):
            continue
        text = " ".join(t for t, is_c in zip(tokens, chord_flags) if not is_c).strip()
        if not text or not CYRILLIC_RE.search(text):
            continue
        if text not in seen:
            seen.add(text)
            result.append(text)
    return result


def primary_artist(name: str) -> str:
    stripped = (name or "").strip()
    if stripped in PACKS:
        return stripped
    return ARTIST_SPLIT_RE.split(stripped, maxsplit=1)[0].strip()


def safe_prev(line: str) -> bool:
    return not UNSAFE_LINE_RE.search(line)


def safe_target(line: str) -> bool:
    return not UNSAFE_LINE_RE.search(line) and not LOWER_CYR_START_RE.match(line)


def excerpts(lines: list[str], k: int = 5) -> list[tuple[str, str]]:
    if k <= 0 or len(lines) < 2:
        return []
    candidates = [
        i
        for i in range(1, len(lines))
        if 4 <= len(lines[i].split()) <= 12 and safe_target(lines[i]) and safe_prev(lines[i - 1])
    ]
    if not candidates:
        return []
    if len(candidates) <= k:
        chosen = candidates
    elif k == 1:
        chosen = [candidates[0]]
    else:
        chosen = [
            candidates[round(j * (len(candidates) - 1) / (k - 1))]
            for j in range(k)
        ]
    return [(lines[i - 1], lines[i]) for i in chosen]


def blocked(line: str) -> bool:
    for token in TOKEN_RE.findall((line or "").lower()):
        if token in EN_EXACT or token.startswith(EN_PREFIXES) or token.startswith(MN_PREFIXES):
            return True
    return False


def build(songs: list[dict], version: str, dropped: list[str] | None = None) -> dict:
    raw_groups = {}
    for song in songs:
        if song.get("published") is False:
            continue
        name = primary_artist(song.get("artist", ""))
        if not name:
            continue
        lines = clean_lines(song)
        pairs = excerpts(lines, k=5)
        if not pairs:
            continue
        group = raw_groups.get(name)
        if group is None:
            group = {"views": 0, "songs": [], "seen_ids": set()}
            raw_groups[name] = group
        song_excerpts = []
        for prev, target in pairs:
            if blocked(prev) or blocked(target):
                if dropped is not None:
                    dropped.append(f"DROPPED: {prev} | {target}")
                continue
            eid = hashlib.sha1(f"{name}|{target}".encode("utf-8")).hexdigest()[:10]
            if eid in group["seen_ids"]:
                continue
            group["seen_ids"].add(eid)
            song_excerpts.append([eid, prev, target])
        if song_excerpts:
            group["views"] += int(song.get("views") or 0)
            group["songs"].append({"t": song.get("title", ""), "x": song_excerpts})

    groups = []
    for name, group in raw_groups.items():
        excerpt_total = sum(len(s["x"]) for s in group["songs"])
        if len(group["songs"]) < 5 or excerpt_total < 10:
            continue
        gid = hashlib.sha1(name.encode("utf-8")).hexdigest()[:8]
        groups.append(
            {
                "id": gid,
                "name": name,
                "pack": name in PACKS,
                "views": group["views"],
                "songs": group["songs"],
            }
        )

    groups.sort(key=lambda g: (-g["views"], g["name"]))
    return {"v": version, "groups": groups}


def fetch_json(url: str) -> object:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main():
    tools_dir = os.path.dirname(os.path.abspath(__file__))
    repo_root = os.path.dirname(tools_dir)
    cache_dir = os.path.join(tools_dir, "lyrics-cache")
    os.makedirs(cache_dir, exist_ok=True)

    manifest = fetch_json(MANIFEST_URL)
    songs_info = manifest["songs"]
    version = songs_info["version"]
    songs_url = songs_info["url"]

    cache_path = os.path.join(cache_dir, f"songs.{version}.json")
    if os.path.exists(cache_path):
        with open(cache_path, "r", encoding="utf-8") as f:
            songs = json.load(f)
    else:
        songs = fetch_json(songs_url)
        with open(cache_path, "w", encoding="utf-8") as f:
            json.dump(songs, f, ensure_ascii=False)

    dropped = []
    data = build(songs, version, dropped=dropped)
    for line in dropped:
        print(line)
    out_dir = os.path.join(repo_root, "ugee-buu-mart")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "lyrics-data.js")
    payload = "window.LYRICS=" + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";"
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(payload)

    group_count = len(data["groups"])
    song_count = sum(len(g["songs"]) for g in data["groups"])
    excerpt_count = sum(len(s["x"]) for g in data["groups"] for s in g["songs"])
    file_kb = os.path.getsize(out_path) / 1024.0
    print(f"groups={group_count} songs={song_count} excerpts={excerpt_count} file_kb={file_kb:.2f}")


if __name__ == "__main__":
    main()
