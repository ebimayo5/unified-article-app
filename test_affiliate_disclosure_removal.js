// 2026-10-03: サイト共通の広告表記（SWELLのPRラベル）が記事上部に出るのに、本文側にも
// 「PR：ここからは〇〇の案内です。」が生成され、ユーザーが毎回手で消していた。
// 定型文だけでなく、案件ごとに文面を変えた同趣旨の表記も取り除くこと。
const assert = require('assert');
const fs = require('fs');

const box = { exports: {} };
new Function('module', fs.readFileSync('unified_article_app/article.gs', 'utf8') + `
module.exports = { strip: uaRemoveRedundantAffiliateDisclosure_ };
`)(box);
const { strip } = box.exports;

// 後ろに本文が続くときは、先頭の一文だけを消して段落は残す。
const lead = '<p>PR：ここからは積水ハウスの紹介サポートに関する案内です。積水ハウスが候補に残り、これから具体相談へ進みたいなら、展示場へ行く前に条件を確認する方法があります。</p>';
assert.strictEqual(
  strip(lead),
  '<p>積水ハウスが候補に残り、これから具体相談へ進みたいなら、展示場へ行く前に条件を確認する方法があります。</p>',
  '先頭のPR表記だけを消して本文は残す'
);

// 段落がその表記だけなら段落ごと消す。
assert.strictEqual(strip('<p>PR：本記事にはアフィリエイト広告を含みます。</p>\n<p>本文</p>'), '<p>本文</p>', '定型文の段落は段落ごと消す');
assert.strictEqual(strip('<p>PR：この記事にはプロモーションが含まれます。</p>\n<p>本文</p>'), '<p>本文</p>', '言い換えた表記も段落ごと消す');
assert.strictEqual(strip('<p><strong>PR：ここからは案件のご案内です。</strong></p>\n<p>本文</p>'), '<p>本文</p>', 'strongで囲まれていても消す');

// 従来の挙動（PR接頭辞なしの定型文）は変えない。
assert.strictEqual(strip('<p>本記事にはアフィリエイト広告を含みます。</p>\n<p>本文</p>'), '<p>本文</p>', '既存の定型文は従来どおり消す');

// 広告表記ではない文は消さない。
const keep = '<p>PR会社に勤める友人の話では、展示場の集客は季節で変わるそうです。</p>';
assert.strictEqual(strip(keep), keep, '「PR」で始まっても広告表記でなければ残す');
const keep2 = '<p>紹介サポートの仕組み、使える条件、申し込みの流れは別記事でまとめています。</p>';
assert.strictEqual(strip(keep2), keep2, '通常の段落は触らない');
const keep3 = '<p>積水ハウスの広告を見て興味を持った人も多いはずです。</p>';
assert.strictEqual(strip(keep3), keep3, '本文中の「広告」という語だけでは消さない');

// 文中（段落の途中）に出てくる場合は消さない。段落先頭のみが対象。
const mid = '<p>展示場へ行く前に確認しましょう。PR：ここからは案件の案内です。</p>';
assert.strictEqual(strip(mid), mid, '段落の途中にある場合は触らない');

// 空文字・未定義でも落ちない。
assert.strictEqual(strip(''), '');
assert.strictEqual(strip(null), '');

console.log('test_affiliate_disclosure_removal.js: PASS');
