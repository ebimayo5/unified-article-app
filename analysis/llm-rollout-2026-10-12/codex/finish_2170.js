const fs=require('fs'),path=require('path');const base=path.resolve(__dirname,'../snapshots/drive');
const original=fs.readFileSync(path.join(base,'backups/2170_before.raw.html'),'utf8');
const ps=[...original.matchAll(/<p[^>]*>[\s\S]*?<\/p>/g)].map(m=>m[0]);let raw=original;const changes=[];
function c(before,after){if(raw.split(before).length!==2)throw Error('nonunique');raw=raw.replace(before,after);changes.push({before,after});}
function p(i,t){c(ps[i],'<p>'+t+'</p>');}
p(4,'この記事の対象は初代トヨタ86（ZN6）です。<a href="https://manual.toyota.jp/86/" target="_blank" rel="noopener">トヨタの86取扱説明書一覧</a>では、初代の生産年月を2012年3月〜2021年9月、2021年10月以降を別世代として分けています。購入候補が86、GR86、旧車のAE86のどれかを車名だけでなく型式・初度登録年で確かめ、該当年式の資料を見てください。');
p(13,'広告の「支払総額」は車両価格と購入時に必要な諸費用の合計です。購入後のタイヤ・ブレーキなどの交換、任意保険の選び方、将来の税金や燃料代、突発修理まで払えるかは別に見積もります。車両価格だけが安い個体と、納車整備・保証を含む個体を同じ基準で比較してください。');
p(14,'<a href="https://www.aftc.or.jp/contents/am/shiharai/faq.html" target="_blank" rel="noopener">自動車公正取引協議会の支払総額FAQ</a>は、最低限必要な費用を含めた総額表示と、任意オプションを別にするルールを説明しています。「納車準備費用」や加入必須とされるパックが表示総額の外に追加されるなら、何の費用か書面で確認してください。購入後の消耗品交換は別予算で考えます。');
p(18,'<a href="https://www.aftc.or.jp/contents/am/kiyaku/chuuko/hitsuyou_1.html" target="_blank" rel="noopener">自動車公正取引協議会の表示案内</a>でいう修復歴は、車体の骨格に当たる部位の修正・交換歴です。「修復歴なし」は外板の補修、下回り損傷、冠水、機関状態まで問題ないという意味ではありません。パネルの隙間、塗装、下回りの大きな打痕やサビ、室内の湿気・水濡れ跡は別に確認し、気になる点を販売店へ書面で尋ねます。');
p(23,'リコールは車名や車台番号の範囲だけで対象を断定せず、<a href="https://toyota.jp/recall/" target="_blank" rel="noopener">トヨタの対象車両検索</a>に候補車の車台番号を入れ、実施済みか販売店にも確認してください。例えば<a href="https://toyota.jp/recall/2024/0126.html" target="_blank" rel="noopener">2024年の86燃料ポンプのリコール</a>は2017〜2019年生産車の一部が対象です。掲載された番号範囲に対象外車も含まれるとトヨタは注意しているため、年式だけで対象・対象外を決めません。');
p(35,'保証は販売店と車両ごとに期間・対象部品・免責・修理窓口を確認します。<a href="https://toyota.jp/ucar/about/longrun/" target="_blank" rel="noopener">トヨタのロングラン保証案内</a>では、対象の中古車に1年間・走行距離無制限の保証がありますが、消耗部品・油脂類などは対象外で、一部車両には保証が付きません。他店の保証へ同じ条件を当てはめず、社外パーツ装着車で何が対象になるか契約書で確認してください。');
p(47,'まず候補車の<strong>型式・車台番号・支払総額・納車整備・保証範囲</strong>を書面でそろえます。リコールの対象と実施状況を確認したうえで現車と試乗を見て、不明点は第三者点検を相談してください。価格が低い理由を記録や現車で説明できなければ、購入後の整備予算を残せても契約は保留にします。');
const imgs=s=>s.match(/<img\b[^>]*>/g)||[];if(JSON.stringify(imgs(raw))!==JSON.stringify(imgs(original)))throw Error('image mismatch');
for(const m of original.matchAll(/href=(['"])(.*?)\1/g))if(!raw.includes(m[2]))throw Error('link lost '+m[2]);
fs.writeFileSync(path.join(base,'drafts/2170_proposed.raw.html'),raw);
fs.writeFileSync(path.join(__dirname,'2170_rewrite_patch.json'),JSON.stringify({post_id:2170,status:'verified_ready_to_publish',changes},null,2)+'\n');
function hash(s){let h=2166136261;for(const c of s.replace(/\r\n/g,'\n')){h^=c.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}return h;}
console.log(JSON.stringify({changes:changes.length,originalChars:original.length,proposedChars:raw.length,images:imgs(raw).length,originalFNV:hash(original),proposedFNV:hash(raw)}));
