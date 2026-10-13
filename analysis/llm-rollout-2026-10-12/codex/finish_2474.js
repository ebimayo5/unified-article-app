const fs=require('fs'),path=require('path');const base=path.resolve(__dirname,'../snapshots/drive');
const original=fs.readFileSync(path.join(base,'backups/2474_before.raw.html'),'utf8');const ps=[...original.matchAll(/<p[^>]*>[\s\S]*?<\/p>/g)].map(m=>m[0]);let raw=original;const changes=[];
function c(before,after){if(raw.split(before).length!==2)throw Error('nonunique');raw=raw.replace(before,after);changes.push({before,after});}
function p(i,t){c(ps[i],'<p>'+t+'</p>');}
p(0,"<strong>フォレスターのHDMI位置は装着ナビと接続部品で変わります。</strong>SUBARU公式SK型カタログのパナソニック掲載機種では、外部入力ユニットを付けた場合はセンタートレイ、指定HDMI変換ケーブルを使う場合はグローブボックスです。全世代共通の位置ではないため、まずナビ品番と装着部品を確認してください。");
p(4,"<a href=\"https://www.subaru.jp/accessory/catalog/oldmodel/pdf/forester_acc_sk.pdf\" target=\"_blank\" rel=\"noopener\">SUBARU公式の旧型SKアクセサリーカタログ</a>では、パナソニックH0012SJ010SS用のHDMI/USB外部入力ユニットH0012FL900はセンタートレイに装着します。別方式のHDMI変換ケーブルH0012FJ900はグローブボックスに設置し、同ユニットと共着できません。これは掲載構成の例であり、SJ・SL型や他品番のナビへ一律に適用できません。");
p(8,"ナビの説明書で、外部映像を受ける入力方式と入力切替の手順を確認します。HDMIを別方式へ変換する構成では、画面上のソース名が「HDMI」とは限りません。端子名だけで故障と判断せず、ナビ・変換器・ケーブルそれぞれの説明書に沿って選択してください。");
p(16,"車両説明書とナビ説明書を分けて確認します。上記SK型カタログでは、DIATONE H0014SJ040SS向けの外部入力ユニットH0014AL901はUSB/AUX（音声のみ）で、パナソニック向けHDMI/USBユニットとは異なります。「外部入力ユニット」という名称だけでHDMI対応と判断しないでください。");
p(26,"Fire TV Stick等では、対応HDMI入力に加えてメーカー指定の電源と動画配信に必要なインターネット接続を確認します。車載USBから給電できるとは限りません。映らない場合は、停車中に入力切替、ケーブル・変換器、端末の出力設定、給電、通信を一つずつ照合します。");
p(28,"<a href=\"https://ebimayo5.com/archives/display-audio-mirroring-hdmi-not-working/\">HDMI・ミラーリングが映らない場合の接続条件と確認手順</a>");
p(35,"専門店にも相談する場合は、<a href=\"https://px.a8.net/svt/ejp?a8mat=44Z0VG+70FT9U+4YGQ+BW0YB&amp;a8ejpredirect=https%3A%2F%2Fnaviokun.ocnk.net%2F\" target=\"_blank\" rel=\"nofollow sponsored noopener\">ナビ男くん</a>へフォレスターの型式とナビ品番を伝え、HDMI入力の追加を扱えるか、部品と施工範囲、保証窓口を問い合わせてください。車種名だけで施工対応があるとは決めず、販売店や電装店とも条件を比較します。");
p(42,"後席への表示は、前席HDMI入力とは別にナビの出力とモニターの入力を確認します。次のステップワゴン記事は別車種の比較例で、フォレスターへの適合根拠ではありません。");
p(43,"<a href=\"https://ebimayo5.com/archives/stepwgn-rear-seat-monitor/\">別車種の比較例：ステップワゴンの後席モニターで確認する条件</a>");
p(44,"<strong>運転者が走行中にカーナビ等の画像を注視することは禁止されています。</strong><a href=\"https://www.npa.go.jp/bureau/traffic/keitai/info.html\" target=\"_blank\" rel=\"noopener\">警察庁の案内</a>に沿い、設定・接続・映像の確認は安全な場所に停車して行います。同乗者向けでも配線や端末が運転操作を妨げない配置にしてください。");
p(50,"上記SUBARU公式SKカタログの2025年10月1日価格改訂表に、対応部品と標準工賃を含む価格例があります（2026年10月13日確認）。掲載パナソニックナビ向けの部品であり、現在の車両へ追加する全作業の確定料金ではありません。");
p(51,"2種類は共着できないため、価格を足して一式と考えないでください。部品供給、自車への適合、既存ナビの脱着や追加加工を含む税込総額は販売店で見積もります。TVキャンセラーはHDMI入力を追加する部品ではなく、レーダー探知機も動画表示の代替にはなりません。");
c("<h2>端子にこだわらず「車内で映像を見る」なら別の手もある</h2>","<h2>HDMI対応部品の価格はナビ品番と条件で比較</h2>");
const table=[...original.matchAll(/<figure[\s\S]*?<\/figure>/g)].find(m=>m[0].includes('57,000円'));if(!table)throw Error('table');
c(table[0],'<figure class="wp-block-table is-style-stripes"><table><thead><tr><th>掲載部品と品番</th><th>改訂リストの税込価格</th><th>使い方と条件</th></tr></thead><tbody><tr><td>外部入力ユニット インパネ H0012FL900</td><td>13,200円（標準工賃を含む）</td><td>掲載パナソニックナビ用のHDMI/USB接続部をセンタートレイへ設置。</td></tr><tr><td>HDMI変換ケーブル H0012FJ900</td><td>4,730円（標準工賃を含む）</td><td>掲載パナソニックナビの映像入力をグローブボックスに設置する方法。上記ユニットと共着不可。</td></tr></tbody></table><figcaption class="wp-element-caption">SUBARU公式SKカタログの2025年10月1日価格改訂表。対応ナビ・取付構成を確認し、2種類の部品代を単純に合算しないでください。</figcaption></figure>');
const imgs=s=>s.match(/<img\b[^>]*>/g)||[];if(JSON.stringify(imgs(raw))!==JSON.stringify(imgs(original)))throw Error('image mismatch');for(const m of original.matchAll(/href=(['"])(.*?)\1/g))if(!raw.includes(m[2]))throw Error('link lost '+m[2]);
fs.writeFileSync(path.join(base,'drafts/2474_proposed.raw.html'),raw);fs.writeFileSync(path.join(__dirname,'2474_rewrite_patch.json'),JSON.stringify({post_id:2474,status:'verified_ready_to_publish',changes},null,2)+'\n');
function hash(s){let h=2166136261;for(const c of s.replace(/\r\n/g,'\n')){h^=c.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}return h;}
console.log(JSON.stringify({changes:changes.length,originalChars:original.length,proposedChars:raw.length,images:imgs(raw).length,originalFNV:hash(original),proposedFNV:hash(raw)}));
