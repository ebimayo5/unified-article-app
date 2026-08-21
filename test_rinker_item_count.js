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

console.log('Rinker and product routing tests: OK (9 checks)');
