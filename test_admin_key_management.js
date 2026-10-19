const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const crypto = require('crypto');

const source = fs.readFileSync('unified_article_app/ua_admin.gs', 'utf8');
const script = new vm.Script(source);
const scriptProps = new Map();
const userProps = new Map();
const sent = [];
let active = '';
let effective = 'owner@example.com';
let now = 1000000;
let uuid = 0;
const props = map => ({
  getProperty: key => map.get(key) || null,
  setProperty: (key, value) => { map.set(key, value); return null; },
  deleteProperty: key => { map.delete(key); return null; },
  setProperties: values => { Object.entries(values).forEach(([key, value]) => map.set(key, value)); return null; }
});
const context = {
  Session: {
    getActiveUser: () => ({ getEmail: () => active }),
    getEffectiveUser: () => ({ getEmail: () => effective })
  },
  PropertiesService: {
    getScriptProperties: () => props(scriptProps),
    getUserProperties: () => props(userProps)
  },
  LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
  MailApp: { sendEmail: message => sent.push(message) },
  Utilities: {
    DigestAlgorithm: { SHA_256: 'sha256' },
    Charset: { UTF_8: 'utf8' },
    computeDigest: (_algorithm, text) => [...crypto.createHash('sha256').update(text).digest()],
    base64EncodeWebSafe: bytes => Buffer.from(bytes).toString('base64url'),
    getUuid: () => (++uuid).toString(16).padStart(32, 'a')
  },
  Date: class extends Date { static now() { return now; } }
};
vm.createContext(context);
script.runInContext(context);

assert.throws(() => context.uaAdminSerpApiStatus(), /所有者/);
assert.throws(() => context.uaAdminRequestSerpApiCode(), /所有者/);
assert.throws(() => context.uaAdminSaveSerpApiKey('a'.repeat(40), 'AAAAAAAAAA'), /所有者/);
active = 'visitor@example.com';
assert.throws(() => context.uaAdminRequestSerpApiCode(), /所有者/);
active = 'owner@example.com';
assert.strictEqual(context.uaAdminSerpApiStatus().configured, false);
context.uaAdminRequestSerpApiCode();
assert.strictEqual(sent.length, 1);
assert.strictEqual(sent[0].to, active);
assert.throws(() => context.uaAdminRequestSerpApiCode(), /1分後/);
const code = sent[0].body.match(/([A-F0-9]{10})/)[1];
assert.throws(() => context.uaAdminSaveSerpApiKey('a'.repeat(40), 'FFFFFFFFFF'), /一致しません/);
assert.strictEqual(scriptProps.size, 0);
const saved = context.uaAdminSaveSerpApiKey('a'.repeat(40), code);
assert.strictEqual(saved.suffix, 'aaaa');
assert.strictEqual(scriptProps.get('UA_SERPAPI_API_KEY'), 'a'.repeat(40));
assert.throws(() => context.uaAdminSaveSerpApiKey('b'.repeat(40), code), /無効/);
now += 60001;
context.uaAdminRequestSerpApiCode();
now += 300001;
const expired = sent[1].body.match(/([A-F0-9]{10})/)[1];
assert.throws(() => context.uaAdminSaveSerpApiKey('b'.repeat(40), expired), /期限切れ/);
assert.strictEqual(scriptProps.get('UA_SERPAPI_API_KEY'), 'a'.repeat(40));
console.log('admin key management security checks passed');
