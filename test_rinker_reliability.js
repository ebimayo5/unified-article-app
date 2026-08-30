const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(
  path.join(__dirname, 'unified_article_app', 'article.gs'),
  'utf8'
);
const context = { console };
vm.createContext(context);
vm.runInContext(source, context);

const homeConfig = { key: 'home', label: 'たくみパパ' };
const driveConfig = { key: 'drive', label: 'DRIVE BASE' };
const sampleItems = [
  { name: 'サンシェード ベランダ 日よけ 2m', url: 'https://item.rakuten.co.jp/shop/sunshade-1/', itemCode: 'shop:sunshade-1', price: 2980 }
];

let sleptFor = [];
context.Utilities = { sleep: (ms) => { sleptFor.push(ms); } };

// 1) A transient failure on the first attempt must be retried, and succeed on the
// second attempt instead of immediately falling back to the plain banner.
{
  sleptFor = [];
  let callCount = 0;
  context.uaGetWpConfig_ = () => ({});
  context.uaCallWordPressApi_ = () => {
    callCount++;
    if (callCount === 1) throw new Error('一時的な接続エラー');
    return { items: [{ post_id: 701 }] };
  };
  const html = context.uaBuildHomeRinkerItemsHtml_(sampleItems, 'サンシェード', homeConfig);
  assert.strictEqual(callCount, 2, '1回目の失敗後、2回目のAPI呼び出しでリトライする');
  assert.ok(html.includes('[itemlink post_id="701"]'), 'リトライ成功時は通常どおりRinkerショートコードを返す');
  assert.strictEqual(sleptFor.length, 1, 'リトライの間に1回だけ待機する');
}

// DRIVE BASEも同じWordPress別設定を使ってRinker商品を登録する。
{
  let receivedConfig = null;
  context.uaGetWpConfig_ = (config) => {
    receivedConfig = config;
    return {};
  };
  context.uaCallWordPressApi_ = () => ({ items: [{ post_id: 703 }] });
  const html = context.uaBuildRinkerItemsHtml_(sampleItems, '車用サンシェード', driveConfig);
  assert.strictEqual(receivedConfig, driveConfig, 'DRIVE BASEのWordPress設定をRinker REST APIへ渡す');
  assert.ok(html.includes('[itemlink post_id="703"]'), 'DRIVE BASEでもRinkerショートコードを返す');
}

// 2) After every attempt fails, give up and record a specific failure reason
// instead of failing silently -- this is what a caller checks to flag the row.
{
  sleptFor = [];
  let callCount = 0;
  context.uaGetWpConfig_ = () => ({});
  context.uaCallWordPressApi_ = () => {
    callCount++;
    throw new Error('WordPress API 500');
  };
  const html = context.uaBuildHomeRinkerItemsHtml_(sampleItems, 'サンシェード', homeConfig);
  assert.strictEqual(html, '', '全リトライが失敗したら空文字を返し、呼び出し元が従来バナーへフォールバックできるようにする');
  assert.strictEqual(callCount, 2, '設定した試行回数（2回）だけ呼び出す');
  assert.ok(
    /WordPress API 500/.test(vm.runInContext('UA_LAST_RINKER_FAILURE_REASON', context)),
    '失敗理由をUA_LAST_RINKER_FAILURE_REASONに残し、無言の握りつぶしにしない'
  );
}

// 3) A successful call must not leave a stale failure reason from an earlier,
// failed row in place -- confirm the success path does not overwrite the flag
// with a new failure message (callers reset it before each row).
{
  vm.runInContext("UA_LAST_RINKER_FAILURE_REASON = '前回記事の古い失敗理由'", context);
  context.uaGetWpConfig_ = () => ({});
  context.uaCallWordPressApi_ = () => ({ items: [{ post_id: 702 }] });
  const html = context.uaBuildHomeRinkerItemsHtml_(sampleItems, 'サンシェード', homeConfig);
  assert.ok(html.includes('[itemlink post_id="702"]'), '成功時は通常どおりショートコードを返す');
  assert.ok(
    !/接続エラー|API 500/.test(vm.runInContext('UA_LAST_RINKER_FAILURE_REASON', context)),
    '成功時に新しい失敗理由で上書きしない'
  );
}

// 4) Wiring check: both call sites that build the automatic product-link banner must
// reset the flag before starting and flag the row's fact-check column when Rinker
// specifically failed, not just when no banner was built at all.
{
  const addContextStart = source.indexOf('function uaAddRakutenBannerForContext_');
  const addContextEnd = source.indexOf('\nfunction ', addContextStart + 1);
  const addContextBody = source.slice(addContextStart, addContextEnd);
  assert.ok(addContextBody.includes('UA_LAST_RINKER_FAILURE_REASON = \'\';'), 'uaAddRakutenBannerForContext_は行ごとに失敗フラグをリセットする');
  assert.ok(
    addContextBody.includes("uaAppendFactCheckPoint_(context.sheet, context.row, '・Rinker連携失敗"),
    'uaAddRakutenBannerForContext_はRinker失敗時に要確認ポイントへ記録する'
  );

  const refreshStart = source.indexOf('function uaRefreshRakutenBannerForArticleRow_');
  const refreshEnd = source.indexOf('\nfunction ', refreshStart + 1);
  const refreshBody = source.slice(refreshStart, refreshEnd);
  assert.ok(
    refreshBody.includes("uaAppendFactCheckPoint_(sheet, row, '・Rinker連携失敗"),
    'uaRefreshRakutenBannerForArticleRow_（手動の商品リンク再選定）もRinker失敗時に要確認ポイントへ記録する'
  );
}

console.log('Rinker reliability (retry + failure visibility) tests passed.');
