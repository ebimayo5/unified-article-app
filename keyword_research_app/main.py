from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from app.models import AppConfig
from app.runner import run_discovery_research, run_research


ROOT = Path(sys.executable).resolve().parent if getattr(sys, "frozen", False) else Path(__file__).resolve().parent


def default_output_dir() -> Path:
    downloads = Path.home() / "Downloads"
    return downloads if downloads.exists() else ROOT / "output"


def load_config(path: Path) -> AppConfig:
    if not path.exists():
        return AppConfig()
    with path.open("r", encoding="utf-8") as file:
        return AppConfig.from_dict(json.load(file))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Keyword Treasure Finder")
    parser.add_argument("--gui", action="store_true", help="Launch desktop GUI")
    parser.add_argument("--gui-smoke", action="store_true", help=argparse.SUPPRESS)
    parser.add_argument("--input", help="CSV or XLSX file with keyword column")
    parser.add_argument("--output", default=str(default_output_dir()), help="Output directory")
    parser.add_argument("--config", default=str(ROOT / "config.json"), help="Config JSON path")
    parser.add_argument(
        "--format",
        choices=["csv", "xlsx", "both"],
        help="Override output format in config.json",
    )
    parser.add_argument(
        "--mode",
        choices=["dummy", "live"],
        help="Use dummy data or live Selenium search",
    )
    parser.add_argument("--headless", action="store_true", help="Run Chrome in headless mode")
    parser.add_argument("--wait", type=float, help="Override wait seconds between page loads")
    parser.add_argument("--max-results", type=int, help="Override number of top URLs to collect")
    parser.add_argument("--discover", action="store_true", help="Collect suggestions first, then run research")
    parser.add_argument("--max-discovered", type=int, default=100, help="Maximum suggested keywords to research")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.gui_smoke:
        from app.gui import KeywordTreasureApp

        app = KeywordTreasureApp(ROOT)
        app.after(1000, app.destroy)
        app.mainloop()
        print("GUI smoke ok")
        return
    if args.gui or not args.input:
        from app.gui import launch_gui

        launch_gui(ROOT)
        return

    config = load_config(Path(args.config))
    if args.format:
        config.output_format = args.format
    if args.mode:
        config.search_mode = args.mode
    if args.headless:
        config.headless = True
    if args.wait is not None:
        config.wait_seconds = args.wait
    if args.max_results is not None:
        config.max_results = args.max_results

    runner = run_discovery_research if args.discover else run_research
    if args.discover:
        result = runner(
            Path(args.input),
            Path(args.output),
            config,
            ROOT,
            max_discovered_keywords=args.max_discovered,
        )
    else:
        result = runner(Path(args.input), Path(args.output), config, ROOT)
    print(f"Done: {result.count} keywords")
    if result.csv_path:
        print(f"CSV: {result.csv_path}")
    if result.xlsx_path:
        print(f"XLSX: {result.xlsx_path}")


if __name__ == "__main__":
    main()
