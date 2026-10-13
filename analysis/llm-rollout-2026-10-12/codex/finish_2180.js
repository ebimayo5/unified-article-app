const fs=require('fs'),path=require('path');
const base=path.resolve(__dirname,'../snapshots/drive');
const original=fs.readFileSync(path.join(base,'backups/2180_before.raw.html'),'utf8');
const ps=[...original.matchAll(/<p[^>]*>[\s\S]*?<\/p>/g)].map(m=>m[0]);
let raw=original;const changes=[];
function c(before,after){if(raw.split(before).length!==2)throw Error('nonunique');raw=raw.replace(before,after);changes.push({before,after});}
function p(i,t){c(ps[i],'<p>'+t+'</p>');}
p(1,'<strong>購入前に確認するのは、後席を使う人数、同時に積む荷物、希望する走りの3点です。</strong>通勤中心の1〜2人利用でも、送迎や旅行で困る条件がないか実車で試してください。後席に大人を頻繁に乗せる人や大きな荷物を日常的に運ぶ人は、候補を広げて比較します。');
p(10,'<a href="https://toyota.jp/pages/contents/corollasport/001_p_001/pdf/corollasport_spec_202607.pdf" target="_blank" rel="noopener">トヨタの主要諸元表（2026年7月）</a>では、現行カローラスポーツは全長4,375mm・全幅1,790mm・全高1,460mm、乗車定員5人です。定員と、大人を乗せて荷物も積める余裕は別に確認します。後席に誰を乗せ、何を積むかを具体化して実車で判断してください。中古車は年式ごとの仕様を確認します。');
p(13,'<a href="https://toyota.jp/corollasport/usability/" target="_blank" rel="noopener">トヨタの室内空間案内</a>には荷室の使い方が掲載されています。ただし容量の数字だけでスーツケース、ベビーカー、ゴルフバッグが希望どおり入るとは判断できません。後席を使う人数と積む荷物を同時に決め、開口部と奥行き、荷物の向きまで実車で確かめてください。後席を倒して積む場合は、乗れる人数も変わります。');
p(17,'乗り心地とロードノイズは、路面や速度に加え、装着タイヤの銘柄、空気圧、摩耗状態でも印象が変わります。整備を学んだ経験からも、中古車は車種名だけで評価せず、試乗する実車のタイヤ状態と異音を確認することを勧めます。異常が気になる場合は販売店に点検内容を尋ねてください。');
p(18,'現行の<strong>2026年7月主要諸元表は1.8Lハイブリッド・前輪駆動</strong>を掲載しています。エンジンとモーターの最高出力を単純に足して車両の最高出力と考えず、発進、合流、坂道で希望する反応か試乗して判断してください。中古車は年式・駆動方式・パワートレーンを個別に確認します。');
p(22,'現行モデルの燃費や装備を中古車へそのまま当てはめないでください。2026年7月主要諸元表では、グレードによって10.5インチ、8インチのディスプレイオーディオ、オーディオレスの設定が異なります。候補の年式・グレード・装着品を車両説明と該当年式の資料で照合し、スマホ連携の有無や接続方式は実車で確認してください。');
p(27,'<a href="https://ebimayo5.com/archives/mazda-logo-not-cool/">別車種の例：デザインの好みと実用性を分けて考える</a>');
p(28,'現行主要諸元の全長4,375mm・全幅1,790mmは、駐車場に入るかを調べる出発点です。最小回転半径もグレードで5.1〜5.3mと異なります。数値だけで扱いやすいと決めず、いつもの駐車場や通勤路に近い環境で、見切り・切り返し・ドアを開ける余裕を確かめてください。');
p(31,'旅行、帰省、ベビーカー、大型の買い物などで荷物が増える人は、ワゴンやSUVも実車で比較します。カローラツーリングは荷室の形状・積み方を比べる候補です。後席の足元まで広いと推測せず、同じ前席位置で同乗者に座ってもらい、荷物も同時に積めるか確認してください。年式やグレードで装備も異なります。');
p(38,'駆動用バッテリーの寿命や交換費用を走行距離だけで決めないでください。候補車の診断結果、保証の対象部品・期間・距離条件を販売店に確認します。<a href="https://toyota.jp/ucar/about/plus/index.html" target="_blank" rel="noopener">トヨタ認定中古車の公式案内</a>は対象のハイブリッド車にシステム診断と無償のハイブリッド機構保証を設けていますが、すべての中古車へ適用される制度ではありません。保証の条件をバッテリー寿命の目安として扱わず、目の前の車両が対象か確認してください。');
p(47,'CarPlayなどの対応は、年式・グレード・装着ディスプレイの仕様で異なります。現行のG“X”にはオーディオレスの設定もあるため、車名だけで対応を判断できません。候補車の装備と説明書を照合し、接続を実車で試してください。<a href="https://www.npa.go.jp/bureau/traffic/keitai/info.html" target="_blank" rel="noopener">警察庁の案内</a>のとおり運転者による走行中の画像注視は禁止されています。設定と目的地の操作は安全な場所に停車して行います。');
p(51,'A. 荷室の形状と積み方を優先するならカローラツーリングも比較対象です。後席の広さは別に確認し、同じ前席位置で座り比べてください。低めのハッチバックの見た目や運転感覚を優先し、必要な荷物が積めるならカローラスポーツを選ぶ理由があります。');
p(53,'A. 候補車の年式・グレードと現物のオーディオ型番を販売店へ確認してください。現行でも装着画面に差があり、中古車には別年式の仕様があります。説明書を照合してスマホ連携と接続方式を実車で試し、後付けについては必要部品・保持できる機能・費用を個別に確認します。');
const imgs=s=>s.match(/<img\b[^>]*>/g)||[];
if(JSON.stringify(imgs(raw))!==JSON.stringify(imgs(original)))throw Error('image mismatch');
for(const m of original.matchAll(/href=(['"])(.*?)\1/g))if(!raw.includes(m[2]))throw Error('link lost '+m[2]);
fs.writeFileSync(path.join(base,'drafts/2180_proposed.raw.html'),raw);
fs.writeFileSync(path.join(__dirname,'2180_rewrite_patch.json'),JSON.stringify({post_id:2180,status:'verified_ready_to_publish',changes},null,2)+'\n');
function hash(s){let h=2166136261;for(const c of s.replace(/\r\n/g,'\n')){h^=c.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}return h;}
console.log(JSON.stringify({changes:changes.length,originalChars:original.length,proposedChars:raw.length,images:imgs(raw).length,originalFNV:hash(original),proposedFNV:hash(raw)}));
