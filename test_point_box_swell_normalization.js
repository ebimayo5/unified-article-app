const fs = require('fs'), vm = require('vm'), assert = require('assert');
const source = fs.readFileSync(__dirname + '/unified_article_app/pre_publish_check.gs', 'utf8');
const ctx = { console, uaUsesSwellBlocks_: (c) => !!(c && c.swell) };
vm.createContext(ctx); vm.runInContext(source, ctx);
const norm = (body, swell = true) => ctx.uaNormalizeLegacyPointBoxToSwell_(body, { swell });

const legacy = [
  '<!-- wp:paragraph -->', '<p>導入です。</p>', '<!-- /wp:paragraph -->', '',
  '<!-- wp:html -->',
  '<div style="background:#fff8e1;border-left:6px solid #f5a623;padding:16px 20px;margin:20px 0;border-radius:4px;">',
  '<p style="margin:0 0 8px;font-weight:bold;">この記事のポイント</p>',
  '<ul style="margin:0;padding-left:1.2em;">',
  '<li><strong style="color:#d32f2f;">基礎講習</strong>は、受験資格の代わりになる講習。3日間・16時間</li>',
  '<li>2024年度から、<strong style="color:#d32f2f;">オンラインでも受講できる</strong>。<a href="https://example.com/x">詳細</a></li>',
  '</ul>', '</div>', '<!-- /wp:html -->', '',
  '<!-- wp:heading -->', '<h2 class="wp-block-heading">基礎講習と一般講習の違い</h2>', '<!-- /wp:heading -->'
].join('\n');

// 1) 手作りの枠 → SWELL標準の形。見出し文言・各項目の中身(強調・リンク)は保持。
const out = norm(legacy);
assert(out.includes('article-compass-point-box'));
assert(out.includes('<!-- wp:group {"className":"is-style-big_icon_point article-compass-point-box"'));
assert(out.includes('<strong>この記事のポイント</strong>'));
assert(out.includes('<strong style="color:#d32f2f;">基礎講習</strong>は、受験資格の代わりになる講習。3日間・16時間'));
assert(out.includes('<a href="https://example.com/x">詳細</a>'), 'リンクを保持する');
assert(!/<!-- wp:html -->/.test(out), '手作りのhtmlブロックは置き換わる');
assert.equal((out.match(/<li>/g) || []).length, 2, '項目数が変わらない');
// 周囲の本文は一切変わらない
assert(out.startsWith('<!-- wp:paragraph -->\n<p>導入です。</p>'));
assert(out.endsWith('<!-- /wp:heading -->'));
assert(out.includes('<h2 class="wp-block-heading">基礎講習と一般講習の違い</h2>'));

// 2) すでに標準形なら変更しない(冪等)
assert.equal(norm(out), out);

// 3) SWELL出力でないサイトは変更しない
assert.equal(norm(legacy, false), legacy);

// 4) 箇条書きを読み取れない・ポイント枠がない本文は変更しない
const noList = legacy.replace(/<ul[\s\S]*?<\/ul>/, '<p>本文のみ</p>');
assert.equal(norm(noList), noList);
const none = '<!-- wp:paragraph --><p>ポイント枠なし</p><!-- /wp:paragraph -->';
assert.equal(norm(none), none);
assert.equal(norm(''), '');

// 5) 変換後は、チェックの判定条件(標準形のクラスと見出し文言)を満たす
assert(out.indexOf('article-compass-point-box') !== -1 && out.indexOf('この記事のポイント') !== -1);

// 6) 実際の安全検証(長さ・保護要素・リンク・ブロックの開閉)を通る。長い本文に埋め込んでも同じ。
const long = legacy + '\n\n' + '<!-- wp:paragraph --><p>' + 'あ'.repeat(6000) + '</p><!-- /wp:paragraph -->';
const longOut = norm(long);
assert.doesNotThrow(() => ctx.uaValidatePrePublishRevision_(long, longOut, [], { swell: true }));
// 検証の側も、変換前→変換前なら当然通る(比較の健全性)
assert.doesNotThrow(() => ctx.uaValidatePrePublishRevision_(long, long, [], { swell: true }));

console.log('PASS: 手作りのポイント枠をSWELL標準の形へ変換(中身・強調・リンク・周囲の本文は不変)。標準形・非SWELL・読み取れない本文は変更しない。');
