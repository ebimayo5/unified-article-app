const fs = require('fs'), vm = require('vm'), assert = require('assert');
const source = fs.readFileSync(__dirname + '/unified_article_app/image.gs', 'utf8');

function scenario(options = {}) {
  const calls = [], sheetWrites = [];
  const row = { appType: '運行管理者試験対策', body: '<h2>見出しA</h2><p>本文</p><h2>見出しB</h2><p>本文</p>', titleIdeas: 'タイトル', mainInput: 'キーワード', wpPostId: 69, structureMemo: '' };
  const tasks = [
    { role: 'eyecatch', heading: '', alt: 'eye' },
    { role: 'section', heading: '見出しA', alt: 'a' },
    { role: 'section', heading: '見出しB', alt: 'b' }
  ];
  const sheet = { getRange: (r, c) => ({ setValue: v => sheetWrites.push({ r, c, v }) }), getActiveCell: () => ({ getRow: () => 2 }) };
  const ctx = {
    console, UA_COLUMNS: { body: 10, structureMemo: 11 },
    uaSaveActiveRowData: () => {}, uaGetSheetForData_: () => sheet,
    uaBuildRowData_: () => ({ ...row }),
    uaGetAppConfigByLabel_: () => ({ key: 'unkan', useWordPress: true }),
    uaIsUnkan_: () => true,
    uaGetImageProvider_: () => 'openai',
    uaBuildGeneratedImageTasks_: () => tasks.map(t => ({ ...t })),
    uaGetWpConfig_: () => ({ siteUrl: 'https://unkan-genba.com' }),
    uaPickWpTitle_: s => s,
    uaTryFetchGeneratedImageWpPost_: () => options.post === undefined ? { status: 'publish', featured_media: 91 } : options.post,
    uaGetWpPostContentText_: () => '',
    uaGenerateImageForTask_: (task) => { calls.push('generate:' + task.role); return { bytes: [1], contentType: 'image/png', model: 'm' }; },
    uaUploadWpImageBytes_: (cfg, bytes, ct, src, alt, i) => { calls.push('upload'); return { id: 500 + i, url: 'https://x/' + i + '.png' }; },
    uaInsertWpImageAfterHeading_: (body, heading, media) => { calls.push('insert:' + heading); return body.replace('<h2>' + heading + '</h2>', '<h2>' + heading + '</h2><figure>' + media.id + '</figure>'); },
    uaTrySaveGeneratedImageCheckpoint_: () => {},
    uaTryUpdateGeneratedImagesCheckpoint_: () => { calls.push('WP_CHECKPOINT'); return null; },
    uaUpdateWpPostWithImages_: () => { calls.push('WP_UPDATE'); },
    uaAppendGeneratedImageMemo_: m => m,
    uaNormalizeHeadingText_: h => String(h || '').replace(/<[^>]*>/g, '').replace(/s+/g, '').trim(),
    uaBuildGeneratedImageFailure_: () => ({}), uaBuildGeneratedImageFailureSummary_: () => ''
  };
  const stubs = { ...ctx };
  vm.createContext(ctx); vm.runInContext(source, ctx);
  Object.assign(ctx, stubs); // 外部呼び出しだけ差し替え、判定ロジックはimage.gsの実物を使う
  let result, error;
  try { result = ctx.uaGenerateWpImagesFromPanel({ row: 2, imageBatchSize: 2 }); } catch (e) { error = e; }
  return { calls, sheetWrites, result, error };
}

// 1) 公開済み: アイキャッチ生成なし・WordPressへの書き込みなし・本文(シート)にだけ差し込み
const pub = scenario({ post: { status: 'publish', featured_media: 91 } });
assert.ifError(pub.error);
assert(!pub.calls.includes('generate:eyecatch'), 'アイキャッチは生成しない');
assert(!pub.calls.includes('WP_CHECKPOINT') && !pub.calls.includes('WP_UPDATE'), '公開記事へWordPress書き込みをしない');
assert(pub.calls.filter(c => c.startsWith('insert:')).length >= 1, '本文へ差し込む');
const bodyWrite = pub.sheetWrites.find(w => w.c === 10);
assert(bodyWrite && /<figure>/.test(bodyWrite.v), 'シート本文に画像ブロックが入る');
assert(/変更していません/.test(pub.result.message) && /公開記事を更新/.test(pub.result.message));

// 2) 下書き: 従来どおりWordPressへ反映(回帰)
const draft = scenario({ post: { status: 'draft', featured_media: 0 } });
assert.ifError(draft.error);
assert(draft.calls.includes('generate:eyecatch'), '下書きではアイキャッチも作る');
assert(draft.calls.includes('WP_UPDATE'), '下書きはWordPressへ反映する');

// 3) 投稿状態が取得できない: 安全側で停止し、何も生成しない
const unknown = scenario({ post: null });
assert(unknown.error && /状態を確認できない/.test(unknown.error.message));
assert(!unknown.calls.some(c => c.startsWith('generate')));

// 4) 非公開・保留以外(private等): 停止
const priv = scenario({ post: { status: 'private' } });
assert(priv.error);
assert(!priv.calls.some(c => c.startsWith('generate')));

console.log('PASS: 公開済み運管記事は記事内画像のみ・WordPress非更新・アイキャッチ非変更、下書きは従来どおり、状態不明/非公開は停止。');
