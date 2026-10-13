const fs = require('fs');
const path = require('path');
const base = path.resolve(__dirname, '../snapshots/drive');
const original = fs.readFileSync(path.join(base, 'backups/2446_before.raw.html'), 'utf8');
const paragraphs = [...original.matchAll(/<p[^>]*>[\s\S]*?<\/p>/g)].map(m => m[0]);
let raw = original;
const changes = [];
function replace(before, after) {
  if (raw.split(before).length !== 2) throw Error('nonunique: ' + before.slice(0, 100));
  raw = raw.replace(before, after);
  changes.push({ before, after });
}
function p(i, html) { replace(paragraphs[i], '<p>' + html + '</p>'); }

const generationTable = '<figure class="wp-block-table"><table><thead><tr><th>先に分ける条件</th><th>HDMIの確認場所・方法</th><th>注意点</th></tr></thead><tbody><tr><td>40系・前席用</td><td>センターコンソールボックス内部。トヨタの現行FAQ・車両の取扱説明書を確認</td><td>前席用入力から後席への映像出力端子は公式FAQで案内されていない</td></tr><tr><td>40系・工場装着後席エンターテインメント付き</td><td>センターコンソールボックス後部の後席専用HDMI端子</td><td>後席専用入力。装備の有無と再生条件を車両ごとに確認</td></tr><tr><td>30系・旧型または社外機器装着車</td><td>年式・ナビ型番・装着オプションの取扱書と現車</td><td>40系の位置や施工商品をそのまま当てはめない</td></tr></tbody></table></figure>';
replace(paragraphs[3], '<p>アルファードのHDMI端子は、<strong>40系では前席用がセンターコンソールボックス内部、工場装着の後席エンターテインメント装着車では後席専用が同ボックス後部</strong>というのがトヨタの現行案内です。一方、30系の装備や後付け部品は別仕様です。<a href="https://toyota.jp/faq/show/10011.html" target="_blank" rel="noopener">トヨタ公式FAQ</a>と自車の年式に合う取扱説明書を先に照合すると、探す場所と使える画面を混同せずに済みます。</p>' + generationTable);

p(8, '40系なら最初にセンターコンソールボックス内部の前席用HDMI端子を確認します。工場装着のリヤシートエンターテインメントシステムがある車両では、コンソール後部に後席専用端子もあります。30系や社外機器装着車は配置が異なるため、取扱説明書と現車の入力表示を照合してください。');
p(9, '40系の前席用端子について、<a href="https://manual.toyota.jp/alphard/3115/cv/ja_JP/contents/nvch01se030405.php" target="_blank" rel="noopener">トヨタの2025年12月以降の取扱説明書</a>は、コンソールボックスを開けてHDMIケーブルを接続すると案内しています。装備の有無は仕様で異なるため、自車の生産年月に合う説明書も確認してください。');
p(11, '40系で後席用を探す場合は、工場装着リヤシートエンターテインメントシステムの有無を確認し、センターコンソールボックス後部のフタを見ます。<a href="https://manual.toyota.jp/alphard/3110/hev/ja_JP/contents/nvch01se040408.php" target="_blank" rel="noopener">トヨタの後席HDMI接続手順</a>に位置が示されています。30系や社外品の配線は別の場所にある場合があり、DVD用配線をそのまま外部HDMI入力とみなさないでください。');
p(12, 'トヨタの<a href="https://toyota.jp/faq/show/10011.html" target="_blank" rel="noopener">アルファードの入出力端子FAQ</a>は、前席用HDMIをセンターコンソールボックス内部、工場装着の後席エンターテインメント装着車の後席専用HDMIを同ボックス後部と区別しています。さらに音声・映像の出力端子はないと明記します。前席入力を後席へそのまま送れると考えず、後席で使う機器は後席専用入力と再生条件を確認してください。装備の背景は<a href="https://kinto-jp.com/magazine/k20230808-1/" target="_blank" rel="noopener">KINTOの紹介</a>も参考になりますが、端子位置はトヨタの現行資料と自車の説明書を優先します。');
p(19, '長距離移動で同乗者向けの映像環境を使うなら、配線の見た目だけでなく、乗り降りやシート移動でケーブルが引っ掛からないかも確認してください。接続機器やケーブルがコンソールボックスのフタに挟まらないことも、トヨタの取扱説明書が注意を促しています。');
p(25, '後付け施工を検討する場合は、<a href="https://naviokun.ocnk.net/product/25" target="_blank" rel="noopener">ナビ男くんの30系用オールインワン・インターフェース</a>のように、対象年式と純正ナビ仕様が限定された商品を個別に確認してください。同商品の対象はアルファード2020年1月〜2023年5月のディスプレイオーディオ車で、T-Connect SDナビ＋JBLプレミアムサウンドには非対応です。40系へ流用できるという案内ではありません。');
p(32, '<a href="https://ebimayo5.com/archives/display-audio-mirroring-hdmi-not-working/">ディスプレイオーディオのHDMIミラーリングが映らないときの確認手順</a>');
p(38, '40系の前席用HDMI入力と後席専用HDMI入力は、トヨタの公式FAQで別の端子として案内されています。同FAQは音声・映像の出力端子がないとも明記します。前席に接続した映像が純正後席ディスプレイへそのまま出ると考えず、後席用端子と再生条件を確認してください。30系の社外施工では出力経路が異なる場合があります。');
p(43, '<a href="https://ebimayo5.com/archives/stepwgn-rear-seat-monitor/">後席モニターの接続方式と前後席の表示条件</a>');
p(55, '下表の価格は<strong>30系の特定年式・ディスプレイオーディオ車向け施工例</strong>です。40系の純正HDMI端子の設置費用や、アルファード全世代に共通する後付け相場ではありません。まず前席用・後席用の装備をトヨタ資料で確認し、対象外の場合に施工店へ車台番号とナビ仕様を伝えて見積もります。');
const oldTable = '<figure class="wp-block-table is-style-stripes"><table><thead><tr><th>施工メニュー</th><th>工賃コミ価格（税込）</th></tr></thead><tbody><tr><td>純正ナビのカスタマイズ（HDMI・Blu-ray等）</td><td>55,000円</td></tr><tr><td>大画面ディスプレイへの交換（アルパイン）</td><td>412,800円</td></tr></tbody></table><figcaption class="wp-element-caption">ナビ男くん公式サイトの表示価格（税込・工賃コミ）。2026年9月27日時点。車種・ナビの種類・オプションにより変動します。</figcaption></figure>';
const newTable = '<figure class="wp-block-table is-style-stripes"><table><thead><tr><th>30系向けの施工例</th><th>掲載価格（税込）</th><th>対象と注意点</th></tr></thead><tbody><tr><td><a href="https://naviokun.ocnk.net/product/25" target="_blank" rel="noopener">オールインワン・インターフェース</a></td><td>55,000円</td><td>2020年1月〜2023年5月の対象ディスプレイオーディオ車。HDMIアダプターなど追加機器・オプションは個別確認</td></tr><tr><td><a href="https://naviokun.ocnk.net/product/260" target="_blank" rel="noopener">アルパイン11型ナビへの交換</a></td><td>412,800円</td><td>同期間の30系ディスプレイオーディオ車向け。純正後席ディスプレイは映らなくなる案内</td></tr></tbody></table><figcaption class="wp-element-caption">2026年10月13日にナビ男くん公式ページを確認。両商品とも掲載価格に車両施工サービスを含むが、オプション追加や既設機器の撤去で総額は変わる。</figcaption></figure>';
replace(oldTable, newTable);
p(56, '55,000円の商品は30系の対象ディスプレイオーディオへ映像入力環境を追加する施工で、HDMI接続には別途アダプター等の構成確認が必要です。412,800円のナビ交換はHDMIだけでなく本体・カメラ・接続ユニットを含む別案で、<a href="https://naviokun.ocnk.net/product/260" target="_blank" rel="noopener">施工元は純正後席ディスプレイが映らなくなると明記</a>しています。40系では純正の前席・後席端子を先に確認し、Fire TV Stickは給電・通信、スマホは映像出力とアプリの条件を合わせて判断してください。');
p(57, 'A. <a href="https://toyota.jp/faq/show/10011.html" target="_blank" rel="noopener">トヨタの現行FAQ</a>では40系の前席用HDMIをセンターコンソールボックス内部、工場装着の後席エンターテインメント付き車の後席専用HDMIを同ボックス後部と案内しています。Xグレードを含め、個車の装備・生産年月を取扱説明書と販売店で確認してください。');
p(62, '40系アルファードなら前席用HDMIはセンターコンソールボックス内部、工場装着の後席エンターテインメント付き車では後席専用HDMIが同ボックス後部です。30系は装着ナビやオプションで異なるため、40系の位置を当てはめず、自車の取扱説明書と現車を照合してください。');

const images = s => s.match(/<img\b[^>]*>/g) || [];
if (JSON.stringify(images(raw)) !== JSON.stringify(images(original))) throw Error('images changed');
for (const m of original.matchAll(/href=(['"])(.*?)\1/g)) if (!raw.includes(m[2]) && !raw.includes(m[2].replace(/&(?!(?:amp|quot|#\d+);)/g, '&amp;'))) throw Error('link lost ' + m[2]);
fs.writeFileSync(path.join(base, 'drafts/2446_proposed.raw.html'), raw);
fs.writeFileSync(path.join(__dirname, '2446_rewrite_patch.json'), JSON.stringify({ post_id: 2446, status: 'verified_ready_to_publish', changes }, null, 2) + '\n');
function fnv(s) { let h=2166136261; for (const c of s.replace(/\r\n/g,'\n')) { h^=c.charCodeAt(0); h=Math.imul(h,16777619)>>>0; } return h; }
console.log(JSON.stringify({ changes:changes.length, originalFNV:fnv(original), proposedFNV:fnv(raw), images:images(raw).length, chars:raw.length }));
