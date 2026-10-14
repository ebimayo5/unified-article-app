const fs = require('fs');
const path = require('path');
const root = __dirname;
const current = JSON.parse(fs.readFileSync(path.join(root, '1912_public_rest.json'), 'utf8'));
const before = current.content.rendered;
let after = before;
const changes = [];
function replaceOnce(label, from, to) {
  const i = after.indexOf(from);
  if (i < 0 || after.indexOf(from, i + from.length) >= 0) throw new Error(`Expected one match: ${label}`);
  after = after.replace(from, to);
  changes.push(label);
}
replaceOnce('repair_broken_commerce_intro',
  '<p>型番と既存装備を確認したうえで、必要な接続方式と画面サイズに合うカーナビを比較できるため。普段の通勤・送迎や長距離移動で、地図・音楽・通話・駐車時の画面確認を自分の使い方に合わせて整えられる。条件に合う場合は、下の商品候補で価格と仕様を確認できます。 条件に合わなければ、無理に購入する必要はありません。</p>',
  '<p>車両と現在の機器の型番を確認してから、必要な接続方式・画面サイズ・純正機能との適合を比較してください。次の掲載商品はナビ本体ではなく汎用配線キットの例です。ライズへの適合は型式・装備・取付機器で変わるため、施工店の適合確認前に購入しないでください。</p>');
replaceOnce('label_generic_harness_correctly',
  '「カーナビ」を楽天で比較する',
  '汎用配線キットの例（ライズへの適合未確認）');
replaceOnce('add_toyota_raize_carplay_era_exception',
  '<p>Apple CarPlayとAndroid Autoが使えるか、有線か無線かは、ライズの車名ではなく装着機器の仕様表で確認します。Bluetoothで音楽が流れることと、CarPlayやAndroid Autoが起動することは同じではありません。</p>',
  '<p>Apple CarPlayとAndroid Autoが使えるか、有線か無線かは、車両の生産時期と装着機器の仕様表で確認します。<a href="https://toyota.jp/faq/show/11711.html">トヨタ公式FAQ</a>によると、2019年11月～2021年2月のライズ純正ディスプレイオーディオはApple CarPlayのみ対応し、Android Autoには対応しません。販売店装着オプションのナビは同FAQでは両規格に非対応です。現行ライズの9インチディスプレイオーディオは<a href="https://toyota.jp/raize/connected/">トヨタ車種ページ</a>で両規格への対応とUSBケーブル接続が案内されています。Bluetoothで音楽が流れることと、CarPlayやAndroid Autoが起動することは別です。</p>');
replaceOnce('remove_unverified_workshop_training',
  '<p>整備工場での研修経験から見ても、電装品は見えない配線処理で施工品質の差が出やすい分野です。内装の浮き、異音、配線の無理な取り回しを避けるためにも、エアバッグ周辺や純正配線の加工を伴う作業は専門施工を前提に考えましょう。</p>',
  '<p>内装の浮き、異音、配線の無理な取り回しを避けるため、エアバッグ周辺や純正配線の加工を伴う作業は、適合確認と施工保証を説明できる専門店へ相談しましょう。</p>');
replaceOnce('make_era_exception_visible_in_faq',
  '<p>A. 対応するライズはありますが、利用可否は年式・グレードだけでなく、装着されているナビまたはディスプレイオーディオの仕様で確認します。本体型番を調べ、取扱説明書またはメーカー公式情報で対応スマホ・接続方式を確認してください。</p>',
  '<p>A. 生産時期と装着機器で異なります。トヨタによると2019年11月～2021年2月の純正ディスプレイオーディオはApple CarPlayのみでAndroid Auto非対応です。現行9インチディスプレイオーディオは両規格に対応し、USBケーブル接続が案内されています。販売店装着オプションナビも同じ対応とは限らないため、本体型番と公式取扱説明書で確認してください。</p>');
const imgs = h => [...h.matchAll(/<img\b[^>]*>/g)].map(m => m[0]);
const links = h => [...h.matchAll(/\bhref=(['"])(.*?)\1/g)].map(m => m[2]);
if (JSON.stringify(imgs(before)) !== JSON.stringify(imgs(after))) throw new Error('Original image tags changed');
for (const link of links(before)) if (!links(after).includes(link)) throw new Error(`Original href missing: ${link}`);
if (after.includes('整備工場での研修経験から見ても')) throw new Error('Author claim remains');
fs.writeFileSync(path.join(root, '1912_proposed.raw.html'), after);
fs.writeFileSync(path.join(root, '1912_patch.json'), JSON.stringify({post_id:1912, original_modified:current.modified, changes, original_images:imgs(before).length, original_hrefs:links(before).length, proposed_hrefs:links(after).length, published:false}, null, 2));
console.log(JSON.stringify({changes:changes.length, images:imgs(before).length, original_hrefs:links(before).length, proposed_hrefs:links(after).length, before_chars:before.length, after_chars:after.length}));
