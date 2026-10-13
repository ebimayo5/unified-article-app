const fs=require('fs'),path=require('path');const base=path.resolve(__dirname,'../snapshots/drive');
const original=fs.readFileSync(path.join(base,'backups/3060_before.raw.html'),'utf8');
const ps=[...original.matchAll(/<p[^>]*>[\s\S]*?<\/p>/g)].map(m=>m[0]);let raw=original;const changes=[];
function c(before,after){if(raw.split(before).length!==2)throw Error('nonunique');raw=raw.replace(before,after);changes.push({before,after});}
function p(i,t){c(ps[i],'<p>'+t+'</p>');}
p(0,'<strong>レクサスRXのHDMI端子を探すときは、販売店オプションのHDMI入力端子が装着されているかを先に確認してください。</strong>RX350の2025年9月〜用公式説明書でも、HDMI接続の案内は同オプション装着車が対象です。対応するRX純正用品カタログには取付位置の拡大図があります。自車の生産時期・装備とその図を照合してから接続部を探すと、非搭載車向けに不要なケーブルを買う失敗を避けやすくなります。');
p(3,'<a href="https://manual.lexus.jp/rx/3076/cv/ja_JP/contents/edo1749090458948.php" target="_blank" rel="noopener">RX350・2025年9月〜用の公式説明書「HDMI機器を接続する」</a>は、販売店オプションのHDMI入力端子装着車を対象にしています。説明書にHDMIの章があることだけでは、手元の車両への装着は証明できません。<a href="https://lexus.jp/models/rx/features/equipment/" target="_blank" rel="noopener">RX装備案内</a>、注文書・用品の装着記録と現車を照合しましょう。');
p(7,'<a href="https://manual.lexus.jp/rx/" target="_blank" rel="noopener">レクサス公式のRX説明書一覧</a>で、パワートレーンと生産年月に合う版を選び、「HDMI機器を接続する」「HDMIを再生する」を確認します。初度登録年と生産時期は同じとは限りません。説明書の対象とオプションの注記を読み、装着済みかを注文書または販売店照会で確かめてください。');
p(11,'<a href="https://lexus.jp/models/rx/pdf/dealer_option.pdf?p=l-tokyo#page=14" target="_blank" rel="noopener">RX純正用品カタログの冊子26ページ（PDF14ページ）</a>には、HDMI入力端子の「取付位置拡大」図が掲載されています（2026年10月13日確認）。掲載構成ではセンターコンソール周辺の接続部を図と照合できます。過去のRXや社外の延長ポートを同じ位置と決めず、自車の装着内容に合う図で確認しましょう。見つからない場合もパネルを外さず、販売店へ装着有無と位置を問い合わせてください。');
const table=[...original.matchAll(/<figure[\s\S]*?<\/figure>/g)].find(m=>m[0].includes('40,000円'));if(!table)throw Error('table');
c(table[0],'<figure class="wp-block-table"><table><thead><tr><th>見積もり項目</th><th>具体例・確認内容</th><th>注意点</th></tr></thead><tbody><tr><td>純正HDMI入力端子</td><td>RX純正用品カタログ掲載価格6,050円（税込）</td><td>取付費別。自車への適用、必要部品、既設端子の有無を確認。</td></tr><tr><td>取付工賃・追加部品</td><td>販売店に作業内容と税込総額を確認</td><td>部品代だけを施工完了の価格と考えない。</td></tr><tr><td>接続機器・ケーブル・給電</td><td>接続機器に適合する変換器、ケーブル、電源を確認</td><td>純正HDMI入力端子には給電機能がない。</td></tr></tbody></table></figure>');
const navAnchor=(ps[25].match(/<a\b[^>]*>[\s\S]*?<\/a>/g)||[])[0];
p(25,'上表の6,050円は、2026年10月13日に確認したRX純正用品カタログのHDMI入力端子の掲載価格です。別途取付費が必要で、接続機器の動作が一律に保証されるものではありません。'+navAnchor+'など専門店へ相談する場合も、HDMI入力追加に必要な部品・施工を見積もり、テレビキャンセラーや後席モニターの価格をHDMI施工費として比べないでください。');
c(ps[28],ps[28].replace('有線CarPlay対応車でUSB接続だけで完結させたい場合は、','有線CarPlayを利用するAI Boxを検討する場合は、').replace('方法があります。一方、','方法があります。ただし、対象ナビへの適合、給電・通信・視聴したいアプリの対応を別に確認してください。一方、'));
p(30,'CarPlay AI Boxは、HDMI増設とは別の接続方法を検討するときの候補です。車両に有線CarPlayがあることに加え、選ぶ製品が自車のナビ・OS・利用アプリに対応するか、給電と通信をどう用意するかを確認しましょう。RXならUSBへ挿すだけで必ず動画を見られる、という意味ではありません。商品名だけで選ばず、型番別のメーカー対応情報と返品・サポート条件を照合してください。');
p(33,'レクサス販売店には、純正アクセサリーの適用、既設装備、今回の施工内容と保証書の条件を照合してもらいます。製品保証、施工保証、車両保証は分けて、故障時の窓口・対象範囲・脱着費を確認してください。社外品の装着だけで車両全体の保証が一律に失われるとも、無条件に維持されるとも決めつけないでください。');
p(38,'映像を使う目的は、停車中の確認や同乗者・後席乗員の利用を前提に考えます。<a href="https://www.npa.go.jp/bureau/traffic/keitai/info.html" target="_blank" rel="noopener">警察庁の案内</a>のとおり、運転者が走行中に画像表示装置を注視することは禁止されています。接続や操作の確認は、安全な場所に停車して行ってください。');
// Plain URL paragraphs become actual navigable links without changing destinations.
for(const i of [19,37]){const url=ps[i].slice(3,-4);p(i,'<a href="'+url+'">'+(i===19?'HDMIが映らない場合の入力・変換器の確認手順':'後席モニターの入力・出力を確認する方法（ステップワゴンの例）')+'</a>');}
const imgs=s=>s.match(/<img\b[^>]*>/g)||[];if(JSON.stringify(imgs(raw))!==JSON.stringify(imgs(original)))throw Error('image mismatch');
for(const m of original.matchAll(/href=(['"])(.*?)\1/g))if(!raw.includes(m[2]))throw Error('link lost '+m[2]);
for(const code of ['[affi id=7]','[itemlink post_id="3069"]'])if(!raw.includes(code))throw Error('ad lost');
fs.writeFileSync(path.join(base,'drafts/3060_proposed.raw.html'),raw);
fs.writeFileSync(path.join(__dirname,'3060_rewrite_patch.json'),JSON.stringify({post_id:3060,status:'verified_ready_to_publish',changes},null,2)+'\n');
function hash(s){let h=2166136261;for(const c of s.replace(/\r\n/g,'\n')){h^=c.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}return h;}
console.log(JSON.stringify({changes:changes.length,originalChars:original.length,proposedChars:raw.length,images:imgs(raw).length,originalFNV:hash(original),proposedFNV:hash(raw)}));
