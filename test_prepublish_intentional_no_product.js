const assert = require('assert');
const fs = require('fs');

const prePublish = fs.readFileSync('unified_article_app/pre_publish_check.gs', 'utf8');
const moduleBox = { exports: {} };
new Function('module', prePublish + `
module.exports = {
  hasIntentionalNoProductDecision: uaHasIntentionalNoProductDecision_,
  findStandaloneProductSections: uaFindPrePublishStandaloneProductSectionsWithoutRakuten_
};
`)(moduleBox);

const { hasIntentionalNoProductDecision, findStandaloneProductSections } = moduleBox.exports;
const article = [
  '<h2>食品以外の防災用品も期限と劣化を分けて点検</h2>',
  '<p>電池やボンベは表示とメーカー案内を確認します。</p>',
  '<h2>買い直す前の防災用品チェックリスト</h2>',
  '<p>保管場所と残存期限を確認します。</p>'
].join('');

assert.strictEqual(
  hasIntentionalNoProductDecision({
    factCheckPoints: '・商品導線保証をスキップ｜楽天検索で条件に合う商品がありませんでした'
  }),
  true,
  '商品なしの理由を記録した記事だけを意図的な商品導線省略として扱う'
);
assert.strictEqual(
  hasIntentionalNoProductDecision({ factCheckPoints: '・公開前チェックを実行しました' }),
  false,
  '商品なしの記録がない記事では従来の導線検査を維持する'
);
assert.deepStrictEqual(
  findStandaloneProductSections(article, false),
  ['食品以外の防災用品も期限と劣化を分けて点検', '買い直す前の防災用品チェックリスト'],
  '通常記事の用品専用H2は、対応商品導線がない場合に検出する'
);
assert.deepStrictEqual(
  findStandaloneProductSections(article, true),
  [],
  '適合候補なしを記録して商品導線を省略した記事では、安全確認のH2をNGにしない'
);

console.log('Intentional no-product pre-publish tests passed.');
