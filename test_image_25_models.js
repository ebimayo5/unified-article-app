const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const read = name => fs.readFileSync('unified_article_app/' + name, 'utf8');
const fn = (file, name) => {
  const source = read(file);
  const start = source.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name);
  const end = source.indexOf('\n}', start);
  assert.ok(end > start, name);
  return source.slice(start, end + 2);
};
const props = {};
let calls = [];
let status = 200;
let responseBody = {data: [{b64_json: 'aW1hZ2U='}]};
const ctx = vm.createContext({
  PropertiesService: {getScriptProperties: () => ({getProperty: k => props[k] || null})},
  uaGetOpenAiApiKey_: () => 'test-only-placeholder',
  Utilities: {base64Decode: s => Array.from(Buffer.from(s, 'base64'))},
  UrlFetchApp: {fetch: (url, options) => {
    calls.push({url, payload: JSON.parse(options.payload)});
    return {getResponseCode: () => status, getContentText: () => JSON.stringify(responseBody)};
  }}
});
vm.runInContext(read('config.gs') + '\n' + fn('main.gs', 'uaGetOpenAiImageModel_') + '\n' + fn('api.gs', 'uaCallOpenAiImage_'), ctx);
const run = source => vm.runInContext(source, ctx);
const sunburst = 'gpt-image-2.5-sunburst';
const flare = 'gpt-image-2.5-flare';
assert.equal(run('UA_DEFAULT_OPENAI_IMAGE_MODEL'), sunburst);
for (const legacy of [undefined, '', 'gpt-image-1', 'gpt-image-1.5', 'gpt-image-2']) {
  props.OPENAI_IMAGE_MODEL = legacy;
  assert.equal(run('uaGetOpenAiImageModel_()'), sunburst);
  assert.equal(props.OPENAI_IMAGE_MODEL, legacy, 'read must not mutate stored settings');
}
for (const selected of [sunburst, flare, 'gpt-image-2.5-sunburst-2026-09-08']) {
  props.OPENAI_IMAGE_MODEL = selected;
  calls = [];
  const result = run('uaCallOpenAiImage_("test prompt")');
  assert.equal(result.model, selected);
  assert.equal(result.contentType, 'image/png');
  assert.deepEqual(Array.from(result.bytes), Array.from(Buffer.from('image')));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.openai.com/v1/images/generations');
  assert.deepEqual(calls[0].payload, {model: selected, prompt: 'test prompt', n: 1, size: '1536x1024', quality: 'high'});
}
assert.deepEqual(JSON.parse(run('JSON.stringify(UA_OPENAI_IMAGE_MODEL_OPTIONS.map(x => x.value))')), [sunburst, flare]);
status = 403;
calls = [];
assert.throws(() => run('uaCallOpenAiImage_("test")'), /OpenAI Images API/);
assert.equal(calls.length, 1, 'no retry or silent model fallback');
status = 200;
responseBody = {data: []};
assert.throws(() => run('uaCallOpenAiImage_("test")'), /画像データ/);
for (const panel of ['app_panel.html', 'ua_web_app.html']) {
  assert.ok(read(panel).includes("|| '" + sunburst + "'"));
  assert.ok(!read(panel).includes("|| 'gpt-image-2'"));
}
console.log('PASS: Image 2.5 defaults, migration, selection, API contract, errors and panels (mock only)');
