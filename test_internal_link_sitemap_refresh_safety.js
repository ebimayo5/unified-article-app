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
// marked 手動保持 (manual keep) -- the exact shape that a prior refresh (or the
// automatic per-post capture) would have produced.
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

function run(callWordPressApiImpl) {
  const sheet = makeSheetMock(existingRows);
  const alerts = [];
  const moduleBox = { exports: {} };

  new Function(
    'SpreadsheetApp',
    'uaGetWpConfig_',
    'uaCallWordPressApi_',
    'module',
    config + '\n' + utils + '\n' + links + `
module.exports = { run: uaUpdateInternalLinksFromSitemaps };
`
  )(
    makeSpreadsheetAppMock(sheet, alerts),
    (appConfig) => ({ siteUrl: 'https://ebimayo5.com', label: appConfig.label }),
    callWordPressApiImpl,
    moduleBox
  );

  moduleBox.exports.run();

  return { sheet, alerts };
}

// Scenario: the WordPress REST API call throws (auth failure, network error,
// WAF block, etc). This must NOT touch existing rows.
{
  const { sheet } = run(() => { throw new Error('403 Forbidden'); });
  assert.strictEqual(sheet.getLastRow(), 4, 'A failed WordPress fetch must not remove any existing rows');
  assert.strictEqual(sheet._rows[1][2], '記事A', 'Existing row A must be untouched after a failed refresh');
  assert.strictEqual(sheet._rows[2][2], '記事B', 'Existing row B must be untouched after a failed refresh');
  assert.strictEqual(sheet._rows[3][2], '記事C', 'Existing row C must be untouched after a failed refresh');
}

// Scenario: the API call succeeds but returns zero posts. Also must not
// touch existing rows (this is exactly what happened in production: the
// old sitemap-scrape path silently returned 0 URLs with no thrown error).
{
  const { sheet, alerts } = run(() => []);
  assert.strictEqual(sheet.getLastRow(), 4, 'Zero posts returned must not remove any existing rows');
  assert(alerts[0].indexOf('記事取得0件') !== -1, 'The alert must clearly say 0 posts were fetched');
}

// Scenario: a successful fetch upserts an existing URL in place (preserving
// 使う場面) and appends a brand-new URL as a new row.
{
  const { sheet } = run((wpConfig, path) => {
    if (path.indexOf('page=1') === -1) return [];
    return [
      {
        link: 'https://ebimayo5.com/archives/a/',
        title: { rendered: '記事A（更新後タイトル）' },
        excerpt: { rendered: '<p>更新後の説明。</p>' },
        content: { rendered: '<p>更新後の本文冒頭。</p>' }
      },
      {
        link: 'https://ebimayo5.com/archives/d/',
        title: { rendered: '新しい記事D' },
        excerpt: { rendered: '<p>Dの説明。</p>' },
        content: { rendered: '<p>Dの本文冒頭。</p>' }
      }
    ];
  });
  assert.strictEqual(sheet.getLastRow(), 5, 'One updated row plus one appended row must total 5 rows (4 + the new D row)');
  assert.strictEqual(sheet._rows[1][2], '記事A（更新後タイトル）', 'Row A must refresh to the latest title');
  assert.strictEqual(sheet._rows[1][9], '使う場面A', 'Manually-set 使う場面 on row A must survive the refresh');
  assert.strictEqual(sheet._rows[4][2], '新しい記事D', 'A brand-new post must be appended as a new row');
}

console.log('internal link sitemap-refresh safety tests: OK');
