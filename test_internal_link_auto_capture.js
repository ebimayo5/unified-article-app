const assert = require('assert');
const fs = require('fs');

const links = fs.readFileSync('unified_article_app/links.gs', 'utf8');
const utils = fs.readFileSync('unified_article_app/utils.gs', 'utf8');
const automation = fs.readFileSync('unified_article_app/automation.gs', 'utf8');

new Function(links);
new Function(automation);

function makeSheetMock() {
  const rows = [];
  return {
    getLastRow: () => rows.length,
    getLastColumn: () => (rows[0] ? rows[0].length : 0),
    getRange: (r, c, numRows, numCols) => ({
      setValues: (values) => {
        for (let i = 0; i < values.length; i++) {
          rows[r - 1 + i] = rows[r - 1 + i] || [];
          for (let j = 0; j < values[i].length; j++) {
            rows[r - 1 + i][c - 1 + j] = values[i][j];
          }
        }
      },
      getValues: () => {
        const out = [];
        for (let i = 0; i < numRows; i++) {
          const row = rows[r - 1 + i] || [];
          const line = [];
          for (let j = 0; j < numCols; j++) line.push(row[c - 1 + j] === undefined ? '' : row[c - 1 + j]);
          out.push(line);
        }
        return out;
      }
    }),
    appendRow: (row) => { rows.push(row.slice()); },
    setFrozenRows: () => {},
    autoResizeColumns: () => {},
    _rows: rows
  };
}

function makeSpreadsheetAppMock() {
  const sheets = {};
  return {
    getActiveSpreadsheet: () => ({
      getSheetByName: (name) => sheets[name] || null,
      insertSheet: (name) => { sheets[name] = makeSheetMock(); return sheets[name]; }
    }),
    _sheets: sheets
  };
}

const moduleBox = { exports: {} };
const spreadsheetApp = makeSpreadsheetAppMock();
new Function(
  'SpreadsheetApp',
  'uaUsesSwellBlocks_',
  'uaNormalizeForScore_',
  'module',
  "const UA_INTERNAL_LINK_SHEET_NAME = '内部リンク';\nconst UA_INTERNAL_LINK_MAX_CANDIDATES = 3;\n" + utils + '\n' + links + `
module.exports = {
  upsert: uaUpsertInternalLinkCandidateForPost_,
  candidates: uaGetInternalLinkCandidates_
};
`
)(
  spreadsheetApp,
  (config) => config && config.wpEditorTheme === 'swell',
  (value) => String(value || '').toLowerCase().replace(/[\s　]+/g, ''),
  moduleBox
);

const driveConfig = { key: 'drive', label: 'DRIVE BASE', wpEditorTheme: 'swell', useInternalLinks: true };

moduleBox.exports.upsert(
  driveConfig,
  'https://ebimayo5.com/archives/certified-used-car-yametoke/',
  '認定中古車はやめとけ？割高でも後悔しない購入判断のポイント',
  '認定中古車の価格差と保証を確認して後悔を減らす方法を解説します。',
  '<p>認定中古車は安心だと思っていたのに、後悔するのは避けたいですよね。</p>',
  '認定中古車,中古車保証'
);

const sheet = spreadsheetApp._sheets['内部リンク'];
assert(sheet, 'Internal link sheet must be created automatically');
assert.strictEqual(sheet.getLastRow(), 2, 'One header row plus one data row must exist after first upsert');
assert.strictEqual(sheet._rows[1][1], 'https://ebimayo5.com/archives/certified-used-car-yametoke/', 'URL must be stored');
assert.strictEqual(sheet._rows[1][2], '認定中古車はやめとけ？割高でも後悔しない購入判断のポイント', 'Title must be stored');

// Simulate a manual edit to 核記事 (core-article flag) and 使う場面 before the next automatic republish.
sheet._rows[1][6] = true;
sheet._rows[1][9] = '手動で決めた使う場面';

moduleBox.exports.upsert(
  driveConfig,
  'https://ebimayo5.com/archives/certified-used-car-yametoke/',
  '認定中古車はやめとけ？割高でも後悔しない購入判断のポイント（更新）',
  '更新後の説明文。',
  '<p>更新後の本文冒頭。</p>',
  '認定中古車'
);

assert.strictEqual(sheet.getLastRow(), 2, 'Re-publishing the same URL must update the row in place, not append a duplicate');
assert.strictEqual(sheet._rows[1][6], true, 'Manually-set 核記事 flag must survive an automatic refresh');
assert.strictEqual(sheet._rows[1][9], '手動で決めた使う場面', 'Manually-set 使う場面 must survive an automatic refresh');
assert.strictEqual(sheet._rows[1][2], '認定中古車はやめとけ？割高でも後悔しない購入判断のポイント（更新）', 'Title must refresh to the latest published title');

// A different article on the same site should become a new row, not overwrite the first.
moduleBox.exports.upsert(
  driveConfig,
  'https://ebimayo5.com/archives/toyota-86-used-car-yametoke/',
  '86の中古はやめとけ？後悔しない個体の見分け方',
  '86の中古車選びの注意点を整理します。',
  '<p>86の中古は憧れの気持ちを否定されたようで迷うものです。</p>',
  '86,中古車'
);
assert.strictEqual(sheet.getLastRow(), 3, 'A second, different URL must be appended as a new row');

// Disabled sites (useInternalLinks:false) must not write anything.
const generalConfig = { key: 'general', label: '汎用記事', wpEditorTheme: 'core', useInternalLinks: false };
moduleBox.exports.upsert(generalConfig, 'https://example.com/general/', 'タイトル', '説明', '<p>本文</p>', '');
assert.strictEqual(sheet.getLastRow(), 3, 'Sites with useInternalLinks:false must not add a candidate row');

assert(
  automation.includes('uaUpsertInternalLinkCandidateForPost_('),
  'Automatic publishing must register the newly published post as a future internal-link candidate'
);

console.log('internal link auto-capture tests: OK');
