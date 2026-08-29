const assert = require('assert');
const fs = require('fs');

const config = fs.readFileSync('unified_article_app/config.gs', 'utf8');
const prePublish = fs.readFileSync('unified_article_app/pre_publish_check.gs', 'utf8');

const moduleBox = { exports: {} };
new Function('module', config + '\n' + prePublish + `
module.exports = { validate: uaValidatePrePublishRevision_ };
`)(moduleBox);
const validate = moduleBox.exports.validate;

const swellConfig = { wpEditorTheme: 'swell' };
const cocoonConfig = { wpEditorTheme: 'cocoon' };

// A SWELL article's "point box" and CTA are both real content the AI must not delete.
const swellBefore = [
  '<p>intro</p>',
  '<!-- wp:group {"className":"is-style-big_icon_point article-compass-point-box"} -->',
  '<div class="wp-block-group is-style-big_icon_point article-compass-point-box"><p>この記事のポイント</p></div>',
  '<!-- /wp:group -->',
  '<!-- UA_MAIN_AFFILIATE_CTA_START -->',
  '<div class="article-compass-affiliate-cta"><a href="https://example.com/cta">申し込む</a></div>',
  '<!-- UA_MAIN_AFFILIATE_CTA_END -->'
].join('\n');

// 1) Before the fix, this exact case (SWELL blocks stripped) passed validation silently,
//    because uaValidatePrePublishRevision_ only ever counted Cocoon-specific markers.
{
  const swellAfterMissingPointBox = swellBefore.replace(
    /<!-- wp:group \{"className":"is-style-big_icon_point article-compass-point-box"\}[\s\S]*?<!-- \/wp:group -->/,
    ''
  );
  assert.throws(
    () => validate(swellBefore, swellAfterMissingPointBox, [], swellConfig),
    /この記事のポイント/,
    'Deleting the SWELL point box from a SWELL article must be rejected'
  );
}

// 2) A revision that keeps every protected element intact must still pass.
{
  assert.doesNotThrow(
    () => validate(swellBefore, swellBefore, [], swellConfig),
    'An unchanged SWELL body must pass validation'
  );
}

// 3) Cocoon behavior must be unaffected by the theme branch.
{
  const cocoonBefore = [
    '<p>intro</p>',
    '<!-- wp:cocoon-blocks/tab-caption-box-1 -->この記事のポイント<!-- /wp:cocoon-blocks/tab-caption-box-1 -->'
  ].join('\n');
  const cocoonAfterMissing = '<p>intro</p>';
  assert.throws(
    () => validate(cocoonBefore, cocoonAfterMissing, [], cocoonConfig),
    /この記事のポイント/,
    'Deleting the Cocoon point box from a Cocoon article must still be rejected'
  );
}

console.log('Pre-publish revision theme-aware protected-block tests passed.');
