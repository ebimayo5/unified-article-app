const fs = require('fs');
const path = require('path');
const root = __dirname;
const current = JSON.parse(fs.readFileSync(path.join(root, '2258_public_rest.json'), 'utf8'));
const before = current.content.rendered;
let after = before;
const changes = [];
function replaceOnce(label, from, to) {
  const i = after.indexOf(from);
  if (i < 0 || after.indexOf(from, i + from.length) >= 0) throw new Error(`Expected one match: ${label}`);
  after = after.replace(from, to);
  changes.push(label);
}
replaceOnce('remove_unverified_mechanic_training',
  '整備士専門学校で基礎を学び、整備工場で研修した経験から見ても、症状の原因を車内で推測して対処するより、',
  '症状の原因を車内で推測して対処するより、');
replaceOnce('remove_unverified_truck_driving',
  '大型トラックで長距離を運転してきた筆者の感覚では、移動中の大きな不満よりも、',
  '長距離の使用を判断するときは、大きな不満だけでなく、');
replaceOnce('correct_japanese_panda_cross_drivetrain',
  '<p>パンダ クロスを検討する場合は、見た目だけで選ばず、降雪地での使用、未舗装路へ入る頻度、必要な駆動方式を確認してください。2WDと4WDでは駆動系やタイヤの確認点が変わり、整備先が対応できる範囲も個体によって異なります。</p>',
  '<p>パンダ クロスを検討する場合は、見た目だけで選ばず、降雪地での使用や未舗装路へ入る頻度を確認してください。<a href="https://www.stellantis.jp/news/20231127_fiat_panda_cross_4x4">ステランティスジャパンの2023年Panda Cross 4×4発表</a>では、日本向け限定車は4輪駆動と6速MTの組み合わせです。「クロス」の名称だけから2WDも選べると考えず、候補車の年式・正式グレード・駆動方式・変速機を車検証と車両資料で確かめてください。4WDの駆動系やタイヤについて整備先が対応できるかも、個体ごとに確認が必要です。</p>');
replaceOnce('source_fiat_service_maintenance',
  '点検整備記録簿では、いつ、どこで、何を交換・整備したかを追います。',
  '<a href="https://www.fiat-auto.co.jp/maestroservice/inspection">フィアット公式の点検案内</a>では、法定点検に加え、車種ごとの取扱説明書・メンテナンスノートに沿うメーカー推奨点検も案内しています。点検整備記録簿では、いつ、どこで、何を交換・整備したかを追います。');
const imgs = h => [...h.matchAll(/<img\b[^>]*>/g)].map(m => m[0]);
const links = h => [...h.matchAll(/\bhref=([\x27"])(.*?)\1/g)].map(m => m[2]);
if (JSON.stringify(imgs(before)) !== JSON.stringify(imgs(after))) throw new Error('Original image tags changed');
for (const link of links(before)) if (!links(after).includes(link)) throw new Error(`Original href missing: ${link}`);
fs.writeFileSync(path.join(root, '2258_proposed.raw.html'), after);
fs.writeFileSync(path.join(root, '2258_patch.json'), JSON.stringify({post_id:2258, original_modified:current.modified, changes, original_images:imgs(before).length, original_hrefs:links(before).length, proposed_hrefs:links(after).length, published:false}, null, 2));
console.log(JSON.stringify({changes:changes.length, images:imgs(before).length, original_hrefs:links(before).length, proposed_hrefs:links(after).length}));
