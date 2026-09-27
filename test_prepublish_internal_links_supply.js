// 2026-09-27: 指摘修正には内部リンク候補が渡っておらず、公開前チェックが内部リンク不足を
// 指摘しても修正モデルは「関連する既存記事のURL・内容が提示されていない」として毎回見送って
// いた（見送り163件中19件）。生成時と同じ候補を渡し、その候補URLは許可リストにも載せること。
const assert = require('assert');
const fs = require('fs');

const prePublish = fs.readFileSync('unified_article_app/pre_publish_check.gs', 'utf8');
const box = { exports: {} };
const harness = `
// links.gs / config.gs の代わりに最小限のスタブを置く
function uaGetAppConfigByLabel_(label) {
  return label === 'リンク無し'
    ? { useInternalLinks: false, wpEditorTheme: 'swell' }
    : { useInternalLinks: true, wpEditorTheme: 'swell' };
}
function uaUsesSwellBlocks_(config) { return !!config && config.wpEditorTheme === 'swell'; }
function uaBuildInternalLinksPrompt_(mainInput, appConfig, rowData) {
  return '1. URL: https://ebimayo5.com/archives/stepwgn-hdmi-doko/ タイトル: ステップワゴンのHDMI';
}
function uaGetInternalLinkCandidates_(mainInput, appConfig, rowData) {
  return [{ url: 'https://ebimayo5.com/archives/stepwgn-hdmi-doko/', title: 'ステップワゴンのHDMI' }];
}
module.exports = {
  buildPrompt: uaBuildPrePublishPatchPrompt_,
  linksPrompt: uaBuildPrePublishInternalLinksPrompt_,
  linkUrls: uaGetPrePublishInternalLinkUrls_,
  applyEdits: uaApplyPrePublishPatchEdits_
};
`;
new Function('module', prePublish + harness)(box);
const { buildPrompt, linksPrompt, linkUrls, applyEdits } = box.exports;

const rowData = { appType: 'DRIVE BASE', mainInput: 'アクア HDMI どこ', body: '<p>本文</p>' };
const appConfig = { useInternalLinks: true, wpEditorTheme: 'swell' };

// 候補が取れること。
assert.ok(/stepwgn-hdmi-doko/.test(linksPrompt(rowData, appConfig)), '内部リンク候補を組み立てる');
assert.deepStrictEqual(
  Array.from(linkUrls(rowData, appConfig)),
  ['https://ebimayo5.com/archives/stepwgn-hdmi-doko/'],
  '候補のURLだけを取り出す'
);

// 内部リンクを使わない記事タイプでは空。
assert.strictEqual(linksPrompt(rowData, { useInternalLinks: false }), '', '使わない記事タイプは空');
assert.deepStrictEqual(Array.from(linkUrls(rowData, { useInternalLinks: false })), [], '同上');

// プロンプトに候補が載ること。
const prompt = buildPrompt(rowData, '【公開前チェック】', '外部出典なし', linksPrompt(rowData, appConfig));
assert.ok(prompt.indexOf('【使用を許可する内部リンク候補】') > -1, '内部リンク候補の見出しを出す');
assert.ok(prompt.indexOf('stepwgn-hdmi-doko') > -1, '候補URLを本文に載せる');
assert.ok(/候補にないURLの内部リンクは作らない/.test(prompt), '候補外を禁じる指示を入れる');

// 候補が無いときは「新設しない」と伝える。
const emptyPrompt = buildPrompt(rowData, '【公開前チェック】', '', '');
assert.ok(/内部リンクは新設しないでください/.test(emptyPrompt), '候補ゼロなら新設させない');

// テーマの説明が入ること（Cocoon誤提案の抑止）。
assert.ok(/WordPressテーマはSWELLです/.test(prompt), 'テーマを明示する');
assert.ok(/Cocoonからの変換・置換は提案しないでください/.test(prompt), '存在しないCocoon変換を禁じる');

// 候補URLを許可リストに渡せば、内部リンクを足す差分が通ること（②の修正との接続）。
const body = '<p>ステップワゴンの端子については別記事で詳しく説明しています。</p>';
const edit = [{
  find: '<p>ステップワゴンの端子については別記事で詳しく説明しています。</p>',
  replace: '<p>ステップワゴンの端子については<a href="https://ebimayo5.com/archives/stepwgn-hdmi-doko/">別記事</a>で詳しく説明しています。</p>',
  reason: '内部リンクの追加'
}];
const allowed = applyEdits(body, edit, linkUrls(rowData, appConfig));
assert.strictEqual(allowed.appliedChanges.length, 1, '候補URLの内部リンクは適用される');
const blocked = applyEdits(body, edit, []);
assert.strictEqual(blocked.appliedChanges.length, 0, '許可リストに無ければ従来どおり落とす');

console.log('test_prepublish_internal_links_supply.js: PASS');
