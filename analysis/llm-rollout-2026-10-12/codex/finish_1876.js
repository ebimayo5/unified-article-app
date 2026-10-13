const fs=require('fs'),path=require('path');const base=path.resolve(__dirname,'../snapshots/drive');
const original=fs.readFileSync(path.join(base,'backups/1876_before.raw.html'),'utf8');const ps=[...original.matchAll(/<p[^>]*>[\s\S]*?<\/p>/g)].map(m=>m[0]);let raw=original;const changes=[];
function c(before,after){if(raw.split(before).length!==2)throw Error('nonunique');raw=raw.replace(before,after);changes.push({before,after});}
function p(i,t){c(ps[i],'<p>'+t+'</p>');}
p(0,"<strong>フィットのナビは、残したいカメラ・ETC・通信機能と、装着できる機器を照合して選びます。</strong>新車では工場装着オプションを注文前に確認し、交換する車では現ナビの品番と車両側パッケージを控えてください。Googleマップが目的でも、対応する純正機器を含めて比較できます。");
p(8,"<a href=\"https://www.honda.co.jp/navi/fit/\" target=\"_blank\" rel=\"noopener\">Honda公式フィットのナビ案内</a>は、工場装着のメーカーオプションと販売店装着のナビを分けています。メーカーオプションは車両注文後に受け付けられないと案内されているため、希望グレードでの設定と注文内容を商談中に確認してください。現在の掲載内容を旧型フィットへ一律に適用しないことも大切です。");
p(9,"Honda CONNECT for Gathers＋ナビ装着用スペシャルパッケージの内容と、標準装備・オプションの区分は上記フィット専用案内で確認します。<a href=\"https://www.honda.co.jp/auto/\" target=\"_blank\" rel=\"noopener\">Honda公式の車種情報</a>と自車の装備表・見積書を照合し、似た装備名だけで同じ配線や連携が使えると判断しないでください。");
p(12,"Googleマップ等を車載画面で使う場合、社外品に限らず、対応するGathersや工場装着ディスプレーも比較できます。CarPlay・Android Autoの接続方式と対応スマホを品番ごとに確認し、地図をスマホ中心にするか、内蔵ナビも使いたいかで選びます。");
p(13,"フィット専用公式案内は、Honda CONNECT対応のGathersナビ・オーディオ以外を装着した場合、車両連携機能の動作を保証できないと注意しています。社外機へ交換する場合は、カメラ、スイッチ、ETC、メーター表示、通信を個別に照合します。単にパネルへ収まることと、連携を維持できることは別です。");
p(21,"運転者が走行中にカーナビ等の画像を注視することは禁止されています。<a href=\"https://www.npa.go.jp/bureau/traffic/keitai/info.html\" target=\"_blank\" rel=\"noopener\">警察庁の案内</a>に沿い、接続や目的地設定は安全な場所に停車して行ってください。");
p(22,"後付けも検討する場合は、<a href=\"https://px.a8.net/svt/ejp?a8mat=44Z0VG+70FT9U+4YGQ+BW0YB&amp;a8ejpredirect=https%3A%2F%2Fnaviokun.ocnk.net%2F\" target=\"_blank\" rel=\"nofollow sponsored noopener\">ナビ男くん</a>へ、フィットの年式・ナビ品番・希望機能に対する施工受付の有無を問い合わせてください。車名だけで対応施工があるとは判断せず、販売店や電装店とも条件を比較します。");
p(33,"純正画面を活用したい場合も、CarPlay対応、外部入力、純正機能への影響を現ナビの説明書で確認します。機器を交換する場合と追加部品で補う場合の、実現できる機能と総額を比較してください。");
p(36,"純正画面を活かす施工も候補にする場合は、<a href=\"https://px.a8.net/svt/ejp?a8mat=44Z0VG+70FT9U+4YGQ+BW0YB&amp;a8ejpredirect=https%3A%2F%2Fnaviokun.ocnk.net%2F\" target=\"_blank\" rel=\"nofollow sponsored noopener\">ナビ男くん</a>へ、対象品番の施工可否、必要部品、保持できる純正機能、保証窓口から確認します。追加施工だけで希望機能がすべて得られるとは限りません。");
p(39,"施工前に販売店と施工店へ、配線変更の内容、ナビ・カメラ等への影響、保証窓口を確認します。製品保証・施工保証と車両保証を分け、加工しただけで全保証が失効する、または必ず保証されるとは判断しないでください。");
p(44,"ナビ交換とTVキャンセラーは別の施工です。比較に必要な価格例として、Honda公式フィット専用案内のナビ本体・取付部品の掲載合計を示します（2026年10月13日確認）。金額は取付費を含まないため、施工総額とは分けて見てください。");
p(45,"掲載合計のほか、取付費、追加アンテナ、ETCやカメラとの連携部品、必要なサービス契約を見積もります。旧型や既存ナビからの交換では追加作業が変わるため、この価格だけで載せ替えが完了するとは判断できません。");
p(50,"A. ナビ品番と施工内容ごとに確認します。TVキャンセラーはCarPlayやHDMI入力、全周囲カメラを追加する機器ではありません。運転者の走行中画像注視は禁止されており、施工可否と保証・点検時の扱いは販売店・施工店へ個別に確認してください。");
const fee=[...original.matchAll(/<figure[\s\S]*?<\/figure>/g)].find(m=>m[0].includes('19,000円'));if(!fee)throw Error('fee');c(fee[0],"<figure class=\"wp-block-table is-style-stripes\"><table><thead><tr><th>掲載機種</th><th>本体・取付部品の税込合計</th><th>含まれる掲載部品</th></tr></thead><tbody><tr><td>9インチ LXM-262ZFNi</td><td>239,800円（取付費別）</td><td>本体224,400円＋取付アタッチメント4,400円＋パネルキット11,000円</td></tr><tr><td>8インチ VXM-264ZFEi</td><td>178,200円（取付費別）</td><td>本体162,800円＋取付アタッチメント4,400円＋フェイスパネルキット11,000円</td></tr></tbody></table><figcaption class=\"wp-element-caption\">Honda公式フィット専用ページ掲載例。自車への適合、追加部品、別途取付費を販売店で確認してください。</figcaption></figure>");
const malformed=(raw.match(/<a\b[^>]*target="_blank" rel="noopener" rel="nofollow sponsored noopener"[^>]*>[\s\S]*?<\/a>/)||[])[0];if(!malformed)throw Error('duplicate rel');c(malformed,malformed.replace(' rel="noopener" rel="nofollow sponsored noopener"',' rel="nofollow sponsored noopener"'));
const imgs=s=>s.match(/<img\b[^>]*>/g)||[];if(JSON.stringify(imgs(raw))!==JSON.stringify(imgs(original)))throw Error('image mismatch');for(const m of original.matchAll(/href=(['"])(.*?)\1/g))if(!raw.includes(m[2]))throw Error('link lost '+m[2]);
fs.writeFileSync(path.join(base,'drafts/1876_proposed.raw.html'),raw);fs.writeFileSync(path.join(__dirname,'1876_rewrite_patch.json'),JSON.stringify({post_id:1876,status:'verified_ready_to_publish',changes},null,2)+'\n');
function hash(s){let h=2166136261;for(const c of s.replace(/\r\n/g,'\n')){h^=c.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}return h;}
console.log(JSON.stringify({changes:changes.length,originalChars:original.length,proposedChars:raw.length,images:imgs(raw).length,originalFNV:hash(original),proposedFNV:hash(raw)}));
