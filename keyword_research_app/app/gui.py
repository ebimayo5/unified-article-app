from __future__ import annotations

import json
import os
import queue
import threading
import time
from dataclasses import asdict
from pathlib import Path
from tkinter import Canvas, filedialog, messagebox, ttk

import customtkinter as ctk

from app.exporter import ensure_keyword_template, write_keyword_inputs
from app.models import AppConfig, KeywordInput, KeywordResult
from app.runner import run_discovery_research, run_research


def default_output_dir() -> Path:
    downloads = Path.home() / "Downloads"
    return downloads if downloads.exists() else Path.home()


class KeywordTreasureApp(ctk.CTk):
    def __init__(self, app_root: Path):
        super().__init__()
        self.app_root = _normalize_app_root(app_root)
        self.config_path = self.app_root / "config.json"
        self.keyword_sheet_path = self.app_root / "keyword_input.xlsx"
        self.config = self._load_config()
        self.worker: threading.Thread | None = None
        self.stop_event = threading.Event()
        self.events: queue.Queue[tuple[str, object]] = queue.Queue()
        self.keyword_sheet_mtime: float | None = None
        self.watch_keyword_sheet = False

        ctk.set_appearance_mode("light")
        ctk.set_default_color_theme("blue")
        self.title("Keyword Treasure Finder")
        self.geometry("1240x820")
        self.minsize(1080, 720)
        self.configure(fg_color="#0F2F27")
        self.colors = {
            "bg": "#0F2F27",
            "panel": "#FFFFFF",
            "panel_alt": "#FBFDFC",
            "border": "#95CFC2",
            "text": "#1F2933",
            "muted": "#667085",
            "primary": "#20AD7F",
            "primary_hover": "#0D7659",
            "secondary": "#E4F4EF",
            "secondary_hover": "#C9EBD9",
            "secondary_text": "#0D7659",
            "danger": "#B42318",
            "danger_hover": "#8E1C13",
            "header": "#0A241D",
            "accent": "#0D7659",
            "soft": "#E5F7EE",
            "soft_strong": "#C9EBD9",
            "header_start": "#071B16",
            "header_mid": "#0D7659",
            "header_end": "#20AD7F",
        }
        self.fonts = {
            "button": ctk.CTkFont(family="Yu Gothic UI", size=13, weight="bold"),
            "control": ctk.CTkFont(family="Yu Gothic UI", size=13, weight="bold"),
            "entry": ctk.CTkFont(family="Yu Gothic UI", size=13),
            "status": ctk.CTkFont(family="Yu Gothic UI", size=12, weight="bold"),
            "log": ctk.CTkFont(family="Yu Gothic UI", size=12),
        }

        self.input_path = ctk.StringVar(value=str(self.keyword_sheet_path))
        self.discovery_theme = ctk.StringVar(value="")
        self.output_dir = ctk.StringVar(value=str(default_output_dir()))
        self.output_format = ctk.StringVar(value="xlsx")
        self.search_mode = ctk.StringVar(value=self.config.search_mode)
        self.max_results = ctk.StringVar(value=str(self.config.max_results))
        self.discovery_max_keywords = ctk.StringVar(value=str(self.config.discovery_max_keywords))
        self.wait_seconds = ctk.StringVar(value=str(self.config.wait_seconds))
        self.timeout_seconds = ctk.StringVar(value=str(self.config.timeout_seconds))
        self.aim_allintitle_limit = ctk.StringVar(value=str(self.config.aim_allintitle_limit))
        self.aim_intitle_limit = ctk.StringVar(value=str(self.config.aim_intitle_limit))
        self.headless = ctk.BooleanVar(value=self.config.headless)
        self.enable_allintitle = ctk.BooleanVar(value=self.config.enable_allintitle)
        self.enable_intitle = ctk.BooleanVar(value=self.config.enable_intitle)
        self.enable_domain_check = ctk.BooleanVar(value=self.config.enable_domain_check)
        self.status = ctk.StringVar(value="待機中")
        self.current_keyword = ctk.StringVar(value="-")
        self.progress_text = ctk.StringVar(value="0 / 0")

        self._build_layout()
        self._polish_controls(self)
        self._ensure_keyword_sheet()
        self.after(100, self._drain_events)

    def _build_layout(self) -> None:
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(4, weight=1)
        self.grid_rowconfigure(5, weight=1)

        self.header_canvas = Canvas(self, height=92, highlightthickness=0, bd=0)
        self.header_canvas.grid(row=0, column=0, sticky="ew")
        self.header_canvas.bind("<Configure>", self._draw_header)

        file_frame = ctk.CTkFrame(
            self,
            corner_radius=8,
            fg_color=self.colors["panel"],
            border_width=1,
            border_color=self.colors["border"],
        )
        file_frame.grid(row=1, column=0, sticky="ew", padx=20, pady=(16, 8))
        file_frame.grid_columnconfigure(1, weight=1)
        file_frame.grid_columnconfigure(3, weight=1)

        ctk.CTkLabel(file_frame, text="入力ファイル").grid(row=0, column=0, padx=10, pady=10, sticky="w")
        ctk.CTkEntry(file_frame, textvariable=self.input_path).grid(row=0, column=1, padx=8, pady=10, sticky="ew")
        ctk.CTkButton(file_frame, text="選択", width=86, fg_color=self.colors["secondary"], hover_color=self.colors["secondary_hover"], command=self._choose_input).grid(row=0, column=2, padx=8, pady=10)
        ctk.CTkButton(file_frame, text="キーワードシートを開く", width=180, fg_color=self.colors["primary"], hover_color=self.colors["primary_hover"], command=self._open_keyword_sheet).grid(row=0, column=3, padx=8, pady=10, sticky="ew")

        ctk.CTkLabel(file_frame, text="探索テーマ").grid(row=1, column=0, padx=10, pady=10, sticky="w")
        ctk.CTkEntry(file_frame, textvariable=self.discovery_theme, placeholder_text="例: ナビ / ソリオ 後部座席 / https://...",).grid(row=1, column=1, padx=8, pady=10, sticky="ew")
        ctk.CTkButton(file_frame, text="候補取得→調査", width=150, fg_color=self.colors["primary"], hover_color=self.colors["primary_hover"], command=lambda: self._start(auto_discover=True)).grid(row=1, column=2, padx=8, pady=10)

        ctk.CTkLabel(file_frame, text="出力フォルダ").grid(row=2, column=0, padx=10, pady=10, sticky="w")
        ctk.CTkEntry(file_frame, textvariable=self.output_dir).grid(row=2, column=1, padx=8, pady=10, sticky="ew")
        ctk.CTkButton(file_frame, text="選択", width=86, fg_color=self.colors["secondary"], hover_color=self.colors["secondary_hover"], command=self._choose_output).grid(row=2, column=2, padx=8, pady=10)
        ctk.CTkSegmentedButton(file_frame, values=["xlsx"], variable=self.output_format).grid(row=2, column=3, padx=8, pady=10, sticky="ew")

        settings = ctk.CTkFrame(
            self,
            corner_radius=8,
            fg_color=self.colors["panel"],
            border_width=1,
            border_color=self.colors["border"],
        )
        settings.grid(row=2, column=0, sticky="ew", padx=20, pady=8)
        for col in range(8):
            settings.grid_columnconfigure(col, weight=1)

        ctk.CTkLabel(settings, text="検索モード").grid(row=0, column=0, padx=10, pady=8, sticky="w")
        ctk.CTkSegmentedButton(settings, values=["live", "dummy"], variable=self.search_mode).grid(row=0, column=1, padx=6, pady=8, sticky="ew")
        ctk.CTkLabel(settings, text="上位件数").grid(row=0, column=2, padx=10, pady=8, sticky="w")
        ctk.CTkEntry(settings, textvariable=self.max_results, width=78).grid(row=0, column=3, padx=6, pady=8, sticky="w")
        ctk.CTkLabel(settings, text="待機秒数").grid(row=0, column=4, padx=10, pady=8, sticky="w")
        ctk.CTkEntry(settings, textvariable=self.wait_seconds, width=78).grid(row=0, column=5, padx=6, pady=8, sticky="w")
        ctk.CTkLabel(settings, text="timeout").grid(row=0, column=6, padx=10, pady=8, sticky="w")
        ctk.CTkEntry(settings, textvariable=self.timeout_seconds, width=78).grid(row=0, column=7, padx=6, pady=8, sticky="w")

        ctk.CTkCheckBox(settings, text="headless", variable=self.headless).grid(row=1, column=0, padx=10, pady=8, sticky="w")
        ctk.CTkCheckBox(settings, text="allintitle", variable=self.enable_allintitle).grid(row=1, column=1, padx=10, pady=8, sticky="w")
        ctk.CTkCheckBox(settings, text="intitle", variable=self.enable_intitle).grid(row=1, column=2, padx=10, pady=8, sticky="w")
        ctk.CTkCheckBox(settings, text="ドメイン分類", variable=self.enable_domain_check).grid(row=1, column=3, padx=10, pady=8, sticky="w")
        ctk.CTkLabel(settings, text="判定 allintitle").grid(row=1, column=4, padx=10, pady=8, sticky="w")
        ctk.CTkEntry(settings, textvariable=self.aim_allintitle_limit, width=78).grid(row=1, column=5, padx=6, pady=8, sticky="w")
        ctk.CTkLabel(settings, text="判定 intitle").grid(row=1, column=6, padx=10, pady=8, sticky="w")
        ctk.CTkEntry(settings, textvariable=self.aim_intitle_limit, width=78).grid(row=1, column=7, padx=6, pady=8, sticky="w")
        ctk.CTkLabel(settings, text="候補数").grid(row=2, column=0, padx=10, pady=8, sticky="w")
        ctk.CTkEntry(settings, textvariable=self.discovery_max_keywords, width=78).grid(row=2, column=1, padx=6, pady=8, sticky="w")

        actions = ctk.CTkFrame(
            self,
            corner_radius=8,
            fg_color=self.colors["panel"],
            border_width=1,
            border_color=self.colors["border"],
        )
        actions.grid(row=3, column=0, sticky="ew", padx=20, pady=8)
        actions.grid_columnconfigure(6, weight=1)
        self.start_button = ctk.CTkButton(actions, text="開始", width=104, fg_color=self.colors["primary"], hover_color=self.colors["primary_hover"], command=self._start)
        self.start_button.grid(row=0, column=0, padx=10, pady=10)
        self.discovery_button = ctk.CTkButton(actions, text="探索テーマから調査", width=160, fg_color=self.colors["primary"], hover_color=self.colors["primary_hover"], command=lambda: self._start(auto_discover=True))
        self.discovery_button.grid(row=0, column=1, padx=10, pady=10)
        self.stop_button = ctk.CTkButton(actions, text="停止", width=96, state="disabled", fg_color=self.colors["danger"], hover_color=self.colors["danger_hover"], command=self._stop)
        self.stop_button.grid(row=0, column=2, padx=10, pady=10)
        ctk.CTkButton(actions, text="設定保存", width=110, fg_color=self.colors["secondary"], hover_color=self.colors["secondary_hover"], command=self._save_config).grid(row=0, column=3, padx=10, pady=10)
        ctk.CTkButton(actions, text="出力フォルダを開く", width=150, fg_color=self.colors["secondary"], hover_color=self.colors["secondary_hover"], command=self._open_output).grid(row=0, column=4, padx=10, pady=10)

        progress_frame = ctk.CTkFrame(actions, fg_color="transparent")
        progress_frame.grid(row=0, column=6, padx=10, pady=10, sticky="ew")
        progress_frame.grid_columnconfigure(1, weight=1)
        ctk.CTkLabel(progress_frame, textvariable=self.status, width=80, font=self.fonts["status"]).grid(row=0, column=0, padx=(0, 10))
        self.progress_bar = ctk.CTkProgressBar(progress_frame)
        self.progress_bar.configure(progress_color=self.colors["primary"], fg_color="#DFE7E5")
        self.progress_bar.set(0)
        self.progress_bar.grid(row=0, column=1, sticky="ew")
        ctk.CTkLabel(progress_frame, textvariable=self.progress_text, width=80, font=self.fonts["status"]).grid(row=0, column=2, padx=(10, 0))
        ctk.CTkLabel(progress_frame, textvariable=self.current_keyword, font=self.fonts["status"], text_color=self.colors["muted"]).grid(row=1, column=0, columnspan=3, sticky="w", pady=(6, 0))

        preview_frame = ctk.CTkFrame(
            self,
            corner_radius=8,
            fg_color=self.colors["panel"],
            border_width=1,
            border_color=self.colors["border"],
        )
        preview_frame.grid(row=4, column=0, sticky="nsew", padx=20, pady=8)
        preview_frame.grid_rowconfigure(0, weight=1)
        preview_frame.grid_columnconfigure(0, weight=1)

        columns = ("keyword", "volume", "aim", "allintitle", "intitle", "qa", "blog", "tk", "ig", "x", "strong", "score", "level")
        self._configure_tree_style()
        self.tree = ttk.Treeview(preview_frame, columns=columns, show="headings", height=8)
        headings = {
            "keyword": "keyword",
            "volume": "月間検索数",
            "aim": "判定",
            "allintitle": "allintitle",
            "intitle": "intitle",
            "qa": "Q&A位",
            "blog": "blog位",
            "tk": "TK位",
            "ig": "Insta位",
            "x": "X位",
            "strong": "strong",
            "score": "score",
            "level": "level",
        }
        widths = {"keyword": 260, "volume": 90, "aim": 110, "level": 130}
        for column in columns:
            self.tree.heading(column, text=headings[column])
            self.tree.column(column, width=widths.get(column, 86), anchor="w")
        self.tree.grid(row=0, column=0, sticky="nsew", padx=12, pady=12)

        log_frame = ctk.CTkFrame(
            self,
            corner_radius=8,
            fg_color=self.colors["panel"],
            border_width=1,
            border_color=self.colors["border"],
        )
        log_frame.grid(row=5, column=0, sticky="nsew", padx=20, pady=(8, 18))
        log_frame.grid_rowconfigure(0, weight=1)
        log_frame.grid_columnconfigure(0, weight=1)
        self.log_box = ctk.CTkTextbox(
            log_frame,
            height=150,
            fg_color=self.colors["panel_alt"],
            border_color=self.colors["border"],
            border_width=1,
        )
        self.log_box.grid(row=0, column=0, sticky="nsew", padx=12, pady=12)

    def _draw_header(self, event=None) -> None:
        canvas = self.header_canvas
        width = max(canvas.winfo_width(), 1)
        height = max(canvas.winfo_height(), 1)
        canvas.delete("all")

        start = _hex_to_rgb(self.colors["header_start"])
        mid = _hex_to_rgb(self.colors["header_mid"])
        end = _hex_to_rgb(self.colors["header_end"])
        for x in range(width):
            ratio = x / max(width - 1, 1)
            if ratio < 0.58:
                color = _mix_rgb(start, mid, ratio / 0.58)
            else:
                color = _mix_rgb(mid, end, (ratio - 0.58) / 0.42)
            canvas.create_line(x, 0, x, height, fill=_rgb_to_hex(color))

        canvas.create_rectangle(0, height - 1, width, height, fill="#064E3B", outline="")
        canvas.create_text(
            24,
            22,
            anchor="nw",
            text="Keyword Treasure Finder",
            fill="#FFFFFF",
            font=("Yu Gothic UI", 25, "bold"),
        )
        canvas.create_text(
            25,
            58,
            anchor="nw",
            text="Article Compass System style keyword research workspace",
            fill="#D9FBE8",
            font=("Yu Gothic UI", 12, "bold"),
        )
        canvas.create_text(
            width - 24,
            32,
            anchor="ne",
            text="TREASURE MODE",
            fill="#B7F7D6",
            font=("Yu Gothic UI", 11, "bold"),
        )

    def _polish_controls(self, widget) -> None:
        for child in widget.winfo_children():
            try:
                if isinstance(child, ctk.CTkButton):
                    child.configure(font=self.fonts["button"], height=36, corner_radius=7)
                    if child.cget("fg_color") == self.colors["secondary"]:
                        child.configure(text_color=self.colors["secondary_text"], border_width=1, border_color="#95CFC2")
                    else:
                        child.configure(text_color="#FFFFFF")
                elif isinstance(child, ctk.CTkSegmentedButton):
                    child.configure(
                        font=self.fonts["control"],
                        height=34,
                        corner_radius=7,
                        selected_color=self.colors["primary"],
                        selected_hover_color=self.colors["primary_hover"],
                        unselected_color=self.colors["soft"],
                        unselected_hover_color=self.colors["soft_strong"],
                        text_color=self.colors["secondary_text"],
                    )
                elif isinstance(child, ctk.CTkCheckBox):
                    child.configure(
                        font=self.fonts["control"],
                        text_color=self.colors["text"],
                        fg_color=self.colors["primary"],
                        hover_color=self.colors["primary_hover"],
                        border_color="#95CFC2",
                    )
                elif isinstance(child, ctk.CTkEntry):
                    child.configure(
                        font=self.fonts["entry"],
                        height=34,
                        corner_radius=7,
                        border_color="#CBD5DF",
                        fg_color="#FFFFFF",
                    )
                elif isinstance(child, ctk.CTkTextbox):
                    child.configure(font=self.fonts["log"], corner_radius=7, fg_color=self.colors["panel_alt"])
            except Exception:
                pass
            self._polish_controls(child)

    def _configure_tree_style(self) -> None:
        style = ttk.Style()
        style.theme_use("clam")
        style.configure(
            "Treeview",
            background="#FFFFFF",
            foreground=self.colors["text"],
            fieldbackground="#FFFFFF",
            rowheight=30,
            borderwidth=0,
            font=("Yu Gothic UI", 9),
        )
        style.configure(
            "Treeview.Heading",
            background="#0D7659",
            foreground="#FFFFFF",
            relief="flat",
            font=("Yu Gothic UI", 9, "bold"),
        )
        style.map(
            "Treeview",
            background=[("selected", "#C9EBD9")],
            foreground=[("selected", "#1F2933")],
        )
        style.map(
            "Treeview.Heading",
            background=[("active", "#20AD7F")],
        )

    def _choose_input(self) -> None:
        path = filedialog.askopenfilename(filetypes=[("Keyword files", "*.csv *.xlsx"), ("All files", "*.*")])
        if path:
            self.input_path.set(path)

    def _choose_output(self) -> None:
        path = filedialog.askdirectory()
        if path:
            self.output_dir.set(path)

    def _ensure_keyword_sheet(self) -> None:
        try:
            ensure_keyword_template(self.keyword_sheet_path)
        except Exception as exc:
            messagebox.showerror("キーワードシート作成エラー", str(exc))
            return
        self._append_log(f"固定キーワードシートを確認しました: {self.keyword_sheet_path}")

    def _open_keyword_sheet(self) -> None:
        self._ensure_keyword_sheet()
        if not self.keyword_sheet_path.exists():
            return
        self.input_path.set(str(self.keyword_sheet_path))
        self.keyword_sheet_mtime = self.keyword_sheet_path.stat().st_mtime
        self.watch_keyword_sheet = True
        self._append_log("Excelでキーワードを入力して保存すると、アプリを前面に戻します。")
        os.startfile(self.keyword_sheet_path)
        self.after(1000, self._watch_keyword_sheet_save)

    def _watch_keyword_sheet_save(self) -> None:
        if not self.watch_keyword_sheet or not self.keyword_sheet_path.exists():
            return
        current_mtime = self.keyword_sheet_path.stat().st_mtime
        if self.keyword_sheet_mtime is not None and current_mtime > self.keyword_sheet_mtime:
            self.keyword_sheet_mtime = current_mtime
            self.watch_keyword_sheet = False
            self.status.set("保存検知")
            self._append_log("キーワードシートの保存を検知しました。開始できます。")
            self.lift()
            self.attributes("-topmost", True)
            self.after(500, lambda: self.attributes("-topmost", False))
            self.focus_force()
            return
        self.after(1000, self._watch_keyword_sheet_save)

    def _start(self, auto_discover: bool = False) -> None:
        if self.worker and self.worker.is_alive():
            return
        try:
            config = self._config_from_form()
        except ValueError as exc:
            messagebox.showerror("設定エラー", str(exc))
            return

        raw_input_path = self.input_path.get().strip()
        try:
            theme_path = self._create_theme_input_file() if auto_discover and self.discovery_theme.get().strip() else None
        except ValueError as exc:
            messagebox.showerror("探索テーマエラー", str(exc))
            return
        input_path = theme_path or (Path(raw_input_path) if raw_input_path else self.keyword_sheet_path)
        if not raw_input_path:
            self.input_path.set(str(input_path))
            self._ensure_keyword_sheet()
        if not input_path.exists():
            messagebox.showerror("入力エラー", "入力ファイルを選択してください。")
            return
        if input_path == self.keyword_sheet_path:
            self._append_log("固定キーワードシートから読み込みます。Excelで編集中の場合は保存後の内容だけ反映されます。")

        self.tree.delete(*self.tree.get_children())
        self.log_box.delete("1.0", "end")
        self.stop_event.clear()
        self.start_button.configure(state="disabled")
        self.discovery_button.configure(state="disabled")
        self.stop_button.configure(state="normal")
        self.status.set("候補取得中" if auto_discover else "処理中")
        self.progress_bar.set(0)

        self.worker = threading.Thread(
            target=self._run_worker,
            args=(input_path, Path(self.output_dir.get()), config, auto_discover),
            daemon=True,
        )
        self.worker.start()

    def _create_theme_input_file(self) -> Path:
        values = [
            line.strip()
            for line in self.discovery_theme.get().replace(",", "\n").splitlines()
            if line.strip()
        ]
        if not values:
            raise ValueError("探索テーマを入力してください。")
        keywords = [KeywordInput(keyword=value) for value in values]
        path = self.app_root / "work" / f"theme_keywords_{int(time.time())}.csv"
        write_keyword_inputs(keywords, path)
        self._append_log(f"探索テーマから候補取得を開始します: {', '.join(values[:5])}")
        return path

    def _run_worker(self, input_path: Path, output_dir: Path, config: AppConfig, auto_discover: bool = False) -> None:
        try:
            runner = run_discovery_research if auto_discover else run_research
            result = runner(
                input_path,
                output_dir,
                config,
                self.app_root,
                stop_event=self.stop_event,
                progress_callback=lambda done, total, keyword, status: self.events.put(("progress", (done, total, keyword, status))),
                result_callback=lambda item: self.events.put(("result", item)),
                log_callback=lambda message: self.events.put(("log", message)),
            )
            self.events.put(("done", result))
        except Exception as exc:
            self.events.put(("error", exc))

    def _stop(self) -> None:
        self.stop_event.set()
        self.status.set("停止中")
        self._append_log("停止要求を送信しました。現在の検索が終わり次第停止します。")

    def _drain_events(self) -> None:
        while True:
            try:
                kind, payload = self.events.get_nowait()
            except queue.Empty:
                break
            if kind == "progress":
                done, total, keyword, status = payload
                self._update_progress(done, total, keyword, status)
            elif kind == "result":
                self._add_result(payload)
            elif kind == "log":
                self._append_log(str(payload))
            elif kind == "done":
                if payload.xlsx_path:
                    self._append_log(f"Excel result saved: {payload.xlsx_path}")
                if payload.error_message:
                    self._append_log(f"Partial results saved after error: {payload.error_message}")
                    self._finish("Partial saved")
                    return
                if payload.stopped:
                    self._finish("停止")
                    return
                if payload.xlsx_path:
                    self._append_log(f"Excel結果を保存しました: {payload.xlsx_path}")
                self._finish("完了")
                self.after(1200, self.destroy)
            elif kind == "error":
                self._finish("エラー")
                messagebox.showerror("実行エラー", str(payload))
                self._append_log(f"ERROR: {payload}")
        self.after(100, self._drain_events)

    def _update_progress(self, done: int, total: int, keyword: str, status: str) -> None:
        ratio = 0 if total == 0 else done / total
        self.progress_bar.set(ratio)
        self.progress_text.set(f"{done} / {total}")
        self.current_keyword.set(keyword or "-")
        self.status.set(status)

    def _add_result(self, result: KeywordResult) -> None:
        self.tree.insert(
            "",
            "end",
            values=(
                result.keyword,
                result.monthly_search_volume or "",
                result.aim,
                result.allintitle_count,
                result.intitle_count,
                result.qa_site_rank or "",
                result.free_blog_rank or "",
                result.tiktok_rank or "",
                result.instagram_rank or "",
                result.x_rank or "",
                result.strong_domain_count,
                result.opportunity_score,
                result.opportunity_level,
            ),
        )

    def _append_log(self, message: str) -> None:
        self.log_box.insert("end", message + "\n")
        self.log_box.see("end")

    def _finish(self, status: str) -> None:
        self.status.set(status)
        self.start_button.configure(state="normal")
        self.discovery_button.configure(state="normal")
        self.stop_button.configure(state="disabled")

    def _open_output(self) -> None:
        path = Path(self.output_dir.get())
        path.mkdir(parents=True, exist_ok=True)
        os.startfile(path)

    def _config_from_form(self) -> AppConfig:
        max_results = int(self.max_results.get())
        wait_seconds = float(self.wait_seconds.get())
        timeout_seconds = int(self.timeout_seconds.get())
        discovery_max_keywords = int(self.discovery_max_keywords.get())
        aim_allintitle_limit = int(self.aim_allintitle_limit.get())
        aim_intitle_limit = int(self.aim_intitle_limit.get())
        if max_results < 1:
            raise ValueError("上位件数は1以上にしてください。")
        if wait_seconds < 0:
            raise ValueError("待機秒数は0以上にしてください。")
        if timeout_seconds < 1:
            raise ValueError("timeoutは1以上にしてください。")
        if discovery_max_keywords < 1:
            raise ValueError("候補数は1以上にしてください。")
        if aim_allintitle_limit < 0 or aim_intitle_limit < 0:
            raise ValueError("ねらい目判定のしきい値は0以上にしてください。")
        return AppConfig(
            search_engine="yahoo",
            search_mode=self.search_mode.get(),
            max_results=max_results,
            wait_seconds=wait_seconds,
            timeout_seconds=timeout_seconds,
            discovery_max_keywords=discovery_max_keywords,
            headless=self.headless.get(),
            output_format="xlsx",
            enable_allintitle=self.enable_allintitle.get(),
            enable_intitle=self.enable_intitle.get(),
            enable_domain_check=self.enable_domain_check.get(),
            aim_allintitle_limit=aim_allintitle_limit,
            aim_intitle_limit=aim_intitle_limit,
        )

    def _save_config(self) -> None:
        try:
            config = self._config_from_form()
        except ValueError as exc:
            messagebox.showerror("設定エラー", str(exc))
            return
        self.config_path.write_text(
            json.dumps(asdict(config), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        self._append_log("設定を保存しました。")

    def _load_config(self) -> AppConfig:
        if not self.config_path.exists():
            return AppConfig()
        with self.config_path.open("r", encoding="utf-8") as file:
            return AppConfig.from_dict(json.load(file))


def launch_gui(app_root: Path) -> None:
    app = KeywordTreasureApp(app_root)
    app.mainloop()


def _normalize_app_root(app_root: Path) -> Path:
    app_root = Path(app_root).resolve()
    if app_root.is_file() or app_root.suffix.lower() == ".exe":
        return app_root.parent
    return app_root


def _hex_to_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16)


def _rgb_to_hex(value: tuple[int, int, int]) -> str:
    return f"#{value[0]:02x}{value[1]:02x}{value[2]:02x}"


def _mix_rgb(start: tuple[int, int, int], end: tuple[int, int, int], ratio: float) -> tuple[int, int, int]:
    ratio = max(0.0, min(1.0, ratio))
    return tuple(round(start[index] + (end[index] - start[index]) * ratio) for index in range(3))
