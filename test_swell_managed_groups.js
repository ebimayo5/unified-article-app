const assert = require('assert');
const fs = require('fs');

const links = fs.readFileSync('unified_article_app/links.gs', 'utf8');
const wordpress = fs.readFileSync('unified_article_app/wordpress.gs', 'utf8');
const prompt = fs.readFileSync('unified_article_app/prompt.gs', 'utf8');

const moduleBox = { exports: {} };
new Function(
  'uaUsesSwellBlocks_',
  'module',
  links + '\nmodule.exports={normalize:uaNormalizeSwellManagedCoreGroups_};'
)(config => config && config.wpEditorTheme === 'swell', moduleBox);

const config = { wpEditorTheme: 'swell' };
const malformedPoint = [
  '<!-- wp:group {"className":"is-style-big_icon_point article-compass-point-box"} -->',
  '<div class="wp-block-group is-style-big_icon_point article-compass-point-box"><div class="wp-block-group__inner-container">',
  '<p><strong>この記事のポイント</strong></p>',
  '<ul><li>一つ目</li><li>二つ目</li></ul>',
  '</div></div>',
  '<!-- /wp:group -->'
].join('\n');
const normalizedPoint = moduleBox.exports.normalize(malformedPoint, config);
assert(normalizedPoint.includes('"layout":{"type":"constrained"}'), 'Managed groups need the current core-group layout');
assert(!normalizedPoint.includes('wp-block-group__inner-container'), 'Legacy inner-container must be removed');
assert(normalizedPoint.includes('<!-- wp:paragraph -->'), 'Point title needs paragraph block comments');
assert(normalizedPoint.includes('<!-- wp:list -->'), 'Point list needs list block comments');
assert(normalizedPoint.includes('<ul class="wp-block-list">'), 'Point list needs the core list class');
assert.strictEqual((normalizedPoint.match(/article-compass-point-box/g) || []).length, 2, 'One managed point group has one comment class and one div class');
assert.strictEqual(moduleBox.exports.normalize(normalizedPoint, config), normalizedPoint, 'Normalization must be idempotent');

const malformedNotice = [
  '<!-- wp:group {"className":"is-style-big_icon_caution article-compass-notice-box article-compass-notice-danger"} -->',
  '<div class="wp-block-group is-style-big_icon_caution article-compass-notice-box article-compass-notice-danger"><div class="wp-block-group__inner-container">',
  '<p><strong>注意：</strong>安全条件を確認します。</p>',
  '</div></div>',
  '<!-- /wp:group -->'
].join('\n');
const normalizedNotice = moduleBox.exports.normalize(malformedNotice, config);
assert(normalizedNotice.includes('<!-- wp:paragraph -->'), 'Notice text needs paragraph block comments');
assert(!normalizedNotice.includes('wp-block-group__inner-container'), 'Notice inner-container must be removed');

const separatedGroups = malformedPoint + '\n<!-- wp:image --><figure><img src="keep.png"></figure><!-- /wp:image -->\n' + malformedNotice;
const normalizedSeparated = moduleBox.exports.normalize(separatedGroups, config);
assert(normalizedSeparated.includes('<img src="keep.png">'), 'Normalization must not span from one managed group into a later group');
assert.strictEqual((normalizedSeparated.match(/<img\b/gi) || []).length, 1, 'Images between managed groups must be preserved');

const ordinaryGroup = '<!-- wp:group --><div class="wp-block-group"><p>通常</p></div><!-- /wp:group -->';
assert.strictEqual(moduleBox.exports.normalize(ordinaryGroup, config), ordinaryGroup, 'Ordinary author-created groups must stay untouched');
assert.strictEqual(moduleBox.exports.normalize(malformedPoint, { wpEditorTheme: 'cocoon' }), malformedPoint, 'Cocoon content must stay untouched');

assert(wordpress.includes('uaNormalizeSwellManagedCoreGroups_('), 'WordPress draft/update must normalize managed groups');
assert(wordpress.includes('function uaMigrateRecentSwellManagedGroups(options)'), 'A guarded recent-post repair must be available');
assert(wordpress.includes('uaFindMissingPublishedWpImages_(before, after)'), 'Recent repair must protect images');
assert(prompt.includes('wp-block-group__inner-container は入れません'), 'The prompt must forbid the invalid legacy wrapper');

console.log('SWELL managed group serialization tests passed.');
