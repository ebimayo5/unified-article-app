const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const ctx = {console, UA_COMPETITOR_FETCH_TIME_BUDGET_MS: 180000};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('unified_article_app/outline.gs','utf8'),ctx);
ctx.uaRecordSearchRoute_ = () => {};
const page = (url, title, body = title + 'について具体的な確認事項と選び方を解説します。'.repeat(30)) => ({url, title, bodyText:body, headings:[title],fetchStatus:'OK'});
let pages = [
  page('https://a-example.jp/article?utm_source=ad','買ってはいけないドライブレコーダーの注意点'),
  page('https://a-example.jp/other','ドラレコ選びの失敗'),
  page('https://b-example.jp/article','ドラレコの故障と避けるべき機種'),
  page('https://c-example.jp/article','ドライブレコーダーおすすめ', 'ドライブレコーダーの紹介です。'.repeat(30)),
  page('https://d-example.jp/article','中古車の選び方と失敗'),
  page('https://youtube.com/watch?v=1','買ってはいけないドラレコ'),
  page('https://shop-example.jp/category/recorder','買ってはいけないドラレコ'),
  {...page('https://e-example.jp/article','ドラレコの失敗'), fetchStatus:'HTTP 403'},
  page('https://f-example.jp/article','ドラレコの失敗','アクセスできません'),
];
let result = ctx.uaSelectRelevantCompetitorPages_(pages,'買って は いけない ドライブレコーダー');
assert.equal(result.length,2);
assert(result.every(p=> !p.url.includes('utm_source')));
assert.equal(new Set(result.map(p=>new URL(p.url).hostname)).size,2);
assert.equal(ctx.uaSelectRelevantCompetitorPages_([page('https://a-example.jp/article','GR86の故障')],'R8 壊れやすい').length,0);
assert.equal(ctx.uaSelectRelevantCompetitorPages_([page('https://a-example.jp/article','アウディR8の故障')],'R8 壊れやすい').length,1);
assert.equal(ctx.uaSelectRelevantCompetitorPages_([page('https://a-example.jp/article','アルファード HDMI 接続方法')],'アルファード HDMI ない').length,1);
assert.equal(ctx.uaSelectRelevantCompetitorPages_([page('https://a-example.jp/article','ヴォクシー HDMI 接続方法')],'アルファード HDMI ない').length,0);
assert.equal(ctx.uaSelectRelevantCompetitorPages_([page('https://a-example.jp/article','食器棚1800は収納が足りない')],'カップボード 1800 足りない').length,1);
assert.equal(ctx.uaSelectRelevantCompetitorPages_([page('https://a-example.jp/article','食器棚1200は収納が足りない')],'カップボード 1800 足りない').length,0);
assert(ctx.uaIsCompetitorArticleUrl_('https://note.com/person/n/abc'));
assert(!ctx.uaIsCompetitorArticleUrl_('https://www.amazon.co.jp/dp/B123'));
assert(!ctx.uaIsCompetitorArticleUrl_('https://kurashi-ie.com/article/'));
assert.equal(ctx.uaCanonicalCompetitorUrl_('https://a-example.jp/a?item=3&utm_source=b#abc'),'https://a-example.jp/a?item=3');
// 保存候補が不適切でも、追加検索は1回。既取得URLは再取得しない。
ctx.uaBuildReaderMindSearchQuery_ = s => s;
let searches=0, batches=[];
ctx.uaFetchSearchResultUrls_ = q => {searches++; return ['https://good-example.jp/article'];};
ctx.uaFetchCompetitorPageInfos_ = (urls,deadline) => {batches.push({urls:Array.from(urls),deadline});return urls.map(u=>u.includes('good')?page(u,'ドラレコの失敗と注意点'):page(u,'中古車の比較'));};
result=ctx.uaFetchStructureCompetitorPages_({mainInput:'ドラレコ 失敗',competitorUrl1:'https://old-example.jp/a',competitorUrl2:'https://old-example.jp/b',competitorUrl3:'https://old-example.jp/c'},{});
assert.equal(searches,1); assert.equal(result.length,1);
assert.equal(batches[0].deadline,batches[1].deadline);
// トレファイ供給本文にも同じ選別を適用する。適合0件ならAI呼出し前に停止。
searches=0;
ctx.uaFetchSearchResultUrls_ = () => {searches++;return [];};
assert.throws(()=>ctx.uaFetchStructureCompetitorPages_({mainInput:'ドラレコ 失敗'}, {}, [],[page('https://bad-example.jp/a','中古車の相場')]),/競合記事を確認できません/);
assert.equal(searches,1);
// 適合済み3サイトがあれば補充検索をしない。
searches=0;
result=ctx.uaFetchStructureCompetitorPages_({mainInput:'ドラレコ 失敗'}, {}, [],['a','b','c'].map(h=>page('https://'+h+'-example.jp/article','ドラレコの失敗と注意点')));
assert.equal(searches,0); assert.equal(result.length,3);
// 保存済みの不適合URLを次回へ引き継がず、0件なら元のシートを触らない。
let saved;
ctx.UA_COLUMNS={competitorUrl1:7};
const sheet={getRange:()=>({setValues:v=>{saved=v[0];}})};
ctx.uaSaveAutoCompetitorUrls_(sheet,1,{competitorUrl1:'https://bad-example.jp/a'},result);
assert(!saved.includes('https://bad-example.jp/a'));
assert.equal(saved.filter(Boolean).length,3);
saved=undefined;
ctx.uaSaveAutoCompetitorUrls_(sheet,1,{competitorUrl1:'https://old-example.jp/a'},[]);
assert.equal(saved,undefined);
console.log('Competitor selection tests PASS');
