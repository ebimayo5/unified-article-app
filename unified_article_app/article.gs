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

    const body = uaFixGeneratedHtml_(resultJson.body);
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
