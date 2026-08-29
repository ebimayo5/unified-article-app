const assert = require('assert');
const fs = require('fs');

const config = fs.readFileSync('unified_article_app/config.gs', 'utf8');
const main = fs.readFileSync('unified_article_app/main.gs', 'utf8');

function makeSheetMock() {
  const rows = {};
  return {
    getName: () => 'DRIVE BASE',
    getActiveCell: () => ({ getRow: () => 5 }),
    getRange: (r, c, numRows, numCols) => ({
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
      }
    }),
    _rows: rows
  };
}

const moduleBox = { exports: {} };
const sheet = makeSheetMock();
// Row 5 already has real data before any save attempt, to prove a blocked call leaves it untouched.
sheet._rows[5] = ['DRIVE BASE', '既存のキーワード', '100', '', '', '', '', '', '', '', '投稿済み', '', '', '既存の本文', '', '', '', '', '', '', '', '', ''];

new Function(
  'SpreadsheetApp',
  'Utilities',
  'module',
  config + '\n' + main + `
module.exports = { uaSaveActiveRowData };
`
)(
  { getActiveSpreadsheet: () => ({ getSheetByName: (name) => (name === 'DRIVE BASE' ? sheet : null), getActiveSheet: () => sheet }) },
  { computeDigest: () => [] },
  moduleBox
);

// 1) Calling with no data (or {}) must throw instead of wiping the row.
assert.throws(() => moduleBox.exports.uaSaveActiveRowData(undefined), /dataが空です/, 'undefined data must be rejected');
assert.throws(() => moduleBox.exports.uaSaveActiveRowData({}), /dataが空です/, 'empty object data must be rejected');

// 2) The row must be completely untouched after the blocked calls.
assert.strictEqual(sheet._rows[5][1], '既存のキーワード', 'mainInput must survive a blocked call');
assert.strictEqual(sheet._rows[5][13], '既存の本文', 'body must survive a blocked call');

console.log('uaSaveActiveRowData empty-data guard tests passed.');
