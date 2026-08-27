function uaBuildInternalLinksPrompt_(mainInput, appConfig, rowData) {
  if (!appConfig || !appConfig.useInternalLinks) {
    return `
内部リンク:
この記事タイプでは内部リンク候補を使いません。
`;
  }

  const candidates = uaGetInternalLinkCandidates_(mainInput, appConfig, rowData);
  const topicCluster = uaInferTopicCluster_(mainInput, appConfig);
  const internalLinkFormatPrompt = uaUsesSwellBlocks_(appConfig)
    ? [
        '内部リンクは「前置き文 + SWELLの記事リンクカード」で入れてください。Cocoonブログカードや通常のテキストリンクは作らないでください。',
        'カードは <!-- wp:loos/post-link {"linkData":{"url":"URL"}} /--> の形式にしてください。',
        'URLは内部リンク候補にある値を一字も変えずに使い、カードのタイトルや説明はリンク先情報をSWELLに取得させてください。'
      ].join('\n')
    : [
        '内部リンクは通常のテキストリンクではなく、必ず「前置き文 + Cocoonブログカード」で入れてください。',
        'ブログカードは必ず次の形式にしてください。divの中にはURLだけを入れ、タイトルや<a>タグは入れないでください。',
        '<!-- wp:cocoon-blocks/blogcard {"style":"blogcard-type bct-together"} -->',
        '<div class="wp-block-cocoon-blocks-blogcard blogcard-type bct-together">',
        'URL',
        '</div>',
        '<!-- /wp:cocoon-blocks/blogcard -->'
      ].join('\n');

  if (candidates.length === 0) {
    return `
内部リンク:
内部リンクシートに関連候補がない、または内部リンクシートが未作成です。
本文内に内部リンクは入れないでください。
`;
  }

  const candidateText = candidates.map(function(item, index) {
    return [
      (index + 1) + '. サイト: ' + item.site,
      'URL: ' + item.url,
      'タイトル: ' + item.title,
      'メタディスクリプション: ' + item.description,
      '本文冒頭: ' + item.intro,
      '使う場面: ' + item.usage,
      '関連キーワード: ' + item.keywords,
      '核記事: ' + (item.isCore ? 'はい' : 'いいえ'),
      '優先度: ' + item.priority
    ].join('\n');
  }).join('\n\n');

  return `
内部リンク:
以下は、このサイト内の関連記事候補です。
この記事の自動判定クラスターは「${topicCluster.label}」です。同じクラスターを優先しつつ、読者の次の疑問に直接つながる候補だけを使ってください。
候補がある場合は、関連性が高いものを本文中に1個以上入れる前提で検討してください。
ただし、読者の次の悩みにつながらない候補は無理に入れないでください。
内部リンクは1〜3個まで入れてください。
同じURLは1回だけ使ってください。
関連性が薄い候補は使わないでください。
SWELLの記事リンクカードとは別に、同じURLのテキストリンクを重ねて入れないでください。
${internalLinkFormatPrompt}
前置き文は、文脈に合わせて「〜の記事も参考になります。」「詳しくはこちらの記事で整理しています。」「関連する注意点は次の記事も参考になります。」のように、読者が別記事へ移動すると分かる一文にしてください。
内部リンクだけのブロックを連発せず、読者の次の悩みや補足理解につながる位置に入れてください。
入れやすい位置は、関連するH2の本文中、比較・注意点の補足、まとめ前の「次に読む内容」です。
内部リンクは自然に溶け込ませすぎず、読者が別記事へ移動するブログカードだと分かる文脈にしてください。
1記事内の内部リンクのうち少なくとも1つは、「あわせて読みたい」「関連する内容は〜の記事で整理しています」「本文では触れきれない注意点は〜も参考になります」のような補足導線の前置き文を添えてください。
ただし、リンクだけの不自然な案内文は避け、本文の悩みや次の確認事項につながる位置に置いてください。

【内部リンク候補】
${candidateText}
`;
}

function uaSetupInternalLinkSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(UA_INTERNAL_LINK_SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(UA_INTERNAL_LINK_SHEET_NAME);
  }

  sheet.getRange(1, 1, 1, 11).setValues([[
    'サイト',
    'URL',
    'タイトル',
    'メタディスクリプション',
    '本文冒頭',
    '関連キーワード',
    '核記事',
    '取得日時',
    '手動保持',
    '使う場面',
    '優先度'
  ]]);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 11);
}

function uaUpdateInternalLinksFromSitemaps() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(UA_INTERNAL_LINK_SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(UA_INTERNAL_LINK_SHEET_NAME);
  }

  uaSetupInternalLinkSheet();

  const existingMap = uaGetExistingInternalLinkMap_(sheet);
  const rows = [];
  const seenUrls = {};
  const messages = [];

  Object.keys(UA_APP_TYPES).forEach(function(key) {
    const appConfig = UA_APP_TYPES[key];

    if (!appConfig.useInternalLinks) {
      return;
    }

    const sitemapUrl = uaGetInternalLinkSitemapUrl_(appConfig);

    if (!sitemapUrl) {
      messages.push(appConfig.label + ': サイトマップURL未設定');
      return;
    }

    const urls = uaFetchSitemapUrls_(sitemapUrl).slice(0, UA_INTERNAL_LINK_MAX_URLS);

    if (urls.length === 0) {
      messages.push(appConfig.label + ': URL取得0件');
      return;
    }

    let count = 0;

    urls.forEach(function(url) {
      const oldData = existingMap[url] || {};
      const info = uaFetchPageInfo_(url);

      if (!info || !info.title) {
        return;
      }

      const inferred = uaInferInternalLinkMetadata_(appConfig, url, info);

      seenUrls[url] = true;
      count++;

      rows.push([
        appConfig.label,
        url,
        info.title || oldData.title || '',
        info.description || oldData.description || '',
        info.intro || oldData.intro || '',
        oldData.keywords || info.keywords || inferred.keywords || '',
        oldData.isCore ? true : '',
        new Date(),
        oldData.isManualKeep ? true : '',
        oldData.usage || inferred.usage || '',
        oldData.priority || inferred.priority || ''
      ]);
    });

    messages.push(appConfig.label + ': ' + count + '件');
  });

  Object.keys(existingMap).forEach(function(url) {
    const oldData = existingMap[url];

    if (!oldData.isManualKeep || seenUrls[url]) {
      return;
    }

    rows.push([
      oldData.site || '',
      oldData.url || url,
      oldData.title || '',
      oldData.description || '',
      oldData.intro || '',
      oldData.keywords || '',
      oldData.isCore ? true : '',
      oldData.fetchedAt || '',
      true,
      oldData.usage || '',
      oldData.priority || ''
    ]);
  });

  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 11).clearContent();
  }

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, 11).setValues(rows);
  }

  SpreadsheetApp.getUi().alert('内部リンク候補を更新しました。\n' + messages.join('\n') + '\n合計: ' + rows.length + '件');
}

function uaInferInternalLinkMetadata_(appConfig, url, info) {
  const appKey = String(appConfig && appConfig.key || '');
  const text = uaNormalizeForScore_([
    url,
    info && info.title,
    info && info.description,
    info && info.intro,
    info && info.keywords
  ].join(' '));

  const result = {
    usage: '関連テーマの補足、比較、注意点、次に読む記事として使う',
    priority: '中',
    keywords: ''
  };

  const rules = [];

  function addRule(triggers, usage, priority, keywords) {
    rules.push({
      triggers: triggers,
      usage: usage,
      priority: priority || '中',
      keywords: keywords || triggers.join(' ')
    });
  }

  addRule(
    ['後悔', '失敗', 'デメリット', '注意', '不安'],
    '後悔・失敗・注意点を補足するときに使う',
    '高',
    '後悔 失敗 デメリット 注意点 選び方 比較'
  );

  addRule(
    ['費用', '料金', '相場', '価格', '工賃', '維持費'],
    '費用・相場・見積もりの補足として使う',
    '高',
    '費用 相場 価格 工賃 維持費 見積もり'
  );

  if (appKey === 'drive') {
    addRule(
      ['洗車', 'コーティング', 'ワックス', '水垢', '油膜', 'ガラス', '車内清掃', '汚れ', '綺麗', 'きれい', '清潔'],
      '洗車・車内清掃・汚れ対策・清潔感の補足として使う',
      '高',
      '洗車 車内清掃 汚れ 綺麗 清潔 コーティング ワックス 水垢 油膜 ガラス'
    );
    addRule(
      ['ナビ', 'テレビ', '地デジ', 'モニター', 'hdmi', 'carplay', 'android', '後付け'],
      'ナビ・モニター・CarPlay・後付け電装の補足として使う',
      '高',
      'ナビ テレビ 地デジ モニター HDMI CarPlay Android Auto 後付け'
    );
    addRule(
      ['エアコン', '冷房', '暖房', 'アイドリング', '車中泊', '仮眠', 'バッテリー', '電源'],
      'エアコン・車中泊・バッテリー・電源まわりの補足として使う',
      '高',
      'エアコン 車中泊 仮眠 バッテリー 電源 アイドリング ポータブル電源'
    );
    addRule(
      ['タイヤ', 'ホイール', '空気圧', 'スタッドレス'],
      'タイヤ・ホイール・交換時期の補足として使う',
      '中',
      'タイヤ ホイール 空気圧 スタッドレス 交換'
    );
  }

  if (appKey === 'home') {
    addRule(
      ['間取り', '動線', '家事動線', '生活動線', '車いす', 'バリアフリー'],
      '間取り・生活動線・家族の使いやすさの補足として使う',
      '高',
      '間取り 動線 家事動線 生活動線 車いす バリアフリー 通路幅'
    );
    addRule(
      ['キッチン', '洗面', '浴室', '風呂', 'トイレ', '水回り', '排水', 'ぬめり', '掃除'],
      '水回り・掃除・設備選びの補足として使う',
      '高',
      'キッチン 洗面 浴室 トイレ 水回り 排水 ぬめり 掃除'
    );
    addRule(
      ['収納', '片付け', 'クローゼット', 'パントリー', '土間'],
      '収納計画・片付け・生活用品の置き場を補足するときに使う',
      '高',
      '収納 片付け クローゼット パントリー 土間収納 可動棚'
    );
    addRule(
      ['外構', '庭', '駐車場', '玄関', 'アプローチ', '隣家', '境界'],
      '外構・玄関まわり・隣家との距離感の補足として使う',
      '中',
      '外構 庭 駐車場 玄関 アプローチ 隣家 境界'
    );
    addRule(
      ['断熱', '窓', '結露', '換気', 'エアコン', '寒い', '暑い'],
      '断熱・窓・換気・暑さ寒さ対策の補足として使う',
      '中',
      '断熱 窓 結露 換気 エアコン 寒さ 暑さ'
    );
  }

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    if (rule.triggers.some(function(trigger) {
      return text.indexOf(uaNormalizeForScore_(trigger)) !== -1;
    })) {
      result.usage = rule.usage;
      result.priority = rule.priority;
      result.keywords = rule.keywords;
      return result;
    }
  }

  if (info && info.keywords) {
    result.keywords = info.keywords;
  }

  return result;
}

function uaGetInternalLinkSitemapUrl_(appConfig) {
  const props = PropertiesService.getScriptProperties();
  const key = String(appConfig && appConfig.key || '').toUpperCase();
  return props.getProperty('UA_INTERNAL_LINK_' + key + '_SITEMAP_URL') ||
    props.getProperty('UA_INTERNAL_LINK_SITEMAP_URL') ||
    '';
}

function uaGetExistingInternalLinkMap_(sheet) {
  const map = {};

  if (!sheet || sheet.getLastRow() < 2) {
    return map;
  }

  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, Math.min(sheet.getLastColumn(), 11)).getValues();

  values.forEach(function(row, index) {
    const url = row[1];
    if (!url) return;

    map[url] = {
      site: row[0],
      url: row[1],
      title: row[2],
      description: row[3],
      intro: row[4],
      keywords: row[5],
      isCore: row[6] === true || String(row[6]).toUpperCase() === 'TRUE',
      fetchedAt: row[7],
      isManualKeep: row[8] === true || String(row[8]).toUpperCase() === 'TRUE',
      usage: row[9],
      priority: row[10],
      rowIndex: index + 2
    };
  });

  return map;
}

/**
 * Adds or refreshes a single internal-link candidate row right after a post
 * goes live, using data already on hand (no sitemap crawl / page fetch).
 * Keeps existing 核記事・手動保持・使う場面・優先度 edits intact.
 */
function uaUpsertInternalLinkCandidateForPost_(appConfig, url, title, description, bodyHtml, keywords) {
  if (!appConfig || !appConfig.useInternalLinks || !url || !title) return;

  const introText = uaCleanText_(uaStripHtml_(String(bodyHtml || ''))).slice(0, 200);
  const info = { title: uaCleanText_(title), description: uaCleanText_(description || ''), intro: introText, keywords: uaCleanText_(keywords || '') };
  const inferred = uaInferInternalLinkMetadata_(appConfig, url, info);

  uaSetupInternalLinkSheet();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(UA_INTERNAL_LINK_SHEET_NAME);
  const existingMap = uaGetExistingInternalLinkMap_(sheet);
  const oldData = existingMap[url] || {};

  const row = [
    appConfig.label,
    url,
    info.title || oldData.title || '',
    info.description || oldData.description || '',
    info.intro || oldData.intro || '',
    oldData.keywords || info.keywords || inferred.keywords || '',
    oldData.isCore ? true : '',
    new Date(),
    oldData.isManualKeep ? true : '',
    oldData.usage || inferred.usage || '',
    oldData.priority || inferred.priority || ''
  ];

  if (oldData.rowIndex) {
    sheet.getRange(oldData.rowIndex, 1, 1, 11).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
}

function uaGetInternalLinkCandidates_(mainInput, appConfig, rowData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(UA_INTERNAL_LINK_SHEET_NAME);

  if (!sheet || sheet.getLastRow() < 2) {
    return [];
  }

  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, Math.min(sheet.getLastColumn(), 11)).getValues();

  return values
    .map(function(row) {
      const data = {
        site: row[0] || '',
        url: row[1] || '',
        title: row[2] || '',
        description: row[3] || '',
        intro: row[4] || '',
        keywords: row[5] || '',
        isCore: row[6] === true || String(row[6]).toUpperCase() === 'TRUE',
        isManualKeep: row[8] === true || String(row[8]).toUpperCase() === 'TRUE',
        usage: row[9] || '',
        priority: row[10] || ''
      };

      data.score = uaScoreInternalLink_(mainInput, appConfig, data, rowData);
      return data;
    })
    .filter(function(item) {
      return item.url &&
        item.title &&
        item.score > 0 &&
        uaIsSameInternalLinkSite_(item, appConfig);
    })
    .sort(function(a, b) {
      if (b.score !== a.score) return b.score - a.score;
      if (a.isCore !== b.isCore) return a.isCore ? -1 : 1;
      if (a.isManualKeep !== b.isManualKeep) return a.isManualKeep ? -1 : 1;
      return 0;
    })
    .slice(0, UA_INTERNAL_LINK_MAX_CANDIDATES);
}

function uaIsSameInternalLinkSite_(item, appConfig) {
  const site = uaNormalizeForScore_(item && item.site);
  const label = uaNormalizeForScore_(appConfig && appConfig.label);
  const key = uaNormalizeForScore_(appConfig && appConfig.key);

  if (!site || !label) {
    return true;
  }

  return site.indexOf(label) !== -1 ||
    label.indexOf(site) !== -1 ||
    (key && site.indexOf(key) !== -1);
}

function uaScoreInternalLink_(mainInput, appConfig, data, rowData) {
  const key = uaNormalizeForScore_(mainInput);
  const expandedTerms = uaGetInternalLinkExpandedTerms_(mainInput, appConfig);
  const queryTerms = uaGetInternalLinkQueryTerms_(mainInput);
  const mainText = uaNormalizeForScore_([
    data.url,
    data.title,
    data.description,
    data.intro,
    data.keywords
  ].join(' '));
  const usageText = uaNormalizeForScore_(data.usage);

  let score = 0;

  if (key && mainText.indexOf(key) !== -1) score += 6;

  queryTerms.forEach(function(term) {
    if (mainText.indexOf(term) !== -1) {
      score += term.length >= 4 ? 2 : 1;
    }
  });

  expandedTerms.forEach(function(term) {
    if (mainText.indexOf(term) !== -1) score += 3;
  });

  if (score === 0) {
    return 0;
  }

  queryTerms.forEach(function(term) {
    if (usageText.indexOf(term) !== -1) {
      score += 0.5;
    }
  });

  if (String(data.priority).indexOf('高') !== -1) score += 2;
  if (String(data.priority).indexOf('中') !== -1) score += 1;
  if (data.isCore) score += 3;
  if (data.isManualKeep) score += 1;

  const sourceCluster = uaInferTopicCluster_(mainInput, appConfig);
  const candidateCluster = uaInferTopicCluster_([
    data.title,
    data.description,
    data.intro,
    data.keywords,
    data.usage
  ].join(' '), appConfig);
  if (sourceCluster.key === candidateCluster.key) score += 4;
  if (data.isCore && sourceCluster.key === candidateCluster.key) score += 2;

  return score;
}

function uaGetInternalLinkQueryTerms_(mainInput) {
  const key = uaNormalizeForScore_(mainInput);
  const terms = [];

  function add(term) {
    term = uaNormalizeForScore_(term);
    if (term && term.length >= 2 && terms.indexOf(term) === -1) {
      terms.push(term);
    }
  }

  key.split(/\s+/).forEach(add);

  return terms;
}

function uaGetInternalLinkExpandedTerms_(mainInput, appConfig) {
  const key = uaNormalizeForScore_(mainInput);
  const appKey = String(appConfig && appConfig.key || '');
  const terms = [];

  function add(words) {
    words.forEach(function(word) {
      const normalized = uaNormalizeForScore_(word);
      if (normalized && terms.indexOf(normalized) === -1) {
        terms.push(normalized);
      }
    });
  }

  uaGetInternalLinkTopicFamilies_(appKey).forEach(function(family) {
    if (family.triggers.some(function(trigger) {
      return key.indexOf(uaNormalizeForScore_(trigger)) !== -1;
    })) {
      add(family.terms);
    }
  });

  return terms;
}

function uaGetInternalLinkTopicFamilies_(appKey) {
  const commonFamilies = [
    {
      triggers: ['後悔', '失敗', 'デメリット', '注意', '不安', '迷う'],
      terms: ['後悔', '失敗', 'デメリット', '注意点', '選び方', '比較', 'チェック']
    },
    {
      triggers: ['費用', '料金', '相場', '価格', '工賃', '維持費'],
      terms: ['費用', '料金', '相場', '価格', '工賃', '維持費', '見積もり']
    },
    {
      triggers: ['中古', '買う', '購入', '選び方', '比較'],
      terms: ['中古', '購入', '選び方', '比較', '注意点', 'チェック']
    },
    {
      triggers: ['安全', '危険', '違法', '車検', '法律', '規制'],
      terms: ['安全', '危険', '車検', '法律', '規制', '注意点']
    },
    {
      triggers: ['掃除', '汚れ', '汚い', '綺麗', 'きれい', 'キレイ', '清潔', '手入れ', 'メンテ'],
      terms: ['掃除', '汚れ', '清潔', '手入れ', 'メンテナンス', '洗浄', 'カビ', '臭い', 'におい', '洗車', '車内清掃']
    }
  ];

  const driveFamilies = [
    {
      triggers: ['洗車', 'コーティング', 'ワックス', '水垢', '油膜', 'ガラス', '車内清掃', '外装', '内装', '綺麗', 'きれい', 'キレイ', '汚い', '汚れ', '清潔', '性格'],
      terms: ['洗車', 'コーティング', 'ワックス', '水垢', '油膜', 'ガラス', '車内清掃', '外装', '内装', '掃除', '清潔', '手入れ', 'メンテナンス', '臭い', 'におい']
    },
    {
      triggers: ['ナビ', 'テレビ', '地デジ', 'モニター', 'hdmi', 'carplay', 'android', '後付け', '取り付け'],
      terms: ['ナビ', 'テレビ', '地デジ', 'モニター', 'HDMI', 'CarPlay', 'Android Auto', '後付け', '取り付け']
    },
    {
      triggers: ['エアコン', '冷房', '暖房', 'アイドリング', '車中泊', '仮眠', '休憩', '暑い', '寒い'],
      terms: ['エアコン', '冷房', '暖房', 'アイドリング', '車中泊', '仮眠', 'ポータブル電源', 'バッテリー']
    },
    {
      triggers: ['バッテリー', '電源', '充電', 'ドラレコ', '電装', 'ヒューズ'],
      terms: ['バッテリー', '電源', '充電', 'ドライブレコーダー', '電装', 'ヒューズ', '配線']
    },
    {
      triggers: ['タイヤ', 'ホイール', '空気圧', 'スタッドレス', 'インチ'],
      terms: ['タイヤ', 'ホイール', '空気圧', 'スタッドレス', 'インチ', '交換']
    }
  ];

  const homeFamilies = [
    {
      triggers: ['間取り', '動線', '生活動線', '家事動線', '車いす', 'バリアフリー'],
      terms: ['間取り', '動線', '生活動線', '家事動線', '車いす', 'バリアフリー', '通路幅']
    },
    {
      triggers: ['キッチン', '洗面', '風呂', 'トイレ', '水回り', '排水', 'ぬめり', '掃除', '汚れ', 'カビ', '臭い', 'におい'],
      terms: ['キッチン', '洗面所', '浴室', 'トイレ', '水回り', '排水', 'ぬめり', '掃除', 'カビ', '臭い', 'におい', '手入れ']
    },
    {
      triggers: ['収納', '片付け', 'クローゼット', 'パントリー', '土間'],
      terms: ['収納', '片付け', 'クローゼット', 'パントリー', '土間収納', '可動棚']
    },
    {
      triggers: ['外構', '庭', '駐車場', '玄関', 'アプローチ', '隣家', '境界'],
      terms: ['外構', '庭', '駐車場', '玄関', 'アプローチ', '隣家', '境界', '目隠し']
    },
    {
      triggers: ['断熱', '寒い', '暑い', '窓', '結露', '換気', 'エアコン'],
      terms: ['断熱', '窓', '結露', '換気', 'エアコン', '寒さ', '暑さ']
    }
  ];

  if (appKey === 'drive') {
    return commonFamilies.concat(driveFamilies);
  }

  if (appKey === 'home') {
    return commonFamilies.concat(homeFamilies);
  }

  return commonFamilies;
}

function uaFetchSitemapUrls_(sitemapUrl) {
  const res = UrlFetchApp.fetch(sitemapUrl, { muteHttpExceptions: true });
  const text = res.getContentText();
  const urls = [];
  const locMatches = text.match(/<loc>[\s\S]*?<\/loc>/g) || [];

  locMatches.forEach(function(match) {
    const url = match
      .replace(/<loc>/, '')
      .replace(/<\/loc>/, '')
      .trim();

    if (!url) return;

    if (url.indexOf('wp-sitemap-posts-post') !== -1 || /\.xml(?:\?|$)/.test(url)) {
      try {
        urls.push.apply(urls, uaFetchSitemapUrls_(url));
      } catch (e) {
        // 子サイトマップが取れない場合はスキップ
      }
      return;
    }

    if (url.indexOf('/wp-sitemap-') === -1) {
      urls.push(url);
    }
  });

  return uaUniqueUrls_(urls);
}

function uaFetchPageInfo_(url, introLength) {
  try {
    const res = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      followRedirects: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; UnifiedArticleApp/1.0; Google Apps Script)'
      }
    });

    if (res.getResponseCode() >= 400) return null;

    const html = res.getContentText();
    const title = uaExtractTitle_(html);
    const description = uaExtractMetaDescription_(html);
    const intro = uaExtractBodyIntro_(html, introLength);

    return {
      title: title,
      description: description,
      intro: intro,
      keywords: uaBuildSimpleKeywords_(title + ' ' + description + ' ' + intro)
    };
  } catch (e) {
    return null;
  }
}

function uaGetCompetitorFetchOptions_() {
  return {
    muteHttpExceptions: true,
    followRedirects: true,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; UnifiedArticleApp/1.0; Google Apps Script)'
    }
  };
}

function uaBuildCompetitorPageFetchFailure_(url, fetchStatus) {
  return {
    url: url,
    fetchStatus: fetchStatus || '取得失敗',
    title: uaBuildUrlHintTitle_(url),
    description: '',
    headings: [],
    bodyText: '',
    keywords: uaBuildUrlKeywords_(url)
  };
}

function uaBuildCompetitorPageInfoFromResponse_(url, res) {
  if (!res) return uaBuildCompetitorPageFetchFailure_(url, '取得失敗');

  if (res.getResponseCode() >= 400) {
    return uaBuildCompetitorPageFetchFailure_(url, 'HTTP ' + res.getResponseCode());
  }

  const html = res.getContentText();
  const title = uaExtractTitle_(html);
  const description = uaExtractMetaDescription_(html);
  const headings = uaExtractHeadings_(html).slice(0, UA_COMPETITOR_URL_MAX_HEADINGS);
  const bodyText = uaExtractBodyIntro_(html, UA_COMPETITOR_URL_TEXT_LENGTH);

  return {
    url: url,
    fetchStatus: 'OK',
    title: title,
    description: description,
    headings: headings,
    bodyText: bodyText,
    keywords: uaBuildSimpleKeywords_(title + ' ' + description + ' ' + bodyText)
  };
}

function uaFetchCompetitorPageInfos_(urls) {
  const list = (Array.isArray(urls) ? urls : []).map(function(url) {
    return String(url || '').trim();
  }).filter(Boolean);

  if (list.length === 0) return [];

  try {
    const requests = list.map(function(url) {
      const options = uaGetCompetitorFetchOptions_();
      options.url = url;
      return options;
    });
    const responses = UrlFetchApp.fetchAll(requests);
    return list.map(function(url, index) {
      return uaBuildCompetitorPageInfoFromResponse_(url, responses[index]);
    });
  } catch (e) {
    return list.map(function(url) {
      return uaFetchCompetitorPageInfo_(url);
    });
  }
}

function uaFetchCompetitorPageInfo_(url) {
  try {
    const res = UrlFetchApp.fetch(url, uaGetCompetitorFetchOptions_());
    return uaBuildCompetitorPageInfoFromResponse_(url, res);
  } catch (e) {
    return uaBuildCompetitorPageFetchFailure_(url, '取得失敗');
  }
}

function uaBuildUrlHintTitle_(url) {
  const text = uaBuildUrlKeywords_(url);
  return text ? 'URLヒント: ' + text : '';
}

function uaBuildUrlKeywords_(url) {
  let value = String(url || '');

  try {
    value = decodeURIComponent(value);
  } catch (e) {
    // URLデコードできない場合は元のURLを使う
  }

  return value
    .replace(/^https?:\/\//i, '')
    .replace(/[?#].*$/, '')
    .replace(/[._~=&:%]+/g, ' ')
    .replace(/[\/\-+]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
}

function uaExtractTitle_(html) {
  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i);
  if (ogTitle && ogTitle[1]) return uaCleanText_(uaDecodeHtmlEntities_(ogTitle[1]));

  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (title && title[1]) return uaCleanText_(uaDecodeHtmlEntities_(title[1]));

  return '';
}

function uaExtractHeadings_(html) {
  const headings = [];
  const matches = String(html || '').match(/<h[2-4][^>]*>[\s\S]*?<\/h[2-4]>/gi) || [];

  matches.forEach(function(match) {
    const levelMatch = match.match(/<h([2-4])/i);
    const level = levelMatch && levelMatch[1] ? 'H' + levelMatch[1] : 'H';
    const text = uaCleanText_(uaDecodeHtmlEntities_(uaStripHtml_(match)));

    if (text) {
      headings.push(level + ': ' + text);
    }
  });

  return headings;
}

function uaExtractMetaDescription_(html) {
  const desc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i);
  if (desc && desc[1]) return uaCleanText_(uaDecodeHtmlEntities_(desc[1]));

  const descReverse = html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["'][^>]*>/i);
  if (descReverse && descReverse[1]) return uaCleanText_(uaDecodeHtmlEntities_(descReverse[1]));

  const ogDesc = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["'][^>]*>/i);
  if (ogDesc && ogDesc[1]) return uaCleanText_(uaDecodeHtmlEntities_(ogDesc[1]));

  return '';
}

function uaExtractBodyIntro_(html, introLength) {
  const articleMatch =
    html.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
    html.match(/<main[^>]*>([\s\S]*?)<\/main>/i) ||
    html.match(/<div[^>]+class=["'][^"']*(entry-content|post-content|article-content|wp-block-post-content|content-area)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);

  const contentHtml = articleMatch
    ? articleMatch[articleMatch.length - 1]
    : html;

  return uaCleanText_(uaStripHtml_(contentHtml)).slice(0, introLength || UA_INTERNAL_LINK_INTRO_LENGTH);
}

function uaBuildSimpleKeywords_(text) {
  const cleaned = uaCleanText_(text);
  const counts = {};

  cleaned
    .replace(/[、。・／/｜|（）()【】「」『』［］\[\],.]/g, ' ')
    .split(/\s+/)
    .map(function(word) {
      return word.trim();
    })
    .filter(function(word) {
      return word.length >= 2 && word.length <= 20;
    })
    .forEach(function(word) {
      counts[word] = (counts[word] || 0) + 1;
    });

  return Object.keys(counts)
    .sort(function(a, b) {
      return counts[b] - counts[a];
    })
    .slice(0, 10)
    .join(',');
}

function uaUniqueUrls_(urls) {
  const seen = {};
  const result = [];

  urls.forEach(function(url) {
    if (!url || seen[url]) return;
    seen[url] = true;
    result.push(url);
  });

  return result;
}

function uaRequiresFreshOfficialSourceSearch_(mainInput) {
  return /(最新|現在|今後|倒産|経営|決算|業績|赤字|黒字|利益|財務|負債|資金繰り|キャッシュフロー|株価|法令|法律|違反|規制|制度|補助金|税制|保険|保証|リコール|改善対策|安全基準|価格|料金|相場)/i.test(String(mainInput || ''));
}

function uaRequiresStrictOfficialSource_(value) {
  return /(最新|現在|今後|倒産|経営|決算|業績|赤字|黒字|利益|財務|負債|資金繰り|キャッシュフロー|株価|法令|法律|違反|規制|制度|補助金|税制|保険|保証|リコール|改善対策|安全基準)/i.test(String(value || ''));
}

function uaIsMarketFreshnessTopic_(value) {
  return /(価格|料金|相場)/i.test(String(value || ''));
}

function uaIsUsedVehicleMarketTopic_(value) {
  return /(中古車|中古\s*(?:自動車|カー)|認定中古車|車両価格|支払総額)/i.test(String(value || ''));
}

function uaRequiresFreshOfficialSourceSearchFromContext_(contextText) {
  const text = String(contextText || '');
  if (/(倒産|経営|決算|業績|赤字|黒字|利益|財務|負債|資金繰り|キャッシュフロー|株価|法令|法律|違反|規制|補助金|税制|リコール|改善対策)/i.test(text)) {
    return true;
  }
  return /(最新|現在|今後).{0,16}(制度|価格|料金|相場|保証|安全基準)|(制度|価格|料金|相場|保証|安全基準).{0,16}(最新|現在|今後)/i.test(text);
}

function uaIsFinanceFreshnessTopic_(value) {
  return /(倒産|経営|決算|業績|赤字|黒字|利益|財務|負債|資金繰り|キャッシュフロー|株価)/i.test(String(value || ''));
}

function uaDiscoverCurrentOfficialSources_(mainInput, appConfig, contextText) {
  const input = String(mainInput || '').trim();
  const context = String(contextText || '');
  const topicText = [input, context].join(' ');
  const requiresFreshSearch = uaRequiresFreshOfficialSourceSearch_(input) ||
    uaRequiresFreshOfficialSourceSearchFromContext_(context);
  if (!input || !requiresFreshSearch) return [];
  if (typeof uaFetchSearchResultUrls_ !== 'function' || typeof uaFetchCompetitorPageInfos_ !== 'function') return [];

  const queries = [input + ' 最新 公式'];
  if (uaIsMarketFreshnessTopic_(topicText)) queries.unshift(input + ' 現在 価格 公式');
  if (uaIsUsedVehicleMarketTopic_(topicText)) {
    queries.unshift(input + ' 認定中古車 公式');
    queries.push(input + ' 中古車 相場 現在');
  }
  if (uaIsFinanceFreshnessTopic_(topicText)) queries.unshift(input + ' 最新 決算 IR 公式');

  const urls = [];
  queries.forEach(function(query) {
    uaFetchSearchResultUrls_(query, 8).forEach(function(url) {
      if (urls.length >= 10 || urls.indexOf(url) !== -1) return;
      urls.push(url);
    });
  });

  const pages = uaFetchCompetitorPageInfos_(urls).filter(function(page) {
    return page && page.fetchStatus === 'OK' && uaIsLikelyOfficialSourcePage_(page);
  }).map(function(page) {
    const dateText = uaExtractOfficialSourceDate_(
      [page.title, page.description, page.bodyText].join(' ')
    );
    return {
      genre: uaIsFinanceFreshnessTopic_(topicText) ? '自動検索・最新IR/公式情報' : '自動検索・最新公式情報',
      name: String(page.title || '公式情報').trim(),
      url: String(page.url || '').trim(),
      usage: '記事公開時点の最新情報、日付、数値、条件を確認する',
      keywords: input,
      priority: '最優先',
      urlStatus: '自動取得OK',
      checkedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Tokyo', 'yyyy-MM-dd HH:mm'),
      sourceDate: dateText,
      verifiedExcerpt: String(page.bodyText || page.description || '').replace(/\s+/g, ' ').trim().slice(0, 1800)
    };
  });

  pages.sort(function(a, b) {
    return String(b.sourceDate || '').localeCompare(String(a.sourceDate || ''));
  });

  return pages.slice(0, 4);
}

function uaIsLikelyOfficialSourcePage_(page) {
  const url = String(page && page.url || '').toLowerCase();
  const text = [page && page.title, page && page.description, page && page.bodyText].join(' ');
  if (!/^https?:\/\//i.test(url)) return false;
  if (/(wikipedia|youtube|facebook|instagram|x\.com|twitter|note\.com|ameblo|価格\.com|kakaku|yahoo|goo\.ne\.jp|allabout|carview|minkara)/i.test(url)) return false;
  if (/\.(?:go|lg)\.jp(?:\/|$)/i.test(url)) return true;
  return /(公式|official|企業サイト|コーポレート|IR情報|投資家情報|株主・投資家|決算|有価証券報告書|取扱説明書|リコール|改善対策)/i.test(text);
}

function uaExtractOfficialSourceDate_(value) {
  const text = String(value || '');
  const matches = text.match(/20\d{2}[年\/.-]\s*\d{1,2}[月\/.-]\s*\d{1,2}日?/g) || [];
  if (matches.length === 0) return '';
  return matches.map(function(item) {
    const parts = String(item).match(/(20\d{2})\D+(\d{1,2})\D+(\d{1,2})/);
    return parts ? parts[1] + '-' + ('0' + parts[2]).slice(-2) + '-' + ('0' + parts[3]).slice(-2) : '';
  }).filter(Boolean).sort().reverse()[0] || '';
}

function uaBuildExternalSourcesPrompt_(mainInput, appConfig, contextText) {
  const storedCandidates = uaGetExternalSourceCandidates_(mainInput, appConfig);
  const discoveredCandidates = uaDiscoverCurrentOfficialSources_(mainInput, appConfig, contextText);
  const seenUrls = {};
  const candidates = discoveredCandidates.concat(storedCandidates).filter(function(item) {
    const url = String(item && item.url || '').trim();
    if (!url || seenUrls[url]) return false;
    seenUrls[url] = true;
    return true;
  });

  if (candidates.length === 0) {
    return `
外部出典リンク:
外部出典シートと最新公式情報の自動検索で、関連候補を取得できませんでした。
記事テーマが最新性を必要とする場合は、本文を一般論だけで完成させず、fact_check_points に「最新の公式情報を取得できないため公開前に確認」と必ず出してください。
ただし、記事内で法規・安全・メーカー仕様・料金・保証・制度・補助金・公的統計など、読者が「本当かな？」と感じやすい説明をする場合は、URLが確実に分かる公式サイト・公的機関・メーカー公式などの外部リンクを本文中に自然に1〜3個入れてください。
URLが不確かな場合は本文にリンクを入れず、fact_check_points に確認事項として出してください。
無関係な外部リンクは入れないでください。
リンク形式は <a href='URL' target='_blank' rel='noopener'>自然な文言</a> とします。
外部リンクは、読者が公式サイト・公的機関・メーカー情報へ移動するリンクだと分かる文脈で入れてください。
特に法規、安全、保証、メーカー仕様、価格、対応可否に関わるリンクは、「公式案内」「メーカー公式サイト」「公的機関の情報」など、リンク先の性質が分かる文言にしてください。
競合URL欄に入力されたURLは外部リンク候補ではありません。競合URLを本文リンクとして使わないでください。
`;
  }

  const candidateText = candidates.map(function(item, index) {
    return [
      (index + 1) + '. ジャンル: ' + item.genre,
      '出典名: ' + item.name,
      'URL: ' + item.url,
      '使う場面: ' + item.usage,
      '関連キーワード: ' + item.keywords,
      '優先度: ' + item.priority,
      '自動確認日時: ' + (item.checkedAt || '未確認'),
      'ページ内の日付候補: ' + (item.sourceDate || '取得できず'),
      '取得本文抜粋: ' + (item.verifiedExcerpt || '自動取得なし')
    ].join('\n');
  }).join('\n\n');

  return `
外部出典リンク:
以下は、記事テーマに関連しそうな外部出典候補です。
「自動検索・最新」と付いた候補は、記事生成直前に公式情報を検索して取得した候補です。ページ内の日付候補と実際の内容を比較し、公開時点で最も新しい資料を優先してください。
最新性が必要なテーマでは、URLを置くだけで終わらせず、資料名・公表日または確認時点・本文の判断に必要な具体的数値や条件を本文へ反映してください。
具体的な数値や条件は「取得本文抜粋」に実際に含まれる内容だけを使い、抜粋にない数字を推測で補わないでください。
最新候補を取得できない、日付を確認できない、必要な数値を読み取れない場合は、一般論で穴埋めせず fact_check_points に公開停止理由として出してください。
候補が本文の内容に合う場合は、候補URLを優先して使ってください。
ただし、関連性が薄い候補を無理に入れないでください。
候補だけで足りない場合は、URLが確実に分かる公式サイト・公的機関・メーカー公式など信頼できる外部リンクを補っても構いません。
URLが不確かな場合は本文にリンクを入れず、fact_check_points に確認事項として出してください。

法規、安全、メーカー仕様、対応商品、施工可否、料金、保証、制度、補助金など、事実確認が必要な説明の近くに入れてください。
本文中に「出典」「参考」「参照」「情報源」などのラベルは入れないでください。
外部リンクだけの独立段落は禁止です。
リンク形式は <a href='URL' target='_blank' rel='noopener'>自然な文言</a> とします。
外部リンクは、読者が公式サイト・公的機関・メーカー情報へ移動するリンクだと分かる文脈で入れてください。
特に法規、安全、保証、メーカー仕様、価格、対応可否に関わるリンクは、「公式案内」「メーカー公式サイト」「公的機関の情報」など、リンク先の性質が分かる文言にしてください。
内部リンクのような「あわせて読みたい」ではなく、「最新情報は公式サイトで確認する」「制度は公的機関の案内を見る」「対応可否はメーカー公式サイトで確認する」という信頼性補強の役割で使ってください。
競合URL欄に入力されたURLは外部リンク候補ではありません。競合URLを本文リンクとして使わないでください。

【外部出典候補】
${candidateText}
`;
}

function uaSetupExternalSourceSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(UA_EXTERNAL_SOURCE_SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(UA_EXTERNAL_SOURCE_SHEET_NAME);
  }

  sheet.getRange(1, 1, 1, 8).setValues([[
    'ジャンル',
    '出典名',
    'URL',
    '使う場面',
    '関連キーワード',
    '優先度',
    'URL確認',
    '確認日時'
  ]]);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 8);
}

function uaGetExternalSourceCandidates_(mainInput, appConfig) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(UA_EXTERNAL_SOURCE_SHEET_NAME);

  if (!sheet || sheet.getLastRow() < 2) {
    return [];
  }

  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, Math.min(sheet.getLastColumn(), 8)).getValues();

  return values
    .map(function(row) {
      const data = {
        genre: row[0] || '',
        name: row[1] || '',
        url: row[2] || '',
        usage: row[3] || '',
        keywords: row[4] || '',
        priority: row[5] || '',
        urlStatus: row[6] || '',
        checkedAt: row[7] || ''
      };

      data.score = uaScoreExternalSource_(mainInput, appConfig, data);
      return data;
    })
    .filter(function(item) {
      const status = String(item.urlStatus || '').trim();
      return item.name &&
        item.url &&
        item.score > 0 &&
        status !== 'NG' &&
        status !== '要確認';
    })
    .sort(function(a, b) {
      return b.score - a.score;
    })
    .slice(0, UA_EXTERNAL_SOURCE_MAX_CANDIDATES);
}

function uaScoreExternalSource_(mainInput, appConfig, data) {
  const key = uaNormalizeForScore_(mainInput);
  const typeWords = appConfig ? uaNormalizeForScore_(appConfig.label + ' ' + appConfig.key) : '';
  const text = uaNormalizeForScore_([
    data.genre,
    data.name,
    data.usage,
    data.keywords
  ].join(' '));

  let score = 0;

  if (key && text.indexOf(key) !== -1) score += 6;
  if (typeWords && text.indexOf(typeWords) !== -1) score += 2;

  key.split(/\s+/).filter(function(part) {
    return part.length >= 2;
  }).forEach(function(part) {
    if (text.indexOf(part) !== -1) score += 1;
  });

  if (String(data.priority).indexOf('高') !== -1) score += 2;
  if (String(data.priority).indexOf('中') !== -1) score += 1;

  return score;
}

function uaAddInternalLinkToActiveRow() {
  const result = uaAddInternalLinkToActiveRow_();
  SpreadsheetApp.getUi().alert(result && result.message ? result.message : '内部リンクを本文へ追加しました。');
}

function uaAddExternalSourceLinkToActiveRow() {
  const result = uaAddExternalSourceLinkToActiveRow_();
  SpreadsheetApp.getUi().alert(result && result.message ? result.message : '外部リンクを本文へ追加しました。');
}

function uaAddInternalLinkFromPanel(data) {
  uaSaveActiveRowData(data || {});
  return uaAddInternalLinkForData_(data || {});
}

function uaAddExternalSourceLinkFromPanel(data) {
  uaSaveActiveRowData(data || {});
  return uaAddExternalSourceLinkForData_(data || {});
}

function uaAddInternalLinkFromWeb(data) {
  uaSaveActiveRowData(data || {});
  return uaAddInternalLinkForData_(data || {});
}

function uaAddExternalSourceLinkFromWeb(data) {
  uaSaveActiveRowData(data || {});
  return uaAddExternalSourceLinkForData_(data || {});
}

function uaAddInternalLinkToActiveRow_() {
  const sheet = uaGetRequiredSheet_();
  const row = sheet.getActiveCell().getRow();
  return uaAddInternalLinkForContext_(sheet, row);
}

function uaAddExternalSourceLinkToActiveRow_() {
  const sheet = uaGetRequiredSheet_();
  const row = sheet.getActiveCell().getRow();
  return uaAddExternalSourceLinkForContext_(sheet, row);
}

function uaAddInternalLinkForData_(data) {
  const sheet = uaGetSheetForData_(data || {});
  const row = Number(data && data.row) || sheet.getActiveCell().getRow();
  return uaAddInternalLinkForContext_(sheet, row);
}

function uaAddExternalSourceLinkForData_(data) {
  const sheet = uaGetSheetForData_(data || {});
  const row = Number(data && data.row) || sheet.getActiveCell().getRow();
  return uaAddExternalSourceLinkForContext_(sheet, row);
}

function uaAddInternalLinkForContext_(sheet, row) {
  if (row === 1) {
    throw new Error('記事データの行を選択してください。');
  }

  const rowData = uaBuildRowData_(sheet, row);
  const appConfig = uaGetAppConfigByLabel_(rowData.appType);

  if (!appConfig || !appConfig.useInternalLinks) {
    throw new Error('この記事タイプでは内部リンク後入れは使いません。');
  }

  const body = String(rowData.body || '').trim();

  if (!body) {
    throw new Error('本文が空です。先に本文生成をしてください。');
  }

  const candidate = uaPickInternalLinkForBody_(rowData, appConfig, body);

  if (!candidate) {
    uaAppendLinkPostInsertFact_(sheet, row, '・内部リンク後入れ未実行｜関連候補なし');
    return {
      message: '内部リンクを追加しませんでした。\n理由: 関連候補がありません。'
    };
  }

  if (body.indexOf(candidate.url) !== -1) {
    uaAppendLinkPostInsertFact_(sheet, row, '・内部リンク後入れ未実行｜本文内に同じURLあり');
    return {
      message: '内部リンクを追加しませんでした。\n理由: 本文内に同じURLがすでにあります。'
    };
  }

  const block = uaBuildInternalLinkPostInsertBlock_(candidate, appConfig);
  const nextBody = uaInsertLinkBlockIntoBody_(body, block, candidate);
  sheet.getRange(row, UA_COLUMNS.body).setValue(nextBody);
  uaAppendLinkPostInsertFact_(sheet, row, '・内部リンク後入れ｜' + candidate.url);

  const nextData = uaBuildRowData_(sheet, row);
  nextData.message = '内部リンクを本文へ追加しました。';
  return nextData;
}

function uaAddExternalSourceLinkForContext_(sheet, row) {
  if (row === 1) {
    throw new Error('記事データの行を選択してください。');
  }

  const rowData = uaBuildRowData_(sheet, row);
  const appConfig = uaGetAppConfigByLabel_(rowData.appType);
  const body = String(rowData.body || '').trim();

  if (!body) {
    throw new Error('本文が空です。先に本文生成をしてください。');
  }

  const candidate = uaPickExternalSourceForBody_(rowData, appConfig, body);

  if (!candidate) {
    uaAppendLinkPostInsertFact_(sheet, row, '・外部リンク後入れ未実行｜関連候補なし');
    return {
      message: '外部リンクを追加しませんでした。\n理由: 関連候補がありません。'
    };
  }

  if (body.indexOf(candidate.url) !== -1) {
    uaAppendLinkPostInsertFact_(sheet, row, '・外部リンク後入れ未実行｜本文内に同じURLあり');
    return {
      message: '外部リンクを追加しませんでした。\n理由: 本文内に同じURLがすでにあります。'
    };
  }

  const block = uaBuildExternalSourcePostInsertBlock_(candidate);
  const nextBody = uaInsertLinkBlockIntoBody_(body, block, candidate);
  sheet.getRange(row, UA_COLUMNS.body).setValue(nextBody);
  uaAppendLinkPostInsertFact_(sheet, row, '・外部リンク後入れ｜' + candidate.url);

  const nextData = uaBuildRowData_(sheet, row);
  nextData.message = '外部リンクを本文へ追加しました。';
  return nextData;
}

function uaPickInternalLinkForBody_(rowData, appConfig, body) {
  const candidates = uaGetInternalLinkCandidates_([
    rowData && rowData.mainInput,
    rowData && rowData.readerMindMemo,
    body
  ].join(' '), appConfig, rowData);

  for (let i = 0; i < candidates.length; i++) {
    if (String(body || '').indexOf(candidates[i].url) === -1) {
      return candidates[i];
    }
  }

  return null;
}

function uaPickExternalSourceForBody_(rowData, appConfig, body) {
  const candidates = uaGetExternalSourceCandidates_([
    rowData && rowData.mainInput,
    rowData && rowData.readerMindMemo,
    body
  ].join(' '), appConfig);

  for (let i = 0; i < candidates.length; i++) {
    if (String(body || '').indexOf(candidates[i].url) === -1) {
      return candidates[i];
    }
  }

  return null;
}

function uaBuildInternalLinkPostInsertBlock_(candidate, appConfig) {
  const rawUrl = String(candidate.url || '').trim();
  const url = uaEscapeLinkHtml_(rawUrl);
  const rawUsage = String(candidate.usage || '本文では触れきれない補足内容')
    .replace(/として使う$/, '')
    .replace(/ときに使う$/, 'とき')
    .replace(/に使う$/, '')
    .trim();
  const usage = uaEscapeLinkHtml_(rawUsage || '本文では触れきれない補足内容');
  const leadText = /とき$/.test(usage)
    ? usage + 'は、こちらの記事も参考になります。'
    : usage + 'をあわせて確認したい場合は、こちらの記事も参考になります。';

  if (uaUsesSwellBlocks_(appConfig)) {
    return [
      '<!-- wp:paragraph -->',
      '<p>' + leadText + '</p>',
      '<!-- /wp:paragraph -->',
      uaBuildSwellInternalPostLinkBlock_(rawUrl)
    ].join('\n');
  }

  return [
    '<p>' + leadText + '</p>',
    '<!-- wp:cocoon-blocks/blogcard {"style":"blogcard-type bct-together"} -->',
    '<div class="wp-block-cocoon-blocks-blogcard blogcard-type bct-together">',
    url,
    '</div>',
    '<!-- /wp:cocoon-blocks/blogcard -->'
  ].join('\n');
}

function uaBuildSwellInternalPostLinkBlock_(url) {
  const cleanUrl = String(url || '').trim().replace(/&amp;/gi, '&');
  if (!/^https?:\/\//i.test(cleanUrl)) return '';
  return '<!-- wp:loos/post-link ' + JSON.stringify({
    linkData: { url: cleanUrl }
  }) + ' /-->';
}

/**
 * Converts the former SWELL "card-like text link" and standalone same-site
 * link paragraphs into SWELL's native post-link block before WordPress sync.
 * Normal inline links inside explanatory paragraphs are intentionally kept.
 */
function uaNormalizeSwellInternalLinkBlocks_(body, appConfig, siteUrl) {
  let html = String(body || '');
  if (!html || !uaUsesSwellBlocks_(appConfig)) return html;

  const siteHostMatch = /^https?:\/\/([^\/?#]+)/i.exec(String(siteUrl || '').trim());
  const siteHost = String(siteHostMatch && siteHostMatch[1] || '').toLowerCase().replace(/^www\./, '');
  if (!siteHost) return html;

  const paragraphPattern = /(?:<!--\s*wp:paragraph\b[^>]*-->\s*)?<p\b([^>]*)>\s*<a\b([^>]*)href=(['"])(https?:\/\/[^'"]+)\3([^>]*)>[\s\S]*?<\/a>\s*<\/p>\s*(?:<!--\s*\/wp:paragraph\s*-->)?/gi;
  return html.replace(paragraphPattern, function(match, paragraphAttrs, beforeHref, quote, rawUrl) {
    const url = String(rawUrl || '').replace(/&amp;/gi, '&');
    const hostMatch = /^https?:\/\/([^\/?#]+)/i.exec(url);
    const host = String(hostMatch && hostMatch[1] || '').toLowerCase().replace(/^www\./, '');
    const isMarkedInternal = /\barticle-compass-internal-link\b/i.test(String(paragraphAttrs || ''));
    if (!isMarkedInternal && host !== siteHost) return match;
    return uaBuildSwellInternalPostLinkBlock_(url) || match;
  });
}

/**
 * Re-serializes the two managed SWELL core-group decorations into markup that
 * Gutenberg can parse without showing "unexpected or invalid content".
 *
 * Older generated posts included wp-block-group__inner-container and raw
 * <p>/<ul> children without their own block comments. They rendered on the
 * public page, but the block editor treated the outer group as invalid and
 * visually showed a second point/caution frame. Only Article Compass managed
 * groups are touched here; ordinary author-created groups are left unchanged.
 */
function uaNormalizeSwellManagedCoreGroups_(body, appConfig) {
  let html = String(body || '');
  if (!html || !uaUsesSwellBlocks_(appConfig)) return html;

  const managedGroups = [
    {
      marker: 'article-compass-point-box',
      className: 'is-style-big_icon_point article-compass-point-box'
    },
    {
      marker: 'article-compass-notice-box',
      className: 'is-style-big_icon_caution article-compass-notice-box article-compass-notice-danger'
    }
  ];

  managedGroups.forEach(function(spec) {
    const escapedMarker = spec.marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(
      '<!--\\s*wp:group\\b(?:(?!-->)[\\s\\S])*?' + escapedMarker + '(?:(?!-->)[\\s\\S])*?-->' +
      '\\s*<div\\b[^>]*class=[^>]*' + escapedMarker + '[^>]*>' +
      '\\s*(?:<div\\b[^>]*class=[^>]*wp-block-group__inner-container[^>]*>\\s*)?' +
      '([\\s\\S]*?)' +
      '(?:\\s*</div>)?\\s*</div>\\s*<!--\\s*/wp:group\\s*-->',
      'gi'
    );

    html = html.replace(pattern, function(match, inner) {
      const children = uaSerializeSwellManagedGroupChildren_(inner);
      if (!children) return match;
      return [
        '<!-- wp:group {"className":' + JSON.stringify(spec.className) + ',"layout":{"type":"constrained"}} -->',
        '<div class="wp-block-group ' + spec.className + '">',
        children,
        '</div>',
        '<!-- /wp:group -->'
      ].join('\n');
    });
  });

  return html;
}

function uaNormalizeSwellAffiliateCtaButtons_(body, appConfig) {
  let html = String(body || '');
  if (!html || !uaUsesSwellBlocks_(appConfig)) return html;

  const buttonColor = uaGetSwellButtonColor_(appConfig);
  const pattern = /<!--\s*wp:html\s*-->\s*<div class=(["'])wp-block-button is-style-btn_solid\1>([\s\S]*?)<\/div>\s*<!--\s*\/wp:html\s*-->/gi;

  return html.replace(pattern, function(match, quote, inner) {
    return [
      '<!-- wp:loos/button {"isCount":true,"color":"' + buttonColor + '","btnSize":"l","className":"is-style-btn_shiny"} -->',
      '<div class="swell-block-button -html ' + buttonColor + '_ -size-l is-style-btn_shiny" data-id="article-compass-cta">' + inner + '</div>',
      '<!-- /wp:loos/button -->'
    ].join('\n');
  });
}

function uaSerializeSwellManagedGroupChildren_(inner) {
  const source = String(inner || '')
    .replace(/^\s*<div\b[^>]*wp-block-group__inner-container[^>]*>/i, '')
    .replace(/<\/div>\s*$/i, '')
    .trim();
  const tags = source.match(/<(p|ul|ol)\b[^>]*>[\s\S]*?<\/\1>/gi) || [];
  if (!tags.length) return '';

  return tags.map(function(tag) {
    if (/^<p\b/i.test(tag)) {
      return '<!-- wp:paragraph -->\n' + tag + '\n<!-- /wp:paragraph -->';
    }
    const listTag = /^<ol\b/i.test(tag) ? 'ol' : 'ul';
    let normalized = tag;
    if (!/\bclass=(["'])[^"']*\bwp-block-list\b/i.test(normalized)) {
      normalized = normalized.replace(
        new RegExp('^<' + listTag + '\\b', 'i'),
        '<' + listTag + ' class="wp-block-list"'
      );
    }
    const attributes = listTag === 'ol' ? ' {"ordered":true}' : '';
    return '<!-- wp:list' + attributes + ' -->\n' + normalized + '\n<!-- /wp:list -->';
  }).join('\n');
}

function uaBuildExternalSourcePostInsertBlock_(candidate) {
  const url = uaEscapeLinkHtml_(candidate.url);
  const name = uaEscapeLinkHtml_(candidate.name || '公式情報');
  const usage = uaEscapeLinkHtml_(candidate.usage || '最新情報や公式条件');

  return [
    '<p>' + usage + 'は、<a href=\'' + url + '\' target=\'_blank\' rel=\'noopener\'>' + name + '</a>でも確認できます。記事内の判断材料とあわせて、最新条件は公式情報で確認しておくと安心です。</p>'
  ].join('\n');
}

function uaInsertLinkBlockIntoBody_(body, block, candidate) {
  const text = String(body || '');
  const contextualIndex = uaFindContextualLinkInsertIndex_(text, candidate);

  if (contextualIndex > 0) {
    return text.slice(0, contextualIndex).trim() + '\n\n' + block + '\n\n' + text.slice(contextualIndex).trim();
  }

  const markers = [
    /<h2[^>]*>よくある質問<\/h2>/i,
    /<h2[^>]*>まとめ[\s\S]*?<\/h2>/i
  ];

  for (let i = 0; i < markers.length; i++) {
    const match = text.match(markers[i]);
    if (match && typeof match.index === 'number') {
      return text.slice(0, match.index).trim() + '\n\n' + block + '\n\n' + text.slice(match.index).trim();
    }
  }

  return text.trim() + '\n\n' + block;
}

function uaFindContextualLinkInsertIndex_(body, candidate) {
  const text = String(body || '');
  const sections = uaExtractH2SectionsForInsert_(text);
  const terms = uaBuildLinkCandidateTerms_(candidate);
  let best = null;

  if (sections.length === 0 || terms.length === 0) {
    return -1;
  }

  sections.forEach(function(section) {
    const normalized = uaNormalizeForScore_(section.text);
    let score = 0;

    terms.forEach(function(term) {
      if (normalized.indexOf(term) !== -1) {
        score += term.length >= 4 ? 3 : 1;
      }
    });

    if (/よくある質問|まとめ/i.test(section.headingText)) {
      score -= 4;
    }

    if (score > 0 && (!best || score > best.score)) {
      best = {
        score: score,
        insertIndex: section.endIndex
      };
    }
  });

  return best ? best.insertIndex : -1;
}

function uaExtractH2SectionsForInsert_(body) {
  const text = String(body || '');
  const matches = [];
  const pattern = /<h2[^>]*>[\s\S]*?<\/h2>/gi;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    matches.push({
      startIndex: match.index,
      headingEndIndex: pattern.lastIndex,
      headingHtml: match[0],
      headingText: uaCleanText_(uaStripHtml_(match[0]))
    });
  }

  return matches.map(function(item, index) {
    const next = matches[index + 1];
    const endIndex = next ? next.startIndex : text.length;

    return {
      startIndex: item.startIndex,
      endIndex: endIndex,
      headingText: item.headingText,
      text: text.slice(item.startIndex, endIndex)
    };
  });
}

function uaBuildLinkCandidateTerms_(candidate) {
  const source = [
    candidate && candidate.title,
    candidate && candidate.name,
    candidate && candidate.usage,
    candidate && candidate.keywords,
    candidate && candidate.genre
  ].join(' ');
  const terms = [];
  const genericTerms = [
    '後悔',
    '失敗',
    '注意',
    '注意点',
    '補足',
    '比較',
    '費用',
    '相場',
    '見積もり',
    '関連',
    'テーマ',
    '使う',
    '場面',
    '内容',
    '記事'
  ];

  uaNormalizeForScore_(source)
    .split(/\s+/)
    .forEach(function(term) {
      if (genericTerms.indexOf(term) !== -1) return;
      if (term.length >= 2 && terms.indexOf(term) === -1) {
        terms.push(term);
      }
    });

  return terms.slice(0, 20);
}

function uaAppendLinkPostInsertFact_(sheet, row, line) {
  const range = sheet.getRange(row, UA_COLUMNS.factCheckPoints);
  const current = String(range.getValue() || '').trim();
  const value = String(line || '').trim();
  const next = !current || current === '特になし'
    ? value
    : current + '\n' + value;

  uaSetFactCheckPointsWithLinks_(sheet, row, next);
}

function uaBuildShortAnchorText_(title) {
  return uaEscapeLinkHtml_(String(title || '関連記事')
    .replace(/[「」『』【】]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 24) || '関連記事');
}

function uaEscapeLinkHtml_(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;');
}

function uaNormalizeForScore_(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/https?:\/\/[^\s]+/g, ' ')
    .replace(/[　]/g, ' ')
    .replace(/[、。・／/｜|（）()【】「」『』［］\[\],.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
