const fs = require('fs');
const path = require('path');
const root = __dirname;
const current = JSON.parse(fs.readFileSync(path.join(root, '2761_public_rest.json'), 'utf8'));
const before = current.content.rendered;
let after = before;
const changes = [];
function replaceOnce(label, from, to) {
  const i = after.indexOf(from);
  if (i < 0 || after.indexOf(from, i + from.length) >= 0) throw new Error(`Expected one match: ${label}`);
  after = after.replace(from, to);
  changes.push(label);
}
replaceOnce('remove_unverified_workshop_experience',
  '整備工場での研修経験から見ても、見えない場所の配線処理や固定方法は、装着直後には判断しにくい部分です。',
  '見えない場所の配線処理や固定方法は、装着直後には判断しにくい部分です。');
replaceOnce('scope_honda_tv',
  'TVキャンセラー施工（ホンダ純正ナビ）',
  'TVキャンセラー施工（ホンダ純正ギャザズ向け）');
replaceOnce('scope_honda_hdmi',
  'HDMI入力端子の新設（ホンダ純正ナビ）',
  'HDMI接続施工（HDMI入力対応のホンダ純正ギャザズ向け）');
replaceOnce('scope_toyota_interface',
  '純正ナビのカスタマイズ（トヨタ純正ナビ）',
  '映像入力などの多機能インターフェース（対象のトヨタ純正ディスプレイオーディオ向け）');
replaceOnce('explain_vendor_product_differences',
  '<p>社外ナビへ載せ替えると純正側の機能を一部失うことがあります。まず純正を活かす方法の費用と比べてから決めると、後悔しにくくなります。</p>',
  '<p>上表は異なる車種・画面・機能の施工例で、一台の車にすべて適用できる料金表ではありません。ホンダ12,000円は<a href="https://naviokun.ocnk.net/product/222">ギャザズ向けTVキャンセラー</a>、16,000円は<a href="https://naviokun.ocnk.net/product/227">HDMI入力対応ギャザズ向け接続施工</a>です。トヨタ24,000〜30,000円は<a href="https://naviokun.ocnk.net/product/191">旧世代等のTVキャンセラー</a>と<a href="https://naviokun.ocnk.net/product/236">対象車種の30,000円メニュー</a>をまとめた価格帯で、55,000円は<a href="https://naviokun.ocnk.net/product/12">対象の純正ディスプレイオーディオ向け多機能インターフェース</a>です。後者を単なるHDMI端子追加の料金と比べず、車種・製造時期・画面品番・使いたい機能の一致を確認してください。社外ナビへ載せ替えると純正側の機能を一部失うことがあります。まず純正を活かす方法の適合と費用を比べてから決めましょう。</p>');
const imgs = h => [...h.matchAll(/<img\b[^>]*>/g)].map(m => m[0]);
const links = h => [...h.matchAll(/\bhref=([\x27"])(.*?)\1/g)].map(m => m[2]);
if (JSON.stringify(imgs(before)) !== JSON.stringify(imgs(after))) throw new Error('Original image tags changed');
for (const link of links(before)) if (!links(after).includes(link)) throw new Error(`Original href missing: ${link}`);
fs.writeFileSync(path.join(root, '2761_proposed.raw.html'), after);
fs.writeFileSync(path.join(root, '2761_patch.json'), JSON.stringify({post_id:2761, original_modified:current.modified, changes, original_images:imgs(before).length, original_hrefs:links(before).length, proposed_hrefs:links(after).length, published:false}, null, 2));
console.log(JSON.stringify({changes:changes.length, images:imgs(before).length, original_hrefs:links(before).length, proposed_hrefs:links(after).length}));
