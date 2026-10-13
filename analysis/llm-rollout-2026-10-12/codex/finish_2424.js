const fs=require('fs'),path=require('path');const base=path.resolve(__dirname,'../snapshots/drive');
const original=fs.readFileSync(path.join(base,'backups/2424_before.raw.html'),'utf8');const ps=[...original.matchAll(/<p[^>]*>[\s\S]*?<\/p>/g)].map(m=>m[0]);let raw=original;const changes=[];
function c(before,after){if(raw.split(before).length!==2)throw Error('nonunique');raw=raw.replace(before,after);changes.push({before,after});}
function p(i,t){c(ps[i],'<p>'+t+'</p>');}
p(0,"<strong>トヨタのヴォクシー公式FAQに掲載された仕様では、HDMI入力端子は前席のシフトレバー下です。</strong>ただし、80系やナビを交換した車まで同じ位置とは限りません。実車の装着機器と年式を確かめ、下記の公式案内と対応する説明書で照合してください。");
p(12,"<a href=\"https://toyota.jp/faq/show/7078.html\" target=\"_blank\" rel=\"noopener\">トヨタ公式のヴォクシー入出力端子FAQ</a>では、HDMI入力Type Aをシフトレバー下、通信用USB Type-Cをシフト横小物入れと区別しています（2026年4月の取扱説明書参照を含む掲載内容、2026年10月13日確認）。現行FAQの位置や装備を、旧型や販売店装着・社外ナビへ一律に流用しないでください。");
p(13,"公式掲載仕様なら、まずシフトレバー下のHDMI表示を確認します。以下の4か所は、販売店装着・社外ナビや施工済み配線で場所が異なる場合の確認候補です。ヴォクシー全世代に端子がある場所を示す一覧ではありません。説明書と施工明細を見て、ふたを無理に開けたり内装を外したりせず確認します。");
p(19,"公式FAQ掲載のHDMIは音声・映像の入力用で、対応映像は480p・720p・1080i・VGA、音声はLPCM 2chです。1080pを含むすべての映像形式が使えるとは判断できません。出力機器の設定と車載器の対応形式を合わせて確認してください。USBとHDMIの再生条件も別です。");
p(30,"前席のHDMI入力と、任意の社外後席モニターへ取り出せる映像出力は別です。上記公式FAQでは外部向け音声・映像出力端子はないとされています。一方、販売店装着の純正後席ディスプレイは専用の構成なので、その仕様を確認してください。");
p(31,"<a href=\"https://toyota.jp/faq/show/7079.html\" target=\"_blank\" rel=\"noopener\">トヨタの前後画面に関するFAQ</a>では、ディスプレイオーディオと販売店装着後席ディスプレイは、同じモードなら同じ番組・映像・音声となり、異なるモードの組み合わせも可能と案内しています。FAQ内の組み合わせ表で、使いたい入力と後席装備を照合してください。次のステップワゴン記事は別車種の比較用であり、ヴォクシーへの適合根拠ではありません。");
p(32,"<a href=\"https://ebimayo5.com/archives/stepwgn-rear-seat-monitor/\">別車種の例：ステップワゴンの後席モニターで確認する条件</a>");
p(45,"接続と映像の確認は安全な場所に停車して行います。運転者が走行中にカーナビ等の画像を注視することは禁止されています。<a href=\"https://www.npa.go.jp/bureau/traffic/keitai/info.html\" target=\"_blank\" rel=\"noopener\">警察庁の案内</a>と<a href=\"https://laws.e-gov.go.jp/law/335AC0000000105\" target=\"_blank\" rel=\"noopener\">道路交通法</a>を確認し、同乗者向けの機器でも運転操作や視界を妨げない配置にします。");
p(50,"<a href=\"https://ebimayo5.com/archives/car-navigation-tv-not-showing/\">カーナビのテレビが映らない場合の受信・設定の確認手順</a>");
p(55,"後付け費用はHDMIの引き出し、TVキャンセラー、後席モニターを分けて確認します。<a href=\"https://naviokun.ocnk.net/product/236\" target=\"_blank\" rel=\"noopener\">ナビ男くんの対象施工ページ</a>は90系ノア／ヴォクシー（2022年1月以降、2026年5月改良型を含む）を掲載しています。次は2026年10月13日確認の表示例です。80系や社外ナビへの適合、単独施工の可否と総額は別に問い合わせてください。");
p(56,"HDMI新設11,000円の表示を、すべてのヴォクシーに対する単独施工総額と受け取らないでください。既設端子があれば不要な施工です。見積書では基本施工と追加オプション、必要部品、給電、後席への表示確認を分け、必要のないキャンセラーまで付ける前提にしないことが大切です。");
p(57,"A. 同じとは限りません。公式FAQ掲載仕様ではHDMIはシフトレバー下ですが、80系やナビ交換車は実際のナビ品番と専用説明書で確認します。USBがあることだけではHDMI入力対応を判断できません。");
c("<h2>端子にこだわらず「車内で映像を見る」なら別の手もある</h2>","<h2>後付け費用はHDMI新設と別施工を分ける</h2>");
const fee=[...original.matchAll(/<figure[\s\S]*?<\/figure>/g)].find(m=>m[0].includes('73,100円'));if(!fee)throw Error('fee');c(fee[0],"<figure class=\"wp-block-table is-style-stripes\"><table><thead><tr><th>施工の区分</th><th>ページ掲載例（税込・工賃込み）</th><th>見積もり時の確認</th></tr></thead><tbody><tr><td>HDMI入力端子・USB給電のグローブボックスへの新設</td><td>追加オプション11,000円</td><td>対応DA背面の入力を引き出す施工。単独価格か基本施工への追加か、既設端子の有無を確認。</td></tr><tr><td>TVキャンセラー基本施工</td><td>30,000円</td><td>HDMI端子新設とは別。CarPlayナビ利用時OFF等の商品固有の注意がある。同乗者向けで運転者の注視は禁止。</td></tr><tr><td>後席モニター・プレーヤーなど</td><td>希望構成で別見積もり</td><td>画面数、製品、接続、工賃、給電を含む総額と前後表示を確認。</td></tr></tbody></table><figcaption class=\"wp-element-caption\">対象施工ページの条件付き表示例。純正部品価格、80系への適合や全構成の確定料金を示すものではありません。</figcaption></figure>");
const imgs=s=>s.match(/<img\b[^>]*>/g)||[];if(JSON.stringify(imgs(raw))!==JSON.stringify(imgs(original)))throw Error('image mismatch');for(const m of original.matchAll(/href=(['"])(.*?)\1/g))if(!raw.includes(m[2]))throw Error('link lost '+m[2]);
fs.writeFileSync(path.join(base,'drafts/2424_proposed.raw.html'),raw);fs.writeFileSync(path.join(__dirname,'2424_rewrite_patch.json'),JSON.stringify({post_id:2424,status:'verified_ready_to_publish',changes},null,2)+'\n');
function hash(s){let h=2166136261;for(const c of s.replace(/\r\n/g,'\n')){h^=c.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}return h;}
console.log(JSON.stringify({changes:changes.length,originalChars:original.length,proposedChars:raw.length,images:imgs(raw).length,originalFNV:hash(original),proposedFNV:hash(raw)}));
