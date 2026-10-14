const fs = require('fs');
const path = require('path');
const root = __dirname;
const current = JSON.parse(fs.readFileSync(path.join(root, '2737_public_rest.json'), 'utf8'));
const before = current.content.rendered;
let after = before;
const changes = [];
function replaceOnce(label, from, to) {
  const first = after.indexOf(from);
  if (first < 0 || after.indexOf(from, first + from.length) >= 0) throw new Error(`Expected one match: ${label}`);
  after = after.replace(from, to);
  changes.push(label);
}
replaceOnce('add_era_specific_toyota_map_controls',
  '<h3>3. 停車中に地図画面の切替を試す</h3>\n<p>安全な場所に停車してから、地図画面のメニューや表示切替を確認します。地図表示、案内表示、分割表示の選択肢があるかを、取扱説明書に沿って見てください。</p>',
  '<h3>3. 停車中に地図画面の切替を試す</h3>\n<p>安全な場所に停車してから、自車の生産時期に合う取扱説明書を開きます。<a href="https://manual.toyota.jp/pdf/harrier/harrier_navi_202009.pdf">トヨタの2020年版ナビ取扱書</a>では、Home画面に分割表示された地図画面を選択すると、その画面が全画面表示になると説明されています。一方、<a href="https://manual.toyota.jp/harrier/2209/hev/ja_JP/contents/nvch01se020401.php">2022年9月以降のマルチメディア取扱書</a>では、メインメニューの地図から地図画面を開く手順が示されています。まず自車の表示がHome画面の分割表示なのか、地図画面そのものなのかを見分けてください。</p>');
replaceOnce('remove_unverified_truck_experience',
  '<p>大型トラックで長距離を運転していた経験からも、走行中に小さな操作を何度も繰り返さなくて済む配置は、疲労がたまる場面ほど助けになります。ただし、地図の文字や交差点案内が読み取りにくければ、本末転倒です。停車中に普段使う縮尺へ合わせ、文字サイズ、次の交差点、分岐案内の見え方を確認してください。</p>',
  '<p>地図の文字や交差点案内が読み取りにくい場合は、停車中に普段使う縮尺へ合わせ、文字サイズ、次の交差点、分岐案内の見え方を確認してください。運転中の細かな操作を減らせる表示を選ぶことも大切です。</p>');
replaceOnce('clarify_vendor_price_is_video_adapter',
  '<h2>ハリアーの画面まわりを変えるといくらか</h2>\n<p>純正ナビを使い続けるか、画面そのものを変えるか。どちらを選ぶにしても、工賃を含んだ総額で比べると判断しやすくなります。</p>\n<figure class="wp-block-table is-style-stripes"><table><thead><tr><th>施工メニュー</th><th>工賃コミ価格（税込）</th></tr></thead><tbody><tr><td>純正ディスプレイの全画面表示</td><td>68,000円</td></tr></tbody></table><figcaption class="wp-element-caption">ナビ男くん公式サイトの表示価格（税込・工賃コミ）。2026年9月27日時点。車種・ナビの種類・オプションにより変動します。</figcaption></figure>\n<p>ナビ本体を社外品へ載せ替えると、純正側の機能を一部失うことがあります。純正を活かす方法から先に検討したほうが失敗しにくいです。</p>',
  '<h2>ハリアーの画面まわりを変えるといくらか</h2>\n<p>純正地図を大きくしたい場合は、まず自車の取扱説明書にある画面操作を確認してください。<strong>ネット動画を大きく表示したい場合は別の機器・施工です。</strong><a href="https://naviokun.ocnk.net/product/304">ナビ男くんの商品304</a>は、ハリアーなどのトヨタ12.3インチディスプレイ向けAndroid AVアダプター「アンドロイダーLite」を、工事費込み税込68,000円で掲載しています。これはネット動画向けであり、純正ナビ地図の全画面化料金ではありません。オプションや車両仕様による価格・適合条件は購入前に確認してください。</p>\n<p>純正地図の表示だけが目的なら、この68,000円の商品を解決策として選ばないでください。車両ごとの画面設定を確認し、設定で解決しなければトヨタ販売店へ仕様を照会しましょう。</p>');
const imgs = h => [...h.matchAll(/<img\b[^>]*>/g)].map(m => m[0]);
const links = h => [...h.matchAll(/\bhref=(['"])(.*?)\1/g)].map(m => m[2]);
if (JSON.stringify(imgs(before)) !== JSON.stringify(imgs(after))) throw new Error('Original images changed');
for (const link of links(before)) if (!links(after).includes(link)) throw new Error(`Original href missing: ${link}`);
if (after.includes('大型トラックで長距離を運転していた経験')) throw new Error('Unverified claim remains');
fs.writeFileSync(path.join(root, '2737_proposed.raw.html'), after);
fs.writeFileSync(path.join(root, '2737_patch.json'), JSON.stringify({post_id:2737, original_modified:current.modified, changes, original_images:imgs(before).length, original_hrefs:links(before).length, proposed_hrefs:links(after).length, published:false}, null, 2));
console.log(JSON.stringify({changes:changes.length, images:imgs(before).length, original_hrefs:links(before).length, proposed_hrefs:links(after).length, before_chars:before.length, after_chars:after.length}));
