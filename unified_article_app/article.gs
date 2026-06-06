let UA_LAST_RAKUTEN_STATUS = '';

function uaRunArticleFromPanel(data) {
  uaSaveActiveRowData(data || {});

  const sheet = uaGetSheetForData_(data || {});
  const row = Number(data && data.row) || sheet.getActiveCell().getRow();
  const rowData = uaBuildRowData_(sheet, row);
  const appConfig = uaGetAppConfigByLabel_(rowData.appType);
  const mainInput = String(rowData.mainInput || '').trim();

  if (!appConfig) {
    throw new Error('記事タイプを取得できません。A列で DRIVE BASE、たくみパパ、汎用記事 のいずれかを選んでください。');
  }

  if (!mainInput) {
    throw new Error((appConfig.inputLabel || 'メインキーワード') + 'を入力してください。');
  }

  const currentStatus = String(rowData.status || '').trim();

  if (currentStatus === UA_STATUS_POSTED) {
    throw new Error('この行は「投稿済み」です。再生成する場合は状態を空欄にしてください。');
  }

  const provider = uaGetArticleProvider_();

  if (provider === 'gemini' && !uaGetGeminiApiKey_()) {
    throw new Error('Gemini APIキーが設定されていません。');
  }

  if (provider === 'openai' && !uaGetOpenAiApiKey_()) {
    throw new Error('OpenAI APIキーが設定されていません。');
  }

  if (provider === 'claude' && !uaGetClaudeApiKey_()) {
    throw new Error('Claude APIキーが設定されていません。');
  }

  sheet.getRange(row, UA_COLUMNS.status).setValue(UA_STATUS_GENERATING);

  try {
    const promptText = uaBuildArticlePrompt_(rowData, appConfig);
    const result = uaCallArticleGenerationJson_(promptText, provider);
    const resultJson = result && result.data;

    if (!resultJson || !resultJson.body || !resultJson.title_ideas) {
      sheet.getRange(row, UA_COLUMNS.status).setValue(UA_STATUS_STOPPED);
      throw new Error('生成結果に必要な項目がありません。');
    }

    const body = uaApplyRakutenAffiliateBanner_(
      uaFixGeneratedHtml_(resultJson.body),
      rowData,
      appConfig
    );
    const metaDescription = resultJson.meta_description ||
      resultJson.metaDescription ||
      '';
    const permalink = resultJson.permalink ||
      resultJson.slug ||
      '';
    const tags = uaNormalizeGeneratedTags_(resultJson.tags || '', rowData, appConfig);
    const factCheckPointsBase = resultJson.fact_check_points ||
      resultJson.factCheckPoints ||
      '特になし';
    const factCheckPoints = uaAppendRakutenStatusToFactCheck_(factCheckPointsBase);
    const structureMemo = resultJson.structure_memo ||
      resultJson.structureMemo ||
      '';

    uaSetGeneratedMeta_(sheet, row, UA_STATUS_DONE, provider, result && result.model);

    sheet.getRange(row, UA_COLUMNS.body, 1, 5).setValues([[
      body,
      resultJson.title_ideas,
      tags,
      metaDescription,
      permalink
    ]]);

    uaSetFactCheckPointsWithLinks_(sheet, row, factCheckPoints);
    sheet.getRange(row, UA_COLUMNS.structureMemo).setValue(structureMemo);

    const nextData = uaBuildRowData_(sheet, row);
    nextData.message = '記事生成が完了しました。';
    return nextData;
  } catch (e) {
    sheet.getRange(row, UA_COLUMNS.status).setValue(UA_STATUS_STOPPED);
    sheet.getRange(row, UA_COLUMNS.factCheckPoints).setValue('・記事生成停止理由｜' + e.toString());
    throw e;
  }
}

function uaRunArticleFromWeb(data) {
  return uaRunArticleFromPanel(data || {});
}

function uaAddRakutenBannerToActiveRow() {
  const result = uaAddRakutenBannerToActiveRow_();
  SpreadsheetApp.getUi().alert(result.message);
}

function uaAddRakutenBannerFromPanel(data) {
  uaSaveActiveRowData(data || {});
  return uaAddRakutenBannerForData_(data || {});
}

function uaAddRakutenBannerFromWeb(data) {
  uaSaveActiveRowData(data || {});
  return uaAddRakutenBannerForData_(data || {});
}

function uaAddRakutenBannerToActiveRow_() {
  return uaAddRakutenBannerForContext_(uaGetRakutenActiveRowContext_());
}

function uaAddRakutenBannerForData_(data) {
  const sheet = uaGetSheetForData_(data || {});
  const row = Number(data && data.row) || sheet.getActiveCell().getRow();
  return uaAddRakutenBannerForContext_(uaGetRakutenRowContext_(sheet, row));
}

function uaAddRakutenBannerForContext_(context) {
  if (!context.body) {
    throw new Error('本文が空です。先に本文を生成してください。');
  }

  if (uaHasRakutenBanner_(context.body)) {
    throw new Error('本文内に楽天バナーらしきリンクがすでにあります。重複を避けるため追加しません。');
  }

  UA_LAST_RAKUTEN_STATUS = '';

  if (!uaShouldInsertRakutenAffiliateBanner_(context.body, context.rowData, context.appConfig)) {
    const reason = UA_LAST_RAKUTEN_STATUS || '楽天バナー挿入対象外です。';
    uaAppendFactCheckPoint_(context.sheet, context.row, '・楽天バナー後入れ未実行｜' + reason);
    return {
      message: '楽天バナーは追加しませんでした。\n理由: ' + reason
    };
  }

  const block = uaBuildRakutenFollowupBlock_(context.body, context.rowData, context.appConfig);

  if (!block) {
    const reason = UA_LAST_RAKUTEN_STATUS || '楽天バナーを作成できませんでした。';
    uaAppendFactCheckPoint_(context.sheet, context.row, '・楽天バナー後入れ失敗｜' + reason);
    return {
      message: '楽天バナーを追加できませんでした。\n理由: ' + reason
    };
  }

  const nextBody = uaInsertRakutenBlockIntoBody_(context.body, block);
  context.sheet.getRange(context.row, UA_COLUMNS.body).setValue(nextBody);
  uaAppendFactCheckPoint_(context.sheet, context.row, '・楽天バナー後入れ｜既存本文に小リライトとして追加済み');

  const nextData = uaBuildRowData_(context.sheet, context.row);
  nextData.message = '楽天バナーを本文へ追加しました。本文生成APIは使っていません。';
  return nextData;
}

function uaGetRakutenActiveRowContext_() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const row = sheet.getActiveCell().getRow();
  return uaGetRakutenRowContext_(sheet, row);
}

function uaGetRakutenRowContext_(sheet, row) {
  if (row === 1) {
    throw new Error('記事データの行を選択してください。1行目は見出しです。');
  }

  const rowData = uaBuildRowData_(sheet, row);
  const appConfig = uaGetAppConfigByLabel_(rowData.appType);

  if (!appConfig) {
    throw new Error('記事タイプを取得できません。A列で DRIVE BASE、たくみパパ、汎用記事 のいずれかを選んでください。');
  }

  if (appConfig.key === 'general') {
    throw new Error('汎用記事では楽天バナー自動挿入は使いません。');
  }

  return {
    sheet: sheet,
    row: row,
    rowData: rowData,
    appConfig: appConfig,
    body: String(rowData.body || '')
  };
}

function uaBuildRakutenFollowupBlock_(body, rowData, appConfig) {
  const query = uaSelectRakutenProductQuery_(body, rowData, appConfig);

  if (!query) {
    UA_LAST_RAKUTEN_STATUS = '商品検索キーワードを選定できませんでした。';
    return '';
  }

  const banner = uaBuildRakutenAffiliateBanner_(body, rowData, appConfig);

  if (!banner) {
    return '';
  }

  return [
    '<h2>関連アイテムも選択肢に入れる</h2>',
    '<p>本文の対策を読んで「実際に何を用意すればいいか」まで考えたい場合は、関連アイテムを見比べておくと判断しやすくなります。</p>',
    banner
  ].join('\n');
}

function uaInsertRakutenBlockIntoBody_(body, block) {
  const faqIndex = body.search(/<h2[^>]*>\s*よくある質問\s*<\/h2>/i);

  if (faqIndex > -1) {
    return body.slice(0, faqIndex) + block + '\n\n' + body.slice(faqIndex);
  }

  const summaryIndex = body.search(/<h2[^>]*>[\s\S]*?まとめ[\s\S]*?<\/h2>/i);

  if (summaryIndex > -1) {
    return body.slice(0, summaryIndex) + block + '\n\n' + body.slice(summaryIndex);
  }

  return body + '\n\n' + block;
}

function uaHasRakutenBanner_(body) {
  const text = String(body || '');
  return text.indexOf('openapi.rakuten') !== -1 ||
    text.indexOf('hb.afl.rakuten') !== -1 ||
    text.indexOf('rakuten.co.jp') !== -1 ||
    text.indexOf('rel=\'nofollow sponsored\'') !== -1 && text.indexOf('楽天') !== -1;
}

function uaAppendFactCheckPoint_(sheet, row, line) {
  const current = String(sheet.getRange(row, UA_COLUMNS.factCheckPoints).getValue() || '').trim();
  const next = !current || current === '特になし'
    ? line
    : current + '\n' + line;

  uaSetFactCheckPointsWithLinks_(sheet, row, next);
}

function uaAppendRakutenStatusToFactCheck_(factCheckPoints) {
  const status = String(UA_LAST_RAKUTEN_STATUS || '').trim();
  const value = String(factCheckPoints || '').trim();

  if (!status || status === '挿入済み') {
    return value || '特になし';
  }

  if (!value || value === '特になし') {
    return '・楽天バナー未挿入｜' + status;
  }

  return value + '\n・楽天バナー未挿入｜' + status;
}

function uaSetGeneratedMeta_(sheet, row, status, provider, model) {
  sheet.getRange(row, UA_COLUMNS.status).setValue(status);
  sheet.getRange(row, UA_COLUMNS.createdAt).setValue(new Date());
  sheet.getRange(row, UA_COLUMNS.generationModel).setValue(uaFormatModelLabel_(provider, model));
  SpreadsheetApp.flush();
}

function uaCallArticleGenerationJson_(promptText, provider) {
  if (provider === 'claude') {
    return uaCallClaudeJson_(promptText, 18000);
  }

  if (provider === 'openai') {
    return uaCallOpenAiJson_(promptText, 16000);
  }

  return uaCallGeminiJson_(promptText, 16000, 512);
}

function uaApplyRakutenAffiliateBanner_(body, rowData, appConfig) {
  UA_LAST_RAKUTEN_STATUS = '';

  if (!appConfig || appConfig.key === 'general') {
    return body;
  }

  if (!uaShouldInsertRakutenAffiliateBanner_(body, rowData, appConfig)) {
    return body;
  }

  const banner = uaBuildRakutenAffiliateBanner_(body, rowData, appConfig);

  if (!banner) {
    return body;
  }

  UA_LAST_RAKUTEN_STATUS = '挿入済み';

  const faqIndex = body.search(/<h2[^>]*>\s*よくある質問\s*<\/h2>/i);

  if (faqIndex > -1) {
    return body.slice(0, faqIndex) + banner + '\n\n' + body.slice(faqIndex);
  }

  const summaryIndex = body.search(/<h2[^>]*>[\s\S]*?まとめ[\s\S]*?<\/h2>/i);

  if (summaryIndex > -1) {
    return body.slice(0, summaryIndex) + banner + '\n\n' + body.slice(summaryIndex);
  }

  return body + '\n\n' + banner;
}

function uaBuildRakutenAffiliateBanner_(body, rowData, appConfig) {
  const query = uaSelectRakutenProductQuery_(body, rowData, appConfig);

  if (!query) {
    UA_LAST_RAKUTEN_STATUS = '商品検索キーワードを選定できませんでした';
    return '';
  }

  const item = uaFetchRakutenItem_(query);

  if (item) {
    return uaBuildRakutenItemBannerHtml_(item, query);
  }

  const fallbackHtml = String(PropertiesService.getScriptProperties().getProperty('UA_RAKUTEN_AFFILIATE_BANNER_HTML') || '').trim();

  if (!fallbackHtml) {
    if (!UA_LAST_RAKUTEN_STATUS) {
      UA_LAST_RAKUTEN_STATUS = '楽天APIで商品を取得できず、固定バナーfallbackも未設定です。検索キーワード: ' + query;
    }
    return '';
  }

  return [
    '<p>具体的な商品を比較したい場合は、下の楽天バナーから関連アイテムを確認できます。楽天を特別に推す意図ではなく、価格や種類を見比べるための選択肢として使ってください。</p>',
    uaNormalizeRakutenAffiliateBanner_(fallbackHtml)
  ].join('\n');
}

function uaSelectRakutenProductQuery_(body, rowData, appConfig) {
  const notes = String(rowData && rowData.affiliateNotes || '');
  const override = notes.match(/楽天商品(?:キーワード|KW)[:：]\s*([^\n\r]+)/);

  if (override && override[1]) {
    return override[1].trim();
  }

  const text = [
    rowData && rowData.mainInput,
    rowData && rowData.readerMindMemo,
    body
  ].join(' ');
  const prioritizedQueries = uaPrioritizedRakutenQueriesFromBody_(text, appConfig && appConfig.key);

  if (prioritizedQueries.length > 0) {
    return prioritizedQueries[0];
  }

  const candidates = appConfig && appConfig.key === 'home'
    ? uaHomeRakutenProductCandidates_()
    : uaDriveRakutenProductCandidates_();
  let best = null;

  candidates.forEach(function(candidate) {
    const score = candidate.keywords.reduce(function(total, keyword) {
      return total + (text.indexOf(keyword) !== -1 ? 1 : 0);
    }, 0);

    if (score > 0 && (!best || score > best.score)) {
      best = {
        query: candidate.query,
        score: score
      };
    }
  });

  return best ? best.query : '';
}

function uaGetRakutenKeywordSuggestionsFromPanel(data) {
  return uaGetRakutenKeywordSuggestions_(data || {});
}

function uaGetRakutenKeywordSuggestionsFromWeb(data) {
  return uaGetRakutenKeywordSuggestions_(data || {});
}

function uaGetRakutenKeywordSuggestions_(data) {
  const appConfig = uaGetAppConfigByLabel_(data && data.appType);

  if (!appConfig || appConfig.key === 'general') {
    return {
      suggestions: [],
      message: '汎用記事では楽天バナー自動挿入は使いません。'
    };
  }

  const notes = String(data && data.affiliateNotes || '');
  const override = notes.match(/楽天商品(?:キーワード|KW)[:：]\s*([^\n\r]+)/);
  const text = [
    data && data.mainInput,
    data && data.readerMindMemo,
    data && data.body,
    notes
  ].join(' ');
  const candidates = appConfig.key === 'home'
    ? uaHomeRakutenProductCandidates_()
    : uaDriveRakutenProductCandidates_();
  const suggestions = [];
  const seen = {};

  function addSuggestion(query) {
    query = String(query || '').replace(/\s+/g, ' ').trim();
    if (!query || seen[query]) return;
    seen[query] = true;
    suggestions.push(query);
  }

  if (override && override[1]) {
    addSuggestion(override[1]);
  }

  uaPrioritizedRakutenQueriesFromBody_(text, appConfig.key).forEach(addSuggestion);
  uaContextualRakutenQueries_(text, appConfig.key).forEach(addSuggestion);

  candidates
    .map(function(candidate) {
      const score = candidate.keywords.reduce(function(total, keyword) {
        return total + (text.indexOf(keyword) !== -1 ? 1 : 0);
      }, 0);

      return {
        query: candidate.query,
        score: score
      };
    })
    .filter(function(item) {
      return item.score > 0;
    })
    .sort(function(a, b) {
      return b.score - a.score;
    })
    .forEach(function(item) {
      addSuggestion(item.query);
    });

  uaKeywordBasedRakutenQueries_(data && data.mainInput, appConfig.key).forEach(addSuggestion);

  return {
    suggestions: suggestions.slice(0, 5),
    message: suggestions.length > 0
      ? '商品検索キーワード候補を取得しました。'
      : '候補を取得できませんでした。案件注意点に「楽天商品キーワード: ...」で手動指定してください。'
  };
}

function uaPrioritizedRakutenQueriesFromBody_(text, appKey) {
  const value = String(text || '');
  const result = [];
  const seen = {};

  function add(query) {
    query = String(query || '').replace(/\s+/g, ' ').trim();
    if (!query || seen[query]) return;
    seen[query] = true;
    result.push(query);
  }

  if (appKey === 'drive') {
    [
      { query: 'ディテールブラシ 車 洗車', words: ['ディテールブラシ', '細かい部分に使えるブラシ', '隙間の砂'] },
      { query: 'クイックディテーラー 車', words: ['クイックディテーラー', '軽い汚れの時短'] },
      { query: 'マイクロファイバークロス 車 洗車', words: ['マイクロファイバークロス', '薄手のクロス', '厚手のクロス', '拭き上げクロス'] },
      { query: 'カーシャンプー 車 洗車', words: ['カーシャンプー', '泡洗車'] },
      { query: '水垢取り 車', words: ['水垢取り', '水垢を減らす', '水垢対策'] },
      { query: '車 ガラスクリーナー 油膜取り', words: ['ガラスクリーナー', '油膜取り'] },
      { query: '車 コーティング剤', words: ['コーティング剤', '撥水剤'] },
      { query: 'タイヤワックス 車', words: ['タイヤワックス'] },
      { query: '車 サンシェード', words: ['サンシェード', '日よけ'] },
      { query: 'ポータブル電源 車中泊', words: ['ポータブル電源', '車中泊 電源'] },
      { query: '車載扇風機 車中泊', words: ['車載扇風機', '扇風機 車内'] },
      { query: 'ジャンプスターター 車 バッテリー', words: ['ジャンプスターター', 'バッテリー上がり'] },
      { query: 'スマホホルダー 車', words: ['スマホホルダー'] }
    ].forEach(function(item) {
      if (item.words.some(function(word) { return value.indexOf(word) !== -1; })) add(item.query);
    });
  }

  if (appKey === 'home') {
    [
      { query: '除湿機 コンパクト', words: ['除湿機', '除湿器'] },
      { query: 'サーキュレーター 部屋干し', words: ['サーキュレーター', '部屋干し'] },
      { query: '湿度計 室内', words: ['湿度計'] },
      { query: '防カビ 収納用品', words: ['防カビ 収納', 'カビ対策 収納'] },
      { query: 'ランドリーチェスト 防カビ', words: ['ランドリーチェスト', '洗面所 チェスト'] },
      { query: '収納ボックス 家庭用', words: ['収納ボックス', '収納ケース'] },
      { query: '滑り止めマット 浴室', words: ['滑り止めマット', '滑り止め'] },
      { query: 'センサーライト 屋外', words: ['センサーライト'] },
      { query: '室外機カバー', words: ['室外機カバー', '室外機 日よけ'] }
    ].forEach(function(item) {
      if (item.words.some(function(word) { return value.indexOf(word) !== -1; })) add(item.query);
    });
  }

  return result.slice(0, 5);
}

function uaContextualRakutenQueries_(text, appKey) {
  const value = String(text || '');

  if (appKey === 'home') {
    if ((value.indexOf('ランドリー') !== -1 || value.indexOf('脱衣') !== -1 || value.indexOf('洗面') !== -1) &&
      (value.indexOf('チェスト') !== -1 || value.indexOf('収納') !== -1)) {
      return [
        'ランドリーチェスト 防カビ',
        'ランドリー収納 樹脂 チェスト',
        '脱衣所 収納 チェスト',
        'ランドリー収納 スリム',
        'ランドリーチェスト キャスター'
      ];
    }

    if (value.indexOf('カビ') !== -1 || value.indexOf('湿気') !== -1 || value.indexOf('除湿') !== -1) {
      return [
        '除湿機 コンパクト',
        'サーキュレーター 部屋干し',
        '湿度計 室内',
        '防カビ 収納',
        'ランドリー収納 防カビ'
      ];
    }
  }

  if (appKey === 'drive') {
    if (value.indexOf('車内') !== -1 && (value.indexOf('掃除') !== -1 || value.indexOf('清掃') !== -1)) {
      return [
        '車内 掃除 グッズ',
        '車 掃除機 コードレス',
        '車内クリーナー',
        'マイクロファイバークロス 車',
        '車 ガラスクリーナー'
      ];
    }
  }

  return [];
}

function uaKeywordBasedRakutenQueries_(keyword, appKey) {
  const value = String(keyword || '')
    .replace(/[「」『』【】（）()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!value) return [];

  const parts = value.split(/\s+/).filter(function(part) {
    return part.length >= 2 && part.length <= 18;
  });
  const compact = parts.join(' ');
  const result = [];

  if (compact) result.push(compact);

  if (appKey === 'home') {
    if (compact.indexOf('ランドリー') !== -1 || compact.indexOf('洗面') !== -1 || compact.indexOf('脱衣') !== -1) {
      result.push(compact + ' 収納');
      result.push(compact + ' 防カビ');
    }
  }

  if (appKey === 'drive') {
    result.push(compact + ' 車');
    result.push(compact + ' カー用品');
  }

  return result;
}

function uaDriveRakutenProductCandidates_() {
  return [
    { query: 'カーシャンプー 車 洗車', keywords: ['洗車', 'カーシャンプー', '泡洗車'] },
    { query: 'マイクロファイバークロス 車', keywords: ['マイクロファイバー', '拭き上げ', '車内清掃', '清掃'] },
    { query: '車 ガラスクリーナー 油膜取り', keywords: ['ガラスクリーナー', '油膜', 'フロントガラス'] },
    { query: '車 コーティング剤', keywords: ['コーティング', '撥水', '艶'] },
    { query: 'タイヤワックス 車', keywords: ['タイヤワックス', 'タイヤ', '足元'] },
    { query: 'ドライブレコーダー 前後', keywords: ['ドラレコ', 'ドライブレコーダー', '駐車監視'] },
    { query: '車 サンシェード', keywords: ['サンシェード', '日よけ', '暑さ対策'] },
    { query: 'ポータブル電源 車中泊', keywords: ['ポータブル電源', '車中泊', '電源'] },
    { query: '車載扇風機 車中泊', keywords: ['車載扇風機', '扇風機', '車内 待機'] },
    { query: 'スマホホルダー 車', keywords: ['スマホホルダー', 'スマホ', 'ナビアプリ'] },
    { query: 'HDMI 車載 モニター', keywords: ['HDMI', '後席モニター', 'モニター', 'YouTube'] },
    { query: '車 収納 ポケット', keywords: ['収納', '車内収納', 'シートバック'] },
    { query: '車 フロアマット', keywords: ['フロアマット', 'マット', '汚れ防止'] },
    { query: 'ジャンプスターター 車 バッテリー', keywords: ['バッテリー', 'ジャンプスターター', 'バッテリー上がり'] }
  ];
}

function uaHomeRakutenProductCandidates_() {
  return [
    { query: '除湿機 コンパクト', keywords: ['カビ', '湿気', '除湿', 'ランドリー', '脱衣所', '洗面所'] },
    { query: 'サーキュレーター 部屋干し', keywords: ['換気', '部屋干し', 'サーキュレーター', '湿気', 'ランドリー'] },
    { query: 'ランドリーチェスト 防カビ', keywords: ['ランドリー チェスト', 'ランドリーチェスト', 'カビない', '防カビ'] },
    { query: 'ランドリー収納 樹脂 チェスト', keywords: ['ランドリー収納', '脱衣所 収納', '洗面所 収納', '樹脂'] },
    { query: '脱衣所 収納 チェスト', keywords: ['脱衣所', '洗面所', 'チェスト'] },
    { query: '収納ボックス 住宅', keywords: ['収納', '収納ボックス', '片付け'] },
    { query: '可動棚 収納', keywords: ['可動棚', '棚', '収納'] },
    { query: '排水口 掃除 ぬめり取り', keywords: ['排水口', 'ぬめり', '掃除'] },
    { query: '滑り止めマット 玄関 浴室', keywords: ['滑りにくい', '滑り止め', 'マット'] },
    { query: 'センサーライト 屋外', keywords: ['センサーライト', '外構', '防犯'] },
    { query: '防災用品 セット 家庭用', keywords: ['防災', '停電', '備え'] },
    { query: '室外機カバー', keywords: ['室外機カバー', '室外機', '日よけ'] },
    { query: '室内物干し', keywords: ['物干し', 'ランドリー', '洗濯'] },
    { query: '見守りカメラ 家庭用', keywords: ['見守り', 'カメラ', '子ども'] },
    { query: 'ベビーゲート 階段', keywords: ['ベビーゲート', '子育て', '階段'] },
    { query: '車いす スロープ 簡易', keywords: ['車いす', 'スロープ', '段差'] }
  ];
}

function uaFetchRakutenItem_(query) {
  const applicationId = String(PropertiesService.getScriptProperties().getProperty('UA_RAKUTEN_APPLICATION_ID') || '').trim();
  const accessKey = String(PropertiesService.getScriptProperties().getProperty('UA_RAKUTEN_ACCESS_KEY') || '').trim();

  if (!applicationId || !accessKey) {
    UA_LAST_RAKUTEN_STATUS = '楽天APIキー不足（UA_RAKUTEN_APPLICATION_ID / UA_RAKUTEN_ACCESS_KEY）';
    return null;
  }

  const affiliateId = String(PropertiesService.getScriptProperties().getProperty('UA_RAKUTEN_AFFILIATE_ID') || '').trim();
  const refererUrl = uaGetRakutenRefererUrl_();
  const params = [
    'format=json',
    'formatVersion=2',
    'hits=1',
    'imageFlag=1',
    'sort=standard',
    'applicationId=' + encodeURIComponent(applicationId),
    'accessKey=' + encodeURIComponent(accessKey),
    'keyword=' + encodeURIComponent(query)
  ];

  if (affiliateId) {
    params.push('affiliateId=' + encodeURIComponent(affiliateId));
  }

  const url = 'https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260401?' + params.join('&');

  try {
    const res = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: {
        referer: refererUrl,
        origin: uaGetOriginFromUrl_(refererUrl),
        accessKey: accessKey
      },
      muteHttpExceptions: true
    });

    const statusCode = res.getResponseCode();
    const responseText = res.getContentText();

    if (statusCode !== 200) {
      UA_LAST_RAKUTEN_STATUS = '楽天API HTTP ' + statusCode + ': ' + String(responseText || '').slice(0, 120) +
        ' / Referer=' + refererUrl;
      return null;
    }

    const json = JSON.parse(responseText);
    const items = json.items || json.Items || [];
    const firstItem = items[0];
    const item = firstItem && (firstItem.item || firstItem.Item || firstItem);

    if (!item || !item.itemName || !(item.affiliateUrl || item.itemUrl)) {
      UA_LAST_RAKUTEN_STATUS = '楽天APIの商品取得0件またはURL不足。検索キーワード: ' + query;
      return null;
    }

    const mediumImage = item.mediumImageUrls &&
      item.mediumImageUrls[0];

    return {
      name: item.itemName,
      url: item.affiliateUrl || item.itemUrl,
      imageUrl: typeof mediumImage === 'string'
        ? mediumImage
        : mediumImage && mediumImage.imageUrl
    };
  } catch (e) {
    UA_LAST_RAKUTEN_STATUS = '楽天API取得エラー: ' + e.toString();
    return null;
  }
}

function uaGetRakutenRefererUrl_() {
  const props = PropertiesService.getScriptProperties();
  return String(
    props.getProperty('UA_RAKUTEN_REFERER_URL') ||
    props.getProperty('UA_RAKUTEN_APPLICATION_URL') ||
    'https://script.google.com/'
  ).trim();
}

function uaGetOriginFromUrl_(url) {
  const match = String(url || '').match(/^https?:\/\/[^/]+/i);
  return match ? match[0] : 'https://script.google.com';
}

function uaBuildRakutenItemBannerHtml_(item, query) {
  const name = uaEscapeHtml_(String(item.name || '').slice(0, 80));
  const url = uaEscapeHtml_(item.url || '');
  const imageUrl = uaEscapeHtml_(item.imageUrl || '');
  const queryText = uaEscapeHtml_(query || '関連アイテム');
  const imageHtml = imageUrl
    ? '<a href=\'' + url + '\' target=\'_blank\' rel=\'nofollow sponsored\' style=\'display:block;width:120px;flex:0 0 120px;background:#fff;border:1px solid #eef1f4;border-radius:6px;padding:6px;\'><img src=\'' + imageUrl + '\' alt=\'' + name + '\' style=\'display:block;max-width:100%;height:auto;border:0;background:#fff;\'></a>'
    : '';

  return [
    '<p>具体的な商品を比較したい場合は、下の楽天バナーから「' + queryText + '」の関連アイテムを確認できます。楽天を特別に推す意図ではなく、価格や種類を見比べるための選択肢として使ってください。</p>',
    '<!-- wp:html -->',
    '<div style=\'background:#fff;border:1px solid #d7dde3;border-radius:8px;padding:14px;margin:16px 0;display:flex;gap:14px;align-items:center;max-width:720px;box-sizing:border-box;\'>',
    imageHtml,
    '<div style=\'min-width:0;\'>',
    '<p style=\'margin:0 0 8px;font-weight:700;\'>関連アイテムを楽天で確認</p>',
    '<p style=\'margin:0;font-size:14px;line-height:1.7;\'><a href=\'' + url + '\' target=\'_blank\' rel=\'nofollow sponsored\'>' + name + '</a></p>',
    '</div>',
    '</div>',
    '<!-- /wp:html -->'
  ].filter(Boolean).join('\n');
}

function uaNormalizeRakutenAffiliateBanner_(bannerHtml) {
  return String(bannerHtml || '')
    .replace(/target="_blank"/g, "target='_blank'")
    .replace(/rel="([^"]*)"/g, "rel='$1'")
    .replace(/href="([^"]*)"/g, "href='$1'")
    .replace(/src="([^"]*)"/g, "src='$1'")
    .replace(/alt="([^"]*)"/g, "alt='$1'")
    .replace(/width="([^"]*)"/g, "width='$1'")
    .replace(/height="([^"]*)"/g, "height='$1'");
}

function uaEscapeHtml_(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;');
}

function uaShouldInsertRakutenAffiliateBanner_(body, rowData, appConfig) {
  const text = [
    rowData && rowData.mainInput,
    rowData && rowData.readerMindMemo,
    rowData && rowData.affiliateNotes,
    body
  ].join(' ');
  const notes = String(rowData && rowData.affiliateNotes || '');

  if (notes.indexOf('楽天バナーなし') !== -1 || notes.indexOf('楽天なし') !== -1) {
    UA_LAST_RAKUTEN_STATUS = 'パネルまたは案件注意点で楽天バナーなしが指定されています';
    return false;
  }

  if (notes.indexOf('楽天バナーあり') !== -1 || notes.indexOf('楽天あり') !== -1) {
    return true;
  }

  const negativeKeywords = [
    '工賃',
    '法規',
    '法律',
    '違法',
    '車検',
    '保証',
    '店舗対応',
    '手続き',
    '制度',
    '税金',
    'ローン',
    '保険',
    '売却',
    '査定'
  ];

  const positiveKeywords = appConfig && appConfig.key === 'home'
    ? [
      '収納',
      '掃除',
      '家事',
      '外構',
      '防災',
      '室外機カバー',
      'センサーライト',
      'マット',
      '物干し',
      '可動棚',
      '排水口',
      '換気',
      'エアコン',
      '家電',
      '見守り',
      'ベビーカー',
      '車いす'
    ]
    : [
      '洗車',
      '車内清掃',
      'カー用品',
      'コーティング',
      'タイヤ',
      'ドラレコ',
      'ドライブレコーダー',
      'サンシェード',
      '車中泊',
      'ポータブル電源',
      'バッテリー',
      'マット',
      '収納',
      'クリーナー',
      '油膜',
      '水垢',
      'ワックス',
      'モニター',
      'HDMI',
      'スマホホルダー'
    ];

  const hasPositive = positiveKeywords.some(function(keyword) {
    return text.indexOf(keyword) !== -1;
  });

  if (!hasPositive) {
    UA_LAST_RAKUTEN_STATUS = '自動判定で関連商品キーワード不足。楽天バナーあり、または楽天商品キーワードを手動指定してください';
    return false;
  }

  const negativeCount = negativeKeywords.filter(function(keyword) {
    return text.indexOf(keyword) !== -1;
  }).length;

  if (negativeCount >= 3) {
    UA_LAST_RAKUTEN_STATUS = '自動判定で除外語が多いため未挿入（工賃・法規・保証などの商品購入が主解決ではない可能性）';
    return false;
  }

  return true;
}

function uaNormalizeGeneratedTags_(tagsText, rowData, appConfig) {
  const tags = [];
  const seen = {};

  function addTag(value) {
    const tag = String(value || '')
      .replace(/^#+/, '')
      .replace(/[、。|｜/／\n\r\t]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!tag || tag.length > 24) return;
    if (seen[tag]) return;

    seen[tag] = true;
    tags.push(tag);
  }

  String(tagsText || '')
    .split(/[,，、\n]/)
    .forEach(addTag);

  String(rowData && rowData.mainInput || '')
    .replace(/[「」『』【】（）()]/g, ' ')
    .split(/[\s,，、。・|｜/／]+/)
    .filter(function(part) {
      return part.length >= 2 && part.length <= 16;
    })
    .slice(0, 8)
    .forEach(addTag);

  const promptType = appConfig && appConfig.promptType;
  const fallbackTags = promptType === 'home'
    ? ['家づくり', 'マイホーム', '注文住宅', '間取り', '住宅設備', '暮らし', '新築', '後悔対策', '家づくり初心者', '住まい']
    : promptType === 'general'
      ? ['選び方', '比較', '費用', '注意点', 'メリット', 'デメリット', '初心者向け', 'よくある質問', '購入前チェック', '失敗対策']
      : ['車', 'カー用品', '車の悩み', '車メンテナンス', '中古車', '運転', 'カスタム', 'ドライブ', '車選び', 'トラブル対策'];

  fallbackTags.forEach(function(tag) {
    if (tags.length < 10) addTag(tag);
  });

  return tags.slice(0, 10).join(',');
}

function uaFixGeneratedHtml_(html) {
  let text = String(html || '');

  text = text
    .replace(/=&quot;([^&]+?)&quot;/g, "='$1'")
    .replace(/=“([^”]+?)”/g, "='$1'")
    .replace(/=""([^"]+?)""/g, "='$1'")
    .replace(/="([^"]+?)"/g, "='$1'");

  text = text
    .replace(/href=''+(https?:\/\/[^'\s<>]+)''*/g, "href='$1'")
    .replace(/target=''+([^'\s<>]+)''*/g, "target='$1'")
    .replace(/rel=''+([^']+?)''*/g, "rel='$1'")
    .replace(/class=''+([^']+?)''*/g, "class='$1'")
    .replace(/style=''+([^']+?)''*/g, "style='$1'")
    .replace(/<body[^>]*>/gi, '')
    .replace(/<\/body>\s*$/i, '')
    .replace(/<div[^>]*>/gi, '')
    .replace(/<\/div>/gi, '')
    .replace(/<table class='[^']*'>/gi, '<table>')
    .replace(/<table style='[^']*'>/gi, '<table>');

  return text;
}
