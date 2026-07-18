function onOpen() {
  uaRenameSpreadsheetFileIfLegacyName_();

  SpreadsheetApp.getUi()
    .createMenu('★Article Compass System')
    .addItem('記事作成パネルを開く', 'uaShowArticleApp')
    .addSeparator()
    .addItem('アプリ表示にする', 'uaSetupAppView')
    .addItem('全列を表示する', 'uaShowAllColumns')
    .addSeparator()
    .addItem('DRIVE BASE候補を開く', 'uaOpenDriveCandidateSheet')
    .addItem('たくみパパ候補を開く', 'uaOpenHomeCandidateSheet')
    .addItem('案件管理シートを作る・整える', 'uaSetupAffiliateManagementSheet')
    .addItem('「書く」候補を記事シートへ送る', 'uaMoveWriteCandidatesToArticleSheets')
    .addItem('記事/候補シートの表示ルールを整える', 'uaSetupArticleAndCandidateFormatting')
    .addItem('内部リンクシートを作る', 'uaSetupInternalLinkSheet')
    .addItem('内部リンク候補をサイトマップ更新', 'uaUpdateInternalLinksFromSitemaps')
    .addItem('外部出典シートを作る', 'uaSetupExternalSourceSheet')
    .addItem('WordPress接続テスト', 'uaTestWordPressConnections')
    .addSeparator()
    .addItem('自動投稿を設定・有効化', 'uaSetupAutomaticPosting')
    .addItem('自動投稿設定を開く', 'uaOpenAutomaticPostingSettings')
    .addItem('自動投稿を停止', 'uaDisableAutomaticPosting')
    .addItem('停止位置から再開', 'uaResumeAutomaticPosting')
    .addSeparator()
    .addItem('楽天バナーを本文へ追加', 'uaAddRakutenBannerToActiveRow')
    .addItem('内部リンクを本文へ追加', 'uaAddInternalLinkToActiveRow')
    .addItem('外部リンクを本文へ追加', 'uaAddExternalSourceLinkToActiveRow')
    .addToUi();
}

function uaRenameSpreadsheetFileIfLegacyName_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss.getName() === '統合版アプリ用シート') {
    ss.rename('Article Compass System');
  }
}

function onSelectionChange(e) {
  if (!e || !e.range) {
    return;
  }

  const sheet = e.range.getSheet();
  const appConfig = uaGetAppConfigByCandidateSheet_(sheet.getName());

  if (!appConfig || e.range.getRow() === 1) {
    return;
  }

  PropertiesService.getScriptProperties().setProperties({
    UA_LAST_CANDIDATE_APP_KEY: appConfig.key,
    UA_LAST_CANDIDATE_SHEET_NAME: sheet.getName(),
    UA_LAST_CANDIDATE_ROW: String(e.range.getRow()),
    UA_LAST_CANDIDATE_AT: String(new Date().getTime())
  });
}

function uaOpenDriveCandidateSheet() {
  uaOpenCandidateSheet_('drive');
}

function uaOpenHomeCandidateSheet() {
  uaOpenCandidateSheet_('home');
}

function uaOpenCandidateSheet_(appKey) {
  const appConfig = UA_APP_TYPES[appKey];

  if (!appConfig || !appConfig.candidateSheetName) {
    SpreadsheetApp.getUi().alert('この記事タイプには候補シートがありません。');
    return;
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(appConfig.candidateSheetName);

  if (!sheet) {
    SpreadsheetApp.getUi().alert('「' + appConfig.candidateSheetName + '」シートが見つかりません。');
    return;
  }

  uaEnsureCandidateSheetLayout_(sheet);
  sheet.showColumns(1, sheet.getMaxColumns());
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(4);
  ss.setActiveSheet(sheet);
}

function uaOpenCandidateSheetFromPanel(appTypeLabel) {
  const appConfig = uaGetAppConfigByLabel_(appTypeLabel);

  if (!appConfig || !appConfig.candidateSheetName) {
    throw new Error('この記事タイプには候補シートがありません。');
  }

  uaOpenCandidateSheet_(appConfig.key);

  return {
    message: appConfig.label + 'の候補シートを開きました。キーワード行を選んで「選択行を反映」を押してください。'
  };
}

function uaMoveWriteCandidatesToArticleSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const messages = [];

  Object.keys(UA_APP_TYPES).forEach(function(key) {
    const appConfig = UA_APP_TYPES[key];

    if (!appConfig.candidateSheetName || !appConfig.articleSheetName) {
      return;
    }

    const candidateSheet = ss.getSheetByName(appConfig.candidateSheetName);
    const articleSheet = ss.getSheetByName(appConfig.articleSheetName);

    if (!candidateSheet || !articleSheet) {
      messages.push(appConfig.label + ': 対象シートなし');
      return;
    }

    const movedCount = uaMoveWriteCandidatesForApp_(candidateSheet, articleSheet);
    messages.push(appConfig.label + ': ' + movedCount + '件転記');
  });

  SpreadsheetApp.getUi().alert(messages.join('\n') || '転記対象がありませんでした。');
}

function uaMoveWriteCandidatesForApp_(candidateSheet, articleSheet) {
  uaEnsureCandidateSheetLayout_(candidateSheet);
  const lastRow = candidateSheet.getLastRow();

  if (lastRow < 2) {
    return 0;
  }

  const values = candidateSheet
    .getRange(2, 1, lastRow - 1, Math.max(candidateSheet.getLastColumn(), UA_CANDIDATE_COLUMNS.volume))
    .getValues();
  const rowsToAppend = [];
  const candidateRowsToMark = [];

  values.forEach(function(row, index) {
    const status = String(row[UA_CANDIDATE_COLUMNS.status - 1] || '').trim();
    const affiliateName = String(row[UA_CANDIDATE_COLUMNS.affiliateName - 1] || '').trim();
    const keyword = String(row[UA_CANDIDATE_COLUMNS.keyword - 1] || '').trim();
    const volume = row[UA_CANDIDATE_COLUMNS.volume - 1] || '';

    if (status !== UA_CANDIDATE_STATUS_WRITE || !keyword) {
      return;
    }

    const affiliate = uaGetAffiliateProjectByName_(affiliateName);
    rowsToAppend.push(uaBuildArticleRowFromCandidate_(
      keyword,
      volume,
      uaGetAppConfigByArticleSheet_(articleSheet.getName()),
      affiliate
    ));
    candidateRowsToMark.push(index + 2);
  });

  if (rowsToAppend.length === 0) {
    return 0;
  }

  const startRow = uaFindNextArticleRow_(articleSheet);
  articleSheet
    .getRange(startRow, 1, rowsToAppend.length, UA_ARTICLE_COLUMN_COUNT)
    .setValues(rowsToAppend);

  candidateRowsToMark.forEach(function(rowNumber) {
    candidateSheet
      .getRange(rowNumber, UA_CANDIDATE_COLUMNS.status)
      .setValue(UA_CANDIDATE_STATUS_SENT);
  });

  uaApplyCandidateSheetRules_(candidateSheet);

  return rowsToAppend.length;
}

function uaBuildArticleRowFromCandidate_(keyword, volume, appConfig, affiliate) {
  const row = new Array(UA_ARTICLE_COLUMN_COUNT).fill('');

  row[UA_COLUMNS.appType - 1] = appConfig && appConfig.label
    ? appConfig.label
    : '';
  row[UA_COLUMNS.mainInput - 1] = keyword;
  row[UA_COLUMNS.volume - 1] = volume;
  row[UA_COLUMNS.affiliateName - 1] = affiliate && affiliate.name || '';
  row[UA_COLUMNS.affiliateUrl - 1] = affiliate && affiliate.url || '';
  row[UA_COLUMNS.affiliateNotes - 1] = affiliate && affiliate.notes || '';

  return row;
}

function uaGetAffiliateProjectByName_(affiliateName) {
  const cleanName = String(affiliateName || '').trim();
  if (!cleanName) {
    return { name: '', url: '', linkInput: '', shortcode: '', notes: '' };
  }

  return uaReadAffiliateProjectByName_(cleanName, true);
}

function uaReadAffiliateProjectByName_(affiliateName, required) {
  const cleanName = String(affiliateName || '').trim();
  if (!cleanName) return null;

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(UA_AFFILIATE_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) {
    if (!required) return null;
    throw new Error('案件「' + cleanName + '」を案件管理シートで確認できません。先に案件管理シートを整えてください。');
  }

  const values = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, UA_AFFILIATE_HEADERS.length)
    .getValues();
  const matches = values.filter(function(row) {
    return String(row[UA_AFFILIATE_COLUMNS.name - 1] || '').trim() === cleanName;
  });

  if (matches.length === 0) {
    if (!required) return null;
    throw new Error('案件「' + cleanName + '」が案件管理シートにありません。プルダウンから選び直してください。');
  }
  if (matches.length > 1) {
    throw new Error('案件管理シートに「' + cleanName + '」が重複しています。案件名を一意にしてください。');
  }

  const match = matches[0];
  const linkInput = uaNormalizeAffiliateCodeInput_(match[UA_AFFILIATE_COLUMNS.url - 1]);
  return {
    name: cleanName,
    url: uaExtractAffiliateUrl_(linkInput),
    linkInput: linkInput,
    shortcode: String(match[UA_AFFILIATE_COLUMNS.shortcode - 1] || '').trim(),
    notes: String(match[UA_AFFILIATE_COLUMNS.notes - 1] || '').trim()
  };
}

function uaNormalizeAffiliateCodeInput_(value) {
  let text = String(value || '').trim();
  const looksQuoted = text.length >= 2 && text.charAt(0) === '"' && text.charAt(text.length - 1) === '"';

  if (looksQuoted) {
    text = text.slice(1, -1).replace(/""/g, '"').trim();
  } else if (/<a\b/i.test(text) && text.indexOf('""') !== -1) {
    text = text.replace(/""/g, '"');
  }

  return text;
}

function uaExtractAffiliateUrl_(value) {
  const text = uaNormalizeAffiliateCodeInput_(value);
  const anchorMatch = /<a\b[^>]*\bhref\s*=\s*(['"])(.*?)\1/i.exec(text);
  if (anchorMatch && /^https?:\/\//i.test(String(anchorMatch[2] || '').trim())) {
    return String(anchorMatch[2] || '').trim().replace(/&amp;/gi, '&');
  }
  return /^https?:\/\//i.test(text) ? text : '';
}

function uaExtractUrlsFromAffiliateCode_(value) {
  const text = uaNormalizeAffiliateCodeInput_(value);
  const urls = [];
  const regex = /\b(?:href|src)\s*=\s*(['"])(https?:\/\/.*?)\1/gi;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const url = String(match[2] || '').trim().replace(/&amp;/gi, '&');
    if (url && urls.indexOf(url) === -1) urls.push(url);
  }

  if (urls.length === 0 && /^https?:\/\//i.test(text)) urls.push(text);
  return urls;
}

function uaGetManagedAffiliateUrls_(rowData) {
  const spec = uaGetManagedAffiliateCtaSpec_(rowData);
  if (!spec) return [];
  return uaExtractUrlsFromAffiliateCode_(spec.content).concat(spec.url || '').filter(function(url, index, list) {
    return url && list.indexOf(url) === index;
  });
}

function uaGetManagedAffiliateCtaSpec_(rowData) {
  const name = String(rowData && rowData.affiliateName || '').trim();
  if (!name) return null;

  const project = uaReadAffiliateProjectByName_(name, false);
  if (!project) return null;

  if (project.shortcode) {
    return {
      type: 'shortcode',
      name: project.name,
      url: project.url,
      content: project.shortcode
    };
  }

  if (/<a\b/i.test(project.linkInput)) {
    return {
      type: 'html',
      name: project.name,
      url: project.url,
      content: project.linkInput
    };
  }

  if (project.url && project.linkInput === project.url && /^https?:\/\/[^\s"'<>]+$/i.test(project.linkInput)) {
    return {
      type: 'url',
      name: project.name,
      url: project.url,
      content: project.linkInput
    };
  }

  return null;
}

function uaLoadSelectedRowForPanel() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  const candidateConfig = uaGetAppConfigByCandidateSheet_(sheet.getName());

  if (candidateConfig) {
    return uaCreateArticleFromSelectedCandidate_(sheet, candidateConfig);
  }

  return uaGetActiveRowData();
}

function uaCreateArticleFromSelectedCandidate_(candidateSheet, appConfig) {
  const row = candidateSheet.getActiveCell().getRow();
  const data = uaCreateArticleFromCandidateRow_(candidateSheet, appConfig, row);
  const articleSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(appConfig.articleSheetName);
  const articleRow = Number(data.row);

  SpreadsheetApp.getActiveSpreadsheet().setActiveSheet(articleSheet);
  articleSheet.setActiveSelection(articleSheet.getRange(articleRow, UA_COLUMNS.mainInput));

  data.message = '候補を記事シートへ送信し、パネルに反映しました。';
  return data;
}

function uaGetAppConfigByArticleSheet_(sheetName) {
  const keys = Object.keys(UA_APP_TYPES);

  for (let i = 0; i < keys.length; i++) {
    const config = UA_APP_TYPES[keys[i]];

    if (config.articleSheetName === sheetName) {
      return config;
    }
  }

  return null;
}

function uaGetAppConfigByCandidateSheet_(sheetName) {
  const keys = Object.keys(UA_APP_TYPES);

  for (let i = 0; i < keys.length; i++) {
    const config = UA_APP_TYPES[keys[i]];

    if (config.candidateSheetName && config.candidateSheetName === sheetName) {
      return config;
    }
  }

  return null;
}

function uaFindNextArticleRow_(sheet) {
  const lastRow = Math.max(sheet.getLastRow(), 1);

  if (lastRow < 2) {
    return 2;
  }

  const values = sheet.getRange(2, UA_COLUMNS.mainInput, lastRow - 1, 1).getValues();

  for (let i = values.length - 1; i >= 0; i--) {
    if (String(values[i][0] || '').trim()) {
      return i + 3;
    }
  }

  return 2;
}

function uaMarkActiveArticlePosted(data) {
  uaSaveActiveRowData(data || {});

  const sheet = uaGetRequiredSheet_();
  const row = Number(data && data.row) || sheet.getActiveCell().getRow();

  if (row === 1) {
    throw new Error('記事データの行を選択してください。1行目は見出しです。');
  }

  sheet.getRange(row, UA_COLUMNS.status).setValue(UA_STATUS_POSTED);

  const nextData = uaBuildRowData_(sheet, row);
  nextData.message = '投稿済みにしました。';
  return nextData;
}

function uaSetupArticleAndCandidateFormatting() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  uaEnsureAffiliateManagementSheet_(ss);

  Object.keys(UA_APP_TYPES).forEach(function(key) {
    const appConfig = UA_APP_TYPES[key];

    if (appConfig.articleSheetName) {
      const articleSheet = ss.getSheetByName(appConfig.articleSheetName);
      if (articleSheet) {
        uaEnsureArticleSheetLayout_(articleSheet);
        uaApplyConditionalFormatting_(articleSheet, Math.max(articleSheet.getMaxRows() - 1, 1));
        uaApplyDataValidations_(articleSheet, Math.max(articleSheet.getMaxRows() - 1, 1));
      }
    }

    if (appConfig.candidateSheetName) {
      const candidateSheet = ss.getSheetByName(appConfig.candidateSheetName);
      if (candidateSheet) {
        uaApplyCandidateSheetRules_(candidateSheet);
      }
    }
  });

  SpreadsheetApp.getUi().alert('記事シートと候補シートの表示ルールを整えました。');
}

function uaEnsureArticleSheetLayout_(sheet) {
  if (sheet.getMaxColumns() < UA_HEADERS.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), UA_HEADERS.length - sheet.getMaxColumns());
  }

  sheet.getRange(1, 1, 1, UA_HEADERS.length).setValues([UA_HEADERS]);
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(2);
}

function uaApplyCandidateSheetRules_(sheet) {
  uaEnsureCandidateSheetLayout_(sheet);
  const maxRows = Math.max(sheet.getMaxRows() - 1, 1);

  const statusRule = uaBuildCandidateStatusValidation_();

  sheet.getRange(2, UA_CANDIDATE_COLUMNS.status, maxRows, 1).setDataValidation(statusRule);

  const affiliateSheet = uaEnsureAffiliateManagementSheet_(SpreadsheetApp.getActiveSpreadsheet());
  const affiliateRule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(
      affiliateSheet.getRange(2, UA_AFFILIATE_COLUMNS.name, Math.max(affiliateSheet.getMaxRows() - 1, 1), 1),
      true
    )
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, UA_CANDIDATE_COLUMNS.affiliateName, maxRows, 1).setDataValidation(affiliateRule);

  const rangeAll = sheet.getRange(2, 1, maxRows, sheet.getMaxColumns());
  const statusRange = sheet.getRange(2, UA_CANDIDATE_COLUMNS.status, maxRows, 1);
  const existingRules = sheet.getConditionalFormatRules().filter(function(rule) {
    const ranges = rule.getRanges();
    return !ranges.some(function(range) {
      return range.getColumn() === UA_CANDIDATE_COLUMNS.status ||
        (range.getColumn() === 1 && range.getNumColumns() >= 18);
    });
  });

  const candidateRules = [
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=$A2="' + UA_CANDIDATE_STATUS_SENT + '"')
      .setBackground('#e5e5e5')
      .setRanges([rangeAll])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=$A2="' + UA_CANDIDATE_STATUS_WRITE + '"')
      .setBackground('#fff2cc')
      .setRanges([rangeAll])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(UA_CANDIDATE_STATUS_SENT)
      .setBackground('#e5e5e5')
      .setFontColor('#3f3f3f')
      .setBold(true)
      .setRanges([statusRange])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(UA_CANDIDATE_STATUS_WRITE)
      .setBackground('#fff2cc')
      .setFontColor('#724700')
      .setBold(true)
      .setRanges([statusRange])
      .build()
  ];

  sheet.setConditionalFormatRules(existingRules.concat(candidateRules));
}

function uaBuildCandidateStatusValidation_() {
  return SpreadsheetApp.newDataValidation()
    .requireValueInList([
      UA_CANDIDATE_STATUS_WRITE,
      UA_CANDIDATE_STATUS_SENT,
      UA_CANDIDATE_STATUS_HOLD
    ], true)
    .setAllowInvalid(false)
    .build();
}

function uaSetupAffiliateManagementSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = uaEnsureAffiliateManagementSheet_(ss);

  Object.keys(UA_APP_TYPES).forEach(function(key) {
    const candidateName = UA_APP_TYPES[key].candidateSheetName;
    const candidateSheet = candidateName && ss.getSheetByName(candidateName);
    if (candidateSheet) uaApplyCandidateSheetRules_(candidateSheet);
  });

  ss.setActiveSheet(sheet);
  SpreadsheetApp.getUi().alert('案件管理シートと候補シートの案件プルダウンを整えました。');
}

function uaEnsureAffiliateManagementSheet_(ss) {
  const spreadsheet = ss || SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(UA_AFFILIATE_SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(UA_AFFILIATE_SHEET_NAME);
  }
  if (sheet.getMaxColumns() < UA_AFFILIATE_HEADERS.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), UA_AFFILIATE_HEADERS.length - sheet.getMaxColumns());
  }

  sheet.getRange(1, 1, 1, UA_AFFILIATE_HEADERS.length).setValues([UA_AFFILIATE_HEADERS]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, UA_AFFILIATE_HEADERS.length)
    .setFontWeight('bold')
    .setBackground('#d9ead3');
  sheet.setColumnWidth(UA_AFFILIATE_COLUMNS.name, 180);
  sheet.setColumnWidth(UA_AFFILIATE_COLUMNS.url, 360);
  sheet.setColumnWidth(UA_AFFILIATE_COLUMNS.shortcode, 220);
  sheet.setColumnWidth(UA_AFFILIATE_COLUMNS.notes, 360);
  return sheet;
}

function uaEnsureCandidateSheetLayout_(sheet) {
  if (sheet.getMaxColumns() < UA_CANDIDATE_HEADERS.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), UA_CANDIDATE_HEADERS.length - sheet.getMaxColumns());
  }

  const currentHeaders = sheet.getRange(1, 1, 1, Math.min(sheet.getMaxColumns(), 4)).getDisplayValues()[0];
  const secondHeader = String(currentHeaders[1] || '').trim();
  const thirdHeader = String(currentHeaders[2] || '').trim();
  const fourthHeader = String(currentHeaders[3] || '').trim();
  const isLegacyLayout = (secondHeader === 'キーワード' || secondHeader === 'メインキーワード') &&
    (thirdHeader === '検索ボリューム' || thirdHeader === 'ボリューム');
  const isCurrentLayout = secondHeader === '案件名' &&
    (thirdHeader === 'キーワード' || thirdHeader === 'メインキーワード') &&
    (fourthHeader === '検索ボリューム' || fourthHeader === 'ボリューム');
  const isEmptyLayout = sheet.getLastRow() <= 1 && currentHeaders.every(function(header) {
    return !String(header || '').trim();
  });

  if (!isLegacyLayout && !isCurrentLayout && !isEmptyLayout) {
    throw new Error(
      '「' + sheet.getName() + '」の見出しを安全に判別できません。' +
      'A〜D列を確認してから、必要であれば旧チャットの仕様と照合してください。'
    );
  }

  if (isLegacyLayout) {
    sheet.insertColumnAfter(UA_CANDIDATE_COLUMNS.status);
  }

  sheet.getRange(1, 1, 1, UA_CANDIDATE_HEADERS.length).setValues([UA_CANDIDATE_HEADERS]);
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(4);

  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    const statusRange = sheet.getRange(2, UA_CANDIDATE_COLUMNS.status, lastRow - 1, 1);
    const statuses = statusRange.getValues();
    let changed = false;
    statuses.forEach(function(row) {
      if (String(row[0] || '').trim() === UA_CANDIDATE_LEGACY_STATUS_SENT) {
        row[0] = UA_CANDIDATE_STATUS_SENT;
        changed = true;
      }
    });
    statusRange.clearDataValidations();
    if (changed) statusRange.setValues(statuses);
    statusRange.setDataValidation(uaBuildCandidateStatusValidation_());
  }
}

function uaShowArticleApp() {
  const html = HtmlService
    .createHtmlOutputFromFile('app_panel')
    .setTitle(UA_APP_NAME)
    .setWidth(1200)
    .setHeight(860);

  SpreadsheetApp.getUi().showModelessDialog(html, UA_APP_NAME);
}

function uaGetAppConfigList() {
  return Object.keys(UA_APP_TYPES).map(function(key) {
    return UA_APP_TYPES[key];
  });
}

function uaGetPanelOptions() {
  return {
    appConfigs: uaGetAppConfigList(),
    textModels: uaGetOpenAiTextModelOptions_(),
    imageModels: uaGetOpenAiImageModelOptions_(),
    selectedTextModel: uaGetOpenAiModel_(),
    selectedImageModel: uaGetOpenAiImageModel_()
  };
}

function uaGetAppConfigByLabel_(label) {
  const cleanLabel = String(label || '').trim();
  const keys = Object.keys(UA_APP_TYPES);

  for (let i = 0; i < keys.length; i++) {
    const config = UA_APP_TYPES[keys[i]];
    if (config.label === cleanLabel || config.key === cleanLabel) {
      return config;
    }
  }

  return null;
}

function uaGetGeminiApiKey_() {
  return PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
}

function uaGetOpenAiApiKey_() {
  return PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
}

function uaGetClaudeApiKey_() {
  return PropertiesService.getScriptProperties().getProperty('CLAUDE_API_KEY');
}

function uaGetOpenAiModel_() {
  return PropertiesService.getScriptProperties().getProperty('OPENAI_MODEL') ||
    UA_DEFAULT_OPENAI_MODEL;
}

function uaAppendCurrentModelOption_(options, currentModel) {
  const cleanCurrentModel = String(currentModel || '').trim();
  const copiedOptions = (options || []).map(function(option) {
    return { value: option.value, label: option.label };
  });
  const values = copiedOptions.map(function(option) { return option.value; });
  if (cleanCurrentModel && values.indexOf(cleanCurrentModel) === -1) {
    copiedOptions.push({ value: cleanCurrentModel, label: cleanCurrentModel + '（現在の設定）' });
  }
  return copiedOptions;
}

function uaGetOpenAiTextModelOptions_() {
  return uaAppendCurrentModelOption_(UA_OPENAI_TEXT_MODEL_OPTIONS || [], uaGetOpenAiModel_());
}

function uaGetOpenAiImageModelOptions_() {
  return uaAppendCurrentModelOption_(UA_OPENAI_IMAGE_MODEL_OPTIONS || [], uaGetOpenAiImageModel_());
}

function uaGetImageModelOptions_() {
  return [
    { value: 'openai:' + uaGetOpenAiImageModel_(), label: 'OpenAI Images: ' + uaGetOpenAiImageModel_() }
  ].concat((UA_GEMINI_IMAGE_MODEL_OPTIONS || []).map(function(option) {
    return {
      value: 'gemini:' + option.value,
      label: option.label + ': ' + option.value.replace(/^models\//, '')
    };
  }));
}

function uaGetSelectedImageModelValue_() {
  const provider = uaGetImageProvider_();
  if (provider === 'gemini') {
    return 'gemini:' + uaGetGeminiImageModel_();
  }
  return 'openai:' + uaGetOpenAiImageModel_();
}

function uaGetOpenAiImageModel_() {
  const model = PropertiesService.getScriptProperties().getProperty('OPENAI_IMAGE_MODEL');
  if (!model || model === 'gpt-image-1' || model === 'gpt-image-1.5') {
    return UA_DEFAULT_OPENAI_IMAGE_MODEL;
  }
  return model;
}

function uaGetGeminiImageModel_() {
  const model = PropertiesService.getScriptProperties().getProperty('GEMINI_IMAGE_MODEL') ||
    UA_DEFAULT_GEMINI_IMAGE_MODEL;
  const allowed = (UA_GEMINI_IMAGE_MODEL_OPTIONS || []).map(function(option) { return option.value; });
  return allowed.indexOf(model) !== -1 ? model : UA_DEFAULT_GEMINI_IMAGE_MODEL;
}

function uaGetClaudeModel_() {
  return PropertiesService.getScriptProperties().getProperty('CLAUDE_MODEL') ||
    UA_DEFAULT_CLAUDE_MODEL;
}

function uaGetArticleProvider_() {
  return 'openai';
}

function uaGetReaderMindProvider_() {
  return 'openai';
}

function uaGetImageProvider_() {
  return 'openai';
}

function uaSetArticleProviderGemini() {
  PropertiesService.getScriptProperties().setProperty(UA_ARTICLE_PROVIDER_PROPERTY, 'gemini');
  SpreadsheetApp.getUi().alert('本文生成をGeminiに切り替えました。');
}

function uaSetArticleProviderOpenAi() {
  PropertiesService.getScriptProperties().setProperty(UA_ARTICLE_PROVIDER_PROPERTY, 'openai');
  SpreadsheetApp.getUi().alert('本文生成をOpenAIに切り替えました。');
}

function uaSetArticleProviderClaude() {
  PropertiesService.getScriptProperties().setProperty(UA_ARTICLE_PROVIDER_PROPERTY, 'claude');
  SpreadsheetApp.getUi().alert('本文生成をClaudeに切り替えました。');
}

function uaSetReaderMindProviderGemini() {
  PropertiesService.getScriptProperties().setProperty(UA_READER_MIND_PROVIDER_PROPERTY, 'gemini');
  SpreadsheetApp.getUi().alert('読者心理メモ生成をGeminiに切り替えました。');
}

function uaSetReaderMindProviderOpenAi() {
  PropertiesService.getScriptProperties().setProperty(UA_READER_MIND_PROVIDER_PROPERTY, 'openai');
  SpreadsheetApp.getUi().alert('読者心理メモ生成をOpenAIに切り替えました。');
}

function uaSetProvidersFromPanel(articleProvider, readerMindProvider, imageProvider, imageModelValue) {
  const legacyImageModel = String(imageModelValue || '').replace(/^openai:/, '');
  return uaSetOpenAiModelsFromPanel(uaGetOpenAiModel_(), legacyImageModel || uaGetOpenAiImageModel_());
}

function uaSetOpenAiModelsFromPanel(textModel, imageModel) {
  const cleanTextModel = String(textModel || '').trim();
  const cleanImageModel = String(imageModel || '').trim();
  const allowedTextModels = uaGetOpenAiTextModelOptions_().map(function(option) { return option.value; });
  const allowedImageModels = uaGetOpenAiImageModelOptions_().map(function(option) { return option.value; });

  if (!cleanTextModel || allowedTextModels.indexOf(cleanTextModel) === -1) {
    throw new Error('選択した文章モデルは保存できません。パネルを再読み込みしてください。');
  }
  if (!cleanImageModel || allowedImageModels.indexOf(cleanImageModel) === -1) {
    throw new Error('選択した画像モデルは保存できません。パネルを再読み込みしてください。');
  }

  const properties = PropertiesService.getScriptProperties();
  properties.setProperty('OPENAI_MODEL', cleanTextModel);
  properties.setProperty('OPENAI_IMAGE_MODEL', cleanImageModel);
  properties.setProperty(UA_ARTICLE_PROVIDER_PROPERTY, 'openai');
  properties.setProperty(UA_READER_MIND_PROVIDER_PROPERTY, 'openai');
  properties.setProperty(UA_IMAGE_PROVIDER_PROPERTY, 'openai');

  return {
    selectedTextModel: uaGetOpenAiModel_(),
    selectedImageModel: uaGetOpenAiImageModel_(),
    message: 'OpenAIのモデル設定を更新しました。'
  };
}

function uaFormatModelLabel_(provider, model) {
  const cleanProvider = String(provider || '').trim() || 'unknown';
  const cleanModel = String(model || '').trim();

  if (!cleanModel) {
    return cleanProvider;
  }

  return cleanProvider + ':' + cleanModel.replace(/^models\//, '');
}

function uaGetSelectedArticleModelLabel_() {
  const provider = uaGetArticleProvider_();

  if (provider === 'claude') {
    return uaFormatModelLabel_(provider, uaGetClaudeModel_());
  }

  if (provider === 'openai') {
    return uaFormatModelLabel_(provider, uaGetOpenAiModel_());
  }

  return uaFormatModelLabel_(provider, UA_GEMINI_MODELS[0] || '');
}

function uaGetSelectedReaderMindModelLabel_() {
  const provider = uaGetReaderMindProvider_();

  if (provider === 'openai') {
    return uaFormatModelLabel_(provider, uaGetOpenAiModel_());
  }

  return uaFormatModelLabel_(provider, UA_GEMINI_MODELS[0] || '');
}

function uaGetSelectedImageModelLabel_() {
  const provider = uaGetImageProvider_();
  if (provider === 'gemini') {
    return uaFormatModelLabel_(provider, uaGetGeminiImageModel_());
  }
  return uaFormatModelLabel_(provider, uaGetOpenAiImageModel_());
}


function uaOpenArticleSheetFromPanel(appTypeLabel) {
  const appConfig = uaGetAppConfigByLabel_(appTypeLabel);

  if (!appConfig || !appConfig.articleSheetName) {
    throw new Error('\u3053\u306e\u8a18\u4e8b\u30bf\u30a4\u30d7\u306b\u306f\u8a18\u4e8b\u30b7\u30fc\u30c8\u304c\u3042\u308a\u307e\u305b\u3093\u3002');
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(appConfig.articleSheetName);

  if (!sheet) {
    throw new Error('"' + appConfig.articleSheetName + '" \u30b7\u30fc\u30c8\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093\u3002');
  }

  ss.setActiveSheet(sheet);
  sheet.showColumns(1, sheet.getMaxColumns());
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(2);

  return {
    message: appConfig.label + '\u306e\u8a18\u4e8b\u30b7\u30fc\u30c8\u3092\u958b\u304d\u307e\u3057\u305f\u3002\u53cd\u6620\u3057\u305f\u3044\u884c\u3092\u9078\u3093\u3067\u304b\u3089\u300c\u9078\u629e\u884c\u3092\u53cd\u6620\u300d\u3092\u62bc\u3057\u3066\u304f\u3060\u3055\u3044\u3002'
  };
}
function uaGetRequiredSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const activeSheet = ss.getActiveSheet();
  const activeConfig = uaGetAppConfigByArticleSheet_(activeSheet.getName());

  if (activeConfig) {
    return activeSheet;
  }

  throw new Error('DRIVE BASE、たくみパパ、汎用記事のいずれかの記事シートで実行してください。候補シートから使う場合は、候補行を選んで「選択行を反映」を使ってください。');
}

function uaSetupAppView() {
  const sheet = uaGetRequiredSheet_();
  const maxRows = Math.max(sheet.getMaxRows() - 1, 1);

  uaEnsureArticleSheetLayout_(sheet);

  sheet.showColumns(1, sheet.getMaxColumns());
  sheet.hideColumns(3, UA_HEADERS.length - 2);
  sheet.autoResizeColumns(1, 2);

  uaApplyDataValidations_(sheet, maxRows);
  uaApplyConditionalFormatting_(sheet, maxRows);
}

function uaShowAllColumns() {
  const sheet = uaGetRequiredSheet_();
  sheet.showColumns(1, Math.max(sheet.getMaxColumns(), UA_HEADERS.length));
}

function uaApplyDataValidations_(sheet, maxRows) {
  const appTypeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(Object.keys(UA_APP_TYPES).map(function(key) {
      return UA_APP_TYPES[key].label;
    }), true)
    .setAllowInvalid(false)
    .build();

  const statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList([
      UA_STATUS_GENERATING,
      UA_STATUS_DONE,
      UA_STATUS_STOPPED,
      UA_STATUS_WP_DRAFTED,
      UA_STATUS_POSTED
    ], true)
    .setAllowInvalid(false)
    .build();

  sheet.getRange(2, UA_COLUMNS.appType, maxRows, 1).setDataValidation(appTypeRule);
  sheet.getRange(2, UA_COLUMNS.status, maxRows, 1).setDataValidation(statusRule);
}

function uaApplyConditionalFormatting_(sheet, maxRows) {
  const rangeAll = sheet.getRange(2, 1, maxRows, UA_ARTICLE_COLUMN_COUNT);
  const statusRange = sheet.getRange(2, UA_COLUMNS.status, maxRows, 1);

  const rules = [
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=$K2="' + UA_STATUS_POSTED + '"')
      .setBackground('#e5e5e5')
      .setRanges([rangeAll])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=$K2="' + UA_STATUS_STOPPED + '"')
      .setBackground('#ffd8d8')
      .setRanges([rangeAll])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=$K2="' + UA_STATUS_DONE + '"')
      .setBackground('#d8f2d8')
      .setRanges([rangeAll])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=$K2="' + UA_STATUS_WP_DRAFTED + '"')
      .setBackground('#d8edf8')
      .setRanges([rangeAll])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=$K2="' + UA_STATUS_GENERATING + '"')
      .setBackground('#fff2cc')
      .setRanges([rangeAll])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(UA_STATUS_POSTED)
      .setBackground('#e5e5e5')
      .setFontColor('#3f3f3f')
      .setBold(true)
      .setRanges([statusRange])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(UA_STATUS_STOPPED)
      .setBackground('#ffd8d8')
      .setFontColor('#8c0000')
      .setBold(true)
      .setRanges([statusRange])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(UA_STATUS_DONE)
      .setBackground('#d8f2d8')
      .setFontColor('#00591e')
      .setBold(true)
      .setRanges([statusRange])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(UA_STATUS_WP_DRAFTED)
      .setBackground('#d8edf8')
      .setFontColor('#174ea6')
      .setBold(true)
      .setRanges([statusRange])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(UA_STATUS_GENERATING)
      .setBackground('#fff2cc')
      .setFontColor('#724700')
      .setBold(true)
      .setRanges([statusRange])
      .build()
  ];

  sheet.setConditionalFormatRules(rules);
}

function uaGetActiveRowData() {
  const sheet = uaGetRequiredSheet_();
  const row = sheet.getActiveCell().getRow();

  if (row === 1) {
    throw new Error('記事データの行を選択してください。1行目は見出しです。');
  }

  return uaBuildRowData_(sheet, row);
}

function uaGetInitialPanelData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  const candidateConfig = uaGetAppConfigByCandidateSheet_(sheet.getName());

  if (candidateConfig) {
    return {
      row: sheet.getActiveCell().getRow(),
      appType: candidateConfig.label,
      mainInput: '',
      volume: '',
      affiliateName: '',
      affiliateUrl: '',
      affiliateNotes: '',
      competitorUrl1: '',
      competitorUrl2: '',
      competitorUrl3: '',
      readerMindMemo: '',
      status: '',
      createdAt: '',
      generationModel: '',
      body: '',
      titleIdeas: '',
      tags: '',
      metaDescription: '',
      permalink: '',
      factCheckPoints: '',
      wpPostId: '',
      wpEditUrl: '',
      wpDraftedAt: '',
      structureMemo: '',
      selectedArticleModel: uaGetSelectedArticleModelLabel_(),
      selectedReaderMindModel: uaGetSelectedReaderMindModelLabel_(),
      message: '候補シートを開いています。キーワード行を選んで「選択行を反映」を押してください。'
    };
  }

  return uaGetActiveRowData();
}

function uaSaveActiveRowData(data) {
  const sheet = uaGetSheetForData_(data);
  const row = Number(data && data.row) || sheet.getActiveCell().getRow();
  const sheetConfig = uaGetAppConfigByArticleSheet_(sheet.getName());

  if (row === 1) {
    throw new Error('記事データの行を選択してください。1行目は見出しです。');
  }

  uaEnsureArticleSheetLayout_(sheet);

  const values = [
    data.appType || (sheetConfig && sheetConfig.label) || '',
    data.mainInput || '',
    data.volume || '',
    data.affiliateName || '',
    data.affiliateUrl || '',
    data.affiliateNotes || '',
    data.competitorUrl1 || '',
    data.competitorUrl2 || '',
    data.competitorUrl3 || '',
    data.readerMindMemo || '',
    data.status || '',
    data.createdAt || '',
    data.generationModel || '',
    data.body || '',
    data.titleIdeas || '',
    data.tags || '',
    data.metaDescription || '',
    data.permalink || '',
    data.factCheckPoints || '',
    data.wpPostId || '',
    data.wpEditUrl || '',
    data.wpDraftedAt || '',
    data.structureMemo || ''
  ];

  sheet.getRange(row, 1, 1, UA_ARTICLE_COLUMN_COUNT).setValues([values]);
  return uaBuildRowData_(sheet, row);
}

function uaGetSheetForData_(data) {
  const appConfig = uaGetAppConfigByLabel_(data && data.appType);

  if (appConfig && appConfig.articleSheetName) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(appConfig.articleSheetName);
    if (sheet) return sheet;
  }

  return uaGetRequiredSheet_();
}

function uaBuildRowData_(sheet, row) {
  uaEnsureArticleSheetLayout_(sheet);
  const values = sheet.getRange(row, 1, 1, UA_ARTICLE_COLUMN_COUNT).getValues()[0];
  const sheetConfig = uaGetAppConfigByArticleSheet_(sheet.getName());
  const appType = values[UA_COLUMNS.appType - 1] ||
    (sheetConfig && sheetConfig.label) ||
    '';

  return {
    row: row,
    appType: appType,
    mainInput: values[UA_COLUMNS.mainInput - 1] || '',
    volume: values[UA_COLUMNS.volume - 1] || '',
    affiliateName: values[UA_COLUMNS.affiliateName - 1] || '',
    affiliateUrl: values[UA_COLUMNS.affiliateUrl - 1] || '',
    affiliateNotes: values[UA_COLUMNS.affiliateNotes - 1] || '',
    competitorUrl1: values[UA_COLUMNS.competitorUrl1 - 1] || '',
    competitorUrl2: values[UA_COLUMNS.competitorUrl2 - 1] || '',
    competitorUrl3: values[UA_COLUMNS.competitorUrl3 - 1] || '',
    readerMindMemo: values[UA_COLUMNS.readerMindMemo - 1] || '',
    status: values[UA_COLUMNS.status - 1] || '',
    createdAt: values[UA_COLUMNS.createdAt - 1] ? String(values[UA_COLUMNS.createdAt - 1]) : '',
    generationModel: values[UA_COLUMNS.generationModel - 1] || '',
    body: values[UA_COLUMNS.body - 1] || '',
    titleIdeas: values[UA_COLUMNS.titleIdeas - 1] || '',
    tags: values[UA_COLUMNS.tags - 1] || '',
    metaDescription: values[UA_COLUMNS.metaDescription - 1] || '',
    permalink: values[UA_COLUMNS.permalink - 1] || '',
    factCheckPoints: values[UA_COLUMNS.factCheckPoints - 1] || '',
    wpPostId: values[UA_COLUMNS.wpPostId - 1] || '',
    wpEditUrl: values[UA_COLUMNS.wpEditUrl - 1] || '',
    wpDraftedAt: values[UA_COLUMNS.wpDraftedAt - 1] ? String(values[UA_COLUMNS.wpDraftedAt - 1]) : '',
    structureMemo: values[UA_COLUMNS.structureMemo - 1] || '',
    selectedArticleModel: uaGetSelectedArticleModelLabel_(),
    selectedReaderMindModel: uaGetSelectedReaderMindModelLabel_()
  };
}

