function uaCreateWpDraftFromWeb(data) {
  return uaCreateWpDraftFromPanel(data || {});
}

function uaAddWpImagesFromWeb(data) {
  return uaAddWpImagesFromPanel(data || {});
}

function uaTestWordPressConnections() {
  const messages = [];

  Object.keys(UA_APP_TYPES).forEach(function(key) {
    const appConfig = UA_APP_TYPES[key];

    if (!appConfig.useWordPress) {
      return;
    }

    try {
      const wpConfig = uaGetWpConfig_(appConfig);
      const user = uaCallWordPressApi_(wpConfig, '/wp-json/wp/v2/users/me', 'get');
      const userLabel = user && (user.name || user.slug || user.username || user.id)
        ? (user.name || user.slug || user.username || user.id)
        : 'ユーザー取得OK';

      messages.push(appConfig.label + ': OK（' + wpConfig.siteUrl + ' / ' + userLabel + '）');
    } catch (e) {
      messages.push(appConfig.label + ': NG - ' + e.message);
    }
  });

  SpreadsheetApp.getUi().alert(messages.join('\n') || 'WordPress対象の記事タイプがありません。');
}

function uaCreateWpDraftFromPanel(data) {
  uaSaveActiveRowData(data || {});

  const sheet = uaGetSheetForData_(data || {});
  const row = Number(data && data.row) || sheet.getActiveCell().getRow();
  const rowData = uaBuildRowData_(sheet, row);
  const appConfig = uaGetAppConfigByLabel_(rowData.appType);

  if (!appConfig) {
    throw new Error('記事タイプを取得できません。A列で DRIVE BASE または たくみパパ を選んでください。');
  }

  if (appConfig && appConfig.useWordPress === false) {
    throw new Error('汎用記事はWordPress下書き作成の対象外です。本文コピーで納品してください。');
  }

  if (!rowData.body) {
    throw new Error('本文が空です。先に本文生成または本文入力をしてください。');
  }

  if (!rowData.titleIdeas) {
    throw new Error('タイトル案が空です。WordPress下書き作成前にタイトル案を入れてください。');
  }

  const wpConfig = uaGetWpConfig_(appConfig);
  const title = uaPickWpTitle_(rowData.titleIdeas);
  const slug = uaCleanWpSlug_(rowData.permalink);
  const tagIds = uaEnsureWpTagIds_(wpConfig, rowData.tags);
  const categoryIds = uaGetWpCategoryIds_(wpConfig);

  const payload = {
    title: title,
    content: rowData.body,
    status: 'draft'
  };

  if (slug) {
    payload.slug = slug;
  }

  if (tagIds.length > 0) {
    payload.tags = tagIds;
  }

  if (categoryIds.length > 0) {
    payload.categories = categoryIds;
  }

  const post = uaCallWordPressApi_(wpConfig, '/wp-json/wp/v2/posts', 'post', payload);
  const postId = post && post.id;

  if (!postId) {
    throw new Error('WordPress下書きの作成結果に投稿IDがありません。');
  }

  const editUrl = uaBuildWpEditUrl_(wpConfig.siteUrl, postId);
  const draftedAt = new Date();

  sheet.getRange(row, UA_COLUMNS.wpPostId).setValue(postId);
  sheet.getRange(row, UA_COLUMNS.wpEditUrl).setValue(editUrl);
  sheet.getRange(row, UA_COLUMNS.wpDraftedAt).setValue(draftedAt);
  sheet.getRange(row, UA_COLUMNS.status).setValue(UA_STATUS_WP_DRAFTED);

  const nextData = uaBuildRowData_(sheet, row);
  nextData.message = 'WordPress下書きを作成しました。';
  return nextData;
}

function uaAddWpImagesFromPanel(data) {
  uaSaveActiveRowData(data || {});

  const sheet = uaGetSheetForData_(data || {});
  const row = Number(data && data.row) || sheet.getActiveCell().getRow();
  const rowData = uaBuildRowData_(sheet, row);
  const appConfig = uaGetAppConfigByLabel_(rowData.appType);

  if (!appConfig) {
    throw new Error('記事タイプを取得できません。');
  }

  if (!appConfig.useWordPress) {
    throw new Error('この記事タイプはWordPress入稿対象外です。');
  }

  if (!rowData.body) {
    throw new Error('本文が空です。先に本文生成または本文入力をしてください。');
  }

  const imageItems = uaParseImageUrlMemo_(rowData.structureMemo);
  if (imageItems.length === 0) {
    throw new Error('構成メモに画像URLメモがありません。「画像URLひな形」を追加し、画像URLを入れてください。');
  }

  const wpConfig = uaGetWpConfig_(appConfig);
  let body = String(rowData.body || '');
  let featuredMediaId = 0;
  let insertedCount = 0;
  const uploaded = [];

  imageItems.forEach(function(item, index) {
    const media = uaUploadWpImageFromUrl_(wpConfig, item.url, item.alt || uaPickWpTitle_(rowData.titleIdeas) || rowData.mainInput || '記事画像', index + 1);
    uploaded.push(media);

    if (item.role === 'eyecatch') {
      featuredMediaId = media.id || featuredMediaId;
      return;
    }

    const nextBody = uaInsertWpImageAfterHeading_(body, item.heading, media);
    if (nextBody !== body) {
      body = nextBody;
      insertedCount++;
    }
  });

  sheet.getRange(row, UA_COLUMNS.body).setValue(body);

  const postId = Number(rowData.wpPostId || 0);
  if (postId > 0) {
    const payload = { content: body };
    if (featuredMediaId > 0) {
      payload.featured_media = featuredMediaId;
    }
    uaCallWordPressApi_(wpConfig, '/wp-json/wp/v2/posts/' + encodeURIComponent(postId), 'post', payload);
  }

  const nextData = uaBuildRowData_(sheet, row);
  const wpPart = postId > 0 ? 'WordPress下書きも更新しました。' : '本文へ挿入しました。WP下書き作成前なら、次回下書き作成時に反映されます。';
  nextData.message = '画像を' + uploaded.length + '件アップロードし、本文へ' + insertedCount + '件挿入しました。' + wpPart;
  return nextData;
}

function uaGetWpConfig_(appConfig) {
  if (!appConfig || !appConfig.key) {
    throw new Error('記事タイプが取得できません。');
  }

  const props = PropertiesService.getScriptProperties();
  const prefix = 'UA_WP_' + String(appConfig.key).toUpperCase() + '_';
  const fallbackPrefix = 'UA_WP_DEFAULT_';

  const siteUrl = uaTrimTrailingSlash_(props.getProperty(prefix + 'SITE_URL') || props.getProperty(fallbackPrefix + 'SITE_URL'));
  const username = props.getProperty(prefix + 'USERNAME') || props.getProperty(fallbackPrefix + 'USERNAME');
  const appPassword = props.getProperty(prefix + 'APP_PASSWORD') || props.getProperty(fallbackPrefix + 'APP_PASSWORD');
  const categoryIds = props.getProperty(prefix + 'CATEGORY_IDS') || props.getProperty(fallbackPrefix + 'CATEGORY_IDS') || '';

  if (!siteUrl || !username || !appPassword) {
    throw new Error('WordPress接続情報が未設定です。スクリプトプロパティに ' + prefix + 'SITE_URL / USERNAME / APP_PASSWORD を設定してください。');
  }

  return {
    siteUrl: siteUrl,
    username: username,
    appPassword: appPassword,
    categoryIds: categoryIds
  };
}

function uaParseImageUrlMemo_(memoText) {
  const text = String(memoText || '');
  const markerIndex = text.indexOf('【画像URLメモ】');
  const target = markerIndex >= 0 ? text.slice(markerIndex) : text;
  const lines = target.split(/\r?\n/);
  const items = [];

  lines.forEach(function(line) {
    const raw = String(line || '').trim();
    if (!raw || raw === '【画像URLメモ】') return;
    const urlMatch = raw.match(/https?:\/\/\S+/);
    if (!urlMatch) return;

    const url = urlMatch[0].replace(/[)、。,\]]+$/g, '');
    const beforeUrl = raw.slice(0, raw.indexOf(urlMatch[0])).trim();

    if (/^アイキャッチ[:：]/.test(beforeUrl) || /^eyecatch[:：]/i.test(beforeUrl)) {
      items.push({
        role: 'eyecatch',
        heading: '',
        url: url,
        alt: beforeUrl.replace(/^アイキャッチ[:：]\s*/i, '').trim()
      });
      return;
    }

    const h2Match = beforeUrl.match(/^H2[:：]\s*(.+?)(?:\s*\|\s*)?$/i);
    if (h2Match && h2Match[1]) {
      items.push({
        role: 'h2',
        heading: h2Match[1].trim(),
        url: url,
        alt: h2Match[1].trim()
      });
    }
  });

  return items;
}

function uaUploadWpImageFromUrl_(wpConfig, imageUrl, altText, index) {
  const res = UrlFetchApp.fetch(imageUrl, {
    muteHttpExceptions: true,
    followRedirects: true,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; UnifiedArticleApp/1.0; Google Apps Script)'
    }
  });
  const statusCode = res.getResponseCode();
  if (statusCode < 200 || statusCode >= 300) {
    throw new Error('画像URLを取得できませんでした。HTTP ' + statusCode + ': ' + imageUrl);
  }

  const headers = res.getHeaders();
  const contentType = String(headers['Content-Type'] || headers['content-type'] || 'image/jpeg').split(';')[0].trim();
  if (!/^image\//i.test(contentType)) {
    throw new Error('画像URLのContent-Typeが画像ではありません: ' + contentType);
  }

  const extension = uaImageExtensionFromContentType_(contentType);
  const filename = 'article-image-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss') + '-' + index + extension;
  const uploadUrl = wpConfig.siteUrl + '/wp-json/wp/v2/media';
  const options = {
    method: 'post',
    muteHttpExceptions: true,
    contentType: contentType,
    payload: res.getBlob().getBytes(),
    headers: {
      Authorization: 'Basic ' + Utilities.base64Encode(wpConfig.username + ':' + wpConfig.appPassword),
      Accept: 'application/json',
      'Content-Disposition': 'attachment; filename="' + filename + '"',
      'User-Agent': 'Mozilla/5.0 (compatible; UnifiedArticleApp/1.0; Google Apps Script)'
    }
  };

  const uploadRes = UrlFetchApp.fetch(uploadUrl, options);
  const uploadStatus = uploadRes.getResponseCode();
  const uploadText = uploadRes.getContentText();
  let media = {};
  try {
    media = uploadText ? JSON.parse(uploadText) : {};
  } catch (e) {
    throw new Error('WordPressメディア登録の返答をJSONとして読めませんでした。HTTP ' + uploadStatus + ': ' + uploadText);
  }

  if (uploadStatus < 200 || uploadStatus >= 300 || !media.id) {
    throw new Error('WordPressメディア登録に失敗しました。HTTP ' + uploadStatus + ': ' + uploadText);
  }

  if (altText) {
    try {
      uaCallWordPressApi_(wpConfig, '/wp-json/wp/v2/media/' + encodeURIComponent(media.id), 'post', {
        alt_text: String(altText || '').slice(0, 120)
      });
    } catch (e) {
      // Alt text update is useful but not critical enough to stop insertion.
    }
  }

  return {
    id: media.id,
    url: media.source_url || imageUrl,
    alt: String(altText || '').slice(0, 120)
  };
}

function uaImageExtensionFromContentType_(contentType) {
  const type = String(contentType || '').toLowerCase();
  if (type.indexOf('png') !== -1) return '.png';
  if (type.indexOf('webp') !== -1) return '.webp';
  if (type.indexOf('gif') !== -1) return '.gif';
  return '.jpg';
}

function uaInsertWpImageAfterHeading_(bodyHtml, headingText, media) {
  const targetHeading = uaNormalizeHeadingText_(headingText);
  if (!targetHeading || !media || !media.url) return bodyHtml;

  const imageBlock = uaBuildWpImageBlock_(media);
  const h2Regex = /<h2\b[^>]*>[\s\S]*?<\/h2>/gi;
  let match;

  while ((match = h2Regex.exec(bodyHtml)) !== null) {
    const currentHeading = uaNormalizeHeadingText_(match[0]);
    if (currentHeading !== targetHeading) continue;

    const insertAt = match.index + match[0].length;
    const nextChunk = bodyHtml.slice(insertAt, insertAt + 500);
    if (nextChunk.indexOf('wp-block-image') !== -1 && nextChunk.indexOf(media.url) !== -1) {
      return bodyHtml;
    }

    return bodyHtml.slice(0, insertAt) + '\n\n' + imageBlock + '\n\n' + bodyHtml.slice(insertAt);
  }

  return bodyHtml;
}

function uaNormalizeHeadingText_(htmlText) {
  return String(htmlText || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function uaBuildWpImageBlock_(media) {
  const id = Number(media.id || 0);
  const url = String(media.url || '');
  const alt = String(media.alt || '').replace(/"/g, '&quot;');
  return '<!-- wp:image {"id":' + id + ',"sizeSlug":"large","linkDestination":"none"} -->\n' +
    '<figure class="wp-block-image size-large"><img src="' + url + '" alt="' + alt + '" class="wp-image-' + id + '"/></figure>\n' +
    '<!-- /wp:image -->';
}

function uaCallWordPressApi_(wpConfig, path, method, payload) {
  const url = wpConfig.siteUrl + path;
  const headers = {
    Authorization: 'Basic ' + Utilities.base64Encode(wpConfig.username + ':' + wpConfig.appPassword),
    Accept: 'application/json',
    'User-Agent': 'Mozilla/5.0 (compatible; UnifiedArticleApp/1.0; Google Apps Script)'
  };

  const options = {
    method: method || 'get',
    headers: headers,
    muteHttpExceptions: true
  };

  if (payload) {
    options.contentType = 'application/json';
    options.payload = JSON.stringify(payload);
  }

  const res = UrlFetchApp.fetch(url, options);
  const statusCode = res.getResponseCode();
  const text = res.getContentText();

  let json = {};

  try {
    json = text ? JSON.parse(text) : {};
  } catch (e) {
    if (statusCode === 403 && /^<!DOCTYPE|^<html/i.test(String(text || '').trim())) {
      throw new Error('WordPress REST APIがサーバー側で403拒否されています。' +
        'WAF、セキュリティプラグイン、Basic認証、.htaccess、REST API制限を確認してください。URL: ' + url);
    }

    throw new Error('WordPress APIの返答をJSONとして読めませんでした。HTTP ' + statusCode + ': ' + text);
  }

  if (statusCode < 200 || statusCode >= 300) {
    const message = json && json.message ? json.message : text;
    throw new Error('WordPress APIエラー HTTP ' + statusCode + ': ' + message);
  }

  return json;
}

function uaEnsureWpTagIds_(wpConfig, tagsText) {
  const tagNames = uaSplitTags_(tagsText).slice(0, 10);
  const ids = [];

  tagNames.forEach(function(tagName) {
    const id = uaFindOrCreateWpTag_(wpConfig, tagName);
    if (id) ids.push(id);
  });

  return ids;
}

function uaFindOrCreateWpTag_(wpConfig, tagName) {
  const cleanName = String(tagName || '').trim();

  if (!cleanName) {
    return 0;
  }

  const searchPath = '/wp-json/wp/v2/tags?search=' + encodeURIComponent(cleanName) + '&per_page=20';
  const results = uaCallWordPressApi_(wpConfig, searchPath, 'get');

  if (Array.isArray(results)) {
    for (let i = 0; i < results.length; i++) {
      if (String(results[i].name || '').trim() === cleanName) {
        return results[i].id || 0;
      }
    }
  }

  try {
    const created = uaCallWordPressApi_(wpConfig, '/wp-json/wp/v2/tags', 'post', {
      name: cleanName
    });
    return created && created.id ? created.id : 0;
  } catch (e) {
    const retryResults = uaCallWordPressApi_(wpConfig, searchPath, 'get');
    if (Array.isArray(retryResults) && retryResults.length > 0) {
      return retryResults[0].id || 0;
    }
    throw e;
  }
}

function uaSplitTags_(tagsText) {
  const seen = {};
  const tags = [];

  String(tagsText || '')
    .split(/[,，、\n]/)
    .forEach(function(rawTag) {
      const tag = String(rawTag || '')
        .replace(/^#+/, '')
        .trim();

      if (!tag || seen[tag]) return;
      seen[tag] = true;
      tags.push(tag);
    });

  return tags;
}

function uaGetWpCategoryIds_(wpConfig) {
  return String(wpConfig.categoryIds || '')
    .split(/[,，、\s]+/)
    .map(function(id) {
      return Number(id);
    })
    .filter(function(id) {
      return id > 0;
    });
}

function uaPickWpTitle_(titleIdeas) {
  const text = String(titleIdeas || '').trim();

  if (!text) {
    return '';
  }

  const first = text
    .split(/\s*[\/／]\s*|\n/)[0]
    .replace(/^案\s*\d+\s*[:：.\-、]?\s*/i, '')
    .trim();

  return first || text;
}

function uaCleanWpSlug_(slug) {
  return String(slug || '')
    .toLowerCase()
    .replace(/[^a-z0-9\-_/]+/g, '-')
    .replace(/_/g, '-')
    .replace(/\/+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .trim();
}

function uaBuildWpEditUrl_(siteUrl, postId) {
  return uaTrimTrailingSlash_(siteUrl) + '/wp-admin/post.php?post=' + encodeURIComponent(postId) + '&action=edit';
}

function uaTrimTrailingSlash_(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}
