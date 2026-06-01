function uaCreateWpDraftFromWeb(data) {
  return uaCreateWpDraftFromPanel(data || {});
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
