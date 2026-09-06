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

// 2026-09-05: シートに貼り付ける前に、既存記事とのカニバリ（同じ読者の悩みを扱っていて
// 記事内容が丸かぶりする）検査を入れてほしいという要望への対応。単なる完全一致の重複
// チェック（既存の候補・記事と重複）だけでは、表現が違うだけで同じ悩みを扱っている
// キーワード（例:「チェスト たわむ 補強」と既存の「チェスト 収納 おすすめ」）を防げない。
function uaBuildCannibalizationCheckPrompt_(candidateKeywords, existingArticleKeywords) {
  return [
    '以下の「新しいキーワード候補」それぞれについて、「既存記事のキーワード一覧」の中に、',
    '同じ商品・同じ読者の悩みを扱っていて、記事にすると内容が丸かぶりする（カニバリゼーション）',
    'ものがあるかどうか判定してください。',
    '・単に同じ商品カテゴリというだけでなく、読者が同じ疑問を持って検索したときに既存記事1本で',
    '　十分に答えられてしまう場合は「カニバる」と判定してください。',
    '・同じ商品でも切り口（悩みの種類）が明確に違う場合は「カニバらない」としてください。',
    '',
    '新しいキーワード候補:',
    candidateKeywords.map(function(k) { return '- ' + k; }).join('\n'),
    '',
    '既存記事のキーワード一覧:',
    existingArticleKeywords.join('、') || '（まだ無し）',
    '',
    'JSON形式のみで回答してください: {"results": [{"keyword": "候補キーワードそのまま", "cannibalizes": true または false, "matchedExisting": "該当する既存キーワード（無ければ空文字）"}]}'
  ].join('\n');
}

// 2026-09-05: DRIVE BASEはRinker（楽天商品検索）よりも「案件」（案件管理シートに登録した
// A8等のアフィリエイトプログラム）中心の収益構造。homeの商品ひも付き判定
// （uaGetMainKeywordProductProfile_、車種名や車用品名の正規表現ベース）はそのままでは
// 車種名メインの実際のDRIVE BASEキーワード傾向に合わないため、代わりに「候補キーワードで
// 記事を書いたときに、登録済みの案件を自然に紹介できそうか」をGeminiに判定させる
// （カニバリ検査と同じやり方）。案件管理シートはhome/drive兼用（サイト区分の列が無い）ため、
// リストごとGeminiに渡し、appConfig.labelを文脈として文脈判断させる。
function uaCollectAffiliateOffers_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = uaEnsureAffiliateManagementSheet_(ss);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, UA_AFFILIATE_COLUMNS.notes).getValues();
  return values
    .map(function(row) {
      return {
        name: String(row[UA_AFFILIATE_COLUMNS.name - 1] || '').trim(),
        notes: String(row[UA_AFFILIATE_COLUMNS.notes - 1] || '').trim()
      };
    })
    .filter(function(offer) { return offer.name && !uaIsNoAffiliateName_(offer.name); });
}

function uaBuildOfferLinkageCheckPrompt_(appConfig, candidateKeywords, offers) {
  const offerLines = offers.map(function(offer) {
    return '- ' + offer.name + (offer.notes ? '（' + offer.notes + '）' : '');
  }).join('\n');
  return [
    '「' + appConfig.label + '」というブログで、以下の「候補キーワード」それぞれについて、',
    '「登録済みの案件（アフィリエイトプログラム）一覧」の中に、その記事で自然に紹介できそうな',
    '案件があるかどうか判定してください。',
    '・こじつけではなく、読者がそのキーワードで検索したときに、記事の流れの中で違和感なく',
    '　紹介できる案件だけを「ひも付く」としてください。',
    '・当てはまる案件が無ければ「ひも付かない」としてください。',
    '',
    '候補キーワード:',
    candidateKeywords.map(function(k) { return '- ' + k; }).join('\n'),
    '',
    '登録済みの案件一覧:',
    offerLines || '（まだ無し）',
    '',
    'JSON形式のみで回答してください: {"results": [{"keyword": "候補キーワードそのまま", "linked": true または false, "matchedOffer": "該当する案件名（無ければ空文字）"}]}'
  ].join('\n');
}

// 2026-09-06: DRIVE BASEの「保留」を候補シートから直接読み込む運用（
// uaEvaluateCandidateSheetKeywords_）だと、AI発掘の1バッチ8件と違って一度に
// 100件を超えることがある。1回のGemini呼び出しに全件詰め込むと、出力JSONが
// maxOutputTokensの途中で切れてパースエラーになり、その回の判定が全滅する
// （実例: DRIVE BASEの保留全件評価でJSON途中切れが発生し addedCount:0 になった）。
// 一定件数ごとにチャンク分割して複数回Geminiを呼ぶことで、1回の応答サイズを
// 安全な範囲に収める。
const UA_TREASURE_KEYWORD_GEMINI_BATCH_CHECK_SIZE = 12;

function uaChunkArray_(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// 2026-09-06: 対象キーワードが数百件規模になると、このバッチ処理自体（Geminiへの
// チャンクごとの問い合わせ）だけでGASの実行時間を使い切ってしまい、後続のSERP採点
// フェーズの時間切れ処理（uaEvaluateTreasureKeywordCandidates_側）が始まる前に
// 気づかぬうちに予算を使い果たす恐れがある。呼び出し元と同じevalStartTime／
// 時間上限を共有し、残り時間が無くなったら以降のチャンクを処理せず打ち切る。
// 戻り値にprocessedKeywords（実際に問い合わせを試みたキーワード）も含めることで、
// 呼び出し元は「時間切れで未着手」と「問い合わせたが不一致／エラー」を区別できる。
function uaCheckTreasureKeywordOfferLinkage_(appConfig, candidateKeywords, offers, evalStartTime) {
  const map = {};
  // 案件が1件も登録されていない場合は「時間切れで未着手」ではなく「案件無し」として
  // 全キーワードを処理済み扱いにする（呼び出し元は正しく却下判定できる）。
  if (candidateKeywords.length === 0 || offers.length === 0) {
    return { map: map, processedKeywords: candidateKeywords.slice() };
  }
  const processedKeywords = [];
  const startTime = evalStartTime || Date.now();
  uaChunkArray_(candidateKeywords, UA_TREASURE_KEYWORD_GEMINI_BATCH_CHECK_SIZE).some(function(chunk) {
    if (Date.now() - startTime > UA_TREASURE_KEYWORD_EVAL_TIME_LIMIT_MS) {
      return true; // 以降のチャンクは未着手のまま打ち切る
    }
    processedKeywords.push.apply(processedKeywords, chunk);
    const prompt = uaBuildOfferLinkageCheckPrompt_(appConfig, chunk, offers);
    let result;
    try {
      result = uaCallGeminiJson_(prompt, 1500, 0);
    } catch (e) {
      console.log('案件ひも付き検査（' + chunk.length + '件分）でエラーが発生したため、このチャンクはスキップします: ' + (e && e.message || e));
      return false;
    }
    const items = (result && result.data && result.data.results) || [];
    items.forEach(function(item) {
      const keyword = String(item && item.keyword || '').trim();
      if (!keyword) return;
      map[keyword] = {
        linked: !!(item && item.linked),
        matchedOffer: String(item && item.matchedOffer || '').trim()
      };
    });
    return false;
  });
  return { map: map, processedKeywords: processedKeywords };
}

function uaCheckTreasureKeywordCannibalization_(candidateKeywords, existingArticleKeywords) {
  if (candidateKeywords.length === 0 || existingArticleKeywords.length === 0) return {};
  const map = {};
  uaChunkArray_(candidateKeywords, UA_TREASURE_KEYWORD_GEMINI_BATCH_CHECK_SIZE).forEach(function(chunk) {
    const prompt = uaBuildCannibalizationCheckPrompt_(chunk, existingArticleKeywords);
    let result;
    try {
      result = uaCallGeminiJson_(prompt, 1500, 0);
    } catch (e) {
      console.log('カニバリ検査（' + chunk.length + '件分）でエラーが発生したため、このチャンクはスキップします: ' + (e && e.message || e));
      return;
    }
    const items = (result && result.data && result.data.results) || [];
    items.forEach(function(item) {
      const keyword = String(item && item.keyword || '').trim();
      if (!keyword) return;
      map[keyword] = {
        cannibalizes: !!(item && item.cannibalizes),
        matchedExisting: String(item && item.matchedExisting || '').trim()
      };
    });
  });
  return map;
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
    // 2026-09-05: 実際にラッコキーワードで検索数を確認したところ、4語以上の
    // 細かすぎるキーワードはほぼ全て月間検索数0だった。3語以下に絞ることで
    // 検索される見込みの高いキーワードに寄せる。
    '5. キーワードは単語（スペース区切り）3つ以内にしてください。4つ以上の細かすぎる言葉は検索されていない可能性が高いので避けてください。',
    '',
    'JSON形式のみで回答してください: {"keywords": ["キーワード1", "キーワード2", ...]}'
  ].join('\n');
}

function uaCountKeywordWords_(keyword) {
  return String(keyword || '').trim().split(/\s+/).filter(Boolean).length;
}

function uaGenerateTreasureKeywordCandidates_(appConfig, existingKeywords, count) {
  const prompt = uaBuildTreasureKeywordIdeationPrompt_(appConfig, existingKeywords, count);
  const result = uaCallGeminiJson_(prompt, 800, 0);
  const keywords = (result && result.data && result.data.keywords) || [];
  return keywords
    .map(function(value) { return String(value || '').trim(); })
    .filter(function(value) { return value.length >= 2; })
    // 2026-09-05: プロンプトで3語以内を指示しても稀に無視されるため、コード側でも
    // 4語以上を弾く（検索数の実測で4語以上はほぼ0件だったため）。
    .filter(function(value) { return uaCountKeywordWords_(value) <= 3; });
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

// 候補キーワード（AIが考えたものでも、人が用意したものでも）を、商品ひも付き判定→
// SERPスコア→既存記事とのカニバリ検査、の順で評価する共通ロジック。
// 「書く」への昇格は絶対に行わない（人が確認して昇格させる）。この関数自体はシートへの
// 書き込みは行わず、判定結果（kept/reason付き）の配列を返すだけ。
// 2026-09-05: 案件欄で絞り込むと対象キーワードが数十〜百件規模になることがあり、
// SERPスコアリングは1件ずつSerperへ同期フェッチするため、GASの実行上限（6分）に
// タイムアウトすると全件評価が完了する前に強制終了され、それまでのSerper/Gemini
// 呼び出し分のAPIコストが結果として1件もシートに保存されず無駄になる。
// これを防ぐため、実行開始から一定時間が経過したら残りのキーワードはSERP採点せず
// 「時間切れのため未評価」として打ち切り、そこまでの結果は必ず呼び出し元に返す
// （呼び出し元はここまでの採用分をシートへ書き込める）。
const UA_TREASURE_KEYWORD_EVAL_TIME_LIMIT_MS = 4.5 * 60 * 1000;

function uaEvaluateTreasureKeywordCandidates_(appConfig, rawCandidates, existingSet, existingArticleKeywords) {
  const evalStartTime = Date.now();
  const resultByKeyword = {};
  const toScore = [];

  rawCandidates.forEach(function(keyword) {
    if (existingSet[keyword]) {
      resultByKeyword[keyword] = { keyword: keyword, kept: false, reason: '既存の候補・記事と重複' };
      return;
    }
    toScore.push(keyword);
  });

  // home: まず商品（Rinker/楽天検索語）ひも付き判定を1件ずつ同期チェック（APIコール無し）。
  // それで拾えなかったキーワードだけ、home・drive問わず案件（アフィリエイトプログラム）
  // ひも付き判定をバッチでGeminiに1回問い合わせる（コスト抑制のため対象0件なら呼ばない）。
  // 2026-09-06: たくみパパにも商品ひも付きの他にRinkerを介さない案件があるとのことで、
  // home限定だった案件ひも付き判定をhome/drive共通にした。
  const isHome = appConfig.key === 'home';
  const homeProfileByKeyword = {};
  const needsOfferCheck = [];
  toScore.forEach(function(keyword) {
    if (isHome) {
      const profile = uaGetMainKeywordProductProfile_({ mainInput: keyword }, appConfig);
      if (profile) {
        homeProfileByKeyword[keyword] = profile;
        return;
      }
    }
    needsOfferCheck.push(keyword);
  });

  let offerLinkageMap = {};
  let offerCheckProcessedSet = null; // nullのままなら「時間切れ判定は行わない（案件一覧取得エラー等）」
  if (needsOfferCheck.length > 0) {
    let offers = [];
    try {
      offers = uaCollectAffiliateOffers_();
    } catch (e) {
      console.log('案件一覧の取得でエラーが発生しました: ' + (e && e.message || e));
    }
    try {
      const offerCheckResult = uaCheckTreasureKeywordOfferLinkage_(appConfig, needsOfferCheck, offers, evalStartTime);
      offerLinkageMap = offerCheckResult.map;
      offerCheckProcessedSet = {};
      offerCheckResult.processedKeywords.forEach(function(k) { offerCheckProcessedSet[k] = true; });
    } catch (e) {
      console.log('案件ひも付き検査でエラーが発生したため、この回は該当キーワードを全件対象外にします: ' + (e && e.message || e));
    }
  }

  const timedOutReason = '時間切れのため未評価（もう一度実行すると続きを評価できます）';

  toScore.forEach(function(keyword) {
    let profile = homeProfileByKeyword[keyword];
    if (!profile) {
      // 案件ひも付き検査の対象だったが、時間切れで問い合わせ自体に着手できなかった
      // キーワードは「不一致」ではなく「未評価」として扱う（誤って却下扱いにしない）。
      if (offerCheckProcessedSet && !offerCheckProcessedSet[keyword]) {
        resultByKeyword[keyword] = { keyword: keyword, kept: false, reason: timedOutReason };
        return;
      }
      const verdict = offerLinkageMap[keyword];
      profile = (verdict && verdict.linked) ? { label: verdict.matchedOffer || '案件', matchedOffer: verdict.matchedOffer } : null;
    }
    if (!profile) {
      resultByKeyword[keyword] = {
        keyword: keyword,
        kept: false,
        reason: '商品・案件のいずれにもひも付かず'
      };
      return;
    }

    if (Date.now() - evalStartTime > UA_TREASURE_KEYWORD_EVAL_TIME_LIMIT_MS) {
      resultByKeyword[keyword] = {
        keyword: keyword,
        kept: false,
        reason: timedOutReason
      };
      return;
    }

    let serpResult;
    try {
      serpResult = uaScoreTreasureKeywordSerp_(keyword, appConfig);
    } catch (e) {
      resultByKeyword[keyword] = { keyword: keyword, kept: false, reason: 'Serper取得エラー: ' + (e && e.message || e) };
      return;
    }

    const kept = serpResult.score >= UA_TREASURE_KEYWORD_SCORE_THRESHOLD;
    resultByKeyword[keyword] = {
      keyword: keyword,
      kept: kept,
      productLabel: profile.label,
      matchedOffer: profile.matchedOffer || undefined,
      serpScore: serpResult.score,
      serpLevel: serpResult.level,
      weakUrls: serpResult.weakUrls,
      reason: kept
        ? ('お宝候補として採用（' + serpResult.level + '、スコア' + serpResult.score + '）')
        : ('SERPスコア不足（' + serpResult.level + '、スコア' + serpResult.score + ' < ' + UA_TREASURE_KEYWORD_SCORE_THRESHOLD + '）')
    };
  });

  const results = rawCandidates.map(function(keyword) { return resultByKeyword[keyword]; });

  // シートに書き込む前の最終ゲート: SERPスコアを通過した候補だけを対象に、既存記事との
  // カニバリ（表現は違っても同じ読者の悩みを扱っていて内容が丸かぶりする）を検査する。
  const serpPassedKeywords = results.filter(function(item) { return item.kept; }).map(function(item) { return item.keyword; });
  if (serpPassedKeywords.length > 0 && existingArticleKeywords.length > 0) {
    let cannibalMap = {};
    try {
      cannibalMap = uaCheckTreasureKeywordCannibalization_(serpPassedKeywords, existingArticleKeywords);
    } catch (e) {
      console.log('カニバリ検査でエラーが発生したため、この回はスキップします: ' + (e && e.message || e));
    }
    results.forEach(function(item) {
      if (!item.kept) return;
      const verdict = cannibalMap[item.keyword];
      if (verdict && verdict.cannibalizes) {
        item.kept = false;
        item.cannibalizedWith = verdict.matchedExisting || null;
        item.reason = '既存記事とカニバリ（類似: ' + (verdict.matchedExisting || '不明') + '）';
      }
    });
  }

  return results;
}

// メインの発掘処理（AIが自分でキーワード案を考える版）。
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

  const results = uaEvaluateTreasureKeywordCandidates_(appConfig, rawCandidates, existingSet, existingArticleKeywords);

  const keptKeywords = results.filter(function(item) { return item.kept; }).map(function(item) { return item.keyword; });
  uaAppendAiSuggestedCandidates_(candidateSheet, keptKeywords);

  const summary = { appKey: appConfig.key, addedCount: keptKeywords.length, results: results };
  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

// 人が用意したキーワード案を、AI発掘と同じ評価（商品ひも付き→SERPスコア→カニバリ検査）に
// かけてから候補シートへ追加する版。キーワード案出し（Gemini）だけをスキップする。
// 2026-09-05: この入力キーワードは「すでに候補シートに保留などで入っている行」を
// 再評価するのが主な使い方なので、候補シート自身との重複チェックはしない
// （それをすると入力した瞬間に全件「既存の候補と重複」で弾かれてしまう）。
// 既存の公開記事と丸かぶりしていないかだけを見る。
function uaEvaluateManualTreasureKeywords_(appConfig, keywords) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const candidateSheet = ss.getSheetByName(appConfig.candidateSheetName);
  if (!candidateSheet) throw new Error('候補シートが見つかりません: ' + appConfig.candidateSheetName);
  const articleSheet = ss.getSheetByName(appConfig.articleSheetName);

  const existingArticleKeywords = articleSheet ? uaCollectExistingArticleKeywords_(articleSheet) : [];
  const existingSet = {};
  existingArticleKeywords.forEach(function(keyword) { existingSet[keyword] = true; });

  const uniqueInputKeywords = [];
  const seenInput = {};
  keywords.map(function(k) { return String(k || '').trim(); }).filter(Boolean).forEach(function(k) {
    if (seenInput[k]) return;
    seenInput[k] = true;
    uniqueInputKeywords.push(k);
  });

  const results = uaEvaluateTreasureKeywordCandidates_(appConfig, uniqueInputKeywords, existingSet, existingArticleKeywords);

  const keptKeywords = results.filter(function(item) { return item.kept; }).map(function(item) { return item.keyword; });
  uaAppendAiSuggestedCandidates_(candidateSheet, keptKeywords);

  const timedOutKeywords = results.filter(function(item) { return item.reason === '時間切れのため未評価（もう一度実行すると続きを評価できます）'; })
    .map(function(item) { return item.keyword; });

  const summary = { appKey: appConfig.key, addedCount: keptKeywords.length, timedOutCount: timedOutKeywords.length, timedOutKeywords: timedOutKeywords, results: results };
  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

// 2026-09-05: 候補シートに既に入っているキーワード（デフォルトは「保留」）を、
// チャットに貼り直させることなく直接読み込んで評価する版。
function uaCollectCandidateSheetKeywordsByStatus_(candidateSheet, statuses) {
  const lastRow = candidateSheet.getLastRow();
  if (lastRow < 2) return [];
  const values = candidateSheet.getRange(2, 1, lastRow - 1, UA_CANDIDATE_COLUMNS.keyword).getValues();
  const statusSet = {};
  (statuses || []).forEach(function(s) { statusSet[s] = true; });
  return values
    .filter(function(row) {
      if (!statuses || statuses.length === 0) return true;
      const status = String(row[UA_CANDIDATE_COLUMNS.status - 1] || '').trim();
      return !!statusSet[status];
    })
    .map(function(row) { return String(row[UA_CANDIDATE_COLUMNS.keyword - 1] || '').trim(); })
    .filter(Boolean);
}

// 読み取り専用: 案件管理シートの登録内容（案件名・注意点）をそのまま確認する診断用。
function uaInspectAffiliateOffers20260906() {
  const offers = uaCollectAffiliateOffers_();
  console.log(JSON.stringify(offers, null, 2));
  return offers;
}

// A8.netのリンクHTML/トラッキングURLから、実際の遷移先URL（a8ejpredirectパラメータ、
// もしくはURLエンコードされたクエリの中のhttps://を含む部分）を抜き出す。
function uaExtractRealUrlFromAffiliateHtml_(html) {
  const raw = String(html || '');
  const match = raw.match(/a8ejpredirect=([^&"'\s]+)/) || raw.match(/[?&]url=([^&"'\s]+)/);
  if (match) {
    try {
      return decodeURIComponent(match[1]);
    } catch (e) {
      return match[1];
    }
  }
  const hrefMatch = raw.match(/href=\\?"([^"\\]+)\\?"/i) || raw.match(/href="([^"]+)"/i);
  return hrefMatch ? hrefMatch[1] : '';
}

// 読み取り専用: 案件管理シートのURL列も含めて確認する診断用（各案件のページを見て
// メモを充実させるための材料集め）。A8トラッキングリンクは実際の遷移先URLに変換して出す。
function uaInspectAffiliateOffersWithUrl20260906() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = uaEnsureAffiliateManagementSheet_(ss);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, UA_AFFILIATE_COLUMNS.notes).getValues();
  const offers = values
    .map(function(row, i) {
      const rawUrl = String(row[UA_AFFILIATE_COLUMNS.url - 1] || '').trim();
      const notes = String(row[UA_AFFILIATE_COLUMNS.notes - 1] || '').trim();
      return {
        row: i + 2,
        name: String(row[UA_AFFILIATE_COLUMNS.name - 1] || '').trim(),
        realUrl: uaExtractRealUrlFromAffiliateHtml_(rawUrl),
        notesLength: notes.length,
        notesPreview: notes.slice(0, 20)
      };
    })
    .filter(function(offer) { return offer.name && !uaIsNoAffiliateName_(offer.name); });
  console.log(JSON.stringify(offers, null, 2));
  return offers;
}

// 2026-09-06: 「ナビ男くん」の案件ひも付き判定が、キーワードの言い回し次第で
// 通ったり通らなかったりした（例:「アルファード HDMI 後付け」は通ったが
// 「ハスラー HDMI どこ」「ルーミー HDMI どこ」は落ちた）。原因は登録済みメモが
// 「ナビや車内エンタメのアップグレードを促す。」という一文だけで、HDMI・
// テレビキャンセラー・後席モニターといった具体的な訴求語を含んでおらず、
// Geminiが言い回しの違いだけで判定をブレさせていたため。実際の商品ページ
// （https://naviokun.ocnk.net/）を確認し、具体的な機能・対応車種を盛り込んで
// メモを充実させる。
function uaUpdateNaviokunNotes20260906() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = uaEnsureAffiliateManagementSheet_(ss);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error('案件管理シートにデータがありません。');
  const names = sheet.getRange(2, UA_AFFILIATE_COLUMNS.name, lastRow - 1, 1).getValues();
  let targetRow = -1;
  for (let i = 0; i < names.length; i++) {
    if (String(names[i][0] || '').trim() === 'ナビ男くん') {
      targetRow = i + 2;
      break;
    }
  }
  if (targetRow === -1) throw new Error('「ナビ男くん」の行が案件管理シートに見つかりませんでした。');

  const newNotes = '純正ナビの機能拡張＋車載AV機器の販売・取付（出張取付対応）。' +
    '走行中もテレビが映るようにするTVキャンセラー／ナビの操作制限解除、' +
    'HDMI接続・Android AVアダプター（YouTube・Amazonプライム等ネット動画視聴対応）、' +
    '後席モニター（リアモニター）取付、Blu-ray/DVDプレーヤー、' +
    'デジタルミラー型ドライブレコーダー、レーダー探知機。' +
    '「HDMI どこ」「HDMI 後付け」「テレビキャンセラー」「走行中 テレビ 見れる」' +
    '「後席モニター 後付け」「ナビ 操作制限」等の車種別お困りごとキーワードに紐づけやすい。' +
    '対応車種例: アルファード、ランドクルーザー、RAV4、ノア、クラウン、' +
    'レクサスRX/NX、ステップワゴン、フリード、CX-5、CX-80、BMW、ベンツ等。';

  const before = sheet.getRange(targetRow, UA_AFFILIATE_COLUMNS.notes).getValue();
  sheet.getRange(targetRow, UA_AFFILIATE_COLUMNS.notes).setValue(newNotes);
  SpreadsheetApp.flush();
  return { updated: true, row: targetRow, notesBefore: before, notesAfter: newNotes };
}

// 2026-09-06: ナビ男くんと同じ理由（メモが空欄または一言だけで、Geminiの案件ひも付き
// 判定がキーワードの言い回し次第でブレる）で、他の登録案件のメモも各公式ページを見て
// 充実させる。名前で行を探して一括更新する。
function uaUpdateAffiliateOfferNotes_(updates) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = uaEnsureAffiliateManagementSheet_(ss);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error('案件管理シートにデータがありません。');
  const names = sheet.getRange(2, UA_AFFILIATE_COLUMNS.name, lastRow - 1, 1).getValues();
  const results = [];
  updates.forEach(function(update) {
    let targetRow = -1;
    for (let i = 0; i < names.length; i++) {
      if (String(names[i][0] || '').trim() === update.name) {
        targetRow = i + 2;
        break;
      }
    }
    if (targetRow === -1) {
      results.push({ name: update.name, updated: false, reason: '案件管理シートに見つかりませんでした' });
      return;
    }
    const before = sheet.getRange(targetRow, UA_AFFILIATE_COLUMNS.notes).getValue();
    sheet.getRange(targetRow, UA_AFFILIATE_COLUMNS.notes).setValue(update.notes);
    results.push({ name: update.name, updated: true, row: targetRow, notesBefore: before });
  });
  SpreadsheetApp.flush();
  console.log(JSON.stringify(results, null, 2));
  return results;
}

function uaUpdateRemainingAffiliateOfferNotes20260906() {
  return uaUpdateAffiliateOfferNotes_([
    {
      name: 'ottocast',
      notes: '純正ナビ・車の画面をワイヤレスCarPlay/Android Auto化する車載AVアクセサリーブランド。' +
        'AIBOX（USB接続でYouTube等のアプリを画面に表示）、ADAPTER（有線→ワイヤレス変換）、' +
        'SCREEN（純正ナビの無い車への後付けディスプレイ）、HDMI入力対応。工事不要・取り付け簡単。' +
        '既にCarPlay/Android Auto対応の車が対象（購入前に対応車種データベースで確認が必要）。' +
        '「CarPlay ワイヤレス化」「Android Auto 有線 うざい」「ナビ 画面 YouTube 見る方法」' +
        '「HDMI 入力 純正ナビ」等のキーワードに紐づけやすい。'
    },
    {
      name: 'シンシェード',
      notes: '車のフロントガラス用ロール式サンシェード（日除け）。フロントガラス上部に常時設置でき、' +
        'ボタン一つで2〜3秒で自動巻き取り。アルミ製で剛性・耐久性が高く、未使用時も視界を妨げない。' +
        '特許取得済み。価格は1万円台。ボルボ・ジープ・アウディ・レクサス・ベンツ・BMW等の高級車・' +
        '輸入車には非対応。「サンシェード 面倒」「フロントガラス 日除け 収納」「車 日除け 自動」' +
        '等のキーワードに紐づけやすい（高級車・輸入車のキーワードには不向き）。'
    },
    {
      name: 'MOTAカーリース',
      notes: '新車のカーリースサービス。頭金0円・初期費用なしで新車に乗れる、残価設定なし（契約満了時に' +
        '車がもらえる）、走行距離制限なし（マイカー感覚）、オイル交換・車検費用込みの無料クーポン付き。' +
        '軽自動車・コンパクトカー・ミニバン・SUV・セダン等、国内主要8メーカーに対応。' +
        '契約期間は7年・9年・11年。「新車 リース デメリット」「カーリース 走行距離」' +
        '「新車 頭金なし」等のキーワードに紐づけやすい。'
    },
    {
      name: 'CARCLUB',
      notes: '車用品・カーパーツの通販専門店（日本最大級）。シートカバー・ハンドルカバー・クッション等の' +
        '内装パーツ、ボディカバー、外装パーツ、洗車・工具・メンテナンス用品を扱う。メーカー・車種・' +
        '年式で検索でき、車種専用設計・オーダーメイド商品も豊富。「シートカバー 車種専用」' +
        '「ハンドルカバー 汗ばむ」「車 内装 パーツ おすすめ」等のキーワードに紐づけやすい。'
    },
    {
      name: 'ガリバー買取査定',
      notes: '中古車買取・査定サービス（IDOM/ガリバー）。愛車を売りたいユーザー向けに無料出張査定・' +
        '一括査定を行う。「車 売る タイミング」「下取りより高く売る」「車買取 査定額」' +
        '「事故車 廃車 買取」等、車を手放す・乗り換える検討段階のキーワードに紐づけやすい。'
    },
    {
      name: '関電SOS',
      notes: '関西電力グループ（オプテージ運営）のホームセキュリティサービス。防犯センサーで空き巣・' +
        '非常事態を検知し、警備スタッフが駆けつける。関西エリア特化（セコム・ALSOKと違い全国対応では' +
        'ない）。「ホームセキュリティ 関西」「一人暮らし 防犯 電気会社」「留守中 空き巣対策」' +
        '等のキーワードに紐づけやすい。'
    },
    {
      name: 'セコム株式会社',
      notes: '国内最大手の警備会社（全国対応）のホームセキュリティサービス。防犯サービス・火災監視・' +
        '非常通報の基本3サービスに加え、住居タイプや家族構成に合わせたプランを提案。マンション月額' +
        '3,200円〜、戸建て月額4,700円〜（税別）。スタッフが自宅を見て無料見積り。' +
        '「一人暮らし 防犯対策」「ホームセキュリティ 費用」「留守番 高齢者 見守り」' +
        '等のキーワードに紐づけやすい。'
    },
    {
      name: 'ミラブルシリーズ',
      notes: 'サイエンス社のウルトラファインバブルシャワーヘッド（ミラブルZ/ミラブルplus等）。毛穴の' +
        '奥の汚れ・皮脂を落とす洗浄力、保湿効果、節水効果、塩素除去機能。乾燥肌・ニキビ跡・加齢臭など' +
        '肌や頭皮の悩み向け。工事不要で既存の蛇口に取り付けるだけ。「シャワーヘッド 塩素除去」' +
        '「毛穴 汚れ 落ちない」「節水 シャワーヘッド おすすめ」等のキーワードに紐づけやすい。'
    },
    {
      name: 'ロボット掃除機ルンバ',
      notes: 'iRobot社のロボット掃除機ブランド。自動走行での掃除、スマホアプリ連携での外出先操作、' +
        '上位モデルは自動ゴミ捨て・自動充電に対応。ペットの毛・花粉・ハウスダスト対策、共働き・子育て' +
        '世帯の時短家事に訴求。「ロボット掃除機 ペットの毛」「掃除 時間ない 共働き」' +
        '「ルンバ おすすめ 型番」等のキーワードに紐づけやすい。'
    }
  ]);
}

function uaEvaluateCandidateSheetKeywords_(appConfig, statuses) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const candidateSheet = ss.getSheetByName(appConfig.candidateSheetName);
  if (!candidateSheet) throw new Error('候補シートが見つかりません: ' + appConfig.candidateSheetName);
  const keywords = uaCollectCandidateSheetKeywordsByStatus_(candidateSheet, statuses);
  console.log('候補シートから読み込んだキーワード(' + (statuses || []).join('/') + '): ' + JSON.stringify(keywords));
  return uaEvaluateManualTreasureKeywords_(appConfig, keywords);
}

function uaEvaluateHoldCandidatesDrive20260905() {
  return uaEvaluateCandidateSheetKeywords_(UA_APP_TYPES.drive, [UA_CANDIDATE_STATUS_HOLD]);
}

function uaEvaluateHoldCandidatesHome20260905() {
  return uaEvaluateCandidateSheetKeywords_(UA_APP_TYPES.home, [UA_CANDIDATE_STATUS_HOLD]);
}

// 2026-09-06: 「保留」ではなく「書く」（自動投稿がこれから実際に記事化する予定）の
// キーワードを、書く前の品質チェックとして評価する版。この関数自体は「書く」行の
// ステータスを一切変更しない（読み取り専用の評価＋AI提案への追加のみ）。
function uaEvaluateWriteCandidatesDrive20260905() {
  return uaEvaluateCandidateSheetKeywords_(UA_APP_TYPES.drive, [UA_CANDIDATE_STATUS_WRITE]);
}

function uaEvaluateWriteCandidatesHome20260905() {
  return uaEvaluateCandidateSheetKeywords_(UA_APP_TYPES.home, [UA_CANDIDATE_STATUS_WRITE]);
}

// 2026-09-06: 「案件」欄で絞り込み、さらにステータスでも絞り込む版（例: ナビ男くんが
// 登録されていて、かつまだ「書く」のままの行だけ）。行番号も一緒に返すことで、
// 評価結果に応じて元の行のステータスを直接書き換えられるようにする。
// 「AI提案」「保留」に既に書き換え済みの行は対象から除外する＝再実行しても
// 未処理分（時間切れで未評価だった分を含む）だけが対象になり、無駄なAPI呼び出しを防ぐ。
function uaCollectCandidateRowsByAffiliateNameAndStatus_(candidateSheet, affiliateName, status) {
  const lastRow = candidateSheet.getLastRow();
  if (lastRow < 2) return [];
  const values = candidateSheet.getRange(2, 1, lastRow - 1, UA_CANDIDATE_COLUMNS.keyword).getValues();
  const targetAffiliate = String(affiliateName || '').trim();
  const targetStatus = String(status || '').trim();
  const rows = [];
  values.forEach(function(row, index) {
    const rowAffiliate = String(row[UA_CANDIDATE_COLUMNS.affiliateName - 1] || '').trim();
    const rowStatus = String(row[UA_CANDIDATE_COLUMNS.status - 1] || '').trim();
    const keyword = String(row[UA_CANDIDATE_COLUMNS.keyword - 1] || '').trim();
    if (rowAffiliate === targetAffiliate && rowStatus === targetStatus && keyword) {
      rows.push({ row: index + 2, keyword: keyword });
    }
  });
  return rows;
}

// 評価結果に応じて元の行のステータスを直接書き換える版（新しい行を追加するのではなく）。
// 合格（kept）→「AI提案」、不合格→「保留」。時間切れで未評価の分だけは元のステータス
// （＝このステータスフィルタの対象）のまま残すので、もう一度実行すれば続きから拾える。
function uaEvaluateAndUpdateCandidateRowsByAffiliateNameAndStatus_(appConfig, affiliateName, status) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const candidateSheet = ss.getSheetByName(appConfig.candidateSheetName);
  if (!candidateSheet) throw new Error('候補シートが見つかりません: ' + appConfig.candidateSheetName);
  const articleSheet = ss.getSheetByName(appConfig.articleSheetName);
  const existingArticleKeywords = articleSheet ? uaCollectExistingArticleKeywords_(articleSheet) : [];
  const existingSet = {};
  existingArticleKeywords.forEach(function(keyword) { existingSet[keyword] = true; });

  const rows = uaCollectCandidateRowsByAffiliateNameAndStatus_(candidateSheet, affiliateName, status);
  console.log('案件「' + affiliateName + '」×ステータス「' + status + '」の対象行数: ' + rows.length);

  const rowsByKeyword = {};
  rows.forEach(function(r) {
    if (!rowsByKeyword[r.keyword]) rowsByKeyword[r.keyword] = [];
    rowsByKeyword[r.keyword].push(r.row);
  });
  const uniqueKeywords = Object.keys(rowsByKeyword);

  const results = uaEvaluateTreasureKeywordCandidates_(appConfig, uniqueKeywords, existingSet, existingArticleKeywords);

  // 2026-09-06: シートの入力規則が古いまま（「AI提案」が選択肢に無い等）だと
  // setValueが規則違反例外を投げ、以降の行が一切書き込まれず結果ごと失われる
  // （たくみパパ側の候補シートで実際に発生）。書き込み前に必ず規則を最新化し、
  // 念のため1行ずつtry/catchで、1行の失敗が他の行を巻き込まないようにする。
  uaApplyCandidateSheetRules_(candidateSheet);

  let keptCount = 0, rejectedCount = 0, timedOutCount = 0, writeErrorCount = 0;
  const timedOutReason = '時間切れのため未評価（もう一度実行すると続きを評価できます）';
  results.forEach(function(item) {
    if (item.reason === timedOutReason) {
      timedOutCount++;
      return;
    }
    const newStatus = item.kept ? UA_CANDIDATE_STATUS_AI_SUGGESTED : UA_CANDIDATE_STATUS_HOLD;
    (rowsByKeyword[item.keyword] || []).forEach(function(rowNum) {
      try {
        candidateSheet.getRange(rowNum, UA_CANDIDATE_COLUMNS.status).setValue(newStatus);
      } catch (e) {
        writeErrorCount++;
        console.log('行' + rowNum + '（' + item.keyword + '）へのステータス書き込みに失敗しました: ' + (e && e.message || e));
      }
    });
    if (item.kept) keptCount++; else rejectedCount++;
  });

  const summary = { appKey: appConfig.key, targetRowCount: rows.length, keptCount: keptCount, rejectedCount: rejectedCount, timedOutCount: timedOutCount, writeErrorCount: writeErrorCount, results: results };
  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

function uaEvaluateNaviokunCandidatesDrive20260906() {
  return uaEvaluateAndUpdateCandidateRowsByAffiliateNameAndStatus_(UA_APP_TYPES.drive, 'ナビ男くん', UA_CANDIDATE_STATUS_WRITE);
}

// 2026-09-06: 上のuaEvaluateNaviokunCandidatesDrive20260906で合格し「AI提案」に
// なった「ナビ男くん」案件の行を、ユーザーの明示指示により「書く」へ昇格させる。
// SERP評価を通過済みの行だけが対象（案件欄=ナビ男くん かつ ステータス=AI提案）。
// 他の（案件欄が空の）AI提案候補には一切触れない。
function uaPromoteNaviokunAiSuggestedToWrite20260906() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const candidateSheet = ss.getSheetByName(UA_APP_TYPES.drive.candidateSheetName);
  if (!candidateSheet) throw new Error('候補シートが見つかりません: ' + UA_APP_TYPES.drive.candidateSheetName);

  const rows = uaCollectCandidateRowsByAffiliateNameAndStatus_(candidateSheet, 'ナビ男くん', UA_CANDIDATE_STATUS_AI_SUGGESTED);
  rows.forEach(function(r) {
    candidateSheet.getRange(r.row, UA_CANDIDATE_COLUMNS.status).setValue(UA_CANDIDATE_STATUS_WRITE);
  });

  const summary = { promotedCount: rows.length, keywords: rows.map(function(r) { return r.keyword; }) };
  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

// 2026-09-06: 「案件」欄では絞り込まず、特定ステータス（通常は「転送済み」＝自動投稿
// 済みで触ってはいけないもの）だけを除外して、候補シートの残り全行を洗い直す版。
// 行番号を保持し、評価結果に応じて元の行のステータスを直接書き換える
// （合格→「AI提案」、不合格→「保留」）。時間切れで未評価の行だけは元のステータスの
// まま残るので、再実行すれば続きから拾える。
function uaCollectCandidateRowsExcludingStatuses_(candidateSheet, excludedStatuses) {
  const lastRow = candidateSheet.getLastRow();
  if (lastRow < 2) return [];
  const values = candidateSheet.getRange(2, 1, lastRow - 1, UA_CANDIDATE_COLUMNS.keyword).getValues();
  const excludedSet = {};
  (excludedStatuses || []).forEach(function(s) { excludedSet[String(s || '').trim()] = true; });
  const rows = [];
  values.forEach(function(row, index) {
    const status = String(row[UA_CANDIDATE_COLUMNS.status - 1] || '').trim();
    const keyword = String(row[UA_CANDIDATE_COLUMNS.keyword - 1] || '').trim();
    if (!excludedSet[status] && keyword) {
      rows.push({ row: index + 2, keyword: keyword });
    }
  });
  return rows;
}

function uaEvaluateAndUpdateAllCandidateRowsExcludingStatuses_(appConfig, excludedStatuses) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const candidateSheet = ss.getSheetByName(appConfig.candidateSheetName);
  if (!candidateSheet) throw new Error('候補シートが見つかりません: ' + appConfig.candidateSheetName);
  const articleSheet = ss.getSheetByName(appConfig.articleSheetName);
  const existingArticleKeywords = articleSheet ? uaCollectExistingArticleKeywords_(articleSheet) : [];
  const existingSet = {};
  existingArticleKeywords.forEach(function(keyword) { existingSet[keyword] = true; });

  const rows = uaCollectCandidateRowsExcludingStatuses_(candidateSheet, excludedStatuses);
  console.log('「' + (excludedStatuses || []).join('/') + '」以外の対象行数（' + appConfig.key + '）: ' + rows.length);

  const rowsByKeyword = {};
  rows.forEach(function(r) {
    if (!rowsByKeyword[r.keyword]) rowsByKeyword[r.keyword] = [];
    rowsByKeyword[r.keyword].push(r.row);
  });
  const uniqueKeywords = Object.keys(rowsByKeyword);

  const results = uaEvaluateTreasureKeywordCandidates_(appConfig, uniqueKeywords, existingSet, existingArticleKeywords);

  // 書き込み前に必ず入力規則を最新化し（「AI提案」が選択肢から漏れていると
  // setValueが例外を投げて以降の行が書き込まれなくなる）、1行ずつtry/catchする。
  uaApplyCandidateSheetRules_(candidateSheet);

  let keptCount = 0, rejectedCount = 0, timedOutCount = 0, writeErrorCount = 0;
  const timedOutReason = '時間切れのため未評価（もう一度実行すると続きを評価できます）';
  results.forEach(function(item) {
    if (item.reason === timedOutReason) {
      timedOutCount++;
      return;
    }
    const newStatus = item.kept ? UA_CANDIDATE_STATUS_AI_SUGGESTED : UA_CANDIDATE_STATUS_HOLD;
    (rowsByKeyword[item.keyword] || []).forEach(function(rowNum) {
      try {
        candidateSheet.getRange(rowNum, UA_CANDIDATE_COLUMNS.status).setValue(newStatus);
      } catch (e) {
        writeErrorCount++;
        console.log('行' + rowNum + '（' + item.keyword + '）へのステータス書き込みに失敗しました: ' + (e && e.message || e));
      }
    });
    if (item.kept) keptCount++; else rejectedCount++;
  });

  const summary = { appKey: appConfig.key, targetRowCount: rows.length, keptCount: keptCount, rejectedCount: rejectedCount, timedOutCount: timedOutCount, writeErrorCount: writeErrorCount, results: results };
  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

function uaEvaluateAllHomeCandidatesExceptSent20260906() {
  return uaEvaluateAndUpdateAllCandidateRowsExcludingStatuses_(UA_APP_TYPES.home, [UA_CANDIDATE_STATUS_SENT]);
}

// 読み取り専用: API呼び出し（SERP/Gemini）を一切せず、対象行数だけを事前確認する。
function uaCountHomeCandidatesExceptSent20260906() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const candidateSheet = ss.getSheetByName(UA_APP_TYPES.home.candidateSheetName);
  if (!candidateSheet) throw new Error('候補シートが見つかりません: ' + UA_APP_TYPES.home.candidateSheetName);
  const rows = uaCollectCandidateRowsExcludingStatuses_(candidateSheet, [UA_CANDIDATE_STATUS_SENT]);
  const byStatus = {};
  const lastRow = candidateSheet.getLastRow();
  const values = lastRow >= 2 ? candidateSheet.getRange(2, 1, lastRow - 1, UA_CANDIDATE_COLUMNS.keyword).getValues() : [];
  values.forEach(function(row) {
    const status = String(row[UA_CANDIDATE_COLUMNS.status - 1] || '').trim() || '(空欄)';
    byStatus[status] = (byStatus[status] || 0) + 1;
  });
  const summary = { targetRowCount: rows.length, statusBreakdown: byStatus };
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

// 2026-09-05: ユーザーが手動で用意した25件のキーワード案を、AI発掘と同じ評価
// （商品ひも付き→SERPスコア→カニバリ検査）にかける。
function uaEvaluateManualTreasureKeywordsHome20260905() {
  const keywords = [
    'お風呂 着替え どこに置く',
    '引き戸 レール マスキングテープ',
    'こたつの代わりになるもの',
    '電気毛布 こたつ代わり',
    'ゴミ当番',
    '結露防止シート 100均',
    'マンション 玄関ドア 防寒',
    'カレンダー 壁に穴開けない',
    '狭いベランダ 物干し 工夫',
    'キッチン 腰壁 後悔',
    '玄関 リビング 仕切りなし 寒い',
    '電子レンジ コンセント 位置',
    'ニトリ ソファ 合皮 ボロボロ',
    'プランター 防虫ネット 100均',
    '猫 キッチン 対策',
    '霧ヶ峰 ai自動 電気代 高い',
    '玄関 リビング 仕切りなし 後悔',
    'ウォークインクローゼット 鏡',
    'キッチン ワゴン 邪魔',
    '猫 キッチン 侵入防止',
    'トイレ リビング 壁一枚',
    'カーテン開けて寝る',
    'ベランダ 自転車',
    'ダンボール小さくする方法',
    '玄関ドア 取っ手 熱い 対策'
  ];
  return uaEvaluateManualTreasureKeywords_(UA_APP_TYPES.home, keywords);
}

// 読み取り専用: 候補シート先頭（一番上、AI提案の挿入位置）の実データを確認する診断用。
function uaInspectCandidateSheetHeadKeywords20260905(count) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(UA_APP_TYPES.home.candidateSheetName);
  const scanRows = Math.min(Number(count) || 30, sheet.getLastRow() - 1);
  const values = sheet.getRange(2, 1, scanRows, 4).getValues();
  const rows = values.map(function(row, i) {
    return {
      row: 2 + i,
      status: row[0],
      affiliateName: row[1],
      keyword: row[2],
      keywordLength: String(row[2] || '').length
    };
  });
  console.log(JSON.stringify(rows, null, 2));
  return rows;
}

// ============================================================
// 2026-09-06: パネル「お宝キーワード」タブ用のweb-callableラッパー。
// 上記の既存ロジック（一回限り関数含む）は変更せず、そのまま呼び出すだけに
// 留める。この機能は「書く」へは絶対に直接昇格させない設計を維持する
// （下記のどの関数も、評価結果を「AI提案」または「保留」にするだけ。
// 「書く」への変更は uaSetCandidateStatusForWeb 経由でユーザーが個別に選ぶ
// 操作としてのみ許可する）。
// ============================================================

// AIキーワード発掘（既存ロジックそのまま）。
function uaDiscoverTreasureKeywordsForWeb(appTypeLabel) {
  const appConfig = uaGetAppConfigByLabel_(appTypeLabel);
  if (!appConfig) throw new Error('不明な記事タイプです: ' + appTypeLabel);
  return uaDiscoverTreasureKeywords_(appConfig);
}

// 手動で貼り付けたキーワード（改行/カンマ/読点区切り）を評価。
function uaEvaluateManualTreasureKeywordsForWeb(appTypeLabel, keywordsText) {
  const appConfig = uaGetAppConfigByLabel_(appTypeLabel);
  if (!appConfig) throw new Error('不明な記事タイプです: ' + appTypeLabel);

  const seen = {};
  const keywords = String(keywordsText || '')
    .split(/[\n,、]/)
    .map(function(k) { return k.trim(); })
    .filter(function(k) {
      if (!k || seen[k]) return false;
      seen[k] = true;
      return true;
    });

  if (keywords.length === 0) throw new Error('評価するキーワードがありません。');

  return uaEvaluateManualTreasureKeywords_(appConfig, keywords);
}

// 案件名ドロップダウン用（案件管理シートはサイト共通）。
function uaListAffiliateNamesForWeb() {
  return uaCollectAffiliateOffers_();
}

// 候補シートの行を「案件名」「含めるステータス」「除外するステータス」で汎用的に
// 絞り込む。既存の uaCollectCandidateRowsByAffiliateNameAndStatus_ /
// uaCollectCandidateRowsExcludingStatuses_ は既存の一回限り関数から参照されて
// いるため変更しない。ここでは同等の絞り込みをパラメータ化した別関数として新設する。
function uaCollectCandidateRowsByFilter_(candidateSheet, filter) {
  const lastRow = candidateSheet.getLastRow();
  if (lastRow < 2) return [];
  const values = candidateSheet.getRange(2, 1, lastRow - 1, UA_CANDIDATE_COLUMNS.keyword).getValues();

  const targetAffiliate = String((filter && filter.affiliateName) || '').trim();
  const includeSet = {};
  ((filter && filter.includeStatuses) || []).forEach(function(s) { includeSet[String(s || '').trim()] = true; });
  const excludeSet = {};
  ((filter && filter.excludeStatuses) || []).forEach(function(s) { excludeSet[String(s || '').trim()] = true; });
  const hasIncludeFilter = Object.keys(includeSet).length > 0;

  const rows = [];
  values.forEach(function(row, index) {
    const rowAffiliate = String(row[UA_CANDIDATE_COLUMNS.affiliateName - 1] || '').trim();
    const rowStatus = String(row[UA_CANDIDATE_COLUMNS.status - 1] || '').trim();
    const keyword = String(row[UA_CANDIDATE_COLUMNS.keyword - 1] || '').trim();
    if (!keyword) return;
    if (targetAffiliate && rowAffiliate !== targetAffiliate) return;
    if (hasIncludeFilter && !includeSet[rowStatus]) return;
    if (excludeSet[rowStatus]) return;
    rows.push({ row: index + 2, keyword: keyword });
  });
  return rows;
}

// 上記フィルタで集めた行を評価し、結果に応じて元の行のステータスを直接
// 書き換える（合格→「AI提案」、不合格→「保留」）。時間切れで未評価の行は
// 元のステータスのまま残るので、同じフィルタでもう一度実行すれば続きから
// 拾える（既存の uaEvaluateAndUpdateCandidateRowsByAffiliateNameAndStatus_ と
// 同じ設計）。
function uaEvaluateCandidateRowsForWeb(appTypeLabel, filter) {
  const appConfig = uaGetAppConfigByLabel_(appTypeLabel);
  if (!appConfig) throw new Error('不明な記事タイプです: ' + appTypeLabel);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const candidateSheet = ss.getSheetByName(appConfig.candidateSheetName);
  if (!candidateSheet) throw new Error('候補シートが見つかりません: ' + appConfig.candidateSheetName);
  const articleSheet = ss.getSheetByName(appConfig.articleSheetName);
  const existingArticleKeywords = articleSheet ? uaCollectExistingArticleKeywords_(articleSheet) : [];
  const existingSet = {};
  existingArticleKeywords.forEach(function(keyword) { existingSet[keyword] = true; });

  const rows = uaCollectCandidateRowsByFilter_(candidateSheet, filter);
  console.log('パネルからの再評価対象行数（' + appConfig.key + '）: ' + rows.length);

  const rowsByKeyword = {};
  rows.forEach(function(r) {
    if (!rowsByKeyword[r.keyword]) rowsByKeyword[r.keyword] = [];
    rowsByKeyword[r.keyword].push(r.row);
  });
  const uniqueKeywords = Object.keys(rowsByKeyword);

  const results = uaEvaluateTreasureKeywordCandidates_(appConfig, uniqueKeywords, existingSet, existingArticleKeywords);

  // 書き込み前に必ず入力規則を最新化する（既存の同種関数と同じ事故防止パターン）。
  uaApplyCandidateSheetRules_(candidateSheet);

  let keptCount = 0, rejectedCount = 0, timedOutCount = 0, writeErrorCount = 0;
  const timedOutReason = '時間切れのため未評価（もう一度実行すると続きを評価できます）';
  results.forEach(function(item) {
    if (item.reason === timedOutReason) {
      timedOutCount++;
      return;
    }
    const newStatus = item.kept ? UA_CANDIDATE_STATUS_AI_SUGGESTED : UA_CANDIDATE_STATUS_HOLD;
    (rowsByKeyword[item.keyword] || []).forEach(function(rowNum) {
      try {
        candidateSheet.getRange(rowNum, UA_CANDIDATE_COLUMNS.status).setValue(newStatus);
      } catch (e) {
        writeErrorCount++;
        console.log('行' + rowNum + '（' + item.keyword + '）へのステータス書き込みに失敗しました: ' + (e && e.message || e));
      }
    });
    if (item.kept) keptCount++; else rejectedCount++;
  });

  const summary = {
    appKey: appConfig.key,
    targetRowCount: rows.length,
    keptCount: keptCount,
    rejectedCount: rejectedCount,
    timedOutCount: timedOutCount,
    writeErrorCount: writeErrorCount,
    results: results
  };
  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

// 一覧の操作ボタン（書くへ昇格 / 保留にする / AI提案に戻す）用。この3つ以外への
// 変更は許可しない（「転送済み」等の自動投稿管理用ステータスをパネルから
// 誤って書き換えられないようにするホワイトリスト）。
const UA_CANDIDATE_STATUS_WEB_WHITELIST_ = [
  UA_CANDIDATE_STATUS_WRITE,
  UA_CANDIDATE_STATUS_HOLD,
  UA_CANDIDATE_STATUS_AI_SUGGESTED
];

function uaSetCandidateStatusForWeb(appTypeLabel, row, newStatus) {
  const appConfig = uaGetAppConfigByLabel_(appTypeLabel);
  if (!appConfig) throw new Error('不明な記事タイプです: ' + appTypeLabel);

  const cleanStatus = String(newStatus || '').trim();
  if (UA_CANDIDATE_STATUS_WEB_WHITELIST_.indexOf(cleanStatus) === -1) {
    throw new Error('許可されていないステータスです: ' + cleanStatus);
  }

  const rowNum = Number(row);
  if (!rowNum || rowNum < 2) throw new Error('不正な行番号です: ' + row);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const candidateSheet = ss.getSheetByName(appConfig.candidateSheetName);
  if (!candidateSheet) throw new Error('候補シートが見つかりません: ' + appConfig.candidateSheetName);

  uaApplyCandidateSheetRules_(candidateSheet);
  candidateSheet.getRange(rowNum, UA_CANDIDATE_COLUMNS.status).setValue(cleanStatus);

  return { row: rowNum, status: cleanStatus };
}
