const assert = require('assert');
const fs = require('fs');

const webHtml = fs.readFileSync('C:/Users/ebima/Documents/Codex/ua_web_app_panel_button.html', 'utf8');
const panelHtml = fs.readFileSync('C:/Users/ebima/Documents/Codex/app_panel_button.html', 'utf8');
const automation = fs.readFileSync('C:/Users/ebima/Documents/Codex/automation_panel_button.gs', 'utf8');

[webHtml, panelHtml].forEach((html, index) => {
  const label = index === 0 ? 'ua_web_app.html' : 'app_panel.html';
  assert.ok(html.includes('id="autoPostingOpenArticleButton"'), label + ': open button is missing');
  assert.ok(html.includes('>処理中の記事を表示</button>'), label + ': button label is missing');
  assert.ok(html.includes('function loadActiveAutomaticPostingArticle(button)'), label + ': click handler is missing');
  assert.ok(html.includes('.uaGetActiveAutomaticPostingArticleFromPanel(appType);'), label + ': server call is missing');
  assert.ok(html.includes("openArticleButton.classList.toggle('hidden', !settings.activeKeyword)"), label + ': visibility rule is missing');
});

assert.ok(automation.includes('function uaGetActiveAutomaticPostingArticleFromPanel(appType)'), 'server loader is missing');
assert.ok(automation.includes("String(job.status || '') === 'complete'"), 'completed jobs must be rejected');
assert.ok(automation.includes('uaGetAutomaticPostingRowData_(job)'), 'active job row must be loaded without regeneration');

console.log('active automation panel tests: OK');
