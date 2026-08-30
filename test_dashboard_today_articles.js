const assert = require('assert');
const fs = require('fs');

const config = fs.readFileSync('unified_article_app/config.gs', 'utf8');
const automation = fs.readFileSync('unified_article_app/automation.gs', 'utf8');
const webHtml = fs.readFileSync('unified_article_app/ua_web_app.html', 'utf8');

// --- 1) Wiring assertions: the completion path must log, and the panel endpoint must expose it ---

assert.ok(automation.includes("const UA_AUTOMATION_DAILY_LOG_PROPERTY = 'UA_AUTOMATION_DAILY_LOG';"), 'daily log property key is missing');
assert.ok(automation.includes('function uaAppendAutomaticPostingDailyLog_('), 'daily log append helper is missing');
assert.ok(automation.includes('function uaListUpcomingAutomaticPostingCandidates_('), 'upcoming candidates helper is missing');
assert.ok(
  automation.includes("if (String(message || '').indexOf('完了') === 0) {") &&
  automation.includes('uaAppendAutomaticPostingDailyLog_({'),
  'uaCompleteAutomaticPostingJob_ must log only successful completions (skip must not log)'
);
assert.ok(automation.includes('todayPosted: todayPosted,'), 'panel endpoint must return todayPosted');
assert.ok(automation.includes('todayUpcoming: todayUpcoming,'), 'panel endpoint must return todayUpcoming');

// --- 2) Functional test: uaGetAutomaticPostingDailyLog_ / uaAppendAutomaticPostingDailyLog_ ---
{
  const store = {};
  const PropertiesService = {
    getScriptProperties: () => ({
      getProperty: (key) => (store[key] === undefined ? null : store[key]),
      setProperty: (key, value) => { store[key] = value; }
    })
  };
  const Utilities = {
    formatDate: () => '2026-08-29'
  };
  const moduleBox = { exports: {} };
  new Function('PropertiesService', 'Utilities', 'module', config + '\n' + automation + `
module.exports = { getLog: uaGetAutomaticPostingDailyLog_, appendLog: uaAppendAutomaticPostingDailyLog_ };
`)(PropertiesService, Utilities, moduleBox);
  const { getLog, appendLog } = moduleBox.exports;

  assert.deepStrictEqual(getLog('2026-08-29', 'drive'), { date: '2026-08-29', items: [] }, 'a missing log must return an empty list');

  appendLog({ keyword: 'セレナe-power 買って 後悔', time: '2026-08-29T09:00:00.000Z', mode: 'drafted' }, 'drive');
  appendLog({ keyword: 'フィアットパンダ 後悔', time: '2026-08-29T10:00:00.000Z', mode: 'published' }, 'drive');
  const log = getLog('2026-08-29', 'drive');
  assert.strictEqual(log.items.length, 2, 'both entries must be recorded');
  assert.strictEqual(log.items[1].keyword, 'フィアットパンダ 後悔', 'entries must be appended in order');

  // A log written under yesterday's date must not leak into today's read.
  assert.deepStrictEqual(getLog('2026-08-28', 'drive'), { date: '2026-08-28', items: [] }, 'a stale-dated log must not be returned for a different date');
}

// --- 3) Functional test: uaListUpcomingAutomaticPostingCandidates_ ---
{
  const candidateRows = [
    ['書く', '案件A', 'キーワードA', '1000'],
    ['保留', '案件B', 'キーワードB', '2000'],
    ['書く', '案件C', 'キーワードC', '3000'],
    ['書く', '案件D', 'キーワードD', '4000']
  ];
  const candidateSheet = {
    getLastRow: () => candidateRows.length + 1,
    getRange: (r, c, numRows, numCols) => ({
      getValues: () => candidateRows.slice(r - 2, r - 2 + numRows)
    })
  };
  const SpreadsheetApp = {
    getActiveSpreadsheet: () => ({
      getSheetByName: (name) => (name === 'DRIVE BASE_キーワード候補' ? candidateSheet : null)
    })
  };
  const moduleBox = { exports: {} };
  new Function('SpreadsheetApp', 'module', config + '\n' + automation + `
module.exports = { listUpcoming: uaListUpcomingAutomaticPostingCandidates_ };
`)(SpreadsheetApp, moduleBox);
  const listUpcoming = moduleBox.exports.listUpcoming;

  const appConfig = { key: 'drive', label: 'DRIVE BASE', candidateSheetName: 'DRIVE BASE_キーワード候補' };
  assert.deepStrictEqual(listUpcoming(appConfig, 2), ['キーワードA', 'キーワードC'], 'must return only 書く candidates in row order, capped at the limit');
  assert.deepStrictEqual(listUpcoming(appConfig, 0), [], 'a zero limit must return no candidates');
  assert.deepStrictEqual(listUpcoming(appConfig, 10), ['キーワードA', 'キーワードC', 'キーワードD'], 'a limit larger than available candidates must return them all');
}

// --- 4) Client wiring: dashboard lists and their render function must exist ---
assert.ok(webHtml.includes('id="dashboardPostedList"'), 'posted-list element is missing');
assert.ok(webHtml.includes('id="dashboardUpcomingList"'), 'upcoming-list element is missing');
assert.ok(webHtml.includes('function renderAutomaticPostingArticleLists(settings)'), 'article-list renderer is missing');
assert.ok(webHtml.includes('renderAutomaticPostingArticleLists(settings);'), 'renderer must be called from renderAutomaticPostingSettings');

// --- 5) Topbar notice must track the global active job, not just the currently loaded article,
//        and must revert once the job it was showing stops — otherwise it freezes on the last
//        article being processed even after automation moves on to the next one.
assert.ok(!webHtml.includes('isWatchingActiveJob'), 'the loaded-article match gate must be removed so the notice always reflects the live global job');
assert.ok(webHtml.includes("notice.dataset.autoWatch = '1';"), 'the live-notice writer must mark ownership of the notice');
assert.ok(
  webHtml.includes("} else if (notice && notice.dataset.autoWatch === '1' && !window.uaCurrentOperationToken) {"),
  'the notice must be released back to neutral once no job is active, instead of staying frozen'
);

// --- 7) The 詳細編集 form must auto-load the active/stopped job's article so
//        it stays in sync with the dashboard notice, instead of staying
//        empty until the user manually presses "処理中の記事を表示".
//        Confirmed live 2026-08-30: a user edited 案件注意点 on an unloaded
//        form (row was blank) after seeing the dashboard's stopped-job
//        notice, and the edit had nowhere to save. Must still avoid
//        clobbering a different article the user has open, and avoid firing
//        while a save is in flight.
assert.ok(webHtml.includes('function maybeSyncActiveArticleIntoForm(settings)'), 'the active-article auto-sync function is missing');
assert.ok(webHtml.includes('maybeSyncActiveArticleIntoForm(settings);'), 'renderAutomaticPostingSettings must call the auto-sync function');
assert.ok(
  webHtml.includes('if (autoSavePending || autoSaveInFlight || isFillingForm) return;'),
  'auto-sync must not fire while a save is pending/in-flight or the form is already being filled'
);
assert.ok(
  webHtml.includes('if (rowLoaded && currentMainInput && currentMainInput !== settings.activeKeyword) {'),
  'auto-sync must not clobber a different article the user already has open'
);

// --- 6) The topbar notice must distinguish a genuinely running job from one
//        stopped on an NG (activeJobStatus === 'error'), instead of showing
//        the same pulsing "進行中" banner with a live-updating timestamp for
//        both. Confirmed live 2026-08-30: a job stopped on an NG kept
//        showing "自動投稿が進行中です" indefinitely, making it impossible to
//        tell from this banner alone that nothing was actually happening.
assert.ok(
  webHtml.includes("if (settings.activeJobStatus === 'error') {") &&
  webHtml.includes("notice.textContent = '自動投稿は停止中です: '") &&
  webHtml.includes("notice.className = 'status error';"),
  'the live notice must switch to a stopped/error state when the active job has errored, not stay on the working banner'
);

console.log('dashboard today-articles + live-notice tests passed.');
