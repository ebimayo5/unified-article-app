# Article Compass System（アーコン）詳細引き継ぎデータ

更新日: 2026-10-11 JST  
更新者: Codex  
対象: Article Compass System、DRIVE BASE、暮らしやすい家づくりノート（たくみパパ）

## 1. このチャットの直近完了事項

### 本文中のPR表記を削除して再発を防止

ユーザーの方針は明確です。**SWELLが記事上部に表示するPRラベルで広告表記は足りているため、本文中に「ここからはPRを含みます。」「PR：」「アフィリエイト広告を含みます。」を入れない。**

- 対象公開記事: たくみパパ「キッチン前面収納はいらない？後悔しない判断のコツ」
  - WordPress post ID: `1791`
  - URL: `https://kurashi-ie.com/kitchen-front-storage-not-needed/`
- 2026-10-11に本文のCTA直前にあった「ここからはPRを含みます。」だけを削除して保存済み。
- 公開ページで、本文から当該文言が消え、記事上部のSWELL共通PRラベルが残ることを確認済み。
- 今後の生成・公開前修正・WordPress反映でも消えるよう、次を更新した。
  - `unified_article_app/article.gs`
    - `uaRemoveRedundantAffiliateDisclosure_()` の対象に「ここからはPRを含みます。」を追加。
    - 独立段落なら段落ごと、段落先頭に本文が続くなら先頭文だけを削除する。
  - `unified_article_app/prompt.gs`
    - 本文に広告表記を追加しないよう生成ルールに明記。
  - `unified_article_app/pre_publish_check.gs`
    - 公開前修正モデルにも同じ禁止事項を明記。
  - `test_affiliate_disclosure_removal.js`
    - 独立段落・本文と連続する段落の両方を回帰テスト化。
- 検証: 全 `test_*.js` がPASS。
- Git: `864f79a Remove inline affiliate disclosures`、記録 `df66694 Record affiliate disclosure update` を `origin/main` へpush済み。
- 本番Apps Script: **@388**（`Remove inline affiliate disclosures`）へデプロイ済み。

## 2. 現在の稼働状態（2026-10-11確認）

### たくみパパ

- Article Compassパネル設定: 自動運転 **ON**、開始時刻 **5時**、1日 **1記事**、画像あり、WordPress到達点は公開。
- 当日実績: `05:38 キッチン 前面収納 いらない（公開）`、**1 / 1件**で完了。
- 次の予定: なし。
- パネルには完了行のため「自動投稿は現在停止中です」「処理中: ... / WordPress公開」と残る表示があるが、ダッシュボードの当日件数・公開完了と整合しており、再開対象ではない。
- ローカル `KeywordTreasureFinder` / `ArticleBridge`: **0件**。

### DRIVE BASE

- この引き継ぎ作成時に記事生成・自動投稿は操作していない。
- 次回の監視時に、処理表示だけで正常と判定しない。実プロセス、進捗更新時刻、同名トリガーの重複、WordPress到達状態まで確認する。

## 3. 絶対に守る運用ルール

### 自動投稿の事故防止

2026-08-23に、停止・待機状態の記事で `uaRunAutomaticPostingWorker` と `uaStartNextAutomaticPosting` が相互に再予約され、24時間で200件超、OpenAI 829リクエスト・入力約1,796万トークン・55.47ドルを消費した事故がある。

- 「処理中」「生成中」という表示だけで正常と判断しない。
- 同じキーワード・同じ工程が20分以上変わらず、必要なローカル処理がない場合は異常候補。
- `ArticleBridge` が2個以上、同名のワーカー／次記事確認トリガーが複数、OFFなのに処理中、サイト切替後も別サイト表示が残る場合は異常。
- 異常時は**再開・再生成をしない**。本文・下書き・処理ID・停止位置を保持して、まず途中停止または自動運転OFFにする。重複ローカル処理も停止する。
- 同じAPI本文生成を最初から送り直さない。本文品質、公開前チェック、根拠確認を省略して進めない。
- 監視時に安全に直せない記事は対象外にして次へ進められる状態を残すが、勝手に再開しない。

### サイト間の引き継ぎ

- 5時はDRIVE BASE、6時はたくみパパの日次枠。
- DRIVE BASEが実際に進捗更新していて、実プロセス・トリガー・WP到達に異常がなければ、6時のたくみパパ開始と重なっても停止しない。
- DRIVE BASE完了後、開始時刻を過ぎた未消化のたくみパパ枠は `uaStartNextAutomaticPosting` 経由で**1回だけ**開始される。
- サイト切替直後は旧サイト表示が残ることがある。読み込み完了後に、サイト名・設定見出し・ダッシュボード内容が揃ってから判定する。
- 16時は通常両サイト停止。生成・画像・修正・WP反映・ワーカー・ArticleBridge・次記事確認が動いていたら原則として異常停止し、再開しない。

### 並行作業

- 作業開始時に `HANDOVER_STATUS.md` の「現在作業中」を読む。
- 意味のある編集、Gitコミット、`clasp push/deploy`、自動投稿操作の直前に「現在作業中」欄へ作業内容・対象・本番操作の有無を書く。
- `clasp push/deploy` や自動投稿の操作の直前には必ず同欄を再読する。
- 他エージェントが30分以内に同じ対象を作業中なら、同じ箇所を編集しない。
- Gitは区切りごとにコミット・pushし、競合時にforce pushしない。
- `.claude/` は他作業由来の未追跡ファイル。追加・削除・コミットしない。

## 4. 本番反映の手順

### リポジトリとデプロイ用ディレクトリ

- リポジトリ: `C:\Users\ebima\Documents\GitHub\unified-article-app`
- Apps Scriptソース: `unified_article_app\`
- デプロイ用ステージング: `C:\Users\ebima\Documents\Codex\deploy_stale_guard`
- Apps Script project ID: `1OIzsyQgzT9dDNeUvytDNIXgtOgTXrXJomlhhNFtNbFyhmkf7KZ0jBMa7`
- Webアプリ deployment ID: `AKfycbzGbxQA5AuXH3MlUZSlfTjDn1hrpH4MnNNG0NVKty0wUz1Bd-4oVXbMQUBloQvd-HCm`

### 重要: 古いステージングをそのままpushしない

過去にステージングの `pre_publish_check.gs` が古い状態で残り、本番の修正を消しかけた。デプロイ前に少なくとも変更対象をリポジトリからコピーし、ハッシュまたは差分で一致を確認する。

```powershell
$src = 'C:\Users\ebima\Documents\GitHub\unified-article-app\unified_article_app'
$dst = 'C:\Users\ebima\Documents\Codex\deploy_stale_guard'
Copy-Item -LiteralPath "$src\article.gs","$src\prompt.gs","$src\pre_publish_check.gs" -Destination $dst -Force
```

変更が他ファイルにも及ぶ場合は、そのファイルも必ず同期する。同期後、ステージングで以下を行う。

```powershell
clasp.cmd push --force
clasp.cmd version "短い変更内容"
clasp.cmd deploy --deploymentId AKfycbzGbxQA5AuXH3MlUZSlfTjDn1hrpH4MnNNG0NVKty0wUz1Bd-4oVXbMQUBloQvd-HCm -V <version> -d "短い変更内容"
```

- `push` 成功だけで本番Webアプリは更新されない。必ず version と deploy を行う。
- Google側の一時的な503が出ることがある。処理の二重実行ではなく、同じ安全なバージョン作成を再試行する。
- 本番デプロイ後に、対象のパネル・記事・または該当テストで確認する。

## 5. コンテンツとCTAの方針

### 本文中の広告表記

- 記事上部のSWELL PR表示を残す。
- 本文内のPR開始宣言、PRだけの段落、アフィリエイト広告の注記は不要であり、入れない。
- 案件CTAの前後に本文の文脈があり、読者が条件を判断できることを優先する。

### 積水ハウス紹介CTA

- 紹介コード: **`GJ1997`**。
- 対象の紹介記事ではCTAボタンの直前にコード入力案内を置く。コード欄へ入力しないと紹介が成立しない。
- 初回接触前が原則。資料請求、展示場予約、来場、展示場アンケート、担当者付与後は対象外になり得るため、個別条件は問い合わせ先で確認するよう案内する。
- 3%は一律保証ではない。公式ページの条件を確認するよう書く。
- 過去の不具合: 紹介コードを必ず入れる設定が、CTA全体を組み替える経路で抜けた。現在はCTA直前に強制する修正を導入済み。積水ハウス関連記事を追加・修正するときは、コード案内とCTAの両方を目視確認する。

### 商品・楽天・Amazon

- ユーザー希望: 可能な限り同一商品が楽天とAmazonの両方にある候補にする。
- 適合判定が不正確だったため、OpenAIによる順位付けを導入した。
- トークンを抑える設計にし、通常の楽天・Amazonページ取得と照合はAI追加呼び出しなしで実行する。AIは候補順位付けなど必要な絞り込みに限定する。
- 商品がないほうが自然な記事は「商品なし」でも止めず、続行理由を記録する。ただし根拠不足・公開前チェックを無視して続行しない。

## 6. 外部リンクと根拠の方針

- 外部リンクは数合わせではなく、本文の検証可能な主張を補う一次・公的・公式資料だけを必要箇所へ置く。
- いつも同じ警察庁資料や点検整備資料を入れる運用にはしない。
- ただし本文に「走行中の画面注視を避ける」等の主張があるなら、対応する警察庁/e-Gov資料が必要。画面注視という文脈があるのにリンクがない状態は不具合。
- 車種・端子・対応可否は該当メーカー公式、運転中の画面注視は警察庁/e-Gov、住宅設備の性能・保証・施工条件はメーカー・住宅会社公式というように、主張と出典のカテゴリを合わせる。
- 契約図面・見積もり・仕様書を住宅会社へ確認するよう促すだけの一般的な助言は、外部根拠リンクを必須にしない。根拠がないことを理由に記事生成を停止させない。
- 2026-08-29以降の公開記事について、検証可能な安全・仕様・法令・施工条件の主張があり、対応する根拠リンクがない記事のみを監査対象にする。

### 未完了の外部リンク監査

- DRIVE BASEの画面注視注意を含む36記事は、警察庁リンク不足の可能性がある。
- 本文の注意段落直後へ一度だけ追記する関数とテストは作成済み。
- `clasp run uaBackfillDrivingSafetyEvidenceLinks20261008` はApps Script側の保存領域 `NOT_FOUND` で実行開始できなかった。
- 代表4記事で未反映を確認済み。重複実行はしていない。
- 次回はWordPress管理画面など、記事内容を壊さない更新経路で、対象・挿入位置・リンクを確定してから実施する。

## 7. 近時の実装・設定変更

| 項目 | 状態 | 主なコミット / 本番 |
|---|---|---|
| 本文PR表記除去 | 完了 | `864f79a`、Apps Script @388 |
| 本文中の誤検知根拠リンク停止を緩和 | 完了 | `dd9b674`、@386 |
| HTML装飾を根拠主張と誤認しない修正 | 完了 | `d4f868b`、@387 |
| CTAクリック計測 | 完了 | `1510bc1`。GA4 event `affiliate_cta_click` |
| たくみ候補シートの保留→AI候補移動 | 完了 | 保留54行を削除、AI提案72行にE〜S列を移動 |
| Contact Form 7迷惑メール対策 | 完了 | 氏名・メールにAkismet属性を追加。Turnstile/reCAPTCHAは未設定 |
| 積水ハウス記事群 | 公開済み | 成約ハブpost50ほか5本。本文中PR行なし、SWELL上部PRあり |

### GA4 CTA計測

- Rinker商品・外部CTAクリックで `affiliate_cta_click` を送信する。
- 計測値には記事URL、CTA種別、遷移先ドメイン、GA4標準リンク用パラメータを含める。
- たくみパパGA4 property: `p532520973`。
- 「CTA種別」「CTA遷移先ドメイン」のイベントスコープ定義を作成済み。
- 実データが入るには公開記事で実際にクリックが発生した後、GA4でイベント確認が必要。

## 8. 積水ハウス記事群の状態

| WP ID | URL | 役割 |
|---|---|---|
| 50 | `/before-showroom-visit/` | 成約ハブ（紹介割引） |
| 1653 | `/archives/housing-exhibition-not-go-homebuilding/` | 展示場に行かない |
| 1668 | `/sekisuihouse-sales-persistent/` | 営業はしつこい？ |
| 1681 | `/sekisuihouse-modelhouse-no-reservation/` | 予約なし見学 |
| 1693 | `/sekisuihouse-expensive-reasons/` | 高い理由 |

- 4本はpost50へリンク済み。post50は受けるハブとして発リンクなし。
- 5本とも案件リンク1本・本文中のPR行なし・SWELLのPRラベルあり・タグ崩れなしを確認済み。
- 成果計測は直リンクのためA8ではなく、北川さん側への確認が必要。
- GSCの観測対象: 「積水ハウス 紹介」「積水ハウス 展示場 予約なし」等。記事投入直後は0表示だったため、数日〜2週間で確認する。

## 9. 次の担当者向け開始チェックリスト

1. `HANDOVER_STATUS.md` の先頭「現在作業中」を読む。
2. `git status --short` と `git log -5 --oneline` を実行する。
3. Article Compassで、対象サイト・キーワード・工程・更新時刻・当日件数・WP到達を確認する。
4. ローカル `KeywordTreasureFinder` と `ArticleBridge` の数を確認する。
5. 「処理中」表示だけでは再開しない。20分以上同じ工程なら、保存状態・トリガー・実プロセスを調べてから停止または対応する。
6. 編集・push・deploy・自動投稿操作の前にライブ状況欄を更新し、直前に再読する。
7. 本文PR表記、紹介コード、CTA、外部根拠リンクは公開前に実際のWordPress本文で確認する。

## 10. 参考ファイル

- ライブ状況・運用履歴: `HANDOVER_STATUS.md`
- 本文生成・広告表記除去: `unified_article_app/article.gs`
- 生成ルール: `unified_article_app/prompt.gs`
- 公開前チェック: `unified_article_app/pre_publish_check.gs`
- WordPress反映: `unified_article_app/wordpress.gs`
- 外部リンク選定: `unified_article_app/links.gs`
- 自動投稿: `unified_article_app/automation.gs`
- 本文PR表記回帰テスト: `test_affiliate_disclosure_removal.js`
- 根拠リンク回帰テスト: `test_reliable_evidence_source_guard.js`
- CTA・紹介コード関連テスト: `test_affiliate_referral_cta_guard.js`

## 11. Git状態（この文書作成時点）

- ブランチ: `main`
- 直近コミット:
  - `df66694 Record affiliate disclosure update`
  - `864f79a Remove inline affiliate disclosures`
  - `973b0ef Record successful Takumi article restart`
- 意図的に未追跡: `.claude/`（他作業のため触らない）。

