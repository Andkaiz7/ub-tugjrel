import hashlib
import json
import os
import random
import re
import sys
import tempfile
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request

CYR_MAP = str.maketrans(
    {
        "а": "a",
        "б": "b",
        "в": "v",
        "г": "g",
        "д": "d",
        "е": "e",
        "ё": "yo",
        "ж": "j",
        "з": "z",
        "и": "i",
        "й": "i",
        "к": "k",
        "л": "l",
        "м": "m",
        "н": "n",
        "о": "o",
        "ө": "o",
        "п": "p",
        "р": "r",
        "с": "s",
        "т": "t",
        "у": "u",
        "ү": "u",
        "ф": "f",
        "х": "h",
        "ц": "ts",
        "ч": "ch",
        "ш": "sh",
        "щ": "sh",
        "ъ": "",
        "ы": "y",
        "ь": "i",
        "э": "e",
        "ю": "yu",
        "я": "ya",
    }
)

UA_API = "UBMMediaBuilder/1.0"
UA_BROWSER = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

OG_IMAGE_RE_1 = re.compile(
    r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']',
    re.IGNORECASE,
)
OG_IMAGE_RE_2 = re.compile(
    r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']',
    re.IGNORECASE,
)

SKIP_IMG = {"4ed5a354", "6acbcadc"}


def lat(s: str) -> str:
    return unicodedata.normalize("NFC", s).lower().translate(CYR_MAP)


def key(s: str) -> str:
    text = lat(s)
    nfkd = unicodedata.normalize("NFKD", text)
    stripped = "".join(ch for ch in nfkd if not unicodedata.combining(ch))
    alnum = re.sub(r"[^a-z0-9]", "", stripped)
    alnum = alnum.replace("kh", "h")
    return re.sub(r"([aeiouy])\1+", r"\1", alnum)


def _norm_title(s: str) -> str:
    t = s.strip()
    while True:
        nt = re.sub(r"\s*(?:\([^()]*\)|\[[^\[\]]*\])\s*$", "", t)
        nt = re.sub(r"\s+(?:feat\.?|ft\.?|featuring)\b.*$", "", nt, flags=re.IGNORECASE)
        nt = re.sub(r"\s+-\s+.*$", "", nt)
        if nt == t:
            return t
        t = nt


def title_key(s: str) -> str:
    return key(_norm_title(s))


def _stripped_forms(name: str) -> list[str]:
    base = name.strip()
    forms = [base]
    no_lead = re.sub(r"^\s*[^\W\d_]\.\s*", "", base)
    if no_lead and no_lead != base:
        forms.append(no_lead)
    no_trail = re.sub(r"\s*\.\s*[^\W\d_]\s*$", "", base)
    if no_trail and no_trail != base:
        forms.append(no_trail)
    no_paren = re.sub(r"\s*\([^)]*\)\s*", " ", base).strip()
    if no_paren and no_paren != base:
        forms.append(no_paren)
    return forms


def variants(name: str) -> set[str]:
    out = set()
    for form in _stripped_forms(name):
        k = key(form)
        if k:
            out.add(k)
    return out


def title_match(ours: str, theirs: str) -> bool:
    a = title_key(ours)
    b = title_key(theirs)
    return bool(a and a == b)


def _match_score(titles: list[str], track_names: list[str]) -> int:
    track_keys = {title_key(tr) for tr in track_names if tr}
    track_keys.discard("")
    matched = {title_key(t) for t in titles if title_key(t) in track_keys}
    if len(matched) >= 2:
        return len(matched)
    if len(matched) == 1 and len(next(iter(matched))) >= 8:
        return 1
    return 0


def pick_artist(results: list[dict], name: str, titles: list[str]) -> int | None:
    allowed = variants(name)
    by_artist: dict[int, list[str]] = {}
    for item in results:
        if not isinstance(item, dict):
            continue
        artist_id = item.get("artistId")
        artist_name = item.get("artistName")
        track_name = item.get("trackName")
        if artist_id is None or not artist_name or not track_name:
            continue
        if key(artist_name) not in allowed:
            continue
        by_artist.setdefault(int(artist_id), []).append(track_name)
    best_id = None
    best_score = 0
    for artist_id, tracks in by_artist.items():
        score = _match_score(titles, tracks)
        if score > best_score:
            best_score = score
            best_id = artist_id
    return best_id if best_score > 0 else None


def photo_url(url: str) -> str | None:
    if not url or not isinstance(url, str):
        return None
    if "mzstatic.com" in url:
        return re.sub(r"/\d+x\d+[^/]*$", "/200x200cc.jpg", url)
    if "dzcdn.net" in url:
        if "/images/artist//" in url:
            return None
        return url
    return None


def _is_apple_artist_image(url: str) -> bool:
    if not url or "mzstatic.com" not in url:
        return False
    path = urllib.parse.urlparse(url).path
    return any(tok in path for tok in ("AMCArtistImages", "pr_source", "Features"))


def _dedupe_terms(candidates: list[str]) -> list[str]:
    seen = set()
    unique = []
    for c in candidates:
        norm = c.strip()
        low = norm.lower()
        if norm and low not in seen:
            seen.add(low)
            unique.append(norm)
    return unique


def _itunes_search_terms(name: str) -> list[str]:
    candidates = []
    for form in _stripped_forms(name):
        candidates.append(form)
        candidates.append(lat(form))
        if "х" in form.lower():
            candidates.append(lat(form.replace("х", "kh").replace("Х", "kh")))
    return _dedupe_terms(candidates)


def _deezer_search_terms(name: str) -> list[str]:
    candidates = []
    for form in _stripped_forms(name):
        candidates.append(lat(form))
        if "х" in form.lower():
            candidates.append(lat(form.replace("х", "kh").replace("Х", "kh")))
    return _dedupe_terms(candidates)


def _extract_og_image(html: str) -> str | None:
    if not html:
        return None
    m = OG_IMAGE_RE_1.search(html) or OG_IMAGE_RE_2.search(html)
    return m.group(1) if m else None


def _pick_artist_by_music_artist(
    name: str, titles: list[str], get_json
) -> tuple[int | None, list[dict]]:
    allowed = variants(name)
    candidate_ids: list[int] = []
    seen_ids: set[int] = set()
    for term in _itunes_search_terms(name):
        q = urllib.parse.urlencode(
            {
                "term": term,
                "entity": "musicArtist",
                "limit": 10,
                "country": "us",
            }
        )
        data = get_json(f"https://itunes.apple.com/search?{q}")
        results = (data.get("results") or []) if isinstance(data, dict) else []
        for item in results:
            if not isinstance(item, dict):
                continue
            cid = item.get("artistId")
            cname = item.get("artistName")
            if cid is None or not cname or key(cname) not in allowed:
                continue
            cid_int = int(cid)
            if cid_int not in seen_ids:
                seen_ids.add(cid_int)
                candidate_ids.append(cid_int)

    best_id = None
    best_score = 0
    best_tracks: list[dict] = []
    for cid in candidate_ids:
        lookup_url = (
            f"https://itunes.apple.com/lookup?id={cid}&entity=song&limit=200&country=us"
        )
        lookup_data = get_json(lookup_url)
        results = (
            (lookup_data.get("results") or [])
            if isinstance(lookup_data, dict)
            else []
        )
        track_names = [
            r["trackName"]
            for r in results
            if isinstance(r, dict) and r.get("trackName")
        ]
        score = _match_score(titles, track_names)
        if score > best_score:
            best_score = score
            best_id = cid
            best_tracks = results
    return (best_id, best_tracks) if best_score > 0 else (None, [])


def _find_deezer_photo(name: str, titles: list[str], get_json) -> str | None:
    allowed = variants(name)
    for term in _deezer_search_terms(name):
        dz_q = urllib.parse.urlencode({"q": term, "limit": 5})
        dz_data = get_json(f"https://api.deezer.com/search/artist?{dz_q}")
        candidates = (
            (dz_data.get("data") or [])
            if isinstance(dz_data, dict)
            else []
        )
        for cand in candidates:
            if not isinstance(cand, dict):
                continue
            cname = cand.get("name") or ""
            cid = cand.get("id")
            if cid is None or key(cname) not in allowed:
                continue
            top_data = get_json(f"https://api.deezer.com/artist/{cid}/top?limit=50")
            top_tracks = (
                (top_data.get("data") or [])
                if isinstance(top_data, dict)
                else []
            )
            track_names = [
                tr["title"]
                for tr in top_tracks
                if isinstance(tr, dict) and tr.get("title")
            ]
            if _match_score(titles, track_names) > 0:
                p_url = photo_url(cand.get("picture_medium") or "")
                if p_url:
                    return p_url
    return None


def _select_previews(titles: list[str], tracks: list[dict]) -> dict[str, str]:
    pre_map: dict[str, str] = {}
    used_urls: set[str] = set()
    for title in titles:
        if title in pre_map:
            continue
        exact_k = key(title)
        chosen = None
        for tr in tracks:
            if not isinstance(tr, dict):
                continue
            tr_name = tr.get("trackName")
            tr_preview = tr.get("previewUrl")
            if not tr_name or not tr_preview or tr_preview in used_urls:
                continue
            if exact_k and key(tr_name) == exact_k:
                chosen = tr_preview
                break
        if chosen is None:
            for tr in tracks:
                if not isinstance(tr, dict):
                    continue
                tr_name = tr.get("trackName")
                tr_preview = tr.get("previewUrl")
                if not tr_name or not tr_preview or tr_preview in used_urls:
                    continue
                if title_match(title, tr_name):
                    chosen = tr_preview
                    break
        if chosen is not None:
            pre_map[title] = chosen
            used_urls.add(chosen)
    return pre_map


def build(groups: list[dict], get_json, get_text) -> dict:
    img: dict[str, str] = {}
    pre: dict[str, dict[str, str]] = {}

    for group in groups:
        if group.get("pack"):
            continue
        gid = group["id"]
        name = group["name"]
        titles = [s["t"] for s in group.get("songs", []) if s.get("t")]
        if not titles:
            continue

        all_results: list[dict] = []
        artist_id = None
        for term in _itunes_search_terms(name):
            q = urllib.parse.urlencode(
                {
                    "term": term,
                    "entity": "song",
                    "attribute": "artistTerm",
                    "limit": 200,
                    "country": "us",
                }
            )
            url = f"https://itunes.apple.com/search?{q}"
            data = get_json(url)
            if isinstance(data, dict):
                all_results.extend(data.get("results") or [])
            artist_id = pick_artist(all_results, name, titles)
            if artist_id is not None:
                break

        tracks: list[dict] = []
        if artist_id is not None:
            lookup_url = (
                f"https://itunes.apple.com/lookup?id={artist_id}&entity=song&limit=200&country=us"
            )
            lookup_data = get_json(lookup_url)
            tracks = (
                (lookup_data.get("results") or [])
                if isinstance(lookup_data, dict)
                else []
            )
            if not tracks:
                tracks = [
                    r
                    for r in all_results
                    if isinstance(r, dict) and r.get("artistId") == artist_id
                ]
        else:
            artist_id, tracks = _pick_artist_by_music_artist(name, titles, get_json)

        if artist_id is not None:
            pre_map = _select_previews(titles, tracks)
            if pre_map:
                pre[gid] = pre_map

        if gid in SKIP_IMG:
            continue

        apple_photo = None
        if artist_id is not None:
            apple_html = get_text(f"https://music.apple.com/us/artist/{artist_id}")
            og = _extract_og_image(apple_html)
            apple_photo = photo_url(og) if og else None

        if apple_photo and _is_apple_artist_image(apple_photo):
            img[gid] = apple_photo
        else:
            dz_photo = _find_deezer_photo(name, titles, get_json)
            if dz_photo:
                img[gid] = dz_photo
            elif apple_photo:
                img[gid] = apple_photo

    return {"img": img, "pre": pre}


def render(data: dict) -> str:
    return f"window.MEDIA={json.dumps(data, ensure_ascii=False, separators=(',', ':'))};"


def _write_cache(cache_path: str, text: str) -> None:
    cache_dir = os.path.dirname(cache_path)
    fd, tmp_path = tempfile.mkstemp(dir=cache_dir, prefix=".tmp_")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(text)
        os.replace(tmp_path, cache_path)
    except Exception:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise


def _make_fetchers(cache_dir: str, stats: dict | None = None):
    os.makedirs(cache_dir, exist_ok=True)
    last_apple = [None]
    if stats is None:
        stats = {"failed": 0}
    stats.setdefault("failed", 0)

    def get_text(url: str) -> str:
        digest = hashlib.sha1(url.encode("utf-8")).hexdigest()
        cache_path = os.path.join(cache_dir, digest)
        if os.path.exists(cache_path):
            with open(cache_path, "r", encoding="utf-8") as f:
                return f.read()

        is_apple = "itunes.apple.com" in url or "music.apple.com" in url
        is_apple_page = "music.apple.com" in url
        ua = UA_API

        for attempt in range(4):
            if is_apple and last_apple[0] is not None:
                wait = 3.2 - (time.monotonic() - last_apple[0])
                if wait > 0:
                    time.sleep(wait)
            req = urllib.request.Request(url, headers={"User-Agent": ua})
            if is_apple:
                last_apple[0] = time.monotonic()
            try:
                with urllib.request.urlopen(req, timeout=20) as resp:
                    text = resp.read().decode("utf-8", "replace")
                _write_cache(cache_path, text)
                return text
            except urllib.error.HTTPError as e:
                if e.code == 404:
                    _write_cache(cache_path, "")
                    return ""
                if e.code in (403, 429) and attempt < 3:
                    if is_apple_page and e.code == 403 and ua != UA_BROWSER:
                        ua = UA_BROWSER
                    else:
                        time.sleep(60)
                    continue
                stats["failed"] += 1
                return ""
            except Exception:
                stats["failed"] += 1
                return ""
        return ""

    def get_json(url: str) -> dict:
        raw = get_text(url)
        if not raw:
            return {}
        try:
            parsed = json.loads(raw)
            return parsed if isinstance(parsed, dict) else {}
        except Exception:
            return {}

    return get_json, get_text


def main():
    tools_dir = os.path.dirname(os.path.abspath(__file__))
    repo_root = os.path.dirname(tools_dir)
    lyrics_path = os.path.join(repo_root, "ugee-buu-mart", "lyrics-data.js")
    out_path = os.path.join(repo_root, "ugee-buu-mart", "media-data.js")
    cache_dir = os.path.join(tools_dir, "media-cache")

    with open(lyrics_path, "r", encoding="utf-8") as f:
        raw = f.read().strip()
    if raw.startswith("window.LYRICS="):
        raw = raw[len("window.LYRICS=") :]
    if raw.endswith(";"):
        raw = raw[:-1]
    groups = json.loads(raw).get("groups", [])

    stats = {"failed": 0}
    get_json, get_text = _make_fetchers(cache_dir, stats=stats)
    data = build(groups, get_json, get_text)
    failed = stats["failed"]
    print(f"Failed fetches: {failed}")
    if failed > 0:
        sys.exit(1)

    rendered = render(data)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(rendered)

    id_to_name = {g["id"]: g["name"] for g in groups if not g.get("pack")}
    singers_photo = len(data["img"])
    singers_pre = len(data["pre"])
    songs_pre = sum(len(v) for v in data["pre"].values())
    file_kb = os.path.getsize(out_path) / 1024.0

    print(f"Singers with photo: {singers_photo}")
    print(f"Singers with previews: {singers_pre}")
    print(f"Songs with previews: {songs_pre}")
    print(f"File KB: {file_kb:.2f}")

    pairs = [(id_to_name.get(gid, gid), url) for gid, url in data["img"].items()]
    sample = random.sample(pairs, min(15, len(pairs)))
    print("15 random (singer, photo url) pairs:")
    for singer, url in sample:
        print(f"  {singer}: {url}")

    no_pre = [g["name"] for g in groups if not g.get("pack") and g["id"] not in data["pre"]]
    print(f"Singers with NO previews ({len(no_pre)}): {no_pre}")


if __name__ == "__main__":
    main()
