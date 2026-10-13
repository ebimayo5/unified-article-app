const fs=require('fs'),path=require('path');const base=path.resolve(__dirname,'../snapshots/drive');
const original=fs.readFileSync(path.join(base,'backups/1279_before.raw.html'),'utf8');const ps=[...original.matchAll(/<p[^>]*>[\s\S]*?<\/p>/g)].map(m=>m[0]);let raw=original;const changes=[];
function c(before,after){if(raw.split(before).length!==2)throw Error('nonunique');raw=raw.replace(before,after);changes.push({before,after});}
function p(i,t){c(ps[i],'<p>'+t+'</p>');}
p(0,"<strong>アルファードの後席モニター後付けは、純正画面の映像を共有する構成と、後付けモニターへ機器を直接つなぐ構成を分けて考えます。</strong>前席にHDMI入力があっても、任意の後席画面へ出力できるとは限りません。30系後期・40系の装着ナビ、モニターの入力、映したい内容を確認してから見積もってください。");
p(6,"純正のテレビ等を後席へ共有したい場合は、車載器の対応出力と後席モニターの入力を照合します。外部プレーヤーを後付けモニターへ直接接続する構成なら、車載ナビに映像出力がなくても検討できます。音声・給電・固定は別に必要です。");
p(8,"<a href=\"https://toyota.jp/faq/show/10011.html\" target=\"_blank\" rel=\"noopener\">トヨタ公式FAQのアルファード掲載仕様</a>では、後席専用HDMIは工場装着リヤシートエンターテインメントシステム装着車に備わり、センターコンソール後部にあります。前席HDMIはコンソール内部です。この純正後席用入力を、任意の社外モニター向け出力とは読み替えないでください。");
p(9,"30系後期でも、純正ナビから映像を共有するなら年式・ナビ品番・既設後席画面の確認が必要です。一方、後付けモニターへ外部プレーヤーを直接つなぐ方法は別に検討できます。「純正に後席出力がない＝後付けモニターを一切使えない」ではありません。");
p(14,"接続は、①純正ナビから後席へ出す、②外部プレーヤーから後付け画面へ直接入れる、のどちらかを先に決めます。前者は車両側の出力対応が必要ですが、後者ではモニターの入力とプレーヤーの出力を合わせます。両方へ同じ映像を送る分配は、機器の対応・映像保護・音声経路を別に確認します。");
p(15,"運転者が走行中にカーナビ等の画像を注視することは禁止されています。後席モニターは同乗者向けとして設置し、接続・設定は安全な場所に停車して行ってください。");
p(18,"次の7項目は、見積もり前に構成を整理する確認項目です。すべて埋めても適合やアプリ動作の保証にはならないため、説明書・販売店・機器メーカーで最終照合します。");
p(23,"公式FAQの後席専用HDMIは、装備された純正後席システムへの入力です。FAQ掲載仕様は、前席入力が480p・720p・1080i・VGA、後席入力が480p・576p・720p・1080p・VGAで、どちらもLPCM 2chです。前後で対応形式が同一とは限りません。自車の説明書で機器の出力設定を合わせます。");
p(26,"ストリーミング端末を直接つなぐ場合も、動画サービスの対応・認証・通信・電源条件を満たす必要があります。スマホのミラーリングより必ず安定する、すべてのアプリが再生できるとは判断できません。後席側の入力選択も説明書で確認してください。");
p(27,"既存リンクの<a href=\"https://manual.toyota.jp/alphard/3000/cv/ja_JP/contents/nvch05se100402.php\" target=\"_blank\" rel=\"noopener\">公式説明書「HDMIを再生する」</a>は、メイン画面でオーディオ選択→HDMIと操作する案内です。後席専用入力の操作は上記「後席HDMIの設定」と区別してください。前席HDMIで映ることを、後席専用HDMIの動作確認の必須条件にはしません。");
p(28,"AI Boxは車のシステム全体をAndroidへ置き換える機器ではなく、対応するUSB経路で映像等を車載画面へ送る別の端末です。<a href=\"https://ottocast.jp/products/ottoaibox-p3-pro\" target=\"_blank\" rel=\"noopener\">Ottocast P3 Proの公式仕様</a>にはHDMI出力も掲載されていますが、全AI Boxに同じ出力があるわけではありません。車載器への適合と、後席画面へ送る経路を製品別に確認します。");
p(31,"30系後期で純正ナビの映像を共有するなら、ナビの外部出力とモニター入力を確認します。外部プレーヤーを後付けモニターへ直結するなら、それぞれの対応端子・音声・給電を合わせます。必要な部品は、共有する映像源と接続先から決めてください。");
p(32,"後席モニターのない車へ純正連携型を追加する作業と、独立したHDMIモニターを設置する作業は異なります。前席ナビへのHDMI入力追加が、どちらでも必須になるわけではありません。希望する映像源に合う経路を先に選びます。");
p(34,"車載ナビからの共有に必要なインターフェースと、外部機器からの直接接続に必要なケーブルを混同しないでください。次は必要に応じて確認する部品カテゴリで、すべてを買いそろえる構成表ではありません。");
p(35,"整備学校・工場研修で車の基礎を学んだ立場から、筆者は表示確認に加えて配線固定、ケーブル保護、指定電源の使用も確認することを勧めます。取付可否の照合と施工後の仕上がり確認は、どちらも必要です。");
p(40,"iPhoneの外部表示は、端末の映像出力、対応アダプター、アプリの外部出力制限を確認します。<a href=\"https://support.apple.com/ja-jp/108399\" target=\"_blank\" rel=\"noopener\">Apple公式AVアダプター案内</a>も、アプリ非対応やHDCP・ケーブルを確認対象としています。黒画面だけで車側の故障を除外することはできません。");
p(41,"USB-C端子のiPhoneでも、すべてが有線映像出力に対応するわけではありません。<a href=\"https://support.apple.com/ja-jp/105099\" target=\"_blank\" rel=\"noopener\">Apple公式のモデル別案内</a>にはiPhone 16e等の対象外があります。正確なモデル名と見たいアプリを確認してから、周辺機器を選んでください。");
p(50,"後席だけ映らない場合も、設定が原因とは限りません。後席入力の選択、対応解像度、給電、ケーブルと分配方向、通信、アプリの外部出力対応を一つずつ照合します。車両側と機器側を、接続図に沿って確認してください。");
p(55,"TVキャンセラーは後席モニターやHDMI出力を追加する部品ではありません。純正後席システムや独立画面が、希望する入力を表示できるかを先に確認します。製品を検討する場合は自車への適合、ナビ動作、施工後の保証窓口を確認し、後席設置に一律必須とは考えないでください。");
p(56,"運転者の走行中画像注視は禁止されています。製品・施工保証と車両保証も別です。<a href=\"https://toyota.jp/faq/show/182.html\" target=\"_blank\" rel=\"noopener\">トヨタの保証案内</a>に沿って保証書の範囲・条件を確認し、個別の加工による影響は販売店へ照会してください。");
p(63,"<a href=\"https://naviokun.ocnk.net/product/241\" target=\"_blank\" rel=\"noopener\">ナビ男くんのSumaMoniLite施工ページ</a>には税込・施工込み56,000円の表示があります（2026年10月13日確認）。ただし車種・画面サイズ・枚数・追加部品で変わる表示価格で、全アルファードの確定総額ではありません。対象車として40系が掲載されており、30系後期への適合根拠にはできません。");
p(64,"この施工ページの基本経路は外部HDMI機器の映像で、純正TV・USBビデオ・Miracast・純正DVDの表示には対応しないと案内されています。別チューナー等は追加構成です。純正映像を後席へ共有したい人は、価格だけで選ばず、希望するソースを表示できる構成を別に確認してください。");
p(65,"A. 純正ナビの映像を共有するなら、対応出力やインターフェースを確認します。一方、外部プレーヤーとHDMI入力付き後席モニターを直接つなぐ構成は別に検討できます。車載ナビへHDMIを追加することが必須とは限りません。機器の対応・給電・音声・安全固定を照合してください。");
p(67,"A. どちらも端末・車載器・アプリへの適合が先です。ミラーリングはスマホの映像出力とアプリ制限、AI Boxは対応USB経路と後席向け出力の有無を確認します。AI Boxを付けるだけで純正後席へ映像が送られるとは判断できません。操作する人と通信・給電の管理方法で選んでください。");
p(70,"アルファードの後席モニター後付けは、純正映像の共有と外部機器からの直接接続を分けると、必要な部品を整理できます。自車の装着機器・映像源・後席入力を確認し、適合と税込見積もりがそろってから注文してください。");
const fee=[...original.matchAll(/<figure[\s\S]*?<\/figure>/g)].find(m=>m[0].includes('56,000円'));if(!fee)throw Error('fee');c(fee[0],"<figure class=\"wp-block-table is-style-stripes\"><table><thead><tr><th>確認する区分</th><th>掲載表示・見積もり条件</th></tr></thead><tbody><tr><td>SumaMoniLite後席シートモニター施工</td><td>税込・施工込み56,000円の表示。車種・画面サイズ・枚数を選んだ総額を確認。</td></tr><tr><td>HDMI・給電等の追加</td><td>既設端子とグレードにより別構成。40系Xグレード向けの新設等は個別確認。</td></tr><tr><td>純正TV等も見たい場合</td><td>掲載基本構成では非対応。別チューナー等の可否と追加費用を確認。</td></tr></tbody></table><figcaption class=\"wp-element-caption\">2026年10月13日確認の対象施工ページ例。30系後期を含む全仕様の確定料金ではありません。</figcaption></figure>");
c('<h3 class="wp-block-heading">パターンB：スマートAIボックスで車側をAndroid化して使う</h3>','<h3 class="wp-block-heading">パターンB：AI Boxの対応と後席向け出力を確認する</h3>');
c('<h3 class="wp-block-heading">施工先選び：電装は“対応表”より“仕上げ”で差が出る</h3>','<h3 class="wp-block-heading">施工先選びは適合と配線の仕上がりを確認する</h3>');
const imgs=s=>s.match(/<img\b[^>]*>/g)||[];if(JSON.stringify(imgs(raw))!==JSON.stringify(imgs(original)))throw Error('image mismatch');for(const m of original.matchAll(/href=(['"])(.*?)\1/g))if(!raw.includes(m[2]))throw Error('link lost '+m[2]);
fs.writeFileSync(path.join(base,'drafts/1279_proposed.raw.html'),raw);fs.writeFileSync(path.join(__dirname,'1279_rewrite_patch.json'),JSON.stringify({post_id:1279,status:'verified_ready_to_publish',changes},null,2)+'\n');
function hash(s){let h=2166136261;for(const c of s.replace(/\r\n/g,'\n')){h^=c.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}return h;}
console.log(JSON.stringify({changes:changes.length,originalChars:original.length,proposedChars:raw.length,images:imgs(raw).length,originalFNV:hash(original),proposedFNV:hash(raw)}));
