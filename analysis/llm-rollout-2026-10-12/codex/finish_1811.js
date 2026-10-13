const fs=require('fs'),path=require('path');const base=path.resolve(__dirname,'../snapshots/drive');
const original=fs.readFileSync(path.join(base,'backups/1811_before.raw.html'),'utf8');const ps=[...original.matchAll(/<p[^>]*>[\s\S]*?<\/p>/g)].map(m=>m[0]);let raw=original;const changes=[];
function c(before,after){if(raw.split(before).length!==2)throw Error('nonunique');raw=raw.replace(before,after);changes.push({before,after});}
function p(i,t){c(ps[i],'<p>'+t+'</p>');}
p(0,"<strong>社外ナビへ交換後にテレビが映らないときは、停車して「テレビ機能の有無」「画面のメッセージ」「チャンネル設定」「アンテナ・配線」の順に確認します。</strong>走行中だけ映らない場合は安全制限の可能性があり、停車中も受信できない症状と分けます。症状だけで本体故障や接続忘れに決めつけないことが大切です。");
p(1,"ナビ本体の品番と、交換直後からか・特定の場所だけか・音は出るかを控えます。自分で行うのはメニューや表示の確認までを基本とし、本体の取り外し・電源配線の変更が必要なら施工店へ相談してください。");
p(2,"交換後に受信できない場合は、地デジアンテナの未接続・接触不良・適合違いも確認候補です。<a href=\"https://manual.kenwood.com/mt/navi/mdv-d613_d413_mdr-d213/ja-JP/212065931.html\" target=\"_blank\" rel=\"noopener\">KENWOODのMDV-D613/D413/MDR-D213系公式説明書</a>でも、アンテナ接続・受信エリア・初期スキャンを切り分けています。これは掲載機種の例です。アンテナを流用できるか、端子や必要電源が合うかは自分のナビの取付説明書で確認します。");
p(4,"交換したナビでは、その機種の案内に従って地域設定とチャンネルスキャンを行います。設定名や実行条件は機種ごとに異なります。上記KENWOOD説明書の例でも、受信不良への対処として初期スキャンを案内しています。安全に停車し、受信しやすい場所で試しても登録できない場合は、その結果を施工店へ伝えてください。");
p(5,"電源・スピーカー用ハーネスと、地デジアンテナの接続部品を区別します。車種専用の電源ハーネスが付いていても、既設テレビアンテナをそのまま使える証明にはなりません。アンテナの品番・端子・給電条件・ナビ側の適合を施工店へ確認してください。テレビが映らないことだけで「配線キットとの相性」と決めないようにします。");
p(7,"配線の接続や適合が分からない場合は、まず交換を行った店舗へ、ナビ品番と画面のメッセージ、停車時の確認結果を伝えます。別の専門店にも相談するなら、<a href=\"https://px.a8.net/svt/ejp?a8mat=44Z0VG+70FT9U+4YGQ+BW0YB&amp;a8ejpredirect=https%3A%2F%2Fnaviokun.ocnk.net%2F\" target=\"_blank\" rel=\"nofollow sponsored noopener\">ナビ男くん</a>などへ対象車両とナビの点検を扱うか確認してください。車種名だけで施工対応や保証を判断せず、点検費・追加部品・税込総額を聞いてから依頼します。");
c('<h2>キャンセラーを付ける場合の費用の目安</h2>','<h2>音だけ出る場合は安全制限と受信不良を分ける</h2>');
p(10,"<a href=\"https://jpn.pioneer/ja/support/manual/navi/13cyber/?section=500\" target=\"_blank\" rel=\"noopener\">Pioneerの2013年サイバーナビ掲載機種の公式ガイド</a>は、停車してパーキングブレーキをかけたときに映像を視聴でき、走行中は映像を表示しない仕様を案内しています。自分の機種にも同様の制限があるか説明書を確認します。停車中も見えない場合は、施工店にパーキング信号などの接続確認を依頼してください。");
const fee=[...original.matchAll(/<figure[\s\S]*?<\/figure>/g)].find(m=>m[0].includes('12,000円'));if(!fee)throw Error('fee');c(fee[0],"<figure class=\"wp-block-table is-style-stripes\"><table><thead><tr><th>表示・症状</th><th>先に確認すること</th></tr></thead><tbody><tr><td>テレビのメニュー自体がない</td><td>品番のテレビ機能と必要オプション</td></tr><tr><td>受信できない・チャンネルがない</td><td>地域設定、スキャン、受信場所、アンテナ適合</td></tr><tr><td>カードに関するエラー</td><td>カードを使う機種か、説明書の装着方向と対処手順</td></tr><tr><td>停車中は見えるが走行中は音だけ</td><td>機種の安全制限。受信故障とは分ける</td></tr></tbody></table><figcaption class=\"wp-element-caption\">画面の文言を記録し、自分の機種の説明書で該当する症状を確認してください。</figcaption></figure>");
p(11,"テレビキャンセラーは、テレビチューナー・アンテナ・受信設定の代わりにはなりません。純正ナビ用の施工料金を、社外ナビの受信不良を直す費用として比較しないでください。<a href=\"https://www.npa.go.jp/bureau/traffic/keitai/info.html\" target=\"_blank\" rel=\"noopener\">警察庁は運転中のカーナビ等の画像注視を禁止</a>と案内しています。動作確認や操作は安全な場所に停車して行います。");
p(12,"A. ナビ製品の保証、取付作業の保証、車両側の保証を分けて確認します。交換しただけで車両全体の保証が失われるとは限りません。施工内容と不具合との関係、保証書・購入店の条件を確認し、新車保証中は車両販売店にも事前に相談してください。");
p(13,"A. 設定や手の届く接続部を確認する範囲と、ナビを外して電源・信号線へ手を加える作業を分けます。後者は取付説明書と車両知識が必要です。無理に分解せず、交換を行った店舗へ症状と試した設定を伝えてください。");
p(14,"A. テレビ対応、車両とアンテナへの適合、付属品の欠品、メーカーの修理対応を確認します。カードを使う機種ではカードの有無も確認してください。<a href=\"https://www.b-cas.co.jp/support/faq/category01/faq004.html\" target=\"_blank\" rel=\"noopener\">B-CAS公式FAQ</a>は、カード関連の表示とアンテナ・電波関連の表示を分けて確認するよう案内しています。カード不要の方式もあるため、すべてのナビにカードが必要とは判断しません。");
p(15,"社外ナビ交換後のテレビ不調は、テレビ対応・画面の表示・地域とチャンネル設定・受信環境・取付配線を順に確認します。音だけ出る安全制限を受信不良と混同せず、品番と再現条件を記録してから施工店へ相談すると、不要な部品購入を避けやすくなります。");
c('<h3>④配線接続キット（オプションカプラー）との相性</h3>','<h3>④既設アンテナと接続部品の適合違い</h3>');
const imgs=s=>s.match(/<img\b[^>]*>/g)||[];if(JSON.stringify(imgs(raw))!==JSON.stringify(imgs(original)))throw Error('image mismatch');for(const m of original.matchAll(/href=(['"])(.*?)\1/g))if(!raw.includes(m[2]))throw Error('link lost '+m[2]);
fs.writeFileSync(path.join(base,'drafts/1811_proposed.raw.html'),raw);fs.writeFileSync(path.join(__dirname,'1811_rewrite_patch.json'),JSON.stringify({post_id:1811,status:'verified_ready_to_publish',changes},null,2)+'\n');
function hash(s){let h=2166136261;for(const c of s.replace(/\r\n/g,'\n')){h^=c.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}return h;}
console.log(JSON.stringify({changes:changes.length,originalChars:original.length,proposedChars:raw.length,images:imgs(raw).length,originalFNV:hash(original),proposedFNV:hash(raw)}));
