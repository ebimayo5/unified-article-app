const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sleeps = [];
const responses = [];
const context = {
  console,
  Utilities: {
    base64Encode(value) { return Buffer.from(value).toString('base64'); },
    sleep(milliseconds) { sleeps.push(milliseconds); }
  },
  UrlFetchApp: {
    fetch() {
      const next = responses.shift();
      if (!next) throw new Error('Unexpected WordPress request');
      return {
        getResponseCode: () => next.status,
        getContentText: () => next.text
      };
    }
  }
};
vm.createContext(context);
vm.runInContext(
  fs.readFileSync(path.join(__dirname, 'unified_article_app', 'wordpress.gs'), 'utf8'),
  context
);

function queue(status, text) {
  responses.push({ status, text });
}

const config = {
  siteUrl: 'https://example.test',
  username: 'user',
  appPassword: 'password'
};

// A temporary maintenance page during a tag lookup should be retried without
// consuming an automation run or creating a duplicate tag.
queue(503, 'Briefly unavailable for scheduled maintenance.');
queue(200, '[{"id":12,"name":"カーナビ"}]');
const tagLookup = context.uaCallWordPressApi_(
  config,
  '/wp-json/wp/v2/tags?search=%E3%82%AB%E3%83%BC%E3%83%8A%E3%83%93',
  'get'
);
assert.strictEqual(tagLookup[0].id, 12, '503後のタグ確認は成功レスポンスを返す');
assert.deepStrictEqual(sleeps, [3000], '一時的な503では3秒待って1回だけ再試行する');

// Writes remain single-shot. A 503 after a POST is ambiguous, so the caller
// must use its existing exact-name reconciliation instead of resending it.
queue(503, 'Briefly unavailable for scheduled maintenance.');
assert.throws(
  () => context.uaCallWordPressApi_(config, '/wp-json/wp/v2/tags', 'post', { name: 'カーナビ' }),
  /HTTP 503/,
  'タグ作成POSTを自動再送しない'
);
assert.strictEqual(responses.length, 0, 'POSTの503は追加リクエストを発生させない');

console.log('WordPress transient read retry tests passed');
