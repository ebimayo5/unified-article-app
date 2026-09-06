# Codexへの依頼: お宝キーワードタブの本番デプロイ

## 背景

Claude Codeが、パネル(アーコン)に3つ目のメインタブ「お宝キーワード」を追加した。
これまでApps Scriptエディタから一回限りの関数を手動実行する運用だった「お宝キーワード」発掘・評価機能を、
正式なパネルUIから操作できるようにしたもの。

- コードはすでに `unified_article_app/keyword_discovery.gs`, `unified_article_app/web_app.gs`,
  `unified_article_app/ua_web_app.html` に実装済み・git push済み(直近コミット: `38a4cd5`)。
- 全39本のローカルテストPASS確認済み。
- `clasp push` はステージングフォルダ(`C:\Users\ebima\Documents\Codex\deploy_stale_guard`)から
  実行済みで、Apps ScriptのHEAD(保存済みコード)には既に反映されている。
- 「デプロイをテスト」機能で発行したテスト用URL
  (`https://script.google.com/macros/s/AKfycbwphhYK-xmQbrRIZCIA9ChmFg6okIDCLdNwegbv8Kk/dev`)で
  実際にブラウザ確認済み。3タブとも正常表示、候補一覧も実データで表示されることを確認済み。
  ステータスを書き換えるボタン(書くへ昇格/保留にする/AI提案に戻す/AI発掘/評価実行)は、
  本番データを変更してしまうため確認時はクリックしていない。

**残っている作業は「本番Webアプリの同一URLへ`clasp deploy`でバージョンを更新する」ことだけ。**
コード変更・push・動作確認はすべて完了済み。この依頼は最後のデプロイ操作のみ。

Claude Code環境ではこの`clasp deploy`コマンドが安全装置(auto modeのクラシファイア)により
自動実行をブロックされたため、Codexに依頼する。

## 作業前に必ず確認すること(CLAUDE.mdの並行作業ルール)

1. `HANDOVER_STATUS.md` 先頭の「現在作業中（ライブ状況）」欄を読み、
   他のエージェントが同じファイル・機能で作業中でないか確認する。
2. `git status --short` と `git log -5` を実行し、リポジトリの状態が
   `HANDOVER_STATUS.md` の記述と一致しているか確認する。
   - 一致していれば、そのまま進めてよい。
   - 一致しない場合は、実際の状態を優先し、ユーザーに報告してから進める。
3. 作業を始める前に、「現在作業中」欄へ以下を記入する:
   - エージェント: Codex
   - やっていること: お宝キーワードタブの本番デプロイ(`clasp deploy`のみ)
   - 本番影響: あり(Webアプリのバージョン更新)

## 実行手順

1. ステージングフォルダのファイルが最新か確認する。
   リポジトリ側の3ファイルとの差分がないことを確認してから進める:
   ```bash
   diff "unified_article_app/keyword_discovery.gs" "C:/Users/ebima/Documents/Codex/deploy_stale_guard/keyword_discovery.gs"
   diff "unified_article_app/web_app.gs" "C:/Users/ebima/Documents/Codex/deploy_stale_guard/web_app.gs"
   diff "unified_article_app/ua_web_app.html" "C:/Users/ebima/Documents/Codex/deploy_stale_guard/ua_web_app.html"
   ```
   差分がある場合は、リポジトリ側の内容をステージングフォルダへ上書きコピーしてから
   `clasp push --force` を実行し、HEADを最新化してから次に進む。

2. 本番Webアプリの同一URL(デプロイID `AKfycbzGbxQA5AuXH3MlUZSlfTjDn1hrpH4MnNNG0NVKty0wUz1Bd-4oVXbMQUBloQvd-HCm`)へ
   新しいバージョンをデプロイする:
   ```bash
   cd "C:\Users\ebima\Documents\Codex\deploy_stale_guard"
   npx clasp deploy --deploymentId AKfycbzGbxQA5AuXH3MlUZSlfTjDn1hrpH4MnNNG0NVKty0wUz1Bd-4oVXbMQUBloQvd-HCm --description "Add treasure-keyword panel tab"
   ```

3. デプロイ後、**報告された内容を鵜呑みにせず**、必ず以下で実際の反映状況を確認する
   (`deploy_version_verification`の教訓: 報告されたバージョン番号を信用しない):
   ```bash
   npx clasp deployments
   ```
   出力の中で、上記デプロイIDに対応する行の**バージョン番号が今回作成した新しい番号になっているか**を確認する。

4. 可能であれば、本番URL
   (`https://script.google.com/macros/s/AKfycbzGbxQA5AuXH3MlUZSlfTjDn1hrpH4MnNNG0NVKty0wUz1Bd-4oVXbMQUBloQvd-HCm/exec`)
   をブラウザで開き、パネル上部のタブが3つ(ダッシュボード/詳細編集/お宝キーワード)に増えていることを確認する。
   このとき、書き込み系ボタン(書くへ昇格/保留にする/AI提案に戻す/AIに新しいキーワードを考えてもらう/
   評価して候補へ追加/再評価を実行)は、本番の候補シートを実際に書き換えるかAPI課金が発生するため、
   **ユーザーの別途の指示がない限りクリックしない**こと。表示確認のみでよい。

5. 自動投稿は操作しない。今回の変更はパネルUIの追加のみで、自動投稿ロジック自体には手を入れていない。

## 完了後に行うこと

`HANDOVER_STATUS.md` を以下の内容で更新する:
- 「現在作業中」欄を空きに戻す
- 完了記録として、デプロイしたバージョン番号、`clasp deployments`で確認した結果、
  本番URLでの表示確認結果(タブ3つ表示できたか)を記載する
- 何か問題があれば(diffが一致しなかった、デプロイでエラーが出た等)、その内容も具体的に記載する

作業が終わったら、このファイル(`CODEX_TASK_deploy_treasure_keyword_tab.md`)は削除してよい
(過去の `CODEX_TASK_clasp_run_setup.md` と同様、使い捨てのタスク指示ファイルのため)。
