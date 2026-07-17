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
        : 'user';

      messages.push(appConfig.label + ': OK - ' + wpConfig.siteUrl + ' / ' + userLabel);
    } catch (e) {
      messages.push(appConfig.label + ': NG - ' + e.message);
    }
  });

  SpreadsheetApp.getUi().alert(messages.join('`n') || 'No WordPress app type found.');
}

function uaCreateWpDraftFromPanel(data) {
  uaSaveActiveRowData(data || {});

  const sheet = uaGetSheetForData_(data || {});
  const row = Number(data && data.row) || sheet.getActiveCell().getRow();
  const rowData = uaBuildRowData_(sheet, row);
  const appConfig = uaGetAppConfigByLabel_(rowData.appType);

  if (!appConfig) {
    throw new Error('WP draft: article type was not found. Open DRIVE BASE or Takumi Papa and select the target row.');
  }

  if (appConfig && appConfig.useWordPress === false) {
    throw new Error('WP draft: this article type is not configured for WordPress drafts.');
  }

  if (!rowData.body) {
    throw new Error('WP draft: body is empty. Generate or paste body first.');
  }

  if (!rowData.titleIdeas) {
    throw new Error('WP draft: title candidates are empty.');
  }

  const wpBody = uaNormalizeAnchorRelAttributes_(uaApplyNaviokunIntroSet_(
    uaApplyManagedAffiliateCta_(rowData.body, rowData, appConfig),
    rowData,
    appConfig
  ));
  if (wpBody !== String(rowData.body || '')) {
    sheet.getRange(row, UA_COLUMNS.body).setValue(wpBody);
    rowData.body = wpBody;
  }

  uaAssertWpDraftHardQualityGates_(rowData);

  const wpConfig = uaGetWpConfig_(appConfig);
  const title = uaPickWpTitle_(rowData.titleIdeas);
  const slug = uaCleanWpSlug_(rowData.permalink);
  const tagIds = uaEnsureWpTagIds_(wpConfig, rowData.tags);
  const categoryIds = uaGetWpCategoryIds_(wpConfig);
  const existingPostId = Number(rowData.wpPostId || 0);

  const payload = {
    title: title,
    content: wpBody,
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

  let post;
  let updatedExistingDraft = false;
  if (existingPostId > 0) {
    const existingPost = uaFetchWpPostForEdit_(wpConfig, existingPostId);
    const existingStatus = String(existingPost && existingPost.status || '').trim();
    const editableStatuses = ['draft', 'pending', 'auto-draft'];
    if (editableStatuses.indexOf(existingStatus) === -1) {
      throw new Error('WP draft: 投稿ID ' + existingPostId + ' は「' + (existingStatus || '状態不明') + '」のため自動更新しません。公開済み・予約済み記事の誤更新を防ぐため停止しました。');
    }
    payload.status = existingStatus === 'auto-draft' ? 'draft' : existingStatus;
    post = uaCallWordPressApi_(
      wpConfig,
      '/wp-json/wp/v2/posts/' + encodeURIComponent(existingPostId),
      'post',
      payload
    );
    updatedExistingDraft = true;
  } else {
    post = uaCallWordPressApi_(wpConfig, '/wp-json/wp/v2/posts', 'post', payload);
  }
  const postId = post && post.id;

  if (!postId) {
    throw new Error('WP draft: WordPress did not return a post ID.');
  }
  if (existingPostId > 0 && Number(postId) !== existingPostId) {
    throw new Error('WP draft: 既存下書きの更新確認に失敗しました。別の投稿IDは保存しません。');
  }

  const editUrl = uaBuildWpEditUrl_(wpConfig.siteUrl, postId);
  const draftedAt = new Date();

  sheet.getRange(row, UA_COLUMNS.wpPostId).setValue(postId);
  sheet.getRange(row, UA_COLUMNS.wpEditUrl).setValue(editUrl);
  sheet.getRange(row, UA_COLUMNS.wpDraftedAt).setValue(draftedAt);
  sheet.getRange(row, UA_COLUMNS.status).setValue(UA_STATUS_WP_DRAFTED);

  const nextData = uaBuildRowData_(sheet, row);
  nextData.message = updatedExistingDraft
    ? 'WordPressの既存下書きを更新しました。'
    : 'WordPress下書きを作成しました。';
  return nextData;
}

function uaAddWpImagesFromPanel(data) {
  uaSaveActiveRowData(data || {});

  const sheet = uaGetSheetForData_(data || {});
  const row = Number(data && data.row) || sheet.getActiveCell().getRow();
  const rowData = uaBuildRowData_(sheet, row);
  const appConfig = uaGetAppConfigByLabel_(rowData.appType);

  if (!appConfig) {
    throw new Error('WP images: article type was not found.');
  }

  if (!appConfig.useWordPress) {
    throw new Error('WP images: this article type is not configured for WordPress.');
  }

  if (!rowData.body) {
    throw new Error('WP images: body is empty.');
  }

  const imageItems = uaParseImageUrlMemo_(rowData.structureMemo);
  if (imageItems.length === 0) {
    throw new Error('WP images: no image URL memo was found in the structure memo.');
  }

  const wpConfig = uaGetWpConfig_(appConfig);
  let body = uaNormalizeAnchorRelAttributes_(uaApplyNaviokunIntroSet_(
    uaApplyManagedAffiliateCta_(rowData.body, rowData, appConfig),
    rowData,
    appConfig
  ));
  let featuredMediaId = 0;
  let insertedCount = 0;
  const uploaded = [];

  imageItems.forEach(function(item, index) {
    const media = uaUploadWpImageFromUrl_(wpConfig, item.url, item.alt || uaPickWpTitle_(rowData.titleIdeas) || rowData.mainInput || 'article image', index + 1);
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
    uaUpdateWpPostWithImages_(wpConfig, postId, body, featuredMediaId, uploaded);
  }

  const nextData = uaBuildRowData_(sheet, row);
  const wpPart = postId > 0 ? 'WordPress draft updated.' : 'Inserted into body only.';
  nextData.message = 'Uploaded ' + uploaded.length + ' image(s), inserted ' + insertedCount + ' image(s). ' + wpPart;
  return nextData;
}

function uaDecodeHtmlEntities_(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function uaEscapeHtml_(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function uaGetWpConfig_(appConfig) {
  if (!appConfig || !appConfig.key) {
    throw new Error('WP config: article type key was not found.');
  }

  const props = PropertiesService.getScriptProperties();
  const prefix = 'UA_WP_' + String(appConfig.key).toUpperCase() + '_';
  const fallbackPrefix = 'UA_WP_DEFAULT_';

  const siteUrl = uaTrimTrailingSlash_(props.getProperty(prefix + 'SITE_URL') || props.getProperty(fallbackPrefix + 'SITE_URL'));
  const username = props.getProperty(prefix + 'USERNAME') || props.getProperty(fallbackPrefix + 'USERNAME');
  const appPassword = props.getProperty(prefix + 'APP_PASSWORD') || props.getProperty(fallbackPrefix + 'APP_PASSWORD');
  const categoryIds = props.getProperty(prefix + 'CATEGORY_IDS') || props.getProperty(fallbackPrefix + 'CATEGORY_IDS') || '';

  if (!siteUrl || !username || !appPassword) {
    throw new Error('WP config: SITE_URL / USERNAME / APP_PASSWORD is missing in script properties.');
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
  const marker = '\u3010\u753b\u50cfURL\u30e1\u30e2\u3011';
  const markerIndex = text.indexOf(marker);
  const target = markerIndex >= 0 ? text.slice(markerIndex) : text;
  const lines = target.split(/\r?\n/);
  const items = [];

  lines.forEach(function(line) {
    const raw = String(line || '').trim();
    if (!raw || raw === marker) return;
    const urlMatch = raw.match(/https?:\/\/\S+/);
    if (!urlMatch) return;

    const url = urlMatch[0].replace(/[)、。\\]]+$/g, '');
    const beforeUrl = raw.slice(0, raw.indexOf(urlMatch[0])).trim();

    if (/^\u30a2\u30a4\u30ad\u30e3\u30c3\u30c1[:：]/.test(beforeUrl) || /^eyecatch[:：]/i.test(beforeUrl)) {
      items.push({
        role: 'eyecatch',
        heading: '',
        url: url,
        alt: beforeUrl.replace(/^\u30a2\u30a4\u30ad\u30e3\u30c3\u30c1[:：]\s*/i, '').trim()
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
    throw new Error('WP image fetch: image URL could not be downloaded.');
  }

  const headers = res.getHeaders();
  const contentType = String(headers['Content-Type'] || headers['content-type'] || 'image/jpeg').split(';')[0].trim();
  if (!/^image\//i.test(contentType)) {
    throw new Error('WP image fetch: downloaded file is not an image.');
  }

  return uaUploadWpImageBytes_(wpConfig, res.getBlob().getBytes(), contentType, imageUrl, altText, index);
}

function uaUploadWpImageBytes_(wpConfig, bytes, contentType, sourceUrl, altText, index) {
  const extension = uaImageExtensionFromContentType_(contentType);
  const filename = 'article-image-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss') + '-' + index + extension;
  const uploadUrl = wpConfig.siteUrl + '/wp-json/wp/v2/media';
  const options = {
    method: 'post',
    muteHttpExceptions: true,
    contentType: contentType,
    payload: bytes,
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
    throw new Error('WP media upload: WordPress response was not JSON.');
  }

  if (uploadStatus < 200 || uploadStatus >= 300 || !media.id) {
    throw new Error('WP media upload: upload failed or media ID was missing.');
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
    url: media.source_url || sourceUrl || '',
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
  const caption = String(media.caption || '').trim();
  if (!id) {
    return '<!-- wp:image {"sizeSlug":"large","linkDestination":"none"} -->\n' +
      '<figure class="wp-block-image size-large"><img src="' + url + '" alt="' + alt + '"/>' +
      (caption ? '<figcaption class="wp-element-caption">' + caption + '</figcaption>' : '') +
      '</figure>\n' +
      '<!-- /wp:image -->';
  }
  return '<!-- wp:image {"id":' + id + ',"sizeSlug":"large","linkDestination":"none"} -->\n' +
    '<figure class="wp-block-image size-large"><img src="' + url + '" alt="' + alt + '" class="wp-image-' + id + '"/>' +
    (caption ? '<figcaption class="wp-element-caption">' + caption + '</figcaption>' : '') +
    '</figure>\n' +
    '<!-- /wp:image -->';
}

function uaUpdateWpPostWithImages_(wpConfig, postId, bodyHtml, featuredMediaId, uploadedMedia) {
  const cleanPostId = Number(postId || 0);
  if (!cleanPostId) {
    throw new Error('WP post update: post ID is empty.');
  }

  const payload = { content: String(bodyHtml || '') };
  const cleanFeaturedMediaId = Number(featuredMediaId || 0);
  if (cleanFeaturedMediaId > 0) {
    payload.featured_media = cleanFeaturedMediaId;
  }

  let post = uaCallWordPressApi_(wpConfig, '/wp-json/wp/v2/posts/' + encodeURIComponent(cleanPostId), 'post', payload);
  post = uaVerifyWpPostImageUpdate_(wpConfig, cleanPostId, bodyHtml, cleanFeaturedMediaId, uploadedMedia, post);
  return post;
}

function uaVerifyWpPostImageUpdate_(wpConfig, postId, bodyHtml, featuredMediaId, uploadedMedia, post) {
  let latest = post || {};
  let state = uaInspectWpPostImageState_(latest, featuredMediaId, uploadedMedia);

  if (!state.ok) {
    latest = uaFetchWpPostForEdit_(wpConfig, postId);
    state = uaInspectWpPostImageState_(latest, featuredMediaId, uploadedMedia);
  }

  if (!state.featuredOk && featuredMediaId > 0) {
    uaCallWordPressApi_(wpConfig, '/wp-json/wp/v2/posts/' + encodeURIComponent(postId), 'post', {
      featured_media: featuredMediaId
    });
    latest = uaFetchWpPostForEdit_(wpConfig, postId);
    state = uaInspectWpPostImageState_(latest, featuredMediaId, uploadedMedia);
  }

  if (!state.bodyOk && uaGetExpectedBodyImageMedia_(uploadedMedia).length > 0) {
    uaCallWordPressApi_(wpConfig, '/wp-json/wp/v2/posts/' + encodeURIComponent(postId), 'post', {
      content: String(bodyHtml || '')
    });
    latest = uaFetchWpPostForEdit_(wpConfig, postId);
    state = uaInspectWpPostImageState_(latest, featuredMediaId, uploadedMedia);
  }

  if (!state.ok) {
    const parts = [];
    if (!state.featuredOk && featuredMediaId > 0) {
      parts.push('Featured image not reflected expected=' + featuredMediaId + ' actual=' + state.actualFeaturedMediaId);
    }
    if (!state.bodyOk) {
      parts.push('Body image not reflected missing=' + state.missingBodyImages.join(', '));
    }
    throw new Error('WP post update: image reflection check failed.');
  }

  return latest;
}

function uaFetchWpPostForEdit_(wpConfig, postId) {
  const path = '/wp-json/wp/v2/posts/' + encodeURIComponent(postId) + '?context=edit&_=' + Date.now();
  return uaCallWordPressApi_(wpConfig, path, 'get');
}

function uaInspectWpPostImageState_(post, featuredMediaId, uploadedMedia) {
  const actualFeaturedMediaId = Number(post && post.featured_media || 0);
  const expectedFeaturedMediaId = Number(featuredMediaId || 0);
  const featuredOk = expectedFeaturedMediaId > 0
    ? actualFeaturedMediaId === expectedFeaturedMediaId
    : true;
  const expectedBodyImages = uaGetExpectedBodyImageMedia_(uploadedMedia);
  const contentText = uaGetWpPostContentText_(post);
  const missingBodyImages = expectedBodyImages.filter(function(media) {
    const id = Number(media && media.id || 0);
    const url = String(media && media.url || '');
    const idToken = id > 0 ? 'wp-image-' + id : '';
    return !(idToken && contentText.indexOf(idToken) !== -1) &&
      !(url && contentText.indexOf(url) !== -1);
  }).map(function(media) {
    return String(media && (media.id || media.url || media.heading) || '');
  });
  const bodyOk = missingBodyImages.length === 0;

  return {
    ok: featuredOk && bodyOk,
    featuredOk: featuredOk,
    bodyOk: bodyOk,
    actualFeaturedMediaId: actualFeaturedMediaId,
    missingBodyImages: missingBodyImages
  };
}

function uaGetExpectedBodyImageMedia_(uploadedMedia) {
  return (uploadedMedia || []).filter(function(media) {
    return media && media.role !== 'eyecatch';
  });
}

function uaGetWpPostContentText_(post) {
  const content = post && post.content || {};
  return [
    content.raw,
    content.rendered
  ].map(function(value) {
    return String(value || '');
  }).join('\n');
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
      throw new Error('WP API: server returned a 403 HTML response.');
    }

    throw new Error('WP API: response was not JSON.');
  }

  if (statusCode < 200 || statusCode >= 300) {
    const message = json && json.message ? json.message : text;
    throw new Error('WP API: request failed.');
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
    .split(/[,・後―n]/)
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
    .split(/[,・後―s]+/)
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
    .split(/\s*[\/・｜|\n]/)[0]
    .replace(/^案\s*\d+\s*[:：・\-]?\s*/i, '')
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
