const assert = require('assert');
const fs = require('fs');

const config = fs.readFileSync('unified_article_app/config.gs', 'utf8');
const main = fs.readFileSync('unified_article_app/main.gs', 'utf8');
const article = fs.readFileSync('unified_article_app/article.gs', 'utf8');
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
  // Any other chainable setter (setDataValidation, setFontWeight, merge, ...)
  // used by uaEnsureArticleSheetLayout_'s header/link setup is irrelevant to
  // this guard test -- catch-all no-op that returns the range for chaining.
  proxy = new Proxy(base, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return () => proxy;
    }
  });
  return proxy;
}

function makeSheetMock() {
  let proxy;
  const rows = {};
  const base = {
    getName: () => 'DRIVE BASE',
    getActiveCell: () => ({ getRow: () => 5 }),
    getRange: (r, c, numRows, numCols) => makeChainableRangeMock(rows, r, c, numRows, numCols),
    getMaxColumns: () => 30,
    _rows: rows
  };
  // Sheet-level cosmetic setup (insertColumnsAfter, setFrozenRows,
  // setColumnWidth, ...) called by uaEnsureArticleSheetLayout_'s header/link
  // setup is irrelevant to this guard test -- catch-all no-op returning the
  // sheet mock itself for chaining, same pattern as the range mock above.
  proxy = new Proxy(base, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return () => proxy;
    }
  });
  return proxy;
}

const propsStore = {};
const propertiesServiceMock = {
  getScriptProperties: () => ({
    getProperty: (key) => propsStore[key] || '',
    setProperty: (key, value) => { propsStore[key] = value; }
  })
};

const moduleBox = { exports: {} };
const sheet = makeSheetMock();
// Row 5 already has real data before any save attempt, to prove a blocked call leaves it untouched.
sheet._rows[5] = ['DRIVE BASE', '既存のキーワード', '100', '', '', '', '', '', '', '', '投稿済み', '', '', '既存の本文', '', '', '', '', '', '', '', '', ''];

new Function(
  'SpreadsheetApp',
  'Utilities',
  'PropertiesService',
  'module',
  config + '\n' + main + '\n' + article + '\n' + utils + `
module.exports = { uaSaveActiveRowData };
`
)(
  { getActiveSpreadsheet: () => ({ getSheetByName: (name) => (name === 'DRIVE BASE' ? sheet : null), getActiveSheet: () => sheet }) },
  { computeDigest: () => [] },
  propertiesServiceMock,
  moduleBox
);

// 1) Calling with no data (or {}) must throw instead of wiping the row.
assert.throws(() => moduleBox.exports.uaSaveActiveRowData(undefined), /dataが空です/, 'undefined data must be rejected');
assert.throws(() => moduleBox.exports.uaSaveActiveRowData({}), /dataが空です/, 'empty object data must be rejected');

// 2) The row must be completely untouched after the blocked calls.
assert.strictEqual(sheet._rows[5][1], '既存のキーワード', 'mainInput must survive a blocked call');
assert.strictEqual(sheet._rows[5][13], '既存の本文', 'body must survive a blocked call');

// 3) Real 2026-08-30 incident: calling a *FromPanel function directly from
// the script editor with a sparse object (just row/appType, as readForm()
// never produces) must be rejected when the row already has real content --
// this is exactly the shape that wiped a live row's body/title/tags/WP post
// id down to empty strings before this guard existed.
assert.throws(
  () => moduleBox.exports.uaSaveActiveRowData({ row: 5, appType: 'DRIVE BASE' }),
  /body \/ mainInput のキーがありません/,
  'sparse data (missing body/mainInput keys) on a row with existing content must be rejected'
);
assert.strictEqual(sheet._rows[5][1], '既存のキーワード', 'mainInput must survive a blocked sparse call');
assert.strictEqual(sheet._rows[5][13], '既存の本文', 'body must survive a blocked sparse call');

// 4) A real readForm()-shaped save (body/mainInput keys present, even as
// explicit empty strings for untouched fields) must still work normally --
// the guard must not block legitimate panel saves.
{
  const sheet6 = makeSheetMock();
  const freshModule = { exports: {} };
  new Function(
    'SpreadsheetApp',
    'Utilities',
  'PropertiesService',
    'module',
    config + '\n' + main + '\n' + article + '\n' + utils + `
module.exports = { uaSaveActiveRowData };
`
  )(
    { getActiveSpreadsheet: () => ({ getSheetByName: (name) => (name === 'DRIVE BASE' ? sheet6 : null), getActiveSheet: () => sheet6 }) },
    { computeDigest: () => [] },
  propertiesServiceMock,
    freshModule
  );
  const saved = freshModule.exports.uaSaveActiveRowData({
    row: 6,
    appType: 'DRIVE BASE',
    mainInput: '新しいキーワード',
    body: '新しい本文'
  });
  assert.strictEqual(saved.mainInput, '新しいキーワード', '通常のパネル保存（body/mainInputキーあり）は成功する');
  assert.strictEqual(saved.body, '新しい本文', '通常のパネル保存で本文が保存される');
}

// 5) A blank, never-populated row must still allow a first save even without
// body/mainInput keys -- the guard only blocks overwriting EXISTING content.
{
  const blankSheet = makeSheetMock();
  const freshModule = { exports: {} };
  new Function(
    'SpreadsheetApp',
    'Utilities',
  'PropertiesService',
    'module',
    config + '\n' + main + '\n' + article + '\n' + utils + `
module.exports = { uaSaveActiveRowData };
`
  )(
    { getActiveSpreadsheet: () => ({ getSheetByName: (name) => (name === 'DRIVE BASE' ? blankSheet : null), getActiveSheet: () => blankSheet }) },
    { computeDigest: () => [] },
  propertiesServiceMock,
    freshModule
  );
  const saved = freshModule.exports.uaSaveActiveRowData({ row: 5, appType: 'DRIVE BASE' });
  assert.strictEqual(saved.mainInput, '', '空欄行への初回保存はガードでブロックされない');
}

console.log('uaSaveActiveRowData empty-data guard tests passed.');
