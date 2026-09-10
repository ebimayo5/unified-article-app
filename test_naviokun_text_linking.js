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

const url = 'https://px.example/a?x=1&y=2';
const drive = { key: 'drive' };
const home = { key: 'home' };
const plain = '<!-- wp:paragraph --><p>ナビ男くんなら相談できます。ナビ男くんの施工例も確認します。</p><!-- /wp:paragraph -->';
const linked = context.uaLinkifyNaviokunTextMentions_(plain, drive, url);

assert.strictEqual((linked.match(/<a\b/g) || []).length, 2, 'all plain mentions should be linked');
assert.strictEqual((linked.match(/rel="nofollow sponsored noopener"/g) || []).length, 2, 'all links should carry affiliate rel values');
assert.ok(linked.includes('href="https://px.example/a?x=1&amp;y=2"'), 'sheet URL should be HTML-escaped only for the href attribute');
assert.strictEqual(context.uaLinkifyNaviokunTextMentions_(linked, drive, url), linked, 'linking must be idempotent');

const protectedHtml = [
  '<p><a href="https://ebimayo5.com/archives/naviokun-reputation/">ナビ男くん</a>とナビ男くんを比較</p>',
  '<img alt="ナビ男くん" src="https://example.com/image.jpg">',
  '<span title="比較 > ナビ男くん">ナビ男くん</span>',
  '<p>[sample label="ナビ男くん"] ナビ男くん</p>',
  '<pre>ナビ男くん</pre>',
  '<!-- ナビ男くん -->'
].join('\n');
const transformed = context.uaTransformNaviokunTextMentions_(protectedHtml, url);
assert.strictEqual(transformed.unlinked, 3, 'only visible prose outside links/shortcodes/pre should be candidates');
assert.strictEqual(transformed.alreadyLinked, 1, 'existing anchor text should be counted but preserved');
assert.strictEqual(transformed.linked, 3, 'all eligible prose mentions should be linked');
assert.ok(transformed.html.includes('<a href="https://ebimayo5.com/archives/naviokun-reputation/">ナビ男くん</a>'), 'existing meaningful links must not be overwritten');
assert.ok(transformed.html.includes('alt="ナビ男くん"'), 'HTML attributes must remain untouched');
assert.ok(transformed.html.includes('title="比較 > ナビ男くん"'), 'quoted > and attribute text must remain untouched');
assert.ok(transformed.html.includes('[sample label="ナビ男くん"]'), 'shortcodes must remain untouched');
assert.ok(transformed.html.includes('<pre>ナビ男くん</pre>'), 'preformatted code must remain untouched');
assert.ok(transformed.html.includes('<!-- ナビ男くん -->'), 'Gutenberg/comments must remain untouched');

assert.strictEqual(context.uaLinkifyNaviokunTextMentions_(plain, home, url), plain, 'non-DRIVE sites must be untouched');
assert.strictEqual(context.uaLinkifyNaviokunTextMentions_(plain, drive, 'javascript:alert(1)'), plain, 'invalid URLs must fail closed');

console.log('Naviokun text-linking tests: OK');
