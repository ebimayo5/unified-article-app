function uaStripJsonFence_(text) {
  return String(text || '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function uaCleanText_(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function uaStripHtml_(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<aside[\s\S]*?<\/aside>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
}

function uaDecodeHtmlEntities_(text) {
  return String(text || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function uaFormatReaderMindMemoValue_(value) {
  if (!value) return '';

  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(function(item) {
      return uaFormatReaderMindMemoValue_(item);
    }).filter(Boolean).join('\n');
  }

  if (typeof value === 'object') {
    return Object.keys(value).map(function(key) {
      const formatted = uaFormatReaderMindMemoValue_(value[key]);
      return formatted ? '【' + key + '】\n' + formatted : '';
    }).filter(Boolean).join('\n\n');
  }

  return String(value);
}

function uaFindDeterministicKeywordSiteFitIssue_(mainInput, appConfig) {
  const input = String(mainInput || '').trim();
  const compact = input.replace(/[\s　]+/g, '');
  const appKey = String(appConfig && appConfig.key || '').toLowerCase();
  if (!input || !appKey || appKey === 'general') return null;

  if (appKey === 'drive') {
    const explicitlyAutomotive = /(車|自動車|車載|カーナビ|カー用品|運転|走行|ディーラー|メーカー|車種)/i.test(input);
    const knownPcRecoveryIntent = /トラブル解決ナビ|recovery\s*and\s*utility/i.test(compact) ||
      (/(富士通|FMV|Windows|パソコン|PC|リカバリ|復旧領域|回復環境)/i.test(input) && !explicitlyAutomotive);
    if (knownPcRecoveryIntent) {
      return {
        status: 'off_topic',
        primaryIntent: '富士通FMVなどのパソコン復旧機能を探す検索意図',
        reason: '「トラブル解決ナビ」は車載ナビの一般語ではなく、富士通PCの復旧機能名として使われます。'
      };
    }
  }

  return null;
}

function uaNormalizeReaderMindSiteFit_(value) {
  const source = value && typeof value === 'object' ? value : {};
  const rawStatus = String(source.status || source['判定'] || '').toLowerCase().trim();
  const status = rawStatus === 'off_topic' || rawStatus === 'off-topic' || rawStatus === '対象外'
    ? 'off_topic'
    : rawStatus === 'ambiguous' || rawStatus === '要確認'
    ? 'ambiguous'
    : rawStatus === 'fit' || rawStatus === '適合'
    ? 'fit'
    : '';
  return {
    status: status,
    primaryIntent: String(source.primary_intent || source.primaryIntent || source['主な検索意図'] || '').trim(),
    reason: String(source.reason || source['理由'] || '').trim()
  };
}

function uaBuildSiteFitStopMessage_(issue, appConfig) {
  const siteLabel = String(appConfig && appConfig.label || 'このサイト');
  const intent = String(issue && issue.primaryIntent || '').trim();
  const reason = String(issue && issue.reason || '').trim();
  return 'キーワードの検索意図が「' + siteLabel + '」の対象外です。' +
    (intent ? ' 主な検索意図: ' + intent + '。' : '') +
    (reason ? ' ' + reason : '') +
    ' 候補シートでは「保留」にし、車・住宅などサイトの主題に合うキーワードを選び直してください。';
}

function uaSetFactCheckPointsWithLinks_(sheet, rowNumber, text) {
  const range = sheet.getRange(rowNumber, UA_COLUMNS.factCheckPoints);
  const value = String(text || '').trim();

  if (!value || value === '特になし') {
    range.setValue(value || '特になし');
    return;
  }

  const builder = SpreadsheetApp.newRichTextValue().setText(value);
  const urlPattern = /https?:\/\/[^\s\n]+/g;
  let match;

  while ((match = urlPattern.exec(value)) !== null) {
    const url = match[0].replace(/[),.。]$/, '');
    builder.setLinkUrl(match.index, match.index + url.length, url);
  }

  range.setRichTextValue(builder.build());
}
