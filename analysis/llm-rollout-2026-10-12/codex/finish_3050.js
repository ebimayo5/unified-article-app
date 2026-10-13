const fs=require('fs'),path=require('path');const base=path.resolve(__dirname,'../snapshots/drive');
const original=fs.readFileSync(path.join(base,'backups/3050_before.raw.html'),'utf8');const ps=[...original.matchAll(/<p[^>]*>[\s\S]*?<\/p>/g)].map(m=>m[0]);let raw=original;const changes=[];
function c(before,after){if(raw.split(before).length!==2)throw Error('nonunique');raw=raw.replace(before,after);changes.push({before,after});}
function p(i,t){c(ps[i],'<p>'+t+'</p>');}
p(0,"<strong>アクアのHDMI端子は、トヨタ公式FAQの掲載仕様ではフロントコンソール前部にあります。</strong>ただし、このFAQは2025年9月現在の説明書を案内しており、旧型・社外ナビ・後付け配線まで同じ位置とは限りません。<a href=\"https://toyota.jp/faq/show/6344.html\" target=\"_blank\" rel=\"noopener\">アクアの入出力端子に関する公式FAQ</a>と、自車の年式・装着ナビを照合して確認しましょう。");
p(9,"公式FAQの掲載構成なら、先にフロントコンソール前部のHDMI Type-A端子を確認します。USB Type-Cはフロントコンソール部にありますが、用途と端子形状は別です。旧型・社外ナビ・後付けの場合は、以下を固定位置ではなく施工状況を調べる候補として使ってください。");
p(13,"センターコンソールやグローブボックスを強く引っ張って探さず、見える範囲と説明書を照合します。ナビ脱着や配線確認が必要なら、販売店や施工店へ型番と装着履歴を伝えて確認してください。見えない配線を引っ張ると、内装や接続部を傷めるおそれがあります。");
p(16,"説明書では入力対応・接続コードに加え、映像と音声の規格を確認します。上記アクアFAQの掲載仕様は、HDMI Type-A、映像480p・720p・1080i・VGA、音声LPCM 2chです。1080pを含むあらゆる映像信号が使えるという意味ではありません。接続機器・アプリによって再生できない場合もあります。");
p(19,"<a href=\"https://ebimayo5.com/archives/display-audio-mirroring-hdmi-not-working/\">HDMI・ミラーリングが映らない場合の接続条件の整理</a>");
p(24,"Fire TV Stickなどの端末は、指定された電源と通信条件を確認します。<a href=\"https://www.aboutamazon.jp/news/devices/how-to-connect-a-fire-tv-stick-to-your-tv\" target=\"_blank\" rel=\"noopener\">Amazonの接続案内</a>は家庭用テレビへの接続と電源アダプターを説明しています。車両のUSB端子ならどれでも使えると判断せず、端末メーカーと車載入力の条件を照合してください。");
p(30,"後付けの見積もりでは、端子を使いやすい位置へ固定できるか、配線が足元・シートレール・収納の動きを妨げないかを確認します。見栄えだけでなく、ケーブルを抜き差しする際に接続部へ負荷がかからないかも確認してください。");
p(32,"<a href=\"https://ebimayo5.com/archives/stepwgn-rear-seat-monitor/\">ステップワゴンを例にした後席モニター構成の整理</a>。他車種の施工例なので、アクアへの適合は自車の装着機器で確認してください。");
p(34,"<a href=\"https://px.a8.net/svt/ejp?a8mat=44Z0VG+70FT9U+4YGQ+BW0YB&amp;a8ejpredirect=https%3A%2F%2Fnaviokun.ocnk.net%2F\" target=\"_blank\" rel=\"nofollow sponsored noopener\">ナビ男くん</a>などへ相談する際も、アクアの型式・年式とナビ品番でHDMI追加を扱えるか確認します。トヨタ純正ナビ向けの一般的なカスタマイズ料金を、アクアのHDMI増設総額としては使えません。後席モニターの新設費も、端子だけを追加する工事とは分けて比較します。");
const fee=[...original.matchAll(/<figure[\s\S]*?<\/figure>/g)].find(m=>m[0].includes('55,000円'));if(!fee)throw Error('fee');c(fee[0],"<figure class=\"wp-block-table\"><table><thead><tr><th>見積もりの項目</th><th>確認する条件</th></tr></thead><tbody><tr><td>HDMI入力の追加</td><td>自車とナビへの適合、接続コード・変換器の品番</td></tr><tr><td>施工</td><td>ナビ脱着・配線保護・端子固定・復元・動作確認の範囲</td></tr><tr><td>接続する端末</td><td>映像出力・指定電源・アプリ・必要な通信と別売品</td></tr><tr><td>後席用の表示</td><td>ナビからの出力対応、追加モニターや別配線の必要性</td></tr><tr><td>総額と保証</td><td>部品・工賃・出張等を含む税込額と点検窓口</td></tr></tbody></table><figcaption class=\"wp-element-caption\">自車への適合と作業範囲をそろえた見積もりで比較してください。</figcaption></figure>");
p(37,"既に対応する純正HDMI端子が付いているなら、入力端子を新設する工事が不要な場合があります。部品を買う前に装着状況を確定し、必要な場合にだけ、部品・工賃・保証を含めた総額を依頼してください（2026年10月13日確認）。");
p(41,"<a href=\"https://px.a8.net/svt/ejp?a8mat=44Z0VG+70FT9U+4YGQ+BW0YB&amp;a8ejpredirect=https%3A%2F%2Fnaviokun.ocnk.net%2F\" target=\"_blank\" rel=\"nofollow sponsored noopener\">ナビ男くん</a>へ専門施工を問い合わせる場合は、自車のナビ型番に対して施工を扱うか、必要部品と税込総額、施工後の点検・保証範囲を確認します。車種名だけで適合や対応を決めず、現車確認が必要かも問い合わせてください。");
p(42,"A. トヨタ公式FAQの掲載仕様ではフロントコンソール前部です。同FAQは2025年9月現在の説明書を案内しています。旧型、社外ナビ、後付け配線では位置と有無が異なる場合があるため、自車のナビ・装備と一致するか確認してください。");
const imgs=s=>s.match(/<img\b[^>]*>/g)||[];if(JSON.stringify(imgs(raw))!==JSON.stringify(imgs(original)))throw Error('image mismatch');for(const m of original.matchAll(/href=(['"])(.*?)\1/g))if(!raw.includes(m[2]))throw Error('link lost '+m[2]);
fs.writeFileSync(path.join(base,'drafts/3050_proposed.raw.html'),raw);fs.writeFileSync(path.join(__dirname,'3050_rewrite_patch.json'),JSON.stringify({post_id:3050,status:'verified_ready_to_publish',changes},null,2)+'\n');
function hash(s){let h=2166136261;for(const c of s.replace(/\r\n/g,'\n')){h^=c.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}return h;}
console.log(JSON.stringify({changes:changes.length,originalChars:original.length,proposedChars:raw.length,images:imgs(raw).length,originalFNV:hash(original),proposedFNV:hash(raw)}));
