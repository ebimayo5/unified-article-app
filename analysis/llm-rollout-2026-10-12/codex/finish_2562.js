const fs = require('fs');
const path = require('path');
const root = __dirname;
const current = JSON.parse(fs.readFileSync(path.join(root, '2562_public_rest.json'), 'utf8'));
const before = current.content.rendered;
let after = before;
const changes = [];
function replaceOnce(label, from, to) {
  const i = after.indexOf(from);
  if (i < 0 || after.indexOf(from, i + from.length) >= 0) throw new Error(`Expected one match: ${label}`);
  after = after.replace(from, to);
  changes.push(label);
}
replaceOnce('distinguish_nav_mirror_from_independent_hdmi',
  '<p>後席モニターに映像を送るには、ナビ本体から映像出力できる経路が必要です。純正ナビの型番によっては映像出力に対応していない場合があり、後付けしても映らないというトラブルにつながります。</p>',
  '<p>前席ナビと同じ映像を後席へ送る構成なら、ナビ側の映像出力とモニター側の入力が対応している必要があります。一方、<a href="https://www.kenwood.com/jp/car/system/rear-monitors/products/lz-1000hd/spec/">HDMI入力を備える後席モニター</a>へ外部機器を直接接続する独立再生なら、ナビの映像出力が必須とは限りません。映したい映像源と接続経路を先に決め、ナビ・モニター双方の端子規格を照合してください。</p>');
replaceOnce('qualify_rear_monitor_price',
  '<p>枚数や映像の取り出し方で金額は変わります。先に「何を映したいか」を決めてから構成を相談する順番が確実です。</p>',
  '<p>上表は車種共通の設置相場ではなく、ナビ男くんの<a href="https://naviokun.ocnk.net/product/241">トヨタ／レクサス向けSumaMoniLite（片側1枚、56,000円〜）</a>と<a href="https://naviokun.ocnk.net/product/285">ホンダ純正ギャザズ向けSumaMoniLite（59,000円〜）</a>という別商品の公開価格です。ホンダ向けはナビにHDMI出力が備わることが条件です。枚数・映像経路・画面品番・取付位置で適合と総額が変わるため、先に何を映したいかを決めて確認してください。</p>');
replaceOnce('correct_nav_required_faq',
  '<p>A. ナビの型番が映像出力に対応していれば可能な場合があります。詳しくはお使いの車種の記事で確認してください。</p>',
  '<p>A. 純正ナビと同じ映像を後席に表示するなら、ナビの映像出力とモニター入力の適合が必要です。外部HDMI機器を後席モニターへ直接つなぐ独立再生なら構成が異なります。車種・ナビ・モニターの型番と、前後で同じ映像を見たいかを販売店や施工店へ伝えてください。</p>');
replaceOnce('correct_youtube_faq',
  '<p>A. ナビ本体がミラーリングに対応していれば可能な場合がありますが、対応状況は車種・ナビ型番によって異なります。</p>',
  '<p>A. ナビの映像を後席へ出力する構成と、後席モニターのHDMI入力へストリーミング端末を直接つなぐ構成で条件が異なります。後者ではナビのミラーリング対応だけでは判断できません。モニターの入力端子、端末の給電・通信、アプリの外部表示条件を確認してください。</p>');
const imgs = h => [...h.matchAll(/<img\b[^>]*>/g)].map(m => m[0]);
const links = h => [...h.matchAll(/\bhref=([\x27"])(.*?)\1/g)].map(m => m[2]);
if (JSON.stringify(imgs(before)) !== JSON.stringify(imgs(after))) throw new Error('Original image tags changed');
for (const link of links(before)) if (!links(after).includes(link)) throw new Error(`Original href missing: ${link}`);
fs.writeFileSync(path.join(root, '2562_proposed.raw.html'), after);
fs.writeFileSync(path.join(root, '2562_patch.json'), JSON.stringify({post_id:2562, original_modified:current.modified, changes, original_images:imgs(before).length, original_hrefs:links(before).length, proposed_hrefs:links(after).length, published:false}, null, 2));
console.log(JSON.stringify({changes:changes.length, images:imgs(before).length, original_hrefs:links(before).length, proposed_hrefs:links(after).length}));
