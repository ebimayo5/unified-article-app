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
