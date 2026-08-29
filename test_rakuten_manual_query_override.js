const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const configSource = fs.readFileSync(
  path.join(__dirname, 'unified_article_app', 'config.gs'),
  'utf8'
);
const utilsSource = fs.readFileSync(
  path.join(__dirname, 'unified_article_app', 'utils.gs'),
  'utf8'
);
const source = fs.readFileSync(
  path.join(__dirname, 'unified_article_app', 'article.gs'),
  'utf8'
);
const context = { console };
vm.createContext(context);
vm.runInContext(configSource, context);
vm.runInContext(utilsSource, context);
vm.runInContext(source, context);

const homeConfig = { key: 'home', label: 'たくみパパ' };

// A mainInput that happens to mention a home appliance ("冷蔵庫") alongside an
// opinion word ("後悔") triggers uaGetMainKeywordProductProfile_'s generic
// keyword-catchall, which used to always win over an explicit manual
// "楽天商品キーワード：" override in 案件注意点 -- even though the manual override
// exists specifically to correct cases where the raw topic phrase is not
// itself a purchasable product. This test locks in that the manual override
// now takes priority.
const rowData = {
  mainInput: '冷蔵庫 コンロ 向かい合わせ 後悔',
  affiliateNotes: '楽天商品キーワード：防熱ボード',
  titleIdeas: '',
  readerMindMemo: ''
};

// 1) uaSelectRakutenProductQuery_ itself must return the manual override,
// not the mainInput-derived keyword-catchall query.
{
  const query = context.uaSelectRakutenProductQuery_('<p>本文</p>', rowData, homeConfig);
  assert.strictEqual(query, '防熱ボード', '案件注意点の手動指定が、メインキーワードの自動キャッチオールより優先される');
}

// 2) uaGetMainKeywordProductProfile_ itself still finds a (wrong-for-this-case)
// catchall match on the raw keyword, confirming this test exercises the real
// precedence conflict rather than a case where no conflict exists.
{
  const profile = context.uaGetMainKeywordProductProfile_(rowData, homeConfig);
  assert.ok(profile && profile.source === 'keyword', '前提条件: メインキーワードのキャッチオールが本来ヒットするケースであること');
  assert.strictEqual(profile.query, '冷蔵庫 コンロ 向かい合わせ', '前提条件: キャッチオールはメインキーワードそのものを商品名として扱う');
}

// 3) The actual Rakuten API search (uaBuildRakutenAffiliateBanner_'s internal
// item fetch) must be called with the manual override keyword, not the raw
// mainInput text.
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
        getContentText: () => JSON.stringify({ items: [] })
      };
    }
  };
  context.Utilities = { sleep: () => {} };

  context.uaBuildRakutenAffiliateBanner_('<p>本文</p>', rowData, homeConfig);

  assert.ok(requestedKeywords.length > 0, '楽天APIへの検索リクエストが発生する');
  assert.ok(
    requestedKeywords.every((keyword) => keyword === '防熱ボード'),
    '実際にAPIへ送られる検索キーワードも手動指定のものになる（メインキーワードそのものは使われない）: ' +
      JSON.stringify(requestedKeywords)
  );
}

console.log('Rakuten manual query override precedence: OK');
