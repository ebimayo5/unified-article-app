// 2026-09-05: 「お宝キーワード」自動発掘機能。
//
// これまで keyword_research_app/（トレファイ連携ブリッジ）という、ユーザーの
// ローカルPCで別途起動する独立したPythonデスクトップアプリ側にあった
// ドメイン分類・スコアリングのロジックを、この統合版アプリ（Google Apps
// Script、クラウド側で完結）に移植し、スタンドアロンアプリ起動への依存を
// 無くす。ドメインリスト（keyword_research_app/data/target_sites.json）は
// 既に精査済みだったものをそのまま流用している。
//
// お宝キーワードの定義（ユーザー指定、2026-09-05）:
// ・Yahoo!知恵袋等のQ&Aサイト、アメブロ/はてなブログ等の無料ブログ、
//   X/ThreadsなどのSNS、会社名の無い個人ブログが、より多く・より上位に
//   ランクインしているキーワード（特に個人ブログが多いほど良い）
// ・月間検索数100以上（ただし実数の自動取得手段が無いため、ここでは
//   SERP構成だけで判定し、検索数はユーザーがラッコキーワードで手動確認する
//   運用にする）
//
// 安全設計: 2026-08-23の自動投稿コスト事故を踏まえ、この機能は「書く」へは
// 絶対に直接書き込まない。新しいステータス「AI提案」（UA_CANDIDATE_STATUS_AI_SUGGESTED）
// で候補シートへ追加するだけに留め、人が検索ボリュームを確認した上で
// 「書く」へ昇格させる前提とする。

const UA_TREASURE_KEYWORD_QA_SITES = [
  'chiebukuro.yahoo.co.jp',
  'detail.chiebukuro.yahoo.co.jp',
  'oshiete.goo.ne.jp',
  'okwave.jp',
  'komachi.yomiuri.co.jp',
  'jp.quora.com',
  'teratail.com',
  'ja.stackoverflow.com',
  'qa.mamari.jp',
  'soumunomori.com'
];

const UA_TREASURE_KEYWORD_FREE_BLOGS = [
  'ameblo.jp',
  'hatenablog.com',
  'hatenablog.jp',
  'hatenadiary.jp',
  'blog.goo.ne.jp',
  'plaza.rakuten.co.jp',
  'note.com',
  'fanblogs.jp',
  'cocolog-nifty.com',
  'tumblr.com',
  'fc2.com',
  'seesaa.net',
  'livedoor.blog',
  'jugem.jp',
  'exblog.jp',
  'muragon.com',
  'blogspot.com'
];

const UA_TREASURE_KEYWORD_SNS = [
  'tiktok.com',
  'instagram.com',
  'x.com',
  'twitter.com',
  'threads.net',
  'bsky.app',
  'facebook.com'
];

// 汎用（どのサイトにも強い）強ドメイン。
const UA_TREASURE_KEYWORD_STRONG_DOMAINS_COMMON = [
  'amazon.co.jp',
  'rakuten.co.jp',
  'shopping.yahoo.co.jp',
  'yahoo.co.jp',
  'wikipedia.org',
  'kakaku.com',
  'my-best.com',
  'kurashiru.com'
];

// サイトごとに強いジャンル特化ドメインを追加する。
const UA_TREASURE_KEYWORD_STRONG_DOMAINS_BY_APP = {
  home: [
    'suumo.jp',
    'homes.co.jp',
    'nitori-net.jp',
    'muji.com',
    'irisohyama.co.jp',
    'panasonic.jp',
    'sharp.co.jp',
    'hitachi.co.jp',
    'toshiba.co.jp',
    'lixil.co.jp',
    'toto.co.jp',
    'ikea.com',
    'nissen.co.jp',
    'cainz.com',
    'kohnan.co.jp'
  ],
  drive: [
    'carview.yahoo.co.jp',
    'response.jp',
    'kuruma-news.jp',
    'webcartop.jp',
    'autocar.jp',
    'carsensor.net',
    'goo-net.com',
    'toyota.jp',
    'honda.co.jp',
    'subaru.jp',
    'nissan.co.jp',
    'mazda.co.jp',
    'suzuki.co.jp',
    'daihatsu.co.jp'
  ]
};

function uaGetTreasureKeywordStrongDomains_(appConfig) {
  const byApp = UA_TREASURE_KEYWORD_STRONG_DOMAINS_BY_APP[appConfig && appConfig.key] || [];
  return UA_TREASURE_KEYWORD_STRONG_DOMAINS_COMMON.concat(byApp);
}

function uaExtractUrlHostname_(url) {
  const match = String(url || '').match(/^https?:\/\/([^/]+)/i);
  if (!match) return '';
  return match[1].replace(/^www\./i, '').toLowerCase();
}

function uaHostMatchesDomainList_(host, domains) {
  return domains.some(function(domain) {
    const normalized = domain.toLowerCase();
    if (host === normalized) return true;
    // サブドメイン一致（例: detail.chiebukuro.yahoo.co.jp は chiebukuro.yahoo.co.jp
    // に一致させたい）。host が normalized より真に長い場合のみ判定する
    // -- 同じ長さの別ドメイン同士だと、indexOf の「見つからない」(-1) と
    // 期待位置の計算がたまたま両方 -1 になり誤って一致してしまう不具合が
    // あったため、長さを先に確認する。
    if (host.length <= normalized.length) return false;
    const suffix = '.' + normalized;
    return host.indexOf(suffix) === host.length - suffix.length;
  });
}

// keyword_research_app/app/scorer.py の classify_domain を移植。
function uaClassifyTreasureDomain_(url, appConfig) {
  const host = uaExtractUrlHostname_(url);
  if (!host) return 'other';
  if (uaHostMatchesDomainList_(host, UA_TREASURE_KEYWORD_QA_SITES)) return 'qa_site';
  if (uaHostMatchesDomainList_(host, UA_TREASURE_KEYWORD_FREE_BLOGS)) return 'free_blog';
  if (uaHostMatchesDomainList_(host, UA_TREASURE_KEYWORD_SNS)) return 'sns';
  if (uaHostMatchesDomainList_(host, uaGetTreasureKeywordStrongDomains_(appConfig))) return 'strong_domain';
  return 'other';
}

// Serperの生の検索結果を取得する（outline.gsのuaFetchGoogleTopUrlsViaSerper_は
// 記事構成づくり用に知恵袋・Q&Aサイトを最初から除外しているため、
// お宝キーワード判定にはそのまま使えない。ここではフィルタ無しで取得する）。
function uaFetchSerperOrganicResultsRaw_(query, maxCount) {
  const apiKey = uaGetSerperApiKey_();
  if (!apiKey) return [];

  const response = UrlFetchApp.fetch('https://google.serper.dev/search', {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    headers: { 'X-API-KEY': apiKey },
    payload: JSON.stringify({
      q: query,
      gl: 'jp',
      hl: 'ja',
      num: Math.max(10, maxCount)
    })
  });

  if (response.getResponseCode() >= 400) {
    throw new Error('Serper API error ' + response.getResponseCode() + ': ' + response.getContentText('UTF-8'));
  }

  const data = JSON.parse(response.getContentText('UTF-8'));
  const organic = (data && data.organic) || [];
  return organic.slice(0, maxCount).map(function(item) {
    return {
      url: String((item && item.link) || '').trim(),
      title: String((item && item.title) || '').trim()
    };
  }).filter(function(item) { return item.url; });
}

function uaRankScoreForWeakSignal_(rank, topScore, midScore, lowScore) {
  if (!rank || rank <= 0) return 0;
  if (rank <= 3) return topScore;
  if (rank <= 5) return midScore;
  if (rank <= 10) return lowScore;
  return 0;
}

// keyword_research_app/app/scorer.py の calculate_score / judge_level を移植。
// allintitle/intitle・検索ボリュームは自動取得手段が無いため対象外にしている
// （検索ボリュームはユーザーがラッコキーワードで手動確認する運用）。
function uaScoreTreasureKeywordSerp_(query, appConfig) {
  const results = uaFetchSerperOrganicResultsRaw_(query, 10);
  if (results.length === 0) {
    return { score: 0, level: '取得失敗', results: [], weakUrls: [], strongCount: 0 };
  }

  let qaCount = 0, qaRank = 0;
  let freeBlogCount = 0, freeBlogRank = 0;
  let snsCount = 0, snsRank = 0;
  let strongCount = 0;
  const weakUrls = [];

  results.forEach(function(item, index) {
    const rank = index + 1;
    const type = uaClassifyTreasureDomain_(item.url, appConfig);
    if (type === 'qa_site') {
      qaCount++;
      if (!qaRank) qaRank = rank;
      weakUrls.push(item.url);
    } else if (type === 'free_blog') {
      freeBlogCount++;
      if (!freeBlogRank) freeBlogRank = rank;
      weakUrls.push(item.url);
    } else if (type === 'sns') {
      snsCount++;
      if (!snsRank) snsRank = rank;
      weakUrls.push(item.url);
    } else if (type === 'strong_domain') {
      strongCount++;
    }
  });

  let score = 0;
  score += uaRankScoreForWeakSignal_(qaRank, 40, 28, 16);
  score += uaRankScoreForWeakSignal_(freeBlogRank, 30, 20, 12);
  score += uaRankScoreForWeakSignal_(snsRank, 16, 11, 7);
  score += Math.min(Math.max(qaCount - 1, 0) * 4, 8);
  score += Math.min(Math.max(freeBlogCount - 1, 0) * 3, 6);
  score += Math.min(Math.max(snsCount - 1, 0) * 2, 4);
  score -= Math.min(strongCount * 5, 15);
  score = Math.max(0, Math.min(100, score));

  let level;
  if (score >= 80) level = 'かなり狙い目';
  else if (score >= 60) level = '狙いやすい';
  else if (score >= 40) level = '要検討';
  else level = '厳しい';

  return {
    score: score,
    level: level,
    results: results,
    weakUrls: weakUrls,
    strongCount: strongCount,
    qaCount: qaCount,
    freeBlogCount: freeBlogCount,
    snsCount: snsCount
  };
}

const UA_TREASURE_KEYWORD_SCORE_THRESHOLD = 40; // judge_levelの「要検討」以上のみ残す
const UA_TREASURE_KEYWORD_BATCH_SIZE = 8; // 1回の実行で使うAI呼び出し・Serper呼び出しの上限（コスト抑制）

function uaCollectExistingCandidateKeywords_(candidateSheet) {
  const lastRow = candidateSheet.getLastRow();
  if (lastRow < 2) return [];
  const values = candidateSheet.getRange(2, UA_CANDIDATE_COLUMNS.keyword, lastRow - 1, 1).getValues();
  return values.map(function(row) { return String(row[0] || '').trim(); }).filter(Boolean);
}

function uaCollectExistingArticleKeywords_(articleSheet) {
  const lastRow = articleSheet.getLastRow();
  if (lastRow < 2) return [];
  const values = articleSheet.getRange(2, UA_COLUMNS.mainInput, lastRow - 1, 1).getValues();
  return values.map(function(row) { return String(row[0] || '').trim(); }).filter(Boolean);
}

function uaBuildTreasureKeywordIdeationPrompt_(appConfig, existingKeywords, count) {
  const genreHint = appConfig.key === 'home'
    ? 'ソファ、チェスト、ラック、収納ケース、洗濯機、冷蔵庫、掃除機、除湿機、加湿器、サーキュレーター、空気清浄機、物干し、ベビーゲート、見守りカメラ、防災用品、サンシェード、日よけ、トイレブラシ、汚れ防止シート、結露防止シート、電気毛布、こたつ、室内ジャングルジム、シーリングライトなど、暮らし用品・家具・家電'
    : 'カーナビ、ドライブレコーダー、レーダー探知機、バックカメラ、スマホホルダー、フロアマット、シートカバー、ポータブル電源、タイヤチェーンなど、車載機器・カー用品';

  return [
    '暮らし系ブログ「' + appConfig.label + '」の新しい記事キーワード候補を' + count + '個、考えてください。',
    '',
    '条件:',
    '1. 次のような、実際に売れている物理的な商品ジャンルのどれかに、はっきり結びつくキーワードにしてください: ' + genreHint,
    '2. 単なる「おすすめ」「比較」ではなく、「カビない」「壊れやすい」「後悔」「デメリット」のような、読者の悩み・不安・失敗回避の切り口にしてください（購入直前ではなく、購入を検討し始めた読者が検索しそうな言葉）。',
    '3. 既存の候補・既存記事と内容が重複しないようにしてください。既存一覧:',
    existingKeywords.slice(0, 150).join('、') || '（まだ無し）',
    '4. 競合が強すぎる一般的なビッグキーワードではなく、具体的な悩みに絞った言葉にしてください。',
    '',
    'JSON形式のみで回答してください: {"keywords": ["キーワード1", "キーワード2", ...]}'
  ].join('\n');
}

function uaGenerateTreasureKeywordCandidates_(appConfig, existingKeywords, count) {
  const prompt = uaBuildTreasureKeywordIdeationPrompt_(appConfig, existingKeywords, count);
  const result = uaCallGeminiJson_(prompt, 800, 0);
  const keywords = (result && result.data && result.data.keywords) || [];
  return keywords
    .map(function(value) { return String(value || '').trim(); })
    .filter(function(value) { return value.length >= 2; });
}

// 候補シートへ新しい「AI提案」行を追加する。既存の行には一切触れない。
// 2026-09-05: ユーザー指定により、一番下への追記ではなく見出し直下（一番上）へ
// 挿入する。毎回の実行結果がすぐ目に入るようにするため。
function uaAppendAiSuggestedCandidates_(candidateSheet, keywords) {
  if (keywords.length === 0) return;
  const rows = keywords.map(function(keyword) {
    return [UA_CANDIDATE_STATUS_AI_SUGGESTED, UA_NO_AFFILIATE_NAME, keyword, ''];
  });
  const insertRow = 2;
  candidateSheet.insertRowsBefore(insertRow, rows.length);
  // 2026-09-05: 挿入直後の行は「状態」列の入力規則が未更新（過去の書く/転送済み/保留のみの
  // 古いルール）のままなことがあり、setValuesが先だと「AI提案」を書いた瞬間に入力規則
  // 違反で例外になる。先にuaApplyCandidateSheetRules_で入力規則を最新化してから書き込む。
  uaApplyCandidateSheetRules_(candidateSheet);
  candidateSheet.getRange(insertRow, 1, rows.length, 4).setValues(rows);
  uaApplyCandidateSheetRules_(candidateSheet);
  SpreadsheetApp.flush();
}

// メインの発掘処理。「書く」への昇格は絶対に行わない（人が確認して昇格させる）。
function uaDiscoverTreasureKeywords_(appConfig) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const candidateSheet = ss.getSheetByName(appConfig.candidateSheetName);
  if (!candidateSheet) throw new Error('候補シートが見つかりません: ' + appConfig.candidateSheetName);
  const articleSheet = ss.getSheetByName(appConfig.articleSheetName);

  const existingCandidateKeywords = uaCollectExistingCandidateKeywords_(candidateSheet);
  const existingArticleKeywords = articleSheet ? uaCollectExistingArticleKeywords_(articleSheet) : [];
  const existingKeywords = existingCandidateKeywords.concat(existingArticleKeywords);
  const existingSet = {};
  existingKeywords.forEach(function(keyword) { existingSet[keyword] = true; });

  const rawCandidates = uaGenerateTreasureKeywordCandidates_(appConfig, existingKeywords, UA_TREASURE_KEYWORD_BATCH_SIZE);
  console.log('AI提案キーワード(生成直後): ' + JSON.stringify(rawCandidates));

  const results = [];
  rawCandidates.forEach(function(keyword) {
    if (existingSet[keyword]) {
      results.push({ keyword: keyword, kept: false, reason: '既存の候補・記事と重複' });
      return;
    }
    const profile = uaGetMainKeywordProductProfile_({ mainInput: keyword }, appConfig);
    if (!profile) {
      results.push({ keyword: keyword, kept: false, reason: '商品ひも付きと判定されず' });
      return;
    }

    let serpResult;
    try {
      serpResult = uaScoreTreasureKeywordSerp_(keyword, appConfig);
    } catch (e) {
      results.push({ keyword: keyword, kept: false, reason: 'Serper取得エラー: ' + (e && e.message || e) });
      return;
    }

    const kept = serpResult.score >= UA_TREASURE_KEYWORD_SCORE_THRESHOLD;
    results.push({
      keyword: keyword,
      kept: kept,
      productLabel: profile.label,
      serpScore: serpResult.score,
      serpLevel: serpResult.level,
      weakUrls: serpResult.weakUrls,
      reason: kept
        ? ('お宝候補として採用（' + serpResult.level + '、スコア' + serpResult.score + '）')
        : ('SERPスコア不足（' + serpResult.level + '、スコア' + serpResult.score + ' < ' + UA_TREASURE_KEYWORD_SCORE_THRESHOLD + '）')
    });
  });

  const keptKeywords = results.filter(function(item) { return item.kept; }).map(function(item) { return item.keyword; });
  uaAppendAiSuggestedCandidates_(candidateSheet, keptKeywords);

  const summary = { appKey: appConfig.key, addedCount: keptKeywords.length, results: results };
  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

function uaDiscoverTreasureKeywordsHome() {
  return uaDiscoverTreasureKeywords_(UA_APP_TYPES.home);
}

function uaDiscoverTreasureKeywordsDrive() {
  return uaDiscoverTreasureKeywords_(UA_APP_TYPES.drive);
}

// 2026-09-05: 手動で「実行」を何十回もクリックするのは非現実的なので、1回の実行内で
// 複数バッチを回すループ版。Apps Scriptの実行時間上限（6分）に当たる前に自分で
// 安全に打ち切る（5.5分）。目標回数に届かなければ、この関数をもう一度実行すれば続きから
// 再開できる（候補シート・既存記事のキーワードを毎回スキャンして重複除外するため）。
function uaDiscoverTreasureKeywordsLoop_(appConfig, times) {
  const maxIterations = Math.max(1, Number(times) || 1);
  const maxMillis = 5.5 * 60 * 1000;
  const startedAt = Date.now();
  let iterationsRun = 0;
  let totalAdded = 0;
  const addedKeywords = [];

  for (let i = 0; i < maxIterations; i++) {
    if (Date.now() - startedAt > maxMillis) {
      console.log('実行時間の上限に近づいたため中断（' + iterationsRun + '/' + maxIterations + '回実行済み）。続きはもう一度実行してください。');
      break;
    }

    let summary;
    try {
      summary = uaDiscoverTreasureKeywords_(appConfig);
    } catch (e) {
      console.log((i + 1) + '回目でエラー: ' + (e && e.message || e));
      continue;
    }

    iterationsRun++;
    totalAdded += summary.addedCount;
    summary.results.forEach(function(r) {
      if (r.kept) addedKeywords.push(r.keyword);
    });
    console.log(
      (i + 1) + '/' + maxIterations + '回目 完了。今回追加:' + summary.addedCount +
      '件、累計追加:' + totalAdded + '件（経過' + Math.round((Date.now() - startedAt) / 1000) + '秒）'
    );
  }

  const finalSummary = {
    iterationsRun: iterationsRun,
    targetIterations: maxIterations,
    totalAdded: totalAdded,
    addedKeywords: addedKeywords,
    elapsedSeconds: Math.round((Date.now() - startedAt) / 1000)
  };
  console.log('=== ループ終了 ===\n' + JSON.stringify(finalSummary, null, 2));
  return finalSummary;
}

function uaDiscoverTreasureKeywordsHomeLoop50() {
  return uaDiscoverTreasureKeywordsLoop_(UA_APP_TYPES.home, 50);
}

// 読み取り専用: 候補シート末尾の実データをそのまま確認する診断用。
function uaInspectCandidateSheetTailStatuses20260905() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(UA_APP_TYPES.home.candidateSheetName);
  const lastRow = sheet.getLastRow();
  const scanRows = Math.min(10, lastRow - 1);
  const range = sheet.getRange(lastRow - scanRows + 1, 1, scanRows, 4);
  const values = range.getValues();
  const validations = range.getDataValidations();
  const rows = values.map(function(row, i) {
    const rule = validations[i][0];
    return {
      row: lastRow - scanRows + 1 + i,
      status: row[0],
      affiliateName: row[1],
      keyword: row[2],
      volume: row[3],
      statusValidationCriteriaValues: rule ? rule.getCriteriaValues() : null
    };
  });
  console.log(JSON.stringify(rows, null, 2));
  return rows;
}
