const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

['ua_web_app.html', 'app_panel.html'].forEach((fileName) => {
  const html = fs.readFileSync(path.join(__dirname, 'unified_article_app', fileName), 'utf8');
  const start = html.indexOf('function setNotice(message, isError, source)');
  const end = html.indexOf('\n      function ', start + 20);
  assert.ok(start >= 0 && end > start, fileName + ': protected setNotice function is missing');
  assert.ok(html.includes("setNotice('自動保存中...', false, 'autosave')"), fileName + ': autosave start must be non-destructive');
  assert.ok(html.includes("setNotice('自動保存しました。', false, 'autosave')"), fileName + ': autosave completion must be non-destructive');
  assert.ok(/\.status\s*\{[^}]*white-space:\s*pre-line/s.test(html), fileName + ': multiline result messages must remain readable');

  let now = 1000;
  const notice = { textContent: '', className: '' };
  const context = {
    document: { getElementById: () => notice },
    Date: { now: () => now },
    noticeAutoSaveBlockedUntil: 0
  };
  vm.createContext(context);
  vm.runInContext('var noticeAutoSaveBlockedUntil = 0;\n' + html.slice(start, end), context);

  context.setNotice('商品リンクは追加しませんでした。\n理由: 候補なし', false);
  context.setNotice('自動保存しました。', false, 'autosave');
  assert.ok(notice.textContent.startsWith('商品リンクは追加しませんでした。'), fileName + ': autosave overwrote the Rinker result');

  now += 11000;
  context.setNotice('自動保存しました。', false, 'autosave');
  assert.strictEqual(notice.textContent, '自動保存しました。', fileName + ': autosave notice should recover after protection expires');
});

console.log('notice protection tests: OK (12 checks)');
