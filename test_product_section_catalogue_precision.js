const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// 2026-09-19: the dedicated-product-H2 rule used to be switched off entirely for
// articles that intentionally carry no product links. That was too blunt — a
// section that really is a product catalogue would have slipped through. This
// narrows it: in those articles the rule only fires when the section shows
// concrete catalogue evidence (several listed items plus repeated prices or
// model numbers). Articles with normal product links are unaffected.
const context = { console };
vm.createContext(context);
vm.runInContext(
  fs.readFileSync(path.join(__dirname, 'unified_article_app', 'pre_publish_check.gs'), 'utf8'),
  context
);

const raw = context.uaFindPrePublishStandaloneProductSectionsWithoutRakuten_;
// The vm realm returns its own Array, so copy into this realm before comparing.
const find = (body, allow) => Array.from(raw(body, allow));

// Taken from the live article kurashi-ie.com/disaster-stockpile-expired-regret/
// (row93), the exact two H2s that kept it from ever publishing. Checklist and
// inspection prose: no prices, no model numbers, only a couple of list items.
const checklistBody =
  '<h2>食品以外の防災用品も期限と劣化を分けて点検</h2>' +
  '<p>食品以外の防災用品も、使用期限、劣化、作動確認に分けて見直します。</p>' +
  '<ul><li>備蓄を日常で回す物と定期点検する物に分ける</li>' +
  '<li>見直しは確認・分類・判断・補充・次回予約の5ステップで進める</li></ul>' +
  '<h2>買い直す前の防災用品チェックリスト</h2>' +
  '<h3>長期保存の表示だけでなく残存期限を見る</h3>' +
  '<p>保存年数は製造日を基準にした表記の場合があります。</p>' +
  '<h3>収納は中身と期限が見える形にする</h3>' +
  '<ul><li>ふたを開けなくても中身がわかるか</li><li>補充しやすい置き方か</li></ul>';

assert.deepStrictEqual(
  find(checklistBody, true), [],
  '商品を意図的に省略した記事では、点検手順やチェックリストの章をNGにしない（row93の再発防止）'
);
assert.strictEqual(
  find(checklistBody, false).length, 2,
  '通常の記事では従来どおり、商品導線のない用品専用H2は2件ともNGにする'
);

// A section that really does read like a catalogue: several listed items with
// prices. This still needs either a product link or removal, so it stays NG
// even when the article decided to omit product links elsewhere.
const catalogueBody =
  '<h2>おすすめ防災用品グッズ</h2>' +
  '<ul>' +
  '<li>ポータブル電源 49,800円</li>' +
  '<li>非常用トイレ 3,280円</li>' +
  '<li>手回しラジオ 5,980円</li>' +
  '</ul>';
assert.deepStrictEqual(
  find(catalogueBody, true), ['おすすめ防災用品グッズ'],
  '価格を並べた商品カタログ的な章は、商品省略記事でもNGのまま'
);

// Same shape, but identified by model numbers instead of prices.
const modelNumberBody =
  '<h2>揃えておきたい防災アイテム</h2>' +
  '<ul>' +
  '<li>ソーラーランタン LN-2400</li>' +
  '<li>浄水ボトル PW-750</li>' +
  '<li>簡易寝袋 SB-180</li>' +
  '</ul>';
assert.deepStrictEqual(
  find(modelNumberBody, true), ['揃えておきたい防災アイテム'],
  '型番を並べた章も商品カタログとして扱う'
);

// Guard against over-eager flagging: a long list with no prices and no model
// numbers is still just an article section.
const plainListBody =
  '<h2>備えておきたい防災用品の考え方</h2>' +
  '<ul><li>水と食料</li><li>明かり</li><li>衛生用品</li><li>情報を得る手段</li></ul>';
assert.deepStrictEqual(
  find(plainListBody, true), [],
  '項目数が多くても、価格も型番もなければカタログとは見なさない'
);

// A section that has a product link is fine either way.
const linkedBody =
  '<h2>おすすめ防災用品グッズ</h2>' +
  '<ul><li>ポータブル電源 49,800円</li><li>非常用トイレ 3,280円</li><li>ラジオ 5,980円</li></ul>' +
  '<!-- UA_RINKER_PRODUCTS_START -->';
assert.deepStrictEqual(
  find(linkedBody, true), [],
  '商品導線がある章はもともと対象外'
);

console.log('Product section catalogue precision tests passed');
