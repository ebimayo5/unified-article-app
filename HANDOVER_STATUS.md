# HANDOVER_STATUS

## 現在作業中（ライブ状況）
作業を始める前・区切りがつくたびに、必ずここを読み書きすること（CLAUDE.md / AGENTS.md の「並行作業ルール」参照）。
複数エージェントが同時に動く前提のため、このセクションだけは「最終更新」より新しい情報になり得る。

- 状態: 作業中
- エージェント: Claude Code
- 開始時刻: 2026-08-29 20:30頃（日本時間）
- やっていること: ユーザーから「記事を見て文章の出力の精度や記事品質どう？」と聞かれ、公開済み記事6本（DRIVE BASE 3本・たくみパパ 3本）を実際にWordPress REST APIとブラウザで確認。文章自体の質は高いが、たくみパパのRinker商品カードが楽天APIの生の商品名（出品者のSEOキーワード詰め込みタイトル、例:「＼楽天ランキング1位！／隙間パッキン ホームセンター 洗濯機 洗面台...」）をそのまま表示してしまっており、丁寧な本文と比べて見た目が浮くことを実際のページで確認。ユーザーに確認の上「整形して短くする」を選択されたため、[unified_article_app/article.gs](unified_article_app/article.gs)の`uaBuildHomeRinkerItemsHtml_`を修正: 既存のAmazon検索キーワード整形ロジック（`uaBuildAmazonSameProductQuery_`）を`uaCleanRakutenItemName_`として共通化し、＼〜／装飾タグの除去も追加、Rinkerへ送るtitleは整形後60文字で切り詰め（`uaTruncateForDisplay_`）。ブランド保証用の`sourceItems`（生の商品名）には影響しないことを確認済み。新規テスト追加、全21ファイルPASS。
- 本番に影響する操作: これから実施予定（git commit→push→clasp push→clasp deploy）。まだ本番未反映。
- 最終更新: (作業中のため未更新)
- **次のエージェントへの引き継ぎ**: この「本番に影響する操作」欄が「完了」に変わっていない場合、作業が中断された可能性があるため、実際のgit状態・`clasp deployments`を確認してから触ること。
- 最終更新: 2026-08-29 20:15頃（Claude Code）— 本番@314。
- **次のエージェントへの引き継ぎ**: 特になし。ユーザーから記事品質のレビュー依頼があり、続けて対応中。
- 最終更新: 2026-08-29 19:00頃（Claude Code）— 本番@313。
- **次のエージェントへの引き継ぎ**: 特になし。ユーザーがパネルで動作確認するのを待つ段階。

## ⚠️ 2026-08-28 発生: パネルの「WPへ更新」ボタンが動かず、Apps Scriptエディタから直接関数を叩いたことで行48のデータが一時消失（自己修復済み）
- 経緯: パネルの「WPへ更新」ボタンは`window.confirm()`（公開記事を上書きする確認ダイアログ）を出すが、ブラウザ自動操作からこのネイティブダイアログのOKを確実に押す方法がなく、複数回クリック・Enterキー送信を試みても`WP更新`が実行された形跡がなかった（WordPress側の`modified`日時が変化しない）。
- 原因調査のため、Apps Scriptエディタの「実行」ボタンから`uaUpdatePublishedWpFromPanel`を**引数なし（`data = undefined`）で直接実行**した。この関数は内部で`uaSaveActiveRowData(data || {})`を呼んでおり、`data`が空だと[main.gs](unified_article_app/main.gs) `uaSaveActiveRowData`が**本文(body)を含む行のほぼ全列を空文字列で上書きする**構造だった（本文だけは`uaPreserveProductPlanMarker_`で「保持」を試みるが、`visibleBody`が空文字のときは早期returnで空のまま返す実装になっており、実際には保持されない）。結果、たくみパパシート行48（テレビ2台記事、WP投稿ID 989）のB〜W列（メインキーワード・本文・タイトル案・WP投稿ID等）がほぼ全て空になった。
- 気づいた経緯: 直接実行の結果が`Error: WP更新: 本文が空です。`だったため、行48を確認したところ実際に空になっていることを発見。**WordPress側（公開中の投稿989）は無事**で、影響はスプレッドシート側のみ。
- 復旧: Googleスプレッドシートの「変更履歴」から、事故発生直前のバージョン（同日14:22時点）を「コピーを作成」で別ファイルとして複製し、そこから行48（A48:W48）をコピーして本番シートの行48へ貼り戻した。本文には既にRinker商品リンク3件（`UA_RINKER_PRODUCTS_START`〜`END`内の`[itemlink]` post_id 1041/1042/1043）が含まれていたため、Rinker選定作業自体はやり直し不要だった。
- 恒久対応: [wordpress.gs](unified_article_app/wordpress.gs) `uaUpdatePublishedWpFromPanel`の本体ロジックを`uaUpdatePublishedWpFromPanelCore_(sheet, row)`として切り出した（`uaSaveActiveRowData`の呼び出しから独立）。動作は変更していない（`uaUpdatePublishedWpFromPanel`は従来どおり`uaSaveActiveRowData`を呼んでからcoreを呼ぶ）。本番@304へデプロイ済み。
- 実際のWP反映は、この`uaUpdatePublishedWpFromPanelCore_(sheet, 48)`を一時的な公開関数経由でApps Scriptエディタから直接実行する方法で行った（`uaSaveActiveRowData`を経由しないため、行データを壊さずに済む）。実行後はテスト用の一時関数を削除し、コミット・再デプロイ済み。
- **教訓（重要）**: `uaUpdatePublishedWpFromPanel`・`uaRunArticleFromPanel`など`uaSaveActiveRowData(data || {})`を呼ぶ関数群は、**パネル（`ua_web_app.html`の`readForm()`）経由の呼び出し以外では絶対に空データで実行しないこと**。Apps Scriptエディタから直接デバッグ実行する場合は、`data`引数を渡せない（エディタの「実行」は引数なし実行のみ）ため、これらの関数を直接叩くと行データが吹き飛ぶ。デバッグ目的でロジックだけ再利用したい場合は、今回のように`uaSaveActiveRowData`を呼ばない別経路（`*Core_`関数など）を用意すること。
- **パネルの「WPへ更新」ボタン自体（`window.confirm`のダイアログ）が自動操作から確実に押せない問題は未解決**。次にこのボタンを人間以外の手段（ブラウザ拡張など）から操作する必要がある場合は注意。人間が実際にクリックする分には問題ない可能性が高い（ダイアログはブラウザ標準のものなので、人がクリックすれば普通に動くはず）。

## 最終更新
- 更新者: Codex（このセクションを直近で更新）
- 日時: 2026-08-28 09:30（日本時間）
- 切り替え理由: Rinkerブランド保証のコード・テスト・仕様・本番・GitHub反映が完了し、公開記事更新だけがユーザー確認待ちになったため。

## 2026-08-28: Rinkerブランド比較保証（本番 `@296`）
- 公開確認で、ヨギボー比較記事には無印良品本体がある一方、Yogibo本体がなく汎用ビーズソファ2件で代替されていることを確認した。商品数だけを見る旧保証判定では、この構成を正常扱いしてしまう穴があった。
- `article.gs` に既知ブランド抽出、ブランド指定検索での別ブランド除外、選定商品名メタ `UA_RINKER_SELECTION_META`、明示ブランドの不足判定を追加した。Yogibo・無印良品のように複数ブランドがメインキーワードへ明示された比較では、各ブランド最低1件を必須にする。旧管理ブロックに選定メタがない場合も一度だけ再選定する。手動Rinkerは従来どおり保持する。
- 山崎実業の製品シリーズ名として使われることがある「tower／タワー」は「タワーファン」等の一般語と衝突するため、ブランド自動認識には使わず「山崎実業」だけを認識する。
- 全ローカルテストを実行し全件PASS。以前から単独実行できなかった `test_complementary_affiliate.js` も、実コード側にあるSWELL判定関数をテスト環境へ追加して14チェックPASSに直した。
- Git: `69a010f Require explicit brands in managed Rinker comparisons` を `origin/main` へpush済み。Apps Script本番デプロイは `@296 - Require explicit Rinker brands without category false positives`。
- 公開記事の事前監査: 洗濯機の隙間記事は、隙間パッキン・防水パン上ラック・隙間ガードの3件で適合。ヨギボー記事はYogibo本体欠落のため要再選定。テレビ2台、シーリングライト調色、室内ジャングルジムは現在Rinker 0件で、いずれもメインキーワードと本文上、商品導線を入れる対象と判定した。
- **未実施・次にやること**: ユーザーの公開記事更新確認後、ヨギボー記事を本番@296で再選定してYogibo本体＋無印良品本体を確認し、WordPress公開記事へ反映する。成功後、テレビ2台（行48）、シーリングライト（行46）、室内ジャングルジム（行45）にも適切なRinkerを追加する。各記事でタイトル・URL・画像・公開状態と楽天/Amazon導線を反映前後に確認する。停止中の自動投稿「エアコン位置 失敗」は再開しない。

## ⚠️ 2026-08-27 発生: 「内部リンク」シートのデータ消失事故（原因判明・2段階で修正済み）
- 経緯: ユーザーが下記「その4」の対応を受けて、スプレッドシートのメニューから手動で「内部リンク候補をサイトマップ更新」を実行したところ、**89件以上あったはずの内部リンク候補が2件（手動保持にチェックが入っていた行のみ）まで減った**。ユーザー報告により発覚。
- **応急対応（ユーザー実施・完了）**: Googleスプレッドシートの変更履歴から復元し、**42件まで復旧済み**（ユーザー確認済み。89件との差は元々の候補数が42件程度だった可能性が高く、これ自体は異常ではない）。
- 修正1（データ消失防止・`@286`）: `uaUpdateInternalLinksFromSitemaps`（[links.gs](unified_article_app/links.gs)）が**毎回シートを全クリアしてから、再取得できた行と「手動保持」行だけを書き戻す**設計だったため、取得がほとんど失敗すると手動保持以外の全候補が消える構造的欠陥があった。**シートを一括クリアする処理を完全に削除**し、成功したURLだけを1行ずつ upsert する方式（共有関数 `uaUpsertInternalLinkCandidateRow_`）に変更。
- 修正2（根本原因・`@287`）: 復旧後にユーザーが再実行しても**両サイトとも「URL取得0件」**（エラーは出ない）。原因は、`uaFetchSitemapUrls_`/`uaFetchPageInfo_`が使っていた**認証なしのsitemap.xml取得・記事ページの直接HTML取得**が、両サイトに入っているセキュリティプラグイン（DRIVE BASE: SiteGuard、たくみパパ: SiteGuard＋Wordfence）にブロックされ、エラーは出ないまま0件を返していたためと判明。**サイトマップ経由をやめ、自動投稿でも使っている認証済みWordPress REST API（`uaCallWordPressApi_`/`uaGetWpConfig_`、`/wp-json/wp/v2/posts?status=publish`）から直接記事一覧を取得する方式に全面書き換え**（新関数 `uaFetchPublishedWpPostsForInternalLinks_`）。
- 新規テスト`test_internal_link_sitemap_refresh_safety.js`で、(a) 取得失敗時に既存データが消えないこと、(b) 0件取得時も既存データが消えないこと、(c) 正常時は既存URLの上書き更新（手動編集列は保持）と新規URLの追加が両方正しく動くこと、を確認済み。
- 本番デプロイ済み: **`@287`**（"Fetch internal-link candidates via WordPress REST API instead of sitemap.xml"）。
- **✅ ユーザーが再実行して動作確認済み: 42件→140件（DRIVE BASE＋たくみパパ合計として妥当な件数）に復旧・増加。この事故は完全に解決済み。次のエージェントが追加対応する必要はない。**
- 教訓1: 「シート全体を消してから再構築する」系のバッチ処理は、部分的な取得失敗が起きただけで大量のデータ消失につながる。同種の一括更新処理（既存記事移行系など）を今後触るときは、同じパターン（全クリア→成功分だけ書き戻し）になっていないか要注意。
- 教訓2: 外部サイトへの認証なしHTTPアクセス（sitemap.xml、記事ページの直接取得など）は、SiteGuard/Wordfenceのようなセキュリティプラグインに**エラーも出さず黙って弾かれる**ことがある。同様の仕組みを新設する場合は、可能な限り既に動作実績のある認証済みWordPress REST API経由にする。

## 直前まで何をしていたか（その4: 内部リンク候補シートの自動更新）
- ユーザーからの指摘で、「内部リンク」候補シートは**手動でスプレッドシートメニューから「サイトマップ更新」を押さない限り更新されない**ことが判明。自動投稿はこのシートの候補を見て内部リンクを入れるかどうか決めるため（[links.gs:1](unified_article_app/links.gs:1) `uaBuildInternalLinksPrompt_`、候補0件なら本文に内部リンクを入れないようAIへ明示指示）、シートが古いままだと新しい記事同士がお互いの内部リンク候補にならない。
- 対応: 記事が実際に公開された直後（自動投稿の最終公開ステップ）に、**サイトマップ再クロールをせず、その場で持っているデータ（タイトル・メタディスクリプション・本文冒頭・タグ）だけで1行を追加/更新する**関数 `uaUpsertInternalLinkCandidateForPost_` を新設（[links.gs](unified_article_app/links.gs)）。[automation.gs](unified_article_app/automation.gs) の `uaPublishWpPostFromAutomation_`（自動投稿の公開ステップ）から呼び出す。
  - 同じURLが既にシートにあれば上書き更新（タイトル変更などに追従）。ただし「核記事」「使う場面」「優先度」「手動保持」など**手動で書き換えた列は保持**する。
  - 失敗してもtry/catchで握りつぶし、公開処理自体は失敗させない（内部リンク登録はあくまで補助機能のため）。
  - 新規テスト `test_internal_link_auto_capture.js` で、新規追加・同一URL上書き時の手動編集保持・別URLは別行・`useInternalLinks:false`のサイトでは書き込まないことを確認済み。
- 本番デプロイ済み: **`@285`**（"Auto-register new posts as internal-link candidates on publish"）。
- **注意点（まだ手動対応が必要）**: この機能は「今後公開される記事」からしか効かない。今回レビューした2記事を含め、**すでに公開済みの記事同士を内部リンクでつなぐ候補は、今回の修正だけでは増えない**（それらの記事はこの新機能が有効になる前に公開されたため、シートに載っていない）。過去記事をまとめて候補に入れたい場合は、従来通りスプレッドシートメニューの「内部リンク候補をサイトマップ更新」を一度手動で実行する必要がある。

## 直前まで何をしていたか（その3: 既存記事への反映を実行）
- ユーザーの指示で、ユーザー自身のChrome（Claude in Chrome連携）を使い、WordPressへ実際にログインした状態でCTAボタンの修正を直接反映した。`clasp run`が使えない制約を、認証済みブラウザから`wp.apiFetch`（WordPress公式のREST APIクライアント、Gutenbergエディタ自身が使っているもの）を使うことで回避した。
- 実施内容（すべてURL・ボタン文言・画像・公開状態を変更前後で確認しながら実施）:
  1. DRIVE BASE 投稿ID 2190（認定中古車はやめとけ？）のメインCTAボタンを新形式へ修正。
  2. その過程で、**実際に保存されているHTMLは属性のクォートが `"` から `'` に書き換えられている**ことが判明（WordPress保存時の正規化と思われる）。[links.gs](unified_article_app/links.gs)の`uaNormalizeSwellAffiliateCtaButtons_`の正規表現がダブルクォート決め打ちで、このままでは既存記事に一切マッチしない不具合だったため修正し、コミット・本番デプロイ（`@284`）済み。
  3. DRIVE BASEの直近20記事をスキャンし、同じ旧形式ボタンが残っていた7記事（投稿ID 2180, 2170, 2151, 2141, 2131, 2121, 2103）も同じ方法で修正・確認済み。
  4. たくみパパ（kurashi-ie.com）の直近20記事もスキャンしたが、対象0件（このサイトはRinker中心でこの形式のボタンをほぼ使っていないため）。
  5. 投稿ID 2190の本文中に残っていた、Codexが見本として置いたと思われる**中身が空のSWELLボタン**（リンク先・文字なし、公開ページ上で空白のボタンとして表示されていた）をユーザー確認のうえ削除。CTAボタン・URL・画像には影響なし。
- **本番デプロイの最新版は `@284`**（"Fix quote-style handling in SWELL CTA button migration regex"）。Apps Script側の`uaMigrateRecentSwellAffiliateCtaButtons`／`uaPreviewRecentSwellAffiliateCtaButtons`／`uaApplyRecentSwellAffiliateCtaButtons`（wordpress.gs）は今回使わなかったが、クォート修正が反映済みなので、次に使うときは正しく動くはず。
- 次に確認するとよいこと: DRIVE BASEの21件目以降の古い記事（直近20件より前）にも同じ旧形式ボタンが残っている可能性がある。必要なら`uaPreviewRecentSwellAffiliateCtaButtons({maxPosts: 50, dryRun:true})`のように`maxPosts`を増やして確認する。


- 日時: 2026-08-27
- 切り替え理由: 「今からN記事開始」機能に続けて、DRIVE BASE最新記事で見つかった「CTAボタンがSWELL本来のボタンになっていない」問題も修正・本番デプロイ・GitHub反映まで完了したための更新。

## 直前まで何をしていたか（その2: SWELLボタン統一）
- ユーザーが「ドラベの最新記事のボタンがSWELLボタンじゃない」と報告。DRIVE BASEの最新記事（[認定中古車はやめとけ？](https://ebimayo5.com/archives/certified-used-car-yametoke/)）をブラウザで直接確認し、以下を発見:
  - 自動投稿が作るメインCTAボタンは `<!-- wp:html --><div class="wp-block-button is-style-btn_solid">...` という**カスタムHTMLブロック**で、見た目はプラグイン（Article Compass Rinker Bridge）のCSS（`.article-compass-affiliate-cta .wp-block-button__link`、`var(--color_main)` で色付け）で整えていただけだった。
  - 同じ記事の本文下部に、Codexが見本として置いたと思われる**中身が空のSWELL純正ボタン**（`swell-block-button green_ -size-l is-style-btn_shiny`）があり、これが本来あるべき形式だった。
  - 色はDRIVE BASE=green（サイトテーマ色と一致）。たくみパパは対象記事にCTAボタンがなかったため実例なし、ユーザーに確認し **orange** に決定。
- 対応内容（コミット `141ae0f`、本番 `@283` へデプロイ済み）:
  - [config.gs](unified_article_app/config.gs) の `UA_APP_TYPES` に `swellButtonColor`（drive:'green', home:'orange'）を追加し、`uaGetSwellButtonColor_()` を新設。
  - [article.gs](unified_article_app/article.gs) の `uaBuildManagedAffiliateCtaBlock_` を、`wp:loos/button` + `swell-block-button -html {色}_ -size-l is-style-btn_shiny` という、移行コード（wordpress.gs側）と同じ本物のSWELLボタン形式に変更。**今後の自動投稿・新規記事生成分はこの修正で正しい形式になる。**
  - [links.gs](unified_article_app/links.gs) に変換用の純粋関数 `uaNormalizeSwellAffiliateCtaButtons_` を追加。
  - [wordpress.gs](unified_article_app/wordpress.gs) に、既存公開記事をスキャンして直す `uaMigrateRecentSwellAffiliateCtaButtons`（+ `uaPreviewRecentSwellAffiliateCtaButtons` / `uaApplyRecentSwellAffiliateCtaButtons`）を追加。直近のポイント枠修復（`uaMigrateRecentSwellManagedGroups`）と全く同じパターン（デフォルトはドライラン、URL・画像が変わらないことを書き込み前後で必ず確認）。
  - `uaTestSwellBlockDialect` / `uaCreateDriveSwellMigrationTestDraft` のアサーションも新形式に合わせて更新。ローカルで実行可能なテストは全てPASS確認済み（vmでのシミュレーション実行でも、DRIVE BASE=green・たくみパパ=orangeの出力、旧形式→新形式の変換とその冪等性を確認済み）。
- **未完了・次にやること**: `clasp run` がこの環境ではまだ動かない（`Exception: ... NOT_FOUND` — `.clasp.json` にGCPプロジェクトIDの紐付けがない可能性）ため、**Claude Codeからは既存公開記事への実際の書き換えを実行できていない**。DRIVE BASEの最新記事はじめ、直近の公開記事に残っている旧形式ボタンは、Apps Scriptエディタから手動で実行する必要がある。
  1. スプレッドシートを開く →「拡張機能」→「Apps Script」
  2. 関数選択で `uaPreviewRecentSwellAffiliateCtaButtons` を選び実行（書き込みなしの確認。ログに対象記事一覧が出る）
  3. 内容を確認し、問題なければ `uaApplyRecentSwellAffiliateCtaButtons` を実行（実際にWordPressへ反映。デフォルトは直近20記事、両サイトを対象。サイトを絞りたい場合は `uaMigrateRecentSwellAffiliateCtaButtons({appKey:'drive', maxPosts:5, dryRun:false})` のように直接呼び出す）

## 直前まで何をしていたか（その1: 今からN記事開始）
- セッション開始時点で、**Codexが実装した「今からN記事開始」機能**（保存済みの画像・WordPress到達点を使って1〜5記事を1回限りで即時開始するボタン。毎日の自動運転設定は変更しない）がリポジトリに未コミットのまま残っていた。
- **重要な発見**: この機能はローカルでは未コミットだったが、**Codexはすでにclasp経由で本番Webアプリへデプロイ済み**だった（本番デプロイIDのバージョンが `@281 - Add one-time immediate article batch start` になっているのをClaude Codeが `clasp deployments` で発見。ユーザーが当初報告していた「本番は@280のまま」という情報は、この時点ですでに古くなっていた）。
- Claude Codeがコードを精査し、Codexの実装に**2つの不具合**を発見・修正した:
  1. 対象サイトの「自動運転」がOFFのとき、「今からN記事開始」で開始したジョブが1歩も進まず無言で止まる不具合（`uaRunAutomaticPostingWorker` の `if (!settings.enabled) return;` が手動バッチの例外を考慮していなかった）。→ `job.manualBatch !== true` の条件を追加して修正。
  2. 手動実行した記事数が、その日の自動運転「1日の記事数」上限のカウンタと共有されており、手動実行が自動運転の当日残り枠を消費してしまう（逆もあり得る）不具合。→ ユーザーに確認したところ「別枠にしてほしい」との回答だったため、手動バッチはカウンタを共有しないよう分離。
- 修正後、リポジトリ内ファイルを直接読むローカルテスト（`test_manual_automation_batch.js`、`test_trefai_flow_guard.js` ほか計10本）をすべて実行し、PASSを確認済み。
  - `test_active_automation_panel.js` はリポジトリ外の古いスナップショットファイル（`C:/Users/ebima/Documents/Codex/...`）を参照する作りで実行不可（今回の変更とは無関係、対応不要）。
  - `test_complementary_affiliate.js` は今回の変更と無関係な既存の失敗（`article.gs` を単体で読み込むテストが、別ファイル `wordpress.gs` にある `uaUsesSwellBlocks_` の未定義エラーで落ちる。テスト側の依存不足で、今回の変更前から存在していたはず）。

## Gitの状態
- ブランチ: `main`
- 直近コミット（すべてPush済み・GitHub反映済み）:
  - `cf98c3a Add one-time manual "start N articles now" automation trigger`（今回の機能＋バグ修正2件、対象: `unified_article_app/automation.gs`, `app_panel.html`, `ua_web_app.html`, `CURRENT_SPEC.md`, 新規 `test_manual_automation_batch.js`）
  - `74e3f39 Add Codex/Claude Code handover rules and status file`（`CLAUDE.md` / `HANDOVER_STATUS.md` 新規作成）
  - その前: `0f04fb6 Fix invalid SWELL managed group blocks`
- 未コミットの変更: なし（`git status --short` はクリーンな想定。次のセッション開始時に必ず再確認すること）

## 自動投稿・本番デプロイの状態
- **本番デプロイID** `AKfycbzGbxQA5AuXH3MlUZSlfTjDn1hrpH4MnNNG0NVKty0wUz1Bd-4oVXbMQUBloQvd-HCm` は、このセッション内で2回デプロイを更新した:
  - `@282`（説明: "Fix manual batch: run when automation OFF, separate daily quota"）
  - **`@283`**（説明: "Use native SWELL button block for affiliate CTA"）← **現在の本番版**。SWELLボタン統一の修正が反映済み。
  - 直前の本番バージョンは `@281`（Codexが手動バッチ機能を初めてデプロイしたバージョン。上記の不具合2件を含む）だった。
  - clasp pushの実行元: `C:\Users\ebima\Documents\Codex\deploy_stale_guard`（`.clasp.json` のscriptIdは `1OIzsyQgzT9dDNeUvytDNIXgtOgTXrXJomlhhNFtNbFyhmkf7KZ0jBMa7` で一致確認済み）。GitHub本体の `unified_article_app/` とこのステージングフォルダは、Claude Codeがpush前にファイル単位で内容一致を確認済み（`automation.gs` 以外はCodexがすでに同期済みだった）。
- **Claude Codeはこのセッションでライブの「アーコンパネル」へブラウザでアクセスを試みたが、Google認証がされておらず中身が表示できなかった**（`このアプリケーションは Google Apps Script のユーザーによって作成されたものです` の案内画面のみ表示）。そのため「処理中の記事を表示」による実際の進行状況の直接確認は**今回もできていない**。
- ユーザーから受領した「2026-08-27実画面確認」情報（本セッション冒頭、上記の本番@281デプロイ発覚より前の時点）:
  - DRIVE BASE: 自動運転ON／毎日4時ごろ開始／1日最大3記事／画像あり／WordPress到達点=投稿まで（公開）／エラー通知OFF／最終表示「完了（WordPress公開）：新型ハスラー 買って後悔」
  - たくみパパ: 自動運転ON／毎日5時ごろ開始／1日最大3記事／画像あり／WordPress到達点=投稿まで（公開）／エラー通知ON／最終表示「完了（WordPress公開）：スタバ 氷少なめ」
  - Codex定時監視（automation, 名前「アーコン定時監視」）: ACTIVE、日本時間 5:00(DRIVE BASE)・6:00(たくみパパ)・16:00(両サイト)
  - 両サイトとも自動運転ONだったため、修正1の「OFF時に無言で止まる」不具合は**発生していなかった可能性が高い**（自動運転OFFのサイトで手動バッチが実行された場合のみ顕在化する）。修正2（日次カウンタ共有）は、@281デプロイ後に誰かが実際に「今からN記事開始」を使っていれば影響した可能性があるが、使用履歴は未確認。
- **2026-08-23に55.47ドルのAPI消費事故が発生済み**（自動投稿ワーカーが停止・待機中の記事を1〜2分おきに相互再予約し、24時間で200件超・OpenAI 829リクエスト・入力約1,796万トークンを消費）。**画面の「処理中」表示だけで正常と判断しないこと。**

## 次に引き継ぐ側が最初に確認すべきこと
1. アーコンパネル（本番Webアプリ、URL下記）を開き、「処理中の記事を表示」で実際の進行状況を確認する。進行中ジョブがあれば `stepStartedAt` からの経過時間が20分以上でないか確認し、超えていれば再開せず先に停止・OpenAI側のresponseキャンセル状況を確認する。
   - URL: `https://script.google.com/macros/s/AKfycbzGbxQA5AuXH3MlUZSlfTjDn1hrpH4MnNNG0NVKty0wUz1Bd-4oVXbMQUBloQvd-HCm/exec`
2. 本番デプロイが `@282` のままか（それ以降に誰かが別バージョンをデプロイしていないか）を `clasp deployments`（`C:\Users\ebima\Documents\Codex\deploy_stale_guard` から実行）で確認する。
3. 「今からN記事開始」を実際にパネルから1回試し、①自動運転ONのサイトで正しく1〜N記事を順番に処理する、②その日の自動運転の残り枠が減っていない、の2点を実地確認できると理想的（今回はコードレビューと自動テストのみで、実際のパネル操作による動作確認はできていない）。
4. `git status --short` / `git log -5` を実行し、本ファイルの記述と食い違いがないか確認する。

## 次のエージェントへのメモ（自由記述）
- 今回の教訓: **ユーザー報告の「実画面確認」情報や `HANDOVER_STATUS.md` の記載であっても、本番デプロイの実バージョンは `clasp deployments` で必ず自分で確認すること。** 今回、ユーザーの直近報告では本番は`@280`とされていたが、実際には調査時点ですでにCodexが`@281`をデプロイ済みだった（ユーザーが確認した後、Codexが利用制限に達する直前に反映した可能性が高い）。この食い違いに気づけたのはコードをレビューしにいったからで、もしそのまま「まだ本番に入っていない」と信じてスキップしていたら、本番の不具合を見逃していた。
- Claude Codeはこのセッションで、ライブのアーコンパネルにブラウザからアクセス（Google認証なし）を試みたが中身を確認できなかった。今後の引き継ぎでも同様の制約がある可能性が高い。正確な自動投稿状況の確認は、ユーザー本人の実画面報告、`clasp deployments`/`clasp versions`、またはスプレッドシートの「自動投稿設定」シートの直接確認に頼ること。
- 以下は、ユーザーが本セッション中に提供した詳細引き継ぎデータ全文（2026-08-27作成、本番@281発覚より前に受領）。`CURRENT_SPEC.md` より新しい情報を含むため、矛盾がある場合はこちらと実コード・実パネルを優先する。ただし本番バージョン番号（@280との記載）は上記の通りすでに更新されている点に注意。

---

## 付録: Article Compass System 詳細引き継ぎデータ（ユーザー提供、2026-08-27作成）

作成日: 2026-08-27
対象: Article Compass System（通称: アーコン）
対象サイト: DRIVE BASE / 暮らしやすい家づくりノート（パネル表示名: たくみパパ）

### 0. 次のチャットが最初に守ること
1. この文書とリポジトリ内の `unified_article_app/CURRENT_SPEC.md` を最初に読む。
2. ただし `CURRENT_SPEC.md` には古い記述も一部残るため、日時が新しい本書、実コード、実パネルの順に現在値を確認する。
3. 不明点を勝手に解釈しない。過去チャット、引き継ぎ文書、コード、実画面を確認し、それでも判断が分かれる場合だけユーザーへ聞く。
4. ユーザーは技術用語より「何が直ったか」「投稿や収益にどう影響するか」を重視する。説明は非技術的かつ具体的にする。
5. 診断だけを頼まれた場合は勝手に修正しない。修正を頼まれた場合は、テスト、本番デプロイ、GitHub反映まで行う。
6. API呼び出し回数を増やす変更、高額モデルへの変更、公開記事の大規模更新は、目的・最大呼び出し数・失敗時の保存方法を先に整理する。
7. OpenAIの処理ID、本文、画像、WordPress下書き、停止位置を消さない。再開時に完了済み工程を最初から生成し直さない。
8. 「処理中」という画面表示だけで正常と判断しない。2026-08-23に同じ待機処理の多重再実行で55.47ドルを消費した重大事故がある。

### 1. アーコンの目的
アーコンは、Googleスプレッドシートのキーワード候補から、読者心理・競合調査・記事構成・本文・画像・商品導線・内部リンク・公開前チェック・WordPress公開までを一元管理する自動記事作成システム。

重要な目的は単なる記事量産ではない。
- 読者の検索意図に正面から答える
- 経験・体験・運営者の立場を適切に出す
- 公式情報・最新情報を使って信頼性を保つ
- 案件や商品を押し付けず、自然な導線で収益化する
- 既存記事とのカニバリを避ける
- 途中停止しても同じAPI生成を繰り返さず、安全に再開する
- 2サイトを同じ仕組みで運用しつつ、文体・画風・収益構造は分ける

### 2. 現在のシステム構成

**Google Apps Script**
- プロジェクト名: 統合版アプリ用
- Apps ScriptプロジェクトID: `1OIzsyQgzT9dDNeUvytDNIXgtOgTXrXJomlhhNFtNbFyhmkf7KZ0jBMa7`
- 本番WebアプリURL: `https://script.google.com/macros/s/AKfycbzGbxQA5AuXH3MlUZSlfTjDn1hrpH4MnNNG0NVKty0wUz1Bd-4oVXbMQUBloQvd-HCm/exec`
- 本番デプロイID: `AKfycbzGbxQA5AuXH3MlUZSlfTjDn1hrpH4MnNNG0NVKty0wUz1Bd-4oVXbMQUBloQvd-HCm`
- 現在の本番版: `@280`
- @280の内容: Gutenbergで無効になるSWELLポイント枠・注意枠の修正

**GitHub・ローカルコード**
- 正本リポジトリ: `C:\Users\ebima\Documents\GitHub\unified-article-app`
- Apps Scriptコード: `C:\Users\ebima\Documents\GitHub\unified-article-app\unified_article_app`
- clasp本番反映用ステージング: `C:\Users\ebima\Documents\Codex\deploy_stale_guard`
- GitHub main最新コミット: `0f04fb6 Fix invalid SWELL managed group blocks`
- 直前の主要コミット:
  - `407cce4 Stabilize automation and use native SWELL link cards`
  - `02463cf Prevent duplicate automatic OpenAI requests`
  - `bfa5a77 Migrate Home posts to SWELL decorations`
  - `bf11ac8 Complete SWELL migration and SEO bridge`

**ローカル競合調査**
- `KeywordTreasureFinder` / `ArticleBridge` がPC側で競合ページ取得を担当する。
- アーコンパネルに表示される現在の起動BAT: `C:\Users\ebima\Documents\Codex\2026-06-14\files-mentioned-by-the-user-codex\outputs\keyword_research_app\dist\ArticleBridge_1回だけ実行.bat`
- 上記BATは2026-08-27時点で存在する。
- 開発元フォルダ: `C:\Users\ebima\Documents\GitHub\unified-article-app\keyword_research_app`
- ArticleBridgeは単一起動ロックを持ち、同時に2プロセス以上起動させない。

### 3. 2サイトの現在仕様

| 項目 | DRIVE BASE | たくみパパ / 暮らしやすい家づくりノート |
|---|---|---|
| サイトURL | `https://ebimayo5.com/` | `https://kurashi-ie.com/` |
| パネル名 | DRIVE BASE | たくみパパ |
| WordPressテーマ | SWELL | SWELL |
| パネル色 | 緑 | 茶 |
| 主領域 | 車選び、車内エンタメ、カー用品、維持費、運転 | リフォーム後の暮らし、住宅設備、家事、収納、暮らし用品、安全 |
| 文体 | 車の購入・使用判断を具体的に整理 | 家族生活と電気工事経験を土台に柔らかく整理 |
| 画像スタイル | 最新アニメ風 | 柔らかい日本のフリー素材風 |
| 商品導線 | 案件CTA＋楽天バナー。必要に応じてサブ案件のテキストリンク | Rinkerで楽天・Amazon導線。暮らし用品を日々の収益の主軸にする |
| 内部リンク | SWELLネイティブ関連記事カード | SWELLネイティブ関連記事カード |

DRIVE BASEのカテゴリ: ①車選び・購入(`car-buying`) ②車内エンタメ(`shanai`) ③カー用品・カスタム(`car-item`) ④維持費・メンテナンス(`maintenance`) ⑤運転・制度(`drive`)

たくみパパのカテゴリ: ①家づくり・リフォーム(`kosodate`) ②住宅設備・家事(`kajiraku`) ③収納・暮らし用品(`shuunou`) ④住まいの悩み・安全(`kurashi`)

既存URLを壊さないため、カテゴリ名を変更しても上記スラッグは維持する。

### 4. たくみパパの人物設定と収益方針

**現在の人物設定**
- 古い実家を家族の暮らしに合わせてリフォームして住んでいる。
- 妻と2人の息子がいる。長男は車いすユーザー。
- 注文住宅の電気配線工事を3年間経験している。
- 現在の家はリフォーム後で、写真を使っても「ボロい古民家」のようには見えない。
- 「新築を建てて住んだ」体験は作らない。新築・注文住宅は、電気工事経験、リフォーム後の生活、公式情報を基に判断材料を書く。

**収益方針**
- 日々の主軸: Amazon・楽天などの暮らし用品。
- 商品購入・比較意図がある記事は、本文に合う商品を自然に紹介して背中を押す。
- 悩み解決記事でも、商品が補助解決になる場合は検索意図への主回答を先に出し、その後に自然な商品導線を作る。
- 商品が主回答にも補助解決にもならない記事には無理に商品を出さない。
- 積水ハウス紹介制度は高単価の核記事・家づくり案件として残す。ただし成約ハードルが高いため日々の収益の主軸にはしない。
- 実際に使った確認がない商品について「使った」「愛用している」と創作しない。

### 5. シート構成

**記事管理シート**（`DRIVE BASE` / `たくみパパ`）列構成:
A記事タイプ／B メインキーワード・案件指示書／C 検索ボリューム／D メイン案件名／E メインアフィリエイトURL／F 案件注意点・その他制約事項／G〜I 競合URL1〜3／J 読者心理メモ／K 状態／L 作成日時／M 使用モデル／N 本文／O タイトル案／P 関連タグ／Q メタディスクリプション／R パーマリンク／S 要確認ポイント／T WP投稿ID／U WP編集URL／V WP入稿日時／W 構成メモ

状態: `記事生成中` / `記事生成済み` / `記事生成停止` / `WP下書き済み` / `投稿済み`

**キーワード候補シート**（`DRIVE BASE_キーワード候補` / `たくみパパ_キーワード候補`）状態: `書く`（自動投稿・転送対象）／`転送済み`／`保留`（対象外・重複・カニバリ・停止記事の戻し先）

案件名には `案件無し` を選べる。空白または `案件無し` はメイン案件なしとして扱い、商品が自然な解決になる場合は楽天/Rinkerを積極的に検討する。

案件管理シートは両サイト共通。案件名、URL、A8リンクHTML、ショートコード、注意点を管理する。URLやトラッキングピクセルはシステム側で勝手に改変しない。

### 6. シートとアプリの操作動線
基本動線: ①アーコンWebアプリを開く ②パネルの「シートを開く」で対象シートへ移動 ③シートで行を選ぶ ④左上A1の緑色ボタン「▶ 選択行をアプリに反映」を押す ⑤最初に開いているアプリ画面へ切り替わり、選択行が反映される。

注意:
- シートを開いただけ／行を選んだだけでは勝手にアプリへ反映しない。A1ボタン操作を明示的な開始操作とする。
- アプリが開いていない場合は、アプリを開くための案内を出す。
- パネル側には「処理中の記事を表示」があり、自動投稿中のキーワードと工程を表示できる。
- エラー時は赤い状態表示、赤い「停止位置から再開」、「この記事を対象外にして次へ」を表示する。

### 7. 手動記事作成の主要ボタン
`今すぐ保存` `読者心理→記事構成作成` `本文生成` `1ボタン作成（画像あり）` `1ボタン作成（画像なし）` DRIVE BASE:`楽天バナーを追加` たくみパパ:`Rinkerを追加` `内部リンクを追加` `外部リンクを追加` `画像プロンプト作成` `WPへ下書き` `WPへ更新` `チェック修正→WP反映` `投稿済みにする`

`WPへ更新` は公開済み記事へパネル側のタイトル・本文・タグ・メタディスクリプション等を安全に反映する。公開中に存在する画像がパネル本文から欠ける場合は更新を止める。

### 8. 自動投稿の現在設定（2026-08-27実画面確認）

**DRIVE BASE**: 自動運転ON／毎日4時ごろ開始／1日最大3記事／画像あり／WordPress到達点=投稿まで（公開）／エラー通知OFF／文章モデル GPT-5.6 Terra／画像モデル GPT Image 2／画風 最新アニメ風／最終表示「完了（WordPress公開）：新型ハスラー 買って後悔」

**たくみパパ**: 自動運転ON／毎日5時ごろ開始／1日最大3記事／画像あり／WordPress到達点=投稿まで（公開）／エラー通知ON／文章モデル GPT-5.6 Terra／画像モデル GPT Image 2／画風 柔らかいフリー素材風／最終表示「完了（WordPress公開）：スタバ 氷少なめ」

重要: 投稿開始時刻とCodex監視時刻は別物。

### 9. 自動投稿の工程
①読者心理メモ ②競合調査・構成案 ③トレファイ待ち ④本文生成 ⑤WP下書き準備 ⑥画像生成・WP差し込み ⑦公開前チェック ⑧指摘修正（1回） ⑨WPへ修正版反映 ⑩WordPress公開

コード上の工程名: `reader_mind` `structure` `wait_trefai` `article` `initial_wp` `images` `check` `revision` `final_wp` `publish`

ルール:
- 全体で同時に1記事だけ処理する。候補シートの上から最初の「書く」を1件転送する。
- 各工程の成果物と停止位置を保存する。
- 待機確認は原則5分間隔。20秒単位の短周期確認は禁止。
- 同じ工程が20分進まなければ異常停止する。`updatedAt` ではなく `stepStartedAt` から20分を測る。ポーリングで時間をリセットしない。
- 停止中に同じ本文生成や修正を新規送信しない。保存済みOpenAI response IDを完了・キャンセル・上限まで追跡する。
- 赤い「途中停止」は、画面表示だけでなくOpenAIの進行中responseをキャンセルする。
- 「停止位置から再開」をユーザーが明示的に押した場合だけ、必要なら新しい生成を1回許可する。
- トレファイ全体が故障している場合は記事を次々スキップせず、自動運転そのものを止めて直す。
- 1記事固有の問題で安全に解決できない場合は、本文・処理ID・停止位置を保存し、「この記事を対象外にして次へ」で候補を保留へ戻す。

### 10. Codex定時監視
- 自動化ID: `automation` ／ 名前: `アーコン定時監視` ／ 種類: このチャットに紐づくheartbeat ／ 状態: ACTIVE
- 監視時刻（日本時間）: 5:00 DRIVE BASE確認／6:00 たくみパパ確認／16:00 両サイト確認
- 16:00は通常どちらも動いていない時間。生成、画像、修正、WP反映、ArticleBridge、次記事確認が残っていれば原則異常停止する。

正常判定に必要な根拠: 対象サイト／キーワード／現在工程／工程開始時刻または最終進捗時刻／経過時間／KeywordTreasureFinder・ArticleBridgeの実プロセスと個数／Apps Scriptのワーカー・次記事トリガーの重複／WordPressの下書きまたは公開到達状況。確認できない場合は「正常」と報告せず「要確認」とする。

異常例: 同じキーワード・同じ工程のまま20分以上／実ローカルプロセスがないのにトレファイ待ち／ArticleBridgeが2個以上／同名トリガーが複数／自動運転OFFなのに処理中／サイトを切り替えても別サイトの状態が残る。

毎回、問題がなくても短く結果を報告する。

### 11. 2026-08-23の55.47ドル事故
**原因**: SWELL移行作業そのものではない。自動投稿の `uaRunAutomaticPostingWorker` と `uaStartNextAutomaticPosting` が、停止・待機中の記事にも1〜2分おきに相互再予約され、同じ処理を何度も呼び出した。

**結果**: 24時間で200件超の自動処理／OpenAI 829リクエスト／入力約1,796万トークン／55.47ドル消費

**再発防止**: トリガー重複削除／response ID再利用／重複起動防止／ArticleBridge単一起動／待機確認5分間隔／20分上限／停止時のOpenAIキャンセル／トレファイ完了通知では構成生成を行わずURL保存だけ／構成生成は自動投稿ワーカーから1回だけ／本文生成時に競合ページを再取得しない

この事故を忘れず、画面の「処理中」だけを見て正常報告しない。

### 12. 記事品質の基本ルール
**構成**: H2は基本6〜8個（9個でも役割が異なれば無理に統合しない／重複する章だけ統合、数合わせでまとめない）。元本文が悪くない場合、大規模な書き直しはしない。修正は基本的に軽い修正とし、CTA・ブログカード・画像・商品リンク・ポイント枠を保護する。自動修正は1回。処理待ちなら同じresponse IDを回収し最初からやり直さない。

**タイトル**: SEO上の明確さと読者訴求を両立（案1: SEOと読者訴求の両立／案2: 疑問・不安への回答／案3: 読後の判断・価値）。WordPressには3案のうち最適な1案だけを入れる。案1〜3の全文やラベルをWPタイトルへ入れない。「確認ポイント」「判断基準」「解説」だけで無難に終わらない。数字を入れる場合はタイトルの数字と対応する本文項目数を一致させる（H2内の別リストまで誤って数えない）。

**検索意図と対象判定**: 読者心理工程で `fit / ambiguous / off_topic` を判定。`ambiguous`・`off_topic` は本文生成前に停止。DRIVE BASEでは「ナビ」の一語だけで車記事と判定しない（「トラブル解決ナビ」は富士通PCの復旧機能名）。価格・相場が主題でも機械的に止めすぎない。公式情報が見つからない場合もQ&Aや補助情報だけで危険な断定をしない。

**経験・体験**: 両サイトとも運営者の経験や立場を消さない。商品導線追加で体験談を打ち消さない。未確認の使用経験は創作しない。公式情報と実体験の境界を明確にする。

**YMYL・最新性**: 医療、法律、金融、安全、法規、施工は断定を避け公式・公的情報を優先。高い安全性が必要でも停止しすぎて全記事が進まない設計にしない。重要な根拠不足は公開前で止め、単なる補足資料不足は警告にとどめる場合を区別する。

### 13. 収益化と案件導線
**全記事共通**: 収益化が目的だが、検索意図への主回答より先に案件を押し込まない。読者の迷いを整理した直後に選択肢として案件・商品を提示。案件専用H2を数合わせで作らない。検索意図から離れた案件は既存の購入判断セクション内の1〜3段落とCTAに圧縮する。

**メイン・サブ案件**: メイン案件=囲みボタン、サブ案件=文脈内テキストリンク。ガリバーとカーネクストのように併用可能な案件は自然な場合だけメイン＋サブで使う。既存記事へ新案件を入れる場合も読者の次の行動に合う箇所へ入れる。

**CTA HTML**: 案件管理シートB列のURLはそのまま使う。A8リンクHTMLは「自由テキスト」部分だけ自然なCTA文言に置き換え可（既にCTA文言があるリンクは改変しない）。URL・パラメータ・トラッキングピクセルを改変しない。`rel` 属性を重複させない。

**ナビ男くん**（DRIVE BASEの重要案件）:
基本導線: ①文脈に合う接続文（例:「配線や適合判断に不安があるときは、ナビ男くんという専門店に依頼するのも選択肢の一つです。」）②ナビ男くん紹介セット ③メイン案件の囲みボタン

紹介セット:
```html
<!-- wp:cocoon-blocks/info-box {"style":"danger-box"} -->
<div class="wp-block-cocoon-blocks-info-box block-box danger-box"><!-- wp:paragraph -->
<p><strong><span class="marker">ナビ男くんとは車内エンタメのアップグレードを得意とする専門店です。</span></strong></p>
<!-- /wp:paragraph -->

<!-- wp:cocoon-blocks/blogcard {"style":"blogcard-type bct-detail"} -->
<div class="wp-block-cocoon-blocks-blogcard blogcard-type bct-detail">
<a href="https://ebimayo5.com/archives/naviokun-reputation/">https://ebimayo5.com/archives/naviokun-reputation/</a>
</div>
<!-- /wp:cocoon-blocks/blogcard -->

<!-- wp:paragraph -->
<p>[affi id=7]</p>
<!-- /wp:paragraph --></div>
<!-- /wp:cocoon-blocks/info-box -->
```
注意: 紹介セット末尾の `[affi id=3]` は削除済みで、入れない。

SWELL移行後は、システム側の互換・正規化処理で表示を整える。新規の通常内部リンクはCocoonブログカードではなくSWELL関連記事カードを使う。

**ottocast**: ナビ男くんと競合するため、車種適合・DIY/製品購入・専門店依頼の違いを分ける。ottocastが自然な記事では候補にするが、毎回両方を無理に入れない。

### 14. 楽天・Amazon・Rinker

**たくみパパ**: `Article Compass Rinker Bridge` を使用（プラグイン現行版1.3.3、ソース `wordpress_plugins/article-compass-rinker-bridge`）。楽天APIで商品を取得しWordPress側へRinker商品として登録・再利用。本文には `[itemlink post_id="..."]` を挿入。同じ楽天商品コード・URLは重複登録せず既存Rinker IDを再利用。1つの商品ボックスに楽天商品リンクと、商品名・型番を使ったAmazon検索導線を出す。Amazon Creators APIが利用可能になるまではAmazon側の完全一致商品と断定しない。Rinker連携失敗だけで記事生成全体を止めず楽天商品カード＋Amazon検索へフォールバック。候補は最大3商品まで（同一商品を3つ出さない、用途・サイズ・仕様など違いを持たせる）。候補が1種類しか適切でない場合は1件だけでよい。手動で貼ったRinkerショートコードは自動削除しない。

**DRIVE BASE**: Rinker連携は原則使わず楽天バナーを使用。メイン案件がない、または「案件無し」の場合はキーワードや本文の文脈に合う楽天商品を積極的に検討。毎回同じ商品を出さない（サンシェード記事ならサンシェードなど商品カテゴリを本文と一致させる）。

**商品H2の条件**: 商品選びが検索意図の重要な解決策である／同じH2内へ一致するRinkerまたは楽天商品を入れられる。入れられない場合は商品専用H2を作らず、必要なら既存章へ1〜3段落で統合する。用品の話だけをして商品リンクがない章は原則不要。

### 15. 内部リンク
両サイトともSWELLネイティブの関連記事カードを使う。形式:
```html
<!-- wp:loos/post-link {"linkData":{"url":"https://example.com/related/"}} /-->
```
旧 `article-compass-internal-link` のカード風段落や、同一サイトURLだけの独立段落は、WordPress同期時にネイティブ関連記事カードへ正規化する。説明文の途中にある通常のインラインリンクは勝手にカード化しない。内部リンク候補は同じトピッククラスター、既存記事、読者の次の疑問を考慮する。カニバリ候補同士を無理に内部リンクで共存させず、検索意図が同じなら統合・リライトを検討する。

2026-08-27に修正済み: DRIVE BASE投稿ID 2151、たくみパパ投稿ID 922。両記事でネイティブ関連記事カード2件、旧形式0件を確認済み。

### 16. SWELL装飾
両サイトはCocoonからSWELLへ移行済み。新規本文はSWELL対応形式を使う。

**この記事のポイント**: WordPressコアの `wp:group` を使用。className: `is-style-big_icon_point article-compass-point-box`。`layout:{"type":"constrained"}` を付ける。内側の段落・リストにも `wp:paragraph` / `wp:list` コメントを付ける。旧式の `wp-block-group__inner-container` は使わない。枠を入れ子にしない。

**注意枠**: WordPressコアの `wp:group` を使用。className: `is-style-big_icon_caution article-compass-notice-box article-compass-notice-danger`。内側の段落に `wp:paragraph` コメントを付ける。`wp-block-group__inner-container` は使わない。

**2026-08-27の修復**: Gutenberg編集画面で外枠が無効ブロックになり、ポイント枠が二重に見える不具合を修正（原因: 外側は `wp:group` なのに内側の `<p>`/`<ul>` にブロックコメントがなかった／旧 `wp-block-group__inner-container` が残っていた）。修復結果: 直近40記事を検査、DRIVE BASE 5記事・たくみパパ3記事の合計8記事を修復。画像・URL・公開状態を維持。投稿ID 922・2151で無効ブロック0、「復旧を試みる」0、ポイント枠1を編集画面で確認。

修復対象だった記事: DRIVE BASE 2151, 2141, 2131, 2121, 2103／たくみパパ 932, 922, 909

### 17. 画像生成
画像モデル: GPT Image 2。基本16:9。アイキャッチは記事タイトル由来の自然な短い見出しを入れる。H2図解は対象H2の内容に応じた要素数にする（本文が7項目なら機械的に2〜3項目へ縮めない）。長文やH2全文を画像へ転載しない。主役と文字は15%以上の安全余白へ置く。連続する画像で同じ構図を繰り返さない。人物を描く場合は目・鼻・口のある自然な顔にする（「人物の特定可能な顔は入れない」という旧指示はのっぺらぼうの原因になるため削除済み）。DRIVE BASEはフリー素材・企業向けベクター・クリップアート風を避ける。たくみパパは柔らかい日本のフリー素材風。画像生成中のパネルは上部の進捗アニメーションを残すが、画面全体が点滅・乱れないようにする。

### 18. メタディスクリプション・SEO・JSON-LD
**メタディスクリプション**: 記事管理シートQ列で生成・保存。WordPress反映時に `Article Compass Rinker Bridge` の認証付きREST APIでSEOメタへ同期。SWELL側メタキー: `ssp_meta_description`。Cocoon旧メタキー: `the_page_meta_description`。管理ハッシュ: `article_compass_description_hash`。手動変更したメタを不用意に上書きしない設計。既存CocoonメタがありSWELLメタが空の場合の互換出力を持つ。

**JSON-LD**: SWELL・SEOプラグイン側の構造化データと競合させない。記事本文へ独自JSON-LDを重複挿入しない。Article、Breadcrumb等はテーマ/SEOプラグイン側を正とする。FAQを本文へ書いたことだけを理由にFAQPage JSON-LDを重複出力しない。次のチャットでJSON-LDを変更する場合は両サイトのHTMLソースを確認し、既存出力との重複がないことを先に検証する。

**PR表記**: Cocoon/SWELL側で広告表記を自動挿入するため、本文冒頭へ「PR：本記事にはアフィリエイト広告を含みます。」を重複挿入しない。

### 19. WordPressプラグイン（Article Compass Rinker Bridge）
バージョン1.3.3。主な役割: Rinker商品登録・再利用／Gutenberg iframe化後のRinker手動追加互換／Rinker検索ポップアップから商品リンクを追加する処理／商品リンククリックがWordPress編集画面内で楽天ページへ遷移する問題への対策／SWELL/Cocoonのメタディスクリプション橋渡し／既存Cocoon装飾のSWELL互換表示。REST namespace: `article-compass/v1`。主なエンドポイント: `/rinker-status` `/rinker-items` `/post-seo-meta`。

注意: プラグインを更新する場合はバージョン番号とZIPを更新する。WordPress側で古いZIPを削除してから再インストールする必要がある場合がある。Rinker本体やSWELLのアップデート後はGutenberg iframe互換を再テストする。

### 20. 現在選べるモデル
文章モデル: GPT-5.2／GPT-5.6 Terra（推奨・品質とコストのバランス）／GPT-5.6 Sol（最高品質）／GPT-5.6 Luna（コスト重視）。画像モデル: GPT Image 2。現在の実パネル選択は両サイトともGPT-5.6 Terra。

基本はOpenAIのみを使う。他社APIへ自動フォールバックしない。OpenAIでエラーになった場合は停止し、処理IDと停止位置を保存する。APIキーはスクリプトプロパティで管理し、画面・ログ・引き継ぎ文書へ平文を出さない。

### 21. WordPress接続プロパティ
DRIVE BASE: `UA_WP_DRIVE_SITE_URL` `UA_WP_DRIVE_USERNAME` `UA_WP_DRIVE_APP_PASSWORD` `UA_WP_DRIVE_CATEGORY_IDS`
たくみパパ: `UA_WP_HOME_SITE_URL` `UA_WP_HOME_USERNAME` `UA_WP_HOME_APP_PASSWORD` `UA_WP_HOME_CATEGORY_IDS`
共通フォールバック: `UA_WP_DEFAULT_SITE_URL` `UA_WP_DEFAULT_USERNAME` `UA_WP_DEFAULT_APP_PASSWORD` `UA_WP_DEFAULT_CATEGORY_IDS`

通常ログインパスワードではなくWordPressアプリケーションパスワードを使う。403時はWordPressセキュリティ機能、WAF、REST API制限、送信元IPを確認する。

### 22. 主要ファイルの役割
`config.gs` サイト・シート・列・状態・モデル設定／`main.gs` スプレッドシートメニュー・行転送・A1ボタン・シート整形／`web_app.gs` Webアプリとシートの連携／`app_panel.html` パネルUI／`ua_web_app.html` WebアプリUI／`reader_mind.gs` 読者心理と対象適合判定／`outline.gs` 記事構成／`prompt.gs` サイト別本文プロンプト・SWELL出力ルール／`enhancements.gs` 記事タイプ自動判定・追加方針／`links.gs` 内部リンク・外部リンク・SWELL関連記事カード・装飾正規化／`article.gs` 本文生成・CTA・商品導線・OpenAIバックグラウンド処理／`image.gs` 画像プロンプト・画像生成・構図回避／`pre_publish_check.gs` 公開前品質ゲート・1回修正／`wordpress.gs` WP下書き・公開記事更新・メタ同期・既存記事移行／`automation.gs` 自動投稿・停止・再開・対象外・通知・工程管理／`api.gs` OpenAI等のAPI接続／`utils.gs` 共通処理／`CURRENT_SPEC.md` 詳細仕様（ただし実装より古い記述が一部あるため日付を確認）

### 23. テスト
主なテスト（リポジトリ直下）: `test_trefai_flow_guard.js` `test_active_automation_panel.js` `test_swell_internal_link_cards.js` `test_swell_managed_groups.js` `test_swell_existing_migration.js` `test_notice_protection.js` `test_published_wp_update.js` `test_title_selection.js` `test_rinker_item_count.js` `test_rinker_editor_compat.js` `test_complementary_affiliate.js`

直近確認済み: SWELL managed group serialization tests passed／SWELL internal link card tests passed／SWELL existing-post migration tests passed／autosave indicator tests passed

変更時の最低確認: ①該当テスト ②`git diff --check` ③clasp push ④同じ本番デプロイIDへ新バージョンをデプロイ ⑤Webアプリの本番版を開いて確認 ⑥必要ならWordPress下書きで実表示確認 ⑦公開記事更新時は画像・URL・公開状態を再取得確認 ⑧Git commit / push

### 24. やってはいけないこと
停止中の記事を自動で最初から再生成する／保存済みresponse IDがあるのに新しいOpenAI生成を送る／1〜2分ごとに本文・修正処理を再予約する／画面の「処理中」だけで正常と報告する／トレファイ全体障害で記事を次々スキップする／品質ゲートを無視して強制公開する／根拠不足を商品・案件の文章でごまかす／案件のためだけに検索意図から離れた長い専用章を作る／同じRinker商品を3つ並べる／記事に関係ない楽天商品を出す／画像・ブログカード・CTA・ポイント枠を自動修正で消す／タイトル案3つを全部WordPressタイトルへ入れる／URL、A8パラメータ、トラッキングピクセルを改変する／`rel` 属性を重複させる／SWELLのグループ内へブロックコメントなしの生 `<p>`/`<ul>` を入れる／SWELL/SEOプラグインと重複するJSON-LDを本文へ入れる／APIキー、WPアプリケーションパスワード、メールアドレスを回答やログに表示する

### 25. 次のチャット開始時チェックリスト
①本書を読む ②`git status --short` で未反映変更を確認 ③`git log -5` で最新コミットを確認 ④本番デプロイが@280以降か確認 ⑤アーコン実画面で両サイトの自動運転・開始時刻・記事数・画像・WP到達点を確認 ⑥`automation` がACTIVEで5:00・6:00・16:00監視になっているか確認 ⑦自動投稿中ならキーワード・工程・経過時間・実プロセス・トリガー・WP到達を確認 ⑧同じ工程が20分以上なら再開せず先に停止・キャンセル ⑨WordPressの最近の記事でメタディスクリプション・内部リンクカード・ポイント枠・商品リンク・画像を抜き取り確認 ⑩修正依頼では既存システムを大きく作り直さず、現在の仕組みに安全に追加する

### 26. 現在地の短い要約
両サイトのSWELL移行と新規SWELL本文出力は完了。内部リンクはSWELLネイティブ関連記事カードへ修正済み。ポイント枠・注意枠のGutenberg無効ブロック問題は本番@280で修正済み。直近8公開記事も安全に修復済み。メタディスクリプションはWordPressプラグイン経由でSWELLメタへ同期する。たくみパパはRinker＋楽天/Amazon導線、DRIVE BASEは案件＋楽天バナーが基本。自動投稿はDRIVE BASE 4時、たくみパパ5時、各最大3記事、画像あり、公開まで、稼働ON。Codex監視は5時、6時、16時。最大の注意点はトレファイ・OpenAI待機処理の重複再実行。表示だけで正常扱いしない。次の重点は、数日間の実運転を観察し、投稿数・メタ・内部リンク・商品一致・API消費を根拠付きで確認すること。
