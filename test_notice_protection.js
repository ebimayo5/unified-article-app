const assert = require('assert');
const fs = require('fs');
const path = require('path');
['ua_web_app.html', 'app_panel.html'].forEach((fileName) => {
  const html = fs.readFileSync(path.join(__dirname, 'unified_article_app', fileName), 'utf8');
  assert.ok(html.includes('id="autoSaveIndicator"'), fileName + ': save indicator is missing');
  assert.ok(html.includes('class="auto-save-spinner"'), fileName + ': spinning save icon is missing');
  assert.ok(html.includes("setAutoSaveIndicator('saving')"), fileName + ': autosave must show the side indicator');
  assert.ok(html.includes("setAutoSaveIndicator('saved')"), fileName + ': autosave completion must update the side indicator');
  assert.ok(html.includes('function setAutoSaveIndicator(state)'), fileName + ': save indicator controller is missing');
  assert.ok(/\.status\s*\{[^}]*white-space:\s*pre-line/s.test(html), fileName + ': multiline action messages must remain readable');
  assert.ok(!html.includes("setNotice('自動保存中...'"), fileName + ': autosave start must not use the notice area');
  assert.ok(!html.includes("setNotice('自動保存しました。'"), fileName + ': autosave completion must not use the notice area');
});

console.log('autosave indicator tests: OK (16 checks)');
