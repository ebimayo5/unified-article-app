const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(
  path.join(__dirname, 'unified_article_app', 'article.gs'),
  'utf8'
);
const context = { console };
vm.createContext(context);
vm.runInContext(source, context);

const duplicateProductVariants = [
  {
    itemCode: 'shop:popup-tent-1',
    url: 'https://item.rakuten.co.jp/shop/popup-tent-1/?scid=af_pc_etc',
    name: '収納しやすいポップアップテント'
  },
  {
    itemCode: 'shop:popup-tent-1',
    url: 'https://hb.afl.rakuten.co.jp/hgc/example/?pc=https%3A%2F%2Fitem.rakuten.co.jp%2Fshop%2Fpopup-tent-1%2F',
    name: '収納しやすいポップアップテント'
  },
  {
    itemCode: 'shop:popup-tent-2',
    url: 'https://item.rakuten.co.jp/shop/popup-tent-2/',
    name: '別仕様のポップアップテント'
  }
];
assert.deepStrictEqual(
  Array.from(context.uaDedupeRakutenItems_(duplicateProductVariants), item => item.itemCode),
  ['shop:popup-tent-1', 'shop:popup-tent-2'],
  '同じ楽天itemCodeはURLが違っても1商品にまとめる'
);
assert.strictEqual(
  context.uaBuildRinkerShortcodeBlocks_([
    { post_id: 501 },
    { post_id: 501 },
    { post_id: 502 }
  ]).match(/\[itemlink/g).length,
  2,
  '同じRinker post_idのショートコードを重複出力しない'
);
assert.strictEqual(
  context.uaDecideRakutenItemCount_('', { forceRakutenItemCount: 3 }, { key: 'home' }, 'ポップアップテント'),
  3,
  'たくみパパの手動Rinkerボタンは3種類を要求する'
);
assert.strictEqual(
  context.uaDecideRakutenItemCount_('', { forceRakutenItemCount: 3 }, { key: 'drive' }, 'カーナビ'),
  1,
  'DRIVE BASEの楽天バナー件数にはRinker専用指定を適用しない'
);

const originalSingleFetch = context.uaFetchRakutenItems_;
const originalMultiFetch = context.uaFetchRakutenItemsByQueries_;

context.uaFetchRakutenItems_ = (query, count) => Array.from({ length: count }, (_, index) => ({
  itemCode: query + '-' + (index + 1),
  url: 'https://example.com/' + encodeURIComponent(query) + '/' + (index + 1),
  name: query + ' 候補' + (index + 1)
}));

let singleQueryItems = context.uaFetchRakutenItemsAcrossQueries_(
  ['遮光カーテン'],
  3,
  '遮光カーテン やめた',
  null
);
assert.strictEqual(singleQueryItems.length, 3, '1つの検索語からも3商品を取得する');

context.uaFetchRakutenItemsByQueries_ = () => [
  { itemCode: 'shared-1', url: 'https://example.com/shared-1', name: '主候補' }
];
context.uaFetchRakutenItems_ = (query) => [
  { itemCode: 'shared-1', url: 'https://example.com/shared-1', name: '主候補' },
  { itemCode: 'extra-2', url: 'https://example.com/extra-2', name: query + ' 候補2' },
  { itemCode: 'extra-3', url: 'https://example.com/extra-3', name: query + ' 候補3' }
];

const backfilledItems = context.uaFetchRakutenItemsAcrossQueries_(
  ['遮光カーテン', '遮光カーテン 1級'],
  3,
  '遮光カーテン やめた',
  null
);
assert.deepStrictEqual(
  backfilledItems.map(item => item.itemCode),
  ['shared-1', 'extra-2', 'extra-3'],
  '複数検索でも不足分を重複なしで補充する'
);

const popupPlan = {
  should_insert: false,
  primary_product: '',
  market_query: '',
  purpose: '現有のポップアップテントを安全に収納する情報が主題であり、商品購入は直接の解決策ではない。',
  benefit: '片付けで慌てにくい商品を選びやすくなる'
};
const popupBody = context.uaAttachProductPlanMarker_(
  '<h2>ポップアップテントがたためないときの手順</h2><p>まずは今使っているテントを買い替えずに直します。</p>',
  popupPlan
);
const popupRow = {
  mainInput: 'ポップアップテント たためない',
  affiliateName: '案件無し',
  affiliateNotes: ''
};
const homeConfig = { key: 'home' };
const yogiboRow = {
  mainInput: '無印良品の人をダメにするソファとYogibo、暮らしに合うのはどっち？',
  affiliateName: '案件無し',
  affiliateNotes: ''
};
const yogiboProfile = context.uaGetMainKeywordProductProfile_(yogiboRow, homeConfig);
assert.strictEqual(yogiboProfile.query, 'ビーズソファ 本体', '商品比較の中心カテゴリをメインキーワードから復元する');
assert.deepStrictEqual(
  Array.from(yogiboProfile.queries),
  ['無印良品 体にフィットするソファ 本体', 'Yogibo ビーズソファ 本体', 'ビーズソファ 本体'],
  '比較対象を別々の商品検索へ分ける'
);
const falseYogiboPlanBody = context.uaAttachProductPlanMarker_(
  '<h2>無印良品とYogiboを比較</h2><p>サイズと手入れを比べます。</p>',
  { should_insert: false, purpose: '部屋への置きやすさを判断する' }
);
assert.deepStrictEqual(
  Array.from(context.uaBuildMainKeywordProductPlan_(yogiboProfile, {
    should_insert: true,
    required_features: ['対応カバー', '設置可能サイズ', '取扱表示']
  }).requiredFeatures),
  [],
  '本文の比較観点を楽天の商品名に含まれる必須語として誤適用しない'
);
assert.ok(
  context.uaShouldInsertRakutenAffiliateBanner_(falseYogiboPlanBody, yogiboRow, homeConfig),
  'メインキーワードが商品比較ならAIの誤った未挿入判定を上書きする'
);
assert.strictEqual(
  context.uaSelectRakutenProductQuery_(falseYogiboPlanBody, yogiboRow, homeConfig),
  'ビーズソファ 本体',
  '商品検索では本文の脇役よりメインキーワードを優先する'
);
assert.strictEqual(
  context.uaDecideRakutenItemCount_(falseYogiboPlanBody, yogiboRow, homeConfig, 'ビーズソファ 本体'),
  3,
  '商品比較記事は最大3候補を探す'
);
assert.ok(
  context.uaIsRakutenItemRelevant_('Yogibo Max ヨギボー ビーズソファ', 'Yogibo ビーズソファ'),
  'ブランド別検索では一致ブランドの商品を採用する'
);
assert.ok(
  !context.uaIsRakutenItemRelevant_('ノーブランド ビーズソファ', 'Yogibo ビーズソファ'),
  'ブランド別検索へ別ブランドの商品を混ぜない'
);
assert.ok(
  !context.uaIsRakutenItemRelevant_('Yogibo Max ヨギボー ビーズソファ', '無印良品 体にフィットするソファ'),
  '無印良品の検索へYogiboを混ぜない'
);
assert.ok(
  context.uaScoreRakutenItem_(
    { itemName: 'ビーズソファカバー(BC-A12) ニトリ 大サイズ', reviewAverage: 4.5, reviewCount: 20 },
    'ビーズソファ 本体',
    { should_insert: true, primary_product: 'ビーズソファ', market_query: 'ビーズソファ 本体' }
  ) < 0,
  'メイン商品がビーズソファのときカバー単品を本体候補にしない'
);
assert.ok(
  context.uaScoreRakutenItem_(
    { itemName: '無印良品 体にフィットするソファ 本体 幅65cm', reviewAverage: 4.5, reviewCount: 20 },
    '無印良品 体にフィットするソファ 本体',
    { should_insert: true, primary_product: 'ビーズソファ', market_query: 'ビーズソファ 本体' }
  ) > 0,
  'メイン商品本体は適切な候補として残す'
);
assert.ok(
  context.uaScoreRakutenItem_(
    { itemName: '【中古】Yogibo Hugger ビーズソファ 本体', reviewAverage: 4.5, reviewCount: 20 },
    'Yogibo ビーズソファ 本体',
    { should_insert: true, primary_product: 'ビーズソファ', market_query: 'ビーズソファ 本体' }
  ) < 0,
  '通常の商品導線へ中古・ジャンク商品を混ぜない'
);
assert.strictEqual(
  context.uaDedupeRakutenItems_([
    { name: '洗濯機 隙間パッキン 2本セット', itemCode: 'shop-a:item-1', url: 'https://example.com/a' },
    { name: '洗濯機 隙間パッキン 2本セット', itemCode: 'shop-b:item-9', url: 'https://example.com/b' },
    { name: '洗濯機 マグネット収納', itemCode: 'shop-c:item-3', url: 'https://example.com/c' }
  ]).length,
  2,
  '別店舗・別商品コードでも商品名が同じ候補を重複表示しない'
);
assert.strictEqual(
  context.uaGetMainKeywordProductProfile_({ mainInput: 'スタバ 氷少なめ' }, homeConfig),
  null,
  '商品性のない暮らし外キーワードへ無関係商品を出さない'
);
assert.strictEqual(
  context.uaGetMainKeywordProductProfile_({ mainInput: '住宅ローン 控除 申請' }, homeConfig),
  null,
  '制度記事へ商品導線を強制しない'
);
assert.strictEqual(
  context.uaGetMainKeywordProductProfile_({ mainInput: 'エアコン うるさい 原因' }, homeConfig),
  null,
  '困りごとの原因解説をエアコン本体の購入記事と誤判定しない'
);
assert.strictEqual(
  context.uaGetMainKeywordProductProfile_({ mainInput: '遮光カーテン 比較' }, homeConfig).query,
  '遮光カーテン',
  '一般商品でも比較・購入意図があればメイン商品を抽出する'
);
assert.ok(
  !context.uaShouldInsertRakutenAffiliateBanner_(
    falseYogiboPlanBody,
    Object.assign({}, yogiboRow, { affiliateNotes: '楽天なし' }),
    homeConfig
  ),
  '運用者が明示した楽天なしは商品比較の自動保証より優先する'
);
assert.strictEqual(
  context.uaSelectRakutenProductQuery_(
    falseYogiboPlanBody,
    Object.assign({}, yogiboRow, { affiliateNotes: '楽天商品キーワード: Yogibo Mini' }),
    homeConfig
  ),
  'Yogibo Mini',
  '運用者が指定した商品検索語は自動抽出より優先する'
);
assert.strictEqual(
  context.uaGetMainKeywordProductProfile_({ mainInput: '洗濯機の隙間を埋める' }, homeConfig).query,
  '洗濯機 隙間 ガード',
  '悩み語をそのまま本体購入へ結び付けず、解決用品へ正規化する'
);
assert.ok(
  context.uaScoreRakutenItem_(
    { itemName: '洗濯機 防水パン 隙間カバー 防臭タイプ', reviewAverage: 4.5, reviewCount: 20 },
    '洗濯機 防水パン 隙間 カバー',
    { should_insert: true, primary_product: '洗濯機まわりの隙間対策用品', market_query: '洗濯機 隙間 ガード' }
  ) > 0,
  '悩み解決用品として必要なカバーはソファ等のカバー単品と区別して残す'
);
const alignedYogiboBody = context.uaAttachProductPlanMarker_(
  '<!-- UA_RINKER_PRODUCTS_START -->\n[itemlink post_id="601"]\n[itemlink post_id="602"]\n<!-- UA_RINKER_PRODUCTS_END -->',
  { should_insert: true, primary_product: 'ビーズソファ', market_query: 'ビーズソファ' }
);
assert.ok(
  context.uaGetExistingProductLinkAssessment_(alignedYogiboBody, yogiboRow, homeConfig).adequate,
  '比較記事ではメインキーワードに合う複数候補を保証済みと判定する'
);
const oneChoiceYogiboBody = context.uaAttachProductPlanMarker_(
  '<!-- UA_RINKER_PRODUCTS_START -->\n[itemlink post_id="601"]\n<!-- UA_RINKER_PRODUCTS_END -->',
  { should_insert: true, primary_product: 'ビーズソファ', market_query: 'ビーズソファ' }
);
assert.ok(
  !context.uaGetExistingProductLinkAssessment_(oneChoiceYogiboBody, yogiboRow, homeConfig).adequate,
  '商品比較記事を1商品だけで保証済みにしない'
);
const wrongChoiceYogiboBody = context.uaAttachProductPlanMarker_(
  '<!-- UA_RINKER_PRODUCTS_START -->\n[itemlink post_id="701"]\n[itemlink post_id="702"]\n<!-- UA_RINKER_PRODUCTS_END -->',
  { should_insert: true, primary_product: '除湿機', market_query: '除湿機 コンパクト' }
);
assert.ok(
  !context.uaGetExistingProductLinkAssessment_(wrongChoiceYogiboBody, yogiboRow, homeConfig).adequate,
  '件数が足りてもメインキーワードと違う自動商品は再選定する'
);
assert.ok(
  context.uaGetExistingProductLinkAssessment_('[itemlink post_id="801"]', yogiboRow, homeConfig).adequate,
  '手動Rinkerは自動置換せず保持する'
);
const originalGetSheetForData = context.uaGetSheetForData_;
const originalGetRakutenRowContext = context.uaGetRakutenRowContext_;
const originalBuildRowData = context.uaBuildRowData_;
const originalAddRakutenForContext = context.uaAddRakutenBannerForContext_;
const originalShouldInsert = context.uaShouldInsertRakutenAffiliateBanner_;
const fakeSheet = {};
let ensuredBody = alignedYogiboBody;
let ensureCalls = 0;
context.uaGetSheetForData_ = () => fakeSheet;
context.uaGetRakutenRowContext_ = () => ({
  sheet: fakeSheet,
  row: 2,
  rowData: yogiboRow,
  appConfig: homeConfig,
  body: ensuredBody
});
context.uaBuildRowData_ = () => ({ row: 2, body: ensuredBody });
context.uaShouldInsertRakutenAffiliateBanner_ = () => true;
context.uaAddRakutenBannerForContext_ = () => {
  ensureCalls += 1;
  ensuredBody = alignedYogiboBody;
  return { row: 2, body: ensuredBody };
};
context.uaEnsureAutomaticProductLinksForData_({ row: 2 });
assert.strictEqual(ensureCalls, 0, '適切な自動Rinkerがあれば保証工程を再実行しても増殖させない');
ensuredBody = oneChoiceYogiboBody;
context.uaEnsureAutomaticProductLinksForData_({ row: 2 });
assert.strictEqual(ensureCalls, 1, '比較候補が不足する自動Rinkerだけを再選定する');
context.uaAddRakutenBannerForContext_ = () => {
  ensureCalls += 1;
  ensuredBody = oneChoiceYogiboBody;
  return { row: 2, body: ensuredBody };
};
ensuredBody = oneChoiceYogiboBody;
assert.throws(
  () => context.uaEnsureAutomaticProductLinksForData_({ row: 2 }),
  /適切なRinker・楽天・Amazon導線を作成できませんでした/,
  '比較記事の再選定後も1候補しかない場合はWPへ進めず停止する'
);
ensuredBody = '[itemlink post_id="801"]';
context.uaEnsureAutomaticProductLinksForData_({ row: 2 });
assert.strictEqual(ensureCalls, 2, '手動Rinkerは商品導線保証工程でも置換しない');
context.uaGetSheetForData_ = originalGetSheetForData;
context.uaGetRakutenRowContext_ = originalGetRakutenRowContext;
context.uaBuildRowData_ = originalBuildRowData;
context.uaAddRakutenBannerForContext_ = originalAddRakutenForContext;
context.uaShouldInsertRakutenAffiliateBanner_ = originalShouldInsert;
const normalizedPopupPlan = context.uaExtractProductPlan_(popupBody);
assert.ok(
  context.uaCanUseSupplementalProductPlan_(normalizedPopupPlan, popupBody, popupRow, homeConfig),
  'トラブル解決記事でも購入前読者向けの補助商品を許可する'
);
assert.strictEqual(
  context.uaSelectRakutenProductQuery_(popupBody, popupRow, homeConfig),
  'ポップアップテント 収納しやすい',
  '補助商品の具体的な検索語を引き継ぐ'
);
assert.ok(
  context.uaShouldInsertRakutenAffiliateBanner_(popupBody, popupRow, homeConfig),
  '商品トラブル記事を一律に商品リンク対象外へしない'
);
const supplementalPopupPlan = context.uaBuildSupplementalProductPlan_(normalizedPopupPlan, popupRow, homeConfig);
assert.ok(
  supplementalPopupPlan.ctaReason.includes('買い替えは不要') && supplementalPopupPlan.ctaReason.includes('購入前'),
  '所有者と購入前読者を分けたCTAにする'
);
assert.strictEqual(
  supplementalPopupPlan.primaryProduct,
  'ポップアップテント',
  '空の商品計画でもメインキーワードから主役商品を復元する'
);
assert.strictEqual(
  supplementalPopupPlan.marketQuery,
  'ポップアップテント 収納しやすい',
  '空の商品計画でも比較用検索語を復元する'
);

const seidoPlan = context.uaNormalizeProductPlan_({
  should_insert: false,
  primary_product: '収納用品',
  market_query: '収納用品 家庭用',
  purpose: '補助金制度を確認する'
});
assert.ok(
  !context.uaCanUseSupplementalProductPlan_(seidoPlan, '<p>補助金の申請条件を確認します。</p>', { mainInput: '住宅 補助金 申請' }, homeConfig),
  '制度記事へ無関係な商品導線を足さない'
);

context.uaFetchRakutenItems_ = originalSingleFetch;
context.uaFetchRakutenItemsByQueries_ = originalMultiFetch;

const homeConfigForProfile = { key: 'home' };
assert.strictEqual(
  context.uaGetMainKeywordProductProfile_({ mainInput: 'テレビ アンテナ 映らない 原因' }, homeConfigForProfile),
  null,
  'トラブル解決系のテレビ記事は商品カタログに誤マッチさせない'
);
assert.ok(
  context.uaGetMainKeywordProductProfile_({ mainInput: 'テレビ 省スペース おすすめ' }, homeConfigForProfile),
  '購入検討系のテレビ記事は引き続きカタログにマッチする'
);

const comparisonPlan = context.uaBuildMainKeywordProductPlan_(
  { label: 'ビーズソファ', query: 'ビーズソファ 本体', comparison: true },
  context.uaNormalizeProductPlan_({ should_insert: true, required_features: ['特大サイズ'] })
);
assert.deepStrictEqual(
  Array.from(comparisonPlan.requiredFeatures || []),
  [],
  '比較記事ではAIの比較観点をrequiredFeaturesとして商品名に強制しない'
);
const nonComparisonPlan = context.uaBuildMainKeywordProductPlan_(
  { label: 'シーリングライト', query: 'シーリングライト 調色', comparison: false },
  context.uaNormalizeProductPlan_({ should_insert: true, required_features: ['調色機能'] })
);
assert.deepStrictEqual(
  Array.from(nonComparisonPlan.requiredFeatures || []),
  ['調色機能'],
  '比較記事でない場合はAIのrequiredFeaturesフィルタリングを維持する'
);

const coverWithNegation = context.uaScoreRakutenItem_(
  { name: 'ビーズソファカバー Lサイズ 本体は含まれません', url: 'https://item.rakuten.co.jp/shop/cover-only/' },
  { primaryProduct: 'ビーズソファ', marketQuery: 'ビーズソファ 本体' },
  'ビーズソファ 本体',
  0
);
assert.strictEqual(
  coverWithNegation,
  -1000,
  '「本体は含まれません」という否定文言のカバー単品商品は主役商品として選ばない'
);

context.PropertiesService = { getScriptProperties: () => ({ getProperty: () => '' }) };
const bareBanner = context.uaBuildRakutenItemBannerHtml_(
  [{ name: 'ダミー商品', url: 'https://item.rakuten.co.jp/shop/dummy/', imageUrl: '' }],
  'ダミー商品',
  null,
  { key: 'drive' }
);
delete context.PropertiesService;
assert.ok(
  bareBanner.includes('UA_PRODUCT_FOLLOWUP_START') && bareBanner.includes('UA_PRODUCT_FOLLOWUP_END'),
  'Rinker未使用サイトの商品バナーもUA_PRODUCT_FOLLOWUP印を付けて自動生成ブロックと分かるようにする'
);

console.log('Rinker and product routing tests: OK (32 checks)');
