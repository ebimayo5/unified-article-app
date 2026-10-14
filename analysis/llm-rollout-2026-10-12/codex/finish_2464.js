const fs = require('fs');
const path = require('path');
const root = __dirname;
const current = JSON.parse(fs.readFileSync(path.join(root, '2464_public_rest.json'), 'utf8'));
const before = current.content.rendered;
let after = before;
const changes = [];
function replaceOnce(label, from, to) {
  const i = after.indexOf(from);
  if (i < 0 || after.indexOf(from, i + from.length) >= 0) throw new Error(`Expected one match: ${label}`);
  after = after.replace(from, to);
  changes.push(label);
}
replaceOnce('add_suzuki_documented_location_and_price',
  '<p>ソリオのHDMI端子の位置は一律ではありません。年式・型式・グレードに加え、メーカーオプションナビ、販売店装着ナビ、社外ナビの違いと、HDMI接続ケーブルの施工有無で、端子の有無も確認場所も変わるためです。</p>',
  '<p>ソリオのHDMI端子の位置は一律ではありません。年式・型式・グレードに加え、メーカーオプションナビ、販売店装着ナビ、社外ナビの違いと、HDMI接続ケーブルの施工有無で、端子の有無も確認場所も変わるためです。<a href="https://www.suzuki.co.jp/accessory_car/catalog-library/solio202505.pdf">スズキの2025年5月アクセサリーカタログ</a>では、対象の販売会社装着ナビ用HDMI接続ケーブル（CA2V／99000-79BR2）の取出位置を「インパネアッパーボックス内（運転席）」、表示価格を本体6,600円＋参考取付費3,300円の計9,900円と案内しています。この位置・価格を別の年式やナビに当てはめず、装着品番を先に照合してください。</p>');
replaceOnce('do_not_imply_vendor_has_solio_hdmi_menu',
  '配線を見せずに仕上げたい人や、後席利用を含めて相談したい人は、対応車種と施工内容を確認できる<a href="https://px.a8.net/svt/ejp?a8mat=44Z0VG+70FT9U+4YGQ+BW0YB&amp;a8ejpredirect=https%3A%2F%2Fnaviokun.ocnk.net%2F" target="_blank" rel="nofollow sponsored noopener">ナビ男くん</a>を選択肢にすると、部品だけを先に買う失敗を避けやすくなります。',
  'まずスズキ販売店に装着ナビの品番とHDMI接続ケーブルの設定・取出位置を確認してください。<a href="https://px.a8.net/svt/ejp?a8mat=44Z0VG+70FT9U+4YGQ+BW0YB&amp;a8ejpredirect=https%3A%2F%2Fnaviokun.ocnk.net%2F" target="_blank" rel="nofollow sponsored noopener">ナビ男くん</a>への相談も可能ですが、後述のとおり公開中のソリオ向けメニューにHDMI増設は掲載されていません。施工を受けられると推定せず、対応可否を個別に確認してください。');
replaceOnce('correct_solio_affiliate_cta',
  'ナビ男くんでソリオのナビ型番に合うHDMI施工と対応内容を確認する',
  'ナビ男くんの公開メニューを確認する（ソリオHDMI施工の掲載なし）');
const imgs = h => [...h.matchAll(/<img\b[^>]*>/g)].map(m => m[0]);
const links = h => [...h.matchAll(/\bhref=(['"])(.*?)\1/g)].map(m => m[2]);
if (JSON.stringify(imgs(before)) !== JSON.stringify(imgs(after))) throw new Error('Original image tags changed');
for (const link of links(before)) if (!links(after).includes(link)) throw new Error(`Original href missing: ${link}`);
fs.writeFileSync(path.join(root, '2464_proposed.raw.html'), after);
fs.writeFileSync(path.join(root, '2464_patch.json'), JSON.stringify({post_id:2464, original_modified:current.modified, changes, original_images:imgs(before).length, original_hrefs:links(before).length, proposed_hrefs:links(after).length, published:false}, null, 2));
console.log(JSON.stringify({changes:changes.length, images:imgs(before).length, original_hrefs:links(before).length, proposed_hrefs:links(after).length}));
