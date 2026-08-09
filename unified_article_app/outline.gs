const UA_STRUCTURE_COMPETITOR_SEARCH_MAX_RESULTS = 10;
const UA_STRUCTURE_COMPETITOR_ANALYSIS_MAX_PAGES = 10;
const UA_STRUCTURE_COMPETITOR_DISPLAY_MAX_URLS = 3;
const UA_TREFAI_QUEUE_SHEET_NAME = 'トレファイ連携';
const UA_TREFAI_QUEUE_COLUMNS = {
  jobId: 1,
  status: 2,
  createdAt: 3,
  updatedAt: 4,
  appType: 5,
  sheetName: 6,
  row: 7,
  keyword: 8,
  readerMindMemo: 9,
  message: 10,
  resultJson: 11
};
const UA_TREFAI_STATUS_PENDING = 'pending';
const UA_TREFAI_STATUS_RUNNING = 'running';
const UA_TREFAI_STATUS_DONE = 'done';
const UA_TREFAI_STATUS_ERROR = 'error';

function uaRunArticleStructureFromPanel(data) {
  return uaRunArticleStructureForData_(data || {});
}

function uaRunArticleStructureFromWeb(data) {
  return uaRunArticleStructureForData_(data || {});
}

function uaRunArticleStructureForData_(data) {
  uaSaveActiveRowData(data || {});

  const sheet = uaGetSheetForData_(data || {});
  const row = Number(data && data.row) || sheet.getActiveCell().getRow();
  let rowData = uaBuildRowData_(sheet, row);
  const appConfig = uaGetAppConfigByLabel_(rowData.appType);
  const mainInput = String(rowData.mainInput || '').trim();

  if (!appConfig) {
    throw new Error('記事タイプを取得できません。A列で DRIVE BASE、たくみパパ、汎用記事 のいずれかを選んでください。');
  }

  if (!mainInput) {
    throw new Error((appConfig.inputLabel || 'メインキーワード') + 'を入力してください。');
  }

  if (!String(rowData.readerMindMemo || '').trim()) {
    uaRunReaderMindMemoFromPanel(data || {});
    rowData = uaBuildRowData_(sheet, row);
  }

  const provider = uaGetArticleProvider_();
  uaAssertArticleProviderReady_(provider);

  if (uaShouldUseTrefaiBridge_(rowData, data)) {
    const job = uaCreateTrefaiStructureJob_(sheet, row, rowData, appConfig);
    const nextData = uaBuildRowData_(sheet, row);
    nextData.trefaiJob = job;
    nextData.message = 'トレファイへ上位URL取得を依頼しました。PC側ブリッジが処理すると構成メモまで作成されます。jobId: ' + job.jobId;
    return nextData;
  }

  return uaGenerateArticleStructureForRow_(sheet, row, appConfig, provider, {});
}

function uaGenerateArticleStructureForRow_(sheet, row, appConfig, provider, options) {
  let rowData = uaBuildRowData_(sheet, row);
  const readyProvider = provider || uaGetArticleProvider_();
  uaAssertArticleProviderReady_(readyProvider);

  const competitorPages = uaFetchStructureCompetitorPages_(rowData, appConfig, options && options.competitorUrls);
  uaSaveAutoCompetitorUrls_(sheet, row, rowData, competitorPages);
  rowData = uaBuildRowData_(sheet, row);

  const promptText = uaBuildArticleStructurePrompt_(rowData, appConfig, competitorPages);
  const result = uaCallArticleStructureJson_(promptText, readyProvider);
  const resultJson = result && result.data;

  if (!resultJson || !resultJson.structure_memo || !resultJson.article_outline) {
    throw new Error('記事構成の生成結果に必要な項目がありません。');
  }

  const structureMemo = uaFormatArticleStructureMemo_(resultJson, competitorPages);

  sheet.getRange(row, UA_COLUMNS.structureMemo).setValue(structureMemo);
  sheet.getRange(row, UA_COLUMNS.createdAt).setValue(new Date());
  sheet.getRange(row, UA_COLUMNS.generationModel).setValue(uaFormatModelLabel_(readyProvider, result && result.model));
  SpreadsheetApp.flush();

  const nextData = uaBuildRowData_(sheet, row);
  nextData.message = (options && options.messagePrefix ? options.messagePrefix : '記事構成を作成しました。') + '競合取得件数: ' + competitorPages.length;
  return nextData;
}

function uaShouldUseTrefaiBridge_(rowData, data) {
  if (data && data.forceGasSearch) return false;
  if (!uaIsTrefaiBridgeEnabled_()) return false;

  const currentUrls = [
    rowData.competitorUrl1,
    rowData.competitorUrl2,
    rowData.competitorUrl3
  ].map(function(url) {
    return String(url || '').trim();
  }).filter(Boolean);

  return currentUrls.length < 3;
}

function uaIsTrefaiBridgeEnabled_() {
  const value = String(PropertiesService.getScriptProperties().getProperty('UA_TREFAI_BRIDGE_ENABLED') || '').trim().toLowerCase();
  return value === 'true' || value === '1' || value === 'on';
}

function uaCreateTrefaiStructureJob_(sheet, row, rowData, appConfig) {
  const queueSheet = uaEnsureTrefaiQueueSheet_();
  const keyword = String(rowData.mainInput || '').trim();
  const appType = String(appConfig.label || rowData.appType || '').trim();
  const existing = uaFindOpenTrefaiJob_(queueSheet, appType, row, keyword);

  if (existing) {
    return existing;
  }

  const now = new Date();
  const jobId = Utilities.getUuid();
  queueSheet.appendRow([
    jobId,
    UA_TREFAI_STATUS_PENDING,
    now,
    now,
    appType,
    sheet.getName(),
    row,
    keyword,
    String(rowData.readerMindMemo || '').trim(),
    '',
    ''
  ]);
  SpreadsheetApp.flush();

  return {
    jobId: jobId,
    status: UA_TREFAI_STATUS_PENDING,
    row: row,
    appType: appType,
    keyword: keyword
  };
}

function uaFindOpenTrefaiJob_(queueSheet, appType, row, keyword) {
  const lastRow = queueSheet.getLastRow();
  if (lastRow < 2) return null;

  const values = queueSheet.getRange(2, 1, lastRow - 1, UA_TREFAI_QUEUE_COLUMNS.resultJson).getValues();
  for (let index = values.length - 1; index >= 0; index--) {
    const item = values[index];
    const status = String(item[UA_TREFAI_QUEUE_COLUMNS.status - 1] || '').trim();
    const itemAppType = String(item[UA_TREFAI_QUEUE_COLUMNS.appType - 1] || '').trim();
    const itemRow = Number(item[UA_TREFAI_QUEUE_COLUMNS.row - 1] || 0);
    const itemKeyword = String(item[UA_TREFAI_QUEUE_COLUMNS.keyword - 1] || '').trim();

    if (
      (status === UA_TREFAI_STATUS_PENDING || status === UA_TREFAI_STATUS_RUNNING) &&
      itemAppType === appType &&
      itemRow === row &&
      itemKeyword === keyword
    ) {
      return {
        jobId: String(item[UA_TREFAI_QUEUE_COLUMNS.jobId - 1] || '').trim(),
        status: status,
        row: itemRow,
        appType: itemAppType,
        keyword: itemKeyword
      };
    }
  }

  return null;
}

function uaGetLatestTrefaiJobStatus_(appType, row, keyword) {
  const queueSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(UA_TREFAI_QUEUE_SHEET_NAME);
  if (!queueSheet || queueSheet.getLastRow() < 2) return null;

  const targetAppType = String(appType || '').trim();
  const targetRow = Number(row || 0);
  const targetKeyword = String(keyword || '').trim();
  const values = queueSheet.getRange(2, 1, queueSheet.getLastRow() - 1, UA_TREFAI_QUEUE_COLUMNS.resultJson).getValues();

  for (let index = values.length - 1; index >= 0; index--) {
    const item = values[index];
    if (String(item[UA_TREFAI_QUEUE_COLUMNS.appType - 1] || '').trim() !== targetAppType) continue;
    if (Number(item[UA_TREFAI_QUEUE_COLUMNS.row - 1] || 0) !== targetRow) continue;
    if (String(item[UA_TREFAI_QUEUE_COLUMNS.keyword - 1] || '').trim() !== targetKeyword) continue;

    const updatedAt = item[UA_TREFAI_QUEUE_COLUMNS.updatedAt - 1];
    return {
      jobId: String(item[UA_TREFAI_QUEUE_COLUMNS.jobId - 1] || '').trim(),
      status: String(item[UA_TREFAI_QUEUE_COLUMNS.status - 1] || '').trim(),
      updatedAt: updatedAt ? String(updatedAt) : '',
      message: String(item[UA_TREFAI_QUEUE_COLUMNS.message - 1] || '').trim()
    };
  }

  return null;
}

function uaEnsureTrefaiQueueSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(UA_TREFAI_QUEUE_SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(UA_TREFAI_QUEUE_SHEET_NAME);
    sheet.hideSheet();
  }

  const headers = [
    'jobId',
    'status',
    'createdAt',
    'updatedAt',
    'appType',
    'sheetName',
    'row',
    'keyword',
    'readerMindMemo',
    'message',
    'resultJson'
  ];

  const currentHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  if (currentHeaders.join('\t') !== headers.join('\t')) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function uaGetNextTrefaiStructureJob_(payload) {
  uaAssertLocalBridgeToken_(payload);

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = uaEnsureTrefaiQueueSheet_();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return {
        ok: true,
        job: null,
        message: '待機中のトレファイ依頼はありません。'
      };
    }

    const values = sheet.getRange(2, 1, lastRow - 1, UA_TREFAI_QUEUE_COLUMNS.resultJson).getValues();
    for (let index = 0; index < values.length; index++) {
      const item = values[index];
      const status = String(item[UA_TREFAI_QUEUE_COLUMNS.status - 1] || '').trim();
      if (status !== UA_TREFAI_STATUS_PENDING) continue;

      const rowNumber = index + 2;
      sheet.getRange(rowNumber, UA_TREFAI_QUEUE_COLUMNS.status).setValue(UA_TREFAI_STATUS_RUNNING);
      sheet.getRange(rowNumber, UA_TREFAI_QUEUE_COLUMNS.updatedAt).setValue(new Date());
      sheet.getRange(rowNumber, UA_TREFAI_QUEUE_COLUMNS.message).setValue('PC側トレファイの起動を確認しました。上位URLを取得中です。');
      SpreadsheetApp.flush();

      return {
        ok: true,
        job: {
          jobId: String(item[UA_TREFAI_QUEUE_COLUMNS.jobId - 1] || '').trim(),
          appType: String(item[UA_TREFAI_QUEUE_COLUMNS.appType - 1] || '').trim(),
          sheetName: String(item[UA_TREFAI_QUEUE_COLUMNS.sheetName - 1] || '').trim(),
          row: Number(item[UA_TREFAI_QUEUE_COLUMNS.row - 1] || 0),
          keyword: String(item[UA_TREFAI_QUEUE_COLUMNS.keyword - 1] || '').trim(),
          readerMindMemo: String(item[UA_TREFAI_QUEUE_COLUMNS.readerMindMemo - 1] || '').trim()
        }
      };
    }

    return {
      ok: true,
      job: null,
      message: '待機中のトレファイ依頼はありません。'
    };
  } finally {
    lock.releaseLock();
  }
}

function uaCompleteTrefaiStructureJob_(payload) {
  uaAssertLocalBridgeToken_(payload);

  const jobId = String(payload && payload.jobId || '').trim();
  if (!jobId) {
    throw new Error('jobId がありません。');
  }

  const queueSheet = uaEnsureTrefaiQueueSheet_();
  const queueRow = uaFindTrefaiJobRowById_(queueSheet, jobId);
  if (!queueRow) {
    throw new Error('トレファイ依頼が見つかりません: ' + jobId);
  }

  const status = String(payload && payload.status || UA_TREFAI_STATUS_DONE).trim();
  const resultJson = JSON.stringify(payload || {});
  queueSheet.getRange(queueRow, UA_TREFAI_QUEUE_COLUMNS.updatedAt).setValue(new Date());
  queueSheet.getRange(queueRow, UA_TREFAI_QUEUE_COLUMNS.resultJson).setValue(resultJson);

  if (status === UA_TREFAI_STATUS_ERROR || payload.error) {
    queueSheet.getRange(queueRow, UA_TREFAI_QUEUE_COLUMNS.status).setValue(UA_TREFAI_STATUS_ERROR);
    queueSheet.getRange(queueRow, UA_TREFAI_QUEUE_COLUMNS.message).setValue(String(payload.error || payload.message || 'トレファイ取得に失敗しました。'));
    SpreadsheetApp.flush();
    return {
      ok: false,
      jobId: jobId,
      message: 'トレファイ取得エラーを記録しました。'
    };
  }

  const appConfig = uaGetAppConfigByLabel_(payload && payload.appType);
  if (!appConfig || !appConfig.articleSheetName) {
    throw new Error('appType は DRIVE BASE、たくみパパ、汎用記事 のいずれかを指定してください。');
  }

  const articleSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(appConfig.articleSheetName);
  if (!articleSheet) {
    throw new Error('「' + appConfig.articleSheetName + '」シートが見つかりません。');
  }

  const row = Number(payload && payload.row || 0);
  if (!row || row < 2) {
    throw new Error('記事行 row が不正です。');
  }

  const urls = uaNormalizeTrefaiUrls_(payload && (payload.competitorUrls || payload.urls));
  queueSheet.getRange(queueRow, UA_TREFAI_QUEUE_COLUMNS.status).setValue(UA_TREFAI_STATUS_RUNNING);
  queueSheet.getRange(queueRow, UA_TREFAI_QUEUE_COLUMNS.updatedAt).setValue(new Date());
  queueSheet.getRange(queueRow, UA_TREFAI_QUEUE_COLUMNS.message).setValue('上位URLを' + urls.length + '件取得しました。競合ページを確認して記事構成を生成中です。');
  SpreadsheetApp.flush();
  uaSaveTrefaiUrlsToArticleRow_(articleSheet, row, urls);

  const provider = uaGetArticleProvider_();
  const data = uaGenerateArticleStructureForRow_(articleSheet, row, appConfig, provider, {
    messagePrefix: 'トレファイURLを使って記事構成を作成しました。',
    competitorUrls: urls
  });

  queueSheet.getRange(queueRow, UA_TREFAI_QUEUE_COLUMNS.status).setValue(UA_TREFAI_STATUS_DONE);
  queueSheet.getRange(queueRow, UA_TREFAI_QUEUE_COLUMNS.message).setValue('記事構成作成まで完了しました。');
  SpreadsheetApp.flush();

  return {
    ok: true,
    jobId: jobId,
    row: row,
    appType: appConfig.label,
    savedUrls: urls,
    message: data.message
  };
}

function uaFindTrefaiJobRowById_(queueSheet, jobId) {
  const lastRow = queueSheet.getLastRow();
  if (lastRow < 2) return 0;

  const values = queueSheet.getRange(2, UA_TREFAI_QUEUE_COLUMNS.jobId, lastRow - 1, 1).getValues();
  for (let index = 0; index < values.length; index++) {
    if (String(values[index][0] || '').trim() === jobId) {
      return index + 2;
    }
  }

  return 0;
}

function uaNormalizeTrefaiUrls_(urls) {
  if (!Array.isArray(urls)) return [];

  const results = [];
  urls.forEach(function(url) {
    const value = String(url || '').trim();
    if (!uaIsUsefulCompetitorUrl_(value)) return;
    if (results.indexOf(value) !== -1) return;
    results.push(value);
  });

  return results.slice(0, UA_STRUCTURE_COMPETITOR_ANALYSIS_MAX_PAGES);
}

function uaSaveTrefaiUrlsToArticleRow_(sheet, row, urls) {
  const currentUrls = sheet.getRange(row, UA_COLUMNS.competitorUrl1, 1, UA_STRUCTURE_COMPETITOR_DISPLAY_MAX_URLS).getValues()[0].map(function(url) {
    return String(url || '').trim();
  });
  const nextUrls = currentUrls.slice();

  urls.forEach(function(url) {
    if (nextUrls.indexOf(url) !== -1) return;
    const emptyIndex = nextUrls.findIndex(function(value) { return !value; });
    if (emptyIndex === -1) return;
    nextUrls[emptyIndex] = url;
  });

  sheet.getRange(row, UA_COLUMNS.competitorUrl1, 1, UA_STRUCTURE_COMPETITOR_DISPLAY_MAX_URLS).setValues([nextUrls]);
}

function uaAssertArticleProviderReady_(provider) {
  if (provider === 'gemini' && !uaGetGeminiApiKey_()) {
    throw new Error('Gemini APIキーが設定されていません。');
  }

  if (provider === 'openai' && !uaGetOpenAiApiKey_()) {
    throw new Error('OpenAI APIキーが設定されていません。');
  }

  if (provider === 'claude' && !uaGetClaudeApiKey_()) {
    throw new Error('Claude APIキーが設定されていません。');
  }
}

function uaCallArticleStructureJson_(promptText, provider) {
  if (provider === 'claude') {
    return uaCallClaudeJson_(promptText, 9000);
  }

  if (provider === 'openai') {
    return uaCallOpenAiJson_(promptText, 9000);
  }

  return uaCallGeminiJson_(promptText, 9000, 512);
}

function uaFetchStructureCompetitorPages_(rowData, appConfig, preferredUrls) {
  const manualUrls = [
    rowData.competitorUrl1,
    rowData.competitorUrl2,
    rowData.competitorUrl3
  ].map(function(url) {
    return String(url || '').trim();
  }).filter(Boolean);

  const normalizedPreferredUrls = uaNormalizeTrefaiUrls_(preferredUrls || []);
  const query = uaBuildReaderMindSearchQuery_(rowData.mainInput, appConfig);
  const searchUrls = normalizedPreferredUrls.length
    ? []
    : manualUrls.length >= UA_STRUCTURE_COMPETITOR_DISPLAY_MAX_URLS
      ? []
      : uaFetchSearchResultUrls_(query, UA_STRUCTURE_COMPETITOR_SEARCH_MAX_RESULTS);
  const urls = [];

  normalizedPreferredUrls.concat(manualUrls).concat(searchUrls).forEach(function(url) {
    if (!url || urls.indexOf(url) !== -1) return;
    urls.push(url);
  });

  return uaFetchCompetitorPageInfos_(urls.slice(0, UA_STRUCTURE_COMPETITOR_ANALYSIS_MAX_PAGES));
}

function uaSaveAutoCompetitorUrls_(sheet, row, rowData, pages) {
  const currentUrls = [
    rowData.competitorUrl1,
    rowData.competitorUrl2,
    rowData.competitorUrl3
  ].map(function(url) {
    return String(url || '').trim();
  });

  const nextUrls = currentUrls.slice();
  let pageIndex = 0;

  for (let i = 0; i < nextUrls.length; i++) {
    if (nextUrls[i]) continue;

    while (pageIndex < pages.length) {
      const url = String(pages[pageIndex].url || '').trim();
      pageIndex++;

      if (url && nextUrls.indexOf(url) === -1) {
        nextUrls[i] = url;
        break;
      }
    }
  }

  sheet.getRange(row, UA_COLUMNS.competitorUrl1, 1, UA_STRUCTURE_COMPETITOR_DISPLAY_MAX_URLS).setValues([nextUrls]);
}

function uaFetchSearchResultUrls_(query, maxCount) {
  const urls = [];
  const searchUrls = [
    'https://www.bing.com/search?q=' + encodeURIComponent(query) + '&cc=jp&mkt=ja-JP',
    'https://search.yahoo.co.jp/search?p=' + encodeURIComponent(query)
  ];

  searchUrls.forEach(function(searchUrl) {
    if (urls.length >= maxCount) return;

    try {
      const html = uaFetchSearchHtml_(searchUrl);
      uaExtractSearchResultUrls_(html).forEach(function(url) {
        if (urls.length >= maxCount) return;
        if (urls.indexOf(url) !== -1) return;
        urls.push(url);
      });
    } catch (e) {
      // 検索ページが取れない場合は次の検索先へ進む
    }
  });

  return urls.slice(0, maxCount);
}

function uaFetchSearchHtml_(url) {
  const response = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    followRedirects: true,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'ja,en;q=0.5'
    }
  });

  if (response.getResponseCode() >= 400) {
    return '';
  }

  return response.getContentText('UTF-8');
}

function uaExtractSearchResultUrls_(html) {
  const urls = [];
  const pattern = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
  let match;

  while ((match = pattern.exec(String(html || ''))) !== null) {
    const url = uaNormalizeSearchResultUrl_(match[1]);
    if (!uaIsUsefulCompetitorUrl_(url)) continue;
    if (urls.indexOf(url) === -1) urls.push(url);
  }

  return urls;
}

function uaNormalizeSearchResultUrl_(rawUrl) {
  let url = String(rawUrl || '')
    .replace(/&amp;/g, '&')
    .trim();

  if (url.indexOf('/url?') === 0) {
    url = 'https://www.bing.com' + url;
  }

  try {
    const decoded = decodeURIComponent(url);
    const qMatch = decoded.match(/[?&](?:q|u|url)=((?:https?:\/\/)[^&]+)/i);
    if (qMatch && qMatch[1]) return qMatch[1];
  } catch (e) {
    // デコードできないURLは元のURLを使う
  }

  return url;
}

function uaIsUsefulCompetitorUrl_(url) {
  const text = String(url || '').toLowerCase();
  if (!/^https?:\/\//i.test(text)) return false;
  if (text.indexOf('google.') !== -1) return false;
  if (text.indexOf('bing.com') !== -1) return false;
  if (text.indexOf('search.yahoo.co.jp') !== -1) return false;
  if (text.indexOf('chiebukuro.yahoo.co.jp') !== -1) return false;
  if (text.indexOf('oshiete.goo.ne.jp') !== -1) return false;
  if (text.indexOf('okwave.jp') !== -1) return false;
  if (text.indexOf('komachi.yomiuri.co.jp') !== -1) return false;
  if (text.indexOf('ebimayo5.com') !== -1) return false;
  if (/[?#&](utm_|yclid|gclid)/i.test(text)) return false;
  if (/\.(jpg|jpeg|png|gif|webp|svg|pdf)(?:[?#].*)?$/i.test(text)) return false;
  return true;
}

function uaBuildArticleStructurePrompt_(rowData, appConfig, competitorPages) {
  const competitorText = competitorPages.length === 0
    ? '検索結果から競合ページを取得できませんでした。読者心理メモと入力内容から、競合で扱われやすい論点を推定してください。ただし未確認情報を事実として断定しないでください。'
    : competitorPages.map(function(item, index) {
      return [
        '--- 競合候補 ' + (index + 1) + ' ---',
        'URL: ' + item.url,
        '取得状況: ' + (item.fetchStatus || '不明'),
        'タイトル: ' + (item.title || '取得できませんでした'),
        'メタディスクリプション: ' + (item.description || 'なし'),
        '見出し構成:',
        (item.headings && item.headings.length ? item.headings.join('\n') : '取得できませんでした'),
        '本文抽出:',
        item.bodyText || '取得できませんでした',
        '抽出キーワード: ' + (item.keywords || 'なし')
      ].join('\n');
    }).join('\n\n');

  return `
あなたはSEO記事の編集設計者です。
本文はまだ書かず、記事本文の手前に必要な「読者心理メモ」「競合分析メモ」「構成メモ」「本文手前の記事構成」だけを作成してください。

記事タイプ: ${appConfig ? appConfig.label : '未指定'}
入力内容:
${rowData.mainInput}

検索ボリューム: ${rowData.volume || '未入力'}

${uaBuildAutomaticArticlePolicyPrompt_(rowData, appConfig)}

読者心理メモ:
${rowData.readerMindMemo || '未入力'}

競合候補の取得結果:
${competitorText}

【作業順序】
1. 読者心理メモから、顕在ニーズ、潜在ニーズ、読者の葛藤、本文で優先して扱う材料、FAQに回す材料、今回は主役にしない材料を整理する。
2. 競合候補から、上位記事で共通して扱われる必須論点、公式サービス名や費用・条件などの確認事項、競合に薄い不足論点を整理する。
3. 読者心理メモと競合分析を突き合わせ、読者の不安がほどける順番にH2/H3構成を作る。
4. 競合記事の見出し順や言い回しを丸写ししない。論点だけを抽象化し、記事タイプに合う判断軸へ作り直す。
5. 本文で事実として断定できない情報は、要確認または主役にしない材料へ回す。
6. DRIVE BASE/たくみパパ/汎用記事として、単なる上位記事の要約ではなく、読者が次に何を確認すればよいか分かる構成にする。
7. 用品・道具・アイテム・グッズ・商品候補だけを扱う独立H2は、商品選びが検索意図上の重要な解決策で、紹介カテゴリと一致する楽天バナーを後から同じH2内へ挿入できる場合だけ作る。
8. 用品情報が補足にすぎない場合は、既存の関連H2へ1〜3段落で統合する。費用、工賃、店舗対応、施工、制度、安全、法規、保証が主題の記事へ、収益化やH2数合わせのためだけに用品H2を追加しない。
9. 適切な楽天商品検索キーワードとして使える一般的な商品カテゴリを特定できない場合は、用品専用H2を作らない。

【出力内容】
・競合分析メモは、本文にはそのまま出さない内部メモとして作る。
・article_outline は本文生成直前に使う設計図として、H2/H3、各セクションで答えること、使う材料、注意点、FAQに回す内容を含める。
・本文HTML、タイトル案、メタディスクリプション、タグはまだ作らない。

回答は必ず以下のJSON形式でのみ出力してください。Markdownやコードブロックは禁止です。
{
  "competitor_analysis_memo": "【上位記事で共通して扱われている内容】...\\n【上位記事で不足している内容】...\\n【公式情報・金額・条件など確認したい内容】...\\n【コピー防止のため抽象化する論点】...",
  "structure_memo": "【読者心理から拾った材料】...\\n【競合・参考URLから拾った材料】...\\n【本文に入れる材料】...\\n【FAQに回す材料】...\\n【今回は主役にしない材料】...\\n【見出し構成に使った判断】...",
  "article_outline": "【確定したH2/H3構成】\\nH2: ...\\n- H3: ...\\n  使う材料: ...\\n  答えること: ...\\n  注意点: ...\\n【本文生成時の優先事項】..."
}
`;
}

function uaFormatArticleStructureMemo_(resultJson, competitorPages) {
  const referenceUrls = uaFormatStructureReferenceUrls_(competitorPages);
  return [
    referenceUrls,
    '',
    '【自動競合分析メモ】',
    String(resultJson.competitor_analysis_memo || '').trim(),
    '',
    String(resultJson.structure_memo || '').trim(),
    '',
    '【本文手前の記事構成】',
    String(resultJson.article_outline || '').trim()
  ].join('\n').trim();
}

function uaFormatStructureReferenceUrls_(competitorPages) {
  const pages = Array.isArray(competitorPages) ? competitorPages : [];
  const lines = pages.map(function(item, index) {
    const url = String(item && item.url || '').trim();
    if (!url) return '';
    const title = String(item && item.title || '').trim();
    return (index + 1) + '. ' + url + (title ? '｜' + title : '');
  }).filter(Boolean);

  if (lines.length === 0) {
    return '【記事作成のヒントに用いた上位URL】\n取得できた上位URLはありません。';
  }

  return '【記事作成のヒントに用いた上位URL】\n' + lines.join('\n');
}
