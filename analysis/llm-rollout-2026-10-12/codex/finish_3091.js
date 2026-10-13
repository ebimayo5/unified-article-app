const fs=require('fs'),path=require('path');const base=path.resolve(__dirname,'../snapshots/drive');
const original=fs.readFileSync(path.join(base,'backups/3091_before.raw.html'),'utf8');const ps=[...original.matchAll(/<p[^>]*>[\s\S]*?<\/p>/g)].map(m=>m[0]);let raw=original;const changes=[];
function c(before,after){if(raw.split(before).length!==2)throw Error('nonunique');raw=raw.replace(before,after);changes.push({before,after});}
function p(i,t){c(ps[i],'<p>'+t+'</p>');}
p(0,"<strong>ヴェルファイアの前席用HDMI端子は、トヨタ公式FAQの掲載仕様ではセンターコンソールボックス内部です。</strong>工場装着リヤシートエンターテインメント用の後席専用HDMIは、ボックス後部にあります。ただし旧型・社外ナビ・後付けモニターまで同じとは限りません。<a href=\"https://toyota.jp/faq/show/10059.html\" target=\"_blank\" rel=\"noopener\">トヨタ公式FAQ（2026年6月現在の説明書を案内）</a>と、自車の年式・装備を照合して探しましょう。");
p(2,"上記公式FAQは、前席HDMIと工場装着の後席専用HDMIを分けています。20系・30系などの旧型、社外ナビや販売店装着モニターでは、そのまま同じ位置・配線とは判断できません。まず対応する年式の車両説明書と、装着ナビ・モニターの説明書を確認します。");
p(4,"ナビの情報画面、説明書や購入時の明細から機器名・型番を確認します。ラベルが本体裏にしかない場合も、型番確認のために自己判断でナビを外さず、販売店や施工店へ確認してください。中古車では、ナビ交換・HDMI入力配線の施工歴も聞いておきます。");
p(8,"純正仕様が上記FAQに一致する場合は、センターコンソールボックスを開けて内部のHDMI端子を確認します。旧型や増設済みの車両では、説明書の配置図に沿ってシフト周辺や小物入れも確認してください。端子の刻印を見て、USBや電源ソケットと区別します。");
p(10,"工場装着リヤシートエンターテインメントが付く掲載仕様では、後席専用HDMIはコンソールボックス後部です。前席用と後席専用を取り違えないようにします。HDMI端子が二つあっても、どちらも映像を外へ送る出力端子だという意味ではありません。");
p(19,"入力する画面を選んだうえで、接続元の出力設定を確認します。上記FAQの例では、前席HDMIの映像規格は480p・720p・1080i・VGA、工場装着後席専用は480p・576p・720p・1080p・VGAです。前後席で同じ規格とは限らないため、音だけ出るときも自車の入力仕様と機器の設定を照合してください。");
p(23,"HDMIで映像を接続するほか、外部端末の電源・通信設定も必要です。<a href=\"https://www.aboutamazon.jp/news/devices/how-to-connect-a-fire-tv-stick-to-your-tv\" target=\"_blank\" rel=\"noopener\">AmazonのFire TV Stick接続案内</a>は、テレビへの接続で同梱の電源アダプターやWi-Fi設定を案内しています。この家庭用テレビ向け手順を車内の動作保証とせず、使用機種の電源条件と車載機器の適合を確認してください。車両のUSBポートならどれでも給電できる、と判断しないようにします。");
p(25,"<a href=\"https://ebimayo5.com/archives/stepwgn-rear-seat-monitor/\">ステップワゴンを例にした後席モニター構成の整理</a>。他車種の例なので、ヴェルファイアの配線や適合は自車の説明書で確認してください。");
p(35,"工場装着システムか販売店装着オプションかを先に確認します。<a href=\"https://toyota.jp/faq/show/10056.html\" target=\"_blank\" rel=\"noopener\">トヨタの工場装着ディスプレイオーディオと販売店装着後席ディスプレイのFAQ</a>では、前後が同じモードなら同じ番組・映像・音声となり、別モードの組み合わせは可能と案内しています。この説明を工場装着後席システムや他社モニターへそのまま流用せず、装着品の組み合わせを確認してください。");
p(38,"A. トヨタ公式FAQの掲載仕様では、前席用はセンターコンソールボックス内部、工場装着リヤシートエンターテインメント用の後席専用はボックス後部です。旧型・社外ナビ・後付け装備では位置や有無が違うため、年式と装着機器の説明書を照合してください。");
c("HDMI端子は、センターコンソール周辺からナビ本体背面の順で確認する","純正仕様の公式掲載例はコンソール内部が前席用、後部が工場装着後席用。旧型・別機器は説明書で確認");
const imgs=s=>s.match(/<img\b[^>]*>/g)||[];if(JSON.stringify(imgs(raw))!==JSON.stringify(imgs(original)))throw Error('image mismatch');for(const m of original.matchAll(/href=(['"])(.*?)\1/g))if(!raw.includes(m[2]))throw Error('link lost '+m[2]);
fs.writeFileSync(path.join(base,'drafts/3091_proposed.raw.html'),raw);fs.writeFileSync(path.join(__dirname,'3091_rewrite_patch.json'),JSON.stringify({post_id:3091,status:'verified_ready_to_publish',changes},null,2)+'\n');
function hash(s){let h=2166136261;for(const c of s.replace(/\r\n/g,'\n')){h^=c.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}return h;}
console.log(JSON.stringify({changes:changes.length,originalChars:original.length,proposedChars:raw.length,images:imgs(raw).length,originalFNV:hash(original),proposedFNV:hash(raw)}));
