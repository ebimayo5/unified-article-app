const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const configSource = fs.readFileSync(path.join(__dirname, 'unified_article_app', 'config.gs'), 'utf8');
const utilsSource = fs.readFileSync(path.join(__dirname, 'unified_article_app', 'utils.gs'), 'utf8');
const articleSource = fs.readFileSync(path.join(__dirname, 'unified_article_app', 'article.gs'), 'utf8');
const promptSource = fs.readFileSync(path.join(__dirname, 'unified_article_app', 'prompt.gs'), 'utf8');

const context = { console };
vm.createContext(context);
vm.runInContext(configSource, context);
vm.runInContext(utilsSource, context);
vm.runInContext(articleSource, context);

const homeConfig = { key: 'home', label: 'たくみパパ' };
const row = {
  mainInput: 'ダイニングテーブル ベンチ 失敗',
  affiliateName: '案件無し',
  affiliateNotes: '',
  readerMindMemo: '通路が狭くなる失敗を避け、家族が立ち座りしやすい座席を選びたい'
};
const solutionPlan = {
  should_insert: true,
  primary_product: '背もたれ付きダイニングベンチ',
  market_query: '背もたれ付き ダイニングベンチ 失敗しない 選び方',
  purpose: '長時間座ると疲れることと、立ち座りしにくい悩みを減らす',
  must_have: ['背もたれ付き'],
  exclude: ['屋外用ベンチ'],
  benefit: '家族が食事中に姿勢を保ちやすくなる',
  cta_reason: '座面高とテーブル高を確認して比較できる'
};
const body = context.uaAttachProductPlanMarker_(
  '<h2>失敗を避ける選び方</h2><p>長く座るなら背もたれ付きダイニングベンチを選びます。</p>',
  solutionPlan
);

assert.strictEqual(
  context.uaSelectRakutenProductQueryRaw_(body, row, homeConfig),
  '背もたれ付き ダイニングベンチ',
  '記事全体から決めた解決商品を、否定語を含むタイトル由来クエリより優先する'
);

const profile = context.uaGetMainKeywordProductProfile_(row, homeConfig);
assert.ok(profile, '商品を含む否定系キーワードは購入前の問題解決意図として認識する');
assert.ok(!/失敗|後悔|やめとけ/.test(profile.query), 'タイトルからの予備検索にも否定語を残さない');

assert.strictEqual(
  context.uaSanitizeProductMarketQuery_('ベンチ 後悔 失敗しない おすすめ 口コミ'),
  'ベンチ',
  '楽天検索語から検索意図語を除き、売られている商品カテゴリだけを残す'
);

const categories = Array.from(context.uaSelectRakutenCategoryQueries_(body, row, homeConfig, '背もたれ付き ダイニングベンチ'));
assert.strictEqual(categories[0], '背もたれ付き ダイニングベンチ', '解決策から決めた主検索語を候補の先頭に固定する');
assert.ok(categories.every((query) => !/失敗|後悔|やめとけ/.test(query)), '候補検索語へ否定語を再混入させない');

const furnitureSearchTuning = context.uaBuildRakutenSearchTuning_(solutionPlan, 'ダイニングベンチ 背付き');
assert.strictEqual(furnitureSearchTuning.sort, 'standard', '耐久家具は安い順にせず、本体が上位に出る関連度順で検索する');
assert.strictEqual(furnitureSearchTuning.ngKeyword, 'ふるさと納税', '耐久家具からふるさと納税枠を除外する');
assert.deepStrictEqual(
  Array.from(context.uaBuildPurchaseScaleRetryQueries_('ダイニングベンチ 背付き', solutionPlan)),
  [],
  'トイレットペーパー専用の単品・1パック検索を家具へ流用しない'
);
assert.deepStrictEqual(
  Array.from(context.uaBuildPurchaseScaleRetryQueries_('排水口ブラシ', solutionPlan)),
  [],
  '購入単位の再検索は一般的な日用品にも自動適用しない'
);
assert.deepStrictEqual(
  Array.from(context.uaBuildPurchaseScaleRetryQueries_('トイレットペーパー 2倍巻き', {
    ...solutionPlan,
    primary_product: '2倍巻きトイレットペーパー',
    market_query: 'トイレットペーパー 2倍巻き'
  })),
  ['トイレットペーパー 2倍巻き 単品', 'トイレットペーパー 2倍巻き 1パック'],
  '単品・1パック検索は導入元のトイレットペーパーだけに適用する'
);
assert.strictEqual(
  context.uaIsRakutenItemRelevant_('背もたれ付き ダイニングベンチ 2人掛け 木製 幅110cm', 'ダイニングベンチ 背付き'),
  true,
  '悩みの解決に合う背もたれ付きダイニングベンチ本体を採用する'
);
assert.strictEqual(
  context.uaIsRakutenItemRelevant_('ダイニングベンチ用 替えカバー 洗える', 'ダイニングベンチ 背付き'),
  false,
  '安価な替えカバーをベンチ本体として採用しない'
);
assert.strictEqual(
  context.uaIsRakutenItemRelevant_('屋外 ガーデンベンチ 背もたれ付き', 'ダイニングベンチ 背付き'),
  false,
  '屋外用ベンチをダイニングの解決商品として採用しない'
);
assert.strictEqual(
  context.uaEvaluateProductPlanFit_('テレビキャンセラー アルファード・ヴェルファイア 40系対応', {
    should_insert: true,
    required_features: ['新型アルファード40系対応']
  }).pass,
  true,
  '車名と世代が商品名で確認できれば、語順や「新型」の有無だけで正しい車種適合品を落とさない'
);
assert.strictEqual(
  context.uaEvaluateProductPlanFit_('テレビキャンセラー ヴェルファイア 40系対応', {
    should_insert: true,
    required_features: ['新型アルファード40系対応']
  }).pass,
  false,
  '世代が一致しても指定車名がない車種専用品は通さない'
);
assert.strictEqual(
  context.uaEvaluateProductPlanFit_('テレビキャンセラー アルファード 30系対応', {
    should_insert: true,
    required_features: ['新型アルファード40系対応']
  }).pass,
  false,
  '車名が一致しても世代違いの車種専用品は通さない'
);
assert.strictEqual(
  context.uaEvaluateProductPlanFit_('テレビキャンセラー アルファード 40系対応', {
    should_insert: true,
    required_features: ['防水']
  }).pass,
  false,
  '車種適合以外の必須条件は従来どおり商品名で厳密に確認する'
);
const alphardPlan = {
  should_insert: true,
  primary_product: '新型アルファード対応テレビキャンセラー施工',
  market_query: 'アルファード40系 テレビキャンセラー',
  required_features: ['40系', '適合表', '施工対応'],
  purchase_scale: 'standard'
};
assert.strictEqual(
  context.uaIsRakutenItemRelevant_(
    'TVキャンセラー アルファード・ヴェルファイア 40系対応',
    'アルファード40系 テレビキャンセラー'
  ),
  true,
  'テレビキャンセラーをテレビ本体用の判定に流して車載AV部品を落とさない'
);
assert.strictEqual(
  context.uaEvaluateProductPlanFit_('テレビキャンセラー アルファード・ヴェルファイア 40系対応', alphardPlan).pass,
  true,
  '適合表・施工対応は商品名で検証できない確認条件なので、正しい40系車種専用品を落とさない'
);
assert.ok(
  context.uaScoreRakutenItem_(
    { itemName: 'テレビキャンセラー アルファード・ヴェルファイア 40系対応' },
    'アルファード40系 テレビキャンセラー',
    alphardPlan
  ) > -1000,
  '車種名と40系が確認できるテレビキャンセラーを、主検索語の語順差だけで候補から除外しない'
);
assert.strictEqual(
  context.uaBuildRakutenSearchTuning_(solutionPlan, '除湿機 コンパクト').sort,
  'standard',
  'たくみの家電本体も安価な交換部品より本体を優先する'
);
assert.strictEqual(
  context.uaBuildRakutenSearchTuning_(solutionPlan, 'サンシェード ベランダ 日よけ').sort,
  'standard',
  'たくみの日よけ本体も関連度順で探す'
);
assert.strictEqual(
  context.uaBuildRakutenSearchTuning_(solutionPlan, 'サンシェード 固定金具 屋外').sort,
  '+itemPrice',
  '明示された金具・小物は本体扱いせず従来の価格順を維持する'
);
assert.strictEqual(
  context.uaBuildRakutenSearchTuning_(solutionPlan, '排水口ブラシ 排水トラップ 掃除').sort,
  '+itemPrice',
  '消耗・清掃用品は価格比較を維持する'
);

assert.strictEqual(
  context.uaIsActionableSolutionProductPlan_({
    should_insert: true,
    primary_product: 'ダイニングテーブル ベンチ 失敗',
    market_query: 'ダイニングテーブル ベンチ 失敗',
    purpose: '記事に商品を置く'
  }),
  false,
  '読者の検索文を商品名としてコピーしただけの計画を拒否する'
);

// Articles saved before UA_PRODUCT_PLAN existed must also use the article's
// actual solution, rather than dropping back to a literal negative title.
context.uaCallGeminiJson_ = () => ({
  data: {
    should_insert: true,
    primary_product: '背もたれ付きダイニングベンチ',
    market_query: '背もたれ付き ダイニングベンチ 後悔しない おすすめ',
    purpose: '長時間座ると疲れる悩みを減らす',
    must_have: ['背もたれ付き'],
    exclude: ['屋外用ベンチ'],
    purchase_scale: 'standard',
    benefit: '食事中に姿勢を保ちやすくなる',
    cta_reason: '座面高とテーブル高を比較して選べる'
  }
});
const legacyBody = [
  '<h2>失敗を避ける選び方</h2>',
  '<p>長時間座る家庭では背もたれ付きベンチを候補にし、座面高とテーブル高を測ります。</p>',
  '<p>出入りが多い家庭は個別チェアも比較し、通路と脚間を床に再現して確認します。</p>',
  '<p>短時間の食事と人数調整が中心なら片側ベンチが役立ちます。家族の使い方を基準に決めます。</p>'
].join('').repeat(2);
const legacyPlan = context.uaResolveLegacySolutionProductPlan_(legacyBody, {
  ...row,
  mainInput: 'ダイニングテーブル ベンチ 失敗 旧記事'
}, homeConfig);
assert.ok(legacyPlan && legacyPlan.shouldInsert, '旧本文からも解決商品計画を構造化できる');
assert.strictEqual(legacyPlan.marketQuery, '背もたれ付き ダイニングベンチ', '旧本文の検索語から否定・販促語を除去する');
assert.strictEqual(legacyPlan.purpose, '長時間座ると疲れる悩みを減らす', '商品が解く困りごとを保持する');

context.uaCallGeminiJson_ = () => ({
  data: {
    should_insert: false,
    primary_product: '',
    market_query: '',
    purpose: '制度の確認と申請手続きが解決であり、商品購入では解決しない',
    purchase_scale: 'standard'
  }
});
const nonProductLegacyBody = '<h2>申請条件</h2><p>対象年度と所得条件を公式窓口で確認し、必要書類を揃えて期限までに申請します。</p>'.repeat(5);
const nonProductLegacyRow = {
  mainInput: '住宅 補助金 失敗 旧記事',
  affiliateName: '案件無し',
  affiliateNotes: '',
  readerMindMemo: '申請漏れを避けたい'
};
const noProductDecision = context.uaResolveLegacySolutionProductPlan_(nonProductLegacyBody, nonProductLegacyRow, homeConfig);
assert.ok(noProductDecision && !noProductDecision.shouldInsert, '旧本文でも商品不要という明示判断を保持する');
assert.strictEqual(
  context.uaShouldInsertRakutenAffiliateBanner_(nonProductLegacyBody, nonProductLegacyRow, homeConfig),
  false,
  '商品で解決しない記事をタイトル由来の予備候補へ戻さない'
);

assert.ok(
  promptSource.includes('悩み→起きる原因→自分で確認する方法→回避策→次の行動'),
  '本文プロンプトが共感だけで終わらず解決まで進むよう要求する'
);
assert.ok(
  promptSource.includes('「後悔」「失敗」「やめとけ」「いらない」「原因」「対処法」「口コミ」など読者の検索意図語は絶対に含めない'),
  '商品検索語へ否定・質問語を入れないルールを固定する'
);

console.log('Solution-first product search logic: OK');
