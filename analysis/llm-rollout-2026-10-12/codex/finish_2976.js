const fs = require('fs');
const path = require('path');
const base = path.resolve(__dirname, '../snapshots/drive');
const original = fs.readFileSync(path.join(base, 'backups/2976_public_20261014.raw.html'), 'utf8');
let raw = original;
const changes = [];
function replace(before, after) {
  if (raw.split(before).length !== 2) throw Error('nonunique: ' + before.slice(0, 80));
  raw = raw.replace(before, after);
  changes.push({ before, after });
}
replace('RXは同じ車名でも、年式・型式・グレード・メーカー／ディーラーオプションによって、HDMI端子の有無や確認場所が異なる可能性があります。', '現行RXのレクサス取扱説明書は、HDMI入力を「販売店オプションのHDMI入力端子装着車」に限定しています。まず装着の有無を注文書・装備明細で確認し、年式に合う説明書の端子図を見てください。');
replace('<li>RXのHDMI端子は、車名だけで場所や標準装備の有無を断定できません。</li>', '<li>現行RXのHDMI入力端子は販売店オプション。装着の有無を先に確認します。</li>');
replace('<p>現行RXのレクサス公式情報では、スマートフォンとタッチディスプレイを連携させるApple CarPlayとAndroid Autoに対応することが案内されています。ただし、スマホ連携機能とHDMI映像入力は同じ意味ではありません。車両に装備されたマルチメディアシステムやオプション構成によって、利用できる入力機能は変わります。</p>', '<p><a href="https://manual.lexus.jp/rx/3076/cv/ja_JP/contents/edo1749090458948.php" target="_blank" rel="noopener">2025年9月以降のRX350取扱説明書</a>は、HDMI接続を販売店オプションの入力端子装着車に限定しています。Apple CarPlayやAndroid Autoに対応していても、HDMI映像入力が標準で付くという意味ではありません。自車の生産年月とオプション装着状況を先に確認します。</p>');
replace('<p>大型トラックで長距離移動や待機を経験すると、小さな配線の飛び出しや端末の置き場が、乗り降りのたびに意外なストレスになりやすいと感じます。家族利用なら、後席の人がケーブルを引っ掛けないか、端末が熱を持たないか、前席の運転操作を妨げないかまで確認したいところです。</p>', '<p>端末や配線の設置は、乗降時の引っ掛かり、後席の人が触れる可能性、機器の発熱、前席の運転操作への干渉を具体的に確認します。家族で使う場合は、停車中に機器を接続して乗員の足元まで配線を点検してください。</p>');
replace('<p>レクサスRXでスマホやストリーミング端末をHDMI接続するために、自分の端末と車両の端子形状に適合する変換アダプターをあらかじめ準備しておく必要があるためです。自分のスマホや年式に合う正しい変換アダプターを選ぶことができ、車内での映像出力エラーや不要な買い間違いを防げます。下の商品候補で価格と仕様を見比べ、自分の使い方に合うものを選んでみてください。</p>', '<p>変換アダプターを購入する前に、RXのHDMI入力端子の装着とスマホ側の有線映像出力対応を確認してください。端子形状が合うだけでは映像出力できません。下の商品候補は車両適合を保証するものではないため、両側の仕様が分かってから価格と規格を比較します。</p>');
replace('<h3>レクサスRXの後付け費用の目安（工賃コミ）</h3>\n<p>目安の金額が分かると判断しやすくなります。RXの場合、HDMI入力は単独ではなく、純正ナビを全画面表示にする施工とセットで用意されています。</p>', '<h3>RXのHDMI費用は純正オプションと旧型向け社外施工を分ける</h3>\n<p>現行型RXを検討する場合は、まず販売店オプションのHDMI入力端子の装着状況を確認します。レクサスの<a href="https://lexus.jp/models/rx/pdf/dealer_option.pdf" target="_blank" rel="noopener">現行RX販売店オプション冊子</a>は端子本体6,050円（税込）と標準取付時間0.7Hを掲載しています。対象仕様と取付費を含む支払総額は販売店に確認してください。以下の社外施工の104,500円は旧型RX向けで、現行型RXのHDMI追加費用ではありません。</p>');
replace('<figure class="wp-block-table is-style-stripes"><table><thead><tr><th>施工メニュー</th><th>工賃コミ価格（税込）</th></tr></thead><tbody><tr><td>純正ナビの全画面表示＋HDMI入力の搭載</td><td>104,500円</td></tr><tr><td>TVキャンセラー施工（レクサス純正ナビ）</td><td>40,000円</td></tr><tr><td>後席用モニターの取り付け（片側1枚）</td><td>56,000円〜</td></tr><tr><td>Blu-ray／DVDプレーヤーの新設</td><td>73,100円</td></tr></tbody></table><figcaption class="wp-element-caption">ナビ男くん公式サイトの表示価格（税込・工賃コミ）。2026年9月27日時点。年式・グレード・オプションにより変動します。</figcaption></figure>', '<figure class="wp-block-table is-style-stripes"><table><thead><tr><th>対象</th><th>HDMI関連の掲載額</th><th>確認事項</th></tr></thead><tbody><tr><td>現行RXの販売店オプション冊子掲載仕様</td><td>レクサスHDMI入力端子本体6,050円（税込）</td><td>標準取付時間0.7H。年式別の装着可否と取付費は販売店へ確認</td></tr><tr><td><a href="https://naviokun.ocnk.net/product/149" target="_blank" rel="noopener">2019年9月〜2022年11月のRX・MC後</a></td><td>ナビ男くん全画面表示＋HDMI入力施工104,500円（税込・取付込み）</td><td>在庫限り・生産終了予告あり。車両仕様と追加オプションを確認</td></tr></tbody></table><figcaption class="wp-element-caption">2026年10月14日にレクサス公式冊子と施工元の商品ページを照合。商品ごとに対応年式と費用に含む範囲が異なります。</figcaption></figure>');
replace('<p>商品代と工賃が分かれていないため、見積もりを取る前に総額が分かります。ディーラーは本体代と工賃が別見積もりになるので、比べるときは合計してから見てください。</p>', '<p>社外施工の商品ページは取付込み104,500円と案内しますが、旧型RXの対象年式に限られ、追加オプションで総額が変わる場合があります。レクサス純正端子は本体額と取付費を分けて確認し、同じ車両年式・仕様で比較してください。</p>');
replace('<p>レクサスRXのHDMI端子は、年式や装備仕様によって有無と確認場所が異なる可能性があります。最初に車検証などで車両情報を確認し、取扱説明書の図示、ディスプレイの入力ソース、販売店照会の順で調べると、誤った用品選びを避けやすくなります。</p>', '<p>現行RXのHDMI入力は販売店オプションの端子装着車が対象です。最初に生産年月とオプション明細を調べ、年式に合うレクサス取扱説明書の端子図と照合します。旧型向け社外施工の価格を現行車へ当てはめず、純正端子の取付費を含む総額を販売店へ確認してください。</p>');
const imgs = s => [...s.matchAll(/<img\b[^>]*>/g)].map(m => m[0]);
if (JSON.stringify(imgs(raw)) !== JSON.stringify(imgs(original))) throw Error('images changed');
for (const m of original.matchAll(/href=(['"])(.*?)\1/g)) if (!raw.includes(m[2])) throw Error('link lost ' + m[2]);
fs.mkdirSync(path.join(base, 'drafts'), { recursive: true });
fs.writeFileSync(path.join(base, 'drafts/2976_proposed.raw.html'), raw);
fs.writeFileSync(path.join(__dirname, '2976_rewrite_patch.json'), JSON.stringify({post_id:2976,status:'reviewed_pending_publish',changes},null,2)+'\n');
console.log(JSON.stringify({changes:changes.length,images:imgs(raw).length,chars:raw.length}));
