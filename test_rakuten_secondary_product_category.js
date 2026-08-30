const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

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

const uaFindSecondaryProductSectionQuery_ = vm.runInContext('uaFindSecondaryProductSectionQuery_', context);
const uaApplySecondaryProductMention_ = vm.runInContext('uaApplySecondaryProductMention_', context);

const driveConfig = { key: 'drive', label: 'DRIVE BASE' };
const homeConfig = { key: 'home', label: 'たくみパパ' };
const generalConfig = { key: 'general', label: '汎用記事' };

// This is the real 2026-08-30 case that surfaced this gap: タフト 買って
// よかった's product plan targets "中古車" (used car) and explicitly excludes
// accessories, so the primary Rakuten banner never covers a later H2 that
// names specific accessory items (floor mat, luggage mat, phone holder).
// uaExtractRakutenH2Sections_ needs real paragraph bulk to clear the 4000-char
// gate, same padding approach as test_rakuten_secondary_touchpoint.js.
function padParagraphs(count, filler) {
  const long = (filler || '本文の説明が続きます。読者の判断に役立つ具体的な内容をここに詳しく書いています。') +
    '読者が判断に迷わないよう、具体的な条件や確認ポイントを丁寧に説明する長めの段落です。' +
    'ここではさらに背景や注意点、よくある失敗例、確認しておきたい細かな条件までを具体的に補足しています。';
  return new Array(count).fill('<p>' + long + '</p>').join('\n');
}

function buildTaftLikeBody() {
  return [
    '<p>導入文です。</p>',
    '<h2>タフトの中古車を探す前に確認したいこと</h2>',
    padParagraphs(15, 'ダイハツ タフトの中古車を選ぶときの年式・装備・保証の確認点を説明します。'),
    '<h2>納車後の用品は優先順位を付けて選ぶ</h2>',
    '<p>フロアマットとラゲッジマット、スマホホルダーは特に優先度が高い用品です。</p>',
    padParagraphs(15, '用品を選ぶときの注意点を具体的に説明します。'),
    '<h2>よくある質問</h2>',
    '<h3>Q. 質問です</h3><p>A. 回答です。</p>',
    '<h2>まとめ</h2>',
    '<p>まとめの本文です。</p>'
  ].join('\n');
}

// 1) uaFindSecondaryProductSectionQuery_: finds the distinct-category section
// and maps it to the canonical Rakuten query, when the primary query targets
// something else entirely (used car).
{
  const body = buildTaftLikeBody();
  const match = uaFindSecondaryProductSectionQuery_(body, driveConfig, 'ダイハツ タフト 中古車');
  assert.ok(match, '用品セクションが見つかる');
  assert.strictEqual(match.query, 'フロアマット 車種適合', '本文中で最初に一致した用品カテゴリのクエリが選ばれる');
  assert.ok(match.section.headingText.indexOf('納車後の用品') !== -1, '正しいH2セクションが選ばれる');
}

// 2) Must not fire when the primary query IS the same category (no point
// adding a redundant second mention for the same product).
{
  const body = buildTaftLikeBody();
  const match = uaFindSecondaryProductSectionQuery_(body, driveConfig, 'フロアマット 車種適合');
  assert.strictEqual(match, null, 'メインの検索条件と同じカテゴリなら発火しない');
}

// 3) Short articles (below the light-mention length gate) must not fire,
// same threshold as the existing same-product secondary touchpoint.
{
  const shortBody = [
    '<h2>タフトの中古車を探す前に確認したいこと</h2>',
    '<p>短い本文です。</p>',
    '<h2>納車後の用品は優先順位を付けて選ぶ</h2>',
    '<p>フロアマットが優先度の高い用品です。</p>'
  ].join('\n');
  const match = uaFindSecondaryProductSectionQuery_(shortBody, driveConfig, 'ダイハツ タフト 中古車');
  assert.strictEqual(match, null, '短い記事では発火しない');
}

// 4) No matching accessory term anywhere -- must return null, not throw.
{
  const body = [
    '<h2>タフトの中古車を探す前に確認したいこと</h2>',
    padParagraphs(15, 'ダイハツ タフトの中古車を選ぶときの年式・装備・保証の確認点を説明します。'),
    '<h2>試乗と納車までの流れ</h2>',
    padParagraphs(15, '試乗の予約から納車までの一般的な流れを具体的に説明します。'),
    '<h2>まとめ</h2>',
    '<p>まとめの本文です。</p>'
  ].join('\n');
  const match = uaFindSecondaryProductSectionQuery_(body, driveConfig, 'ダイハツ タフト 中古車');
  assert.strictEqual(match, null, '用品に触れていない記事では発火しない');
}

// 5) 汎用記事 (general) is not in the per-app pattern map -- must return null.
{
  const body = buildTaftLikeBody();
  const match = uaFindSecondaryProductSectionQuery_(body, generalConfig, 'ダイハツ タフト 中古車');
  assert.strictEqual(match, null, '汎用記事では対象外');
}

// 6) たくみパパ (home) side also works with its own accessory pattern.
{
  const body = [
    '<h2>サンシェードの選び方</h2>',
    padParagraphs(20, 'ベランダ用サンシェードの選び方を具体的に説明します。'),
    '<h2>設置後に見直したい収納用品</h2>',
    '<p>ランドリー用のチェストも優先度が高い収納用品です。</p>',
    padParagraphs(15, '収納用品を選ぶときの注意点を具体的に説明します。'),
    '<h2>まとめ</h2>',
    '<p>まとめの本文です。</p>'
  ].join('\n');
  const match = uaFindSecondaryProductSectionQuery_(body, homeConfig, 'サンシェード ベランダ 日よけ');
  assert.ok(match, 'たくみパパ側でも用品セクションが見つかる');
  assert.notStrictEqual(match.query, 'サンシェード ベランダ 日よけ', 'メインとは別カテゴリのクエリになる');
}

// 7) uaApplySecondaryProductMention_ end-to-end: fetches Rakuten items with
// the derived query and inserts a light-mention block at the section's end.
{
  context.PropertiesService = {
    getScriptProperties: () => ({
      getProperty: (key) => ({
        UA_RAKUTEN_APPLICATION_ID: 'test-app-id',
        UA_RAKUTEN_ACCESS_KEY: 'test-access-key'
      }[key] || '')
    })
  };
  const requestedKeywords = [];
  context.UrlFetchApp = {
    fetch: (url) => {
      const match = url.match(/keyword=([^&]+)/);
      requestedKeywords.push(match ? decodeURIComponent(match[1]) : null);
      return {
        getResponseCode: () => 200,
        getContentText: () => JSON.stringify({
          Items: [{
            itemName: 'カー用フロアマット 4点セット',
            itemUrl: 'https://item.rakuten.co.jp/shop/floor-mat/',
            itemPrice: 6980,
            reviewCount: 120,
            reviewAverage: 4.3
          }]
        })
      };
    }
  };
  context.Utilities = { sleep: () => {} };

  const body = buildTaftLikeBody();
  const result = uaApplySecondaryProductMention_(body, { mainInput: 'タフト 買って よかった' }, driveConfig, 'ダイハツ タフト 中古車');

  assert.ok(requestedKeywords.indexOf('フロアマット 車種適合') !== -1, '楽天APIへ用品側のクエリで検索が飛ぶ: ' + JSON.stringify(requestedKeywords));
  assert.ok(result.includes('UA_SECONDARY_PRODUCT_START'), 'セカンダリ商品メンションのマーカーが挿入される');
  assert.ok(result.includes('item.rakuten.co.jp/shop/floor-mat'), '取得した商品への実リンクが含まれる');
  const h2Index = result.indexOf('納車後の用品は優先順位を付けて選ぶ');
  const markerIndex = result.indexOf('UA_SECONDARY_PRODUCT_START');
  assert.ok(markerIndex > h2Index, 'メンションは該当H2セクションの後に挿入される');

  // Idempotency: reapplying must not duplicate the block.
  const reapplied = uaApplySecondaryProductMention_(result, { mainInput: 'タフト 買って よかった' }, driveConfig, 'ダイハツ タフト 中古車');
  assert.strictEqual((reapplied.match(/UA_SECONDARY_PRODUCT_START/g) || []).length, 1, '再適用しても重複しない');
}

// 8) No Rakuten results -- must return the body unchanged, not throw or
// insert an empty block.
{
  context.PropertiesService = {
    getScriptProperties: () => ({
      getProperty: (key) => ({
        UA_RAKUTEN_APPLICATION_ID: 'test-app-id',
        UA_RAKUTEN_ACCESS_KEY: 'test-access-key'
      }[key] || '')
    })
  };
  context.UrlFetchApp = {
    fetch: () => ({
      getResponseCode: () => 200,
      getContentText: () => JSON.stringify({ Items: [] })
    })
  };
  context.Utilities = { sleep: () => {} };

  const body = buildTaftLikeBody();
  const result = uaApplySecondaryProductMention_(body, { mainInput: 'タフト 買って よかった' }, driveConfig, 'ダイハツ タフト 中古車');
  assert.ok(!result.includes('UA_SECONDARY_PRODUCT_START'), '商品が見つからない場合は何も挿入しない');
}

console.log('Rakuten secondary product-category mention: OK');
