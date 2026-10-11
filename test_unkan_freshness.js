const fs = require('fs'), vm = require('vm'), assert = require('assert');
const core = fs.readFileSync(__dirname + '/unified_article_app/freshness.gs', 'utf8');
const source = fs.readFileSync(__dirname + '/unified_article_app/unkan_arcon.gs', 'utf8');

const sandbox = { console, UA_APP_TYPES: { unkan: { articleSheetName: '運管' } } };
vm.createContext(sandbox);
vm.runInContext(core, sandbox);
vm.runInContext(source, sandbox);
const topics = vm.runInContext('UA_UNKAN_FRESHNESS_TOPICS', sandbox);
const score = (raw, touched, now) => sandbox.uaFreshnessScore_({ raw, touched }, now, { topicGroups: topics });
const NOW = new Date('2026-10-11T03:00:00Z');

// 1) 古い年の記載 + 法令 + 試験情報 + 長期未更新 → 高
const stale = score('<p>2024年の改善基準告示では拘束時間が変わりました。合格率は約38%、受験手数料は8,500円です。</p>', '2026-03-01T00:00:00Z', NOW);
assert.equal(stale.level, '高', JSON.stringify(stale));
assert(stale.reasons.some(r => /2024年/.test(r)), '古い年を理由に出す');
assert(stale.ageDays >= 180);

// 2) 「時点」の古い記載を検出
const stated = score('<p>2026年3月時点の情報です。</p>', '2026-09-20T00:00:00Z', NOW);
assert(stated.reasons.some(r => /時点/.test(r)), JSON.stringify(stated));
assert(stated.score >= 2);

// 3) 最近更新・今年の記載・センシティブな話題なし → 低
const fresh = score('<p>読者の皆さんへ。2026年10月に書いた雑記です。</p>', '2026-10-09T00:00:00Z', NOW);
assert.equal(fresh.level, '低', JSON.stringify(fresh));

// 4) 令和表記: 令和6年=2024年 → 古い年として扱う
const reiwa = score('<p>令和6年度の試験について解説します。</p>', '2026-10-01T00:00:00Z', NOW);
assert(reiwa.reasons.some(r => /2024年/.test(r)), JSON.stringify(reiwa));

// 5) 日付が不正でも落ちない
const noDate = score('<p>本文</p>', 'invalid', NOW);
assert.equal(noDate.ageDays, null);

// 6) HTMLタグ・コメントの中身は本文として扱わない
const tagOnly = score('<!-- 2020年 --><div data-year="2020年">本文</div>', '2026-10-01T00:00:00Z', NOW);
assert.equal(tagOnly.maxYear, 0, '属性・コメント内の年は数えない');

// 7) レポート: 取り込み後に公開更新済み(シートの更新日が新しい)ならシート本文で判定し、並び順は優先度が高い順
const header = new Array(40).fill('');
const COL = { titleIdeas: 5, mainInput: 3, body: 6, wpPostId: 7, wpDraftedAt: 8 };
sandbox.UA_COLUMNS = COL;
sandbox.UA_HEADERS = new Array(10).fill('');
sandbox.uaGetWpPostRawContent_ = p => p.content && p.content.raw || '';
const mkRow = (title, body, id, drafted) => { const r = new Array(10).fill(''); r[COL.titleIdeas - 1] = title; r[COL.mainInput - 1] = title; r[COL.body - 1] = body; r[COL.wpPostId - 1] = id; r[COL.wpDraftedAt - 1] = drafted; return r; };
const rows = [
  mkRow('案1：新しい記事', '<p>2026年10月の内容。</p>', 11, ''),
  mkRow('案1：古い法令記事', '<p>(シート本文は使われない想定)</p>', 12, ''),
  mkRow('案1：更新済み記事', '<p>2026年10月に書き直した本文。拘束時間の解説。</p>', 13, new Date('2026-10-05T00:00:00Z'))
];
const origRows = [
  [11, new Date(), 'u', JSON.stringify({ modified_gmt: '2026-10-08T00:00:00', content: { raw: '<p>2026年10月の内容。</p>' } })],
  [12, new Date(), 'u', JSON.stringify({ modified_gmt: '2026-01-10T00:00:00', content: { raw: '<p>2023年の改善基準告示と合格率、受験手数料8,500円について。</p>' } })],
  [13, new Date(), 'u', JSON.stringify({ modified_gmt: '2025-12-01T00:00:00', content: { raw: '<p>2023年の古い本文。法令、合格率。</p>' } })]
];
const mkSheet = (data) => ({ getLastRow: () => data.length + 1, getRange: (r, c, nr, nc) => ({ getValues: () => data.slice(0, nr).map(x => x.slice(c - 1, c - 1 + nc)) }) });
const sheets = { '運管': mkSheet(rows), [vm.runInContext('UA_UNKAN_ORIGINALS', sandbox)]: mkSheet(origRows) };
sandbox.SpreadsheetApp = { getActiveSpreadsheet: () => ({ getSheetByName: n => sheets[n] || null }) };
const report = sandbox.uaUnkanFreshnessReport_(NOW);
assert.equal(report.length, 3);
assert.equal(report[0].postId, 12, '古い法令記事が最優先');
const updated = report.find(x => x.postId === 13);
assert(!updated.reasons.some(r => /2023年/.test(r)), '公開更新済みは新しい本文で判定する: ' + JSON.stringify(updated));
assert(report[0].score >= report[1].score && report[1].score >= report[2].score, '優先度の降順');
assert.equal(report.find(x => x.postId === 11).level, '低');

// 7b) 共通の核はサイト非依存: 話題語を渡さなければ話題の加点はなく、年・日付だけで判定する
const generic = sandbox.uaFreshnessScore_({ raw: '<p>2024年の改善基準告示と合格率</p>', touched: '2026-10-01T00:00:00Z' }, NOW);
assert.equal(generic.score, 3, JSON.stringify(generic));
assert(!generic.reasons.some(r => /法令|試験情報/.test(r)));

// 8) 書き込み系を一切呼ばない(読み取り専用)
['setValue', 'setValues', 'appendRow', 'deleteRow', 'clear'].forEach(m => assert(!new RegExp('uaUnkanFreshnessReport_[\\s\\S]{0,3000}\\.' + m + '\\(').test(source.slice(source.indexOf('function uaUnkanFreshnessReport_'))), m + 'を使っていない'));

console.log('PASS: 鮮度判定(古い年・時点・令和・日付不正・タグ内の年)、公開更新済みはシート本文で判定、優先度降順、読み取り専用。');
