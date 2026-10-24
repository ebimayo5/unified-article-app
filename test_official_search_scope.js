const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const queries = [];
const ctx = { console, uaRequiresFreshOfficialSourceSearch_: () => true,
  uaFetchSearchResultUrls_: q => { queries.push(q); return []; },
  uaFetchCompetitorPageInfos_: () => [] };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('unified_article_app/links.gs', 'utf8'), ctx);
ctx.uaDiscoverCurrentOfficialSources_('買って は いけない ドライブレコーダー', {}, '現在の価格や中古車相場、認定中古車のCTA。走行中の画面を注視しない');
assert(!queries.some(q => /認定中古車|中古車 相場|現在 価格|決算 IR/.test(q)), queries.join('\n'));
assert(queries.some(q => /メーカー 取扱説明書 録画 microSD/.test(q)));
assert(queries.some(q => /site:npa.go.jp/.test(q)));
queries.length = 0;
ctx.uaDiscoverCurrentOfficialSources_('認定中古車 価格 相場', {}, '');
assert(queries.some(q => /現在 価格/.test(q)));
assert(queries.some(q => /中古車 相場 現在/.test(q)));
queries.length = 0;
ctx.uaDiscoverCurrentOfficialSources_('日産 経営 決算', {}, '');
assert(queries.some(q => /決算 IR/.test(q)));
assert(!ctx.uaIsLikelyOfficialSourcePage_({url:'https://shop.example.com/recorder', title:'公式 おすすめランキング'}));
assert(ctx.uaIsLikelyOfficialSourcePage_({url:'https://www.npa.go.jp/bureau/traffic/keitai/info.html'}));
assert(ctx.uaIsLikelyOfficialSourcePage_({url:'https://toyota.jp/ownersmanual/'}));
console.log('Official search scope tests PASS');
