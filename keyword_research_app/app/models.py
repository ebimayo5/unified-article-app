from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path


OUTPUT_COLUMNS = [
    "keyword",
    "genre",
    "monthly_search_volume",
    "search_url",
    "allintitle_count",
    "intitle_count",
    "ねらい目判定",
    "qa_site_count",
    "qa_site_rank",
    "free_blog_count",
    "free_blog_rank",
    "sns_count",
    "tiktok_count",
    "tiktok_rank",
    "instagram_count",
    "instagram_rank",
    "x_count",
    "x_rank",
    "threads_count",
    "threads_rank",
    "facebook_count",
    "facebook_rank",
    "strong_domain_count",
    "weak_domain_count",
    "opportunity_score",
    "opportunity_level",
    "top_urls",
    "notes",
]

DOKUSOU_LIKE_COLUMNS = [
    "キーワード",
    "月間検索数",
    "Q&Aサイト",
    "Q&A順位",
    "無料ブログ",
    "無料ブログ順位",
    "TikTok",
    "TikTok順位",
    "Instagram",
    "Instagram順位",
    "エックス",
    "エックス順位",
    "Threads",
    "Threads順位",
    "Facebook",
    "Facebook順位",
    "ねらい目判定",
    "スコア",
    "判定レベル",
    "allintitle_count",
    "intitle_count",
    "メモ",
]


@dataclass
class AppConfig:
    search_engine: str = "yahoo"
    search_mode: str = "live"
    max_results: int = 10
    wait_seconds: float = 2
    timeout_seconds: int = 20
    headless: bool = True
    output_format: str = "xlsx"
    enable_allintitle: bool = True
    enable_intitle: bool = True
    enable_domain_check: bool = True
    aim_allintitle_limit: int = 10
    aim_intitle_limit: int = 5000
    user_agent: str = ""
    log_retention_count: int = 20
    output_retention_count: int = 20
    fallback_to_dummy: bool = False
    discovery_max_keywords: int = 100

    @classmethod
    def from_dict(cls, data: dict) -> "AppConfig":
        known = {field.name for field in cls.__dataclass_fields__.values()}
        values = {key: value for key, value in data.items() if key in known}
        return cls(**values)


@dataclass
class KeywordInput:
    keyword: str
    genre: str = ""
    memo: str = ""
    priority: str = ""
    monthly_search_volume: int = 0
    competitor_position: int = 0
    competitor_url: str = ""
    keyword_difficulty: float = 0.0
    source_file: str = ""


@dataclass
class KeywordResult:
    keyword: str
    genre: str = ""
    monthly_search_volume: int = 0
    competitor_position: int = 0
    competitor_url: str = ""
    keyword_difficulty: float = 0.0
    source_file: str = ""
    search_url: str = ""
    allintitle_count: int = 0
    intitle_count: int = 0
    aim: str = ""
    qa_site_count: int = 0
    qa_site_rank: int = 0
    free_blog_count: int = 0
    free_blog_rank: int = 0
    sns_count: int = 0
    tiktok_count: int = 0
    tiktok_rank: int = 0
    instagram_count: int = 0
    instagram_rank: int = 0
    x_count: int = 0
    x_rank: int = 0
    threads_count: int = 0
    threads_rank: int = 0
    facebook_count: int = 0
    facebook_rank: int = 0
    strong_domain_count: int = 0
    weak_domain_count: int = 0
    opportunity_score: int = 0
    opportunity_level: str = ""
    top_urls: list[str] = field(default_factory=list)
    notes: str = ""

    def to_row(self) -> dict:
        return {
            "keyword": self.keyword,
            "genre": self.genre,
            "monthly_search_volume": self.monthly_search_volume,
            "search_url": self.search_url,
            "allintitle_count": self.allintitle_count,
            "intitle_count": self.intitle_count,
            "ねらい目判定": self.aim,
            "qa_site_count": self.qa_site_count,
            "qa_site_rank": self.qa_site_rank,
            "free_blog_count": self.free_blog_count,
            "free_blog_rank": self.free_blog_rank,
            "sns_count": self.sns_count,
            "tiktok_count": self.tiktok_count,
            "tiktok_rank": self.tiktok_rank,
            "instagram_count": self.instagram_count,
            "instagram_rank": self.instagram_rank,
            "x_count": self.x_count,
            "x_rank": self.x_rank,
            "threads_count": self.threads_count,
            "threads_rank": self.threads_rank,
            "facebook_count": self.facebook_count,
            "facebook_rank": self.facebook_rank,
            "strong_domain_count": self.strong_domain_count,
            "weak_domain_count": self.weak_domain_count,
            "opportunity_score": self.opportunity_score,
            "opportunity_level": self.opportunity_level,
            "top_urls": " | ".join(self.top_urls),
            "notes": self.notes,
        }

    def to_dokusou_like_row(self) -> dict:
        return {
            "キーワード": self.keyword,
            "月間検索数": self.monthly_search_volume or "",
            "Q&Aサイト": "Q&A" if self.qa_site_rank else "",
            "Q&A順位": self.qa_site_rank or "",
            "無料ブログ": "無料" if self.free_blog_rank else "",
            "無料ブログ順位": self.free_blog_rank or "",
            "TikTok": "TK" if self.tiktok_rank else "",
            "TikTok順位": self.tiktok_rank or "",
            "Instagram": "Insta" if self.instagram_rank else "",
            "Instagram順位": self.instagram_rank or "",
            "エックス": "X" if self.x_rank else "",
            "エックス順位": self.x_rank or "",
            "Threads": "Threads" if self.threads_rank else "",
            "Threads順位": self.threads_rank or "",
            "Facebook": "FB" if self.facebook_rank else "",
            "Facebook順位": self.facebook_rank or "",
            "ねらい目判定": self.aim,
            "スコア": self.opportunity_score,
            "判定レベル": self.opportunity_level,
            "allintitle_count": self.allintitle_count,
            "intitle_count": self.intitle_count,
            "メモ": self.notes,
        }


@dataclass
class RunResult:
    csv_path: Path | None = None
    xlsx_path: Path | None = None
    count: int = 0
    stopped: bool = False
    error_message: str = ""
