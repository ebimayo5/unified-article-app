const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const configSource = fs.readFileSync(path.join(__dirname, 'unified_article_app', 'config.gs'), 'utf8');
const automationSource = fs.readFileSync(path.join(__dirname, 'unified_article_app', 'automation.gs'), 'utf8');

const context = { console };
vm.createContext(context);
vm.runInContext(configSource, context);
vm.runInContext(automationSource, context);

// Regression for the normal overlap case: DRIVE BASE can still be running when
// たくみパパ's daily starter fires. The starter safely returns while the DRIVE
// job owns the single worker chain; once DRIVE completes, the common completion
// path must regard the still-unconsumed home quota as eligible and hand off to it.
context.Utilities = {
  formatDate: function(date, timezone, pattern) {
    return pattern === 'H' ? '10' : '2026-08-31';
  }
};
context.uaGetAutomaticPostingManualBatch_ = function() { return null; };
context.uaReadAutomaticPostingSettings_ = function(key) {
  return { enabled: true, hour: key === 'home' ? 5 : 4, dailyLimit: 3 };
};
context.uaGetAutomaticPostingDailyProgress_ = function(date, key) {
  return { date: date, count: key === 'drive' ? 3 : 0 };
};

const eligible = Array.from(vm.runInContext('uaGetEligibleAutomationAppKeys_', context)());
assert.deepStrictEqual(
  eligible,
  ['home'],
  'DRIVE BASEの当日枠完了後は、開始時刻を過ぎた未消化のたくみパパだけが次の対象になる'
);

let scheduledDelay = 0;
context.uaSaveAutomaticPostingJob_ = function() {};
context.uaGetAutomationAppConfig_ = function() { return { key: 'drive', label: 'DRIVE BASE' }; };
context.uaWriteAutomaticPostingStatus_ = function() {};
context.uaAppendAutomaticPostingDailyLog_ = function() {};
context.uaGetEligibleAutomationAppKeys_ = function() { return ['home']; };
context.uaScheduleNextAutomaticPosting_ = function(delayMs) { scheduledDelay = delayMs; };

vm.runInContext('uaCompleteAutomaticPostingJob_', context)({
  status: 'running',
  step: 'publish',
  appType: 'DRIVE BASE',
  keyword: 'ディフェンダー 後悔',
  manualBatch: false
}, '完了（WordPress公開）');
assert.strictEqual(
  scheduledDelay,
  60000,
  'DRIVE BASE完了後は、たくみパパ開始確認を1本だけ60秒後に予約する'
);

const startedKeys = [];
context.uaDeleteAutomaticPostingTriggers_ = function() {};
context.uaGetEligibleAutomationAppKeys_ = function() { return ['home']; };
context.uaStartAutomaticPostingForSite_ = function(key) {
  startedKeys.push(key);
  return true;
};
vm.runInContext('uaStartNextAutomaticPosting', context)();
assert.deepStrictEqual(startedKeys, ['home'], '次記事確認はたくみパパを1回だけ開始する');

console.log('Cross-site automation handoff: OK');
