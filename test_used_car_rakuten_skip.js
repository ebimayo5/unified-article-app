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
// uaApplySecondaryProductMention_ (reached via uaApplyRakutenAffiliateBanner_)
// now gates the fetched item's name through a lightweight Gemini relevance
// check; this file doesn't load api.gs, so stub it to preserve the
// pre-existing "assume relevant" behavior these tests were written against.
context.uaCallGeminiJson_ = function () {
  return { data: { relevant: true } };
};

const uaIsUsedCarProductPlan_ = vm.runInContext('uaIsUsedCarProductPlan_', context);
const uaHasManagedUsedCarAffiliate_ = vm.runInContext('uaHasManagedUsedCarAffiliate_', context);
const uaAttachProductPlanMarker_ = vm.runInContext('uaAttachProductPlanMarker_', context);
const uaApplyRakutenAffiliateBanner_ = vm.runInContext('uaApplyRakutenAffiliateBanner_', context);

const driveConfig = { key: 'drive', label: 'DRIVE BASE' };

// Real 2026-08-30 case: タフト 買って よかった's product plan targets "中古車"
// (a category Rakuten Ichiba structurally cannot sell -- confirmed live, the
// search "ダイハツ タフト 中古車" returned zero Rakuten items), while the row
// already has ガリバー中古車ご提案サービス assigned as its managed affiliate
// with UA_MAIN_AFFILIATE_CTA_START already present in the body (confirmed
// live via uaCheckTaftManagedAffiliateSetup20260830). The real used-car
// funnel already works independently of Rakuten -- so a used-car product
// plan should skip the doomed Rakuten search rather than attempt and fail it.

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
    '<h2>UA_MAIN_AFFILIATE_CTA_START</h2>',
    '<!-- UA_MAIN_AFFILIATE_CTA_START --><p>ガリバーで中古車の提案を見る</p><!-- UA_MAIN_AFFILIATE_CTA_END -->',
    '<h2>よくある質問</h2>',
    '<h3>Q. 質問です</h3><p>A. 回答です。</p>',
    '<h2>まとめ</h2>',
    '<p>まとめの本文です。</p>'
  ].join('\n');
}

const usedCarPlan = {
  shouldInsert: true,
  primaryProduct: '中古車',
  marketQuery: 'ダイハツ タフト 中古車',
  purpose: '中古車選びの参考にする',
  mustHave: [],
  exclude: ['アクセサリー'],
  purchaseScale: 'large',
  requiredFeatures: [],
  excludedFeatures: ['アクセサリー'],
  benefit: '希望条件に合う中古車を探しやすくなります',
  ctaReason: '中古車を探す場合は在庫を確認できます'
};

const gulliverRow = { mainInput: 'タフト 買って よかった', affiliateName: 'ガリバー中古車ご提案サービス' };
const carnextRow = { mainInput: 'タフト 買って よかった', affiliateName: 'カーネクスト' };
const noManagedAffiliateRow = { mainInput: 'タフト 買って よかった', affiliateName: '' };

// 1) uaIsUsedCarProductPlan_ / uaHasManagedUsedCarAffiliate_ unit checks.
{
  assert.ok(uaIsUsedCarProductPlan_(usedCarPlan), '中古車の商品選定設計を検出する');
  assert.ok(!uaIsUsedCarProductPlan_({ primaryProduct: 'フロアマット', marketQuery: 'フロアマット 車種適合' }), '中古車以外は検出しない');
  assert.ok(!uaIsUsedCarProductPlan_(null), 'プランがなければfalse');

  assert.ok(uaHasManagedUsedCarAffiliate_(gulliverRow), 'ガリバーは中古車系管理案件として検出される');
  assert.ok(uaHasManagedUsedCarAffiliate_(carnextRow), 'カーネクストも検出される');
  assert.ok(!uaHasManagedUsedCarAffiliate_(noManagedAffiliateRow), '案件未設定では検出されない');
  assert.ok(!uaHasManagedUsedCarAffiliate_({ affiliateName: 'ottocast' }), '無関係の案件では検出されない');
}

// 2) End-to-end: with a used-car plan AND ガリバー already assigned, the
// Rakuten search must never be attempted (no UrlFetchApp call), and the
// body must come back with the accessory H2's secondary product mention
// still able to run via uaApplySecondaryProductMention_.
{
  let fetchCalled = false;
  context.PropertiesService = {
    getScriptProperties: () => ({
      getProperty: (key) => ({
        UA_RAKUTEN_APPLICATION_ID: 'test-app-id',
        UA_RAKUTEN_ACCESS_KEY: 'test-access-key'
      }[key] || '')
    })
  };
  context.UrlFetchApp = {
    fetch: (url) => {
      fetchCalled = true;
      const match = url.match(/keyword=([^&]+)/);
      const keyword = match ? decodeURIComponent(match[1]) : '';
      if (/中古車/.test(keyword)) {
        return {
          getResponseCode: () => 200,
          getContentText: () => JSON.stringify({ Items: [] })
        };
      }
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

  const bodyWithPlan = uaAttachProductPlanMarker_(buildTaftLikeBody(), usedCarPlan);
  const result = uaApplyRakutenAffiliateBanner_(bodyWithPlan, gulliverRow, driveConfig);

  assert.ok(!/ダイハツ\s*タフト\s*中古車/.test(context.UA_LAST_RAKUTEN_QUERY || ''), '中古車の検索クエリは楽天へ送られない: ' + context.UA_LAST_RAKUTEN_QUERY);
  assert.ok(result.includes('UA_SECONDARY_PRODUCT_START'), '用品セクションのセカンダリ商品メンションは引き続き挿入される');
  assert.ok(result.includes('item.rakuten.co.jp/shop/floor-mat'), 'フロアマットの実リンクが含まれる');
}

// 3) Same used-car plan but WITHOUT a managed used-car affiliate on the row
// -- must fall through to the normal (failing) Rakuten flow, not silently
// suppress monetization for rows that were never set up with ガリバー/
// カーネクスト. This locks the fix to its intended narrow scope.
{
  context.PropertiesService = {
    getScriptProperties: () => ({
      getProperty: (key) => ({
        UA_RAKUTEN_APPLICATION_ID: 'test-app-id',
        UA_RAKUTEN_ACCESS_KEY: 'test-access-key'
      }[key] || '')
    })
  };
  let requestedAnyKeyword = false;
  context.UrlFetchApp = {
    fetch: () => {
      requestedAnyKeyword = true;
      return {
        getResponseCode: () => 200,
        getContentText: () => JSON.stringify({ Items: [] })
      };
    }
  };
  context.Utilities = { sleep: () => {} };

  const bodyWithPlan = uaAttachProductPlanMarker_(buildTaftLikeBody(), usedCarPlan);
  uaApplyRakutenAffiliateBanner_(bodyWithPlan, noManagedAffiliateRow, driveConfig);
  assert.ok(requestedAnyKeyword, '管理案件が無い行では従来どおり楽天検索を試みる');
}

console.log('used-car Rakuten skip: OK');
