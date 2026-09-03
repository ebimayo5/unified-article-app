const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// 2026-09-02: keyword-based candidate matching (uaHomeRakutenProductCandidates_,
// uaPrioritizedRakutenQueriesFromBody_) and the AI-authored UA_PRODUCT_PLAN
// both select a query without checking whether the match represents genuine
// reader interest or just an incidental mention (e.g. an equipment name
// listed as one example among several in a caution sentence). Confirmed live
// on kurashi-ie.com/yabugarashi-kujo/: a weed-removal article ended up
// recommending storage boxes (from the word "片付け", used only in the sense
// of "cleaning up weed debris") and air-conditioner installation parts (from
// "エアコン配管" mentioned once as an example of equipment vines might wrap
// around). uaIsRakutenProductQueryRelevant_ adds a lightweight LLM gate in
// front of the final query before it's used, so a candidate that matched on
// a technicality but isn't a genuine fit for the article gets dropped
// instead of shown to readers.

const configSource = fs.readFileSync(path.join(__dirname, 'unified_article_app', 'config.gs'), 'utf8');
const utilsSource = fs.readFileSync(path.join(__dirname, 'unified_article_app', 'utils.gs'), 'utf8');
const linksSource = fs.readFileSync(path.join(__dirname, 'unified_article_app', 'links.gs'), 'utf8');
const articleSource = fs.readFileSync(path.join(__dirname, 'unified_article_app', 'article.gs'), 'utf8');

function freshContext() {
  const context = { console };
  vm.createContext(context);
  vm.runInContext(configSource, context);
  vm.runInContext(utilsSource, context);
  vm.runInContext(linksSource, context);
  vm.runInContext(articleSource, context);
  return context;
}

const homeConfig = { key: 'home', label: 'たくみパパ' };
const rowData = { mainInput: 'ヤブガラシ 駆除' };

// relevant: true -> the raw query passes through.
{
  const context = freshContext();
  let calledWith = null;
  context.uaCallGeminiJson_ = function (prompt) {
    calledWith = prompt;
    return { data: { relevant: true, reason: 'ok' } };
  };
  const uaIsRakutenProductQueryRelevant_ = vm.runInContext('uaIsRakutenProductQueryRelevant_', context);
  assert.strictEqual(
    uaIsRakutenProductQueryRelevant_('収納ボックス 住宅', rowData, homeConfig),
    true,
    'relevant:true from the model must allow the query through'
  );
  assert.ok(calledWith && calledWith.indexOf('収納ボックス 住宅') !== -1, 'the prompt must include the candidate query');
  assert.ok(calledWith && calledWith.indexOf('ヤブガラシ 駆除') !== -1, 'the prompt must include the article topic');
}

// relevant: false -> the query is rejected (this is the real yabugarashi case).
{
  const context = freshContext();
  context.uaCallGeminiJson_ = function () {
    return { data: { relevant: false, reason: '本文の一例に過ぎない' } };
  };
  const uaIsRakutenProductQueryRelevant_ = vm.runInContext('uaIsRakutenProductQueryRelevant_', context);
  assert.strictEqual(
    uaIsRakutenProductQueryRelevant_('エアコン', rowData, homeConfig),
    false,
    'relevant:false from the model must reject the query'
  );
}

// The model call failing (network error, bad JSON, etc.) must fail closed --
// i.e. treat as not relevant rather than risk showing an unverified product.
{
  const context = freshContext();
  context.uaCallGeminiJson_ = function () {
    throw new Error('simulated network failure');
  };
  const uaIsRakutenProductQueryRelevant_ = vm.runInContext('uaIsRakutenProductQueryRelevant_', context);
  assert.strictEqual(
    uaIsRakutenProductQueryRelevant_('収納ボックス 住宅', rowData, homeConfig),
    false,
    'a failed relevance check must fail closed (not relevant), not fail open'
  );
}

// uaSelectRakutenProductQuery_: a manual override must bypass the gate
// entirely (it's an explicit human decision, not an automatic guess).
{
  const context = freshContext();
  let geminiCalled = false;
  context.uaCallGeminiJson_ = function () {
    geminiCalled = true;
    return { data: { relevant: false } };
  };
  const uaSelectRakutenProductQuery_ = vm.runInContext('uaSelectRakutenProductQuery_', context);
  const overrideRow = {
    mainInput: 'ヤブガラシ 駆除',
    affiliateNotes: '楽天商品キーワード: 除草剤 スプレー'
  };
  const result = uaSelectRakutenProductQuery_('', overrideRow, homeConfig);
  assert.strictEqual(result, '除草剤 スプレー', 'a manual override query must be honored as-is');
  assert.strictEqual(geminiCalled, false, 'a manual override must not trigger the relevance gate at all');
}

// uaSelectRakutenProductQuery_: an automatically-selected query that the
// gate rejects must come back empty (no product shown) rather than the
// irrelevant query.
{
  const context = freshContext();
  context.uaCallGeminiJson_ = function () {
    return { data: { relevant: false, reason: 'ヤブガラシ駆除と無関係' } };
  };
  const uaSelectRakutenProductQuery_ = vm.runInContext('uaSelectRakutenProductQuery_', context);
  const weedRemovalBody = 'ヤブガラシ駆除 処理したつるや根の断片は、そのまま庭に置かないよう片付けます。'.repeat(3);
  const result = uaSelectRakutenProductQuery_(weedRemovalBody, rowData, homeConfig);
  assert.strictEqual(result, '', 'a query the gate rejects must not be returned');
}

console.log('rakuten query relevance gate tests passed.');
