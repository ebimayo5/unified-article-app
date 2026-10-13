const fs = require('fs');
const path = require('path');
const base = path.resolve(__dirname, '../snapshots/drive');
const original = fs.readFileSync(path.join(base, 'backups/2397_before.raw.html'), 'utf8');
const paragraphs = [...original.matchAll(/<p[^>]*>[\s\S]*?<\/p>/g)].map(m => m[0]);
let raw = original;
const changes = [];
function replace(before, after) {
  if (raw.split(before).length !== 2) throw Error('nonunique text: ' + before.slice(0, 80));
  raw = raw.replace(before, after);
  changes.push({ before, after });
}
function p(index, html) { replace(paragraphs[index], '<p>' + html + '</p>'); }

p(6, '「HDMI対応ナビ」と「車内から使えるHDMI端子が施工済み」は同じ意味ではありません。日産の<a href="https://www3.nissan.co.jp/vehicles/new/serena/accessories/audio_navigation.html" target="_blank" rel="noopener">セレナ純正アクセサリー案内</a>にも、日産オリジナルナビと別のHDMI入力ユニットを組み合わせる例があります。自車のナビ品番に対応する入力ユニットと端子の装着有無を、注文書や施工明細で確認してください。');
p(7, '日産の<a href="https://faq2.nissan.co.jp/faq/show/60946?site_domain=default" target="_blank" rel="noopener">C28／GC28型セレナのHDMI端子FAQ</a>では、2022年12月以降の対象NissanConnectナビ付き車と、2026年2月以降の対象NissanConnectインフォテインメントシステム付き車について、端子を<strong>助手席アッパーボックスとグローブボックスの間</strong>と案内しています。端子はType-Aで、装着の有無はグレードごとに異なります。');
p(8, 'この案内はC28／GC28の対象システムに限ります。C27、社外ナビ、日産オリジナルナビと別売りHDMI入力ユニットの組み合わせ、後付け品に同じ位置を当てはめないでください。C28系でも、年式に合う装備表とナビの説明書で確認します。');
p(19, '後付け端子の位置は施工内容で変わります。配線を手探りでたどるより、施工明細を見直すか、施工店へ「端子の設置場所」と「ナビ側への接続状態」を確認してください。見えない配線を無理に引くとコネクターや内装を傷めるおそれがあります。');
p(23, 'ナビの入力切替は「HDMI」のほか、「ソース」「AV」「外部入力」「メディア」などの名前で表示されることがあります。画面名や操作順はナビ品番で異なるため、他車の操作動画ではなく、自車のナビ説明書に記載された名称と手順で確認します。');
p(27, '日産の<a href="https://faq2.nissan.co.jp/faq/show/60946?site_domain=default" target="_blank" rel="noopener">C28／GC28型の公式FAQ</a>は720p（1280×720）の出力を示しています。2022年12月以降のNissanConnectナビ付き車向け説明では、接続機器のHDMI 1.4b準拠・720p出力と、HDMI 1.4対応High Speedケーブルも案内しています。2026年2月以降のインフォテインメントシステム付き車にはFAQ内で別の説明があるため、年式・搭載システムに合う欄を確認してください。C27や社外ナビでは各機器の説明書を優先します。');
p(37, '<a href="https://ebimayo5.com/archives/display-audio-mirroring-hdmi-not-working/">ディスプレイオーディオのミラーリングとHDMI入力の切り分け</a>');
p(49, '<a href="https://ebimayo5.com/archives/stepwgn-rear-seat-monitor/">後席モニターの接続方式と前後独立表示の考え方</a>も参考にできます。ただし、ステップワゴンの記事中の端子・適合情報をセレナへ流用せず、セレナのナビ品番と後席モニターの仕様を確認してください。');
p(54, '<span style="background:linear-gradient(transparent 60%, #fff3a3 60%);"><strong>最初に車検証の型式、ナビ品番、注文書・装備明細を確認し、その後に端子位置と入力メニューを探すと、仕様の取り違えを避けやすくなります。</strong></span>映らない場合は、入力切替、ケーブル、変換アダプター、接続機器の出力、コンテンツ側の制限を分けて確認します。');

const images = s => s.match(/<img\b[^>]*>/g) || [];
if (JSON.stringify(images(raw)) !== JSON.stringify(images(original))) throw Error('image tags changed');
for (const m of original.matchAll(/href=(['"])(.*?)\1/g)) if (!raw.includes(m[2])) throw Error('lost link ' + m[2]);
fs.writeFileSync(path.join(base, 'drafts/2397_proposed.raw.html'), raw);
fs.writeFileSync(path.join(__dirname, '2397_rewrite_patch.json'), JSON.stringify({ post_id: 2397, status: 'verified_ready_to_publish', changes }, null, 2) + '\n');
function fnv(s) { let h = 2166136261; for (const c of s.replace(/\r\n/g, '\n')) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; }
console.log(JSON.stringify({ changes: changes.length, originalFNV: fnv(original), proposedFNV: fnv(raw), images: images(raw).length, chars: raw.length }));
