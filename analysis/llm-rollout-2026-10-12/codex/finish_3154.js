const fs = require('fs');
const path = require('path');
const base = path.resolve(__dirname, '../snapshots/drive');
const original = fs.readFileSync(path.join(base, 'backups/3154_before.raw.html'), 'utf8');
const paragraphs = [...original.matchAll(/<p[^>]*>[\s\S]*?<\/p>/g)].map(m => m[0]);
let raw = original;
const changes = [];
function replace(before, after) { if (raw.split(before).length !== 2) throw Error('nonunique: ' + before.slice(0, 80)); raw = raw.replace(before, after); changes.push({ before, after }); }
function p(i, html) { replace(paragraphs[i], '<p>' + html + '</p>'); }

p(3, 'レクサスUXのHDMI端子は全車標準ではありません。<strong>現行のレクサス純正ディーラーオプションを装着したUX300hでは、フロントセンターコンソールボックス内</strong>に設置する案内です。<a href="https://lexus.jp/models/ux/pdf/dealer_option.pdf" target="_blank" rel="noopener">UXの純正オプション資料</a>を確認し、旧年式やUX300eではその年式・車種向け資料と現車を照合してください。');
p(4, 'UX300hの<a href="https://manual.lexus.jp/ux/2512/hev/ja_JP/contents/egx1751267943074.php" target="_blank" rel="noopener">2025年12月以降の公式取扱説明書</a>は「販売店オプションのHDMI入力端子装着車」を対象に再生方法を説明しています。したがって再生メニューの説明があるだけで標準装備とは判断できません。自車の装着履歴とフロントセンターコンソールボックス内の端子表示を確認してください。');
p(10, '現行UX300hのディーラーオプションなら、<a href="https://lexus.jp/models/ux/features/option/" target="_blank" rel="noopener">レクサス公式のUXオプション案内</a>にHDMI入力端子の税込6,050円が掲載されています。<a href="https://lexus.jp/models/ux/pdf/dealer_option.pdf" target="_blank" rel="noopener">専用PDF</a>は設置位置をフロントセンターコンソールボックス内、標準取付時間を1.5時間と記載します。掲載価格だけを総額と考えず、適合、部品、取付費、ケーブル代を販売店へ確認してください。過去年式へ一律に適用できる価格ではありません。');
p(13, '現行UX300hの純正オプション装着車なら、まずフロントセンターコンソールボックス内のHDMI表示を探します。<a href="https://lexus.jp/models/ux/pdf/dealer_option.pdf" target="_blank" rel="noopener">レクサスの装着位置図</a>が根拠です。UX200・UX250h・UX300eなど旧年式や車種区分では装備・位置が異なり得るため、その車両の説明書と販売店の装着履歴を優先してください。');
p(23, '<a href="https://ebimayo5.com/archives/display-audio-mirroring-hdmi-not-working/">ディスプレイオーディオのHDMIミラーリングが映らないときの確認手順</a>');
p(29, 'レクサス純正の装着履歴と取付費は販売店へ確認します。純正以外の施工も比べるなら、<a href="https://px.a8.net/svt/ejp?a8mat=44Z0VG+70FT9U+4YGQ+BW0YB&amp;a8ejpredirect=https%3A%2F%2Fnaviokun.ocnk.net%2F" target="_blank" rel="nofollow sponsored noopener">ナビ男くん</a>などの施工店へUXの年式・ディスプレイ品番を伝え、HDMI入力の対応商品があるか先に確認してください。別車種向け商品の価格や施工条件をUXへ流用してはいけません。');
p(32, '費用の比較では、<a href="https://lexus.jp/models/ux/features/option/" target="_blank" rel="noopener">レクサス公式の現行UX用HDMI入力端子</a>の表示価格<strong>税込6,050円</strong>と、実際の取付総額を分けてください。<a href="https://lexus.jp/models/ux/pdf/dealer_option.pdf" target="_blank" rel="noopener">オプション資料</a>は標準取付時間1.5時間を示します。販売店の工賃、必要なHDMIケーブル、適合条件は別途確認します。TVキャンセラーの価格はHDMI入力を追加する費用ではありません。');
p(41, '現行UX300hの純正ディーラーオプションHDMI入力端子は、フロントセンターコンソールボックス内に設置する案内です。ただし全車標準ではありません。生産年月・UX200/250h/300h/300eの区分と装着履歴を特定し、対象の取扱説明書と現車を照合してください。');

const images = s => s.match(/<img\b[^>]*>/g) || [];
if (JSON.stringify(images(raw)) !== JSON.stringify(images(original))) throw Error('images changed');
for (const m of original.matchAll(/href=(['"])(.*?)\1/g)) if (!raw.includes(m[2]) && !raw.includes(m[2].replace(/&(?!(?:amp|quot|#\d+);)/g, '&amp;'))) throw Error('link lost ' + m[2]);
fs.writeFileSync(path.join(base, 'drafts/3154_proposed.raw.html'), raw);
fs.writeFileSync(path.join(__dirname, '3154_rewrite_patch.json'), JSON.stringify({ post_id: 3154, status: 'verified_ready_to_publish', changes }, null, 2) + '\n');
function fnv(s) { let h=2166136261; for (const c of s.replace(/\r\n/g,'\n')) { h^=c.charCodeAt(0); h=Math.imul(h,16777619)>>>0; } return h; }
console.log(JSON.stringify({ changes:changes.length, originalFNV:fnv(original), proposedFNV:fnv(raw), images:images(raw).length, chars:raw.length }));
