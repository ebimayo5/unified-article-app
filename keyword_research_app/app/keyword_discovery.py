from __future__ import annotations

import json
import re
import time
from html.parser import HTMLParser
from threading import Event
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen

from app.models import KeywordInput


DEFAULT_EXPANDERS = [
    "",
    "とは",
    "おすすめ",
    "口コミ",
    "評判",
    "比較",
    "後悔",
    "壊れる",
    "デメリット",
    "メリット",
    "注意点",
    "選び方",
    "使い方",
    "値段",
    "費用",
    "安い",
    "中古",
]

RELATED_THEME_TERMS = {
    "ナビ": [
        "カーナビ",
        "ナビキャンセラー",
        "テレビキャンセラー",
        "後席モニター",
        "HDMI",
        "バックカメラ",
        "ディスプレイオーディオ",
        "CarPlay",
        "Android Auto",
        "ETC",
        "ドラレコ",
        "フリップダウンモニター",
        "走行中 テレビ",
        "純正ナビ",
        "社外ナビ",
    ],
    "車": [
        "中古車",
        "車検",
        "修理",
        "維持費",
        "燃費",
        "故障",
        "乗り心地",
        "後部座席",
        "荷室",
        "安全装備",
    ],
}

SEMANTIC_THEME_TERMS = {
    "暮らし": [
        "家事動線",
        "回遊動線",
        "収納",
        "玄関収納",
        "ランドリールーム",
        "ファミリークローゼット",
        "リビング収納",
        "片付け",
    ],
    "間取り": [
        "子育てしやすい 間取り",
        "家事動線 間取り",
        "回遊動線 間取り",
        "収納 間取り",
        "リビング学習 間取り",
        "子供部屋 間取り",
        "平屋 間取り",
        "注文住宅 間取り",
    ],
    "子育て": [
        "子育てしやすい 家",
        "子育てしやすい 間取り",
        "子育て 間取り",
        "子育て 収納",
        "子育て 家事動線",
        "子育て 玄関収納",
        "リビング学習",
        "子供部屋",
        "おもちゃ 収納",
        "ベビーカー 収納",
    ],
    "収納": [
        "玄関収納",
        "リビング収納",
        "おもちゃ 収納",
        "ファミリークローゼット",
        "パントリー",
    ],
    "注文住宅": [
        "注文住宅 間取り",
        "注文住宅 後悔",
        "注文住宅 収納",
        "家事動線 注文住宅",
    ],
}

SEMANTIC_THEME_PATTERNS = [
    (
        {"暮らし", "間取り", "子育て"},
        [
            "子育てしやすい 間取り",
            "子育て 間取り 後悔",
            "子育て 間取り 収納",
            "子育て 間取り リビング",
            "子育て 間取り 平屋",
            "子育て 間取り 失敗",
            "子供部屋 間取り",
            "リビング学習 間取り",
            "家事動線 子育て",
            "回遊動線 子育て",
            "玄関収納 子育て",
            "ファミリークローゼット 子育て",
            "ランドリールーム 子育て",
            "ベビーカー 収納 玄関",
            "おもちゃ 収納 リビング",
            "子育てしやすい 家",
            "子育てしやすい 家 収納",
            "子育てしやすい 注文住宅",
            "子育て世帯 間取り",
        ],
    ),
    (
        {"間取り", "子育て"},
        [
            "子育てしやすい 間取り",
            "子育て 間取り 後悔",
            "子育て 間取り 収納",
            "子供部屋 間取り",
            "リビング学習 間取り",
            "家事動線 子育て",
            "玄関収納 子育て",
        ],
    ),
]

NATURAL_THEME_PHRASES = {
    "ナビ": [
        "ナビ 取り付け",
        "ナビ 交換",
        "ナビ HDMI",
        "ナビ キャンセラー",
        "純正ナビ HDMI",
        "純正ナビ 走行中",
    ],
    "HDMI": [
        "HDMI 接続",
        "HDMI 入力",
        "HDMI 出力",
        "HDMI 映らない",
        "HDMI 分配器",
        "HDMI 変換",
    ],
    "後席モニター": [
        "後席モニター 取り付け",
        "後席モニター HDMI",
        "後席モニター 映らない",
        "後席モニター おすすめ",
        "後席モニター 純正",
        "後席モニター 社外",
    ],
    "キャンセラー": [
        "キャンセラー 取り付け",
        "キャンセラー 費用",
        "キャンセラー デメリット",
        "キャンセラー 車検",
        "キャンセラー 不具合",
        "テレビキャンセラー 取り付け",
        "ナビキャンセラー 取り付け",
    ],
    "純正ナビ": [
        "純正ナビ HDMI",
        "純正ナビ 走行中",
        "純正ナビ 後付け",
        "純正ナビ 交換",
        "純正ナビ 取り付け",
    ],
    "ナビキャンセラー": [
        "ナビキャンセラー 取り付け",
        "ナビキャンセラー 費用",
        "ナビキャンセラー デメリット",
        "ナビキャンセラー 走行中",
    ],
    "テレビキャンセラー": [
        "テレビキャンセラー 取り付け",
        "テレビキャンセラー 費用",
        "テレビキャンセラー デメリット",
        "テレビキャンセラー 走行中",
    ],
    "出張取付": [
        "出張取付 費用",
        "出張取付 口コミ",
        "出張取付 対応エリア",
    ],
}

CONTEXTUAL_THEME_PATTERNS = [
    (
        {"HDMI", "後席モニター"},
        [
            "後席モニター HDMI 接続",
            "後席モニター HDMI 映らない",
            "後席モニター HDMI 取り付け",
            "後席モニター HDMI 分配器",
            "後席モニター HDMI おすすめ",
        ],
    ),
    (
        {"ナビ", "HDMI"},
        [
            "ナビ HDMI 出力",
            "ナビ HDMI 入力",
            "ナビ HDMI 接続",
            "純正ナビ HDMI 出力",
            "純正ナビ HDMI 後付け",
        ],
    ),
    (
        {"ナビ", "キャンセラー"},
        [
            "ナビ キャンセラー 取り付け",
            "ナビ キャンセラー 費用",
            "ナビ キャンセラー デメリット",
            "テレビキャンセラー 走行中 テレビ",
            "ナビキャンセラー 走行中 テレビ",
        ],
    ),
    (
        {"後席モニター", "キャンセラー"},
        [
            "後席モニター キャンセラー 必要",
            "後席モニター キャンセラー 取り付け",
            "後席モニター 走行中 映らない",
        ],
    ),
]

COMMON_SUFFIXES = [
    "おすすめ",
    "後悔",
    "口コミ",
    "評判",
    "比較",
    "デメリット",
    "メリット",
    "注意点",
    "選び方",
    "取り付け",
    "費用",
    "値段",
    "安い",
    "中古",
    "壊れる",
    "使い方",
]

DISCOVERY_MODIFIERS = [
    "おすすめ",
    "後悔",
    "口コミ",
    "評判",
    "比較",
    "デメリット",
    "メリット",
    "注意点",
    "選び方",
    "失敗",
    "問題",
    "悩み",
    "対策",
    "解決",
    "必要",
    "不要",
    "いらない",
    "できない",
    "壊れる",
    "使い方",
    "費用",
    "値段",
    "相場",
    "安い",
    "高い",
    "中古",
    "取り付け",
    "DIY",
    "いつ",
    "いつから",
    "どこ",
    "どれ",
    "違い",
    "代用",
]

URL_KEY_PHRASES = [
    "テレビキャンセラー",
    "TVキャンセラー",
    "ナビキャンセラー",
    "後席モニター",
    "フリップダウンモニター",
    "バックカメラ",
    "ディスプレイオーディオ",
    "純正ナビ",
    "社外ナビ",
    "カーナビ",
    "走行中 テレビ",
    "走行中 TV",
    "出張取付",
    "HDMI",
    "CarPlay",
    "Android Auto",
    "ETC",
    "ドラレコ",
]

MAKER_WORDS = {
    "トヨタ",
    "レクサス",
    "ホンダ",
    "マツダ",
    "マッダ",
    "日産",
    "ニッサン",
    "スズキ",
    "スバル",
    "ダイハツ",
    "三菱",
    "BMW",
    "MINI",
    "ポルシェ",
    "VW",
    "フォルクスワーゲン",
    "ベンツ",
    "メルセデス",
    "アウディ",
}

BRAND_OR_NAV_WORDS = {
    "ナビ男くん",
    "直営",
    "ファクトリーショップ",
    "ショップ",
    "店舗",
    "会社",
    "公式",
}

ALLOWED_STANDALONE_ASCII_TERMS = {
    "HDMI",
    "ETC",
    "CarPlay",
}


def discover_keywords(
    seeds: list[KeywordInput],
    max_keywords: int = 100,
    per_query_delay: float = 0.25,
    stop_event: Event | None = None,
    log=None,
) -> list[KeywordInput]:
    stop_event = stop_event or Event()
    seen: set[str] = set()
    discovered: list[KeywordInput] = []

    def add(keyword: str, seed: KeywordInput, source: str) -> None:
        normalized = _normalize_keyword(keyword)
        if not _is_usable_keyword(normalized):
            return
        if not _is_collectable_keyword(normalized):
            return
        key = normalized.casefold()
        if key in seen:
            return
        seen.add(key)
        discovered.append(
            KeywordInput(
                keyword=normalized,
                genre=seed.genre,
                memo=f"suggest:{source}",
                priority=seed.priority,
            )
        )

    for seed in seeds:
        if stop_event.is_set() or len(discovered) >= max_keywords:
            break
        expanded_seeds = expand_seed_keyword(seed, log=log)
        for expanded_seed in expanded_seeds:
            if len(discovered) >= max_keywords:
                break
            add(expanded_seed.keyword, expanded_seed, "seed")
        for query in _build_queries_from_seeds(expanded_seeds):
            if stop_event.is_set() or len(discovered) >= max_keywords:
                break
            add(query, seed, "query")
            if len(discovered) >= max_keywords:
                break
            if log:
                log("Discovering suggestions: %s", query)
            try:
                suggestions = fetch_google_suggestions(query)
            except Exception as exc:
                if log:
                    log("Suggestion fetch failed: %s", exc)
                suggestions = []
            for suggestion in suggestions:
                add(suggestion, seed, "google")
                if len(discovered) >= max_keywords:
                    break
            time.sleep(per_query_delay)

    return discovered[:max_keywords]


def expand_seed_keyword(seed: KeywordInput, log=None) -> list[KeywordInput]:
    keyword = _normalize_keyword(seed.keyword)
    if _is_url(keyword):
        page_keywords = extract_keywords_from_url(keyword, log=log)
        return [
            KeywordInput(keyword=item, genre=seed.genre, memo=f"url:{keyword}", priority=seed.priority)
            for item in page_keywords
        ]

    theme_terms = _split_theme_terms(keyword)
    expanded = [keyword]
    if len(theme_terms) >= 2:
        expanded.extend(_expand_multi_term_theme(theme_terms))
    else:
        for term in RELATED_THEME_TERMS.get(keyword, []):
            expanded.append(term)
        for key, terms in RELATED_THEME_TERMS.items():
            if key in keyword and keyword != key:
                expanded.extend(terms)
    expanded.extend(_expand_semantic_theme(keyword))
    return [
        KeywordInput(keyword=item, genre=seed.genre, memo=seed.memo, priority=seed.priority)
        for item in _sort_query_themes(_dedupe(expanded))
        if _is_usable_keyword(item) and _looks_like_query_theme(item)
    ]


def extract_keywords_from_url(url: str, max_items: int = 20, log=None) -> list[str]:
    try:
        text = fetch_page_text(url)
    except Exception as exc:
        if log:
            log("URL keyword extraction failed: %s", exc)
        return []

    raw_tags: list[str] = []
    for line in text.splitlines():
        cleaned = _clean_page_text(line)
        if not cleaned:
            continue
        raw_tags.extend(_extract_url_keyword_candidates(cleaned))

    tags = [item for item in _dedupe(raw_tags) if _is_page_keyword(item)]
    candidates = _expand_url_tags_to_queries(tags)
    return [item for item in _dedupe(candidates) if _is_expandable_seed_keyword(item)][:max_items]


def fetch_page_text(url: str, timeout: int = 15) -> str:
    request = Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
            )
        },
    )
    with urlopen(request, timeout=timeout) as response:
        raw = response.read(800_000)
        content_type = response.headers.get("Content-Type", "")
    charset = _guess_charset(content_type, raw)
    html = raw.decode(charset, errors="replace")
    parser = _KeywordHTMLParser()
    parser.feed(html)
    return "\n".join(parser.texts)


def fetch_google_suggestions(query: str, timeout: int = 10) -> list[str]:
    params = urlencode({"client": "firefox", "hl": "ja", "q": query})
    url = f"https://suggestqueries.google.com/complete/search?{params}"
    request = Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
            )
        },
    )
    with urlopen(request, timeout=timeout) as response:
        payload = response.read().decode("utf-8")
    data = json.loads(payload)
    if isinstance(data, list) and len(data) >= 2 and isinstance(data[1], list):
        return [str(item) for item in data[1]]
    return []


def _build_queries_from_seeds(seeds: list[KeywordInput]) -> list[str]:
    queries: list[str] = []
    for seed in seeds:
        queries.extend(_build_queries(seed.keyword))
    return _dedupe(queries)


def _build_queries(seed: str) -> list[str]:
    base = _normalize_keyword(seed)
    queries = []
    base_terms = len(_split_theme_terms(base))
    if 2 <= base_terms <= 3:
        queries.append(base)
    if base_terms <= 2:
        for expander in DEFAULT_EXPANDERS:
            if expander:
                queries.append(f"{base} {expander}")
        for suffix in DISCOVERY_MODIFIERS:
            queries.append(f"{base} {suffix}")
    return queries


def _normalize_keyword(keyword: str) -> str:
    return re.sub(r"\s+", " ", str(keyword or "").strip())


def _expand_semantic_theme(keyword: str) -> list[str]:
    terms = _split_theme_terms(keyword)
    term_set = set(terms)
    expanded: list[str] = []

    for required_terms, candidates in SEMANTIC_THEME_PATTERNS:
        if required_terms.issubset(term_set):
            expanded.extend(candidates)

    for term in terms:
        expanded.extend(SEMANTIC_THEME_TERMS.get(term, []))

    focus = _pick_focus_term(terms)
    if focus:
        for term in terms:
            if term != focus:
                expanded.append(f"{focus} {term}")
        for related in expanded[:]:
            if " " not in related and related != focus:
                expanded.append(f"{focus} {related}")

    return [item for item in _dedupe(expanded) if _looks_like_query_theme(item)]


def _expand_multi_term_theme(terms: list[str]) -> list[str]:
    expanded: list[str] = []
    clean_terms = [term for term in terms if term]
    expanded.extend(clean_terms)
    term_set = set(clean_terms)
    for required_terms, candidates in CONTEXTUAL_THEME_PATTERNS:
        if required_terms.issubset(term_set):
            expanded.extend(candidates)
    for term in clean_terms:
        expanded.extend(NATURAL_THEME_PHRASES.get(term, []))
    return _dedupe(expanded)


def _expand_url_tags_to_queries(tags: list[str]) -> list[str]:
    candidates: list[str] = []
    candidates.extend(tags)

    expanded_terms: list[str] = []
    for tag in tags:
        expanded_terms.extend(_split_theme_terms(tag))
    tag_terms = _dedupe(expanded_terms)
    candidates.extend(_expand_multi_term_theme(tag_terms))

    return _sort_query_themes(_dedupe(candidates))


def _split_theme_terms(keyword: str) -> list[str]:
    parts = re.split(r"[\s,、/／・]+", keyword)
    return [part for part in (_normalize_keyword(item) for item in parts) if part]


def _pick_focus_term(terms: list[str]) -> str:
    return terms[0] if terms else ""


def _looks_like_query_theme(value: str) -> bool:
    if not value:
        return False
    if len(value) > 32:
        return False
    if len(_split_theme_terms(value)) > 3:
        return False
    return True


def _sort_query_themes(items: list[str]) -> list[str]:
    return sorted(
        items,
        key=lambda item: (
            0 if len(_split_theme_terms(item)) == 3 else 1,
            "カーナビ" in item,
            len(item),
            item,
        ),
    )


def _is_usable_keyword(keyword: str) -> bool:
    if not keyword:
        return False
    if len(keyword) > 80:
        return False
    lowered = keyword.lower()
    if lowered.startswith(("http://", "https://")):
        return False
    if any(marker in lowered for marker in ["@", "#", "site:"]):
        return False
    return True


def _is_collectable_keyword(keyword: str) -> bool:
    term_count = len(_split_theme_terms(keyword))
    return term_count == 3


def _is_expandable_seed_keyword(keyword: str) -> bool:
    term_count = len(_split_theme_terms(keyword))
    return 2 <= term_count <= 3


def _is_url(value: str) -> bool:
    parsed = urlparse(value)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def _dedupe(items: list[str]) -> list[str]:
    seen = set()
    result = []
    for item in items:
        normalized = _normalize_keyword(item)
        key = normalized.casefold()
        if not normalized or key in seen:
            continue
        seen.add(key)
        result.append(normalized)
    return result


def _clean_page_text(value: str) -> str:
    value = re.sub(r"\s+", " ", value)
    value = re.sub(r"[｜|].*$", "", value)
    return value.strip(" -:：\t\r\n")


def _extract_url_keyword_candidates(text: str) -> list[str]:
    candidates: list[str] = []
    spaced_text = re.sub(r"\s+", " ", text)
    compact_text = re.sub(r"\s+", "", text)

    for phrase in URL_KEY_PHRASES:
        if phrase in spaced_text or phrase in compact_text:
            candidates.append(phrase)
    if re.search(r"走行中.*(TV|テレビ)", spaced_text, flags=re.IGNORECASE):
        candidates.append("走行中 テレビ")

    maker_count = sum(1 for word in MAKER_WORDS if word.lower() in spaced_text.lower())
    noisy_context = (
        len(spaced_text) > 30
        or any(word.lower() in spaced_text.lower() for word in BRAND_OR_NAV_WORDS)
        or maker_count >= 2
        or any(mark in spaced_text for mark in ["。", "！", "？"])
    )
    if noisy_context:
        return candidates

    chunks = re.split(r"[。、,.!?！？/／・【】\[\]（）()<>「」『』:：]+", spaced_text)
    for chunk in chunks:
        normalized = _normalize_keyword(chunk)
        if _looks_like_short_theme(normalized):
            candidates.append(normalized)

    tokens = re.findall(r"[A-Za-z0-9][A-Za-z0-9+\-]{1,20}|[ァ-ヶー]{2,20}|[一-龥ぁ-んァ-ヶー]{2,20}", spaced_text)
    candidates.extend(tokens)
    return candidates


def _is_page_keyword(value: str) -> bool:
    if not _is_usable_keyword(value):
        return False
    if len(value) < 2 or len(value) > 24:
        return False
    if not _looks_like_short_theme(value):
        return False
    lowered = value.lower()
    stop_words = {
        "home",
        "menu",
        "login",
        "copyright",
        "privacy",
        "javascript",
        "cookie",
        "サイト",
        "ホーム",
        "ログイン",
        "お問い合わせ",
        "プライバシー",
        "利用規約",
    }
    return lowered not in stop_words and value not in stop_words


def _looks_like_short_theme(value: str) -> bool:
    if not value:
        return False
    if any(mark in value for mark in ["。", "、", "！", "？", "\n", "\r"]):
        return False
    if len(re.findall(r"[A-Za-z0-9一-龥ぁ-んァ-ヶー]+", value)) > 3:
        return False
    if value in MAKER_WORDS:
        return False
    if re.fullmatch(r"[A-Z0-9]{2,5}", value) and value not in ALLOWED_STANDALONE_ASCII_TERMS:
        return False
    if sum(1 for word in MAKER_WORDS if word.lower() in value.lower()) >= 2:
        return False
    if any(word.lower() in value.lower() for word in BRAND_OR_NAV_WORDS):
        return False
    if re.search(r"(できます|しました|します|可能|解決|お悩み|対応|利用|なら|はこちら)$", value):
        return False
    if re.search(r"(映る|使える|できる|くん)$", value):
        return False
    if re.search(r"(メーカー|車種|一覧|ページ|サービス)$", value):
        return False
    return True


def _guess_charset(content_type: str, raw: bytes) -> str:
    match = re.search(r"charset=([\w\-]+)", content_type, flags=re.IGNORECASE)
    if match:
        return match.group(1)
    if raw.startswith((b"\xff\xfe", b"\xfe\xff")):
        return "utf-16"
    return "utf-8"


class _KeywordHTMLParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.capture = False
        self.skip = False
        self.current_tag = ""
        self.texts: list[str] = []

    def handle_starttag(self, tag, attrs):
        self.current_tag = tag.lower()
        self.skip = self.current_tag in {"script", "style", "noscript", "svg"}
        if self.current_tag in {"title", "h1", "h2", "h3"}:
            self.capture = True
        if self.current_tag == "meta":
            attrs_dict = {str(key).lower(): str(value) for key, value in attrs if value is not None}
            name = attrs_dict.get("name", "").lower()
            prop = attrs_dict.get("property", "").lower()
            if name in {"description", "keywords"} or prop in {"og:title", "og:description"}:
                content = attrs_dict.get("content", "")
                if content:
                    self.texts.append(content)

    def handle_endtag(self, tag):
        if tag.lower() == self.current_tag:
            self.capture = False
            self.skip = False

    def handle_data(self, data):
        if self.skip:
            return
        if self.capture:
            text = _clean_page_text(data)
            if text:
                self.texts.append(text)
