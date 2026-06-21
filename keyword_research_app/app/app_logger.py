from __future__ import annotations

import logging
from datetime import datetime
from pathlib import Path


def create_logger(log_dir: Path) -> logging.Logger:
    log_dir.mkdir(parents=True, exist_ok=True)
    logger = logging.getLogger("keyword_treasure_finder")
    logger.setLevel(logging.INFO)
    logger.handlers.clear()

    log_path = log_dir / f"run_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
    formatter = logging.Formatter("[%(asctime)s] %(levelname)s %(message)s")

    file_handler = logging.FileHandler(log_path, encoding="utf-8")
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)

    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(formatter)
    logger.addHandler(stream_handler)

    logger.info("Application started")
    return logger

