const fs = require('fs');
const path = require('path');
const root = __dirname;
const current = JSON.parse(fs.readFileSync(path.join(root, '3124_public_rest.json'), 'utf8'));
const before = current.content.rendered;
let after = before;
const changes = [];
function replaceOnce(label, from, to) {
  const i = after.indexOf(from);
  if (i < 0 || after.indexOf(from, i + from.length) >= 0) throw new Error(`Expected one match: ${label}`);
  after = after.replace(from, to);
  changes.push(label);
}
replaceOnce('add_2026_is300h_official_hdmi_location',
  '<p>また、USB Type-C端子が見つかっても、それはHDMI端子とは限りません。現行ISの装備案内では、センターコンソール周辺に通信・充電用USB Type-C端子を設ける仕様が案内されています。USB端子の数や位置からHDMI入力の有無を推測せず、<a href=\'https://lexus.jp/models/is/features/equipment/\' target=\'_blank\' rel="noopener">レクサス公式のIS装備案内</a>と自車の説明書を照合してください。</p>',
  '<p>2026年1月以降のIS300hについては、<a href="https://lexus.jp/models/is/pdf/dealer_option.pdf">レクサスの販売店オプション冊子</a>がHDMI入力端子（用品番号064／D9G4）をグローブボックス内に装着すると明記しています。<a href="https://manual.lexus.jp/is/2601/hev/ja_JP/contents/rcm1705651853999.php">同年式の取扱説明書</a>も、販売店オプション装着車でHDMI出力機器を接続できると案内しています。USB Type-C端子はHDMIとは別です。このグローブボックス位置を旧年式や別の装着ナビへ一律に当てはめず、自車の生産年月・オプション明細を照合してください。<a href=\'https://lexus.jp/models/is/features/equipment/\' target=\'_blank\' rel="noopener">レクサス公式のIS装備案内</a>も確認できます。</p>');
replaceOnce('add_oem_accessory_price_separate_from_labor',
  '<p>後付け費用は「HDMIを付ける」という言葉だけでは比較できません。入力を新設するのか、後席モニターも付けるのか、既存画面の表示機能を変えるのかで、必要な部品と作業が変わります。</p>',
  '<p>後付け費用は「HDMIを付ける」という言葉だけでは比較できません。2026年IS300hのレクサス販売店オプションHDMI入力端子は、公式用品冊子で6,050円（税込、用品代）・標準取付時間1.6時間と案内され、取付費は別途必要です。給電機能はなく、走行中は動画を表示できず音声のみの再生です。この価格は下表の工賃込み社外施工とは同一条件で比較できません。旧年式や別仕様に適用できるか、販売店に確認してください。</p>');
replaceOnce('separate_vendor_price_from_oem_price',
  '<p>上表の価格は税込・工賃込みで、2026年9月27日時点の案内です。車種・ナビの種類・オプションにより変動します。HDMI入力新設についてレクサスの一律価格は示されていないため、端子の有無と接続目的を伝えた個別確認が必要です。</p>',
  '<p>上表はナビ男くんの税込・工賃込み表示価格（2026年9月27日時点）で、レクサス純正用品の価格ではありません。レクサスISのHDMI入力追加について同店の一律価格は確認できません。まず純正オプションの適合と取付費込み総額を販売店で確認し、別施工を比較するなら対応車種・ナビ型番・保証範囲を同店へ個別に確認してください。</p>');
replaceOnce('avoid_unverified_vendor_is_hdmi_cta',
  'ナビ男くんでレクサスISのHDMI入力追加と施工総額を確認する',
  'ナビ男くんの施工メニューを確認する（ISへのHDMI施工は個別確認）');
const imgs = h => [...h.matchAll(/<img\b[^>]*>/g)].map(m => m[0]);
const links = h => [...h.matchAll(/\bhref=(['"])(.*?)\1/g)].map(m => m[2]);
if (JSON.stringify(imgs(before)) !== JSON.stringify(imgs(after))) throw new Error('Original image tags changed');
for (const link of links(before)) if (!links(after).includes(link)) throw new Error(`Original href missing: ${link}`);
fs.writeFileSync(path.join(root, '3124_proposed.raw.html'), after);
fs.writeFileSync(path.join(root, '3124_patch.json'), JSON.stringify({post_id:3124, original_modified:current.modified, changes, original_images:imgs(before).length, original_hrefs:links(before).length, proposed_hrefs:links(after).length, published:false}, null, 2));
console.log(JSON.stringify({changes:changes.length, images:imgs(before).length, original_hrefs:links(before).length, proposed_hrefs:links(after).length}));
