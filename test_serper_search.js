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
  fetchViaSerper: uaFetchGoogleTopUrlsViaSerper_,
  isUseful: uaIsUsefulCompetitorUrl_
};
`
  )(makePropertiesServiceMock(properties), urlFetchApp, moduleBox);

  return { exports: moduleBox.exports, calls };
}

// 1) APIキー未設定ならSerperを呼ばず、Bing/Yahooスクレイピングへフォールバックする
{
  const { exports: mod, calls } = runWith({}, (url) => ({
    getResponseCode: () => 200,
    getContentText: () => '<a href="https://example.com/from-scrape">link</a>'
  }));

  const urls = mod.fetchSearchResultUrls('テストキーワード', 3);
  assert(calls.every((c) => c.url.indexOf('bing.com') !== -1 || c.url.indexOf('search.yahoo.co.jp') !== -1),
    'Without a Serper key, only Bing/Yahoo scraping URLs should be fetched');
  assert(urls.indexOf('https://example.com/from-scrape') !== -1, 'Scraped fallback URL must be returned');
}

// 2) APIキー設定時はSerperへPOSTし、organicのlinkだけを返す（自サイト・検索エンジン等は除外）
{
  const { exports: mod, calls } = runWith({ UA_SERPER_API_KEY: 'test-key' }, (url, options) => {
    assert.strictEqual(url, 'https://google.serper.dev/search', 'Must call Serper search endpoint');
    assert.strictEqual(options.method, 'post', 'Serper call must be a POST');
    assert.strictEqual(options.headers['X-API-KEY'], 'test-key', 'API key must be sent as X-API-KEY header');
    const payload = JSON.parse(options.payload);
    assert.strictEqual(payload.q, 'テストキーワード', 'Query must be forwarded as-is');
    assert.strictEqual(payload.gl, 'jp', 'Must scope results to Japan');
    assert.strictEqual(payload.hl, 'ja', 'Must request Japanese-language results');
    return {
      getResponseCode: () => 200,
      getContentText: () => JSON.stringify({
        organic: [
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
  assert.strictEqual(calls.length, 1, 'Serper success must not fall back to scraping');
  assert.deepStrictEqual(urls, ['https://example.com/one', 'https://example.com/two'],
    'Must dedupe, filter junk domains, and respect maxCount');
}

// 3) Serperがエラーを返した場合はBing/Yahooスクレイピングへフォールバックする
{
  let call = 0;
  const { exports: mod, calls } = runWith({ UA_SERPER_API_KEY: 'test-key' }, (url) => {
    call++;
    if (url === 'https://google.serper.dev/search') {
      return { getResponseCode: () => 500, getContentText: () => 'server error' };
    }
    return {
      getResponseCode: () => 200,
      getContentText: () => '<a href="https://example.com/fallback-after-error">link</a>'
    };
  });

  const urls = mod.fetchSearchResultUrls('テストキーワード', 3);
  assert(calls.some((c) => c.url === 'https://google.serper.dev/search'), 'Must attempt Serper first');
  assert(calls.some((c) => c.url.indexOf('bing.com') !== -1), 'Must fall back to scraping after a Serper error');
  assert(urls.indexOf('https://example.com/fallback-after-error') !== -1, 'Fallback result must still be returned');
}

console.log('Serper search integration tests passed.');
