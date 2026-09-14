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

assert.ok(
  promptSource.includes('悩み→起きる原因→自分で確認する方法→回避策→次の行動'),
  '本文プロンプトが共感だけで終わらず解決まで進むよう要求する'
);
assert.ok(
  promptSource.includes('「後悔」「失敗」「やめとけ」「いらない」「原因」「対処法」「口コミ」など読者の検索意図語は絶対に含めない'),
  '商品検索語へ否定・質問語を入れないルールを固定する'
);

console.log('Solution-first product search logic: OK');
