const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// 2026-09-05: 「お宝キーワード」自動発掘機能（keyword_discovery.gs）のテスト。
// 元は keyword_research_app/（トレファイ連携用のローカルPython製スタンドアロン
// アプリ）にあったドメイン分類・スコアリングのロジックを、この統合版アプリ
// （Google Apps Script、クラウド側）に移植したもの。ドメインリストは
// keyword_research_app/data/target_sites.json を踏襲している。

function freshContext() {
  const configSource = fs.readFileSync(path.join(__dirname, 'unified_article_app', 'config.gs'), 'utf8');
  const utilsSource = fs.readFileSync(path.join(__dirname, 'unified_article_app', 'utils.gs'), 'utf8');
  const linksSource = fs.readFileSync(path.join(__dirname, 'unified_article_app', 'links.gs'), 'utf8');
  const articleSource = fs.readFileSync(path.join(__dirname, 'unified_article_app', 'article.gs'), 'utf8');
  const keywordDiscoverySource = fs.readFileSync(path.join(__dirname, 'unified_article_app', 'keyword_discovery.gs'), 'utf8');
  const context = { console };
  vm.createContext(context);
  vm.runInContext(configSource, context);
  vm.runInContext(utilsSource, context);
  vm.runInContext(linksSource, context);
  vm.runInContext(articleSource, context);
  vm.runInContext(keywordDiscoverySource, context);
  // main.gs's uaApplyCandidateSheetRules_ does heavy real-sheet formatting
  // (conditional format rules, data validation) unrelated to this feature's
  // own logic -- stub it so tests stay focused on keyword_discovery.gs itself.
  context.uaApplyCandidateSheetRules_ = function () {};
  // uaGetSerperApiKey_ lives in outline.gs, which this file doesn't load
  // (unrelated dependencies) -- stub it directly.
  context.uaGetSerperApiKey_ = function () { return 'test-serper-key'; };
  // uaGetAppConfigByLabel_ lives in main.gs, which this file doesn't load
  // (unrelated dependencies) -- stub it directly using the real UA_APP_TYPES.
  context.uaGetAppConfigByLabel_ = function (label) {
    const cleanLabel = String(label || '').trim();
    const appTypes = vm.runInContext('UA_APP_TYPES', context);
    const keys = Object.keys(appTypes);
    for (let i = 0; i < keys.length; i++) {
      const config = appTypes[keys[i]];
      if (config.label === cleanLabel || config.key === cleanLabel) return config;
    }
    return null;
  };
  return context;
}

const homeConfig = { key: 'home', label: 'たくみパパ' };
const driveConfig = { key: 'drive', label: 'DRIVE BASE' };

// 1) uaClassifyTreasureDomain_: domain classification matches the ported
// target_sites.json lists.
{
  const context = freshContext();
  const uaClassifyTreasureDomain_ = vm.runInContext('uaClassifyTreasureDomain_', context);
  assert.strictEqual(uaClassifyTreasureDomain_('https://detail.chiebukuro.yahoo.co.jp/qa/question_detail/q123', homeConfig), 'qa_site', '知恵袋はQ&Aサイト');
  assert.strictEqual(uaClassifyTreasureDomain_('https://hatenablog.com/entry/abc', homeConfig), 'free_blog', 'はてなブログは無料ブログ');
  assert.strictEqual(uaClassifyTreasureDomain_('https://ameblo.jp/someuser/entry-1.html', homeConfig), 'free_blog', 'アメブロは無料ブログ');
  assert.strictEqual(uaClassifyTreasureDomain_('https://x.com/someuser/status/1', homeConfig), 'sns', 'XはSNS');
  assert.strictEqual(uaClassifyTreasureDomain_('https://www.amazon.co.jp/dp/B000123', homeConfig), 'strong_domain', 'Amazonは強いドメイン（www.付きでも判定できる）');
  assert.strictEqual(uaClassifyTreasureDomain_('https://www.nitori-net.jp/ec/item/123', homeConfig), 'strong_domain', 'たくみパパ設定ではニトリネットも強いドメイン');
  assert.strictEqual(uaClassifyTreasureDomain_('https://www.nitori-net.jp/ec/item/123', driveConfig), 'other', 'DRIVE BASE設定ではニトリネットはジャンル特化の強いドメインに含まれない');
  assert.strictEqual(uaClassifyTreasureDomain_('https://www.toyota.jp/models/', driveConfig), 'strong_domain', 'DRIVE BASE設定ではトヨタ公式は強いドメイン');
  assert.strictEqual(uaClassifyTreasureDomain_('https://example-personal-blog.com/entry/1', homeConfig), 'other', '未知のドメインはotherとして扱う（個人ブログの可能性込みで中立）');
}

// 2) uaRankScoreForWeakSignal_: rank tiers.
{
  const context = freshContext();
  const uaRankScoreForWeakSignal_ = vm.runInContext('uaRankScoreForWeakSignal_', context);
  assert.strictEqual(uaRankScoreForWeakSignal_(1, 40, 28, 16), 40, '1位はtopScore');
  assert.strictEqual(uaRankScoreForWeakSignal_(3, 40, 28, 16), 40, '3位までtopScore');
  assert.strictEqual(uaRankScoreForWeakSignal_(4, 40, 28, 16), 28, '4位はmidScore');
  assert.strictEqual(uaRankScoreForWeakSignal_(5, 40, 28, 16), 28, '5位までmidScore');
  assert.strictEqual(uaRankScoreForWeakSignal_(6, 40, 28, 16), 16, '6位はlowScore');
  assert.strictEqual(uaRankScoreForWeakSignal_(10, 40, 28, 16), 16, '10位までlowScore');
  assert.strictEqual(uaRankScoreForWeakSignal_(11, 40, 28, 16), 0, '11位以降は0');
  assert.strictEqual(uaRankScoreForWeakSignal_(0, 40, 28, 16), 0, '0（該当なし）は0');
}

// 3) uaScoreTreasureKeywordSerp_: end-to-end scoring against a mocked Serper response.
{
  const context = freshContext();
  context.PropertiesService = {
    getScriptProperties: () => ({
      getProperty: (key) => (key === 'UA_SERPER_API_KEY' ? 'test-serper-key' : '')
    })
  };
  context.UrlFetchApp = {
    fetch: () => ({
      getResponseCode: () => 200,
      getContentText: () => JSON.stringify({
        organic: [
          { link: 'https://detail.chiebukuro.yahoo.co.jp/qa/question_detail/q1', title: '知恵袋の質問1' },
          { link: 'https://ameblo.jp/someuser/entry-1.html', title: '個人ブログ1' },
          { link: 'https://www.example-unknown-blog.com/post', title: '謎のブログ' },
          { link: 'https://www.amazon.co.jp/dp/B000123', title: 'Amazon商品ページ' },
          { link: 'https://www.rakuten.co.jp/shop/item/', title: '楽天商品ページ' }
        ]
      })
    })
  };

  const uaScoreTreasureKeywordSerp_ = vm.runInContext('uaScoreTreasureKeywordSerp_', context);
  const result = uaScoreTreasureKeywordSerp_('ランドリーチェスト カビ', homeConfig);

  assert.strictEqual(result.qaCount, 1, '知恵袋1件を検出');
  assert.strictEqual(result.freeBlogCount, 1, 'アメブロ1件を検出');
  assert.strictEqual(result.strongCount, 2, 'Amazon・楽天の2件を強いドメインとして検出');
  assert.ok(result.score > 0, '弱いサイトが上位にあるのでスコアはプラスになる');
  assert.ok(['かなり狙い目', '狙いやすい', '要検討', '厳しい'].indexOf(result.level) !== -1, '判定レベルが4段階のいずれかになる');
  assert.ok(result.weakUrls.indexOf('https://detail.chiebukuro.yahoo.co.jp/qa/question_detail/q1') !== -1, '弱いURL一覧に知恵袋のURLが含まれる');
}

// 3b) All-strong-domain SERP must score low ("厳しい").
{
  const context = freshContext();
  context.PropertiesService = {
    getScriptProperties: () => ({ getProperty: () => 'test-serper-key' })
  };
  context.UrlFetchApp = {
    fetch: () => ({
      getResponseCode: () => 200,
      getContentText: () => JSON.stringify({
        organic: [
          { link: 'https://www.amazon.co.jp/dp/B1', title: 'A' },
          { link: 'https://www.rakuten.co.jp/shop/1/', title: 'B' },
          { link: 'https://kakaku.com/item/1', title: 'C' }
        ]
      })
    })
  };
  const uaScoreTreasureKeywordSerp_ = vm.runInContext('uaScoreTreasureKeywordSerp_', context);
  const result = uaScoreTreasureKeywordSerp_('冷蔵庫 おすすめ', homeConfig);
  assert.strictEqual(result.level, '厳しい', '強いドメインばかりのSERPは「厳しい」判定になる');
  assert.strictEqual(result.score, 0, 'スコアは0未満にはならない（下限0でクランプ）');
}

// 4) uaGenerateTreasureKeywordCandidates_: prompt content + parsing.
{
  const context = freshContext();
  let calledWith = null;
  context.uaCallGeminiJson_ = function (prompt) {
    calledWith = prompt;
    return { data: { keywords: ['ランドリーチェスト カビ', '  ', 'サンシェード 破れる'] } };
  };
  const uaGenerateTreasureKeywordCandidates_ = vm.runInContext('uaGenerateTreasureKeywordCandidates_', context);
  const keywords = uaGenerateTreasureKeywordCandidates_(homeConfig, ['既存キーワードA', '既存キーワードB'], 8);

  assert.deepStrictEqual(keywords, ['ランドリーチェスト カビ', 'サンシェード 破れる'], '空白だけの候補は除外される');
  assert.ok(calledWith.indexOf('既存キーワードA') !== -1, 'プロンプトに既存キーワードが含まれる');
  assert.ok(calledWith.indexOf('8') !== -1, 'プロンプトに生成数が含まれる');
}

// 5) uaDiscoverTreasureKeywords_: end-to-end orchestration.
{
  const context = freshContext();

  // Gemini proposes 4 keywords: one duplicate of an existing candidate, one
  // not product-linked, one with a weak (Amazon/Rakuten-only) SERP, and one
  // genuine treasure keyword.
  context.uaCallGeminiJson_ = function () {
    return {
      data: {
        keywords: [
          '既存の候補キーワード',
          '天気 今日 東京',
          'サンシェード カビ',
          'ランドリーチェスト カビ'
        ]
      }
    };
  };

  context.PropertiesService = {
    getScriptProperties: () => ({ getProperty: () => 'test-serper-key' })
  };
  context.UrlFetchApp = {
    fetch: (url, options) => {
      const payload = JSON.parse(options.payload);
      const query = payload.q;
      if (query === 'サンシェード カビ') {
        return {
          getResponseCode: () => 200,
          getContentText: () => JSON.stringify({
            organic: [
              { link: 'https://www.amazon.co.jp/dp/B1', title: 'A' },
              { link: 'https://www.rakuten.co.jp/shop/1/', title: 'B' }
            ]
          })
        };
      }
      // 'ランドリーチェスト カビ' -- weak SERP, should be kept.
      return {
        getResponseCode: () => 200,
        getContentText: () => JSON.stringify({
          organic: [
            { link: 'https://detail.chiebukuro.yahoo.co.jp/qa/question_detail/q1', title: 'Q' },
            { link: 'https://ameblo.jp/someuser/entry-1.html', title: 'B1' },
            { link: 'https://hatenablog.com/entry/2', title: 'B2' }
          ]
        })
      };
    }
  };

  function makeSheetMock(initialKeywordRows) {
    const rows = initialKeywordRows.map(function(keyword) { return ['書く', '案件無し', keyword, '']; });
    return {
      getLastRow: () => rows.length + 1, // +1 for header row
      insertRowsBefore: (beforeRow, howMany) => {
        const insertAt = beforeRow - 2; // row 2 is the first data row
        const blanks = [];
        for (let i = 0; i < howMany; i++) blanks.push(['', '', '', '']);
        rows.splice(insertAt, 0, ...blanks);
      },
      getRange: (r, c, numRows, numCols) => ({
        setValues: (values) => {
          for (let i = 0; i < values.length; i++) {
            const targetRow = r - 2 + i; // row 2 is the first data row
            rows[targetRow] = rows[targetRow] || [];
            for (let j = 0; j < values[i].length; j++) {
              rows[targetRow][c - 1 + j] = values[i][j];
            }
          }
        },
        getValues: () => {
          const out = [];
          for (let i = 0; i < numRows; i++) {
            const row = rows[r - 2 + i] || [];
            const line = [];
            for (let j = 0; j < numCols; j++) line.push(row[c - 1 + j] === undefined ? '' : row[c - 1 + j]);
            out.push(line);
          }
          return out;
        }
      }),
      _rows: rows
    };
  }

  const candidateSheet = makeSheetMock(['既存の候補キーワード']);
  const articleSheet = makeSheetMock([]);

  context.SpreadsheetApp = {
    getActiveSpreadsheet: () => ({
      getSheetByName: (name) => {
        if (name === 'たくみパパ_キーワード候補') return candidateSheet;
        if (name === 'たくみパパ') return articleSheet;
        return null;
      }
    }),
    flush: () => {}
  };

  const homeAppConfig = vm.runInContext('UA_APP_TYPES', context).home;
  const uaDiscoverTreasureKeywords_ = vm.runInContext('uaDiscoverTreasureKeywords_', context);
  const summary = uaDiscoverTreasureKeywords_(homeAppConfig);

  assert.strictEqual(summary.addedCount, 1, '4件中、採用されるのは1件だけ（お宝候補）');

  const byKeyword = {};
  summary.results.forEach(function(item) { byKeyword[item.keyword] = item; });

  assert.strictEqual(byKeyword['既存の候補キーワード'].kept, false, '既存候補と重複するものは除外される');
  assert.strictEqual(byKeyword['天気 今日 東京'].kept, false, '商品にひも付かないものは除外される');
  assert.strictEqual(byKeyword['サンシェード カビ'].kept, false, 'SERPが強いドメインだけのものは除外される');
  assert.strictEqual(byKeyword['ランドリーチェスト カビ'].kept, true, '弱いSERP構成の商品ひも付きキーワードは採用される');

  // 2026-09-05: 新しい行は一番上（見出し直下）に挿入される。
  assert.strictEqual(candidateSheet._rows.length, 2, '候補シートは既存1行+新規1行の計2行になる');
  assert.strictEqual(candidateSheet._rows[0][0], 'AI提案', '追加された行のステータスは「AI提案」（「書く」には絶対に昇格させない）');
  assert.strictEqual(candidateSheet._rows[0][2], 'ランドリーチェスト カビ', '追加された行のキーワードが正しい、かつ一番上にある');

  // Pre-existing row must remain untouched, just pushed down.
  assert.deepStrictEqual(candidateSheet._rows[1], ['書く', '案件無し', '既存の候補キーワード', ''], '既存の行はそのまま残る（下に押し出されるだけ）');
}

// 6) uaDiscoverTreasureKeywords_: cannibalization gate. A candidate that clears
// product-linkage and SERP scoring must still be rejected when it targets the
// same reader intent as an existing PUBLISHED ARTICLE, even without an exact
// string match (the cheap existingSet dedup alone would miss this).
{
  const context = freshContext();

  let geminiCallCount = 0;
  context.uaCallGeminiJson_ = function () {
    geminiCallCount++;
    if (geminiCallCount === 1) {
      // 1st call: keyword ideation.
      return { data: { keywords: ['ランドリーチェスト カビ'] } };
    }
    // 2nd call: cannibalization check.
    return {
      data: {
        results: [
          { keyword: 'ランドリーチェスト カビ', cannibalizes: true, matchedExisting: 'ランドリーチェスト 収納 おすすめ' }
        ]
      }
    };
  };

  context.PropertiesService = {
    getScriptProperties: () => ({ getProperty: () => 'test-serper-key' })
  };
  context.UrlFetchApp = {
    fetch: () => ({
      getResponseCode: () => 200,
      getContentText: () => JSON.stringify({
        organic: [
          { link: 'https://detail.chiebukuro.yahoo.co.jp/qa/question_detail/q1', title: 'Q' },
          { link: 'https://ameblo.jp/someuser/entry-1.html', title: 'B1' },
          { link: 'https://hatenablog.com/entry/2', title: 'B2' }
        ]
      })
    })
  };

  const UA_COLUMNS_ref = vm.runInContext('UA_COLUMNS', context);

  function makeArticleSheetMock(mainInputs) {
    return {
      getLastRow: () => mainInputs.length + 1,
      getRange: (r, c, numRows) => ({
        getValues: () => {
          const out = [];
          for (let i = 0; i < numRows; i++) {
            const idx = r - 2 + i;
            out.push([c === UA_COLUMNS_ref.mainInput && idx < mainInputs.length ? mainInputs[idx] : '']);
          }
          return out;
        }
      })
    };
  }

  function makeEmptyCandidateSheetMock() {
    const rows = [];
    return {
      getLastRow: () => rows.length + 1,
      insertRowsBefore: (beforeRow, howMany) => {
        const insertAt = beforeRow - 2;
        const blanks = [];
        for (let i = 0; i < howMany; i++) blanks.push(['', '', '', '']);
        rows.splice(insertAt, 0, ...blanks);
      },
      getRange: (r, c, numRows, numCols) => ({
        setValues: (values) => {
          for (let i = 0; i < values.length; i++) {
            const targetRow = r - 2 + i;
            rows[targetRow] = rows[targetRow] || [];
            for (let j = 0; j < values[i].length; j++) rows[targetRow][c - 1 + j] = values[i][j];
          }
        },
        getValues: () => {
          const out = [];
          for (let i = 0; i < numRows; i++) {
            const row = rows[r - 2 + i] || [];
            const line = [];
            for (let j = 0; j < numCols; j++) line.push(row[c - 1 + j] === undefined ? '' : row[c - 1 + j]);
            out.push(line);
          }
          return out;
        }
      }),
      _rows: rows
    };
  }

  const candidateSheet = makeEmptyCandidateSheetMock();
  const articleSheet = makeArticleSheetMock(['ランドリーチェスト 収納 おすすめ']);

  context.SpreadsheetApp = {
    getActiveSpreadsheet: () => ({
      getSheetByName: (name) => {
        if (name === 'たくみパパ_キーワード候補') return candidateSheet;
        if (name === 'たくみパパ') return articleSheet;
        return null;
      }
    }),
    flush: () => {}
  };

  const homeAppConfig2 = vm.runInContext('UA_APP_TYPES', context).home;
  const uaDiscoverTreasureKeywords_2 = vm.runInContext('uaDiscoverTreasureKeywords_', context);
  const summary2 = uaDiscoverTreasureKeywords_2(homeAppConfig2);

  assert.strictEqual(summary2.addedCount, 0, 'カニバリと判定された候補は追加されない');
  assert.strictEqual(candidateSheet._rows.length, 0, 'シートには何も追加されない');

  const item = summary2.results.find(function(r) { return r.keyword === 'ランドリーチェスト カビ'; });
  assert.ok(item, '結果に候補が含まれる');
  assert.strictEqual(item.kept, false, 'SERPは通過してもカニバリ判定でkeptがfalseに上書きされる');
  assert.ok(item.reason.indexOf('カニバリ') !== -1, '却下理由にカニバリと明記される');
  assert.strictEqual(item.cannibalizedWith, 'ランドリーチェスト 収納 おすすめ', '一致した既存記事キーワードが記録される');
  assert.strictEqual(geminiCallCount, 2, 'ideation呼び出しとカニバリ検査呼び出しの2回Geminiが呼ばれる');
}

// 7) uaEvaluateTreasureKeywordCandidates_: offer (案件) linkage gate.
// 2026-09-06: DRIVE BASEはRinker商品検索より案件（アフィリエイトプログラム）中心の
// 収益構造なので、Rinker系の商品ひも付き判定が使えないdrive、および商品ひも付き判定で
// 拾えなかったhomeのキーワードは、案件管理シートとの照合（Gemini判定）で拾えるようにした。
{
  const context = freshContext();

  context.PropertiesService = {
    getScriptProperties: () => ({ getProperty: () => 'test-serper-key' })
  };
  context.UrlFetchApp = {
    fetch: () => ({
      getResponseCode: () => 200,
      getContentText: () => JSON.stringify({
        organic: [
          { link: 'https://detail.chiebukuro.yahoo.co.jp/qa/question_detail/q1', title: 'Q' },
          { link: 'https://ameblo.jp/someuser/entry-1.html', title: 'B1' },
          { link: 'https://hatenablog.com/entry/2', title: 'B2' }
        ]
      })
    })
  };

  const offerRows = [
    ['引っ越し一括見積もりサービス', 'https://example.com', '[SC]', '引っ越し検討者向け']
  ];
  const offerSheet = {
    getLastRow: () => offerRows.length + 1,
    getRange: (r, c, numRows, numCols) => ({
      getValues: () => {
        const out = [];
        for (let i = 0; i < numRows; i++) {
          const row = offerRows[r - 2 + i] || [];
          const line = [];
          for (let j = 0; j < numCols; j++) line.push(row[c - 1 + j] === undefined ? '' : row[c - 1 + j]);
          out.push(line);
        }
        return out;
      }
    })
  };
  context.SpreadsheetApp = {
    getActiveSpreadsheet: () => ({
      getSheetByName: (name) => (name === '案件管理' ? offerSheet : null)
    })
  };
  // main.gs isn't loaded in this test context; stub the one helper this path needs.
  context.uaEnsureAffiliateManagementSheet_ = function(ss) { return ss.getSheetByName('案件管理'); };

  context.uaCallGeminiJson_ = function () {
    return {
      data: {
        results: [
          { keyword: '引っ越し 一括見積もり 損しない', linked: true, matchedOffer: '引っ越し一括見積もりサービス' },
          { keyword: '車 一括査定 相場', linked: true, matchedOffer: '引っ越し一括見積もりサービス' },
          { keyword: '猫 爪とぎ 材質', linked: false, matchedOffer: '' }
        ]
      }
    };
  };

  const uaEvaluateTreasureKeywordCandidates_ = vm.runInContext('uaEvaluateTreasureKeywordCandidates_', context);
  const homeAppConfig3 = vm.runInContext('UA_APP_TYPES', context).home;
  const driveAppConfig3 = vm.runInContext('UA_APP_TYPES', context).drive;

  // home: fails the Rinker/product-catalog check (no home product noun), so it must fall
  // back to the offer-linkage check to be kept.
  const homeResults = uaEvaluateTreasureKeywordCandidates_(homeAppConfig3, ['引っ越し 一括見積もり 損しない'], {}, []);
  const homeItem = homeResults.find(function(r) { return r.keyword === '引っ越し 一括見積もり 損しない'; });
  assert.ok(homeItem, 'home: 結果に候補が含まれる');
  assert.strictEqual(homeItem.kept, true, 'home: Rinkerで拾えなくても案件ひも付きで採用される');
  assert.strictEqual(homeItem.productLabel, '引っ越し一括見積もりサービス', 'home: 一致した案件名がラベルになる');

  // drive: no Rinker-style check at all -- goes straight to offer linkage.
  const driveResults = uaEvaluateTreasureKeywordCandidates_(driveAppConfig3, ['車 一括査定 相場', '猫 爪とぎ 材質'], {}, []);
  const driveKept = driveResults.find(function(r) { return r.keyword === '車 一括査定 相場'; });
  const driveRejected = driveResults.find(function(r) { return r.keyword === '猫 爪とぎ 材質'; });
  assert.ok(driveKept, 'drive: 結果に候補が含まれる');
  assert.strictEqual(driveKept.kept, true, 'drive: 案件ひも付きと判定されたキーワードは採用される');
  assert.strictEqual(driveRejected.kept, false, 'drive: 案件ひも付きと判定されなかったキーワードは却下される');
  assert.strictEqual(driveRejected.reason, '商品・案件のいずれにもひも付かず', '却下理由が明記される');
}

// 8) uaCheckTreasureKeywordOfferLinkage_: chunking.
// 2026-09-06: reading 保留 keywords straight from a candidate sheet
// (uaEvaluateCandidateSheetKeywords_) can hand this many more than the 8-keyword
// AI-ideation batch -- a real DRIVE BASE run with 100+ 保留 keywords produced a
// single oversized Gemini call whose JSON response got cut off mid-string and
// failed to parse, silently zeroing out every candidate. Verify large lists get
// split into multiple Gemini calls and that one chunk's failure doesn't lose the
// other chunks' results.
{
  const context = freshContext();
  const uaCheckTreasureKeywordOfferLinkage_ = vm.runInContext('uaCheckTreasureKeywordOfferLinkage_', context);
  const uaCheckTreasureKeywordCannibalization_ = vm.runInContext('uaCheckTreasureKeywordCannibalization_', context);
  const homeAppConfig4 = vm.runInContext('UA_APP_TYPES', context).home;

  const keywords = [];
  for (let i = 0; i < 25; i++) keywords.push('キーワード' + i);
  const offers = [{ name: 'テスト案件', notes: '' }];

  let callCount = 0;
  const chunkSizes = [];
  context.uaCallGeminiJson_ = function (promptText) {
    callCount++;
    // 2回目の呼び出し（2チャンク目）だけ、応答JSONが途中で切れてパースに失敗した
    // ケースを再現する（uaCallGeminiJson_はレスポンスをパースできないとエラーを投げる）。
    if (callCount === 2) {
      throw new Error('Unexpected end of JSON input');
    }
    const match = promptText.match(/候補キーワード:\n([\s\S]*?)\n\n登録済み/);
    const chunkKeywords = match ? match[1].split('\n').map(function(l) { return l.replace(/^- /, ''); }) : [];
    chunkSizes.push(chunkKeywords.length);
    return {
      data: {
        results: chunkKeywords.map(function(k) { return { keyword: k, linked: true, matchedOffer: 'テスト案件' }; })
      }
    };
  };

  const offerCheckResult = uaCheckTreasureKeywordOfferLinkage_(homeAppConfig4, keywords, offers);
  const map = offerCheckResult.map;

  assert.strictEqual(callCount, 3, '25件は12件ずつ3チャンク（12/12/1）に分割されGeminiが3回呼ばれる');
  assert.strictEqual(map['キーワード0'].linked, true, '1チャンク目は正常に判定される');
  assert.strictEqual(map['キーワード12'], undefined, '壊れたJSONを返したチャンクの結果は含まれない（他チャンクを巻き込まない）');
  assert.strictEqual(map['キーワード24'].linked, true, '3チャンク目（壊れたチャンクの後）も正常に判定される');
  assert.strictEqual(offerCheckResult.processedKeywords.length, 25, '時間切れが起きなければ全件が着手済みとして扱われる');

  // カニバリ検査も同じチャンク分割ロジックを共有していることを確認する。
  callCount = 0;
  const cannibalMap = uaCheckTreasureKeywordCannibalization_(keywords, ['既存記事キーワード']);
  assert.strictEqual(callCount, 3, 'カニバリ検査も同様に3チャンクに分割される');
}

// 9) uaCollectCandidateRowsByFilter_: generic filter used by the panel's
// "既存候補の再評価" section. Covers affiliateName+includeStatuses,
// includeStatuses only, and excludeStatuses.
{
  const context = freshContext();
  const uaCollectCandidateRowsByFilter_ = vm.runInContext('uaCollectCandidateRowsByFilter_', context);

  const rows = [
    ['書く', 'ナビ男くん', 'HDMI 後付け', ''],
    ['保留', 'ナビ男くん', 'カーナビ 映らない', ''],
    ['書く', '案件無し', '無関係キーワード', ''],
    ['転送済み', 'ナビ男くん', '既に投稿済み', ''],
    ['', '', '', ''] // blank keyword row must be ignored
  ];
  const sheetMock = {
    getLastRow: () => rows.length + 1,
    getRange: (r, c, numRows, numCols) => ({
      getValues: () => {
        const out = [];
        for (let i = 0; i < numRows; i++) {
          const row = rows[r - 2 + i] || [];
          const line = [];
          for (let j = 0; j < numCols; j++) line.push(row[c - 1 + j] === undefined ? '' : row[c - 1 + j]);
          out.push(line);
        }
        return out;
      }
    })
  };

  // Note: these helpers execute inside a vm context, so the returned arrays
  // are foreign-realm Array instances -- Array.from() re-materializes them
  // as host-realm arrays before comparing (assert.deepStrictEqual treats
  // cross-realm arrays with identical contents as not reference-equal).
  const byAffiliateAndStatus = uaCollectCandidateRowsByFilter_(sheetMock, { affiliateName: 'ナビ男くん', includeStatuses: ['書く'] });
  assert.deepStrictEqual(Array.from(byAffiliateAndStatus, r => r.keyword), ['HDMI 後付け'], '案件名+ステータスの両方で絞り込める');

  const byIncludeOnly = uaCollectCandidateRowsByFilter_(sheetMock, { includeStatuses: ['書く'] });
  assert.deepStrictEqual(Array.from(byIncludeOnly, r => r.keyword), ['HDMI 後付け', '無関係キーワード'], 'ステータスのみでの絞り込み（案件名は問わない）');

  const byExclude = uaCollectCandidateRowsByFilter_(sheetMock, { excludeStatuses: ['転送済み'] });
  assert.deepStrictEqual(
    Array.from(byExclude, r => r.keyword),
    ['HDMI 後付け', 'カーナビ 映らない', '無関係キーワード'],
    '転送済みだけ除外して残り全件を対象にできる'
  );

  const noFilter = uaCollectCandidateRowsByFilter_(sheetMock, {});
  assert.strictEqual(noFilter.length, 4, 'フィルタなしなら空欄行を除く全行が対象になる');
}

// 10) uaSetCandidateStatusForWeb: whitelist enforcement for the panel's
// per-row action buttons (approve to 書く / hold / back to AI提案). Must
// reject statuses outside the whitelist (e.g. 転送済み, which is reserved
// for the automatic-posting pipeline) so the panel can't corrupt that state.
{
  const context = freshContext();
  let writtenValue = null;
  const candidateSheet = {
    getRange: (r, c) => ({
      setValue: (v) => { writtenValue = { row: r, col: c, value: v }; }
    })
  };
  context.SpreadsheetApp = {
    getActiveSpreadsheet: () => ({
      getSheetByName: (name) => (name === 'たくみパパ_キーワード候補' ? candidateSheet : null)
    })
  };

  const uaSetCandidateStatusForWeb = vm.runInContext('uaSetCandidateStatusForWeb', context);
  const candidateColumnsRef = vm.runInContext('UA_CANDIDATE_COLUMNS', context);

  // result is returned from inside the vm context (foreign-realm object),
  // so compare fields individually rather than via deepStrictEqual.
  const result = uaSetCandidateStatusForWeb('たくみパパ', 5, '書く');
  assert.strictEqual(result.row, 5, '許可されたステータスへの変更は成功する（行番号）');
  assert.strictEqual(result.status, '書く', '許可されたステータスへの変更は成功する（ステータス）');
  assert.deepStrictEqual(writtenValue, { row: 5, col: candidateColumnsRef.status, value: '書く' }, 'ステータス列の該当行に書き込まれる');

  assert.throws(function () {
    uaSetCandidateStatusForWeb('たくみパパ', 5, '転送済み');
  }, /許可されていないステータス/, 'ホワイトリスト外（転送済み等）は拒否される');

  assert.throws(function () {
    uaSetCandidateStatusForWeb('たくみパパ', 1, '書く');
  }, /不正な行番号/, 'ヘッダー行（1行目）は拒否される');
}

// 11) uaListCandidatesForWeb (web_app.gs) with the new optional statuses
// filter -- verify both the filtered and backward-compatible (no filter)
// call shapes.
{
  const configSource = fs.readFileSync(path.join(__dirname, 'unified_article_app', 'config.gs'), 'utf8');
  const mainSource = fs.readFileSync(path.join(__dirname, 'unified_article_app', 'main.gs'), 'utf8');
  const webAppSource = fs.readFileSync(path.join(__dirname, 'unified_article_app', 'web_app.gs'), 'utf8');
  const context2 = { console };
  vm.createContext(context2);
  vm.runInContext(configSource, context2);
  vm.runInContext(mainSource, context2);
  vm.runInContext(webAppSource, context2);

  const rows = [
    ['書く', 'ナビ男くん', 'HDMI 後付け', ''],
    ['保留', 'ナビ男くん', 'カーナビ 映らない', '']
  ];
  const candidateSheet = {
    getLastRow: () => rows.length + 1,
    getLastColumn: () => 4,
    getRange: (r, c, numRows, numCols) => ({
      getDisplayValues: () => {
        const out = [];
        for (let i = 0; i < numRows; i++) {
          const row = rows[r - 2 + i] || [];
          out.push(row.slice(c - 1, c - 1 + numCols));
        }
        return out;
      }
    })
  };
  context2.SpreadsheetApp = {
    getActiveSpreadsheet: () => ({
      getSheetByName: (name) => (name === 'たくみパパ_キーワード候補' ? candidateSheet : null)
    })
  };
  // uaEnsureCandidateSheetLayout_ lives in main.gs and touches sheet formatting
  // APIs this mock doesn't implement -- stub it, matching the other tests' pattern.
  context2.uaEnsureCandidateSheetLayout_ = function () {};

  const uaListCandidatesForWeb = vm.runInContext('uaListCandidatesForWeb', context2);

  const unfiltered = uaListCandidatesForWeb('たくみパパ', '');
  assert.strictEqual(unfiltered.length, 2, '第3引数を省略すれば従来通り全件返る（後方互換）');

  const filtered = uaListCandidatesForWeb('たくみパパ', '', ['書く']);
  assert.strictEqual(filtered.length, 1, 'statusesを渡すとサーバー側で絞り込まれる');
  assert.strictEqual(filtered[0].keyword, 'HDMI 後付け', '絞り込み結果のキーワードが正しい');
}

console.log('Treasure keyword discovery: OK');
