let UA_LAST_RAKUTEN_STATUS = '';
const UA_NAVIOKUN_INTRO_URL = 'https://ebimayo5.com/archives/naviokun-reputation/';

function uaRemoveRedundantAffiliateDisclosure_(body) {
  // Cocoon displays the site's affiliate disclosure automatically. Keep the
  // generated article body free of a second, CTA-local disclosure paragraph.
  return String(body || '').replace(
    /<p\b[^>]*>\s*(?:<strong\b[^>]*>)?\s*(?:PR[：:]\s*)?本記事(?:には|に|は)アフィリエイト広告を含みます。?\s*(?:<\/strong>)?\s*<\/p>\s*/gi,
    ''
  );
}

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

    const body = uaRemoveRedundantAffiliateDisclosure_(uaNormalizeAnchorRelAttributes_(uaApplyRakutenAffiliateBanner_(
      uaApplyNaviokunIntroSet_(
        uaApplyManagedAffiliateCta_(
          uaApplyYmylNotice_(
            uaNormalizeFaqHeadingLevels_(uaFixGeneratedHtml_(resultJson.body)),
            rowData,
            appConfig
          ),
          rowData,
          appConfig
        ),
        rowData,
        appConfig
      ),
      rowData,
      appConfig
    )));
    const metaDescription = resultJson.meta_description ||
      resultJson.metaDescription ||
      '';
    const permalink = resultJson.permalink ||
      resultJson.slug ||
      '';
    const tags = uaNormalizeGeneratedTags_(resultJson.tags || '', rowData, appConfig);
    const factCheckPointsBase = resultJson.fact_check_points ||
      resultJson.factCheckPoints ||
      '特になし';
    const factCheckPoints = uaAppendRakutenStatusToFactCheck_(factCheckPointsBase);
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

function uaApplyManagedAffiliateCta_(body, rowData, appConfig) {
  const html = uaRelocateManagedAffiliateTokenByContext_(String(body || ''), rowData, appConfig);
  const spec = uaGetManagedAffiliateCtaSpec_(rowData);
  if (!html || !spec) return html;

  if (uaManagedAffiliateCtaAlreadyExists_(html, spec)) {
    return uaRemoveManagedAffiliateCtaToken_(html);
  }

  const cleanHtml = uaRemoveManagedAffiliateButtonBlocks_(html, spec);
  const tokenMatch = /\[UA_AFFILIATE_CTA[:：]\s*([^\]\r\n]{1,160})\]/i.exec(cleanHtml);
  const ctaText = uaNormalizeManagedAffiliateCtaText_(
    tokenMatch && tokenMatch[1],
    spec.name
  );
  const ctaBlock = uaBuildManagedAffiliateCtaBlock_(spec, ctaText);

  if (tokenMatch) {
    return uaReplaceManagedAffiliateCtaToken_(cleanHtml, ctaBlock);
  }

  const insertionIndex = uaFindManagedAffiliateCtaFallbackIndex_(cleanHtml);
  return [
    cleanHtml.slice(0, insertionIndex).trimEnd(),
    ctaBlock,
    cleanHtml.slice(insertionIndex).trimStart()
  ].filter(Boolean).join('\n\n');
}

function uaManagedAffiliateCtaAlreadyExists_(body, spec) {
  const html = String(body || '');
  if (spec.type === 'shortcode') {
    const shortcode = String(spec.content || '').trim();
    const buttonBlocks = uaGetManagedAffiliateButtonBlocks_(html);
    return buttonBlocks.some(function(block) {
      return shortcode && block.indexOf(shortcode) !== -1;
    });
  }

  const urls = uaExtractUrlsFromAffiliateCode_(spec.content);
  return urls.length > 0 && urls.every(function(url) {
    return html.indexOf(url) !== -1 || html.indexOf(url.replace(/&/g, '&amp;')) !== -1;
  });
}

function uaGetManagedAffiliateButtonBlocks_(body) {
  return String(body || '').match(
    /<!--\s*wp:cocoon-blocks\/button-wrap-1\b[\s\S]*?<!--\s*\/wp:cocoon-blocks\/button-wrap-1\s*-->/gi
  ) || [];
}

function uaRemoveManagedAffiliateButtonBlocks_(body, spec) {
  let html = String(body || '');
  const markers = uaExtractUrlsFromAffiliateCode_(spec && spec.content || '');
  if (spec && spec.url && markers.indexOf(spec.url) === -1) markers.push(spec.url);
  if (spec && spec.type === 'shortcode' && spec.content) markers.push(String(spec.content).trim());
  if (markers.length === 0) return html;

  uaGetManagedAffiliateButtonBlocks_(html).forEach(function(block) {
    const isManagedBlock = markers.some(function(marker) {
      return marker && (
        block.indexOf(marker) !== -1 ||
        block.indexOf(String(marker).replace(/&/g, '&amp;')) !== -1
      );
    });
    if (isManagedBlock) html = html.replace(block, '');
  });
  return html;
}

function uaRemoveManagedAffiliateCtaToken_(body) {
  return uaReplaceManagedAffiliateCtaToken_(String(body || ''), '');
}

function uaReplaceManagedAffiliateCtaToken_(body, replacement) {
  const html = String(body || '');
  const block = String(replacement || '');
  const token = '\\[UA_AFFILIATE_CTA[:：]\\s*[^\\]\\r\\n]{1,160}\\]';
  const patterns = [
    new RegExp('<!--\\s*wp:paragraph\\b[^>]*-->\\s*<p\\b[^>]*>\\s*' + token + '\\s*<\\/p>\\s*<!--\\s*\\/wp:paragraph\\s*-->', 'i'),
    new RegExp('<p\\b[^>]*>\\s*' + token + '\\s*<\\/p>', 'i'),
    new RegExp(token, 'i')
  ];

  for (let i = 0; i < patterns.length; i += 1) {
    if (patterns[i].test(html)) return html.replace(patterns[i], block);
  }
  return html;
}

function uaNormalizeManagedAffiliateCtaText_(value, affiliateName) {
  const name = String(affiliateName || '').trim();
  let text = String(value || '')
    .replace(/<!--[^]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const vague = !text || /^(詳しくはこちら|公式サイトはこちら|詳細を見る|こちら)$/i.test(text);
  if (vague || (name && text.indexOf(name) === -1)) {
    text = name ? name + 'で対応内容を確認する' : '対応内容を確認する';
  }
  return text.slice(0, 100);
}

function uaBuildManagedAffiliateCtaBlock_(spec, ctaText) {
  let tagContent = '';

  if (spec.type === 'shortcode') {
    tagContent = String(spec.content || '').trim();
  } else if (spec.type === 'url') {
    const exactUrl = String(spec.content || '').trim();
    if (!exactUrl || exactUrl !== String(spec.url || '').trim() || !/^https?:\/\/[^\s"'<>]+$/i.test(exactUrl)) {
      throw new Error('案件管理シートのURLを安全に囲みボタンへ設定できません。B列のURLを確認してください。');
    }
    tagContent = '<a href="' + exactUrl + '" target="_blank" rel="nofollow sponsored noopener">' + uaEscapeHtml_(ctaText) + '</a>';
  } else {
    const sourceHtml = uaNormalizeAnchorRelAttributes_(uaNormalizeAffiliateCodeInput_(spec.content));
    const safeText = uaEscapeHtml_(ctaText);
    const anchorMatch = /<a\b([^>]*)>([\s\S]*?)<\/a>/i.exec(sourceHtml);
    if (!anchorMatch) {
      throw new Error('案件管理シートのA8リンクHTMLに、置換できるリンクタグがありません。');
    }
    tagContent = uaIsAffiliateFreeTextPlaceholder_(anchorMatch[2])
      ? sourceHtml.replace(anchorMatch[0], '<a' + anchorMatch[1] + '>' + safeText + '</a>')
      : sourceHtml;
  }

  if (!tagContent) {
    throw new Error('案件管理シートのCTA情報が空です。');
  }

  const attributes = {
    tag: tagContent + '\n',
    isCircle: true,
    isShine: true,
    align: 'center',
    backgroundColor: 'teal',
    textColor: 'cocoon-white',
    width: '75'
  };

  return [
    '<!-- wp:cocoon-blocks/button-wrap-1 ' + JSON.stringify(attributes) + ' -->',
    '<div class="wp-block-cocoon-blocks-button-wrap-1 aligncenter btn-wrap btn-wrap-block button-block btn-wrap-circle btn-wrap-shine has-text-color has-background has-cocoon-white-color has-teal-background-color has-custom-width cocoon-block-button__width-75">' + tagContent + '</div>',
    '<!-- /wp:cocoon-blocks/button-wrap-1 -->'
  ].join('\n');
}

function uaTestManagedAffiliateUrlCta() {
  const cases = [
    {
      name: 'ナビ男くん',
      url: 'https://px.a8.net/svt/ejp?a8mat=44Z0VG+70FT9U+4YGQ+BW0YB&a8ejpredirect=https%3A%2F%2Fnaviokun.ocnk.net%2F'
    },
    {
      name: 'シンシェード',
      url: 'https://px.a8.net/svt/ejp?a8mat=44Z0VG+6ZUDO2+5JIS+BW0YB&a8ejpredirect=https%3A%2F%2Fshinshade.com%2F'
    }
  ];

  cases.forEach(function(item, index) {
    const block = uaBuildManagedAffiliateCtaBlock_({
      type: 'url',
      name: item.name,
      url: item.url,
      content: item.url
    }, item.name + 'で対応内容を確認する');
    const anchor = /<div class="wp-block-cocoon-blocks-button-wrap-1[^>]*>([\s\S]*?)<\/div>/.exec(block);
    const href = anchor && /<a\b[^>]*\bhref="([^"]+)"/i.exec(anchor[1]);
    if (!href || href[1] !== item.url) {
      throw new Error('B列URLが囲みボタンで改変されました。case=' + (index + 1));
    }
    if (uaFindPrePublishDuplicateRelLinks_(block).length) {
      throw new Error('URL囲みボタンのrel属性が重複しています。case=' + (index + 1));
    }
  });

  return {
    ok: true,
    testedCases: cases.length,
    urlsPreserved: true
  };
}

function uaIsAffiliateFreeTextPlaceholder_(value) {
  const text = String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, '')
    .trim();
  return /^(?:＜|<)?自由テキスト(?:\d+)?(?:＞|>)?$/i.test(text);
}

function uaIsNaviokunHighRelevanceTopic_(rowData) {
  const text = [
    rowData && rowData.mainInput,
    rowData && rowData.readerMindMemo,
    rowData && rowData.affiliateNotes
  ].join(' ');
  if (/(トラブル\s*解決\s*ナビ|Recovery\s*and\s*Utility|富士通|FMV|Windows|復旧領域|リカバリ)/i.test(text)) {
    return false;
  }
  return /(ナビ|モニター|ディスプレイ|carplay|android\s*auto|hdmi|テレビ|\btv\b|動画|車内エンタメ|ミラーリング|オーディオ|後席モニター|後席ディスプレイ)/i.test(text);
}

function uaNormalizeAnchorRelAttributes_(value) {
  return String(value || '').replace(/<a\b[^>]*>/gi, function(tag) {
    const relPattern = /\s+rel\s*=\s*(["'])([\s\S]*?)\1/gi;
    const relValues = [];
    let match;

    while ((match = relPattern.exec(tag)) !== null) {
      String(match[2] || '').split(/\s+/).forEach(function(token) {
        const clean = String(token || '').trim().toLowerCase();
        if (clean && relValues.indexOf(clean) === -1) relValues.push(clean);
      });
    }

    if (relValues.length === 0) return tag;

    const withoutRel = tag.replace(relPattern, '');
    return withoutRel.replace(/\s*(\/?)>$/, ' rel="' + relValues.join(' ') + '"$1>');
  });
}

function uaTestNormalizeAnchorRelAttributes() {
  const cases = [
    {
      input: '<a href="https://example.com" target="_blank" rel="noopener" rel="nofollow sponsored noopener">CTA</a>',
      expected: '<a href="https://example.com" target="_blank" rel="noopener nofollow sponsored">CTA</a>'
    },
    {
      input: "<a href='https://example.com' rel='nofollow sponsored' rel='noopener'>CTA</a>",
      expected: '<a href=\'https://example.com\' rel="nofollow sponsored noopener">CTA</a>'
    },
    {
      input: '<a href="https://example.com" rel="nofollow nofollow sponsored">CTA</a>',
      expected: '<a href="https://example.com" rel="nofollow sponsored">CTA</a>'
    }
  ];

  cases.forEach(function(item, index) {
    const before = uaFindPrePublishDuplicateRelLinks_(item.input);
    const output = uaNormalizeAnchorRelAttributes_(item.input);
    const after = uaFindPrePublishDuplicateRelLinks_(output);
    if (!before.length) throw new Error('rel重複を検出できませんでした。case=' + (index + 1));
    if (output !== item.expected) throw new Error('rel統合結果が不正です。case=' + (index + 1) + ' output=' + output);
    if (after.length) throw new Error('rel統合後も重複が残っています。case=' + (index + 1));
  });

  const clean = '<a href="https://example.com" target="_blank" rel="nofollow sponsored noopener">CTA</a>';
  if (uaNormalizeAnchorRelAttributes_(clean) !== clean) {
    throw new Error('正常なrel属性を変更しました。');
  }
  if (uaFindPrePublishDuplicateRelLinks_(clean).length) {
    throw new Error('正常なrel属性を重複判定しました。');
  }

  return {
    ok: true,
    testedCases: cases.length + 1,
    normalizedExample: uaNormalizeAnchorRelAttributes_(cases[0].input)
  };
}

function uaFindManagedAffiliateCtaFallbackIndex_(body) {
  const html = String(body || '');
  const h2Regex = /<h2\b[^>]*>([\s\S]*?)<\/h2>/gi;
  let match;

  while ((match = h2Regex.exec(html)) !== null) {
    const heading = String(match[1] || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (heading.indexOf('よくある質問') !== -1 || heading.indexOf('まとめ') !== -1) {
      return match.index;
    }
  }
  return html.length;
}

function uaApplyNaviokunIntroSet_(body, rowData, appConfig) {
  let html = String(body || '');
  if (!html || !appConfig || appConfig.key !== 'drive') return html;
  const isNaviokunAffiliate = /ナビ男くん/.test(String(rowData && rowData.affiliateName || ''));
  const hadIntroSet = html.indexOf(UA_NAVIOKUN_INTRO_URL) !== -1 && /\[affi\s+id\s*=\s*7\s*\]/i.test(html);
  if (!isNaviokunAffiliate && html.indexOf('ナビ男くん') === -1 && !hadIntroSet) return html;

  html = uaRemoveNaviokunIntroSet_(html);
  let ctaBounds = isNaviokunAffiliate ? uaFindNaviokunManagedCtaBounds_(html, rowData) : null;
  if (ctaBounds) {
    html = uaEnsureNaviokunBridgeBeforeCta_(html, ctaBounds.start, rowData);
    ctaBounds = uaFindNaviokunManagedCtaBounds_(html, rowData);
    if (ctaBounds) {
      return [
        html.slice(0, ctaBounds.start).trimEnd(),
        uaBuildNaviokunIntroSetHtml_(),
        html.slice(ctaBounds.start).trimStart()
      ].filter(Boolean).join('\n\n');
    }
  }

  const insertionIndex = uaFindNaviokunIntroInsertionIndex_(html);
  const introSet = uaBuildNaviokunIntroSetHtml_();
  return [
    html.slice(0, insertionIndex).trimEnd(),
    introSet,
    html.slice(insertionIndex).trimStart()
  ].filter(Boolean).join('\n\n');
}

function uaRemoveNaviokunIntroSet_(body) {
  let html = String(body || '');
  const exactSet = uaBuildNaviokunIntroSetHtml_();
  html = html.split(exactSet).join('');

  let urlIndex = html.indexOf(UA_NAVIOKUN_INTRO_URL);
  while (urlIndex !== -1) {
    const start = html.lastIndexOf('<!-- wp:cocoon-blocks/info-box', urlIndex);
    const endMarker = '<!-- /wp:cocoon-blocks/info-box -->';
    const endStart = html.indexOf(endMarker, urlIndex);
    if (start < 0 || endStart < 0) break;
    const end = endStart + endMarker.length;
    const block = html.slice(start, end);
    if (block.indexOf('danger-box') === -1 || !/\[affi\s+id\s*=\s*7\s*\]/i.test(block)) break;
    html = html.slice(0, start) + html.slice(end);
    urlIndex = html.indexOf(UA_NAVIOKUN_INTRO_URL);
  }
  return html.replace(/\n{3,}/g, '\n\n').trim();
}

function uaFindNaviokunManagedCtaBounds_(body, rowData) {
  const html = String(body || '');
  const spec = uaGetManagedAffiliateCtaSpec_(rowData || {});
  if (!spec || !/ナビ男くん/.test(String(spec.name || ''))) return null;
  const markers = uaExtractUrlsFromAffiliateCode_(spec.content || '');
  if (spec.url && markers.indexOf(spec.url) === -1) markers.push(spec.url);
  if (spec.type === 'shortcode' && spec.content) markers.push(String(spec.content).trim());
  const regex = /<!--\s*wp:cocoon-blocks\/button-wrap-1\b[\s\S]*?<!--\s*\/wp:cocoon-blocks\/button-wrap-1\s*-->/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const block = String(match[0] || '');
    const isTarget = markers.some(function(marker) {
      return marker && (block.indexOf(marker) !== -1 || block.indexOf(String(marker).replace(/&/g, '&amp;')) !== -1);
    });
    if (isTarget) return { start: match.index, end: match.index + match[0].length, block: block };
  }
  return null;
}

function uaEnsureNaviokunBridgeBeforeCta_(body, ctaStart, rowData) {
  const html = String(body || '');
  const start = Math.max(0, Number(ctaStart || 0));
  const previousH2 = html.lastIndexOf('<h2', start);
  const contextStart = Math.max(previousH2 >= 0 ? previousH2 : 0, start - 1600);
  const precedingText = html.slice(contextStart, start)
    .replace(/<!--[^]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (/ナビ男くん/.test(precedingText)) return html;

  const bridgeText = uaIsNaviokunHighRelevanceTopic_(rowData)
    ? '純正機能で足りない部分を後付けで補いたい場合は、車内エンタメの施工を扱うナビ男くんで、対応車種や施工内容を確認できます。'
    : '購入後に変えにくい条件とは別に、ナビや映像環境など後付けで調整できる部分は、車内エンタメの施工を扱うナビ男くんで対応内容を確認できます。';
  const bridgeBlock = [
    '<!-- wp:paragraph -->',
    '<p>' + bridgeText + '</p>',
    '<!-- /wp:paragraph -->'
  ].join('\n');
  return [html.slice(0, start).trimEnd(), bridgeBlock, html.slice(start).trimStart()].filter(Boolean).join('\n\n');
}

function uaFindNaviokunIntroInsertionIndex_(body) {
  const html = String(body || '');
  let bestStart = -1;
  let bestInsertionIndex = -1;
  const blockPatterns = [
    /<!--\s*wp:paragraph\b[^>]*-->[\s\S]*?<!--\s*\/wp:paragraph\s*-->/gi,
    /<!--\s*wp:heading\b[^>]*-->[\s\S]*?<!--\s*\/wp:heading\s*-->/gi
  ];

  for (let i = 0; i < blockPatterns.length; i += 1) {
    const regex = blockPatterns[i];
    let match;
    while ((match = regex.exec(html)) !== null) {
      if (String(match[0] || '').indexOf('ナビ男くん') !== -1) {
        if (bestStart === -1 || match.index < bestStart) {
          bestStart = match.index;
          bestInsertionIndex = match.index + match[0].length;
        }
        break;
      }
    }
  }

  if (bestInsertionIndex !== -1) return bestInsertionIndex;

  const rawParagraphRegex = /<p\b[^>]*>[\s\S]*?<\/p>/gi;
  let rawParagraphMatch;
  while ((rawParagraphMatch = rawParagraphRegex.exec(html)) !== null) {
    if (String(rawParagraphMatch[0] || '').indexOf('ナビ男くん') !== -1) {
      return rawParagraphMatch.index + rawParagraphMatch[0].length;
    }
  }

  const fallbackHeading = /<!--\s*wp:heading\b[^>]*-->\s*<h2\b[^>]*>[\s\S]*?(?:よくある質問|まとめ)[\s\S]*?<\/h2>\s*<!--\s*\/wp:heading\s*-->/i.exec(html);
  return fallbackHeading ? fallbackHeading.index : html.length;
}

function uaBuildNaviokunIntroSetHtml_() {
  return [
    '<!-- wp:cocoon-blocks/info-box {"style":"danger-box"} -->',
    '<div class="wp-block-cocoon-blocks-info-box block-box danger-box"><!-- wp:paragraph -->',
    '<p><strong><span class="marker">ナビ男くんとは車内エンタメのアップグレードを得意とする専門店です。</span></strong></p>',
    '<!-- /wp:paragraph -->',
    '',
    '<!-- wp:cocoon-blocks/blogcard {"style":"blogcard-type bct-detail"} -->',
    '<div class="wp-block-cocoon-blocks-blogcard blogcard-type bct-detail">',
    '<a href="' + UA_NAVIOKUN_INTRO_URL + '">' + UA_NAVIOKUN_INTRO_URL + '</a>',
    '</div>',
    '<!-- /wp:cocoon-blocks/blogcard -->',
    '',
    '<!-- wp:paragraph -->',
    '<p>[affi id=7]</p>',
    '<!-- /wp:paragraph --></div>',
    '<!-- /wp:cocoon-blocks/info-box -->'
  ].join('\n');
}

function uaFindFaqSectionBounds_(body) {
  const html = String(body || '');
  const h2Regex = /<h2\b[^>]*>([\s\S]*?)<\/h2>/gi;
  let match;
  let faqStart = -1;

  while ((match = h2Regex.exec(html)) !== null) {
    const headingText = String(match[1] || '')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (headingText.indexOf('よくある質問') !== -1 || /^FAQ(?:\s|$|[：:（(])/i.test(headingText)) {
      faqStart = h2Regex.lastIndex;
      break;
    }
  }

  if (faqStart < 0) return null;

  h2Regex.lastIndex = faqStart;
  const nextH2 = h2Regex.exec(html);
  return {
    start: faqStart,
    end: nextH2 ? nextH2.index : html.length
  };
}

function uaNormalizeFaqHeadingLevels_(body) {
  const html = String(body || '');
  const bounds = uaFindFaqSectionBounds_(html);
  if (!bounds) return html;

  const section = html.slice(bounds.start, bounds.end)
    .replace(/<!--\s*wp:heading\b[\s\S]*?-->/gi, function(comment) {
      return comment.replace(/("level"\s*:\s*)4\b/g, function(_, prefix) {
        return prefix + '3';
      });
    })
    .replace(/<h4\b([^>]*)>([\s\S]*?)<\/h4>/gi, '<h3$1>$2</h3>');

  return html.slice(0, bounds.start) + section + html.slice(bounds.end);
}

function uaApplyYmylNotice_(body, rowData, appConfig) {
  const html = String(body || '').trim();
  if (!html || uaHasYmylNotice_(html)) return html;

  const spec = uaBuildYmylNoticeSpec_(rowData || {}, appConfig, html);
  if (!spec) return html;

  const notice = uaBuildYmylNoticeHtml_(spec);
  const insertionIndex = uaFindYmylNoticeInsertionIndex_(html, spec.category);
  return [
    html.slice(0, insertionIndex).trimEnd(),
    notice,
    html.slice(insertionIndex).trimStart()
  ].filter(Boolean).join('\n\n');
}

function uaBuildYmylNoticeSpec_(rowData, appConfig, body) {
  const notes = String(rowData && rowData.affiliateNotes || '');
  if (notes.indexOf('YMYL注意書きなし') !== -1) return null;

  const detectionText = uaBuildYmylDetectionText_(rowData, body);
  const category = uaDetectYmylCategory_(detectionText, appConfig);
  if (!category && notes.indexOf('YMYL注意書きあり') === -1) return null;

  const resolvedCategory = category || uaDefaultYmylCategory_(appConfig);
  const source = uaPickYmylNoticeSource_(rowData, appConfig, resolvedCategory, detectionText, body);
  return {
    category: resolvedCategory,
    topic: String(rowData && rowData.mainInput || uaPickWpTitle_(rowData && rowData.titleIdeas || '') || 'この記事のテーマ').trim(),
    sourceUrl: source && source.url || '',
    sourceLabel: source && source.label || ''
  };
}

function uaBuildYmylDetectionText_(rowData, body) {
  const headings = [];
  const regex = /<h2\b[^>]*>([\s\S]*?)<\/h2>/gi;
  let match;
  while ((match = regex.exec(String(body || ''))) !== null) {
    headings.push(uaPlainYmylText_(match[1]));
  }
  return [
    rowData && rowData.mainInput,
    rowData && rowData.titleIdeas,
    headings.join(' ')
  ].map(function(value) {
    return String(value || '').trim();
  }).filter(Boolean).join(' ');
}

function uaDetectYmylCategory_(text, appConfig) {
  const value = String(text || '');
  const strongHealthTerms = /(病気|服薬|薬の|医療|妊娠|アレルギー|感染症|健康被害|医師|薬剤師|病院|クリニック)/i;
  const contextualHealthTerms = /(症状|治療|診断)/i;
  const bodyHealthContext = /(身体|体調|痛み|発熱|皮膚|呼吸|血圧|血糖|吐き気|めまい|けが|怪我|患者)/i;
  if (strongHealthTerms.test(value) || (contextualHealthTerms.test(value) && bodyHealthContext.test(value))) {
    return 'health';
  }
  if (/(住宅ローン|自動車ローン|ローン|借入|金利|任意保険|自動車保険|車両保険|生命保険|税金|税制|補助金|投資|資産運用|相続)/i.test(value)) {
    return 'finance';
  }
  if (/(法律相談|法的責任|弁護士|訴訟|損害賠償|契約解除|クーリングオフ|消費者契約|相続放棄)/i.test(value)) {
    return 'legal';
  }
  if (/(電気工事|電気配線|分電盤|感電|ガス工事|ガス漏れ|給湯器|火災|アスベスト|耐震|構造耐力|防水工事|雨漏り|屋根工事|高所作業|農薬|薬剤散布|害虫駆除)/i.test(value)) {
    return 'home_safety';
  }
  if (/(道路交通法|道路運送車両法|保安基準|車検適合|違法改造|道路規制|運転免許|灯火類|ナンバープレート)/i.test(value)) {
    return 'vehicle_law';
  }
  if (/(E[-‐‑–—\s]?Four|4WD|AWD|四輪駆動|雪道|凍結路|アイスバーン|スタッドレス|タイヤチェーン|タイヤ交換|ブレーキ|運転支援|自動ブレーキ|衝突被害軽減|牽引|冠水|事故|走行可否|安全性|チャイルドシート|ジャッキアップ|バッテリー交換)/i.test(value)) {
    return 'vehicle_safety';
  }
  return null;
}

function uaDefaultYmylCategory_(appConfig) {
  const key = String(appConfig && appConfig.key || '').toLowerCase();
  if (key === 'drive') return 'vehicle_safety';
  if (key === 'home') return 'home_safety';
  return 'general_safety';
}

function uaPickYmylNoticeSource_(rowData, appConfig, category, detectionText, body) {
  let candidates = [];
  try {
    candidates = uaGetExternalSourceCandidates_(rowData && rowData.mainInput || '', appConfig) || [];
  } catch (e) {
    candidates = [];
  }
  candidates = uaExtractYmylBodySourceCandidates_(body, rowData, appConfig).concat(candidates);

  const mainInput = String(rowData && rowData.mainInput || '').trim();
  const inputParts = mainInput.split(/[\s　]+/).filter(function(part) { return part.length >= 2; });
  const categoryTerms = uaGetYmylCategoryTerms_(category);
  let best = null;

  candidates.forEach(function(item) {
    const url = String(item && item.url || '').trim();
    if (!/^https:\/\//i.test(url)) return;
    const sourceText = [item.name, item.genre, item.usage, item.keywords].join(' ');
    let relevanceScore = 0;
    inputParts.forEach(function(part) {
      if (sourceText.indexOf(part) !== -1) relevanceScore += 4;
    });
    categoryTerms.forEach(function(term) {
      if (sourceText.indexOf(term) !== -1) relevanceScore += 2;
    });
    if (relevanceScore < 2) return;
    let contextScore = relevanceScore;
    if (/公式|公的|省|庁|警察|自治体|機構|協会|取扱説明書|メーカー/i.test(sourceText) || /\.go\.jp(?:\/|$)/i.test(url)) {
      contextScore += 2;
    }
    contextScore += Math.min(4, Number(item.score || 0));
    if (contextScore < 3) return;
    if (!best || contextScore > best.score) {
      best = {
        url: url,
        label: String(item.name || '公式情報').trim(),
        score: contextScore
      };
    }
  });

  if (best) return best;

  if (/E[-‐‑–—\s]?Four/i.test(String(detectionText || ''))) {
    return {
      url: 'https://toyota.jp/ownersmanual/index.html',
      label: 'トヨタ公式の取扱説明書',
      score: 1
    };
  }

  return null;
}

function uaExtractYmylBodySourceCandidates_(body, rowData, appConfig) {
  const affiliateUrl = uaNormalizeYmylUrl_(rowData && rowData.affiliateUrl || '');
  const competitorUrls = [
    rowData && rowData.competitorUrl1,
    rowData && rowData.competitorUrl2,
    rowData && rowData.competitorUrl3
  ].map(uaNormalizeYmylUrl_).filter(Boolean);
  const siteHost = uaGetYmylSiteHost_(rowData, appConfig);
  const html = String(body || '').replace(
    /<!--\s*wp:cocoon-blocks\/blogcard\b[\s\S]*?<!--\s*\/wp:cocoon-blocks\/blogcard\s*-->/gi,
    ''
  );
  const result = [];
  const regex = /<a\b([^>]*)\bhref=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const attributes = String(match[1] || '') + ' ' + String(match[3] || '');
    const url = uaNormalizeYmylUrl_(match[2]);
    if (!/^https:\/\//i.test(url)) continue;
    if (affiliateUrl && url === affiliateUrl) continue;
    if (competitorUrls.indexOf(url) !== -1) continue;
    if (/\brel=["'][^"']*\b(?:sponsored|affiliate)\b/i.test(attributes)) continue;
    if (siteHost && uaExtractYmylHost_(url) === siteHost) continue;

    const label = uaPlainYmylText_(match[4]) || '公式情報';
    const contextStart = Math.max(0, match.index - 240);
    const contextEnd = Math.min(html.length, regex.lastIndex + 240);
    const context = uaPlainYmylText_(html.slice(contextStart, contextEnd));
    const trustText = label + ' ' + context;
    if (!(/公式|公的|省|庁|警察|自治体|機構|協会|取扱説明書|メーカー|JAF/i.test(trustText) || /\.go\.jp(?:\/|$)/i.test(url))) {
      continue;
    }
    result.push({
      name: label,
      url: url,
      genre: '本文内の公式・公的リンク',
      usage: context,
      keywords: context,
      score: 8
    });
  }
  return result;
}

function uaGetYmylSiteHost_(rowData, appConfig) {
  const editHost = uaExtractYmylHost_(rowData && rowData.wpEditUrl || '');
  if (editHost) return editHost;
  try {
    const wpConfig = appConfig ? uaGetWpConfig_(appConfig) : null;
    return uaExtractYmylHost_(wpConfig && wpConfig.siteUrl || '');
  } catch (e) {
    return '';
  }
}

function uaExtractYmylHost_(url) {
  const match = String(url || '').match(/^https?:\/\/([^\/:?#]+)/i);
  return match ? String(match[1] || '').toLowerCase().replace(/^www\./, '') : '';
}

function uaNormalizeYmylUrl_(value) {
  return String(value || '')
    .trim()
    .replace(/&amp;/g, '&')
    .replace(/\/$/, '');
}

function uaGetYmylCategoryTerms_(category) {
  const terms = {
    vehicle_safety: ['安全', '走行', '雪道', 'タイヤ', '取扱説明書', '車種', '年式', '道路'],
    vehicle_law: ['法令', '車検', '保安基準', '道路', '警察', '国土交通省'],
    home_safety: ['安全', '施工', '電気', 'ガス', '火災', '建物', '資格'],
    finance: ['金融', '保険', '税', '補助金', '制度', '契約'],
    legal: ['法律', '法令', '契約', '消費者', '裁判', '弁護士', '公的'],
    health: ['医療', '健康', '治療', '薬', '厚生労働省'],
    general_safety: ['安全', '法令', '公式', '公的']
  };
  return terms[category] || terms.general_safety;
}

function uaBuildYmylNoticeHtml_(spec) {
  const topic = uaEscapeHtml_(spec && spec.topic || 'この記事のテーマ');
  const reference = uaBuildYmylReferenceHtml_(spec);
  let text;

  if (spec.category === 'health') {
    text = 'この記事は、' + topic + 'に関する一般的な情報であり、診断や治療の代わりになるものではありません。症状、体質、服薬状況によって適切な対応は変わります。判断に迷う場合は、' + reference + '、医師・薬剤師などの専門家へ確認してください。';
  } else if (spec.category === 'legal') {
    text = 'この記事は、' + topic + 'に関する一般的な情報であり、個別の法律相談に代わるものではありません。適用される法令や手続きは、契約内容、地域、時期、個別事情で変わります。重要な判断の前には、' + reference + '、弁護士・司法書士・所管機関などの専門家へ確認してください。';
  } else if (spec.category === 'finance') {
    text = 'この記事は、' + topic + 'の判断材料を整理する一般的な情報です。費用、税制、保険、補助制度、契約条件は、時期・地域・申込条件・個別の状況で変わります。契約や申請の前には、' + reference + '、金融機関・保険会社・自治体などの最新情報を確認してください。';
  } else if (spec.category === 'home_safety') {
    text = 'この記事は、' + topic + 'の考え方を整理する一般的な情報です。実際の施工可否や安全性は、建物・設備の状態、使用製品、施工方法、地域の規制で変わります。作業や契約の前には、' + reference + '、有資格者・施工会社・関係機関の最新情報を確認してください。';
  } else if (spec.category === 'vehicle_law') {
    text = 'この記事は、' + topic + 'に関する法規・安全面の一般的な情報です。実際の適法性や車検適合性は、車種・年式・部品仕様・取付方法・法令改正で変わります。購入・取付・走行前には、' + reference + '、販売店・整備事業者・所管機関の最新情報を確認してください。';
  } else {
    text = 'この記事は、' + topic + 'について判断材料を整理する一般的な情報です。実際の走行可否や安全性は、車種・年式・装備の状態・路面状況・道路規制で変わります。購入・走行・作業前には、' + reference + '、販売店・整備事業者・道路管理者の最新情報を確認してください。';
  }

  return [
    '<!-- wp:cocoon-blocks/info-box {"style":"danger-box"} -->',
    '<div class="wp-block-cocoon-blocks-info-box block-box danger-box"><!-- wp:paragraph -->',
    '<p><strong>注意：</strong>' + text + '</p>',
    '<!-- /wp:paragraph --></div>',
    '<!-- /wp:cocoon-blocks/info-box -->'
  ].join('\n');
}

function uaBuildYmylReferenceHtml_(spec) {
  const url = String(spec && spec.sourceUrl || '').trim();
  const label = String(spec && spec.sourceLabel || '').trim();
  if (url && label) {
    return '<a href="' + uaEscapeHtml_(url) + '" target="_blank" rel="noopener">' + uaEscapeHtml_(label) + '</a>';
  }
  if (spec.category === 'health') return '公的機関の公式情報';
  if (spec.category === 'legal') return '公的機関の公式情報';
  if (spec.category === 'finance') return '公的機関・事業者の公式情報';
  if (spec.category === 'home_safety') return 'メーカー・公的機関の公式情報';
  return 'メーカーの取扱説明書・公的機関の公式情報';
}

function uaFindYmylNoticeInsertionIndex_(body, category) {
  const html = String(body || '');
  const headingPattern = uaGetYmylHeadingPattern_(category);
  const h2Regex = /<h2\b[^>]*>([\s\S]*?)<\/h2>/gi;
  let match;
  while ((match = h2Regex.exec(html)) !== null) {
    if (headingPattern.test(uaPlainYmylText_(match[1]))) return match.index;
  }

  const pointsClose = /<!--\s*\/wp:cocoon-blocks\/tab-caption-box-1\s*-->/i.exec(html);
  if (pointsClose) return pointsClose.index + pointsClose[0].length;

  const firstH2 = /<h2\b/i.exec(html);
  if (firstH2) return firstH2.index;

  const firstParagraph = /<\/p>/i.exec(html);
  return firstParagraph ? firstParagraph.index + firstParagraph[0].length : 0;
}

function uaGetYmylHeadingPattern_(category) {
  if (category === 'health') return /(注意|症状|治療|薬|医療|受診|リスク)/i;
  if (category === 'legal') return /(法律|法令|契約|手続き|責任|注意|リスク)/i;
  if (category === 'finance') return /(費用|税|保険|補助金|契約|金利|注意|リスク)/i;
  if (category === 'home_safety') return /(安全|注意|施工|資格|電気|ガス|火災|規制|リスク)/i;
  if (category === 'vehicle_law') return /(法規|車検|保安基準|違法|規制|注意|安全)/i;
  return /(安全|注意|雪道|凍結|タイヤ|ブレーキ|走行|規制|事故|リスク)/i;
}

function uaHasYmylNotice_(body) {
  const text = String(body || '');
  return text.indexOf('wp:cocoon-blocks/info-box') !== -1 &&
    text.indexOf('danger-box') !== -1 &&
    /<strong>\s*注意[：:]\s*<\/strong>/i.test(text) &&
    /(一般的な情報|最新情報を確認|専門家へ確認)/.test(text);
}

function uaGetYmylNoticeSourceUrls_(rowData, appConfig, body) {
  const spec = uaBuildYmylNoticeSpec_(rowData || {}, appConfig, body || rowData && rowData.body || '');
  return spec && spec.sourceUrl ? [spec.sourceUrl] : [];
}

function uaPlainYmylText_(html) {
  return String(html || '')
    .replace(/<!--([\s\S]*?)-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function uaAddRakutenBannerToActiveRow() {
  const result = uaAddRakutenBannerToActiveRow_();
  SpreadsheetApp.getUi().alert(result.message);
}

function uaAddRakutenBannerFromPanel(data) {
  uaSaveActiveRowData(data || {});
  return uaAddRakutenBannerForData_(data || {});
}

function uaAddRakutenBannerFromWeb(data) {
  uaSaveActiveRowData(data || {});
  return uaAddRakutenBannerForData_(data || {});
}

function uaAddRakutenBannerToActiveRow_() {
  return uaAddRakutenBannerForContext_(uaGetRakutenActiveRowContext_());
}

function uaAddRakutenBannerForData_(data) {
  const sheet = uaGetSheetForData_(data || {});
  const row = Number(data && data.row) || sheet.getActiveCell().getRow();
  return uaAddRakutenBannerForContext_(uaGetRakutenRowContext_(sheet, row));
}

function uaAddRakutenBannerForContext_(context) {
  if (!context.body) {
    throw new Error('本文が空です。先に本文を生成してください。');
  }

  let sourceBody = context.body;
  let replacedExisting = false;
  if (uaHasRakutenBanner_(context.body)) {
    sourceBody = uaRemoveGeneratedRakutenBanner_(context.body);
    replacedExisting = sourceBody !== context.body;
    if (!replacedExisting) {
      throw new Error('本文内に手動追加された楽天リンクがあります。自動判定では安全に置き換えられないため停止しました。');
    }
  }

  UA_LAST_RAKUTEN_STATUS = '';

  if (!uaShouldInsertRakutenAffiliateBanner_(sourceBody, context.rowData, context.appConfig)) {
    const reason = UA_LAST_RAKUTEN_STATUS || '楽天バナー挿入対象外です。';
    uaAppendFactCheckPoint_(context.sheet, context.row, '・楽天バナー後入れ未実行｜' + reason);
    return {
      message: '楽天バナーは追加しませんでした。\n理由: ' + reason
    };
  }

  const block = uaBuildRakutenFollowupBlock_(sourceBody, context.rowData, context.appConfig);

  if (!block) {
    const reason = UA_LAST_RAKUTEN_STATUS || '楽天バナーを作成できませんでした。';
    uaAppendFactCheckPoint_(context.sheet, context.row, '・楽天バナー後入れ失敗｜' + reason);
    return {
      message: '楽天バナーを追加できませんでした。\n理由: ' + reason
    };
  }

  const nextBody = uaInsertRakutenBlockIntoBody_(sourceBody, block, context.rowData, context.appConfig);
  context.sheet.getRange(context.row, UA_COLUMNS.body).setValue(nextBody);
  uaAppendFactCheckPoint_(context.sheet, context.row, replacedExisting
    ? '・楽天バナー再選定｜既存の自動生成バナーを削除し、現在のキーワードで置換済み'
    : '・楽天バナー後入れ｜既存本文に小リライトとして追加済み');

  const nextData = uaBuildRowData_(context.sheet, context.row);
  nextData.message = replacedExisting
    ? '楽天バナーを現在のキーワードで再選定して置き換えました。本文生成APIは使っていません。'
    : '楽天バナーを本文へ追加しました。本文生成APIは使っていません。';
  return nextData;
}

function uaRefreshRakutenBannerForArticleRow_(appConfig, row) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(appConfig.articleSheetName);
  if (!sheet) {
    throw new Error('記事管理シートが見つかりません: ' + appConfig.articleSheetName);
  }

  const context = uaGetRakutenRowContext_(sheet, row);
  const sourceBody = uaRemoveGeneratedRakutenBanner_(context.body);
  if (sourceBody === context.body && uaHasRakutenBanner_(context.body)) {
    throw new Error('手動追加された楽天リンクは自動更新できません。');
  }

  const nextBody = uaApplyRakutenAffiliateBanner_(sourceBody, context.rowData, context.appConfig);
  if (!uaHasRakutenBanner_(nextBody)) {
    throw new Error('楽天バナーを再生成できませんでした: ' + (UA_LAST_RAKUTEN_STATUS || '原因不明'));
  }
  sheet.getRange(row, UA_COLUMNS.body).setValue(nextBody);
  uaAppendFactCheckPoint_(sheet, row, '・楽天バナー再選定｜既存の自動生成バナーを削除し、現在の主役商品で置換済み');
  const refreshed = uaBuildRowData_(sheet, row);
  const postId = Number(refreshed.wpPostId || 0);

  if (postId > 0) {
    const wpConfig = uaGetWpConfig_(appConfig);
    uaCallWordPressApi_(
      wpConfig,
      '/wp-json/wp/v2/posts/' + encodeURIComponent(postId),
      'post',
      { content: refreshed.body }
    );
  }

  return {
    ok: true,
    row: row,
    postId: postId,
    message: '楽天バナーを現在の主役商品で再選定し、シートとWordPressへ反映しました。'
  };
}

function uaRefreshTakumiSunshadeRakutenBanner() {
  return uaRefreshRakutenBannerForArticleRow_(UA_APP_TYPES.home, 14);
}

function uaGetRakutenActiveRowContext_() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const row = sheet.getActiveCell().getRow();
  return uaGetRakutenRowContext_(sheet, row);
}

function uaGetRakutenRowContext_(sheet, row) {
  if (row === 1) {
    throw new Error('記事データの行を選択してください。1行目は見出しです。');
  }

  const rowData = uaBuildRowData_(sheet, row);
  const appConfig = uaGetAppConfigByLabel_(rowData.appType);

  if (!appConfig) {
    throw new Error('記事タイプを取得できません。A列で DRIVE BASE、たくみパパ、汎用記事 のいずれかを選んでください。');
  }

  if (appConfig.key === 'general') {
    throw new Error('汎用記事では楽天バナー自動挿入は使いません。');
  }

  return {
    sheet: sheet,
    row: row,
    rowData: rowData,
    appConfig: appConfig,
    body: String(rowData.body || '')
  };
}

function uaBuildRakutenFollowupBlock_(body, rowData, appConfig) {
  const query = uaSelectRakutenProductQuery_(body, rowData, appConfig);

  if (!query) {
    UA_LAST_RAKUTEN_STATUS = '商品検索キーワードを選定できませんでした。';
    return '';
  }

  const banner = uaBuildRakutenAffiliateBanner_(body, rowData, appConfig);

  if (!banner) {
    return '';
  }

  return [
    '<h2>関連アイテムも選択肢に入れる</h2>',
    '<p>本文の対策を読んで「実際に何を用意すればいいか」まで考えたい場合は、関連アイテムを見比べておくと判断しやすくなります。</p>',
    banner
  ].join('\n');
}

function uaInsertRakutenBlockIntoBody_(body, block, rowData, appConfig) {
  const contextualIndex = uaFindRakutenContextualInsertIndex_(body, rowData, appConfig);

  if (contextualIndex > 0) {
    return body.slice(0, contextualIndex).trim() + '\n\n' + block + '\n\n' + body.slice(contextualIndex).trim();
  }

  const faqIndex = body.search(/<h2[^>]*>\s*よくある質問\s*<\/h2>/i);

  if (faqIndex > -1) {
    return body.slice(0, faqIndex) + block + '\n\n' + body.slice(faqIndex);
  }

  const summaryIndex = body.search(/<h2[^>]*>[\s\S]*?まとめ[\s\S]*?<\/h2>/i);

  if (summaryIndex > -1) {
    return body.slice(0, summaryIndex) + block + '\n\n' + body.slice(summaryIndex);
  }

  return body + '\n\n' + block;
}

function uaFindRakutenContextualInsertIndex_(body, rowData, appConfig) {
  const text = String(body || '');
  const query = uaSelectRakutenProductQuery_(text, rowData, appConfig);
  const sections = uaExtractRakutenH2Sections_(text);
  const terms = uaBuildRakutenInsertTerms_(query);
  let best = null;

  if (!query || sections.length === 0 || terms.length === 0) {
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

function uaExtractRakutenH2Sections_(body) {
  const text = String(body || '');
  const matches = [];
  const pattern = /<h2[^>]*>[\s\S]*?<\/h2>/gi;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    matches.push({
      startIndex: match.index,
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

function uaBuildRakutenInsertTerms_(query) {
  const terms = [];

  function add(term) {
    term = uaNormalizeForScore_(term);
    if (term && term.length >= 2 && terms.indexOf(term) === -1) {
      terms.push(term);
    }
  }

  String(query || '')
    .split(/\s+/)
    .forEach(add);

  return terms.slice(0, 20);
}

function uaHasRakutenBanner_(body) {
  const text = String(body || '');
  return text.indexOf('openapi.rakuten') !== -1 ||
    text.indexOf('hb.afl.rakuten') !== -1 ||
    text.indexOf('rakuten.co.jp') !== -1 ||
    text.indexOf('rel=\'nofollow sponsored\'') !== -1 && text.indexOf('楽天') !== -1;
}

function uaRemoveGeneratedRakutenBanner_(body) {
  return String(body || '').replace(
    /(?:<h2[^>]*>\s*関連アイテムも選択肢に入れる\s*<\/h2>\s*<p>本文の対策を読んで[\s\S]*?<\/p>\s*)?<p>本文の対策を実際に試すための商品候補[\s\S]*?<!-- \/wp:html -->\s*/gi,
    ''
  ).trim();
}

function uaAppendFactCheckPoint_(sheet, row, line) {
  const current = String(sheet.getRange(row, UA_COLUMNS.factCheckPoints).getValue() || '').trim();
  const next = !current || current === '特になし'
    ? line
    : current + '\n' + line;

  uaSetFactCheckPointsWithLinks_(sheet, row, next);
}

function uaAppendRakutenStatusToFactCheck_(factCheckPoints) {
  const status = String(UA_LAST_RAKUTEN_STATUS || '').trim();
  const value = String(factCheckPoints || '').trim();

  if (!status || status === '挿入済み') {
    return value || '特になし';
  }

  if (!value || value === '特になし') {
    return '・楽天バナー未挿入｜' + status;
  }

  return value + '\n・楽天バナー未挿入｜' + status;
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
  UA_LAST_RAKUTEN_STATUS = '';

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

  UA_LAST_RAKUTEN_STATUS = '挿入済み';

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
    UA_LAST_RAKUTEN_STATUS = '商品検索キーワードを選定できませんでした';
    return '';
  }

  const categoryQueries = uaSelectRakutenCategoryQueries_(body, rowData, appConfig, query);
  const selectionSeed = String(rowData && rowData.mainInput || '') + '|' + String(query || '');
  const hasMainAffiliate = uaHasMainAffiliateProject_(rowData);
  let items = [];

  if (!hasMainAffiliate) {
    const keywordAndContextQueries = [query].concat(categoryQueries).filter(function(value, index, values) {
      return value && values.indexOf(value) === index;
    }).slice(0, 3);
    items = uaFetchRakutenItemsByQueries_(keywordAndContextQueries, Math.min(3, keywordAndContextQueries.length), selectionSeed);
  } else if (categoryQueries.length > 0) {
    items = uaFetchRakutenItemsByQueries_(categoryQueries, Math.min(3, categoryQueries.length), selectionSeed);
  }

  if (items.length === 0) {
    const desiredCount = uaDecideRakutenItemCount_(body, rowData, appConfig, query);
    items = uaFetchRakutenItems_(query, desiredCount, selectionSeed);
  }

  if (items.length > 0) {
    const bannerLabel = categoryQueries.length >= 2 ? '' : query;
    return uaBuildRakutenItemBannerHtml_(items, bannerLabel);
  }

  const fallbackHtml = String(PropertiesService.getScriptProperties().getProperty('UA_RAKUTEN_AFFILIATE_BANNER_HTML') || '').trim();

  if (!fallbackHtml) {
    if (!UA_LAST_RAKUTEN_STATUS) {
      UA_LAST_RAKUTEN_STATUS = '楽天APIで商品を取得できず、固定バナーfallbackも未設定です。検索キーワード: ' + query;
    }
    return '';
  }

  return [
    '<p>本文の対策を実際に試すための商品候補を見比べたい場合は、下の楽天バナーから関連アイテムの価格や種類を確認できます。</p>',
    uaNormalizeRakutenAffiliateBanner_(fallbackHtml)
  ].join('\n');
}

function uaSelectRakutenProductQuery_(body, rowData, appConfig) {
  const notes = String(rowData && rowData.affiliateNotes || '');
  const override = notes.match(/楽天商品(?:キーワード|KW)[:：]\s*([^\n\r]+)/);

  if (override && override[1]) {
    return override[1].trim();
  }

  if (!uaHasMainAffiliateProject_(rowData)) {
    const keywordQuery = uaSelectRakutenKeywordFallbackQuery_(rowData && rowData.mainInput, appConfig && appConfig.key);
    if (keywordQuery) return keywordQuery;
  }

  const text = [
    rowData && rowData.mainInput,
    rowData && rowData.readerMindMemo,
    body
  ].join(' ');
  const prioritizedQueries = uaPrioritizedRakutenQueriesFromBody_(text, appConfig && appConfig.key);

  if (prioritizedQueries.length > 0) {
    return prioritizedQueries[0];
  }

  const candidates = appConfig && appConfig.key === 'home'
    ? uaHomeRakutenProductCandidates_()
    : uaDriveRakutenProductCandidates_();
  let best = null;

  candidates.forEach(function(candidate) {
    const score = candidate.keywords.reduce(function(total, keyword) {
      return total + (uaRakutenTextContains_(text, keyword) ? 1 : 0);
    }, 0);
    const minScore = Number(candidate.minScore) || 1;

    if (score >= minScore && (!best || score > best.score)) {
      best = {
        query: candidate.query,
        score: score
      };
    }
  });

  return best ? best.query : '';
}

function uaHasMainAffiliateProject_(rowData) {
  if (uaIsNoAffiliateName_(rowData && rowData.affiliateName)) return false;
  return !!uaNormalizeAffiliateName_(rowData && rowData.affiliateName) ||
    !!String(rowData && rowData.affiliateUrl || '').trim();
}

function uaSelectRakutenKeywordFallbackQuery_(keyword, appKey) {
  const value = String(keyword || '').replace(/\s+/g, ' ').trim();
  if (!value) return '';

  const productPattern = appKey === 'home'
    ? /(サンシェード|日よけ|収納|チェスト|棚|ラック|マット|カーテン|照明|ライト|カメラ|エアコン|除湿機|サーキュレーター|物干し|掃除|ブラシ|防災|ゲート|スロープ|家電|家具)/
    : /(ブレーキパッド|カーナビ|ナビゲーション|アンドロイドナビ|ディスプレイオーディオ|ドラレコ|ドライブレコーダー|レーダー探知機|バックカメラ|モニター|HDMI|USB|スピーカー|スマホホルダー|サンシェード|フロアマット|シートマット|シートカバー|シートクッション|収納|ドリンクホルダー|ルーフキャリア|ポータブル電源|ジャンプスターター|バッテリー|タイヤ|ホイール|タイヤチェーン|洗車|クリーナー|コーティング|ワックス|カー用品|車中泊)/i;

  if (!productPattern.test(value)) return '';

  const canonicalQueries = appKey === 'home'
    ? [
      { pattern: /サンシェード|日よけ/, query: 'サンシェード ベランダ 日よけ' },
      { pattern: /ランドリー.*(?:収納|チェスト)|(?:収納|チェスト).*ランドリー/, query: 'ランドリーチェスト 防カビ' },
      { pattern: /除湿機|除湿器/, query: '除湿機 コンパクト' },
      { pattern: /サーキュレーター|部屋干し/, query: 'サーキュレーター 部屋干し' },
      { pattern: /センサーライト/, query: 'センサーライト 屋外' },
      { pattern: /見守り.*カメラ|カメラ.*見守り/, query: '見守りカメラ 家庭用' },
      { pattern: /ベビーゲート/, query: 'ベビーゲート 階段' },
      { pattern: /防災/, query: '防災用品 セット 家庭用' }
    ]
    : [
      { pattern: /ブレーキパッド/, query: 'ブレーキパッド 車種適合' },
      { pattern: /カーナビ|ナビゲーション|アンドロイドナビ/, query: 'カーナビ 車種適合' },
      { pattern: /ディスプレイオーディオ/, query: 'ディスプレイオーディオ 車種適合' },
      { pattern: /ドライブレコーダー|ドラレコ/, query: 'ドライブレコーダー 前後' },
      { pattern: /バックカメラ/, query: 'バックカメラ 車種適合' },
      { pattern: /スマホホルダー/, query: 'スマホホルダー 車' },
      { pattern: /フロアマット|シートマット/, query: 'フロアマット 車種適合' },
      { pattern: /ポータブル電源/, query: 'ポータブル電源 車中泊' },
      { pattern: /ジャンプスターター/, query: 'ジャンプスターター 車 バッテリー' },
      { pattern: /タイヤチェーン/, query: 'タイヤチェーン 車種適合' }
    ];
  const canonical = canonicalQueries.find(function(item) { return item.pattern.test(value); });
  if (canonical) return canonical.query;

  const cleaned = value
    .replace(/どこが安い|どこで買う|どこに売ってる|おすすめ|ランキング|比較|口コミ|評判|後悔|デメリット|メリット|費用|工賃|価格|値段|交換/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length >= 2 ? cleaned : '';
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

  uaPrioritizedRakutenQueriesFromBody_(text, appConfig.key).forEach(addSuggestion);
  uaContextualRakutenQueries_(text, appConfig.key).forEach(addSuggestion);

  candidates
    .map(function(candidate) {
      const score = candidate.keywords.reduce(function(total, keyword) {
        return total + (uaRakutenTextContains_(text, keyword) ? 1 : 0);
      }, 0);

      return {
        query: candidate.query,
        score: score,
        minScore: Number(candidate.minScore) || 1
      };
    })
    .filter(function(item) {
      return item.score >= item.minScore;
    })
    .sort(function(a, b) {
      return b.score - a.score;
    })
    .forEach(function(item) {
      addSuggestion(item.query);
    });

  addSuggestion(uaSelectRakutenKeywordFallbackQuery_(data && data.mainInput, appConfig.key));

  return {
    suggestions: suggestions.slice(0, 5),
    message: suggestions.length > 0
      ? '商品検索キーワード候補を取得しました。'
      : '候補を取得できませんでした。案件注意点に「楽天商品キーワード: ...」で手動指定してください。'
  };
}

function uaPrioritizedRakutenQueriesFromBody_(text, appKey) {
  const value = String(text || '');
  const result = [];
  const seen = {};

  function add(query) {
    query = String(query || '').replace(/\s+/g, ' ').trim();
    if (!query || seen[query]) return;
    seen[query] = true;
    result.push(query);
  }

  if (appKey === 'drive') {
    [
      { query: 'ディテールブラシ 車 洗車', words: ['ディテールブラシ', '細かい部分に使えるブラシ', '隙間の砂'] },
      { query: 'クイックディテーラー 車', words: ['クイックディテーラー', '軽い汚れの時短'] },
      { query: 'マイクロファイバークロス 車 洗車', words: ['マイクロファイバークロス', '薄手のクロス', '厚手のクロス', '拭き上げクロス'] },
      { query: 'カーシャンプー 車 洗車', words: ['カーシャンプー', '泡洗車'] },
      { query: '水垢取り 車', words: ['水垢取り', '水垢を減らす', '水垢対策'] },
      { query: '車 ガラスクリーナー 油膜取り', words: ['ガラスクリーナー', '油膜取り'] },
      { query: '車 コーティング剤', words: ['コーティング剤', '撥水剤'] },
      { query: 'タイヤワックス 車', words: ['タイヤワックス'] },
      { query: 'レーダー探知機 GPS 車', words: ['レーダー探知機', 'GPSレーダー', '速度アラーム', '速度管理'] },
      { query: 'ドライブレコーダー 前後', words: ['ドライブレコーダー', 'ドラレコ', '駐車監視'] },
      { query: '車 シートクッション 腰', words: ['シートクッション', '腰の支え', '腰痛', '運転の疲れ', '疲労対策'] },
      { query: '運転用 サングラス 偏光', words: ['サングラス', '偏光サングラス', '目の疲れ', '視認性'] },
      { query: '車 サンシェード', words: ['サンシェード', '日よけ'] },
      { query: 'ポータブル電源 車中泊', words: ['ポータブル電源', '車中泊 電源'] },
      { query: '車載扇風機 車中泊', words: ['車載扇風機', '扇風機 車内'] },
      { query: 'ジャンプスターター 車 バッテリー', words: ['ジャンプスターター', 'バッテリー上がり'] },
      { query: 'スマホホルダー 車', words: ['スマホホルダー'] }
    ].forEach(function(item) {
      if (item.words.some(function(word) { return value.indexOf(word) !== -1; })) add(item.query);
    });
  }

  if (appKey === 'home') {
    [
      { query: 'サンシェード ベランダ 日よけ', words: ['サンシェード', '日よけシェード'] },
      { query: '除湿機 コンパクト', words: ['除湿機', '除湿器'] },
      { query: 'サーキュレーター 部屋干し', words: ['サーキュレーター', '部屋干し'] },
      { query: '湿度計 室内', words: ['湿度計'] },
      { query: '防カビ 収納用品', words: ['防カビ 収納', 'カビ対策 収納'] },
      { query: 'ランドリーチェスト 防カビ', words: ['ランドリーチェスト', '洗面所 チェスト'] },
      { query: '収納ボックス 家庭用', words: ['収納ボックス', '収納ケース'] },
      { query: '滑り止めマット 浴室', words: ['滑り止めマット', '滑り止め'] },
      { query: 'センサーライト 屋外', words: ['センサーライト'] },
      { query: '室外機カバー', words: ['室外機カバー', '室外機 日よけ'] }
    ].forEach(function(item) {
      if (item.words.some(function(word) { return value.indexOf(word) !== -1; })) add(item.query);
    });
  }

  return result.slice(0, 5);
}

function uaContextualRakutenQueries_(text, appKey) {
  const value = String(text || '');

  if (appKey === 'home') {
    if (value.indexOf('サンシェード') !== -1 || value.indexOf('日よけシェード') !== -1) {
      return [
        'サンシェード ベランダ 日よけ',
        'サンシェード 固定金具 屋外',
        'サンシェード ベランダ 収納式'
      ];
    }

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

function uaSelectRakutenCategoryQueries_(body, rowData, appConfig, primaryQuery) {
  const appKey = appConfig && appConfig.key;
  const text = [
    rowData && rowData.mainInput,
    rowData && rowData.readerMindMemo,
    rowData && rowData.affiliateNotes,
    body
  ].join(' ');
  const queries = [];
  const seen = {};

  function add(query) {
    query = String(query || '').replace(/\s+/g, ' ').trim();
    if (!query || seen[query]) return;
    seen[query] = true;
    queries.push(query);
  }

  function hasAny(words) {
    return words.some(function(word) {
      return text.indexOf(word) !== -1;
    });
  }

  if (appKey === 'drive') {
    if (hasAny(['ディテールブラシ', '細かい部分に使えるブラシ', '段差・隙間', 'スポイラー下面', '隙間の砂'])) {
      add('ディテールブラシ 車 洗車');
    }

    if (hasAny(['マイクロファイバークロス', '厚手', '薄手', '拭き上げクロス', '吸水クロス'])) {
      add('マイクロファイバークロス 車 洗車');
    }

    if (hasAny(['ガラス撥水剤', 'ガラスクリーナー', '油膜取り', 'リアガラス', '撥水'])) {
      add('車 ガラス撥水剤 油膜取り');
    }

    if (hasAny(['クイックディテーラー', '軽い汚れ', '時短'])) {
      add('クイックディテーラー 車');
    }

    if (hasAny(['カーシャンプー', '泡洗車', '洗車シャンプー'])) {
      add('カーシャンプー 車 洗車');
    }

    if (hasAny(['レーダー探知機', 'GPSレーダー', '速度アラーム', '速度管理'])) {
      add('レーダー探知機 GPS 車');
    }

    if (hasAny(['ドライブレコーダー', 'ドラレコ', '駐車監視'])) {
      add('ドライブレコーダー 前後');
    }

    if (hasAny(['シートクッション', '腰の支え', '腰痛', '運転の疲れ', '疲労対策'])) {
      add('車 シートクッション 腰');
    }

    if (hasAny(['サングラス', '偏光サングラス', '目の疲れ', '視認性'])) {
      add('運転用 サングラス 偏光');
    }
  }

  if (appKey === 'home') {
    if (hasAny(['サンシェード', '日よけシェード'])) {
      add('サンシェード ベランダ 日よけ');
      add('サンシェード 固定金具 屋外');
      add('サンシェード ベランダ 収納式');
    }

    if (hasAny(['除湿機', '除湿器', '湿気対策', '衣類乾燥'])) {
      add('除湿機 コンパクト');
    }

    if (hasAny(['サーキュレーター', '空気を回す', '送風'])) {
      add('サーキュレーター 部屋干し');
    }

    if (hasAny(['湿度計', '湿度を見る', '湿度管理'])) {
      add('湿度計 室内');
    }

    if (hasAny(['収納ボックス', '収納ケース', 'チェスト', 'ランドリーチェスト'])) {
      add('ランドリーチェスト 防カビ');
    }

    if (hasAny(['防カビ', 'カビ対策', '除湿剤'])) {
      add('防カビ 収納用品');
    }
  }

  return queries.slice(0, 3);
}

function uaFetchRakutenItemsByQueries_(queries, maxItems, selectionSeed) {
  const results = [];
  const seenUrls = {};
  const limit = Math.max(1, Math.min(3, Number(maxItems) || 3));

  (queries || []).forEach(function(query) {
    if (results.length >= limit) return;

    const items = uaFetchRakutenItems_(query, 1, String(selectionSeed || '') + '|' + query);
    items.forEach(function(item) {
      if (results.length >= limit) return;
      if (!item || !item.url || seenUrls[item.url]) return;
      seenUrls[item.url] = true;
      results.push(item);
    });
  });

  return results;
}

function uaRakutenTextContains_(text, keyword) {
  const value = String(text || '');
  const word = String(keyword || '').trim();

  if (!word) return false;
  if (value.indexOf(word) !== -1) return true;

  const compactValue = value.replace(/[\s　]+/g, '');
  const compactWord = word.replace(/[\s　]+/g, '');
  return !!compactWord && compactValue.indexOf(compactWord) !== -1;
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
    { query: 'レーダー探知機 GPS 車', keywords: ['レーダー探知機', 'GPSレーダー', '速度管理', '速度アラーム'] },
    { query: 'ドライブレコーダー 前後', keywords: ['ドラレコ', 'ドライブレコーダー', '駐車監視'] },
    { query: '車 シートクッション 腰', keywords: ['シートクッション', '腰', '疲労対策', '運転 疲れ'] },
    { query: '運転用 サングラス 偏光', keywords: ['サングラス', '偏光サングラス', '目の疲れ', '視認性'] },
    { query: '車 サンシェード', keywords: ['サンシェード', '日よけ', '暑さ対策'] },
    { query: 'ポータブル電源 車中泊', keywords: ['ポータブル電源', '車中泊'] },
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
    { query: 'サンシェード ベランダ 日よけ', keywords: ['サンシェード', '日よけシェード', '強風対策'] },
    { query: '除湿機 コンパクト', keywords: ['カビ', '湿気', '除湿', 'ランドリー', '脱衣所', '洗面所'] },
    { query: 'サーキュレーター 部屋干し', keywords: ['換気', '部屋干し', 'サーキュレーター', '湿気', 'ランドリー'] },
    { query: 'ランドリーチェスト 防カビ', keywords: ['ランドリー チェスト', 'ランドリーチェスト', 'カビない', '防カビ'] },
    { query: 'ランドリー収納 樹脂 チェスト', keywords: ['ランドリー収納', '脱衣所 収納', '洗面所 収納', '樹脂'] },
    { query: '脱衣所 収納 チェスト', keywords: ['脱衣所', '洗面所', 'チェスト'] },
    { query: '収納ボックス 住宅', keywords: ['収納', '収納ボックス', '片付け'] },
    { query: '可動棚 収納', keywords: ['可動棚', '棚', '収納'] },
    { query: '排水口ブラシ 排水トラップ 掃除', keywords: ['排水口', 'ぬめり', '掃除'], minScore: 2 },
    { query: '滑り止めマット 玄関 浴室', keywords: ['滑りにくい', '滑り止め', 'マット'] },
    { query: 'センサーライト 屋外', keywords: ['センサーライト', '外構', '防犯'] },
    { query: '防災用品 セット 家庭用', keywords: ['防災', '停電', '備え'] },
    { query: '室外機カバー', keywords: ['室外機カバー', '室外機', '日よけ'] },
    { query: '室内物干し', keywords: ['物干し', 'ランドリー', '洗濯'] },
    { query: '見守りカメラ 家庭用', keywords: ['見守り', 'カメラ', '子ども'] },
    { query: 'ベビーゲート 階段', keywords: ['ベビーゲート', '子育て', '階段'] },
    { query: '車いす スロープ 簡易', keywords: ['車いす', 'スロープ', '段差'] }
  ];
}

function uaDecideRakutenItemCount_(body, rowData, appConfig, query) {
  const text = [
    rowData && rowData.mainInput,
    rowData && rowData.readerMindMemo,
    rowData && rowData.affiliateNotes,
    query,
    body
  ].join(' ');
  const compareWords = [
    '比較',
    '選び方',
    '定番',
    '候補',
    '用意',
    'アイテム',
    'グッズ',
    '商品',
    '買う',
    '購入',
    '揃える',
    '使い分け',
    '初心者向け',
    '価格を抑えたい',
    '仕上がり重視',
    '時短'
  ];
  const supportWords = [
    '対策',
    '予防',
    '便利',
    'あると',
    '減らす',
    '防ぐ',
    '掃除',
    '洗車',
    '収納',
    '湿気',
    'カビ',
    '車中泊',
    '防災'
  ];

  if (compareWords.some(function(word) { return text.indexOf(word) !== -1; })) {
    return 3;
  }

  if (supportWords.some(function(word) { return text.indexOf(word) !== -1; })) {
    return 2;
  }

  return 1;
}

function uaFetchRakutenItems_(query, maxItems, selectionSeed) {
  const applicationId = String(PropertiesService.getScriptProperties().getProperty('UA_RAKUTEN_APPLICATION_ID') || '').trim();
  const accessKey = String(PropertiesService.getScriptProperties().getProperty('UA_RAKUTEN_ACCESS_KEY') || '').trim();

  if (!applicationId || !accessKey) {
    UA_LAST_RAKUTEN_STATUS = '楽天APIキー不足（UA_RAKUTEN_APPLICATION_ID / UA_RAKUTEN_ACCESS_KEY）';
    return [];
  }

  const affiliateId = String(PropertiesService.getScriptProperties().getProperty('UA_RAKUTEN_AFFILIATE_ID') || '').trim();
  const refererUrl = uaGetRakutenRefererUrl_();
  const hits = Math.max(1, Math.min(3, Number(maxItems) || 1));
  const candidateHits = Math.max(8, Math.min(20, hits * 5));
  const params = [
    'format=json',
    'formatVersion=2',
    'hits=' + candidateHits,
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
      headers: {
        referer: refererUrl,
        origin: uaGetOriginFromUrl_(refererUrl),
        accessKey: accessKey
      },
      muteHttpExceptions: true
    });

    const statusCode = res.getResponseCode();
    const responseText = res.getContentText();

    if (statusCode !== 200) {
      UA_LAST_RAKUTEN_STATUS = '楽天API HTTP ' + statusCode + ': ' + String(responseText || '').slice(0, 120) +
        ' / Referer=' + refererUrl;
      return [];
    }

    const json = JSON.parse(responseText);
    const responseItems = json.items || json.Items || [];
    const candidates = [];
    const seenUrls = {};

    responseItems.forEach(function(rawItem) {
      const currentItem = rawItem && (rawItem.item || rawItem.Item || rawItem);
      if (!currentItem || !currentItem.itemName || !(currentItem.affiliateUrl || currentItem.itemUrl)) return;
      if (!uaIsRakutenItemRelevant_(currentItem.itemName, query)) return;

      const currentUrl = currentItem.affiliateUrl || currentItem.itemUrl;
      if (seenUrls[currentUrl]) return;
      seenUrls[currentUrl] = true;

      const currentMediumImage = currentItem.mediumImageUrls &&
        currentItem.mediumImageUrls[0];

      candidates.push({
        name: currentItem.itemName,
        url: currentUrl,
        imageUrl: typeof currentMediumImage === 'string'
          ? currentMediumImage
          : currentMediumImage && currentMediumImage.imageUrl
      });
    });

    if (candidates.length === 0) {
      UA_LAST_RAKUTEN_STATUS = '讌ｽ螟ｩAPI縺ｮ蝠・刀蜿門ｾ・莉ｶ縺ｾ縺溘・URL荳崎ｶｳ縲よ､懃ｴ｢繧ｭ繝ｼ繝ｯ繝ｼ繝・ ' + query;
      return [];
    }

    const results = [];
    const start = uaStableRakutenSelectionOffset_(String(selectionSeed || query), candidates.length);
    for (let offset = 0; offset < candidates.length && results.length < hits; offset += 1) {
      results.push(candidates[(start + offset) % candidates.length]);
    }
    return results;

    const items = json.items || json.Items || [];
    const firstItem = items[0];
    const item = firstItem && (firstItem.item || firstItem.Item || firstItem);

    if (!item || !item.itemName || !(item.affiliateUrl || item.itemUrl)) {
      UA_LAST_RAKUTEN_STATUS = '楽天APIの商品取得0件またはURL不足。検索キーワード: ' + query;
      return [];
    }

    const mediumImage = item.mediumImageUrls &&
      item.mediumImageUrls[0];

    return {
      name: item.itemName,
      url: item.affiliateUrl || item.itemUrl,
      imageUrl: typeof mediumImage === 'string'
        ? mediumImage
        : mediumImage && mediumImage.imageUrl
    };
  } catch (e) {
    UA_LAST_RAKUTEN_STATUS = '楽天API取得エラー: ' + e.toString();
    return [];
  }
}

function uaIsRakutenItemRelevant_(itemName, query) {
  const name = String(itemName || '').replace(/[\s　]+/g, '').toLowerCase();
  const queryText = String(query || '').replace(/[\s　]+/g, '').toLowerCase();
  if (!name || !queryText) return false;

  if ((queryText.indexOf('サンシェード') !== -1 || queryText.indexOf('日よけ') !== -1) &&
    (queryText.indexOf('ベランダ') !== -1 || queryText.indexOf('屋外') !== -1)) {
    const vehicleOnlyTerms = ['車用', '車載', '自動車', 'カー用品', 'フロントガラス', 'サイドウィンドウ', '後部座席'];
    if (vehicleOnlyTerms.some(function(value) { return name.indexOf(value) !== -1; })) return false;
  }

  const synonymGroups = [
    ['サンシェード', '日よけ', '日除け', 'シェード'],
    ['収納ボックス', '収納ケース', 'ストレージボックス'],
    ['ランドリーチェスト', 'ランドリー収納', 'ランドリーボックス', 'チェスト'],
    ['除湿機', '除湿器'],
    ['サーキュレーター'],
    ['湿度計'],
    ['シートクッション', 'カーシートクッション'],
    ['ガラスクリーナー'],
    ['カーシャンプー'],
    ['マイクロファイバークロス', 'マイクロファイバー'],
    ['ドライブレコーダー', 'ドラレコ'],
    ['レーダー探知機'],
    ['スマホホルダー'],
    ['防災用品', '防災セット'],
    ['センサーライト'],
    ['室外機カバー'],
    ['室内物干し'],
    ['ベビーゲート'],
    ['スロープ'],
    ['配線カバー'],
    ['滑り止めマット'],
    ['排水口ブラシ'],
    ['可動棚']
  ];

  for (let i = 0; i < synonymGroups.length; i++) {
    const group = synonymGroups[i].map(function(value) {
      return value.replace(/[\s　]+/g, '').toLowerCase();
    });
    if (group.some(function(value) { return queryText.indexOf(value) !== -1; })) {
      return group.some(function(value) { return name.indexOf(value) !== -1; });
    }
  }

  const stopWords = {
    '車': true,
    '住宅': true,
    '家庭用': true,
    '屋外': true,
    '室内': true,
    'コンパクト': true,
    '防カビ': true,
    '部屋干し': true,
    '前後': true,
    '車種適合': true,
    'セット': true,
    '強風': true,
    '対策': true,
    '日よけ': true,
    'ベランダ': true,
    '玄関': true,
    '浴室': true,
    '洗車': true,
    '掃除': true
  };
  const coreTerms = String(query || '')
    .split(/[\s　]+/)
    .map(function(value) { return value.trim().toLowerCase(); })
    .filter(function(value) { return value.length >= 2 && !stopWords[value]; });

  if (coreTerms.length === 0) return false;
  return coreTerms.some(function(value) {
    return name.indexOf(value.replace(/[\s　]+/g, '')) !== -1;
  });
}

function uaTestRakutenPrimaryProductRouting() {
  const homeConfig = { key: 'home' };
  const sunshadeRow = {
    mainInput: 'サンシェード 強風対策',
    affiliateName: '案件無し',
    affiliateNotes: '楽天バナーあり',
    readerMindMemo: '強風時に外しやすく収納できるサンシェードを安全に使いたい'
  };
  const query = uaSelectRakutenProductQuery_('', sunshadeRow, homeConfig);
  const categories = uaSelectRakutenCategoryQueries_('', sunshadeRow, homeConfig, query);
  const checks = [
    { name: 'sunshade query', ok: query === 'サンシェード ベランダ 日よけ', actual: query },
    { name: 'sunshade category first', ok: categories[0] === 'サンシェード ベランダ 日よけ', actual: categories },
    { name: 'reject mailbox', ok: !uaIsRakutenItemRelevant_('北欧デザイン メールボックス 郵便ポスト', '収納ボックス 住宅') },
    { name: 'accept sunshade', ok: uaIsRakutenItemRelevant_('撥水シェード ベランダ用 日よけ 2m', 'サンシェード ベランダ 日よけ') },
    { name: 'reject car sunshade for home', ok: !uaIsRakutenItemRelevant_('車用カーテン 吸盤式サンシェード カー用品', 'サンシェード ベランダ 収納式') },
    { name: 'accept storage box', ok: uaIsRakutenItemRelevant_('ふた付き収納ケース 大容量', '収納ボックス 住宅') }
  ];
  const failures = checks.filter(function(check) { return !check.ok; });
  if (failures.length > 0) {
    throw new Error('Rakuten primary product routing test failed: ' + JSON.stringify(failures));
  }
  return { ok: true, count: checks.length, checks: checks };
}

function uaStableRakutenSelectionOffset_(seed, length) {
  const size = Math.max(0, Number(length) || 0);
  if (!size) return 0;
  let hash = 2166136261;
  String(seed || '').split('').forEach(function(char) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  });
  return hash % size;
}

function uaGetRakutenRefererUrl_() {
  const props = PropertiesService.getScriptProperties();
  return String(
    props.getProperty('UA_RAKUTEN_REFERER_URL') ||
    props.getProperty('UA_RAKUTEN_APPLICATION_URL') ||
    'https://script.google.com/'
  ).trim();
}

function uaGetOriginFromUrl_(url) {
  const match = String(url || '').match(/^https?:\/\/[^/]+/i);
  return match ? match[0] : 'https://script.google.com';
}

function uaBuildRakutenSingleItemBannerHtml_(item, query) {
  const name = uaEscapeHtml_(String(item.name || '').slice(0, 80));
  const url = uaEscapeHtml_(item.url || '');
  const imageUrl = uaEscapeHtml_(item.imageUrl || '');
  const queryText = uaEscapeHtml_(query || '');
  const imageHtml = imageUrl
    ? '<a href=\'' + url + '\' target=\'_blank\' rel=\'nofollow sponsored\' style=\'display:block;width:120px;flex:0 0 120px;background:#fff;border:1px solid #eef1f4;border-radius:6px;padding:6px;\'><img src=\'' + imageUrl + '\' alt=\'' + name + '\' style=\'display:block;max-width:100%;height:auto;border:0;background:#fff;\'></a>'
    : '';

  return [
    '<p>本文の対策を実際に試すための商品候補を見比べたい場合は、下の楽天バナーから「' + queryText + '」の価格や種類を確認できます。</p>',
    '<!-- wp:html -->',
    '<div style=\'background:#fff;border:1px solid #d7dde3;border-radius:8px;padding:14px;margin:16px 0;display:flex;gap:14px;align-items:center;max-width:720px;box-sizing:border-box;\'>',
    imageHtml,
    '<div style=\'min-width:0;\'>',
    '<p style=\'margin:0 0 8px;font-weight:700;\'>「' + queryText + '」を楽天で比較する</p>',
    '<p style=\'margin:0;font-size:14px;line-height:1.7;\'><a href=\'' + url + '\' target=\'_blank\' rel=\'nofollow sponsored\'>' + name + '</a></p>',
    '</div>',
    '</div>',
    '<!-- /wp:html -->'
  ].filter(Boolean).join('\n');
}

function uaBuildRakutenItemBannerHtml_(items, query) {
  items = (items || []).slice(0, 3);

  if (items.length === 0) {
    return '';
  }

  const queryText = uaEscapeHtml_(query || '関連アイテム');
  const itemHtml = items.map(function(item) {
    const name = uaEscapeHtml_(String(item.name || '').slice(0, 80));
    const url = uaEscapeHtml_(item.url || '');
    const imageUrl = uaEscapeHtml_(item.imageUrl || '');
    const imageHtml = imageUrl
      ? '<a href=\'' + url + '\' target=\'_blank\' rel=\'nofollow sponsored\' style=\'display:block;width:92px;flex:0 0 92px;background:#fff;border:1px solid #eef1f4;border-radius:6px;padding:5px;\'><img src=\'' + imageUrl + '\' alt=\'' + name + '\' style=\'display:block;max-width:100%;height:auto;border:0;background:#fff;\'></a>'
      : '';

    return [
      '<div style=\'display:flex;gap:12px;align-items:center;padding:10px 0;border-top:1px solid #edf1f4;\'>',
      imageHtml,
      '<p style=\'margin:0;font-size:14px;line-height:1.7;\'><a href=\'' + url + '\' target=\'_blank\' rel=\'nofollow sponsored\'>' + name + '</a></p>',
      '</div>'
    ].filter(Boolean).join('');
  }).join('');

  const leadText = queryText
    ? (items.length > 1
      ? '<p>本文の対策を実際に試すための商品候補を見比べたい場合は、下の楽天バナーから「' + queryText + '」の価格や種類をいくつか確認できます。</p>'
      : '<p>本文の対策を実際に試すための商品候補を確認したい場合は、下の楽天バナーから「' + queryText + '」の価格や種類を確認できます。</p>')
    : (items.length > 1
      ? '<p>本文の対策を実際に試すための商品候補を見比べたい場合は、下の楽天バナーから関連アイテムの価格や種類をいくつか確認できます。</p>'
      : '<p>本文の対策を実際に試すための商品候補を確認したい場合は、下の楽天バナーから関連アイテムの価格や種類を確認できます。</p>');

  return [
    leadText,
    '<!-- wp:html -->',
    '<div style=\'background:#fff;border:1px solid #d7dde3;border-radius:8px;padding:14px;margin:16px 0;max-width:760px;box-sizing:border-box;\'>',
    '<p style=\'margin:0 0 8px;font-weight:700;\'>「' + queryText + '」を楽天で比較する</p>',
    itemHtml,
    '</div>',
    '<!-- /wp:html -->'
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
    UA_LAST_RAKUTEN_STATUS = 'パネルまたは案件注意点で楽天バナーなしが指定されています';
    return false;
  }

  if (notes.indexOf('楽天バナーあり') !== -1 || notes.indexOf('楽天あり') !== -1) {
    return true;
  }

  if (!uaHasMainAffiliateProject_(rowData)) {
    const relatedQuery = uaSelectRakutenProductQuery_(body, rowData, appConfig);
    if (relatedQuery) {
      UA_LAST_RAKUTEN_STATUS = 'メイン案件なし・キーワード関連商品を優先: ' + relatedQuery;
      return true;
    }
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
    UA_LAST_RAKUTEN_STATUS = '自動判定で関連商品キーワード不足。楽天バナーあり、または楽天商品キーワードを手動指定してください';
    return false;
  }

  const negativeCount = negativeKeywords.filter(function(keyword) {
    return text.indexOf(keyword) !== -1;
  }).length;

  if (negativeCount >= 3) {
    UA_LAST_RAKUTEN_STATUS = '自動判定で除外語が多いため未挿入（工賃・法規・保証などの商品購入が主解決ではない可能性）';
    return false;
  }

  return true;
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
    .replace(/<table class='[^']*'>/gi, '<table>')
    .replace(/<table style='[^']*'>/gi, '<table>');

  return text;
}
