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

function uaListCandidatesForWeb(appTypeLabel, query) {
  const appConfig = uaGetAppConfigByLabel_(appTypeLabel);

  if (!appConfig || !appConfig.candidateSheetName) {
    return [];
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(appConfig.candidateSheetName);

  if (!sheet || !sheet.getLastRow || sheet.getLastRow() < 2) {
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

  return uaBuildRowData_(sheet, Number(row));
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
