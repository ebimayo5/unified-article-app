const fs = require('fs');
const path = require('path');
const base = path.resolve(__dirname, '../snapshots/drive');
const original = fs.readFileSync(path.join(base, 'backups/1706_before.raw.html'), 'utf8');
const paragraphs = [...original.matchAll(/<p[^>]*>[\s\S]*?<\/p>/g)].map(m => m[0]);
let raw = original;
const changes = [];
function replace(before, after) { if (raw.split(before).length !== 2) throw Error('nonunique: ' + before.slice(0, 70)); raw = raw.replace(before, after); changes.push({ before, after }); }
function p(i, html) { replace(paragraphs[i], '<p>' + html + '</p>'); }

p(4, '現行フリード向けの<a href="https://www.honda.co.jp/navi/pdf/cable/cord_freed_2603.pdf" target="_blank" rel="noopener">Honda Access公式の接続コード資料</a>には、HDMI接続コード（品番08A40-PL0-900A）が税込6,600円と掲載されています。これは<strong>取付費を含まない部品の参考価格</strong>です。標準取付時間は単独1.0時間、対象ナビなどとの同時装着では0.5時間ですが、工賃額は販売会社に確認が必要です。<a href="https://www.honda.co.jp/navi/audio/freed/" target="_blank" rel="noopener">フリード用オーディオ公式案内</a>も確認し、車両とナビの適用を販売会社に照会してください。');
p(16, '端子を設置するだけでなく、配線が可動部に干渉せず、乗降時の引っ掛けや断線につながらない位置に収まるかを施工前に確認します。長距離移動で使うなら、ケーブルが足元に垂れない位置と、接続機器の置き場まで決めておくと使いやすくなります。');
p(22, '施工込み価格を比べる例として、<a href="https://px.a8.net/svt/ejp?a8mat=44Z0VG+70FT9U+4YGQ+BW0YB&amp;a8ejpredirect=https%3A%2F%2Fnaviokun.ocnk.net%2F" target="_blank" rel="nofollow sponsored noopener">ナビ男くん</a>の<a href="https://naviokun.ocnk.net/product/227" target="_blank" rel="noopener">HDMI新設工事の公式ページ</a>にはフリードが対応車種として載っています。ただし対象はHDMI入力を備えるディーラーオプションのギャザズナビで、メーカーオプションナビやHDMI入力のないナビにはこの工事を適用できません。');
p(23, '<a href="https://px.a8.net/svt/ejp?a8mat=44Z0VG+70FT9U+4YGQ+BW0YB&amp;a8ejpredirect=https%3A%2F%2Fnaviokun.ocnk.net%2F" target="_blank" rel="nofollow sponsored noopener">ナビ男くん</a>の<a href="https://naviokun.ocnk.net/product/227" target="_blank" rel="noopener">公式施工ページ</a>は2026年10月13日確認時点で税込16,000円と表示し、車両への取付サービスを含むと明記しています。オプションによる増額、ギャザズナビの適合、既存端子、後席モニターへの出力可否は個車ごとに確認してください。');
p(39, '費用を比べる前に、今のナビにHDMI入力があるかを確かめてください。Honda純正の接続コードは部品代と工賃が別で、専門店の施工メニューは取付込みの表示です。金額の対象範囲が違うため、同じ「端子追加」として価格だけを比べないことが大切です。');
const oldTable = '<figure class="wp-block-table is-style-stripes"><table><thead><tr><th>施工メニュー</th><th>工賃コミ価格（税込）</th></tr></thead><tbody><tr><td>TVキャンセラー施工（ホンダ純正ナビ・ギャザズ）</td><td>12,000円</td></tr><tr><td>HDMI入力端子の新設（ホンダ純正ナビ・ギャザズ）</td><td>16,000円</td></tr></tbody></table><figcaption class="wp-element-caption">ナビ男くん公式サイトの表示価格（税込・工賃コミ）。2026年9月27日時点。車種・ナビの種類・オプションにより変動します。</figcaption></figure>';
const newTable = '<figure class="wp-block-table is-style-stripes"><table><thead><tr><th>確認するメニュー</th><th>掲載価格（税込）</th><th>価格に含まれる範囲</th></tr></thead><tbody><tr><td>Honda純正HDMI接続コード（08A40-PL0-900A）</td><td>6,600円</td><td>部品の参考価格。取付費は別途</td></tr><tr><td>ナビ男くんのギャザズ用HDMI新設工事</td><td>16,000円</td><td>対象車・ナビへの取付サービス込み。追加オプションは別途</td></tr></tbody></table><figcaption class="wp-element-caption">2026年10月13日時点のHonda Access資料とナビ男くん公式施工ページを照合。適合・工賃・追加部品は車両とナビの条件で確認してください。</figcaption></figure>';
replace(oldTable, newTable);
p(40, 'ナビ自体にHDMI入力がなければ、端子だけを新設しても映像は映りません。入力がある場合でも、Fire TV Stickには給電と通信が必要で、スマホには有線映像出力対応や変換アダプター、アプリ側の出力条件が関係します。ナビ型番と使いたい機器を伝えて、施工範囲と総額を確認してください。');

// The existing SWELL button has two rel attributes and a literal '&' in href.
// WordPress' block validator renders one rel attribute and an escaped href.
// Normalize that one anchor to its expected markup without changing its target.
const buttonBefore = '<a href="https://px.a8.net/svt/ejp?a8mat=44Z0VG+70FT9U+4YGQ+BW0YB&a8ejpredirect=https%3A%2F%2Fnaviokun.ocnk.net%2F" target="_blank" rel="noopener" rel="nofollow sponsored noopener">ナビ男くんでフリードの対応車種とHDMI新設の施工条件を確認する</a>';
const buttonAfter = '<a href="https://px.a8.net/svt/ejp?a8mat=44Z0VG+70FT9U+4YGQ+BW0YB&amp;a8ejpredirect=https%3A%2F%2Fnaviokun.ocnk.net%2F" target="_blank" rel="noopener">ナビ男くんでフリードの対応車種とHDMI新設の施工条件を確認する</a>';
replace(buttonBefore, buttonAfter);

const images = s => s.match(/<img\b[^>]*>/g) || [];
if (JSON.stringify(images(raw)) !== JSON.stringify(images(original))) throw Error('images changed');
for (const m of original.matchAll(/href=(['"])(.*?)\1/g)) if (!raw.includes(m[2]) && !raw.includes(m[2].replace(/&(?!(?:amp|quot|#\d+);)/g, '&amp;'))) throw Error('link lost ' + m[2]);
fs.writeFileSync(path.join(base, 'drafts/1706_proposed.raw.html'), raw);
fs.writeFileSync(path.join(__dirname, '1706_rewrite_patch.json'), JSON.stringify({ post_id: 1706, status: 'verified_ready_to_publish', changes }, null, 2) + '\n');
function fnv(s) { let h=2166136261; for (const c of s.replace(/\r\n/g,'\n')) { h^=c.charCodeAt(0); h=Math.imul(h,16777619)>>>0; } return h; }
console.log(JSON.stringify({ changes:changes.length, originalFNV:fnv(original), proposedFNV:fnv(raw), images:images(raw).length, chars:raw.length }));
