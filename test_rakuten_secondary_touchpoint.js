const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const configSource = fs.readFileSync(path.join(__dirname, 'unified_article_app', 'config.gs'), 'utf8');
const utilsSource = fs.readFileSync(path.join(__dirname, 'unified_article_app', 'utils.gs'), 'utf8');
const linksSource = fs.readFileSync(path.join(__dirname, 'unified_article_app', 'links.gs'), 'utf8');
const articleSource = fs.readFileSync(path.join(__dirname, 'unified_article_app', 'article.gs'), 'utf8');

const context = { console };
vm.createContext(context);
vm.runInContext(configSource, context);
vm.runInContext(utilsSource, context);
vm.runInContext(linksSource, context);
vm.runInContext(articleSource, context);
// uaSelectRakutenProductQuery_ (called internally by
// uaFindRakutenSecondaryMentionIndex_) now gates its result through a
// lightweight Gemini relevance check; this file doesn't load api.gs, so
// stub it to preserve the pre-existing "assume relevant" behavior these
// tests were written against.
context.uaCallGeminiJson_ = function () {
  return { data: { relevant: true } };
};

const uaFindRakutenSecondaryMentionIndex_ = vm.runInContext('uaFindRakutenSecondaryMentionIndex_', context);
const uaBuildRakutenLightMentionHtml_ = vm.runInContext('uaBuildRakutenLightMentionHtml_', context);
const uaFindRakutenContextualInsertIndex_ = vm.runInContext('uaFindRakutenContextualInsertIndex_', context);
const UA_RAKUTEN_LIGHT_MENTION_TEMPLATES = vm.runInContext('UA_RAKUTEN_LIGHT_MENTION_TEMPLATES', context);

const homeConfig = { key: 'home', label: 'たくみパパ' };

function padParagraphs(count, filler) {
  const long = (filler || '本文の説明が続きます。読者の悩みに寄り添う内容をここに詳しく書いています。') +
    '読者が判断に迷わないよう、具体的な条件や確認ポイントを丁寧に説明する長めの段落です。' +
    'ここではさらに背景や注意点、よくある失敗例、確認しておきたい細かな条件までを具体的に補足しています。';
  return new Array(count).fill('<p>' + long + '</p>').join('\n');
}

// Build a long (4000+ char) article body with two H2 sections that each match
// the query terms ("冷蔵庫" / "マット") to a different degree: an early section
// that only mentions "冷蔵庫" (partial match, lower score), and a late section
// that mentions both "冷蔵庫" and "マット" (full match, higher score -- the
// scoring in uaFindRakutenContextualInsertIndex_ is presence-based per distinct
// term, not frequency-based, so the late section must match strictly more
// distinct terms to outrank the earlier one and take the primary/main-CTA slot).
// The early section is then left as a valid, distinct candidate for the light
// secondary mention.
function buildLongBodyWithTwoMatches() {
  return [
    '<p>導入文です。読者の悩みに触れます。</p>',
    '<h2>冷蔵庫の基礎知識</h2>',
    padParagraphs(15, '冷蔵庫の設置場所について基礎から説明します。'),
    '<h2>関係のない話題</h2>',
    padParagraphs(15, '本題とは関係のない一般的な話です。'),
    '<h2>冷蔵庫マットを選ぶときのポイント</h2>',
    padParagraphs(15, '冷蔵庫マットを選ぶときに確認したい条件を具体的に説明します。'),
    '<h2>よくある質問</h2>',
    '<h3>Q. よくある質問です</h3><p>A. 回答です。</p>',
    '<h2>まとめ</h2>',
    '<p>まとめの本文です。</p>'
  ].join('\n');
}

// 1) Long article with an early qualifying section: the secondary index must be
// strictly before the primary (main banner) index, and point at the earlier
// matching section, not the late one.
{
  const rowData = { mainInput: '冷蔵庫 マット 後悔' };
  const body = buildLongBodyWithTwoMatches();
  const primaryIndex = uaFindRakutenContextualInsertIndex_(body, rowData, homeConfig);
  assert.ok(primaryIndex > -1, '前提: 主要な挿入位置が見つかる');

  const secondaryIndex = uaFindRakutenSecondaryMentionIndex_(body, rowData, homeConfig, primaryIndex);
  assert.ok(secondaryIndex > -1, '早い段落にも一致する見出しがあれば、序盤の挿入位置が見つかる');
  assert.ok(secondaryIndex < primaryIndex, '序盤の挿入位置は、本編CTAより必ず前に来る');
}

// 2) Short article: even if two matching sections exist, no secondary mention is
// added -- this is meant for long articles only, per the roadmap note.
{
  const rowData = { mainInput: '冷蔵庫 マット 後悔' };
  const shortBody = [
    '<p>短い導入文です。</p>',
    '<h2>冷蔵庫マットの基礎知識</h2>',
    '<p>冷蔵庫マットについて説明します。</p>',
    '<h2>冷蔵庫マットを選ぶときのポイント</h2>',
    '<p>冷蔵庫マットを選ぶ条件を説明します。</p>'
  ].join('\n');
  const primaryIndex = uaFindRakutenContextualInsertIndex_(shortBody, rowData, homeConfig);
  const secondaryIndex = uaFindRakutenSecondaryMentionIndex_(shortBody, rowData, homeConfig, primaryIndex);
  assert.strictEqual(secondaryIndex, -1, '短い記事では2つ目のタッチポイントを追加しない');
}

// 3) No earlier qualifying section (only one matching H2, which is the primary
// itself): must return -1, not accidentally reuse the same section.
{
  const rowData = { mainInput: '冷蔵庫 マット 後悔' };
  const body = [
    '<p>導入文です。</p>',
    '<h2>関係のない話題A</h2>',
    padParagraphs(6, '本題とは関係のない話です。'),
    '<h2>冷蔵庫マットを選ぶときのポイント</h2>',
    padParagraphs(6, '冷蔵庫マットを選ぶ条件を説明します。'),
    '<h2>よくある質問</h2>',
    '<h3>Q. 質問</h3><p>A. 回答</p>',
    '<h2>まとめ</h2>',
    '<p>まとめ本文</p>'
  ].join('\n');
  const primaryIndex = uaFindRakutenContextualInsertIndex_(body, rowData, homeConfig);
  const secondaryIndex = uaFindRakutenSecondaryMentionIndex_(body, rowData, homeConfig, primaryIndex);
  assert.strictEqual(secondaryIndex, -1, '一致する見出しが本編CTAの1箇所しかなければ、2つ目は追加しない');
}

// 4) uaBuildRakutenLightMentionHtml_: builds a plain <p> with a text link (not a
// duplicate of the full image banner), rotates its wording by seed, and is safe
// against missing/malformed item data.
{
  const items = [{ name: '冷蔵庫マット 透明 保護シート', url: 'https://item.rakuten.co.jp/shop/item1/' }];
  const htmlA = uaBuildRakutenLightMentionHtml_(items, 'seed-A');
  const htmlB = uaBuildRakutenLightMentionHtml_(items, 'seed-A');
  assert.strictEqual(htmlA, htmlB, '同じシードなら同じ文言（記事再生成で揺れない）');
  assert.ok(htmlA.indexOf('<a href="https://item.rakuten.co.jp/shop/item1/"') !== -1, 'リンク先が正しい');
  assert.ok(htmlA.indexOf('rel="nofollow sponsored noopener"') !== -1, 'nofollow等の属性が付く');
  assert.ok(htmlA.startsWith('<p>') && htmlA.endsWith('</p>'), '通常のテキスト段落として出力される（画像バナーの複製ではない）');
  assert.ok(!/img|figure/i.test(htmlA), '画像は含まない（軽めのテキストリンクという設計どおり）');

  const usedTemplates = new Set();
  ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].forEach(function(seed) {
    usedTemplates.add(uaBuildRakutenLightMentionHtml_(items, seed));
  });
  assert.ok(usedTemplates.size >= 2, '文言はローテーションする（' + UA_RAKUTEN_LIGHT_MENTION_TEMPLATES.length + '種類のプールから選ばれる）');

  assert.strictEqual(uaBuildRakutenLightMentionHtml_([], 'seed'), '', '商品が無ければ何も返さない');
  assert.strictEqual(uaBuildRakutenLightMentionHtml_([{ name: '商品名のみ' }], 'seed'), '', 'URLが無ければ何も返さない');
  assert.strictEqual(uaBuildRakutenLightMentionHtml_([{ url: 'https://item.rakuten.co.jp/x/' }], 'seed'), '', '商品名が無ければ何も返さない');
}

console.log('Rakuten secondary touchpoint (light mention): OK');
