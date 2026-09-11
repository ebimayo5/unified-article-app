const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const context = { console };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'unified_article_app', 'article.gs'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'unified_article_app', 'wordpress.gs'), 'utf8'), context);

const unrelatedMarkedCta = [
  '<!-- UA_SECONDARY_PRODUCT_START -->',
  '<p>選択肢のひとつとして、<a href="https://hb.afl.rakuten.co.jp/unrelated">掃除ブラシ</a>も確認できます。</p>',
  '<!-- UA_SECONDARY_PRODUCT_END -->'
].join('\n');
const oldUnmarkedCta = '<p>選択肢のひとつとして、<a href="https://hb.afl.rakuten.co.jp/old-real">≪ ★11日09:59迄≫ サーキュレーター アイリスオーヤマ</a>も確認できます。</p>';
const oldCardCta = [
  '<!-- UA_SECONDARY_PRODUCT_START -->',
  '<p>選択肢のひとつとして、<a href="https://hb.afl.rakuten.co.jp/yu-gi-oh-card">サーキュレーター</a>も確認できます。</p>',
  '<!-- UA_SECONDARY_PRODUCT_END -->'
].join('\n');
const rinkerBlock = [
  '<!-- UA_RINKER_PRODUCTS_START -->',
  '<p>主商品です。</p>',
  '[itemlink post_id="123"]',
  '<!-- UA_RINKER_PRODUCTS_END -->'
].join('\n');
const source = [
  '<p>導入文は保持します。</p>',
  unrelatedMarkedCta,
  '<h2>カバーが外れないときの確認</h2>',
  oldUnmarkedCta,
  '<p>途中の説明も保持します。</p>',
  oldCardCta,
  '<h2>まとめ</h2>',
  rinkerBlock,
  '<p>末尾も保持します。</p>'
].join('\n');

const replacement = {
  name: 'アイリスオーヤマ サーキュレーター 8畳 PCF-MKM15N',
  url: 'https://hb.afl.rakuten.co.jp/correct-circulator'
};
const result = context.uaTransformCirculatorEarlyCta20260912_(source, replacement);

assert.strictEqual(result.removedCtaCount, 2, '対象の重複CTAだけを2件検出する');
assert.ok(!result.html.includes('old-real'), '古い実用品リンクを除去する');
assert.ok(!result.html.includes('yu-gi-oh-card'), '遊戯王カードのリンクを除去する');
assert.ok(result.html.includes('correct-circulator'), '正しいサーキュレーターリンクを追加する');
assert.ok(result.html.includes('>サーキュレーター</a>'), '自然な短いリンク文言を使う');
assert.ok(result.html.includes(unrelatedMarkedCta), '別商品の前半CTAは保持する');
assert.ok(result.html.includes('<p>導入文は保持します。</p>'), '周辺本文を保持する');
assert.ok(result.html.includes('<p>途中の説明も保持します。</p>'), 'CTA間の本文を保持する');
assert.strictEqual(
  result.html.slice(result.html.indexOf('<!-- UA_RINKER_PRODUCTS_START -->')),
  source.slice(source.indexOf('<!-- UA_RINKER_PRODUCTS_START -->')),
  '下部Rinkerブロック以降は完全一致で保持する'
);

console.log('circulator early CTA repair tests passed');
