function uaGenerateWpImagesFromWeb(data) {
  return uaGenerateWpImagesFromPanel(data || {});
}

function uaCreateImagePromptPackFromWeb(data) {
  return uaCreateImagePromptPackFromPanel(data || {});
}

function uaCreateImagePromptPackFromPanel(data) {
  const requestData = data || {};
  const title = String(
    requestData.imageArticleTitle
    || uaPickWpTitle_(requestData.titleIdeas)
    || requestData.mainInput
    || ''
  ).trim();
  const body = String(requestData.body || '');

  if (!title && !body) {
    throw new Error('画像設計AI: タイトルまたは本文がありません。');
  }

  const targets = uaNormalizeImagePromptTargets_(requestData.imageTargets, body);
  const provider = uaGetArticleProvider_();
  const promptText = uaBuildImagePromptPlannerPrompt_(title, requestData, targets);
  let response;

  try {
    response = uaCallImagePromptPlannerJson_(promptText, provider);
  } catch (e) {
    throw new Error('画像設計AI（' + provider + '）で失敗しました: ' + (e && e.message ? e.message : e));
  }

  const promptPack = uaFormatImagePromptPack_(response && response.data, title, requestData, targets);
  const count = 1 + targets.length;

  return {
    imagePromptPack: promptPack,
    imagePromptCount: count,
    imagePromptModel: uaFormatModelLabel_(provider, response && response.model || ''),
    message: '画像設計AIで' + count + '枚分の画像生成プロンプトを作成しました。'
  };
}

function uaNormalizeImagePromptTargets_(suppliedTargets, body) {
  const supplied = Array.isArray(suppliedTargets) ? suppliedTargets : [];
  const normalized = supplied.map(function(item) {
    return {
      heading: uaNormalizeHeadingText_(item && item.heading || ''),
      text: uaNormalizeHeadingText_(item && item.text || '').slice(0, 900),
      rank: String(item && item.rank || 'B').toUpperCase() === 'A' ? 'A' : 'B'
    };
  }).filter(function(item) {
    return item.heading;
  });

  if (normalized.length) {
    return normalized.slice(0, 6);
  }

  return uaPickGeneratedImageSections_(uaExtractImageSectionsFromBody_(body)).slice(0, 6);
}

function uaCallImagePromptPlannerJson_(promptText, provider) {
  if (provider === 'claude') {
    return uaCallClaudeJson_(promptText, 6000);
  }
  if (provider === 'openai') {
    return uaCallOpenAiJson_(promptText, 6000);
  }
  return uaCallGeminiJson_(promptText, 6000, 256);
}

function uaBuildImagePromptPlannerPrompt_(title, requestData, targets) {
  const style = uaBuildImagePromptPlanStyle_(requestData);
  const targetText = (targets || []).map(function(target, index) {
    return [
      '【対象' + (index + 1) + '】',
      'H2: ' + target.heading,
      '重要度: ' + target.rank,
      '本文（画像設計の参考だけに使い、出力へ転載しない）: ' + target.text
    ].join('\n');
  }).join('\n\n');

  return [
    'あなたは、日本語ブログ記事の画像ディレクターです。',
    '記事本文を画像モデルへ丸投げせず、アイキャッチと各H2に対して、その1枚だけで成立する具体的な画像生成プロンプトを設計してください。',
    '',
    '【記事タイトル】',
    title || '記事タイトル未設定',
    '',
    '【メインキーワード・依頼】',
    String(requestData.mainInput || ''),
    '',
    '【画風】',
    style,
    '',
    '【画像を作るH2】',
    targetText || 'H2画像なし',
    '',
    '【設計ルール】',
    '1. visual_prompt は、画像生成モデルへそのまま渡せる具体的な日本語の描写にする。被写体、場面、配置、視点、表情や動き、図解要素を120〜320文字で明示する。',
    '2. 「本文を表す画像」「分かりやすい図解」のような抽象指示だけで終わらせない。記事本文やH2全文を転載しない。',
    '3. 1枚につき1用途。別のH2、画像一覧、プロンプト一覧、コラージュ、サムネイル集を混ぜない。',
    '4. 比較・手順・判断基準なら、必要な2〜3要素を一つの自然な図解構図にまとめる。細かい説明文や小さなカードを大量に並べない。',
    '5. short_label は画像内に本当に必要な場合だけ、自然に完結する4〜14文字の日本語を1つ返す。途中で切った語句は禁止。不要なら空文字にする。',
    '6. composition は、主役の位置、余白、視線の流れが分かる具体的な1文にする。',
    '7. avoid は、その画像固有の誤解や不要物を短い1文にする。実在ロゴ、透かし、長文、端で切れる文字は全画像で禁止。',
    '8. アイキャッチは記事全体の悩みと判断軸が一目で伝わる主役中心の構図にし、H2要素を一覧化しない。',
    '9. sections は提示されたH2だけを、同じ見出し名・同じ順番・同じ件数で返す。',
    '',
    '【出力JSON】',
    '{',
    '  "eyecatch": {"visual_prompt":"", "short_label":"", "composition":"", "avoid":""},',
    '  "sections": [',
    '    {"heading":"提示されたH2を完全一致で返す", "visual_prompt":"", "short_label":"", "composition":"", "avoid":""}',
    '  ]',
    '}',
    '',
    'JSON以外は出力しないでください。'
  ].join('\n');
}

function uaBuildImagePromptPlanStyle_(requestData) {
  const preset = String(requestData && requestData.imageStylePreset || '').trim();
  const custom = String(requestData && requestData.imageStylePrompt || '').trim();
  if (preset === 'softFree') {
    return '柔らかい日本のフリー素材風。親しみやすい形、淡い色、明るい背景、ブログで意味が一目で伝わる清潔なイラスト。既存素材の模倣はしない。';
  }
  if (preset === 'custom' && custom) {
    return custom.slice(0, 500);
  }
  return '最新アニメ風。現代的で高品質な日本のアニメ調、清潔な線、自然な光、洗練された配色、記事向けに主役が明確な構図。特定作品の模倣はしない。';
}

function uaFormatImagePromptPack_(planData, title, requestData, targets) {
  const plan = planData && typeof planData === 'object' ? planData : {};
  const style = uaBuildImagePromptPlanStyle_(requestData);
  const total = 1 + (targets || []).length;
  const eyecatch = plan.eyecatch && typeof plan.eyecatch === 'object' ? plan.eyecatch : {};
  const sectionPlans = Array.isArray(plan.sections) ? plan.sections : [];
  const lines = [
    '【画風指定】',
    style,
    '',
    '【共通ルール】',
    '- 横長16:9。ここに書かれた各ブロックは、それぞれ別の1枚として生成する。',
    '- 1枚へ複数ブロック、画像一覧、コラージュ、設計表を混ぜない。',
    '- 画像内文字は指定された短い日本語ラベルだけ。説明文、H2全文、記事タイトル全文は描かない。',
    '- 文字と主役は中央の安全範囲に置き、上下左右に15%以上の余白を取る。',
    '- 実在ブランドのロゴ、正確な商品パッケージ、透かし、人物の特定可能な顔は入れない。',
    ''
  ];

  uaAppendImagePromptPackBlock_(lines, {
    heading: '【生成1/' + total + ' アイキャッチ】',
    type: 'EYECATCH',
    displayIndex: '00',
    targetHeading: '',
    title: title,
    visualPrompt: uaCleanImagePlanText_(eyecatch.visual_prompt, 500)
      || '記事「' + title + '」の中心的な悩みと判断軸を、象徴的な主役と状況が一目で分かる広い構図で描く。H2内容の一覧ではなく、記事を読みたくなる一つの場面として成立させる。',
    composition: uaCleanImagePlanText_(eyecatch.composition, 240)
      || '大きな主役を中央に置き、周囲の要素は少数に絞り、タイトル用の余白を十分に残す。',
    shortLabel: uaNormalizeImagePlanLabel_(eyecatch.short_label)
      || uaBuildNaturalGeneratedImageLabel_(requestData.mainInput, title, true),
    avoid: uaCleanImagePlanText_(eyecatch.avoid, 220)
  });

  (targets || []).forEach(function(target, index) {
    const sectionPlan = uaFindImageSectionPlan_(sectionPlans, target.heading, index);
    const number = String(index + 1).padStart(2, '0');
    uaAppendImagePromptPackBlock_(lines, {
      heading: '【生成' + (index + 2) + '/' + total + ' H2図解】',
      type: 'H2_SECTION',
      displayIndex: number,
      targetHeading: target.heading,
      title: '',
      visualPrompt: uaCleanImagePlanText_(sectionPlan.visual_prompt, 500)
        || 'H2「' + target.heading + '」の判断材料を、主役と2〜3個の具体的な視覚要素で直感的に理解できる1枚のブログ図解として描く。本文や見出し全文は画像内へ転載しない。',
      composition: uaCleanImagePlanText_(sectionPlan.composition, 240)
        || uaPickGeneratedImageLayout_({ role: 'h2', displayIndex: number }),
      shortLabel: uaNormalizeImagePlanLabel_(sectionPlan.short_label),
      avoid: uaCleanImagePlanText_(sectionPlan.avoid, 220)
    });
  });

  return lines.join('\n').trim();
}

function uaFindImageSectionPlan_(sectionPlans, heading, fallbackIndex) {
  const normalizedHeading = uaNormalizeHeadingText_(heading);
  return (sectionPlans || []).find(function(item) {
    return uaNormalizeHeadingText_(item && item.heading || '') === normalizedHeading;
  }) || sectionPlans[fallbackIndex] || {};
}

function uaAppendImagePromptPackBlock_(lines, block) {
  lines.push(block.heading);
  lines.push('画像タイプ: ' + block.type);
  lines.push('表示番号: ' + block.displayIndex + '（画像の右下に小さく、安全な余白を取って入れる）');
  if (block.title) lines.push('記事タイトル: ' + block.title);
  if (block.targetHeading) lines.push('対象H2: ' + block.targetHeading);
  lines.push('画像生成プロンプト: ' + block.visualPrompt);
  lines.push('構図: ' + block.composition);
  lines.push(block.shortLabel
    ? '画像内テキスト: 「' + block.shortLabel + '」だけを一字も省略せず入れる。'
    : '画像内テキスト: なし。日本語の見出しや説明文を描かない。');
  if (block.avoid) lines.push('この画像で避けるもの: ' + block.avoid);
  lines.push('');
}

function uaNormalizeImagePlanLabel_(value) {
  const label = uaNormalizeHeadingText_(value).replace(/[「」『』]/g, '').trim();
  if (label.length < 4 || label.length > 20) return '';
  return label;
}

function uaCleanImagePlanText_(value, maxLength) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text || text.length <= maxLength) return text;
  const clipped = text.slice(0, maxLength);
  const boundary = Math.max(
    clipped.lastIndexOf('。'),
    clipped.lastIndexOf('！'),
    clipped.lastIndexOf('？')
  );
  return boundary >= Math.floor(maxLength * 0.55)
    ? clipped.slice(0, boundary + 1).trim()
    : clipped.trim();
}

function uaGenerateWpImagesFromPanel(data) {
  uaSaveActiveRowData(data || {});

  const sheet = uaGetSheetForData_(data || {});
  const row = Number(data && data.row) || sheet.getActiveCell().getRow();
  const rowData = uaBuildRowData_(sheet, row);
  rowData.imageStylePreset = data && data.imageStylePreset;
  rowData.imageStylePrompt = data && data.imageStylePrompt;
  rowData.imagePromptPack = data && data.imagePromptPack;
  const appConfig = uaGetAppConfigByLabel_(rowData.appType);

  if (!appConfig) {
    throw new Error('記事タイプを取得できません。');
  }

  if (!appConfig.useWordPress) {
    throw new Error('この記事タイプはWordPress画像追加の対象外です。');
  }

  if (!rowData.body) {
    throw new Error('本文が空です。先に本文を生成してください。');
  }

  const provider = uaGetImageProvider_();
  if (provider !== 'openai' && provider !== 'gemini') {
    throw new Error('Unsupported image generation API: ' + provider);
  }

  const tasks = uaBuildGeneratedImageTasks_(rowData);
  if (tasks.length === 0) {
    throw new Error('画像化できる見出しが見つかりませんでした。');
  }

  const wpConfig = uaGetWpConfig_(appConfig);
  const title = uaPickWpTitle_(rowData.titleIdeas) || rowData.mainInput || '記事画像';
  const uploaded = [];
  const failures = [];
  let body = String(rowData.body || '');
  let featuredMediaId = 0;
  let insertedCount = 0;
  let wpUpdated = false;
  const postId = Number(rowData.wpPostId || 0);
  const existingWpPost = uaTryFetchGeneratedImageWpPost_(wpConfig, postId);
  const existingFeaturedMediaId = Number(existingWpPost && existingWpPost.featured_media || 0);
  rowData.existingWpBody = existingWpPost ? uaGetWpPostContentText_(existingWpPost) : '';
  if (existingFeaturedMediaId > 0) {
    featuredMediaId = existingFeaturedMediaId;
  }

  const pendingTasks = uaFilterPendingGeneratedImageTasks_(tasks, rowData, existingFeaturedMediaId);
  const batchSize = Math.max(1, Math.min(2, Number(data && data.imageBatchSize) || 1));
  const selectedTasks = pendingTasks.slice(0, batchSize);

  if (!selectedTasks.length) {
    const nextData = uaBuildRowData_(sheet, row);
    nextData.imageHasMore = false;
    nextData.message = '画像生成は完了済みです。';
    return nextData;
  }

  selectedTasks.forEach(function(task, batchIndex) {
    const index = Number(task.originalIndex || batchIndex);
    let generated;
    try {
      generated = uaGenerateImageForTask_(task, rowData, provider);
    } catch (e) {
      failures.push(uaBuildGeneratedImageFailure_('画像API生成', task, index, e));
      uaTrySaveGeneratedImageCheckpoint_(sheet, row, rowData, body, uploaded, provider, failures);
      return;
    }

    let media;
    try {
      media = uaUploadWpImageBytes_(
        wpConfig,
        generated.bytes,
        generated.contentType || 'image/png',
        '',
        task.alt || title,
        index + 1
      );
    } catch (e) {
      failures.push(uaBuildGeneratedImageFailure_('WordPressメディアアップロード', task, index, e));
      uaTrySaveGeneratedImageCheckpoint_(sheet, row, rowData, body, uploaded, provider, failures);
      return;
    }

    media.role = task.role;
    media.heading = task.heading || '';
    media.model = generated.model || '';
    uploaded.push(media);

    if (task.role === 'eyecatch') {
      featuredMediaId = media.id || featuredMediaId;
      const wpFailure = uaTryUpdateGeneratedImagesCheckpoint_(wpConfig, postId, body, featuredMediaId, uploaded);
      if (wpFailure) {
        failures.push(uaBuildGeneratedImageFailure_('WordPress途中反映', task, index, wpFailure, media));
      } else if (postId > 0) {
        wpUpdated = true;
      }
      uaTrySaveGeneratedImageCheckpoint_(sheet, row, rowData, body, uploaded, provider, failures);
      return;
    }

    let nextBody;
    try {
      nextBody = uaInsertWpImageAfterHeading_(body, task.heading, media);
    } catch (e) {
      failures.push(uaBuildGeneratedImageFailure_('本文への画像ブロック差し込み', task, index, e, media));
      uaTrySaveGeneratedImageCheckpoint_(sheet, row, rowData, body, uploaded, provider, failures);
      return;
    }
    if (nextBody !== body) {
      body = nextBody;
      insertedCount++;
    }
    const wpFailure = uaTryUpdateGeneratedImagesCheckpoint_(wpConfig, postId, body, featuredMediaId, uploaded);
    if (wpFailure) {
      failures.push(uaBuildGeneratedImageFailure_('WordPress途中反映', task, index, wpFailure, media));
    } else if (postId > 0) {
      wpUpdated = true;
    }
    uaTrySaveGeneratedImageCheckpoint_(sheet, row, rowData, body, uploaded, provider, failures);
  });

  try {
    sheet.getRange(row, UA_COLUMNS.body).setValue(body);
    sheet.getRange(row, UA_COLUMNS.structureMemo).setValue(uaAppendGeneratedImageMemo_(rowData.structureMemo, uploaded, provider, failures));
  } catch (e) {
    uaThrowGeneratedImageStageError_('スプレッドシートへの保存', null, -1, e);
  }

  if (postId > 0) {
    try {
      uaUpdateWpPostWithImages_(wpConfig, postId, body, featuredMediaId, uploaded);
      wpUpdated = true;
    } catch (e) {
      failures.push(uaBuildGeneratedImageFailure_('WordPress投稿本文更新', null, -1, e));
      try {
        sheet.getRange(row, UA_COLUMNS.structureMemo).setValue(uaAppendGeneratedImageMemo_(rowData.structureMemo, uploaded, provider, failures));
      } catch (saveError) {
        uaThrowGeneratedImageStageError_('WordPress投稿本文更新＋失敗メモ保存', null, -1, saveError);
      }
    }
  }

  if (uploaded.length === 0 && failures.length > 0) {
    throw new Error('画像生成→WP差し込み / 成功画像なし: ' + uaBuildGeneratedImageFailureSummary_(failures));
  }

  const nextData = uaBuildRowData_(sheet, row);
  const stillPendingCount = Math.max(0, pendingTasks.length - selectedTasks.length);
  nextData.imageHasMore = uploaded.length > 0 && stillPendingCount > 0;
  nextData.imageRemainingCount = stillPendingCount;
  nextData.imageProcessedThisRun = uploaded.length;
  nextData.imagePendingBefore = pendingTasks.length;
  nextData.imageBatchSize = batchSize;
  nextData.imagePromptPack = data && data.imagePromptPack || '';
  const wpPart = postId > 0
    ? (wpUpdated ? 'WordPress下書きも更新しました。' : 'WordPress下書き更新は失敗しました。生成済み画像の詳細は構成メモに残しました。')
    : '本文に差し込みました。WP下書き作成前の場合、アイキャッチ設定は下書き作成後に手動確認してください。';
  const continuePart = nextData.imageHasMore ? ' 残り' + stillPendingCount + '件を続けて処理します。' : '';
  const failurePart = failures.length ? ' 失敗: ' + failures.length + '件（詳細は構成メモに残しました: ' + uaBuildGeneratedImageFailureSummary_(failures) + '）' : '';
  nextData.message = '画像を' + uploaded.length + '件生成し、本文へ' + insertedCount + '件差し込みました。' + wpPart + continuePart + failurePart;
  return nextData;
}

function uaFilterPendingGeneratedImageTasks_(tasks, rowData, existingFeaturedMediaId) {
  const body = [rowData && rowData.body || '', rowData && rowData.existingWpBody || ''].join('\n');
  const memo = String(rowData && rowData.structureMemo || '');
  return (tasks || []).map(function(task, index) {
    const nextTask = {};
    Object.keys(task || {}).forEach(function(key) {
      nextTask[key] = task[key];
    });
    nextTask.originalIndex = index;
    return nextTask;
  }).filter(function(task) {
    if (task.role === 'eyecatch') {
      return !(Number(existingFeaturedMediaId || 0) > 0 || memo.indexOf('eyecatch:') !== -1);
    }
    return !uaIsGeneratedImageHeadingCompleted_(body, memo, task.heading);
  });
}

function uaIsGeneratedImageHeadingCompleted_(bodyHtml, memo, heading) {
  const cleanHeading = uaNormalizeHeadingText_(heading);
  if (!cleanHeading) return false;

  const body = String(bodyHtml || '');
  const h2Regex = /<h2\b[^>]*>([\s\S]*?)<\/h2>/gi;
  let match;

  while ((match = h2Regex.exec(body)) !== null) {
    const currentHeading = uaNormalizeHeadingText_(match[0]);
    if (currentHeading !== cleanHeading) continue;
    const nextH2 = body.slice(h2Regex.lastIndex).search(/<h2\b/i);
    const sectionHtml = nextH2 >= 0
      ? body.slice(h2Regex.lastIndex, h2Regex.lastIndex + nextH2)
      : body.slice(h2Regex.lastIndex);
    if (sectionHtml.indexOf('wp-block-image') !== -1 || sectionHtml.indexOf('<!-- wp:image') !== -1 || /wp-image-\d+/.test(sectionHtml)) {
      return true;
    }
  }

  return String(memo || '').indexOf('H2: ' + cleanHeading + ' |') !== -1;
}

function uaTryFetchGeneratedImageWpPost_(wpConfig, postId) {
  if (!(postId > 0)) return null;
  try {
    return uaFetchWpPostForEdit_(wpConfig, postId);
  } catch (e) {
    Logger.log('Generated image existing WP post fetch failed: ' + (e && e.message ? e.message : e));
    return null;
  }
}

function uaTrySaveGeneratedImageCheckpoint_(sheet, row, rowData, body, uploaded, provider, failures) {
  try {
    sheet.getRange(row, UA_COLUMNS.body).setValue(body);
    sheet.getRange(row, UA_COLUMNS.structureMemo).setValue(uaAppendGeneratedImageMemo_(rowData.structureMemo, uploaded, provider, failures));
  } catch (e) {
    Logger.log('Generated image checkpoint save failed: ' + (e && e.message ? e.message : e));
  }
}

function uaTryUpdateGeneratedImagesCheckpoint_(wpConfig, postId, body, featuredMediaId, uploaded) {
  if (!(postId > 0) || !(uploaded || []).length) return null;
  try {
    uaUpdateWpPostWithImages_(wpConfig, postId, body, featuredMediaId, uploaded);
    return null;
  } catch (e) {
    return e;
  }
}

function uaBuildGeneratedImageFailure_(stage, task, index, error, media) {
  const message = error && error.message ? error.message : String(error || '');
  return {
    stage: stage,
    target: uaDescribeGeneratedImageTask_(task, index),
    message: message,
    mediaId: media && media.id || '',
    mediaUrl: media && media.url || ''
  };
}

function uaBuildGeneratedImageFailureSummary_(failures) {
  return (failures || []).map(function(failure) {
    return failure.stage + ' / ' + failure.target + ': ' + failure.message;
  }).join(' | ').slice(0, 700);
}

function uaThrowGeneratedImageStageError_(stage, task, index, error) {
  const message = error && error.message ? error.message : String(error || '');
  const target = uaDescribeGeneratedImageTask_(task, index);
  throw new Error('画像生成→WP差し込み / ' + stage + ' / ' + target + ': ' + message);
}

function uaDescribeGeneratedImageTask_(task, index) {
  if (!task) {
    return '全体処理';
  }

  const number = index >= 0 ? String(index + 1) + '枚目' : '対象不明';

  if (task.role === 'eyecatch') {
    return number + ' アイキャッチ';
  }

  return number + ' H2「' + String(task.heading || '').slice(0, 80) + '」';
}

function uaGenerateImageForTask_(task, rowData, provider) {
  const prompt = task.promptOverride || uaBuildGeneratedImagePrompt_(task, rowData);
  if (provider === 'openai') {
    return uaCallOpenAiImage_(prompt, {
      size: '1536x1024',
      quality: 'high'
    });
  }
  if (provider === 'gemini') {
    return uaCallGeminiImage_(prompt, {
      aspectRatio: '16:9'
    });
  }

  throw new Error('Unsupported image generation API: ' + provider);
}

function uaBuildGeneratedImageTasks_(rowData) {
  const title = uaPickWpTitle_(rowData.titleIdeas) || rowData.mainInput || '記事';
  const sections = uaExtractImageSectionsFromBody_(rowData.body);
  const picked = uaPickGeneratedImageSections_(sections);
  const imageLimit = uaResolveGeneratedImageLimit_(rowData, sections, picked);
  const promptPackTasks = uaBuildGeneratedImageTasksFromPromptPack_(rowData, title, sections, imageLimit);

  if (promptPackTasks.length) {
    return promptPackTasks;
  }

  const tasks = [{
    role: 'eyecatch',
    heading: '',
    rank: 'S',
    alt: title,
    title: title,
    displayIndex: '00'
  }];

  picked.forEach(function(section, index) {
    if (tasks.length >= imageLimit) return;
    tasks.push({
      role: 'h2',
      heading: section.heading,
      text: section.text,
      rank: section.rank,
      alt: section.heading,
      title: title,
      displayIndex: String(index + 1).padStart(2, '0')
    });
  });

  return tasks.slice(0, imageLimit);
}

function uaBuildGeneratedImageTasksFromPromptPack_(rowData, title, sections, imageLimit) {
  const promptPack = String(rowData && rowData.imagePromptPack || '').trim();
  if (!promptPack) return [];

  const blocks = uaParseImagePromptPackBlocks_(promptPack);
  if (!blocks.length) return [];

  const tasks = [];
  const eyecatchBlock = blocks.find(function(block) {
    return block.type === 'eyecatch';
  });

  if (eyecatchBlock) {
    tasks.push({
      role: 'eyecatch',
      heading: '',
      rank: 'S',
      alt: title,
      title: title,
      displayIndex: '00',
      promptOverride: uaBuildGeneratedImagePromptFromPromptPackBlock_(eyecatchBlock, rowData, title, null)
    });
  }

  blocks.filter(function(block) {
    return block.type === 'h2';
  }).forEach(function(block) {
    if (tasks.length >= imageLimit) return;
    const section = uaFindPromptPackSection_(block, sections);
    if (!section) return;
    tasks.push({
      role: 'h2',
      heading: section.heading,
      text: section.text,
      rank: section.rank,
      alt: section.heading,
      title: title,
      displayIndex: String(tasks.length).padStart(2, '0'),
      promptOverride: uaBuildGeneratedImagePromptFromPromptPackBlock_(block, rowData, title, section)
    });
  });

  return tasks.slice(0, imageLimit);
}

function uaParseImagePromptPackBlocks_(promptPack) {
  const lines = String(promptPack || '').split(/\r?\n/);
  const blocks = [];
  let current = null;

  lines.forEach(function(line) {
    const headingMatch = line.match(/^\s*【[^\r\n]*(アイキャッチ|H2図解)[^\r\n]*】\s*$/);
    if (headingMatch) {
      current = {
        type: headingMatch[1] === 'アイキャッチ' ? 'eyecatch' : 'h2',
        lines: [line]
      };
      blocks.push(current);
      return;
    }

    if (line.indexOf('EYECATCH') !== -1 || line.indexOf('H2_SECTION') !== -1) {
      const type = line.indexOf('EYECATCH') !== -1 ? 'eyecatch' : 'h2';
      if (!current || current.type !== type || current.lines.some(function(value) {
        return value.indexOf('EYECATCH') !== -1 || value.indexOf('H2_SECTION') !== -1;
      })) {
        current = {
          type: type,
          lines: []
        };
        blocks.push(current);
      }
    }

    if (current) {
      current.lines.push(line);
    }
  });

  return blocks.map(function(block) {
    return {
      type: block.type,
      text: block.lines.join('\n').trim()
    };
  }).filter(function(block) {
    return block.text;
  });
}

function uaFindPromptPackSection_(block, sections) {
  const blockText = String(block && block.text || '');
  const normalizedBlock = uaNormalizeHeadingText_(blockText);
  const promptHeading = uaExtractPromptPackHeading_(blockText);
  const normalizedPromptHeading = uaNormalizeHeadingText_(promptHeading);

  return (sections || []).find(function(section) {
    const heading = String(section && section.heading || '');
    const normalizedHeading = uaNormalizeHeadingText_(heading);
    return (heading && blockText.indexOf(heading) !== -1)
      || (normalizedHeading && normalizedBlock.indexOf(normalizedHeading) !== -1)
      || (normalizedPromptHeading && normalizedHeading === normalizedPromptHeading);
  }) || null;
}

function uaExtractPromptPackHeading_(blockText) {
  const match = String(blockText || '').match(/(?:対象H2|H2 heading|H2)\s*[:：]\s*([^\r\n]+)/i);
  return match ? match[1].trim() : '';
}

function uaBuildGeneratedImagePromptFromPromptPackBlock_(block, rowData, title, section) {
  const textTask = {
    role: section ? 'h2' : 'eyecatch',
    title: title,
    heading: section && section.heading || ''
  };
  const blockText = String(block && block.text || '');
  const explicitLabel = uaExtractImagePromptPackLabel_(blockText);
  const explicitlyNoLabel = /^\s*(?:画像内テキスト|Image text|Short label)\s*[:：]\s*(?:なし|none)(?:\s|[。.、]|$)/im.test(blockText);
  const shortLabel = explicitlyNoLabel
    ? ''
    : (explicitLabel || uaBuildGeneratedImageShortLabel_(textTask, rowData));
  const common = [
    'Create one high-quality 16:9 Japanese blog illustration from the approved prompt block below.',
    'Use this prompt block as the source of truth for the target, composition, and visual intent.',
    'Create only one image for this block, not a collage or prompt sheet.',
    'Keep it useful for reader comprehension and suitable for WordPress article insertion.',
    'Avoid real brand logos, exact product packaging, UI screenshots, celebrity faces, watermarks, and messy text.',
    'Use the article title only as visual context. Never render the full article title in the image.',
    'Never crop, abbreviate, or stop Japanese text in the middle of a word or phrase.',
    'Keep every character and the main subject inside the central safe area with at least 15 percent margin on all sides, so a 16:9 WordPress crop cannot cut them off.',
    'Article title: ' + title
  ];

  if (shortLabel) {
    common.push('Render exactly this Japanese label and no other Japanese wording: "' + shortLabel + '".');
    common.push('The label is complete. Do not omit any character. Use one or two lines and break only at a natural phrase boundary.');
  } else {
    common.push('Do not render Japanese words, sentences, captions, or headings in this image.');
  }

  if (section && section.heading) {
    common.push('Insert target H2 heading: ' + section.heading);
  }

  const styleInstruction = uaBuildGeneratedImageStyleInstruction_(rowData);
  if (styleInstruction) {
    common.push('Style direction: ' + styleInstruction);
  }

  common.push('Approved prompt block:');
  common.push(uaSanitizeImagePromptPackBlock_(block && block.text || '').slice(0, 3500));
  return common.join('\n');
}

function uaSanitizeImagePromptPackBlock_(blockText) {
  return String(blockText || '').split(/\r?\n/).filter(function(line) {
    return !/^\s*(?:画像内テキスト|Image text|Short label)\s*[:：]/i.test(line);
  }).join('\n').trim();
}

function uaExtractImagePromptPackLabel_(blockText) {
  const lineMatch = String(blockText || '').match(/^\s*(?:画像内テキスト|Image text|Short label)\s*[:：]\s*([^\r\n]+)/im);
  if (!lineMatch) return '';
  const quoted = lineMatch[1].match(/[「"]([^」"]+)[」"]/);
  return uaNormalizeImagePlanLabel_(quoted ? quoted[1] : lineMatch[1]);
}

function uaResolveGeneratedImageLimit_(rowData, sections, pickedSections) {
  const plainBody = uaNormalizeHeadingText_(rowData && rowData.body || '');
  const bodyLength = plainBody.length;
  const h2Count = (sections || []).length;
  const picked = pickedSections || [];
  const highNeedCount = picked.filter(function(section) {
    return section.rank === 'A';
  }).length;
  let limit = 3;

  if (bodyLength < 3000 || h2Count <= 3) {
    limit = 2;
  }

  if (bodyLength >= 5500 || h2Count >= 5 || highNeedCount >= 2) {
    limit = 3;
  }

  if ((bodyLength >= 9000 && h2Count >= 7) || highNeedCount >= 4) {
    limit = 4;
  }

  if (bodyLength >= 13000 && h2Count >= 9 && highNeedCount >= 5) {
    limit = 5;
  }

  return Math.max(1, Math.min(UA_GENERATED_IMAGE_MAX_ITEMS, limit));
}

function uaExtractImageSectionsFromBody_(bodyHtml) {
  const body = String(bodyHtml || '');
  const h2Regex = /<h2\b[^>]*>([\s\S]*?)<\/h2>/gi;
  const matches = [];
  let match;

  while ((match = h2Regex.exec(body)) !== null) {
    const heading = uaNormalizeHeadingText_(match[0]);
    if (!heading) continue;
    matches.push({
      heading: heading,
      index: match.index
    });
  }

  return matches.map(function(item, index) {
    const next = matches[index + 1];
    const sectionHtml = body.slice(item.index, next ? next.index : body.length);
    return {
      heading: item.heading,
      text: uaNormalizeHeadingText_(sectionHtml).slice(0, 900),
      rank: uaClassifyGeneratedImageNeed_(item.heading + '\n' + sectionHtml)
    };
  });
}

function uaClassifyGeneratedImageNeed_(text) {
  const normalized = String(text || '').toLowerCase();
  if (/比較|手順|流れ|選び方|チェック|ポイント|一覧|違い|メリット|デメリット|原因|対策|例/.test(normalized)) {
    return 'A';
  }
  if (/まとめ|faq|よくある質問|注意点|口コミ|レビュー/.test(normalized)) {
    return 'C';
  }
  return 'B';
}

function uaPickGeneratedImageSections_(sections) {
  return (sections || [])
    .filter(function(section) {
      return section.rank !== 'C';
    })
    .sort(function(a, b) {
      const score = { A: 0, B: 1, C: 2 };
      return (score[a.rank] || 9) - (score[b.rank] || 9);
    });
}

function uaBuildGeneratedImagePrompt_(task, rowData) {
  const baseTitle = task.title || uaPickWpTitle_(rowData.titleIdeas) || rowData.mainInput || '記事';
  const layout = uaPickGeneratedImageLayout_(task);
  const shortLabel = uaBuildGeneratedImageShortLabel_(task, rowData);
  const common = [
    'Create one high-quality 16:9 Japanese blog illustration for an article.',
    'Make it useful for reader comprehension, not a generic decorative stock image.',
    'Use a clear editorial infographic-like composition with depth, natural lighting, polished details, and a professional web media finish.',
    'Avoid real brand logos, exact product packaging, UI screenshots, celebrity faces, watermarks, and messy text.',
    'Use the article title only as visual context. Never render the full article title in the image.',
    'Never crop, abbreviate, or stop Japanese text in the middle of a word or phrase.',
    'Keep every character and the main subject inside the central safe area with at least 15 percent margin on all sides, so a 16:9 WordPress crop cannot cut them off.',
    'Place the small display number "' + (task.displayIndex || '') + '" near the lower-right while keeping it safely inset from the edge.',
    'Use a different composition, subject, angle, and main visual motif from the other images in the same article.',
    'Article title: ' + baseTitle,
    'Suggested composition: ' + layout
  ];

  if (shortLabel) {
    common.push('Render exactly this Japanese label and no other Japanese wording: "' + shortLabel + '".');
    common.push('The label is complete. Do not omit any character. Use one or two lines and break only at a natural phrase boundary.');
  } else {
    common.push('Do not render Japanese words, sentences, captions, or headings in this image.');
  }

  if (task.role === 'eyecatch') {
    common.push('Purpose: eye-catch image for the whole article.');
    common.push('Visualize the main benefit, reader problem, and solution direction of the article as a broad first impression.');
    common.push('Image type: EYECATCH');
  } else {
    common.push('Purpose: supporting image inserted immediately after this H2 heading.');
    common.push('Image type: H2_SECTION');
    common.push('H2 heading: ' + task.heading);
    common.push('Section summary: ' + String(task.text || '').slice(0, 900));
    common.push('Visual role: help the reader understand the section before reading it, by showing the situation, comparison, checklist, flow, causes, or solution elements visually.');
  }

  if (rowData.mainInput) {
    common.push('Main keyword or brief: ' + rowData.mainInput);
  }

  const styleInstruction = uaBuildGeneratedImageStyleInstruction_(rowData);
  if (styleInstruction) {
    common.push('Style direction: ' + styleInstruction);
  }

  return common.join('\n');
}

function uaPickGeneratedImageLayout_(task) {
  const layouts = [
    'left-right comparison between confusion/problem and clear solution',
    'central main object with three surrounding check points shown as simple icons',
    'three-step flow from problem to confirmation to solution',
    'card-like breakdown of cost, condition, and decision factors',
    'cause-to-countermeasure diagram connected by clean arrows',
    'diagonal checklist composition with practical items arranged for scanning'
  ];
  if (task && task.role === 'eyecatch') {
    return 'wide hero composition with a large symbolic main subject in the center and subtle problem/solution elements around it';
  }
  const index = Math.max(0, Number(task && task.displayIndex || 1) - 1);
  return layouts[index % layouts.length];
}

function uaBuildGeneratedImageShortLabel_(task, rowData) {
  const required = !!(task && task.role === 'eyecatch');
  const preferred = required
    ? String(rowData && rowData.mainInput || '')
    : String(task && task.heading || '');
  const fallback = required
    ? String(task && task.title || '')
    : String(rowData && rowData.mainInput || '');
  return uaBuildNaturalGeneratedImageLabel_(preferred, fallback, required);
}

function uaBuildNaturalGeneratedImageLabel_(preferred, fallback, required) {
  const maxLength = 20;
  const sources = [preferred, fallback];

  for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex++) {
    const cleaned = uaNormalizeHeadingText_(sources[sourceIndex])
      .replace(/^案\s*\d+\s*[:：・\-]?\s*/i, '')
      .replace(/[「」『』【】\[\]（）()]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleaned) continue;
    if (cleaned.length <= maxLength) return cleaned;

    const clauses = cleaned.split(/[｜|／/:：!?！？。、]/).map(function(value) {
      return value.trim();
    }).filter(Boolean);
    const completeClause = clauses.find(function(value) {
      return value.length >= 3 && value.length <= maxLength;
    });
    if (completeClause) return completeClause;

    const words = cleaned.split(/[\s　]+/).filter(Boolean);
    let joined = '';
    words.forEach(function(word) {
      const candidate = joined ? joined + ' ' + word : word;
      if (candidate.length <= maxLength) joined = candidate;
    });
    if (joined) return joined;
  }

  if (!required) return '';
  const context = String(preferred || '') + ' ' + String(fallback || '');
  if (/後悔|失敗|がっかり/.test(context)) return '後悔しないための要点';
  if (/比較|違い/.test(context)) return '違いをわかりやすく比較';
  if (/費用|価格|料金|いくら/.test(context)) return '費用と条件をチェック';
  if (/安全|雪道|事故|注意/.test(context)) return '安全のための確認ポイント';
  if (/手順|方法|やり方/.test(context)) return '手順をわかりやすく解説';
  if (/おすすめ|選び方/.test(context)) return '失敗しない選び方';
  return '知っておきたいポイント';
}

function uaBuildGeneratedImageStyleInstruction_(rowData) {
  const preset = String(rowData && rowData.imageStylePreset || '').trim();
  const custom = String(rowData && rowData.imageStylePrompt || '').trim();
  const presetMap = {
    latestAnime: 'modern high-quality Japanese anime key visual style, clean line art, polished lighting, vivid but tasteful colors, article-friendly composition',
    softFree: 'soft royalty-free stock illustration style, gentle colors, rounded shapes, friendly non-branded web media look, practical and approachable',
    custom: ''
  };
  const parts = [];

  if (preset && presetMap[preset]) {
    parts.push(presetMap[preset]);
  }

  if ((preset === 'custom' || !preset) && custom) {
    parts.push(custom.slice(0, 500));
  }

  return parts.join('. ');
}

function uaAppendGeneratedImageMemo_(currentMemo, uploaded, provider, failures) {
  const lines = [
    '【画像生成メモ】',
    'provider: ' + provider,
    'model: ' + uaGetSelectedImageModelLabel_(),
    'generatedAt: ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss')
  ];

  (uploaded || []).forEach(function(media) {
    if (media.role === 'eyecatch') {
      lines.push('eyecatch: ' + media.url);
    } else {
      lines.push('H2: ' + media.heading + ' | ' + media.url);
    }
  });

  if ((failures || []).length) {
    lines.push('failures:');
    failures.forEach(function(failure) {
      const mediaPart = failure.mediaId || failure.mediaUrl
        ? ' | mediaId: ' + (failure.mediaId || '') + ' | mediaUrl: ' + (failure.mediaUrl || '')
        : '';
      lines.push('- ' + failure.stage + ' / ' + failure.target + ': ' + failure.message + mediaPart);
    });
  }

  return [String(currentMemo || '').trim(), lines.join('\n')].filter(Boolean).join('\n\n');
}
