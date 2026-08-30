const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const articleSource = fs.readFileSync(
  path.join(__dirname, 'unified_article_app', 'article.gs'),
  'utf8'
);
const context = { console };
vm.createContext(context);
vm.runInContext(articleSource, context);

assert.ok(context.uaUsesRinkerProductLinks_({ key: 'drive' }), 'DRIVE BASEはRinker対象');
assert.ok(context.uaUsesRinkerProductLinks_({ key: 'home' }), 'たくみパパはRinker対象');
assert.ok(!context.uaUsesRinkerProductLinks_({ key: 'general' }), '汎用記事はRinker対象外');

const sampleItems = [{
  name: '車種専用サンシェード',
  url: 'https://item.rakuten.co.jp/example/car-sunshade/',
  itemCode: 'example:car-sunshade',
  imageUrl: '',
  price: 3980
}];
let receivedConfig = null;
context.uaGetWpConfig_ = (config) => {
  receivedConfig = config;
  return {};
};
context.uaCallWordPressApi_ = () => ({ items: [{ post_id: 901 }] });
const driveConfig = { key: 'drive', label: 'DRIVE BASE' };
const html = context.uaBuildRinkerItemsHtml_(sampleItems, '車種専用サンシェード', driveConfig);
assert.strictEqual(receivedConfig, driveConfig, 'DRIVE BASE専用のWordPress設定で登録する');
assert.ok(html.includes('[itemlink post_id="901"]'), 'DRIVE BASE本文へRinkerショートコードを返す');

for (const file of ['app_panel.html', 'ua_web_app.html']) {
  const uiSource = fs.readFileSync(path.join(__dirname, 'unified_article_app', file), 'utf8');
  assert.ok(
    uiSource.includes("config.key === 'home' || config.key === 'drive'"),
    `${file}: DRIVE BASEとたくみパパを同じRinker表示へ切り替える`
  );
  assert.ok(uiSource.includes("'Rinkerを追加'"), `${file}: Rinker追加ボタンを表示する`);
  assert.ok(uiSource.includes('payload.forceRinkerItemCount = 3'), `${file}: 手動追加時は最大3商品を選定する`);
}

console.log('DRIVE BASE Rinker enablement tests passed.');
