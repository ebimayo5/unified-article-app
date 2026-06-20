from __future__ import annotations

import ctypes
import html
import json
import socket
import threading
import time
import webbrowser
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs

from selenium import webdriver
from selenium.common.exceptions import WebDriverException
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait


HOST = "127.0.0.1"
APP_VERSION = "2026-06-20-single-002"
ROOT = Path(__file__).resolve().parent
CONFIG_PATH = ROOT / "opal_single_image_config.json"
STYLE_PATH = ROOT / "style_instruction.txt"

DEFAULT_OPAL_URL = "https://opal.google/edit/1x59-WBuo5-AIygPJMIXq-A8-QogKaA3w"
DEFAULT_WHISK_URL = "https://labs.google/fx/tools/whisk"


@dataclass
class AppConfig:
    target_tool: str = "opal"
    opal_url: str = DEFAULT_OPAL_URL
    whisk_url: str = DEFAULT_WHISK_URL
    chrome_profile_dir: str = str(ROOT / "chrome_profile")
    wait_seconds: int = 50

    @classmethod
    def load(cls) -> "AppConfig":
        if not CONFIG_PATH.exists():
            return cls()
        try:
            data = json.loads(CONFIG_PATH.read_text(encoding="utf-8-sig"))
        except Exception:
            return cls()

        profile_dir = str(data.get("chrome_profile_dir") or cls.chrome_profile_dir)
        if not Path(profile_dir).is_absolute():
            profile_dir = str(ROOT / profile_dir)

        return cls(
            target_tool=str(data.get("target_tool") or data.get("targetTool") or "opal"),
            opal_url=str(data.get("opal_url") or data.get("target_url") or DEFAULT_OPAL_URL),
            whisk_url=str(data.get("whisk_url") or DEFAULT_WHISK_URL),
            chrome_profile_dir=profile_dir,
            wait_seconds=int(data.get("wait_seconds") or 50),
        )

    def target_url(self) -> str:
        return self.whisk_url if self.target_tool == "whisk" else self.opal_url

    def save(self) -> None:
        CONFIG_PATH.write_text(
            json.dumps(
                {
                    "target_tool": self.target_tool,
                    "opal_url": self.opal_url,
                    "whisk_url": self.whisk_url,
                    "chrome_profile_dir": self.chrome_profile_dir,
                    "wait_seconds": self.wait_seconds,
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )


def read_style() -> str:
    if not STYLE_PATH.exists():
        return ""
    try:
        return STYLE_PATH.read_text(encoding="utf-8-sig").strip()
    except Exception:
        return ""


def write_style(value: str) -> None:
    STYLE_PATH.write_text(value.strip(), encoding="utf-8")


def set_windows_clipboard(text: str) -> None:
    user32 = ctypes.windll.user32
    kernel32 = ctypes.windll.kernel32
    cf_unicode_text = 13
    gmem_moveable = 0x0002

    user32.OpenClipboard.argtypes = [ctypes.c_void_p]
    user32.OpenClipboard.restype = ctypes.c_bool
    user32.EmptyClipboard.argtypes = []
    user32.EmptyClipboard.restype = ctypes.c_bool
    user32.SetClipboardData.argtypes = [ctypes.c_uint, ctypes.c_void_p]
    user32.SetClipboardData.restype = ctypes.c_void_p
    user32.CloseClipboard.argtypes = []
    user32.CloseClipboard.restype = ctypes.c_bool
    kernel32.GlobalAlloc.argtypes = [ctypes.c_uint, ctypes.c_size_t]
    kernel32.GlobalAlloc.restype = ctypes.c_void_p
    kernel32.GlobalLock.argtypes = [ctypes.c_void_p]
    kernel32.GlobalLock.restype = ctypes.c_void_p
    kernel32.GlobalUnlock.argtypes = [ctypes.c_void_p]
    kernel32.GlobalUnlock.restype = ctypes.c_bool
    kernel32.GlobalFree.argtypes = [ctypes.c_void_p]
    kernel32.GlobalFree.restype = ctypes.c_void_p

    data = (text + "\0").encode("utf-16-le")
    opened = False
    for _ in range(15):
        if user32.OpenClipboard(None):
            opened = True
            break
        time.sleep(0.1)
    if not opened:
        raise RuntimeError("クリップボードを開けませんでした。")

    handle = None
    try:
        user32.EmptyClipboard()
        handle = kernel32.GlobalAlloc(gmem_moveable, len(data))
        if not handle:
            raise RuntimeError("クリップボード用メモリを確保できませんでした。")
        pointer = kernel32.GlobalLock(handle)
        if not pointer:
            raise RuntimeError("クリップボード用メモリをロックできませんでした。")
        try:
            ctypes.memmove(pointer, data, len(data))
        finally:
            kernel32.GlobalUnlock(handle)
        if not user32.SetClipboardData(cf_unicode_text, handle):
            raise RuntimeError("クリップボードへ書き込めませんでした。")
        handle = None
    finally:
        user32.CloseClipboard()
        if handle:
            kernel32.GlobalFree(handle)


def find_free_port(start: int = 8765, end: int = 8799) -> int:
    for port in range(start, end + 1):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            try:
                sock.bind((HOST, port))
            except OSError:
                continue
            return port
    raise RuntimeError("空いているローカルポートが見つかりません。")


def normalize_text(value: str, limit: int) -> str:
    text = " ".join((value or "").replace("\r", "\n").split())
    return text[:limit]


def build_single_prompt(title: str, body: str, style: str, image_type: str, target_tool: str) -> str:
    image_type = (image_type or "EYECATCH").strip() or "EYECATCH"
    style = (style or "").strip()
    title = (title or "").strip()
    body = (body or "").strip()

    body_limit = 2400 if target_tool == "whisk" else 7000
    tool_note = (
        "Whisk向け: 長文記事をそのまま絵にせず、主題・場面・読者の理解ポイントを1つのビジュアルに要約する。"
        if target_tool == "whisk"
        else "Opal向け: 1枚だけ生成する。複数枚、候補一覧、同じ構図の量産は禁止。"
    )

    return "\n".join(
        [
            "ブログ記事用の画像を1枚だけ生成してください。",
            "複数枚生成、候補一覧、同じ構図の量産は禁止です。",
            tool_note,
            "",
            f"画像タイプ: {image_type}",
            f"記事タイトル: {title or '未指定'}",
            "",
            "本文要約材料:",
            normalize_text(body, body_limit) or "本文未指定",
            "",
            "画像ルール:",
            "- 横長16:9",
            "- WordPress記事内で使いやすい、明るく見やすい図解/イラスト寄り",
            "- 文字を入れる場合は短い日本語だけ。細かい文章は入れない",
            "- アイキャッチなら記事全体の価値が一目で伝わる構図",
            "- H2画像なら対象見出しの理解を助ける構図",
            "- 写実よりも、情報が伝わる整理されたビジュアルを優先",
            "- 画像内に小さく画像タイプのラベルを入れる場合は右下に控えめにする",
            "",
            "画風指定:",
            style or "ミニマルで読みやすいブログ図解。淡い背景、余白多め、落ち着いた配色。",
        ]
    ).strip()


def launch_chrome(profile_dir: Path) -> webdriver.Chrome:
    profile_dir.mkdir(parents=True, exist_ok=True)
    options = Options()
    options.add_argument(f"--user-data-dir={profile_dir}")
    options.add_argument("--profile-directory=Default")
    options.add_argument("--start-maximized")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)
    return webdriver.Chrome(options=options)


def body_text(driver: webdriver.Chrome) -> str:
    try:
        return driver.find_element(By.TAG_NAME, "body").text.lower()
    except Exception:
        return ""


def click_by_text(driver: webdriver.Chrome, labels: list[str]) -> bool:
    lowered = [label.lower() for label in labels if label]
    candidates = driver.find_elements(By.XPATH, "//button|//div[@role='button']|//span|//p")
    for element in candidates:
        try:
            text = (element.text or element.get_attribute("aria-label") or element.get_attribute("title") or "").strip()
            if not text:
                continue
            if any(label in text.lower() for label in lowered):
                driver.execute_script("arguments[0].scrollIntoView({block:'center'});", element)
                time.sleep(0.2)
                element.click()
                return True
        except Exception:
            continue
    return False


def win_click(x: int, y: int) -> None:
    user32 = ctypes.windll.user32
    user32.SetCursorPos.argtypes = [ctypes.c_int, ctypes.c_int]
    user32.SetCursorPos.restype = ctypes.c_bool
    user32.mouse_event.argtypes = [ctypes.c_uint, ctypes.c_uint, ctypes.c_uint, ctypes.c_uint, ctypes.c_void_p]
    user32.mouse_event.restype = None
    user32.SetCursorPos(int(x), int(y))
    time.sleep(0.1)
    user32.mouse_event(0x0002, 0, 0, 0, None)
    time.sleep(0.05)
    user32.mouse_event(0x0004, 0, 0, 0, None)


def win_ctrl_v() -> None:
    user32 = ctypes.windll.user32
    user32.keybd_event.argtypes = [ctypes.c_ubyte, ctypes.c_ubyte, ctypes.c_uint, ctypes.c_void_p]
    user32.keybd_event.restype = None
    keyup = 0x0002
    user32.keybd_event(0x11, 0, 0, None)
    time.sleep(0.05)
    user32.keybd_event(0x56, 0, 0, None)
    time.sleep(0.05)
    user32.keybd_event(0x56, 0, keyup, None)
    time.sleep(0.05)
    user32.keybd_event(0x11, 0, keyup, None)


def click_bottom_send(driver: webdriver.Chrome) -> bool:
    try:
        driver.switch_to.default_content()
        driver.maximize_window()
        time.sleep(0.3)
        rect = driver.get_window_rect()
        x = int(rect["x"] + rect["width"] * 0.81)
        y = int(rect["y"] + rect["height"] * 0.89)
        win_click(x, y)
        return True
    except Exception:
        return False


def click_center_input(driver: webdriver.Chrome) -> bool:
    try:
        driver.switch_to.default_content()
        driver.maximize_window()
        time.sleep(0.3)
        rect = driver.get_window_rect()
        x = int(rect["x"] + rect["width"] * 0.50)
        y = int(rect["y"] + rect["height"] * 0.82)
        win_click(x, y)
        return True
    except Exception:
        return False


def click_start_if_needed(driver: webdriver.Chrome, target_tool: str, wait_seconds: int) -> None:
    if target_tool != "opal":
        return
    deadline = time.time() + wait_seconds
    while time.time() < deadline:
        text = body_text(driver)
        if "type or upload your response" in text or "response" in text:
            return
        if click_by_text(driver, ["App"]):
            time.sleep(1.0)
        if click_by_text(driver, ["Start", "開始"]):
            time.sleep(2.0)
        else:
            time.sleep(0.8)


def find_prompt_input(driver: webdriver.Chrome):
    selectors = [
        "textarea[name='request']",
        "textarea[placeholder*='response']",
        "textarea[placeholder*='prompt']",
        "textarea",
        "[contenteditable='true']",
        "input[type='text']",
    ]
    for selector in selectors:
        for element in driver.find_elements(By.CSS_SELECTOR, selector):
            try:
                if element.is_displayed() and element.is_enabled():
                    return element
            except Exception:
                continue
    return None


def paste_prompt(driver: webdriver.Chrome, prompt: str, wait_seconds: int) -> bool:
    deadline = time.time() + wait_seconds
    while time.time() < deadline:
        element = find_prompt_input(driver)
        if element:
            try:
                element.click()
                time.sleep(0.2)
                set_windows_clipboard(prompt)
                ActionChains(driver).key_down(Keys.CONTROL).send_keys("v").key_up(Keys.CONTROL).perform()
                time.sleep(0.5)
                return True
            except Exception:
                pass
        time.sleep(0.8)

    set_windows_clipboard(prompt)
    if click_center_input(driver):
        time.sleep(0.3)
        win_ctrl_v()
        time.sleep(0.8)
        return True
    return False


def send_prompt(driver: webdriver.Chrome) -> bool:
    selectors = [
        "button[title='Submit']",
        "button[aria-label='Submit']",
        "button[type='submit']",
        "button[aria-label*='Send']",
        "button[aria-label*='送信']",
        "button[aria-label*='Generate']",
    ]
    for selector in selectors:
        for element in driver.find_elements(By.CSS_SELECTOR, selector):
            try:
                if element.is_displayed() and element.is_enabled():
                    element.click()
                    return True
            except Exception:
                continue
    if click_by_text(driver, ["send", "submit", "run", "generate", "create", "送信", "生成"]):
        return True
    try:
        ActionChains(driver).key_down(Keys.CONTROL).send_keys(Keys.ENTER).key_up(Keys.CONTROL).perform()
        time.sleep(0.5)
        return True
    except Exception:
        pass
    return click_bottom_send(driver)


def run_single_image(title: str, body: str, style: str, image_type: str, log) -> None:
    config = AppConfig.load()
    target_tool = config.target_tool if config.target_tool in ("opal", "whisk") else "opal"
    target_url = config.target_url()
    prompt = build_single_prompt(title, body, style, image_type, target_tool)
    set_windows_clipboard(prompt)

    log("Chromeを起動します。")
    driver = launch_chrome(Path(config.chrome_profile_dir))
    wait = WebDriverWait(driver, config.wait_seconds)

    log(f"{'Whisk' if target_tool == 'whisk' else 'Opal'}を開きます: {target_url}")
    driver.get(target_url)
    wait.until(lambda d: d.execute_script("return document.readyState") in ("interactive", "complete"))
    time.sleep(2.0)

    if "accounts.google" in driver.current_url or "signin" in driver.current_url:
        log("Googleログイン画面です。ログイン後、もう一度送信してください。")
        return

    click_start_if_needed(driver, target_tool, config.wait_seconds)
    pasted = paste_prompt(driver, prompt, 14)
    if not pasted:
        log("入力欄へ自動貼り付けできませんでした。プロンプトはクリップボードに入っています。")
        return

    if send_prompt(driver):
        log("1枚生成用プロンプトを送信しました。生成結果はブラウザ画面で確認してください。")
    else:
        log("送信ボタンを押せませんでした。プロンプトは貼り付け済みです。画面上で送信してください。")


def render_page(message: str = "", details: str = "", port: int | None = None) -> bytes:
    config = AppConfig.load()
    style_value = html.escape(read_style())
    opal_checked = "checked" if config.target_tool != "whisk" else ""
    whisk_checked = "checked" if config.target_tool == "whisk" else ""
    message_html = f"<div class='notice'>{html.escape(message)}</div>" if message else ""
    details_html = f"<div class='details'>{html.escape(details).replace(chr(10), '<br>')}</div>" if details else ""
    return f"""<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ブログ画像 1枚生成</title>
<style>
body {{ margin:0; background:#eef6f1; color:#14251d; font-family:"Yu Gothic UI","Meiryo",sans-serif; }}
.wrap {{ max-width:1040px; margin:0 auto; padding:24px; }}
h1 {{ margin:0; font-size:26px; }}
.sub {{ margin-top:6px; color:#557064; font-size:14px; }}
.panel {{ margin-top:18px; background:#fff; border:1px solid #cfe0d7; border-radius:10px; box-shadow:0 8px 30px rgba(20,58,40,.08); padding:20px; }}
label {{ display:block; font-weight:700; margin:16px 0 8px; }}
input, textarea, select {{ width:100%; box-sizing:border-box; border:1px solid #b9cec4; border-radius:8px; padding:12px; font:inherit; background:#fbfdfc; color:#14251d; }}
textarea {{ min-height:250px; resize:vertical; line-height:1.65; }}
textarea.style {{ min-height:110px; }}
.grid {{ display:grid; grid-template-columns:1fr 220px; gap:14px; }}
.tools {{ display:flex; gap:12px; flex-wrap:wrap; margin-top:8px; }}
.tool {{ display:flex; gap:8px; align-items:center; border:1px solid #cfe0d7; border-radius:999px; padding:9px 14px; background:#f7fbf8; }}
.tool input {{ width:auto; }}
button {{ border:0; border-radius:999px; background:#16834f; color:#fff; font-weight:700; padding:13px 26px; cursor:pointer; font-size:16px; }}
button:hover {{ background:#0f6f41; }}
.hint, .version {{ color:#6b8278; font-size:13px; }}
.notice {{ background:#e3f6eb; color:#0c5d37; border:1px solid #9bd7b7; border-radius:8px; padding:12px 14px; margin-bottom:14px; font-weight:700; }}
.details {{ background:#fff8dc; color:#4b3b00; border:1px solid #ead27b; border-radius:8px; padding:12px 14px; margin-bottom:14px; line-height:1.7; }}
</style>
</head>
<body>
<div class="wrap">
  <h1>ブログ画像 1枚生成</h1>
  <div class="sub">タイトル・本文・画風を入れて、画像生成ツールへ1枚分だけ送ります。</div>
  <div class="version">version: {APP_VERSION}{' / port: ' + str(port) if port else ''}</div>
  <div class="panel">
    {message_html}
    {details_html}
    <form method="post" action="/send" onsubmit="document.getElementById('send').disabled=true;document.getElementById('send').textContent='送信中...';">
      <label>送信先</label>
      <div class="tools">
        <label class="tool"><input type="radio" name="target_tool" value="opal" {opal_checked}>Opal</label>
        <label class="tool"><input type="radio" name="target_tool" value="whisk" {whisk_checked}>Whisk</label>
      </div>

      <label for="opal_url">Opal URL</label>
      <input id="opal_url" name="opal_url" value="{html.escape(config.opal_url)}">

      <label for="whisk_url">Whisk URL</label>
      <input id="whisk_url" name="whisk_url" value="{html.escape(config.whisk_url)}">

      <div class="grid">
        <div>
          <label for="title">タイトル</label>
          <input id="title" name="title" autocomplete="off" placeholder="記事タイトルを貼り付け">
        </div>
        <div>
          <label for="image_type">画像タイプ</label>
          <select id="image_type" name="image_type">
            <option value="EYECATCH">EYECATCH</option>
            <option value="H2-01">H2-01</option>
            <option value="H2-02">H2-02</option>
            <option value="H2-03">H2-03</option>
            <option value="CUSTOM">CUSTOM</option>
          </select>
        </div>
      </div>

      <label for="body">本文</label>
      <textarea id="body" name="body" placeholder="WordPress本文や対象H2周辺を貼り付け"></textarea>

      <label for="style">画風指定</label>
      <textarea id="style" name="style" class="style">{style_value}</textarea>

      <p class="hint">Whiskは画像リミックス寄りのツールなので、本文は短めに要約して送ります。Opalは接続未完了だと送信後に止まる場合があります。</p>
      <button id="send" type="submit">画像生成ツールへ送る</button>
    </form>
  </div>
</div>
</body>
</html>""".encode("utf-8")


class Handler(BaseHTTPRequestHandler):
    server_port = 0

    def cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.cors()
        self.end_headers()

    def do_GET(self) -> None:
        if self.path.startswith("/health"):
            self.send_json({"ok": True, "version": APP_VERSION, "mode": "single"})
            return
        self.respond(render_page(port=self.server_port))

    def do_POST(self) -> None:
        if self.path == "/api/send":
            self.handle_api_send()
            return
        if self.path != "/send":
            self.send_error(404)
            return
        values = self.read_form()
        result = self.queue_send(values)
        self.respond(render_page(result["message"], result.get("details", ""), port=self.server_port))

    def read_form(self) -> dict:
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length).decode("utf-8", errors="replace")
        values = parse_qs(raw)
        return {key: (values.get(key) or [""])[0].strip() for key in values}

    def handle_api_send(self) -> None:
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length).decode("utf-8", errors="replace")
        try:
            values = json.loads(raw or "{}")
        except Exception:
            self.send_json({"ok": False, "message": "JSONを読めませんでした。"})
            return
        result = self.queue_send(values)
        self.send_json(result)

    def queue_send(self, values: dict) -> dict:
        title = str(values.get("title") or "").strip()
        body = str(values.get("body") or "").strip()
        style = str(values.get("style") or "").strip() or read_style()
        image_type = str(values.get("imageType") or values.get("image_type") or "EYECATCH").strip() or "EYECATCH"
        target_tool = str(values.get("targetTool") or values.get("target_tool") or "").strip().lower()
        opal_url = str(values.get("opal_url") or "").strip()
        whisk_url = str(values.get("whisk_url") or "").strip()

        if not title and not body:
            return {"ok": False, "message": "タイトルか本文を入力してください。"}

        if style:
            write_style(style)

        config = AppConfig.load()
        if target_tool in ("opal", "whisk"):
            config.target_tool = target_tool
        if opal_url:
            config.opal_url = opal_url
        if whisk_url:
            config.whisk_url = whisk_url
        config.save()

        def worker() -> None:
            def log(message: str) -> None:
                print(message, flush=True)

            try:
                run_single_image(title, body, style, image_type, log)
            except WebDriverException as exc:
                print(f"ブラウザ操作で失敗しました: {exc.__class__.__name__}", flush=True)
            except Exception as exc:
                print(f"処理に失敗しました: {exc}", flush=True)

        threading.Thread(target=worker, daemon=True).start()
        return {
            "ok": True,
            "message": "1枚生成リクエストを送りました。Chromeで生成結果を確認してください。",
            "version": APP_VERSION,
            "mode": "single",
        }

    def respond(self, body: bytes) -> None:
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.cors()
        self.end_headers()
        self.wfile.write(body)

    def send_json(self, data: dict) -> None:
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.cors()
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args) -> None:
        return


def main() -> int:
    port = find_free_port()
    Handler.server_port = port
    server = ThreadingHTTPServer((HOST, port), Handler)
    url = f"http://{HOST}:{port}/"
    print(f"ブログ画像 1枚生成フォームを開きます: {url}", flush=True)
    print("この黒い画面はフォーム用サーバーです。作業が終わったら閉じて大丈夫です。", flush=True)
    webbrowser.open_new(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        return 0
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
