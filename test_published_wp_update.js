const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(
  path.join(__dirname, 'unified_article_app', 'wordpress.gs'),
  'utf8'
);
const context = { console };
vm.createContext(context);
vm.runInContext(source, context);

const findMissing = context.uaFindMissingPublishedWpImages_;
const buildPayload = context.uaBuildPublishedWpUpdatePayload_;
const getRaw = context.uaGetWpPostRawContent_;

const image10 = '<!-- wp:image {"id":10} --><figure><img src="https://example.com/a.jpg" class="wp-image-10"/></figure><!-- /wp:image -->';
const image20 = '<figure><img src="https://example.com/manual.png?ver=2" alt="manual"/></figure>';
const currentBody = '<p>before</p>' + image10 + image20;

assert.deepStrictEqual(
  Array.from(findMissing(currentBody, '<p>after</p>' + image10 + '<img src="https://example.com/manual.png"/>')),
  [],
  'preserved media ID and normalized manual image URL should pass'
);

assert.deepStrictEqual(
  Array.from(findMissing(currentBody, '<p>after</p>' + image10)),
  ['https://example.com/manual.png'],
  'a manually added image missing from the panel body must stop the update'
);

assert.deepStrictEqual(
  Array.from(findMissing(currentBody, '<p>after</p>' + image20)),
  ['画像ID 10'],
  'a generated WordPress media image missing from the panel body must stop the update'
);

const payload = buildPayload('  採用タイトル  ', '<p>本文</p>');
assert.strictEqual(payload.title, '採用タイトル');
assert.strictEqual(payload.content, '<p>本文</p>');
assert.strictEqual(Object.prototype.hasOwnProperty.call(payload, 'status'), false, 'published status must not be overwritten');
assert.strictEqual(Object.prototype.hasOwnProperty.call(payload, 'featured_media'), false, 'featured image must not be overwritten');

assert.strictEqual(
  getRaw({ content: { raw: '<p>raw</p>', rendered: '<p>rendered</p>' } }),
  '<p>raw</p>',
  'image comparison must use editable raw WordPress content'
);

['ua_web_app.html', 'app_panel.html'].forEach((fileName) => {
  const html = fs.readFileSync(path.join(__dirname, 'unified_article_app', fileName), 'utf8');
  assert.ok(html.includes('onclick="updatePublishedWp(this)"'), fileName + ': update button is missing');
  assert.ok(html.includes('function updatePublishedWp(button)'), fileName + ': update handler is missing');
  assert.ok(html.includes('.uaUpdatePublishedWpFromWeb(data)'), fileName + ': server update call is missing');
});

console.log('published WordPress update tests: OK (14 checks)');
