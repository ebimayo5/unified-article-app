const assert = require('assert');
const fs = require('fs');

const automation = fs.readFileSync('unified_article_app/automation.gs', 'utf8');
const webHtml = fs.readFileSync('unified_article_app/ua_web_app.html', 'utf8');
const panelHtml = fs.readFileSync('unified_article_app/app_panel.html', 'utf8');

assert.doesNotThrow(() => new Function(automation), 'automation.gs must remain valid JavaScript');

[webHtml, panelHtml].forEach((html, index) => {
  const label = index === 0 ? 'ua_web_app.html' : 'app_panel.html';
  assert.ok(html.includes('id="autoPostingImmediateCount"'), label + ': immediate count selector is missing');
  assert.ok(html.includes('id="autoPostingStartNowButton"'), label + ': start-now button is missing');
  assert.ok(html.includes('function startAutomaticPostingNow(button)'), label + ': start-now handler is missing');
  assert.ok(html.includes('.uaStartAutomaticPostingNowFromPanel(appType, articleCount);'), label + ': server call is missing');
  assert.ok(html.includes('1回限りの開始です。毎日の時刻・記事数・ON/OFFは変更しません。'), label + ': one-time behavior note is missing');
});

assert.ok(automation.includes("const UA_AUTOMATION_MANUAL_BATCH_PROPERTY = 'UA_AUTOMATION_MANUAL_BATCH';"), 'manual batch property is missing');
assert.ok(automation.includes('function uaStartAutomaticPostingNowFromPanel(appType, articleCount)'), 'manual start endpoint is missing');
assert.ok(automation.includes('requestedCount < 1 || requestedCount > 5'), 'manual article count guard is missing');
assert.ok(automation.includes('uaHasBlockingAutomaticPostingJob_(activeJob)'), 'blocking job guard is missing');
assert.ok(automation.includes('if (!settings.enabled && !isManualStart) return false;'), 'one-time start must work without changing daily ON/OFF');
assert.ok(automation.includes('manualBatch: isManualStart'), 'manual jobs must be marked for safe resume');
assert.ok(automation.includes('uaRestoreAutomaticPostingManualBatchArticle_'), 'skipped manual articles must be replaced');
assert.ok(automation.includes('if (manualBatch && Number(manualBatch.remaining) > 0) return true;'), 'remaining manual articles must continue sequentially');
assert.ok(automation.includes("const UA_AUTOMATION_STEP_PRODUCT_LINKS = 'product_links';"), 'product-link guarantee step is missing');
assert.ok(
  automation.includes('uaAdvanceAutomaticPostingJob_(job, UA_AUTOMATION_STEP_PRODUCT_LINKS, 60000);'),
  'every article must advance through the product-link guarantee step'
);
assert.ok(
  automation.includes('if (job.step === UA_AUTOMATION_STEP_PRODUCT_LINKS)') &&
  automation.includes('uaEnsureAutomaticProductLinksForData_(Object.assign({}, data, { automaticPosting: true }));'),
  'saved and resumed bodies must run the idempotent product-link guarantee'
);
assert.ok(
  automation.includes('const finalWpData = uaGetAutomaticPostingRowData_(job);'),
  'final WordPress sync must reload the body after the product-link guarantee'
);

console.log('manual automation batch tests: OK');
