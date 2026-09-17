const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const source = fs.readFileSync('unified_article_app/api.gs', 'utf8');
for (const [status, body, code] of [
  [429, { error: { message: 'provider-private-message' } }, 'http_429'],
  [200, { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output_text: '{}' }, 'output_token_limit'],
  [200, { status: 'completed', output_text: '' }, 'empty_response'],
  [200, { status: 'completed', output_text: '{broken' }, 'invalid_json'],
  [200, { status: 'completed', output_text: '{"ok":true}' }, null]
]) {
  let calls = 0;
  const context = {
    uaGetOpenAiApiKey_: () => 'test-only', uaGetOpenAiModel_: () => 'configured-model',
    uaStripJsonFence_: t => t,
    UrlFetchApp: { fetch: (url, options) => {
      calls++;
      assert.strictEqual(JSON.parse(options.payload).max_output_tokens, 1800);
      return { getResponseCode: () => status, getContentText: () => JSON.stringify(body) };
    } }
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  if (code) assert.throws(() => context.uaCallOpenAiJson_('test', 1800), e => e.productDiagnosticCode === code);
  else assert.strictEqual(context.uaCallOpenAiJson_('test', 1800).data.ok, true);
  assert.strictEqual(calls, 1, 'JSON/出力上限/HTTP失敗でも自動再送しない');
}
console.log('Product AI diagnostics tests passed');
