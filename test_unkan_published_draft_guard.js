const fs = require('fs'), vm = require('vm'), assert = require('assert');
const source = fs.readFileSync(__dirname + '/unified_article_app/wordpress.gs', 'utf8');

function scenario({ unkan, status }) {
  const calls = [], writes = [];
  const row = { appType: unkan ? '運行管理者試験対策' : 'DRIVE BASE', body: '<p>本文</p>', titleIdeas: 'タイトル', mainInput: 'kw', wpPostId: 86, permalink: 'koshu', tags: '', metaDescription: '' };
  const sheet = { getActiveCell: () => ({ getRow: () => 2 }), getRange: (r, c) => ({ setValue: (v) => writes.push({ c, v }) }) };
  const stubs = {
    console, UA_COLUMNS: { body: 6, wpPostId: 19, wpEditUrl: 20, wpDraftedAt: 21, status: 10 }, UA_STATUS_WP_DRAFTED: 'WP下書き済み',
    uaSaveActiveRowData: () => {}, uaGetSheetForData_: () => sheet,
    uaBuildRowData_: () => ({ ...row }),
    uaGetAppConfigByLabel_: () => ({ key: unkan ? 'unkan' : 'drive', useWordPress: true }),
    uaIsUnkan_: () => unkan,
    uaUnkanContentIssues_: () => [],
    uaGetWpConfig_: () => ({ siteUrl: 'https://unkan-genba.com' }),
    uaExtractProductPlan_: () => null, uaStripProductPlanMarker_: s => s,
    uaNormalizeSwellManagedCoreGroups_: s => s, uaNormalizeSwellInternalLinkBlocks_: s => s, uaNormalizeUnsupportedTrialGuidance_: s => s,
    uaRemoveRedundantAffiliateDisclosure_: s => s, uaApplyManagedAffiliateCta_: s => s,
    uaAssertWpDraftHardQualityGates_: () => {},
    uaPickWpTitle_: s => s, uaCleanWpSlug_: s => s, uaEnsureWpTagIds_: () => [], uaResolveWpCategoryIds_: () => [],
    uaFetchWpPostForEdit_: () => ({ id: 86, status }),
    uaCallWordPressApi_: (cfg, path, method, payload) => { calls.push({ path, method }); return { id: 86 }; },
    uaSyncWpMetaDescription_: () => {}, uaBuildWpEditUrl_: () => 'edit',
    uaNormalizeAnchorRelAttributes_: s => s, uaFixGeneratedHtml_: s => s, uaApplyNaviokunPostProcessing_: s => s, uaApplyYmylNotice_: s => s
  };
  const ctx = { ...stubs };
  vm.createContext(ctx); vm.runInContext(source, ctx); Object.assign(ctx, stubs);
  let result, error;
  try { result = ctx.uaCreateWpDraftFromPanel({ row: 2 }); } catch (e) { error = e; }
  return { calls, writes, result, error };
}

// 1) 運管の公開済み: 従来どおりエラーで拒否(WordPressへ書き込まない)。メッセージで次の手順を案内する
const pub = scenario({ unkan: true, status: 'publish' });
assert(pub.error, '拒否(エラー)のまま');
assert.equal(pub.calls.length, 0, 'WordPressへ書き込まない');
assert.equal(pub.writes.length, 0, 'シートも更新しない');
assert(/公開済み・予約済み/.test(pub.error.message), '既存の安全テストが見る文言を保持');
assert(/運管の公開済み記事です/.test(pub.error.message) && /公開記事を更新/.test(pub.error.message));

// 2) 運管の下書き: 従来どおり更新
const draft = scenario({ unkan: true, status: 'draft' });
assert.ifError(draft.error);
assert(draft.calls.some(c => c.method === 'post' && /posts\/86/.test(c.path)));

// 3) 他サイトの公開済み: 従来どおり停止(運管用の案内は付かない)
const other = scenario({ unkan: false, status: 'publish' });
assert(other.error && /自動更新しません/.test(other.error.message));
assert(!/運管の公開済み記事です/.test(other.error.message));
assert.equal(other.calls.length, 0);

// 4) 運管でも予約・非公開など(publish以外の編集不可)は従来どおり停止
const future = scenario({ unkan: true, status: 'future' });
assert(future.error && /自動更新しません/.test(future.error.message));
assert(!/運管の公開済み記事です/.test(future.error.message), '予約には公開記事の案内を付けない');

// 5) 画面側: 運管の公開済み停止は「リライト完了」として終える。他の失敗は従来どおり失敗扱い
const html = fs.readFileSync(__dirname + '/unified_article_app/ua_web_app.html', 'utf8').split(String.fromCharCode(13)).join('');
assert(html.includes("step.server === 'uaCreateWpDraftFromWeb' && isUnkanPublishedStopError(error)"));
assert(html.includes('finishFullWorkflowAtUnkanPublishedStop(flow);'));
const start = html.indexOf('function isUnkanPublishedStopError(error) {');
assert(start >= 0, '判定関数がある');
const end = html.indexOf('\n      }\n', start) + '\n      }'.length;
const fnSrc = html.slice(start, end);
const isStop = new Function(fnSrc + '; return isUnkanPublishedStopError;')();
assert.equal(isStop({ message: pub.error.message }), true);
assert.equal(isStop({ message: other.error.message }), false);
assert.equal(isStop({ message: 'WP draft: 投稿ID 5 は「publish」のため自動更新しません。公開済み・予約済み記事の誤更新を防ぐため停止しました。' }), false);

console.log('PASS: 運管の公開済みは拒否のまま案内メッセージ付き、画面は完了扱い。下書きは従来どおり、他サイトの公開済み・予約は停止のまま。');
