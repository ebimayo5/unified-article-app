const UA_AUTOMATIC_ARTICLE_DEFAULTS = {
  drive: {
    h2Guide: '基本6〜8個',
    faqMin: 3,
    faqMax: 5,
    internalLinkMax: 3
  },
  home: {
    h2Guide: '基本6〜8個',
    faqMin: 3,
    faqMax: 5,
    internalLinkMax: 3
  },
  general: {
    h2Guide: '内容に必要な数',
    faqMin: 2,
    faqMax: 5,
    internalLinkMax: 0
  }
};

function uaGetAutomaticArticlePolicy_(rowData, appConfig) {
  const key = String(appConfig && appConfig.key || 'general');
  const defaults = UA_AUTOMATIC_ARTICLE_DEFAULTS[key] || UA_AUTOMATIC_ARTICLE_DEFAULTS.general;
  const input = String(rowData && rowData.mainInput || '');
  const articleType = uaDetectAutomaticArticleType_(input);
  const cluster = uaInferTopicCluster_(input, appConfig);
  const revenuePolicy = key === 'home'
    ? uaGetHomeRevenuePolicy_(rowData)
    : null;

  return {
    articleType: articleType,
    cluster: cluster,
    h2Guide: defaults.h2Guide,
    faqMin: defaults.faqMin,
    faqMax: defaults.faqMax,
    internalLinkMax: defaults.internalLinkMax,
    revenuePolicy: revenuePolicy
  };
}

function uaDetectAutomaticArticleType_(input) {
  const text = uaNormalizeForScore_(input);
  const patterns = [
    { key: 'comparison', label: '比較・選択', pattern: /(?:比較|どっち|どちら|\bvs\b|違い)/i },
    { key: 'regret', label: '後悔・デメリット解消', pattern: /(?:後悔|やめとけ|デメリット|欠点|失敗|最悪)/i },
    { key: 'reputation', label: '評判・口コミ検証', pattern: /(?:評判|口コミ|怪しい|実際どう|本当)/i },
    { key: 'trouble', label: 'トラブル解決', pattern: /(?:故障|不具合|エラー|動かない|映らない|直らない|解決|対処|復旧)/i },
    { key: 'price', label: '費用・価格判断', pattern: /(?:費用|料金|価格|値段|相場|工賃|維持費|安い理由)/i },
    { key: 'recommendation', label: 'おすすめ・選び方', pattern: /(?:おすすめ|ランキング|選び方|何がいい|どれがいい)/i },
    { key: 'where', label: '購入場所・依頼先', pattern: /(?:どこで買う|どこに売ってる|どこで売ってる|どこが安い|どこに頼む|依頼先)/i },
    { key: 'howto', label: '方法・手順', pattern: /(?:方法|やり方|手順|取り付け|交換|設定|使い方)/i }
  ];

  for (let i = 0; i < patterns.length; i += 1) {
    if (patterns[i].pattern.test(text)) return patterns[i];
  }
  return { key: 'standard', label: '総合解説' };
}

function uaGetAutomaticArticleTypeInstructions_(articleType) {
  const key = String(articleType && articleType.key || 'standard');
  const instructions = {
    comparison: '比較軸を先に示し、条件別の向き・不向きから結論を選べる構成にする。項目数を無理にそろえない。',
    regret: '不安を煽らず、後悔の原因、避けられる条件、購入前チェック、向く人・向かない人の順で判断できる構成にする。',
    reputation: '評判を事実扱いせず、確認できる事実、口コミで意見が分かれる点、判断基準を分ける。',
    trouble: '最初に症状と緊急度を切り分け、安全確認、原因候補、簡単な対処、専門家へ任せる境界の順にする。',
    price: '金額を断定せず、価格を左右する条件、内訳、比較方法、追加費用の確認項目を示す。',
    recommendation: 'ランキングありきにせず、用途と選定基準を先に示し、条件別候補と選び方を結びつける。',
    where: '購入・依頼先ごとの違い、価格以外の条件、失敗しない確認項目を整理する。',
    howto: '前提条件、安全確認、手順、つまずきやすい点、中止して専門家へ任せる条件を整理する。',
    standard: '結論を先に示し、理由、判断材料、注意点、次の行動へ自然につなぐ。'
  };
  return instructions[key] || instructions.standard;
}

function uaBuildAutomaticArticlePolicyPrompt_(rowData, appConfig) {
  const policy = uaGetAutomaticArticlePolicy_(rowData, appConfig);
  const lines = [
    '【システム自動判定（追加入力不要）】',
    '記事型: ' + policy.articleType.label,
    'トピッククラスター: ' + policy.cluster.label,
    '構成方針: ' + uaGetAutomaticArticleTypeInstructions_(policy.articleType),
    'H2目安: ' + policy.h2Guide + '。数合わせはせず、役割が重複する見出しだけを統合する。',
    'FAQ: Googleの「他の人はこちらも質問」に相当する実質問が読者心理メモにある場合は重複を除いて優先し、不足分だけ検索意図から補完する。本文で十分に答えた質問はFAQで繰り返さない。',
    '参考情報: このキーワード用に自動取得した上位URL・公式情報だけを今回の記事の判断材料にする。別記事で取得したURLや未確認情報を流用しない。',
    '案件導線: 案件名と案件注意点を各H2の内容に照合し、読者が次の選択肢を必要とする最も関連性の高い節へ置く。関連性が弱い場合は新しい案件専用H2を作らない。',
    '内部リンク: 「' + policy.cluster.label + '」と同じテーマの記事を優先し、読者の次の疑問に直接つながる候補だけを使う。'
  ];
  if (policy.revenuePolicy) {
    lines.push('たくみパパの収益導線: ' + policy.revenuePolicy.label + '。' + policy.revenuePolicy.instruction);
  }
  return lines.join('\n');
}

function uaGetHomeRevenuePolicy_(rowData) {
  const data = rowData || {};
  const input = uaNormalizeForScore_(data.mainInput);
  const affiliateName = String(data.affiliateName || '');
  const affiliateNotes = String(data.affiliateNotes || '');
  const affiliateText = [affiliateName, affiliateNotes].join(' ');
  const isSekisuiReferral = /積水ハウス/.test(affiliateText) || /積水ハウス.{0,12}(紹介|紹介制度)/.test(input);
  const isHouseBuildingTopic = /(注文住宅|新築|家を建て|家づくり|マイホーム|ハウスメーカー|工務店|住宅展示場|土地探し|間取り|積水ハウス)/i.test(input);
  const hasProductDecisionIntent = /(後悔|デメリット|いらない|必要|カビ|錆びる|落ちる|壊れやすい|臭い|邪魔|入らない|代用)/i.test(input);
  const hasProductConversionIntent = /(どっち|どちら|比較|違い|口コミ|評判|サイズ|大きさ|おすすめ|選び方|どこで買う|どこに売ってる)/i.test(input);

  if (isSekisuiReferral) {
    return {
      key: 'sekisui_referral',
      label: '積水ハウス紹介制度につなぐ家づくり核記事',
      instruction: '積水ハウスを押し売りせず、家づくり条件と相談前の確認点を整理したうえで紹介制度へつなぐ。住宅成約まで距離がある高単価案件なので、無関係な暮らし用品記事からは誘導しない。'
    };
  }
  if (isHouseBuildingTopic) {
    return {
      key: 'house_research',
      label: '家づくり集客・信頼形成記事',
      instruction: '新築・リフォームの判断材料を優先し、商品を無理に売らない。検索意図に合う場合だけ積水ハウス紹介制度の核記事または関連する家づくり記事へ内部リンクする。'
    };
  }
  if (hasProductConversionIntent) {
    return {
      key: 'product_conversion',
      label: '暮らし用品の成約記事',
      instruction: '条件別の比較、買わなくてよい人、購入前確認を示したうえで、実際に選べる商品候補とAmazon・楽天等の購入先へ明確につなぐ。CTA前に、なぜその商品を確認するのかを具体的に書く。'
    };
  }
  if (hasProductDecisionIntent) {
    return {
      key: 'product_decision',
      label: '暮らし用品の購入判断記事',
      instruction: '必要な人・不要な人を分け、商品購入が有効な解決策の場合は選び方と商品候補まで示す。押し売りはせず、結論を「家庭による」だけで終わらせない。'
    };
  }
  return {
    key: 'living_traffic',
    label: '暮らし改善の集客記事',
    instruction: '悩みの解決を優先し、商品が直接の解決策になる場合だけ購入判断記事または商品候補へつなぐ。出口のない記事にはせず、次に読む関連記事か確認行動を示す。'
  };
}

function uaInferTopicCluster_(input, appConfig) {
  const text = uaNormalizeForScore_(input);
  const appKey = String(appConfig && appConfig.key || '');
  const common = [
    { key: 'purchase', label: '購入判断・後悔対策', pattern: /後悔|失敗|やめとけ|評判|口コミ|中古|購入|買う|比較/ },
    { key: 'cost', label: '費用・維持管理', pattern: /費用|料金|価格|相場|工賃|維持費|交換/ },
    { key: 'trouble', label: 'トラブル・安全対策', pattern: /故障|不具合|エラー|危険|安全|法律|車検|対処|解決/ }
  ];
  const drive = [
    { key: 'car_entertainment', label: 'ナビ・車内エンタメ', pattern: /ナビ|carplay|android|hdmi|モニター|テレビ|オーディオ|ミラーリング/ },
    { key: 'maintenance', label: '整備・メンテナンス', pattern: /オイル|ブレーキ|バッテリー|タイヤ|整備|修理|点検/ },
    { key: 'car_care', label: '洗車・カーケア', pattern: /洗車|コーティング|ワックス|水垢|油膜|汚れ|クリーナー/ },
    { key: 'comfort', label: '車内快適化・車中泊', pattern: /車中泊|サンシェード|暑い|寒い|収納|シート|エアコン/ }
  ];
  const home = [
    { key: 'layout', label: '間取り・生活動線', pattern: /間取り|動線|玄関|リビング|寝室|通路/ },
    { key: 'storage', label: '収納・片付け', pattern: /収納|片付け|クローゼット|パントリー|棚/ },
    { key: 'equipment', label: '住宅設備・水回り', pattern: /キッチン|風呂|浴室|洗面|トイレ|設備|給湯/ },
    { key: 'comfort', label: '住環境・快適性', pattern: /断熱|結露|換気|暑い|寒い|カビ|湿気|日よけ|サンシェード/ },
    { key: 'exterior', label: '外構・庭・駐車場', pattern: /外構|庭|駐車場|境界|フェンス|アプローチ/ }
  ];
  const candidates = (appKey === 'drive' ? drive : appKey === 'home' ? home : []).concat(common);
  for (let i = 0; i < candidates.length; i += 1) {
    if (candidates[i].pattern.test(text)) return candidates[i];
  }
  return { key: appKey + '_general', label: appKey === 'drive' ? '車選び・カーライフ' : appKey === 'home' ? '家づくり・暮らし' : '総合' };
}

function uaFetchGooglePaaQuestions_(keyword, maxCount) {
  const query = String(keyword || '').trim();
  if (!query) return [];
  try {
    const response = UrlFetchApp.fetch('https://www.google.com/search?hl=ja&gl=jp&gbv=1&q=' + encodeURIComponent(query), {
      muteHttpExceptions: true,
      followRedirects: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'ja-JP,ja;q=0.9'
      }
    });
    if (response.getResponseCode() !== 200) return [];
    return uaExtractGooglePaaQuestions_(response.getContentText('UTF-8'), maxCount || 6);
  } catch (e) {
    return [];
  }
}

function uaExtractGooglePaaQuestions_(html, maxCount) {
  const source = String(html || '')
    .replace(/\\u003d/g, '=')
    .replace(/\\u0026/g, '&')
    .replace(/\\x3c/g, '<')
    .replace(/\\x3e/g, '>');
  const patterns = [
    /data-q=["']([^"']{6,160})["']/gi,
    /jsname=["']Cpkphb["'][^>]*>([\s\S]*?)<\/[^>]+>/gi,
    /["']question["']\s*:\s*["']([^"']{6,160})["']/gi
  ];
  const results = [];
  patterns.forEach(function(pattern) {
    let match;
    while ((match = pattern.exec(source)) !== null && results.length < (maxCount || 6)) {
      const question = uaNormalizePaaQuestion_(match[1]);
      if (question && results.indexOf(question) === -1) results.push(question);
    }
  });
  return results.slice(0, maxCount || 6);
}

function uaNormalizePaaQuestion_(value) {
  const text = uaCleanText_(uaDecodeHtmlEntities_(uaStripHtml_(String(value || ''))))
    .replace(/\\[nrt]/g, ' ')
    .replace(/\\"/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length < 6 || text.length > 120) return '';
  if (!/(?:[？?]$|とは$|なぜ|どう|どこ|いつ|いくら|何|できますか|ですか|ますか|でしょうか)/.test(text)) return '';
  return text.replace(/\?$/, '？');
}

function uaBuildPaaPromptText_(questions) {
  const values = (Array.isArray(questions) ? questions : []).filter(Boolean);
  if (!values.length) {
    return 'Googleの「他の人はこちらも質問」は取得できませんでした。収集データと検索意図からFAQ候補を補完してください。取得失敗だけを理由に処理を停止しないでください。';
  }
  return 'Googleの「他の人はこちらも質問」で取得した実質問:\n' + values.map(function(value, index) {
    return (index + 1) + '. ' + value;
  }).join('\n');
}

function uaBuildAffiliateContextTerms_(rowData, appConfig) {
  const source = [
    rowData && rowData.affiliateName,
    rowData && rowData.affiliateNotes
  ].join(' ');
  const terms = uaGetInternalLinkQueryTerms_(source);
  const cluster = uaInferTopicCluster_(source, appConfig);
  const clusterTerms = uaGetInternalLinkExpandedTerms_(cluster.label, appConfig);
  clusterTerms.forEach(function(term) {
    if (terms.indexOf(term) === -1) terms.push(term);
  });
  return terms;
}

function uaRelocateManagedAffiliateTokenByContext_(body, rowData, appConfig) {
  const html = String(body || '');
  const tokenPattern = /\[UA_AFFILIATE_CTA[:：]\s*[^\]\r\n]{1,160}\]/i;
  const token = tokenPattern.exec(html);
  if (!token) return html;
  const sections = uaExtractH2SectionsForInsert_(html);
  const terms = uaBuildAffiliateContextTerms_(rowData, appConfig);
  if (!sections.length || !terms.length) return html;

  let best = null;
  sections.forEach(function(section) {
    if (/よくある質問|まとめ/i.test(section.headingText)) return;
    const normalized = uaNormalizeForScore_(section.text);
    let score = 0;
    terms.forEach(function(term) {
      if (normalized.indexOf(term) !== -1) score += term.length >= 4 ? 3 : 1;
    });
    if (/(比較|選び方|判断|対策|解決|後付け|依頼|相談|購入)/.test(section.headingText)) score += 1;
    if (score > 0 && (!best || score > best.score)) best = { score: score, insertIndex: section.endIndex };
  });
  if (!best) return html;

  const currentSection = sections.filter(function(section) {
    return token.index >= section.startIndex && token.index < section.endIndex;
  })[0];
  let currentScore = 0;
  if (currentSection) {
    const currentText = uaNormalizeForScore_(currentSection.text);
    terms.forEach(function(term) { if (currentText.indexOf(term) !== -1) currentScore += term.length >= 4 ? 3 : 1; });
  }
  if (currentSection && currentScore + 1 >= best.score) return html;

  const targetHeading = sections.filter(function(section) {
    return section.endIndex === best.insertIndex;
  })[0].headingText;
  const withoutToken = html.replace(tokenPattern, '').replace(/<p\b[^>]*>\s*<\/p>/i, '');
  const refreshedTarget = uaExtractH2SectionsForInsert_(withoutToken).filter(function(section) {
    return section.headingText === targetHeading;
  })[0];
  const adjustedIndex = refreshedTarget ? refreshedTarget.endIndex : withoutToken.length;
  return [
    withoutToken.slice(0, adjustedIndex).trimEnd(),
    '<!-- wp:paragraph -->\n<p>' + token[0] + '</p>\n<!-- /wp:paragraph -->',
    withoutToken.slice(adjustedIndex).trimStart()
  ].filter(Boolean).join('\n\n');
}

function uaTestAutomaticArticleEnhancements() {
  const drive = UA_APP_TYPES.drive;
  const cases = [
    ['フィット 後悔', 'regret', 'purchase'],
    ['カーナビ 比較', 'comparison', 'car_entertainment'],
    ['オイル交換 費用', 'price', 'maintenance']
  ];
  cases.forEach(function(item) {
    const policy = uaGetAutomaticArticlePolicy_({ mainInput: item[0] }, drive);
    if (policy.articleType.key !== item[1]) throw new Error('記事型の自動判定に失敗: ' + item[0]);
    if (policy.cluster.key !== item[2]) throw new Error('クラスターの自動判定に失敗: ' + item[0]);
  });

  const paa = uaExtractGooglePaaQuestions_('<div data-q="フィットは何年乗れますか？"></div><div data-q="フィットで後悔する理由は？"></div>', 5);
  if (paa.length !== 2) throw new Error('PAA実質問の抽出テストに失敗しました。');

  const sample = '<h2>特徴</h2><p>[UA_AFFILIATE_CTA:テスト案件で確認する]</p><h2>購入後のナビ対策</h2><p>ナビやモニターを後付けする選択肢です。</p><h2>まとめ</h2><p>まとめ</p>';
  const moved = uaRelocateManagedAffiliateTokenByContext_(sample, { affiliateName: 'ナビ専門店', affiliateNotes: 'ナビ モニター 後付け' }, drive);
  if (moved.indexOf('[UA_AFFILIATE_CTA') < moved.indexOf('購入後のナビ対策')) throw new Error('案件CTAの見出し照合テストに失敗しました。');

  const homeRevenueCases = [
    [{ mainInput: '冷蔵庫マット 後悔' }, 'product_decision'],
    [{ mainInput: 'ランドリーチェスト 口コミ' }, 'product_conversion'],
    [{ mainInput: '積水ハウス 紹介制度' }, 'sekisui_referral'],
    [{ mainInput: '新築 間取り 後悔' }, 'house_research'],
    [{ mainInput: '洗面所 収納 悩み' }, 'living_traffic']
  ];
  homeRevenueCases.forEach(function(item) {
    const actual = uaGetHomeRevenuePolicy_(item[0]);
    if (actual.key !== item[1]) throw new Error('たくみパパ収益導線の判定に失敗: ' + item[0].mainInput + ' / ' + actual.key);
  });

  return { ok: true, articleTypes: cases.length, paaQuestions: paa.length, affiliateRelocation: true, homeRevenuePolicies: homeRevenueCases.length };
}
