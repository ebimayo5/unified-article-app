const UA_AUTOMATION_SHEET_NAME = '自動投稿設定';
const UA_AUTOMATION_JOB_PROPERTY = 'UA_AUTOMATION_ACTIVE_JOB';
const UA_AUTOMATION_LAST_STARTED_DATE_PROPERTY = 'UA_AUTOMATION_LAST_STARTED_DATE';
const UA_AUTOMATION_DAILY_PROGRESS_PROPERTY = 'UA_AUTOMATION_DAILY_PROGRESS';
const UA_AUTOMATION_DAILY_LOG_PROPERTY = 'UA_AUTOMATION_DAILY_LOG';
const UA_AUTOMATION_MANUAL_BATCH_PROPERTY = 'UA_AUTOMATION_MANUAL_BATCH';
const UA_AUTOMATION_DAILY_HANDLER = 'uaStartAutomaticPostingDaily';
const UA_AUTOMATION_DAILY_HANDLERS = {
  drive: 'uaStartAutomaticPostingDriveDaily',
  home: 'uaStartAutomaticPostingHomeDaily'
};
const UA_AUTOMATION_WORKER_HANDLER = 'uaRunAutomaticPostingWorker';
const UA_AUTOMATION_NEXT_HANDLER = 'uaStartNextAutomaticPosting';
const UA_AUTOMATION_TIMEZONE = 'Asia/Tokyo';
const UA_AUTOMATION_STALE_JOB_MINUTES = 20;

const UA_AUTOMATION_STEP_READER_MIND = 'reader_mind';
const UA_AUTOMATION_STEP_STRUCTURE = 'structure';
const UA_AUTOMATION_STEP_WAIT_TREFAI = 'wait_trefai';
const UA_AUTOMATION_STEP_ARTICLE = 'article';
const UA_AUTOMATION_STEP_PRODUCT_LINKS = 'product_links';
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
  const job = uaMarkStaleAutomaticPostingJobError_(uaGetAutomaticPostingJob_());
  const today = Utilities.formatDate(new Date(), UA_AUTOMATION_TIMEZONE, 'yyyy-MM-dd');
  const manualBatch = uaGetAutomaticPostingManualBatch_(appConfig.key, today);
  const statusValues = sheet.getRange(7, column, 3, 1).getDisplayValues().map(function(row) {
    return String(row[0] || '').trim();
  });
  const isThisSiteJob = job && job.status !== 'complete' && String(job.appType || '') === appConfig.label;
  const todayCount = uaGetAutomaticPostingDailyProgress_(today, appConfig.key).count;
  const todayPosted = uaGetAutomaticPostingDailyLog_(today, appConfig.key).items;
  const remainingSlots = manualBatch
    ? Math.max(0, Number(manualBatch.remaining) || 0)
    : Math.max(0, (Number(settings.dailyLimit) || 1) - todayCount);
  const todayUpcoming = uaListUpcomingAutomaticPostingCandidates_(appConfig, remainingSlots);
  return {
    todayCount: todayCount,
    todayPosted: todayPosted,
    todayUpcoming: todayUpcoming,
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
    activeJobStatus: isThisSiteJob ? String(job.status || '') : '',
    activeProgress: isThisSiteJob ? uaBuildAutomaticPostingProgress_(job) : null,
    manualBatchRequested: manualBatch ? Number(manualBatch.requestedCount) || 0 : 0,
    manualBatchStarted: manualBatch ? Number(manualBatch.startedCount) || 0 : 0,
    manualBatchRemaining: manualBatch ? Number(manualBatch.remaining) || 0 : 0
  };
}

function uaGetActiveAutomaticPostingArticleFromPanel(appType) {
  const job = uaMarkStaleAutomaticPostingJobError_(uaGetAutomaticPostingJob_());
  if (!job || String(job.status || '') === 'complete') {
    throw new Error('現在処理中の自動投稿記事はありません。');
  }

  const appConfig = uaGetAutomationAppConfig_(job.appType);
  const requestedType = String(appType || '').trim();
  if (requestedType) {
    const requestedConfig = uaGetAutomationAppConfig_(requestedType);
    if (requestedConfig.key !== appConfig.key) {
      throw new Error('処理中の記事は' + appConfig.label + 'です。サイトを切り替えてください。');
    }
  }

  const data = uaGetAutomaticPostingRowData_(job);
  data.automaticPostingProgress = uaBuildAutomaticPostingProgress_(job);
  data.message = '自動投稿中の記事「' + job.keyword + '」をパネルに表示しました。';
  return data;
}

function uaBuildAutomaticPostingProgress_(job) {
  const currentJob = job || {};
  const groups = [
    { keys: [UA_AUTOMATION_STEP_READER_MIND], label: '読者心理メモ' },
    { keys: [UA_AUTOMATION_STEP_STRUCTURE, UA_AUTOMATION_STEP_WAIT_TREFAI], label: '競合調査・構成案' },
    { keys: [UA_AUTOMATION_STEP_ARTICLE], label: '本文生成' },
    { keys: [UA_AUTOMATION_STEP_PRODUCT_LINKS], label: '商品導線保証' },
    { keys: [UA_AUTOMATION_STEP_INITIAL_WP], label: 'WP下書き準備' }
  ];
  if (currentJob.includeImages !== false) {
    groups.push({ keys: [UA_AUTOMATION_STEP_IMAGES], label: '画像生成・WP差し込み' });
  }
  groups.push(
    { keys: [UA_AUTOMATION_STEP_CHECK], label: '公開前チェック' },
    { keys: [UA_AUTOMATION_STEP_REVISION], label: '指摘修正（1回）' },
    { keys: [UA_AUTOMATION_STEP_FINAL_WP], label: 'WPへ修正版反映' }
  );
  if (String(currentJob.publishMode || '') === '公開まで') {
    groups.push({ keys: [UA_AUTOMATION_STEP_PUBLISH], label: 'WordPress公開' });
  }

  const currentStep = String(currentJob.step || '');
  let currentIndex = groups.findIndex(function(group) {
    return group.keys.indexOf(currentStep) !== -1;
  });
  if (currentIndex < 0) currentIndex = 0;

  return {
    steps: groups.map(function(group) { return group.label; }),
    currentIndex: currentIndex,
    currentLabel: uaGetAutomaticPostingStepLabel_(currentStep) || groups[currentIndex].label,
    state: String(currentJob.status || '') === 'error' ? 'error' : 'running',
    startedAt: String(currentJob.startedAt || ''),
    updatedAt: String(currentJob.updatedAt || '')
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
      uaDeleteAutomaticPostingTriggers_(UA_AUTOMATION_NEXT_HANDLER);
      uaPauseAutomaticPostingJob_(activeJob, '自動投稿設定をOFFにしたため一時停止しました。');
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
  uaPauseAutomaticPostingJob_(
    uaGetAutomaticPostingJob_(),
    '自動投稿を停止したため一時停止しました。'
  );
  uaWriteAutomaticPostingStatus_('drive', '停止中', '');
  uaWriteAutomaticPostingStatus_('home', '停止中', '');
  SpreadsheetApp.getUi().alert('自動投稿を停止しました。進行中の記事情報は保存しています。');
}

function uaPauseAutomaticPostingJob_(job, reason) {
  if (!job || String(job.status || '') === 'complete') return false;
  uaCancelAutomaticPostingBackgroundWork_(job);
  job.status = 'error';
  job.lastError = String(reason || '自動投稿を一時停止しました。');
  job.updatedAt = new Date().toISOString();
  uaSaveAutomaticPostingJob_(job);
  return true;
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
  if (!settings.enabled && job.manualBatch !== true) {
    throw new Error(appConfig.label + 'の自動投稿設定がOFFです。');
  }
  if (job.step === UA_AUTOMATION_STEP_WAIT_TREFAI) {
    uaResetLatestTrefaiJobForExplicitRetry_(job.appType, job.row, job.keyword);
    if (job.structureAi && job.backgroundCancellation) delete job.structureAi;
  }
  if (job.step === UA_AUTOMATION_STEP_ARTICLE && job.backgroundCancellation) {
    const articleSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(job.sheetName);
    if (articleSheet) {
      uaClearArticleBackgroundState_(uaGetArticleBackgroundStateKey_(articleSheet, Number(job.row)));
    }
  }
  delete job.backgroundCancellation;
  job.status = 'running';
  job.lastError = '';
  const resumedAt = new Date().toISOString();
  job.stepStartedAt = resumedAt;
  job.updatedAt = resumedAt;
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

  if (job.manualBatch === true) {
    uaRestoreAutomaticPostingManualBatchArticle_(appConfig.key, job.date);
  } else {
    const progress = uaGetAutomaticPostingDailyProgress_(job.date, appConfig.key);
    if (progress.count > 0) {
      progress.count--;
      uaSaveAutomaticPostingDailyProgress_(progress, appConfig.key);
    }
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

function uaStartAutomaticPostingNowFromPanel(appType, articleCount) {
  const appConfig = uaGetAutomationAppConfig_(appType);
  const requestedCount = Math.floor(Number(articleCount));
  if (!isFinite(requestedCount) || requestedCount < 1 || requestedCount > 5) {
    throw new Error('今から開始する記事数は1〜5件で選んでください。');
  }

  const activeJob = uaMarkStaleAutomaticPostingJobError_(uaGetAutomaticPostingJob_());
  if (uaHasBlockingAutomaticPostingJob_(activeJob)) {
    const activeConfig = uaGetAutomationAppConfig_(activeJob.appType);
    if (String(activeJob.status || '') === 'error') {
      throw new Error('「' + activeJob.keyword + '」がエラー停止中です。'
        + activeConfig.label + 'で「停止位置から再開」または「この記事を対象外にして次へ」を選んでから開始してください。');
    }
    throw new Error(activeConfig.label + 'の「' + activeJob.keyword + '」を処理中です。完了後に開始してください。');
  }

  const today = Utilities.formatDate(new Date(), UA_AUTOMATION_TIMEZONE, 'yyyy-MM-dd');
  uaDeleteAutomaticPostingTriggers_(UA_AUTOMATION_WORKER_HANDLER);
  uaDeleteAutomaticPostingTriggers_(UA_AUTOMATION_NEXT_HANDLER);
  uaSaveAutomaticPostingManualBatch_({
    date: today,
    appKey: appConfig.key,
    requestedCount: requestedCount,
    startedCount: 0,
    remaining: requestedCount,
    createdAt: new Date().toISOString()
  }, appConfig.key);

  const started = uaStartAutomaticPostingForSite_(appConfig.key);
  const result = uaGetAutomaticPostingSettingsForPanel(appConfig.label);
  result.message = started
    ? appConfig.label + 'で今から' + requestedCount + '記事の処理を開始しました。1記事ずつ順番に進みます。'
    : result.manualBatchRemaining > 0
      ? appConfig.label + 'で今から' + requestedCount + '記事を開始予約しました。現在の安全確認後に1記事ずつ進みます。'
      : appConfig.label + 'の候補シートに「書く」の記事がないため、開始しませんでした。';
  return result;
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
    const today = Utilities.formatDate(new Date(), UA_AUTOMATION_TIMEZONE, 'yyyy-MM-dd');
    const manualBatch = uaGetAutomaticPostingManualBatch_(appConfig.key, today);
    const isManualStart = !!(manualBatch && Number(manualBatch.remaining) > 0);
    if (!settings.enabled && !isManualStart) return false;

    const activeJob = uaMarkStaleAutomaticPostingJobError_(uaGetAutomaticPostingJob_());
    if (uaHasBlockingAutomaticPostingJob_(activeJob)) {
      // 進行中ジョブは、そのジョブ自身が予約した1本のワーカーチェーンだけに任せる。
      // starter側でもworker/nextを予約すると、長時間処理中に重複実行ループが生まれる。
      return false;
    }

    const props = PropertiesService.getScriptProperties();
    const dailyProgress = uaGetAutomaticPostingDailyProgress_(today, appConfig.key);
    if (!isManualStart && dailyProgress.count >= settings.dailyLimit) return false;

    const target = uaMoveFirstWriteCandidateToArticle_(appConfig.label);
    if (!target) {
      if (isManualStart) uaClearAutomaticPostingManualBatch_(appConfig.key);
      uaWriteAutomaticPostingStatus_(appConfig.key, '待機中：「書く」の候補がありません。', '');
      return false;
    }

    if (isManualStart) {
      manualBatch.remaining = Math.max(0, Number(manualBatch.remaining) - 1);
      manualBatch.startedCount = Math.max(0, Number(manualBatch.startedCount) || 0) + 1;
      manualBatch.updatedAt = new Date().toISOString();
      uaSaveAutomaticPostingManualBatch_(manualBatch, appConfig.key);
    }

    const startedAt = new Date().toISOString();
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
      startedAt: startedAt,
      stepStartedAt: startedAt,
      updatedAt: startedAt,
      lastError: '',
      manualBatch: isManualStart,
      manualBatchRequested: isManualStart ? Number(manualBatch.requestedCount) || 0 : 0
    };
    uaSaveAutomaticPostingJob_(job);
    if (!isManualStart) {
      dailyProgress.count++;
      uaSaveAutomaticPostingDailyProgress_(dailyProgress, appConfig.key);
    }
    props.setProperty(UA_AUTOMATION_LAST_STARTED_DATE_PROPERTY + '_' + appConfig.key, today);
    uaWriteAutomaticPostingStatus_(appConfig.key, isManualStart
      ? '今すぐ開始（' + manualBatch.startedCount + '/' + manualBatch.requestedCount + '記事）：' + job.keyword
      : '開始（' + dailyProgress.count + '/' + settings.dailyLimit + '記事）：' + job.keyword, '');
    uaScheduleAutomaticPostingWorker_(1000);
    return true;
  } finally {
    lock.releaseLock();
  }
}

function uaHasBlockingAutomaticPostingJob_(job) {
  return !!(job && String(job.status || '') !== 'complete');
}

function uaMarkStaleAutomaticPostingJobError_(job) {
  if (!job || String(job.status || '') !== 'running') return job;

  // Polling the same step updates updatedAt, so use the time the step itself
  // began when detecting an endlessly waiting worker.
  const stepStartedAtMs = Date.parse(String(job.stepStartedAt || job.updatedAt || job.startedAt || ''));
  if (!isFinite(stepStartedAtMs)) return job;

  const staleMs = UA_AUTOMATION_STALE_JOB_MINUTES * 60 * 1000;
  if (Date.now() - stepStartedAtMs < staleMs) return job;

  const appConfig = uaGetAutomationAppConfig_(job.appType);
  uaCancelAutomaticPostingBackgroundWork_(job);
  job.status = 'error';
  job.lastError = UA_AUTOMATION_STALE_JOB_MINUTES
    + '分以上進捗更新がないため、安全のためエラー停止に切り替えました。'
    + '保存済み工程から再開するか、この記事を対象外にして次へ進んでください。';
  job.updatedAt = new Date().toISOString();
  uaSaveAutomaticPostingJob_(job);
  uaTryMarkAutomaticPostingRowStopped_(job);
  uaWriteAutomaticPostingStatus_(appConfig.key, '停止：' + job.keyword, job.lastError);
  try {
    uaSendAutomaticPostingErrorNotification_(job, appConfig, job.lastError);
  } catch (notificationError) {
    console.error(notificationError && notificationError.stack ? notificationError.stack : notificationError);
  }
  return job;
}

function uaCancelAutomaticPostingBackgroundWork_(job) {
  if (!job || !job.sheetName || !job.row) return null;
  let responseId = '';
  let stateKey = '';
  let state = null;

  if (job.step === UA_AUTOMATION_STEP_ARTICLE) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(job.sheetName);
    if (sheet) {
      stateKey = uaGetArticleBackgroundStateKey_(sheet, Number(job.row));
      state = uaLoadArticleBackgroundState_(stateKey);
      responseId = String(state && state.responseId || '').trim();
    }
  } else if (job.step === UA_AUTOMATION_STEP_WAIT_TREFAI) {
    responseId = String(job.structureAi && job.structureAi.responseId || '').trim();
  }

  if (!responseId) return null;
  let result;
  try {
    result = uaCancelOpenAiBackgroundResponse_(responseId);
  } catch (e) {
    result = { cancelled: false, status: 'cancel_failed', message: String(e && e.message || e) };
  }
  job.backgroundCancellation = {
    responseId: responseId,
    cancelledAt: new Date().toISOString(),
    result: result
  };
  if (state && stateKey) {
    state.phase = result && result.cancelled ? 'cancelled' : 'cancel_requested';
    state.cancelledAt = job.backgroundCancellation.cancelledAt;
    uaSaveArticleBackgroundState_(stateKey, state);
  }
  return result;
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
    const job = uaMarkStaleAutomaticPostingJobError_(uaGetAutomaticPostingJob_());
    if (!job || job.status !== 'running') return;
    const appConfig = uaGetAutomationAppConfig_(job.appType);
    const settings = uaReadAutomaticPostingSettings_(appConfig.key);
    if (!settings.enabled && job.manualBatch !== true) return;

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
      const trefai = uaIsTrefaiBridgeEnabled_()
        ? uaGetLatestTrefaiJobStatus_(job.appType, job.row, job.keyword)
        : { status: UA_TREFAI_STATUS_DONE, competitorUrls: [], competitorPages: [] };
      if (trefai && trefai.status === UA_TREFAI_STATUS_ERROR) {
        throw new Error('トレファイ処理エラー: ' + (trefai.message || '詳細なし'));
      }
      if (trefai && trefai.status === UA_TREFAI_STATUS_DONE) {
        const articleSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(job.sheetName);
        if (!articleSheet) throw new Error('記事シートが見つかりません: ' + job.sheetName);
        if (!job.structureAi || !String(job.structureAi.responseId || '').trim()) {
          job.structureAi = uaStartArticleStructureBackgroundForRow_(
            articleSheet,
            Number(job.row),
            uaGetAutomationAppConfig_(job.appType),
            uaGetArticleProvider_(),
            {
              messagePrefix: (trefai.competitorUrls || []).length
                ? 'トレファイURLを使って記事構成を作成しました。'
                : '記事構成を作成しました。',
              competitorUrls: trefai.competitorUrls || [],
              competitorPages: trefai.competitorPages || []
            }
          );
          uaAdvanceAutomaticPostingJob_(job, UA_AUTOMATION_STEP_WAIT_TREFAI, 60000);
          return;
        }
        const structureResult = uaContinueArticleStructureBackgroundForRow_(
          articleSheet,
          Number(job.row),
          job.structureAi
        );
        if (structureResult && structureResult.pending) {
          uaAdvanceAutomaticPostingJob_(job, UA_AUTOMATION_STEP_WAIT_TREFAI, 60000);
          return;
        }
        delete job.structureAi;
        uaAdvanceAutomaticPostingJob_(job, UA_AUTOMATION_STEP_ARTICLE, 60000);
        return;
      }
      uaAdvanceAutomaticPostingJob_(job, UA_AUTOMATION_STEP_WAIT_TREFAI, 300000);
      return;
    }

    if (job.step === UA_AUTOMATION_STEP_ARTICLE) {
      if (!String(data.body || '').trim()) {
        uaRunArticleFromPanel(Object.assign({}, data, { automaticPosting: true }));
      }
      uaAdvanceAutomaticPostingJob_(job, UA_AUTOMATION_STEP_PRODUCT_LINKS, 60000);
      return;
    }

    if (job.step === UA_AUTOMATION_STEP_PRODUCT_LINKS) {
      uaEnsureAutomaticProductLinksForData_(Object.assign({}, data, { automaticPosting: true }));
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
      uaEnsureAutomaticProductLinksForData_(Object.assign({}, data, { automaticPosting: true }));
      const finalWpData = uaGetAutomaticPostingRowData_(job);
      uaCreateWpDraftFromPanel(finalWpData);
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
    if (job && job.step === UA_AUTOMATION_STEP_ARTICLE && e && e.uaArticleBackgroundPending) {
      job.status = 'running';
      job.lastError = '';
      job.updatedAt = new Date().toISOString();
      uaSaveAutomaticPostingJob_(job);
      const waitingArticleConfig = uaGetAutomationAppConfig_(job.appType);
      uaWriteAutomaticPostingStatus_(
        waitingArticleConfig.key,
        '処理中: ' + job.keyword + ' / OpenAIの本文生成完了待ち',
        ''
      );
      uaScheduleAutomaticPostingWorker_(5 * 60 * 1000);
      return;
    }
    if (job && job.step === UA_AUTOMATION_STEP_REVISION && e && e.uaBackgroundPending) {
      job.status = 'running';
      job.lastError = '';
      job.updatedAt = new Date().toISOString();
      uaSaveAutomaticPostingJob_(job);
      const waitingConfig = uaGetAutomationAppConfig_(job.appType);
      uaWriteAutomaticPostingStatus_(
        waitingConfig.key,
        '処理中: ' + job.keyword + ' / OpenAIの修正結果待ち',
        ''
      );
      uaScheduleAutomaticPostingWorker_(5 * 60 * 1000);
      return;
    }
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

  uaSyncWpMetaDescription_(wpConfig, postId, rowData.metaDescription);

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
  uaClearPrePublishCompletedStateForRow_(sheet, row);
  SpreadsheetApp.flush();

  try {
    uaUpsertInternalLinkCandidateForPost_(
      appConfig,
      String(post.link || ''),
      uaDecodeHtmlEntities_(String(post.title && post.title.rendered || rowData.mainInput || '')),
      rowData.metaDescription,
      rowData.body,
      rowData.tags
    );
  } catch (e) {
    console.error('内部リンク候補の自動追加に失敗しました: ' + (e && e.message ? e.message : e));
  }

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
    const performanceTerms = uaFetchTopPerformingQueryTermsSafely_(appConfig);
    const selectedIndex = uaSelectNextCandidateIndex_(values, appConfig, performanceTerms);
    if (selectedIndex === -1) return null;

    const candidate = values[selectedIndex];
    const keyword = String(candidate[UA_CANDIDATE_COLUMNS.keyword - 1] || '').trim();
    const affiliateName = String(candidate[UA_CANDIDATE_COLUMNS.affiliateName - 1] || '').trim();
    const affiliate = uaGetAffiliateProjectByName_(affiliateName);
    const articleRow = uaFindNextArticleRow_(articleSheet);
    articleSheet.getRange(articleRow, 1, 1, UA_ARTICLE_COLUMN_COUNT).setValues([uaBuildArticleRowFromCandidate_(
      keyword,
      candidate[UA_CANDIDATE_COLUMNS.volume - 1] || '',
      appConfig,
      affiliate
    )]);
    candidateSheet.getRange(selectedIndex + 2, UA_CANDIDATE_COLUMNS.status).setValue(UA_CANDIDATE_STATUS_SENT);
    uaApplyCandidateSheetRules_(candidateSheet);
    SpreadsheetApp.flush();
    return { appType: appConfig.label, sheetName: articleSheet.getName(), row: articleRow, keyword: keyword };
}

function uaSelectNextCandidateIndex_(values, appConfig, performanceTerms) {
  const preferProductLinked = appConfig && appConfig.key === 'home';
  const terms = Array.isArray(performanceTerms) ? performanceTerms : [];
  let firstWritableIndex = -1;
  let firstProductLinkedIndex = -1;
  let firstProvenDemandIndex = -1;

  for (let index = 0; index < values.length; index++) {
    const candidate = values[index];
    const status = String(candidate[UA_CANDIDATE_COLUMNS.status - 1] || '').trim();
    const keyword = String(candidate[UA_CANDIDATE_COLUMNS.keyword - 1] || '').trim();
    if (status !== UA_CANDIDATE_STATUS_WRITE || !keyword) continue;
    if (firstWritableIndex === -1) firstWritableIndex = index;
    if (!preferProductLinked) continue;

    const isProductLinked = !!uaGetMainKeywordProductProfile_({ mainInput: keyword }, appConfig);
    if (!isProductLinked) continue;
    if (firstProductLinkedIndex === -1) firstProductLinkedIndex = index;
    if (firstProvenDemandIndex === -1 && terms.length > 0 && uaKeywordMatchesPerformanceTerms_(keyword, terms)) {
      firstProvenDemandIndex = index;
    }
  }

  if (firstProvenDemandIndex !== -1) return firstProvenDemandIndex;
  if (firstProductLinkedIndex !== -1) return firstProductLinkedIndex;
  return firstWritableIndex;
}

function uaKeywordMatchesPerformanceTerms_(keyword, terms) {
  const normalized = String(keyword || '');
  return terms.some(function(term) {
    return term && normalized.indexOf(term) !== -1;
  });
}

function uaFetchTopPerformingQueryTermsSafely_(appConfig) {
  if (!appConfig || appConfig.key !== 'home') return [];
  try {
    return uaFetchTopPerformingQueryTerms_(appConfig);
  } catch (e) {
    console.error('GSC実績シグナルの取得に失敗しました（候補選定は商品優先ロジックのみで継続します）: ' + (e && e.message ? e.message : e));
    return [];
  }
}

const UA_GSC_PERFORMANCE_SHEET_NAME = 'たくみパパ_GSC実績';
const UA_GSC_PERFORMANCE_COLUMNS = { query: 1, clicks: 2, updatedAt: 3 };
const UA_GSC_PERFORMANCE_HEADERS = ['検索クエリ', 'クリック数', '更新日'];

function uaEnsureGscPerformanceSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(UA_GSC_PERFORMANCE_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(UA_GSC_PERFORMANCE_SHEET_NAME);
  const headerRange = sheet.getRange(1, 1, 1, UA_GSC_PERFORMANCE_HEADERS.length);
  const currentHeaders = headerRange.getDisplayValues()[0];
  const matches = UA_GSC_PERFORMANCE_HEADERS.every(function(header, index) {
    return String(currentHeaders[index] || '').trim() === header;
  });
  if (!matches) {
    headerRange.setValues([UA_GSC_PERFORMANCE_HEADERS]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Google Search Console has no Apps Script Advanced Service, and pulling it via
// raw UrlFetchApp would require manually re-declaring this project's entire
// oauthScopes list (risking breakage of the unrelated, already-working daily
// automatic posting). Instead this reads real GSC numbers that get pasted into
// the UA_GSC_PERFORMANCE_SHEET_NAME sheet periodically (via browser export or by
// asking Claude to refresh it) -- see uaSaveGscPerformanceRows_.
function uaFetchTopPerformingQueryTerms_(appConfig) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(UA_GSC_PERFORMANCE_SHEET_NAME);
  if (!sheet) return [];
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, UA_GSC_PERFORMANCE_COLUMNS.clicks).getValues();
  const rows = values.map(function(row) {
    return {
      query: String(row[UA_GSC_PERFORMANCE_COLUMNS.query - 1] || '').trim(),
      clicks: Number(row[UA_GSC_PERFORMANCE_COLUMNS.clicks - 1]) || 0
    };
  });
  return uaExtractPerformanceTermsFromGscRows_(rows);
}

function uaExtractPerformanceTermsFromGscRows_(rows) {
  const stopWords = /^(?:の|と|に|は|が|で|を|も|や|から|まで|後悔|デメリット|メリット|おすすめ|比較|方法|やり方|とは|いくら|安い|人気|口コミ|評判|理由|原因|対策)$/;
  const terms = {};
  (rows || []).forEach(function(row) {
    const clicks = Number(row.clicks || 0);
    if (clicks <= 0) return;
    const query = String(row.query || '').trim();
    if (!query) return;
    query.split(/[\s　・、,／/|｜]+/).forEach(function(term) {
      const trimmed = term.trim();
      if (trimmed.length < 2 || stopWords.test(trimmed)) return;
      terms[trimmed] = true;
    });
  });
  return Object.keys(terms);
}

// One-off helper to (re)populate the manual GSC performance sheet. rows is an
// array of {query, clicks} pulled from a real Search Console report.
function uaSaveGscPerformanceRows_(rows) {
  const sheet = uaEnsureGscPerformanceSheet_();
  if (!Array.isArray(rows) || rows.length === 0) return { ok: true, written: 0 };
  const now = new Date();
  const values = rows.map(function(row) {
    return [String(row.query || '').trim(), Number(row.clicks) || 0, now];
  });
  sheet.getRange(2, 1, sheet.getLastRow() > 1 ? sheet.getLastRow() - 1 : 0, UA_GSC_PERFORMANCE_HEADERS.length).clearContent();
  sheet.getRange(2, 1, values.length, UA_GSC_PERFORMANCE_HEADERS.length).setValues(values);
  return { ok: true, written: values.length };
}

// One-off: seed たくみパパ_GSC実績 with the real Search Console top-30 queries
// (kurashi-ie.com, 3か月, pulled 2026-08-30). Re-run uaSaveGscPerformanceRows_
// with a fresh export periodically to keep this current.
function uaRunGscPerformanceSeed20260830() {
  return uaSeedGscPerformanceSheet20260830_();
}

function uaSeedGscPerformanceSheet20260830_() {
  return uaSaveGscPerformanceRows_([
    { query: '二階 洗面台 後悔', clicks: 31 },
    { query: '排水口 不織布 つまる', clicks: 12 },
    { query: '排水溝ネット 不織布 詰まる', clicks: 9 },
    { query: '冷蔵庫 コンロ 向かい合わせ', clicks: 8 },
    { query: '冷蔵庫 マット 後悔', clicks: 8 },
    { query: 'ランドリールーム 木製 チェスト カビ', clicks: 8 },
    { query: 'ランドリー チェスト カビない', clicks: 6 },
    { query: 'サンシェード強風対策', clicks: 6 },
    { query: 'キッチン 排水溝ネット すぐ詰まる', clicks: 6 },
    { query: '冷蔵庫 コンロ 向かい合わせ 対策', clicks: 5 },
    { query: '水切りフィルター 不織布 詰まる', clicks: 5 },
    { query: '隣の家との距離 1m', clicks: 4 },
    { query: '冷蔵庫 コンロ 向かい合わせ 狭い', clicks: 3 },
    { query: 'トイレ掃除シート いらない', clicks: 3 },
    { query: 'トイレ掃除シート 代用', clicks: 3 },
    { query: 'ランドリーチェスト カビない', clicks: 3 },
    { query: 'セカンド洗面台 後悔', clicks: 2 },
    { query: 'サンシェード 強風対策', clicks: 2 },
    { query: '2階 洗面台 後悔', clicks: 2 },
    { query: 'ポップアップテント たためない', clicks: 2 },
    { query: 'ランドリールーム チェスト 湿気', clicks: 2 },
    { query: '洗面所 タンス カビ', clicks: 2 },
    { query: '冷蔵庫 コンロ 向かい合わせ 距離', clicks: 1 },
    { query: '100均 水切りネット 詰まる', clicks: 1 },
    { query: 'コンロ 冷蔵庫 向かい合わせ', clicks: 1 },
    { query: 'ランドリー チェスト 湿気に強い', clicks: 1 },
    { query: '洗面所 窓なし 後悔', clicks: 1 },
    { query: '洗い桶 ステンレス デメリット', clicks: 1 },
    { query: 'サンシェード 台風対策', clicks: 1 },
    { query: '2階 洗面台後悔', clicks: 1 }
  ]);
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
  const webAppUrl = uaGetArticleWebAppUrl_();
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
  const webAppUrl = uaGetArticleWebAppUrl_();
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

function uaGetAutomaticPostingDiagnostics_() {
  const job = uaGetAutomaticPostingJob_();
  const triggers = ScriptApp.getProjectTriggers().map(function(trigger) {
    return {
      handler: trigger.getHandlerFunction(),
      source: String(trigger.getTriggerSource()),
      eventType: String(trigger.getEventType())
    };
  });
  return {
    checkedAt: new Date().toISOString(),
    job: job,
    trefai: job ? uaGetLatestTrefaiJobStatus_(job.appType, job.row, job.keyword) : null,
    triggers: triggers,
    driveSettings: uaReadAutomaticPostingSettings_('drive'),
    homeSettings: uaReadAutomaticPostingSettings_('home')
  };
}

function uaGetAutomaticPostingDiagnosticsForCodex() {
  return uaGetAutomaticPostingDiagnostics_();
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
  const previousStep = String(job.step || '');
  const cleanNextStep = String(nextStep || '');
  if (previousStep !== cleanNextStep || !String(job.stepStartedAt || '').trim()) {
    job.stepStartedAt = new Date().toISOString();
  }
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
  if (String(message || '').indexOf('完了') === 0) {
    uaAppendAutomaticPostingDailyLog_({
      keyword: job.keyword,
      time: job.completedAt,
      mode: message.indexOf('公開') !== -1 ? 'published' : 'drafted'
    }, appConfig.key);
  }
  if (job.manualBatch === true) {
    const manualBatch = uaGetAutomaticPostingManualBatch_(appConfig.key, job.date);
    if (!manualBatch || Number(manualBatch.remaining) <= 0) {
      uaClearAutomaticPostingManualBatch_(appConfig.key);
    }
  }
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

function uaGetAutomaticPostingDailyLog_(dateText, appType) {
  const appConfig = uaGetAutomationAppConfig_(appType);
  const targetDate = String(dateText || '');
  const propertyName = UA_AUTOMATION_DAILY_LOG_PROPERTY + '_' + appConfig.key;
  const raw = PropertiesService.getScriptProperties().getProperty(propertyName);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && String(parsed.date || '') === targetDate && Array.isArray(parsed.items)) {
        return { date: targetDate, items: parsed.items };
      }
    } catch (e) {
      console.error(e);
    }
  }
  return { date: targetDate, items: [] };
}

function uaAppendAutomaticPostingDailyLog_(entry, appType) {
  const appConfig = uaGetAutomationAppConfig_(appType);
  const today = Utilities.formatDate(new Date(), UA_AUTOMATION_TIMEZONE, 'yyyy-MM-dd');
  const log = uaGetAutomaticPostingDailyLog_(today, appConfig.key);
  log.items.push(entry);
  PropertiesService.getScriptProperties().setProperty(
    UA_AUTOMATION_DAILY_LOG_PROPERTY + '_' + appConfig.key,
    JSON.stringify({ date: today, items: log.items.slice(-20) })
  );
}

function uaListUpcomingAutomaticPostingCandidates_(appConfig, limit) {
  const maxCount = Math.floor(Number(limit)) || 0;
  if (maxCount <= 0 || !appConfig || !appConfig.candidateSheetName) return [];
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(appConfig.candidateSheetName);
  if (!sheet) return [];
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, UA_CANDIDATE_COLUMNS.volume).getValues();
  const results = [];
  for (let index = 0; index < values.length && results.length < maxCount; index++) {
    const status = String(values[index][UA_CANDIDATE_COLUMNS.status - 1] || '').trim();
    const keyword = String(values[index][UA_CANDIDATE_COLUMNS.keyword - 1] || '').trim();
    if (status === UA_CANDIDATE_STATUS_WRITE && keyword) results.push(keyword);
  }
  return results;
}

function uaGetAutomaticPostingManualBatch_(appType, dateText) {
  const appConfig = uaGetAutomationAppConfig_(appType);
  const propertyName = UA_AUTOMATION_MANUAL_BATCH_PROPERTY + '_' + appConfig.key;
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty(propertyName);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || String(parsed.date || '') !== String(dateText || '')) {
      props.deleteProperty(propertyName);
      return null;
    }
    return parsed;
  } catch (e) {
    console.error(e);
    props.deleteProperty(propertyName);
    return null;
  }
}

function uaSaveAutomaticPostingManualBatch_(batch, appType) {
  const appConfig = uaGetAutomationAppConfig_(appType);
  PropertiesService.getScriptProperties().setProperty(
    UA_AUTOMATION_MANUAL_BATCH_PROPERTY + '_' + appConfig.key,
    JSON.stringify(batch || {})
  );
}

function uaClearAutomaticPostingManualBatch_(appType) {
  const appConfig = uaGetAutomationAppConfig_(appType);
  PropertiesService.getScriptProperties().deleteProperty(UA_AUTOMATION_MANUAL_BATCH_PROPERTY + '_' + appConfig.key);
}

function uaRestoreAutomaticPostingManualBatchArticle_(appType, dateText) {
  const batch = uaGetAutomaticPostingManualBatch_(appType, dateText);
  if (!batch) return false;
  batch.remaining = Math.min(Number(batch.requestedCount) || 5, Math.max(0, Number(batch.remaining) || 0) + 1);
  batch.startedCount = Math.max(0, (Number(batch.startedCount) || 0) - 1);
  batch.updatedAt = new Date().toISOString();
  uaSaveAutomaticPostingManualBatch_(batch, appType);
  return true;
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
    const manualBatch = uaGetAutomaticPostingManualBatch_(key, today);
    if (manualBatch && Number(manualBatch.remaining) > 0) return true;
    const settings = uaReadAutomaticPostingSettings_(key);
    if (!settings.enabled || currentHour < settings.hour) return false;
    return uaGetAutomaticPostingDailyProgress_(today, key).count < settings.dailyLimit;
  });
}

function uaGetAutomaticPostingStepLabel_(step) {
  const labels = {};
  labels[UA_AUTOMATION_STEP_READER_MIND] = '読者心理';
  labels[UA_AUTOMATION_STEP_STRUCTURE] = '記事構成';
  labels[UA_AUTOMATION_STEP_WAIT_TREFAI] = uaIsTrefaiBridgeEnabled_() ? 'トレファイ待ち' : '競合URL取得・構成案作成中';
  labels[UA_AUTOMATION_STEP_ARTICLE] = '本文生成';
  labels[UA_AUTOMATION_STEP_PRODUCT_LINKS] = '商品導線保証';
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
    UA_AUTOMATION_STEP_ARTICLE, UA_AUTOMATION_STEP_PRODUCT_LINKS, UA_AUTOMATION_STEP_INITIAL_WP, UA_AUTOMATION_STEP_IMAGES,
    UA_AUTOMATION_STEP_CHECK, UA_AUTOMATION_STEP_REVISION, UA_AUTOMATION_STEP_FINAL_WP,
    UA_AUTOMATION_STEP_PUBLISH
  ];
  if (steps.some(function(step) { return !uaGetAutomaticPostingStepLabel_(step); })) throw new Error('段階定義テスト失敗');
  if (uaNormalizeAutomaticPostingInteger_(25, 0, 23, 4) !== 4) throw new Error('開始時刻範囲テスト失敗');
  if (uaNormalizeAutomaticPostingInteger_(3, 1, 5, 1) !== 3) throw new Error('記事数変更テスト失敗');
  if (!uaHasBlockingAutomaticPostingJob_({ status: 'running' })) throw new Error('進行中ジョブの重複開始防止テスト失敗');
  if (!uaHasBlockingAutomaticPostingJob_({ status: 'error' })) throw new Error('停止中ジョブの重複開始防止テスト失敗');
  if (uaHasBlockingAutomaticPostingJob_({ status: 'complete' })) throw new Error('完了ジョブ判定テスト失敗');
  return { ok: true, tested: ['1日1〜5記事', '0〜23時', '画像あり', '下書き/公開分岐', '再開段階', '重複開始防止'] };
}
