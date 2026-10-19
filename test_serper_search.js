const assert = require('assert');
const fs = require('fs');

const outline = fs.readFileSync('unified_article_app/outline.gs', 'utf8');

function makePropertiesServiceMock(props) {
  return {
    getScriptProperties: () => ({
      getProperty: (key) => (Object.prototype.hasOwnProperty.call(props, key) ? props[key] : null)
    })
  };
}

function runWith(properties, fetchImpl) {
  const moduleBox = { exports: {} };
  const calls = [];
  const urlFetchApp = {
    fetch: (url, options) => {
      calls.push({ url, options });
      return fetchImpl(url, options);
    }
  };

  new Function(
    'PropertiesService',
    'UrlFetchApp',
    'module',
    outline + `
module.exports = {
  fetchSearchResultUrls: uaFetchSearchResultUrls_,
  fetchViaSerper: uaFetchGoogleTopUrlsViaSerpApi_,
  isUseful: uaIsUsefulCompetitorUrl_
};
`
  )(makePropertiesServiceMock(properties), urlFetchApp, moduleBox);

  return { exports: moduleBox.exports, calls };
}

// 1) APIキー未設定ならYahoo検索へフォールバックする
{
  const { exports: mod, calls } = runWith({}, (url) => ({
    getResponseCode: () => 200,
    getContentText: () => '<a href="https://example.com/from-scrape">link</a>'
  }));

  const urls = mod.fetchSearchResultUrls('テストキーワード', 3);
  assert(calls.every((c) => c.url.indexOf('search.yahoo.co.jp') !== -1),
    'Without a SerpApi key, only Yahoo search should be fetched');
  assert(urls.indexOf('https://example.com/from-scrape') !== -1, 'Scraped fallback URL must be returned');
}

// 2) 無料枠が残る間はSerpApiを使い、organic_resultsを返す
{
  const { exports: mod, calls } = runWith({ UA_SERPAPI_API_KEY: 'test-key' }, (url) => {
    if (url.startsWith('https://serpapi.com/account.json?')) return {
      getResponseCode: () => 200,
      getContentText: () => JSON.stringify({ total_searches_left: 240, this_month_usage: 10 })
    };
    assert(url.startsWith('https://serpapi.com/search.json?'), 'Must call SerpApi search endpoint');
    assert(url.includes('api_key=test-key'));
    assert(url.includes('gl=jp&hl=ja'));
    assert(url.includes('q=' + encodeURIComponent('テストキーワード')));
    return {
      getResponseCode: () => 200,
      getContentText: () => JSON.stringify({
        organic_results: [
          { link: 'https://example.com/one' },
          { link: 'https://www.google.com/should-be-filtered' },
          { link: 'https://example.com/one' },
          { link: 'https://example.com/two' },
          { link: 'https://example.com/three' }
        ]
      })
    };
  });

  const urls = mod.fetchSearchResultUrls('テストキーワード', 2);
  assert.strictEqual(calls.length, 2, 'Account API and search API must be called once each');
  assert.deepStrictEqual(urls, ['https://example.com/one', 'https://example.com/two'],
    'Must dedupe, filter junk domains, and respect maxCount');
}

// 3) 無料枠切れなら検索APIを呼ばずYahooへフォールバックする
{
  const { exports: mod, calls } = runWith({ UA_SERPAPI_API_KEY: 'test-key' }, (url) => {
    if (url.startsWith('https://serpapi.com/account.json?')) {
      return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ total_searches_left: 0, this_month_usage: 250 }) };
    }
    return {
      getResponseCode: () => 200,
      getContentText: () => '<a href="https://example.com/fallback-after-error">link</a>'
    };
  });

  const urls = mod.fetchSearchResultUrls('テストキーワード', 3);
  assert(calls.some((c) => c.url.startsWith('https://serpapi.com/account.json?')), 'Must check remaining quota first');
  assert(!calls.some((c) => c.url.startsWith('https://serpapi.com/search.json?')), 'Must not consume paid credits');
  assert(calls.some((c) => c.url.indexOf('search.yahoo.co.jp') !== -1), 'Must use Yahoo after quota exhaustion');
  assert(urls.indexOf('https://example.com/fallback-after-error') !== -1, 'Fallback result must still be returned');
}

// 4) 有料枠が残っていても、当月250回に達したら追加課金を避ける。
{
  const { exports: mod, calls } = runWith({ UA_SERPAPI_API_KEY: 'test-key' }, (url) => {
    if (url.startsWith('https://serpapi.com/account.json?')) {
      return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ total_searches_left: 1000, this_month_usage: 250 }) };
    }
    assert(url.includes('search.yahoo.co.jp'));
    return { getResponseCode: () => 200, getContentText: () => '<a href="https://example.com/free-fallback">link</a>' };
  });
  assert.deepStrictEqual(mod.fetchSearchResultUrls('テスト', 2), ['https://example.com/free-fallback']);
  assert(!calls.some((c) => c.url.startsWith('https://serpapi.com/search.json?')));
}

console.log('SerpApi free quota and Yahoo fallback tests passed.');
