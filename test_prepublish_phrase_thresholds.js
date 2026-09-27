// 2026-09-27: 定型表現チェックが全語句一律「2回以上」で、条件表現まで指摘していた。
// 公開済み138記事の実測では「場合があります」の46%、「可能性があります」の27%が該当し、
// 指摘修正の見送り163件中63件がこの2語だった（修正モデルは毎回「仕様差を伝えるのに必要」
// として却下）。語句ごとにしきい値を分け、外れ値だけを拾うこと。
const assert = require('assert');
const fs = require('fs');

const prePublish = fs.readFileSync('unified_article_app/pre_publish_check.gs', 'utf8');
const box = { exports: {} };
new Function('module', prePublish + `
module.exports = {
  hits: uaFindPrePublishPhraseHits_,
  thresholds: UA_PREPUBLISH_PHRASE_THRESHOLDS
};
`)(box);
const { hits, thresholds } = box.exports;

const body = (phrase, times) =>
  '<p>' + Array.from({ length: times }, (_, i) => '本文' + i + 'は条件によって' + phrase + '。').join('') + '</p>';

// 条件表現は、車種記事で普通に使う回数では指摘しない。
assert.deepStrictEqual(Array.from(hits(body('場合があります', 4))), [],
  '「場合があります」4回は指摘しない（実測の中央値は2回、4回でも17%が該当していた）');
assert.ok(hits(body('場合があります', 5)).length === 1,
  '「場合があります」5回から指摘する');
assert.deepStrictEqual(Array.from(hits(body('可能性があります', 3))), [],
  '「可能性があります」3回は指摘しない');
assert.ok(hits(body('可能性があります', 4)).length === 1,
  '「可能性があります」4回から指摘する');

// 定型の締め表現は従来どおり早めに拾う。
assert.ok(hits(body('確認しておくと安心です', 2)).length === 1,
  '中身のない締め表現は2回で指摘する');
assert.ok(hits(body('おすすめします', 2)).length === 1,
  '「おすすめします」は2回で指摘する');
assert.deepStrictEqual(Array.from(hits(body('重要です', 2))), [],
  '「重要です」2回は指摘しない');
assert.ok(hits(body('重要です', 3)).length === 1,
  '「重要です」3回から指摘する');

// 回数は指摘文に残す。人が見て判断できるようにするため。
assert.ok(/場合があります（6回）/.test(hits(body('場合があります', 6))[0]),
  '実際の出現回数を添える');

// 出現ゼロの語句も見張りとして残す。
assert.strictEqual(thresholds['と言えるでしょう'], 2, '未出現の語句も定義を残す');
assert.strictEqual(thresholds['状況に応じて判断しましょう'], 2, '未出現の語句も定義を残す');

// 複数語句が同時に外れ値なら両方出す。
const mixed = body('場合があります', 5) + body('重要です', 3);
assert.strictEqual(hits(mixed).length, 2, '複数の外れ値をまとめて報告する');

// 上限は従来どおり8件。
assert.ok(hits(Object.keys(thresholds).map((p) => body(p, 9)).join('')).length <= 8,
  '報告は8件までに抑える');

console.log('test_prepublish_phrase_thresholds.js: PASS');
