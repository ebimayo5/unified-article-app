from __future__ import annotations

import hashlib
import time
from threading import Event
from urllib.parse import quote_plus, urlparse

from app.models import AppConfig, KeywordInput, KeywordResult
from app.parser import clean_search_url, normalize_urls, parse_result_count
from app.scorer import classify_domain, classify_social_platform, enrich_score


class StopRequested(Exception):
    pass


DUMMY_URL_POOL = [
    "https://detail.chiebukuro.yahoo.co.jp/qa/question_detail/example",
    "https://oshiete.goo.ne.jp/qa/example.html",
    "https://ameblo.jp/example-entry",
    "https://hatenablog.com/example",
    "https://note.com/example/n/n123",
    "https://x.com/example/status/123",
    "https://instagram.com/example",
    "https://www.amazon.co.jp/example",
    "https://kakaku.com/item/example",
    "https://www.wikipedia.org/wiki/example",
    "https://example.com/article",
    "https://personal-site.example/review",
]


def count_and_rank_urls(
    urls: list[str],
    target_sites: dict[str, list[str]],
) -> dict[str, int]:
    counts = {
        "qa_site": 0,
        "free_blog": 0,
        "sns": 0,
        "strong_domain": 0,
        "tiktok": 0,
        "instagram": 0,
        "x": 0,
        "threads": 0,
        "facebook": 0,
        "qa_site_rank": 0,
        "free_blog_rank": 0,
        "tiktok_rank": 0,
        "instagram_rank": 0,
        "x_rank": 0,
        "threads_rank": 0,
        "facebook_rank": 0,
    }
    for rank, url in enumerate(urls[:10], start=1):
        category = classify_domain(url, target_sites)
        if category in counts:
            counts[category] += 1
            rank_key = f"{category}_rank"
            if rank_key in counts and not counts[rank_key]:
                counts[rank_key] = rank
        platform = classify_social_platform(url)
        if platform:
            counts[platform] += 1
            rank_key = f"{platform}_rank"
            if not counts[rank_key]:
                counts[rank_key] = rank
    return counts


def build_search_url(keyword: str, engine: str = "yahoo") -> str:
    query = quote_plus(keyword)
    if engine.lower() == "yahoo":
        return f"https://search.yahoo.co.jp/search?p={query}"
    return f"https://www.google.com/search?q={query}"


def create_dummy_result(
    keyword_input: KeywordInput,
    config: AppConfig,
    target_sites: dict[str, list[str]],
) -> KeywordResult:
    seed = int(hashlib.sha256(keyword_input.keyword.encode("utf-8")).hexdigest()[:8], 16)
    allintitle_count = seed % 65
    intitle_count = (seed // 7) % 520
    start = seed % len(DUMMY_URL_POOL)
    urls = [
        DUMMY_URL_POOL[(start + index) % len(DUMMY_URL_POOL)]
        for index in range(config.max_results)
    ]

    counts = count_and_rank_urls(urls, target_sites)

    result = KeywordResult(
        keyword=keyword_input.keyword,
        genre=keyword_input.genre,
        monthly_search_volume=keyword_input.monthly_search_volume,
        competitor_position=keyword_input.competitor_position,
        competitor_url=keyword_input.competitor_url,
        keyword_difficulty=keyword_input.keyword_difficulty,
        source_file=keyword_input.source_file,
        search_url=build_search_url(keyword_input.keyword, config.search_engine),
        allintitle_count=allintitle_count,
        intitle_count=intitle_count,
        qa_site_count=counts["qa_site"],
        qa_site_rank=counts["qa_site_rank"],
        free_blog_count=counts["free_blog"],
        free_blog_rank=counts["free_blog_rank"],
        sns_count=counts["sns"],
        tiktok_count=counts["tiktok"],
        tiktok_rank=counts["tiktok_rank"],
        instagram_count=counts["instagram"],
        instagram_rank=counts["instagram_rank"],
        x_count=counts["x"],
        x_rank=counts["x_rank"],
        threads_count=counts["threads"],
        threads_rank=counts["threads_rank"],
        facebook_count=counts["facebook"],
        facebook_rank=counts["facebook_rank"],
        strong_domain_count=counts["strong_domain"],
        top_urls=urls,
    )
    return enrich_score(
        result,
        config.aim_allintitle_limit,
        config.aim_intitle_limit,
    )


class SearchCrawler:
    def __init__(
        self,
        config: AppConfig,
        target_sites: dict[str, list[str]],
        stop_event: Event | None = None,
    ):
        self.config = config
        self.target_sites = target_sites
        self.stop_event = stop_event or Event()
        self.driver = None

    def __enter__(self) -> "SearchCrawler":
        self.driver = self._create_driver()
        return self

    def __exit__(self, exc_type, exc, traceback) -> None:
        if self.driver:
            self.driver.quit()

    def _create_driver(self):
        try:
            from selenium import webdriver
            from selenium.webdriver.chrome.options import Options
        except ImportError as exc:
            raise RuntimeError(
                "Selenium is not installed. Run: python -m pip install -r requirements.txt"
            ) from exc

        options = Options()
        if self.config.headless:
            options.add_argument("--headless=new")
        options.add_argument("--disable-gpu")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-extensions")
        options.add_argument("--disable-background-networking")
        options.add_argument("--disable-renderer-backgrounding")
        options.add_argument("--lang=ja-JP")
        if self.config.user_agent:
            options.add_argument(f"--user-agent={self.config.user_agent}")

        driver = webdriver.Chrome(options=options)
        driver.set_page_load_timeout(self.config.timeout_seconds)
        return driver

    def search_keyword(self, keyword_input: KeywordInput) -> KeywordResult:
        self._raise_if_stopped()
        normal = self._fetch(keyword_input.keyword)
        allintitle_count = 0
        intitle_count = 0

        if self.config.enable_allintitle:
            self._raise_if_stopped()
            allintitle_count = self._fetch(f"allintitle:{keyword_input.keyword}").count
        if self.config.enable_intitle:
            self._raise_if_stopped()
            intitle_count = self._fetch(f"intitle:{keyword_input.keyword}").count

        if self.config.enable_domain_check:
            counts = count_and_rank_urls(normal.urls, self.target_sites)
        else:
            counts = {key: 0 for key in count_and_rank_urls([], self.target_sites)}

        result = KeywordResult(
            keyword=keyword_input.keyword,
            genre=keyword_input.genre,
            monthly_search_volume=keyword_input.monthly_search_volume,
            competitor_position=keyword_input.competitor_position,
            competitor_url=keyword_input.competitor_url,
            keyword_difficulty=keyword_input.keyword_difficulty,
            source_file=keyword_input.source_file,
            search_url=normal.url,
            allintitle_count=allintitle_count,
            intitle_count=intitle_count,
            qa_site_count=counts["qa_site"],
            qa_site_rank=counts["qa_site_rank"],
            free_blog_count=counts["free_blog"],
            free_blog_rank=counts["free_blog_rank"],
            sns_count=counts["sns"],
            tiktok_count=counts["tiktok"],
            tiktok_rank=counts["tiktok_rank"],
            instagram_count=counts["instagram"],
            instagram_rank=counts["instagram_rank"],
            x_count=counts["x"],
            x_rank=counts["x_rank"],
            threads_count=counts["threads"],
            threads_rank=counts["threads_rank"],
            facebook_count=counts["facebook"],
            facebook_rank=counts["facebook_rank"],
            strong_domain_count=counts["strong_domain"],
            top_urls=normal.urls,
        )
        return enrich_score(
            result,
            self.config.aim_allintitle_limit,
            self.config.aim_intitle_limit,
        )

    def _fetch(self, query: str) -> "_FetchedSearch":
        if not self.driver:
            raise RuntimeError("Crawler is not started")

        self._raise_if_stopped()
        url = build_search_url(query, self.config.search_engine)
        last_error: Exception | None = None
        for attempt in range(2):
            try:
                self.driver.get(url)
                self._interruptible_sleep(max(0, float(self.config.wait_seconds)))

                body_text = self.driver.find_element("tag name", "body").text
                urls = self._extract_urls()
                return _FetchedSearch(
                    url=url,
                    count=parse_result_count(body_text),
                    urls=normalize_urls(urls, self.config.max_results),
                )
            except Exception as exc:
                self._raise_if_stopped()
                last_error = exc
                if not _is_recoverable_webdriver_error(exc) or attempt >= 1:
                    break
                self._restart_driver()
                self._interruptible_sleep(1.0)

        return _FetchedSearch(url=url, count=0, urls=[], error=str(last_error or "fetch failed"))

    def _restart_driver(self) -> None:
        if self.driver:
            try:
                self.driver.quit()
            except Exception:
                pass
        self.driver = self._create_driver()

    def _extract_urls(self) -> list[str]:
        anchors = self.driver.find_elements("tag name", "a")
        urls = []
        for anchor in anchors:
            href = anchor.get_attribute("href") or ""
            text = (anchor.text or "").strip()
            if href and text and self._looks_like_main_result(href, text):
                urls.append(href)
        return urls

    def _looks_like_main_result(self, href: str, text: str) -> bool:
        if self.config.search_engine.lower() != "yahoo":
            return True
        cleaned = clean_search_url(href)
        host = urlparse(cleaned).netloc.lower()
        if host.startswith("www."):
            host = host[4:]
        if not host:
            return False
        visible_text = text.lower()
        host_parts = [host]
        if host.startswith("detail."):
            host_parts.append(host.removeprefix("detail."))
        return any(part in visible_text for part in host_parts)

    def _interruptible_sleep(self, seconds: float) -> None:
        end_time = time.monotonic() + seconds
        while time.monotonic() < end_time:
            self._raise_if_stopped()
            time.sleep(min(0.2, end_time - time.monotonic()))

    def _raise_if_stopped(self) -> None:
        if self.stop_event.is_set():
            raise StopRequested()


def _is_recoverable_webdriver_error(exc: Exception) -> bool:
    message = str(exc).lower()
    recoverable_markers = [
        "invalid session id",
        "session deleted",
        "not connected to devtools",
        "chrome not reachable",
        "disconnected",
        "target window already closed",
        "timeout",
        "timed out",
    ]
    return any(marker in message for marker in recoverable_markers)


class _FetchedSearch:
    def __init__(self, url: str, count: int, urls: list[str], error: str = ""):
        self.url = url
        self.count = count
        self.urls = urls
        self.error = error
