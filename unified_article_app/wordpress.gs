const UA_DRIVE_WP_CATEGORY_DEFINITIONS = {
  car_buying: {
    name: '車選び・購入',
    slug: 'car-buying'
  },
  entertainment: {
    name: '車内エンタメ',
    slug: 'shanai'
  },
  accessories: {
    name: 'カー用品・カスタム',
    slug: 'car-item'
  },
  maintenance: {
    name: '維持費・メンテナンス',
    slug: 'maintenance'
  },
  driving: {
    name: '運転・制度',
    slug: 'drive'
  }
};

const UA_HOME_WP_CATEGORY_DEFINITIONS = {
  home_building: {
    name: '①家づくり・リフォーム',
    slug: 'kosodate'
  },
  equipment_housework: {
    name: '②住宅設備・家事',
    slug: 'kajiraku'
  },
  storage_goods: {
    name: '③収納・暮らし用品',
    slug: 'shuunou'
  },
  home_safety: {
    name: '④住まいの悩み・安全',
    slug: 'kurashi'
  }
};

function uaCreateWpDraftFromWeb(data) {
  return uaCreateWpDraftFromPanel(data || {});
}

function uaUpdatePublishedWpFromWeb(data) {
  return uaUpdatePublishedWpFromPanel(data || {});
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

  const productPlan = uaExtractProductPlan_(rowData.body);
  const storedBody = uaNormalizeUnsupportedTrialGuidance_(uaRemoveRedundantAffiliateDisclosure_(uaNormalizeAnchorRelAttributes_(uaApplyNaviokunIntroSet_(
    uaApplyManagedAffiliateCta_(uaRemoveRedundantAffiliateDisclosure_(rowData.body), rowData, appConfig),
    rowData,
    appConfig
  ))), productPlan);
  const wpBody = uaStripProductPlanMarker_(storedBody);
  if (storedBody !== String(rowData.body || '')) {
    sheet.getRange(row, UA_COLUMNS.body).setValue(storedBody);
    rowData.body = storedBody;
  }

  const allowedUnverifiedMarketFreshnessDraft = !!(data && data.allowUnverifiedMarketFreshnessDraft);
  uaAssertWpDraftHardQualityGates_(rowData, {
    allowUnverifiedMarketFreshnessDraft: allowedUnverifiedMarketFreshnessDraft
  });

  const wpConfig = uaGetWpConfig_(appConfig);
  const title = uaPickWpTitle_(rowData.titleIdeas, rowData.mainInput, rowData.body);
  const slug = uaCleanWpSlug_(rowData.permalink);
  const tagIds = uaEnsureWpTagIds_(wpConfig, rowData.tags);
  const categoryIds = uaResolveWpCategoryIds_(wpConfig, rowData, appConfig);
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

  uaSyncWpMetaDescription_(wpConfig, postId, rowData.metaDescription);

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
  if (allowedUnverifiedMarketFreshnessDraft) {
    nextData.message += ' 価格・相場の資料不足は手動確認済みとして下書きへ進めました。公開前に金額と確認時点を確認してください。';
  }
  return nextData;
}

function uaUpdatePublishedWpFromPanel(data) {
  uaSaveActiveRowData(data || {});

  const sheet = uaGetSheetForData_(data || {});
  const row = Number(data && data.row) || sheet.getActiveCell().getRow();
  const rowData = uaBuildRowData_(sheet, row);
  const appConfig = uaGetAppConfigByLabel_(rowData.appType);

  if (!appConfig || appConfig.useWordPress === false) {
    throw new Error('WP更新: この記事タイプはWordPress更新に対応していません。');
  }
  if (!String(rowData.body || '').trim()) {
    throw new Error('WP更新: 本文が空です。');
  }
  if (!String(rowData.titleIdeas || '').trim()) {
    throw new Error('WP更新: タイトル案が空です。');
  }

  const postId = Number(rowData.wpPostId || 0);
  if (postId <= 0) {
    throw new Error('WP更新: WP投稿IDがありません。先にWordPressへ入稿してください。');
  }

  const wpConfig = uaGetWpConfig_(appConfig);
  const currentPost = uaFetchWpPostForEdit_(wpConfig, postId);
  const currentStatus = String(currentPost && currentPost.status || '').trim();
  if (currentStatus !== 'publish') {
    throw new Error(
      'WP更新: 投稿ID ' + postId + ' は公開中ではありません（現在: ' +
      (currentStatus || '状態不明') + '）。下書きは「WPへ下書き」で更新してください。'
    );
  }

  const productPlan = uaExtractProductPlan_(rowData.body);
  const storedBody = uaNormalizeUnsupportedTrialGuidance_(uaRemoveRedundantAffiliateDisclosure_(uaNormalizeAnchorRelAttributes_(uaApplyNaviokunIntroSet_(
    uaApplyManagedAffiliateCta_(uaRemoveRedundantAffiliateDisclosure_(rowData.body), rowData, appConfig),
    rowData,
    appConfig
  ))), productPlan);
  const wpBody = uaStripProductPlanMarker_(storedBody);
  if (storedBody !== String(rowData.body || '')) {
    sheet.getRange(row, UA_COLUMNS.body).setValue(storedBody);
    rowData.body = storedBody;
  }

  const currentWpBody = uaGetWpPostRawContent_(currentPost);
  const missingImages = uaFindMissingPublishedWpImages_(currentWpBody, wpBody);
  if (missingImages.length > 0) {
    throw new Error(
      'WP更新を停止しました。公開中の記事にある画像がパネル本文から' +
      missingImages.length + '件欠落しています。画像を消さないため更新していません。欠落画像: ' +
      missingImages.slice(0, 5).join(', ')
    );
  }

  const title = uaPickWpTitle_(rowData.titleIdeas, rowData.mainInput, rowData.body);
  const payload = uaBuildPublishedWpUpdatePayload_(title, wpBody);
  const slug = uaCleanWpSlug_(rowData.permalink);
  const tagIds = uaEnsureWpTagIds_(wpConfig, rowData.tags);
  const categoryIds = uaResolveWpCategoryIds_(wpConfig, rowData, appConfig);
  if (slug) payload.slug = slug;
  if (tagIds.length > 0) payload.tags = tagIds;
  if (categoryIds.length > 0) payload.categories = categoryIds;

  const updatedPost = uaCallWordPressApi_(
    wpConfig,
    '/wp-json/wp/v2/posts/' + encodeURIComponent(postId),
    'post',
    payload
  );
  const verifiedPost = uaFetchWpPostForEdit_(wpConfig, postId);
  const verifiedStatus = String(verifiedPost && verifiedPost.status || '').trim();
  const verifiedId = Number(verifiedPost && verifiedPost.id || updatedPost && updatedPost.id || 0);
  const originalFeaturedMediaId = Number(currentPost && currentPost.featured_media || 0);
  const verifiedFeaturedMediaId = Number(verifiedPost && verifiedPost.featured_media || 0);

  if (verifiedId !== postId || verifiedStatus !== 'publish') {
    throw new Error('WP更新後の確認に失敗しました。投稿IDまたは公開状態が一致しません。');
  }
  if (verifiedFeaturedMediaId !== originalFeaturedMediaId) {
    throw new Error('WP更新後の確認でアイキャッチ画像の変更を検出しました。WordPress管理画面を確認してください。');
  }
  const remainingMissingImages = uaFindMissingPublishedWpImages_(currentWpBody, uaGetWpPostRawContent_(verifiedPost));
  if (remainingMissingImages.length > 0) {
    throw new Error('WP更新後の確認で既存画像の欠落を検出しました。WordPress管理画面を確認してください。');
  }

  uaSyncWpMetaDescription_(wpConfig, postId, rowData.metaDescription);
  const updatedAt = new Date();
  sheet.getRange(row, UA_COLUMNS.wpDraftedAt).setValue(updatedAt);

  const nextData = uaBuildRowData_(sheet, row);
  nextData.message = '公開中の記事を更新しました。タイトル・本文・商品リンク・SEO情報を反映し、公開状態と既存画像を維持しています。採用タイトル: ' + title;
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
    const productPlan = uaExtractProductPlan_(body);
    const wpBody = uaStripProductPlanMarker_(uaNormalizeUnsupportedTrialGuidance_(body, productPlan));
    uaUpdateWpPostWithImages_(wpConfig, postId, wpBody, featuredMediaId, uploaded);
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

function uaGetWpPostRawContent_(post) {
  const content = post && post.content || {};
  return String(content.raw || content.rendered || '');
}

function uaBuildPublishedWpUpdatePayload_(title, bodyHtml) {
  return {
    title: String(title || '').trim(),
    content: String(bodyHtml || '')
  };
}

function uaFindMissingPublishedWpImages_(currentBody, nextBody) {
  const currentImages = uaExtractWpImageReferences_(currentBody);
  const nextImages = uaExtractWpImageReferences_(nextBody);
  const nextKeys = {};
  nextImages.forEach(function(item) {
    nextKeys[item.key] = true;
  });
  return currentImages.filter(function(item) {
    return !nextKeys[item.key];
  }).map(function(item) {
    return item.label;
  });
}

function uaExtractWpImageReferences_(bodyHtml) {
  const html = String(bodyHtml || '');
  const seen = {};
  const items = [];

  function addImage(key, label) {
    const cleanKey = String(key || '').trim();
    if (!cleanKey || seen[cleanKey]) return;
    seen[cleanKey] = true;
    items.push({ key: cleanKey, label: String(label || cleanKey) });
  }

  let match;
  const classIdRegex = /\bwp-image-(\d+)\b/gi;
  while ((match = classIdRegex.exec(html)) !== null) {
    addImage('id:' + match[1], '画像ID ' + match[1]);
  }

  const blockIdRegex = /<!--\s+wp:image\s+\{[^}]*"id"\s*:\s*(\d+)[^}]*\}\s+-->/gi;
  while ((match = blockIdRegex.exec(html)) !== null) {
    addImage('id:' + match[1], '画像ID ' + match[1]);
  }

  const srcRegex = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  while ((match = srcRegex.exec(html)) !== null) {
    if (/\bwp-image-\d+\b/i.test(match[0])) continue;
    const src = uaNormalizeWpImageUrl_(match[1]);
    if (src) addImage('url:' + src, src);
  }

  return items;
}

function uaNormalizeWpImageUrl_(value) {
  const url = String(value || '')
    .replace(/&amp;/g, '&')
    .trim();
  if (!url) return '';
  return url.replace(/[?#].*$/, '').replace(/^http:\/\//i, 'https://');
}

function uaCallWordPressApi_(wpConfig, path, method, payload) {
  const url = wpConfig.siteUrl + path;
  const requestMethod = String(method || 'get').toUpperCase();
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
      throw new Error(uaBuildWordPressHttpErrorMessage_(
        statusCode,
        requestMethod,
        path,
        text,
        true
      ));
    }

    throw new Error(uaBuildWordPressHttpErrorMessage_(
      statusCode,
      requestMethod,
      path,
      text,
      false
    ));
  }

  if (statusCode < 200 || statusCode >= 300) {
    const message = json && json.message ? json.message : text;
    throw new Error(
      uaBuildWordPressHttpErrorMessage_(statusCode, requestMethod, path, message, false)
    );
  }

  return json;
}

function uaSyncWpMetaDescription_(wpConfig, postId, metaDescription) {
  const cleanPostId = Number(postId || 0);
  const description = String(metaDescription || '').replace(/\s+/g, ' ').trim();
  if (!cleanPostId || !description) {
    return {
      ok: true,
      updated: false,
      preserved: true,
      reason: !cleanPostId ? 'missing_post_id' : 'empty_input'
    };
  }

  const result = uaCallWordPressApi_(
    wpConfig,
    '/wp-json/article-compass/v1/post-seo-meta',
    'post',
    {
      post_id: cleanPostId,
      meta_description: description
    }
  );

  if (!result || result.ok !== true) {
    throw new Error('WordPressメタディスクリプションの反映確認に失敗しました。');
  }

  const acceptedManualValue = result.preserved === true &&
    String(result.reason || '') === 'manual_value_preserved';
  if (result.updated !== true && !acceptedManualValue) {
    throw new Error(
      'WordPressメタディスクリプションが保存されませんでした。受信結果: ' +
      String(result.reason || 'unknown')
    );
  }
  return result;
}

function uaBuildWordPressHttpErrorMessage_(statusCode, method, path, responseText, isHtml) {
  const stage = uaDescribeWordPressApiStage_(path, method);
  const responseBody = String(responseText || '');
  const titleMatch = String(responseText || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const htmlTitle = titleMatch
    ? String(titleMatch[1] || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    : '';
  const isSiteGuardWaf = /SiteGuard\s+Lite/i.test(responseBody) ||
    /閲覧できません\s*\(Forbidden access\)/i.test(responseBody);
  const detail = !isHtml
    ? String(responseText || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180)
    : htmlTitle;
  const parts = [
    'WordPressの' + stage + 'が拒否されました',
    'HTTP ' + statusCode,
    method + ' ' + uaGetSafeWordPressApiPath_(path)
  ];

  if (detail) {
    parts.push(detail);
  }

  if (Number(statusCode) === 403 && isHtml) {
    parts.push(isSiteGuardWaf
      ? 'ConoHa WINGのWAFによる誤検知です。WING→サイト管理→サイトセキュリティ→WAF→ログで、この時刻の検知を「除外」してから停止位置より再開してください'
      : 'WordPress側のWAF・セキュリティ機能による遮断の可能性があります');
  }

  return parts.join(' / ');
}

function uaDescribeWordPressApiStage_(path, method) {
  const cleanPath = String(path || '');
  const cleanMethod = String(method || 'GET').toUpperCase();

  if (/\/users\/me(?:\?|$)/.test(cleanPath)) return '接続認証確認';
  if (/\/tags(?:\/|\?|$)/.test(cleanPath)) {
    return cleanMethod === 'GET' ? 'タグ確認' : 'タグ作成';
  }
  if (/\/categories(?:\/|\?|$)/.test(cleanPath)) return 'カテゴリ確認';
  if (/\/media(?:\/|\?|$)/.test(cleanPath)) {
    return cleanMethod === 'GET' ? '画像確認' : '画像送信';
  }
  if (/\/posts(?:\/|\?|$)/.test(cleanPath)) {
    return cleanMethod === 'GET' ? '下書き確認' : '本文送信';
  }

  return 'API通信';
}

function uaGetSafeWordPressApiPath_(path) {
  return String(path || '').replace(/([?&](?:search)=)[^&]*/gi, '$1…');
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
    .split(/[,，、\r\n]+/)
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

function uaResolveWpCategoryIds_(wpConfig, rowData, appConfig) {
  if (!appConfig) {
    return uaGetWpCategoryIds_(wpConfig);
  }

  let categoryKey = '';
  let definition = null;
  if (appConfig.key === 'drive') {
    categoryKey = uaDetectDriveWpCategory_(rowData);
    definition = UA_DRIVE_WP_CATEGORY_DEFINITIONS[categoryKey];
  } else if (appConfig.key === 'home') {
    categoryKey = uaDetectHomeWpCategory_(rowData);
    definition = UA_HOME_WP_CATEGORY_DEFINITIONS[categoryKey];
  } else {
    return uaGetWpCategoryIds_(wpConfig);
  }

  if (!definition) {
    throw new Error('WP category: category could not be determined for ' + appConfig.label + '.');
  }

  const categoryId = uaFindWpCategoryIdBySlug_(wpConfig, definition.slug);
  if (!categoryId) {
    throw new Error('WP category: "' + definition.name + '" (' + definition.slug + ') was not found in WordPress.');
  }

  return [categoryId];
}

function uaDetectHomeWpCategory_(rowData) {
  const data = rowData || {};
  const topicText = [
    data.mainInput,
    data.titleIdeas,
    data.tags,
    data.readerMindMemo
  ].map(function(value) {
    return String(value || '');
  }).join('\n');

  const scores = {
    home_building: 1,
    equipment_housework: 0,
    storage_goods: 0,
    home_safety: 0
  };

  uaAddWpCategoryScore_(scores, 'home_building', topicText, [
    [/(注文住宅|新築|家を建て|家づくり|マイホーム|ハウスメーカー|工務店|住宅展示場|展示場|地鎮祭|建築中|土地|旗竿地|外構)/i, 26],
    [/(間取り|回遊動線|生活動線|家事動線|建具|床材|壁紙|クロス|玄関|階段|吹き抜け|コンセント|照明|温白色)/i, 24],
    [/(窓|日当たり|南西向き|南東向き|隣の家|隣家|駐車場|子供部屋|リビング|寝室|洗面台|対面キッチン|キッチン.{0,12}(配置|通路|向かい合わせ)|防水パン)/i, 18],
    [/(リフォーム|リノベーション|フラワーボックス|ロールスクリーン|カーテン.{0,10}(天井付け|正面付け))/i, 14]
  ]);

  uaAddWpCategoryScore_(scores, 'equipment_housework', topicText, [
    [/(冷蔵庫|冷凍庫|エアコン|霧ヶ峰|室外機|乾太くん|食洗機|洗濯機|浴室乾燥|除湿機|サーキュレーター|掃除機|布団乾燥機|炊飯器|電子レンジ|給湯|エコキュート|換気扇|ミラブル|シャワー)/i, 26],
    [/(掃除|洗濯|物干し|干せる|部屋干し|排水口|排水溝|水切りネット|トイレブラシ|アイロン|魚焼きグリル|家事|時短)/i, 22],
    [/(電気代|放熱|フィルター|カビ|結露|お手入れ|メンテナンス)/i, 12]
  ]);

  uaAddWpCategoryScore_(scores, 'storage_goods', topicText, [
    [/(収納|片付け|チェスト|棚|カラーボックス|クローゼット|押入れ|靴箱|シューズボックス|ラック|パントリー)/i, 28],
    [/(配線カバー|段ボール|ダンボール|タオル掛け|ドアハンガー|パジャマ収納|リモコンカバー|ソファ|ビーズクッション|家具|インテリア)/i, 24],
    [/(マット|ラグ|スリッパ|カーテン|突っ張り棒|ニトリ|無印|ダイソー|100均|百均)/i, 14]
  ]);

  uaAddWpCategoryScore_(scores, 'home_safety', topicText, [
    [/(セコム|ホームセキュリティ|防犯|防災|空き巣|火災|地震)/i, 30],
    [/(強風|台風|サンシェード|よしず|防音|音漏れ|声.{0,12}(聞こえる|響く)|筒抜け|騒音)/i, 26],
    [/(安全|危険|事故|侵入防止|ゴキブリ|害虫|防虫|ヤブガラシ|カビ|結露)/i, 18],
    [/(家族|子育て|共働き|車いす|介護|猫|犬|ペット|近所|隣家)/i, 12]
  ]);

  const priority = ['home_safety', 'equipment_housework', 'storage_goods', 'home_building'];
  let bestKey = 'home_building';
  let bestScore = scores.home_building;
  priority.forEach(function(key) {
    if (scores[key] > bestScore) {
      bestKey = key;
      bestScore = scores[key];
    }
  });

  return bestKey;
}

function uaTestHomeWpCategoryRouting() {
  const cases = [
    [{ mainInput: '南西向き やめとけ' }, 'home_building'],
    [{ mainInput: '子供部屋 仕切り ニトリ' }, 'home_building'],
    [{ mainInput: '冷蔵庫 側面 マグネット 大丈夫' }, 'equipment_housework'],
    [{ mainInput: '霧ヶ峰 みまもり機能 電気代' }, 'equipment_housework'],
    [{ mainInput: '流せるトイレブラシ やめた' }, 'equipment_housework'],
    [{ mainInput: 'ランドリー チェスト カビない' }, 'storage_goods'],
    [{ mainInput: '人をダメにするソファ 無印' }, 'storage_goods'],
    [{ mainInput: '配線カバー ダイソー' }, 'storage_goods'],
    [{ mainInput: 'セコムホームセキュリティ 値段' }, 'home_safety'],
    [{ mainInput: '2階の声 1階に聞こえる' }, 'home_safety'],
    [{ mainInput: 'サンシェード 強風対策' }, 'home_safety']
  ];

  const results = cases.map(function(testCase) {
    const actual = uaDetectHomeWpCategory_(testCase[0]);
    return {
      input: testCase[0].mainInput,
      expected: testCase[1],
      actual: actual,
      ok: actual === testCase[1]
    };
  });
  const failures = results.filter(function(result) { return !result.ok; });
  if (failures.length > 0) {
    throw new Error('Home WP category routing test failed: ' + JSON.stringify(failures));
  }

  return {
    ok: true,
    count: results.length,
    results: results
  };
}

function uaOptimizeHomeWpCategories() {
  const appConfig = UA_APP_TYPES.home;
  const wpConfig = uaGetWpConfig_(appConfig);
  const categoryIds = {};
  Object.keys(UA_HOME_WP_CATEGORY_DEFINITIONS).forEach(function(key) {
    const definition = UA_HOME_WP_CATEGORY_DEFINITIONS[key];
    const id = uaFindWpCategoryIdBySlug_(wpConfig, definition.slug);
    if (!id) {
      throw new Error('WP category: "' + definition.name + '" (' + definition.slug + ') was not found in WordPress.');
    }
    categoryIds[key] = id;
  });

  const assignments = {
    home_building: [414, 248, 122, 111, 272, 193, 99, 317, 85, 50, 476],
    equipment_housework: [369, 309, 143, 400, 502, 485, 254, 179, 315],
    storage_goods: [433, 246, 115],
    home_safety: [149, 456, 386, 230, 520]
  };
  const results = [];
  Object.keys(assignments).forEach(function(key) {
    assignments[key].forEach(function(postId) {
      const post = uaCallWordPressApi_(
        wpConfig,
        '/wp-json/wp/v2/posts/' + encodeURIComponent(postId),
        'post',
        { categories: [categoryIds[key]] }
      );
      results.push({
        postId: postId,
        category: UA_HOME_WP_CATEGORY_DEFINITIONS[key].name,
        categoryId: categoryIds[key],
        ok: Number(post && post.id || 0) === postId
      });
    });
  });

  const failures = results.filter(function(result) { return !result.ok; });
  if (failures.length > 0) {
    throw new Error('Home WP category reassignment failed: ' + JSON.stringify(failures));
  }

  return {
    ok: true,
    count: results.length,
    categoryIds: categoryIds,
    results: results
  };
}

function uaFindWpCategoryIdBySlug_(wpConfig, slug) {
  const cleanSlug = String(slug || '').trim();
  if (!cleanSlug) return 0;

  const results = uaCallWordPressApi_(
    wpConfig,
    '/wp-json/wp/v2/categories?slug=' + encodeURIComponent(cleanSlug) + '&per_page=10&hide_empty=false',
    'get'
  );

  if (!Array.isArray(results)) return 0;

  for (let i = 0; i < results.length; i++) {
    if (String(results[i] && results[i].slug || '').trim() === cleanSlug) {
      return Number(results[i].id || 0);
    }
  }

  return 0;
}

function uaDetectDriveWpCategory_(rowData) {
  const data = rowData || {};
  const topicText = [
    data.mainInput,
    data.titleIdeas,
    data.tags
  ].map(function(value) {
    return String(value || '');
  }).join('\n');

  const scores = {
    car_buying: 1,
    entertainment: 0,
    accessories: 0,
    maintenance: 0,
    driving: 0
  };

  uaAddWpCategoryScore_(scores, 'entertainment', topicText, [
    [/(ナビ男くん|テレビキャンセラー|TVキャンセラー|後席モニター|フリップダウンモニター)/i, 30],
    [/(カーナビ|純正ナビ|ナビ取付|ナビ取り付け|ナビが|ナビは|ナビを|ナビの)/i, 24],
    [/(ディスプレイオーディオ|マツダコネクト|マツコネ|CarPlay|Android\s*Auto)/i, 24],
    [/(HDMI|Fire\s*TV|車内エンタメ|カーオーディオ|スピーカー|音質)/i, 18],
    [/(走行中[^\n]{0,20}(テレビ|TV)|テレビ[^\n]{0,20}(見れない|映らない|解除))/i, 18]
  ]);

  uaAddWpCategoryScore_(scores, 'accessories', topicText, [
    [/(シンシェード|サンシェード|フロアマット|シートカバー|スマホホルダー)/i, 26],
    [/(ボディカバー|ドライブレコーダー|ドラレコ|レーダー探知機|ルーフキャリア)/i, 24],
    [/(スポイラー|エアロパーツ|ホイール|工具|キーケース|コンソールボックス|ドリンクホルダー)/i, 20],
    [/(カー用品|カスタムパーツ|車中泊グッズ)/i, 16]
  ]);

  uaAddWpCategoryScore_(scores, 'maintenance', topicText, [
    [/(タイヤ|バッテリー|エンジンオイル|オイル交換|車検|故障|修理|異音)/i, 24],
    [/(洗車傷|洗車キズ|コーティング|錆|サビ|空気圧)/i, 22],
    [/(維持費|メンテナンス|点検|エアコン|燃費|交換費用|寿命)/i, 14],
    [/(洗車|車内清掃|掃除)/i, 12]
  ]);

  uaAddWpCategoryScore_(scores, 'driving', topicText, [
    [/(普通免許|運転免許|免許証|道路交通法|交通違反|反則金|違反点数)/i, 28],
    [/(車のナンバー|車ナンバー|ナンバープレート|希望ナンバー|車庫証明)/i, 26],
    [/(安全運転|あおり運転|煽り運転|駐車違反|交通ルール|道路標識)/i, 22],
    [/(雪道走行|高速道路|自動車税|税金)/i, 12]
  ]);

  uaAddWpCategoryScore_(scores, 'car_buying', topicText, [
    [/(中古車|中古|購入|買って|買うなら|買い替え|乗り換え)/i, 18],
    [/(残クレ|残価設定|カーリース|買取|査定|売却|下取り|リセール)/i, 18],
    [/(後悔|やめとけ|いらない|がっかり|欠点|デメリット)/i, 12],
    [/(評判|口コミ|ダサい|恥ずかしい|貧乏人|頭おかしい|危ない|やばい|売れない)/i, 10],
    [/(グレード|年式|モデルチェンジ|納期|値引き|車種比較|選び方)/i, 8],
    [/(価格|安い|高い|人気|何人乗り|後部座席|狭い|広い)/i, 5]
  ]);

  const strongestTopicScore = Math.max(
    scores.car_buying,
    scores.entertainment,
    scores.accessories,
    scores.maintenance,
    scores.driving
  );
  if (strongestTopicScore <= 1) {
    const projectCategory = uaGetDriveWpProjectCategory_(data.affiliateName);
    if (projectCategory) return projectCategory;
  }

  const priority = ['entertainment', 'accessories', 'maintenance', 'driving', 'car_buying'];
  let bestKey = 'car_buying';
  let bestScore = scores.car_buying;

  priority.forEach(function(key) {
    if (scores[key] > bestScore) {
      bestKey = key;
      bestScore = scores[key];
    }
  });

  return bestKey;
}

function uaAddWpCategoryScore_(scores, categoryKey, text, rules) {
  (rules || []).forEach(function(rule) {
    const pattern = rule && rule[0];
    const weight = Number(rule && rule[1] || 0);
    if (pattern && pattern.test(String(text || ''))) {
      scores[categoryKey] += weight;
    }
  });
}

function uaGetDriveWpProjectCategory_(affiliateName) {
  const name = String(affiliateName || '').trim();
  if (!name) return '';
  if (/ナビ男くん/.test(name)) return 'entertainment';
  if (/(シンシェード|CARCLUB)/i.test(name)) return 'accessories';
  if (/(ガリバー|MOTAカーリース|カーリース|買取査定|中古車)/i.test(name)) return 'car_buying';
  return '';
}

function uaTestDriveWpCategoryRouting() {
  const cases = [
    [{ mainInput: 'マツダ やばい', titleIdeas: 'マツダ やばいの真相は？倒産不安と足回りを確認', affiliateName: 'ナビ男くん' }, 'car_buying'],
    [{ mainInput: '新型シエンタ テレビキャンセラーおすすめ', affiliateName: 'ナビ男くん' }, 'entertainment'],
    [{ mainInput: '車 サンシェード 効果 夏', affiliateName: 'シンシェード' }, 'accessories'],
    [{ mainInput: 'トーヨータイヤ やばい', affiliateName: 'CARCLUB' }, 'maintenance'],
    [{ mainInput: '旧普通免許 ずるい' }, 'driving'],
    [{ mainInput: 'ベンツ Vクラス なぜ安い', titleIdeas: '中古で後悔しないための維持費・リセール・選び方' }, 'car_buying'],
    [{ mainInput: 'ルーミー 買って よかった', affiliateName: 'ナビ男くん' }, 'car_buying'],
    [{ mainInput: 'ソリオ 後部座席 3人', affiliateName: 'MOTAカーリース' }, 'car_buying'],
    [{ mainInput: '記事テーマ未確定', affiliateName: 'ナビ男くん' }, 'entertainment']
  ];

  const results = cases.map(function(testCase) {
    const actual = uaDetectDriveWpCategory_(testCase[0]);
    return {
      input: testCase[0].mainInput,
      expected: testCase[1],
      actual: actual,
      ok: actual === testCase[1]
    };
  });
  const failures = results.filter(function(result) { return !result.ok; });
  if (failures.length > 0) {
    throw new Error('WP category routing test failed: ' + JSON.stringify(failures));
  }

  return {
    ok: true,
    count: results.length,
    results: results
  };
}

function uaTestDriveWpCategoryWordPressResolution() {
  const appConfig = UA_APP_TYPES.drive;
  const wpConfig = uaGetWpConfig_(appConfig);
  const results = Object.keys(UA_DRIVE_WP_CATEGORY_DEFINITIONS).map(function(key) {
    const definition = UA_DRIVE_WP_CATEGORY_DEFINITIONS[key];
    const id = uaFindWpCategoryIdBySlug_(wpConfig, definition.slug);
    return {
      key: key,
      name: definition.name,
      slug: definition.slug,
      id: id,
      ok: id > 0
    };
  });
  const failures = results.filter(function(result) { return !result.ok; });
  if (failures.length > 0) {
    throw new Error('WP category resolution test failed: ' + JSON.stringify(failures));
  }

  return {
    ok: true,
    count: results.length,
    results: results
  };
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

function uaPickWpTitle_(titleIdeas, mainInput, bodyHtml) {
  const candidates = uaParseWpTitleCandidates_(titleIdeas);
  if (candidates.length === 0) return '';
  if (candidates.length === 1) return candidates[0];

  let bestTitle = candidates[0];
  let bestScore = -Infinity;
  candidates.forEach(function(candidate, index) {
    const score = uaScoreWpTitleCandidate_(candidate, mainInput, bodyHtml, index);
    if (score > bestScore) {
      bestScore = score;
      bestTitle = candidate;
    }
  });
  return bestTitle;
}

function uaParseWpTitleCandidates_(titleIdeas) {
  const text = String(titleIdeas || '')
    .replace(/\r\n?/g, '\n')
    .trim();
  if (!text) return [];

  const labelPattern = /(?:^|\n+|[ \t]*[\/／|｜][ \t]*)案\s*[1-3１-３一二三]\s*(?:[:：・\-]\s*)?/gim;
  let parts;
  const hasLabels = labelPattern.test(text);
  labelPattern.lastIndex = 0;
  if (hasLabels) {
    parts = text
      .replace(labelPattern, '\n@@UA_TITLE@@')
      .split('@@UA_TITLE@@');
  } else {
    parts = text.split(/[\/／]+|\n+/);
  }

  const seen = {};
  const candidates = [];
  parts.forEach(function(part) {
    const candidate = String(part || '')
      .replace(/^[\s\/／|:：・\-]+/, '')
      .replace(/[\s\/／|]+$/, '')
      .replace(/^案\s*[1-3１-３一二三]\s*(?:[:：・\-]\s*)?/i, '')
      .replace(/^(?:[①②③]|[1-3１-３][\.．\)）:：])\s*/, '')
      .replace(/^["'「『]+|["'」』]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!candidate || seen[candidate]) return;
    if (/^案\s*[1-3１-３一二三]$/i.test(candidate)) return;
    seen[candidate] = true;
    candidates.push(candidate);
  });

  if (candidates.length === 0) {
    const fallback = text
      .replace(/^案\s*[1-3１-３一二三]\s*(?:[:：・\-]\s*)?/i, '')
      .trim();
    return fallback ? [fallback] : [];
  }
  return candidates.slice(0, 5);
}

function uaScoreWpTitleCandidate_(title, mainInput, bodyHtml, index) {
  const cleanTitle = String(title || '').trim();
  const length = cleanTitle.length;
  let score = 0;

  if (length >= 28 && length <= 34) score += 8;
  else if (length >= 24 && length <= 38) score += 4;
  else if (length < 20 || length > 42) score -= 8;

  const keywordTokens = String(mainInput || '')
    .toLowerCase()
    .split(/[\s　,，、\/／・|｜]+/)
    .map(function(token) { return token.trim(); })
    .filter(function(token) { return token.length >= 2; });
  if (keywordTokens.length > 0) {
    const lowerTitle = cleanTitle.toLowerCase();
    let covered = 0;
    keywordTokens.forEach(function(token) {
      if (lowerTitle.indexOf(token) !== -1) covered++;
    });
    score += (covered / keywordTokens.length) * 12;
  }

  if (/[？?]/.test(cleanTitle)) score += 5;
  if (/(後悔|失敗|不安|迷|困|本当|大丈夫|必要|できる|使いにくい|外れない|映らない|流れない|理由|原因|違い|総額|費用|いくら|どこ|なぜ|何を|どうする|向く|合う|見分け|選び分け|防ぐ|避ける|減らす|楽に|ラクに)/i.test(cleanTitle)) {
    score += 5;
  }
  if (/｜/.test(cleanTitle)) score += 1;
  if (/\d|[０-９]/.test(cleanTitle)) score += 1;

  const genericMatches = cleanTitle.match(/(確認ポイント|確認点|判断基準|確認手順|確認項目|確認法|選び方|見極め方|解説)/g) || [];
  score -= genericMatches.length * 1.5;
  if (/(確認ポイント|確認点|判断基準|確認手順|確認項目|確認法|選び方|見極め方|解説)$/.test(cleanTitle) &&
      !/[？?]/.test(cleanTitle) &&
      !/(後悔|失敗|不安|迷|困|本当|大丈夫|できる|使いにくい|外れない|映らない|流れない)/.test(cleanTitle)) {
    score -= 5;
  }
  if (/で分かる[、,]?/.test(cleanTitle)) score -= 2;
  if (/案\s*[1-3１-３一二三]/i.test(cleanTitle)) score -= 30;
  if (/[\/／]\s*案\s*[1-3１-３一二三]/i.test(cleanTitle)) score -= 30;

  // Keep a small stability bonus for the intentionally strongest first idea,
  // while still allowing a clearly more compelling candidate to win.
  if (index === 0) score += 0.75;
  return score;
}

function uaFindWeakWpTitleReason_(title) {
  const cleanTitle = String(title || '').trim();
  if (!cleanTitle) return 'タイトルが空です。';
  const genericEnding = /(確認ポイント|確認点|判断基準|確認手順|確認項目|確認法|選び方|見極め方|解説)$/;
  const readerPull = /[？?]|後悔|失敗|不安|迷|困|本当|大丈夫|必要|できる|使いにくい|外れない|映らない|流れない|理由|原因|違い|総額|費用|いくら|どこ|なぜ|何を|どうする|向く|合う|見分け|選び分け|防ぐ|避ける|減らす|楽に|ラクに/;
  if (genericEnding.test(cleanTitle) && !readerPull.test(cleanTitle)) {
    return '「確認ポイント」「判断基準」などの抽象語で終わり、読者の疑問や読むメリットが伝わりにくいです。';
  }
  if (/で分かる[、,]?/.test(cleanTitle) && !/[？?]/.test(cleanTitle)) {
    return '「〜で分かる」が説明的で、読者が自分事として読みたくなる焦点が弱いです。';
  }
  return '';
}

function uaTestWpTitleSelection() {
  const cases = [
    {
      input: '案1 / ハリアーのテレビキャンセラー選び｜適合とタイプ比較で後悔を防ぐ / 案2 / ハリアーのテレビキャンセラーは必要？ナビ操作の注意点 / 案3 / ハリアーのテレビキャンセラーを安全に選ぶ3つの確認項目',
      keyword: 'ハリアー テレビキャンセラー'
    },
    {
      input: '案1 カーナビ画面が映らない原因と確認手順 / 案2 音は出るのに画面が真っ暗なときは故障？ / 案3 修理か交換か迷ったときの見分け方',
      keyword: 'カーナビ 画面 映らない 音は出る'
    },
    {
      input: '案1：乾太くんで後悔する家庭は？\n案2：乾太くんは必要？容量と動線で判断\n案3：乾太くんを付ける前に知りたい費用差',
      keyword: '乾太くん 後悔'
    }
  ];
  const results = cases.map(function(testCase) {
    const candidates = uaParseWpTitleCandidates_(testCase.input);
    const selected = uaPickWpTitle_(testCase.input, testCase.keyword, '');
    const ok = candidates.length === 3 &&
      selected.length < 60 &&
      !/案\s*[1-3１-３一二三]/.test(selected);
    return {
      keyword: testCase.keyword,
      candidates: candidates,
      selected: selected,
      weakReason: uaFindWeakWpTitleReason_(selected),
      ok: ok
    };
  });
  const failures = results.filter(function(result) { return !result.ok; });
  if (failures.length > 0) {
    throw new Error('WP title selection test failed: ' + JSON.stringify(failures));
  }
  return { ok: true, count: results.length, results: results };
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
