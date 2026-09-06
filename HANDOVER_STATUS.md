# HANDOVER_STATUS

## 現在作業中（ライブ状況）
作業を始める前・区切りがつくたびに、必ずここを読み書きすること（CLAUDE.md / AGENTS.md の「並行作業ルール」参照）。
複数エージェントが同時に動く前提のため、このセクションだけは「最終更新」より新しい情報になり得る。

- 状態: 作業中
- エージェント: Claude Code
- 開始時刻: 2026-09-06 （このセッション開始時）
- やっていること: パネルに「お宝キーワード」タブ（3つ目のメインタブ）を新設中。対象ファイル: unified_article_app/keyword_discovery.gs（新規web-callableラッパー追加）, unified_article_app/web_app.gs（uaListCandidatesForWebに引数追加）, unified_article_app/ua_web_app.html（タブ・ビュー追加、showMainView書き換え）, test_treasure_keyword_discovery.js。既存の一回限り関数・本番データ書き換えロジックは変更しない設計。
- 本番影響: あり（予定）。コード変更後、ローカルテスト→clasp push→ブラウザでの動作確認→ユーザー確認の上でclasp deployまで行う想定。自動投稿の停止・再開は行わない。
- 完了内容（2026-09-06 Codex）: DRIVE BASE公開記事を全件検査し、旧Cocoon版ナビ男くん紹介セットが残っていた8件（post 2414/2424/2446/2456/2464/2474/2484/2512）を完全一致置換でSWELL版へ更新。再検出0件、8記事すべて公開画面で`article-compass-notice-box`表示を確認。本文再生成、自動投稿の停止・再開は行っていない。全38テストPASS。Claude Codeの完成済み変更がcommit/push済み（`048237e`、引き継ぎ`48f0c5a`）、HEADとorigin/main一致を確認後、同じWebアプリURLを本番バージョン342へ更新。`doGet`と`uaGetWebAppBootData`が342で完了していることを実行履歴で確認。
- 完了内容（2026-09-06 Claude Code、セッション全体の詳細引き継ぎ）:

  ## このセッションでやったこと（時系列）

  **お宝キーワード発掘機能の改善（keyword_discovery.gs）**
  1. AI提案キーワード追加時のデータ検証クラッシュ修正（`uaAppendAiSuggestedCandidates_`— 挿入後ではなく挿入前に`uaApplyCandidateSheetRules_`を呼ぶよう順序変更）。追加位置もシート末尾→2行目（先頭）へ変更。
  2. AI発掘プロンプトに「3単語以内」の条件を追加＋コード側でもフィルタ（`uaCountKeywordWords_`）。Rakko実測で4語以上はほぼ検索ボリューム0だったため。
  3. 手動評価（`uaEvaluateManualTreasureKeywords_`）の重複除外ロジックを、既存記事のみでチェックするよう修正（候補シート自体との重複チェックを削除）。理由: シートに既にある保留/書くキーワードを再評価する用途なので、候補シート照合だと100%弾かれてしまうため。
  4. DRIVE BASEの商品ひも付き判定が常にnullを返す不具合を発見（`uaGetMainKeywordProductProfile_`がhome限定にハードゲートされていた＝DRIVE BASEのお宝キーワード発掘は最初から機能していなかった）。DRIVE BASEの実態がRinker/楽天ではなく「案件」（案件管理シートに登録されたASPプログラム）中心という点を踏まえ、Geminiベースの新しい案件ひも付き判定`uaCheckTreasureKeywordOfferLinkage_`を新設。home側にも「Rinkerで拾えなかった分は案件ひも付きもフォールバックで見る」形で適用。
  5. 大量キーワードを1回のGemini呼び出しに渡すとJSONレスポンスが途中で切れて全滅する不具合を発見・修正。`uaChunkArray_`で12件ずつのチャンクに分割し、1チャンクの失敗が他チャンクを巻き込まないようにした（案件ひも付き判定・カニバリ判定の両方に適用）。
  6. 案件管理シートの「案件注意点」欄が空欄/一言だけの案件（ナビ男くん等）で、似た言い回しのキーワードでもGeminiのひも付き判定が不安定になる問題をユーザーが発見（「HDMIはナビ男くんの得意案件になるんだけどね」）。ナビ男くん含む案件10件について、実際の商品ページをWeb調査し、キーワード実例入りの詳細メモへ書き換え（`uaUpdateNaviokunNotes20260906`、`uaUpdateRemainingAffiliateOfferNotes20260906`）。
  7. **今回セッション後半で発見・修正した重大バグ**: 案件欄で絞り込むと対象が数百件規模になり、Gemini案件ひも付き判定のバッチ処理自体がGASの6分実行上限を使い切り、後続のSERP採点フェーズが始まる前に打ち切られる（DRIVE BASEの「ナビ男くん」全件評価で実際に発生: 150件中20件しか評価されず130件が「時間切れ」に）。`uaCheckTreasureKeywordOfferLinkage_`にも同じ時間予算（`UA_TREASURE_KEYWORD_EVAL_TIME_LIMIT_MS`=4.5分）を適用し、`processedKeywords`を返すことで「時間切れで未着手」と「問い合わせたが不一致」を区別できるようにした（誤って却下扱いにしない）。案件が0件の場合の早期returnでも同じ誤判定が起きるバグも合わせて修正。
  8. ユーザー指示で、案件欄＋ステータスで絞り込んで評価し、結果を新規行追加ではなく**元の行のステータスを直接書き換える**（合格→「AI提案」、不合格→「保留」）版を新設（`uaEvaluateAndUpdateCandidateRowsByAffiliateNameAndStatus_`）。DRIVE BASE「ナビ男くん」×「書く」38件で実行→合格5件・不合格33件。合格5件はユーザー指示で「書く」へ再昇格済み（`uaPromoteNaviokunAiSuggestedToWrite20260906`）。
  9. 上を一般化し、特定ステータス（転送済み）だけ除外して候補シート全体を洗い直す版も新設（`uaEvaluateAndUpdateAllCandidateRowsExcludingStatuses_`）。たくみパパで798行（うち転送済み50件を除外）を実行し完走: 合格17件・不合格742件・時間切れ0件。
  10. **書き込み時のもう一つの重大バグ**: たくみパパの候補シートだけステータス列のデータ検証に「AI提案」が登録されておらず、直接書き込みで例外→残り全行が書き込まれず失われる事故が発生。書き込み前に必ず`uaApplyCandidateSheetRules_`を呼ぶよう修正し、1行ずつtry/catchで1行の失敗が他行を巻き込まないようにした。

  **自動投稿の停止事故2件を調査・修正（本番影響あり、WordPress公開まで実施）**
  11. たくみパパ「空気清浄機 フィルター交換不要 デメリット」が記事構成工程でGASの6分実行上限にタイムアウトし、2回連続で自動スキップされた事故を調査。原因は`uaFetchCompetitorPageInfos_`（links.gs）が、`UrlFetchApp.fetchAll`が例外を投げた場合に競合ページ全件を1件ずつの逐次フォールバックへ落としており、応答の遅い/固まったサイトが1件でも混じると全体が長時間ブロックされる作り。GASの`UrlFetchApp`には個別リクエストを外部から打ち切る機能が無い（AbortController相当の機能なし）という制約を踏まえ、(a) 3分の時間予算で以降のURLを「時間切れのため未取得」として打ち切る、(b) 例外時は全件を逐次処理せずリストを二分して再帰的に`fetchAll`を試す（分割統治）よう修正。正常な大多数は並列フェッチの恩恵を受け、問題のあるURLだけが個別フェッチに絞り込まれる。
  12. たくみパパ「掃除機 バッテリー 寿命」が自動修正（revision）工程で「NGが1件残っている」を繰り返し、ウォッチドッグが2回自動再開しても解消しない無限ループに陥っていた事故を調査・修正・**WordPress公開まで完了**。
      - 原因: YMYLカテゴリ判定`uaDetectYmylCategory_`（article.gs）の「バッテリー交換」等の車両判定語が家電記事にも一致してしまい、掃除機記事がvehicle_safety扱いに誤判定。さらにAIの1回限りの自動修正が「本文に既存の異常発熱・液漏れ注意ブロックがあるため重複回避で追加しない」と判断（別種の安全警告と、YMYLの内容開示免責文言を混同）。結果、決定的ルールチェックが要求するYMYL開示文言（「一般的な情報」「専門家へ確認」等）が本文に無いまま、AI修正は完了済み扱いのため二度と送信されず、NGだけが永久に残る設計上の詰みになっていた。
      - 対応: (1) `uaDetectYmylCategory_`のvehicle_safety/vehicle_law判定をdrive限定に修正（home記事が誤って車両カテゴリにならないようにする恒久修正）。(2) 対象記事（たくみパパ post1290, row79）へ、既存のYMYL注意書き生成ロジック（`uaBuildYmylNoticeHtml_`+`uaFindYmylNoticeInsertionIndex_`、記事新規生成時と同じ関数）を再利用して不足分だけを直接追記（OpenAIへの再課金なし・本文の他部分は無改変）。(3) `uaResumeAutomaticPostingFromPanel('たくみパパ')`で自動投稿を再開し、revision→final_wp→publishまで自動進行。WordPress側で直接確認済み: **公開済み**（https://kurashi-ie.com/vacuum-cleaner-battery-lifespan/、post ID 1290）。本文に注意書きが実際に反映されていることも確認済み。

  ## Gitの状態
  コミット・push済み（`048237e`、2026-09-06 Claude Code）。対象6ファイル: `HANDOVER_STATUS.md`, `test_treasure_keyword_discovery.js`, `unified_article_app/article.gs`, `unified_article_app/keyword_discovery.gs`, `unified_article_app/links.gs`, `unified_article_app/pre_publish_check.gs`（+448/-21行）。全ファイルは既にclasp pushで本番Apps Scriptへも反映済み（コード上は本番稼働中）。※当初「コミットはCodex側が担当」の取り決めだったが、ユーザー指示「コミットはためずにその都度やって」によりClaude Code側で都度コミットする方針に変更（以後のセッションもこまめにcommit→pushすること）。

  ## 衝突リスク（並行作業ルール関連）
  この完了内容を書いている時点で、HANDOVER_STATUS.mdの「現在作業中」欄にCodexが「DRIVE BASEのナビ男くん紹介セットをSWELL版へ置換し、同一Apps Script WebアプリURLへclasp push/デプロイ予定」と記載していた。Codexのローカル環境が私（Claude Code）のこの6ファイルの変更を取り込まないままclasp pushすると、本番Apps Scriptから今回の修正（特にYMYLバグ修正・競合ページ取得タイムアウト対策）が上書きされて消える可能性がある。次のエージェントは、作業開始時に必ず本番のkeyword_discovery.gs/links.gs/article.gs/pre_publish_check.gsの内容を確認し、今回の修正（下記の関数群）が実際に残っているか確認すること。

  ## 一時診断・ワンオフ関数（cleanup候補、実害なし）
  `keyword_discovery.gs`: `uaInspectAffiliateOffers20260906`, `uaInspectAffiliateOffersWithUrl20260906`, `uaUpdateNaviokunNotes20260906`, `uaUpdateRemainingAffiliateOfferNotes20260906`, `uaEvaluateNaviokunCandidatesDrive20260906`, `uaPromoteNaviokunAiSuggestedToWrite20260906`, `uaEvaluateAllHomeCandidatesExceptSent20260906`, `uaCountHomeCandidatesExceptSent20260906`
  `pre_publish_check.gs`: `uaInspectStaleVacuumBatteryRow20260906`, `uaFixStaleVacuumBatteryYmylNotice20260906`, `uaInspectCurrentAutomaticPostingJob20260906`, `uaResumeStaleVacuumBatteryJob20260906`
  いずれも読み取り専用または対象を厳密に限定したワンオフ処理で、残っていても実害はない。不要なら次回整理してよい。

  ## 未完了・次回検討事項
  - DRIVE BASEの「ナビ男くん」案件で、書く以外のステータス（保留等、全体で100件超）はまだ再評価していない（今回はユーザー指示で「書く」ステータスのみに絞った）。必要ならユーザーに確認の上、同じ関数パターンで拡張可能。
  - たくみパパの798件洗い直しで合格した17件は「AI提案」ステータスのまま。ナビ男くんの5件のようにユーザーが個別に「書く」へ昇格させるかは未確認・未対応。
  - ユーザーから好意的に受け止められた提案（未実装）: お宝キーワード評価をアドホックなApps Script関数ではなく、パネルの3つ目のタブとして正式なUIにする案（「パネルのタブ3つめにできるね」）。
  - 自動投稿は現在通常稼働中（意図的に停止していない）。今回発見した2件の停止事故はどちらも個別記事の内容起因（YMYL判定・競合ページ遅延）で、自動投稿システム自体の恒久停止が必要な種類の問題ではない。
- 完了内容（2026-09-04 Claude Code、続き3）: 前項の購入検討ワード修正を受けて、ユーザー指示「直して」でpost433（ランドリーチェスト記事）のライブ本文も修正。旧「湿気が強い家は除湿機も候補に入れる」セクション（見出し・本文2段落・商品リンク・画像2枚）をまるごと除去し（`uaFixLaundryChestPostMissingProduct20260904`、境界はwp:heading単位で正確に特定）、`uaApplyRakutenAffiliateBanner_`を再実行してテーマ通りの「ランドリー収納 カビ防止 チェスト」商品を新規挿入。除去に伴い画像2枚（AI生成の挿絵ID452、旧除湿機商品の楽天CDN画像）が欠落する点は診断関数`uaInspectLaundryChestPostImage452Position20260904`でどちらも除去対象セクション専用と確認した上で、想定内の欠落として安全チェックを調整（画像ID・rakuten.co.jpドメインでフィルタ）。ライブ確認済み（除湿機の話は本文から完全に消え、見出し構成は自然につながり、新しいバナーは本物のランドリー収納商品にリンク）。git push済み（`8df7521`）、clasp push済み。
- 完了内容（2026-09-04 Claude Code、続き2）: ユーザーとの「そもそも売れる未来が見えない」という戦略的な話から発展し、実データで根本原因を特定。①たくみパパの「書く」ステータス候補25件のうち商品ひも付き判定されたのは**0件**（`uaInspectHomeCandidateProductLinkageCoverage20260904`で確認）。②サイト内トラフィック1位の記事（ランドリーチェストのカビ対策、post433）にテーマ商品（チェスト）の商品リンクが1つも無く、無関係な除湿機のテキストリンクだけが入っていた（`uaInspectLaundryChestPostProductLinkage20260904`で確認）。③GA4で外部リンククリックが28日でサイト全体9回・3ユーザーのみ（511ユーザー中）と判明。根本原因は`uaGetMainKeywordProductProfile_`の購入検討シグナル判定（article.gs）が「比較」「おすすめ」等の明示語しか見ておらず、「カビない」のような品質評価語（実質は同じくらい強い購入シグナル）を認識できていなかったこと。`hasPurchaseIntent`正規表現へカビ・におい・汚れ・傷・劣化・へたる・壊れやすい・耐久・コスパ等の評価語を追加して修正。回帰テスト`test_product_purchase_intent_quality_words.js`新規追加（既存の「エアコン うるさい 原因」等の誤判定防止テストは維持されることも確認済み）。全テストPASS、git push済み（`0104613`）、clasp push済み。**まだライブのランドリーチェスト記事(post433)自体は直していない**（コード修正のみ。この記事へ実際にチェスト商品を挿入し直すかはユーザー確認待ち）。
- 完了内容（2026-09-04 Claude Code、続き）: ユーザー報告「kurashi-ie.com/shutter-closed-all-the-time-demerits/ 商品選択,,,」に対応。原因は`uaApplySecondaryProductMention_`（本文中の単語1語だけを拾うセカンダリ商品メンション機能）が、productPlanなしで`uaFetchRakutenItems_`を呼ぶため`uaScoreRakutenItem_`のmustHave/exclude等の絞り込みが一切効かず、クエリ「照明」に対して楽天APIが返した最上位商品が商品名に「照明」を含むだけの無関係な物（デュエル・マスターズのトレーディングカード「照明魚」）だったこと。既存の`uaIsRakutenProductQueryRelevant_`（クエリの概念だけを判定）ではこの種の取り違えを検出できないため、実際に取得した商品名そのものを判定する新しい関所`uaIsRakutenItemNameRelevant_`（article.gs）を追加し、`uaApplySecondaryProductMention_`内で商品名確定直後に適用。回帰テスト`test_rakuten_secondary_item_name_relevance.js`を新規追加、既存2本（`test_rakuten_secondary_product_category.js`・`test_used_car_rakuten_skip.js`）にGeminiスタブを追加して復旧。全テストPASS。ライブ記事（post1245）は一回限り関数`uaFixShutterPostBadSecondaryMention20260904`（wordpress.gs）で修正済み（`uaApplyRakutenAffiliateBanner_`を再実行してセカンダリメンションだけ再評価→新しい関所がトレーディングカードを弾く→`uaUpdatePublishedWpFromPanelCore_`経由でWPへ反映、公開状態・既存画像・除湿機バナー3件は維持）。ライブ確認済み（`照明魚`は本文から消え、見出し構成・除湿機商品ブロックは無傷）。git push済み（`f8f503c`）。clasp push済み。
- 完了内容（2026-09-04 Claude Code）: サーキュレーター記事カニバリ対応が完了。post1190はユーザーがパネルで本文再生成・画像追加・WP更新を実施し、ライブに反映済み（タイトル「外れないサーキュレーターを壊さず掃除する4つの判断」、画像は新規3枚1216/1218/1220に入れ替わり旧手順写真は正しく除去、ブランド比較コンテンツあり）。最後に残っていたstructureMemo指定の内部リンク（post1158アイリスオーヤマ記事へ）は、本文再生成では反映されなかったため、一回限り関数`uaAddIrisohyamaCrossLinkToCirculatorCoverPost20260904`（wordpress.gs、`uaInsertBareUrlLinkBeforeHeading_`を再利用）で手動挿入し、ライブ反映を確認済み（`hasIrisLink:true`）。ユーザーが「WP更新」で見た「画像が3件欠落」エラーはバグではなく既存の画像保護ガードが正常に働いた結果だった（旧画像が新本文に無いため）ことも確認済み。診断用一回限り関数`uaInspectCirculatorRow1190CurrentBody20260903`も追加（読み取り専用）。git push済み（`10610e9`, `43cae96`）。clasp pushは実施済み（デプロイ`@341`のまま、Webアプリのコード自体は変更していないためデプロイ更新は不要）。
- 完了内容（2026-09-02 Claude Code）: サーキュレーター記事カニバリゼーション対応。post1190（行69）のstructureMemo/titleIdeasを、アイリスオーヤマ記事（post1158）との重複を避ける方向（ブランド横断比較・型番不明時の判断・修理vs買い替え）へ書き換え済み（`uaRewriteCirculatorRow1190StructureMemo20260902`実行済み、1913字→930字）。bodyとstatusは触れていない。**次のステップ: ユーザーがパネルの詳細編集タブで行69を開き、本文を再生成する必要がある**（安全のため、この作業はApps Scriptエディタから直接実行していない）。再生成後は、内部リンク（アイリスオーヤマ記事への言及）が入っているか、実際に差別化できているかを確認すること。
- 完了内容（2026-09-02 Claude Code）: ヤブガラシ記事の無関係商品調査から発展し、ユーザー指示で構造的な再発防止策を実装。`uaSelectRakutenProductQuery_`に軽量LLM関所（`uaIsRakutenProductQueryRelevant_`、Gemini flash、判定不能時は安全側＝非表示に倒す、手動オーバーライドはバイパス）を追加し、キーワード一致やUA_PRODUCT_PLANが選んだクエリでも「本当にこの記事のテーマとして妥当か」を挿入前に確認するようにした（①の`片付け`キーワード削除も別途実施済み）。既存テスト2本（api.gs非ロードでuaCallGeminiJson_未定義によりfail closedして失敗）にモックを追加して復旧、新規テスト`test_rakuten_query_relevance_gate.js`・`test_rakuten_storage_keyword_specificity.js`追加。全35テストPASS、構文チェックOK。push・デプロイはこれから。まだ実記事(post 1145の収納ボックス/エアコン挿入)からは除去していない。並行して、サーキュレーター記事2本（circulator-cover-wont-come-off-cleaning wpPostId=1190 / irisohyama-circulator-cleaning wpPostId=1158）のカニバリゼーションをユーザーと合意（②一方を大幅に作り直して差別化）、まだ未着手。
- 完了内容（2026-09-02 Claude Code）: たくみパパ停止対応完了。ウォッチドッグトリガーを実際に登録した（`uaSetupAutomaticPostingWatchdog`をApps Scriptエディタから実行、`{"installed":true}`確認済み。30分おきに`uaRunAutomaticPostingWatchdog`が発火する）。モデルは`gpt-5.6-terra`のまま維持（ユーザー判断）。row67「枝豆 防虫ネット」自体（OpenAI応答が"queued"のまま止まっている件）は、まだ再開も対象外にもしていない——次回ウォッチドッグが猶予30分を超えたタイミングで自動再開を試みる想定。
  - 補足: `uaInstallAutomaticPostingWatchdogTrigger_`は末尾`_`のためApps Scriptエディタの実行メニューに出ない。公開ラッパー`uaSetupAutomaticPostingWatchdog()`を追加して対応。
  - 事故メモその2: このラッパーを実行する前、関数ドロップダウンを開いて検索文字列をタイプしようとしたところ、ドロップダウンにフォーカスが無くタイプした文字列がコードエディタ本体（automation.gs 1行目）に挿入されてしまった。すぐにCtrl+Zで復元し実害なし。教訓：Apps Scriptエディタの関数選択ドロップダウンは検索ボックスではなく、タイプ操作はせず「ドロップダウンを開く→スクロール→クリック」だけで選ぶこと。選択後は必ずツールバーの関数名表示をスクリーンショットで確認してから実行ボタンを押すこと。
- 完了内容（2026-09-02 Claude Code）: 「たくみパパが停止している」の根本原因を特定。row67「枝豆 防虫ネット」の本文生成が、OpenAI Responses APIのbackgroundモードでキューに入ったまま（`status: "queued"`）13時間半以上進行しなかった（`in_progress`にすらなっていない）。使用モデルはデフォルトの`gpt-5.2`ではなく、script propertyで`gpt-5.6-terra`に上書きされていた。プロンプトサイズは正常範囲（構成メモ7188字など）で、プロンプト起因ではない。20分タイムアウト時の自動キャンセルは`phase: "cancel_requested"`のまま実際にはOpenAI側で成立していなかった（queued状態のジョブはキャンセルできない可能性）。2026-08-29の「ソファー 寿命 ニトリ」も同じ症状だったため、`gpt-5.6-terra`のbackgroundモードでの信頼性が疑わしい。ユーザーには`gpt-5.2`へ戻すか、このモデルを維持してウォッチドッグに頼るかを提示済み、まだ結論は出ていない。
  - 追加した調査用関数（読み取り専用）: `uaInspectTakumiPapaAutomationStop20260901`・`uaInvestigateTakumiArticleTimeout20260901`（`wordpress.gs`）。
  - 再発防止として追加: 定期ウォッチドッグ`uaRunAutomaticPostingWatchdog`（`automation.gs`、`uaInstallAutomaticPostingWatchdogTrigger_`で30分毎のトリガーを登録・まだ未登録）。エラー停止したジョブを30分の猶予後に自動再開（パネルの「再開」と同じ経路）。既存の「同じ工程で2回連続ハングしたら自動対象外」ルールと役割が重複気味だったため、ウォッチドッグ自身の上限もユーザー指示で2へ統一（元は3で設計したが、実際には同じ工程の繰り返しハングでは既存ルールが先に効くため3回に達することはほぼ無く紛らわしいと判断）。上限到達時は通知のみで無限リトライしない。
  - 事故防止メモ: Apps Scriptエディタで関数選択ドロップダウンをクリック操作中に誤って`uaCreateWpDraftFromWeb`を実行してしまったが、8/30の事故を受けて追加した`uaSaveActiveRowData`のsparse-dataガードが機能し、書き込み前にエラーで停止して実害なし。エディタ操作は関数名がツールバーに表示されたことを screenshot で確認してから実行ボタンを押すこと。
- **Codexへの依頼（2026-09-01、ユーザー承認済み）**: `clasp run`が使えない問題（projectId未紐付け）の解消を試してほしい。手順は[CODEX_TASK_clasp_run_setup.md](CODEX_TASK_clasp_run_setup.md)を参照。GCPプロジェクトの紐付け自体はブラウザでのユーザー操作が必要な可能性が高いため、CLIで進められるところまで進めて、進捗と壁に当たった箇所をこの欄か完了記録に書き残してほしい。
- 完了内容（2026-09-01 Claude Code）: ユーザー指摘「ナビ男くんセットがまだcocoonのボックス」に対応。`article.gs`の`uaBuildNaviokunIntroSetHtml_`がSWELL移行後もCocoonの`wp:cocoon-blocks/info-box`・`blogcard`を生成し続けていたバグを修正（appConfigを受け取ってSWELL/Cocoonを分岐、SWELL版は既存の注意書きボックス`is-style-big_icon_caution article-compass-notice-box article-compass-notice-danger`・`wp:loos/post-link`パターンを踏襲、`uaRemoveNaviokunIntroSet_`は両バージョンを除去できるよう修正）。公開済み記事に埋め込まれた旧Cocoon版を新SWELL版へ置き換える一回限り関数`uaFindDrivePublishedPostsWithCocoonNaviokunSet20260901`（検出のみ）・`uaMigrateNaviokunIntroSetToSwell20260901`（置換実行）を`wordpress.gs`に追加。全33テストPASS、git push（`94d7654`）・clasp push済み。ユーザーにApps Scriptエディタから手動実行を依頼中（`clasp run`不可のため）。
- 完了内容（2026-09-01 Claude Code）: キーワード候補シート棚卸し完了。`uaRevertCandidateFalsePositiveHolds20260901`→修正版`uaAuditAndHoldOverlappingCandidates20260901`をユーザーが実行し、誤保留2件（アウディQ5×A1、スバル フォレスター×XV）が「書く」へ復元された上で、修正版ロジックは本物の重複1件のみを正しく検出（行121「スバル フォレスター 中古 注意点」←既存記事「フォレスター やめとけ」と被り、保留化）。これでSearch Console起点の一連の対応（タフト/ナビ男くん相互内部リンク、ハリアーペアは誤検知と確認、候補シート棚卸し）が完了。
- 完了内容（2026-09-01 Claude Code）: DRIVE BASE_キーワード候補シートの棚卸し用に一回限り関数`uaAuditAndHoldOverlappingCandidates20260901`を`wordpress.gs`に追加、git push・clasp push済み。まだ実行はしていない（`clasp run`が使えないためユーザーがApps Scriptエディタから手動実行する必要あり）。既存記事の`mainInput`と、候補シートで「書く」ステータスの行を、主語トークン一致＋感情軸クラスタ一致（後悔系/満足系/評判系）でヒューリスティック照合し、一致したものだけ「保留」に変更する。非破壊（ステータスを戻すだけ）。実行後の判定結果ログを確認してから、次のキーワード生成に活かす想定。
- 完了内容（2026-09-01 Claude Code）: タフト（taft-gakkari-reasons-checklist post1317⇔taft-katte-yokatta-guide post2288）・ナビ男くん（naviokun-reputation post1004⇔naviokun-hyoban-checkpoints）の相互内部リンク追加を、ユーザーがApps Scriptエディタから`uaAddCrossLinkTaftPair20260901`・`uaAddCrossLinkNaviokunPair20260901`を実行して反映。WordPress REST APIで両記事の本文に対象URLが含まれることを確認済み（`content.rendered.includes(...)`で直接検証）。
- 完了内容（2026-09-01 Claude Code）: Search Console分析で「クロール済み-インデックス未登録」に実記事URLが約6件混在していることを発見（タグ/フィード系のノイズと明確に区別済み）。うち被り記事ペア3組を内容比較し、タフト（taft-gakkari-reasons-checklist⇔taft-katte-yokatta-guide）とナビ男くん（naviokun-reputation⇔naviokun-hyoban-checkpoints）の2組は相互内部リンクが片方向しかなかったため、逆方向リンクを追加する一回限りの関数`uaAddCrossLinkTaftPair20260901`・`uaAddCrossLinkNaviokunPair20260901`を`wordpress.gs`に追加（WordPress REST APIで本文へ裸URL行を1つ挿入するだけ、他の変更なし）。ハリアーペア（harrier-navi-fullscreen-dealer⇔harrier-rear-seat-monitor-retrofit）は内容を比較した結果、扱っている機能が別物（全画面化 vs 後席モニター後付け）で誤検知と判断し対応不要とした。全33テストPASS、git push済み（`e0e1b16`）、clasp push済み。**ただしこの環境では`clasp run`が使えない（projectId未リンク、既知の制限）ため、2つの関数はまだ実行していない。ユーザーがApps Scriptエディタから手動実行する必要がある。**
- **次にやること**: ユーザーがApps Scriptエディタ（Extensions > Apps Script）で`uaAddCrossLinkTaftPair20260901`と`uaAddCrossLinkNaviokunPair20260901`を実行し、実行ログを確認する。その後、続けてキーワード候補シートの棚卸し（既存記事と被りそうなキーワードを保留にする作業）に着手予定。
- 完了内容（2026-08-31 Codex）: ユーザー確認により、DRIVE BASEの正常処理がたくみパパ定時開始と重なっても停止せず、DRIVE BASE完了後にたくみパパを開始する方針を確定。現行`automation.gs`を再確認すると、完了時に`uaGetEligibleAutomationAppKeys_()`で開始時刻経過済み・当日枠未消化のサイトを抽出し、`uaStartNextAutomaticPosting`を1本だけ予約する実装がすでに存在した。実運用でもDRIVE BASEが09:38に3件目「ディフェンダー 後悔」を公開後、たくみパパの「冷蔵庫 台 必要か」が自動開始されたことをパネルで確認済み。既存動作を将来壊さないため`test_cross_site_automation_handoff.js`を追加し、DRIVE BASE当日枠完了→たくみパパだけがeligible→次記事確認を60秒後に1本予約→homeを1回だけ開始、を回帰テスト化。全33テストPASS、`git diff --check` PASS。アプリコード変更がないためclasp push/deployは不要。現在「冷蔵庫 台 必要か」は商品導線保証で、楽天APIに条件適合商品がなくWordPress下書き前に品質停止中。無関係商品を入れず本文・停止位置を保持しており、再開・対象外操作は行っていない。
- 完了内容（2026-08-30 Codex）: ユーザー指示「DRIVE BASEでも、たくみパパと同じようにRinkerを使えるようにする」に対応。WordPress管理画面でDRIVE BASE側のRinker 1.13.0とArticle Compass Rinker Bridge 1.3.3がどちらも導入・有効済みであることを確認し、追加インストールは不要と判定。原因だったアーコン側の「たくみパパだけRinkerを呼ぶ」サイト制限を解除し、DRIVE BASEも楽天APIで商品選定→サイト別WordPressへRinker商品登録・再利用→`[itemlink]`挿入→失敗時のみ従来の楽天/Amazon表示へフォールバックする共通経路へ変更。`article.gs`、`app_panel.html`、`ua_web_app.html`、`CURRENT_SPEC.md`、関連テストを更新。全32テストPASS、`git diff --check` PASS。自動投稿が停止中であることを実画面で確認後、clasp pushし本番`@340`へデプロイ。本番DRIVE BASE画面で「商品リンク（Rinker）」「商品検索キーワード」「Rinkerを追加」表示を確認済み。自動投稿の開始・停止・再開や既存記事の一括変換は行っていない。`clasp run uaTestDriveRinkerConnectorStatus`は既知のGoogle側storage NOT_FOUND制限で実行不可。ローカル`.git`管理領域の書き込みがOS側で拒否され、GitHub Desktopもユーザー操作中／最小化状態として制御を中断したため、Git commit/pushのみ未実施と報告していたが、Codexが制限で停止した後にClaude Codeが確認したところ実際にはローカルcommit（`72747f6`）は成立していた。Claude Code側の未push分（車種名クエリ修正、後述）と合わせてorigin/mainへpush済み（`21146e0..72747f6`）。
- 完了内容（2026-08-30 Claude Code）: タフト記事のセカンダリ商品メンションについてユーザーからの2件のフィードバックに対応。①`uaTruncateForDisplay_`が単語の途中で切り詰めていた不具合を修正（直前のスペースで切る）。②リンク文字が楽天出品者の生タイトルそのままだった箇所を、マッチしたカテゴリ語（例:「フロアマット」）に変更。③検索クエリ「フロアマット 車種適合」が車種名を含まず汎用的すぎたため（タフトに3列目用＝ミニバン向けマットが誤って選定される実害を確認）、`mainInput`の先頭語（車種名）をクエリへ付加する`uaBuildVehicleSpecificSecondaryQuery_`を追加（DRIVE BASEのみ）。テスト`test_rinker_item_count.js`・`test_rakuten_secondary_product_category.js`に回帰テスト追加。①②は先に公開済みのタフト記事へ`uaReapplySecondaryMentionFixToPublishedTaft20260830`で反映済み（`uaUpdatePublishedWpFromPanelCore_`経由、公開状態・既存画像を維持）。③はCodexのRinker作業と同じ`article.gs`に触れるため、ユーザー確認の上でローカルcommitのみ行いpushを保留していたが、Codex側のcommitが先に成立していたため合流してpush済み。③はまだ公開済みタフト記事へ反映していない（本番デプロイは`@340`のRinker版まで反映済みだが、本文自体の再適用はこれから）。
- 本番デプロイ: `@340`（Enable Rinker product links on DRIVE BASE）。
- ⚠️**事故記録（2026-08-30 21:22、Claude Code）**: タフト 買って よかった（DRIVE BASE 106行目）の本文を、中古車ジャンルの楽天スキップ修正（`@335`）で再生成・再検証した直後、`uaCreateWpDraftFromPanel({row, appType})` をApps Scriptエディタから直接（パネルのreadForm()を経由せず）呼び出した結果、`uaSaveActiveRowData`が本文以外のほぼ全列（メイン案件名・タグ・メタディスクリプション・WordPress投稿ID・作成日時など）を空文字で上書きした。原因は、`uaSaveActiveRowData`の既存ガード（`data`が完全に空`{}`の場合のみ拒否）が、`{row, appType}`のような**部分的に空**のオブジェクトを検知できなかったこと。GoogleスプレッドシートのFile→変更履歴から事故直前（19:14版）のコピーを作成し、106行目（A106:W106、全23列）を値のみコピー＆貼り付けで復元。`uaInspectTaftBuyGoodStopReason20260830`で mainInput・status・wpPostId=2288・bodyLength・factCheckPointsが元通りであることを確認済み。
  - **再発防止**: `unified_article_app/main.gs`の`uaSaveActiveRowData`に第2のガードを追加。パネルのreadForm()は対象フィールドを常にキーとして含む（値が空文字でも）ため、`data`に`body`/`mainInput`キー自体が無く、かつ対象行にすでに本文またはメインキーワードがある場合は保存を拒否するようにした（空欄行への初回保存は従来通り許可）。テスト`test_save_active_row_guard.js`に回帰テスト追加（新規2ケース）。全35本PASS。git push済み（`acbefc4`）、clasp push/deploy済み（本番`@336`）。
  - **教訓**: `*FromPanel`/`*FromWeb`系の関数は、パネル以外から呼ぶ場合は必ずパネルと同様の完全なrowData（`uaBuildRowData_`の戻り値をそのまま渡すなど）を使うこと。「rowとappTypeさえあれば十分」という思い込みで直接呼び出さない。
  - 事故直前の19:14版スプレッドシートのフルコピー（ファイル名「Article Compass System - 8月30日、19:14」のコピー）がGoogleドライブに残っている。復元確認が済んだので、ユーザーが不要と判断すれば削除して問題ない。
- 完了内容: 上記事故からの復旧後、`unified_article_app/wordpress.gs`の一回限りの関数`uaResumeTaftAfterUsedCarFix20260830`（WordPress下書き更新は行わない安全な版に修正済み）を再実行。①`uaApplyRakutenAffiliateBanner_`で中古車スキップ修正を本文へ再適用（bodyLength 11898→12372）、②`uaApplyPrePublishFixesOnceFromPanel`の再検査（すでに1回分のAI修正レポートが保存済みのため、OpenAIへの再送信なしの経路）でNGが0件になったことを確認（`公開前チェック再検証: 成功`）。自動投稿ジョブの状態（status=error, step=revision, publishMode=公開まで）とWordPress下書き（post 2288）は意図的に変更していない。
- 完了内容: ユーザー指示「中古車ジャンルはガリバー/カーネクスト導線を使うよう修正してほしい」に対応。根本原因は、楽天市場が中古車を取り扱っておらず、商品選定設計（AIが本文に埋め込む`UA_PRODUCT_PLAN`）が`primaryProduct:"中古車"`を狙う記事では楽天検索が常に0件で失敗すること（タフト 買って よかった で実証済み、検索クエリ「ダイハツ タフト 中古車」）。この行にはすでにガリバー中古車ご提案サービスが管理案件として設定済みで、本文にも`UA_MAIN_AFFILIATE_CTA_START`ブロックとガリバー/カーネクストの導線が存在することを確認した上で、`unified_article_app/article.gs`の`uaApplyRakutenAffiliateBanner_`に、商品選定設計が中古車ジャンル（新規`uaIsUsedCarProductPlan_`）かつ行に管理案件ガリバー/カーネクストが既に設定済み（新規`uaHasManagedUsedCarAffiliate_`）の場合は楽天検索自体を試みずスキップし、既存の管理アフィリエイト導線に任せる分岐を追加。ただしこのスキップ時も、別H2で言及されているアクセサリー（フロアマット等）向けのセカンダリ商品メンション機能は引き続き動作するようにした。さらに、そのセカンダリ商品メンション機能自体に「見出しに『用品』等を含む専用H2より先に、本文中で偶然用品語へ触れているだけの別H2を誤って選んでしまう」バグを発見・修正（`uaFindSecondaryProductSectionQuery_`が見出し名を優先するよう変更）。テスト`test_used_car_rakuten_skip.js`・`test_rakuten_secondary_product_category.js`に回帰テスト追加、全35本PASS。git push済み（`cd5bff4`, `c98bcb6`, `acbefc4`）、clasp push/deploy済み。
- 完了内容: ユーザーがパネル上部の通知バナーを見て「自動投稿が進行中です」が延々表示されるのを見て、実際は停止しているのに紛らわしいと指摘。原因を特定：`ua_web_app.html`の通知バナーは`settings.activeKeyword`があるかどうかだけを見ており、ジョブが`activeJobStatus === 'error'`で停止中でも常に緑色の「進行中」表示になっていた（下の状態カードは正しく「停止」と表示していたが、上のバナーだけ食い違っていた）。ジョブがエラー停止中のときは赤い「自動投稿は停止中です」表示に切り替わるよう修正。テスト`test_dashboard_today_articles.js`に回帰テスト追加、全35本PASS。git push済み（`0e9440c`）、clasp push/deploy済み。
- 本番デプロイ: `@337`。
- 自動投稿: 操作していない。タフト行のジョブはエラー状態のまま（本文・NG判定は修正済み）。WordPress下書き（post 2288）の更新・自動投稿の再開は、ユーザー確認の上でパネルから手動で行う想定。
- 完了内容: ユーザー・Codex双方によるDRIVE BASE記事「[display-audio-regret-guide](https://ebimayo5.com/archives/display-audio-regret-guide/)」の品質レビューを起点に、DRIVE BASE全体に効くコード修正を実施。詳細は下記「2026-08-30 Claude Code担当分」節を参照。続くCodex担当で、外部出典シートへApple/Google公式を含む車載機器系一次情報6件を追加し、表示確認まで完了した。追加で、rel="sponsored"強制付与時にナビ男くんの案件データが裸URL形式（linkInput===url）で`<a>`タグの正規表現にマッチせずサブ導線が無音失敗する不具合と、サブ導線自体の「ナビ男くん」文言が既存の`uaApplyNaviokunIntroSet_`を誤発火させ紹介ボックスが二重に入る不具合を発見・修正（`57a877d`, `99c6250`, `e184263`）。本番`@332`→`@333`。バージョン履歴が200件上限に達したためユーザー許可のもと最古24件を削除（本番`@331`には影響なし）。display-audio-regret-guide自体（WP投稿2268）にもCTA修正を再適用し、rel=sponsored・ナビ男くんサブ導線（重複なし1件）を実サイトで確認済み。
- 本番デプロイ: `@333`。
- 自動投稿: 操作していない。

- 完了内容: たくみパパ自動投稿の停止原因を調査・修正。**当初「OpenAI本文生成のハング」と診断したが誤りで、実際は55行目「ソファー 寿命 ニトリ」がSTRUCTURE工程（`outline.gs`の`uaGenerateArticleStructureForRow_`、競合ページ最大10件の同期UrlFetchAppまたは構成案LLM呼び出し）でApps Scriptの6分実行上限までハングし続けていたことが原因**（本番の`実行`ログでjob.step=structureを確認して訂正）。PC側Trefaiブリッジ（`article_bridge.py`）は`UA_TREFAI_BRIDGE_ENABLED=false`で無効化されたままであることをスクリプトプロパティで確認済みで、今回の件とは無関係。今日それまでのコード変更が原因でもない（楽天バナー修正のみだった@319稼働中に最初のハングが発生済み）。20分無進捗の安全停止自体は動いていたが、人が再開するたびに同じ記事で同じ理由のハングが繰り返されていた。`unified_article_app/automation.gs`に、同じジョブ・同じ工程で安全停止が2回連続発生した場合に自動でその記事を対象外にして次へ進む仕組み（`UA_AUTOMATION_STALE_JOB_AUTO_SKIP_THRESHOLD=2`、`uaSkipAutomaticPostingJob_`を手動スキップと共通化、`uaAdvanceAutomaticPostingJob_`で工程が実際に進んだ時だけカウンタをリセット）を追加。ただし**WAIT_TREFAI工程だけは自動スキップの対象外**にした（CURRENT_SPEC.mdの2026-08-25事故記録にある「トレファイ全体障害時は次々スキップしない」方針を将来ブリッジ再有効化時も守るため。現状ブリッジ無効なのでこの工程自体発生しない）。テスト`test_automation_stale_job_auto_skip.js`追加、全29本PASS。git push済み（`0d1ff83`, `8b7cbab`, `7a00187`）、clasp push/deploy済み。本番の一回限りの検証用関数`uaRunAutoSkipVerificationForStuckJob20260830`をApps Scriptエディタから実行し、新仕組みが実際に発火してjob.status=completeになることを確認した上で55行目を解消済み。
- 本番デプロイ: `@329`。
- 自動投稿: 55行目「ソファー 寿命 ニトリ」は自動スキップ済み（候補シートは保留へ戻した）。キューは次の候補へ進行中（自動投稿設定シートで確認可能）。
- 完了内容: Codexの画像監査で見つかったたくみパパ2記事のアイキャッチalt空欄を修正した。投稿979（muji-beads-sofa-choice, media id=1039）・投稿726（popup-tent-cannot-fold, media id=763）とも、記事タイトルをalt_textに設定（`image.gs`の自動生成アイキャッチと同じ`alt: title`規約に合わせた）。WordPress REST APIで直接更新し、Apps Scriptエディタの実行ログでalt_text更新後の値を確認済み。git push済み（`5da0142`, `28f391f`）。コード変更のみでclasp deployは不要（一回限りの実行関数、本番デプロイポインタは`@329`のまま）。
- 完了内容: 「Claude Code向け」4項目すべて完了。①CTA文言のテンプレ均一化解消（`UA_CTA_PHRASE_TEMPLATES`、@325）、②商品導線の複数タッチポイント化（序盤に軽めのテキストリンクを追加、`uaFindRakutenSecondaryMentionIndex_`/`uaBuildRakutenLightMentionHtml_`、@326）、③CTA文言バリエーションは①と同一修正で解消済み、④商品選定への価格帯シグナル追加（`uaPickPriceTierAwarePrimaryItem_`、単一商品選定時のみ対象、@327）。全テスト（test_*.js 28本）PASS、都度git push・clasp push/deploy済み。詳細はメモリ`project_quality_monetization_roadmap.md`参照。
- 本番デプロイ: `@327`。
- 自動投稿: 操作していない（前回の状態から変更なし）。
- **次にやること**: Codex向け3項目は完了。画像監査で見つかった「たくみパパ2記事のアイキャッチalt空欄」は、修正範囲と優先順をユーザー確認してから別タスクで対応する。本文内画像は直近40記事すべてに存在する。アイキャッチ右下の「00」は画像生成プロンプトで明示された仕様であり、品質不具合ではない。Claude Code側の残りは、鮮度チェック拡大・全自動投稿の品質天井など、着手前にユーザーとスコープ確認が必要な大きめの項目。
- 完了内容: Codexが2026-08-29 23:57にローカルコミットしていた外部出典7件追加（`8307380`）を含め、たまっていたローカルコミット15件（Rinker修正・候補選定ロジック改善・GSC実績シート導入など）を`origin/main`へpush済み（`7e66fe1..99dec94`）。Codexが保留していたpushはこれで解消。
- 本番デプロイ: `@324`（GSC実績シートのclearContentバグ修正まで反映済み）。
- 自動投稿: 操作していない（前回の状態から変更なし）。
- Git: クリーン（`design_mockup/`のuntrackedのみ残存、誰のファイルか不明のため触れていない）。
- **たくみパパ「２からはじめて１，３にいこう」は3項目とも完了**（詳細はメモリ`project_quality_monetization_roadmap.md`）。次にやることの一覧・Codexと並行分担できるものは下記「次のエージェントへの引き継ぎ」参照。
- **次のエージェントへの引き継ぎ（Codex/Claude Code 並行分担案、ユーザー承認済みの優先順）**:
  - Codex向け（完了）: ①DRIVE BASEの「ナビ／車載機器」困りごとジャンルのキーワード候補12件を`DRIVE BASE_キーワード候補`の2429〜2440行へ追加。②内部リンク候補プールの鮮度監査。③画像・altテキストの品質監査。詳細は直下の2026-08-30記録を参照。
  - Claude Code向け（article.gs等のコード変更、続けて触る想定）: ①DRIVE BASEのCTA文言・見出し構成のテンプレ均一化を崩す。②商品導線の挿入箇所を記事内複数箇所に増やす（`uaFindRakutenContextualInsertIndex_`は現状1箇所のみ）。③CTA文言のバリエーション追加。④商品選定に価格帯シグナルを追加（関連性のみで選定中）。
  - 作業前に必ずこの「現在作業中」欄を再確認し、対象ファイルが重ならないことを確認してから着手すること。

### 2026-08-30 Claude Code担当分の完了記録（記事品質レビュー起点の修正）

ユーザーが[display-audio-regret-guide](https://ebimayo5.com/archives/display-audio-regret-guide/)（DRIVE BASE）の品質評価を依頼し、私とCodexが独立にレビューした。Codexの指摘のうち検証できたもの（rel属性、alt文言崩れ、H2/H3数）は実データで裏付けが取れ、私の指摘（商品導線1箇所のみ）と合わせて以下を修正した。

1. **rel="sponsored"の欠落を修正（DRIVE BASE全体に影響）**
   - 根本原因: afb（アフィリエイトB）のASP標準コードが`rel="nofollow"`のみで、`sponsored`を含まない（afb公式の広告原稿ページで確認済み。案件データの入力ミスではない）。
   - `uaNormalizeAnchorRelAttributes_`は重複統合のみで不足分の追加はしないため直らなかった。新規`uaEnsureAffiliateRelSponsored_`（[article.gs](unified_article_app/article.gs)）を追加し、案件管理シートの生HTMLを信頼する3箇所（メインCTAのhtml分岐、Ottocastサブ導線、ガリバー/カーネクストサブ導線）に適用。href・トラッキングpixelなど他の要素は一切変更しない設計。
   - テスト`test_complementary_affiliate.js`に検証を追加（25 checks）。git push `d7a762f`、本番`@330`。

2. **Ottocast（メイン案件）→ナビ男くん の逆方向サブ導線を追加**
   - 既存の複数タッチポイント機構（ガリバー↔カーネクスト、ナビ男くん→Ottocast）はユーザーの記憶通り実装済みだったが、**Ottocastがメイン案件の記事では逆方向（→ナビ男くん）が存在せず**、display-audio-regret-guideのような記事はCTAが1箇所のみになっていた。
   - `uaGetManagedNaviokunSubProject_`/`uaBuildManagedNaviokunSubBlock_`/`uaApplyManagedNaviokunSubTextLink_`を追加し、Ottocastがメインでも本文にHDMI増設・後席モニター・配線施工等の話題があればナビ男くんをサブ導線として追加するようにした。
   - 配置は試行錯誤した：①メインCTA直後→分散にならない、②「まとめ」直前へ機械的に配置→文脈と無関係、の順にユーザーから指摘を受け、最終的に**該当キーワードを実際に含むH2セクションの直後**に配置する方式に変更（楽天2箇所目タッチポイントで確立した`uaExtractRakutenH2Sections_`の仕組みを再利用）。該当セクションが見つからない場合のみメインCTA直後にフォールバック。
   - 1記事あたりのCTA上限は機械的に3箇所固定にはせず、「文脈的に関連するセクションがあるときだけ」発動する設計を維持（ユーザーとの合意）。
   - テスト追加（25 checks、うち新規は分散配置の検証込み）。git push `99550d1`、本番`@331`。

3. **DRIVE BASE関連記事4件のalt文言崩れを修正**
   - 「案1 / タイトル候補A / 案2 / タイトル候補B / 案3 / タイトル候補C」がそのままアイキャッチaltに残っていた（Codex指摘、実ページで確認済み）。対象: 投稿1892（オートバックス工賃）、1876（フィットのナビ選び）、1858（カーナビ画面が映らない）、1843（フリード社外ナビ）。
   - 一回限りの実行関数`uaFixDriveRelatedPostAltTitleLeak20260830`（[wordpress.gs](unified_article_app/wordpress.gs)）で、各投稿の確定タイトルをalt_textへ設定。Apps Scriptエディタの実行ログで更新前後の値を確認済み。git push `02ce51c`。コード変更のみでclasp deployは不要（一回限りの関数、本番デプロイポインタは`@331`のまま）。

4. **Codexへの引き継ぎ: 外部出典シートの一次情報不足**
   - Codexの指摘「Apple/Google公式のCarPlay/Android Auto案内がない」を検証: 外部出典シート（全95行）を`uaInspectExternalSourcesForCarplayAndroidAuto20260830`で確認したところ、トヨタ・ホンダ・日産・マツダ・パイオニア等メーカー公式や警察庁・e-Gov等の法規情報はあるが、**Apple・Googleの公式リンクが1件もない**ことを確認した。
   - お願いしたい作業: ジャンル「メーカー公式」または新設「スマホ連携公式」で、Apple公式CarPlay案内・Google公式Android Auto案内の2件を外部出典シートへ追加。あわせて、他のDRIVE BASE車載機器系ジャンルにも同様の一次情報抜けがないか監査してもらえると助かる。
   - 具体的な後悔ケース追加・目次簡潔化（Codex評価の#2・#3）はプロンプト調整寄りのため、外部出典の穴を埋めてから改めて検討する方針で保留中。

### 2026-08-30 Codex担当分の完了記録（候補追加・内部リンク・画像監査）

#### 外部出典シート：DRIVE BASE車載機器系の一次情報補強（Claude Codeからの引き継ぎ）
- `外部出典`シートの既存95件を監査し、Apple／Google公式だけでなく、カーナビ・テレビキャンセラー分野でも主要メーカー一次情報が不足していることを確認した。
- A97:H102へ次の6件を追加した（すべて公式ページ、優先度「高」、URL確認「OK」、確認日時2026/08/30）。
  1. Appleサポート「iPhoneをCarPlayに接続する」
  2. Google Android Auto ヘルプ「設定方法」
  3. パナソニック カーナビ／カーAV公式
  4. アルパイン カーナビ ビッグX公式
  5. KENWOOD 彩速ナビ公式
  6. データシステム TV-KIT公式
- 既存URLとの重複なし。追加後にGoogle Sheets APIで値・リンク・日付書式を再取得し、さらに実際のシート画面で6行が正しく表示されることを確認した。
- 監査結論: 警察庁・e-Gov等の法規情報、自動車メーカー各社、パイオニア、量販店、ドラレコメーカーは既存行で概ねカバー済み。今回の6件を超えて低優先度の出典を大量追加する必要はないと判断した。
- コード・WordPress・Apps Scriptデプロイ・自動投稿は一切操作していない。本番デプロイは`@331`のまま。

1. **DRIVE BASE ナビ／車載機器キーワード候補追加**
   - DRIVE BASE_キーワード候補シートの既存2,428行を照合し、ナビ系既存135件と重複しない購入・施工直前の困りごと12件を2429〜2440行へ追加した。
   - 案件はすべてナビ男くん。状態列は空欄のままなので、追加によって自動執筆は開始されない。検索ボリュームは推測値を入れず空欄。
   - 追加語: カーナビHDMI後付け、車にHDMIがない場合の増設、ディスプレイオーディオHDMI後付け、後席モニターが映らない、純正ナビと後席モニター、純正ナビから社外ナビ交換、助手席で走行中にナビ操作できない、テレビキャンセラーをディーラーに断られる／保証対象外、HDMIで映らず音だけ出る、純正ナビでYouTubeを見る方法、ディスプレイオーディオの後席モニター後付け。
   - API再読とGoogle Sheets画面の両方で、値・空の状態列・プルダウン・表示崩れなしを確認した。

2. **内部リンク候補プール鮮度監査**
   - 内部リンクは計153件（DRIVE BASE 95、たくみパパ58）。空URL0、空タイトル0、重複URL0。
   - 両サイトの公開WordPress REST APIから直近20記事ずつを取得して照合し、40記事すべてが候補プールに存在した。最終取得は2026/08/29 23:35:46で、固定プールの更新停止・直近記事欠落・8/27の候補消失事故再発は確認されなかった。
   - 監査のみ。シートの全件再取得・削除・WordPress更新は実行していない。

3. **画像・alt品質監査**
   - 両サイトの直近20記事ずつ（計40記事）をREST APIと実公開ページで再監査。最初の集計では監査用正規表現のエスケープを誤り、本文画像を0枚と誤判定した。修正後は全40記事で本文画像を確認した。
   - 記事説明用の画像（意味のあるaltあり）は、DRIVE BASEが20記事すべて3枚、たくみパパが19記事で3枚、最新の電子レンジ記事のみ2枚。商品・計測用画像まで含む本文img総数はDRIVE BASE 101枚、たくみパパ98枚。
   - DRIVE BASE直近20記事はアイキャッチalt空欄0。たくみパパは2記事で空欄: https://kurashi-ie.com/muji-beads-sofa-choice/（投稿979）、https://kurashi-ie.com/popup-tent-cannot-fold/（投稿726）。
   - 直近各3枚＋alt空欄2枚の計8枚を実画像で確認した。右下の「00」は全画像で共通しているが、ユーザー確認により画像生成プロンプトで明示された仕様と判明したため、品質不具合の判定を撤回した。
   - 文字の可読性と記事テーマとの一致は概ね良好。監査上の要確認点はアイキャッチalt空欄2件。本文画像がないという指摘は撤回済み。
   - 監査のみ。既存画像の差し替え、alt修正、WordPress本文更新、画像生成コード変更は行っていない。

### 2026-08-29 Claude Codeの作業まとめ（たくみパパRinker整備・続き）
前回（本セクション旧内容）の続きとして、たくみパパで実際にRinker連携が壊れていた3記事の再選定と、その過程で見つかった実コードの不具合修正を完了した。

1. **row 14（サンシェード強風対策）・row 13（冷蔵庫マット後悔）**: 既存のリトライ機構で無事再選定成功。ライブページでRinker商品ボックス（`yyi-rinker-box`）を確認済み。
2. **冷蔵庫コンロ向かい合わせ（サイト最大トラフィックページ、WP投稿ID 193）**: シート管理外（行が存在しなかった＝トラッキング開始前の記事）だったため、ユーザー確認のうえ`uaRegisterExistingRefrigeratorStoveArticle()`でシート末尾（**行54**）に新規登録。WPの生content（`context=edit`のREST API）を取得してそのままシートのbody列へ格納し、既存記事を壊さない形で自動処理対象に組み込んだ。
3. **その過程で発見した実コードの不具合（修正・本番反映済み）**: `案件注意点`列の「楽天商品キーワード：」手動指定オーバーライドが、`uaGetMainKeywordProductProfile_`のキャッチオール（メインキーワードが家電名＋「後悔」等の感想語を含むと、キーワードそのものを商品名として扱ってしまう）に**常に負けていた**。`uaBuildRakutenAffiliateBanner_`と`uaSelectRakutenCategoryQueries_`の両方に手動オーバーライド優先のガードを追加（新関数`uaGetManualRakutenQueryOverride_`）。新規テスト`test_rakuten_manual_query_override.js`で固定化。行54は最終的に「キッチンパネル 防熱」で再選定し、ライブページで実際の商品ボックス（`item.rakuten.co.jp/hanahaco/...`）を確認済み。
4. 全24ファイルのローカルテストPASS。

- **Gitコミット**（すべてpush済み、`origin/main`反映済み）: `49f22f2`〜`bfa714f`（8件、うち`5974e92`のデバッグ用一時関数は`6b98392`で削除済み）。
- **本番デプロイ**: `clasp push`でHEAD反映後、`clasp deploy --deploymentId AKfycbzGbxQA5AuXH3MlUZSlfTjDn1hrpH4MnNNG0NVKty0wUz1Bd-4oVXbMQUBloQvd-HCm`で同一URL上に**新バージョン `@319`**（"Fix manual Rakuten query override precedence + register fridge/stove article"）を作成・反映済み。前回セクションに記載の`@316`〜`@318`はすべて含まれている。
- **自動投稿**: 今回のセッションでは一切操作していない（前回の「電子レンジ コンセント 真後ろ」再開状態・「エアコン位置 失敗」停止状態から変更なし）。
- **未対応（次のエージェントへの引き継ぎ）**:
  1. ~~Codexへ：`外部出典`シートへの7件追加~~ → **2026-08-29 23:57に完了**（A90:H96、重複なし・リンク/表示確認済み）。
  2. ユーザーの「２からはじめて１，３にいこう」の指示のうち、**「２」（実配置の検証・修正）はこれで完了**。次は「１」（たくみパパで「買える商品」に紐づくテーマを優先する）と「３」（GSC/A8/楽天の実績データを候補選定ロジックへ反映する）が未着手。

  Codex宛て・外部出典シート追加分（列は左から ジャンル / 出典名 / URL / 使う場面 / 関連キーワード / 優先度 / URL確認 / 確認日時）:

     | ジャンル | 出典名 | URL | 使う場面 | 関連キーワード | 優先度 | URL確認 | 確認日時 |
     |---|---|---|---|---|---|---|---|
     | 家電・安全 | 日本電機工業会（JEMA）洗濯機設置注意 | https://www.jema-net.or.jp/Japanese/ha/sentakuki/setting_chuui.html | 洗濯機の設置・排水・隙間対策の安全確認 | 洗濯機 排水 隙間 設置 防水パン たくみパパ | 高 | OK | 2026/08/29 |
     | 子ども安全・室内遊具 | 消費者庁 家庭用室内遊具の安全対策 | https://www.caa.go.jp/policies/policy/consumer_safety/child/project_001/mail/20200827/ | 室内ジャングルジム等の遊具事故防止の案内 | 室内ジャングルジム 室内遊具 子ども 事故防止 たくみパパ | 高 | OK | 2026/08/29 |
     | ベランダ安全 | 消費者庁 窓・ベランダからの子どもの転落事故防止 | https://www.caa.go.jp/policies/policy/consumer_safety/caution/caution_037/ | サンシェード等ベランダ用品設置時の転落防止注意 | サンシェード ベランダ 転落防止 手すり 子ども たくみパパ | 高 | OK | 2026/08/29 |
     | 家具安全・地震対策 | 東京消防庁 家具類の転倒・落下・移動防止対策 | https://www.tfd.metro.tokyo.lg.jp/lfe/bou_topic/kaguten/measures_house.html | 収納家具・チェスト・ラック等の転倒防止対策 | 家具 転倒防止 収納 チェスト ラック 地震 たくみパパ | 高 | OK | 2026/08/29 |
     | 照明安全 | 日本照明工業会（JLMA） 照明器具の安全 | https://www.jlma.or.jp/hub/safety.htm | シーリングライト等照明器具の安全確認 | シーリングライト LED照明 安全 交換時期 たくみパパ | 高 | OK | 2026/08/29 |
     | 製品事故情報 | 製品評価技術基盤機構（NITE） 製品事故情報・リコール情報 | https://www.nite.go.jp/jiko/jikojohou/ | 家具・家電の製品事故情報を確認する | 製品事故 リコール 家電 家具 安全 たくみパパ | 中 | OK | 2026/08/29 |
     | 換気・カビ対策 | 国土交通省 住宅等における換気に関する情報 | https://www.mlit.go.jp/jutakukentiku/build/jutakukentiku_house_fr_000108.html | 換気・カビ対策・除湿に関する公式情報 | 換気 カビ対策 除湿 湿気 ランドリー たくみパパ | 中 | OK | 2026/08/29 |

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
- 更新者: Codex
- 日時: 2026-08-30 12:14（日本時間）
- 切り替え理由: Claude Codeから引き継いだ外部出典シートの一次情報補強を完了。Apple／Google公式を含む車載機器系公式ソース6件を追加し、値・リンク・日付書式・実画面表示を確認してライブ作業欄を空きへ戻したため。

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

**DRIVE BASE**: たくみパパと同じRinker連携を使用。楽天APIで商品を選定し、DRIVE BASE側のRinker商品として登録・再利用して本文へ`[itemlink]`を挿入する。Rinker連携が一時失敗した場合だけ従来の楽天商品カード＋Amazon検索へフォールバックする。メイン案件がない、または「案件無し」の場合はキーワードや本文の文脈に合う商品を積極的に検討し、毎回同じ商品を出さない（サンシェード記事ならサンシェードなど商品カテゴリを本文と一致させる）。

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
両サイトのSWELL移行と新規SWELL本文出力は完了。内部リンクはSWELLネイティブ関連記事カードへ修正済み。ポイント枠・注意枠のGutenberg無効ブロック問題は本番@280で修正済み。直近8公開記事も安全に修復済み。メタディスクリプションはWordPressプラグイン経由でSWELLメタへ同期する。たくみパパ・DRIVE BASEとも商品導線はRinker＋楽天/Amazonフォールバックを使用し、DRIVE BASEは案件導線も併用する。自動投稿はDRIVE BASE 4時、たくみパパ5時、各最大3記事、画像あり、公開まで、稼働ON。Codex監視は5時、6時、16時。最大の注意点はトレファイ・OpenAI待機処理の重複再実行。表示だけで正常扱いしない。次の重点は、数日間の実運転を観察し、投稿数・メタ・内部リンク・商品一致・API消費を根拠付きで確認すること。
