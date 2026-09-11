const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, 'unified_article_app', 'article.gs'), 'utf8');
const context = { console };
vm.createContext(context);
vm.runInContext(source, context);

const relevant = vm.runInContext('uaIsRakutenItemRelevant_', context);

assert.strictEqual(relevant('患者衣ガウン 竹虎 病院用衣料', '電子レンジ L字プラグ 変換アダプター'), false);
assert.strictEqual(relevant('L字型プラグ 変換アダプター 省スペース', '電子レンジ L字プラグ 変換アダプター'), true);
assert.strictEqual(relevant('小型収納ボックス 屋外用', 'ヤブガラシ 除草剤'), false);
assert.strictEqual(relevant('根まで枯らす 液体除草剤', 'ヤブガラシ 除草剤'), true);
assert.strictEqual(relevant('液晶テレビ 24V型', 'テレビ裏 収納 ラック'), false);
assert.strictEqual(relevant('テレビ裏 収納ラック 配線整理', 'テレビ裏 収納 ラック'), true);
assert.strictEqual(relevant('食器棚シート 冷蔵庫マット 庫内用', '冷蔵庫 床 保護マット'), false);
assert.strictEqual(relevant('冷蔵庫 床保護マット 透明 ポリカーボネート', '冷蔵庫 床 保護マット'), true);
assert.strictEqual(relevant('キッチン排水口 掃除ブラシ シンク用', '浴室 排水口 ブラシ'), false);
assert.strictEqual(relevant('浴室 排水口ブラシ パイプクリーナー', '浴室 排水口 ブラシ'), true);
assert.strictEqual(relevant('LEDダストセンサーライト 掃除機用', '掃除機 交換バッテリー'), false);
assert.strictEqual(relevant('掃除機 交換バッテリー 長寿命', '掃除機 交換バッテリー'), true);

const secondary = vm.runInContext('uaIsRakutenItemNameRelevant_', context);
let modelCalls = 0;
context.uaCallGeminiJson_ = () => {
  modelCalls += 1;
  return { data: { relevant: true } };
};
assert.strictEqual(secondary('選択用18インチバルーン 1円商品', 'ラック', { mainInput: 'テレビ裏収納' }), false);
assert.strictEqual(secondary('ブラックタイツ 美脚レギンス', 'ラック', { mainInput: '食洗機' }), false);
assert.strictEqual(secondary('釘打ち厳禁シール エアコン配管材', 'エアコン', { mainInput: '庭の雑草' }), false);
assert.strictEqual(modelCalls, 0, '明白なカテゴリ違いはGeminiを呼ぶ前に拒否する');

console.log('Rakuten explicit-intent guards: OK');
