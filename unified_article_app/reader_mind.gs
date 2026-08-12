const UA_READER_MIND_FETCH_TIMEOUT_MS = 45000;
const UA_READER_MIND_TIMEOUT_MARKER = 'READER_MIND_FETCH_TIMEOUT';

function uaRunReaderMindMemoFromPanel(data) {
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

  const deterministicSiteFitIssue = uaFindDeterministicKeywordSiteFitIssue_(mainInput, appConfig);
  if (deterministicSiteFitIssue) {
    throw new Error(uaBuildSiteFitStopMessage_(deterministicSiteFitIssue, appConfig));
  }

  const provider = uaGetReaderMindProvider_();

  if (provider === 'gemini' && !uaGetGeminiApiKey_()) {
    throw new Error('Gemini APIキーが設定されていません。');
  }

  if (provider === 'openai' && !uaGetOpenAiApiKey_()) {
    throw new Error('OpenAI APIキーが設定されていません。');
  }

  const sourceQuery = uaBuildReaderMindSearchQuery_(mainInput, appConfig);
  let sources;
  let paaQuestions = [];

  try {
    paaQuestions = uaFetchGooglePaaQuestions_(sourceQuery, 6);
    sources = uaFetchReaderMindSources_(sourceQuery, UA_READER_MIND_MAX_RESULTS);
  } catch (e) {
    if (uaIsReaderMindFetchTimeout_(e)) {
      throw new Error(uaCleanReaderMindErrorMessage_(e.message));
    }

    throw e;
  }

  const promptText = uaBuildReaderMindMemoPrompt_(mainInput, appConfig, sources, paaQuestions);
  const result = uaCallReaderMindJson_(promptText, provider);
  const resultJson = result && result.data;

  if (!resultJson || !resultJson.reader_mind_memo) {
    throw new Error('読者心理メモの生成結果に必要な項目がありません。');
  }

  const siteFit = uaNormalizeReaderMindSiteFit_(resultJson.site_fit);
  if (!siteFit.status && data && data.automaticPosting) {
    throw new Error('キーワードの検索意図とサイト適合を判定できなかったため、本文生成前で停止しました。候補シートのキーワードを確認してから再開してください。');
  }
  if (siteFit.status === 'off_topic' || (siteFit.status === 'ambiguous' && data && data.automaticPosting)) {
    throw new Error(uaBuildSiteFitStopMessage_(siteFit, appConfig));
  }

  sheet.getRange(row, UA_COLUMNS.readerMindMemo).setValue(uaFormatReaderMindMemoValue_(resultJson.reader_mind_memo));
  sheet.getRange(row, UA_COLUMNS.createdAt).setValue(new Date());
  sheet.getRange(row, UA_COLUMNS.generationModel).setValue(uaFormatModelLabel_(provider, result && result.model));
  SpreadsheetApp.flush();

  const nextData = uaBuildRowData_(sheet, row);
  nextData.message = siteFit.status === 'ambiguous'
    ? '検索意図とサイトの適合が曖昧です。記事化前に読者心理メモの「主な検索意図」を確認してください。'
    : sources.length > 0
    ? '読者心理メモを作成しました。取得件数: ' + sources.length
    : '読者心理メモを作成しました。元データ取得なしのため、入力内容から推定しています。';
  return nextData;
}

function uaRunReaderMindMemoFromWeb(data) {
  return uaRunReaderMindMemoFromPanel(data || {});
}

function uaCleanReaderMindErrorMessage_(message) {
  return String(message || '').replace(UA_READER_MIND_TIMEOUT_MARKER + ': ', '');
}

function uaBuildReaderMindSearchQuery_(mainInput, appConfig) {
  let text = String(mainInput || '')
    .replace(/https?:\/\/[^\s]+/g, ' ')
    .replace(/[「」『』【】\[\]（）()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (appConfig && appConfig.key === 'general') {
    text = text
      .split(/[。\n]/)
      .map(function(line) {
        return line.trim();
      })
      .filter(Boolean)[0] || text;
  }

  return text.slice(0, 80);
}

function uaBuildReaderMindMemoPrompt_(mainInput, appConfig, sources, paaQuestions) {
  const sourceText = sources.length === 0
    ? '今回はQ&Aサイト等の元データを取得できませんでした。入力内容、記事タイプ、一般的な検索意図から推定してください。ただし、本文で事実として使える具体情報は増やさず、推定であることを前提に安全側で整理してください。'
    : sources.map(function(source, index) {
    return [
      '--- ' + (index + 1) + '. ' + source.title + ' ---',
      'サイト: ' + source.source,
      '日付: ' + (source.date || '不明'),
      'URL: ' + source.url,
      '本文: ' + source.body
    ].join('\n');
  }).join('\n\n');

  return `
あなたはSEO記事の読者心理を分析するリサーチャーです。
以下の検索キーワードまたは案件指示書と、Q&Aサイト等から取得した悩みデータをもとに、記事作成に使える読者心理メモを作成してください。

記事タイプ: ${appConfig ? appConfig.label : '未指定'}
入力内容:
${mainInput}

【収集データ】
${sourceText}

【Googleの関連質問】
${uaBuildPaaPromptText_(paaQuestions)}

【出力方針】
・最初に検索キーワードの主な検索意図が記事タイプに適合するか判定する。
・DRIVE BASEは、車選び、車種、運転、整備、洗車、車載機器、カーナビ、車内快適化など自動車領域を対象とする。「ナビ」という一語だけで車関連と決めず、固有の商品名・機能名、収集データ、共起語から判定する。
・たくみパパは、家づくり、リフォーム、住宅設備、間取り、家事、収納、外構、防災、暮らし用品など、建てる前から住んだ後までの住宅・暮らし領域を対象とする。
・同じ表記が別業界の固有名詞を指す場合や、収集データの大半が記事タイプと別領域の場合は off_topic とする。複数の検索意図が拮抗して判断できない場合は ambiguous とする。
・off_topicでも実際の検索意図を勝手に車・住宅へ寄せず、収集データから読み取れる主な検索意図を正直に返す。
・本文でそのまま引用するためではなく、記事構成・導入文・FAQ・判断軸を作るためのメモにする。
・収集データがない、または少ない場合は、入力内容から検索意図を推定してよい。ただし、取得データ由来の具体事実として扱わない。
・収集データがない場合でも、顕在ニーズ、潜在ニーズ、読者の葛藤、導入文で拾う本音、見出し順のヒント、FAQ候補、判断軸は必ず出す。
・「Googleの関連質問」に実質問がある場合は、検索意図と合うものを「PAA実質問」に原文の意味を変えず入れる。重複や主題から外れる質問は除く。
・PAA実質問だけでFAQに必要な論点が足りない場合は、Q&Aサイト等の収集データと読者心理から「FAQ候補」を補完する。PAAを取得できないことだけを理由に停止しない。
・特定の口コミを一般論として断定しない。
・古い情報、個人の特殊事情、根拠が弱い金額や制度は「本文で事実として使わない方がよいもの」に分ける。
・どのキーワードでも使えるように、表面的な要望だけでなく、読者の葛藤、潜在ニーズ、本文で深掘りすると刺さる判断軸まで整理する。
・最後に、既存項目をもとに「本文で優先して扱う材料」「FAQに回す材料」「今回は主役にしない材料」へ仕分ける。新しい事実を増やすのではなく、本文構成に渡すための編集メモとして整理する。
・「本文で優先して扱う材料」には、顕在ニーズ、潜在ニーズ、読者の葛藤、深掘りすると刺さる判断軸のうち、本文の主軸に置くべきものを入れる。
・「FAQに回す材料」には、補足疑問、細かい条件差、本文で深掘りしすぎると主題が散るものを入れる。
・「今回は主役にしない材料」には、主役にしない補足テーマ、別記事向きの論点、根拠が弱く本文で断定しない方がよいものを入れる。
・記事タイプが汎用記事の場合は、案件指示書の意図を尊重し、無関係な口コミテーマを主役にしない。
・安全、法規、保証、車検、保険、施工可否、修理費、DIY作業など、読者の判断ミスが大きな不利益につながる可能性があるテーマでは「安全・法規・保証まわりの書き方ガード」を必ず出す。
・「違法ではない」「車検に通る」「保証対象になる」「誰でも簡単に取り付けできる」「運転中も使える」などの言い切りが危ない場合は、断定を避ける指示として整理する。
・運転者が画面を注視する使い方、危険なDIY、保安部品やエアバッグ周辺配線への安易な作業、保証や保険で不利になる可能性がある行為を推奨しないように整理する。
・安全・法規・保証・施工可否に関わる箇所では、公式情報、販売店、施工店、保険会社、整備工場などで確認する導線を入れるように整理する。

回答は必ず以下のJSON形式でのみ出力してください。
{
  "site_fit": {
    "status": "fit | ambiguous | off_topic",
    "primary_intent": "このキーワードで最も強い検索意図",
    "reason": "記事タイプへの適合を判断した根拠"
  },
  "reader_mind_memo": {
    "顕在ニーズ": ["..."],
    "潜在ニーズ": ["..."],
    "読者の葛藤": ["..."],
    "導入文で拾う本音": ["..."],
    "見出し順のヒント": ["..."],
    "PAA実質問": ["..."],
    "FAQ候補": ["..."],
    "記事で深掘りすると刺さる判断軸": ["..."],
    "主役にしない補足テーマ": ["..."],
    "本文で事実として使わない方がよいもの": ["..."],
    "安全・法規・保証まわりの書き方ガード": ["..."],
    "本文で優先して扱う材料": ["..."],
    "FAQに回す材料": ["..."],
    "今回は主役にしない材料": ["..."]
  }
}
`;
}

function uaFetchReaderMindSources_(keyword, totalMax) {
  const configs = uaGetReaderMindSourceConfigs_();
  const perSite = Math.max(1, Math.ceil(totalMax / configs.length));
  const startedAt = Date.now();
  const results = [];

  for (let i = 0; i < configs.length; i++) {
    const config = configs[i];
    uaThrowIfReaderMindFetchTooSlow_(startedAt, '検索ページ取得前', config.source);

    try {
      const items = uaFetchReaderMindSearchItems_(config, keyword, perSite);

      for (let j = 0; j < items.length; j++) {
        if (results.length >= totalMax) break;

        uaThrowIfReaderMindFetchTooSlow_(startedAt, '詳細ページ取得前', config.source);

        const item = items[j];
        const detail = uaFetchReaderMindDetail_(item);
        if (detail && detail.body) {
          results.push(detail);
        }
      }
    } catch (e) {
      if (uaIsReaderMindFetchTimeout_(e)) {
        throw e;
      }

      // 取得できないサイトはスキップする
    }
  }

  return results.slice(0, totalMax);
}

function uaThrowIfReaderMindFetchTooSlow_(startedAt, phase, sourceName) {
  const elapsedMs = Date.now() - startedAt;

  if (elapsedMs <= UA_READER_MIND_FETCH_TIMEOUT_MS) {
    return;
  }

  throw new Error(
    UA_READER_MIND_TIMEOUT_MARKER + ': 読者心理メモの元データ取得に時間がかかりすぎています。' +
    '原因候補は、Q&Aサイト側の混雑・一時的なブロック・検索結果ページの応答遅延・キーワードが広すぎることです。' +
    '現在の処理: ' + (sourceName || '不明') + ' / ' + (phase || '不明') + '。' +
    '少し時間を置いてリトライしてください。急ぐ場合は、読者心理メモ欄に手入力して本文生成へ進んでください。'
  );
}

function uaIsReaderMindFetchTimeout_(error) {
  return String(error && error.message || error || '').indexOf(UA_READER_MIND_TIMEOUT_MARKER) !== -1;
}

function uaGetReaderMindSourceConfigs_() {
  return [
    {
      source: 'Yahoo知恵袋',
      searchUrl: function(keyword) {
        return 'https://chiebukuro.yahoo.co.jp/search?p=' + encodeURIComponent(keyword) + '&type=tag';
      },
      itemPattern: /<a[^>]*href="(https:\/\/detail\.chiebukuro\.yahoo\.co\.jp\/qa\/question_detail\/q[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
    },
    {
      source: '教えて!goo',
      searchUrl: function(keyword) {
        return 'https://oshiete.goo.ne.jp/search_goo/?MT=' + encodeURIComponent(keyword) + '&ct=qa';
      },
      itemPattern: /<a[^>]*href="(https?:\/\/oshiete\.goo\.ne\.jp\/qa\/\d+\.html)"[^>]*>([\s\S]*?)<\/a>/gi
    },
    {
      source: '発言小町',
      searchUrl: function(keyword) {
        return 'https://komachi.yomiuri.co.jp/search?q=' + encodeURIComponent(keyword);
      },
      itemPattern: /<a[^>]*href="(https?:\/\/komachi\.yomiuri\.co\.jp\/topics\/id\/\d+[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi
    },
    {
      source: 'OKWAVE',
      searchUrl: function(keyword) {
        return 'https://okwave.jp/search?word=' + encodeURIComponent(keyword);
      },
      itemPattern: /<a[^>]*href="(https?:\/\/okwave\.jp\/qa\/q\d+\.html)"[^>]*>([\s\S]*?)<\/a>/gi
    }
  ];
}

function uaFetchReaderMindSearchItems_(config, keyword, maxCount) {
  const html = uaFetchReaderMindHtml_(config.searchUrl(keyword));
  const items = [];
  let match;

  if (!html) return items;

  while ((match = config.itemPattern.exec(html)) !== null && items.length < maxCount) {
    const url = match[1];
    const title = uaCleanText_(uaDecodeHtmlEntities_(uaStripHtml_(match[2])));

    if (!title || title.length < 4) continue;

    if (!items.some(function(item) { return item.url === url; })) {
      items.push({
        source: config.source,
        title: title,
        url: url
      });
    }
  }

  return items;
}

function uaFetchReaderMindDetail_(item) {
  const html = uaFetchReaderMindHtml_(item.url);

  if (!html) {
    return null;
  }

  const description = uaExtractReaderMindDescription_(html);
  const date = uaExtractReaderMindDate_(html);
  const body = uaExtractReaderMindBody_(html, description || item.title);

  return {
    source: item.source,
    title: item.title,
    url: item.url,
    date: date,
    body: body
  };
}

function uaExtractReaderMindDescription_(html) {
  const meta = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["'][^>]*>/i);

  return meta && meta[1]
    ? uaCleanText_(uaDecodeHtmlEntities_(meta[1]))
    : '';
}

function uaExtractReaderMindDate_(html) {
  const dateMatch =
    html.match(/(\d{4}\/\d{1,2}\/\d{1,2})\s*(\d{1,2}:\d{2})/) ||
    html.match(/<time[^>]*datetime=["']([^"']+)["']/i) ||
    html.match(/(\d{4}年\d{1,2}月\d{1,2}日)/);

  if (!dateMatch) return '';

  return dateMatch[1] + (dateMatch[2] ? ' ' + dateMatch[2] : '');
}

function uaExtractReaderMindBody_(html, fallbackText) {
  const patterns = [
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /<div[^>]*class=["'][^"']*(question|qa|topic|answer)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i
  ];

  for (let i = 0; i < patterns.length; i++) {
    const match = html.match(patterns[i]);
    if (!match) continue;

    const raw = match[match.length - 1];
    const text = uaCleanText_(uaDecodeHtmlEntities_(uaStripHtml_(raw)));

    if (text.length >= 30) {
      return text.slice(0, 1800);
    }
  }

  const pageText = uaCleanText_(uaDecodeHtmlEntities_(uaStripHtml_(html)));
  const fallback = uaCleanText_(fallbackText || '');
  const idx = fallback ? pageText.indexOf(fallback.slice(0, 20)) : -1;
  const start = idx >= 0 ? idx : 0;

  return pageText.slice(start, start + 1800);
}

function uaFetchReaderMindHtml_(url) {
  const response = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    followRedirects: true,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'ja,en;q=0.5'
    }
  });

  if (response.getResponseCode() !== 200) {
    return '';
  }

  return response.getContentText('UTF-8');
}
