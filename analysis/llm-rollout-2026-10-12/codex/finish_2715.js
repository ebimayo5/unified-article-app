const fs=require('fs'),path=require('path');const base=path.resolve(__dirname,'../snapshots/drive');
const original=fs.readFileSync(path.join(base,'backups/2715_before.raw.html'),'utf8');const ps=[...original.matchAll(/<p[^>]*>[\s\S]*?<\/p>/g)].map(m=>m[0]);let raw=original;const changes=[];
function c(before,after){if(raw.split(before).length!==2)throw Error('nonunique');raw=raw.replace(before,after);changes.push({before,after});}
function p(i,t){c(ps[i],'<p>'+t+'</p>');}
p(2,'<strong>アルファードのHDMIが映らないときは、停車して入力選択・接続と給電・機器再起動・別機器比較の順に確認します。</strong>動画だけ黒い場合はアプリの出力条件、後席だけ映らない場合は後席専用入力も確認します。車両の故障と決める前に、年式・ナビ品番・前席か後席かを特定しましょう。');
p(5,'表の症状が重なる場合は、使っているHDMI端子が前席用か後席専用かを先に確認します。その入力でホーム画面や写真が出るか、動画だけ出ないかを比較してください。後席専用端子へ接続している構成では、前席に映ることを成功条件にしないでください。');
p(8,'音が出ても、映像信号が対応しているとは限りません。<a href="https://toyota.jp/faq/show/10011.html" target="_blank" rel="noopener">トヨタ公式アルファードFAQ（2026年6月現在の説明書を案内）</a>の例では、前席HDMIの映像規格は480p・720p・1080i・VGA、工場装着リヤシートエンターテインメントの後席専用入力は480p・576p・720p・1080p・VGAです。前後席で同じとは限らないため、自車の説明書と出力機器の設定を照合します。この例を旧型や別ナビへ一律に当てはめないでください。');
p(10,'ホーム画面が映り、特定の動画だけ黒くなる場合は、アプリの外部出力対応やコンテンツ保護条件を先に調べます。<a href="https://support.apple.com/ja-jp/108399" target="_blank" rel="noopener">Apple公式のDigital AVアダプタ案内</a>でも、アプリがアダプタに非対応の場合や、映画などでHDCP対応が必要な場合を説明しています。黒画面だけで断線やHDCPのどちらかに断定しないでください。');
p(18,'ケーブルが内装の隙間で強く折れていないか、コネクターに横向きの力がかかっていないかを、手が届く範囲で確認します。内装を外して配線を追う作業が必要なら、自分で引っ張らず販売店や施工店へ相談してください。');
p(24,'映像経路は「機器の映像出力→変換アダプター→HDMIケーブル→使用中の入力端子→選んだ表示先」です。前席入力と後席専用入力を混同せず、部品は一つずつ比較します。端子がHDMIでも、外部機器へ画面を送る出力端子とは限りません。');
p(34,ps[34].slice(3,-4).replace('などの外部ストリーミング端末が映らない場合は、端末の電源、起動完了、接続先入力、端末側の映像出力を分けて確認します。','などを検討する場合も、製品がHDMI出力型か、USBの有線CarPlay接続を使うAI Box型かを先に分けます。USB接続型をHDMI端子につなぐ手順では確認できません。HDMI出力型では電源・起動完了・HDMI入力選択を、USB接続型では指定USBポートと製品の車両適合を確認します。'));
p(35,'起動に必要な時間と給電方法は端末の説明書を確認します。HDMI接続型では、通電・起動完了・車両側のHDMI入力を順に確認してください。USBのCarPlay接続型では、HDMIを選ぶのではなく、その製品が指定するCarPlay接続手順を使います。');
p(39,'後席だけ映らない場合は、後席側の入力選択と、ケーブルを挿した端子を確認します。上記トヨタFAQに掲載される工場装着リヤシートエンターテインメントの例では、後席専用HDMI端子はセンターコンソール後部、前席用はボックス内部です。後付けモニターや旧型で同じ配置・接続になるとは限りません。');
p(44,'端子が未装着でも、純正ナビの改造が必ず必要とは限りません。対応する入力部品を追加できる構成、別の映像入力方式が必要な構成、増設に対応しない構成を分けて見積もります。<a href="https://toyota.jp/dop/avn/hdmi/" target="_blank" rel="noopener">トヨタの販売店装着HDMIオプション案内</a>も、設定車種・取付方法・取付費は販売店への確認事項としています。アルファード全世代共通の後付け総額は示せません（2026年10月13日確認）。');
const fee=[...original.matchAll(/<figure[\s\S]*?<\/figure>/g)].find(m=>m[0].includes('55,000円'));if(!fee)throw Error('fee');
c(fee[0],'<figure class="wp-block-table is-style-stripes"><table><thead><tr><th>見積もりで確認する項目</th><th>確認する範囲</th></tr></thead><tbody><tr><td>入力の追加</td><td>年式・ナビ品番への適合、入力部品、変換器、必要なケーブル</td></tr><tr><td>取付作業</td><td>脱着・配線・加工・内装復元・動作確認の工賃</td></tr><tr><td>後席への表示</td><td>既設モニターへ映せるか、別部品や別モニターが必要か</td></tr><tr><td>総額と保証</td><td>税込総額、持ち込み可否、点検や再脱着の費用と保証窓口</td></tr></tbody></table><figcaption class="wp-element-caption">HDMI入力を追加する費用と、映像制限の変更・後席モニター新設の費用は分けて比較します。</figcaption></figure>');
p(45,'テレビキャンセラーはHDMI入力端子を追加する部品ではありません。後席モニターの新設も、既存端子の不具合確認とは別の施工です。まず切り分けを済ませ、必要な作業だけの見積もりを依頼してください。');
p(53,ps[53].slice(3,-4).replace('有線CarPlay対応車でUSB接続だけで完結させたい場合は、','USBの有線CarPlay接続を使う方式を検討する場合は、').replace('方法があります。一方、','前に、車両の年式・ナビ品番・給電条件と対象製品の適合を照合してください。USB接続だけで動作することや後席表示までは保証できません。一方、'));
p(57,'運転者が走行中に映像を注視することは、<a href="https://www.npa.go.jp/bureau/traffic/keitai/info.html" target="_blank" rel="noopener">警察庁の案内</a>で禁止されています。配線や入力を変えてもこの注意は変わりません。設定・接続・動作確認は安全な場所に停車して行ってください。');
const imgs=s=>s.match(/<img\b[^>]*>/g)||[];if(JSON.stringify(imgs(raw))!==JSON.stringify(imgs(original)))throw Error('image mismatch');for(const m of original.matchAll(/href=(['"])(.*?)\1/g))if(!raw.includes(m[2]))throw Error('link lost '+m[2]);if(!raw.includes('[affi id=7]'))throw Error('ad lost');
fs.writeFileSync(path.join(base,'drafts/2715_proposed.raw.html'),raw);fs.writeFileSync(path.join(__dirname,'2715_rewrite_patch.json'),JSON.stringify({post_id:2715,status:'verified_ready_to_publish',changes},null,2)+'\n');
function hash(s){let h=2166136261;for(const c of s.replace(/\r\n/g,'\n')){h^=c.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}return h;}
console.log(JSON.stringify({changes:changes.length,originalChars:original.length,proposedChars:raw.length,images:imgs(raw).length,originalFNV:hash(original),proposedFNV:hash(raw)}));
