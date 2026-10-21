const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const c = { console };
vm.createContext(c);
vm.runInContext(fs.readFileSync('unified_article_app/article.gs', 'utf8'), c);
const title = '【楽天市場】バッテリーチャージャー 12V 24V';
const broken = '�ڳ�ŷ�Ծ�ۥХåƥ꡼���㡼���㡼 12V 24V';
function page(charset, declaration, header = {}) {
  const good = declaration + '<title>' + title + '</title>';
  const bad = declaration + '<title>' + broken + '</title>';
  const calls = [];
  return { calls, getResponseCode: () => 200, getAllHeaders: () => header,
    getContentText: enc => { calls.push(enc); return enc === charset ? good : bad; } };
}
for (const [charset, meta] of [
  ['EUC-JP', '<meta charset="EUC-JP">'],
  ['EUC-JP', '<meta http-equiv="Content-Type" content="text/html; charset=euc-jp">'],
  ['Windows-31J', "<META CHARSET='Shift_JIS'>"],
  ['UTF-8', '<meta charset="utf-8">']
]) {
  const response = page(charset, meta);
  c.UrlFetchApp = { fetch: () => response };
  const facts = c.uaFetchProductPageFacts_('https://item.rakuten.co.jp/shop/item/', false);
  assert.strictEqual(facts.status, 'ok');
  assert.strictEqual(facts.title, title);
  assert.ok(response.calls.includes(charset));
  assert.strictEqual(response.calls.length, charset === 'UTF-8' ? 1 : 2);
}
{
  const response = page('EUC-JP', '', { 'Content-Type': 'text/html; charset=EUC-JP' });
  assert.ok(c.uaDecodeProductPageHtml_(response).includes(title));
}
{
  const response = page('UTF-8', '<meta charset="euc-jp">', { 'content-type': 'text/html; charset=utf-8' });
  assert.ok(c.uaDecodeProductPageHtml_(response).includes(title), 'HTTP charset takes precedence');
}
{
  const response = page('EUC-JP', '');
  c.UrlFetchApp = { fetch: () => response };
  assert.strictEqual(c.uaFetchProductPageFacts_('https://item.rakuten.co.jp/shop/item/', false).status, 'encoding_error');
}
{
  const response = page('UTF-8', '<meta charset="unsupported-encoding">');
  assert.throws(() => c.uaDecodeProductPageHtml_(response), /ENCODING_UNSUPPORTED/);
}
{
  let searches = 0;
  c.uaRakutenItemModelKey_ = () => '';
  c.uaExtractRequiredProductBrands_ = () => [];
  c.uaFetchSearchResultUrls_ = () => { searches++; return []; };
  c.uaFindAmazonProductPages_({ name: title, rakutenPage: { title: broken } });
  assert.strictEqual(searches, 0, 'Saved mojibake query must not spend credits');
  c.uaFindAmazonProductPages_({ name: title, rakutenPage: { title } });
  assert.strictEqual(searches, 1, 'Valid Japanese still reaches search');
}
{
  const ctx = { PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'test' }) },
    UrlFetchApp: { fetch: () => { throw new Error('Network must not be called'); } } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('unified_article_app/outline.gs', 'utf8'), ctx);
  assert.strictEqual(ctx.uaFetchSearchResultUrls_('site:amazon.co.jp ' + broken, 2).length, 0);
  assert.throws(() => ctx.uaFetchSerpApiOrganicResults_(broken, 2), /SEARCH_QUERY_ENCODING_INVALID/);
}
console.log('PASS product page charset decoding and corrupt query credit guard');
