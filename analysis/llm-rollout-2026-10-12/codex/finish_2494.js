const fs=require('fs'),path=require('path');const base=path.resolve(__dirname,'../snapshots/drive');
const original=fs.readFileSync(path.join(base,'backups/2494_before.raw.html'),'utf8');const ps=[...original.matchAll(/<p[^>]*>[\s\S]*?<\/p>/g)].map(m=>m[0]);let raw=original;const changes=[];
function c(before,after){if(raw.split(before).length!==2)throw Error('nonunique');raw=raw.replace(before,after);changes.push({before,after});}
function p(i,t){c(ps[i],'<p>'+t+'</p>');}
p(0,"<strong>セレナの後席モニターだけ映らない場合は、後席の電源・入力選択と、使っている映像を後席へ出せる仕様かを先に確認します。</strong>前席に映るだけでは後席表示は保証されません。USB動画だけ出ないなど、ソースごとに症状を分け、年式・ナビ・モニター品番をそろえて切り分けましょう。");
p(5,"仕様上、前席で再生できても後席へ出せない映像があります。例として、<a href=\"https://faq2.nissan.co.jp/faq/show/7337?category_id=749&amp;site_domain=default\" target=\"_blank\" rel=\"noopener\">日産公式FAQ7337（2025年3月31日更新）</a>は、掲載するC28/GC28のNissanConnectナビでUSB動画を再生できても、ディーラーオプションの後席専用モニターでは再生できないと案内しています。この掲載構成と自車が一致するか確認し、2026年改良後や別ナビ・社外モニターへ一律に当てはめないでください。");
p(12,"<strong>運転者が走行中にカーナビ等の画像を注視することは禁止されています。</strong><a href=\"https://www.npa.go.jp/bureau/traffic/keitai/info.html\" target=\"_blank\" rel=\"noopener\">警察庁の案内</a>を確認し、接続・設定・動作確認は安全な場所に停車して行います。");
p(25,"再起動や接続し直しは、車両・ナビ・外部機器それぞれの説明書にある停止と起動の手順に従って行います。HDMI端末とUSBのCarPlay接続型AI Boxでは、接続先や起動条件が異なる場合があります。改善しなければ強制終了を繰り返さず、症状と試した手順を記録して相談してください。");
p(35,"HDMI機器は、電源・入力選択に加えて出力解像度も確認します。<a href=\"https://faq2.nissan.co.jp/faq/show/60946?category_id=67&amp;site_domain=default\" target=\"_blank\" rel=\"noopener\">日産公式のC28/GC28 HDMI案内</a>では、掲載NissanConnect構成の仕様はHDMI Type-A・720p（1280×720）で、外部プレイヤーの出力を「自動」から「720p」にする必要がある例を説明しています。これは入力条件の確認であり、その映像を後席へ出せる保証ではありません。後席出力は装着機器の説明書で別に確認します。");
p(37,"USB動画が後席に出せるかは、ナビのUSB再生対応と後席出力対応を分けて確認します。上記FAQ7337の掲載構成なら、対応ファイルへ作り直したりUSBメモリーを買い替えたりしても、後席非対応という仕様は解決しません。自車の構成が違う場合は、その品番の説明書で判断してください。");
p(39,"USBの有線CarPlay接続を使うAI Boxは、HDMI出力端末と同じ経路とは限りません。前席に出せる画面をナビから後席へ転送できるか、AI Box自体に後席向け出力があるかを分けます。HDMI分配器を追加すれば、USBで動くAI Boxの画面も必ず後席へ出せる、と考えないようにしてください。");
p(42,"<a href=\"https://ebimayo5.com/archives/display-audio-mirroring-hdmi-not-working/\">HDMI・ミラーリングが映らない場合の接続条件の整理</a>");
p(52,"A. 機器の給電・選んだ入力・映像出力条件を確かめてから、ナビと後席モニターの出力対応を確認します。C28/GC28の掲載NissanConnect仕様では、外部プレイヤーの720p設定を確認する例があります。ただしHDMI入力が映る条件と後席に表示できる条件は別です。");
p(59,"<a href=\"https://ebimayo5.com/archives/car-navigation-tv-not-showing/\">社外ナビのテレビが映らない場合の症状別確認</a>");
const imgs=s=>s.match(/<img\b[^>]*>/g)||[];if(JSON.stringify(imgs(raw))!==JSON.stringify(imgs(original)))throw Error('image mismatch');for(const m of original.matchAll(/href=(['"])(.*?)\1/g))if(!raw.includes(m[2]))throw Error('link lost '+m[2]);
fs.writeFileSync(path.join(base,'drafts/2494_proposed.raw.html'),raw);fs.writeFileSync(path.join(__dirname,'2494_rewrite_patch.json'),JSON.stringify({post_id:2494,status:'verified_ready_to_publish',changes},null,2)+'\n');
function hash(s){let h=2166136261;for(const c of s.replace(/\r\n/g,'\n')){h^=c.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}return h;}
console.log(JSON.stringify({changes:changes.length,originalChars:original.length,proposedChars:raw.length,images:imgs(raw).length,originalFNV:hash(original),proposedFNV:hash(raw)}));
