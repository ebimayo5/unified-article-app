from __future__ import annotations

import logging
from datetime import datetime
from pathlib import Path
from threading import Event
from typing import Callable

from app.app_logger import create_logger
from app.crawler import SearchCrawler, StopRequested, create_dummy_result
from app.exporter import read_keywords, write_csv, write_keyword_inputs, write_xlsx
from app.keyword_discovery import discover_keywords
from app.models import AppConfig, KeywordInput, KeywordResult, RunResult
from app.scorer import load_target_sites


ProgressCallback = Callable[[int, int, str, str], None]
ResultCallback = Callable[[KeywordResult], None]
LogCallback = Callable[[str], None]


def run_research(
    input_path: Path,
    output_dir: Path,
    config: AppConfig,
    app_root: Path,
    stop_event: Event | None = None,
    progress_callback: ProgressCallback | None = None,
    result_callback: ResultCallback | None = None,
    log_callback: LogCallback | None = None,
) -> RunResult:
    stop_event = stop_event or Event()
    logger = create_logger(app_root / "logs")

    def log(message: str, *args) -> None:
        rendered = message % args if args else message
        logger.info(rendered)
        if log_callback:
            log_callback(rendered)

    log("Input file: %s", input_path)
    log("Output directory: %s", output_dir)

    keywords = read_keywords(input_path)
    if not keywords:
        raise ValueError("No keywords found in input file")
    log("Loaded %s keywords", len(keywords))

    target_sites = load_target_sites(app_root / "data" / "target_sites.json")
    results: list[KeywordResult] = []

    error_message = ""
    try:
        if config.search_mode == "live":
            try:
                log("Search mode: live")
                with SearchCrawler(config, target_sites, stop_event=stop_event) as crawler:
                    _process_keywords(
                        keywords,
                        results,
                        stop_event,
                        progress_callback,
                        result_callback,
                        log,
                        lambda keyword: crawler.search_keyword(keyword),
                    )
            except Exception as exc:
                if isinstance(exc, StopRequested) or not config.fallback_to_dummy:
                    raise
                log("Live search failed, falling back to dummy: %s", exc)
                results.clear()
                _run_dummy(
                    keywords,
                    results,
                    config,
                    target_sites,
                    stop_event,
                    progress_callback,
                    result_callback,
                    log,
                )
        else:
            _run_dummy(
                keywords,
                results,
                config,
                target_sites,
                stop_event,
                progress_callback,
                result_callback,
                log,
                )
    except StopRequested:
        log("Stopped by user")
    except Exception as exc:
        if not results:
            raise
        error_message = str(exc)
        log("Stopped by error after partial results: %s", error_message)

    if stop_event.is_set() or error_message:
        reason = "途中終了のため未調査" if error_message else "停止のため未調査"
        _append_unresearched_results(keywords, results, reason)

    run_result = _save_results(results, output_dir, config, log)
    run_result.stopped = stop_event.is_set() or bool(error_message)
    run_result.error_message = error_message

    status = "Partial saved" if error_message else "Stopped" if run_result.stopped else "Completed"
    log("%s: %s keywords", status, len(results))
    if progress_callback:
        progress_callback(len(results), len(keywords), "", status)
    return run_result


def run_discovery_research(
    input_path: Path,
    output_dir: Path,
    config: AppConfig,
    app_root: Path,
    stop_event: Event | None = None,
    progress_callback: ProgressCallback | None = None,
    result_callback: ResultCallback | None = None,
    log_callback: LogCallback | None = None,
    max_discovered_keywords: int | None = None,
) -> RunResult:
    stop_event = stop_event or Event()
    logger = create_logger(app_root / "logs")

    def log(message: str, *args) -> None:
        rendered = message % args if args else message
        logger.info(rendered)
        if log_callback:
            log_callback(rendered)

    max_discovered_keywords = max_discovered_keywords or config.discovery_max_keywords
    log("Discovery input file: %s", input_path)
    seeds = read_keywords(input_path)
    if not seeds:
        raise ValueError("No seed keywords found in input file")
    log("Loaded %s seed keywords", len(seeds))
    if progress_callback:
        progress_callback(0, max_discovered_keywords, "", "Discovering")

    discovered = discover_keywords(
        seeds,
        max_keywords=max_discovered_keywords,
        stop_event=stop_event,
        log=log,
    )
    if not discovered:
        raise ValueError("No suggested keywords found")

    work_dir = app_root / "work"
    work_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    discovered_path = work_dir / f"discovered_keywords_{timestamp}.csv"
    write_keyword_inputs(discovered, discovered_path)
    log("Discovered %s keywords", len(discovered))
    log("Discovered keyword file: %s", discovered_path)

    if progress_callback:
        progress_callback(0, len(discovered), "", "Researching")
    return run_research(
        discovered_path,
        output_dir,
        config,
        app_root,
        stop_event=stop_event,
        progress_callback=progress_callback,
        result_callback=result_callback,
        log_callback=log_callback,
    )


def _process_keywords(
    keywords: list[KeywordInput],
    results: list[KeywordResult],
    stop_event: Event,
    progress_callback: ProgressCallback | None,
    result_callback: ResultCallback | None,
    log: Callable[[str, object], None],
    search: Callable[[KeywordInput], KeywordResult],
) -> None:
    total = len(keywords)
    for index, keyword in enumerate(keywords, start=1):
        if stop_event.is_set():
            raise StopRequested()
        if progress_callback:
            progress_callback(index - 1, total, keyword.keyword, "Processing")
        log("Processing %s/%s: %s", index, total, keyword.keyword)
        result = search(keyword)
        results.append(result)
        if result_callback:
            result_callback(result)
        if progress_callback:
            progress_callback(index, total, keyword.keyword, "Processing")


def _run_dummy(
    keywords: list[KeywordInput],
    results: list[KeywordResult],
    config: AppConfig,
    target_sites: dict[str, list[str]],
    stop_event: Event,
    progress_callback: ProgressCallback | None,
    result_callback: ResultCallback | None,
    log: Callable[..., None],
) -> None:
    log("Search mode: dummy")
    _process_keywords(
        keywords,
        results,
        stop_event,
        progress_callback,
        result_callback,
        log,
        lambda keyword: create_dummy_result(keyword, config, target_sites),
    )


def _append_unresearched_results(
    keywords: list[KeywordInput],
    results: list[KeywordResult],
    reason: str,
) -> None:
    for keyword in keywords[len(results):]:
        results.append(
            KeywordResult(
                keyword=keyword.keyword,
                genre=keyword.genre,
                monthly_search_volume=keyword.monthly_search_volume,
                competitor_position=keyword.competitor_position,
                competitor_url=keyword.competitor_url,
                keyword_difficulty=keyword.keyword_difficulty,
                source_file=keyword.source_file,
                aim="未調査",
                opportunity_level="未調査",
                notes=reason,
            )
        )


def _save_results(
    results: list[KeywordResult],
    output_dir: Path,
    config: AppConfig,
    log: Callable[..., None],
) -> RunResult:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir.mkdir(parents=True, exist_ok=True)
    run_result = RunResult(count=len(results))

    output_format = config.output_format.lower()
    if results and output_format in {"csv", "both"}:
        run_result.csv_path = output_dir / f"keyword_results_{timestamp}.csv"
        write_csv(results, run_result.csv_path)
        log("CSV saved: %s", run_result.csv_path)

    if results and output_format in {"xlsx", "excel", "both"}:
        run_result.xlsx_path = output_dir / f"keyword_results_{timestamp}.xlsx"
        write_xlsx(results, run_result.xlsx_path)
        log("XLSX saved: %s", run_result.xlsx_path)

    return run_result


def log_exception(logger: logging.Logger, message: str) -> None:
    logger.exception(message)
