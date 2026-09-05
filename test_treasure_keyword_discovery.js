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

  const newRows = candidateSheet._rows.slice(1); // skip the pre-existing row
  assert.strictEqual(newRows.length, 1, '候補シートには1行だけ追加される');
  assert.strictEqual(newRows[0][0], 'AI提案', '追加された行のステータスは「AI提案」（「書く」には絶対に昇格させない）');
  assert.strictEqual(newRows[0][2], 'ランドリーチェスト カビ', '追加された行のキーワードが正しい');

  // Pre-existing row must remain untouched.
  assert.deepStrictEqual(candidateSheet._rows[0], ['書く', '案件無し', '既存の候補キーワード', ''], '既存の行はそのまま残る');
}

console.log('Treasure keyword discovery: OK');
