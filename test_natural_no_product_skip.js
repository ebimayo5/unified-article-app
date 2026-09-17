const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(
  path.join(__dirname, 'unified_article_app', 'article.gs'),
  'utf8'
);
const context = { console };
vm.createContext(context);
vm.runInContext(source, context);

assert.strictEqual(
  context.uaIsNaturalNoProductOutcome_('商品AI選定を安全停止：AIが適合商品なしと判定｜車種適合確認・施工保証・カメラ連携確認を満たす取付サービスがないため'),
  true,
  'AIが実候補を精査した上での明示的な不一致判定は自然な結果として扱う'
);
assert.strictEqual(
  context.uaIsNaturalNoProductOutcome_('商品AI選定を安全停止：候補なし（楽天候補0件・正規URL0件・明白な不適合除外0件）'),
  true,
  'マーケットプレイス検索自体が候補ゼロなのも自然な結果として扱う'
);
assert.strictEqual(
  context.uaIsNaturalNoProductOutcome_('商品AI選定を安全停止：OpenAI呼び出し・JSON解析（http_500）'),
  false,
  'OpenAI呼び出し失敗などの技術的失敗は自然な結果として扱わない'
);
assert.strictEqual(
  context.uaIsNaturalNoProductOutcome_('商品AI選定を安全停止：採用商品の実ページ引用確認'),
  false,
  '実ページ照合の失敗は自然な結果として扱わない（内容の裏取りに失敗しているため）'
);
assert.strictEqual(
  context.uaIsNaturalNoProductOutcome_('商品AI選定を安全停止：比較記事の指定ブランド確認'),
  false,
  '比較記事で必須ブランドが欠けているのは自然な結果として扱わない'
);

const fakeSheet = {};
const installationServiceRow = { row: 139, mainInput: '純正 ナビ メリット', affiliateNotes: '' };
const driveConfig = { key: 'drive' };
const bodyWithProductPlan = context.uaAttachProductPlanMarker_(
  '<p>純正ナビのメリットを解説します。</p>',
  { should_insert: true, primary_product: 'カーナビ取付サービス', market_query: 'カーナビ 取付サービス' }
);

function setupEnsureStubs(overrides) {
  context.uaGetSheetForData_ = () => fakeSheet;
  context.uaGetRakutenRowContext_ = () => ({
    sheet: fakeSheet,
    row: 139,
    rowData: installationServiceRow,
    appConfig: driveConfig,
    body: bodyWithProductPlan
  });
  context.uaBuildRowData_ = () => ({ row: 139, body: bodyWithProductPlan });
  context.uaGetMainKeywordProductProfile_ = () => ({ queries: ['カーナビ 取付サービス', 'カーナビ取付サービス'] });
  context.uaShouldInsertRakutenAffiliateBanner_ = () => true;
  // UA_LAST_RAKUTEN_STATUS is a `let` binding inside article.gs, so it can only
  // be set by code running in the same script scope, not via context assignment.
  context.uaAddRakutenBannerForContext_ = () => {
    vm.runInContext('UA_LAST_RAKUTEN_STATUS = ' + JSON.stringify(overrides.rakutenStatus), context);
    return { row: 139, body: bodyWithProductPlan };
  };
  context.uaGetExistingProductLinkAssessment_ = () => ({ adequate: false, reason: '候補が適合条件を満たしませんでした' });
  const logged = [];
  context.uaAppendFactCheckPoint_ = (sheet, row, line) => logged.push(line);
  return logged;
}

{
  const logged = setupEnsureStubs({
    rakutenStatus: '商品AI選定を安全停止：AIが適合商品なしと判定｜車種適合確認・施工保証・カメラ連携確認を満たす取付サービスがないため'
  });
  const result = context.uaEnsureAutomaticProductLinksForData_({ row: 139 });
  assert.ok(!/停止/.test(result.message) || /スキップ/.test(result.message),
    'AIの明示的な不一致判定では例外を投げず、スキップ結果を返す');
  assert.ok(logged.some((line) => line.indexOf('商品導線保証をスキップ') !== -1),
    'スキップした理由を確認記録へ残す');
}

{
  setupEnsureStubs({
    rakutenStatus: '商品AI選定を安全停止：候補なし（楽天候補0件・正規URL0件・明白な不適合除外0件）'
  });
  assert.doesNotThrow(
    () => context.uaEnsureAutomaticProductLinksForData_({ row: 139 }),
    '検索自体が候補ゼロの場合も止めずに次工程へ進む'
  );
}

{
  setupEnsureStubs({
    rakutenStatus: '商品AI選定を安全停止：OpenAI呼び出し・JSON解析（http_500）'
  });
  assert.throws(
    () => context.uaEnsureAutomaticProductLinksForData_({ row: 139 }),
    /適切なRinker・楽天・Amazon導線を作成できませんでした/,
    'OpenAI呼び出し失敗など技術的失敗は引き続き停止する'
  );
}

{
  installationServiceRow.affiliateNotes = '楽天あり';
  setupEnsureStubs({
    rakutenStatus: '商品AI選定を安全停止：AIが適合商品なしと判定｜取付サービスがないため'
  });
  assert.throws(
    () => context.uaEnsureAutomaticProductLinksForData_({ row: 139 }),
    /適切なRinker・楽天・Amazon導線を作成できませんでした/,
    '明示的な「楽天あり」指定がある場合は、AIの不一致判定でも人の確認のため停止する'
  );
  installationServiceRow.affiliateNotes = '';
}

console.log('Natural no-product outcome tests passed');
