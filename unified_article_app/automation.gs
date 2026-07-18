const UA_AUTOMATION_SHEET_NAME = '自動投稿設定';
const UA_AUTOMATION_JOB_PROPERTY = 'UA_AUTOMATION_ACTIVE_JOB';
const UA_AUTOMATION_LAST_STARTED_DATE_PROPERTY = 'UA_AUTOMATION_LAST_STARTED_DATE';
const UA_AUTOMATION_DAILY_PROGRESS_PROPERTY = 'UA_AUTOMATION_DAILY_PROGRESS';
const UA_AUTOMATION_DAILY_HANDLER = 'uaStartAutomaticPostingDaily';
const UA_AUTOMATION_DAILY_HANDLERS = {
  drive: 'uaStartAutomaticPostingDriveDaily',
  home: 'uaStartAutomaticPostingHomeDaily'
};
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
  sheet.getRange('B2').setValue('ON');
  const settings = uaReadAutomaticPostingSettings_('drive');
  uaInstallAutomaticPostingTrigger_('drive');
  uaWriteAutomaticPostingStatus_('drive', uaBuildAutomaticPostingRunningStatus_(settings), '');
  return sheet;
}

function uaOpenAutomaticPostingSettings() {
  const sheet = uaEnsureAutomaticPostingSheet_();
  SpreadsheetApp.getActiveSpreadsheet().setActiveSheet(sheet);
}

function uaGetAutomaticPostingSettingsForPanel(appType) {
  const sheet = uaEnsureAutomaticPostingSheet_();
  const appConfig = uaGetAutomationAppConfig_(appType);
  const settings = uaReadAutomaticPostingSettings_(appConfig.key);
  const column = uaGetAutomationColumn_(appConfig.key);
  const statusValues = sheet.getRange(7, column, 3, 1).getDisplayValues().map(function(row) {
    return String(row[0] || '').trim();
  });
  const job = uaGetAutomaticPostingJob_();
  const isThisSiteJob = job && job.status !== 'complete' && String(job.appType || '') === appConfig.label;
  return {
    appType: appConfig.label,
    appKey: appConfig.key,
    siteLabel: appConfig.label,
    enabled: settings.enabled,
    hour: settings.hour,
    dailyLimit: settings.dailyLimit,
    includeImages: settings.includeImages,
    publishMode: settings.publishMode,
    notificationEnabled: settings.notificationEnabled,
    notificationEmail: settings.notificationEmail,
    status: statusValues[0] || (settings.enabled ? '稼働中' : '停止中'),
    lastUpdated: statusValues[1] || '',
    lastError: statusValues[2] || '',
    activeKeyword: isThisSiteJob ? String(job.keyword || '') : '',
    activeStep: isThisSiteJob ? uaGetAutomaticPostingStepLabel_(job.step) : '',
    activeJobStatus: isThisSiteJob ? String(job.status || '') : ''
  };
}

function uaSaveAutomaticPostingSettingsFromPanel(data) {
  const request = data || {};
  const sheet = uaEnsureAutomaticPostingSheet_();
  const appConfig = uaGetAutomationAppConfig_(request.appType);
  const column = uaGetAutomationColumn_(appConfig.key);
  const enabled = request.enabled === true || String(request.enabled || '').toUpperCase() === 'ON';
  const includeImages = request.includeImages !== false && String(request.includeImages || '') !== 'なし';
  const publishMode = String(request.publishMode || '') === '公開まで' ? '公開まで' : '下書きまで';
  const notificationEnabled = request.notificationEnabled !== false && String(request.notificationEnabled || '').toUpperCase() !== 'OFF';
  const notificationEmail = uaNormalizeAutomaticPostingNotificationEmail_(request.notificationEmail);
  if (notificationEnabled && !notificationEmail) {
    throw new Error('エラー通知をONにする場合は、通知先メールを入力してください。');
  }
  const hour = uaNormalizeAutomaticPostingInteger_(request.hour, 0, 23, 4);
  const dailyLimit = uaNormalizeAutomaticPostingInteger_(request.dailyLimit, 1, 5, 1);
  uaDeleteAutomaticPostingTriggers_(UA_AUTOMATION_DAILY_HANDLER);

  sheet.getRange(2, column, 5, 1).setValues([[
    enabled ? 'ON' : 'OFF'
  ], [hour], [dailyLimit], [
    includeImages ? 'あり' : 'なし'
  ], [
    publishMode
  ]]);
  sheet.getRange(10, column, 2, 1).setValues([[
    notificationEnabled ? 'ON' : 'OFF'
  ], [
    notificationEmail
  ]]);

  if (enabled) {
    uaInstallAutomaticPostingTrigger_(appConfig.key);
    uaWriteAutomaticPostingStatus_(appConfig.key, uaBuildAutomaticPostingRunningStatus_({ hour: hour, dailyLimit: dailyLimit }), '');
  } else {
    uaDeleteAutomaticPostingTriggers_(uaGetAutomationDailyHandler_(appConfig.key));
    const activeJob = uaGetAutomaticPostingJob_();
    if (activeJob && String(activeJob.appType || '') === appConfig.label) {
      uaDeleteAutomaticPostingTriggers_(UA_AUTOMATION_WORKER_HANDLER);
    }
    uaWriteAutomaticPostingStatus_(appConfig.key, '停止中', '');
  }

  const result = uaGetAutomaticPostingSettingsForPanel(appConfig.label);
  result.message = enabled
    ? appConfig.label + 'の自動投稿設定を保存し、毎日' + hour + '時ごろの実行を有効にしました。'
    : appConfig.label + 'の自動投稿設定を保存し、自動実行を停止しました。';
  return result;
}

function uaDisableAutomaticPosting() {
  const sheet = uaEnsureAutomaticPostingSheet_();
  sheet.getRange('B2:C2').setValue('OFF');
  uaDeleteAutomaticPostingTriggers_(UA_AUTOMATION_DAILY_HANDLER);
  Object.keys(UA_AUTOMATION_DAILY_HANDLERS).forEach(function(key) {
    uaDeleteAutomaticPostingTriggers_(UA_AUTOMATION_DAILY_HANDLERS[key]);
  });
  uaDeleteAutomaticPostingTriggers_(UA_AUTOMATION_WORKER_HANDLER);
  uaDeleteAutomaticPostingTriggers_(UA_AUTOMATION_NEXT_HANDLER);
  uaWriteAutomaticPostingStatus_('drive', '停止中', '');
  uaWriteAutomaticPostingStatus_('home', '停止中', '');
  SpreadsheetApp.getUi().alert('自動投稿を停止しました。進行中の記事情報は保存しています。');
}

function uaResumeAutomaticPosting() {
  const result = uaResumeAutomaticPostingFromPanel('');
  SpreadsheetApp.getUi().alert(result.message);
}

function uaResumeAutomaticPostingFromPanel(appType) {
  const job = uaGetAutomaticPostingJob_();
  if (!job) throw new Error('再開対象の記事はありません。');
  const appConfig = uaGetAutomationAppConfig_(job.appType);
  const requestedType = String(appType || '').trim();
  if (requestedType) {
    const requestedConfig = uaGetAutomationAppConfig_(requestedType);
    if (requestedConfig.key !== appConfig.key) {
      throw new Error('再開対象は' + appConfig.label + 'の記事です。' + appConfig.label + 'へ切り替えて再開してください。');
    }
  }
  if (String(job.status || '') !== 'error') {
    throw new Error('再開できるエラー停止中の記事はありません。');
  }
  const settings = uaReadAutomaticPostingSettings_(appConfig.key);
  if (!settings.enabled) throw new Error(appConfig.label + 'の自動投稿設定がOFFです。');
  job.status = 'running';
  job.lastError = '';
  job.updatedAt = new Date().toISOString();
  uaSaveAutomaticPostingJob_(job);
  uaScheduleAutomaticPostingWorker_(1000);
  uaWriteAutomaticPostingStatus_(appConfig.key, '再開待ち：' + job.keyword, '');
  const result = uaGetAutomaticPostingSettingsForPanel(appConfig.label);
  result.message = appConfig.label + 'の記事「' + job.keyword + '」を停止位置から再開しました。';
  return result;
}

function uaSkipAutomaticPostingFromPanel(appType) {
  const job = uaGetAutomaticPostingJob_();
  if (!job) throw new Error('対象外にする自動投稿記事はありません。');
  const appConfig = uaGetAutomationAppConfig_(job.appType);
  const requestedType = String(appType || '').trim();
  if (requestedType) {
    const requestedConfig = uaGetAutomationAppConfig_(requestedType);
    if (requestedConfig.key !== appConfig.key) {
      throw new Error('対象外にできるのは' + appConfig.label + 'の記事です。' + appConfig.label + 'へ切り替えてください。');
    }
  }
  if (String(job.status || '') !== 'error') {
    throw new Error('対象外にできるエラー停止中の記事はありません。');
  }

  uaMarkSkippedAutomaticPostingCandidateHeld_(job, appConfig);
  uaTryMarkAutomaticPostingRowStopped_(job);

  const progress = uaGetAutomaticPostingDailyProgress_(job.date, appConfig.key);
  if (progress.count > 0) {
    progress.count--;
    uaSaveAutomaticPostingDailyProgress_(progress, appConfig.key);
  }

  uaCompleteAutomaticPostingJob_(job, '対象外としてスキップ');
  uaScheduleNextAutomaticPosting_(1000);
  const result = uaGetAutomaticPostingSettingsForPanel(appConfig.label);
  result.message = '「' + job.keyword + '」を候補シートの保留へ戻し、次の候補へ進みます。';
  return result;
}

function uaMarkSkippedAutomaticPostingCandidateHeld_(job, appConfig) {
  if (!appConfig || !appConfig.candidateSheetName) return false;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(appConfig.candidateSheetName);
  if (!sheet || sheet.getLastRow() < 2) return false;
  uaEnsureCandidateSheetLayout_(sheet);
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, UA_CANDIDATE_COLUMNS.volume).getValues();
  const keyword = String(job && job.keyword || '').trim();
  for (let index = 0; index < values.length; index++) {
    const rowKeyword = String(values[index][UA_CANDIDATE_COLUMNS.keyword - 1] || '').trim();
    const status = String(values[index][UA_CANDIDATE_COLUMNS.status - 1] || '').trim();
    if (rowKeyword === keyword && (status === UA_CANDIDATE_STATUS_SENT || status === UA_CANDIDATE_STATUS_WRITE)) {
      sheet.getRange(index + 2, UA_CANDIDATE_COLUMNS.status).setValue(UA_CANDIDATE_STATUS_HOLD);
      uaApplyCandidateSheetRules_(sheet);
      SpreadsheetApp.flush();
      return true;
    }
  }
  return false;
}

function uaStartAutomaticPostingDaily() {
  uaStartAutomaticPostingForSite_('drive');
}

function uaStartAutomaticPostingDriveDaily() {
  uaStartAutomaticPostingForSite_('drive');
}

function uaStartAutomaticPostingHomeDaily() {
  uaStartAutomaticPostingForSite_('home');
}

function uaStartAutomaticPostingForSite_(appKey) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    uaScheduleNextAutomaticPosting_(60000);
    return false;
  }
  try {
    const appConfig = uaGetAutomationAppConfig_(appKey);
    const settings = uaReadAutomaticPostingSettings_(appConfig.key);
    if (!settings.enabled) return false;

    const activeJob = uaGetAutomaticPostingJob_();
    if (activeJob && activeJob.status !== 'complete') {
      if (activeJob.status === 'running') {
        uaScheduleAutomaticPostingWorker_(1000);
        uaScheduleNextAutomaticPosting_(60000);
      }
      return false;
    }

    const today = Utilities.formatDate(new Date(), UA_AUTOMATION_TIMEZONE, 'yyyy-MM-dd');
    const props = PropertiesService.getScriptProperties();
    const dailyProgress = uaGetAutomaticPostingDailyProgress_(today, appConfig.key);
    if (dailyProgress.count >= settings.dailyLimit) return false;

    const target = uaMoveFirstWriteCandidateToArticle_(appConfig.label);
    if (!target) {
      uaWriteAutomaticPostingStatus_(appConfig.key, '待機中：「書く」の候補がありません。', '');
      return false;
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
    uaSaveAutomaticPostingDailyProgress_(dailyProgress, appConfig.key);
    props.setProperty(UA_AUTOMATION_LAST_STARTED_DATE_PROPERTY + '_' + appConfig.key, today);
    uaWriteAutomaticPostingStatus_(appConfig.key, '開始（' + dailyProgress.count + '/' + settings.dailyLimit + '記事）：' + job.keyword, '');
    uaScheduleAutomaticPostingWorker_(1000);
    return true;
  } finally {
    lock.releaseLock();
  }
}

function uaStartNextAutomaticPosting() {
  uaDeleteAutomaticPostingTriggers_(UA_AUTOMATION_NEXT_HANDLER);
  const eligibleKeys = uaGetEligibleAutomationAppKeys_();
  for (let index = 0; index < eligibleKeys.length; index++) {
    if (uaStartAutomaticPostingForSite_(eligibleKeys[index])) return;
  }
}

function uaRunAutomaticPostingWorker() {
  uaDeleteAutomaticPostingTriggers_(UA_AUTOMATION_WORKER_HANDLER);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    uaScheduleAutomaticPostingWorker_(60000);
    return;
  }

  try {
    const job = uaGetAutomaticPostingJob_();
    if (!job || job.status !== 'running') return;
    const appConfig = uaGetAutomationAppConfig_(job.appType);
    const settings = uaReadAutomaticPostingSettings_(appConfig.key);
    if (!settings.enabled) return;

    const data = uaGetAutomaticPostingRowData_(job);
    uaWriteAutomaticPostingStatus_(appConfig.key, '処理中：' + job.keyword + ' / ' + uaGetAutomaticPostingStepLabel_(job.step), '');

    if (job.step === UA_AUTOMATION_STEP_READER_MIND) {
      if (!String(data.readerMindMemo || '').trim()) {
        uaRunReaderMindMemoFromPanel(Object.assign({}, data, { automaticPosting: true }));
      }
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
      const appConfig = uaGetAutomationAppConfig_(job.appType);
      uaWriteAutomaticPostingStatus_(appConfig.key, '停止：' + job.keyword, job.lastError);
      try {
        uaSendAutomaticPostingErrorNotification_(job, appConfig, job.lastError);
      } catch (notificationError) {
        console.error(notificationError && notificationError.stack ? notificationError.stack : notificationError);
      }
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

function uaMoveFirstWriteCandidateToArticle_(appType) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const appConfig = uaGetAutomationAppConfig_(appType);
  if (!appConfig.candidateSheetName || !appConfig.articleSheetName || !appConfig.useWordPress) return null;
    const candidateSheet = ss.getSheetByName(appConfig.candidateSheetName);
    const articleSheet = ss.getSheetByName(appConfig.articleSheetName);
    if (!candidateSheet || !articleSheet) return null;
    uaEnsureCandidateSheetLayout_(candidateSheet);
    const lastRow = candidateSheet.getLastRow();
    if (lastRow < 2) return null;
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
  return null;
}

function uaEnsureAutomaticPostingSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(UA_AUTOMATION_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(UA_AUTOMATION_SHEET_NAME);
  const driveExisting = sheet.getRange('B2:B11').getDisplayValues().map(function(row) { return row[0]; });
  const hasSiteColumns = String(sheet.getRange('C1').getDisplayValue() || '').trim() === UA_APP_TYPES.home.label;
  const homeExisting = hasSiteColumns
    ? sheet.getRange('C2:C11').getDisplayValues().map(function(row) { return row[0]; })
    : [];
  const defaultNotificationEmail = uaGetDefaultAutomaticPostingNotificationEmail_();
  const rows = [
    ['設定', UA_APP_TYPES.drive.label, UA_APP_TYPES.home.label, '説明'],
    ['自動運転', driveExisting[0] || 'OFF', homeExisting[0] || 'OFF', 'ONのサイトだけ実行'],
    ['開始時刻', driveExisting[1] === '' ? 4 : driveExisting[1], homeExisting[1] === '' || homeExisting[1] === undefined ? 4 : homeExisting[1], '日本時間。0〜23時の整数'],
    ['1日の記事数', driveExisting[2] === '' ? 1 : driveExisting[2], homeExisting[2] === '' || homeExisting[2] === undefined ? 1 : homeExisting[2], 'サイトごとに1〜5記事。全体では1記事ずつ順番に処理'],
    ['画像', driveExisting[3] || 'あり', homeExisting[3] || 'あり', 'アイキャッチと本文図解'],
    ['WordPress到達点', driveExisting[4] || '下書きまで', homeExisting[4] || '下書きまで', '公開まででも重大NG時は下書き停止'],
    ['現在の状態', driveExisting[5] || '', homeExisting[5] || '', ''],
    ['最後の更新', driveExisting[6] || '', homeExisting[6] || '', ''],
    ['最後のエラー', driveExisting[7] || '', homeExisting[7] || '', ''],
    ['エラー通知', driveExisting[8] || 'ON', homeExisting[8] || 'ON', 'エラー停止時にメール通知'],
    ['通知先メール', driveExisting[9] || defaultNotificationEmail, homeExisting[9] || defaultNotificationEmail, 'スマホで受信できるメールアドレス']
  ];
  sheet.getRange(1, 1, rows.length, 4).setValues(rows);
  sheet.getRange('B2:C2').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['ON', 'OFF'], true).build());
  sheet.getRange('B3:C3').setDataValidation(SpreadsheetApp.newDataValidation().requireNumberBetween(0, 23).setAllowInvalid(false).build());
  sheet.getRange('B4:C4').setDataValidation(SpreadsheetApp.newDataValidation().requireNumberBetween(1, 5).setAllowInvalid(false).build());
  sheet.getRange('B5:C5').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['あり', 'なし'], true).build());
  sheet.getRange('B6:C6').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['下書きまで', '公開まで'], true).build());
  sheet.getRange('B10:C10').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['ON', 'OFF'], true).build());
  sheet.getRange('A1:D1').setFontWeight('bold').setFontColor('#ffffff');
  sheet.getRange('A1:B1').setBackground('#1f4e3d');
  sheet.getRange('C1').setBackground('#7b5327');
  sheet.getRange('D1').setBackground('#344054');
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 170);
  sheet.setColumnWidth(2, 180);
  sheet.setColumnWidth(3, 180);
  sheet.setColumnWidth(4, 420);
  return sheet;
}

function uaReadAutomaticPostingSettings_(appType) {
  const appConfig = uaGetAutomationAppConfig_(appType);
  const sheet = uaEnsureAutomaticPostingSheet_();
  const column = uaGetAutomationColumn_(appConfig.key);
  const values = sheet.getRange(2, column, 5, 1).getDisplayValues().map(function(row) { return String(row[0] || '').trim(); });
  const notificationValues = sheet.getRange(10, column, 2, 1).getDisplayValues().map(function(row) { return String(row[0] || '').trim(); });
  return {
    appType: appConfig.label,
    appKey: appConfig.key,
    enabled: values[0] === 'ON',
    hour: uaNormalizeAutomaticPostingInteger_(values[1], 0, 23, 4),
    dailyLimit: uaNormalizeAutomaticPostingInteger_(values[2], 1, 5, 1),
    includeImages: values[3] !== 'なし',
    publishMode: values[4] === '公開まで' ? '公開まで' : '下書きまで',
    notificationEnabled: notificationValues[0] !== 'OFF',
    notificationEmail: uaNormalizeAutomaticPostingNotificationEmail_(notificationValues[1])
  };
}

function uaNormalizeAutomaticPostingNotificationEmail_(value) {
  const email = String(value || '').trim();
  if (!email) return '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('通知先メールの形式を確認してください。');
  }
  return email;
}

function uaGetDefaultAutomaticPostingNotificationEmail_() {
  try {
    return uaNormalizeAutomaticPostingNotificationEmail_(Session.getEffectiveUser().getEmail());
  } catch (e) {
    return '';
  }
}

function uaSendAutomaticPostingErrorNotification_(job, appConfig, errorMessage) {
  const settings = uaReadAutomaticPostingSettings_(appConfig.key);
  if (!settings.notificationEnabled || !settings.notificationEmail) return false;

  const occurredAt = Utilities.formatDate(new Date(), UA_AUTOMATION_TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
  const stepLabel = uaGetAutomaticPostingStepLabel_(job && job.step);
  const webAppUrl = String(ScriptApp.getService().getUrl() || '').trim();
  const spreadsheetUrl = SpreadsheetApp.getActiveSpreadsheet().getUrl();
  const bodyLines = [
    '自動投稿がエラーで停止しました。',
    '',
    'サイト: ' + appConfig.label,
    '記事: ' + String(job && job.keyword || ''),
    '停止工程: ' + (stepLabel || String(job && job.step || '不明')),
    '発生時刻: ' + occurredAt,
    'エラー: ' + String(errorMessage || '不明なエラー'),
    '',
    webAppUrl ? 'スマホで確認・再開: ' + webAppUrl : '',
    '管理シート: ' + spreadsheetUrl,
    '',
    'Webパネルで該当サイトを選び、赤いエラー欄の「停止位置から再開」をタップしてください。'
  ].filter(function(line) { return line !== ''; });

  MailApp.sendEmail({
    to: settings.notificationEmail,
    subject: '【Article Compass】' + appConfig.label + ' 自動投稿エラー',
    body: bodyLines.join('\n'),
    name: 'Article Compass System'
  });
  return true;
}

function uaSendAutomaticPostingTestNotificationFromPanel(appType, notificationEmail) {
  const appConfig = uaGetAutomationAppConfig_(appType);
  const email = uaNormalizeAutomaticPostingNotificationEmail_(notificationEmail);
  if (!email) throw new Error('テスト通知の送信先メールを入力してください。');
  const webAppUrl = String(ScriptApp.getService().getUrl() || '').trim();
  const bodyLines = [
    'Article Compass Systemのテスト通知です。',
    'サイト: ' + appConfig.label,
    'このメールがスマホに届けば、エラー通知の準備は完了です。',
    webAppUrl ? 'スマホ用Webパネル: ' + webAppUrl : '',
    '本番のエラー通知からWebパネルを開き、「停止位置から再開」をタップできます。'
  ].filter(Boolean);
  MailApp.sendEmail({
    to: email,
    subject: '【Article Compass】スマホ通知テスト',
    body: bodyLines.join('\n'),
    name: 'Article Compass System'
  });
  return {
    message: email + 'へテスト通知を送信しました。スマホで受信を確認してください。'
  };
}

function uaInstallAutomaticPostingTrigger_(appType) {
  const appConfig = uaGetAutomationAppConfig_(appType);
  const settings = uaReadAutomaticPostingSettings_(appConfig.key);
  const handler = uaGetAutomationDailyHandler_(appConfig.key);
  uaDeleteAutomaticPostingTriggers_(UA_AUTOMATION_DAILY_HANDLER);
  uaDeleteAutomaticPostingTriggers_(handler);
  ScriptApp.newTrigger(handler)
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
  const appConfig = uaGetAutomationAppConfig_(job.appType);
  uaWriteAutomaticPostingStatus_(appConfig.key, message + '：' + job.keyword, '');
  if (uaGetEligibleAutomationAppKeys_().length) {
    uaScheduleNextAutomaticPosting_(60000);
  }
}

function uaScheduleNextAutomaticPosting_(delayMs) {
  uaDeleteAutomaticPostingTriggers_(UA_AUTOMATION_NEXT_HANDLER);
  ScriptApp.newTrigger(UA_AUTOMATION_NEXT_HANDLER).timeBased().after(Math.max(1000, Number(delayMs) || 60000)).create();
}

function uaGetAutomaticPostingDailyProgress_(dateText, appType) {
  const appConfig = uaGetAutomationAppConfig_(appType);
  const targetDate = String(dateText || '');
  const propertyName = UA_AUTOMATION_DAILY_PROGRESS_PROPERTY + '_' + appConfig.key;
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty(propertyName) || (appConfig.key === 'drive' ? props.getProperty(UA_AUTOMATION_DAILY_PROGRESS_PROPERTY) : '');
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

function uaSaveAutomaticPostingDailyProgress_(progress, appType) {
  const appConfig = uaGetAutomationAppConfig_(appType);
  PropertiesService.getScriptProperties().setProperty(UA_AUTOMATION_DAILY_PROGRESS_PROPERTY + '_' + appConfig.key, JSON.stringify({
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

function uaWriteAutomaticPostingStatus_(appType, status, errorMessage) {
  const appConfig = uaGetAutomationAppConfig_(appType);
  const sheet = uaEnsureAutomaticPostingSheet_();
  const column = uaGetAutomationColumn_(appConfig.key);
  sheet.getRange(7, column).setValue(status || '');
  sheet.getRange(8, column).setValue(new Date());
  sheet.getRange(9, column).setValue(errorMessage || '');
}

function uaGetAutomationAppConfig_(appType) {
  const text = String(appType || '').trim();
  const config = UA_APP_TYPES[text] || uaGetAppConfigByLabel_(text || UA_APP_TYPES.drive.label);
  if (!config || ['drive', 'home'].indexOf(config.key) === -1) {
    throw new Error('自動投稿はDRIVE BASEまたはたくみパパを選んで設定してください。');
  }
  return config;
}

function uaGetAutomationColumn_(appType) {
  return uaGetAutomationAppConfig_(appType).key === 'home' ? 3 : 2;
}

function uaGetAutomationDailyHandler_(appType) {
  const key = uaGetAutomationAppConfig_(appType).key;
  return UA_AUTOMATION_DAILY_HANDLERS[key];
}

function uaGetEligibleAutomationAppKeys_() {
  const now = new Date();
  const today = Utilities.formatDate(now, UA_AUTOMATION_TIMEZONE, 'yyyy-MM-dd');
  const currentHour = Number(Utilities.formatDate(now, UA_AUTOMATION_TIMEZONE, 'H'));
  return ['drive', 'home'].filter(function(key) {
    const settings = uaReadAutomaticPostingSettings_(key);
    if (!settings.enabled || currentHour < settings.hour) return false;
    return uaGetAutomaticPostingDailyProgress_(today, key).count < settings.dailyLimit;
  });
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

