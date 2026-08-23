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

const convert = context.uaConvertCocoonDecorationsToSwell_;
const assertSafe = context.uaAssertDriveSwellMigrationSafety_;
const metrics = context.uaGetDriveSwellMigrationMetrics_;

const fixture = [
  '<!-- wp:cocoon-blocks/tab-caption-box-1 {"content":"test"} -->',
  '<div class="wp-block-cocoon-blocks-tab-caption-box-1 tab-caption-box"><div class="tab-caption-box-label"><span class="tab-caption-box-label-text"><strong>この記事のポイント</strong></span></div><div class="tab-caption-box-content"><!-- wp:list --><ul><li>要点</li></ul><!-- /wp:list --></div></div>',
  '<!-- /wp:cocoon-blocks/tab-caption-box-1 -->',
  '<!-- wp:cocoon-blocks/info-box {"style":"danger-box"} -->',
  '<div class="wp-block-cocoon-blocks-info-box block-box danger-box"><!-- wp:paragraph --><p><span class="marker">注意</span></p><!-- /wp:paragraph --><!-- wp:cocoon-blocks/blogcard {"style":"blogcard-type bct-detail"} --><div class="wp-block-cocoon-blocks-blogcard blogcard-type bct-detail"><a href="https://example.com/a?x=1&amp;y=2">https://example.com/a?x=1&amp;y=2</a></div><!-- /wp:cocoon-blocks/blogcard --></div>',
  '<!-- /wp:cocoon-blocks/info-box -->',
  '<!-- wp:cocoon-blocks/button-wrap-1 {"tag":"affiliate"} -->',
  '<div class="wp-block-cocoon-blocks-button-wrap-1 btn-wrap"><a href="https://px.example/a?b=1&amp;c=2" rel="nofollow sponsored">確認する</a><img src="https://track.example/pixel.gif?a=1" width="1" height="1"></div>',
  '<!-- /wp:cocoon-blocks/button-wrap-1 -->',
  '<!-- wp:cocoon-blocks/blank-box-1 {"borderColor":"green"} --><div class="wp-block-cocoon-blocks-blank-box-1 blank-box"><p>枠</p></div><!-- /wp:cocoon-blocks/blank-box-1 -->',
  '<!-- wp:cocoon-blocks/icon-box --><div class="wp-block-cocoon-blocks-icon-box common-icon-box"><p><span class="bold-red">重要</span></p></div><!-- /wp:cocoon-blocks/icon-box -->',
  '<!-- wp:image {"id":77} --><figure><img src="https://example.com/image.jpg" class="wp-image-77"></figure><!-- /wp:image -->',
  '<!-- wp:cocoon-blocks/button-wrap-1 {"tag":"[affi id=7]"} --><div class="wp-block-cocoon-blocks-button-wrap-1 btn-wrap">[affi id=7]</div><!-- /wp:cocoon-blocks/button-wrap-1 -->'
].join('\n');

const converted = convert(fixture);
assertSafe(fixture, converted);
assert.strictEqual(metrics(converted).cocoonTotal, 0);
assert.ok(converted.includes('wp:loos/cap-block'), 'caption/info boxes should use SWELL cap blocks');
assert.ok(converted.includes('wp:loos/button'), 'affiliate anchor should use a SWELL button');
assert.ok(converted.includes('wp:loos/post-link'), 'blogcard should use a SWELL post link');
assert.ok(converted.includes('article-compass-migrated-border'), 'blank box should use a SWELL/core group style');
assert.ok(converted.includes('article-compass-migrated-icon-box'), 'icon box should use a SWELL/core group style');
assert.ok(converted.includes('swl-marker mark_yellow'), 'Cocoon marker should become a SWELL marker');
assert.ok(converted.includes('[affi id=7]'), 'shortcode must remain unchanged');
assert.ok(converted.includes('https://track.example/pixel.gif?a=1'), 'tracking pixel must remain unchanged');

const wxrPath = 'C:\\Users\\ebima\\Downloads\\drivebase.WordPress.2026-08-22.xml';
let audited = 0;
let blocks = 0;
if (fs.existsSync(wxrPath)) {
  const wxr = fs.readFileSync(wxrPath, 'utf8');
  const contents = [...wxr.matchAll(/<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/g)].map((match) => match[1]);
  contents.filter((body) => /(?:wp:cocoon-blocks\/|wp-block-cocoon-blocks-)/i.test(body)).forEach((body) => {
    const beforeMetrics = metrics(body);
    const after = convert(body);
    const residual = after.match(/(?:wp:cocoon-blocks\/[^\s{]+|wp-block-cocoon-blocks-[^\s"']+)/gi) || [];
    const residualIndex = residual.length ? after.indexOf(residual[0]) : -1;
    const residualSnippet = residualIndex >= 0 ? after.slice(Math.max(0, residualIndex - 180), residualIndex + 380) : '';
    assert.deepStrictEqual(residual, [], `residual Cocoon blocks: ${residual.join(', ')} :: ${residualSnippet}`);
    assertSafe(body, after);
    assert.strictEqual(metrics(after).cocoonTotal, 0, 'all known Cocoon blocks in WXR must be converted');
    audited += 1;
    blocks += beforeMetrics.cocoonTotal;
  });
}

console.log(`SWELL existing-post migration tests: OK (fixture + ${audited} WXR contents / ${blocks} blocks)`);
