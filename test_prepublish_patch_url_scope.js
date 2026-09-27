// 2026-09-27: 修正案に許可外URLが1つ含まれるだけで revision 全体が破棄され、
// 同じ修正案の他の妥当な差分まで失われていた（全体棄却31件中26件がこの経路）。
// URLの可否は差分1件ごとに判定し、問題のある差分だけを落とすこと。
const assert = require('assert');
const fs = require('fs');

const prePublish = fs.readFileSync('unified_article_app/pre_publish_check.gs', 'utf8');
const box = { exports: {} };
new Function('module', prePublish + `
module.exports = { applyEdits: uaApplyPrePublishPatchEdits_ };
`)(box);
const { applyEdits } = box.exports;

const body = [
  '<p>アクアのHDMI端子は年式だけでは判断できません。まずナビ型番を確認します。</p>',
  '<p>既存の出典は<a href="https://toyota.jp/faq/show/6344.html">トヨタ公式のFAQ</a>です。</p>',
  '<p>走行中の表示については必ず停車してから操作してください。</p>'
].join('\n');

const allowed = ['https://www.npa.go.jp/bureau/traffic/index.html'];

const edits = [
  {
    // 許可リストにあるURLを足す差分。通ること。
    find: '<p>走行中の表示については必ず停車してから操作してください。</p>',
    replace: '<p>走行中の表示については<a href="https://www.npa.go.jp/bureau/traffic/index.html">警察庁の案内</a>を確認し、停車してから操作してください。</p>',
    reason: '根拠リンクの追加'
  },
  {
    // 許可リストに無いURLを足す差分。これだけ落ちること。
    find: 'まずナビ型番を確認します。',
    replace: 'まず<a href="https://example.com/unverified">ナビ型番の一覧</a>を確認します。',
    reason: '未確認URLの追加'
  },
  {
    // 元本文に既にあるURLを含む差分。新規追加ではないので巻き添えで落ちないこと。
    find: '既存の出典は<a href="https://toyota.jp/faq/show/6344.html">トヨタ公式のFAQ</a>です。',
    replace: '確認できる出典は<a href="https://toyota.jp/faq/show/6344.html">トヨタ公式のFAQ</a>です。',
    reason: '表現の調整'
  }
];

const result = applyEdits(body, edits, allowed);

assert.strictEqual(result.appliedChanges.length, 2, '許可URLの差分と通常の差分は適用される');
assert.ok(result.bodyHtml.indexOf('警察庁の案内') > -1, '許可リストにあるURLの差分は通る');
assert.ok(result.bodyHtml.indexOf('確認できる出典は') > -1, 'URLを含まない差分が巻き添えで落ちない');
assert.ok(result.bodyHtml.indexOf('example.com/unverified') === -1, '許可外URLは本文に入らない');

const skipped = result.skippedSuggestions.map((x) => x.reason).join(' / ');
assert.ok(/確認できない新しいURL/.test(skipped), '落とした差分の理由が記録される');
assert.strictEqual(result.skippedSuggestions.length, 1, '落ちるのは問題のある1件だけ');

// 元本文に既にあるURLは、差分で書き直しても新規追加ではない。
const reuse = applyEdits(body, [{
  find: '<a href="https://toyota.jp/faq/show/6344.html">トヨタ公式のFAQ</a>',
  replace: '<a href="https://toyota.jp/faq/show/6344.html">トヨタ公式のよくある質問</a>',
  reason: 'リンク文言の調整'
}], []);
assert.strictEqual(reuse.appliedChanges.length, 1, '元本文にあるURLの差分は許可リストが空でも通る');
assert.ok(reuse.bodyHtml.indexOf('よくある質問') > -1, 'リンク文言の変更が反映される');

// 許可リスト未指定でも既存の判定（短すぎる置換元など）は従来どおり動く。
const short = applyEdits(body, [{ find: '短い', replace: 'x', reason: 'ダミー' }]);
assert.strictEqual(short.appliedChanges.length, 0, '短すぎる置換元は従来どおり落とす');
assert.ok(/置換元が短すぎる/.test(short.skippedSuggestions[0].reason), '従来の理由文は変えない');

console.log('test_prepublish_patch_url_scope.js: PASS');
