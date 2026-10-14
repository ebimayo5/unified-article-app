const fs = require('fs');
const path = require('path');
const root = __dirname;
const current = JSON.parse(fs.readFileSync(path.join(root, '3144_public_rest.json'), 'utf8'));
const before = current.content.rendered;
let after = before;
const changes = [];
function replaceOnce(label, from, to) {
  const i = after.indexOf(from);
  if (i < 0 || after.indexOf(from, i + from.length) >= 0) throw new Error(`Expected one match: ${label}`);
  after = after.replace(from, to);
  changes.push(label);
}
replaceOnce('identify_factory_display_vs_gathers',
  '<p>コンソール周辺にUSB端子しか見当たらない場合も、探し方が悪いと決めつける必要はありません。物理的なHDMI端子が見える仕様とは限らず、接続コードの追加や装着機器側の設定が必要な場合もあるためです。</p>',
  '<p>コンソール周辺にUSB端子しか見当たらない場合も、探し方が悪いと決めつける必要はありません。物理的なHDMI端子が見える仕様とは限りません。<a href="https://www.honda.co.jp/ACCESS/press/2026/hac2026032601.html">Honda Accessの2026年ZR-V用品案内</a>では、Google搭載Honda CONNECTディスプレーと、e:HEV Xで選べるディーラーオプションのギャザズナビを区別しています。両者のHDMI用品や後付け施工の適合を混同せず、画面の名称・品番から確認してください。</p>');
replaceOnce('remove_unverified_truck_experience',
  '筆者は大型車で長距離を運転した経験から、車内機器では「使えるか」だけでなく、休憩のたびにケーブルが抜ける、給電が足りない、足元に配線が垂れるといった小さなストレスを軽く見ない方がよいと考えます。',
  '車内機器は「使えるか」だけでなく、ケーブルの抜けや給電不足、足元に垂れる配線も確認が必要です。');
replaceOnce('remove_unverified_workshop_experience',
  '整備工場での研修経験から見ても、電装品は見栄え以上に配線処理と固定が重要です。',
  '電装品は見栄えだけでなく、配線処理と固定も重要です。');
replaceOnce('qualify_vendor_hdmi_price',
  'ホンダ純正系のHDMI入力新設</td><td>16,000円</td><td>装着ナビ・ディスプレーの種類、対応車種、入力追加の可否',
  'ホンダ純正ギャザズ向けHDMI接続施工</td><td>16,000円</td><td>ギャザズナビのHDMI入力対応が前提。Google搭載Honda CONNECTディスプレーへの適用は未確認');
replaceOnce('explain_vendor_product_scope',
  '<p>上記は<strong>税・工賃込みの公開価格で、2026年9月27日時点</strong>です。車種、ナビの種類、オプションにより変動します。工賃だけを切り分けて最安価格を探すより、部品と施工を含む総額を事前に把握したい人に向く見方です。</p>',
  '<p>上記は<strong>税・工賃込みの公開価格で、2026年9月27日時点</strong>です。<a href="https://naviokun.ocnk.net/product/227">ナビ男くんのHDMI商品案内</a>はZR-Vを対象車種に含めますが、対象はHDMI入力対応のホンダ純正ディーラーオプション「Gathers」です。入力回路がない画面へ16,000円でHDMI機能を追加できるという意味ではありません。Google搭載Honda CONNECTディスプレー装着車への適用も同商品案内では確認できません。後席モニター59,000円〜は<a href="https://naviokun.ocnk.net/product-group/135">同店のZR-V商品一覧</a>に掲載される別施工です。画面品番、接続先、前後の表示条件を確認して総額を比較してください。</p>');
replaceOnce('qualify_cta',
  'ナビ男くんでZR-VのHDMI入力追加と後席モニター施工の対応内容を確認する',
  'ナビ男くんのZR-V対応商品を確認する（画面品番で適合確認）');
const imgs = h => [...h.matchAll(/<img\b[^>]*>/g)].map(m => m[0]);
const links = h => [...h.matchAll(/\bhref=([\x27"])(.*?)\1/g)].map(m => m[2]);
if (JSON.stringify(imgs(before)) !== JSON.stringify(imgs(after))) throw new Error('Original image tags changed');
for (const link of links(before)) if (!links(after).includes(link)) throw new Error(`Original href missing: ${link}`);
fs.writeFileSync(path.join(root, '3144_proposed.raw.html'), after);
fs.writeFileSync(path.join(root, '3144_patch.json'), JSON.stringify({post_id:3144, original_modified:current.modified, changes, original_images:imgs(before).length, original_hrefs:links(before).length, proposed_hrefs:links(after).length, published:false}, null, 2));
console.log(JSON.stringify({changes:changes.length, images:imgs(before).length, original_hrefs:links(before).length, proposed_hrefs:links(after).length}));
