function uaRunArticleFromPanel(data) {
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

  const currentStatus = String(rowData.status || '').trim();

  if (currentStatus === UA_STATUS_POSTED) {
    throw new Error('この行は「投稿済み」です。再生成する場合は状態を空欄にしてください。');
  }

  const provider = uaGetArticleProvider_();

  if (provider === 'gemini' && !uaGetGeminiApiKey_()) {
    throw new Error('Gemini APIキーが設定されていません。');
  }

  if (provider === 'openai' && !uaGetOpenAiApiKey_()) {
    throw new Error('OpenAI APIキーが設定されていません。');
  }

  if (provider === 'claude' && !uaGetClaudeApiKey_()) {
    throw new Error('Claude APIキーが設定されていません。');
  }

  sheet.getRange(row, UA_COLUMNS.status).setValue(UA_STATUS_GENERATING);

  try {
    const promptText = uaBuildArticlePrompt_(rowData, appConfig);
    const result = uaCallArticleGenerationJson_(promptText, provider);
    const resultJson = result && result.data;

    if (!resultJson || !resultJson.body || !resultJson.title_ideas) {
      sheet.getRange(row, UA_COLUMNS.status).setValue(UA_STATUS_STOPPED);
      throw new Error('生成結果に必要な項目がありません。');
    }

    const body = uaApplyRakutenAffiliateBanner_(
      uaFixGeneratedHtml_(resultJson.body),
      rowData,
      appConfig
    );
    const metaDescription = resultJson.meta_description ||
      resultJson.metaDescription ||
      '';
    const permalink = resultJson.permalink ||
      resultJson.slug ||
      '';
    const tags = uaNormalizeGeneratedTags_(resultJson.tags || '', rowData, appConfig);
    const factCheckPoints = resultJson.fact_check_points ||
      resultJson.factCheckPoints ||
      '特になし';
    const structureMemo = resultJson.structure_memo ||
      resultJson.structureMemo ||
      '';

    uaSetGeneratedMeta_(sheet, row, UA_STATUS_DONE, provider, result && result.model);

    sheet.getRange(row, UA_COLUMNS.body, 1, 5).setValues([[
      body,
      resultJson.title_ideas,
      tags,
      metaDescription,
      permalink
    ]]);

    uaSetFactCheckPointsWithLinks_(sheet, row, factCheckPoints);
    sheet.getRange(row, UA_COLUMNS.structureMemo).setValue(structureMemo);

    const nextData = uaBuildRowData_(sheet, row);
    nextData.message = '記事生成が完了しました。';
    return nextData;
  } catch (e) {
    sheet.getRange(row, UA_COLUMNS.status).setValue(UA_STATUS_STOPPED);
    sheet.getRange(row, UA_COLUMNS.factCheckPoints).setValue('・記事生成停止理由｜' + e.toString());
    throw e;
  }
}

function uaRunArticleFromWeb(data) {
  return uaRunArticleFromPanel(data || {});
}

function uaSetGeneratedMeta_(sheet, row, status, provider, model) {
  sheet.getRange(row, UA_COLUMNS.status).setValue(status);
  sheet.getRange(row, UA_COLUMNS.createdAt).setValue(new Date());
  sheet.getRange(row, UA_COLUMNS.generationModel).setValue(uaFormatModelLabel_(provider, model));
  SpreadsheetApp.flush();
}

function uaCallArticleGenerationJson_(promptText, provider) {
  if (provider === 'claude') {
    return uaCallClaudeJson_(promptText, 18000);
  }

  if (provider === 'openai') {
    return uaCallOpenAiJson_(promptText, 16000);
  }

  return uaCallGeminiJson_(promptText, 16000, 512);
}

function uaApplyRakutenAffiliateBanner_(body, rowData, appConfig) {
  if (!appConfig || appConfig.key === 'general') {
    return body;
  }

  if (!uaShouldInsertRakutenAffiliateBanner_(body, rowData, appConfig)) {
    return body;
  }

  const banner = uaBuildRakutenAffiliateBanner_(body, rowData, appConfig);

  if (!banner) {
    return body;
  }

  const faqIndex = body.search(/<h2[^>]*>\s*よくある質問\s*<\/h2>/i);

  if (faqIndex > -1) {
    return body.slice(0, faqIndex) + banner + '\n\n' + body.slice(faqIndex);
  }

  const summaryIndex = body.search(/<h2[^>]*>[\s\S]*?まとめ[\s\S]*?<\/h2>/i);

  if (summaryIndex > -1) {
    return body.slice(0, summaryIndex) + banner + '\n\n' + body.slice(summaryIndex);
  }

  return body + '\n\n' + banner;
}

function uaBuildRakutenAffiliateBanner_(body, rowData, appConfig) {
  const query = uaSelectRakutenProductQuery_(body, rowData, appConfig);

  if (!query) {
    return '';
  }

  const item = uaFetchRakutenItem_(query);

  if (item) {
    return uaBuildRakutenItemBannerHtml_(item, query);
  }

  const fallbackHtml = String(PropertiesService.getScriptProperties().getProperty('UA_RAKUTEN_AFFILIATE_BANNER_HTML') || '').trim();

  if (!fallbackHtml) {
    return '';
  }

  return [
    '<p>具体的な商品を比較したい場合は、下の楽天バナーから関連アイテムを確認できます。楽天を特別に推す意図ではなく、価格や種類を見比べるための選択肢として使ってください。</p>',
    uaNormalizeRakutenAffiliateBanner_(fallbackHtml)
  ].join('\n');
}

function uaSelectRakutenProductQuery_(body, rowData, appConfig) {
  const notes = String(rowData && rowData.affiliateNotes || '');
  const override = notes.match(/楽天商品(?:キーワード|KW)[:：]\s*([^\n\r]+)/);

  if (override && override[1]) {
    return override[1].trim();
  }

  const text = [
    rowData && rowData.mainInput,
    rowData && rowData.readerMindMemo,
    body
  ].join(' ');
  const candidates = appConfig && appConfig.key === 'home'
    ? uaHomeRakutenProductCandidates_()
    : uaDriveRakutenProductCandidates_();
  let best = null;

  candidates.forEach(function(candidate) {
    const score = candidate.keywords.reduce(function(total, keyword) {
      return total + (text.indexOf(keyword) !== -1 ? 1 : 0);
    }, 0);

    if (score > 0 && (!best || score > best.score)) {
      best = {
        query: candidate.query,
        score: score
      };
    }
  });

  return best ? best.query : '';
}

function uaGetRakutenKeywordSuggestionsFromPanel(data) {
  return uaGetRakutenKeywordSuggestions_(data || {});
}

function uaGetRakutenKeywordSuggestionsFromWeb(data) {
  return uaGetRakutenKeywordSuggestions_(data || {});
}

function uaGetRakutenKeywordSuggestions_(data) {
  const appConfig = uaGetAppConfigByLabel_(data && data.appType);

  if (!appConfig || appConfig.key === 'general') {
    return {
      suggestions: [],
      message: '汎用記事では楽天バナー自動挿入は使いません。'
    };
  }

  const notes = String(data && data.affiliateNotes || '');
  const override = notes.match(/楽天商品(?:キーワード|KW)[:：]\s*([^\n\r]+)/);
  const text = [
    data && data.mainInput,
    data && data.readerMindMemo,
    data && data.body,
    notes
  ].join(' ');
  const candidates = appConfig.key === 'home'
    ? uaHomeRakutenProductCandidates_()
    : uaDriveRakutenProductCandidates_();
  const suggestions = [];
  const seen = {};

  function addSuggestion(query) {
    query = String(query || '').replace(/\s+/g, ' ').trim();
    if (!query || seen[query]) return;
    seen[query] = true;
    suggestions.push(query);
  }

  if (override && override[1]) {
    addSuggestion(override[1]);
  }

  uaContextualRakutenQueries_(text, appConfig.key).forEach(addSuggestion);

  candidates
    .map(function(candidate) {
      const score = candidate.keywords.reduce(function(total, keyword) {
        return total + (text.indexOf(keyword) !== -1 ? 1 : 0);
      }, 0);

      return {
        query: candidate.query,
        score: score
      };
    })
    .filter(function(item) {
      return item.score > 0;
    })
    .sort(function(a, b) {
      return b.score - a.score;
    })
    .forEach(function(item) {
      addSuggestion(item.query);
    });

  uaKeywordBasedRakutenQueries_(data && data.mainInput, appConfig.key).forEach(addSuggestion);

  return {
    suggestions: suggestions.slice(0, 5),
    message: suggestions.length > 0
      ? '商品検索キーワード候補を取得しました。'
      : '候補を取得できませんでした。案件注意点に「楽天商品キーワード: ...」で手動指定してください。'
  };
}

function uaContextualRakutenQueries_(text, appKey) {
  const value = String(text || '');

  if (appKey === 'home') {
    if ((value.indexOf('ランドリー') !== -1 || value.indexOf('脱衣') !== -1 || value.indexOf('洗面') !== -1) &&
      (value.indexOf('チェスト') !== -1 || value.indexOf('収納') !== -1)) {
      return [
        'ランドリーチェスト 防カビ',
        'ランドリー収納 樹脂 チェスト',
        '脱衣所 収納 チェスト',
        'ランドリー収納 スリム',
        'ランドリーチェスト キャスター'
      ];
    }

    if (value.indexOf('カビ') !== -1 || value.indexOf('湿気') !== -1 || value.indexOf('除湿') !== -1) {
      return [
        '除湿機 コンパクト',
        'サーキュレーター 部屋干し',
        '湿度計 室内',
        '防カビ 収納',
        'ランドリー収納 防カビ'
      ];
    }
  }

  if (appKey === 'drive') {
    if (value.indexOf('車内') !== -1 && (value.indexOf('掃除') !== -1 || value.indexOf('清掃') !== -1)) {
      return [
        '車内 掃除 グッズ',
        '車 掃除機 コードレス',
        '車内クリーナー',
        'マイクロファイバークロス 車',
        '車 ガラスクリーナー'
      ];
    }
  }

  return [];
}

function uaKeywordBasedRakutenQueries_(keyword, appKey) {
  const value = String(keyword || '')
    .replace(/[「」『』【】（）()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!value) return [];

  const parts = value.split(/\s+/).filter(function(part) {
    return part.length >= 2 && part.length <= 18;
  });
  const compact = parts.join(' ');
  const result = [];

  if (compact) result.push(compact);

  if (appKey === 'home') {
    if (compact.indexOf('ランドリー') !== -1 || compact.indexOf('洗面') !== -1 || compact.indexOf('脱衣') !== -1) {
      result.push(compact + ' 収納');
      result.push(compact + ' 防カビ');
    }
  }

  if (appKey === 'drive') {
    result.push(compact + ' 車');
    result.push(compact + ' カー用品');
  }

  return result;
}

function uaDriveRakutenProductCandidates_() {
  return [
    { query: 'カーシャンプー 車 洗車', keywords: ['洗車', 'カーシャンプー', '泡洗車'] },
    { query: 'マイクロファイバークロス 車', keywords: ['マイクロファイバー', '拭き上げ', '車内清掃', '清掃'] },
    { query: '車 ガラスクリーナー 油膜取り', keywords: ['ガラスクリーナー', '油膜', 'フロントガラス'] },
    { query: '車 コーティング剤', keywords: ['コーティング', '撥水', '艶'] },
    { query: 'タイヤワックス 車', keywords: ['タイヤワックス', 'タイヤ', '足元'] },
    { query: 'ドライブレコーダー 前後', keywords: ['ドラレコ', 'ドライブレコーダー', '駐車監視'] },
    { query: '車 サンシェード', keywords: ['サンシェード', '日よけ', '暑さ対策'] },
    { query: 'ポータブル電源 車中泊', keywords: ['ポータブル電源', '車中泊', '電源'] },
    { query: '車載扇風機 車中泊', keywords: ['車載扇風機', '扇風機', '車内 待機'] },
    { query: 'スマホホルダー 車', keywords: ['スマホホルダー', 'スマホ', 'ナビアプリ'] },
    { query: 'HDMI 車載 モニター', keywords: ['HDMI', '後席モニター', 'モニター', 'YouTube'] },
    { query: '車 収納 ポケット', keywords: ['収納', '車内収納', 'シートバック'] },
    { query: '車 フロアマット', keywords: ['フロアマット', 'マット', '汚れ防止'] },
    { query: 'ジャンプスターター 車 バッテリー', keywords: ['バッテリー', 'ジャンプスターター', 'バッテリー上がり'] }
  ];
}

function uaHomeRakutenProductCandidates_() {
  return [
    { query: 'ランドリーチェスト 防カビ', keywords: ['ランドリー チェスト', 'ランドリーチェスト', 'カビない', '防カビ'] },
    { query: 'ランドリー収納 樹脂 チェスト', keywords: ['ランドリー収納', '脱衣所 収納', '洗面所 収納', '樹脂'] },
    { query: '脱衣所 収納 チェスト', keywords: ['脱衣所', '洗面所', 'チェスト'] },
    { query: '収納ボックス 住宅', keywords: ['収納', '収納ボックス', '片付け'] },
    { query: '可動棚 収納', keywords: ['可動棚', '棚', '収納'] },
    { query: '排水口 掃除 ぬめり取り', keywords: ['排水口', 'ぬめり', '掃除'] },
    { query: '滑り止めマット 玄関 浴室', keywords: ['滑りにくい', '滑り止め', 'マット'] },
    { query: 'センサーライト 屋外', keywords: ['センサーライト', '外構', '防犯'] },
    { query: '防災用品 セット 家庭用', keywords: ['防災', '停電', '備え'] },
    { query: '室外機カバー', keywords: ['室外機カバー', '室外機', '日よけ'] },
    { query: '室内物干し', keywords: ['物干し', 'ランドリー', '洗濯'] },
    { query: '見守りカメラ 家庭用', keywords: ['見守り', 'カメラ', '子ども'] },
    { query: 'ベビーゲート 階段', keywords: ['ベビーゲート', '子育て', '階段'] },
    { query: '車いす スロープ 簡易', keywords: ['車いす', 'スロープ', '段差'] },
    { query: 'サーキュレーター 部屋干し', keywords: ['換気', '部屋干し', 'サーキュレーター'] }
  ];
}

function uaFetchRakutenItem_(query) {
  const applicationId = String(PropertiesService.getScriptProperties().getProperty('UA_RAKUTEN_APPLICATION_ID') || '').trim();
  const accessKey = String(PropertiesService.getScriptProperties().getProperty('UA_RAKUTEN_ACCESS_KEY') || '').trim();

  if (!applicationId || !accessKey) {
    return null;
  }

  const affiliateId = String(PropertiesService.getScriptProperties().getProperty('UA_RAKUTEN_AFFILIATE_ID') || '').trim();
  const params = [
    'format=json',
    'hits=1',
    'imageFlag=1',
    'sort=standard',
    'applicationId=' + encodeURIComponent(applicationId),
    'accessKey=' + encodeURIComponent(accessKey),
    'keyword=' + encodeURIComponent(query)
  ];

  if (affiliateId) {
    params.push('affiliateId=' + encodeURIComponent(affiliateId));
  }

  const url = 'https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260401?' + params.join('&');

  try {
    const res = UrlFetchApp.fetch(url, {
      method: 'get',
      muteHttpExceptions: true
    });

    if (res.getResponseCode() !== 200) {
      return null;
    }

    const json = JSON.parse(res.getContentText());
    const item = json.Items &&
      json.Items[0] &&
      json.Items[0].Item;

    if (!item || !item.itemName || !(item.affiliateUrl || item.itemUrl)) {
      return null;
    }

    return {
      name: item.itemName,
      url: item.affiliateUrl || item.itemUrl,
      imageUrl: item.mediumImageUrls &&
        item.mediumImageUrls[0] &&
        item.mediumImageUrls[0].imageUrl
    };
  } catch (e) {
    return null;
  }
}

function uaBuildRakutenItemBannerHtml_(item, query) {
  const name = uaEscapeHtml_(String(item.name || '').slice(0, 80));
  const url = uaEscapeHtml_(item.url || '');
  const imageUrl = uaEscapeHtml_(item.imageUrl || '');
  const queryText = uaEscapeHtml_(query || '関連アイテム');
  const imageHtml = imageUrl
    ? '<p><a href=\'' + url + '\' target=\'_blank\' rel=\'nofollow sponsored\'><img src=\'' + imageUrl + '\' alt=\'' + name + '\' style=\'max-width:100%;height:auto;\'></a></p>'
    : '';

  return [
    '<p>具体的な商品を比較したい場合は、下の楽天バナーから「' + queryText + '」の関連アイテムを確認できます。楽天を特別に推す意図ではなく、価格や種類を見比べるための選択肢として使ってください。</p>',
    imageHtml,
    '<p><a href=\'' + url + '\' target=\'_blank\' rel=\'nofollow sponsored\'>' + name + '</a></p>'
  ].filter(Boolean).join('\n');
}

function uaNormalizeRakutenAffiliateBanner_(bannerHtml) {
  return String(bannerHtml || '')
    .replace(/target="_blank"/g, "target='_blank'")
    .replace(/rel="([^"]*)"/g, "rel='$1'")
    .replace(/href="([^"]*)"/g, "href='$1'")
    .replace(/src="([^"]*)"/g, "src='$1'")
    .replace(/alt="([^"]*)"/g, "alt='$1'")
    .replace(/width="([^"]*)"/g, "width='$1'")
    .replace(/height="([^"]*)"/g, "height='$1'");
}

function uaEscapeHtml_(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;');
}

function uaShouldInsertRakutenAffiliateBanner_(body, rowData, appConfig) {
  const text = [
    rowData && rowData.mainInput,
    rowData && rowData.readerMindMemo,
    rowData && rowData.affiliateNotes,
    body
  ].join(' ');
  const notes = String(rowData && rowData.affiliateNotes || '');

  if (notes.indexOf('楽天バナーなし') !== -1 || notes.indexOf('楽天なし') !== -1) {
    return false;
  }

  if (notes.indexOf('楽天バナーあり') !== -1 || notes.indexOf('楽天あり') !== -1) {
    return true;
  }

  const negativeKeywords = [
    '工賃',
    '法規',
    '法律',
    '違法',
    '車検',
    '保証',
    '店舗対応',
    '手続き',
    '制度',
    '税金',
    'ローン',
    '保険',
    '売却',
    '査定'
  ];

  const positiveKeywords = appConfig && appConfig.key === 'home'
    ? [
      '収納',
      '掃除',
      '家事',
      '外構',
      '防災',
      '室外機カバー',
      'センサーライト',
      'マット',
      '物干し',
      '可動棚',
      '排水口',
      '換気',
      'エアコン',
      '家電',
      '見守り',
      'ベビーカー',
      '車いす'
    ]
    : [
      '洗車',
      '車内清掃',
      'カー用品',
      'コーティング',
      'タイヤ',
      'ドラレコ',
      'ドライブレコーダー',
      'サンシェード',
      '車中泊',
      'ポータブル電源',
      'バッテリー',
      'マット',
      '収納',
      'クリーナー',
      '油膜',
      '水垢',
      'ワックス',
      'モニター',
      'HDMI',
      'スマホホルダー'
    ];

  const hasPositive = positiveKeywords.some(function(keyword) {
    return text.indexOf(keyword) !== -1;
  });

  if (!hasPositive) {
    return false;
  }

  const negativeCount = negativeKeywords.filter(function(keyword) {
    return text.indexOf(keyword) !== -1;
  }).length;

  return negativeCount < 3;
}

function uaNormalizeGeneratedTags_(tagsText, rowData, appConfig) {
  const tags = [];
  const seen = {};

  function addTag(value) {
    const tag = String(value || '')
      .replace(/^#+/, '')
      .replace(/[、。|｜/／\n\r\t]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!tag || tag.length > 24) return;
    if (seen[tag]) return;

    seen[tag] = true;
    tags.push(tag);
  }

  String(tagsText || '')
    .split(/[,，、\n]/)
    .forEach(addTag);

  String(rowData && rowData.mainInput || '')
    .replace(/[「」『』【】（）()]/g, ' ')
    .split(/[\s,，、。・|｜/／]+/)
    .filter(function(part) {
      return part.length >= 2 && part.length <= 16;
    })
    .slice(0, 8)
    .forEach(addTag);

  const promptType = appConfig && appConfig.promptType;
  const fallbackTags = promptType === 'home'
    ? ['家づくり', 'マイホーム', '注文住宅', '間取り', '住宅設備', '暮らし', '新築', '後悔対策', '家づくり初心者', '住まい']
    : promptType === 'general'
      ? ['選び方', '比較', '費用', '注意点', 'メリット', 'デメリット', '初心者向け', 'よくある質問', '購入前チェック', '失敗対策']
      : ['車', 'カー用品', '車の悩み', '車メンテナンス', '中古車', '運転', 'カスタム', 'ドライブ', '車選び', 'トラブル対策'];

  fallbackTags.forEach(function(tag) {
    if (tags.length < 10) addTag(tag);
  });

  return tags.slice(0, 10).join(',');
}

function uaFixGeneratedHtml_(html) {
  let text = String(html || '');

  text = text
    .replace(/=&quot;([^&]+?)&quot;/g, "='$1'")
    .replace(/=“([^”]+?)”/g, "='$1'")
    .replace(/=""([^"]+?)""/g, "='$1'")
    .replace(/="([^"]+?)"/g, "='$1'");

  text = text
    .replace(/href=''+(https?:\/\/[^'\s<>]+)''*/g, "href='$1'")
    .replace(/target=''+([^'\s<>]+)''*/g, "target='$1'")
    .replace(/rel=''+([^']+?)''*/g, "rel='$1'")
    .replace(/class=''+([^']+?)''*/g, "class='$1'")
    .replace(/style=''+([^']+?)''*/g, "style='$1'")
    .replace(/<body[^>]*>/gi, '')
    .replace(/<\/body>\s*$/i, '')
    .replace(/<div[^>]*>/gi, '')
    .replace(/<\/div>/gi, '')
    .replace(/<table class='[^']*'>/gi, '<table>')
    .replace(/<table style='[^']*'>/gi, '<table>');

  return text;
}
