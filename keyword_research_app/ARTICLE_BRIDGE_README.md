# 記事作成システム連携ブリッジ

記事作成システム側の「記事構成作成」から依頼されたキーワードを、ローカルPCのトレファイで検索し、上位URLをApps Scriptへ戻すための橋渡しです。

トレファイ本体のGUI/EXEの動きは変更しません。別ファイル `article_bridge.py` を起動している間だけ、記事作成システムからの依頼を処理します。

## 事前設定

Apps Scriptのスクリプトプロパティに次を設定します。

- `UA_LOCAL_IMPORT_TOKEN`: 任意の長い文字列
- `UA_TREFAI_BRIDGE_ENABLED`: `true`

`UA_TREFAI_BRIDGE_ENABLED` を `true` にすると、記事作成システムの「記事構成作成」は、競合URL欄が3件未満のときにトレファイへ上位URL取得を依頼します。`false` または未設定なら従来のGAS検索に戻ります。

## 初回起動

```powershell
cd C:\Users\ebima\Documents\Codex\2026-06-14\files-mentioned-by-the-user-codex\outputs\keyword_research_app
python article_bridge.py --once
```

初回は `article_bridge_config.json` が作成されます。中の次の2項目を入れてください。

- `web_app_url`: 統合版Apps ScriptのWebアプリURL
- `token`: `UA_LOCAL_IMPORT_TOKEN` と同じ値

## EXEで使う場合

次のファイルを起動します。

```text
dist\ArticleBridge.exe
```

`dist\article_bridge_config.json` の `token` に、Apps Scriptの `UA_LOCAL_IMPORT_TOKEN` と同じ値を入れてください。

## Pythonで使う場合

通常は次をダブルクリックします。

```text
run_article_bridge.bat
```

常駐させる場合:

```powershell
python article_bridge.py
```

1件だけ処理して終了する場合:

```powershell
python article_bridge.py --once
```

## 処理の流れ

1. 記事作成システムで記事行を読み込む
2. 「記事構成作成」を押す
3. Apps Scriptが `トレファイ連携` シートへ依頼を作る
4. `article_bridge.py` が依頼を取得する
5. 既存の `SearchCrawler` でYahoo検索の上位URLを取得する
6. Apps ScriptへURLを返す
7. Apps Scriptが競合URL欄へ保存し、構成メモを作成する

## 注意

- GASはGoogle側で動くため、GASだけではローカルPCのEXEやChromeを直接起動できません。
- そのため、ローカルPC側で `article_bridge.py` を起動しておく必要があります。
- トレファイ本体のキーワード調査機能とは分離しています。
