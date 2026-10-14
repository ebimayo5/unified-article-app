const fs = require('fs');
const path = require('path');
const root = __dirname;
const current = JSON.parse(fs.readFileSync(path.join(root, '1843_public_rest.json'), 'utf8'));
const before = current.content.rendered;
let after = before;
const changes = [];
function replaceOnce(label, from, to) {
  const first = after.indexOf(from);
  if (first < 0 || after.indexOf(from, first + from.length) >= 0) throw new Error(`Expected one match: ${label}`);
  after = after.replace(from, to);
  changes.push(label);
}
replaceOnce('scope_honda_price_excludes_install_labor',
  '<p class="wp-block-paragraph">Honda Accessの現行案内では、11.4インチHonda CONNECTナビは取付アタッチメント込みで325,600円、9インチは取付アタッチメントとパネルキット込みで239,800円、8インチは取付アタッチメント込みで172,700円です。いずれも案内ページ掲載時点の消費税込み価格で、装備や追加用品、時期により内容は変わります。</p>',
  '<p class="wp-block-paragraph"><a href="https://www.honda.co.jp/navi/freed/">Honda Accessのフリード用ナビ案内</a>では、11.4インチHonda CONNECTナビは本体と取付アタッチメントの合計で税込325,600円、9インチは本体・取付アタッチメント・パネルキットの合計で税込239,800円、8インチは本体と取付アタッチメントの合計で税込172,700円です。いずれも掲載品の合計であり、取付費は別途販売会社への確認が必要です。社外品の工賃込み価格と比較するときは、純正側の取付費と追加用品も見積もりに入れてください。</p>');
replaceOnce('identify_big_da_and_missing_factory_features',
  'では、フリード向けのアルパイン11型ディスプレイ・ナビ施工例が案内されており、対応車種、残せる機能、マルチビューカメラ装着車の非対応条件などを確認できます。</p>',
  'では、フリード向けに11型ディスプレイオーディオ「ビッグDA」と、地図内蔵ナビ・TVチューナー搭載の「ビッグX」が別機種として案内されています。<a href="https://naviokun.ocnk.net/product/411">施工元の商品411</a>ではマルチビューカメラ装着車を対象外とし、バックカメラの舵角連動ガイド線、パーキングセンサーのナビ画面表示、ステアリングの音声認識スイッチに非対応と明記しています。必要な純正機能を機能単位で確認してください。</p>');
replaceOnce('scope_vendor_big_da_price_and_tv_canceller',
  '<figure class="wp-block-table is-style-stripes"><table><thead><tr><th>施工メニュー</th><th>工賃コミ価格（税込）</th></tr></thead><tbody><tr><td>大画面ディスプレイへの交換（アルパイン）</td><td>190,600円</td></tr><tr><td>TVキャンセラー施工（ホンダ純正ナビ・ギャザズ）</td><td>12,000円</td></tr></tbody></table><figcaption class="wp-element-caption">ナビ男くん公式サイトの表示価格（税込・工賃コミ）。2026年9月27日時点。車種・ナビの種類・オプションにより変動します。</figcaption></figure>',
  '<figure class="wp-block-table is-style-stripes"><table><thead><tr><th>施工メニュー</th><th>工賃コミ価格（税込）</th></tr></thead><tbody><tr><td>フリードGT系用アルパイン11型ビッグDA（PF11DA-FR-GT-NR・ディスプレイオーディオ）</td><td>190,600円</td></tr><tr><td>TVキャンセラー施工（ホンダ純正ナビ・ギャザズ向け。社外ナビ取付費には含めない）</td><td>12,000円から</td></tr></tbody></table><figcaption class="wp-element-caption">ナビ男くんの<a href="https://naviokun.ocnk.net/product/411">フリード用商品411</a>と<a href="https://naviokun.ocnk.net/product/222">ギャザズ用商品222</a>の公開表示を参照。19万600円はビッグDAの税・工賃込み価格で、地図内蔵ビッグXの価格ではありません。オプション・車両仕様・施工場所で総額が変わる場合があります。TVキャンセラーは純正ギャザズ用の別施工です。</figcaption></figure>');
const imgs = h => [...h.matchAll(/<img\b[^>]*>/g)].map(m => m[0]);
const links = h => [...h.matchAll(/\bhref=(['"])(.*?)\1/g)].map(m => m[2]);
if (JSON.stringify(imgs(before)) !== JSON.stringify(imgs(after))) throw new Error('Original images changed');
for (const link of links(before)) if (!links(after).includes(link)) throw new Error(`Original href missing: ${link}`);
fs.writeFileSync(path.join(root, '1843_proposed.raw.html'), after);
fs.writeFileSync(path.join(root, '1843_patch.json'), JSON.stringify({post_id:1843, original_modified:current.modified, changes, original_images:imgs(before).length, original_hrefs:links(before).length, proposed_hrefs:links(after).length, published:false}, null, 2));
console.log(JSON.stringify({changes:changes.length, images:imgs(before).length, original_hrefs:links(before).length, proposed_hrefs:links(after).length, before_chars:before.length, after_chars:after.length}));
