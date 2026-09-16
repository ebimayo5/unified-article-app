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
    assert.ok(input.candidates.length <= 10);
    assert.ok(input.readerMindSummary.length <= 1200);
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
  assert.strictEqual(calls.page, 0);
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
console.log('Rakuten AI ranking safety tests passed');
