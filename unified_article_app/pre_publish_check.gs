function uaRunPrePublishCheckFromWeb(data) {
  return uaRunPrePublishCheckFromPanel(data || {});
}

function uaApplyPrePublishFixesOnceFromWeb(data) {
  return uaApplyPrePublishFixesOnceFromPanel(data || {});
}

function uaRunPrePublishCheckFromPanel(data) {
  const sheet = uaGetSheetForData_(data || {});
  const row = Number(data && data.row) || sheet.getActiveCell().getRow();
  if (row === 1) {
    throw new Error('記事データの行を選択してください。1行目は見出しです。');
  }
  const currentData = uaBuildRowData_(sheet, row);
  const mergedData = Object.assign({}, currentData, data || {});
  uaSaveActiveRowData(mergedData);

  const rowData = uaBuildRowData_(sheet, row);
  const ruleCheck = uaBuildPrePublishRuleCheck_(rowData);
  let editorCheck = null;
  let editorError = '';
  let modelLabel = '';

  if (String(rowData.body || '').trim()) {
    try {
      const provider = uaGetReaderMindProvider_();
      const result = uaCallReaderMindJson_(uaBuildPrePublishEditorPrompt_(rowData, ruleCheck), provider);
      editorCheck = result && result.data || null;
      modelLabel = uaFormatModelLabel_(provider, result && result.model);
    } catch (e) {
      editorError = e && e.message ? e.message : String(e || '');
    }
  } else {
    editorError = '本文が空のため、編集者チェックはスキップしました。';
  }

  const report = uaFormatPrePublishCheckReport_(ruleCheck, editorCheck, modelLabel, editorError);
  uaSetFactCheckPointsWithLinks_(sheet, row, report);
  SpreadsheetApp.flush();

  const nextData = uaBuildRowData_(sheet, row);
  nextData.message = '公開前チェックを実行しました。確認タブの「要確認ポイント」を見てください。';
  return nextData;
}

function uaApplyPrePublishFixesOnceFromPanel(data) {
  const sheet = uaGetSheetForData_(data || {});
  const row = Number(data && data.row) || sheet.getActiveCell().getRow();
  if (row === 1) {
    throw new Error('記事データの行を選択してください。1行目は見出しです。');
  }

  const currentData = uaBuildRowData_(sheet, row);
  uaSaveActiveRowData(Object.assign({}, currentData, data || {}));
  const rowData = uaBuildRowData_(sheet, row);
  const originalBody = String(rowData.body || '').trim();
  const originalReport = String(rowData.factCheckPoints || '').trim();

  if (!originalBody) {
    throw new Error('本文が空です。先に本文を生成してください。');
  }
  if (originalReport.indexOf('【公開前チェック】') === -1) {
    throw new Error('直前の公開前チェック結果がありません。先に公開前チェックを実行してください。');
  }

  const appConfig = uaGetAppConfigByLabel_(rowData.appType);
  if (!appConfig) {
    throw new Error('記事タイプを判定できません。対象行の記事タイプを確認してください。');
  }

  const provider = uaGetArticleProvider_();
  uaAssertArticleProviderReady_(provider);
  const externalSourcesPrompt = uaBuildExternalSourcesPrompt_(rowData.mainInput, appConfig);
  const result = uaCallArticleGenerationJson_(
    uaBuildPrePublishRevisionPrompt_(rowData, originalReport, externalSourcesPrompt),
    provider
  );
  const revision = uaNormalizePrePublishRevision_(result && result.data, rowData);
  const revisedBody = uaApplyNaviokunIntroSet_(
    uaApplyManagedAffiliateCta_(
      uaApplyYmylNotice_(
        uaNormalizeFaqHeadingLevels_(uaFixGeneratedHtml_(revision.bodyHtml)),
        rowData,
        appConfig
      ),
      rowData,
      appConfig
    ),
    rowData,
    appConfig
  );
  const allowedNewUrls = uaExtractPrePublishUrlsFromText_(externalSourcesPrompt)
    .concat([String(rowData.affiliateUrl || '').trim()])
    .concat(uaGetManagedAffiliateUrls_(rowData))
    .concat([UA_NAVIOKUN_INTRO_URL])
    .concat(uaGetYmylNoticeSourceUrls_(rowData, appConfig, revisedBody))
    .filter(Boolean);

  uaValidatePrePublishRevision_(originalBody, revisedBody, allowedNewUrls);

  sheet.getRange(row, UA_COLUMNS.body, 1, 5).setValues([[
    revisedBody,
    revision.titleIdeas,
    revision.tags,
    revision.metaDescription,
    revision.permalink
  ]]);
  uaSetGeneratedMeta_(sheet, row, UA_STATUS_DONE, provider, result && result.model);
  SpreadsheetApp.flush();

  const revisedRowData = uaBuildRowData_(sheet, row);
  const ruleCheck = uaBuildPrePublishRuleCheck_(revisedRowData);
  const modelLabel = uaFormatModelLabel_(provider, result && result.model);
  const revisionReport = uaFormatPrePublishRevisionReport_(
    revision,
    ruleCheck,
    modelLabel,
    originalReport
  );
  uaSetFactCheckPointsWithLinks_(sheet, row, revisionReport);
  SpreadsheetApp.flush();

  if (ruleCheck.critical.length) {
    throw new Error(
      '文脈を読んだ修正は保存しましたが、修正後もNGが' + ruleCheck.critical.length +
      '件あるためWordPress反映前で停止しました。確認タブを見てください。'
    );
  }

  const nextData = uaBuildRowData_(sheet, row);
  nextData.message = '公開前チェックの指摘を文脈に沿って1回修正しました。';
  return nextData;
}

function uaBuildPrePublishRevisionPrompt_(rowData, checkReport, externalSourcesPrompt) {
  return [
    'あなたはプロの編集者兼コピーライターです。公開前チェック結果を受けて、記事を1回だけ修正してください。',
    '最重要: 指摘に含まれる単語だけを見て一律置換しないでください。本文全体、前後の文、段落、見出しの役割、読者の検索意図を読んでから、修正が必要か判断してください。',
    '機械チェックの検出は修正候補であり、すべてを直す命令ではありません。質問文、引用、条件付き説明、手順、注意書き、保証・契約内容の説明として適切なら変更せず、skipped_suggestions に理由を残してください。',
    '元の意味と事実を変えず、必要な箇所だけを最小限に直してください。記事全体の書き直しは禁止です。',
    '事実、数値、制度、法規、安全、価格、保証、メーカー仕様、対応可否、URLを推測で作らないでください。根拠を確認できない指摘は本文で断定せず、manual_confirmation_needed に残してください。',
    '信頼性が必要な主張には、その内容に直接対応する公的機関・メーカー公式・店舗公式などの外部リンクを近くに置いてください。ただし、下記の外部出典候補または本文内に既にあるURLだけを使用し、URLを捏造しないでください。',
    '既存の画像、リンク、楽天広告、アフィリエイトCTA、Cocoonブログカード、YMYL注意書き、WordPressブロックコメントと属性は削除・変更しないでください。',
    '商品名や用品紹介は、楽天バナー、案件CTA、公式リンクなど読者が次に確認できる導線があり、記事の判断に必要な場合だけ残してください。導線のない商品名の羅列は増やさず、選び方・適合条件・確認項目へ置き換えてください。',
    '「この記事のポイント」はCocoon tab-caption-box-1、CTAはCocoon button-wrap-1、内部リンクは前置き文とCocoonブログカードの形式を守ってください。',
    'H2は「よくある質問」「まとめ」を含めて最大7個にしてください。H2が多い場合は近い論点を統合し、詳細をH3へ整理してください。',
    'FAQはH2「よくある質問」の直下にH3「Q. 質問」を置き、回答はp要素にしてください。FAQ内の質問にH4は使わないでください。',
    'タイトル案を直す場合は、メインキーワードを自然に含め、本文に根拠がある数字を使い、読者の悩みと読むメリットが伝わる魅力的な30〜32文字を目安にしてください。煽りや本文にない約束は禁止です。',
    'メタディスクリプションを直す場合は、メインキーワード、読者の悩み、記事で分かる具体的な判断材料、読むメリットを自然に含め、約120文字にしてください。単なる記事説明や煽り文句は禁止です。',
    '必ずJSONだけで返してください。body_htmlには修正後の本文HTML全文を省略せず入れてください。',
    '{"body_html":"...","title_ideas":"案1 / 案2 / 案3","tags":"...","meta_description":"...","permalink":"...","applied_changes":[{"target":"対象箇所","reason":"文脈上の理由","change":"実際の修正"}],"skipped_suggestions":[{"target":"対象箇所","reason":"文脈上適切なので見送った理由"}],"manual_confirmation_needed":[{"target":"対象箇所","reason":"確認が必要な理由"}]}',
    '',
    '【記事情報】',
    '記事タイプ: ' + String(rowData.appType || ''),
    'メインキーワード: ' + String(rowData.mainInput || ''),
    '案件名: ' + String(rowData.affiliateName || ''),
    '案件URL: ' + String(rowData.affiliateUrl || ''),
    'タイトル案: ' + String(rowData.titleIdeas || ''),
    'メタディスクリプション: ' + String(rowData.metaDescription || ''),
    'タグ: ' + String(rowData.tags || ''),
    'パーマリンク: ' + String(rowData.permalink || ''),
    '読者心理メモ: ' + String(rowData.readerMindMemo || '').slice(0, 6000),
    '構成メモ: ' + String(rowData.structureMemo || '').slice(0, 8000),
    '',
    '【使用を許可する外部出典候補】',
    String(externalSourcesPrompt || ''),
    '',
    '【公開前チェック結果】',
    String(checkReport || '').slice(0, 24000),
    '',
    '【本文HTML全文】',
    String(rowData.body || '')
  ].join('\n');
}

function uaNormalizePrePublishRevision_(raw, rowData) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const bodyHtml = String(data.body_html || data.body || '').trim();
  if (!bodyHtml) {
    throw new Error('修正結果に本文HTMLがありません。');
  }
  return {
    bodyHtml: bodyHtml,
    titleIdeas: String(data.title_ideas || data.titleIdeas || rowData.titleIdeas || '').trim(),
    tags: String(data.tags || rowData.tags || '').trim(),
    metaDescription: String(data.meta_description || data.metaDescription || rowData.metaDescription || '').trim(),
    permalink: String(data.permalink || data.slug || rowData.permalink || '').trim(),
    appliedChanges: Array.isArray(data.applied_changes) ? data.applied_changes : [],
    skippedSuggestions: Array.isArray(data.skipped_suggestions) ? data.skipped_suggestions : [],
    manualConfirmationNeeded: Array.isArray(data.manual_confirmation_needed) ? data.manual_confirmation_needed : []
  };
}

function uaBuildPrePublishRuleCheck_(rowData) {
  const body = String(rowData && rowData.body || '');
  const title = uaPickWpTitle_(rowData && rowData.titleIdeas || '') || '';
  const meta = String(rowData && rowData.metaDescription || '').trim();
  const tags = String(rowData && rowData.tags || '').trim();
  const permalink = String(rowData && rowData.permalink || '').trim();
  const structureMemo = String(rowData && rowData.structureMemo || '');
  const wpPostId = Number(rowData && rowData.wpPostId || 0);
  const h2List = uaExtractPrePublishH2List_(body);
  const faqHeadingIssues = uaFindPrePublishFaqHeadingIssues_(body);
  const relDuplicates = uaFindPrePublishDuplicateRelLinks_(body);
  const unbalancedBlocks = uaFindPrePublishUnbalancedBlocks_(body);
  const reliabilityClaims = uaFindPrePublishReliabilityClaims_(body);
  const externalSourceLinkCount = uaCountPrePublishExternalSourceLinks_(body, rowData);
  let ymylNoticeSpec = null;
  try {
    const appConfig = uaGetAppConfigByLabel_(rowData && rowData.appType);
    ymylNoticeSpec = uaBuildYmylNoticeSpec_(rowData || {}, appConfig, body);
  } catch (e) {
    ymylNoticeSpec = null;
  }
  const result = {
    ok: [],
    warnings: [],
    critical: [],
    stats: {
      bodyLength: uaStripPrePublishHtml_(body).length,
      h2Count: h2List.length,
      faqHeadingIssueCount: faqHeadingIssues.length,
      imageCount: uaCountPrePublishImages_(body),
      reliabilityClaimCount: reliabilityClaims.length,
      externalSourceLinkCount: externalSourceLinkCount,
      ymylNoticeRequired: !!ymylNoticeSpec,
      hasWpPost: wpPostId > 0
    }
  };

  if (!body.trim()) {
    result.critical.push('本文が空です。本文生成後にチェックしてください。');
  } else {
    result.ok.push('本文があります（文字数目安: ' + result.stats.bodyLength + '文字）。');
  }

  if (!title) {
    result.warnings.push('タイトル案からWordPress用タイトルを判定できません。');
  } else if (title.length < 28 || title.length > 34) {
    result.warnings.push('タイトルが32文字前後から外れています（' + title.length + '文字）。');
  } else {
    result.ok.push('タイトルは32文字前後です。');
  }
  const mainInput = String(rowData && rowData.mainInput || '').trim();
  if (title && mainInput && title.indexOf(mainInput) === -1) {
    result.warnings.push('タイトルにメインキーワードがそのまま含まれていません。文脈上自然に入るか確認してください。');
  }
  if (title && !/[0-9０-９]/.test(title)) {
    result.warnings.push('タイトルに数字がありません。本文内容に合う理由数・注意点数・確認項目数を自然に使えるか確認してください。');
  }

  if (!meta) {
    result.warnings.push('メタディスクリプションが空です。');
  } else if (meta.length < 110 || meta.length > 130) {
    result.warnings.push('メタディスクリプションが120文字前後から外れています（' + meta.length + '文字）。');
  } else {
    result.ok.push('メタディスクリプションは120文字前後です。');
  }
  if (meta && mainInput && meta.indexOf(mainInput) === -1) {
    result.warnings.push('メタディスクリプションにメインキーワードがそのまま含まれていません。');
  }

  if (!tags) result.warnings.push('タグが空です。');
  else result.ok.push('タグがあります。');

  if (!permalink) {
    result.warnings.push('パーマリンクが空です。');
  } else if (/[\s\u3040-\u30ff\u3400-\u9fff]/.test(permalink)) {
    result.warnings.push('パーマリンクに日本語または空白が含まれています。必要なら英数字の短いURLにしてください。');
  } else {
    result.ok.push('パーマリンクがあります。');
  }

  if (h2List.length < 2) result.warnings.push('H2見出しが少なめです（' + h2List.length + '個）。');
  else if (h2List.length > 7) result.warnings.push('H2見出しが多めです（' + h2List.length + '個）。重複論点を統合し、原則7個以内にしてください。');
  else result.ok.push('H2見出しは読みやすい範囲です（' + h2List.length + '個）。');

  uaFindPrePublishDuplicateItems_(h2List).forEach(function(item) {
    result.warnings.push('同じH2が重複しています: ' + item);
  });

  if (faqHeadingIssues.length) {
    faqHeadingIssues.forEach(function(item) {
      result.warnings.push(item);
    });
  } else if (uaFindFaqSectionBounds_(body)) {
    result.ok.push('FAQの質問見出しはH3です。');
  }

  if (body.indexOf('wp:cocoon-blocks/tab-caption-box-1') !== -1 &&
      body.indexOf('この記事のポイント') !== -1) {
    result.ok.push('「この記事のポイント」はCocoon tab-caption-box-1形式です。');
  } else {
    result.critical.push('「この記事のポイント」がCocoon tab-caption-box-1形式で見つかりません。');
  }

  if (body.trim() && ymylNoticeSpec) {
    if (uaHasYmylNotice_(body)) {
      result.ok.push('YMYL寄りの記事向け注意書きがCocoon danger-box形式で入っています。');
    } else {
      result.critical.push('YMYL寄りの記事ですが、Cocoon danger-box形式の注意書きが見つかりません。');
    }
  }

  const hasAffiliateCtaTarget = !!String(rowData && rowData.affiliateUrl || '').trim();
  if (body.indexOf('wp:cocoon-blocks/button-wrap-1') !== -1 &&
      /<a\b[^>]+href=["'][^"']+["'][^>]*>/i.test(body)) {
    result.ok.push('CTA\u306fCocoon button-wrap-1\u5f62\u5f0f\u3067\u898b\u3064\u304b\u308a\u307e\u3057\u305f\u3002');
  } else if (hasAffiliateCtaTarget) {
    result.critical.push('\u6848\u4ef6URL\u304c\u3042\u308a\u307e\u3059\u304c\u3001CTA\u306eCocoon button-wrap-1\u5f62\u5f0f\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093\u3002');
  } else {
    result.warnings.push('\u6848\u4ef6URL\u304c\u672a\u5165\u529b\u306e\u305f\u3081\u3001CTA\u306eCocoon button-wrap-1\u78ba\u8a8d\u306f\u30b9\u30ad\u30c3\u30d7\u3057\u307e\u3057\u305f\u3002');
  }

  relDuplicates.forEach(function(item) {
    result.warnings.push('CTA/リンクのrel属性で重複があります: ' + item);
  });

  if (body.indexOf('wp:cocoon-blocks/blogcard') !== -1 &&
      body.indexOf('wp-block-cocoon-blocks-blogcard') !== -1) {
    result.ok.push('内部リンク用のCocoonブログカード形式が見つかりました。');
  } else {
    result.warnings.push('Cocoonブログカード形式の内部リンクが見つかりません。内部リンク後入れ前なら問題ありません。');
  }

  if (/こちらの記事|関連記事|あわせて読みたい|詳しくはこちら/.test(body) &&
      body.indexOf('wp:cocoon-blocks/blogcard') !== -1) {
    result.ok.push('内部リンク前の前置き文らしき文章があります。');
  } else if (body.indexOf('wp:cocoon-blocks/blogcard') !== -1) {
    result.warnings.push('ブログカード前の前置き文が弱い可能性があります。本文上で自然につながるか確認してください。');
  }

  if (unbalancedBlocks.length) {
    unbalancedBlocks.forEach(function(item) {
      result.critical.push('WordPressブロックの開始/終了数が合いません: ' + item);
    });
  } else if (body.trim()) {
    result.ok.push('主要なWordPressブロックの開始/終了数は大きく崩れていません。');
  }

  uaFindPrePublishLongSections_(body).forEach(function(item) {
    result.warnings.push(item);
  });

  const aiPhraseHits = uaFindPrePublishPhraseHits_(body);
  if (aiPhraseHits.length) {
    result.warnings.push('AIっぽく見えやすい定型表現が多めです: ' + aiPhraseHits.join(' / '));
  }

  uaFindPrePublishStrongClaims_(body).forEach(function(item) {
    result.warnings.push('強い断定表現があります。根拠があるか確認してください: ' + item);
  });

  if (reliabilityClaims.length && externalSourceLinkCount === 0) {
    result.warnings.push('信頼性が必要な説明がありますが、本文内の外部出典リンクが見つかりません: ' + reliabilityClaims.slice(0, 3).join(' / '));
  } else if (reliabilityClaims.length >= 5 && externalSourceLinkCount < 2) {
    result.warnings.push('信頼性が必要な説明に対して外部出典リンクが少ない可能性があります（対象文' + reliabilityClaims.length + '件 / 外部リンク' + externalSourceLinkCount + '件）。');
  } else if (reliabilityClaims.length) {
    result.ok.push('信頼性が必要な説明に対応する外部リンクがあります（' + externalSourceLinkCount + '件）。');
  }

  if (result.stats.imageCount >= 2) {
    result.ok.push('本文内画像は' + result.stats.imageCount + '件あります。');
  } else if (structureMemo.indexOf('eyecatch:') !== -1 || structureMemo.indexOf('H2: ') !== -1) {
    result.warnings.push('画像生成メモはありますが、本文内画像が少ない可能性があります（本文内' + result.stats.imageCount + '件）。');
  } else {
    result.warnings.push('本文内画像が少なめです（本文内' + result.stats.imageCount + '件）。必要なら画像生成→WP差し込み後に再チェックしてください。');
  }

  if (structureMemo.indexOf('eyecatch:') !== -1) result.ok.push('アイキャッチ用の画像生成メモがあります。');
  else result.warnings.push('アイキャッチ用の画像生成メモが見つかりません。');

  if (wpPostId > 0) result.ok.push('WordPress下書きIDがあります（' + wpPostId + '）。');
  else result.warnings.push('WordPress下書きIDがありません。WP貼り付け後の反映確認は未実施です。');

  return result;
}

function uaBuildPrePublishEditorPrompt_(rowData, ruleCheck) {
  const body = String(rowData && rowData.body || '');
  const compactBody = body.length > 18000
    ? body.slice(0, 15000) + '\n\n【本文後半抜粋】\n' + body.slice(-3000)
    : body;
  return [
    'あなたはプロの編集者兼コピーライターです。ブログ記事を公開前チェックしてください。',
    '目的: 読者にとって自然で役に立ち、AIっぽさが少なく、WordPress/Cocoon形式も崩れていない記事にする。',
    '重視する観点: 元の意図を変えない。事実を作らない。不確かな情報は断定しない。AIっぽい定型表現を減らす。読者の迷い、不安、次の行動が自然につながっているか見る。タイトル、導入、構成、具体性、読みやすさ、SEO、独自性、CTA、信頼性を見る。',
    '単語だけを検出して問題扱いしないでください。必ず前後の文、段落、見出し、記事全体の意図を読み、質問、引用、条件付き説明、手順、注意書き、保証・契約内容として適切な表現は修正対象にしないでください。',
    '法規、安全、数値、価格、保証、メーカー仕様、対応可否など信頼性が必要な主張は、内容に対応する外部出典リンクが近くにあるか確認してください。URLを推測して修正案へ書かず、確認できない場合は手動確認事項として示してください。',
    'タイトルはメインキーワードと本文に根拠がある数字を自然に使い、30〜32文字程度で読者の悩みと読むメリットが伝わるか確認してください。メタディスクリプションは約120文字で、単なる記事説明ではなく具体的な判断材料と読むメリットが伝わるか確認してください。',
    'H2は「よくある質問」「まとめ」を含め原則7個以内とし、重複論点が細切れになっていないか確認してください。',
    '楽天バナー、案件CTA、公式リンクなど次の導線がない用品紹介や、記事の判断に不要な商品名の羅列がないか確認してください。',
    '必ずJSONだけで返してください。形式:',
    '{"score":85,"verdict":"軽微修正で公開可","target":"想定読者","goodPoints":["..."],"warnings":["..."],"criticalIssues":["..."],"suggestedFixes":[{"target":"対象箇所","reason":"理由","suggestion":"修正案"}],"ratings":{"titleAppeal":4,"introStrength":4,"targetClarity":4,"structureClarity":4,"specificity":4,"readability":4,"lowAiSmell":4,"warmth":4,"seoBasics":4,"uniqueness":3,"ctaDesign":4,"reliability":4}}',
    '機械チェック結果:',
    JSON.stringify(ruleCheck),
    '記事タイプ: ' + String(rowData && rowData.appType || ''),
    'メイン入力: ' + String(rowData && rowData.mainInput || ''),
    '案件名: ' + String(rowData && rowData.affiliateName || ''),
    'タイトル案: ' + String(rowData && rowData.titleIdeas || ''),
    'メタディスクリプション: ' + String(rowData && rowData.metaDescription || ''),
    'タグ: ' + String(rowData && rowData.tags || ''),
    '読者心理メモ: ' + String(rowData && rowData.readerMindMemo || '').slice(0, 4000),
    '構成メモ: ' + String(rowData && rowData.structureMemo || '').slice(0, 5000),
    '本文HTML:',
    compactBody
  ].join('\n');
}

function uaFormatPrePublishCheckReport_(ruleCheck, editorCheck, modelLabel, editorError) {
  const score = editorCheck && Number(editorCheck.score || 0);
  const verdict = editorCheck && editorCheck.verdict || uaPickPrePublishVerdict_(ruleCheck);
  const lines = [
    '【公開前チェック】',
    '実行: ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
    '判定: ' + verdict,
    score ? '点数: ' + score + '点' : '点数: 未採点',
    modelLabel ? '使用モデル: ' + modelLabel : '',
    '',
    '▼機械チェック',
    'NG: ' + (ruleCheck.critical.length || 0) + '件 / 要確認: ' + (ruleCheck.warnings.length || 0) + '件 / OK: ' + (ruleCheck.ok.length || 0) + '件',
    '本文文字数目安: ' + ruleCheck.stats.bodyLength + ' / H2: ' + ruleCheck.stats.h2Count + ' / 本文内画像: ' + ruleCheck.stats.imageCount
  ].filter(function(line) { return line !== ''; });

  uaPushPrePublishList_(lines, 'NG', ruleCheck.critical);
  uaPushPrePublishList_(lines, '要確認', ruleCheck.warnings);
  uaPushPrePublishList_(lines, 'OK', ruleCheck.ok);
  lines.push('');
  lines.push('▼編集者チェック');

  if (editorCheck) {
    if (editorCheck.target) lines.push('想定読者: ' + editorCheck.target);
    uaPushPrePublishList_(lines, '良い点', editorCheck.goodPoints);
    uaPushPrePublishList_(lines, '編集面の要確認', editorCheck.warnings);
    uaPushPrePublishList_(lines, '公開前に直すべき点', editorCheck.criticalIssues);
    uaPushPrePublishFixes_(lines, editorCheck.suggestedFixes);
    uaPushPrePublishRatings_(lines, editorCheck.ratings);
  } else {
    lines.push('編集者チェックは実行できませんでした。');
    if (editorError) lines.push('理由: ' + editorError);
  }

  return lines.join('\n');
}

function uaValidatePrePublishRevision_(beforeBody, afterBody, allowedNewUrls) {
  const before = String(beforeBody || '').trim();
  const after = String(afterBody || '').trim();
  if (!after) {
    throw new Error('修正後の本文が空です。');
  }
  if (before.length > 1000 && after.length < before.length * 0.65) {
    throw new Error('修正後の本文が大幅に短くなったため、安全確認で停止しました。');
  }
  if (before.length > 1000 && after.length > before.length * 1.25 + 1200) {
    throw new Error('修正後の本文が大幅に増えたため、安全確認で停止しました。');
  }

  const protectedTokens = [
    ['「この記事のポイント」ブロック', '<!-- wp:cocoon-blocks/tab-caption-box-1'],
    ['CTAブロック', '<!-- wp:cocoon-blocks/button-wrap-1'],
    ['Cocoonブログカード', '<!-- wp:cocoon-blocks/blogcard'],
    ['YMYL注意書き', '<!-- wp:cocoon-blocks/info-box'],
    ['本文画像', '<!-- wp:image']
  ];
  protectedTokens.forEach(function(item) {
    const beforeCount = uaCountPrePublishToken_(before, item[1]);
    const afterCount = uaCountPrePublishToken_(after, item[1]);
    if (afterCount < beforeCount) {
      throw new Error('修正処理で' + item[0] + 'が減ったため、WordPress反映前で停止しました。');
    }
  });

  uaAssertPrePublishValuesPreserved_(
    uaGetPrePublishAttributeValues_(before, 'href'),
    uaGetPrePublishAttributeValues_(after, 'href'),
    'リンク'
  );
  uaAssertPrePublishValuesPreserved_(
    uaGetPrePublishAttributeValues_(before, 'src'),
    uaGetPrePublishAttributeValues_(after, 'src'),
    '画像URL'
  );

  const beforeHrefs = uaCountPrePublishValues_(uaGetPrePublishAttributeValues_(before, 'href'));
  const allowedHrefs = uaCountPrePublishValues_(
    Object.keys(beforeHrefs).concat((allowedNewUrls || []).map(uaNormalizePrePublishUrl_))
  );
  uaGetPrePublishAttributeValues_(after, 'href').forEach(function(url) {
    if (!allowedHrefs[url]) {
      throw new Error('確認できない新しいURLが追加されたため、WordPress反映前で停止しました: ' + url);
    }
  });

  const unbalancedBlocks = uaFindPrePublishUnbalancedBlocks_(after);
  if (unbalancedBlocks.length) {
    throw new Error('修正後のWordPressブロック構造に不整合があります: ' + unbalancedBlocks.join(' / '));
  }
}

function uaCountPrePublishToken_(text, token) {
  if (!token) return 0;
  return String(text || '').split(token).length - 1;
}

function uaGetPrePublishAttributeValues_(html, attributeName) {
  const regex = attributeName === 'src'
    ? /\bsrc=["']([^"']+)["']/gi
    : /\bhref=["']([^"']+)["']/gi;
  const values = [];
  let match;
  while ((match = regex.exec(String(html || ''))) !== null) {
    const value = uaNormalizePrePublishUrl_(match[1]);
    if (value) values.push(value);
  }
  return values;
}

function uaNormalizePrePublishUrl_(value) {
  return String(value || '')
    .trim()
    .replace(/&amp;/g, '&')
    .replace(/\/$/, '');
}

function uaCountPrePublishValues_(values) {
  return (values || []).reduce(function(counts, value) {
    const normalized = uaNormalizePrePublishUrl_(value);
    if (normalized) counts[normalized] = (counts[normalized] || 0) + 1;
    return counts;
  }, {});
}

function uaAssertPrePublishValuesPreserved_(beforeValues, afterValues, label) {
  const beforeCounts = uaCountPrePublishValues_(beforeValues);
  const afterCounts = uaCountPrePublishValues_(afterValues);
  Object.keys(beforeCounts).forEach(function(value) {
    if ((afterCounts[value] || 0) < beforeCounts[value]) {
      throw new Error('修正処理で既存の' + label + 'が削除・変更されたため停止しました: ' + value);
    }
  });
}

function uaExtractPrePublishUrlsFromText_(text) {
  const matches = String(text || '').match(/https?:\/\/[^\s<>"'\]\[(){}、。]+/gi) || [];
  return matches.map(uaNormalizePrePublishUrl_).filter(Boolean);
}

function uaFormatPrePublishRevisionReport_(revision, ruleCheck, modelLabel, originalReport) {
  const lines = [
    '【公開前チェック修正（1回）】',
    '実行: ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
    modelLabel ? '使用モデル: ' + modelLabel : '',
    '修正方針: 検出語の一律置換は行わず、本文全体と前後の文脈を判断',
    ''
  ].filter(function(line) { return line !== ''; });

  uaPushPrePublishChangeList_(lines, '実際に修正した箇所', revision.appliedChanges, 'change');
  uaPushPrePublishChangeList_(lines, '文脈上適切なので見送った指摘', revision.skippedSuggestions, '');
  uaPushPrePublishChangeList_(lines, '手動で根拠確認する箇所', revision.manualConfirmationNeeded, '');
  lines.push('');
  lines.push('▼修正後の機械チェック');
  lines.push('NG: ' + ruleCheck.critical.length + '件 / 要確認: ' + ruleCheck.warnings.length + '件 / OK: ' + ruleCheck.ok.length + '件');
  lines.push(
    '本文文字数目安: ' + ruleCheck.stats.bodyLength +
    ' / H2: ' + ruleCheck.stats.h2Count +
    ' / 本文内画像: ' + ruleCheck.stats.imageCount +
    ' / 外部出典リンク: ' + ruleCheck.stats.externalSourceLinkCount
  );
  uaPushPrePublishList_(lines, 'NG', ruleCheck.critical);
  uaPushPrePublishList_(lines, '要確認', ruleCheck.warnings);
  uaPushPrePublishList_(lines, 'OK', ruleCheck.ok);
  lines.push('');
  lines.push('▼修正前の公開前チェック');
  lines.push(String(originalReport || '').slice(0, 20000));
  return lines.join('\n');
}

function uaPushPrePublishChangeList_(lines, title, values, changeKey) {
  const list = Array.isArray(values) ? values : [];
  lines.push('【' + title + '】');
  if (!list.length) {
    lines.push('・なし');
    return;
  }
  list.slice(0, 20).forEach(function(item) {
    if (typeof item === 'string') {
      lines.push('・' + item);
      return;
    }
    const parts = [String(item && item.target || '対象不明'), String(item && item.reason || '')];
    if (changeKey && item && item[changeKey]) parts.push(String(item[changeKey]));
    lines.push('・' + parts.filter(Boolean).join('｜'));
  });
}

function uaPickPrePublishVerdict_(ruleCheck) {
  if (ruleCheck.critical.length) return '公開前に修正必須';
  if (ruleCheck.warnings.length >= 6) return '要確認';
  if (ruleCheck.warnings.length) return '軽微修正で公開可';
  return '公開OK';
}

function uaPushPrePublishList_(lines, title, values) {
  const list = Array.isArray(values) ? values : [];
  lines.push('【' + title + '】');
  if (!list.length) {
    lines.push('・なし');
    return;
  }
  list.slice(0, 20).forEach(function(value) {
    lines.push('・' + String(value));
  });
}

function uaPushPrePublishFixes_(lines, fixes) {
  const list = Array.isArray(fixes) ? fixes : [];
  lines.push('【修正案】');
  if (!list.length) {
    lines.push('・なし');
    return;
  }
  list.slice(0, 8).forEach(function(fix) {
    if (typeof fix === 'string') {
      lines.push('・' + fix);
      return;
    }
    lines.push('・' + String(fix.target || '対象不明') + '｜' + String(fix.reason || '') + '｜' + String(fix.suggestion || ''));
  });
}

function uaPushPrePublishRatings_(lines, ratings) {
  if (!ratings || typeof ratings !== 'object') return;
  const labels = {
    titleAppeal: 'タイトルの引き',
    introStrength: '導入',
    targetClarity: 'ターゲット明確さ',
    structureClarity: '構成',
    specificity: '具体性',
    readability: '読みやすさ',
    lowAiSmell: 'AIっぽさの少なさ',
    warmth: '人間味',
    seoBasics: 'SEO基本',
    uniqueness: '独自性',
    ctaDesign: 'CTA',
    reliability: '信頼性'
  };
  lines.push('【項目別評価】');
  Object.keys(labels).forEach(function(key) {
    if (ratings[key] !== undefined && ratings[key] !== null) {
      lines.push('・' + labels[key] + ': ' + ratings[key] + '/5');
    }
  });
}

function uaExtractPrePublishH2List_(body) {
  const result = [];
  const regex = /<h2\b[^>]*>([\s\S]*?)<\/h2>/gi;
  let match;
  while ((match = regex.exec(String(body || ''))) !== null) {
    result.push(uaStripPrePublishHtml_(match[1]).trim());
  }
  return result.filter(Boolean);
}

function uaStripPrePublishHtml_(html) {
  return String(html || '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function uaFindPrePublishFaqHeadingIssues_(body) {
  const html = String(body || '');
  const bounds = uaFindFaqSectionBounds_(html);
  if (!bounds) return [];

  const section = html.slice(bounds.start, bounds.end);
  const h4Count = (section.match(/<h4\b[^>]*>/gi) || []).length;
  const level4Count = (section.match(/<!--\s*wp:heading\b[\s\S]*?"level"\s*:\s*4\b[\s\S]*?-->/gi) || []).length;
  const issueCount = Math.max(h4Count, level4Count);
  if (!issueCount) return [];

  return [
    'FAQの質問見出しがH4です（' + issueCount + '件）。H2「よくある質問」直下の質問はH3にしてください。'
  ];
}

function uaFindPrePublishDuplicateItems_(items) {
  const seen = {};
  const dupes = [];
  (items || []).forEach(function(item) {
    const key = String(item || '').trim();
    if (!key) return;
    if (seen[key] && dupes.indexOf(key) === -1) dupes.push(key);
    seen[key] = true;
  });
  return dupes;
}

function uaCountPrePublishImages_(body) {
  const text = String(body || '');
  const wpImages = (text.match(/<!--\s*wp:image\b/gi) || []).length;
  const htmlImages = (text.match(/<img\b/gi) || []).length;
  return Math.max(wpImages, htmlImages);
}

function uaFindPrePublishDuplicateRelLinks_(body) {
  const result = [];
  const regex = /<a\b[^>]*\brel=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = regex.exec(String(body || ''))) !== null) {
    const rels = String(match[1] || '').split(/\s+/).filter(Boolean);
    const dupes = uaFindPrePublishDuplicateItems_(rels);
    if (dupes.length) result.push(dupes.join(', '));
  }
  return result;
}

function uaFindPrePublishUnbalancedBlocks_(body) {
  const text = String(body || '');
  const blockNames = [
    'cocoon-blocks/tab-caption-box-1',
    'cocoon-blocks/button-wrap-1',
    'cocoon-blocks/blogcard',
    'cocoon-blocks/info-box',
    'image',
    'list',
    'paragraph',
    'heading'
  ];
  const result = [];
  blockNames.forEach(function(name) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const openCount = (text.match(new RegExp('<!--\\s*wp:' + escaped + '\\b', 'g')) || []).length;
    const closeCount = (text.match(new RegExp('<!--\\s*/wp:' + escaped + '\\s*-->', 'g')) || []).length;
    if (openCount !== closeCount) {
      result.push(name + '（開始' + openCount + ' / 終了' + closeCount + '）');
    }
  });
  return result;
}

function uaFindPrePublishLongSections_(body) {
  const text = String(body || '');
  const warnings = [];
  const h2Regex = /<h2\b[^>]*>[\s\S]*?<\/h2>/gi;
  const matches = [];
  let match;
  while ((match = h2Regex.exec(text)) !== null) {
    matches.push({ index: match.index, end: h2Regex.lastIndex, title: uaStripPrePublishHtml_(match[0]) });
  }
  matches.forEach(function(item, index) {
    const next = matches[index + 1] && matches[index + 1].index || text.length;
    const sectionText = uaStripPrePublishHtml_(text.slice(item.end, next));
    if (sectionText.length > 1800) {
      warnings.push('H2「' + item.title + '」の本文が長めです（約' + sectionText.length + '文字）。途中に小見出しや箇条書きを入れると読みやすくなります。');
    }
  });
  return warnings.slice(0, 5);
}

function uaFindPrePublishPhraseHits_(body) {
  const text = uaStripPrePublishHtml_(body);
  const phrases = ['重要です', '大切です', 'おすすめします', '可能性があります', '場合があります', 'と言えるでしょう', '確認しておくと安心です', '状況に応じて判断しましょう'];
  const hits = [];
  phrases.forEach(function(phrase) {
    const count = (text.match(new RegExp(phrase, 'g')) || []).length;
    if (count >= 2) hits.push(phrase + '（' + count + '回）');
  });
  return hits.slice(0, 8);
}

function uaFindPrePublishReliabilityClaims_(body) {
  const text = uaStripPrePublishHtml_(body);
  const pattern = /(道路交通法|道路運送車両法|法令|保安基準|制度|補助金|税制|安全基準|事故|故障率|保証(?:期間|対象|条件|範囲|対象外)|メーカー(?:仕様|公表|公式)|取扱説明書|対応可否|適合|価格|料金|費用|相場|[0-9０-９][^。！？!?\n]{0,10}(?:円|万円|%|％|年|か月|ヶ月|km|kg|台))/;
  const result = [];
  const seen = {};
  const sentences = String(text || '').match(/[^。！？!?]+[。！？!?]?/g) || [];
  sentences.forEach(function(rawSentence) {
    const sentence = String(rawSentence || '').trim();
    if (!sentence || !pattern.test(sentence)) return;
    const snippet = sentence.length > 140 ? sentence.slice(0, 139).trim() + '…' : sentence;
    if (!seen[snippet]) {
      seen[snippet] = true;
      result.push(snippet);
    }
  });
  return result.slice(0, 12);
}

function uaCountPrePublishExternalSourceLinks_(body, rowData) {
  const affiliateUrl = uaNormalizePrePublishUrl_(rowData && rowData.affiliateUrl || '');
  const siteHost = uaGetPrePublishSiteHost_(rowData);
  const withoutBlogCards = String(body || '').replace(
    /<!--\s*wp:cocoon-blocks\/blogcard\b[\s\S]*?<!--\s*\/wp:cocoon-blocks\/blogcard\s*-->/gi,
    ''
  );
  const urls = [];
  const anchorRegex = /<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = anchorRegex.exec(withoutBlogCards)) !== null) {
    const tag = String(match[0] || '');
    const url = uaNormalizePrePublishUrl_(match[1]);
    if (!/^https?:\/\//i.test(url)) continue;
    if (affiliateUrl && url === affiliateUrl) continue;
    if (/\brel=["'][^"']*\b(?:sponsored|affiliate)\b/i.test(tag)) continue;
    const host = uaExtractPrePublishHost_(url);
    if (siteHost && host === siteHost) continue;
    if (urls.indexOf(url) === -1) urls.push(url);
  }
  return urls.length;
}

function uaGetPrePublishSiteHost_(rowData) {
  const editUrlHost = uaExtractPrePublishHost_(rowData && rowData.wpEditUrl || '');
  if (editUrlHost) return editUrlHost;
  try {
    const appConfig = uaGetAppConfigByLabel_(rowData && rowData.appType);
    const wpConfig = appConfig ? uaGetWpConfig_(appConfig) : null;
    return uaExtractPrePublishHost_(wpConfig && wpConfig.siteUrl || '');
  } catch (e) {
    return '';
  }
}

function uaExtractPrePublishHost_(url) {
  const match = String(url || '').trim().match(/^https?:\/\/([^\/:?#]+)/i);
  return match ? String(match[1] || '').toLowerCase().replace(/^www\./, '') : '';
}

function uaFindPrePublishStrongClaims_(body) {
  const text = uaStripPrePublishHtml_(body);
  const rules = [
    { label: '絶対', regex: /絶対/ },
    { label: '必ず', regex: /必ず/ },
    { label: '100%', regex: /(?:100%|１００％)/ },
    { label: '完全', regex: /完全/ },
    { label: '確実', regex: /確実/ },
    { label: '最安', regex: /最安/ },
    { label: '誰でも', regex: /誰でも/ },
    { label: '永久', regex: /永久/ },
    { label: '保証する表現', regex: /保証(?:します|されます|できます)(?!か)/ }
  ];
  const hits = [];
  const seen = {};
  const sentences = String(text || '').match(/[^。！？!?]+[。！？!?]?/g) || [];

  sentences.some(function(rawSentence) {
    const sentence = String(rawSentence || '').trim();
    if (!sentence) return false;

    const labels = rules.filter(function(rule) {
      return rule.regex.test(sentence);
    }).map(function(rule) {
      return rule.label;
    });

    if (!labels.length) return false;

    const snippet = sentence.length > 180
      ? sentence.slice(0, 179).trim() + '…'
      : sentence;
    const key = labels.join('|') + '|' + snippet;
    if (!seen[key]) {
      seen[key] = true;
      hits.push('検出語「' + labels.join('・') + '」: ' + snippet);
    }

    return hits.length >= 8;
  });

  return hits;
}
