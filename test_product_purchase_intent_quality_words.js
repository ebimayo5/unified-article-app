const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// 2026-09-04: uaGetMainKeywordProductProfile_'s purchase-intent gate only
// recognized explicit comparison/purchase words (比較, おすすめ, 口コミ...).
// A quality/durability-evaluation keyword like "カビない" is just as strong
// a buying signal in practice, but wasn't recognized -- confirmed live on
// kurashi-ie.com's #1-traffic page ("ランドリーチェストってカビない？"):
// the article never got treated as product-linked, so no chest product was
// ever inserted, and the pipeline fell back to an unrelated dehumidifier
// mention picked up from incidental body text instead.

const configSource = fs.readFileSync(path.join(__dirname, 'unified_article_app', 'config.gs'), 'utf8');
const utilsSource = fs.readFileSync(path.join(__dirname, 'unified_article_app', 'utils.gs'), 'utf8');
const linksSource = fs.readFileSync(path.join(__dirname, 'unified_article_app', 'links.gs'), 'utf8');
const articleSource = fs.readFileSync(path.join(__dirname, 'unified_article_app', 'article.gs'), 'utf8');

const context = { console };
vm.createContext(context);
vm.runInContext(configSource, context);
vm.runInContext(utilsSource, context);
vm.runInContext(linksSource, context);
vm.runInContext(articleSource, context);

const uaGetMainKeywordProductProfile_ = vm.runInContext('uaGetMainKeywordProductProfile_', context);
const homeConfig = { key: 'home' };

// The real regression case.
assert.ok(
  uaGetMainKeywordProductProfile_({ mainInput: 'ランドリーチェスト カビない' }, homeConfig),
  '「カビない」は品質評価語として購入検討シグナルに含まれ、商品ひも付きと判定される'
);

// A spread of other quality/durability evaluation words that should now
// also register as purchase intent when paired with a recognized product noun.
[
  '学習チェア 壊れやすい',
  'カーペット 汚れやすい',
  'ソファ へたる',
  '子供机 傷つきやすい',
  'ベビーゲート 使いにくい',
  '収納ラック 耐久性',
  '折りたたみテーブル コスパ',
  '室内物干し 丈夫'
].forEach(function(keyword) {
  assert.ok(
    uaGetMainKeywordProductProfile_({ mainInput: keyword }, homeConfig),
    '品質評価語を含む商品キーワードは商品ひも付きと判定される: ' + keyword
  );
});

// Existing protective null-cases must not regress: a product noun mentioned
// only incidentally inside a troubleshooting/non-purchase context must still
// return null (guards already covered by test_rinker_item_count.js, repeated
// here so this file documents the boundary this fix must not cross).
assert.strictEqual(
  uaGetMainKeywordProductProfile_({ mainInput: 'エアコン うるさい 原因' }, homeConfig),
  null,
  '困りごとの原因解説は引き続き商品ひも付きと誤判定しない'
);
assert.strictEqual(
  uaGetMainKeywordProductProfile_({ mainInput: 'テレビ アンテナ 映らない 原因' }, homeConfig),
  null,
  'トラブル解決系の記事は引き続き商品カタログに誤マッチさせない'
);
assert.strictEqual(
  uaGetMainKeywordProductProfile_({ mainInput: 'スタバ 氷少なめ' }, homeConfig),
  null,
  '商品性のない暮らし外キーワードへは引き続き無関係商品を出さない'
);

console.log('Product purchase-intent quality-word coverage: OK');
