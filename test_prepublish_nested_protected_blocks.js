const assert = require('assert');
const fs = require('fs');

const prePublish = fs.readFileSync('unified_article_app/pre_publish_check.gs', 'utf8');
const moduleBox = { exports: {} };
new Function('module', prePublish + `
module.exports = {
  protect: uaProtectPrePublishRevisionBody_,
  restore: uaRestorePrePublishProtectedBlocks_,
  applyEdits: uaApplyPrePublishPatchEdits_
};
`)(moduleBox);

const { protect, restore, applyEdits } = moduleBox.exports;
const productBlock = [
  '<!-- UA_PRODUCT_FOLLOWUP_START -->',
  '<h2>関連アイテムも選択肢に入れる</h2>',
  '<!-- UA_RINKER_PRODUCTS_START -->',
  '<p>商品ページで仕様を確認してください。</p>',
  '<!-- wp:shortcode -->',
  '[itemlink post_id="1503"]',
  '<!-- /wp:shortcode -->',
  '<!-- UA_RINKER_PRODUCTS_END -->',
  '<!-- UA_PRODUCT_FOLLOWUP_END -->'
].join('\n');
const original = ['<p>修正前の導入文です。</p>', productBlock, '<p>修正前のまとめ文です。</p>'].join('\n');

const protectedResult = protect(original);
assert.strictEqual(protectedResult.blocks.length, 2, '外側の商品導線と内側のRinkerを個別に保護する');
assert.strictEqual(
  restore(protectedResult.body, protectedResult.blocks),
  original,
  '入れ子の保護ブロックを元の位置と内容へ完全復元する'
);

const editResult = applyEdits(protectedResult.body, [{
  find: '<p>修正前の導入文です。</p>',
  replace: '<p>修正後の導入文です。</p>',
  reason: '導入を明確にする'
}]);
const restoredEdited = restore(editResult.bodyHtml, protectedResult.blocks);
assert.ok(restoredEdited.startsWith('<p>修正後の導入文です。</p>'), '通常文章の安全な差分だけを適用する');
assert.ok(restoredEdited.includes(productBlock), 'Rinker商品導線はAI差分に関係なく完全維持する');
assert.strictEqual((restoredEdited.match(/\[itemlink post_id="1503"\]/g) || []).length, 1, 'Rinkerを重複させない');

const protectedEdit = applyEdits(protectedResult.body, [{
  find: '<!-- UA_PROTECTED_BLOCK_002 -->',
  replace: '<p>削除</p>',
  reason: '不正な保護ブロック編集'
}]);
assert.strictEqual(protectedEdit.appliedChanges.length, 0, '保護ブロックを含む差分は適用しない');
assert.strictEqual(
  restore(protectedEdit.bodyHtml, protectedResult.blocks),
  original,
  '不正な差分が来てもRinkerの位置と内容を維持する'
);

console.log('Nested pre-publish protected-block tests passed.');
