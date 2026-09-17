const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('unified_article_app/article.gs', 'utf8');
const context = {};
vm.createContext(context);
vm.runInContext(source, context);

const drive = { key: 'drive' };
const informational = { mainInput: '純正 ナビ メリット', affiliateNotes: '' };

assert.strictEqual(
  context.uaShouldSkipUnplannedInformationalDriveProductLinks_(informational, drive, null),
  true,
  '保存済み商品計画のないDRIVE BASE情報記事は、商品を推測して自動投稿を止めない'
);
assert.strictEqual(
  context.uaShouldSkipUnplannedInformationalDriveProductLinks_(
    informational,
    drive,
    { shouldInsert: true, primaryProduct: 'テレビキャンセラー' }
  ),
  false,
  '保存済み商品計画がある記事は従来どおり商品導線を保証する'
);
assert.strictEqual(
  context.uaShouldSkipUnplannedInformationalDriveProductLinks_(
    { mainInput: '純正 ナビ メリット', affiliateNotes: '楽天あり' },
    drive,
    null
  ),
  false,
  '明示的な楽天導線指定は旧記事でも優先する'
);
assert.strictEqual(
  context.uaShouldSkipUnplannedInformationalDriveProductLinks_(informational, { key: 'home' }, null),
  false,
  'たくみパパの既存商品導線判定には影響しない'
);

console.log('DRIVE unplanned informational product-link skip tests passed');
