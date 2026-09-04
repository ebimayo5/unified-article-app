const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// 2026-09-04: uaApplySecondaryProductMention_'s query is a single bare
// category noun matched from the article body (e.g. "照明"), fetched via
// uaFetchRakutenItems_ with no productPlan -- so none of the mustHave/
// exclude/primaryProduct filtering in uaScoreRakutenItem_ applies. Confirmed
// live on kurashi-ie.com/shutter-closed-all-the-time-demerits/: the query
// "照明" (lighting) returned a Duel Masters trading card named "照明魚" as
// the top Rakuten result, because its item name literally contains the
// substring "照明" and nothing else filters on genre. The existing
// uaIsRakutenProductQueryRelevant_ gate only judges whether the query
// CONCEPT fits the article (lighting genuinely fits a "room is dark"
// article), so it can't catch a bad ITEM slipping through under a fine
// query. uaIsRakutenItemNameRelevant_ checks the actual fetched item name
// instead, right before it's used to build the mention.

function freshContext() {
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
  return context;
}

const homeConfig = { key: 'home', label: 'たくみパパ' };
const rowData = { mainInput: 'シャッター 閉めっぱなし デメリット' };

// 1) relevant: true -> the item name passes.
{
  const context = freshContext();
  let calledWith = null;
  context.uaCallGeminiJson_ = function (prompt) {
    calledWith = prompt;
    return { data: { relevant: true, reason: 'ok' } };
  };
  const uaIsRakutenItemNameRelevant_ = vm.runInContext('uaIsRakutenItemNameRelevant_', context);
  assert.strictEqual(
    uaIsRakutenItemNameRelevant_('シーリングライト LED 調光調色 8畳用', '照明', rowData),
    true,
    'relevant:true from the model must allow the item through'
  );
  assert.ok(calledWith && calledWith.indexOf('シーリングライト LED 調光調色 8畳用') !== -1, 'the prompt must include the actual item name');
  assert.ok(calledWith && calledWith.indexOf('照明') !== -1, 'the prompt must include the category label');
}

// 2) relevant: false -> the item is rejected (this is the real trading-card case).
{
  const context = freshContext();
  context.uaCallGeminiJson_ = function () {
    return { data: { relevant: false, reason: 'トレーディングカードで無関係' } };
  };
  const uaIsRakutenItemNameRelevant_ = vm.runInContext('uaIsRakutenItemNameRelevant_', context);
  assert.strictEqual(
    uaIsRakutenItemNameRelevant_('デュエル・マスターズ 照明魚 【DM23-RP1 34/74 アンコモン】 双竜戦記 シングルカード', '照明', rowData),
    false,
    'relevant:false from the model must reject the item'
  );
}

// 3) The model call failing must fail closed (not relevant), not fail open.
{
  const context = freshContext();
  context.uaCallGeminiJson_ = function () {
    throw new Error('simulated network failure');
  };
  const uaIsRakutenItemNameRelevant_ = vm.runInContext('uaIsRakutenItemNameRelevant_', context);
  assert.strictEqual(
    uaIsRakutenItemNameRelevant_('シーリングライト LED 調光調色 8畳用', '照明', rowData),
    false,
    'a failed relevance check must fail closed (not relevant), not fail open'
  );
}

// 4) uaApplySecondaryProductMention_ end-to-end: a gate rejection must
// suppress the mention entirely -- the real 商品選択 bug this was written
// for (トレーディングカード linked under a home-improvement article).
{
  const context = freshContext();
  context.uaCallGeminiJson_ = function () {
    return { data: { relevant: false, reason: '無関係な商品' } };
  };
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
      getContentText: () => JSON.stringify({
        Items: [{
          itemName: 'デュエル・マスターズ 照明魚 【DM23-RP1 34/74 アンコモン】 双竜戦記 シングルカード',
          itemUrl: 'https://item.rakuten.co.jp/auc-stepreikodo/10262010/',
          itemPrice: 300,
          reviewCount: 0,
          reviewAverage: 0
        }]
      })
    })
  };
  context.Utilities = { sleep: () => {} };

  function padParagraphs(count, filler) {
    const long = (filler || '本文の説明が続きます。') +
      '読者が判断に迷わないよう、具体的な条件や確認ポイントを丁寧に説明する長めの段落です。' +
      'ここではさらに背景や注意点、よくある失敗例、確認しておきたい細かな条件までを具体的に補足しています。';
    return new Array(count).fill('<p>' + long + '</p>').join('\n');
  }
  const body = [
    '<p>導入文です。</p>',
    '<h2>日中でも暗く、居心地が変わりやすい</h2>',
    padParagraphs(40, '日中も閉めたままだと照明をつける時間が増えます。'),
    '<h2>よくある質問</h2>',
    '<h3>Q. 質問です</h3><p>A. 回答です。</p>',
    '<h2>まとめ</h2>',
    '<p>まとめの本文です。</p>'
  ].join('\n');

  const uaApplySecondaryProductMention_ = vm.runInContext('uaApplySecondaryProductMention_', context);
  const result = uaApplySecondaryProductMention_(body, rowData, homeConfig, 'シャッター 電動化');
  assert.ok(!result.includes('UA_SECONDARY_PRODUCT_START'), '関連性ゲートが拒否した商品は本文へ挿入されない');
  assert.ok(!result.includes('照明魚'), '無関係な商品名が本文に出てこない');
}

// 5) uaApplySecondaryProductMention_ end-to-end: a gate approval still
// inserts the mention as before (no regression on the legitimate path).
{
  const context = freshContext();
  context.uaCallGeminiJson_ = function () {
    return { data: { relevant: true, reason: 'ok' } };
  };
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
      getContentText: () => JSON.stringify({
        Items: [{
          itemName: 'LED照明 シーリングライト 8畳用 調光調色 リモコン付き',
          itemUrl: 'https://item.rakuten.co.jp/shop/ceiling-light/',
          itemPrice: 5980,
          reviewCount: 80,
          reviewAverage: 4.4
        }]
      })
    })
  };
  context.Utilities = { sleep: () => {} };

  function padParagraphs(count, filler) {
    const long = (filler || '本文の説明が続きます。') +
      '読者が判断に迷わないよう、具体的な条件や確認ポイントを丁寧に説明する長めの段落です。' +
      'ここではさらに背景や注意点、よくある失敗例、確認しておきたい細かな条件までを具体的に補足しています。';
    return new Array(count).fill('<p>' + long + '</p>').join('\n');
  }
  const body = [
    '<p>導入文です。</p>',
    '<h2>日中でも暗く、居心地が変わりやすい</h2>',
    padParagraphs(40, '日中も閉めたままだと照明をつける時間が増えます。'),
    '<h2>よくある質問</h2>',
    '<h3>Q. 質問です</h3><p>A. 回答です。</p>',
    '<h2>まとめ</h2>',
    '<p>まとめの本文です。</p>'
  ].join('\n');

  const uaApplySecondaryProductMention_ = vm.runInContext('uaApplySecondaryProductMention_', context);
  const result = uaApplySecondaryProductMention_(body, rowData, homeConfig, 'シャッター 電動化');
  assert.ok(result.includes('UA_SECONDARY_PRODUCT_START'), '関連性ゲートを通った商品は引き続き挿入される');
  assert.ok(result.includes('item.rakuten.co.jp/shop/ceiling-light'), '取得した商品への実リンクが含まれる');
}

console.log('Rakuten secondary item-name relevance gate: OK');
