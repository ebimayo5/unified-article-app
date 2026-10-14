const fs = require('fs');
const path = require('path');
const root = __dirname;
const current = JSON.parse(fs.readFileSync(path.join(root, '3081_public_rest.json'), 'utf8'));
const before = current.content.rendered;
let after = before;
const changes = [];
function replaceOnce(label, from, to) {
  const i = after.indexOf(from);
  if (i < 0 || after.indexOf(from, i + from.length) >= 0) throw new Error(`Expected one match: ${label}`);
  after = after.replace(from, to);
  changes.push(label);
}
replaceOnce('remove_unverified_training_claim',
  '筆者が整備工場で研修した際も、電装品では「動くか」だけでなく、配線が可動部や操作部に干渉していないかを確認するのが施工品質の基本でした。',
  '電装品は「動くか」だけでなく、配線が可動部や操作部に干渉していないかも確認してください。');
replaceOnce('vendor_products_and_price_scope',
  '<p><a href="https://px.a8.net/svt/ejp?a8mat=44Z0VG+70FT9U+4YGQ+BW0YB&amp;a8ejpredirect=https%3A%2F%2Fnaviokun.ocnk.net%2F" target="_blank" rel="nofollow sponsored noopener">ナビ男くん</a>の公開表示では、マツダコネクト向けTVキャンセラーは税込33,600円、マツダコネクトの純正ディスプレイ全画面化は税込88,000円です。いずれも商品代と取付工賃を分けずに示す料金体系ですが、HDMI入力新設のマツダ向け価格はこの公開一覧にはありません。</p>',
  '<p><a href="https://px.a8.net/svt/ejp?a8mat=44Z0VG+70FT9U+4YGQ+BW0YB&amp;a8ejpredirect=https%3A%2F%2Fnaviokun.ocnk.net%2F" target="_blank" rel="nofollow sponsored noopener">ナビ男くん</a>の<a href="https://naviokun.ocnk.net/product/231">マツダコネクト向けTVキャンセラー</a>は税込33,600円、<a href="https://naviokun.ocnk.net/product/434">CX-5向け全画面表示プラン</a>は税込88,000円と表示されています（2026年10月確認）。後者はネット動画向けAndroid AVアダプター等の施工で、純正ナビ地図画面を単純に全画面化する設定変更ではありません。両価格は別の施工の工賃込み表示であり、HDMI入力の新設工賃ではありません。車両・ナビの適合とオプション料金は注文前に個別確認してください。</p>');
const imgs = h => [...h.matchAll(/<img\b[^>]*>/g)].map(m => m[0]);
const links = h => [...h.matchAll(/\bhref=([\x27"])(.*?)\1/g)].map(m => m[2]);
if (JSON.stringify(imgs(before)) !== JSON.stringify(imgs(after))) throw new Error('Original image tags changed');
for (const link of links(before)) if (!links(after).includes(link)) throw new Error(`Original href missing: ${link}`);
fs.writeFileSync(path.join(root, '3081_proposed.raw.html'), after);
fs.writeFileSync(path.join(root, '3081_patch.json'), JSON.stringify({post_id:3081, original_modified:current.modified, changes, original_images:imgs(before).length, original_hrefs:links(before).length, proposed_hrefs:links(after).length, published:false}, null, 2));
console.log(JSON.stringify({changes:changes.length, images:imgs(before).length, original_hrefs:links(before).length, proposed_hrefs:links(after).length}));
