const fs = require('fs');
const path = require('path');
const root = __dirname;
const current = JSON.parse(fs.readFileSync(path.join(root, '2860_public_rest.json'), 'utf8'));
const before = current.content.rendered;
let after = before;
const changes = [];
function replaceOnce(label, from, to) {
  const i = after.indexOf(from);
  if (i < 0 || after.indexOf(from, i + from.length) >= 0) throw new Error(`Expected one match: ${label}`);
  after = after.replace(from, to);
  changes.push(label);
}
replaceOnce('scope_generic_hdmi_cable',
  '<p>オデッセイの純正ナビでHDMI映像を映すために、適切な接続ケーブルや入力ポートの規格を確認する。車内の純正ナビにHDMI機器を正しく接続し、車内エンタメを安定して楽しめるようになります。商品ページで詳しい仕様を確認し、自分の使い方に合うかチェックしてみてください。</p>',
  '<p>以下は汎用HDMIケーブルの比較例で、オデッセイのナビ・リアモニターへの適合は未確認です。ナビにHDMI入力がない、またはナビから後席へHDMI映像を出力できない場合、ケーブルだけ買っても解決しません。装着ナビとモニターの型番、端子形状、信号経路を確認してから用品を選んでください。</p>');
replaceOnce('remove_unverified_training',
  '整備工場での研修でも、電装の不調は部品そのものより、端子の保持や配線の挟み込みを丁寧に見ることが基本でした。',
  '目視できる端子の緩みや、配線が内装に挟まれていないかも確認対象です。');
replaceOnce('state_vendor_rear_monitor_exception',
  '<p>純正品同士なら必ず連動する、と考えるのも危険です。型番が分かった時点で、メーカーまたは販売店に「HDMI入力の映像はリアモニターに表示できる仕様か」と具体的に確認してください。</p>',
  '<p>純正品同士なら必ず連動する、と考えるのも危険です。<a href="https://naviokun.ocnk.net/product/222">施工元のギャザズ向け案内</a>は、オデッセイを含む一部車種でリア席モニターがRCA接続の場合、追加したHDMI入力の映像は後席に映らないと注意しています。型番が分かった時点で、メーカーまたは販売店に「HDMI入力の映像はリアモニターに表示できる仕様か」と具体的に確認してください。</p>');
replaceOnce('clarify_hdmi_price_is_not_rear_output_fix',
  '<p>純正ナビにHDMI入力が無い場合でも、端子そのものを新設する施工があります。工賃を含んだ価格が公開されているので、判断材料になります。</p>',
  '<p>装着ナビ本体がHDMI入力に対応している場合に、その入力端子を車内へ引き出す施工があります。<a href="https://naviokun.ocnk.net/product/227">施工元の商品227</a>はギャザズ向け16,000円からと案内し、オデッセイではRC1/2の2020年11月以降を主な対応例に挙げています。メーカーオプションナビやHDMI入力のない型番は対象外です。この費用は後席へのHDMI映像出力を保証するものではありません。</p>');
replaceOnce('clarify_front_vs_rear_result',
  '<p>端子を新設すればFire TV Stickやスマートフォンの映像を映せるようになります。まず今の装備を確認し、無ければこの金額と見比べてください。</p>',
  '<p>対応ギャザズに入力端子を施工できれば、Fire TV Stick等を前席ナビへ接続できます。ただし、リアモニターがRCA接続なら同じ映像を後席へ表示できない場合があります。後席表示が目的なら、16,000円の入力施工を申し込む前にナビ・モニター双方の型番と既存の映像経路を施工店に確認してください。</p>');
const imgs = h => [...h.matchAll(/<img\b[^>]*>/g)].map(m => m[0]);
const links = h => [...h.matchAll(/\bhref=(['"])(.*?)\1/g)].map(m => m[2]);
if (JSON.stringify(imgs(before)) !== JSON.stringify(imgs(after))) throw new Error('Original image tags changed');
for (const link of links(before)) if (!links(after).includes(link)) throw new Error(`Original href missing: ${link}`);
if (after.includes('整備工場での研修でも')) throw new Error('Author claim remains');
fs.writeFileSync(path.join(root, '2860_proposed.raw.html'), after);
fs.writeFileSync(path.join(root, '2860_patch.json'), JSON.stringify({post_id:2860, original_modified:current.modified, changes, original_images:imgs(before).length, original_hrefs:links(before).length, proposed_hrefs:links(after).length, published:false}, null, 2));
console.log(JSON.stringify({changes:changes.length, images:imgs(before).length, original_hrefs:links(before).length, proposed_hrefs:links(after).length}));
