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

/**
 * Creates one private, deterministic DRIVE BASE draft for SWELL migration QA.
 * This avoids article-generation API usage while exercising the real
 * WordPress transport, SWELL blocks, Rinker shortcode, image, links, and SEO
 * meta bridge. Run only when an intentional migration test draft is needed.
 */
function uaCreateDriveSwellMigrationTestDraft() {
  const appConfig = UA_APP_TYPES.drive;
  if (!uaUsesSwellBlocks_(appConfig)) {
    throw new Error('SWELL移行テストを停止しました。DRIVE BASEがSWELL出力設定ではありません。');
  }

  const wpConfig = uaGetWpConfig_(appConfig);
  const affiliateSpec = {
    type: 'url',
    name: 'ナビ男くん',
    url: 'https://px.a8.net/svt/ejp?a8mat=44Z0VG+70FT9U+4YGQ+BW0YB&a8ejpredirect=https%3A%2F%2Fnaviokun.ocnk.net%2F',
    content: 'https://px.a8.net/svt/ejp?a8mat=44Z0VG+70FT9U+4YGQ+BW0YB&a8ejpredirect=https%3A%2F%2Fnaviokun.ocnk.net%2F'
  };
  const pointBox = [
    '<!-- wp:group {"className":"is-style-big_icon_point article-compass-point-box","layout":{"type":"constrained"}} -->',
    '<div class="wp-block-group is-style-big_icon_point article-compass-point-box">',
    '<!-- wp:paragraph --><p><strong>この記事のポイント</strong></p><!-- /wp:paragraph -->',
    '<!-- wp:list --><ul class="wp-block-list"><li>SWELLネイティブの装飾を使用</li><li>CTA・内部リンク・商品リンクを保持</li><li>画像とメタ情報を同時に確認</li></ul><!-- /wp:list -->',
    '</div><!-- /wp:group -->'
  ].join('\n');
  const cta = uaBuildManagedAffiliateCtaBlock_(affiliateSpec, 'ナビ男くんの対応内容を確認する', appConfig);
  const internalLink = uaBuildInternalLinkPostInsertBlock_({
    url: 'https://ebimayo5.com/archives/naviokun-reputation/',
    title: 'ナビ男くんは高い？評判・カー用品店との違い・申し込み前の確認点',
    usage: '専門店へ依頼する前の判断材料'
  }, appConfig);
  const imageUrl = 'https://ebimayo5.com/wp-content/uploads/2026/08/article-image-20260814-110734-2.png';
  const imageBlock = [
    '<!-- wp:image {"sizeSlug":"large","linkDestination":"none"} -->',
    '<figure class="wp-block-image size-large"><img src="' + imageUrl + '" alt="SWELL移行検証用の既存記事画像"></figure>',
    '<!-- /wp:image -->'
  ].join('\n');
  const rinkerBlock = '<!-- wp:shortcode -->\n[itemlink post_id="899"]\n<!-- /wp:shortcode -->';
  const content = [
    '<!-- wp:paragraph --><p>DRIVE BASEのSWELL移行後に、記事生成からWordPress下書きまでの主要要素を確認する非公開テストです。</p><!-- /wp:paragraph -->',
    pointBox,
    '<!-- wp:heading --><h2 class="wp-block-heading">装飾・画像・商品リンクの表示確認</h2><!-- /wp:heading -->',
    imageBlock,
    '<!-- wp:paragraph --><p>車内エンタメ機器を比較するときは、車種適合と必要な機能を先に確認します。</p><!-- /wp:paragraph -->',
    rinkerBlock,
    '<!-- wp:heading --><h2 class="wp-block-heading">専門店へ相談する選択肢</h2><!-- /wp:heading -->',
    '<!-- wp:paragraph --><p>配線処理や適合判断に不安がある場合は、ナビ男くんのような専門店へ相談する方法もあります。</p><!-- /wp:paragraph -->',
    cta,
    internalLink
  ].join('\n\n');
  const metaDescription = 'DRIVE BASEのSWELL移行検証用下書きです。SWELL装飾、CTA、内部リンク、Rinker商品リンク、画像、メタディスクリプションのWordPress反映を非公開状態で確認します。';
  const payload = {
    title: '【非公開テスト】DRIVE BASE SWELL移行・表示確認',
    content: content,
    status: 'draft'
  };
  const created = uaCallWordPressApi_(wpConfig, '/wp-json/wp/v2/posts', 'post', payload);
  const postId = Number(created && created.id || 0);
  if (postId <= 0) {
    throw new Error('SWELL移行テスト下書きの投稿IDを取得できませんでした。');
  }

  const metaResult = uaSyncWpMetaDescription_(wpConfig, postId, metaDescription);
  const verified = uaFetchWpPostForEdit_(wpConfig, postId);
  const verifiedBody = uaGetWpPostRawContent_(verified);
  const checks = [
    ['draft status', String(verified && verified.status || '') === 'draft'],
    ['point box', verifiedBody.indexOf('article-compass-point-box') !== -1],
    ['SWELL CTA', verifiedBody.indexOf('wp:loos/button') !== -1 && verifiedBody.indexOf('swell-block-button') !== -1 && verifiedBody.indexOf('cocoon-blocks') === -1],
    ['internal link', verifiedBody.indexOf('wp:loos/post-link') !== -1],
    ['Rinker', verifiedBody.indexOf('[itemlink post_id="899"]') !== -1],
    ['image', verifiedBody.indexOf(imageUrl) !== -1]
  ];
  const failed = checks.filter(function(item) { return !item[1]; }).map(function(item) { return item[0]; });
  if (failed.length > 0) {
    throw new Error('SWELL移行テスト下書きの再取得確認に失敗しました: ' + failed.join(', ') + '（投稿ID: ' + postId + '）');
  }

  return {
    ok: true,
    postId: postId,
    editUrl: uaBuildWpEditUrl_(wpConfig.siteUrl, postId),
    checks: checks.length,
    meta: metaResult || null
  };
}

function uaUpdatePublishedWpFromWeb(data) {
  return uaUpdatePublishedWpFromPanel(data || {});
}

/**
 * Repairs recent SWELL posts that were published with the former
 * card-like paragraph or a standalone same-site anchor instead of the native
 * SWELL post-link block. The default is a read-only preview.
 */
function uaMigrateRecentSwellInternalLinkCards(options) {
  const opts = options || {};
  const requestedKey = String(opts.appKey || '').trim().toLowerCase();
  const appKeys = requestedKey ? [requestedKey] : ['drive', 'home'];
  const maxPosts = Math.max(1, Math.min(20, Number(opts.maxPosts || 10)));
  const dryRun = opts.dryRun !== false;
  const result = { dryRun: dryRun, scanned: 0, changed: 0, updated: 0, details: [] };

  appKeys.forEach(function(appKey) {
    const appConfig = UA_APP_TYPES[appKey];
    if (!appConfig || !uaUsesSwellBlocks_(appConfig) || appConfig.useWordPress === false) {
      throw new Error('SWELL内部リンク移行: 対象サイトが不正です: ' + appKey);
    }

    const wpConfig = uaGetWpConfig_(appConfig);
    const posts = uaCallWordPressApi_(
      wpConfig,
      '/wp-json/wp/v2/posts?status=publish&per_page=' + maxPosts + '&orderby=date&order=desc&context=edit',
      'get'
    ) || [];

    posts.forEach(function(post) {
      result.scanned++;
      const postId = Number(post && post.id || 0);
      const before = uaGetWpPostRawContent_(post);
      const after = uaNormalizeSwellInternalLinkBlocks_(before, appConfig, wpConfig.siteUrl);
      if (!postId || after === before) return;

      const missingImages = uaFindMissingPublishedWpImages_(before, after);
      if (missingImages.length) {
        throw new Error('SWELL内部リンク移行で画像が減るため停止しました: 投稿ID ' + postId);
      }
      const beforeUrls = uaExtractDriveSwellMigrationUrls_(before);
      const afterUrls = uaExtractDriveSwellMigrationUrls_(after);
      if (JSON.stringify(beforeUrls) !== JSON.stringify(afterUrls)) {
        throw new Error('SWELL内部リンク移行でURLが変わるため停止しました: 投稿ID ' + postId);
      }

      result.changed++;
      const detail = {
        appType: appConfig.label,
        postId: postId,
        title: String(post && post.title && (post.title.raw || post.title.rendered) || ''),
        cardCountBefore: (before.match(/<!--\s*wp:loos\/post-link\b/gi) || []).length,
        cardCountAfter: (after.match(/<!--\s*wp:loos\/post-link\b/gi) || []).length,
        updated: false
      };

      if (!dryRun) {
        uaCallWordPressApi_(
          wpConfig,
          '/wp-json/wp/v2/posts/' + encodeURIComponent(postId),
          'post',
          { content: after, status: 'publish' }
        );
        const verified = uaFetchWpPostForEdit_(wpConfig, postId);
        const verifiedBody = uaGetWpPostRawContent_(verified);
        const verifiedUrls = uaExtractDriveSwellMigrationUrls_(verifiedBody);
        const expectedCardCount = (after.match(/<!--\s*wp:loos\/post-link\b/gi) || []).length;
        const verifiedCardCount = (verifiedBody.match(/<!--\s*wp:loos\/post-link\b/gi) || []).length;
        if (
          String(verified && verified.status || '') !== 'publish' ||
          JSON.stringify(verifiedUrls) !== JSON.stringify(afterUrls) ||
          verifiedCardCount < expectedCardCount
        ) {
          throw new Error('SWELL内部リンク移行後の再取得確認に失敗しました: 投稿ID ' + postId);
        }
        if (uaFindMissingPublishedWpImages_(before, verifiedBody).length) {
          throw new Error('SWELL内部リンク移行後に画像欠落を検出しました: 投稿ID ' + postId);
        }
        detail.updated = true;
        result.updated++;
      }
      result.details.push(detail);
    });
  });

  return result;
}

function uaPreviewRecentSwellInternalLinkCards() {
  const result = uaMigrateRecentSwellInternalLinkCards({ maxPosts: 10, dryRun: true });
  console.log(JSON.stringify(result));
  return result;
}

function uaApplyRecentSwellInternalLinkCards() {
  const result = uaMigrateRecentSwellInternalLinkCards({ maxPosts: 10, dryRun: false });
  console.log(JSON.stringify(result));
  return result;
}

/**
 * Repairs only Article Compass managed point/caution groups that Gutenberg
 * marks invalid. The default is a read-only preview and every write is checked
 * for URL and image preservation before and after the WordPress update.
 */
function uaMigrateRecentSwellManagedGroups(options) {
  const opts = options || {};
  const requestedKey = String(opts.appKey || '').trim().toLowerCase();
  const appKeys = requestedKey ? [requestedKey] : ['drive', 'home'];
  const maxPosts = Math.max(1, Math.min(50, Number(opts.maxPosts || 20)));
  const dryRun = opts.dryRun !== false;
  const result = { dryRun: dryRun, scanned: 0, changed: 0, updated: 0, details: [] };

  appKeys.forEach(function(appKey) {
    const appConfig = UA_APP_TYPES[appKey];
    if (!appConfig || !uaUsesSwellBlocks_(appConfig) || appConfig.useWordPress === false) {
      throw new Error('SWELL装飾修復: 対象サイトが不正です: ' + appKey);
    }
    const wpConfig = uaGetWpConfig_(appConfig);
    const posts = uaCallWordPressApi_(
      wpConfig,
      '/wp-json/wp/v2/posts?status=publish&per_page=' + maxPosts + '&orderby=date&order=desc&context=edit',
      'get'
    ) || [];

    posts.forEach(function(post) {
      result.scanned++;
      const postId = Number(post && post.id || 0);
      const before = uaGetWpPostRawContent_(post);
      const after = uaNormalizeSwellManagedCoreGroups_(before, appConfig);
      if (!postId || after === before) return;

      if (uaFindMissingPublishedWpImages_(before, after).length) {
        throw new Error('SWELL装飾修復で画像が減るため停止しました: 投稿ID ' + postId);
      }
      const beforeUrls = uaExtractDriveSwellMigrationUrls_(before);
      const afterUrls = uaExtractDriveSwellMigrationUrls_(after);
      if (JSON.stringify(beforeUrls) !== JSON.stringify(afterUrls)) {
        throw new Error('SWELL装飾修復でURLが変わるため停止しました: 投稿ID ' + postId);
      }

      result.changed++;
      const detail = {
        appType: appConfig.label,
        postId: postId,
        title: String(post && post.title && (post.title.raw || post.title.rendered) || ''),
        managedGroups: (after.match(/article-compass-(?:point|notice)-box/g) || []).length,
        updated: false
      };

      if (!dryRun) {
        uaCallWordPressApi_(
          wpConfig,
          '/wp-json/wp/v2/posts/' + encodeURIComponent(postId),
          'post',
          { content: after, status: 'publish' }
        );
        const verified = uaFetchWpPostForEdit_(wpConfig, postId);
        const verifiedBody = uaGetWpPostRawContent_(verified);
        if (
          String(verified && verified.status || '') !== 'publish' ||
          uaNormalizeSwellManagedCoreGroups_(verifiedBody, appConfig) !== verifiedBody ||
          JSON.stringify(uaExtractDriveSwellMigrationUrls_(verifiedBody)) !== JSON.stringify(afterUrls) ||
          uaFindMissingPublishedWpImages_(before, verifiedBody).length
        ) {
          throw new Error('SWELL装飾修復後の再取得確認に失敗しました: 投稿ID ' + postId);
        }
        detail.updated = true;
        result.updated++;
      }
      result.details.push(detail);
    });
  });
  return result;
}

function uaPreviewRecentSwellManagedGroups() {
  const result = uaMigrateRecentSwellManagedGroups({ maxPosts: 20, dryRun: true });
  console.log(JSON.stringify(result));
  return result;
}

function uaApplyRecentSwellManagedGroups() {
  const result = uaMigrateRecentSwellManagedGroups({ maxPosts: 20, dryRun: false });
  console.log(JSON.stringify(result));
  return result;
}

/**
 * Replaces the old "wp:html + wp-block-button is-style-btn_solid" main
 * affiliate CTA (a fake SWELL button) with the real native SWELL button
 * block (wp:loos/button), matching what uaBuildManagedAffiliateCtaBlock_
 * now generates for new articles. Read-only preview by default; every
 * write is checked for URL and image preservation before and after.
 */
function uaMigrateRecentSwellAffiliateCtaButtons(options) {
  const opts = options || {};
  const requestedKey = String(opts.appKey || '').trim().toLowerCase();
  const appKeys = requestedKey ? [requestedKey] : ['drive', 'home'];
  const maxPosts = Math.max(1, Math.min(50, Number(opts.maxPosts || 20)));
  const dryRun = opts.dryRun !== false;
  const result = { dryRun: dryRun, scanned: 0, changed: 0, updated: 0, details: [] };

  appKeys.forEach(function(appKey) {
    const appConfig = UA_APP_TYPES[appKey];
    if (!appConfig || !uaUsesSwellBlocks_(appConfig) || appConfig.useWordPress === false) {
      throw new Error('SWELL CTAボタン修復: 対象サイトが不正です: ' + appKey);
    }
    const wpConfig = uaGetWpConfig_(appConfig);
    const posts = uaCallWordPressApi_(
      wpConfig,
      '/wp-json/wp/v2/posts?status=publish&per_page=' + maxPosts + '&orderby=date&order=desc&context=edit',
      'get'
    ) || [];

    posts.forEach(function(post) {
      result.scanned++;
      const postId = Number(post && post.id || 0);
      const before = uaGetWpPostRawContent_(post);
      const after = uaNormalizeSwellAffiliateCtaButtons_(before, appConfig);
      if (!postId || after === before) return;

      if (uaFindMissingPublishedWpImages_(before, after).length) {
        throw new Error('SWELL CTAボタン修復で画像が減るため停止しました: 投稿ID ' + postId);
      }
      const beforeUrls = uaExtractDriveSwellMigrationUrls_(before);
      const afterUrls = uaExtractDriveSwellMigrationUrls_(after);
      if (JSON.stringify(beforeUrls) !== JSON.stringify(afterUrls)) {
        throw new Error('SWELL CTAボタン修復でURLが変わるため停止しました: 投稿ID ' + postId);
      }

      result.changed++;
      const detail = {
        appType: appConfig.label,
        postId: postId,
        title: String(post && post.title && (post.title.raw || post.title.rendered) || ''),
        buttonsBefore: (before.match(/wp-block-button is-style-btn_solid/g) || []).length,
        buttonsAfter: (after.match(/<!--\s*wp:loos\/button\b/gi) || []).length,
        updated: false
      };

      if (!dryRun) {
        uaCallWordPressApi_(
          wpConfig,
          '/wp-json/wp/v2/posts/' + encodeURIComponent(postId),
          'post',
          { content: after, status: 'publish' }
        );
        const verified = uaFetchWpPostForEdit_(wpConfig, postId);
        const verifiedBody = uaGetWpPostRawContent_(verified);
        if (
          String(verified && verified.status || '') !== 'publish' ||
          uaNormalizeSwellAffiliateCtaButtons_(verifiedBody, appConfig) !== verifiedBody ||
          JSON.stringify(uaExtractDriveSwellMigrationUrls_(verifiedBody)) !== JSON.stringify(afterUrls) ||
          uaFindMissingPublishedWpImages_(before, verifiedBody).length
        ) {
          throw new Error('SWELL CTAボタン修復後の再取得確認に失敗しました: 投稿ID ' + postId);
        }
        detail.updated = true;
        result.updated++;
      }
      result.details.push(detail);
    });
  });
  return result;
}

function uaPreviewRecentSwellAffiliateCtaButtons() {
  const result = uaMigrateRecentSwellAffiliateCtaButtons({ maxPosts: 20, dryRun: true });
  console.log(JSON.stringify(result));
  return result;
}

function uaApplyRecentSwellAffiliateCtaButtons() {
  const result = uaMigrateRecentSwellAffiliateCtaButtons({ maxPosts: 20, dryRun: false });
  console.log(JSON.stringify(result));
  return result;
}

function uaMigrateExistingOttocastAffiliateLinks(options) {
  const opts = Object.assign({}, options || {}, { mode: 'ottocast' });
  return uaMigrateExistingComplementaryAffiliateLinks(opts);
}

/**
 * 既存の公開記事へ、メイン案件を補完するテキストリンクだけを安全に追加する。
 *
 * - dryRun=true（既定）では候補確認のみで、シートとWordPressを変更しない。
 * - メイン案件の囲みボタンがシート本文・公開本文の両方に存在する記事だけを対象にする。
 * - 公開中のWordPress本文を直接の更新元にするため、既存画像や手動編集を保持する。
 * - 追加後に公開状態、アイキャッチ、本文画像、サブ案件マーカーを再確認する。
 */
function uaMigrateExistingComplementaryAffiliateLinks(options) {
  const opts = options || {};
  const mode = opts.mode === 'ottocast' ? 'ottocast' : 'vehicle';
  const dryRun = opts.dryRun !== false;
  const afterRow = Math.max(1, Number(opts.afterRow || 1));
  const maxUpdates = dryRun ? 100 : Math.max(1, Math.min(3, Number(opts.maxUpdates || 2)));
  const appConfig = UA_APP_TYPES.drive;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(appConfig.articleSheetName);
  if (!sheet) throw new Error('既存記事移行: DRIVE BASEシートが見つかりません。');

  const wpConfig = uaGetWpConfig_(appConfig);
  const lastRow = sheet.getLastRow();
  const result = {
    dryRun: dryRun,
    scanned: 0,
    eligible: 0,
    updated: 0,
    skipped: 0,
    nextAfterRow: afterRow,
    hasMore: false,
    details: []
  };
  const markerRegex = mode === 'ottocast'
    ? /<!--\s*UA_OTTOCAST_AFFILIATE_START\s*-->/i
    : /<!--\s*UA_SUB_AFFILIATE_START\s*-->/i;

  function isTargetAffiliate(name) {
    if (mode === 'ottocast') return name === 'ナビ男くん';
    return name === 'ガリバー中古車ご提案サービス' || name === 'カーネクスト';
  }

  const articleValues = lastRow >= 2
    ? sheet.getRange(2, 1, lastRow - 1, UA_ARTICLE_COLUMN_COUNT).getValues()
    : [];
  const candidateRows = [];
  for (let sourceRow = Math.max(2, afterRow + 1); sourceRow <= lastRow; sourceRow++) {
    const values = articleValues[sourceRow - 2] || [];
    const sourceData = {
      row: sourceRow,
      appType: values[UA_COLUMNS.appType - 1] || appConfig.label,
      mainInput: values[UA_COLUMNS.mainInput - 1] || '',
      affiliateName: uaNormalizeAffiliateName_(values[UA_COLUMNS.affiliateName - 1]),
      affiliateUrl: values[UA_COLUMNS.affiliateUrl - 1] || '',
      affiliateNotes: values[UA_COLUMNS.affiliateNotes - 1] || '',
      readerMindMemo: values[UA_COLUMNS.readerMindMemo - 1] || '',
      status: values[UA_COLUMNS.status - 1] || '',
      body: values[UA_COLUMNS.body - 1] || '',
      titleIdeas: values[UA_COLUMNS.titleIdeas - 1] || '',
      metaDescription: values[UA_COLUMNS.metaDescription - 1] || '',
      wpPostId: values[UA_COLUMNS.wpPostId - 1] || '',
      structureMemo: values[UA_COLUMNS.structureMemo - 1] || ''
    };
    const sourceAffiliate = uaNormalizeAffiliateName_(sourceData.affiliateName);
    if (!isTargetAffiliate(sourceAffiliate)) continue;
    if (Number(sourceData.wpPostId || 0) <= 0) continue;
    candidateRows.push({ row: sourceRow, data: sourceData });
  }

  const postIds = candidateRows.map(function(item) {
    return Number(item.data.wpPostId || 0);
  }).filter(function(id, index, list) {
    return id > 0 && list.indexOf(id) === index;
  });
  const postMap = {};
  if (postIds.length > 0) {
    const posts = uaCallWordPressApi_(
      wpConfig,
      '/wp-json/wp/v2/posts?include=' + encodeURIComponent(postIds.join(',')) +
        '&per_page=100&context=edit&_fields=id,status,content,featured_media',
      'get'
    );
    (Array.isArray(posts) ? posts : []).forEach(function(post) {
      postMap[Number(post && post.id || 0)] = post;
    });
  }

  for (let candidateIndex = 0; candidateIndex < candidateRows.length; candidateIndex++) {
    const row = candidateRows[candidateIndex].row;
    const rowData = candidateRows[candidateIndex].data;
    const affiliateName = uaNormalizeAffiliateName_(rowData.affiliateName);
    if (!isTargetAffiliate(affiliateName)) continue;
    if (Number(rowData.wpPostId || 0) <= 0) continue;
    result.scanned++;

    const detail = {
      row: row,
      keyword: String(rowData.mainInput || ''),
      mainAffiliate: affiliateName,
      wpPostId: Number(rowData.wpPostId),
      status: 'skip',
      reason: ''
    };

    try {
      if (markerRegex.test(String(rowData.body || ''))) {
        detail.reason = 'シート本文へ追加済み';
        result.skipped++;
        result.details.push(detail);
        continue;
      }

      const mainSpec = uaGetManagedAffiliateCtaSpec_(rowData);
      if (!mainSpec || !uaManagedAffiliateCtaAlreadyExists_(rowData.body, mainSpec)) {
        detail.reason = 'シート本文でメイン案件の囲みボタンを確認できない';
        result.skipped++;
        result.details.push(detail);
        continue;
      }

      const project = mode === 'ottocast'
        ? uaGetManagedOttocastProject_(rowData, appConfig, rowData.body)
        : uaGetComplementaryAffiliateProject_(rowData, appConfig, rowData.body);
      if (!project) {
        detail.reason = mode === 'ottocast'
          ? 'CarPlay AI Boxを自然に案内できる本文ではない'
          : '補助案件を自然に案内できる売却・乗り換え文脈がない';
        result.skipped++;
        result.details.push(detail);
        continue;
      }

      const currentPost = postMap[detail.wpPostId];
      if (!currentPost) {
        detail.reason = 'WordPress記事を取得できない';
        result.skipped++;
        result.details.push(detail);
        result.nextAfterRow = row;
        continue;
      }
      const currentStatus = String(currentPost && currentPost.status || '').trim();
      if (currentStatus !== 'publish') {
        detail.reason = 'WordPressが公開状態ではない（' + (currentStatus || '状態不明') + '）';
        result.skipped++;
        result.details.push(detail);
        continue;
      }

      const currentWpBody = uaGetWpPostRawContent_(currentPost);
      if (markerRegex.test(currentWpBody)) {
        detail.reason = 'WordPress本文へ追加済み';
        result.skipped++;
        result.details.push(detail);
        continue;
      }
      if (!uaManagedAffiliateCtaAlreadyExists_(currentWpBody, mainSpec)) {
        detail.reason = '公開本文でメイン案件の囲みボタンを確認できない';
        result.skipped++;
        result.details.push(detail);
        continue;
      }

      const nextSheetBody = mode === 'ottocast'
        ? uaApplyManagedOttocastTextLink_(rowData.body, rowData, appConfig, mainSpec)
        : uaApplyManagedSubAffiliateTextLink_(rowData.body, rowData, appConfig, mainSpec);
      const nextWpBody = mode === 'ottocast'
        ? uaApplyManagedOttocastTextLink_(currentWpBody, rowData, appConfig, mainSpec)
        : uaApplyManagedSubAffiliateTextLink_(currentWpBody, rowData, appConfig, mainSpec);
      if (nextSheetBody === String(rowData.body || '') || nextWpBody === currentWpBody) {
        detail.reason = 'テキストリンクの安全な差し込み位置を確定できない';
        result.skipped++;
        result.details.push(detail);
        continue;
      }

      const missingImages = uaFindMissingPublishedWpImages_(currentWpBody, nextWpBody);
      if (missingImages.length > 0) {
        detail.reason = '既存画像の欠落を検出';
        result.skipped++;
        result.details.push(detail);
        continue;
      }

      detail.status = dryRun ? 'eligible' : 'updated';
      detail.subAffiliate = String(project.name || '');
      detail.reason = dryRun ? '差し込み可能' : '公開本文とシート本文へ反映済み';
      result.eligible++;

      if (!dryRun) {
        uaCallWordPressApi_(
          wpConfig,
          '/wp-json/wp/v2/posts/' + encodeURIComponent(detail.wpPostId),
          'post',
          { content: nextWpBody }
        );
        const verifiedPost = uaFetchWpPostForEdit_(wpConfig, detail.wpPostId);
        const verifiedBody = uaGetWpPostRawContent_(verifiedPost);
        const originalFeaturedMediaId = Number(currentPost && currentPost.featured_media || 0);
        const verifiedFeaturedMediaId = Number(verifiedPost && verifiedPost.featured_media || 0);
        const remainingMissingImages = uaFindMissingPublishedWpImages_(currentWpBody, verifiedBody);

        if (String(verifiedPost && verifiedPost.status || '') !== 'publish') {
          throw new Error('更新後に公開状態を維持できませんでした。');
        }
        if (verifiedFeaturedMediaId !== originalFeaturedMediaId) {
          throw new Error('更新後にアイキャッチ画像の変更を検出しました。');
        }
        if (remainingMissingImages.length > 0) {
          throw new Error('更新後に既存画像の欠落を検出しました。');
        }
        if (!markerRegex.test(verifiedBody)) {
          throw new Error('更新後にサブ案件テキストリンクを確認できませんでした。');
        }

        sheet.getRange(row, UA_COLUMNS.body).setValue(nextSheetBody);
        sheet.getRange(row, UA_COLUMNS.wpDraftedAt).setValue(new Date());
        result.updated++;
      }
      result.details.push(detail);
      result.nextAfterRow = row;
      if (!dryRun && result.updated >= maxUpdates) {
        result.hasMore = candidateIndex < candidateRows.length - 1;
        break;
      }
    } catch (e) {
      detail.status = 'error';
      detail.reason = e && e.message ? e.message : String(e);
      result.skipped++;
      result.details.push(detail);
      result.nextAfterRow = row;
    }
  }

  return result;
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

  const wpConfig = uaGetWpConfig_(appConfig);
  const productPlan = uaExtractProductPlan_(rowData.body);
  const storedBody = uaNormalizeSwellManagedCoreGroups_(uaNormalizeSwellInternalLinkBlocks_(uaNormalizeUnsupportedTrialGuidance_(uaRemoveRedundantAffiliateDisclosure_(uaNormalizeAnchorRelAttributes_(uaApplyNaviokunIntroSet_(
    uaApplyManagedAffiliateCta_(uaRemoveRedundantAffiliateDisclosure_(rowData.body), rowData, appConfig),
    rowData,
    appConfig
  ))), productPlan), appConfig, wpConfig.siteUrl), appConfig);
  const wpBody = uaStripProductPlanMarker_(storedBody);
  if (storedBody !== String(rowData.body || '')) {
    sheet.getRange(row, UA_COLUMNS.body).setValue(storedBody);
    rowData.body = storedBody;
  }

  const allowedUnverifiedMarketFreshnessDraft = !!(data && data.allowUnverifiedMarketFreshnessDraft);
  uaAssertWpDraftHardQualityGates_(rowData, {
    allowUnverifiedMarketFreshnessDraft: allowedUnverifiedMarketFreshnessDraft
  });

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
  return uaUpdatePublishedWpFromPanelCore_(sheet, row);
}

function uaUpdatePublishedWpFromPanelCore_(sheet, row) {
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
  const storedBody = uaNormalizeSwellManagedCoreGroups_(uaNormalizeSwellInternalLinkBlocks_(uaNormalizeUnsupportedTrialGuidance_(uaRemoveRedundantAffiliateDisclosure_(uaNormalizeAnchorRelAttributes_(uaApplyNaviokunIntroSet_(
    uaApplyManagedAffiliateCta_(uaRemoveRedundantAffiliateDisclosure_(rowData.body), rowData, appConfig),
    rowData,
    appConfig
  ))), productPlan), appConfig, wpConfig.siteUrl), appConfig);
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

const UA_DRIVE_SWELL_MIGRATION_BACKUP_SHEET = 'SWELL移行バックアップ';
const UA_DRIVE_SWELL_MIGRATION_STATE_PROPERTY = 'UA_DRIVE_SWELL_MIGRATION_STATE_V1';
const UA_DRIVE_SWELL_MIGRATION_WORKER = 'uaRunDriveSwellExistingMigrationWorker';
const UA_HOME_SWELL_MIGRATION_BACKUP_SHEET = 'SWELL移行バックアップ_たくみパパ';
const UA_HOME_SWELL_MIGRATION_STATE_PROPERTY = 'UA_HOME_SWELL_MIGRATION_STATE_V1';
const UA_HOME_SWELL_MIGRATION_WORKER = 'uaRunHomeSwellExistingMigrationWorker';

/**
 * Converts only known Cocoon decoration blocks to the SWELL dialect used by
 * Article Compass. Text, images, affiliate markup, tracking pixels, Rinker
 * shortcodes, and URLs are kept byte-for-byte wherever they are reader-facing.
 */
function uaConvertCocoonDecorationsToSwell_(bodyHtml) {
  let html = String(bodyHtml || '');
  if (!html) return html;

  html = uaReplaceCocoonOuterBlock_(html, 'tab-caption-box-1', function(inner) {
    return uaConvertCocoonTabCaptionInnerToSwell_(inner);
  });
  html = html.replace(
    /<!--\s*wp:html\s*-->\s*<div\b[^>]*\bwp-block-cocoon-blocks-tab-caption-box-1\b[^>]*>([\s\S]*?)<\/div>\s*<!--\s*\/wp:html\s*-->/gi,
    function(match, inner) { return uaConvertCocoonTabCaptionInnerToSwell_(inner); }
  );
  html = html.replace(
    /<div\b[^>]*\bwp-block-cocoon-blocks-tab-caption-box-1\b[^>]*>([\s\S]*?<div\b[^>]*class=(['"])[^'"]*tab-caption-box-content[^'"]*\2[^>]*>[\s\S]*?<\/div>)\s*<\/div>/gi,
    function(match, inner) { return uaConvertCocoonTabCaptionInnerToSwell_(inner); }
  );

  html = uaReplaceCocoonOuterBlock_(html, 'info-box', function(inner, opening) {
    const styleMatch = /"style"\s*:\s*"([^"]+)"/i.exec(opening);
    const style = String(styleMatch && styleMatch[1] || '').toLowerCase();
    const title = style === 'success-box'
      ? '確認ポイント'
      : style === 'info-box'
        ? '補足'
        : '注意点';
    return uaBuildSwellMigrationCapBox_(title, inner.trim(), 'article-compass-migrated-info ' + (style || 'info-box'));
  });

  html = uaReplaceCocoonOuterBlock_(html, 'blank-box-1', function(inner) {
    return [
      '<!-- wp:group {"className":"is-style-border article-compass-migrated-border"} -->',
      '<div class="wp-block-group is-style-border article-compass-migrated-border">',
      inner.trim(),
      '</div>',
      '<!-- /wp:group -->'
    ].join('\n');
  });

  html = uaReplaceCocoonOuterBlock_(html, 'icon-box', function(inner) {
    return [
      '<!-- wp:group {"className":"is-style-border_left article-compass-migrated-icon-box"} -->',
      '<div class="wp-block-group is-style-border_left article-compass-migrated-icon-box">',
      inner.trim(),
      '</div>',
      '<!-- /wp:group -->'
    ].join('\n');
  });

  html = uaReplaceCocoonOuterBlock_(html, 'sticky-box', function(inner) {
    return uaBuildSwellMigrationCapBox_('ポイント', inner.trim(), 'article-compass-migrated-sticky');
  });

  html = uaReplaceCocoonOuterBlock_(html, 'micro-text', function(inner) {
    return [
      '<!-- wp:paragraph {"align":"center","style":{"color":{"text":"#e60033"}}} -->',
      '<p class="has-text-align-center has-text-color" style="color:#e60033">' + uaRemoveLegacyMicroTextClasses_(inner.trim()) + '</p>',
      '<!-- /wp:paragraph -->'
    ].join('\n');
  });

  html = uaReplaceCocoonOuterBlock_(html, 'button-wrap-1', function(inner) {
    const clean = inner.trim();
    if (!/<a\b/i.test(clean)) {
      const shortcodeMatch = /(\[[A-Za-z0-9_-]+\b[^\]]*\])/i.exec(clean);
      if (!shortcodeMatch) return clean;
      return [
        '<!-- wp:group {"className":"article-compass-affiliate-cta"} -->',
        '<div class="wp-block-group article-compass-affiliate-cta">',
        '<!-- wp:shortcode -->',
        shortcodeMatch[1],
        '<!-- /wp:shortcode -->',
        '</div>',
        '<!-- /wp:group -->'
      ].join('\n');
    }
    return [
      '<!-- wp:loos/button {"isCount":true,"color":"blue","btnSize":"l","className":"is-style-btn_shiny"} -->',
      '<div class="swell-block-button -html blue_ -size-l is-style-btn_shiny" data-id="article-compass-migrated">' + clean + '</div>',
      '<!-- /wp:loos/button -->'
    ].join('\n');
  });

  html = uaReplaceCocoonOuterBlock_(html, 'blogcard', function(inner) {
    const hrefMatch = /<a\b[^>]*href=(['"])([^'"]+)\1/i.exec(inner);
    const bareMatch = /(https?:\/\/[^\s<>'"]+)/i.exec(uaStripMigrationHtml_(inner));
    const url = uaDecodeMigrationEntities_(hrefMatch ? hrefMatch[2] : (bareMatch ? bareMatch[1] : ''));
    if (!url) return inner.trim();
    const attributes = {
      isNewTab: true,
      rel: 'noopener noreferrer',
      linkData: { url: url },
      icon: 'externalLink'
    };
    return '<!-- wp:loos/post-link ' + JSON.stringify(attributes) + ' /-->';
  });

  html = html.replace(
    /<span\b[^>]*class=(['"])(?:marker|marker-under)\1[^>]*>([\s\S]*?)<\/span>/gi,
    '<span style="background:linear-gradient(transparent 60%, #fff3a3 60%);"><span class="swl-marker mark_yellow">$2</span></span>'
  );
  html = html.replace(
    /<span\b[^>]*class=(['"])bold-red\1[^>]*>([\s\S]*?)<\/span>/gi,
    '<strong style="color:#e60033;">$2</strong>'
  );
  // Existing posts can contain duplicate rel attributes from old editors.
  // Normalize them during the same backed-up migration so affiliate links keep
  // one valid rel attribute without changing URLs, CTA text, or tracking pixels.
  return uaNormalizeAnchorRelAttributes_(uaRemoveLegacyMicroTextClasses_(html));
}

function uaRemoveLegacyMicroTextClasses_(value) {
  return String(value || '').replace(/\sclass=(['"])([^'"]*)\1/gi, function(match, quote, classValue) {
    const classes = String(classValue || '').split(/\s+/).filter(function(className) {
      return className && className !== 'micro-text-content' && className !== 'micro-content';
    });
    return classes.length ? ' class=' + quote + classes.join(' ') + quote : '';
  });
}

function uaConvertCocoonTabCaptionInnerToSwell_(inner) {
  const titleMatch = /class=(['"])[^'"]*tab-caption-box-label-text[^'"]*\1[^>]*>([\s\S]*?)<\/span>/i.exec(inner);
  const title = uaStripMigrationHtml_(titleMatch ? titleMatch[2] : '') || 'この記事のポイント';
  const contentMatch = /<div\b[^>]*class=(['"])[^'"]*tab-caption-box-content[^'"]*\1[^>]*>([\s\S]*)<\/div>\s*$/i.exec(inner);
  const content = contentMatch ? contentMatch[2].trim() : String(inner || '').trim();
  return uaBuildSwellMigrationCapBox_(title, content, 'article-compass-migrated-points');
}

function uaReplaceCocoonOuterBlock_(html, blockName, replacer) {
  const escaped = String(blockName || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(
    '<!--\\s*wp:cocoon-blocks\\/' + escaped + '\\b([\\s\\S]*?)-->' +
      '\\s*<div\\b[^>]*\\bwp-block-cocoon-blocks-' + escaped + '\\b[^>]*>' +
      '([\\s\\S]*?)<\\/div>\\s*<!--\\s*\\/wp:cocoon-blocks\\/' + escaped + '\\s*-->',
    'gi'
  );
  return String(html || '').replace(regex, function(match, attributes, inner) {
    return replacer(String(inner || ''), String(attributes || ''), match);
  });
}

function uaBuildSwellMigrationCapBox_(title, content, extraClass) {
  const className = ['is-style-onborder_ttl2', String(extraClass || '').trim()].filter(Boolean).join(' ');
  return [
    '<!-- wp:loos/cap-block {"dataColSet":"col1","className":' + JSON.stringify(className) + '} -->',
    '<div class="swell-block-capbox cap_box ' + className + '" data-colset="col1">',
    '<div class="cap_box_ttl"><span><strong>' + uaEscapeMigrationHtml_(title) + '</strong></span></div>',
    '<div class="cap_box_content">' + String(content || '').trim() + '</div>',
    '</div>',
    '<!-- /wp:loos/cap-block -->'
  ].join('\n');
}

function uaStripMigrationHtml_(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function uaDecodeMigrationEntities_(value) {
  return String(value || '')
    .replace(/&amp;/gi, '&')
    .replace(/&#38;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function uaEscapeMigrationHtml_(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function uaGetDriveSwellMigrationMetrics_(html) {
  const text = String(html || '');
  const blockNames = [
    'blogcard',
    'tab-caption-box-1',
    'info-box',
    'button-wrap-1',
    'blank-box-1',
    'icon-box',
    'sticky-box',
    'micro-text'
  ];
  const cocoon = {};
  blockNames.forEach(function(name) {
    const regex = new RegExp('<!--\\s*wp:cocoon-blocks\\/' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
    cocoon[name] = (text.match(regex) || []).length;
  });
  return {
    cocoon: cocoon,
    cocoonTotal: Object.keys(cocoon).reduce(function(sum, key) { return sum + cocoon[key]; }, 0),
    swellCapBoxes: (text.match(/<!--\s*wp:loos\/cap-block\b/gi) || []).length,
    swellButtons: (text.match(/<!--\s*wp:loos\/button\b/gi) || []).length,
    swellPostLinks: (text.match(/<!--\s*wp:loos\/post-link\b/gi) || []).length,
    markers: (text.match(/\bswl-marker\b/gi) || []).length
  };
}

function uaExtractDriveSwellMigrationUrls_(html) {
  const text = String(html || '');
  const urls = [];
  let match;
  const anchorRegex = /<a\b[^>]*href=(['"])([^'"]+)\1/gi;
  while ((match = anchorRegex.exec(text)) !== null) urls.push(uaDecodeMigrationEntities_(match[2]));
  const postLinkRegex = /"linkData"\s*:\s*\{\s*"url"\s*:\s*"([^"]+)"/gi;
  while ((match = postLinkRegex.exec(text)) !== null) urls.push(uaDecodeMigrationEntities_(match[1].replace(/\\\//g, '/')));
  const blogCardRegex = /<!--\s*wp:cocoon-blocks\/blogcard\b[\s\S]*?-->[\s\S]*?(https?:\/\/[^\s<>'"]+)[\s\S]*?<!--\s*\/wp:cocoon-blocks\/blogcard\s*-->/gi;
  while ((match = blogCardRegex.exec(text)) !== null) urls.push(uaDecodeMigrationEntities_(match[1]));
  return urls.filter(Boolean).filter(function(url, index, list) { return list.indexOf(url) === index; }).sort();
}

function uaExtractDriveSwellMigrationShortcodes_(html) {
  const textWithoutComments = String(html || '').replace(/<!--[\s\S]*?-->/g, '');
  const matches = textWithoutComments.match(/\[[A-Za-z0-9_-]+\b[^\]]*\]/g) || [];
  return matches.filter(function(item, index, list) { return list.indexOf(item) === index; }).sort();
}

function uaAssertDriveSwellMigrationSafety_(before, after) {
  const missingImages = uaFindMissingPublishedWpImages_(before, after);
  if (missingImages.length) {
    throw new Error('SWELL移行で画像が減るため停止しました: ' + missingImages.join(', '));
  }
  const beforeUrls = uaExtractDriveSwellMigrationUrls_(before);
  const afterUrls = uaExtractDriveSwellMigrationUrls_(after);
  if (JSON.stringify(beforeUrls) !== JSON.stringify(afterUrls)) {
    throw new Error('SWELL移行でリンクURLが変化するため停止しました。');
  }
  const beforeShortcodes = uaExtractDriveSwellMigrationShortcodes_(before);
  const afterShortcodes = uaExtractDriveSwellMigrationShortcodes_(after);
  if (JSON.stringify(beforeShortcodes) !== JSON.stringify(afterShortcodes)) {
    throw new Error('SWELL移行でショートコードが変化するため停止しました。');
  }
  if (/wp:cocoon-blocks\/|wp-block-cocoon-blocks-/i.test(after)) {
    throw new Error('未変換のCocoon装飾が残るため停止しました。');
  }
  return true;
}

function uaGetRemainingCocoonMarkupNames_(html) {
  const text = String(html || '');
  const names = [];
  let match;
  const blockRegex = /wp:cocoon-blocks\/([a-z0-9_-]+)/gi;
  while ((match = blockRegex.exec(text)) !== null) names.push(match[1]);
  const classRegex = /wp-block-cocoon-blocks-([a-z0-9_-]+)/gi;
  while ((match = classRegex.exec(text)) !== null) names.push(match[1]);
  return names.filter(function(name, index, list) { return list.indexOf(name) === index; }).sort();
}

function uaListDrivePublishedPostsForSwellMigration_() {
  const appConfig = UA_APP_TYPES.drive;
  const wpConfig = uaGetWpConfig_(appConfig);
  const posts = [];
  let page = 1;
  while (page <= 20) {
    const batch = uaCallWordPressApi_(
      wpConfig,
      '/wp-json/wp/v2/posts?status=publish&per_page=100&page=' + page +
        '&orderby=id&order=asc&context=edit&_fields=id,slug,status,title,content,featured_media,link',
      'get'
    );
    if (!Array.isArray(batch) || !batch.length) break;
    Array.prototype.push.apply(posts, batch);
    if (batch.length < 100) break;
    page++;
  }
  return posts;
}

function uaPlanDriveSwellExistingPostMigration() {
  const posts = uaListDrivePublishedPostsForSwellMigration_();
  const details = [];
  const totals = { posts: posts.length, candidates: 0, cocoonBlocks: 0 };
  posts.forEach(function(post) {
    const before = uaGetWpPostRawContent_(post);
    const after = uaConvertCocoonDecorationsToSwell_(before);
    const beforeMetrics = uaGetDriveSwellMigrationMetrics_(before);
    if (before === after) return;
    uaAssertDriveSwellMigrationSafety_(before, after);
    totals.candidates++;
    totals.cocoonBlocks += beforeMetrics.cocoonTotal;
    details.push({
      id: Number(post.id || 0),
      slug: String(post.slug || ''),
      title: String(post && post.title && (post.title.raw || post.title.rendered) || ''),
      cocoonBlocks: beforeMetrics.cocoonTotal
    });
  });
  const result = { ok: true, dryRun: true, totals: totals, details: details };
  console.log(JSON.stringify(result));
  return result;
}

function uaMigrateDriveSwellSamplePost894() {
  const result = uaMigrateDriveSwellExistingPost_(894, false);
  console.log(JSON.stringify(result));
  return result;
}

function uaStartDriveSwellExistingPostMigration() {
  const plan = uaPlanDriveSwellExistingPostMigration();
  const state = {
    status: 'running',
    ids: plan.details.map(function(item) { return item.id; }),
    index: 0,
    migrated: 0,
    skipped: 0,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastPostId: 0,
    lastError: ''
  };
  PropertiesService.getScriptProperties().setProperty(UA_DRIVE_SWELL_MIGRATION_STATE_PROPERTY, JSON.stringify(state));
  uaDeleteDriveSwellMigrationWorkerTriggers_();
  if (state.ids.length) {
    ScriptApp.newTrigger(UA_DRIVE_SWELL_MIGRATION_WORKER).timeBased().after(1000).create();
  } else {
    state.status = 'complete';
    PropertiesService.getScriptProperties().setProperty(UA_DRIVE_SWELL_MIGRATION_STATE_PROPERTY, JSON.stringify(state));
  }
  return { ok: true, plan: plan.totals, state: state };
}

function uaRunDriveSwellExistingMigrationWorker() {
  uaDeleteDriveSwellMigrationWorkerTriggers_();
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty(UA_DRIVE_SWELL_MIGRATION_STATE_PROPERTY);
  if (!raw) throw new Error('SWELL既存記事移行の状態がありません。');
  const state = JSON.parse(raw);
  if (state.status !== 'running') return state;
  const ids = Array.isArray(state.ids) ? state.ids : [];
  const limit = Math.min(ids.length, Number(state.index || 0) + 4);
  try {
    while (state.index < limit) {
      const postId = Number(ids[state.index] || 0);
      const result = uaMigrateDriveSwellExistingPost_(postId, false);
      state.lastPostId = postId;
      if (result.changed) state.migrated++;
      else state.skipped++;
      state.index++;
      state.updatedAt = new Date().toISOString();
      props.setProperty(UA_DRIVE_SWELL_MIGRATION_STATE_PROPERTY, JSON.stringify(state));
    }
    if (state.index >= ids.length) {
      state.status = 'complete';
      state.completedAt = new Date().toISOString();
    } else {
      ScriptApp.newTrigger(UA_DRIVE_SWELL_MIGRATION_WORKER).timeBased().after(30000).create();
    }
  } catch (e) {
    state.status = 'error';
    state.lastError = e && e.message ? e.message : String(e || '');
  }
  state.updatedAt = new Date().toISOString();
  props.setProperty(UA_DRIVE_SWELL_MIGRATION_STATE_PROPERTY, JSON.stringify(state));
  return state;
}

function uaMigrateDriveSwellExistingPost(postId, dryRun) {
  return uaMigrateDriveSwellExistingPost_(Number(postId || 0), dryRun !== false);
}

function uaMigrateDriveSwellExistingPost_(postId, dryRun) {
  if (!(postId > 0)) throw new Error('移行対象のWordPress投稿IDが不正です。');
  const appConfig = UA_APP_TYPES.drive;
  const wpConfig = uaGetWpConfig_(appConfig);
  const beforePost = uaFetchWpPostForEdit_(wpConfig, postId);
  if (String(beforePost && beforePost.status || '') !== 'publish') {
    throw new Error('公開済み記事以外は既存記事移行の対象外です。投稿ID: ' + postId);
  }
  const before = uaGetWpPostRawContent_(beforePost);
  const after = uaConvertCocoonDecorationsToSwell_(before);
  const result = {
    ok: true,
    postId: postId,
    changed: before !== after,
    dryRun: dryRun !== false,
    before: uaGetDriveSwellMigrationMetrics_(before),
    after: uaGetDriveSwellMigrationMetrics_(after)
  };
  if (!result.changed) return result;
  uaAssertDriveSwellMigrationSafety_(before, after);
  if (dryRun !== false) return result;

  uaBackupDrivePostForSwellMigration_(beforePost, before);
  uaCallWordPressApi_(wpConfig, '/wp-json/wp/v2/posts/' + encodeURIComponent(postId), 'post', { content: after });
  const verified = uaFetchWpPostForEdit_(wpConfig, postId);
  const verifiedBody = uaGetWpPostRawContent_(verified);
  if (String(verified && verified.status || '') !== 'publish') {
    throw new Error('SWELL移行後に公開状態が変化したため停止しました。投稿ID: ' + postId);
  }
  if (Number(verified && verified.featured_media || 0) !== Number(beforePost && beforePost.featured_media || 0)) {
    throw new Error('SWELL移行後にアイキャッチが変化したため停止しました。投稿ID: ' + postId);
  }
  uaAssertDriveSwellMigrationSafety_(before, verifiedBody);
  if (uaGetDriveSwellMigrationMetrics_(verifiedBody).cocoonTotal !== 0) {
    throw new Error('SWELL移行後の再取得本文にCocoon装飾が残っています。投稿ID: ' + postId);
  }
  result.verified = true;
  return result;
}

function uaBackupDrivePostForSwellMigration_(post, body) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(UA_DRIVE_SWELL_MIGRATION_BACKUP_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(UA_DRIVE_SWELL_MIGRATION_BACKUP_SHEET);
    sheet.getRange(1, 1, 1, 7).setValues([[
      'バックアップ日時', '投稿ID', 'タイトル', '状態', 'アイキャッチID', 'URL', '移行前本文'
    ]]);
    sheet.setFrozenRows(1);
    sheet.hideSheet();
  }
  const postId = Number(post && post.id || 0);
  if (sheet.getLastRow() >= 2) {
    const ids = sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getValues().map(function(row) { return Number(row[0] || 0); });
    if (ids.indexOf(postId) !== -1) return false;
  }
  sheet.appendRow([
    new Date(),
    postId,
    String(post && post.title && (post.title.raw || post.title.rendered) || ''),
    String(post && post.status || ''),
    Number(post && post.featured_media || 0),
    String(post && post.link || ''),
    String(body || '')
  ]);
  SpreadsheetApp.flush();
  return true;
}

function uaGetDriveSwellExistingPostMigrationStatus() {
  const raw = PropertiesService.getScriptProperties().getProperty(UA_DRIVE_SWELL_MIGRATION_STATE_PROPERTY);
  const result = raw ? JSON.parse(raw) : { status: 'not_started' };
  console.log(JSON.stringify(result));
  return result;
}

function uaDeleteDriveSwellMigrationWorkerTriggers_() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === UA_DRIVE_SWELL_MIGRATION_WORKER) ScriptApp.deleteTrigger(trigger);
  });
}

function uaListHomePublishedPostsForSwellMigration_() {
  const appConfig = UA_APP_TYPES.home;
  const wpConfig = uaGetWpConfig_(appConfig);
  const posts = [];
  let page = 1;
  while (page <= 20) {
    const batch = uaCallWordPressApi_(
      wpConfig,
      '/wp-json/wp/v2/posts?status=publish&per_page=100&page=' + page +
        '&orderby=id&order=asc&context=edit&_fields=id,slug,status,title,content,featured_media,link',
      'get'
    );
    if (!Array.isArray(batch) || !batch.length) break;
    Array.prototype.push.apply(posts, batch);
    if (batch.length < 100) break;
    page++;
  }
  return posts;
}

function uaPlanHomeSwellExistingPostMigration() {
  const posts = uaListHomePublishedPostsForSwellMigration_();
  const details = [];
  const totals = { posts: posts.length, candidates: 0, cocoonBlocks: 0 };
  posts.forEach(function(post) {
    const before = uaGetWpPostRawContent_(post);
    const after = uaConvertCocoonDecorationsToSwell_(before);
    const beforeMetrics = uaGetDriveSwellMigrationMetrics_(before);
    if (before === after) return;
    const remainingNames = uaGetRemainingCocoonMarkupNames_(after);
    if (remainingNames.length) {
      throw new Error('たくみパパ投稿ID ' + Number(post.id || 0) + ' に未対応のCocoon装飾があります: ' + remainingNames.join(', '));
    }
    uaAssertDriveSwellMigrationSafety_(before, after);
    totals.candidates++;
    totals.cocoonBlocks += beforeMetrics.cocoonTotal;
    details.push({
      id: Number(post.id || 0),
      slug: String(post.slug || ''),
      title: String(post && post.title && (post.title.raw || post.title.rendered) || ''),
      cocoonBlocks: beforeMetrics.cocoonTotal
    });
  });
  const result = { ok: true, dryRun: true, totals: totals, details: details };
  console.log(JSON.stringify(result));
  return result;
}

function uaInspectHomeCocoonMigrationMarkup() {
  const findings = [];
  uaListHomePublishedPostsForSwellMigration_().forEach(function(post) {
    const before = uaGetWpPostRawContent_(post);
    const after = uaConvertCocoonDecorationsToSwell_(before);
    const names = uaGetRemainingCocoonMarkupNames_(after);
    names.forEach(function(name) {
      const needle1 = 'wp:cocoon-blocks/' + name;
      const needle2 = 'wp-block-cocoon-blocks-' + name;
      let index = after.indexOf(needle1);
      if (index < 0) index = after.indexOf(needle2);
      findings.push({
        id: Number(post.id || 0),
        slug: String(post.slug || ''),
        name: name,
        snippet: index >= 0 ? after.slice(Math.max(0, index - 180), index + 1100) : ''
      });
    });
  });
  console.log(JSON.stringify(findings));
  return findings;
}

function uaMigrateHomeSwellSamplePost() {
  const plan = uaPlanHomeSwellExistingPostMigration();
  if (!plan.details.length) return { ok: true, changed: false, reason: 'no_candidates' };
  const result = uaMigrateHomeSwellExistingPost_(Number(plan.details[0].id || 0), false);
  console.log(JSON.stringify(result));
  return result;
}

function uaStartHomeSwellExistingPostMigration() {
  const plan = uaPlanHomeSwellExistingPostMigration();
  const state = {
    status: 'running',
    ids: plan.details.map(function(item) { return item.id; }),
    index: 0,
    migrated: 0,
    skipped: 0,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastPostId: 0,
    lastError: ''
  };
  PropertiesService.getScriptProperties().setProperty(UA_HOME_SWELL_MIGRATION_STATE_PROPERTY, JSON.stringify(state));
  uaDeleteHomeSwellMigrationWorkerTriggers_();
  if (state.ids.length) {
    ScriptApp.newTrigger(UA_HOME_SWELL_MIGRATION_WORKER).timeBased().after(1000).create();
  } else {
    state.status = 'complete';
    PropertiesService.getScriptProperties().setProperty(UA_HOME_SWELL_MIGRATION_STATE_PROPERTY, JSON.stringify(state));
  }
  return { ok: true, plan: plan.totals, state: state };
}

function uaRunHomeSwellExistingMigrationWorker() {
  uaDeleteHomeSwellMigrationWorkerTriggers_();
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty(UA_HOME_SWELL_MIGRATION_STATE_PROPERTY);
  if (!raw) throw new Error('たくみパパSWELL既存記事移行の状態がありません。');
  const state = JSON.parse(raw);
  if (state.status !== 'running') return state;
  const ids = Array.isArray(state.ids) ? state.ids : [];
  const limit = Math.min(ids.length, Number(state.index || 0) + 4);
  try {
    while (state.index < limit) {
      const postId = Number(ids[state.index] || 0);
      const result = uaMigrateHomeSwellExistingPost_(postId, false);
      state.lastPostId = postId;
      if (result.changed) state.migrated++;
      else state.skipped++;
      state.index++;
      state.updatedAt = new Date().toISOString();
      props.setProperty(UA_HOME_SWELL_MIGRATION_STATE_PROPERTY, JSON.stringify(state));
    }
    if (state.index >= ids.length) {
      state.status = 'complete';
      state.completedAt = new Date().toISOString();
    } else {
      ScriptApp.newTrigger(UA_HOME_SWELL_MIGRATION_WORKER).timeBased().after(30000).create();
    }
  } catch (e) {
    state.status = 'error';
    state.lastError = e && e.message ? e.message : String(e || '');
  }
  state.updatedAt = new Date().toISOString();
  props.setProperty(UA_HOME_SWELL_MIGRATION_STATE_PROPERTY, JSON.stringify(state));
  return state;
}

function uaMigrateHomeSwellExistingPost(postId, dryRun) {
  return uaMigrateHomeSwellExistingPost_(Number(postId || 0), dryRun !== false);
}

function uaMigrateHomeSwellExistingPost_(postId, dryRun) {
  if (!(postId > 0)) throw new Error('たくみパパ移行対象のWordPress投稿IDが不正です。');
  const appConfig = UA_APP_TYPES.home;
  const wpConfig = uaGetWpConfig_(appConfig);
  const beforePost = uaFetchWpPostForEdit_(wpConfig, postId);
  if (String(beforePost && beforePost.status || '') !== 'publish') {
    throw new Error('公開済み記事以外は既存記事移行の対象外です。投稿ID: ' + postId);
  }
  const before = uaGetWpPostRawContent_(beforePost);
  const after = uaConvertCocoonDecorationsToSwell_(before);
  const result = {
    ok: true,
    postId: postId,
    changed: before !== after,
    dryRun: dryRun !== false,
    before: uaGetDriveSwellMigrationMetrics_(before),
    after: uaGetDriveSwellMigrationMetrics_(after)
  };
  if (!result.changed) return result;
  uaAssertDriveSwellMigrationSafety_(before, after);
  if (dryRun !== false) return result;

  uaBackupHomePostForSwellMigration_(beforePost, before);
  uaCallWordPressApi_(wpConfig, '/wp-json/wp/v2/posts/' + encodeURIComponent(postId), 'post', { content: after });
  const verified = uaFetchWpPostForEdit_(wpConfig, postId);
  const verifiedBody = uaGetWpPostRawContent_(verified);
  if (String(verified && verified.status || '') !== 'publish') {
    throw new Error('たくみパパSWELL移行後に公開状態が変化したため停止しました。投稿ID: ' + postId);
  }
  if (Number(verified && verified.featured_media || 0) !== Number(beforePost && beforePost.featured_media || 0)) {
    throw new Error('たくみパパSWELL移行後にアイキャッチが変化したため停止しました。投稿ID: ' + postId);
  }
  uaAssertDriveSwellMigrationSafety_(before, verifiedBody);
  if (uaGetDriveSwellMigrationMetrics_(verifiedBody).cocoonTotal !== 0) {
    throw new Error('たくみパパSWELL移行後の再取得本文にCocoon装飾が残っています。投稿ID: ' + postId);
  }
  result.verified = true;
  return result;
}

function uaBackupHomePostForSwellMigration_(post, body) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(UA_HOME_SWELL_MIGRATION_BACKUP_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(UA_HOME_SWELL_MIGRATION_BACKUP_SHEET);
    sheet.getRange(1, 1, 1, 7).setValues([[
      'バックアップ日時', '投稿ID', 'タイトル', '状態', 'アイキャッチID', 'URL', '移行前本文'
    ]]);
    sheet.setFrozenRows(1);
    sheet.hideSheet();
  }
  const postId = Number(post && post.id || 0);
  if (sheet.getLastRow() >= 2) {
    const ids = sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getValues().map(function(row) { return Number(row[0] || 0); });
    if (ids.indexOf(postId) !== -1) return false;
  }
  sheet.appendRow([
    new Date(),
    postId,
    String(post && post.title && (post.title.raw || post.title.rendered) || ''),
    String(post && post.status || ''),
    Number(post && post.featured_media || 0),
    String(post && post.link || ''),
    String(body || '')
  ]);
  SpreadsheetApp.flush();
  return true;
}

function uaGetHomeSwellExistingPostMigrationStatus() {
  const raw = PropertiesService.getScriptProperties().getProperty(UA_HOME_SWELL_MIGRATION_STATE_PROPERTY);
  const result = raw ? JSON.parse(raw) : { status: 'not_started' };
  console.log(JSON.stringify(result));
  return result;
}

function uaDeleteHomeSwellMigrationWorkerTriggers_() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === UA_HOME_SWELL_MIGRATION_WORKER) ScriptApp.deleteTrigger(trigger);
  });
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

// One-off, 2026-08-30: たくみパパの画像監査（Codex実施）で見つかった、アイキャッチalt
// 空欄の2記事（投稿979 muji-beads-sofa-choice, 投稿726 popup-tent-cannot-fold）の状況を
// 確認する。まずは読み取りのみ（書き込みなし）でタイトル・現在のalt・画像URLをログへ出す。
function uaInspectTakumiMissingFeaturedImageAlt20260830() {
  const wpConfig = uaGetWpConfig_(UA_APP_TYPES.home);
  [979, 726].forEach(function(postId) {
    const post = uaCallWordPressApi_(
      wpConfig,
      '/wp-json/wp/v2/posts/' + postId + '?context=edit&_fields=id,slug,title,featured_media',
      'get'
    );
    const title = post && post.title && (post.title.rendered || post.title.raw) || '';
    const featuredMediaId = Number(post && post.featured_media || 0);
    console.log('投稿' + postId + ' slug=' + (post && post.slug) + ' title=' + title + ' featured_media=' + featuredMediaId);

    if (!featuredMediaId) {
      console.log('  featured_media が設定されていません。');
      return;
    }

    const media = uaCallWordPressApi_(
      wpConfig,
      '/wp-json/wp/v2/media/' + featuredMediaId + '?context=edit&_fields=id,alt_text,source_url,title',
      'get'
    );
    console.log('  media id=' + media.id + ' alt_text="' + (media.alt_text || '') + '" source_url=' + media.source_url);
  });
}

// One-off, 2026-08-30: fill in the missing alt text for those same 2 featured
// images. Uses the post title as alt text, matching the convention every
// other auto-generated eyecatch image already uses (see `alt: title` in
// image.gs's plan builder) -- these 2 just never went through that path.
function uaFixTakumiMissingFeaturedImageAlt20260830() {
  const wpConfig = uaGetWpConfig_(UA_APP_TYPES.home);
  [979, 726].forEach(function(postId) {
    const post = uaCallWordPressApi_(
      wpConfig,
      '/wp-json/wp/v2/posts/' + postId + '?context=edit&_fields=id,title,featured_media',
      'get'
    );
    const title = String(post && post.title && (post.title.rendered || post.title.raw) || '').trim();
    const featuredMediaId = Number(post && post.featured_media || 0);

    if (!title || !featuredMediaId) {
      console.log('投稿' + postId + ': title または featured_media が取得できないためスキップします。');
      return;
    }

    const updated = uaCallWordPressApi_(
      wpConfig,
      '/wp-json/wp/v2/media/' + featuredMediaId,
      'post',
      { alt_text: title.slice(0, 120) }
    );
    console.log('投稿' + postId + ' media id=' + featuredMediaId + ' alt_text更新後="' + (updated.alt_text || '') + '"');
  });
}

// One-off, 2026-08-30: fix DRIVE BASE featured images whose alt text still
// has the raw "案1 / タイトル候補A / 案2 / タイトル候補B / 案3 / タイトル候補C"
// title-selection text baked in, instead of the final chosen title (found
// via a code review comparing this session's evaluation of
// display-audio-regret-guide against Codex's independent review -- these 4
// posts show up as its related-article thumbnails). Same fix as
// uaFixTakumiMissingFeaturedImageAlt20260830: alt_text := current post title.
function uaFixDriveRelatedPostAltTitleLeak20260830() {
  const wpConfig = uaGetWpConfig_(UA_APP_TYPES.drive);
  [1892, 1876, 1858, 1843].forEach(function(postId) {
    const post = uaCallWordPressApi_(
      wpConfig,
      '/wp-json/wp/v2/posts/' + postId + '?context=edit&_fields=id,title,featured_media',
      'get'
    );
    const title = String(post && post.title && (post.title.rendered || post.title.raw) || '').trim();
    const featuredMediaId = Number(post && post.featured_media || 0);

    if (!title || !featuredMediaId) {
      console.log('投稿' + postId + ': title または featured_media が取得できないためスキップします。');
      return;
    }

    const before = uaCallWordPressApi_(
      wpConfig,
      '/wp-json/wp/v2/media/' + featuredMediaId + '?context=edit&_fields=id,alt_text',
      'get'
    );
    const updated = uaCallWordPressApi_(
      wpConfig,
      '/wp-json/wp/v2/media/' + featuredMediaId,
      'post',
      { alt_text: title.slice(0, 120) }
    );
    console.log('投稿' + postId + ' media id=' + featuredMediaId
      + ' alt_text更新前="' + (before.alt_text || '') + '"'
      + ' alt_text更新後="' + (updated.alt_text || '') + '"');
  });
}

// One-off, 2026-08-30: locate the DRIVE BASE sheet row for
// display-audio-regret-guide (WP post 2268) and report its rowData
// (read-only) before re-applying today's CTA fixes to the live post.
function uaFindDisplayAudioRegretGuideRow20260830() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(UA_APP_TYPES.drive.articleSheetName);
  const lastRow = sheet.getLastRow();
  for (let row = 2; row <= lastRow; row++) {
    const wpPostId = Number(sheet.getRange(row, UA_COLUMNS.wpPostId).getValue() || 0);
    if (wpPostId === 2268) {
      const rowData = uaBuildRowData_(sheet, row);
      console.log('row=' + row + ' affiliateName=' + rowData.affiliateName
        + ' mainInput=' + rowData.mainInput + ' status=' + rowData.status
        + ' bodyLength=' + String(rowData.body || '').length);
      return;
    }
  }
  console.log('投稿ID 2268 の行が見つかりませんでした。');
}

// One-off, 2026-08-30: re-apply the CTA pipeline (including today's
// rel="sponsored" fix and the new Ottocast->ナビ男くん sub-offer) to the
// already-published display-audio-regret-guide article, using the standard
// uaUpdatePublishedWpFromPanelCore_ path (same safety checks: refuses to
// touch anything but a currently-published post, refuses if any existing
// image would be dropped).
//
// First run (12:10) updated the post but changed nothing: this article's
// Ottocast URL was already present in the stored body, so
// uaManagedAffiliateCtaAlreadyExists_ took the "already exists" branch,
// which only strips a leftover [UA_AFFILIATE_CTA] token -- it never rebuilds
// the block, so the stale rel="nofollow"-only HTML passed straight through
// untouched, and the sub-offer wrapper never got a fresh block to anchor to.
// Strip the existing managed CTA block from the stored body first so the
// pipeline is forced through uaBuildManagedAffiliateCtaBlock_ again.
function uaReapplyCtaFixesToDisplayAudioRegretGuide20260830() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(UA_APP_TYPES.drive.articleSheetName);
  const lastRow = sheet.getLastRow();
  for (let row = 2; row <= lastRow; row++) {
    const wpPostId = Number(sheet.getRange(row, UA_COLUMNS.wpPostId).getValue() || 0);
    if (wpPostId === 2268) {
      const rowData = uaBuildRowData_(sheet, row);
      const spec = uaGetManagedAffiliateCtaSpec_(rowData);
      if (!spec) {
        console.log('案件仕様(spec)を取得できませんでした。affiliateName=' + rowData.affiliateName);
        return;
      }
      const alreadyExists = uaManagedAffiliateCtaAlreadyExists_(rowData.body, spec);
      // Also strip the stray ナビ男くんイントロセット box a previous run
      // mistakenly added (see the intro-set guard fix) so it doesn't linger.
      const strippedBody = uaRemoveNaviokunIntroSet_(uaRemoveManagedAffiliateButtonBlocks_(rowData.body, spec));
      console.log('既存CTA検出=' + alreadyExists + ' 除去前後の本文長=' + rowData.body.length + '->' + strippedBody.length);
      sheet.getRange(row, UA_COLUMNS.body).setValue(strippedBody);
      const result = uaUpdatePublishedWpFromPanelCore_(sheet, row);
      console.log('更新完了: ' + JSON.stringify(result));
      return;
    }
  }
  console.log('投稿ID 2268 の行が見つかりませんでした。');
}

// One-off, 2026-08-30: diagnose why the ナビ男くん sub-offer wasn't added
// during the reapply above (rel=sponsored fix worked; sub-offer did not).
function uaDiagnoseNaviokunSubForDisplayAudioRegretGuide20260830() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(UA_APP_TYPES.drive.articleSheetName);
  const lastRow = sheet.getLastRow();
  for (let row = 2; row <= lastRow; row++) {
    const wpPostId = Number(sheet.getRange(row, UA_COLUMNS.wpPostId).getValue() || 0);
    if (wpPostId !== 2268) continue;
    const rowData = uaBuildRowData_(sheet, row);
    const appConfig = UA_APP_TYPES.drive;
    const mainName = uaNormalizeAffiliateName_(rowData.affiliateName);
    console.log('mainName(normalized)=' + mainName);

    const project = uaReadAffiliateProjectByName_('ナビ男くん', false);
    console.log('ナビ男くん project=' + JSON.stringify(project));

    const context = [
      rowData.mainInput,
      rowData.readerMindMemo,
      rowData.structureMemo,
      String(rowData.body || '').replace(/<!--[^]*?-->/g, ' ').replace(/<[^>]+>/g, ' ')
    ].join(' ');
    console.log('関連性判定=' + UA_NAVIOKUN_SUB_RELEVANCE_PATTERN.test(context));

    const spec = uaGetManagedAffiliateCtaSpec_(rowData);
    const bounds = uaFindManagedAffiliateCtaBounds_(rowData.body, spec);
    console.log('メインCTA bounds見つかった=' + !!bounds);

    const subProject = uaGetManagedNaviokunSubProject_(rowData, appConfig, rowData.body);
    console.log('uaGetManagedNaviokunSubProject_結果=' + JSON.stringify(subProject));
    return;
  }
  console.log('投稿ID 2268 の行が見つかりませんでした。');
}

// One-off, 2026-08-30: inspect the タフト 買って よかった row that stopped
// with "修正後もNGが1件ある" before WordPress reflection, to see what the
// remaining critical NG item actually is.
function uaInspectTaftBuyGoodStopReason20260830() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(UA_APP_TYPES.drive.articleSheetName);
  const lastRow = sheet.getLastRow();
  const mainInputs = sheet.getRange(2, UA_COLUMNS.mainInput, lastRow - 1, 1).getValues();
  for (let i = 0; i < mainInputs.length; i++) {
    const value = String(mainInputs[i][0] || '');
    if (value.indexOf('タフト') !== -1 && value.indexOf('買って') !== -1) {
      const row = i + 2;
      const rowData = uaBuildRowData_(sheet, row);
      console.log('row=' + row + ' mainInput=' + rowData.mainInput + ' status=' + rowData.status
        + ' wpPostId=' + rowData.wpPostId + ' bodyLength=' + String(rowData.body || '').length);
      console.log('factCheckPoints=' + rowData.factCheckPoints);
      break;
    }
  }
  const job = uaGetAutomaticPostingJob_();
  if (!job) {
    console.log('自動投稿ジョブ: なし（アクティブなジョブがありません）');
    return;
  }
  console.log('自動投稿ジョブ: appType=' + job.appType + ' status=' + job.status + ' step=' + job.step
    + ' keyword=' + job.keyword + ' row=' + job.row
    + ' stepStartedAt=' + job.stepStartedAt + ' updatedAt=' + job.updatedAt);
  console.log('lastError=' + job.lastError);
  const settings = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('自動投稿設定');
  if (settings) {
    console.log('DRIVE BASE現在の状態=' + settings.getRange('B7').getValue());
    console.log('DRIVE BASE最後のエラー=' + settings.getRange('B9').getValue());
  }
}

// One-off, 2026-08-30: trace why the automated Rinker/楽天バナー insertion
// didn't cover the accessories H2 in the タフト row, so we can decide whether
// this is a real gap in uaShouldInsertRakutenAffiliateBanner_/
// uaFindRakutenContextualInsertIndex_ or a case that genuinely needs a human
// call (an intro paragraph naming 3 different accessory types, not one
// specific sellable product).
function uaTraceTaftAccessoryBannerGap20260830() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(UA_APP_TYPES.drive.articleSheetName);
  const lastRow = sheet.getLastRow();
  const mainInputs = sheet.getRange(2, UA_COLUMNS.mainInput, lastRow - 1, 1).getValues();
  for (let i = 0; i < mainInputs.length; i++) {
    const value = String(mainInputs[i][0] || '');
    if (value.indexOf('タフト') === -1 || value.indexOf('買って') === -1) continue;
    const row = i + 2;
    const rowData = uaBuildRowData_(sheet, row);
    const appConfig = UA_APP_TYPES.drive;
    console.log('affiliateName=' + rowData.affiliateName + ' affiliateNotes=' + rowData.affiliateNotes);

    const body = String(rowData.body || '');
    const hasAnyBanner = body.indexOf('UA_MAIN_AFFILIATE_CTA_START') !== -1
      || /yyi-rinker-box|rinker-box|item\.rakuten\.co\.jp/.test(body);
    console.log('本文内にRinker/楽天バナーが既にあるか=' + hasAnyBanner);

    const h2Match = /<h2[^>]*>\s*納車後の用品は優先順位を付けて選ぶ\s*<\/h2>([\s\S]*?)(?=<h2|$)/.exec(body);
    console.log('該当H2の本文=' + (h2Match ? h2Match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500) : '見つかりませんでした'));

    const shouldInsert = uaShouldInsertRakutenAffiliateBanner_(body, rowData, appConfig);
    console.log('uaShouldInsertRakutenAffiliateBanner_結果=' + shouldInsert + ' UA_LAST_RAKUTEN_STATUS=' + UA_LAST_RAKUTEN_STATUS);

    const mainKeywordProfile = uaGetMainKeywordProductProfile_(rowData, appConfig);
    console.log('uaGetMainKeywordProductProfile_結果=' + JSON.stringify(mainKeywordProfile));

    const productPlan = uaExtractProductPlan_(body);
    console.log('uaExtractProductPlan_結果=' + JSON.stringify(productPlan));

    const contextualIndex = uaFindRakutenContextualInsertIndex_(body, rowData, appConfig);
    console.log('uaFindRakutenContextualInsertIndex_結果(挿入位置index)=' + contextualIndex);
    return;
  }
  console.log('タフト 買って よかった に一致する行が見つかりませんでした。');
}

// One-off, 2026-08-30: read-only verification that the new secondary
// product-category feature actually covers タフト row 106's accessories H2.
// Does NOT write anything back to the sheet or WordPress -- just runs
// uaApplyRakutenAffiliateBanner_ against the row's real stored body and
// reports whether the new mention appears.
function uaVerifyTaftSecondaryProductMention20260830() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(UA_APP_TYPES.drive.articleSheetName);
  const lastRow = sheet.getLastRow();
  const mainInputs = sheet.getRange(2, UA_COLUMNS.mainInput, lastRow - 1, 1).getValues();
  for (let i = 0; i < mainInputs.length; i++) {
    const value = String(mainInputs[i][0] || '');
    if (value.indexOf('タフト') === -1 || value.indexOf('買って') === -1) continue;
    const row = i + 2;
    const rowData = uaBuildRowData_(sheet, row);
    const appConfig = UA_APP_TYPES.drive;

    const updatedBody = uaApplyRakutenAffiliateBanner_(rowData.body, rowData, appConfig);
    console.log('UA_LAST_RAKUTEN_STATUS=' + UA_LAST_RAKUTEN_STATUS);
    console.log('本文長: 変更前=' + String(rowData.body || '').length + ' 変更後=' + updatedBody.length);
    console.log('セカンダリ商品メンションを含むか=' + updatedBody.includes('UA_SECONDARY_PRODUCT_START'));

    const markerIndex = updatedBody.indexOf('UA_SECONDARY_PRODUCT_START');
    if (markerIndex > -1) {
      console.log('挿入箇所の前後200文字: ' + updatedBody.slice(Math.max(0, markerIndex - 100), markerIndex + 300)
        .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    }
    return;
  }
  console.log('タフト 買って よかった に一致する行が見つかりませんでした。');
}

// One-off, 2026-08-30: check whether the タフト row already has a proper
// managed used-car affiliate (ガリバー/カーネクスト) set, and whether its CTA
// is already present in the body, before deciding how to fix the Rakuten
// "中古車" search that structurally can never succeed.
function uaCheckTaftManagedAffiliateSetup20260830() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(UA_APP_TYPES.drive.articleSheetName);
  const lastRow = sheet.getLastRow();
  const mainInputs = sheet.getRange(2, UA_COLUMNS.mainInput, lastRow - 1, 1).getValues();
  for (let i = 0; i < mainInputs.length; i++) {
    const value = String(mainInputs[i][0] || '');
    if (value.indexOf('タフト') === -1 || value.indexOf('買って') === -1) continue;
    const row = i + 2;
    const rowData = uaBuildRowData_(sheet, row);
    console.log('affiliateName=' + rowData.affiliateName + ' affiliateUrl=' + rowData.affiliateUrl);
    console.log('本文にUA_MAIN_AFFILIATE_CTA_STARTを含むか=' + String(rowData.body || '').includes('UA_MAIN_AFFILIATE_CTA_START'));
    console.log('本文にガリバーを含むか=' + String(rowData.body || '').includes('ガリバー'));
    console.log('本文にカーネクストを含むか=' + String(rowData.body || '').includes('カーネクスト'));
    return;
  }
  console.log('タフト 買って よかった に一致する行が見つかりませんでした。');
}

// One-off, 2026-08-30: apply the used-car Rakuten-skip fix (@335) to the real
// タフト 買って よかった row, then re-run the existing pre-publish revision
// step through its normal short-circuit path (already has a completed
// AI revision report, so this does NOT call OpenAI again -- no new API cost)
// to confirm the accessory-H2 NG actually clears. If it clears, update the
// existing WordPress draft (post 2288) with the fixed body so the article is
// a ready, reviewable draft. Deliberately stops there -- does NOT call
// uaPublishWpPostFromAutomation_ (making the post live requires a separate,
// explicit user confirmation per the publishing-safety rule), and marks the
// automatic-posting job complete as "draft" so it's cleared from its stuck
// error state and the queue can move on.
function uaResumeTaftAfterUsedCarFix20260830() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(UA_APP_TYPES.drive.articleSheetName);
  const lastRow = sheet.getLastRow();
  const mainInputs = sheet.getRange(2, UA_COLUMNS.mainInput, lastRow - 1, 1).getValues();
  let row = 0;
  for (let i = 0; i < mainInputs.length; i++) {
    const value = String(mainInputs[i][0] || '');
    if (value.indexOf('タフト') !== -1 && value.indexOf('買って') !== -1) {
      row = i + 2;
      break;
    }
  }
  if (!row) {
    console.log('タフト 買って よかった に一致する行が見つかりませんでした（uaResumeTaftAfterUsedCarFix20260830）。');
    return;
  }

  const appConfig = UA_APP_TYPES.drive;
  const rowData = uaBuildRowData_(sheet, row);
  console.log('開始: row=' + row + ' bodyLength(修正前)=' + String(rowData.body || '').length);

  const fixedBody = uaApplyRakutenAffiliateBanner_(rowData.body, rowData, appConfig);
  console.log('UA_LAST_RAKUTEN_STATUS=' + UA_LAST_RAKUTEN_STATUS);
  console.log('bodyLength(修正後)=' + fixedBody.length);
  sheet.getRange(row, UA_COLUMNS.body).setValue(fixedBody);
  SpreadsheetApp.flush();

  const dataRef = { row: row, appType: appConfig.label };
  let revisionResult;
  try {
    revisionResult = uaApplyPrePublishFixesOnceFromPanel(dataRef);
  } catch (e) {
    console.log('公開前チェック再検証で依然としてNGが残っています。WordPress更新・ジョブ更新は行いません。');
    console.log('エラー: ' + (e && e.message ? e.message : String(e)));
    return;
  }
  console.log('公開前チェック再検証: 成功 message=' + (revisionResult && revisionResult.message));

  uaEnsureAutomaticProductLinksForData_(dataRef);
  const draftResult = uaCreateWpDraftFromPanel(dataRef);
  console.log('WordPress下書き更新: message=' + (draftResult && draftResult.message)
    + ' wpPostId=' + (draftResult && draftResult.wpPostId)
    + ' wpEditUrl=' + (draftResult && draftResult.wpEditUrl));

  // Deliberately NOT touching the automatic-posting job/queue state here
  // (uaCompleteAutomaticPostingJob_ etc.) -- clearing this job's error status
  // could let the trigger-driven automatic posting worker pick up the next
  // queued keyword and start spending API money on its own, which needs a
  // separate explicit go-ahead from the user, not an implicit side effect of
  // fixing this one article's body. Just report the job's current state.
  const job = uaGetAutomaticPostingJob_();
  if (job && Number(job.row) === row && String(job.keyword || '').trim() === String(rowData.mainInput || '').trim()) {
    console.log('自動投稿ジョブ(未変更): status=' + job.status + ' step=' + job.step + ' publishMode=' + job.publishMode
      + '｜このジョブの状態はここでは変更していません。自動投稿の再開はユーザー確認の上で別途行ってください。');
  } else {
    console.log('この行に紐づく自動投稿ジョブは見つかりませんでした（すでに解消済み、または対象外）。');
  }

  console.log('完了。WordPress下書き(post ' + (draftResult && draftResult.wpPostId) + ')は更新済みです。実際に公開する／自動投稿を再開するかはユーザー確認の上で判断してください。');
}
