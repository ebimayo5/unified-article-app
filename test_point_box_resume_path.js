const fs = require('fs'), vm = require('vm'), assert = require('assert');
const source = fs.readFileSync(__dirname + '/unified_article_app/pre_publish_check.gs', 'utf8');

function scenario(options = {}) {
  const calls = [], bodyWrites = [];
  let body = options.body;
  const report = '【公開前チェック】\n判定\n\n【公開前チェック修正（1回）】\n実行: 2026-10-11\n';
  const sheet = {
    getActiveCell: () => ({ getRow: () => 2 }),
    getRange: (r, c) => ({ setValue: (v) => { if (c === 6) { body = v; bodyWrites.push(v); } } })
  };
  const stubs = {
    console, UA_COLUMNS: { body: 6 },
    uaGetSheetForData_: () => sheet,
    uaBuildRowData_: () => ({ appType: 'テスト', body, factCheckPoints: report }),
    uaSaveActiveRowData: () => {},
    uaGetAppConfigByLabel_: () => ({ swell: true }),
    uaUsesSwellBlocks_: (c) => !!(c && c.swell),
    uaGetPrePublishBackgroundStateKey_: () => 'bg', uaGetPrePublishCompletedStateKey_: () => 'done',
    uaLoadPrePublishCompletedFingerprint_: () => '',
    uaBuildPrePublishRevisionFingerprint_: () => 'fp',
    uaSavePrePublishCompletedFingerprint_: () => {}, uaClearPrePublishCompletedFingerprint_: () => {},
    uaClearPrePublishBackgroundState_: () => {},
    uaBuildPrePublishRuleCheck_: (row) => ({ critical: String(row.body).indexOf('article-compass-point-box') !== -1 ? [] : ['「この記事のポイント」がSWELL対応形式で見つかりません。'] }),
    uaStartOpenAiBackgroundJson_: () => { calls.push('OPENAI'); throw new Error('OpenAIを呼んではいけない'); },
    SpreadsheetApp: { flush: () => {} }
  };
  const ctx = { ...stubs };
  vm.createContext(ctx); vm.runInContext(source, ctx); Object.assign(ctx, stubs);
  let result, error;
  try { result = ctx.uaApplyPrePublishFixesOnceFromPanel({ row: 2 }); } catch (e) { error = e; }
  return { calls, bodyWrites, result, error, body };
}

const legacy = [
  '<!-- wp:paragraph --><p>導入</p><!-- /wp:paragraph -->',
  '<!-- wp:html -->',
  '<div style="border-left:6px solid #f5a623;"><p style="font-weight:bold;">この記事のポイント</p>',
  '<ul><li><strong style="color:#d32f2f;">基礎講習</strong>は受験資格の代わり</li><li>オンライン受講もできる</li></ul></div>',
  '<!-- /wp:html -->',
  '<!-- wp:heading --><h2 class="wp-block-heading">違い</h2><!-- /wp:heading -->',
  '<!-- wp:paragraph --><p>' + 'あ'.repeat(3000) + '</p><!-- /wp:paragraph -->'
].join('\n');

// 1) 再開(保存済みの修正結果あり): AIを使わずに変換し、本文を保存し、NGが解消して正常終了する
const resumed = scenario({ body: legacy });
assert.ifError(resumed.error);
assert.deepEqual(resumed.calls, []);
assert.equal(resumed.bodyWrites.length, 1);
assert(resumed.body.includes('article-compass-point-box'));
assert(resumed.body.includes('<strong style="color:#d32f2f;">基礎講習</strong>は受験資格の代わり'));
assert(/OpenAIへの再送信は行っていません/.test(resumed.result.message));

// 2) すでに標準形の本文は書き込まない(冪等)
const already = scenario({ body: resumed.body });
assert.ifError(already.error);
assert.equal(already.bodyWrites.length, 0);

// 3) 変換できない本文(枠なし)は、従来どおりNGで停止し、書き込みもしない
const noBox = scenario({ body: '<!-- wp:paragraph --><p>枠のない本文</p><!-- /wp:paragraph -->' });
assert(noBox.error && /NGが1件残っている/.test(noBox.error.message));
assert.equal(noBox.bodyWrites.length, 0);
assert.deepEqual(noBox.calls, []);

console.log('PASS: 再開経路でもポイント枠をAIなしで標準形へ変換して保存し、NGが解消。標準形は書き込まない。枠なしは従来どおり停止。');
