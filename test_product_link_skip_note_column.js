const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Regression for 2026-09-19: row93「防災用品 備蓄 賞味期限切れ 後悔」kept stopping at
// stage 8. Stage 4 had correctly decided "no product fits", but it recorded that
// decision only in 要確認ポイント, and stage 7 replaces that cell wholesale with its
// own report. By the stage 8 re-check the marker was gone, so the dedicated
// product H2 rule fired again and the article could never reach WordPress.
const read = (f) => fs.readFileSync(path.join(__dirname, 'unified_article_app', f), 'utf8');
const context = { console };
vm.createContext(context);
vm.runInContext(read('config.gs') + '\n' + read('pre_publish_check.gs'), context);

// const declarations inside a vm script are not exposed on the context object,
// so read them by evaluating expressions in the same script scope.
const val = (expr) => vm.runInContext(expr, context);

assert.strictEqual(val('UA_COLUMNS.productLinkSkipNote'), 24,
  '商品導線スキップ記録は専用列を持つ');
assert.strictEqual(val('UA_ARTICLE_COLUMN_COUNT'), val('UA_COLUMNS.structureMemo'),
  '一括書き込みの幅に新列を含めない（含めると行保存のたびにフラグが消える）');
assert.strictEqual(val('UA_ARTICLE_READ_COLUMN_COUNT'), val('UA_COLUMNS.productLinkSkipNote'),
  '読み取りの幅は新列まで広げる');
assert.strictEqual(val('UA_HEADERS.length'), val('UA_COLUMNS.productLinkSkipNote'),
  'ヘッダーの数と最終列番号が一致する（uaEnsureArticleSheetLayout_が列を自動追加できる）');

const has = context.uaHasIntentionalNoProductDecision_;
assert.strictEqual(
  has({ productLinkSkipNote: '商品導線保証をスキップ｜2026-09-19 21:00:00｜AIが適合商品なしと判定', factCheckPoints: '【公開前チェック】…' }),
  true,
  '専用列に記録があれば、要確認ポイントが工程7で上書きされていても免除される'
);
assert.strictEqual(
  has({ productLinkSkipNote: '', factCheckPoints: '・商品導線保証をスキップ｜候補なし' }),
  true,
  '新列導入前から処理中だった行は、従来どおり要確認ポイントでも判定できる'
);
assert.strictEqual(
  has({ productLinkSkipNote: '', factCheckPoints: '【公開前チェック】\nNG: 2件' }),
  false,
  'どちらにも記録がなければ免除しない'
);

const findH2 = context.uaFindPrePublishStandaloneProductSectionsWithoutRakuten_;
const body = '<h2>食品以外の防災用品も期限と劣化を分けて点検</h2><p>本文</p>' +
  '<h2>買い直す前の防災用品チェックリスト</h2><p>本文</p>';
assert.strictEqual(findH2(body, false).length, 2,
  '記録がなければ用品専用H2は2件ともNGになる（row93で実際に出たNG）');
assert.strictEqual(findH2(body, true).length, 0,
  '意図的スキップの記録があればNGにしない');

console.log('Product link skip note column tests passed');
