# Codexへの依頼: `clasp run` を使えるようにする（GCPプロジェクト紐付け）

## 背景・目的

このリポジトリのApps Scriptプロジェクト（"統合版アプリ用"、scriptId
`1OIzsyQgzT9dDNeUvytDNIXgtOgTXrXJomlhhNFtNbFyhmkf7KZ0jBMa7`）は、GCPの
「デフォルトプロジェクト」のままで、標準のGCPプロジェクトに紐付けられていない。
そのため `clasp run <関数名>` を実行すると以下のエラーになる。

```
Exception: We're sorry, a server error occurred while reading from storage. Error code NOT_FOUND. []
```

このセッションでは、一回限りの調査・修正用関数（`uaXxx20260901` のような命名のもの）を
本番スプレッドシート上で実行する必要が頻繁に発生するが、`clasp run` が使えないため、
毎回ユーザーがApps Scriptエディタを開いて手動で「関数を選択→実行→ログを見る→
Claude Codeに貼る」という手順を踏んでいる。これが直れば、Claude CodeもCodexも
コマンドラインから直接関数を実行でき、この往復が不要になる。

## 制約（最初に確認すること）

GCPプロジェクトをApps Scriptプロジェクトに紐付ける操作自体は、現状の理解では
**Apps Scriptエディタのブラウザ画面（script.google.com、ユーザーのGoogleアカウントで
ログイン済み）でしか設定できない**。CLIやAPI経由でこの紐付け自体を行う方法は無いはず。

なので、Codexの実行環境にブラウザ操作の手段（ユーザーの認証済みブラウザセッションを
操作できる、など）が無い場合、最後の紐付けステップは実行できない可能性が高い。
その場合は無理に回避策を探さず、「ここまでは自動化できたが、最後のステップは
ユーザーの手動操作が必要」という形で早めに報告してほしい。

## 試してほしい手順

1. **前提確認**: `gcloud auth list` 等で、ユーザーのGoogleアカウント（このArticle
   Compass Systemを所有しているアカウント）で認証済みのgcloud CLIが使えるか確認する。
   使えない・認証できない場合はここで一旦報告して止まってよい。

2. **GCPプロジェクトの用意**: 新規に作成するか、既存の適切なプロジェクトを使う。
   新規作成する場合の例:
   ```
   gcloud projects create article-compass-clasp --name="Article Compass Clasp"
   ```

3. **Apps Script APIを有効化**:
   ```
   gcloud services enable script.googleapis.com --project=article-compass-clasp
   ```

4. **プロジェクト番号を確認**（Project ID ではなく Project **Number**。紐付け画面では
   番号を要求される）:
   ```
   gcloud projects describe article-compass-clasp --format="value(projectNumber)"
   ```

5. **ここから先はブラウザでの手動操作が必要**（gcloud CLIだけでは完結しない）:
   - `https://script.google.com/home/projects/1OIzsyQgzT9dDNeUvytDNIXgtOgTXrXJomlhhNFtNbFyhmkf7KZ0jBMa7/settings`
     を開く
   - 「Google Cloud Platform（GCP）プロジェクト」欄の「プロジェクトを変更」を押す
   - 手順4で得たプロジェクト番号を貼り付けて保存する

6. **動作確認**: `C:\Users\ebima\Documents\Codex\deploy_stale_guard` に移動し、
   ```
   clasp run uaGetWpEditorTheme_
   ```
   のような軽い既存関数（読み取り専用に近いもの）を試し、`NOT_FOUND` エラーが
   出なくなっているか確認する。

## 完了後にHANDOVER_STATUS.mdへ記録してほしいこと

- **成功した場合**: 使ったGCPプロジェクトのID・番号、有効化したAPI、`clasp run`の
  成功ログを記録。
- **途中で止まった場合**（特に手順5のブラウザ操作ができない場合）: どこまで進めたか、
  どこで・なぜ止まったかを記録し、ユーザーが最後の手動ステップだけ引き継げるように
  書き残す。

作業を始める前・終わったタイミングで、必ずHANDOVER_STATUS.md冒頭の
「現在作業中（ライブ状況）」欄を読み書きすること（CLAUDE.mdの並行作業ルール）。
