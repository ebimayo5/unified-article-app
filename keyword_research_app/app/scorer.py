from __future__ import annotations

import json
from pathlib import Path
from urllib.parse import urlparse

from app.models import KeywordResult


DEFAULT_TARGETS = {
    "qa_sites": [],
    "free_blogs": [],
    "sns": [],
    "strong_domains": [],
}


def load_target_sites(path: Path) -> dict[str, list[str]]:
    if not path.exists():
        return DEFAULT_TARGETS.copy()
    with path.open("r", encoding="utf-8") as file:
        data = json.load(file)
    merged = DEFAULT_TARGETS.copy()
    merged.update({key: list(value) for key, value in data.items()})
    return merged


def _hostname(url: str) -> str:
    host = urlparse(url).netloc.lower()
    if host.startswith("www."):
        host = host[4:]
    return host


def _matches(host: str, domains: list[str]) -> bool:
    for domain in domains:
        domain = domain.lower()
        if host == domain or host.endswith("." + domain):
            return True
    return False


def classify_domain(url: str, target_sites: dict[str, list[str]] | None = None) -> str:
    target_sites = target_sites or DEFAULT_TARGETS
    parsed = urlparse(url)
    host = _hostname(url)
    path = parsed.path.lower()
    if host == "carview.yahoo.co.jp" and "/chiebukuro/" in path:
        return "qa_site"
    if _matches(host, target_sites.get("qa_sites", [])):
        return "qa_site"
    if _matches(host, target_sites.get("free_blogs", [])):
        return "free_blog"
    if _matches(host, target_sites.get("sns", [])):
        return "sns"
    if _matches(host, target_sites.get("strong_domains", [])):
        return "strong_domain"
    return "other"


def classify_social_platform(url: str) -> str:
    host = _hostname(url)
    if host == "tiktok.com" or host.endswith(".tiktok.com"):
        return "tiktok"
    if host == "instagram.com" or host.endswith(".instagram.com"):
        return "instagram"
    if host in {"x.com", "twitter.com"} or host.endswith(".x.com") or host.endswith(".twitter.com"):
        return "x"
    if host == "threads.net" or host.endswith(".threads.net"):
        return "threads"
    if host == "facebook.com" or host.endswith(".facebook.com"):
        return "facebook"
    return ""


def calculate_score(result: KeywordResult) -> int:
    score = 0

    if result.allintitle_count >= 0:
        if result.allintitle_count <= 10:
            score += 30
        elif result.allintitle_count <= 30:
            score += 20
        elif result.allintitle_count <= 50:
            score += 10
        elif result.allintitle_count <= 300:
            score += 8
        elif result.allintitle_count <= 500:
            score += 5

    if result.intitle_count >= 0:
        if result.intitle_count <= 100:
            score += 20
        elif result.intitle_count <= 300:
            score += 10
        elif result.intitle_count <= 1000:
            score += 5

    score += _rank_score(result.qa_site_rank, top_score=40, mid_score=28, low_score=16)
    score += _rank_score(result.free_blog_rank, top_score=30, mid_score=20, low_score=12)
    score += _best_sns_rank_score(result)

    score += min(max(result.qa_site_count - 1, 0) * 4, 8)
    score += min(max(result.free_blog_count - 1, 0) * 3, 6)
    score += min(max(result.sns_count - 1, 0) * 2, 4)
    score -= min(result.strong_domain_count * 5, 15)
    score += _volume_score(result.monthly_search_volume)

    return max(0, min(100, score))


def _volume_score(volume: int) -> int:
    if 100 <= volume <= 3000:
        return 10
    if 3000 < volume <= 10000:
        return 7
    if 30 <= volume < 100:
        return 5
    if volume > 10000:
        return 3
    return 0


def _rank_score(rank: int, top_score: int, mid_score: int, low_score: int) -> int:
    if rank <= 0:
        return 0
    if rank <= 3:
        return top_score
    if rank <= 5:
        return mid_score
    if rank <= 10:
        return low_score
    return 0


def _best_sns_rank_score(result: KeywordResult) -> int:
    ranks = [
        result.tiktok_rank,
        result.instagram_rank,
        result.x_rank,
        result.threads_rank,
        result.facebook_rank,
    ]
    visible_ranks = [rank for rank in ranks if rank > 0]
    if not visible_ranks:
        return 0
    return _rank_score(min(visible_ranks), top_score=16, mid_score=11, low_score=7)


def judge_keyword_opportunity(
    result: KeywordResult,
    allintitle_limit: int = 300,
    intitle_limit: int = 1000,
) -> str:
    weak_site_near_top = _best_weak_rank(result) <= 3
    weak_site_visible = _best_weak_rank(result) <= 10
    low_title_competition = (
        result.allintitle_count >= 0
        and result.intitle_count >= 0
        and result.allintitle_count <= allintitle_limit
        and result.intitle_count <= intitle_limit
    )
    very_low_title_competition = (
        result.allintitle_count >= 0
        and result.intitle_count >= 0
        and result.allintitle_count <= allintitle_limit
        and result.intitle_count <= intitle_limit
    )

    if very_low_title_competition and (result.opportunity_score >= 70 or weak_site_visible):
        return "かなり狙い目"
    if result.opportunity_score >= 80:
        return "かなり狙い目"
    if low_title_competition and (result.opportunity_score >= 55 or weak_site_near_top):
        return "狙い目"
    if result.opportunity_score >= 60 and weak_site_visible:
        return "狙い目"
    if result.opportunity_score >= 40 or weak_site_visible:
        return "要検討"
    return ""


def _best_weak_rank(result: KeywordResult) -> int:
    ranks = [
        result.qa_site_rank,
        result.free_blog_rank,
        result.tiktok_rank,
        result.instagram_rank,
        result.x_rank,
        result.threads_rank,
        result.facebook_rank,
    ]
    visible = [rank for rank in ranks if rank > 0]
    return min(visible) if visible else 999


def judge_level(score: int) -> str:
    if score >= 80:
        return "かなり狙い目"
    if score >= 60:
        return "狙いやすい"
    if score >= 40:
        return "要検討"
    return "厳しい"


def build_notes(result: KeywordResult) -> str:
    notes = []
    if not result.top_urls:
        notes.append("\u691c\u7d22\u7d50\u679cURL\u3092\u53d6\u5f97\u3067\u304d\u307e\u305b\u3093\u3067\u3057\u305f")
    if result.allintitle_count < 0:
        notes.append("allintitle取得失敗")
    if result.intitle_count < 0:
        notes.append("intitle取得失敗")
    if result.strong_domain_count >= 8:
        notes.append("\u4e0a\u4f4d\u306b\u5f37\u3044\u30b5\u30a4\u30c8\u304c\u591a\u3081")
    if (
        result.opportunity_score >= 70
        and result.allintitle_count >= 0
        and result.intitle_count >= 0
        and result.allintitle_count <= 10
        and result.intitle_count <= 100
        and not _has_weak_site(result)
    ):
        notes.append("\u30bf\u30a4\u30c8\u30eb\u7af6\u5408\u306f\u5c11\u306a\u3044\u304c\u5f31\u3044\u30b5\u30a4\u30c8\u306f\u672a\u691c\u51fa")
    return " / ".join(notes)


def _has_weak_site(result: KeywordResult) -> bool:
    return any(
        rank > 0
        for rank in (
            result.qa_site_rank,
            result.free_blog_rank,
            result.tiktok_rank,
            result.instagram_rank,
            result.x_rank,
            result.threads_rank,
            result.facebook_rank,
        )
    )


def enrich_score(
    result: KeywordResult,
    allintitle_limit: int = 300,
    intitle_limit: int = 1000,
) -> KeywordResult:
    result.weak_domain_count = (
        result.qa_site_count + result.free_blog_count + result.sns_count
    )
    result.opportunity_score = calculate_score(result)
    result.aim = judge_keyword_opportunity(result, allintitle_limit, intitle_limit)
    if result.aim == "かなり狙い目":
        result.opportunity_score = max(result.opportunity_score, 80)
    elif result.aim == "狙い目":
        result.opportunity_score = max(result.opportunity_score, 60)
    result.opportunity_level = judge_level(result.opportunity_score)
    result.notes = build_notes(result)
    return result


def enrich_imported_result(result: KeywordResult) -> KeywordResult:
    result.opportunity_score = calculate_import_score(result)
    result.opportunity_level = judge_level(result.opportunity_score)
    if result.opportunity_score >= 80:
        result.aim = "かなり狙い目"
    elif result.opportunity_score >= 60:
        result.aim = "狙い目"
    elif result.opportunity_score >= 40:
        result.aim = "要検討"
    else:
        result.aim = ""
    result.notes = build_import_notes(result)
    return result


def calculate_import_score(result: KeywordResult) -> int:
    volume = result.monthly_search_volume
    score = 0

    if 100 <= volume <= 3000:
        score += 55
    elif 3000 < volume <= 10000:
        score += 45
    elif 30 <= volume < 100:
        score += 35
    elif volume > 10000:
        score += 30
    elif volume > 0:
        score += 20

    if _looks_long_tail(result.keyword):
        score += 20
    else:
        score += 8

    if result.keyword_difficulty > 0:
        if result.keyword_difficulty <= 10:
            score += 20
        elif result.keyword_difficulty <= 30:
            score += 12
        elif result.keyword_difficulty <= 50:
            score += 5
        else:
            score -= 10

    return max(0, min(100, score))


def _looks_long_tail(keyword: str) -> bool:
    text = keyword.strip()
    if not text:
        return False
    if " " in text or "　" in text:
        return True
    return len(text) >= 9


def build_import_notes(result: KeywordResult) -> str:
    notes = []
    if result.monthly_search_volume <= 0:
        notes.append("\u6708\u9593\u691c\u7d22\u6570\u304c\u7a7a\u3067\u3059")
    if result.keyword_difficulty >= 50:
        notes.append("KD\u9ad8\u3081")
    if result.competitor_position > 0:
        notes.append(f"\u5143CSV\u9806\u4f4d: {result.competitor_position}")
    return " / ".join(notes)

