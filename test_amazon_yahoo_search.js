const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
function setup(mode = 'ok') {
  const calls = [];
  const c = { console,
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'configured-serpapi-key' }) },
    UrlFetchApp: { fetch: (url) => {
      calls.push(url);
      assert.ok(!url.includes('serpapi.com'), 'Amazon lookup must never spend SerpApi quota');
      if (url.startsWith('https://search.yahoo.co.jp/search?p=')) {
        if (mode === 'error') throw new Error('Yahoo unavailable');
        if (mode === 'model-error' && !decodeURIComponent(url).includes('黒')) throw new Error('Model lookup unavailable');
        return { getResponseCode: () => 200, getContentText: () => mode === 'empty' ? '' :
          '<a href="https://example.com/unrelated">other</a>' +
          '<a href="https://www.amazon.co.jp/s?k=test">search</a>' +
          '<a href="https://www.amazon.co.jp/dp/B012345678">product</a>' +
          '<a href="https://www.amazon.co.jp/gp/product/B012345678">duplicate</a>' };
      }
      assert.strictEqual(url, 'https://www.amazon.co.jp/dp/B012345678');
      return { getResponseCode: () => 200, getContentText: () => '<span id="productTitle">Example AB-12345 黒 1個</span>' };
    } }
  };
  vm.createContext(c);
  ['utils.gs', 'outline.gs', 'article.gs'].forEach(f => vm.runInContext(fs.readFileSync('unified_article_app/' + f, 'utf8'), c));
  return { c, calls };
}
const item = { name: 'Example AB-12345 黒 1個', rakutenPage: { title: 'Example AB-12345 黒 1個' } };
{
  const { c, calls } = setup();
  const result = c.uaFindAmazonProductPages_(item);
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].url, 'https://www.amazon.co.jp/dp/B012345678');
  assert.strictEqual(result[0].status, 'ok');
  result[0].title = 'mutated';
  assert.strictEqual(c.uaFindAmazonProductPages_({ ...item, name: 'Example AB-12345 別販売店' })[0].title, 'Example AB-12345 黒 1個');
  assert.strictEqual(calls.length, 3, 'Two distinct queries share the same product facts and are reused');
  assert.ok(calls.some(url => decodeURIComponent(url).includes('AB-12345 黒 1個')), 'Full name retains model punctuation and specifications');
}
for (const mode of ['error', 'empty']) {
  const { c, calls } = setup(mode);
  assert.strictEqual(c.uaFindAmazonProductPages_(item).length, 0);
  assert.strictEqual(c.uaFindAmazonProductPages_(item).length, 0);
  assert.strictEqual(calls.length, 2, 'Each distinct unavailable query is tried once without SerpApi');
}
{
  const { c, calls } = setup('model-error');
  assert.strictEqual(c.uaFindAmazonProductPages_(item).length, 1, 'Full-name search recovers from a failed model search');
  assert.strictEqual(calls.length, 3);
}
console.log('Amazon Yahoo lookup tests passed');
