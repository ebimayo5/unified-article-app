const assert = require('assert');
const fs = require('fs');

const automation = fs.readFileSync('unified_article_app/automation.gs', 'utf8');

new Function(automation);

// トレファイブリッジをOFFにした後は、既にwait_trefaiに入っているジョブも
// トレファイの完了を待ち続けず、その場でSerper/GAS検索経由の構成作成へ進む必要がある。
const norm = (s) => s.replace(/\s+/g, ' ');

const waitStepStart = automation.indexOf('const trefai = uaIsTrefaiBridgeEnabled_()');
const waitStepEnd = automation.indexOf('if (job.step === UA_AUTOMATION_STEP_ARTICLE)', waitStepStart);
const waitStepBody = norm(automation.slice(waitStepStart, waitStepEnd));

assert(waitStepStart >= 0 && waitStepEnd > waitStepStart, 'wait_trefai step handler not found');
assert(
  waitStepBody.includes(norm('uaIsTrefaiBridgeEnabled_() ? uaGetLatestTrefaiJobStatus_')),
  'wait_trefai must only poll the Trefai queue when the bridge is enabled'
);
assert(
  waitStepBody.includes(norm(': { status: UA_TREFAI_STATUS_DONE, competitorUrls: [], competitorPages: [] }')),
  'wait_trefai must synthesize an immediate DONE status when the bridge is disabled, instead of polling forever'
);
assert(
  waitStepBody.includes('uaStartArticleStructureBackgroundForRow_('),
  'The disabled-bridge fallback must reuse the same background structure generator as the completed-Trefai path'
);
assert(
  waitStepBody.includes(norm("(trefai.competitorUrls || []).length ? 'トレファイURLを使って記事構成を作成しました。' : '記事構成を作成しました。'")),
  'The completion message must not claim Trefai URLs were used when there are none'
);

// ステップ表示名も、ブリッジが無効な間は「トレファイ待ち」と表示しないこと
const labelStart = automation.indexOf('function uaGetAutomaticPostingStepLabel_');
const labelEnd = automation.indexOf('\n}', labelStart);
const labelBody = norm(automation.slice(labelStart, labelEnd));
assert(
  labelBody.includes(norm("uaIsTrefaiBridgeEnabled_() ? 'トレファイ待ち' : '競合URL取得・構成案作成中'")),
  'The step label must reflect whether the Trefai bridge is currently enabled'
);

console.log('Trefai-bridge-disabled fallback tests passed.');
