from __future__ import annotations

import re
from urllib.parse import parse_qs, unquote, urlparse


def parse_result_count(text: str) -> int | None:
    """Extract a rough search result count from visible result text."""
    patterns = [
        r"約\s*([0-9,]+)\s*件",
        r"([0-9,]+)\s*件",
        r"About\s*([0-9,]+)\s*results",
    ]
    match = None
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            break
    if not match:
        return None
    return int(match.group(1).replace(",", ""))


def clean_search_url(url: str) -> str:
    parsed = urlparse(url)
    query = parse_qs(parsed.query)
    for key in ("u", "url", "p"):
        if key in query and query[key]:
            candidate = unquote(query[key][0])
            if candidate.startswith(("http://", "https://")):
                return candidate
    return url


def is_search_internal_url(url: str) -> bool:
    parsed = urlparse(url)
    host = parsed.netloc.lower()
    if host.startswith("www."):
        host = host[4:]
    path = parsed.path.lower()
    internal_domains = {
        "search.yahoo.co.jp",
        "google.com",
        "accounts.google.com",
        "support.google.com",
        "policies.google.com",
        "webcache.googleusercontent.com",
        "chrome.google.com",
    }
    internal_hosts = {
        "yahoo.co.jp",
        "login.yahoo.co.jp",
        "map.yahoo.co.jp",
        "images.search.yahoo.co.jp",
        "news.yahoo.co.jp",
        "video.search.yahoo.co.jp",
    }
    if host in internal_domains or host in internal_hosts:
        return True
    if host.endswith(".search.yahoo.co.jp"):
        return True
    if host == "chiebukuro.yahoo.co.jp" and path.startswith("/search/"):
        return True
    return False


def normalize_urls(urls: list[str], limit: int) -> list[str]:
    seen = set()
    normalized = []
    for url in urls:
        cleaned = clean_search_url(url)
        if not cleaned.startswith(("http://", "https://")):
            continue
        if is_search_internal_url(cleaned) or cleaned in seen:
            continue
        seen.add(cleaned)
        normalized.append(cleaned)
        if len(normalized) >= limit:
            break
    return normalized
