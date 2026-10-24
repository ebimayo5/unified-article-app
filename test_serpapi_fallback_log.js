const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const source = fs.readFileSync('unified_article_app/outline.gs', 'utf8');
function run(reason, failWrite = false) {
  const events = [];
  const props = { UA_SERPAPI_API_KEY: 'secret-key' };
  const context = {
    console: { warn: value => events.push(['log', value]) },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: key => props[key],
      setProperty: (key, value) => { if (failWrite) throw Error('storage'); props[key] = value; events.push(['save']); }
    }) }
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  context.uaFetchGoogleTopUrlsViaSerpApi_ = () => { if (reason) throw Error(reason); return []; };
  context.uaFetchSearchHtml_ = () => { events.push(['yahoo']); return ''; };
  context.uaExtractSearchResultUrls_ = () => ['https://example.com'];
  assert.equal(context.uaFetchSearchResultUrls_('日本語検索', 1)[0], 'https://example.com');
  assert.equal(events[0][0], 'log');
  assert(events.findIndex(e => e[0] === 'yahoo') > 0);
  assert(!events[0][1].includes('secret-key'));
  if (!failWrite) {
    const entry = JSON.parse(props.UA_SERPAPI_LAST_FALLBACK);
    assert.equal(entry.query, '日本語検索');
    assert.equal(entry.fallback, 'Yahoo');
    assert(entry.time);
    assert.equal(entry.reason, reason ? 'SERPAPI_UNAVAILABLE: [URL] secret=[REDACTED]' : 'NO_USABLE_RESULTS');
  }
}
run('SERPAPI_UNAVAILABLE: https://serpapi.com/search?api_key=secret-key secret=secret-key');
run(null);
run('quota', true);
console.log('SerpApi fallback logging tests PASS');
