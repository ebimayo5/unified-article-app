const fs = require('fs');
const path = require('path');
const base = path.resolve(__dirname, '../snapshots/drive');
const original = fs.readFileSync(path.join(base, 'backups/872_before.raw.html'), 'utf8');
const paragraphs = [...original.matchAll(/<p[^>]*>[\s\S]*?<\/p>/g)].map(m => m[0]);
let raw = original;
const changes = [];
function replace(before, after) {
  if (raw.split(before).length !== 2) throw Error('nonunique: ' + before.slice(0, 100));
  raw = raw.replace(before, after);
  changes.push({ before, after });
}
function p(i, html) { replace(paragraphs[i], '<p>' + html + '</p>'); }

p(1, '走行中はナビの操作や映像表示が制限される機種があります。同乗者が目的地を変えたいときも、まず安全な場所に停車して操作する必要がある場合があります。テレビは、ナビにテレビチューナーが備わっている車両でのみ視聴できます。');
p(18, 'RP6/RP7/RP8型のステップワゴンには、年式や装備により異なるナビが用意されています。<a href="https://www.honda.co.jp/navi/pdf/apptable/STEPWGN_apptable_2205.pdf" target="_blank" rel="noopener">Hondaの2022年の適用表</a>には11.4インチ・9インチ・8インチのギャザズ製品が載っています。ただし画面サイズだけでは施工の適合は決まりません。<a href="https://px.a8.net/svt/ejp?a8mat=44Z0VG+70FT9U+4YGQ+BW0YB&amp;a8ejpredirect=https%3A%2F%2Fnaviokun.ocnk.net%2F" target="_blank" rel="nofollow sponsored noopener">ナビ男くん</a>の12,000円の施工は、ディーラーオプションナビ「Gathers」向けです。メーカーオプションナビは別商品なので、先にナビの種類を確認してください。');
p(26, 'DIY用の製品もありますが、価格だけで決めず、ナビ型番への適合、必要な機能、取り付け作業と保証条件まで確認してください。');
p(43, '<a href="https://px.a8.net/svt/ejp?a8mat=44Z0VG+70FT9U+4YGQ+BW0YB&amp;a8ejpredirect=https%3A%2F%2Fnaviokun.ocnk.net%2F" target="_blank" rel="nofollow sponsored noopener">ナビ男くん</a>の<a href="https://naviokun.ocnk.net/product/222" target="_blank" rel="noopener">商品ページ</a>では、ディーラーオプションのGathers向け施工を税込・工賃込み12,000円と案内しています。メーカーオプションナビは対象外で別商品です。追加のHDMI端子などを選ぶ場合は料金が変わるため、注文画面で総額を確認してください。');
p(93, '施工元はテレビキャンセラー単体の作業時間を約1時間と案内しています。予約状況や追加オプションで変わります。');
p(94, 'ステップワゴンのルーフコンソール装着車は約30分追加と案内されています。HDMI追加や後席モニターも同時に頼む場合は、予約前に作業時間と総額を個別に確認してください。');
p(97, '施工元の「車検も大丈夫」という案内だけで個々の車両の適合判断を確定せず、装着状態と受検先の確認事項を施工前に問い合わせてください。');
p(103, '<a href="https://px.a8.net/svt/ejp?a8mat=44Z0VG+70FT9U+4YGQ+BW0YB&amp;a8ejpredirect=https%3A%2F%2Fnaviokun.ocnk.net%2F" target="_blank" rel="nofollow sponsored noopener">ナビ男くん</a>は、RP6/RP7/RP8向けに走行中の同乗者によるテレビ視聴・ナビ操作ができる施工を案内しています。ただし掲載の12,000円はディーラーオプションのGathers向けで、メーカーオプションナビは別商品です。テレビチューナーがないナビではテレビを視聴できません。ナビ型番、映像ソース、追加オプションを確認してから選んでください。');
const oldTable = '<figure class="wp-block-table is-style-stripes"><table><thead><tr><th>施工メニュー</th><th>工賃コミ価格（税込）</th></tr></thead><tbody><tr><td>TVキャンセラー施工（ホンダ純正ナビ・ギャザズ）</td><td>12,000円</td></tr></tbody></table><figcaption class="wp-element-caption">ナビ男くん公式サイトの表示価格（税込・工賃コミ）。2026年9月27日時点。車種・ナビの種類・オプションにより変動します。</figcaption></figure>';
const newTable = '<figure class="wp-block-table is-style-stripes"><table><thead><tr><th>施工対象</th><th>掲載価格（税込・工賃込み）</th><th>事前確認</th></tr></thead><tbody><tr><td>ディーラーオプションナビ「Gathers」向けTVキャンセラー</td><td>12,000円</td><td>起動画面のGathersロゴとナビ型番。メーカーオプションナビは別商品。HDMI追加などのオプション料金は別途確認</td></tr></tbody></table><figcaption class="wp-element-caption"><a href="https://naviokun.ocnk.net/product/222" target="_blank" rel="noopener">施工元の商品ページ</a>を2026年10月13日に確認。テレビの視聴には対応する映像ソース・TVチューナーが必要です。</figcaption></figure>';
replace(oldTable, newTable);
const guide = '<p><strong>最初に3点を確認：</strong>①ナビ起動時に「Gathers」のロゴが出るか、②型番と年式が施工対象か、③テレビチューナーまたは使いたい映像入力が備わっているか。施工元はメーカーオプションナビをこの12,000円の商品から除外し、TVチューナーのないエントリーインターナビではテレビが見られないと明記しています。<a href="https://naviokun.ocnk.net/product/222" target="_blank" rel="noopener">適合条件の原文</a>と自車の装備表を照合してください。</p>';
const rewritten18 = changes.find(c => c.before === paragraphs[18]).after;
replace(rewritten18, rewritten18 + guide);
const imgs = s => [...s.matchAll(/<img\b[^>]*>/g)].map(m => m[0]);
if (JSON.stringify(imgs(raw)) !== JSON.stringify(imgs(original))) throw Error('image tags changed');
for (const m of original.matchAll(/href=(['"])(.*?)\1/g)) if (!raw.includes(m[2])) throw Error('link lost: ' + m[2]);
fs.mkdirSync(path.join(base, 'drafts'), {recursive: true});
fs.writeFileSync(path.join(base, 'drafts/872_proposed.raw.html'), raw);
fs.writeFileSync(path.join(__dirname, '872_rewrite_patch.json'), JSON.stringify({post_id:872,status:'reviewed_pending_publish',changes},null,2)+'\n');
console.log(JSON.stringify({changes:changes.length,images:imgs(raw).length,chars:raw.length}));
