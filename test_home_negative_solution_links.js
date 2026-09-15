const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const context = { console };
vm.createContext(context);
for (const file of ['config.gs', 'utils.gs', 'article.gs', 'wordpress.gs']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'unified_article_app', file), 'utf8'), context);
}

const specs = Array.from(context.uaGetHomeNegativeSolutionLinkSpecs20260915_());
assert.strictEqual(specs.length, 13, '承認済みの13記事だけを対象にする');
assert.strictEqual(new Set(specs.map((spec) => spec.postId)).size, 13, '投稿IDを重複させない');
assert.deepStrictEqual(
  specs.map((spec) => spec.postId).sort((a, b) => a - b),
  [230, 315, 317, 660, 681, 793, 1082, 1267, 1312, 1313, 1314, 1355, 1396],
  '監査で確定した投稿以外を更新対象にしない'
);

const validExamples = {
  closet_curtain: '遮光 クローゼット用 カーテン 幅100 丈200',
  honeycomb_screen: '断熱 ハニカムスクリーン 採光タイプ',
  washroom_dehumidifier: 'コンパクト 除湿機 衣類乾燥 洗面所向け',
  tv_stand: '壁寄せ テレビスタンド 高さ調整 VESA対応',
  toilet_brush: '流せる トイレブラシ 使い捨て 替えブラシ付き',
  fridge_floor_mat: '冷蔵庫用 床保護マット ポリカーボネート',
  tension_roll_screen: 'つっぱり式 ロールスクリーン 遮光',
  bath_hair_catcher: '浴室 排水口 ヘアキャッチャー 髪の毛 ゴミ受け',
  drain_net: 'キッチン 排水口ネット ストッキング 浅型',
  folding_wash_basin: 'キッチン 折りたたみ シリコン 洗い桶',
  outdoor_sunshade: '窓用 屋外 サンシェード 遮熱 日よけ',
  privacy_film: '窓用 目隠しフィルム プライバシーシート'
};
for (const [key, title] of Object.entries(validExamples)) {
  assert.strictEqual(context.uaIsHomeNegativeSolutionItemValid20260915_(key, title), true, key + 'の正当な解決商品を採用する');
}

const invalidExamples = {
  closet_curtain: 'クローゼット用 カーテンレール ブラケット 金具',
  honeycomb_screen: '車用 サンシェード ハニカム柄',
  washroom_dehumidifier: '靴用 除湿剤 10個セット',
  tv_stand: 'テレビスタンド WALLシリーズ オプション品 コーナーガード',
  toilet_brush: 'キッチン 排水口ブラシ',
  fridge_floor_mat: '冷蔵庫 庫内 棚板シート',
  tension_roll_screen: '車用 ロールスクリーン',
  bath_hair_catcher: 'キッチン専用 シンク排水口 ゴミ受け',
  drain_net: '浴室 排水口ネット',
  folding_wash_basin: '折りたたみ ベビーバス 足湯',
  outdoor_sunshade: '自動車 フロントガラス サンシェード',
  privacy_film: 'スマホ液晶 プライバシーフィルム'
};
for (const [key, title] of Object.entries(invalidExamples)) {
  assert.strictEqual(context.uaIsHomeNegativeSolutionItemValid20260915_(key, title), false, key + 'の誤カテゴリ商品を拒否する');
}
assert.strictEqual(
  context.uaIsHomeNegativeSolutionItemValid20260915_('closet_curtain', 'つっぱり棒 テンションポール カフェカーテン用'),
  false,
  'カーテンという用途語があるだけの突っ張り棒を実物カーテンとして採用しない'
);

for (const spec of specs) {
  const plan = context.uaNormalizeProductPlan_(spec.plan);
  assert.ok(plan && plan.shouldInsert && plan.marketQuery && plan.purpose && plan.benefit && plan.ctaReason,
    'post ' + spec.postId + 'に困りごと・解決商品・比較理由を持たせる');
  assert.ok(!/後悔|失敗|やめとけ|いらない/.test(plan.marketQuery),
    'post ' + spec.postId + 'の商品検索語へ否定語を混ぜない');
}

console.log('Home negative-keyword solution links: OK');
