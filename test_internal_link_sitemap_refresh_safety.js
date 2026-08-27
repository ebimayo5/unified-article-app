const assert = require('assert');
const fs = require('fs');

const links = fs.readFileSync('unified_article_app/links.gs', 'utf8');
const utils = fs.readFileSync('unified_article_app/utils.gs', 'utf8');
const config = fs.readFileSync('unified_article_app/config.gs', 'utf8');

new Function(links);

function makeSheetMock(initialRows) {
  const rows = initialRows.map((r) => r.slice());
  return {
    getLastRow: () => rows.length,
    getLastColumn: () => (rows[0] ? rows[0].length : 0),
    getRange: (r, c, numRows, numCols) => ({
      setValues: (values) => {
        for (let i = 0; i < values.length; i++) {
          rows[r - 1 + i] = rows[r - 1 + i] || [];
          for (let j = 0; j < values[i].length; j++) rows[r - 1 + i][c - 1 + j] = values[i][j];
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
      },
      clearContent: () => {
        for (let i = 0; i < numRows; i++) rows[r - 1 + i] = new Array(numCols).fill('');
      }
    }),
    appendRow: (row) => { rows.push(row.slice()); },
    setFrozenRows: () => {},
    autoResizeColumns: () => {},
    _rows: rows
  };
}

// Simulate a sheet that already has 3 established candidates, none of them
// marked 手動保持 (manual keep) -- the exact shape that a prior sitemap crawl
// (or the automatic per-post capture) would have produced.
const header = ['サイト', 'URL', 'タイトル', 'メタディスクリプション', '本文冒頭', '関連キーワード', '核記事', '取得日時', '手動保持', '使う場面', '優先度'];
const existingRows = [
  header,
  ['DRIVE BASE', 'https://ebimayo5.com/archives/a/', '記事A', '説明A', '冒頭A', 'キーワードA', '', new Date(), '', '使う場面A', '中'],
  ['DRIVE BASE', 'https://ebimayo5.com/archives/b/', '記事B', '説明B', '冒頭B', 'キーワードB', '', new Date(), '', '使う場面B', '中'],
  ['DRIVE BASE', 'https://ebimayo5.com/archives/c/', '記事C', '説明C', '冒頭C', 'キーワードC', '', new Date(), '', '使う場面C', '中']
];

function makeSpreadsheetAppMock(sheet, alerts) {
  return {
    getActiveSpreadsheet: () => ({
      getSheetByName: () => sheet,
      insertSheet: () => sheet
    }),
    getUi: () => ({ alert: (msg) => alerts.push(msg) })
  };
}

function run(scenario) {
  const sheet = makeSheetMock(existingRows);
  const alerts = [];
  const moduleBox = { exports: {} };

  new Function(
    'SpreadsheetApp',
    'PropertiesService',
    'UrlFetchApp',
    'module',
    config + '\n' + utils + '\n' + links + `
module.exports = { run: uaUpdateInternalLinksFromSitemaps };
`
  )(
    makeSpreadsheetAppMock(sheet, alerts),
    { getScriptProperties: () => ({ getProperty: (name) => scenario.sitemapUrlSet ? 'https://ebimayo5.com/sitemap.xml' : '' }) },
    { fetch: scenario.urlFetchImpl },
    moduleBox
  );

  moduleBox.exports.run();

  return { sheet, alerts };
}

// Scenario: the sitemap fetch itself throws (e.g. a security plugin blocks
// UrlFetchApp, or the sitemap URL is wrong). This must NOT touch existing rows.
{
  const { sheet } = run({
    sitemapUrlSet: true,
    urlFetchImpl: () => { throw new Error('WAF blocked the request'); }
  });
  assert.strictEqual(sheet.getLastRow(), 4, 'A failed sitemap fetch must not remove any existing rows');
  assert.strictEqual(sheet._rows[1][2], '記事A', 'Existing row A must be untouched after a failed crawl');
  assert.strictEqual(sheet._rows[2][2], '記事B', 'Existing row B must be untouched after a failed crawl');
  assert.strictEqual(sheet._rows[3][2], '記事C', 'Existing row C must be untouched after a failed crawl');
}

// Scenario: the sitemap URL script property was never configured for this
// site. This must also leave existing rows untouched (previously this wiped
// everything down to only 手動保持 rows).
{
  const { sheet } = run({
    sitemapUrlSet: false,
    urlFetchImpl: () => { throw new Error('should not be called'); }
  });
  assert.strictEqual(sheet.getLastRow(), 4, 'A missing sitemap URL setting must not remove any existing rows');
}

console.log('internal link sitemap-refresh safety tests: OK');
