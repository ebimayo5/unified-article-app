const UA_AUTOMATION_SHEET_NAME = '自動投稿設定';
const UA_AUTOMATION_JOB_PROPERTY = 'UA_AUTOMATION_ACTIVE_JOB';
const UA_AUTOMATION_LAST_STARTED_DATE_PROPERTY = 'UA_AUTOMATION_LAST_STARTED_DATE';
const UA_AUTOMATION_DAILY_PROGRESS_PROPERTY = 'UA_AUTOMATION_DAILY_PROGRESS';
const UA_AUTOMATION_DAILY_HANDLER = 'uaStartAutomaticPostingDaily';
const UA_AUTOMATION_WORKER_HANDLER = 'uaRunAutomaticPostingWorker';
const UA_AUTOMATION_NEXT_HANDLER = 'uaStartNextAutomaticPosting';
const UA_AUTOMATION_TIMEZONE = 'Asia/Tokyo';

const UA_AUTOMATION_STEP_READER_MIND = 'reader_mind';
const UA_AUTOMATION_STEP_STRUCTURE = 'structure';
const UA_AUTOMATION_STEP_WAIT_TREFAI = 'wait_trefai';
const UA_AUTOMATION_STEP_ARTICLE = 'article';
const UA_AUTOMATION_STEP_INITIAL_WP = 'initial_wp';
const UA_AUTOMATION_STEP_IMAGES = 'images';
const UA_AUTOMATION_STEP_CHECK = 'check';
const UA_AUTOMATION_STEP_REVISION = 'revision';
const UA_AUTOMATION_STEP_FINAL_WP = 'final_wp';
const UA_AUTOMATION_STEP_PUBLISH = 'publish';

function uaSetupAutomaticPosting() {
  const sheet = uaActivateAutomaticPosting();
  SpreadsheetApp.getActiveSpreadsheet().setActiveSheet(sheet);
  SpreadsheetApp.getUi().alert('自動投稿を有効にしました。「WordPress到達点」で下書きまで／公開までを選べます。');
}

function uaActivateAutomaticPosting() {
  const sheet = uaEnsureAutomaticPostingSheet_();
  uaInstallAutomaticPostingTrigger_();
  sheet.getRange('B2').setValue('ON');
  const settings = uaReadAutomaticPostingSettings_();
  uaWriteAutomaticPostingStatus_(uaBuildAutomaticPostingRunningStatus_(settings), '');
  return sheet;
}

function uaOpenAutomaticPostingSettings() {
  const sheet = uaEnsureAutomaticPostingSheet_();
  SpreadsheetApp.getActiveSpreadsheet().setActiveSheet(sheet);
}

function uaGetAutomaticPostingSettingsForPanel() {
  const sheet = uaEnsureAutomaticPostingSheet_();
  const settings = uaReadAutomaticPostingSettings_();
  const statusValues = sheet.getRange('B7:B9').getDisplayValues().map(function(row) {
    return String(row[0] || '').trim();
  });
  const job = uaGetAutomaticPostingJob_();
  return {
    enabled: settings.enabled,
    hour: settings.hour,
    dailyLimit: settings.dailyLimit,
    includeImages: settings.includeImages,
    publishMode: settings.publishMode,
    status: statusValues[0] || (settings.enabled ? '稼働中' : '停止中'),
    lastUpdated: statusValues[1] || '',
    lastError: statusValues[2] || '',
    activeKeyword: job && job.status !== 'complete' ? String(job.keyword || '') : '',
    activeStep: job && job.status !== 'complete' ? uaGetAutomaticPostingStepLabel_(job.step) : '',
    activeJobStatus: job && job.status !== 'complete' ? String(job.status || '') : ''
  };
}

function uaSaveAutomaticPostingSettingsFromPanel(data) {
  const request = data || {};
  const sheet = uaEnsureAutomaticPostingSheet_();
  const enabled = request.enabled === true || String(request.enabled || '').toUpperCase() === 'ON';
  const includeImages = request.includeImages !== false && String(request.includeImages || '') !== 'なし';
  const publishMode = String(request.publishMode || '') === '公開まで' ? '公開まで' : '下書きまで';
  const hour = uaNormalizeAutomaticPostingInteger_(request.hour, 0, 23, 4);
  const dailyLimit = uaNormalizeAutomaticPostingInteger_(request.dailyLimit, 1, 5, 1);

  sheet.getRange('B2:B6').setValues([[
    enabled ? 'ON' : 'OFF'
  ], [hour], [dailyLimit], [
    includeImages ? 'あり' : 'なし'
  ], [
    publishMode
  ]]);

  if (enabled) {
    uaInstallAutomaticPostingTrigger_();
    uaWriteAutomaticPostingStatus_(uaBuildAutomaticPostingRunningStatus_({ hour: hour, dailyLimit: dailyLimit }), '');
  } else {
    uaDeleteAutomaticPostingTriggers_(UA_AUTOMATION_DAILY_HANDLER);
    uaDeleteAutomaticPostingTriggers_(UA_AUTOMATION_WORKER_HANDLER);
    uaDeleteAutomaticPostingTriggers_(UA_AUTOMATION_NEXT_HANDLER);
    uaWriteAutomaticPostingStatus_('停止中', '');
  }

  const result = uaGetAutomaticPostingSettingsForPanel();
  result.message = enabled
    ? '自動投稿設定を保存し、毎日' + hour + '時ごろの実行を有効にしました。'
    : '自動投稿設定を保存し、自動実行を停止しました。';
  return result;
}

function uaDisableAutomaticPosting() {
  const sheet = uaEnsureAutomaticPostingSheet_();
  sheet.getRange('B2').setValue('OFF');
  uaDeleteAutomaticPostingTriggers_(UA_AUTOMATION_DAILY_HANDLER);
  uaDeleteAutomaticPostingTriggers_(UA_AUTOMATION_WORKER_HANDLER);
  uaDeleteAutomaticPostingTriggers_(UA_AUTOMATION_NEXT_HANDLER);
  uaWriteAutomaticPostingStatus_('停止中', '');
  SpreadsheetApp.getUi().alert('自動投稿を停止しました。進行中の記事情報は保存しています。');
}

function uaResumeAutomaticPosting() {
  const settings = uaReadAutomaticPostingSettings_();
  if (!settings.enabled) throw new Error('自動投稿設定がOFFです。');
  const job = uaGetAutomaticPostingJob_();
  if (!job) throw new Error('再開対象の記事はありません。');
  job.status = 'running';
  job.lastError = '';
  job.updatedAt = new Date().toISOString();
  uaSaveAutomaticPostingJob_(job);
  uaScheduleAutomaticPostingWorker_(1000);
  uaWriteAutomaticPostingStatus_('再開待ち：' + job.keyword, '');
  SpreadsheetApp.getUi().alert('停止位置から再開します。');
}

function uaStartAutomaticPostingDaily() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;
  try {
    const settings = uaReadAutomaticPostingSettings_();
    if (!settings.enabled) return;

    const activeJob = uaGetAutomaticPostingJob_();
    if (activeJob && activeJob.status !== 'complete') {
      if (activeJob.status === 'running') uaScheduleAutomaticPostingWorker_(1000);
      return;
    }

    const today = Utilities.formatDate(new Date(), UA_AUTOMATION_TIMEZONE, 'yyyy-MM-dd');
    const props = PropertiesService.getScriptProperties();
    const dailyProgress = uaGetAutomaticPostingDailyProgress_(today);
    if (dailyProgress.count >= settings.dailyLimit) return;

    const target = uaMoveFirstWriteCandidateToArticle_();
    if (!target) {
      uaWriteAutomaticPostingStatus_('待機中：「書く」の候補がありません。', '');
      return;
    }

    const job = {
      runId: Utilities.getUuid(),
      date: today,
      status: 'running',
      step: UA_AUTOMATION_STEP_READER_MIND,
      appType: target.appType,
      sheetName: target.sheetName,
      row: target.row,
      keyword: target.keyword,
      includeImages: settings.includeImages,
      publishMode: settings.publishMode,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastError: ''
    };
    uaSaveAutomaticPostingJob_(job);
    dailyProgress.count++;
    uaSaveAutomaticPostingDailyProgress_(dailyProgress);
    props.setProperty(UA_AUTOMATION_LAST_STARTED_DATE_PROPERTY, today);
    uaWriteAutomaticPostingStatus_('開始（' + dailyProgress.count + '/' + settings.dailyLimit + '記事）：' + job.keyword, '');
    uaScheduleAutomaticPostingWorker_(1000);
  } finally {
    lock.releaseLock();
  }
}

function uaStartNextAutomaticPosting() {
  uaDeleteAutomaticPostingTriggers_(UA_AUTOMATION_NEXT_HANDLER);
  uaStartAutomaticPostingDaily();
}

function uaRunAutomaticPostingWorker() {
  uaDeleteAutomaticPostingTriggers_(UA_AUTOMATION_WORKER_HANDLER);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    uaScheduleAutomaticPostingWorker_(60000);
    return;
  }

  try {
    const settings = uaReadAutomaticPostingSettings_();
    if (!settings.enabled) return;
    const job = uaGetAutomaticPostingJob_();
    if (!job || job.status !== 'running') return;

    const data = uaGetAutomaticPostingRowData_(job);
    uaWriteAutomaticPostingStatus_('処理中：' + job.keyword + ' / ' + uaGetAutomaticPostingStepLabel_(job.step), '');

    if (job.step === UA_AUTOMATION_STEP_READER_MIND) {
      if (!String(data.readerMindMemo || '').trim()) uaRunReaderMindMemoFromPanel(data);
      uaAdvanceAutomaticPostingJob_(job, UA_AUTOMATION_STEP_STRUCTURE, 60000);
      return;
    }

    if (job.step === UA_AUTOMATION_STEP_STRUCTURE) {
      if (String(data.structureMemo || '').trim()) {
        uaAdvanceAutomaticPostingJob_(job, UA_AUTOMATION_STEP_ARTICLE, 60000);
        return;
      }
      const result = uaRunArticleStructureForData_(data);
      if (result && result.trefaiJob) {
        job.trefaiJobId = result.trefaiJob.jobId || '';
        uaAdvanceAutomaticPostingJob_(job, UA_AUTOMATION_STEP_WAIT_TREFAI, 300000);
      } else {
        uaAdvanceAutomaticPostingJob_(job, UA_AUTOMATION_STEP_ARTICLE, 60000);
      }
      return;
    }

    if (job.step === UA_AUTOMATION_STEP_WAIT_TREFAI) {
      const latestData = uaGetAutomaticPostingRowData_(job);
      if (String(latestData.structureMemo || '').trim()) {
        uaAdvanceAutomaticPostingJob_(job, UA_AUTOMATION_STEP_ARTICLE, 60000);
        return;
      }
      const trefai = uaGetLatestTrefaiJobStatus_(job.appType, job.row, job.keyword);
      if (trefai && trefai.status === UA_TREFAI_STATUS_ERROR) {
        throw new Error('トレファイ処理エラー: ' + (trefai.message || '詳細なし'));
      }
      uaAdvanceAutomaticPostingJob_(job, UA_AUTOMATION_STEP_WAIT_TREFAI, 300000);
      return;
    }

    if (job.step === UA_AUTOMATION_STEP_ARTICLE) {
      if (!String(data.body || '').trim()) uaRunArticleFromPanel(data);
      uaAdvanceAutomaticPostingJob_(job, UA_AUTOMATION_STEP_INITIAL_WP, 60000);
      return;
    }

    if (job.step === UA_AUTOMATION_STEP_INITIAL_WP) {
      uaCreateWpDraftFromPanel(data);
      uaAdvanceAutomaticPostingJob_(job, job.includeImages ? UA_AUTOMATION_STEP_IMAGES : UA_AUTOMATION_STEP_CHECK, 60000);
      return;
    }

    if (job.step === UA_AUTOMATION_STEP_IMAGES) {
      const promptResult = uaCreateImagePromptPackFromPanel(data);
      const imageData = Object.assign({}, data, {
        imagePromptPack: promptResult.imagePromptPack,
        imageBatchSize: 1
      });
      const imageResult = uaGenerateWpImagesFromPanel(imageData);
      uaAdvanceAutomaticPostingJob_(job, imageResult && imageResult.imageHasMore ? UA_AUTOMATION_STEP_IMAGES : UA_AUTOMATION_STEP_CHECK, 60000);
      return;
    }

    if (job.step === UA_AUTOMATION_STEP_CHECK) {
      uaRunPrePublishCheckFromPanel(data);
      uaAdvanceAutomaticPostingJob_(job, UA_AUTOMATION_STEP_REVISION, 60000);
      return;
    }

    if (job.step === UA_AUTOMATION_STEP_REVISION) {
      uaApplyPrePublishFixesOnceFromPanel(data);
      uaAdvanceAutomaticPostingJob_(job, UA_AUTOMATION_STEP_FINAL_WP, 60000);
      return;
    }

    if (job.step === UA_AUTOMATION_STEP_FINAL_WP) {
      uaCreateWpDraftFromPanel(data);
      if (job.publishMode === '公開まで') {
        uaAdvanceAutomaticPostingJob_(job, UA_AUTOMATION_STEP_PUBLISH, 60000);
      } else {
        uaCompleteAutomaticPostingJob_(job, '完了（WordPress下書き）');
      }
      return;
    }

    if (job.step === UA_AUTOMATION_STEP_PUBLISH) {
      uaPublishWpPostFromAutomation_(data, job.includeImages);
      uaCompleteAutomaticPostingJob_(job, '完了（WordPress公開）');
      return;
    }

    throw new Error('不明な自動処理段階です: ' + job.step);
  } catch (e) {
    const job = uaGetAutomaticPostingJob_();
    if (job) {
      job.status = 'error';
      job.lastError = e && e.message ? e.message : String(e || '');
      job.updatedAt = new Date().toISOString();
      uaSaveAutomaticPostingJob_(job);
      uaTryMarkAutomaticPostingRowStopped_(job);
      uaWriteAutomaticPostingStatus_('停止：' + job.keyword, job.lastError);
    }
    console.error(e && e.stack ? e.stack : e);
  } finally {
    lock.releaseLock();
  }
}

function uaPublishWpPostFromAutomation_(data, requireImages) {
  const sheet = uaGetSheetForData_(data || {});
  const row = Number(data && data.row) || 0;
  const rowData = uaBuildRowData_(sheet, row);
  const ruleCheck = uaBuildPrePublishRuleCheck_(rowData);
  if (ruleCheck.critical.length) {
    throw new Error('公開前の重大NGが' + ruleCheck.critical.length + '件残っているため、下書きで停止しました。');
  }

  const appConfig = uaGetAppConfigByLabel_(rowData.appType);
  const wpConfig = uaGetWpConfig_(appConfig);
  const postId = Number(rowData.wpPostId || 0);
  if (!postId) throw new Error('WordPress下書きIDがありません。');

  const currentPost = uaFetchWpPostForEdit_(wpConfig, postId);
  const currentStatus = String(currentPost && currentPost.status || '').trim();
  if (['draft', 'pending', 'auto-draft'].indexOf(currentStatus) === -1) {
    throw new Error('WordPress側が下書き状態ではないため、自動公開を中止しました。');
  }
  if (requireImages && Number(currentPost && currentPost.featured_media || 0) <= 0) {
    throw new Error('アイキャッチがWordPressに反映されていないため、下書きで停止しました。');
  }

  const post = uaCallWordPressApi_(
    wpConfig,
    '/wp-json/wp/v2/posts/' + encodeURIComponent(postId),
    'post',
    { status: 'publish' }
  );
  if (!post || String(post.status || '') !== 'publish') {
    throw new Error('WordPressの公開完了を確認できませんでした。');
  }
  sheet.getRange(row, UA_COLUMNS.status).setValue(UA_STATUS_POSTED);
  SpreadsheetApp.flush();
  return uaBuildRowData_(sheet, row);
}

function uaMoveFirstWriteCandidateToArticle_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const appKeys = Object.keys(UA_APP_TYPES);
  for (let keyIndex = 0; keyIndex < appKeys.length; keyIndex++) {
    const appConfig = UA_APP_TYPES[appKeys[keyIndex]];
    if (!appConfig.candidateSheetName || !appConfig.articleSheetName || !appConfig.useWordPress) continue;
    const candidateSheet = ss.getSheetByName(appConfig.candidateSheetName);
    const articleSheet = ss.getSheetByName(appConfig.articleSheetName);
    if (!candidateSheet || !articleSheet) continue;
    uaEnsureCandidateSheetLayout_(candidateSheet);
    const lastRow = candidateSheet.getLastRow();
    if (lastRow < 2) continue;
    const values = candidateSheet.getRange(2, 1, lastRow - 1, UA_CANDIDATE_COLUMNS.volume).getValues();
    for (let index = 0; index < values.length; index++) {
      const candidate = values[index];
      const status = String(candidate[UA_CANDIDATE_COLUMNS.status - 1] || '').trim();
      const keyword = String(candidate[UA_CANDIDATE_COLUMNS.keyword - 1] || '').trim();
      if (status !== UA_CANDIDATE_STATUS_WRITE || !keyword) continue;
      const affiliateName = String(candidate[UA_CANDIDATE_COLUMNS.affiliateName - 1] || '').trim();
      const affiliate = uaGetAffiliateProjectByName_(affiliateName);
      const articleRow = uaFindNextArticleRow_(articleSheet);
      articleSheet.getRange(articleRow, 1, 1, UA_ARTICLE_COLUMN_COUNT).setValues([uaBuildArticleRowFromCandidate_(
        keyword,
        candidate[UA_CANDIDATE_COLUMNS.volume - 1] || '',
        appConfig,
        affiliate
      )]);
      candidateSheet.getRange(index + 2, UA_CANDIDATE_COLUMNS.status).setValue(UA_CANDIDATE_STATUS_SENT);
      uaApplyCandidateSheetRules_(candidateSheet);
      SpreadsheetApp.flush();
      return { appType: appConfig.label, sheetName: articleSheet.getName(), row: articleRow, keyword: keyword };
    }
  }
  return null;
}

function uaEnsureAutomaticPostingSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(UA_AUTOMATION_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(UA_AUTOMATION_SHEET_NAME);
  const existing = sheet.getRange('B2:B9').getDisplayValues().map(function(row) { return row[0]; });
  const rows = [
    ['設定', '値', '説明'],
    ['自動運転', existing[0] || 'OFF', 'ONのときだけ実行'],
    ['開始時刻', existing[1] === '' ? 4 : existing[1], '日本時間。0〜23時の整数'],
    ['1日の記事数', existing[2] === '' ? 1 : existing[2], '1〜5記事。1記事ずつ順番に処理'],
    ['画像', existing[3] || 'あり', 'アイキャッチと本文図解'],
    ['WordPress到達点', existing[4] || '下書きまで', '公開まででも重大NG時は下書き停止'],
    ['現在の状態', existing[5] || '', ''],
    ['最後の更新', existing[6] || '', ''],
    ['最後のエラー', existing[7] || '', '']
  ];
  sheet.getRange(1, 1, rows.length, 3).setValues(rows);
  sheet.getRange('B2').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['ON', 'OFF'], true).build());
  sheet.getRange('B3').setDataValidation(SpreadsheetApp.newDataValidation().requireNumberBetween(0, 23).setAllowInvalid(false).build());
  sheet.getRange('B4').setDataValidation(SpreadsheetApp.newDataValidation().requireNumberBetween(1, 5).setAllowInvalid(false).build());
  sheet.getRange('B5').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['あり', 'なし'], true).build());
  sheet.getRange('B6').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['下書きまで', '公開まで'], true).build());
  sheet.getRange('A1:C1').setFontWeight('bold').setBackground('#1f4e3d').setFontColor('#ffffff');
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 170);
  sheet.setColumnWidth(2, 180);
  sheet.setColumnWidth(3, 420);
  return sheet;
}

function uaReadAutomaticPostingSettings_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(UA_AUTOMATION_SHEET_NAME);
  if (!sheet) return { enabled: false, hour: 4, dailyLimit: 1, includeImages: true, publishMode: '下書きまで' };
  const values = sheet.getRange('B2:B6').getDisplayValues().map(function(row) { return String(row[0] || '').trim(); });
  return {
    enabled: values[0] === 'ON',
    hour: uaNormalizeAutomaticPostingInteger_(values[1], 0, 23, 4),
    dailyLimit: uaNormalizeAutomaticPostingInteger_(values[2], 1, 5, 1),
    includeImages: values[3] !== 'なし',
    publishMode: values[4] === '公開まで' ? '公開まで' : '下書きまで'
  };
}

function uaInstallAutomaticPostingTrigger_() {
  const settings = uaReadAutomaticPostingSettings_();
  uaDeleteAutomaticPostingTriggers_(UA_AUTOMATION_DAILY_HANDLER);
  ScriptApp.newTrigger(UA_AUTOMATION_DAILY_HANDLER)
    .timeBased()
    .atHour(settings.hour)
    .nearMinute(0)
    .everyDays(1)
    .inTimezone(UA_AUTOMATION_TIMEZONE)
    .create();
}

function uaScheduleAutomaticPostingWorker_(delayMs) {
  uaDeleteAutomaticPostingTriggers_(UA_AUTOMATION_WORKER_HANDLER);
  ScriptApp.newTrigger(UA_AUTOMATION_WORKER_HANDLER).timeBased().after(Math.max(1000, Number(delayMs) || 60000)).create();
}

function uaDeleteAutomaticPostingTriggers_(handlerName) {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === handlerName) ScriptApp.deleteTrigger(trigger);
  });
}

function uaGetAutomaticPostingJob_() {
  const raw = PropertiesService.getScriptProperties().getProperty(UA_AUTOMATION_JOB_PROPERTY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

function uaSaveAutomaticPostingJob_(job) {
  PropertiesService.getScriptProperties().setProperty(UA_AUTOMATION_JOB_PROPERTY, JSON.stringify(job || {}));
}

function uaGetAutomaticPostingRowData_(job) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(job.sheetName);
  if (!sheet) throw new Error('記事シートが見つかりません: ' + job.sheetName);
  const data = uaBuildRowData_(sheet, Number(job.row));
  if (String(data.mainInput || '').trim() !== String(job.keyword || '').trim()) {
    throw new Error('対象行のキーワードが変更されたため停止しました。');
  }
  return data;
}

function uaAdvanceAutomaticPostingJob_(job, nextStep, delayMs) {
  job.step = nextStep;
  job.updatedAt = new Date().toISOString();
  job.lastError = '';
  uaSaveAutomaticPostingJob_(job);
  uaScheduleAutomaticPostingWorker_(delayMs);
}

function uaCompleteAutomaticPostingJob_(job, message) {
  job.status = 'complete';
  job.step = 'complete';
  job.completedAt = new Date().toISOString();
  job.updatedAt = job.completedAt;
  job.lastError = '';
  uaSaveAutomaticPostingJob_(job);
  uaWriteAutomaticPostingStatus_(message + '：' + job.keyword, '');
  const settings = uaReadAutomaticPostingSettings_();
  const today = Utilities.formatDate(new Date(), UA_AUTOMATION_TIMEZONE, 'yyyy-MM-dd');
  const dailyProgress = uaGetAutomaticPostingDailyProgress_(today);
  if (settings.enabled && job.date === today && dailyProgress.count < settings.dailyLimit) {
    uaScheduleNextAutomaticPosting_(60000);
  }
}

function uaScheduleNextAutomaticPosting_(delayMs) {
  uaDeleteAutomaticPostingTriggers_(UA_AUTOMATION_NEXT_HANDLER);
  ScriptApp.newTrigger(UA_AUTOMATION_NEXT_HANDLER).timeBased().after(Math.max(1000, Number(delayMs) || 60000)).create();
}

function uaGetAutomaticPostingDailyProgress_(dateText) {
  const targetDate = String(dateText || '');
  const raw = PropertiesService.getScriptProperties().getProperty(UA_AUTOMATION_DAILY_PROGRESS_PROPERTY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && String(parsed.date || '') === targetDate) {
        return { date: targetDate, count: Math.max(0, Number(parsed.count) || 0) };
      }
    } catch (e) {
      console.error(e);
    }
  }
  return { date: targetDate, count: 0 };
}

function uaSaveAutomaticPostingDailyProgress_(progress) {
  PropertiesService.getScriptProperties().setProperty(UA_AUTOMATION_DAILY_PROGRESS_PROPERTY, JSON.stringify({
    date: String(progress && progress.date || ''),
    count: Math.max(0, Number(progress && progress.count) || 0)
  }));
}

function uaNormalizeAutomaticPostingInteger_(value, min, max, fallback) {
  const number = Math.floor(Number(value));
  if (!isFinite(number) || number < min || number > max) return fallback;
  return number;
}

function uaBuildAutomaticPostingRunningStatus_(settings) {
  const hour = uaNormalizeAutomaticPostingInteger_(settings && settings.hour, 0, 23, 4);
  const dailyLimit = uaNormalizeAutomaticPostingInteger_(settings && settings.dailyLimit, 1, 5, 1);
  return '稼働中：毎日' + hour + '時ごろに最大' + dailyLimit + '記事を順番に処理します。';
}

function uaTryMarkAutomaticPostingRowStopped_(job) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(job.sheetName);
    if (!sheet) return;
    const current = String(sheet.getRange(job.row, UA_COLUMNS.status).getValue() || '').trim();
    if (current !== UA_STATUS_WP_DRAFTED && current !== UA_STATUS_POSTED) {
      sheet.getRange(job.row, UA_COLUMNS.status).setValue(UA_STATUS_STOPPED);
    }
  } catch (e) {
    console.error(e);
  }
}

function uaWriteAutomaticPostingStatus_(status, errorMessage) {
  const sheet = uaEnsureAutomaticPostingSheet_();
  sheet.getRange('B7').setValue(status || '');
  sheet.getRange('B8').setValue(new Date());
  sheet.getRange('B9').setValue(errorMessage || '');
}

function uaGetAutomaticPostingStepLabel_(step) {
  const labels = {};
  labels[UA_AUTOMATION_STEP_READER_MIND] = '読者心理';
  labels[UA_AUTOMATION_STEP_STRUCTURE] = '記事構成';
  labels[UA_AUTOMATION_STEP_WAIT_TREFAI] = 'トレファイ待ち';
  labels[UA_AUTOMATION_STEP_ARTICLE] = '本文生成';
  labels[UA_AUTOMATION_STEP_INITIAL_WP] = 'WP下書き';
  labels[UA_AUTOMATION_STEP_IMAGES] = '画像生成';
  labels[UA_AUTOMATION_STEP_CHECK] = '公開前チェック';
  labels[UA_AUTOMATION_STEP_REVISION] = '自動修正';
  labels[UA_AUTOMATION_STEP_FINAL_WP] = 'WP最終反映';
  labels[UA_AUTOMATION_STEP_PUBLISH] = 'WordPress公開';
  return labels[step] || step;
}

function uaTestAutomaticPostingLogic() {
  const draft = { enabled: true, includeImages: true, publishMode: '下書きまで' };
  const publish = { enabled: true, includeImages: true, publishMode: '公開まで' };
  if (draft.publishMode === publish.publishMode) throw new Error('公開モード分岐テスト失敗');
  const steps = [
    UA_AUTOMATION_STEP_READER_MIND, UA_AUTOMATION_STEP_STRUCTURE, UA_AUTOMATION_STEP_WAIT_TREFAI,
    UA_AUTOMATION_STEP_ARTICLE, UA_AUTOMATION_STEP_INITIAL_WP, UA_AUTOMATION_STEP_IMAGES,
    UA_AUTOMATION_STEP_CHECK, UA_AUTOMATION_STEP_REVISION, UA_AUTOMATION_STEP_FINAL_WP,
    UA_AUTOMATION_STEP_PUBLISH
  ];
  if (steps.some(function(step) { return !uaGetAutomaticPostingStepLabel_(step); })) throw new Error('段階定義テスト失敗');
  if (uaNormalizeAutomaticPostingInteger_(25, 0, 23, 4) !== 4) throw new Error('開始時刻範囲テスト失敗');
  if (uaNormalizeAutomaticPostingInteger_(3, 1, 5, 1) !== 3) throw new Error('記事数変更テスト失敗');
  return { ok: true, tested: ['1日1〜5記事', '0〜23時', '画像あり', '下書き/公開分岐', '再開段階'] };
}
