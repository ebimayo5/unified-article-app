const fs = require('fs'), vm = require('vm'), assert = require('assert');
const src = fs.readFileSync(__dirname + '/unified_article_app/unkan_arcon.gs', 'utf8');

function run(recordJson, rowIdCell) {
  const sheetRows = recordJson === null ? [['記事行', '確認日時', '本文照合ハッシュ', '根拠確認JSON']] : [['記事行', '確認日時', '本文照合ハッシュ', '根拠確認JSON'], [rowIdCell, '', '', recordJson]];
  const reviewSheet = {
    getLastRow: () => sheetRows.length,
    getRange: (r, c, n) => ({
      getValues: () => sheetRows.slice(r - 1, r - 1 + (n || 1)).map(x => [x[c - 1]]),
      getValue: () => sheetRows[r - 1][c - 1],
      setValue: () => {}
    })
  };
  const ctx = {
    console, UA_APP_TYPES: { unkan: { articleSheetName: '運管' } },
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: (n) => (n === '運管_根拠確認' ? reviewSheet : null) }) },
    Session: { getActiveUser: () => ({ getEmail: () => 'o@example.com' }), getEffectiveUser: () => ({ getEmail: () => 'o@example.com' }) },
    uaSaveActiveRowData: () => {}, uaGetSheetForData_: () => ({ getRange: () => ({ setValue: () => {} }) }),
    uaBuildRowData_: () => ({ appType: '運行管理者試験対策', body: '<p>本文</p>', row: 3 }),
    uaIsUnkan_: () => true, uaApplyManagedAffiliateCta_: (b) => b,
    uaUnkanReviewHash_: () => 'HASH', uaUnkanReviewClaims_: () => ['項目A 3日間', '項目B 8,900円'],
    UA_COLUMNS: { body: 14 }
  };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  // ソース内の同名関数を、この試験で使うものに差し替える。
  ctx.uaIsUnkan_ = () => true;
  ctx.uaUnkanReviewHash_ = () => 'HASH';
  ctx.uaUnkanReviewClaims_ = () => ['項目A 3日間', '項目B 8,900円'];
  ctx.uaApplyManagedAffiliateCta_ = (b) => b;
  return ctx.uaGetUnkanReviewFromWeb({ row: 3 });
}

// 下書き(配列だけ)でも、保存済み(entries付きオブジェクト)でも、同じ行のJSONを返す。
const draft = [{ claim: '項目A 3日間', url: 'https://www.nasva.go.jp/x', quote: '3日', checkedOn: '2026-10-11', experience: false }];
assert.strictEqual(run(JSON.stringify(draft), 3).entries.length, 1);
assert.strictEqual(run(JSON.stringify({ digest: 'x', entries: draft }), 3).entries[0].claim, '項目A 3日間');
// 別の行の記録は混ざらない。記録が無い・壊れたJSONでも失敗しない。
assert.strictEqual(run(JSON.stringify(draft), 9).entries.length, 0);
assert.strictEqual(run(null).entries.length, 0);
assert.strictEqual(run('{not json', 3).entries.length, 0);
console.log('test_unkan_review_prefill OK');
