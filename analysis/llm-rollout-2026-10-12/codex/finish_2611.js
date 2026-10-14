const fs = require('fs');
const path = require('path');
const root = __dirname;
const current = JSON.parse(fs.readFileSync(path.join(root, '2611_public_rest.json'), 'utf8'));
const before = current.content.rendered;
let after = before;
const changes = [];
function replaceOnce(label, from, to) {
  const i = after.indexOf(from);
  if (i < 0 || after.indexOf(from, i + from.length) >= 0) throw new Error(`Expected one match: ${label}`);
  after = after.replace(from, to);
  changes.push(label);
}
replaceOnce('show_2026_all_model_hdmi',
  '<p>ヤリスクロスでは、グレード、メーカーオプション、販売店装着品、仕様変更によって、装着されるオーディオ機器や外部入力の条件が異なり得ます。現車にHDMI端子がすでにある車両なら、後付け施工より先に端子位置と入力切替を確認する流れになります。一方、端子がない場合でも、装着機器に対応する外部入力拡張の経路が確認できれば、施工を検討できるケースがあります。</p>',
  '<p>年式を分けて確認してください。<a href="https://toyota.jp/faq/show/11115.html">トヨタのヤリスクロスFAQ（2026年2月現在）</a>は、HDMI入力端子を全車に掲載し、タイプA端子で映像・音声を再生できると案内しています。<a href="https://manual.toyota.jp/yariscross/2603/cv/ja_JP/contents/ifa1754263219621.php">2026年2月以降の取扱説明書</a>も端子への接続方法を示します。この仕様なら後付け部品を買う前に現車の端子を確認してください。一方、<a href="https://manual.toyota.jp/yariscross/2401/cv/ja_JP/contents/rcc1685078211461.php">旧年式の公式説明書</a>ではHDMI入力端子はグレード・オプションで装備の有無があるとされています。旧年式や交換済みの画面は、対象年式の装備表と現車の入力機能を照合し、対応する外部入力拡張がある場合だけ施工を検討します。</p>');
replaceOnce('remove_unverified_long_drive_experience',
  '大型車で長時間の待機や移動を経験すると、端末をつなぐたびに配線が足元へ垂れる、小さな操作を繰り返すといった不便が積み重なります。',
  '長時間の待機や移動では、端末をつなぐたびに配線が足元へ垂れたり、小さな操作を繰り返したりする不便が積み重なります。');
replaceOnce('qualify_vendor_yaris_cross_service',
  'ナビ男くん</a>なら、純正ナビ・ディスプレイオーディオの機能拡張やHDMI接続を含む施工内容について、対応車種と希望する利用方法を照らし合わせて確認できます。',
  'ナビ男くん</a>へ相談する場合も、同店の<a href="https://naviokun.ocnk.net/product/12">55,000円の多機能インターフェース</a>にヤリスクロスの適合は明示されていません。既設HDMIの有無と画面品番を伝え、対応可否と総額を個別に照会してください。');
replaceOnce('qualify_vendor_cta',
  'ナビ男くんでヤリスクロスのHDMI施工対応と希望端子位置を確認する',
  'ナビ男くんの施工メニューを見る（ヤリスクロス適合は個別確認）');
const sectionStart = '<h2>ヤリスクロスにHDMIを後付けするといくらか</h2>';
const sectionEnd = '<h2>よくある質問</h2>';
const a = after.indexOf(sectionStart), b = after.indexOf(sectionEnd, a);
if (a < 0 || b < 0 || after.indexOf(sectionStart, a + 1) >= 0) throw new Error('Expected one price section');
after = after.slice(0, a) + '<h2>ヤリスクロスのHDMI費用は年式と装備から判断する</h2>\n<p>トヨタが2026年2月現在のヤリスクロス全車にHDMI端子を案内する仕様なら、端子を後付けする費用は原則不要です。HDMIケーブルと接続機器側の出力・給電条件を確認してください。旧年式で端子がない場合は、装着画面の型番と純正用品の適合を販売店に照会します。</p>\n<p>ナビ男くんの55,000円（税込・工賃込み、2026年9月27日時点）は対象のトヨタ純正ディスプレイオーディオ向け多機能インターフェースの表示価格です。公開商品ページにはヤリスクロスの適合が明記されておらず、全車の「HDMI端子後付け価格」ではありません。費用比較は、既設端子の有無、画面品番、実現したい機能、適合確認をそろえてから行ってください。</p>\n\n' + after.slice(b);
changes.push('replace_unverified_55000_yaris_cross_price_claim');
const imgs = h => [...h.matchAll(/<img\b[^>]*>/g)].map(m => m[0]);
const links = h => [...h.matchAll(/\bhref=([\x27"])(.*?)\1/g)].map(m => m[2]);
if (JSON.stringify(imgs(before)) !== JSON.stringify(imgs(after))) throw new Error('Original image tags changed');
for (const link of links(before)) if (!links(after).includes(link)) throw new Error(`Original href missing: ${link}`);
fs.writeFileSync(path.join(root, '2611_proposed.raw.html'), after);
fs.writeFileSync(path.join(root, '2611_patch.json'), JSON.stringify({post_id:2611, original_modified:current.modified, changes, original_images:imgs(before).length, original_hrefs:links(before).length, proposed_hrefs:links(after).length, published:false}, null, 2));
console.log(JSON.stringify({changes:changes.length, images:imgs(before).length, original_hrefs:links(before).length, proposed_hrefs:links(after).length}));
