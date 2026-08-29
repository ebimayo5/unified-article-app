const assert = require('assert');
const fs = require('fs');
const crypto = require('crypto');

const config = fs.readFileSync('unified_article_app/config.gs', 'utf8');
const prePublish = fs.readFileSync('unified_article_app/pre_publish_check.gs', 'utf8');

function makeUtilitiesMock() {
  return {
    DigestAlgorithm: { SHA_256: 'SHA_256' },
    Charset: { UTF_8: 'UTF_8' },
    computeDigest: (algorithm, value) => {
      const buf = crypto.createHash('sha256').update(String(value), 'utf8').digest();
      const out = [];
      for (let i = 0; i < buf.length; i++) {
        const byte = buf[i];
        out.push(byte > 127 ? byte - 256 : byte);
      }
      return out;
    }
  };
}

function makePropertiesServiceMock(initial) {
  const store = Object.assign({}, initial);
  return {
    getScriptProperties: () => ({
      getProperty: (key) => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null),
      setProperty: (key, value) => { store[key] = String(value); },
      deleteProperty: (key) => { delete store[key]; },
      getProperties: () => Object.assign({}, store)
    }),
    _store: store
  };
}

function makeSheetMock(name, spreadsheetId, statusByRow) {
  const maxRow = Math.max.apply(null, Object.keys(statusByRow).map(Number).concat([1]));
  return {
    getName: () => name,
    getParent: () => ({ getId: () => spreadsheetId }),
    getLastRow: () => maxRow,
    getRange: (r, c, numRows, numCols) => ({
      getValues: () => {
        const out = [];
        for (let i = 0; i < (numRows || 1); i++) {
          out.push([statusByRow[r + i] || '']);
        }
        return out;
      }
    })
  };
}

function loadModule(utilities, propertiesService, sheetsByName) {
  const moduleBox = { exports: {} };
  const spreadsheetApp = {
    getActiveSpreadsheet: () => ({
      getSheetByName: (name) => sheetsByName[name] || null
    })
  };

  new Function(
    'PropertiesService',
    'Utilities',
    'SpreadsheetApp',
    'Logger',
    'module',
    config + '\n' + prePublish + `
module.exports = {
  clearForRow: uaClearPrePublishCompletedStateForRow_,
  cleanup: uaCleanupPublishedPrePublishState,
  keyFor: uaGetPrePublishCompletedStateKey_
};
`
  )(propertiesService, utilities, spreadsheetApp, { log: () => {} }, moduleBox);

  return moduleBox.exports;
}

// 1) 公開時に該当行のUA_PREPUB_DONE_*だけが消える
{
  const utilities = makeUtilitiesMock();
  const sheet = makeSheetMock('DRIVE BASE', 'ss-1', { 5: '投稿済み' });
  const mod = loadModule(utilities, makePropertiesServiceMock({}), { 'DRIVE BASE': sheet });
  const key = mod.keyFor(sheet, 5);
  const props = makePropertiesServiceMock({ [key]: 'fingerprint-abc', OTHER_KEY: 'keep-me' });
  const mod2 = loadModule(utilities, props, { 'DRIVE BASE': sheet });

  mod2.clearForRow(sheet, 5);
  assert.strictEqual(props._store[key], undefined, 'The row-specific fingerprint must be deleted');
  assert.strictEqual(props._store.OTHER_KEY, 'keep-me', 'Unrelated properties must be untouched');
}

// 2) 一括掃除: 投稿済み行の記録だけ消え、未公開行・無関係キーは残る
{
  const utilities = makeUtilitiesMock();
  const sheet = makeSheetMock('DRIVE BASE', 'ss-1', {
    2: '投稿済み',
    3: 'WP下書き済み',
    4: '投稿済み'
  });
  const keyDummySheets = { 'DRIVE BASE': sheet };
  const probe = loadModule(utilities, makePropertiesServiceMock({}), keyDummySheets);
  const keyRow2 = probe.keyFor(sheet, 2);
  const keyRow3 = probe.keyFor(sheet, 3);
  const keyRow4 = probe.keyFor(sheet, 4);

  const props = makePropertiesServiceMock({
    [keyRow2]: 'fp-2',
    [keyRow3]: 'fp-3',
    [keyRow4]: 'fp-4',
    UA_SERPER_API_KEY: 'unrelated-but-similar-prefix-safe'
  });
  const mod = loadModule(utilities, props, keyDummySheets);

  mod.cleanup();

  assert.strictEqual(props._store[keyRow2], undefined, 'Posted row 2 fingerprint must be removed');
  assert.strictEqual(props._store[keyRow4], undefined, 'Posted row 4 fingerprint must be removed');
  assert.strictEqual(props._store[keyRow3], 'fp-3', 'Row 3 is not posted yet, its fingerprint must survive');
  assert.strictEqual(props._store.UA_SERPER_API_KEY, 'unrelated-but-similar-prefix-safe', 'Non-UA_PREPUB_DONE_ properties must never be touched');
}

console.log('Pre-publish state cleanup tests passed.');
