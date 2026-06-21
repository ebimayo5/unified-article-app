from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.crawler import SearchCrawler
from app.models import AppConfig, KeywordInput
from app.scorer import load_target_sites


ROOT = Path(sys.executable).resolve().parent if getattr(sys, "frozen", False) else Path(__file__).resolve().parent
DEFAULT_CONFIG_PATH = ROOT / "article_bridge_config.json"
SAMPLE_CONFIG = {
    "web_app_url": "https://script.google.com/macros/s/XXXXXXXX/exec",
    "token": "UA_LOCAL_IMPORT_TOKENと同じ値",
    "poll_seconds": 10,
    "once": False,
    "crawler": {
        "search_engine": "yahoo",
        "search_mode": "live",
        "max_results": 10,
        "wait_seconds": 2,
        "timeout_seconds": 20,
        "headless": True,
        "enable_allintitle": False,
        "enable_intitle": False,
        "enable_domain_check": True,
        "fallback_to_dummy": False,
    },
}


def load_bridge_config(path: Path) -> dict:
    if not path.exists():
        path.write_text(
            json.dumps(SAMPLE_CONFIG, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        raise SystemExit(
            f"設定ファイルを作成しました: {path}\n"
            "web_app_url と token を入れてからもう一度実行してください。"
        )

    with path.open("r", encoding="utf-8-sig") as file:
        config = json.load(file)

    if not str(config.get("web_app_url") or "").strip():
        raise SystemExit("article_bridge_config.json の web_app_url が空です。")
    if not str(config.get("token") or "").strip():
        raise SystemExit("article_bridge_config.json の token が空です。")

    return config


def post_json(web_app_url: str, payload: dict, timeout: int = 60) -> dict:
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = Request(
        web_app_url,
        data=data,
        headers={
            "Content-Type": "application/json; charset=utf-8",
            "User-Agent": "KeywordTreasureFinder-ArticleBridge/1.0",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=timeout) as response:
            text = response.read().decode("utf-8", errors="replace")
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code}: {body}") from exc
    except URLError as exc:
        raise RuntimeError(f"通信に失敗しました: {exc}") from exc

    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"JSONとして読めない返答です: {text[:500]}") from exc


def get_next_job(config: dict) -> dict | None:
    response = post_json(
        config["web_app_url"],
        {
            "action": "get_trefai_job",
            "token": config["token"],
        },
        timeout=30,
    )

    if not response.get("ok"):
        raise RuntimeError(response.get("error") or response.get("message") or "get_trefai_job failed")

    return response.get("job")


def complete_job(config: dict, job: dict, urls: list[str], message: str = "") -> dict:
    return post_json(
        config["web_app_url"],
        {
            "action": "complete_trefai_job",
            "token": config["token"],
            "jobId": job["jobId"],
            "appType": job["appType"],
            "row": job["row"],
            "keyword": job["keyword"],
            "competitorUrls": urls,
            "competitorAnalysisMemo": build_competitor_memo(job, urls, message),
            "status": "done",
        },
        timeout=180,
    )


def fail_job(config: dict, job: dict, error: Exception) -> dict:
    return post_json(
        config["web_app_url"],
        {
            "action": "complete_trefai_job",
            "token": config["token"],
            "jobId": job["jobId"],
            "appType": job.get("appType", ""),
            "row": job.get("row", 0),
            "keyword": job.get("keyword", ""),
            "status": "error",
            "error": str(error),
        },
        timeout=30,
    )


def build_crawler_config(config: dict) -> AppConfig:
    crawler_config = dict(config.get("crawler") or {})
    return AppConfig.from_dict(crawler_config)


def fetch_top_urls(config: dict, keyword: str) -> tuple[list[str], str]:
    crawler_config = build_crawler_config(config)
    target_sites = load_target_sites(ROOT / "data" / "target_sites.json")
    keyword_input = KeywordInput(keyword=keyword)

    with SearchCrawler(crawler_config, target_sites) as crawler:
        result = crawler.search_keyword(keyword_input)

    urls = list(result.top_urls or [])[: crawler_config.max_results]
    message = (
        f"search_url: {result.search_url}\n"
        f"allintitle_count: {result.allintitle_count}\n"
        f"intitle_count: {result.intitle_count}\n"
        f"opportunity_score: {result.opportunity_score}\n"
        f"opportunity_level: {result.opportunity_level}"
    )
    return urls, message


def build_competitor_memo(job: dict, urls: list[str], message: str) -> str:
    lines = [
        "【トレファイで取得した上位URL】",
        f"キーワード: {job.get('keyword', '')}",
    ]

    for index, url in enumerate(urls, start=1):
        lines.append(f"{index}. {url}")

    if message:
        lines.extend(["", "【トレファイ取得メモ】", message])

    return "\n".join(lines)


def run_once(config: dict) -> bool:
    try:
        job = get_next_job(config)
    except Exception as exc:
        print(f"依頼確認に失敗しました: {exc}", file=sys.stderr)
        return False

    if not job:
        print("待機中の依頼はありません。")
        return False

    print(f"取得開始: row={job.get('row')} keyword={job.get('keyword')}")
    try:
        urls, message = fetch_top_urls(config, str(job.get("keyword") or ""))
        response = complete_job(config, job, urls, message)
        if not response.get("ok"):
            raise RuntimeError(response.get("error") or response.get("message") or "complete_trefai_job failed")
        print(f"完了: {len(urls)}件 / {response.get('message', '')}")
        return True
    except Exception as exc:
        try:
            fail_job(config, job, exc)
        finally:
            print(f"失敗: {exc}", file=sys.stderr)
        return False


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Keyword Treasure Finder article bridge")
    parser.add_argument("--config", default=str(DEFAULT_CONFIG_PATH), help="Bridge config JSON path")
    parser.add_argument("--once", action="store_true", help="Process at most one queued job and exit")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    config = load_bridge_config(Path(args.config))
    once = bool(args.once or config.get("once"))
    poll_seconds = max(3, int(config.get("poll_seconds") or 10))

    print("トレファイ記事連携ブリッジを開始しました。Ctrl+Cで終了します。")
    while True:
        run_once(config)
        if once:
            break
        time.sleep(poll_seconds)


if __name__ == "__main__":
    main()
