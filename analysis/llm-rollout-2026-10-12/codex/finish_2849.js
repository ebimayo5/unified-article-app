const fs = require('fs');
const path = require('path');
const root = __dirname;
const current = JSON.parse(fs.readFileSync(path.join(root, '2849_public_rest.json'), 'utf8'));
const before = current.content.rendered;
let after = before;
const changes = [];
function replaceOnce(label, from, to) {
  const i = after.indexOf(from);
  if (i < 0 || after.indexOf(from, i + from.length) >= 0) throw new Error(`Expected one match: ${label}`);
  after = after.replace(from, to);
  changes.push(label);
}
replaceOnce('add_manufacturer_fitment_source',
  '適合表を見る際は、ディスプレイオーディオ本体メーカーだけでなく、取付キットメーカーの情報も照合します。車種名と年式だけで判断せず、型式、グレード、既設オーディオの種類、メーカーオプションの有無まで一致させてください。',
  '適合表を見る際は、ディスプレイオーディオ本体メーカーだけでなく、取付キットメーカーの情報も照合します。たとえば<a href="https://jpn.pioneer/ja/carrozzeria/car_av/displayaudio/dmh-sf900/floating/">パイオニアのフローティング型車種別適合情報</a>は、装着可否・推奨位置とは別に必要部品の確認を求め、スイッチや車室内装備への干渉も注意しています。車種名と年式だけで判断せず、型式、グレード、既設オーディオの種類、メーカーオプションの有無まで一致させてください。');
replaceOnce('remove_unverified_workshop_training',
  '整備工場での研修経験から見ても、後から異音や接触不良を招きやすいのは、本体そのものより配線の固定や余長処理が雑なケースです。',
  '配線の固定や余長処理が不適切だと、後から異音や接触不良を招くおそれがあるため、施工後の確認項目に含めましょう。');
replaceOnce('remove_unverified_truck_driving',
  '大型トラックで長距離運転をしていた筆者の感覚では、わずかな操作のしにくさや吹き出し口への干渉でも、長時間の運転では不満になりやすいと感じます。',
  '操作スイッチや吹き出し口への干渉も、普段のシート位置で確認してください。');
replaceOnce('focus_generic_notice_on_installation',
  'この記事は、ディスプレイオーディオ 取付について判断材料を整理する一般的な情報です。実際の走行可否や安全性は、車種・年式・装備の状態・路面状況・道路規制で変わります。購入・走行・作業前には、<a href="https://www.autobacs.com" target="_blank" rel="noopener">カー用品店の公式サイト</a>、販売店・整備事業者・道路管理者の最新情報を確認してください。',
  '取付可否と純正機能の維持は、車両・本体・変換部品の組み合わせで変わります。製品メーカーの車種別適合表と車両の取扱説明書を確認し、施工方法や保証は販売店・整備事業者へ相談してください。<a href="https://www.autobacs.com" target="_blank" rel="noopener">カー用品店の公式サイト</a>に施工を依頼する場合も、車両情報を伝えて実際の対応範囲を確認します。');
replaceOnce('correct_hdmi_product_scope_intro',
  '<p>端子が付いていない車でも、純正ナビ側に入力を新設できる場合があります。工賃を含んだ価格はメーカーによって大きく変わります。</p>',
  '<p>ここで比較するのは社外ディスプレイオーディオ本体の取付工賃ではなく、対応する純正ナビに映像入力を使えるようにする別施工です。<a href="https://naviokun.ocnk.net/product/227">ホンダ向け16,000円の商品</a>は既存のHDMI入力を車内へ引き出す対象ナビ向けで、入力回路のないナビには施工できません。<a href="https://naviokun.ocnk.net/product/12">トヨタ向け55,000円の商品</a>はHDMIだけの端子追加ではなく、映像・音声等を扱うオールインワンのインターフェースです。車種・ナビ型番と商品全体の機能を先に照合してください。</p>');
replaceOnce('label_different_product_scopes_in_table',
  '<tr><td>HDMI入力端子の新設（ホンダ純正ナビ・ギャザズ）</td><td>16,000円</td></tr><tr><td>純正ナビのカスタマイズ（トヨタ純正ナビ・ディスプレイオーディオ）</td><td>55,000円</td></tr><tr><td>HDMI入力の新設（メルセデス・ベンツ）</td><td>108,000円</td></tr><tr><td>HDMI入力の新設（アウディ）</td><td>108,000円</td></tr>',
  '<tr><td>対応ギャザズのHDMI入力を車内へ引き出す施工</td><td>16,000円〜</td></tr><tr><td>対象トヨタ純正ディスプレイオーディオ用オールインワン・インターフェース</td><td>55,000円〜</td></tr><tr><td>対象メルセデス・ベンツ用Android AVアダプター施工</td><td>108,000円〜</td></tr><tr><td>対象アウディ用Android AVアダプター施工</td><td>108,000円〜</td></tr>');
replaceOnce('remove_false_price_comparison',
  '<p>国産車と輸入車で差が大きいのが特徴です。ホンダ系なら16,000円で済む一方、メルセデス・ベンツやアウディは108,000円かかります。作業範囲がまったく違うためです。</p>',
  '<p>この表はメーカー別の同一工事の相場ではありません。ホンダは対応ナビのHDMI入力を引き出す施工、トヨタは多機能インターフェース、<a href="https://naviokun.ocnk.net/product/257">メルセデス・ベンツ</a>と<a href="https://naviokun.ocnk.net/product/275">アウディ</a>はAndroid AVアダプターを含む施工です。価格差をそのまま車種間の工賃差と解釈せず、必要な機能・適合型番・作業範囲をそろえて見積もってください。</p>');
const imgs = h => [...h.matchAll(/<img\b[^>]*>/g)].map(m => m[0]);
const links = h => [...h.matchAll(/\bhref=(['"])(.*?)\1/g)].map(m => m[2]);
if (JSON.stringify(imgs(before)) !== JSON.stringify(imgs(after))) throw new Error('Original image tags changed');
for (const link of links(before)) if (!links(after).includes(link)) throw new Error(`Original href missing: ${link}`);
if (after.includes('整備工場での研修経験') || after.includes('大型トラックで長距離運転')) throw new Error('Author claim remains');
fs.writeFileSync(path.join(root, '2849_proposed.raw.html'), after);
fs.writeFileSync(path.join(root, '2849_patch.json'), JSON.stringify({post_id:2849, original_modified:current.modified, changes, original_images:imgs(before).length, original_hrefs:links(before).length, proposed_hrefs:links(after).length, published:false}, null, 2));
console.log(JSON.stringify({changes:changes.length, images:imgs(before).length, original_hrefs:links(before).length, proposed_hrefs:links(after).length}));
