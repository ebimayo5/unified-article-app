const fs = require('fs');
const path = require('path');
const root = __dirname;
const current = JSON.parse(fs.readFileSync(path.join(root, '2456_public_rest.json'), 'utf8'));
const before = current.content.rendered;
let after = before;
const changes = [];
function replaceOnce(label, from, to) {
  const i = after.indexOf(from);
  if (i < 0 || after.indexOf(from, i + from.length) >= 0) throw new Error(`Expected one match: ${label}`);
  after = after.replace(from, to);
  changes.push(label);
}
replaceOnce('suzuki_primary_source_and_compatibility',
  '<p>スペーシアのHDMI端子は一律の場所にあるわけではなく、<strong>装着ナビとUSB／HDMIソケットのオプション設定</strong>で変わります。見える場所に端子がない車両でも、ナビ背面に入力端子だけを持つ仕様や、追加配線で使える仕様があります。</p>',
  '<p>スペーシアのHDMI端子は一律の場所にあるわけではなく、<strong>装着ナビとHDMI接続ケーブルの装着状況</strong>で変わります。<a href="https://www.suzuki.co.jp/car/spacia/comfort/">スズキのスペーシア装備案内</a>はHDMI入力対応のナビについて、販売会社装着アクセサリーのHDMI接続ケーブルと、接続機器に応じた市販ケーブルなどが別途必要と案内しています。見える場所に端子がなくても、対応ナビに純正ケーブルを追加できる場合があります。まずナビ品番と用品の適合を販売店で確認してください。</p>');
replaceOnce('qualify_affiliate_cta',
  'ナビ男くんでスペーシアのHDMI増設と施工対応を確認する',
  'ナビ男くんのスペーシア向け公開メニューを確認する（HDMI施工は未掲載）');
replaceOnce('remove_unverified_workshop_experience',
  '整備工場での研修経験から見ても、電装品は「映るか」だけでなく、',
  '電装品は「映るか」だけでなく、');
replaceOnce('correct_vendor_scope',
  '<p><a href="https://px.a8.net/svt/ejp?a8mat=44Z0VG+70FT9U+4YGQ+BW0YB&amp;a8ejpredirect=https%3A%2F%2Fnaviokun.ocnk.net%2F" target="_blank" rel="nofollow sponsored noopener">ナビ男くん</a>なら、HDMI入力の増設や車内エンタメ施工について、対応車種・施工内容・純正機能との兼ね合いを事前に確認できます。ナビ脱着や配線処理まで任せたい人は、希望する端子位置と接続機器を伝えたうえで、対応範囲を確認するとよいでしょう。</p>',
  '<p><a href="https://px.a8.net/svt/ejp?a8mat=44Z0VG+70FT9U+4YGQ+BW0YB&amp;a8ejpredirect=https%3A%2F%2Fnaviokun.ocnk.net%2F" target="_blank" rel="nofollow sponsored noopener">ナビ男くん</a>のスペーシア向け公開メニューには、この記事で確認した時点でHDMI入力の施工が掲載されていません。HDMIの後付け可否や工賃を、同店の公開メニューだけで確定することはできません。先にスズキ販売店でナビ品番に適合する純正HDMI接続ケーブルを確認し、社外店に依頼する場合は車両型式・ナビ品番・希望する端子位置を伝えて個別に施工可否と見積もりを確認してください。</p>');
replaceOnce('official_accessory_price_scope',
  '<p>専門店が車種別に用意しているメニューは、車種によって大きく違います。スペーシアの場合、公開されている車種別メニューに映像入力を増やす施工は含まれておらず、対応しているのは録画系です（2026年9月時点）。</p>',
  '<p><a href="https://www.suzuki.co.jp/accessory_car/navigation/mop.html">スズキのメーカーオプションナビ用用品案内</a>では、スペーシア向けHDMI接続ケーブルの本体参考価格を6,820円、参考取付時間を0.5時間としています（2025年12月時点の仕様・参考価格）。取付費は別で、販売会社が定めます。既存車への後付けは車両の状態や作業内容で費用が変わるため、この金額を総工賃と誤認しないでください。専門店の車種別メニューも車種によって違い、ナビ男くんのスペーシア向け公開メニューにHDMI入力施工は見当たりません（2026年9月確認時点）。</p>');
const imgs = h => [...h.matchAll(/<img\b[^>]*>/g)].map(m => m[0]);
const links = h => [...h.matchAll(/\bhref=([\x27"])(.*?)\1/g)].map(m => m[2]);
if (JSON.stringify(imgs(before)) !== JSON.stringify(imgs(after))) throw new Error('Original image tags changed');
for (const link of links(before)) if (!links(after).includes(link)) throw new Error(`Original href missing: ${link}`);
fs.writeFileSync(path.join(root, '2456_proposed.raw.html'), after);
fs.writeFileSync(path.join(root, '2456_patch.json'), JSON.stringify({post_id:2456, original_modified:current.modified, changes, original_images:imgs(before).length, original_hrefs:links(before).length, proposed_hrefs:links(after).length, published:false}, null, 2));
console.log(JSON.stringify({changes:changes.length, images:imgs(before).length, original_hrefs:links(before).length, proposed_hrefs:links(after).length}));
