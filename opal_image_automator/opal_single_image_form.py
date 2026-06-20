from __future__ import annotations

import ctypes
import html
import json
import socket
import threading
import time
import webbrowser
from dataclasses import dataclass, asdict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs

from selenium import webdriver
from selenium.common.exceptions import WebDriverException
from selenium.webdriver import ActionChains
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait


APP_VERSION = "2026-06-20-single-006"
HOST = "127.0.0.1"
BASE_DIR = Path(__file__).resolve().parent
CONFIG_PATH = BASE_DIR / "opal_single_image_config.json"
STYLE_PATH = BASE_DIR / "opal_single_image_style.txt"


@dataclass
class AppConfig:
    target_tool: str = "chatgpt"
    chatgpt_url: str = "https://chatgpt.com/"
    chrome_profile_dir: str = "chrome_profile"
    wait_seconds: int = 50
    batch_pause_seconds: int = 12

    @classmethod
    def load(cls) -> "AppConfig":
        if CONFIG_PATH.exists():
            try:
                data = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
                return cls(**{**asdict(cls()), **data})
            except Exception:
                pass
        return cls()

    def save(self) -> None:
        CONFIG_PATH.write_text(
            json.dumps(asdict(self), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def target_url(self) -> str:
        return self.chatgpt_url or "https://chatgpt.com/"


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


def build_single_prompt(title: str, body: str, style: str, image_type: str, target_tool: str = "chatgpt") -> str:
    image_type = (image_type or "EYECATCH").strip() or "EYECATCH"
    style = (style or "").strip()
    title = (title or "").strip()
    body = (body or "").strip()

    default_style = (
        "明るく読みやすいブログ用の図解イラスト。余白を広めに取り、情報を整理した構図。"
        "グリーンと白を基調に、アクセントカラーを少し使う。文字は必要最小限。"
    )
    if image_type.upper() == "EYECATCH":
        image_role = "記事全体を代表するアイキャッチ画像。読者がクリックしたくなる印象を重視する。"
    else:
        image_role = "対象H2の理解を助ける本文中の図解画像。比較、手順、原因と対策、判断基準を見やすく整理する。"

    return "\n".join(
        [
            "以下の記事内容をもとに、ブログ記事用の画像を1枚だけ生成してください。",
            "説明文だけで終わらず、必ず画像生成まで進めてください。",
            "複数案を並べた一覧画像は禁止です。1枚の完成画像として生成してください。",
            "同じ記事内の他画像と同じ構図は禁止です。画像タイプごとに構図、モチーフ、情報整理の見せ方を変えてください。",
            "",
            f"画像タイプ: {image_type}",
            f"画像の役割: {image_role}",
            f"記事タイトル: {title or '未指定'}",
            "",
            "本文・対象セクション:",
            normalize_text(body, 7000) or "本文未指定",
            "",
            "生成ルール:",
            "- 横長16:9",
            "- WordPress記事で使いやすい、明るく読みやすい図解・イラスト調",
            "- 写実写真ではなく、情報が伝わる整理されたビジュアルを優先",
            "- 画像内テキストは短い日本語だけ。細かい文章や長文は入れない",
            "- 人物を描く場合は自然な一般人風にし、実在人物や有名人にしない",
            "- ロゴ、企業名、ブランド名、実在商品のパッケージを正確に描かない",
            "- 余白を十分に取り、スマホでも意味が伝わる構図にする",
            "- 比較・手順・原因と対策・判断基準は、文章ではなく図解として理解できる構図にする",
            "- EYECATCHは記事全体の価値が一目で伝わる構図にする",
            "- H2画像は対象見出しの論点だけに絞り、アイキャッチとは別構図にする",
            "",
            "画風指定:",
            style or default_style,
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


def find_prompt_input(driver: webdriver.Chrome):
    selectors = [
        "textarea[data-testid='prompt-textarea']",
        "[data-testid='prompt-textarea']",
        "#prompt-textarea",
        "textarea[name='request']",
        "textarea[placeholder*='message']",
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
    last_error = None
    while time.time() < deadline:
        element = find_prompt_input(driver)
        if element:
            try:
                element.click()
                time.sleep(0.2)
                set_windows_clipboard(prompt)
                ActionChains(driver).key_down(Keys.CONTROL).send_keys("v").key_up(Keys.CONTROL).perform()
                time.sleep(0.6)
                return True
            except Exception as exc:
                last_error = exc
        time.sleep(0.8)
    try:
        set_windows_clipboard(prompt)
    except Exception as exc:
        last_error = exc
    if last_error:
        print(f"貼り付け準備で失敗しました: {last_error}", flush=True)
    return False


def send_prompt(driver: webdriver.Chrome) -> bool:
    selectors = [
        "button[data-testid='send-button']",
        "button[aria-label='Send prompt']",
        "button[aria-label='Send message']",
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
    if click_by_text(driver, ["send", "submit", "run", "generate", "create", "送信", "生成", "作成"]):
        return True
    try:
        ActionChains(driver).key_down(Keys.CONTROL).send_keys(Keys.ENTER).key_up(Keys.CONTROL).perform()
        time.sleep(0.5)
        return True
    except Exception:
        return False


def open_target_tool(config: AppConfig, log) -> webdriver.Chrome:
    target_url = config.target_url()
    log("Chromeを起動します。")
    driver = launch_chrome(BASE_DIR / config.chrome_profile_dir)
    wait = WebDriverWait(driver, config.wait_seconds)

    log(f"ChatGPTを開きます: {target_url}")
    driver.get(target_url)
    wait.until(lambda d: d.execute_script("return document.readyState") in ("interactive", "complete"))
    time.sleep(2.0)

    if "accounts.google" in driver.current_url or "signin" in driver.current_url or "auth" in driver.current_url:
        log("ログイン画面です。Chrome側でログイン後、もう一度パネルから送信してください。")
    return driver


def send_one_image_prompt(driver: webdriver.Chrome, prompt: str, log) -> bool:
    if not paste_prompt(driver, prompt, 16):
        log("ChatGPTの入力欄へ自動貼り付けできませんでした。プロンプトはクリップボードに入っています。")
        return False
    if send_prompt(driver):
        log("画像生成プロンプトを送信しました。生成結果はChrome画面で確認してください。")
        return True
    log("送信ボタンを押せませんでした。プロンプトは貼り付け済みです。Chrome画面で送信してください。")
    return False


def run_single_image(title: str, body: str, style: str, image_type: str, log) -> bool:
    config = AppConfig.load()
    driver = open_target_tool(config, log)
    prompt = build_single_prompt(title, body, style, image_type, config.target_tool)
    return send_one_image_prompt(driver, prompt, log)


def run_image_batch(items: list[dict], style: str, log) -> int:
    config = AppConfig.load()
    driver = open_target_tool(config, log)
    sent = 0
    for index, item in enumerate(items, start=1):
        title = str(item.get("title") or "")
        body = str(item.get("body") or "")
        image_type = str(item.get("imageType") or item.get("image_type") or f"H2-{index:02d}")
        prompt = build_single_prompt(title, body, style, image_type, config.target_tool)
        log(f"{index}/{len(items)}件目を送信します: {image_type}")
        if send_one_image_prompt(driver, prompt, log):
            sent += 1
        time.sleep(max(3, int(config.batch_pause_seconds or 12)))
    log(f"送信完了: {sent}/{len(items)}件")
    return sent


def render_page(message: str = "", details: str = "", port: int | None = None) -> bytes:
    config = AppConfig.load()
    style_value = html.escape(read_style())
    message_html = f"<div class='notice'>{html.escape(message)}</div>" if message else ""
    details_html = f"<div class='details'>{html.escape(details).replace(chr(10), '<br>')}</div>" if details else ""
    return f"""<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ChatGPT画像生成フォーム</title>
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
.badge {{ display:inline-flex; align-items:center; border:1px solid #9bd7b7; border-radius:999px; padding:8px 14px; background:#e3f6eb; color:#0c5d37; font-weight:700; margin-top:14px; }}
button {{ border:0; border-radius:999px; background:#16834f; color:#fff; font-weight:700; padding:13px 26px; cursor:pointer; font-size:16px; }}
button:hover {{ background:#0f6f41; }}
.hint, .version {{ color:#6b8278; font-size:13px; }}
.notice {{ background:#e3f6eb; color:#0c5d37; border:1px solid #9bd7b7; border-radius:8px; padding:12px 14px; margin-bottom:14px; font-weight:700; }}
.details {{ background:#fff8dc; color:#4b3b00; border:1px solid #ead27b; border-radius:8px; padding:12px 14px; margin-bottom:14px; line-height:1.7; }}
</style>
</head>
<body>
<div class="wrap">
  <h1>ChatGPT画像生成フォーム</h1>
  <div class="sub">タイトル・本文・画風を入れて、ChatGPTへ画像生成リクエストを1枚ずつ送ります。</div>
  <div class="version">version: {APP_VERSION}{' / port: ' + str(port) if port else ''}</div>
  <div class="panel">
    {message_html}
    {details_html}
    <form method="post" action="/send" onsubmit="document.getElementById('send').disabled=true;document.getElementById('send').textContent='送信中...';">
      <div class="badge">送信先: ChatGPT</div>

      <label for="chatgpt_url">ChatGPT URL</label>
      <input id="chatgpt_url" name="chatgpt_url" value="{html.escape(config.chatgpt_url)}">

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

      <p class="hint">ChatGPT Webへ送ります。初回だけ専用Chromeでログインが必要になることがあります。</p>
      <button id="send" type="submit">ChatGPTへ画像生成</button>
    </form>
  </div>
</div>
</body>
</html>""".encode("utf-8")


class Handler(BaseHTTPRequestHandler):
    server_port: int | None = None

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
            self.send_json({"ok": True, "version": APP_VERSION, "tool": "chatgpt"})
            return
        self.respond(render_page(port=self.server_port))

    def do_POST(self) -> None:
        if self.path.startswith("/api/send"):
            self.handle_api_send()
            return
        if self.path.startswith("/send"):
            self.handle_form_send()
            return
        self.send_json({"ok": False, "message": "未対応のパスです。"})

    def read_post_body(self) -> bytes:
        length = int(self.headers.get("Content-Length", "0") or "0")
        return self.rfile.read(length)

    def parse_form(self) -> dict[str, str]:
        raw = self.read_post_body().decode("utf-8", errors="replace")
        parsed = parse_qs(raw, keep_blank_values=True)
        return {key: (values[0] if values else "") for key, values in parsed.items()}

    def queue_send(self, values: dict) -> dict:
        title = str(values.get("title") or "").strip()
        body = str(values.get("body") or "").strip()
        style = str(values.get("style") or "").strip()
        image_type = str(values.get("image_type") or values.get("imageType") or "EYECATCH").strip()
        items = values.get("items") if isinstance(values.get("items"), list) else []
        chatgpt_url = str(values.get("chatgpt_url") or "").strip()

        if not items and not title and not body:
            return {"ok": False, "message": "タイトルまたは本文を入力してください。"}

        if style:
            write_style(style)

        config = AppConfig.load()
        config.target_tool = "chatgpt"
        if chatgpt_url:
            config.chatgpt_url = chatgpt_url
        config.save()

        def worker() -> None:
            def log(message: str) -> None:
                print(message, flush=True)

            try:
                if items:
                    run_image_batch(items, style, log)
                else:
                    run_single_image(title, body, style, image_type, log)
            except WebDriverException as exc:
                print(f"ブラウザ操作で失敗しました: {exc.__class__.__name__}", flush=True)
            except Exception as exc:
                print(f"処理に失敗しました: {exc}", flush=True)

        threading.Thread(target=worker, daemon=True).start()
        count = len(items) if items else 1
        return {
            "ok": True,
            "message": f"{count}件の画像生成リクエストを順番に送ります。Chromeで生成結果を確認してください。",
            "version": APP_VERSION,
            "mode": "single",
        }

    def handle_api_send(self) -> None:
        try:
            values = json.loads(self.read_post_body().decode("utf-8"))
        except Exception as exc:
            self.send_json({"ok": False, "message": f"JSONを読めませんでした: {exc}"})
            return
        self.send_json(self.queue_send(values))

    def handle_form_send(self) -> None:
        values = self.parse_form()
        result = self.queue_send(values)
        self.respond(
            render_page(
                message=str(result.get("message") or ""),
                details="" if result.get("ok") else "入力内容を確認してください。",
                port=self.server_port,
            )
        )

    def respond(self, body: bytes) -> None:
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
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
    print(f"ChatGPT画像生成フォームを開きます: {url}", flush=True)
    print("この黒い画面はフォーム用サーバーです。作業が終わったら閉じて大丈夫です。", flush=True)
    webbrowser.open_new(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        return 0
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
