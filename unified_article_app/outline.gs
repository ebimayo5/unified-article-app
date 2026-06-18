const UA_STRUCTURE_COMPETITOR_SEARCH_MAX_RESULTS = 5;
const UA_STRUCTURE_COMPETITOR_ANALYSIS_MAX_PAGES = 5;

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

  const competitorPages = uaFetchStructureCompetitorPages_(rowData, appConfig);
  uaSaveAutoCompetitorUrls_(sheet, row, rowData, competitorPages);
  rowData = uaBuildRowData_(sheet, row);

  const promptText = uaBuildArticleStructurePrompt_(rowData, appConfig, competitorPages);
  const result = uaCallArticleStructureJson_(promptText, provider);
  const resultJson = result && result.data;

  if (!resultJson || !resultJson.structure_memo || !resultJson.article_outline) {
    throw new Error('記事構成の生成結果に必要な項目がありません。');
  }

  const structureMemo = uaFormatArticleStructureMemo_(resultJson);

  sheet.getRange(row, UA_COLUMNS.structureMemo).setValue(structureMemo);
  sheet.getRange(row, UA_COLUMNS.createdAt).setValue(new Date());
  sheet.getRange(row, UA_COLUMNS.generationModel).setValue(uaFormatModelLabel_(provider, result && result.model));
  SpreadsheetApp.flush();

  const nextData = uaBuildRowData_(sheet, row);
  nextData.message = '記事構成を作成しました。競合取得件数: ' + competitorPages.length;
  return nextData;
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

function uaFetchStructureCompetitorPages_(rowData, appConfig) {
  const manualUrls = [
    rowData.competitorUrl1,
    rowData.competitorUrl2,
    rowData.competitorUrl3
  ].map(function(url) {
    return String(url || '').trim();
  }).filter(Boolean);

  const query = uaBuildReaderMindSearchQuery_(rowData.mainInput, appConfig);
  const searchUrls = uaFetchSearchResultUrls_(query, UA_STRUCTURE_COMPETITOR_SEARCH_MAX_RESULTS);
  const urls = [];

  manualUrls.concat(searchUrls).forEach(function(url) {
    if (!url || urls.indexOf(url) !== -1) return;
    urls.push(url);
  });

  return urls.slice(0, UA_STRUCTURE_COMPETITOR_ANALYSIS_MAX_PAGES).map(function(url) {
    return uaFetchCompetitorPageInfo_(url);
  });
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

  sheet.getRange(row, UA_COLUMNS.competitorUrl1, 1, 3).setValues([nextUrls]);
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

function uaFormatArticleStructureMemo_(resultJson) {
  return [
    '【自動競合分析メモ】',
    String(resultJson.competitor_analysis_memo || '').trim(),
    '',
    String(resultJson.structure_memo || '').trim(),
    '',
    '【本文手前の記事構成】',
    String(resultJson.article_outline || '').trim()
  ].join('\n').trim();
}
