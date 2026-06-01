# 統合版記事作成アプリ

このフォルダは、DRIVE BASE / たくみパパ / 汎用記事を1つのApps Scriptに統合するための最新版です。

最新仕様は [`CURRENT_SPEC.md`](CURRENT_SPEC.md) を正とします。READMEは入口用の短いメモだけにし、列構成・運用手順・プロパティ一覧・プロンプト方針は `CURRENT_SPEC.md` を確認してください。

## 主要ファイル

- `config.gs`: シート名、列定義、記事タイプ、モデル設定
- `main.gs`: メニュー、パネル連携、シート整形、候補転記
- `prompt.gs`: 記事生成プロンプト
- `links.gs`: 内部リンク・外部出典候補
- `article.gs`: 本文生成、保存、HTML補正
- `api.gs`: Gemini / OpenAI / Claude API
- `reader_mind.gs`: 読者心理メモ取得
- `wordpress.gs`: WordPress下書き作成
- `web_app.gs`: Webアプリ・候補シート連携
- `app_panel.html`: パネルUI
- `ua_web_app.html`: WebアプリUI
- `utils.gs`: 共通ユーティリティ

## 注意

- 旧GASや過去チャットの仕様ではなく、このフォルダ内の `CURRENT_SPEC.md` を優先します。
- `汎用記事` はWordPress下書き作成と内部リンクの対象外です。
- 内部リンク候補は `DRIVE BASE` と `たくみパパ` のみで使います。
