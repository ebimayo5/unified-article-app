const fs = require('fs');
const path = require('path');
const root = __dirname;
const current = JSON.parse(fs.readFileSync(path.join(root, '2357_public_rest.json'), 'utf8'));
const before = current.content.rendered;
let after = before;
const changes = [];
function replaceOnce(label, from, to) {
  const i = after.indexOf(from);
  if (i < 0 || after.indexOf(from, i + from.length) >= 0) throw new Error(`Expected one match: ${label}`);
  after = after.replace(from, to);
  changes.push(label);
}
replaceOnce('source_nissan_dayz_hdmi_option',
  '現行デイズ向けにはHDMI入力に対応する日産オリジナルナビゲーションが案内されていますが、これは対象ナビの機能です。',
  '<a href="https://www.nissan.co.jp/OPTIONAL-PARTS/OPCATALOGUE/PDF/dayz_op.pdf">日産のデイズ純正用品カタログ</a>には、HDMI入力対応の日産オリジナルナビゲーションが掲載されています。ただし、これは掲載された対象ナビの機能です。');
replaceOnce('remove_unverified_training',
  '整備の研修で内装まわりの作業を学んだ立場から見ても、電装作業は「通電するか」だけで終わりません。',
  '電装作業は「通電するか」だけで終わりません。');
replaceOnce('avoid_unverified_dayz_vendor_installation_cta',
  'ナビ男くんでデイズのナビ型番に合うHDMI施工と必要部品を確認する',
  'ナビ男くんの施工メニューを確認する（デイズへの対応は個別照会）');
replaceOnce('avoid_unverified_dayz_vendor_service',
  'ナビ男くん</a>なら、デイズの年式・ナビ仕様を伝えたうえで、対応できる施工内容や必要な確認項目を比較できます。',
  'ナビ男くん</a>へ相談する場合も、デイズ向けのHDMI施工が公開メニューで確認できないため、対応可否・必要部品・総額を個別に照会してください。');
const imgs = h => [...h.matchAll(/<img\b[^>]*>/g)].map(m => m[0]);
const links = h => [...h.matchAll(/\bhref=([\x27"])(.*?)\1/g)].map(m => m[2]);
if (JSON.stringify(imgs(before)) !== JSON.stringify(imgs(after))) throw new Error('Original image tags changed');
for (const link of links(before)) if (!links(after).includes(link)) throw new Error(`Original href missing: ${link}`);
fs.writeFileSync(path.join(root, '2357_proposed.raw.html'), after);
fs.writeFileSync(path.join(root, '2357_patch.json'), JSON.stringify({post_id:2357, original_modified:current.modified, changes, original_images:imgs(before).length, original_hrefs:links(before).length, proposed_hrefs:links(after).length, published:false}, null, 2));
console.log(JSON.stringify({changes:changes.length, images:imgs(before).length, original_hrefs:links(before).length, proposed_hrefs:links(after).length}));
