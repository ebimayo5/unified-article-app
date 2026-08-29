const assert = require('assert');
const fs = require('fs');

const config = fs.readFileSync('unified_article_app/config.gs', 'utf8');
const links = fs.readFileSync('unified_article_app/links.gs', 'utf8');

new Function(links);

function makeSheetMock(rows) {
  const data = rows || [];
  return {
    getLastRow: () => data.length + 1,
    getLastColumn: () => (data[0] ? data[0].length : 8),
    getRange: (r, c, numRows, numCols) => ({
      getValues: () => {
        const out = [];
        for (let i = 0; i < numRows; i++) {
          const rowIndex = r - 2 + i;
          const row = data[rowIndex] || [];
          const line = [];
          for (let j = 0; j < numCols; j++) line.push(row[c - 1 + j] === undefined ? '' : row[c - 1 + j]);
          out.push(line);
        }
        return out;
      }
    })
  };
}

function makeSpreadsheetAppMock(sheetsByName) {
  return {
    getActiveSpreadsheet: () => ({
      getSheetByName: (name) => sheetsByName[name] || null
    })
  };
}

// -- Fixture: the shared 外部出典 sheet has one strong, evergreen candidate
// (columns: genre, name, url, usage, keywords, priority, urlStatus, checkedAt)
// and one weaker but still relevant alternative.
const externalSourceRows = [
  ['安全', '国土交通省の自動車点検整備に関する案内', 'https://example.go.jp/inspection', '点検整備の案内', '点検 整備 自動車 DRIVE BASE', '高', '', ''],
  ['安全', '別の自動車安全情報サイト', 'https://example.org/car-safety-alt', '点検整備の案内', '点検 自動車', '中', '', '']
];

function buildContext(articleRows) {
  const externalSourceSheet = makeSheetMock(externalSourceRows);
  const articleSheet = makeSheetMock(articleRows);
  const spreadsheetApp = makeSpreadsheetAppMock({
    '外部出典': externalSourceSheet,
    'DRIVE BASE': articleSheet
  });
  const moduleBox = { exports: {} };
  new Function('SpreadsheetApp', 'module', config + '\n' + links + `
module.exports = {
  candidates: uaGetExternalSourceCandidates_,
  recentBodies: uaGetRecentExternalSourceArticleBodies_,
  score: uaScoreExternalSource_
};
`)(spreadsheetApp, moduleBox);
  return moduleBox.exports;
}

const appConfig = { key: 'drive', label: 'DRIVE BASE', articleSheetName: 'DRIVE BASE' };

// UA_COLUMNS.status = 11, UA_COLUMNS.body = 14 (1-indexed); build rows wide enough.
function articleRow(status, body) {
  const row = new Array(14).fill('');
  row[10] = status; // column 11
  row[13] = body;   // column 14
  return row;
}

// 1) With no article history yet, the strong evergreen candidate wins as before.
{
  const ctx = buildContext([]);
  const candidates = ctx.candidates('フィアット パンダ 後悔', appConfig);
  assert.ok(candidates.length > 0, '候補が0件にならない');
  assert.strictEqual(candidates[0].url, 'https://example.go.jp/inspection', '通常時は最もスコアが高い候補が先頭に来る');
}

// 2) Once a recent, already-published article's body already cites that same URL,
//    it must be penalized so a different (still relevant) candidate can surface instead.
{
  const recentBody = '<p>点検は<a href="https://example.go.jp/inspection">こちら</a>で確認できます。</p>';
  const articleRows = [
    articleRow('投稿済み', recentBody)
  ];
  const ctx = buildContext(articleRows);

  const recentBodies = ctx.recentBodies(appConfig);
  assert.strictEqual(recentBodies.length, 1, '投稿済み記事の本文を1件取得する');
  assert.ok(recentBodies[0].indexOf('example.go.jp/inspection') !== -1, '取得した本文に対象URLが含まれる');

  const candidates = ctx.candidates('セレナe-power 買って 後悔', appConfig);
  const inspectionCandidate = candidates.find((c) => c.url === 'https://example.go.jp/inspection');
  const altCandidate = candidates.find((c) => c.url === 'https://example.org/car-safety-alt');
  assert.ok(
    !inspectionCandidate || (altCandidate && altCandidate.score >= inspectionCandidate.score),
    '直近で使われたURLは、まだ使われていない同ジャンルの候補より上位に来ない'
  );
}

// 3) Rows that are not yet posted/drafted (candidates, stopped, blank) must not count as "used".
{
  const recentBody = '<p><a href="https://example.go.jp/inspection">案内</a></p>';
  const articleRows = [
    articleRow('候補', recentBody),
    articleRow('停止', recentBody),
    articleRow('', recentBody)
  ];
  const ctx = buildContext(articleRows);
  const recentBodies = ctx.recentBodies(appConfig);
  assert.strictEqual(recentBodies.length, 0, '投稿済み・WP下書き済み以外の行は使用実績として数えない');
}

// 4) A URL that was used many rows ago, outside the recent scan window, no longer counts.
{
  const oldBody = '<p><a href="https://example.go.jp/inspection">案内</a></p>';
  const articleRows = [];
  for (let i = 0; i < 20; i++) articleRows.push(articleRow('投稿済み', i === 0 ? oldBody : '<p>関係ない本文</p>'));
  const ctx = buildContext(articleRows);
  const recentBodies = ctx.recentBodies(appConfig);
  assert.ok(
    recentBodies.every((body) => body.indexOf('example.go.jp/inspection') === -1),
    '直近スキャン範囲より前の使用履歴は減点対象にしない'
  );
}

// 5) uaScoreExternalSource_ itself: direct check of the penalty magnitude.
{
  const data = { genre: '安全', name: '案内', url: 'https://example.go.jp/inspection', usage: '', keywords: '', priority: '高' };
  const scoreWithoutHistory = new Function(config + '\n' + links + '\nreturn uaScoreExternalSource_;')()('フィアット パンダ', appConfig, data, []);
  const scoreWithHistory = new Function(config + '\n' + links + '\nreturn uaScoreExternalSource_;')()(
    'フィアット パンダ',
    appConfig,
    data,
    ['<a href="https://example.go.jp/inspection">x</a>']
  );
  assert.strictEqual(scoreWithoutHistory - scoreWithHistory, 5, '使用済みURLはUA_EXTERNAL_SOURCE_RECENT_USE_PENALTY分だけ減点される');
}

console.log('External source recency tests: OK');
