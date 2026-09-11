const assert = require('assert');
const fs = require('fs');

// Regression test for the 2026-09-11 incident: the DRIVE BASE candidate sheet
// had multiple "書く" rows for the exact same keyword ("ハスラー HDMI どこ"),
// one of which had already been transferred ("転送済み") and turned into a
// published article. uaMoveWriteCandidatesForApp_ blindly moved every "書く"
// row into the article queue with no duplicate check, so the leftover "書く"
// row was generated into a second, near-identical article
// (hustler-hdmi-doko-2). This test locks in the fix: a "書く" row whose
// keyword already has a "転送済み" row (or a duplicate "書く" row earlier in
// the same batch) must be held back, not re-sent.

const config = fs.readFileSync('unified_article_app/config.gs', 'utf8');
const main = fs.readFileSync('unified_article_app/main.gs', 'utf8');
const utils = fs.readFileSync('unified_article_app/utils.gs', 'utf8');

function makeChainableRangeMock(rows, r, c, numRows, numCols) {
  let proxy;
  const base = {
    getValue: () => (rows[r] || [])[c - 1] || '',
    getValues: () => {
      const out = [];
      for (let i = 0; i < (numRows || 1); i++) {
        const row = rows[r + i] || [];
        const line = [];
        for (let j = 0; j < (numCols || 1); j++) line.push(row[c - 1 + j] === undefined ? '' : row[c - 1 + j]);
        out.push(line);
      }
      return out;
    },
    getDisplayValues: () => base.getValues(),
    setValues: (values) => {
      for (let i = 0; i < values.length; i++) {
        rows[r + i] = values[i].slice();
      }
      return proxy;
    },
    setValue: (value) => {
      const line = rows[r] || [];
      line[c - 1] = value;
      rows[r] = line;
      return proxy;
    }
  };
  proxy = new Proxy(base, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return () => proxy;
    }
  });
  return proxy;
}

function makeSheetMock(name, rows, lastRow, lastColumn) {
  let proxy;
  const base = {
    getName: () => name,
    getLastRow: () => lastRow,
    getLastColumn: () => lastColumn,
    getMaxColumns: () => 30,
    getMaxRows: () => Math.max(lastRow + 5, 20),
    getRange: (r, c, numRows, numCols) => makeChainableRangeMock(rows, r, c, numRows, numCols),
    _rows: rows
  };
  proxy = new Proxy(base, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return () => proxy;
    }
  });
  return proxy;
}

function run() {
  // Candidate sheet columns: status, affiliateName, keyword, volume.
  const candidateRows = {};
  candidateRows[1] = ['状態', '案件名', 'キーワード', '検索ボリューム'];
  candidateRows[2] = ['転送済み', 'ナビ男くん', 'ハスラー HDMI どこ', '170']; // already generated (post 2512)
  candidateRows[3] = ['書く', 'ナビ男くん', 'ハスラー HDMI どこ', '110']; // stale duplicate left in queue
  candidateRows[4] = ['書く', '案件無し', 'フォレスター HDMI 後付け', '110']; // duplicated twice within this run
  candidateRows[5] = ['書く', '案件無し', 'フォレスター HDMI 後付け', '90'];
  candidateRows[6] = ['書く', '案件無し', '新規キーワード', '50']; // normal, untouched case

  const candidateSheet = makeSheetMock('DRIVE BASE_キーワード候補', candidateRows, 6, 4);

  const articleRows = {};
  const articleSheet = makeSheetMock('DRIVE BASE', articleRows, 1, 23);

  let genericBuilder;
  genericBuilder = new Proxy({}, { get: () => () => genericBuilder });

  const spreadsheetAppMock = new Proxy({
    getActiveSpreadsheet: () => ({
      getSheetByName: () => null,
      getActiveSheet: () => candidateSheet,
      insertSheet: (name) => makeSheetMock(name, {}, 1, 10)
    })
  }, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return () => genericBuilder;
    }
  });

  const moduleBox = { exports: {} };
  new Function(
    'SpreadsheetApp',
    'Utilities',
    'PropertiesService',
    'module',
    config + '\n' + main + '\n' + utils + `
module.exports = { uaMoveWriteCandidatesForApp_ };
`
  )(
    spreadsheetAppMock,
    { computeDigest: () => [] },
    { getScriptProperties: () => ({ getProperty: () => '', setProperty: () => {} }) },
    moduleBox
  );

  const movedCount = moduleBox.exports.uaMoveWriteCandidatesForApp_(candidateSheet, articleSheet);

  // Only 2 rows should actually be moved: the first occurrence of the
  // Forester keyword, and the untouched new keyword. The Hustler duplicate
  // must NOT be moved (its keyword was already 転送済み).
  assert.strictEqual(movedCount, 2, '重複を除いた2件だけが記事化キューへ転記されるべき');

  // The already-sent Hustler row must remain untouched.
  assert.strictEqual(candidateRows[2][0], '転送済み', '既存の転送済み行は変化しない');

  // The stale duplicate "書く" row for the same keyword must be held, not sent again.
  assert.strictEqual(candidateRows[3][0], '保留', '既に転送済みのキーワードと重複する書く行は保留にする');

  // Of the two "フォレスター HDMI 後付け" rows, exactly one gets sent and the other held.
  const forresterStatuses = [candidateRows[4][0], candidateRows[5][0]].sort();
  assert.deepStrictEqual(forresterStatuses, ['保留', '転送済み'], '同一実行内の重複書く行は片方だけ転送済みになる');

  // The normal, non-duplicate row is sent as before.
  assert.strictEqual(candidateRows[6][0], '転送済み', '重複のない通常の書く行は従来通り転送済みになる');

  console.log('uaMoveWriteCandidatesForApp_ duplicate-keyword guard tests passed.');
}

run();
