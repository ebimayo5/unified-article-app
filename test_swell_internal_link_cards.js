const assert = require('assert');
const fs = require('fs');

const links = fs.readFileSync('unified_article_app/links.gs', 'utf8');
const wordpress = fs.readFileSync('unified_article_app/wordpress.gs', 'utf8');
const prePublish = fs.readFileSync('unified_article_app/pre_publish_check.gs', 'utf8');
const article = fs.readFileSync('unified_article_app/article.gs', 'utf8');

[links, wordpress, prePublish, article].forEach(source => new Function(source));

const moduleBox = { exports: {} };
new Function(
  'uaUsesSwellBlocks_',
  'uaEscapeLinkHtml_',
  'module',
  links + '\nmodule.exports={build:uaBuildInternalLinkPostInsertBlock_,normalize:uaNormalizeSwellInternalLinkBlocks_};'
)(
  config => config && config.wpEditorTheme === 'swell',
  value => String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'),
  moduleBox
);

const config = { wpEditorTheme: 'swell' };
const built = moduleBox.exports.build({
  url: 'https://kurashi-ie.com/related/?a=1&b=2',
  title: '関連記事',
  usage: '関連する注意点'
}, config);
assert(built.includes('<!-- wp:loos/post-link '), 'SWELL internal links must use the native post-link block');
assert(!built.includes('article-compass-internal-link'), 'New SWELL links must not use the legacy card-like paragraph');
assert(built.includes('https://kurashi-ie.com/related/?a=1&b=2'), 'The internal URL must be preserved exactly');

const legacy = '<!-- wp:paragraph {"className":"article-compass-internal-link"} --><p class="article-compass-internal-link"><a href="https://kurashi-ie.com/related/">関連記事</a></p><!-- /wp:paragraph -->';
const normalizedLegacy = moduleBox.exports.normalize(legacy, config, 'https://kurashi-ie.com');
assert(normalizedLegacy.includes('wp:loos/post-link'), 'Legacy marked links must be normalized to SWELL cards');

const plainStandalone = '<p><a href="https://kurashi-ie.com/another/">別の記事</a></p>';
const normalizedPlain = moduleBox.exports.normalize(plainStandalone, config, 'https://kurashi-ie.com');
assert(normalizedPlain.includes('wp:loos/post-link'), 'Standalone same-site links must be normalized to SWELL cards');

const inline = '<p>詳しくは<a href="https://kurashi-ie.com/another/">別の記事</a>も参考になります。</p>';
assert.strictEqual(
  moduleBox.exports.normalize(inline, config, 'https://kurashi-ie.com'),
  inline,
  'Inline explanatory links must remain unchanged'
);

const external = '<p><a href="https://example.com/source/">公式資料</a></p>';
assert.strictEqual(
  moduleBox.exports.normalize(external, config, 'https://kurashi-ie.com'),
  external,
  'Standalone external links must not become internal cards'
);

assert(wordpress.includes('uaNormalizeSwellInternalLinkBlocks_('), 'WordPress draft/update must normalize internal links');
assert(wordpress.includes('function uaMigrateRecentSwellInternalLinkCards(options)'), 'A guarded recent-post repair must be available');
assert(wordpress.includes('uaFindMissingPublishedWpImages_(before, after)'), 'Recent-post repair must protect existing images');
assert(prePublish.includes('wp:loos\\/post-link'), 'Pre-publish protection must preserve SWELL post-link cards');
assert(article.includes("swellInternalLink.indexOf('wp:loos/post-link')"), 'SWELL dialect test must require native post-link cards');

console.log('SWELL internal link card tests passed.');
