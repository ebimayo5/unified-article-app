const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const source = fs.readFileSync('unified_article_app/article.gs', 'utf8');
const utils = fs.readFileSync('unified_article_app/utils.gs', 'utf8');
function setup(answer, page) {
  const calls = { ai: 0, page: 0 };
  const context = { console, uaCallOpenAiJson_: (prompt) => {
    calls.ai++;
    const input = JSON.parse(prompt.split('\n').pop());
    assert.ok(input.candidates.length <= 5);
    assert.ok(input.readerMindSummary.length <= 600);
    assert.ok(input.candidates.every(c => c.rakutenPage.status === 'ok'));
    assert.ok(calls.page > 0, '商品ページはAI呼び出し前に取得する');
    assert.ok(!prompt.includes('SECRET_BODY'));
    if (answer instanceof Error) throw answer;
    return { data: typeof answer === 'function' ? answer(input) : answer };
  }, UrlFetchApp: { fetch: (url, options) => {
    calls.page++;
    assert.strictEqual(options.followRedirects, false);
    assert.ok(url.startsWith('https://item.rakuten.co.jp/'));
    return { getResponseCode: () => 200, getContentText: () => '<title>' + page + '</title>' };
  } } };
  vm.createContext(context);
  vm.runInContext(utils, context);
  vm.runInContext(fs.readFileSync('unified_article_app/links.gs', 'utf8'), context);
  vm.runInContext(source, context);
  return { context, calls };
}
const goodName = 'アルファード ヴェルファイア 40系 テレビキャンセラー';
const plan = { shouldInsert: true, primaryProduct: 'アルファード40系 テレビキャンセラー',
  marketQuery: 'アルファード40系 テレビキャンセラー', requiredFeatures: ['40系', '適合表', '施工対応'],
  excludedFeatures: ['汎用'], exclude: ['汎用'] };
const query = plan.marketQuery;
function item(name, index = 0) {
  return { name, itemCode: 'shop:' + index, itemUrl: 'https://item.rakuten.co.jp/shop/item' + index + '/',
    url: 'https://affiliate.example/' + index, searchQuery: query, price: 10000, description: '製品説明' };
}
const good = item(goodName);
const answer = { selectedIndex: 0, reason: '40系アルファード用として記事の目的と一致する',
  ranking: [{ index: 0, reason: '車名と40系と商品カテゴリが明記されている', evidence: ['アルファード', 'テレビキャンセラー'] }], excluded: [] };
const run = (c, pool, p = plan, q = query) => c.uaRankRakutenArticleCandidates_([], pool,
  { row: 138, mainInput: q, readerMindMemo: '同乗者の快適性を考える', body: 'SECRET_BODY' }, p, q, 1, null);
{
  const { context: c, calls } = setup(answer, goodName);
  assert.strictEqual(run(c, [good])[0].name, goodName);
  assert.strictEqual(run(c, [good])[0].name, goodName);
  assert.deepStrictEqual(calls, { ai: 1, page: 1 }, '同一処理の再呼び出しはAPIも実ページも再取得しない');
}
for (const name of ['アルファード 30系 テレビキャンセラー', 'ノア 90系 テレビキャンセラー', '汎用 40系 テレビキャンセラー']) {
  const { context: c, calls } = setup(answer, name);
  assert.strictEqual(run(c, [item(name)]).length, 0, name);
  assert.strictEqual(calls.ai, 0, '明白な誤商品をAIへ送らない');
  assert.strictEqual(c.uaVerifyRankedRakutenPage_(item(name), plan), false, 'AIが選んでも後段で拒否');
}
for (const data of [new Error('provider secret'), { ...answer, selectedIndex: 12 }, { ...answer, reason: '' },
  { ...answer, ranking: [{ index: 0, reason: 'ok' }] }, { ...answer, excluded: [{ index: 0, reason: '重複したindexの除外理由' }] },
  { ...answer, selectedIndex: -1, ranking: [] }, null]) {
  const { context: c, calls } = setup(data, goodName);
  assert.strictEqual(run(c, [good]).length, 0);
  assert.strictEqual(run(c, [good]).length, 0);
  assert.strictEqual(calls.ai, 1, 'API失敗・不正JSONでも再送しない');
  assert.strictEqual(calls.page, 1, 'AI応答エラー前にページ取得済み');
}
for (const page of ['楽天市場 商品検索', 'アルファード 30系 テレビキャンセラー', 'Access Denied']) {
  const { context: c } = setup(answer, page);
  assert.strictEqual(run(c, [good]).length, 0, '実ページ不一致を拒否');
}
{
  const { context: c, calls } = setup(answer, goodName);
  assert.strictEqual(run(c, [{ ...good, itemUrl: 'https://evil.example/product' }]).length, 0);
  assert.strictEqual(calls.page, 0);
  assert.strictEqual(c.uaRakutenDirectItemUrl_('https://item.rakuten.co.jp.evil.example/shop/item/'), '');
}
for (const [name, q] of [['背もたれ付き ダイニングベンチ', 'ダイニングベンチ 背付き'],
  ['電子レンジ 本体 20L', '電子レンジ'], ['トイレットペーパー 1パック 4ロール', 'トイレットペーパー']]) {
  const perAnswer = { selectedIndex: 0, reason: '記事の目的と用途に合う商品として採用する',
    ranking: [{ index: 0, reason: '必要条件を商品名で確認できる', evidence: [name] }], excluded: [] };
  const { context: c } = setup(perAnswer, name);
  const candidate = { ...item(name), searchQuery: q };
  assert.strictEqual(run(c, [candidate], { shouldInsert: true, primaryProduct: q, marketQuery: q }, q).length, 1, name);
}
{
  const { context: c, calls } = setup(answer, '【楽天市場】40系用 テレビキャンセラー アルファード対応');
  assert.strictEqual(run(c, [good]).length, 1, 'API商品名の全文一致で正当な実ページを拒否しない');
  assert.strictEqual(calls.ai, 1);
}
{
  const { context: c } = setup({ ...answer, ranking: [{ ...answer.ranking[0], evidence: ['存在しない仕様説明'] }] }, goodName);
  assert.strictEqual(run(c, [good]).length, 0, 'ページに存在しない引用は拒否');
  assert.match(vm.runInContext('UA_LAST_PRODUCT_RANKING_REASON', c), /引用検証/);
}
{
  const { context: c, calls } = setup(answer, goodName);
  c.UrlFetchApp.fetch = () => ({ getResponseCode: () => 403 });
  assert.strictEqual(run(c, [good]).length, 0);
  assert.strictEqual(calls.ai, 0, '取得できないページだけならAIを呼ばない');
  assert.match(vm.runInContext('UA_LAST_PRODUCT_RANKING_REASON', c), /http_403/);
}
for (const matched of [true, false]) {
  const { context: c, calls } = setup((input) => {
    assert.strictEqual(input.candidates[0].amazonPages[0].title, 'Example AB-12345 黒 1個');
    assert.ok(!JSON.stringify(input).includes('<script'));
    return { selectedIndex: 0, reason: '記事に適合する車載用品として採用する', ranking: [{ index: 0,
      reason: '必要な製品仕様を実ページで確認した', evidence: ['Example AB-12345'],
      amazonMatch: { sameProduct: matched, index: 0, rakutenEvidence: ['Example AB-12345'], amazonEvidence: ['Example AB-12345'] }
    }], excluded: [] };
  }, '');
  let searches = 0;
  c.uaGetSerperApiKey_ = () => 'test-only';
  c.uaFetchGoogleTopUrlsViaSerper_ = () => { searches++; return ['https://www.amazon.co.jp/dp/B012345678']; };
  c.UrlFetchApp.fetch = (url, options) => {
    calls.page++;
    assert.strictEqual(options.followRedirects, false);
    return { getResponseCode: () => 200, getContentText: () => url.includes('amazon.co.jp')
      ? '<span id="productTitle">Example AB-12345 黒 1個</span>'
      : '<title>Example AB-12345 黒 1個</title>' };
  };
  const candidate = { ...item('Example AB-12345 黒 1個'), searchQuery: '車載用品' };
  const selected = run(c, [candidate], { primaryProduct: '車載用品' }, '車載用品');
  assert.strictEqual(selected.length, 1);
  assert.strictEqual(selected[0].amazonVerifiedUrl, matched ? 'https://www.amazon.co.jp/dp/B012345678' : '');
  run(c, [candidate], { primaryProduct: '車載用品' }, '車載用品');
  assert.strictEqual(searches, 1, '未登録メーカーも検索し、同一実行で再検索しない');
  assert.strictEqual(calls.ai, 1, '商品適合と両市場同一性を1回で判定');
  assert.strictEqual(calls.page, 2);
}
{
  const { context: c } = setup(answer, goodName);
  const candidate = { ...good, rakutenPage: { title: goodName, details: '' },
    amazonPages: [{ status: 'ok', url: 'https://www.amazon.co.jp/dp/B012345678', title: '別商品 30系', details: '' }] };
  const fabricated = { ...answer, ranking: [{ ...answer.ranking[0], amazonMatch: {
    sameProduct: true, index: 0, rakutenEvidence: ['アルファード'], amazonEvidence: ['アルファード'] } }] };
  assert.strictEqual(c.uaValidateProductRanking_(fabricated, [candidate]), null, 'Amazonの架空引用で同一商品扱いしない');
  fabricated.ranking[0].amazonMatch.index = 3;
  assert.strictEqual(c.uaValidateProductRanking_(fabricated, [candidate]), null, '候補外Amazon index拒否');
}
console.log('Rakuten AI ranking safety tests passed');
{
  const { context: c, calls } = setup(answer, goodName);
  const direct = 'https://item.rakuten.co.jp/shop/item0/';
  const wrapped = 'https://hb.afl.rakuten.co.jp/hgc/test/?pc=' + encodeURIComponent(direct) + '&m=' + encodeURIComponent(direct);
  assert.strictEqual(c.uaRakutenDirectItemUrl_(wrapped), direct);
  assert.strictEqual(run(c, [{ ...good, itemUrl: wrapped }]).length, 1, 'affiliateId指定APIのitemUrlも検証できる');
  assert.strictEqual(calls.page, 1, '広告リダイレクト自体は取得しない');
  for (const bad of [
    'https://hb.afl.rakuten.co.jp.evil.example/?pc=' + encodeURIComponent(direct),
    'https://hb.afl.rakuten.co.jp/hgc/test/?pc=' + encodeURIComponent('https://evil.example/x'),
    'https://hb.afl.rakuten.co.jp/hgc/test/?pc=%ZZ',
    'https://hb.afl.rakuten.co.jp/hgc/test/'
  ]) assert.strictEqual(c.uaRakutenDirectItemUrl_(bad), '', '不正ホスト・転送先・エンコード拒否');
  c.uaCallGeminiJson_ = () => { throw new Error('重複AI判定は禁止'); };
  assert.strictEqual(c.uaIsRakutenProductQueryRelevant_(query, { mainInput: query }, {}), true, 'AI選定済みクエリは配置処理で再判定しない');
}
{
  const { context: c } = setup(answer, goodName);
  c.uaSelectRakutenProductQuery_ = () => { throw new Error('旧検索語判定へ戻ってはいけない'); };
  c.uaBuildRakutenAffiliateBanner_ = () => '<p>verified product</p>';
  assert.ok(c.uaBuildRakutenFollowupBlock_('body', {}, {}).includes('verified product'), '後入れも実商品AI選定へ直接進む');
}
