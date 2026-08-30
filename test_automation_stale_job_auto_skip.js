const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const configSource = fs.readFileSync(path.join(__dirname, 'unified_article_app', 'config.gs'), 'utf8');
const utilsSource = fs.readFileSync(path.join(__dirname, 'unified_article_app', 'utils.gs'), 'utf8');
const articleSource = fs.readFileSync(path.join(__dirname, 'unified_article_app', 'article.gs'), 'utf8');
const automationSource = fs.readFileSync(path.join(__dirname, 'unified_article_app', 'automation.gs'), 'utf8');

const context = { console };
vm.createContext(context);
vm.runInContext(configSource, context);
vm.runInContext(utilsSource, context);
vm.runInContext(articleSource, context);
vm.runInContext(automationSource, context);

const UA_APP_TYPES = vm.runInContext('UA_APP_TYPES', context);
const homeConfig = UA_APP_TYPES.home;

// This suite covers the fix for a real 2026-08-30 incident: たくみパパ's automatic
// posting queue stayed blocked because a single article's OpenAI background call
// kept hanging for the full 6-minute Apps Script execution limit, every time a
// human resumed it from the panel after the 20-minute stale-job safety stop. The
// stale-job guard had no way to tell "this keeps failing the same way" from "this
// is a one-off" -- it just re-armed and waited for another manual click each time.
// Fix: track consecutive stale timeouts on the same job/step and auto-skip after
// a repeat, instead of leaving the queue blocked indefinitely on manual retries.

function makeJob(overrides) {
  const staleStart = new Date(Date.now() - 25 * 60 * 1000).toISOString();
  return Object.assign({
    runId: 'job-1',
    date: '2026-08-30',
    status: 'running',
    step: 'article',
    appType: 'home',
    sheetName: 'たくみパパ',
    row: 55,
    keyword: 'ソファー 寿命 ニトリ',
    stepStartedAt: staleStart,
    updatedAt: staleStart,
    startedAt: staleStart,
    lastError: '',
    manualBatch: false
  }, overrides || {});
}

function withStubs(fn) {
  const calls = { skip: 0, skipMessage: '', saved: [], notifications: [] };
  context.uaGetAutomationAppConfig_ = function() { return homeConfig; };
  context.uaCancelAutomaticPostingBackgroundWork_ = function() { return null; };
  context.uaTryMarkAutomaticPostingRowStopped_ = function() {};
  context.uaWriteAutomaticPostingStatus_ = function() {};
  context.uaSendAutomaticPostingErrorNotification_ = function(job, appConfig, message) {
    calls.notifications.push(message);
  };
  context.uaSaveAutomaticPostingJob_ = function(job) { calls.saved.push(Object.assign({}, job)); };
  context.uaSkipAutomaticPostingJob_ = function(job, appConfig, message) {
    calls.skip++;
    calls.skipMessage = message;
    job.status = 'complete';
  };
  fn(calls, vm.runInContext('uaMarkStaleAutomaticPostingJobError_', context));
}

// 1) First stale timeout on a job: still just marks status='error' and waits for
// a human, exactly like before this fix -- no behavior change for a genuine
// one-off hang.
withStubs(function(calls, uaMarkStaleAutomaticPostingJobError_) {
  const job = makeJob({ staleTimeoutCount: 0 });
  const result = uaMarkStaleAutomaticPostingJobError_(job);
  assert.strictEqual(result.status, 'error', '1回目のハングはエラー停止のまま（従来通り）');
  assert.strictEqual(result.staleTimeoutCount, 1, 'ハング回数が1回として記録される');
  assert.strictEqual(calls.skip, 0, '1回目では自動スキップしない');
});

// 2) Second consecutive stale timeout on the same job/step (a human already
// resumed it once and it hung again): auto-skip instead of erroring and
// waiting for a third manual attempt.
withStubs(function(calls, uaMarkStaleAutomaticPostingJobError_) {
  const job = makeJob({ staleTimeoutCount: 1 });
  const result = uaMarkStaleAutomaticPostingJobError_(job);
  assert.strictEqual(calls.skip, 1, '2回連続のハングでは自動スキップ処理が呼ばれる');
  assert.strictEqual(result.status, 'complete', 'スキップ後はcompleteとして扱われる（手動の対象外操作と同じ経路）');
  assert.ok(calls.notifications.length === 1 && /自動/.test(calls.notifications[0]), '自動スキップした旨の通知が送られる');
});

// 3) A job that is not actually running (already 'error' or 'complete') is left
// untouched -- this guard only ever fires on a currently-running job.
withStubs(function(calls, uaMarkStaleAutomaticPostingJobError_) {
  const job = makeJob({ status: 'error', staleTimeoutCount: 1 });
  uaMarkStaleAutomaticPostingJobError_(job);
  assert.strictEqual(calls.skip, 0, 'すでにエラー停止中のジョブには手を出さない');
});

// 4) uaAdvanceAutomaticPostingJob_ resets the counter on genuine step progress
// (the ARTICLE step finally succeeded and moved on to PRODUCT_LINKS) -- a past
// hang on an earlier step must not count against a later, unrelated step.
{
  context.uaScheduleAutomaticPostingWorker_ = function() {};
  context.uaSaveAutomaticPostingJob_ = function() {};
  const job = makeJob({ step: 'article', staleTimeoutCount: 1 });
  vm.runInContext('uaAdvanceAutomaticPostingJob_', context)(job, 'product_links', 1000);
  assert.strictEqual(job.staleTimeoutCount, 0, '工程が実際に進んだらハング回数はリセットされる');
}

// 5) uaAdvanceAutomaticPostingJob_ must NOT reset the counter when rescheduling
// the SAME step (e.g. WAIT_TREFAI's normal polling loop) -- only real forward
// progress counts as "it didn't hang this time."
{
  context.uaScheduleAutomaticPostingWorker_ = function() {};
  context.uaSaveAutomaticPostingJob_ = function() {};
  const job = makeJob({ step: 'wait_trefai', staleTimeoutCount: 1 });
  vm.runInContext('uaAdvanceAutomaticPostingJob_', context)(job, 'wait_trefai', 60000);
  assert.strictEqual(job.staleTimeoutCount, 1, '同じ工程内のポーリングではハング回数を維持する（誤ってリセットしない）');
}

console.log('Automation stale-job auto-skip: OK');
