function doGet() {
  return HtmlService
    .createHtmlOutputFromFile('ua_web_app')
    .setTitle(UA_APP_NAME)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function uaGetWebAppBootData() {
  const options = uaGetPanelOptions();
  options.candidates = uaListCandidatesForWeb('DRIVE BASE', '');
  return options;
}

function doPost(e) {
  try {
    const payload = JSON.parse(e && e.postData && e.postData.contents || '{}');

    if (payload.action === 'import_competitor_analysis') {
      return uaJsonResponse_(uaImportCompetitorAnalysisFromLocal_(payload));
    }

    if (payload.action === 'get_trefai_job') {
      return uaJsonResponse_(uaGetNextTrefaiStructureJob_(payload));
    }

    if (payload.action === 'complete_trefai_job') {
      return uaJsonResponse_(uaCompleteTrefaiStructureJob_(payload));
    }

    return uaJsonResponse_({
      ok: false,
      error: '未対応のactionです。'
    });
  } catch (error) {
    return uaJsonResponse_({
      ok: false,
      error: String(error && error.message ? error.message : error)
    });
  }
}

function uaJsonResponse_(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

function uaImportCompetitorAnalysisFromLocal_(payload) {
  uaAssertLocalBridgeToken_(payload);

  const appConfig = uaGetAppConfigByLabel_(payload && payload.appType);
  if (!appConfig || !appConfig.articleSheetName) {
    throw new Error('appType は DRIVE BASE、たくみパパ、汎用記事 のいずれかを指定してください。');
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(appConfig.articleSheetName);
  if (!sheet) {
    throw new Error('「' + appConfig.articleSheetName + '」シートが見つかりません。');
  }

  const row = uaResolveArticleRowForLocalImport_(sheet, appConfig, payload);
  const urls = uaNormalizeLocalImportUrls_(payload && (payload.competitorUrls || payload.urls));
  const currentUrls = sheet.getRange(row, UA_COLUMNS.competitorUrl1, 1, 3).getValues()[0];
  const nextUrls = currentUrls.map(function(url) {
    return String(url || '').trim();
  });

  urls.forEach(function(url) {
    const emptyIndex = nextUrls.findIndex(function(value) { return !value; });
    if (emptyIndex === -1 || nextUrls.indexOf(url) !== -1) return;
    nextUrls[emptyIndex] = url;
  });

  sheet.getRange(row, UA_COLUMNS.competitorUrl1, 1, 3).setValues([nextUrls]);

  const localMemo = uaBuildLocalImportStructureMemo_(payload);
  if (localMemo) {
    const currentMemo = String(sheet.getRange(row, UA_COLUMNS.structureMemo).getValue() || '').trim();
    sheet.getRange(row, UA_COLUMNS.structureMemo).setValue([currentMemo, localMemo].filter(Boolean).join('\n\n'));
  }

  if (payload.readerMindMemo) {
    sheet.getRange(row, UA_COLUMNS.readerMindMemo).setValue(String(payload.readerMindMemo || '').trim());
  }

  sheet.getRange(row, UA_COLUMNS.createdAt).setValue(new Date());
  SpreadsheetApp.flush();

  return {
    ok: true,
    row: row,
    appType: appConfig.label,
    savedUrls: nextUrls.filter(Boolean),
    message: 'ローカル競合分析を取り込みました。'
  };
}

function uaAssertLocalBridgeToken_(payload) {
  const expectedToken = String(PropertiesService.getScriptProperties().getProperty('UA_LOCAL_IMPORT_TOKEN') || '').trim();
  const token = String(payload && payload.token || '').trim();

  if (!expectedToken) {
    throw new Error('UA_LOCAL_IMPORT_TOKEN が未設定です。ローカル連携用トークンをスクリプトプロパティに設定してください。');
  }

  if (token !== expectedToken) {
    throw new Error('ローカル連携トークンが一致しません。');
  }
}

function uaResolveArticleRowForLocalImport_(sheet, appConfig, payload) {
  const row = Number(payload && payload.row || 0);
  if (row > 1) return row;

  const keyword = String(payload && (payload.keyword || payload.mainInput) || '').trim();
  if (!keyword) {
    throw new Error('row または keyword を指定してください。');
  }

  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    const values = sheet.getRange(2, 1, lastRow - 1, UA_COLUMNS.mainInput).getDisplayValues();

    for (let index = values.length - 1; index >= 0; index--) {
      const rowAppType = String(values[index][UA_COLUMNS.appType - 1] || '').trim();
      const rowKeyword = String(values[index][UA_COLUMNS.mainInput - 1] || '').trim();

      if (rowAppType === appConfig.label && rowKeyword === keyword) {
        return index + 2;
      }
    }
  }

  const nextRow = uaFindNextArticleRow_(sheet);
  const values = new Array(UA_ARTICLE_COLUMN_COUNT).fill('');
  values[UA_COLUMNS.appType - 1] = appConfig.label;
  values[UA_COLUMNS.mainInput - 1] = keyword;
  sheet.getRange(nextRow, 1, 1, UA_ARTICLE_COLUMN_COUNT).setValues([values]);

  return nextRow;
}

function uaNormalizeLocalImportUrls_(urls) {
  if (!Array.isArray(urls)) return [];

  const results = [];
  urls.forEach(function(url) {
    const value = String(url || '').trim();
    if (!/^https?:\/\//i.test(value)) return;
    if (results.indexOf(value) !== -1) return;
    results.push(value);
  });

  return results.slice(0, UA_STRUCTURE_COMPETITOR_ANALYSIS_MAX_PAGES || 10);
}

function uaBuildLocalImportStructureMemo_(payload) {
  const parts = [];
  const urls = uaNormalizeLocalImportUrls_(payload && (payload.competitorUrls || payload.urls));
  const competitorMemo = String(payload && payload.competitorAnalysisMemo || '').trim();
  const structureMemo = String(payload && payload.structureMemo || '').trim();
  const articleOutline = String(payload && payload.articleOutline || '').trim();

  if (urls.length) {
    parts.push('【記事作成のヒントに用いた上位URL】\n' + urls.map(function(url, index) {
      return (index + 1) + '. ' + url;
    }).join('\n'));
  }

  if (competitorMemo) {
    parts.push('【ローカルSelenium競合分析メモ】\n' + competitorMemo);
  }

  if (structureMemo) {
    parts.push('【ローカル構成メモ】\n' + structureMemo);
  }

  if (articleOutline) {
    parts.push('【ローカル本文手前の記事構成】\n' + articleOutline);
  }

  return parts.join('\n\n').trim();
}

function uaListCandidatesForWeb(appTypeLabel, query) {
  const appConfig = uaGetAppConfigByLabel_(appTypeLabel);

  if (!appConfig || !appConfig.candidateSheetName) {
    return [];
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(appConfig.candidateSheetName);

  if (!sheet || sheet.getLastRow() < 2) {
    return [];
  }

  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  const values = sheet.getRange(2, 1, lastRow - 1, lastColumn).getDisplayValues();
  const cleanQuery = String(query || '').toLowerCase().trim();
  const results = [];

  values.forEach(function(row, index) {
    const keyword = String(row[UA_CANDIDATE_COLUMNS.keyword - 1] || '').trim();
    if (!keyword) return;

    const status = String(row[UA_CANDIDATE_COLUMNS.status - 1] || '').trim();
    const haystack = row.join(' ').toLowerCase();

    if (cleanQuery && haystack.indexOf(cleanQuery) === -1) {
      return;
    }

    results.push({
      row: index + 2,
      status: status,
      keyword: keyword,
      volume: row[UA_CANDIDATE_COLUMNS.volume - 1] || '',
      meta: row.slice(3),
      isSent: status === UA_CANDIDATE_STATUS_SENT
    });
  });

  return results.slice(0, 500);
}

function uaCreateArticleFromCandidateForWeb(appTypeLabel, candidateRow) {
  const appConfig = uaGetAppConfigByLabel_(appTypeLabel);

  if (!appConfig || !appConfig.candidateSheetName) {
    throw new Error('この記事タイプには候補シートがありません。');
  }

  const candidateSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(appConfig.candidateSheetName);

  if (!candidateSheet) {
    throw new Error('「' + appConfig.candidateSheetName + '」シートが見つかりません。');
  }

  return uaCreateArticleFromCandidateRow_(candidateSheet, appConfig, Number(candidateRow));
}

function uaGetCandidateSheetUrlForWeb(appTypeLabel) {
  const appConfig = uaGetAppConfigByLabel_(appTypeLabel);

  if (!appConfig || !appConfig.candidateSheetName) {
    throw new Error('この記事タイプには候補シートがありません。');
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(appConfig.candidateSheetName);

  if (!sheet) {
    throw new Error('「' + appConfig.candidateSheetName + '」シートが見つかりません。');
  }

  sheet.showColumns(1, sheet.getMaxColumns());
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(3);

  return {
    url: ss.getUrl() + '#gid=' + sheet.getSheetId(),
    message: appConfig.label + 'の候補シートを開きます。行を選んだらWebアプリに戻って「スプシの選択行を反映」を押してください。'
  };
}


function uaGetArticleSheetUrlForWeb(appTypeLabel) {
  const appConfig = uaGetAppConfigByLabel_(appTypeLabel);

  if (!appConfig || !appConfig.articleSheetName) {
    throw new Error('\u3053\u306e\u8a18\u4e8b\u30bf\u30a4\u30d7\u306b\u306f\u8a18\u4e8b\u30b7\u30fc\u30c8\u304c\u3042\u308a\u307e\u305b\u3093\u3002');
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(appConfig.articleSheetName);

  if (!sheet) {
    throw new Error('"' + appConfig.articleSheetName + '" \u30b7\u30fc\u30c8\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093\u3002');
  }

  sheet.showColumns(1, sheet.getMaxColumns());
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(2);

  return {
    url: ss.getUrl() + '#gid=' + sheet.getSheetId(),
    message: appConfig.label + '\u306e\u8a18\u4e8b\u30b7\u30fc\u30c8\u3092\u958b\u304d\u307e\u3057\u305f\u3002\u884c\u3092\u9078\u3093\u3067\u304b\u3089\u300c\u8a18\u4e8b\u30b7\u30fc\u30c8\u306e\u9078\u629e\u884c\u3092\u53cd\u6620\u300d\u3092\u62bc\u3057\u3066\u304f\u3060\u3055\u3044\u3002'
  };
}

function uaLoadArticleFromActiveArticleSheetForWeb(appTypeLabel) {
  const appConfig = uaGetAppConfigByLabel_(appTypeLabel);

  if (!appConfig || !appConfig.articleSheetName) {
    throw new Error('\u3053\u306e\u8a18\u4e8b\u30bf\u30a4\u30d7\u306b\u306f\u8a18\u4e8b\u30b7\u30fc\u30c8\u304c\u3042\u308a\u307e\u305b\u3093\u3002');
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const activeSheet = ss.getActiveSheet();
  const articleSheet = ss.getSheetByName(appConfig.articleSheetName);

  if (!articleSheet) {
    throw new Error('"' + appConfig.articleSheetName + '" \u30b7\u30fc\u30c8\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093\u3002');
  }

  if (activeSheet.getName() === articleSheet.getName() && activeSheet.getActiveCell().getRow() > 1) {
    return uaGetArticleRowForWeb(appConfig.label, activeSheet.getActiveCell().getRow());
  }

  throw new Error('\u5148\u306b "' + appConfig.articleSheetName + '" \u30b7\u30fc\u30c8\u3092\u958b\u304d\u3001\u53cd\u6620\u3057\u305f\u3044\u884c\u3092\u9078\u3093\u3067\u304b\u3089\u3082\u3046\u4e00\u5ea6\u5b9f\u884c\u3057\u3066\u304f\u3060\u3055\u3044\u3002');
}
function uaCreateArticleFromActiveCandidateForWeb(appTypeLabel) {
  const appConfig = uaGetAppConfigByLabel_(appTypeLabel);

  if (!appConfig || !appConfig.candidateSheetName) {
    throw new Error('この記事タイプには候補シートがありません。');
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const activeSheet = ss.getActiveSheet();
  const candidateSheet = ss.getSheetByName(appConfig.candidateSheetName);

  if (!candidateSheet) {
    throw new Error('「' + appConfig.candidateSheetName + '」シートが見つかりません。');
  }

  if (activeSheet.getName() === candidateSheet.getName() && activeSheet.getActiveCell().getRow() > 1) {
    return uaCreateArticleFromCandidateRow_(candidateSheet, appConfig, activeSheet.getActiveCell().getRow());
  }

  const props = PropertiesService.getScriptProperties();
  const lastAppKey = props.getProperty('UA_LAST_CANDIDATE_APP_KEY');
  const lastSheetName = props.getProperty('UA_LAST_CANDIDATE_SHEET_NAME');
  const lastRow = Number(props.getProperty('UA_LAST_CANDIDATE_ROW') || 0);

  if (lastAppKey === appConfig.key && lastSheetName === candidateSheet.getName() && lastRow > 1) {
    return uaCreateArticleFromCandidateRow_(candidateSheet, appConfig, lastRow);
  }

  throw new Error('先に「' + appConfig.candidateSheetName + '」シートでキーワード行を選択してください。選択が反映されない場合は、行番号入力を使ってください。');
}

function uaCreateArticleFromCandidateRow_(candidateSheet, appConfig, row) {
  if (!row || row === 1) {
    throw new Error('候補データの行を選択してください。');
  }

  const keyword = String(candidateSheet.getRange(row, UA_CANDIDATE_COLUMNS.keyword).getValue() || '').trim();
  const volume = candidateSheet.getRange(row, UA_CANDIDATE_COLUMNS.volume).getValue() || '';
  const candidateStatus = String(candidateSheet.getRange(row, UA_CANDIDATE_COLUMNS.status).getValue() || '').trim();

  if (!keyword) {
    throw new Error('候補行のキーワードが空です。');
  }

  if (candidateStatus === UA_CANDIDATE_STATUS_SENT) {
    return uaLoadSentCandidateArticleRow_(appConfig, keyword, volume);
  }

  const articleSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(appConfig.articleSheetName);

  if (!articleSheet) {
    throw new Error('「' + appConfig.articleSheetName + '」シートが見つかりません。');
  }

  const articleRow = uaFindNextArticleRow_(articleSheet);
  const articleValues = uaBuildArticleRowFromCandidate_(keyword, volume, appConfig);

  articleSheet
    .getRange(articleRow, 1, 1, UA_ARTICLE_COLUMN_COUNT)
    .setValues([articleValues]);

  candidateSheet
    .getRange(row, UA_CANDIDATE_COLUMNS.status)
    .setValue(UA_CANDIDATE_STATUS_SENT);

  uaApplyCandidateSheetRules_(candidateSheet);

  const data = uaBuildRowData_(articleSheet, articleRow);
  data.message = '候補を記事シートへ送信しました。';
  return data;
}

function uaLoadSentCandidateArticleRow_(appConfig, keyword, volume) {
  const articleSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(appConfig.articleSheetName);

  if (!articleSheet) {
    throw new Error('「' + appConfig.articleSheetName + '」シートが見つかりません。');
  }

  const articleRow = uaFindArticleRowByCandidate_(articleSheet, appConfig, keyword, volume);

  if (!articleRow) {
    throw new Error('この候補は記事化済みですが、記事シート側の保存行を見つけられませんでした。記事シートでキーワード検索してください。');
  }

  const data = uaBuildRowData_(articleSheet, articleRow);
  data.message = '記事化済みの保存行を読み込みました。';
  return data;
}

function uaFindArticleRowByCandidate_(articleSheet, appConfig, keyword, volume) {
  const lastRow = articleSheet.getLastRow();

  if (lastRow < 2) {
    return 0;
  }

  const values = articleSheet
    .getRange(2, 1, lastRow - 1, UA_COLUMNS.volume)
    .getDisplayValues();

  const targetAppType = String(appConfig.label || '').trim();
  const targetKeyword = String(keyword || '').trim();
  const targetVolume = String(volume || '').trim();

  for (let index = values.length - 1; index >= 0; index--) {
    const row = values[index];
    const rowAppType = String(row[UA_COLUMNS.appType - 1] || '').trim();
    const rowKeyword = String(row[UA_COLUMNS.mainInput - 1] || '').trim();
    const rowVolume = String(row[UA_COLUMNS.volume - 1] || '').trim();

    if (rowAppType === targetAppType && rowKeyword === targetKeyword && rowVolume === targetVolume) {
      return index + 2;
    }
  }

  for (let index = values.length - 1; index >= 0; index--) {
    const row = values[index];
    const rowAppType = String(row[UA_COLUMNS.appType - 1] || '').trim();
    const rowKeyword = String(row[UA_COLUMNS.mainInput - 1] || '').trim();

    if (rowAppType === targetAppType && rowKeyword === targetKeyword) {
      return index + 2;
    }
  }

  return 0;
}

function uaGetArticleRowForWeb(appTypeLabel, row) {
  const appConfig = uaGetAppConfigByLabel_(appTypeLabel);

  if (!appConfig || !appConfig.articleSheetName) {
    throw new Error('記事シートが見つかりません。');
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(appConfig.articleSheetName);

  if (!sheet) {
    throw new Error('「' + appConfig.articleSheetName + '」シートが見つかりません。');
  }

  const rowNumber = Number(row);
  const data = uaBuildRowData_(sheet, rowNumber);
  data.trefaiJob = uaGetLatestTrefaiJobStatus_(data.appType || appTypeLabel, rowNumber, data.mainInput);
  return data;
}

function uaCreateBlankArticleForWeb(appTypeLabel) {
  const appConfig = uaGetAppConfigByLabel_(appTypeLabel);

  if (!appConfig || !appConfig.articleSheetName) {
    throw new Error('記事シートが見つかりません。');
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(appConfig.articleSheetName);

  if (!sheet) {
    throw new Error('「' + appConfig.articleSheetName + '」シートが見つかりません。');
  }

  const row = uaFindNextArticleRow_(sheet);
  const values = new Array(UA_ARTICLE_COLUMN_COUNT).fill('');
  values[UA_COLUMNS.appType - 1] = appConfig.label;

  sheet
    .getRange(row, 1, 1, UA_ARTICLE_COLUMN_COUNT)
    .setValues([values]);

  const data = uaBuildRowData_(sheet, row);
  data.message = '新規記事行を作成しました。';
  return data;
}

function uaMarkArticlePostedFromWeb(data) {
  uaSaveActiveRowData(data || {});

  const sheet = uaGetSheetForData_(data || {});
  const row = Number(data && data.row);

  if (!row || row === 1) {
    throw new Error('記事データの行がありません。');
  }

  sheet.getRange(row, UA_COLUMNS.status).setValue(UA_STATUS_POSTED);

  const nextData = uaBuildRowData_(sheet, row);
  nextData.message = '投稿済みにしました。';
  return nextData;
}
