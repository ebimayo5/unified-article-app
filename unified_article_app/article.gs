let UA_LAST_RAKUTEN_STATUS = '';
let UA_LAST_RAKUTEN_EFFECTIVE_PRODUCT_PLAN = null;
let UA_LAST_RAKUTEN_QUERY = '';
const UA_NAVIOKUN_INTRO_URL = 'https://ebimayo5.com/archives/naviokun-reputation/';

function uaRemoveRedundantAffiliateDisclosure_(body) {
  // Cocoon displays the site's affiliate disclosure automatically. Keep the
  // generated article body free of a second, CTA-local disclosure paragraph.
  return String(body || '').replace(
    /<p\b[^>]*>\s*(?:<strong\b[^>]*>)?\s*(?:PR[：:]\s*)?本記事(?:には|に|は)アフィリエイト広告を含みます。?\s*(?:<\/strong>)?\s*<\/p>\s*/gi,
    ''
  );
}

function uaNormalizeStandardPurchaseCopy_(text) {
  return String(text || '')
    .replace(/初回は少量パックから試したい読者が比較しやすいため[。．.]?/g, '初回からまとめ買いせず、通常販売単位で比較しやすいため。')
    .replace(/初回は少量パックから試したい/g, '初回からまとめ買いせず、通常販売単位で比較しやすいため')
    .replace(/初回のまとめ買いで失敗しないための試し方/g, '初回購入で失敗しないための確認方法')
    .replace(/少量パック(?:から|で)(?:試す|試せる|始める|確認する)/g, '通常販売単位で確認する')
    .replace(/少量から(?:試す|始める)/g, '通常販売単位で確認する')
    .replace(/少量購入で/g, '通常販売単位で')
    .replace(/初回を試用にする/g, '初回からまとめ買いしない')
    .replace(/少量パック/g, '通常販売単位');
}

function uaNormalizeUnsupportedTrialGuidance_(body, productPlan) {
  const plan = uaNormalizeProductPlan_(productPlan);
  if (!plan || plan.purchaseScale !== 'standard') return String(body || '');
  return uaNormalizeStandardPurchaseCopy_(body);
}

function uaNormalizeProductPlan_(value) {
  let source = value;
  if (typeof source === 'string') {
    try {
      source = JSON.parse(source);
    } catch (e) {
      source = null;
    }
  }
  if (!source || typeof source !== 'object') return null;

  function cleanText(input, maxLength) {
    return String(input || '')
      .replace(/[<>\r\n]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxLength || 100);
  }

  function cleanList(input) {
    const values = Array.isArray(input) ? input : String(input || '').split(/[,、]/);
    const seen = {};
    return values.map(function(item) { return cleanText(item, 40); }).filter(function(item) {
      if (!item || seen[item]) return false;
      seen[item] = true;
      return true;
    }).slice(0, 5);
  }

  let purchaseScale = cleanText(source.purchase_scale || source.purchaseScale, 20).toLowerCase();
  if (!/^(trial|standard|bulk|unspecified)$/.test(purchaseScale)) {
    // Do not infer that a small trial SKU exists from AI-written CTA copy.
    // Normal retail quantity is the safe default unless a scale was explicitly planned.
    purchaseScale = 'standard';
  }

  let ctaReason = cleanText(source.cta_reason || source.ctaReason, 140);
  if (purchaseScale === 'standard') {
    ctaReason = cleanText(uaNormalizeStandardPurchaseCopy_(ctaReason), 140);
  }

  return {
    shouldInsert: source.should_insert === true || source.shouldInsert === true || String(source.should_insert || source.shouldInsert).toLowerCase() === 'true',
    primaryProduct: cleanText(source.primary_product || source.primaryProduct, 60),
    marketQuery: cleanText(source.market_query || source.marketQuery, 80),
    purpose: cleanText(source.purpose, 120),
    mustHave: cleanList(source.must_have || source.mustHave),
    exclude: cleanList(source.exclude),
    purchaseScale: purchaseScale,
    requiredFeatures: cleanList(source.required_features || source.requiredFeatures),
    excludedFeatures: cleanList(source.excluded_features || source.excludedFeatures),
    benefit: cleanText(source.benefit, 140),
    ctaReason: ctaReason
  };
}

function uaCleanMainKeywordProductQuery_(keyword) {
  return String(keyword || '')
    .replace(/[「」『』【】（）()！？!?]/g, ' ')
    .replace(/(?:暮らし|生活|家庭|家族|自宅|部屋)に合う(?:の)?は/g, ' ')
    .replace(/どっち|どちら|おすすめ|ランキング|比較|選び方|口コミ|評判|レビュー/g, ' ')
    .replace(/後悔(?:する|しない)?|デメリット|メリット|いらない|必要(?:か)?|不要/g, ' ')
    .replace(/どこが安い|どこで買う|どこに売ってる|価格|値段|費用|相場/g, ' ')
    .replace(/使い方|置き方|置き場所|判断軸|見分け方|注意点|確認ポイント/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uaGetMainKeywordProductProfile_(rowData, appConfig) {
  if (!appConfig || appConfig.key !== 'home') return null;

  const keyword = String(rowData && rowData.mainInput || '').replace(/\s+/g, ' ').trim();
  if (!keyword) return null;
  const requiredBrands = uaExtractRequiredProductBrands_(keyword);

  const catalog = [
    {
      pattern: /(?:Yogibo|ヨギボー|人をダメにするソファ|体にフィットするソファ|ビーズソファ|ビーズクッション)/i,
      query: 'ビーズソファ 本体',
      label: 'ビーズソファ',
      queries: ['無印良品 体にフィットするソファ 本体', 'Yogibo ビーズソファ 本体', 'ビーズソファ 本体']
    },
    {
      pattern: /室内(?:用)?(?:ジャングルジム|遊具)|ジャングルジム/,
      query: '室内ジャングルジム',
      label: '室内ジャングルジム',
      queries: ['室内ジャングルジム 折りたたみ', '室内ジャングルジム すべり台', '室内ジャングルジム コンパクト']
    },
    {
      pattern: /シーリングライト|天井照明|調色(?:機能)?(?:付き)?照明/,
      query: 'シーリングライト 調色',
      label: '調色対応シーリングライト',
      queries: ['シーリングライト 調色', 'シーリングライト 調光 調色', 'シーリングライト 昼光色 電球色']
    },
    {
      pattern: /窓(?:の)?前.*テレビ|テレビ.*窓(?:の)?前/,
      query: 'テレビスタンド 配線収納',
      label: '配線を整理しやすいテレビスタンド',
      queries: ['テレビスタンド 配線収納', 'テレビ台 ロータイプ', 'テレビ 配線カバー']
    },
    {
      pattern: /テレビ(?:\s*\d+台)?/,
      query: 'テレビ 省スペース',
      label: '省スペースで置けるテレビ',
      queries: ['テレビ 省スペース', 'テレビ 小型', 'テレビ']
    },
    {
      pattern: /洗濯機.*(?:隙間|すき間)|(?:隙間|すき間).*洗濯機/,
      query: '洗濯機 隙間 ガード',
      label: '洗濯機まわりの隙間対策用品',
      queries: ['洗濯機 隙間 ガード', '洗濯機 防水パン 隙間 カバー', '洗濯機 排水口 防臭 キャップ']
    },
    {
      pattern: /キッチン.*(?:汚れ防止シート|保護シート)|(?:汚れ防止シート|保護シート).*キッチン/,
      query: 'キッチン 汚れ防止シート',
      label: 'キッチン用汚れ防止シート',
      queries: ['キッチン 汚れ防止シート', 'キッチン 壁 保護シート', 'キッチン 油はね ガード']
    }
  ];
  const troubleshootingSignal = /映らない|映らず|見れない|音が出ない|音が鳴らない|つかない|点かない|反応しない|動かない|接続できない|繋がらない|繋がりません|故障|直し方|修理|エラー|初期設定|設定方法|使い方|説明書|原因|対処法/;
  const matched = catalog.find(function(item) {
    return item.pattern.test(keyword) && !troubleshootingSignal.test(keyword);
  });
  if (matched) {
    return {
      query: matched.query,
      label: matched.label,
      queries: matched.queries.slice(0, 3),
      requiredBrands: requiredBrands,
      comparison: /比較|どっち|どちら|選び方|おすすめ|対|vs|VS/.test(keyword),
      source: 'catalog'
    };
  }

  const productSignal = /(ソファ|クッション|チェア|椅子|いす|テーブル|机|デスク|ベッド|マットレス|布団|枕|テレビ|モニター|照明|ライト|カーテン|ブラインド|ラグ|カーペット|チェスト|ラック|棚|ワゴン|収納ケース|収納ボックス|収納用品|洗濯機|冷蔵庫|掃除機|炊飯器|電子レンジ|トースター|食洗機|乾燥機|エアコン|除湿機|除湿器|加湿器|サーキュレーター|扇風機|ヒーター|空気清浄機|物干し|ベビーゲート|見守りカメラ|防災用品|スロープ|サンシェード|日よけ|トイレブラシ|掃除用品|汚れ防止シート|保護シート|ジャングルジム|室内遊具|家電|家具|暮らし用品)/i;
  const productMatch = productSignal.exec(keyword);
  if (!productMatch) return null;
  const hasPurchaseIntent = /比較|どっち|どちら|おすすめ|ランキング|選び方|口コミ|評判|レビュー|後悔|デメリット|メリット|いらない|必要|不要|どこで買う|どこに売ってる|価格|値段|費用|相場|購入|買う/.test(keyword);
  const compactKeyword = keyword.replace(/[\s　・、,／/|｜]/g, '');
  const compactProduct = String(productMatch[0] || '').replace(/[\s　]/g, '');
  const isShortProductKeyword = compactKeyword.length <= compactProduct.length + 4;
  if (!hasPurchaseIntent && !isShortProductKeyword) return null;

  const query = uaCleanMainKeywordProductQuery_(keyword);
  if (!query || query.length < 2) return null;
  return {
    query: query,
    label: query,
    queries: [query],
    requiredBrands: requiredBrands,
    comparison: /比較|どっち|どちら|選び方|おすすめ|ランキング|対|vs|VS/.test(keyword),
    source: 'keyword'
  };
}

function uaGetProductBrandDefinitions_() {
  return [
    { key: 'yogibo', label: 'Yogibo', aliases: ['yogibo', 'ヨギボー'] },
    { key: 'muji', label: '無印良品', aliases: ['無印良品', 'muji'] },
    { key: 'nitori', label: 'ニトリ', aliases: ['ニトリ', 'nitori'] },
    { key: 'iris_ohyama', label: 'アイリスオーヤマ', aliases: ['アイリスオーヤマ', 'iris ohyama'] },
    { key: 'panasonic', label: 'パナソニック', aliases: ['パナソニック', 'panasonic'] },
    { key: 'hitachi', label: '日立', aliases: ['日立', 'hitachi'] },
    { key: 'sharp', label: 'シャープ', aliases: ['シャープ', 'sharp'] },
    { key: 'daikin', label: 'ダイキン', aliases: ['ダイキン', 'daikin'] },
    { key: 'toshiba', label: '東芝', aliases: ['東芝', 'toshiba'] },
    { key: 'mitsubishi_electric', label: '三菱電機', aliases: ['三菱電機', 'mitsubishi electric'] },
    { key: 'balmuda', label: 'バルミューダ', aliases: ['バルミューダ', 'balmuda'] },
    { key: 'yamazaki', label: '山崎実業', aliases: ['山崎実業'] },
    { key: 'dyson', label: 'Dyson', aliases: ['dyson', 'ダイソン'] },
    { key: 'ikea', label: 'IKEA', aliases: ['ikea', 'イケア'] }
  ];
}

function uaExtractRequiredProductBrands_(text) {
  const source = String(text || '').toLowerCase();
  return uaGetProductBrandDefinitions_().filter(function(brand) {
    return brand.aliases.some(function(alias) {
      return source.indexOf(String(alias || '').toLowerCase()) !== -1;
    });
  }).map(function(brand) {
    return {
      key: brand.key,
      label: brand.label,
      aliases: brand.aliases.slice()
    };
  });
}

function uaProductNameMatchesBrand_(productName, brand) {
  const source = String(productName || '').toLowerCase();
  return !!(brand && Array.isArray(brand.aliases) && brand.aliases.some(function(alias) {
    return source.indexOf(String(alias || '').toLowerCase()) !== -1;
  }));
}

function uaBuildMainKeywordProductPlan_(productProfile, productPlan) {
  if (!productProfile) return uaNormalizeProductPlan_(productPlan);
  const plan = uaNormalizeProductPlan_(productPlan) || {};
  return uaNormalizeProductPlan_(Object.assign({}, plan, {
    shouldInsert: true,
    primaryProduct: productProfile.label,
    marketQuery: productProfile.query,
    // 比較記事ではAIの比較観点（サイズ・取扱表示など）が本文で確認する条件として
    // requiredFeaturesに入りがちで、楽天の商品名に全語が含まれる必須条件として
    // 誤って扱われるとブランド違いの商品まで弾かれる。比較記事のときだけ無効化し、
    // 通常の商品記事ではAIが出した必須条件のフィルタリングをそのまま活かす。
    requiredFeatures: productProfile.comparison ? [] : plan.requiredFeatures,
    purpose: plan.purpose || 'メインキーワードの商品を比較し、暮らしに合う候補を選ぶ',
    purchaseScale: plan.purchaseScale || 'standard',
    benefit: plan.benefit || '本文の判断条件に合う商品候補を具体的に比較しやすくなります',
    ctaReason: plan.ctaReason || productProfile.label + 'のサイズや仕様を比較してから選べます'
  }));
}

function uaCanUseSupplementalProductPlan_(productPlan, body, rowData, appConfig) {
  const plan = uaNormalizeProductPlan_(productPlan);
  if (!plan || plan.shouldInsert || !appConfig || appConfig.key !== 'home') return false;

  const notes = String(rowData && rowData.affiliateNotes || '');
  if (/楽天バナーなし|楽天なし/.test(notes)) return false;

  const mainInput = String(rowData && rowData.mainInput || '');
  const inferredQuery = uaSelectRakutenKeywordFallbackQuery_(mainInput, appConfig.key);
  if (!plan.primaryProduct && !plan.marketQuery && !inferredQuery) return false;
  const articleText = [mainInput, body, plan.purpose, plan.benefit].join(' ');
  const productText = [plan.primaryProduct, plan.marketQuery, inferredQuery].join(' ');
  const productTerms = productText.split(/[\s　,，、\/／・|｜]+/).filter(function(term) {
    return term.length >= 2 && !/^(家庭用|おすすめ|比較|対策|商品)$/.test(term);
  });
  const directlyRelated = productTerms.some(function(term) {
    return articleText.indexOf(term) !== -1;
  });

  const supportiveContext = /(後悔|やめた|デメリット|不便|困る|手間|負担|収納|掃除|家事|暑さ|寒さ|遮光|日差し|湿気|カビ|換気|防災|子育て|車いす|動線|照明|カーテン|マット|家電)/.test(articleText);
  const nonProductCore = /(制度|法律|法令|税金|ローン|保険|補助金|申請|売却|査定|工賃|施工方法|契約|保証|事故|火災|故障|修理)/.test(mainInput);

  return directlyRelated || supportiveContext && !nonProductCore;
}

function uaBuildSupplementalProductPlan_(productPlan, rowData, appConfig) {
  const plan = uaNormalizeProductPlan_(productPlan);
  if (!plan) return null;
  const mainInput = String(rowData && rowData.mainInput || '');
  const inferredQuery = uaSelectRakutenKeywordFallbackQuery_(mainInput, appConfig && appConfig.key);
  const inferredProduct = mainInput
    .replace(/(?:たためない|畳めない|できない|使えない|外れない|動かない|入らない|後悔|やめた|デメリット|いらない|難しい|面倒|おすすめ|比較|口コミ|評判)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const productLabel = plan.primaryProduct || inferredProduct || plan.marketQuery || inferredQuery || '関連商品';
  const hasTroubleAndPrePurchaseIntent = /(たためない|畳めない|できない|使えない|外れない|動かない|入らない|後悔|やめた|デメリット|いらない|難しい|面倒)/.test(mainInput);
  const ctaReason = hasTroubleAndPrePurchaseIntent
    ? '今使っているもので解決できるなら買い替えは不要です。購入前の人や同じ不便を繰り返したくない人は、' + productLabel + 'のサイズや仕様を比較してから選べます'
    : '本文の判断条件に当てはまり、' + productLabel + 'で手間や不便を減らしたい場合は、購入前にサイズや仕様を比較してから選べます';
  return uaNormalizeProductPlan_(Object.assign({}, plan, {
    shouldInsert: true,
    primaryProduct: plan.primaryProduct || productLabel,
    marketQuery: plan.marketQuery || inferredQuery || productLabel,
    benefit: plan.benefit || '自分の条件に合う選択肢を見つけやすくなる',
    ctaReason: ctaReason
  }));
}

function uaEvaluateProductPlanFit_(itemName, productPlan) {
  const plan = uaNormalizeProductPlan_(productPlan);
  if (!plan) return { pass: true, reason: '' };

  const rawName = String(itemName || '');
  const normalizedName = rawName.replace(/[\s　・、,\/／()（）\[\]【】]+/g, '').toLowerCase();
  if (!normalizedName) return { pass: false, reason: '商品名を確認できません' };

  function normalizeFeature(value) {
    return String(value || '')
      .replace(/[\s　・、,\/／()（）\[\]【】]+/g, '')
      .replace(/(?:専用|対応|仕様|タイプ|用|向け|あり|付き)$/g, '')
      .toLowerCase();
  }

  const explicitExcluded = (plan.excludedFeatures || []).map(normalizeFeature).filter(function(term) {
    return term.length >= 2;
  });
  const excludedHit = explicitExcluded.find(function(term) { return normalizedName.indexOf(term) !== -1; });
  if (excludedHit) return { pass: false, reason: '除外条件に一致: ' + excludedHit };

  const explicitRequired = (plan.requiredFeatures || []).map(normalizeFeature).filter(function(term) {
    return term.length >= 2;
  });
  const missingRequired = explicitRequired.find(function(term) { return normalizedName.indexOf(term) === -1; });
  if (missingRequired) return { pass: false, reason: '必須条件を商品名で確認できない: ' + missingRequired };

  const bulkTerms = [
    '大容量', '業務用', 'まとめ買い', '箱買い', 'ケース販売', 'ケース買い', 'セット買い',
    '備蓄', '定期便', 'ふるさと納税'
  ];
  const trialTerms = ['お試し', '少量', '小容量', 'ミニサイズ', '単品', '1個', '1袋', '1パック'];
  const quantityPattern = /(\d{1,3})\s*(?:個|点|本|枚|袋|パック|ロール|巻|箱|セット)/g;
  let quantityMatch;
  let hasBulkQuantity = /\d+\s*(?:個|点|本|枚|袋|パック|ロール|巻|箱)\s*[×xX]\s*\d+/i.test(rawName);
  while (!hasBulkQuantity && (quantityMatch = quantityPattern.exec(rawName)) !== null) {
    hasBulkQuantity = Number(quantityMatch[1]) >= 10;
  }
  if (plan.purchaseScale === 'trial' && (
    bulkTerms.some(function(term) { return rawName.indexOf(term) !== -1; }) || hasBulkQuantity
  )) {
    return { pass: false, reason: '少量試用のCTAに対して大容量・まとめ買い相当の商品です' };
  }
  if (plan.purchaseScale === 'trial' &&
    !trialTerms.some(function(term) { return rawName.indexOf(term) !== -1; })) {
    return { pass: false, reason: '商品名から少量・試用向けの販売単位を確認できません' };
  }
  if (plan.purchaseScale === 'bulk' && trialTerms.some(function(term) { return rawName.indexOf(term) !== -1; })) {
    return { pass: false, reason: 'まとめ買いの意図に対して少量・試用商品です' };
  }
  if (plan.purchaseScale === 'standard' && bulkTerms.some(function(term) { return rawName.indexOf(term) !== -1; })) {
    return { pass: false, reason: '通常購入の意図に対して大容量・業務用・備蓄向けの商品です' };
  }

  const excludeText = (plan.exclude || []).join(' ');
  if (/大容量|まとめ買い|箱買い|ケース買い|業務用/.test(excludeText) &&
    (bulkTerms.some(function(term) { return rawName.indexOf(term) !== -1; }) || hasBulkQuantity)) {
    return { pass: false, reason: '除外条件に反する大容量・まとめ買い商品です' };
  }
  if (/少量|小容量|お試し|単品/.test(excludeText) &&
    trialTerms.some(function(term) { return rawName.indexOf(term) !== -1; })) {
    return { pass: false, reason: '除外条件に反する少量・試用商品です' };
  }
  return { pass: true, reason: '' };
}

function uaAttachProductPlanMarker_(body, productPlan) {
  const html = String(body || '');
  const plan = uaNormalizeProductPlan_(productPlan);
  if (!plan) return html;
  const marker = '<!-- UA_PRODUCT_PLAN:' + encodeURIComponent(JSON.stringify(plan)) + ' -->';
  return marker + '\n' + uaStripProductPlanMarker_(uaNormalizeUnsupportedTrialGuidance_(html, plan));
}

function uaStripProductPlanMarker_(body) {
  return String(body || '')
    .replace(/<p\b[^>]*>\s*<!--\s*UA_PRODUCT_PLAN:[^>]+-->\s*<\/p>\s*/gi, '')
    .replace(/<!--\s*UA_PRODUCT_PLAN:[^>]+-->\s*/gi, '');
}

function uaPreserveProductPlanMarker_(visibleBody, storedBody) {
  const visible = String(visibleBody || '');
  if (!visible.trim() || uaExtractProductPlan_(visible)) return visible;
  const storedPlan = uaExtractProductPlan_(storedBody);
  return storedPlan ? uaAttachProductPlanMarker_(visible, storedPlan) : visible;
}

function uaExtractProductPlan_(body) {
  const match = /<!--\s*UA_PRODUCT_PLAN:([^\s>]+)\s*-->/i.exec(String(body || ''));
  if (!match || !match[1]) return null;
  try {
    return uaNormalizeProductPlan_(JSON.parse(decodeURIComponent(match[1])));
  } catch (e) {
    return null;
  }
}

function uaRunArticleFromPanel(data) {
  uaSaveActiveRowData(data || {});

  const sheet = uaGetSheetForData_(data || {});
  const row = Number(data && data.row) || sheet.getActiveCell().getRow();
  const rowData = uaBuildRowData_(sheet, row);
  rowData.automaticPosting = !!(data && data.automaticPosting);
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
    const result = uaCallArticleGenerationJson_(promptText, provider, sheet, row);
    const resultJson = result && result.data;

    if (!resultJson || !resultJson.body || !resultJson.title_ideas) {
      sheet.getRange(row, UA_COLUMNS.status).setValue(UA_STATUS_STOPPED);
      throw new Error('生成結果に必要な項目がありません。');
    }

    const bodyWithProductPlan = uaAttachProductPlanMarker_(
      uaFixGeneratedHtml_(resultJson.body),
      resultJson.product_plan || resultJson.productPlan
    );
    const body = uaRemoveRedundantAffiliateDisclosure_(uaNormalizeAnchorRelAttributes_(uaApplyRakutenAffiliateBanner_(
      uaApplyNaviokunIntroSet_(
        uaApplyManagedAffiliateCta_(
          uaApplyYmylNotice_(
            uaNormalizeFaqHeadingLevels_(bodyWithProductPlan),
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
    if (result && result.backgroundStateKey) {
      uaClearArticleBackgroundState_(result.backgroundStateKey);
    }
    return nextData;
  } catch (e) {
    if (e && e.uaArticleBackgroundPending) {
      sheet.getRange(row, UA_COLUMNS.status).setValue(UA_STATUS_GENERATING);
      SpreadsheetApp.flush();
      throw e;
    }
    sheet.getRange(row, UA_COLUMNS.status).setValue(UA_STATUS_STOPPED);
    sheet.getRange(row, UA_COLUMNS.factCheckPoints).setValue('・記事生成停止理由｜' + e.toString());
    throw e;
  }
}

function uaRunArticleFromWeb(data) {
  return uaRunArticleFromPanel(data || {});
}

function uaCancelArticleBackgroundFromWeb(data) {
  const input = data || {};
  const sheet = uaGetSheetForData_(input);
  const row = Number(input.row) || sheet.getActiveCell().getRow();
  const stateKey = uaGetArticleBackgroundStateKey_(sheet, row);
  const state = uaLoadArticleBackgroundState_(stateKey);
  const responseId = String(state && state.responseId || '').trim();
  let result = { cancelled: false, status: responseId ? 'cancel_not_requested' : 'missing' };

  if (responseId) {
    try {
      result = uaCancelOpenAiBackgroundResponse_(responseId);
    } catch (e) {
      result = {
        cancelled: false,
        status: 'cancel_failed',
        message: String(e && e.message || e)
      };
    }
  }

  if (state) {
    state.phase = result && result.cancelled ? 'cancelled' : 'cancel_requested';
    state.cancelledAt = new Date().toISOString();
    state.cancelResult = result;
    uaSaveArticleBackgroundState_(stateKey, state);
  }

  const currentStatus = String(sheet.getRange(row, UA_COLUMNS.status).getValue() || '').trim();
  if (currentStatus === UA_STATUS_GENERATING) {
    sheet.getRange(row, UA_COLUMNS.status).setValue(UA_STATUS_STOPPED);
  }
  SpreadsheetApp.flush();

  return {
    cancelled: !!(result && result.cancelled),
    responseId: responseId,
    status: String(result && result.status || ''),
    message: responseId
      ? '途中停止しました。保存済みのOpenAI処理にもキャンセル要求を送りました。'
      : '途中停止しました。進行中のOpenAI本文生成はありません。'
  };
}

function uaPrepareArticleBackgroundResumeFromWeb(data) {
  const input = data || {};
  const sheet = uaGetSheetForData_(input);
  const row = Number(input.row) || sheet.getActiveCell().getRow();
  const stateKey = uaGetArticleBackgroundStateKey_(sheet, row);
  const state = uaLoadArticleBackgroundState_(stateKey);
  const cancelResult = state && state.cancelResult;
  const canRestart = !!(
    state &&
    state.phase === 'cancelled' &&
    cancelResult &&
    cancelResult.cancelled
  );

  if (canRestart) {
    uaClearArticleBackgroundState_(stateKey);
  }

  const rowData = uaBuildRowData_(sheet, row);
  rowData.backgroundRestartPrepared = canRestart;
  rowData.message = canRestart
    ? 'キャンセル済みの本文生成を確認しました。保存済みの競合調査・構成案から本文生成を1回だけ再開します。'
    : '保存済みの処理IDを維持したまま停止位置から再開します。';
  return rowData;
}

function uaApplyManagedAffiliateCta_(body, rowData, appConfig) {
  const html = uaRemoveManagedOttocastAffiliateBlock_(
    uaRemoveManagedSubAffiliateBlock_(
      uaRelocateManagedAffiliateTokenByContext_(String(body || ''), rowData, appConfig)
    )
  );
  const spec = uaGetManagedAffiliateCtaSpec_(rowData);
  if (!html || !spec) return html;

  let resultHtml = '';
  if (uaManagedAffiliateCtaAlreadyExists_(html, spec)) {
    resultHtml = uaRemoveManagedAffiliateCtaToken_(html);
  } else {
    const cleanHtml = uaRemoveManagedAffiliateButtonBlocks_(html, spec);
    const tokenMatch = /\[UA_AFFILIATE_CTA[:：]\s*([^\]\r\n]{1,160})\]/i.exec(cleanHtml);
    const ctaText = uaNormalizeManagedAffiliateCtaText_(
      tokenMatch && tokenMatch[1],
      spec.name
    );
    const ctaBlock = uaBuildManagedAffiliateCtaBlock_(spec, ctaText, appConfig);

    if (tokenMatch) {
      resultHtml = uaReplaceManagedAffiliateCtaToken_(cleanHtml, ctaBlock);
    } else {
      const insertionIndex = uaFindManagedAffiliateCtaFallbackIndex_(cleanHtml);
      resultHtml = [
        cleanHtml.slice(0, insertionIndex).trimEnd(),
        ctaBlock,
        cleanHtml.slice(insertionIndex).trimStart()
      ].filter(Boolean).join('\n\n');
    }
  }

  return uaApplyManagedOttocastTextLink_(
    uaApplyManagedSubAffiliateTextLink_(resultHtml, rowData, appConfig, spec),
    rowData,
    appConfig,
    spec
  );
}

function uaApplyManagedSubAffiliateTextLink_(body, rowData, appConfig, mainSpec) {
  const html = uaRemoveManagedSubAffiliateBlock_(body);
  const project = uaGetComplementaryAffiliateProject_(rowData, appConfig, html);
  if (!html || !project) return html;

  const projectUrls = uaExtractUrlsFromAffiliateCode_(project.linkInput || project.url || '');
  if (project.url && projectUrls.indexOf(project.url) === -1) projectUrls.push(project.url);
  if (projectUrls.some(function(url) {
    return url && (html.indexOf(url) !== -1 || html.indexOf(String(url).replace(/&/g, '&amp;')) !== -1);
  })) {
    return html;
  }

  const bounds = uaFindManagedAffiliateCtaBounds_(html, mainSpec);
  if (!bounds) return html;

  const block = uaBuildManagedSubAffiliateBlock_(mainSpec && mainSpec.name, project);
  if (!block) return html;

  return [
    html.slice(0, bounds.end).trimEnd(),
    block,
    html.slice(bounds.end).trimStart()
  ].filter(Boolean).join('\n\n');
}

function uaRemoveManagedSubAffiliateBlock_(body) {
  return String(body || '')
    .replace(/<!--\s*UA_SUB_AFFILIATE_START\s*-->[\s\S]*?<!--\s*UA_SUB_AFFILIATE_END\s*-->/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function uaGetComplementaryAffiliateProject_(rowData, appConfig, body) {
  const isDrive = appConfig && appConfig.key
    ? appConfig.key === 'drive'
    : /DRIVE\s*BASE/i.test(String(rowData && rowData.appType || ''));
  if (!isDrive) return null;

  const mainName = uaNormalizeAffiliateName_(rowData && rowData.affiliateName);
  let subName = '';
  let relevancePattern = null;

  if (/^ガリバー中古車ご提案サービス$/.test(mainName)) {
    subName = 'カーネクスト';
    relevancePattern = /(乗り換え|買い替え|下取り|売却|査定|買取|リセール|手放(?:す|した|し)|今の車|現在の車|愛車)/i;
  } else if (/^カーネクスト$/.test(mainName)) {
    subName = 'ガリバー中古車ご提案サービス';
    relevancePattern = /(乗り換え|買い替え|次の車|次に乗る|購入候補|車選び|希望[^。\n]{0,20}車|中古車[^。\n]{0,20}(?:探|選|買))/i;
  } else {
    return null;
  }

  const context = [
    rowData && rowData.mainInput,
    rowData && rowData.readerMindMemo,
    rowData && rowData.structureMemo,
    String(body || '').replace(/<!--[^]*?-->/g, ' ').replace(/<[^>]+>/g, ' ')
  ].join(' ');
  if (!relevancePattern.test(context)) return null;

  const project = uaReadAffiliateProjectByName_(subName, false);
  if (!project || !project.linkInput || !project.url) return null;
  return project;
}

function uaGetManagedComplementaryAffiliateUrls_(rowData, appConfig, body) {
  const project = uaGetComplementaryAffiliateProject_(rowData, appConfig, body);
  const ottocastProject = uaGetManagedOttocastProject_(rowData, appConfig, body);
  const projects = [project, ottocastProject].filter(Boolean);
  return projects.reduce(function(urls, item) {
    return urls.concat(
      uaExtractUrlsFromAffiliateCode_(item.linkInput || item.url || ''),
      item.url || ''
    );
  }, [])
    .filter(function(url, index, list) {
      return url && list.indexOf(url) === index;
    });
}

function uaApplyManagedOttocastTextLink_(body, rowData, appConfig, mainSpec) {
  const html = uaRemoveManagedOttocastAffiliateBlock_(body);
  const project = uaGetManagedOttocastProject_(rowData, appConfig, html);
  if (!html || !project || !mainSpec) return html;

  if (project.url && (html.indexOf(project.url) !== -1 || html.indexOf(String(project.url).replace(/&/g, '&amp;')) !== -1)) {
    return html;
  }

  const bounds = uaFindManagedAffiliateCtaBounds_(html, mainSpec);
  if (!bounds) return html;
  const block = uaBuildManagedOttocastAffiliateBlock_(project);
  if (!block) return html;

  return [
    html.slice(0, bounds.start).trimEnd(),
    block,
    html.slice(bounds.start).trimStart()
  ].filter(Boolean).join('\n\n');
}

function uaRemoveManagedOttocastAffiliateBlock_(body) {
  return String(body || '')
    .replace(/<!--\s*UA_OTTOCAST_AFFILIATE_START\s*-->[\s\S]*?<!--\s*UA_OTTOCAST_AFFILIATE_END\s*-->/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function uaGetManagedOttocastProject_(rowData, appConfig, body) {
  const isDrive = appConfig && appConfig.key
    ? appConfig.key === 'drive'
    : /DRIVE\s*BASE/i.test(String(rowData && rowData.appType || ''));
  if (!isDrive) return null;

  const mainName = uaNormalizeAffiliateName_(rowData && rowData.affiliateName);
  if (mainName !== 'ナビ男くん') return null;

  const mainInput = String(rowData && rowData.mainInput || '');
  const context = [
    mainInput,
    rowData && rowData.readerMindMemo,
    rowData && rowData.structureMemo,
    String(body || '').replace(/<!--[^]*?-->/g, ' ').replace(/<[^>]+>/g, ' ')
  ].join(' ');
  const directAiBox = /(CarPlay\s*AI\s*Box|AI\s*BOX|AIボックス|オットキャスト|Ottocast)/i.test(context);
  const directProblem = /(アンドロイド\s*ナビ\s*デメリット|ディスプレイオーディオ\s*ミラーリング)/i.test(mainInput);
  if (!directAiBox && !directProblem) return null;

  const project = uaReadAffiliateProjectByName_('ottocast', false);
  if (!project || !project.linkInput || !project.url) return null;
  return project;
}

function uaBuildManagedOttocastAffiliateBlock_(project) {
  const anchorText = 'OttocastでCarPlay AI Boxの対応機種を確認する';
  const source = uaNormalizeAnchorRelAttributes_(
    uaNormalizeAffiliateCodeInput_(project && project.linkInput || '')
  );
  const anchorMatch = /<a\b([^>]*)>([\s\S]*?)<\/a>/i.exec(source);
  let linkHtml = '';
  if (anchorMatch) {
    linkHtml = uaIsAffiliateFreeTextPlaceholder_(anchorMatch[2])
      ? source.replace(anchorMatch[0], '<a' + anchorMatch[1] + '>' + uaEscapeHtml_(anchorText) + '</a>')
      : source;
  }
  if (!linkHtml) return '';

  return [
    '<!-- UA_OTTOCAST_AFFILIATE_START -->',
    '<!-- wp:paragraph -->',
    '<p>有線CarPlay対応車でUSB接続だけで完結させたい場合は、' + linkHtml + '方法があります。' +
      '一方、HDMI増設や後席モニター連携、配線施工まで必要な場合は、この後の専門店相談を選ぶと整理しやすいです。</p>',
    '<!-- /wp:paragraph -->',
    '<!-- UA_OTTOCAST_AFFILIATE_END -->'
  ].join('\n');
}

function uaFindManagedAffiliateCtaBounds_(body, spec) {
  const html = String(body || '');
  if (!spec) return null;
  const markers = uaExtractUrlsFromAffiliateCode_(spec.content || '');
  if (spec.url && markers.indexOf(spec.url) === -1) markers.push(spec.url);
  if (spec.type === 'shortcode' && spec.content) markers.push(String(spec.content).trim());

  const blocks = uaGetManagedAffiliateButtonBlocks_(html);
  for (let i = 0; i < blocks.length; i += 1) {
    const block = String(blocks[i] || '');
    if (markers.some(function(marker) {
      return marker && (block.indexOf(marker) !== -1 || block.indexOf(String(marker).replace(/&/g, '&amp;')) !== -1);
    })) {
      const start = html.indexOf(block);
      return { start: start, end: start + block.length, block: block };
    }
  }
  return null;
}

function uaBuildManagedSubAffiliateBlock_(mainName, project) {
  const isCarnextSub = /^カーネクスト$/.test(String(project && project.name || ''));
  const anchorText = isCarnextSub
    ? 'カーネクストで今の車の査定条件を確認する'
    : 'ガリバーで希望に合う中古車の提案を確認する';
  const source = uaNormalizeAnchorRelAttributes_(
    uaNormalizeAffiliateCodeInput_(project && project.linkInput || '')
  );
  const anchorMatch = /<a\b([^>]*)>([\s\S]*?)<\/a>/i.exec(source);
  let linkHtml = '';

  if (anchorMatch) {
    linkHtml = uaIsAffiliateFreeTextPlaceholder_(anchorMatch[2])
      ? source.replace(anchorMatch[0], '<a' + anchorMatch[1] + '>' + uaEscapeHtml_(anchorText) + '</a>')
      : source;
  } else if (/^https?:\/\/[^\s"'<>]+$/i.test(String(project && project.url || ''))) {
    linkHtml = '<a href="' + String(project.url).trim() + '" target="_blank" rel="nofollow sponsored noopener">' +
      uaEscapeHtml_(anchorText) + '</a>';
  }
  if (!linkHtml) return '';

  const sentence = isCarnextSub
    ? '次の車を探す前に売却予算も整理したい場合は、' + linkHtml + 'と乗り換え全体の判断がしやすくなります。'
    : '売却後の次の車まで考える場合は、' + linkHtml + 'と希望条件を整理しやすくなります。';

  return [
    '<!-- UA_SUB_AFFILIATE_START -->',
    '<!-- wp:paragraph -->',
    '<p>' + sentence + '</p>',
    '<!-- /wp:paragraph -->',
    '<!-- UA_SUB_AFFILIATE_END -->'
  ].join('\n');
}

function uaTestManagedComplementaryAffiliateTextLink() {
  const cases = [
    {
      mainSpec: {
        type: 'url',
        name: 'ガリバー中古車ご提案サービス',
        url: 'https://example.com/gulliver',
        content: 'https://example.com/gulliver'
      },
      subProject: {
        name: 'カーネクスト',
        url: 'https://example.com/carnext',
        linkInput: '<a href="https://example.com/carnext" rel="nofollow">自由テキスト</a><img src="https://example.com/carnext-track" width="1" height="1">'
      },
      expectedText: 'カーネクストで今の車の査定条件を確認する'
    },
    {
      mainSpec: {
        type: 'url',
        name: 'カーネクスト',
        url: 'https://example.com/carnext',
        content: 'https://example.com/carnext'
      },
      subProject: {
        name: 'ガリバー中古車ご提案サービス',
        url: 'https://example.com/gulliver',
        linkInput: '<a href="https://example.com/gulliver" rel="nofollow">＜自由テキスト02＞</a><img src="https://example.com/gulliver-track" width="1" height="1">'
      },
      expectedText: 'ガリバーで希望に合う中古車の提案を確認する'
    }
  ];

  cases.forEach(function(item, index) {
    const mainBlock = uaBuildManagedAffiliateCtaBlock_(
      item.mainSpec,
      item.mainSpec.name + 'で対応内容を確認する'
    );
    const subBlock = uaBuildManagedSubAffiliateBlock_(item.mainSpec.name, item.subProject);
    const combined = mainBlock + '\n\n' + subBlock;
    const bounds = uaFindManagedAffiliateCtaBounds_(combined, item.mainSpec);

    if (!bounds || bounds.end > combined.indexOf('<!-- UA_SUB_AFFILIATE_START -->')) {
      throw new Error('サブ案件がメイン囲みボタンの直後に配置されていません。case=' + (index + 1));
    }
    if (subBlock.indexOf(item.subProject.url) === -1) {
      throw new Error('サブ案件URLが本文にありません。case=' + (index + 1));
    }
    if (subBlock.indexOf(item.expectedText) === -1) {
      throw new Error('サブ案件のアンカーテキストが不正です。case=' + (index + 1));
    }
    if (/cocoon-blocks\/button-wrap-1/i.test(subBlock)) {
      throw new Error('サブ案件がテキストリンクではなく囲みボタンになりました。case=' + (index + 1));
    }
    if (uaRemoveManagedSubAffiliateBlock_(combined).indexOf('UA_SUB_AFFILIATE_START') !== -1) {
      throw new Error('再処理前に既存サブ案件を除去できません。case=' + (index + 1));
    }
  });
  return { ok: true, pairedCases: cases.length, textLinksOnly: true, removableBeforeReapply: true };
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
  const html = String(body || '');
  const marked = html.match(
    /<!--\s*UA_MAIN_AFFILIATE_CTA_START\s*-->[\s\S]*?<!--\s*UA_MAIN_AFFILIATE_CTA_END\s*-->/gi
  ) || [];
  const cocoon = html.match(
    /<!--\s*wp:cocoon-blocks\/button-wrap-1\b[\s\S]*?<!--\s*\/wp:cocoon-blocks\/button-wrap-1\s*-->/gi
  ) || [];
  return marked.concat(cocoon);
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

function uaBuildManagedAffiliateCtaBlock_(spec, ctaText, appConfig) {
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

  if (uaUsesSwellBlocks_(appConfig)) {
    if (spec.type === 'shortcode') {
      return [
        '<!-- UA_MAIN_AFFILIATE_CTA_START -->',
        '<!-- wp:group {"className":"article-compass-affiliate-cta"} -->',
        '<div class="wp-block-group article-compass-affiliate-cta">',
        '<!-- wp:shortcode -->',
        tagContent,
        '<!-- /wp:shortcode -->',
        '</div>',
        '<!-- /wp:group -->',
        '<!-- UA_MAIN_AFFILIATE_CTA_END -->'
      ].join('\n');
    }

    const buttonColor = uaGetSwellButtonColor_(appConfig);

    return [
      '<!-- UA_MAIN_AFFILIATE_CTA_START -->',
      '<!-- wp:group {"className":"article-compass-affiliate-cta"} -->',
      '<div class="wp-block-group article-compass-affiliate-cta">',
      '<!-- wp:loos/button {"isCount":true,"color":"' + buttonColor + '","btnSize":"l","className":"is-style-btn_shiny"} -->',
      '<div class="swell-block-button -html ' + buttonColor + '_ -size-l is-style-btn_shiny" data-id="article-compass-cta">' + tagContent + '</div>',
      '<!-- /wp:loos/button -->',
      '</div>',
      '<!-- /wp:group -->',
      '<!-- UA_MAIN_AFFILIATE_CTA_END -->'
    ].join('\n');
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

function uaTestSwellBlockDialect() {
  const homeConfig = UA_APP_TYPES.home;
  const driveConfig = UA_APP_TYPES.drive;
  const spec = {
    type: 'url',
    name: 'テスト案件',
    url: 'https://example.com/path?a=1&b=2',
    content: 'https://example.com/path?a=1&b=2'
  };
  const swellCta = uaBuildManagedAffiliateCtaBlock_(spec, 'テスト案件で対応内容を確認する', homeConfig);
  const driveSwellCta = uaBuildManagedAffiliateCtaBlock_(spec, 'テスト案件で対応内容を確認する', driveConfig);
  const swellNotice = uaBuildYmylNoticeHtml_({
    category: 'home_safety',
    topic: '住宅設備の安全確認',
    sourceUrl: '',
    sourceLabel: ''
  }, homeConfig);
  const swellInternalLink = uaBuildInternalLinkPostInsertBlock_({
    url: 'https://example.com/related/',
    title: '関連記事のタイトル',
    usage: '関連する注意点'
  }, homeConfig);

  const checks = [
    ['home uses SWELL', uaUsesSwellBlocks_(homeConfig)],
    ['drive uses SWELL', uaUsesSwellBlocks_(driveConfig)],
    ['SWELL CTA marker', swellCta.indexOf('UA_MAIN_AFFILIATE_CTA_START') !== -1],
    ['SWELL CTA native button block', swellCta.indexOf('wp:loos/button') !== -1 && swellCta.indexOf('swell-block-button') !== -1],
    ['SWELL CTA home color', swellCta.indexOf('orange_') !== -1],
    ['SWELL CTA no Cocoon', swellCta.indexOf('cocoon-blocks') === -1],
    ['SWELL CTA URL preserved', swellCta.indexOf(spec.url) !== -1],
    ['DRIVE SWELL CTA native button block', driveSwellCta.indexOf('wp:loos/button') !== -1 && driveSwellCta.indexOf('swell-block-button') !== -1],
    ['DRIVE SWELL CTA drive color', driveSwellCta.indexOf('green_') !== -1],
    ['DRIVE SWELL CTA no Cocoon', driveSwellCta.indexOf('cocoon-blocks') === -1],
    ['DRIVE SWELL CTA URL preserved', driveSwellCta.indexOf(spec.url) !== -1],
    ['SWELL notice', swellNotice.indexOf('article-compass-notice-danger') !== -1 && swellNotice.indexOf('cocoon-blocks') === -1],
    ['SWELL internal link', swellInternalLink.indexOf('wp:loos/post-link') !== -1 && swellInternalLink.indexOf('cocoon-blocks') === -1]
  ];
  const failed = checks.filter(function(item) { return !item[1]; }).map(function(item) { return item[0]; });
  if (failed.length) throw new Error('SWELL出力テスト失敗: ' + failed.join(', '));
  return { ok: true, checks: checks.length, homeTheme: uaGetWpEditorTheme_(homeConfig), driveTheme: uaGetWpEditorTheme_(driveConfig) };
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

  const notice = uaBuildYmylNoticeHtml_(spec, appConfig);
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

function uaBuildYmylNoticeHtml_(spec, appConfig) {
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

  if (uaUsesSwellBlocks_(appConfig)) {
    return [
      '<!-- wp:group {"className":"is-style-big_icon_caution article-compass-notice-box article-compass-notice-danger","layout":{"type":"constrained"}} -->',
      '<div class="wp-block-group is-style-big_icon_caution article-compass-notice-box article-compass-notice-danger">',
      '<!-- wp:paragraph -->',
      '<p><strong>注意：</strong>' + text + '</p>',
      '<!-- /wp:paragraph -->',
      '</div>',
      '<!-- /wp:group -->'
    ].join('\n');
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
  const hasNoticeContainer = (
    text.indexOf('wp:cocoon-blocks/info-box') !== -1 && text.indexOf('danger-box') !== -1
  ) || text.indexOf('article-compass-notice-danger') !== -1;
  return hasNoticeContainer &&
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
  const context = uaGetRakutenRowContext_(sheet, row);
  const requestedRinkerCount = Number(data && data.forceRinkerItemCount || 0);
  if (context.appConfig && context.appConfig.key === 'home' && requestedRinkerCount > 0) {
    context.rowData.forceRakutenItemCount = Math.max(1, Math.min(3, requestedRinkerCount));
  }
  return uaAddRakutenBannerForContext_(context);
}

function uaEnsureAutomaticProductLinksForData_(data) {
  const sheet = uaGetSheetForData_(data || {});
  const row = Number(data && data.row) || sheet.getActiveCell().getRow();
  const context = uaGetRakutenRowContext_(sheet, row);
  if (!context.appConfig || context.appConfig.key === 'general' || !context.body) {
    return uaBuildRowData_(sheet, row);
  }

  const existingAssessment = uaGetExistingProductLinkAssessment_(
    context.body,
    context.rowData,
    context.appConfig
  );
  if (existingAssessment.adequate) {
    const existing = uaBuildRowData_(sheet, row);
    existing.message = existingAssessment.managed
      ? 'メインキーワードに合う既存の商品導線を保持しました。重複追加はしていません。'
      : '手動商品リンクを保持しました。自動置換はしていません。';
    return existing;
  }

  const notes = String(context.rowData && context.rowData.affiliateNotes || '');
  const mainKeywordProfile = uaGetMainKeywordProductProfile_(context.rowData, context.appConfig);
  const productLinkRequired = !!mainKeywordProfile && !/楽天バナーなし|楽天なし/.test(notes);

  UA_LAST_RAKUTEN_STATUS = '';
  if (!uaShouldInsertRakutenAffiliateBanner_(context.body, context.rowData, context.appConfig)) {
    const skipped = uaBuildRowData_(sheet, row);
    skipped.message = '商品導線は意図的にスキップしました: ' +
      String(UA_LAST_RAKUTEN_STATUS || '商品購入が検索意図の解決策ではありません');
    return skipped;
  }

  const result = uaAddRakutenBannerForContext_(context);
  const refreshed = uaBuildRowData_(sheet, row);
  const refreshedAssessment = uaGetExistingProductLinkAssessment_(
    refreshed.body,
    context.rowData,
    context.appConfig
  );
  if (productLinkRequired && !refreshedAssessment.adequate) {
    const reason = String(
      UA_LAST_RAKUTEN_STATUS || refreshedAssessment.reason || '適切な商品候補を取得できませんでした'
    );
    throw new Error(
      'メインキーワードが商品を示す記事ですが、適切なRinker・楽天・Amazon導線を作成できませんでした。' +
      '無関係商品で埋めず、WordPress下書き前で停止します。検索条件: ' +
      mainKeywordProfile.queries.join(' / ') + '。理由: ' + reason
    );
  }
  return result;
}

function uaBuildProductLinkNotInsertedResult_(context, sourceBody, replacedExisting, reason, factLabel) {
  if (replacedExisting) {
    context.sheet.getRange(context.row, UA_COLUMNS.body).setValue(sourceBody);
  }
  uaAppendFactCheckPoint_(
    context.sheet,
    context.row,
    '・' + String(factLabel || '商品リンク未挿入') + '｜' + reason
  );
  const data = uaBuildRowData_(context.sheet, context.row);
  data.message = replacedExisting
    ? '本文の購入条件を満たす候補がないため、既存の自動商品リンクを外しました。\n理由: ' + reason
    : '商品リンクは追加しませんでした。\n理由: ' + reason;
  return data;
}

function uaAddRakutenBannerForContext_(context) {
  if (!context.body) {
    throw new Error('本文が空です。先に本文を生成してください。');
  }

  const productPlan = uaExtractProductPlan_(context.body);
  let sourceBody = uaNormalizeUnsupportedTrialGuidance_(context.body, productPlan);
  let replacedExisting = false;
  if (uaHasRakutenBanner_(context.body)) {
    sourceBody = uaNormalizeUnsupportedTrialGuidance_(
      uaRemoveGeneratedRakutenBanner_(context.body),
      productPlan
    );
    replacedExisting = sourceBody !== context.body;
    if (!replacedExisting) {
      throw new Error('本文内に手動追加された楽天リンクがあります。自動判定では安全に置き換えられないため停止しました。');
    }
  }

  UA_LAST_RAKUTEN_STATUS = '';
  UA_LAST_RAKUTEN_EFFECTIVE_PRODUCT_PLAN = null;
  UA_LAST_RAKUTEN_QUERY = '';

  if (!uaShouldInsertRakutenAffiliateBanner_(sourceBody, context.rowData, context.appConfig)) {
    const reason = UA_LAST_RAKUTEN_STATUS || '楽天バナー挿入対象外です。';
    return uaBuildProductLinkNotInsertedResult_(
      context,
      sourceBody,
      replacedExisting,
      reason,
      replacedExisting ? '商品リンク再選定で既存リンク削除' : '商品リンク後入れ未実行'
    );
  }

  const block = uaBuildRakutenFollowupBlock_(sourceBody, context.rowData, context.appConfig);

  if (!block) {
    const reason = UA_LAST_RAKUTEN_STATUS || '楽天バナーを作成できませんでした。';
    return uaBuildProductLinkNotInsertedResult_(
      context,
      sourceBody,
      replacedExisting,
      reason,
      replacedExisting ? '商品リンク再選定で既存リンク削除' : '商品リンク後入れ失敗'
    );
  }

  const effectiveProductPlan = UA_LAST_RAKUTEN_EFFECTIVE_PRODUCT_PLAN || productPlan;
  if (effectiveProductPlan) {
    sourceBody = uaAttachProductPlanMarker_(
      uaNormalizeUnsupportedTrialGuidance_(sourceBody, effectiveProductPlan),
      effectiveProductPlan
    );
  }

  const nextBody = uaInsertRakutenBlockIntoBody_(sourceBody, block, context.rowData, context.appConfig);
  context.sheet.getRange(context.row, UA_COLUMNS.body).setValue(nextBody);
  uaAppendFactCheckPoint_(context.sheet, context.row, replacedExisting
    ? '・楽天バナー再選定｜既存の自動生成バナーを削除し、現在のキーワードで置換済み'
    : '・楽天バナー後入れ｜既存本文に小リライトとして追加済み');

  const nextData = uaBuildRowData_(context.sheet, context.row);
  const isForcedHomeRinker = context.appConfig && context.appConfig.key === 'home' &&
    Number(context.rowData && context.rowData.forceRakutenItemCount || 0) > 0;
  const rinkerItemCount = (String(block || '').match(/\[itemlink\b/gi) || []).length;
  nextData.message = isForcedHomeRinker
    ? 'Rinker商品リンクを' + rinkerItemCount + '種類、本文へ追加しました。重複商品は除外済みです。検索条件: ' + String(UA_LAST_RAKUTEN_QUERY || '自動判定') + '。本文生成APIは使っていません。'
    : replacedExisting
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
    '<!-- UA_PRODUCT_FOLLOWUP_START -->',
    '<h2>関連アイテムも選択肢に入れる</h2>',
    '<p>本文の対策を読んで「実際に何を用意すればいいか」まで考えたい場合は、関連アイテムを見比べておくと判断しやすくなります。</p>',
    banner,
    '<!-- UA_PRODUCT_FOLLOWUP_END -->'
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
  return text.indexOf('UA_PRODUCT_FOLLOWUP_START') !== -1 ||
    text.indexOf('UA_RINKER_PRODUCTS_START') !== -1 ||
    /\[itemlink\s+post_id=["']?\d+/i.test(text) ||
    text.indexOf('openapi.rakuten') !== -1 ||
    text.indexOf('hb.afl.rakuten') !== -1 ||
    text.indexOf('rakuten.co.jp') !== -1 ||
    text.indexOf('rel=\'nofollow sponsored\'') !== -1 && text.indexOf('楽天') !== -1;
}

function uaIsManagedProductLinkBlock_(body) {
  const text = String(body || '');
  return text.indexOf('UA_PRODUCT_FOLLOWUP_START') !== -1 ||
    text.indexOf('UA_RINKER_PRODUCTS_START') !== -1 ||
    text.indexOf('条件に合わなければ、無理に購入する必要はありません。') !== -1 &&
      text.indexOf('楽天で見る') !== -1;
}

function uaCountManagedProductChoices_(body) {
  const text = String(body || '');
  const rinkerCount = (text.match(/\[itemlink\s+post_id=["']?\d+/gi) || []).length;
  if (rinkerCount > 0) return rinkerCount;
  return (text.match(/>\s*楽天で見る\s*<\/a>/gi) || []).length;
}

function uaBuildManagedProductSelectionMeta_(items) {
  const names = (items || []).map(function(item) {
    return String(item && (item.name || item.title) || '').replace(/\s+/g, ' ').trim();
  }).filter(Boolean).slice(0, 3);
  if (names.length === 0) return '';
  return '<!-- UA_RINKER_SELECTION_META ' + encodeURIComponent(JSON.stringify(names)) + ' -->';
}

function uaExtractManagedProductSelectionNames_(body) {
  const match = String(body || '').match(/<!--\s*UA_RINKER_SELECTION_META\s+([^\s>]+)\s*-->/i);
  if (!match || !match[1]) return [];
  try {
    const parsed = JSON.parse(decodeURIComponent(match[1]));
    return Array.isArray(parsed) ? parsed.map(function(name) {
      return String(name || '').replace(/\s+/g, ' ').trim();
    }).filter(Boolean).slice(0, 3) : [];
  } catch (e) {
    return [];
  }
}

function uaGetMissingRequiredProductBrands_(body, productProfile) {
  const requiredBrands = productProfile && Array.isArray(productProfile.requiredBrands)
    ? productProfile.requiredBrands
    : [];
  if (requiredBrands.length === 0) return [];
  const selectedNames = uaExtractManagedProductSelectionNames_(body);
  return requiredBrands.filter(function(brand) {
    return !selectedNames.some(function(name) {
      return uaProductNameMatchesBrand_(name, brand);
    });
  });
}

function uaDoesProductPlanMatchMainKeyword_(body, productProfile) {
  if (!productProfile) return true;
  const plan = uaExtractProductPlan_(body);
  if (!plan || !plan.shouldInsert) return false;
  const plannedText = [plan.primaryProduct, plan.marketQuery].join(' ').toLowerCase();
  const anchorTerms = [productProfile.query, productProfile.label].concat(productProfile.queries || [])
    .join(' ')
    .split(/[\s　・、,／/|｜]+/)
    .map(function(term) { return term.trim().toLowerCase(); })
    .filter(function(term) {
      return term.length >= 2 && !/^(?:比較|おすすめ|家庭用|コンパクト)$/.test(term);
    });
  return anchorTerms.some(function(term) {
    return plannedText.indexOf(term) !== -1;
  });
}

function uaGetExistingProductLinkAssessment_(body, rowData, appConfig) {
  const text = String(body || '');
  if (!uaHasRakutenBanner_(text)) {
    return { exists: false, adequate: false, managed: false, count: 0, reason: '商品導線なし' };
  }

  const managed = uaIsManagedProductLinkBlock_(text);
  if (!managed) {
    return { exists: true, adequate: true, managed: false, count: 1, reason: '手動商品リンクを保持' };
  }

  const profile = uaGetMainKeywordProductProfile_(rowData, appConfig);
  const count = uaCountManagedProductChoices_(text);
  const requiredCount = profile && profile.comparison ? 2 : 1;
  const planMatches = uaDoesProductPlanMatchMainKeyword_(text, profile);
  const missingBrands = uaGetMissingRequiredProductBrands_(text, profile);
  const brandCoverageMatches = missingBrands.length === 0;
  return {
    exists: true,
    adequate: count >= requiredCount && planMatches && brandCoverageMatches,
    managed: true,
    count: count,
    missingBrands: missingBrands.map(function(brand) { return brand.label; }),
    reason: count < requiredCount
      ? '比較記事に必要な商品候補数が不足'
      : !planMatches
        ? '自動商品リンクがメインキーワードと不一致'
        : !brandCoverageMatches
          ? 'メインキーワードで明示されたブランドの商品が不足: ' + missingBrands.map(function(brand) { return brand.label; }).join(' / ')
          : 'メインキーワードとブランド構成が一致'
  };
}

function uaRemoveGeneratedRakutenBanner_(body) {
  return String(body || '').replace(
    /<!--\s*UA_PRODUCT_FOLLOWUP_START\s*-->[\s\S]*?<!--\s*UA_PRODUCT_FOLLOWUP_END\s*-->\s*/gi,
    ''
  ).replace(
    /<h2[^>]*>\s*関連アイテムも選択肢に入れる\s*<\/h2>\s*<p>本文の対策を読んで「実際に何を用意すればいいか」まで考えたい場合は、関連アイテムを見比べておくと判断しやすくなります。<\/p>\s*<!--\s*UA_RINKER_PRODUCTS_START\s*-->[\s\S]*?<!--\s*UA_RINKER_PRODUCTS_END\s*-->\s*/gi,
    ''
  ).replace(
    /<!--\s*UA_RINKER_PRODUCTS_START\s*-->[\s\S]*?<!--\s*UA_RINKER_PRODUCTS_END\s*-->\s*/gi,
    ''
  ).replace(
    /(?:<h2[^>]*>\s*関連アイテムも選択肢に入れる\s*<\/h2>\s*<p>本文の対策を読んで[\s\S]*?<\/p>\s*)?<p>本文の対策を実際に試すための商品候補[\s\S]*?<!-- \/wp:html -->\s*/gi,
    ''
  ).trim();
}

function uaAppendFactCheckPoint_(sheet, row, line) {
  const current = String(sheet.getRange(row, UA_COLUMNS.factCheckPoints).getValue() || '').trim();
  if (current.split(/\r?\n/).indexOf(String(line || '').trim()) !== -1) return;
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

function uaCallArticleGenerationJson_(promptText, provider, sheet, row) {
  if (provider === 'claude') {
    return uaCallClaudeJson_(promptText, 18000);
  }

  if (provider === 'openai') {
    return uaCallOpenAiArticleBackgroundJson_(promptText, 16000, sheet, row);
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

  const effectiveProductPlan = UA_LAST_RAKUTEN_EFFECTIVE_PRODUCT_PLAN || uaExtractProductPlan_(body);
  const sourceBody = effectiveProductPlan
    ? uaAttachProductPlanMarker_(body, effectiveProductPlan)
    : body;
  const productPlan = uaExtractProductPlan_(body);
  const selectedQuery = uaSelectRakutenProductQuery_(body, rowData, appConfig);
  UA_LAST_RAKUTEN_STATUS = '挿入済み｜主役商品: ' +
    String(productPlan && productPlan.primaryProduct || selectedQuery || '関連商品') +
    '｜検索条件: ' + String(selectedQuery || '自動判定');

  const contextualIndex = uaFindRakutenContextualInsertIndex_(sourceBody, rowData, appConfig);
  if (contextualIndex > -1) {
    return sourceBody.slice(0, contextualIndex).trimEnd() + '\n\n' + banner + '\n\n' + sourceBody.slice(contextualIndex).trimStart();
  }

  const faqIndex = sourceBody.search(/<h2[^>]*>\s*よくある質問\s*<\/h2>/i);

  if (faqIndex > -1) {
    return sourceBody.slice(0, faqIndex) + banner + '\n\n' + sourceBody.slice(faqIndex);
  }

  const summaryIndex = sourceBody.search(/<h2[^>]*>[\s\S]*?まとめ[\s\S]*?<\/h2>/i);

  if (summaryIndex > -1) {
    return sourceBody.slice(0, summaryIndex) + banner + '\n\n' + sourceBody.slice(summaryIndex);
  }

  return sourceBody + '\n\n' + banner;
}

function uaBuildRakutenAffiliateBanner_(body, rowData, appConfig) {
  const productPlan = uaExtractProductPlan_(body);
  const mainKeywordProfile = uaGetMainKeywordProductProfile_(rowData, appConfig);
  let effectiveProductPlan = uaCanUseSupplementalProductPlan_(productPlan, body, rowData, appConfig)
    ? uaBuildSupplementalProductPlan_(productPlan, rowData, appConfig)
    : productPlan;
  if (mainKeywordProfile) {
    effectiveProductPlan = uaBuildMainKeywordProductPlan_(mainKeywordProfile, effectiveProductPlan);
  }
  if (!effectiveProductPlan && appConfig && appConfig.key === 'home' && !uaHasMainAffiliateProject_(rowData)) {
    const fallbackQuery = uaSelectRakutenKeywordFallbackQuery_(rowData && rowData.mainInput, 'home');
    if (fallbackQuery) {
      const fallbackProductLabel = uaGetFallbackProductDisplayLabel_(fallbackQuery);
      effectiveProductPlan = uaNormalizeProductPlan_({
        shouldInsert: true,
        primaryProduct: fallbackProductLabel,
        marketQuery: fallbackQuery,
        purpose: '記事の中心となる悩みを解決する',
        purchaseScale: 'standard',
        benefit: '自分の使い方と設置条件に合う候補へ絞り込みやすくなります',
        ctaReason: fallbackProductLabel + 'を追加する場合は、設置サイズや仕様を比較してから選べます'
      });
    }
  }
  effectiveProductPlan = uaAlignProductPlanToMainIntent_(effectiveProductPlan, rowData, appConfig);
  const query = effectiveProductPlan && effectiveProductPlan.shouldInsert
    ? (effectiveProductPlan.marketQuery || effectiveProductPlan.primaryProduct)
    : uaSelectRakutenProductQuery_(body, rowData, appConfig);
  UA_LAST_RAKUTEN_QUERY = String(query || '');

  if (!query) {
    UA_LAST_RAKUTEN_STATUS = '商品検索キーワードを選定できませんでした';
    return '';
  }

  const categoryQueries = uaSelectRakutenCategoryQueries_(body, rowData, appConfig, query);
  const selectionSeed = String(rowData && rowData.mainInput || '') + '|' + String(query || '');
  const hasMainAffiliate = uaHasMainAffiliateProject_(rowData);
  const desiredCount = uaDecideRakutenItemCount_(body, rowData, appConfig, query);
  let items = [];

  if (!hasMainAffiliate) {
    const profileQueries = mainKeywordProfile ? mainKeywordProfile.queries : [];
    const queryPool = [query].concat(profileQueries).concat(effectiveProductPlan && !mainKeywordProfile ? [] : categoryQueries);
    const keywordAndContextQueries = queryPool.filter(function(value, index, values) {
      return value && values.indexOf(value) === index;
    }).slice(0, 3);
    items = uaFetchRakutenItemsAcrossQueries_(keywordAndContextQueries, desiredCount, selectionSeed, effectiveProductPlan);
  } else if (categoryQueries.length > 0) {
    items = uaFetchRakutenItemsAcrossQueries_(categoryQueries, desiredCount, selectionSeed, effectiveProductPlan);
  }

  if (items.length === 0) {
    items = uaFetchRakutenItems_(query, desiredCount, selectionSeed, effectiveProductPlan);
  }

  if (items.length === 0 && effectiveProductPlan) {
    const scaleQueries = uaBuildPurchaseScaleRetryQueries_(query, effectiveProductPlan);
    if (scaleQueries.length > 0) {
      items = uaFetchRakutenItemsByQueries_(scaleQueries, 1, selectionSeed + '|purchase-scale-retry', effectiveProductPlan);
    }
  }

  if (items.length === 0 && effectiveProductPlan && effectiveProductPlan.purchaseScale === 'trial') {
    const standardPlan = uaNormalizeProductPlan_(Object.assign({}, effectiveProductPlan, {
      purchaseScale: 'standard',
      ctaReason: '初回からまとめ買いせず、通常販売単位で比較しやすいため'
    }));
    items = uaFetchRakutenItems_(query, 1, selectionSeed + '|standard-fallback', standardPlan);
    if (items.length === 0) {
      const standardQueries = uaBuildPurchaseScaleRetryQueries_(query, standardPlan);
      items = uaFetchRakutenItemsByQueries_(standardQueries, 1, selectionSeed + '|standard-unit-retry', standardPlan);
    }
    if (items.length > 0) {
      effectiveProductPlan = standardPlan;
    }
  }

  if (items.length > 0) {
    UA_LAST_RAKUTEN_EFFECTIVE_PRODUCT_PLAN = effectiveProductPlan;
    const bannerLabel = categoryQueries.length >= 2 ? '' : query;
    return uaBuildRakutenItemBannerHtml_(items, bannerLabel, effectiveProductPlan, appConfig);
  }

  const fallbackHtml = String(PropertiesService.getScriptProperties().getProperty('UA_RAKUTEN_AFFILIATE_BANNER_HTML') || '').trim();

  if (!fallbackHtml) {
    if (!UA_LAST_RAKUTEN_STATUS) {
      UA_LAST_RAKUTEN_STATUS = '楽天APIで商品を取得できず、固定バナーfallbackも未設定です。検索キーワード: ' + query;
    }
    return '';
  }

  return [
    '<!-- UA_PRODUCT_FOLLOWUP_START -->',
    '<p>本文の対策を実際に試すための商品候補を見比べたい場合は、下の楽天バナーから関連アイテムの価格や種類を確認できます。</p>',
    uaNormalizeRakutenAffiliateBanner_(fallbackHtml),
    '<!-- UA_PRODUCT_FOLLOWUP_END -->'
  ].join('\n');
}

function uaSelectRakutenProductQuery_(body, rowData, appConfig) {
  const notes = String(rowData && rowData.affiliateNotes || '');
  const override = notes.match(/楽天商品(?:キーワード|KW)[:：]\s*([^\n\r]+)/);

  if (override && override[1]) {
    return override[1].trim();
  }

  const mainKeywordProfile = uaGetMainKeywordProductProfile_(rowData, appConfig);
  if (mainKeywordProfile) {
    return mainKeywordProfile.query;
  }

  const productPlan = uaExtractProductPlan_(body);
  if (productPlan && productPlan.shouldInsert) {
    if (productPlan.marketQuery) return productPlan.marketQuery;
    if (productPlan.primaryProduct) {
      return [productPlan.primaryProduct].concat(productPlan.mustHave.slice(0, 2)).join(' ').trim();
    }
  }
  if (uaCanUseSupplementalProductPlan_(productPlan, body, rowData, appConfig)) {
    if (productPlan.marketQuery) return productPlan.marketQuery;
    if (productPlan.primaryProduct) {
      return [productPlan.primaryProduct].concat(productPlan.mustHave.slice(0, 2)).join(' ').trim();
    }
    const supplementalQuery = uaSelectRakutenKeywordFallbackQuery_(rowData && rowData.mainInput, appConfig && appConfig.key);
    if (supplementalQuery) return supplementalQuery;
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

function uaAlignProductPlanToMainIntent_(productPlan, rowData, appConfig) {
  const plan = uaNormalizeProductPlan_(productPlan);
  if (!plan || !appConfig || appConfig.key !== 'home') return plan;

  const mainInput = String(rowData && rowData.mainInput || '').trim();
  const fallbackQuery = uaSelectRakutenKeywordFallbackQuery_(mainInput, 'home');
  if (!fallbackQuery) return plan;

  function terms(value) {
    const stopWords = /^(?:おすすめ|比較|口コミ|評判|後悔|デメリット|メリット|やめた|いらない|狭い|広い|片付け方|片付け|収納|対策|方法|商品|用品)$/;
    return String(value || '')
      .split(/[\s　・、,／/|｜]+/)
      .map(function(term) { return term.trim().toLowerCase(); })
      .filter(function(term) { return term.length >= 2 && !stopWords.test(term); });
  }

  const anchorTerms = terms(fallbackQuery);
  const plannedText = [plan.primaryProduct, plan.marketQuery].join(' ').toLowerCase();
  const aligns = anchorTerms.some(function(term) {
    return plannedText.indexOf(term) !== -1;
  });
  const normalizedMainInput = mainInput.replace(/[\s　]+/g, ' ').trim().toLowerCase();
  const normalizedPrimary = String(plan.primaryProduct || '').replace(/[\s　]+/g, ' ').trim().toLowerCase();
  const normalizedFallbackQuery = fallbackQuery.replace(/[\s　]+/g, ' ').trim().toLowerCase();
  const echoesRawSearchIntent = !!normalizedMainInput && normalizedPrimary === normalizedMainInput;
  const echoesMachineQuery = !!normalizedFallbackQuery && normalizedPrimary === normalizedFallbackQuery &&
    uaGetFallbackProductDisplayLabel_(fallbackQuery) !== fallbackQuery;
  const hasBrokenCtaSentence = /(?:できる|比較できる)ため[.。．]?$/.test(String(plan.ctaReason || '').trim());
  const hasStaleGenericBenefit = /本文の判断条件に合う商品を選びやすくなる/.test(String(plan.benefit || ''));
  if (aligns && !echoesRawSearchIntent && !echoesMachineQuery && !hasBrokenCtaSentence && !hasStaleGenericBenefit) return plan;

  const productLabel = uaGetFallbackProductDisplayLabel_(fallbackQuery);
  return uaNormalizeProductPlan_(Object.assign({}, plan, {
    shouldInsert: true,
    primaryProduct: productLabel,
    marketQuery: fallbackQuery,
    purpose: '記事の中心となる悩みを解決する',
    mustHave: [],
    exclude: [],
    purchaseScale: 'standard',
    requiredFeatures: [],
    excludedFeatures: [],
    benefit: '自分の使い方と設置条件に合う候補へ絞り込みやすくなります',
    ctaReason: productLabel + 'を追加する場合は、設置サイズや仕様を比較してから選べます'
  }));
}

function uaGetFallbackProductDisplayLabel_(query) {
  const value = String(query || '').replace(/[\s　]+/g, ' ').trim();
  const labels = {
    '靴 収納 省スペース スリム': '省スペース靴収納',
    'ポップアップテント 収納しやすい': '収納しやすいポップアップテント',
    'ワンタッチテント 収納しやすい': '収納しやすいワンタッチテント',
    'サンシェード ベランダ 日よけ': 'ベランダ用サンシェード',
    'ランドリーチェスト 防カビ': '防カビ仕様のランドリーチェスト',
    '除湿機 コンパクト': 'コンパクト除湿機',
    'サーキュレーター 部屋干し': '部屋干し向けサーキュレーター'
  };
  return labels[value] || value;
}

function uaCallOpenAiArticleBackgroundJson_(promptText, maxOutputTokens, sheet, row) {
  const stateKey = uaGetArticleBackgroundStateKey_(sheet, row);
  const fingerprint = uaHashArticleBackgroundText_([
    String(uaGetOpenAiModel_() || ''),
    String(maxOutputTokens || ''),
    String(promptText || '')
  ].join('\n---UA-ARTICLE-BACKGROUND---\n'));
  let state = uaLoadArticleBackgroundState_(stateKey);

  if (state && state.fingerprint !== fingerprint) {
    // Never replace an in-flight response merely because the reconstructed
    // prompt changed (for example after a status or panel autosave update).
    // Replacing it here starts another paid background response and also
    // resets the stale timer. Keep retrieving the saved response ID until it
    // completes, is cancelled, or reaches the hard timeout.
    state.promptChangedWhilePending = true;
    state.latestFingerprint = fingerprint;
    uaSaveArticleBackgroundState_(stateKey, state);
  }

  let response;
  if (state && state.responseId) {
    try {
      response = uaRetrieveOpenAiBackgroundJson_(state.responseId);
    } catch (retrieveError) {
      if (Number(retrieveError && retrieveError.statusCode) === 404) {
        throw new Error(
          '保存済みのOpenAI本文生成結果は取得期限を過ぎています。' +
          '重複課金を防ぐため、新しい本文生成は自動送信していません。'
        );
      }
      throw retrieveError;
    }
  }

  if (state && !state.responseId) {
    throw new Error(
      '前回のOpenAI本文生成は開始応答の処理IDを保存できないまま終了しました。' +
      '重複課金を防ぐため自動再送信しません。'
    );
  }

  if (!state) {
    state = {
      responseId: '',
      fingerprint: fingerprint,
      startedAt: new Date().toISOString(),
      phase: 'starting'
    };
    uaSaveArticleBackgroundState_(stateKey, state);
    response = uaStartOpenAiBackgroundJson_(promptText, maxOutputTokens);
    state.responseId = String(response.id || '');
    state.phase = 'queued';
    uaSaveArticleBackgroundState_(stateKey, state);
  }

  const normalized = uaNormalizeOpenAiBackgroundJson_(response);
  if (normalized.pending) {
    const startedAtMs = Date.parse(String(state && state.startedAt || ''));
    if (!isNaN(startedAtMs) && Date.now() - startedAtMs >= 20 * 60 * 1000) {
      let cancelResult;
      try {
        cancelResult = uaCancelOpenAiBackgroundResponse_(state.responseId);
      } catch (cancelError) {
        cancelResult = {
          cancelled: false,
          status: 'cancel_failed',
          message: String(cancelError && cancelError.message || cancelError)
        };
      }
      state.phase = cancelResult && cancelResult.cancelled ? 'cancelled' : 'cancel_requested';
      state.cancelledAt = new Date().toISOString();
      state.cancelResult = cancelResult;
      uaSaveArticleBackgroundState_(stateKey, state);
      throw new Error(
        'OpenAI本文生成が20分を超えて完了しなかったため停止しました。' +
        '処理IDと停止位置は保存し、バックグラウンド処理へキャンセル要求を送りました。'
      );
    }
    const pendingError = new Error(
      'OpenAIで本文生成を継続中です。処理IDは保存済みです。' +
      '同じ本文生成の完了結果だけを確認し、新しい生成依頼は送信しません。'
    );
    pendingError.uaArticleBackgroundPending = true;
    pendingError.responseId = state.responseId;
    throw pendingError;
  }

  normalized.backgroundStateKey = stateKey;
  return normalized;
}

function uaGetArticleBackgroundStateKey_(sheet, row) {
  const spreadsheetId = sheet && sheet.getParent ? sheet.getParent().getId() : '';
  const sheetName = sheet && sheet.getName ? sheet.getName() : '';
  return 'UA_ARTICLE_BG_' + uaHashArticleBackgroundText_([
    spreadsheetId,
    sheetName,
    String(row || '')
  ].join('|')).slice(0, 32);
}

function uaHashArticleBackgroundText_(value) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(value || ''),
    Utilities.Charset.UTF_8
  );
  return bytes.map(function(byte) {
    const normalized = byte < 0 ? byte + 256 : byte;
    return ('0' + normalized.toString(16)).slice(-2);
  }).join('');
}

function uaLoadArticleBackgroundState_(key) {
  const raw = PropertiesService.getScriptProperties().getProperty(key);
  if (!raw) return null;
  try {
    const state = JSON.parse(raw);
    return state && typeof state === 'object' ? state : null;
  } catch (e) {
    PropertiesService.getScriptProperties().deleteProperty(key);
    return null;
  }
}

function uaSaveArticleBackgroundState_(key, state) {
  PropertiesService.getScriptProperties().setProperty(key, JSON.stringify(state || {}));
}

function uaClearArticleBackgroundState_(key) {
  PropertiesService.getScriptProperties().deleteProperty(key);
}

function uaBuildPurchaseScaleRetryQueries_(query, productPlan) {
  const base = String(query || '').trim();
  const plan = uaNormalizeProductPlan_(productPlan);
  if (!base || !plan) return [];

  const suffixes = plan.purchaseScale === 'trial'
    ? ['少量', 'お試し', '単品']
    : plan.purchaseScale === 'bulk'
      ? ['まとめ買い', '大容量']
      : plan.purchaseScale === 'standard'
        ? ['単品', '1パック']
        : [];

  return suffixes.map(function(suffix) {
    return base + ' ' + suffix;
  });
}

function uaHasMainAffiliateProject_(rowData) {
  if (uaIsNoAffiliateName_(rowData && rowData.affiliateName)) return false;
  return !!uaNormalizeAffiliateName_(rowData && rowData.affiliateName) ||
    !!String(rowData && rowData.affiliateUrl || '').trim();
}

function uaSelectRakutenKeywordFallbackQuery_(keyword, appKey) {
  const value = String(keyword || '').replace(/\s+/g, ' ').trim();
  if (!value) return '';

  if (appKey === 'home') {
    const productProfile = uaGetMainKeywordProductProfile_({ mainInput: value }, { key: 'home' });
    if (productProfile) return productProfile.query;
  }

  const productPattern = appKey === 'home'
    ? /(ポップアップテント|ワンタッチテント|テント|サンシェード|日よけ|収納|チェスト|棚|ラック|マット|カーテン|照明|ライト|カメラ|エアコン|除湿機|サーキュレーター|物干し|掃除|ブラシ|防災|ゲート|スロープ|家電|家具)/
    : /(ブレーキパッド|カーナビ|ナビゲーション|アンドロイドナビ|ディスプレイオーディオ|ドラレコ|ドライブレコーダー|レーダー探知機|バックカメラ|モニター|HDMI|USB|スピーカー|スマホホルダー|サンシェード|フロアマット|シートマット|シートカバー|シートクッション|収納|ドリンクホルダー|ルーフキャリア|ポータブル電源|ジャンプスターター|バッテリー|タイヤ|ホイール|タイヤチェーン|洗車|クリーナー|コーティング|ワックス|カー用品|車中泊)/i;

  if (!productPattern.test(value)) return '';

  const canonicalQueries = appKey === 'home'
    ? [
      { pattern: /玄関.*(?:収納|片付)|(?:収納|片付).*玄関/, query: '靴 収納 省スペース スリム' },
      { pattern: /ポップアップテント/, query: 'ポップアップテント 収納しやすい' },
      { pattern: /ワンタッチテント/, query: 'ワンタッチテント 収納しやすい' },
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

  const mainKeywordProfile = uaGetMainKeywordProductProfile_(data, appConfig);
  if (mainKeywordProfile) {
    mainKeywordProfile.queries.forEach(addSuggestion);
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

  const mainKeywordProfile = uaGetMainKeywordProductProfile_(rowData, appConfig);
  if (mainKeywordProfile) {
    mainKeywordProfile.queries.forEach(add);
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

function uaFetchRakutenItemsByQueries_(queries, maxItems, selectionSeed, productPlan) {
  const results = [];
  const seenItems = {};
  const seenNames = {};
  const limit = Math.max(1, Math.min(3, Number(maxItems) || 3));

  (queries || []).forEach(function(query) {
    if (results.length >= limit) return;

    const items = uaFetchRakutenItems_(query, 1, String(selectionSeed || '') + '|' + query, productPlan);
    items.forEach(function(item) {
      if (results.length >= limit) return;
      const key = uaRakutenItemUniqueKey_(item);
      const nameKey = uaRakutenItemNameKey_(item);
      if (!key || seenItems[key] || nameKey && seenNames[nameKey]) return;
      seenItems[key] = true;
      if (nameKey) seenNames[nameKey] = true;
      results.push(item);
    });
  });

  return results;
}

function uaFetchRakutenItemsAcrossQueries_(queries, maxItems, selectionSeed, productPlan) {
  const limit = Math.max(1, Math.min(3, Number(maxItems) || 1));
  const uniqueQueries = (queries || []).map(function(query) {
    return String(query || '').replace(/\s+/g, ' ').trim();
  }).filter(function(query, index, values) {
    return query && values.indexOf(query) === index;
  }).slice(0, 3);

  if (uniqueQueries.length === 0) return [];
  if (uniqueQueries.length === 1) {
    return uaDedupeRakutenItems_(
      uaFetchRakutenItems_(uniqueQueries[0], limit, String(selectionSeed || '') + '|single-query', productPlan)
    ).slice(0, limit);
  }

  const results = uaFetchRakutenItemsByQueries_(uniqueQueries, limit, selectionSeed, productPlan);
  if (results.length >= limit) return results.slice(0, limit);

  const supplemental = uaFetchRakutenItems_(
    uniqueQueries[0],
    limit,
    String(selectionSeed || '') + '|primary-backfill',
    productPlan
  );
  return uaDedupeRakutenItems_(results.concat(supplemental)).slice(0, limit);
}

function uaRakutenItemUniqueKey_(item) {
  const itemCode = String(item && item.itemCode || '').trim().toLowerCase();
  if (itemCode) return 'code:' + itemCode;

  const rawUrl = String(item && item.url || '').trim();
  if (rawUrl) {
    const normalizedUrl = rawUrl
      .replace(/^https?:\/\//i, '')
      .replace(/[?#].*$/, '')
      .replace(/\/$/, '')
      .toLowerCase();
    if (normalizedUrl) return 'url:' + normalizedUrl;
  }

  const name = String(item && item.name || '')
    .replace(/[\s　]+/g, '')
    .trim()
    .toLowerCase();
  return name ? 'name:' + name : '';
}

function uaRakutenItemNameKey_(item) {
  return String(item && item.name || '')
    .replace(/[\s　\-_/／・,，.。()（）【】\[\]「」『』]+/g, '')
    .trim()
    .toLowerCase();
}

function uaDedupeRakutenItems_(items) {
  const seen = {};
  const seenNames = {};
  return (items || []).filter(function(item) {
    const key = uaRakutenItemUniqueKey_(item);
    const nameKey = uaRakutenItemNameKey_(item);
    if (!key || seen[key] || nameKey && seenNames[nameKey]) return false;
    seen[key] = true;
    if (nameKey) seenNames[nameKey] = true;
    return true;
  });
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
    { query: 'ビーズソファ', keywords: ['ビーズソファ', 'ビーズクッション', 'Yogibo', 'ヨギボー', '人をダメにするソファ', '体にフィットするソファ'] },
    { query: '室内ジャングルジム', keywords: ['室内ジャングルジム', '室内遊具', 'ジャングルジム'] },
    { query: 'シーリングライト 調色', keywords: ['シーリングライト', '調色', '天井照明'] },
    { query: 'テレビスタンド 配線収納', keywords: ['テレビスタンド', 'テレビ台', 'テレビ 配線'] },
    { query: 'キッチン 汚れ防止シート', keywords: ['汚れ防止シート', 'キッチン 保護シート', '油はねガード'] },
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
  if (appConfig && appConfig.key === 'home' && Number(rowData && rowData.forceRakutenItemCount || 0) > 0) {
    return Math.max(1, Math.min(3, Number(rowData.forceRakutenItemCount)));
  }

  const text = [
    rowData && rowData.mainInput,
    rowData && rowData.readerMindMemo,
    rowData && rowData.affiliateNotes,
    query,
    body
  ].join(' ');
  const mainKeywordProfile = uaGetMainKeywordProductProfile_(rowData, appConfig);
  if (mainKeywordProfile && mainKeywordProfile.comparison) {
    return 3;
  }
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

function uaFetchRakutenItems_(query, maxItems, selectionSeed, productPlan) {
  const applicationId = String(PropertiesService.getScriptProperties().getProperty('UA_RAKUTEN_APPLICATION_ID') || '').trim();
  const accessKey = String(PropertiesService.getScriptProperties().getProperty('UA_RAKUTEN_ACCESS_KEY') || '').trim();

  if (!applicationId || !accessKey) {
    UA_LAST_RAKUTEN_STATUS = '楽天APIキー不足（UA_RAKUTEN_APPLICATION_ID / UA_RAKUTEN_ACCESS_KEY）';
    return [];
  }

  const affiliateId = String(PropertiesService.getScriptProperties().getProperty('UA_RAKUTEN_AFFILIATE_ID') || '').trim();
  const refererUrl = uaGetRakutenRefererUrl_();
  const hits = Math.max(1, Math.min(3, Number(maxItems) || 1));
  const candidateHits = 20;
  const searchTuning = uaBuildRakutenSearchTuning_(productPlan);
  const params = [
    'format=json',
    'formatVersion=2',
    'hits=' + candidateHits,
    'imageFlag=1',
    'sort=' + encodeURIComponent(searchTuning.sort),
    'applicationId=' + encodeURIComponent(applicationId),
    'accessKey=' + encodeURIComponent(accessKey),
    'keyword=' + encodeURIComponent(query)
  ];

  if (searchTuning.ngKeyword) {
    params.push('NGKeyword=' + encodeURIComponent(searchTuning.ngKeyword));
  }

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
      const relevanceScore = uaScoreRakutenItem_(currentItem, query, productPlan);
      if (relevanceScore < 1) return;

      const currentUrl = currentItem.affiliateUrl || currentItem.itemUrl;
      if (seenUrls[currentUrl]) return;
      seenUrls[currentUrl] = true;

      const currentMediumImage = currentItem.mediumImageUrls &&
        currentItem.mediumImageUrls[0];

      candidates.push({
        name: currentItem.itemName,
        url: currentUrl,
        itemCode: String(currentItem.itemCode || ''),
        imageUrl: typeof currentMediumImage === 'string'
          ? currentMediumImage
          : currentMediumImage && currentMediumImage.imageUrl,
        price: Number(currentItem.itemPrice) || 0,
        reviewAverage: Number(currentItem.reviewAverage) || 0,
        reviewCount: Number(currentItem.reviewCount) || 0,
        relevanceScore: relevanceScore
      });
    });

    if (candidates.length === 0) {
      UA_LAST_RAKUTEN_STATUS = '楽天APIの検索結果に、用途・必須条件・除外条件を満たす商品がありませんでした。検索キーワード: ' + query;
      return [];
    }

    candidates.sort(function(a, b) {
      if (b.relevanceScore !== a.relevanceScore) return b.relevanceScore - a.relevanceScore;
      if (b.reviewCount !== a.reviewCount) return b.reviewCount - a.reviewCount;
      if (b.reviewAverage !== a.reviewAverage) return b.reviewAverage - a.reviewAverage;
      return uaStableRakutenSelectionOffset_(String(selectionSeed || query) + '|' + a.url, 1000) -
        uaStableRakutenSelectionOffset_(String(selectionSeed || query) + '|' + b.url, 1000);
    });
    return uaSelectDiverseRakutenItems_(candidates, hits, selectionSeed || query);
  } catch (e) {
    UA_LAST_RAKUTEN_STATUS = '楽天API取得エラー: ' + e.toString();
    return [];
  }
}

function uaSelectDiverseRakutenItems_(candidates, maxItems, selectionSeed) {
  const limit = Math.max(1, Math.min(3, Number(maxItems) || 1));
  const source = (candidates || []).filter(function(item) {
    return item && item.name && item.url;
  });
  if (source.length <= 1 || limit === 1) return source.slice(0, limit);

  source.sort(function(a, b) {
    if (Number(b.relevanceScore || 0) !== Number(a.relevanceScore || 0)) {
      return Number(b.relevanceScore || 0) - Number(a.relevanceScore || 0);
    }
    if (Number(b.reviewCount || 0) !== Number(a.reviewCount || 0)) {
      return Number(b.reviewCount || 0) - Number(a.reviewCount || 0);
    }
    return uaStableRakutenSelectionOffset_(String(selectionSeed || '') + '|' + a.url, 1000) -
      uaStableRakutenSelectionOffset_(String(selectionSeed || '') + '|' + b.url, 1000);
  });

  const selected = [source.shift()];
  const topRelevance = Number(selected[0].relevanceScore || 0);
  const minimumRelevance = Math.max(1, topRelevance - 15);
  const eligible = source.filter(function(item) {
    return Number(item.relevanceScore || 0) >= minimumRelevance;
  });

  while (selected.length < limit && eligible.length > 0) {
    let bestIndex = 0;
    let bestScore = -Infinity;
    eligible.forEach(function(item, index) {
      const qualityScore = Number(item.relevanceScore || 0) * 2 +
        Math.min(10, Math.log(Number(item.reviewCount || 0) + 1) / Math.log(2));
      const diversityScore = selected.reduce(function(lowest, chosen) {
        return Math.min(lowest, uaRakutenChoiceDifferenceScore_(item, chosen));
      }, 100);
      const stableTieBreak = uaStableRakutenSelectionOffset_(
        String(selectionSeed || '') + '|' + String(item.url || ''),
        1000
      ) / 10000;
      const total = qualityScore + diversityScore + stableTieBreak;
      if (total > bestScore) {
        bestScore = total;
        bestIndex = index;
      }
    });
    selected.push(eligible.splice(bestIndex, 1)[0]);
  }

  return selected.slice(0, limit);
}

function uaRakutenChoiceDifferenceScore_(left, right) {
  const leftName = String(left && left.name || '');
  const rightName = String(right && right.name || '');
  const titleDifference = (1 - uaRakutenTitleSimilarity_(leftName, rightName)) * 35;
  const leftTraits = uaExtractRakutenChoiceTraits_(leftName);
  const rightTraits = uaExtractRakutenChoiceTraits_(rightName);
  const traitDifference = leftTraits.some(function(value) {
    return rightTraits.indexOf(value) === -1;
  }) || rightTraits.some(function(value) {
    return leftTraits.indexOf(value) === -1;
  }) ? 25 : 0;
  const leftPrice = Number(left && left.price || 0);
  const rightPrice = Number(right && right.price || 0);
  const priceDifference = leftPrice > 0 && rightPrice > 0
    ? Math.min(20, Math.abs(Math.log(leftPrice / rightPrice)) * 18)
    : 0;
  return titleDifference + traitDifference + priceDifference;
}

function uaExtractRakutenChoiceTraits_(itemName) {
  const text = String(itemName || '').toLowerCase();
  const values = text.match(/\d+(?:\.\d+)?\s*(?:枚|個|本|ロール|巻|パック|セット|倍|m|cm|mm|l|ml|kg|g|w|畳|人用)/gi) || [];
  const featureWords = [
    'コンパクト', '大容量', '薄型', '折りたたみ', '防水', '撥水', '防カビ',
    '屋外', '室内', 'コードレス', '静音', '軽量', '業務用', '家庭用'
  ];
  featureWords.forEach(function(word) {
    if (text.indexOf(word.toLowerCase()) !== -1) values.push(word);
  });
  return values.map(function(value) {
    return String(value).replace(/[\s　]+/g, '').toLowerCase();
  }).filter(function(value, index, all) {
    return all.indexOf(value) === index;
  });
}

function uaRakutenTitleSimilarity_(leftName, rightName) {
  function bigrams(value) {
    const normalized = String(value || '').toLowerCase().replace(/[\s　\-_/／・,，.。()（）【】\[\]]+/g, '');
    const result = [];
    for (let i = 0; i < normalized.length - 1; i++) {
      const gram = normalized.slice(i, i + 2);
      if (result.indexOf(gram) === -1) result.push(gram);
    }
    return result;
  }
  const left = bigrams(leftName);
  const right = bigrams(rightName);
  if (left.length === 0 || right.length === 0) return 0;
  const shared = left.filter(function(value) { return right.indexOf(value) !== -1; }).length;
  return shared / (left.length + right.length - shared);
}

function uaTestDiverseRakutenItemSelection() {
  const candidates = [
    { name: '2倍巻き トイレットペーパー ダブル 8ロール', url: 'https://example.com/a', price: 980, reviewCount: 300, relevanceScore: 100 },
    { name: '2倍巻き トイレットペーパー ダブル 8ロール 送料無料', url: 'https://example.com/b', price: 1000, reviewCount: 900, relevanceScore: 99 },
    { name: '2倍巻き トイレットペーパー ダブル 6ロール コンパクト', url: 'https://example.com/c', price: 760, reviewCount: 180, relevanceScore: 96 },
    { name: '2倍巻き トイレットペーパー ダブル 12ロール 大容量', url: 'https://example.com/d', price: 1480, reviewCount: 240, relevanceScore: 94 }
  ];
  const selected = uaSelectDiverseRakutenItems_(candidates, 3, 'diversity-test');
  const urls = selected.map(function(item) { return item.url; });
  const checks = [
    { name: 'show up to three choices', ok: selected.length === 3, actual: urls },
    { name: 'keep strongest relevant choice', ok: urls.indexOf('https://example.com/a') !== -1, actual: urls },
    { name: 'prefer compact variation over duplicate listing', ok: urls.indexOf('https://example.com/c') !== -1, actual: urls },
    { name: 'prefer large variation over duplicate listing', ok: urls.indexOf('https://example.com/d') !== -1, actual: urls },
    { name: 'do not fill with much weaker candidate', ok: uaSelectDiverseRakutenItems_([
      candidates[0],
      { name: '関連性が弱い商品', url: 'https://example.com/weak', price: 500, reviewCount: 999, relevanceScore: 70 }
    ], 3, 'weak-test').length === 1 }
  ];
  const failures = checks.filter(function(check) { return !check.ok; });
  if (failures.length > 0) {
    throw new Error('Diverse Rakuten item selection test failed: ' + JSON.stringify(failures));
  }
  return { ok: true, count: checks.length, selected: urls };
}

function uaBuildRakutenSearchTuning_(productPlan) {
  const plan = uaNormalizeProductPlan_(productPlan);
  const scale = plan && plan.purchaseScale || 'standard';
  if (scale === 'standard' || scale === 'trial') {
    return {
      sort: '+itemPrice',
      ngKeyword: 'ふるさと納税'
    };
  }
  return {
    sort: 'standard',
    ngKeyword: ''
  };
}

function uaIsRakutenItemRelevant_(itemName, query) {
  const name = String(itemName || '').replace(/[\s　]+/g, '').toLowerCase();
  const queryText = String(query || '').replace(/[\s　]+/g, '').toLowerCase();
  if (!name || !queryText) return false;

  const brandRequirements = uaExtractRequiredProductBrands_(query);
  for (let brandIndex = 0; brandIndex < brandRequirements.length; brandIndex++) {
    if (!uaProductNameMatchesBrand_(itemName, brandRequirements[brandIndex])) return false;
  }

  if ((queryText.indexOf('サンシェード') !== -1 || queryText.indexOf('日よけ') !== -1) &&
    (queryText.indexOf('ベランダ') !== -1 || queryText.indexOf('屋外') !== -1)) {
    const vehicleOnlyTerms = ['車用', '車載', '自動車', 'カー用品', 'フロントガラス', 'サイドウィンドウ', '後部座席'];
    if (vehicleOnlyTerms.some(function(value) { return name.indexOf(value) !== -1; })) return false;
  }

  const synonymGroups = [
    ['ビーズソファ', 'ビーズクッション', '体にフィットするソファ', 'Yogibo', 'ヨギボー'],
    ['室内ジャングルジム', 'ジャングルジム', '室内遊具'],
    ['シーリングライト', '天井照明'],
    ['テレビスタンド', 'テレビ台'],
    ['汚れ防止シート', '保護シート', '油はねガード'],
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

function uaScoreRakutenItem_(item, query, productPlan) {
  const currentItem = item || {};
  const itemName = String(currentItem.itemName || currentItem.name || '');
  if (!uaIsRakutenItemRelevant_(itemName, query)) return -1000;

  const plan = uaNormalizeProductPlan_(productPlan);
  const normalizedName = itemName.replace(/[\s　]+/g, '').toLowerCase();
  const normalizedQuery = String(query || '').replace(/[\s　]+/g, '').toLowerCase();
  let score = 40;

  const explicitlyRequestsUsed = /中古|ジャンク|used/i.test([
    query,
    plan && plan.primaryProduct,
    plan && plan.marketQuery
  ].join(' '));
  if (!explicitlyRequestsUsed && /中古|ジャンク|レンタル品|used\b/i.test(itemName)) return -1000;

  const planFit = uaEvaluateProductPlanFit_(itemName, plan);
  if (!planFit.pass) return -1000;

  function normalizedTerms(values) {
    return (values || []).reduce(function(result, value) {
      String(value || '').split(/[\s　・、,\/／()（）]+/).forEach(function(term) {
        term = term.replace(/[\s　]+/g, '').toLowerCase();
        if (term.length >= 2 && result.indexOf(term) === -1) result.push(term);
      });
      return result;
    }, []);
  }

  const queryTerms = normalizedTerms([query]).filter(function(term) {
    return !/^(家庭用|屋外|室内|おすすめ|比較|対策|セット)$/.test(term);
  });
  score += Math.min(24, queryTerms.filter(function(term) { return normalizedName.indexOf(term) !== -1; }).length * 8);

  if (plan) {
    const excludedTerms = normalizedTerms(plan.exclude);
    if (excludedTerms.some(function(term) { return normalizedName.indexOf(term) !== -1; })) return -1000;

    const primaryTerms = normalizedTerms([plan.primaryProduct, plan.marketQuery]).filter(function(term) {
      return term.length >= 2 && !/^(家庭用|屋外|室内|コンパクト|おすすめ|比較|対策)$/.test(term);
    });
    const primaryMatches = primaryTerms.filter(function(term) { return normalizedName.indexOf(term) !== -1; }).length;
    if (primaryTerms.length > 0 && primaryMatches === 0 && normalizedName.indexOf(normalizedQuery) === -1) return -1000;
    score += Math.min(30, primaryMatches * 10);

    const mustTerms = normalizedTerms(plan.mustHave);
    score += Math.min(20, mustTerms.filter(function(term) { return normalizedName.indexOf(term) !== -1; }).length * 5);

    const contextTerms = normalizedTerms([plan.purpose, plan.benefit]);
    score += Math.min(10, contextTerms.filter(function(term) { return normalizedName.indexOf(term) !== -1; }).length * 2);

    const accessoryTerms = ['交換用', '替え', '収納袋', '固定金具', '補修部品', 'パーツのみ'];
    const planAsksAccessory = accessoryTerms.some(function(term) {
      return String(plan.primaryProduct || '').indexOf(term) !== -1 || String(plan.marketQuery || '').indexOf(term) !== -1;
    });
    const accessoryOnlyTerms = ['カバーのみ', '専用カバー', '替えカバー', '交換用カバー', '補充ビーズ', '中材のみ'];
    if (!planAsksAccessory && accessoryOnlyTerms.some(function(term) { return itemName.indexOf(term) !== -1; })) {
      return -1000;
    }
    const mainUnitExplicitlyExcluded = /本体(?:は)?(?:含まれ(?:ませ)?ん|含みません|なし|別売り?|付属しません)|カバーのみ|カバー単品/i.test(itemName);
    const isCoverWithoutMainUnit = /カバー/i.test(itemName) &&
      (mainUnitExplicitlyExcluded ||
        !/(?:本体(?:付き|セット)?|本体とカバー|本体・カバー|ソファセット|クッションセット)/i.test(itemName));
    const requiresMainUnit = /本体/i.test(String(plan.marketQuery || '')) ||
      /(?:ビーズソファ|ビーズクッション)/i.test(String(plan.primaryProduct || ''));
    if (!planAsksAccessory && requiresMainUnit && isCoverWithoutMainUnit) return -1000;
    if (!planAsksAccessory && accessoryTerms.some(function(term) { return itemName.indexOf(term) !== -1; })) score -= 25;
  }

  const reviewAverage = Math.max(0, Math.min(5, Number(currentItem.reviewAverage) || 0));
  const reviewCount = Math.max(0, Number(currentItem.reviewCount) || 0);
  score += reviewAverage;
  score += Math.min(8, Math.log(reviewCount + 1) / Math.log(2));
  return Math.round(score * 10) / 10;
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

function uaTestStructuredProductPlanRouting() {
  const plan = {
    should_insert: true,
    primary_product: '冷蔵庫用床保護マット',
    market_query: '冷蔵庫 マット 透明',
    purpose: '冷蔵庫下の床の傷やへこみを抑える',
    must_have: ['冷蔵庫対応', '透明', '適合サイズ'],
    exclude: ['玄関マット', '車用マット'],
    benefit: '床の傷を気にせず冷蔵庫を設置しやすくなる',
    cta_reason: '新しい冷蔵庫を置く前なら床を保護する準備を同時に済ませられる'
  };
  const body = uaAttachProductPlanMarker_('<p>冷蔵庫を置く前にサイズを確認します。</p>', plan);
  const extracted = uaExtractProductPlan_(body);
  const row = { mainInput: '冷蔵庫マット 後悔', affiliateName: '案件無し', affiliateNotes: '' };
  const config = { key: 'home' };
  const query = uaSelectRakutenProductQuery_(body, row, config);
  const goodItem = {
    itemName: '透明 冷蔵庫マット 床保護 冷蔵庫対応 サイズ選択',
    reviewAverage: 4.5,
    reviewCount: 120
  };
  const weakItem = {
    itemName: '透明マット 汎用シート',
    reviewAverage: 4.8,
    reviewCount: 500
  };
  const excludedItem = {
    itemName: '透明 玄関マット 滑り止め',
    reviewAverage: 4.9,
    reviewCount: 900
  };
  const goodScore = uaScoreRakutenItem_(goodItem, query, extracted);
  const weakScore = uaScoreRakutenItem_(weakItem, query, extracted);
  const excludedScore = uaScoreRakutenItem_(excludedItem, query, extracted);
  const trialPlan = uaNormalizeProductPlan_({
    should_insert: true,
    primary_product: '2倍巻きトイレットペーパー',
    market_query: 'トイレットペーパー 2倍巻き',
    purpose: '交換回数を減らしながらホルダーとの相性を試す',
    must_have: ['普段使う紙のタイプに近いこと'],
    exclude: ['初回から選ぶ大容量パック', '箱買い'],
    purchase_scale: 'trial',
    cta_reason: '初回は少量パックを1つ試したい'
  });
  const trialItem = {
    itemName: '2倍巻き トイレットペーパー ダブル 60m 4ロール 1パック',
    reviewAverage: 4.2,
    reviewCount: 30
  };
  const normalPackWithoutTrialEvidence = {
    itemName: '2倍巻き トイレットペーパー ダブル 60m 8ロール',
    reviewAverage: 4.7,
    reviewCount: 300
  };
  const contradictoryBulkItem = {
    itemName: '48ロール 2倍巻き トイレットペーパー 大容量 6ロール×8パック 備蓄用',
    reviewAverage: 4.9,
    reviewCount: 9000
  };
  const disguisedBulkItem = {
    itemName: 'ふるさと納税 トイレットペーパー 2倍巻き シングルまたはダブル 備蓄 防災 日用品',
    reviewAverage: 5,
    reviewCount: 12000
  };
  const multipliedBulkItem = {
    itemName: '2倍巻き トイレットペーパー 6ロール×8パック 送料無料',
    reviewAverage: 4.8,
    reviewCount: 800
  };
  const trialScore = uaScoreRakutenItem_(trialItem, 'トイレットペーパー 2倍巻き', trialPlan);
  const unverifiedTrialScore = uaScoreRakutenItem_(normalPackWithoutTrialEvidence, 'トイレットペーパー 2倍巻き', trialPlan);
  const contradictoryBulkScore = uaScoreRakutenItem_(contradictoryBulkItem, 'トイレットペーパー 2倍巻き', trialPlan);
  const disguisedBulkScore = uaScoreRakutenItem_(disguisedBulkItem, 'トイレットペーパー 2倍巻き', trialPlan);
  const multipliedBulkScore = uaScoreRakutenItem_(multipliedBulkItem, 'トイレットペーパー 2倍巻き', trialPlan);
  const requiredFeaturePlan = uaNormalizeProductPlan_({
    should_insert: true,
    primary_product: '屋外用センサーライト',
    market_query: 'センサーライト 屋外 防水',
    required_features: ['屋外', '防水'],
    excluded_features: ['室内専用']
  });
  const requiredFeatureGood = uaEvaluateProductPlanFit_('屋外 防水 センサーライト 人感式', requiredFeaturePlan);
  const requiredFeatureMissing = uaEvaluateProductPlanFit_('室内用 センサーライト 人感式', requiredFeaturePlan);
  const excludedFeaturePlan = uaNormalizeProductPlan_({
    should_insert: true,
    primary_product: 'センサーライト',
    market_query: 'センサーライト',
    excluded_features: ['室内専用']
  });
  const excludedFeatureHit = uaEvaluateProductPlanFit_('室内用 センサーライト 人感式', excludedFeaturePlan);
  const legacyQuantityGuessPlan = uaNormalizeProductPlan_({
    should_insert: true,
    primary_product: '2倍巻きトイレットペーパー',
    cta_reason: '初回は少量パックから試したい'
  });
  const standardNormalFit = uaEvaluateProductPlanFit_('2倍巻き トイレットペーパー ダブル 6ロール', legacyQuantityGuessPlan);
  const standardBulkFit = uaEvaluateProductPlanFit_('ふるさと納税 2倍巻き トイレットペーパー 備蓄用', legacyQuantityGuessPlan);
  const normalizedStandardCopy = uaNormalizeUnsupportedTrialGuidance_(
    '<h3>初回は少量パックで試す</h3><p>少量から試すほうが安心です。</p>',
    legacyQuantityGuessPlan
  );
  const markerOnly = uaAttachProductPlanMarker_('<p>本文です。</p>', legacyQuantityGuessPlan);
  const wrappedMarker = '<p>' + markerOnly.split('\n')[0] + '</p>\n<p>本文です。</p>';
  const preservedMarker = uaPreserveProductPlanMarker_('<p>編集後です。</p>', markerOnly);
  const standardRetryQueries = uaBuildPurchaseScaleRetryQueries_('トイレットペーパー 2倍巻き', legacyQuantityGuessPlan);
  const standardSearchTuning = uaBuildRakutenSearchTuning_(legacyQuantityGuessPlan);
  const noProductBody = uaAttachProductPlanMarker_('<p>制度を確認します。</p>', {
    should_insert: false,
    purpose: '制度の確認が中心で商品購入では解決しない'
  });
  const checks = [
    { name: 'plan marker', ok: !!extracted && extracted.primaryProduct === '冷蔵庫用床保護マット' },
    { name: 'plan query priority', ok: query === '冷蔵庫 マット 透明', actual: query },
    { name: 'insert decision', ok: uaShouldInsertRakutenAffiliateBanner_(body, row, config) },
    { name: 'good item score', ok: goodScore > weakScore, actual: [goodScore, weakScore] },
    { name: 'exclude wrong category', ok: excludedScore < 1, actual: excludedScore },
    { name: 'accept trial-size product', ok: trialScore > 0, actual: trialScore },
    { name: 'reject normal pack when trial unit is not grounded', ok: unverifiedTrialScore < 1, actual: unverifiedTrialScore },
    { name: 'reject bulk product against trial CTA', ok: contradictoryBulkScore < 1, actual: contradictoryBulkScore },
    { name: 'reject stockpile product against trial CTA', ok: disguisedBulkScore < 1, actual: disguisedBulkScore },
    { name: 'reject multiplied quantity against trial CTA', ok: multipliedBulkScore < 1, actual: multipliedBulkScore },
    { name: 'accept explicit required features', ok: requiredFeatureGood.pass, actual: requiredFeatureGood },
    { name: 'reject missing required features', ok: !requiredFeatureMissing.pass, actual: requiredFeatureMissing },
    { name: 'reject explicit excluded feature', ok: !excludedFeatureHit.pass, actual: excludedFeatureHit },
    { name: 'do not infer trial SKU from CTA copy', ok: legacyQuantityGuessPlan.purchaseScale === 'standard', actual: legacyQuantityGuessPlan.purchaseScale },
    { name: 'replace unsupported trial CTA for standard purchase', ok: legacyQuantityGuessPlan.ctaReason === '初回からまとめ買いせず、通常販売単位で比較しやすいため', actual: legacyQuantityGuessPlan.ctaReason },
    { name: 'normalize unsupported trial language in standard article', ok: normalizedStandardCopy.indexOf('少量') === -1 && normalizedStandardCopy.indexOf('通常販売単位') !== -1, actual: normalizedStandardCopy },
    { name: 'accept normal quantity for standard purchase', ok: standardNormalFit.pass, actual: standardNormalFit },
    { name: 'reject explicit stockpile item for standard purchase', ok: !standardBulkFit.pass, actual: standardBulkFit },
    { name: 'hide bare product plan marker', ok: uaStripProductPlanMarker_(markerOnly) === '<p>本文です。</p>' },
    { name: 'hide paragraph-wrapped product plan marker', ok: uaStripProductPlanMarker_(wrappedMarker) === '<p>本文です。</p>' },
    { name: 'preserve hidden product plan after visible edit', ok: !!uaExtractProductPlan_(preservedMarker) && uaStripProductPlanMarker_(preservedMarker) === '<p>編集後です。</p>' },
    { name: 'retry standard retail units', ok: standardRetryQueries.join('|') === 'トイレットペーパー 2倍巻き 単品|トイレットペーパー 2倍巻き 1パック', actual: standardRetryQueries },
    { name: 'surface normal retail products before bulk listings', ok: standardSearchTuning.sort === '+itemPrice' && standardSearchTuning.ngKeyword === 'ふるさと納税', actual: standardSearchTuning },
    { name: 'skip non-product article', ok: !uaShouldInsertRakutenAffiliateBanner_(noProductBody, row, config) }
  ];
  const failures = checks.filter(function(check) { return !check.ok; });
  if (failures.length > 0) {
    throw new Error('Structured product plan routing test failed: ' + JSON.stringify(failures));
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

function uaBuildRakutenItemBannerHtml_(items, query, productPlan, appConfig) {
  items = uaDedupeRakutenItems_(items).slice(0, 3);

  if (items.length === 0) {
    return '';
  }

  const plan = uaNormalizeProductPlan_(productPlan);
  const productLabel = plan && plan.primaryProduct || query || '関連アイテム';
  const queryText = uaEscapeHtml_(productLabel);
  const isHomeArticle = String(appConfig && appConfig.key || '').trim().toUpperCase() === 'HOME';
  const homeRinkerHtml = isHomeArticle
    ? uaBuildHomeRinkerItemsHtml_(items, productLabel, appConfig)
    : '';
  const itemHtml = items.map(function(item) {
    const rawName = String(item.name || '').trim();
    const name = uaEscapeHtml_(rawName.slice(0, 80));
    const url = uaEscapeHtml_(item.url || '');
    const imageUrl = uaEscapeHtml_(item.imageUrl || '');
    const imageHtml = imageUrl
      ? '<a href=\'' + url + '\' target=\'_blank\' rel=\'nofollow sponsored\' style=\'display:block;width:92px;flex:0 0 92px;background:#fff;border:1px solid #eef1f4;border-radius:6px;padding:5px;\'><img src=\'' + imageUrl + '\' alt=\'' + name + '\' style=\'display:block;max-width:100%;height:auto;border:0;background:#fff;\'></a>'
      : '';
    const amazonSameProductButton = isHomeArticle
      ? uaBuildAmazonSameProductButton_(rawName, productLabel, appConfig)
      : '';

    return [
      '<div style=\'display:flex;gap:12px;align-items:center;padding:10px 0;border-top:1px solid #edf1f4;\'>',
      imageHtml,
      '<div style=\'min-width:0;flex:1;\'>',
      '<p style=\'margin:0 0 8px;font-size:14px;line-height:1.7;\'>' + name + '</p>',
      '<div style=\'display:flex;flex-wrap:wrap;gap:8px;\'>',
      '<a href=\'' + url + '\' target=\'_blank\' rel=\'nofollow sponsored noopener\' style=\'display:inline-block;background:#bf0000;color:#fff;text-decoration:none;font-weight:700;border-radius:6px;padding:8px 12px;\'>楽天で見る</a>',
      amazonSameProductButton,
      '</div>',
      '</div>',
      '</div>'
    ].filter(Boolean).join('');
  }).join('');

  const benefit = plan && plan.benefit ? uaEscapeHtml_(plan.benefit.replace(/[。．.]+$/, '')) + '。' : '';
  const ctaReason = plan && plan.ctaReason ? uaEscapeHtml_(plan.ctaReason.replace(/[。．.]+$/, '')) + '。' : '';
  const compareAction = items.length > 1
    ? '条件に合う場合は、下の商品候補で価格と仕様を見比べられます。'
    : '条件に合う場合は、下の商品候補で価格と仕様を確認できます。';
  const leadText = '<p>' + ctaReason + benefit + compareAction + '条件に合わなければ、無理に購入する必要はありません。</p>';
  const amazonButton = isHomeArticle ? '' : uaBuildAmazonSearchButton_(plan, query || productLabel, appConfig);
  const comparisonHeading = isHomeArticle
    ? '「' + queryText + '」を楽天・Amazonで比較する'
    : '「' + queryText + '」を楽天で比較する';

  if (homeRinkerHtml) {
    return [
      '<!-- UA_RINKER_PRODUCTS_START -->',
      leadText,
      '<p><strong>' + comparisonHeading + '</strong></p>',
      homeRinkerHtml,
      '<!-- UA_RINKER_PRODUCTS_END -->'
    ].join('\n');
  }

  return [
    '<!-- UA_PRODUCT_FOLLOWUP_START -->',
    leadText,
    '<!-- wp:html -->',
    '<div style=\'background:#fff;border:1px solid #d7dde3;border-radius:8px;padding:14px;margin:16px 0;max-width:760px;box-sizing:border-box;\'>',
    '<p style=\'margin:0 0 8px;font-weight:700;\'>' + comparisonHeading + '</p>',
    itemHtml,
    amazonButton,
    '</div>',
    '<!-- /wp:html -->',
    '<!-- UA_PRODUCT_FOLLOWUP_END -->'
  ].filter(Boolean).join('\n');
}

function uaBuildHomeRinkerItemsHtml_(items, fallbackQuery, appConfig) {
  const sourceItems = uaDedupeRakutenItems_(items).slice(0, 3);
  if (sourceItems.length === 0) return '';

  try {
    const payloadItems = sourceItems.map(function(item) {
      const itemName = String(item && item.name || '').trim();
      const keyword = uaBuildAmazonSameProductQuery_(itemName, fallbackQuery);
      return {
        title: itemName,
        keyword: keyword,
        rakuten_itemcode: String(item && item.itemCode || '').trim(),
        rakuten_title_url: String(item && item.url || '').trim(),
        rakuten_url: 'https://search.rakuten.co.jp/search/mall/' + encodeURIComponent(keyword) + '/?f=1&grp=product',
        amazon_url: 'https://www.amazon.co.jp/gp/search?ie=UTF8&keywords=' + encodeURIComponent(keyword),
        image_url: String(item && item.imageUrl || '').trim(),
        price: Number(item && item.price || 0)
      };
    }).filter(function(item) {
      return item.title && item.rakuten_title_url;
    });

    if (payloadItems.length === 0) return '';

    const wpConfig = uaGetWpConfig_(appConfig);
    const response = uaCallWordPressApi_(
      wpConfig,
      '/wp-json/article-compass/v1/rinker-items',
      'post',
      { items: payloadItems }
    );
    const savedItems = uaDedupeRinkerSavedItems_(
      response && Array.isArray(response.items) ? response.items : []
    );
    const shortcodeHtml = uaBuildRinkerShortcodeBlocks_(savedItems);
    if (!shortcodeHtml) return '';
    const selectionMeta = uaBuildManagedProductSelectionMeta_(sourceItems);

    UA_LAST_RAKUTEN_STATUS = 'Rinker商品ボックス挿入済み｜楽天で選定した同一商品名をAmazon検索にも使用';
    return [selectionMeta, shortcodeHtml].filter(Boolean).join('\n');
  } catch (e) {
    UA_LAST_RAKUTEN_STATUS = 'Rinker連携を利用できなかったため、従来の商品比較ボタンへ自動フォールバックしました: ' + e.toString();
    return '';
  }
}

function uaDedupeRinkerSavedItems_(items) {
  const seen = {};
  return (items || []).filter(function(item) {
    const postId = Number(item && item.post_id || 0);
    const key = postId > 0 ? 'post:' + postId : uaRakutenItemUniqueKey_(item);
    if (!key || seen[key]) return false;
    seen[key] = true;
    return true;
  });
}

function uaBuildRinkerShortcodeBlocks_(savedItems) {
  return uaDedupeRinkerSavedItems_(savedItems).map(function(item) {
    const postId = Number(item && item.post_id || 0);
    if (postId <= 0) return '';
    return [
      '<!-- wp:shortcode -->',
      '[itemlink post_id="' + postId + '"]',
      '<!-- /wp:shortcode -->'
    ].join('\n');
  }).filter(Boolean).join('\n\n');
}

function uaTestHomeRinkerShortcodeBlocks() {
  const actual = uaBuildRinkerShortcodeBlocks_([{ post_id: 123 }, { post_id: 456 }]);
  const expected = [
    '<!-- wp:shortcode -->',
    '[itemlink post_id="123"]',
    '<!-- /wp:shortcode -->',
    '',
    '<!-- wp:shortcode -->',
    '[itemlink post_id="456"]',
    '<!-- /wp:shortcode -->'
  ].join('\n');
  if (actual !== expected) throw new Error('Rinkerショートコードの整形テストに失敗しました。');
  if (!uaHasRakutenBanner_(actual)) throw new Error('Rinker商品ボックスの検出テストに失敗しました。');
  const marked = '<!-- UA_RINKER_PRODUCTS_START -->\n' + actual + '\n<!-- UA_RINKER_PRODUCTS_END -->';
  if (uaRemoveGeneratedRakutenBanner_(marked) !== '') throw new Error('Rinker商品ボックスの置換テストに失敗しました。');
  const legacyFollowup = [
    '<p>前の本文</p>',
    '<h2>関連アイテムも選択肢に入れる</h2>',
    '<p>本文の対策を読んで「実際に何を用意すればいいか」まで考えたい場合は、関連アイテムを見比べておくと判断しやすくなります。</p>',
    marked,
    '<h2>次の見出し</h2>'
  ].join('\n');
  if (uaRemoveGeneratedRakutenBanner_(legacyFollowup) !== '<p>前の本文</p>\n<h2>次の見出し</h2>') {
    throw new Error('旧形式の商品後入れブロックの削除テストに失敗しました。');
  }
  const wrappedFollowup = [
    '<p>前の本文</p>',
    '<!-- UA_PRODUCT_FOLLOWUP_START -->',
    '<h2>関連アイテムも選択肢に入れる</h2>',
    marked,
    '<!-- UA_PRODUCT_FOLLOWUP_END -->',
    '<h2>次の見出し</h2>'
  ].join('\n');
  if (uaRemoveGeneratedRakutenBanner_(wrappedFollowup) !== '<p>前の本文</p>\n<h2>次の見出し</h2>') {
    throw new Error('現形式の商品後入れブロックの削除テストに失敗しました。');
  }
  return { ok: true, shortcodes: 2, removableFollowupFormats: 2 };
}

function uaTestHomeRinkerConnectorStatus() {
  const appConfig = UA_APP_TYPES.home;
  const wpConfig = uaGetWpConfig_(appConfig);
  const response = uaCallWordPressApi_(wpConfig, '/wp-json/article-compass/v1/rinker-status', 'get');
  if (!response || !response.ok || !response.rinker_active) {
    throw new Error('たくみパパ側のRinker連携が有効ではありません。');
  }
  return response;
}

function uaTestHomeRinkerItemUpsert() {
  const appConfig = UA_APP_TYPES.home;
  const wpConfig = uaGetWpConfig_(appConfig);
  const testItem = {
    title: 'Article Compass Rinker連携テスト商品',
    keyword: 'Rinker 連携テスト',
    rakuten_itemcode: 'article-compass:rinker-test',
    rakuten_title_url: 'https://item.rakuten.co.jp/article-compass/rinker-test/',
    rakuten_url: 'https://search.rakuten.co.jp/search/mall/Rinker%20%E9%80%A3%E6%90%BA%E3%83%86%E3%82%B9%E3%83%88/',
    amazon_url: 'https://www.amazon.co.jp/gp/search?ie=UTF8&keywords=Rinker%20%E9%80%A3%E6%90%BA%E3%83%86%E3%82%B9%E3%83%88',
    image_url: '',
    price: 0
  };
  const first = uaCallWordPressApi_(wpConfig, '/wp-json/article-compass/v1/rinker-items', 'post', { items: [testItem] });
  const second = uaCallWordPressApi_(wpConfig, '/wp-json/article-compass/v1/rinker-items', 'post', { items: [testItem] });
  const firstId = Number(first && first.items && first.items[0] && first.items[0].post_id || 0);
  const secondId = Number(second && second.items && second.items[0] && second.items[0].post_id || 0);
  if (firstId <= 0 || firstId !== secondId) {
    throw new Error('Rinker商品リンクの重複防止テストに失敗しました。');
  }
  console.log('Rinker connector test post ID: ' + firstId);
  return { ok: true, postId: firstId, reused: true };
}

function uaBuildAmazonSameProductButton_(itemName, fallbackQuery, appConfig) {
  const associateTag = uaGetAmazonAssociateTag_(appConfig);
  if (!associateTag) return '';

  const query = uaBuildAmazonSameProductQuery_(itemName, fallbackQuery);
  if (!query) return '';

  const url = 'https://www.amazon.co.jp/s?k=' + encodeURIComponent(query) + '&tag=' + encodeURIComponent(associateTag);
  return '<a href=\'' + uaEscapeHtml_(url) + '\' target=\'_blank\' rel=\'nofollow sponsored noopener\' style=\'display:inline-block;background:#ff9900;color:#111;text-decoration:none;font-weight:700;border-radius:6px;padding:8px 12px;\'>同じ商品をAmazonで探す</a>';
}

function uaBuildAmazonSameProductQuery_(itemName, fallbackQuery) {
  let query = String(itemName || '')
    .replace(/【[^】]{0,50}】/g, ' ')
    .replace(/\[[^\]]{0,50}\]/g, ' ')
    .replace(/送料無料|送料込み|ポイント\s*\d+倍|クーポン(?:利用)?|期間限定|楽天市場/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!query) query = String(fallbackQuery || '').trim();
  if (query.length > 100) query = query.slice(0, 100).trim();
  return query;
}

function uaBuildAmazonSearchButton_(productPlan, fallbackQuery, appConfig) {
  const plan = uaNormalizeProductPlan_(productPlan);
  const associateTag = uaGetAmazonAssociateTag_(appConfig);
  if (!associateTag) return '';

  const query = String(plan && (plan.marketQuery || plan.primaryProduct) || fallbackQuery || '').trim();
  if (!query) return '';

  const url = 'https://www.amazon.co.jp/s?k=' + encodeURIComponent(query) + '&tag=' + encodeURIComponent(associateTag);
  return [
    '<p style=\'margin:12px 0 0;padding-top:12px;border-top:1px solid #edf1f4;\'>',
    '<a href=\'' + uaEscapeHtml_(url) + '\' target=\'_blank\' rel=\'nofollow sponsored noopener\' style=\'display:inline-block;background:#ff9900;color:#111;text-decoration:none;font-weight:700;border-radius:6px;padding:10px 16px;\'>同じ条件の商品をAmazonで確認する</a>',
    '</p>'
  ].join('');
}

function uaGetAmazonAssociateTag_(appConfig) {
  const props = PropertiesService.getScriptProperties();
  return uaResolveAmazonAssociateTag_(appConfig, function(key) {
    return props.getProperty(key);
  });
}

function uaResolveAmazonAssociateTag_(appConfig, propertyReader) {
  const reader = typeof propertyReader === 'function' ? propertyReader : function() { return ''; };
  const appKey = String(appConfig && appConfig.key || '').trim().toUpperCase();
  const sitePropertyKey = appKey === 'DRIVE'
    ? 'UA_AMAZON_ASSOCIATE_TAG_DRIVE'
    : appKey === 'HOME'
      ? 'UA_AMAZON_ASSOCIATE_TAG_HOME'
      : '';

  if (sitePropertyKey) {
    const siteTag = String(reader(sitePropertyKey) || '').trim();
    if (siteTag) return siteTag;
  }

  return String(reader('UA_AMAZON_ASSOCIATE_TAG') || '').trim();
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

  const mainKeywordProfile = uaGetMainKeywordProductProfile_(rowData, appConfig);
  if (mainKeywordProfile) {
    UA_LAST_RAKUTEN_STATUS = 'メインキーワードの商品を優先して挿入: ' + mainKeywordProfile.label;
    return true;
  }

  const productPlan = uaExtractProductPlan_(body);
  const hasPlanDecision = productPlan && (
    productPlan.primaryProduct || productPlan.marketQuery || productPlan.purpose ||
    productPlan.mustHave.length > 0 || productPlan.exclude.length > 0
  );
  if (hasPlanDecision && !productPlan.shouldInsert) {
    if (uaCanUseSupplementalProductPlan_(productPlan, body, rowData, appConfig)) {
      UA_LAST_RAKUTEN_STATUS = '主回答を妨げない補助商品として自然に挿入: ' +
        (productPlan.primaryProduct || productPlan.marketQuery);
      return true;
    }
    UA_LAST_RAKUTEN_STATUS = '商品選定設計で、商品購入が検索意図の解決策ではないと判定されました';
    return false;
  }
  if (productPlan && productPlan.shouldInsert && (productPlan.primaryProduct || productPlan.marketQuery)) {
    UA_LAST_RAKUTEN_STATUS = '商品選定設計に基づき挿入: ' + (productPlan.primaryProduct || productPlan.marketQuery);
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
